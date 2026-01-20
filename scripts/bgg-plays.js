#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function printHelp() {
  // Keep this in sync with parseArgs().
  console.log(
    [
      "Fetch BoardGameGeek (BGG) plays XML and write it to data.xml.",
      "",
      "Usage:",
      "  node scripts/bgg-plays.js --username <name> [--all] [--mindate YYYY-MM-DD] [--maxdate YYYY-MM-DD] [--output data.xml]",
      "",
      "Options:",
      "  --username <name>     BGG username (required)",
      "  --token <token>       BGG XML API bearer token (or use env BGG_TOKEN / VITE_BGG_TOKEN / .env)",
      "  --page <n>            Fetch a single page (default: 1)",
      "  --all                 Fetch all pages and merge into one <plays> document",
      "  --mindate <date>      Filter plays from this date (YYYY-MM-DD)",
      "  --maxdate <date>      Filter plays up to this date (YYYY-MM-DD)",
      "  --subtype <value>     BGG subtype filter (default: boardgame)",
      "  --output <path>       Output file path (default: data.xml)",
      "  --stdout              Print XML to stdout instead of writing a file",
      "  --verbose             Log progress",
      "  --max-attempts <n>    Max queue-poll attempts (default: 25)",
      "  --sleep-ms <ms>       Initial poll wait in ms (default: 2000)",
      "  -h, --help            Show help",
      "",
      "Notes:",
      "  - BGG may return HTTP 202 while it queues your request; this script polls until ready.",
      "  - For large histories, use --all to fetch every page.",
    ].join("\n"),
  );
}

function parseDotEnvFile(contents) {
  const env = {};
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    env[key] = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return env;
}

function tryLoadDotEnvFromCwd() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const contents = fs.readFileSync(envPath, "utf8");
    return parseDotEnvFile(contents);
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {
    all: false,
    page: 1,
    subtype: "boardgame",
    output: "data.xml",
    stdout: false,
    verbose: false,
    maxAttempts: 25,
    sleepMs: 2000,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--all") {
      args.all = true;
      continue;
    }
    if (token === "--stdout") {
      args.stdout = true;
      continue;
    }
    if (token === "--verbose") {
      args.verbose = true;
      continue;
    }

    const next = argv[i + 1];
    const readValue = () => {
      if (!next || next.startsWith("-")) {
        throw new Error(`Missing value for ${token}`);
      }
      i++;
      return next;
    };

    if (token === "--username") args.username = readValue();
    else if (token === "--token") args.token = readValue();
    else if (token === "--page") args.page = Number(readValue());
    else if (token === "--mindate") args.mindate = readValue();
    else if (token === "--maxdate") args.maxdate = readValue();
    else if (token === "--subtype") args.subtype = readValue();
    else if (token === "--output" || token === "-o") args.output = readValue();
    else if (token === "--max-attempts") args.maxAttempts = Number(readValue());
    else if (token === "--sleep-ms") args.sleepMs = Number(readValue());
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (Number.isNaN(args.page) || args.page < 1) {
    throw new Error("--page must be a positive integer");
  }
  if (Number.isNaN(args.maxAttempts) || args.maxAttempts < 1) {
    throw new Error("--max-attempts must be a positive integer");
  }
  if (Number.isNaN(args.sleepMs) || args.sleepMs < 0) {
    throw new Error("--sleep-ms must be a non-negative integer");
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPlaysUrl({ username, page, mindate, maxdate, subtype }) {
  const url = new URL("https://boardgamegeek.com/xmlapi2/plays");
  url.searchParams.set("username", username);
  url.searchParams.set("page", String(page));
  if (subtype) url.searchParams.set("subtype", subtype);
  if (mindate) url.searchParams.set("mindate", mindate);
  if (maxdate) url.searchParams.set("maxdate", maxdate);
  return url;
}

function parsePlaysRootAttrs(xml) {
  const m = xml.match(/<plays\b([^>]*)>/i);
  if (!m) return null;
  return m[1];
}

function getAttrFromPlaysRoot(xml, attrName) {
  const root = xml.match(/<plays\b[^>]*>/i);
  if (!root) return null;
  const re = new RegExp(`\\b${attrName}="([^"]*)"`, "i");
  const m = root[0].match(re);
  return m ? m[1] : null;
}

function extractPlayBlocks(xml) {
  const plays = [];
  let index = 0;

  while (true) {
    const start = xml.indexOf("<play ", index);
    if (start === -1) break;
    const end = xml.indexOf("</play>", start);
    if (end === -1) {
      throw new Error("Malformed XML: missing </play> closing tag");
    }
    plays.push(xml.slice(start, end + "</play>".length));
    index = end + "</play>".length;
  }

  return plays;
}

function playId(playXml) {
  const m = playXml.match(/<play\b[^>]*\bid="(\d+)"/i);
  return m ? m[1] : null;
}

function xmlProlog(xml) {
  const m = xml.match(/^\s*<\?xml[^>]*\?>/i);
  return m ? m[0] : '<?xml version="1.0" encoding="utf-8"?>';
}

function isQueueResponse(status, body) {
  if (status === 202) return true;
  const normalized = body.toLowerCase();
  return normalized.includes("has been accepted") && normalized.includes("processed");
}

async function fetchXmlWithQueue(url, { maxAttempts, sleepMs, verbose, token }) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("This script requires Node.js with built-in fetch (Node 18+).");
  }

  let delayMs = sleepMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers = { "user-agent": "game-tracker-cli/1.0 (plays fetch)" };
    if (token) headers.authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      headers,
    });
    const body = await response.text();

    if (isQueueResponse(response.status, body)) {
      if (verbose) {
        console.error(
          `BGG queued request (attempt ${attempt}/${maxAttempts}); waiting ${delayMs}ms...`,
        );
      }
      await sleep(delayMs);
      delayMs = Math.min(Math.floor(delayMs * 1.5 + 250), 20_000);
      continue;
    }

    if (response.status === 429) {
      if (verbose) {
        console.error(
          `BGG rate-limited request (attempt ${attempt}/${maxAttempts}); waiting ${delayMs}ms...`,
        );
      }
      await sleep(delayMs);
      delayMs = Math.min(Math.floor(delayMs * 1.5 + 250), 30_000);
      continue;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          `BGG request failed: 401 Unauthorized (missing/invalid token).\n` +
            `Set --token, or env BGG_TOKEN / VITE_BGG_TOKEN (or .env).`,
        );
      }
      throw new Error(`BGG request failed: ${response.status} ${response.statusText}\n${body}`);
    }

    return body;
  }

  throw new Error(`BGG request stayed queued after ${maxAttempts} attempts: ${url.toString()}`);
}

function mergePagesXml(pagesXml) {
  if (pagesXml.length === 0) {
    throw new Error("No XML pages to merge");
  }

  const prolog = xmlProlog(pagesXml[0]);
  const rootAttrs = parsePlaysRootAttrs(pagesXml[0]) ?? "";

  const unique = new Map();
  for (const xml of pagesXml) {
    for (const play of extractPlayBlocks(xml)) {
      const id = playId(play);
      if (id) {
        if (!unique.has(id)) unique.set(id, play);
      } else {
        unique.set(`__noid__${unique.size}`, play);
      }
    }
  }

  const plays = [...unique.values()].join("\n");
  const total = String(unique.size);

  let mergedRootAttrs = rootAttrs;
  if (/\btotal="/i.test(mergedRootAttrs)) {
    mergedRootAttrs = mergedRootAttrs.replace(/\btotal="[^"]*"/i, `total="${total}"`);
  } else {
    mergedRootAttrs = `${mergedRootAttrs} total="${total}"`;
  }
  if (/\bpage="/i.test(mergedRootAttrs)) {
    mergedRootAttrs = mergedRootAttrs.replace(/\bpage="[^"]*"/i, 'page="1"');
  } else {
    mergedRootAttrs = `${mergedRootAttrs} page="1"`;
  }

  return `${prolog}<plays${mergedRootAttrs}>\n${plays}\n</plays>\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.username) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const dotEnv = tryLoadDotEnvFromCwd();
  const token =
    (args.token ||
      process.env.BGG_TOKEN ||
      process.env.VITE_BGG_TOKEN ||
      dotEnv?.BGG_TOKEN ||
      dotEnv?.VITE_BGG_TOKEN ||
      "")?.trim() || null;

  const log = (...parts) => {
    if (args.verbose) console.error(...parts);
  };

  const fetchOnePage = async (page) => {
    const url = buildPlaysUrl({
      username: args.username,
      page,
      mindate: args.mindate,
      maxdate: args.maxdate,
      subtype: args.subtype,
    });
    log(`GET ${url.toString()}`);
    return await fetchXmlWithQueue(url, {
      maxAttempts: args.maxAttempts,
      sleepMs: args.sleepMs,
      verbose: args.verbose,
      token,
    });
  };

  if (!args.all) {
    const xml = await fetchOnePage(args.page);
    if (args.stdout) {
      process.stdout.write(xml);
      return;
    }
    const outPath = path.resolve(process.cwd(), args.output);
    fs.writeFileSync(outPath, xml, "utf8");
    log(`Wrote ${outPath}`);
    return;
  }

  const firstXml = await fetchOnePage(1);
  const totalStr = getAttrFromPlaysRoot(firstXml, "total");
  const total = totalStr ? Number(totalStr) : null;
  const perPage = Math.max(1, extractPlayBlocks(firstXml).length);
  const estimatedPages = total ? Math.max(1, Math.ceil(total / 100)) : 1;

  log(`First page has ${perPage} plays; total=${totalStr ?? "unknown"}; pages≈${estimatedPages}`);

  const pages = [firstXml];
  for (let page = 2; page <= estimatedPages; page++) {
    pages.push(await fetchOnePage(page));
  }

  const merged = mergePagesXml(pages);
  if (args.stdout) {
    process.stdout.write(merged);
    return;
  }

  const outPath = path.resolve(process.cwd(), args.output);
  fs.writeFileSync(outPath, merged, "utf8");
  log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
