import * as functions from 'firebase-functions'

export const bggProxy = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).set('allow', 'GET, HEAD').send('Method Not Allowed')
    return
  }

  const originalUrl = req.originalUrl || req.url || ''
  const parsed = new URL(originalUrl, 'http://localhost')
  const path = parsed.pathname

  const upstreamPath = path.startsWith('/bgg/') ? path.replace(/^\/bgg/, '') : path
  if (!upstreamPath.startsWith('/xmlapi2/')) {
    res.status(404).send('Not Found')
    return
  }
  const upstreamUrl = new URL(`https://boardgamegeek.com${upstreamPath}${parsed.search}`)

  const headers: Record<string, string> = {
    accept: req.get('accept') || 'application/xml,text/xml;q=0.9,*/*;q=0.8',
    'user-agent': 'game-tracker (firebase-functions)',
  }

  const authorization = req.get('authorization')
  if (authorization) headers.authorization = authorization

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
    })

    const contentType = upstream.headers.get('content-type') || 'application/xml; charset=utf-8'
    res.status(upstream.status).set('content-type', contentType)

    const etag = upstream.headers.get('etag')
    if (etag) res.set('etag', etag)

    const lastModified = upstream.headers.get('last-modified')
    if (lastModified) res.set('last-modified', lastModified)

    const body = await upstream.text()
    res.send(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(502).send(`Upstream BGG request failed: ${message}`)
  }
})
