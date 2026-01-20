import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const firestore = admin.firestore()

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

export const spiritIslandProxy = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).set('allow', 'GET, HEAD').send('Method Not Allowed')
    return
  }

  const originalUrl = req.originalUrl || req.url || ''
  const parsed = new URL(originalUrl, 'http://localhost')
  const path = parsed.pathname

  if (path !== '/si/player/json.cgi') {
    res.status(404).send('Not Found')
    return
  }

  const upstreamUrl = new URL(`https://mindwanderer.net${path}${parsed.search}`)
  const headers: Record<string, string> = {
    accept: req.get('accept') || 'application/json',
    'user-agent': 'game-tracker (firebase-functions)',
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
    })

    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    res.status(upstream.status).set('content-type', contentType)

    const cacheControl = upstream.headers.get('cache-control')
    if (cacheControl) res.set('cache-control', cacheControl)

    const etag = upstream.headers.get('etag')
    if (etag) res.set('etag', etag)

    const body = await upstream.text()
    res.send(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(502).send(`Upstream Spirit Island request failed: ${message}`)
  }
})

function normalizePinnedAchievementIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
}

export const getPinnedAchievementIds = functions.https.onCall(async (_data, context) => {
  const uid = context.auth?.uid
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  }

  const doc = await firestore.collection('userPreferences').doc(uid).get()
  if (!doc.exists) return { ids: [] }

  const data = doc.data() as { pinnedAchievementIds?: unknown } | undefined
  return { ids: normalizePinnedAchievementIds(data?.pinnedAchievementIds) }
})

export const setPinnedAchievementIds = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  }

  const ids = normalizePinnedAchievementIds(
    typeof data === 'object' && data != null && 'ids' in data
      ? (data as { ids?: unknown }).ids
      : undefined,
  )

  if (ids.length > 5000) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Too many pinned achievements',
    )
  }

  await firestore
    .collection('userPreferences')
    .doc(uid)
    .set(
      {
        pinnedAchievementIds: ids,
        pinnedAchievementIdsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

  return { ok: true }
})
