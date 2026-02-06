#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

process.stdout.on('error', (err) => {
  if (err?.code === 'EPIPE') process.exit(0)
})

function printHelp() {
  // Keep this in sync with parseArgs().
  console.log(
    [
      'Fetch BoardGameGeek (BGG) plays XML and print/write parsed JSON.',
      '',
      'Usage:',
      '  node scripts/bgg-plays-json.js --username <name> [--all] [--mindate YYYY-MM-DD] [--maxdate YYYY-MM-DD] [--output plays.json]',
      '',
      'Options:',
      '  --username <name>     BGG username (required)',
      '  --token <token>       Bearer token (or use env BGG_TOKEN / VITE_BGG_TOKEN / .env)',
      '  --base-url <url>      Base URL for xmlapi2 (default: https://boardgamegeek.com/xmlapi2)',
      '  --xml-file <path>     Parse plays from a local XML file (skips network fetch)',
      '  --page <n>            Fetch a single page (default: 1)',
      '  --all                 Fetch all pages and merge by play id',
      '  --mindate <date>      Filter plays from this date (YYYY-MM-DD)',
      '  --maxdate <date>      Filter plays up to this date (YYYY-MM-DD)',
      '  --subtype <value>     BGG subtype filter (default: boardgame)',
      '  --output <path>       Output file path (default: plays.json)',
      '  --stdout              Print JSON to stdout instead of writing a file',
      '  --pretty              Pretty-print JSON (2 spaces)',
      '  --verbose             Log progress',
      '  --max-attempts <n>    Max queue-poll attempts (default: 25)',
      '  --sleep-ms <ms>       Initial poll wait in ms (default: 2000)',
      '  -h, --help            Show help',
      '',
      'Notes:',
      '  - BGG may return HTTP 202 while it queues your request; this script polls until ready.',
      '  - If you get 401 from a proxy, pass --token (Authorization: Bearer ...).',
    ].join('\n'),
  )
}

function parseDotEnvFile(contents) {
  const env = {}
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!key) continue
    env[key] = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  }
  return env
}

function tryLoadDotEnvFromCwd() {
  const envPath = path.resolve(process.cwd(), '.env')
  try {
    const contents = fs.readFileSync(envPath, 'utf8')
    return parseDotEnvFile(contents)
  } catch {
    return null
  }
}

function parseArgs(argv) {
  const args = {
    baseUrl: 'https://boardgamegeek.com/xmlapi2',
    all: false,
    page: 1,
    subtype: 'boardgame',
    output: 'plays.json',
    stdout: false,
    pretty: false,
    verbose: false,
    maxAttempts: 25,
    sleepMs: 2000,
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--') continue
    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }
    if (token === '--all') {
      args.all = true
      continue
    }
    if (token === '--stdout') {
      args.stdout = true
      continue
    }
    if (token === '--pretty') {
      args.pretty = true
      continue
    }
    if (token === '--verbose') {
      args.verbose = true
      continue
    }

    const next = argv[i + 1]
    const readValue = () => {
      if (!next || next.startsWith('-')) {
        throw new Error(`Missing value for ${token}`)
      }
      i++
      return next
    }

    if (token === '--username') args.username = readValue()
    else if (token === '--token') args.token = readValue()
    else if (token === '--base-url') args.baseUrl = readValue()
    else if (token === '--xml-file') args.xmlFile = readValue()
    else if (token === '--page') args.page = Number(readValue())
    else if (token === '--mindate') args.mindate = readValue()
    else if (token === '--maxdate') args.maxdate = readValue()
    else if (token === '--subtype') args.subtype = readValue()
    else if (token === '--output' || token === '-o') args.output = readValue()
    else if (token === '--max-attempts') args.maxAttempts = Number(readValue())
    else if (token === '--sleep-ms') args.sleepMs = Number(readValue())
    else throw new Error(`Unknown argument: ${token}`)
  }

  if (Number.isNaN(args.page) || args.page < 1) {
    throw new Error('--page must be a positive integer')
  }
  if (Number.isNaN(args.maxAttempts) || args.maxAttempts < 1) {
    throw new Error('--max-attempts must be a positive integer')
  }
  if (Number.isNaN(args.sleepMs) || args.sleepMs < 0) {
    throw new Error('--sleep-ms must be a non-negative integer')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildPlaysUrl({ baseUrl, username, page, mindate, maxdate, subtype }) {
  const url = new URL(baseUrl.replace(/\/+$/, '') + '/plays')
  url.searchParams.set('username', username)
  url.searchParams.set('page', String(page))
  if (subtype) url.searchParams.set('subtype', subtype)
  if (mindate) url.searchParams.set('mindate', mindate)
  if (maxdate) url.searchParams.set('maxdate', maxdate)
  return url
}

function isQueueResponse(status, body) {
  if (status === 202) return true
  const normalized = body.toLowerCase()
  return normalized.includes('has been accepted') && normalized.includes('processed')
}

async function fetchXmlWithQueue(url, { maxAttempts, sleepMs, verbose, token }) {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('This script requires Node.js with built-in fetch (Node 18+).')
  }

  let delayMs = sleepMs
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers = { 'user-agent': 'game-tracker-cli/1.0 (plays json fetch)' }
    if (token) headers.authorization = `Bearer ${token}`

    const response = await fetch(url, { headers })
    const body = await response.text()

    if (isQueueResponse(response.status, body)) {
      if (verbose) {
        console.error(
          `BGG queued request (attempt ${attempt}/${maxAttempts}); waiting ${delayMs}ms...`,
        )
      }
      await sleep(delayMs)
      delayMs = Math.min(Math.floor(delayMs * 1.5 + 250), 20_000)
      continue
    }

    if (response.status === 429) {
      if (verbose) {
        console.error(
          `BGG rate-limited request (attempt ${attempt}/${maxAttempts}); waiting ${delayMs}ms...`,
        )
      }
      await sleep(delayMs)
      delayMs = Math.min(Math.floor(delayMs * 1.5 + 250), 30_000)
      continue
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          `BGG request failed: 401 Unauthorized (missing/invalid token).\n` +
            `Set --token, or env BGG_TOKEN / VITE_BGG_TOKEN (or .env).`,
        )
      }
      throw new Error(`BGG request failed: ${response.status} ${response.statusText}\n${body}`)
    }

    return body
  }

  throw new Error(`BGG request stayed queued after ${maxAttempts} attempts: ${url.toString()}`)
}

function decodeXmlEntities(text) {
  if (!text) return text
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
}

function parseAttributes(attrText) {
  const attrs = {}
  if (!attrText) return attrs
  const re = /([A-Za-z_][\w:.-]*)="([^"]*)"/g
  for (const match of attrText.matchAll(re)) {
    const name = match[1]
    const value = decodeXmlEntities(match[2])
    attrs[name] = value
  }
  return attrs
}

function playsRootOpenTag(xml) {
  const m = xml.match(/<plays\b([^>]*)>/i)
  return m ? m[0] : null
}

function playsRootAttrs(xml) {
  const m = xml.match(/<plays\b([^>]*)>/i)
  return m ? m[1] : null
}

function extractPlayBlocks(xml) {
  const plays = []
  let index = 0

  while (true) {
    const start = xml.indexOf('<play ', index)
    if (start === -1) break
    const end = xml.indexOf('</play>', start)
    if (end === -1) {
      throw new Error('Malformed XML: missing </play> closing tag')
    }
    plays.push(xml.slice(start, end + '</play>'.length))
    index = end + '</play>'.length
  }

  return plays
}

function playIdFromXml(playXml) {
  const m = playXml.match(/<play\b[^>]*\bid="(\d+)"/i)
  return m ? Number(m[1]) : 0
}

function innerText(xml, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const m = xml.match(re)
  if (!m) return undefined
  const text = decodeXmlEntities(m[1].trim())
  return text ? text : undefined
}

function parsePlay(playXml) {
  const open = playXml.match(/<play\b([^>]*)>/i)
  const playAttrs = parseAttributes(open ? open[1] : '')
  const id = Number(playAttrs.id || '0')

  const itemOpen = playXml.match(/<item\b([^>]*)>/i)
  const itemAttrs = itemOpen ? parseAttributes(itemOpen[1]) : null

  const players = []
  const playersRe = /<player\b([^/>]*?)\/>/gi
  for (const match of playXml.matchAll(playersRe)) {
    players.push({ attributes: parseAttributes(match[1]) })
  }

  const comments = innerText(playXml, 'comments')
  const usercomment = innerText(playXml, 'usercomment')

  return {
    id,
    attributes: playAttrs,
    item: itemAttrs ? { attributes: itemAttrs } : undefined,
    players,
    comments,
    usercomment,
  }
}

function parsePlaysXmlToJson(xmlText) {
  const rootAttrsText = playsRootAttrs(xmlText) || ''
  const rootAttrs = parseAttributes(rootAttrsText)
  const username = rootAttrs.username || ''
  const userid = rootAttrs.userid || undefined
  const total = Number(rootAttrs.total || '0')
  const page = Number(rootAttrs.page || '1')

  const plays = extractPlayBlocks(xmlText).map(parsePlay)

  return { username, userid, total, page, plays }
}

function mergePlaysResponses(responses, fallbackUsername) {
  const playsById = new Map()
  for (const response of responses) {
    for (const play of response.plays) {
      if (play.id) playsById.set(play.id, play)
      else playsById.set(`__noid__${playsById.size}`, play)
    }
  }

  const first = responses[0]
  const username = first?.username || fallbackUsername || ''
  const userid = first?.userid

  return {
    username,
    userid,
    total: playsById.size,
    page: 1,
    plays: Array.from(playsById.values()),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }
  if (!args.username) {
    printHelp()
    process.exitCode = 2
    return
  }

  if (args.xmlFile) {
    const xml = fs.readFileSync(path.resolve(process.cwd(), args.xmlFile), 'utf8')
    const json = parsePlaysXmlToJson(xml)
    const out = JSON.stringify(json, null, args.pretty ? 2 : undefined) + '\n'
    if (args.stdout) {
      process.stdout.write(out)
      return
    }
    const outPath = path.resolve(process.cwd(), args.output)
    fs.writeFileSync(outPath, out, 'utf8')
    return
  }

  const dotEnv = tryLoadDotEnvFromCwd()
  const token =
    (args.token ||
      process.env.BGG_TOKEN ||
      process.env.VITE_BGG_TOKEN ||
      dotEnv?.BGG_TOKEN ||
      dotEnv?.VITE_BGG_TOKEN ||
      '')?.trim() || null

  const log = (...parts) => {
    if (args.verbose) console.error(...parts)
  }

  const fetchOnePageXml = async (page) => {
    const url = buildPlaysUrl({
      baseUrl: args.baseUrl,
      username: args.username,
      page,
      mindate: args.mindate,
      maxdate: args.maxdate,
      subtype: args.subtype,
    })
    log(`GET ${url.toString()}`)
    return await fetchXmlWithQueue(url, {
      maxAttempts: args.maxAttempts,
      sleepMs: args.sleepMs,
      verbose: args.verbose,
      token,
    })
  }

  if (!args.all) {
    const xml = await fetchOnePageXml(args.page)
    const json = parsePlaysXmlToJson(xml)
    const out = JSON.stringify(json, null, args.pretty ? 2 : undefined) + '\n'
    if (args.stdout) {
      process.stdout.write(out)
      return
    }
    const outPath = path.resolve(process.cwd(), args.output)
    fs.writeFileSync(outPath, out, 'utf8')
    log(`Wrote ${outPath}`)
    return
  }

  const firstXml = await fetchOnePageXml(1)
  const firstRootTag = playsRootOpenTag(firstXml)
  const firstRootAttrs = parseAttributes(playsRootAttrs(firstXml) || '')
  const total = Number(firstRootAttrs.total || '0') || null
  const estimatedPages = total ? Math.max(1, Math.ceil(total / 100)) : null
  const firstJson = parsePlaysXmlToJson(firstXml)

  log(
    `First page plays=${firstJson.plays.length}; total=${firstRootAttrs.total ?? 'unknown'}; pages≈${
      estimatedPages ?? 'unknown'
    }`,
  )
  if (args.verbose && firstRootTag) log(firstRootTag)

  const responses = [firstJson]

  if (estimatedPages != null) {
    for (let page = 2; page <= estimatedPages; page++) {
      const xml = await fetchOnePageXml(page)
      responses.push(parsePlaysXmlToJson(xml))
    }
  } else {
    let page = 2
    while (true) {
      const xml = await fetchOnePageXml(page)
      const json = parsePlaysXmlToJson(xml)
      if (json.plays.length === 0) break
      responses.push(json)
      page += 1
    }
  }

  const merged = mergePlaysResponses(responses, args.username)
  const out = JSON.stringify(merged, null, args.pretty ? 2 : undefined) + '\n'
  if (args.stdout) {
    process.stdout.write(out)
    return
  }

  const outPath = path.resolve(process.cwd(), args.output)
  fs.writeFileSync(outPath, out, 'utf8')
  log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exitCode = 1
})
