# BGG plays fetcher

Fetch a BoardGameGeek user's play history as XML and optionally write it to `data.xml`.

If BGG returns `401 Unauthorized`, set a token via `--token`, or put `BGG_TOKEN=` / `VITE_BGG_TOKEN=` in `.env`.

## Examples

Fetch a single page:

```bash
node scripts/bgg-plays.js --username stony82 --page 1 --output data.xml
```

Fetch all pages (merges into one `<plays>` document):

```bash
node scripts/bgg-plays.js --username stony82 --all --output data.xml
```

Limit by date:

```bash
node scripts/bgg-plays.js --username stony82 --all --mindate 2026-01-01 --maxdate 2026-01-31 --output data.xml
```

Print to stdout:

```bash
node scripts/bgg-plays.js --username stony82 --all --stdout
```
