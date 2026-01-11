export type BggUserProfile = {
  id: number
  name: string
  raw: unknown
  fields: Record<string, string>
}

export type BggPlaysResponse = {
  username: string
  userid?: string
  total: number
  page: number
  raw: unknown
  plays: BggPlay[]
}

export type BggPlay = {
  id: number
  attributes: Record<string, string>
  item?: {
    attributes: Record<string, string>
  }
  players: Array<{
    attributes: Record<string, string>
  }>
  comments?: string
  usercomment?: string
  raw: unknown
}

export type BggThingSummary = {
  id: string
  type?: string
  primaryName?: string
  thumbnail?: string
  image?: string
  raw: unknown
}

const BGG_BASE = '/bgg/xmlapi2'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function elementAttributesToRecord(element: Element): Record<string, string> {
  const record: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    record[attribute.name] = attribute.value
  }
  return record
}

function parseXmlText(xmlText: string): Document {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(parseError.textContent?.trim() || 'Failed to parse XML')
  }
  return doc
}

function elementToObject(element: Element): unknown {
  const attributes = elementAttributesToRecord(element)
  const children = Array.from(element.children)

  const node: Record<string, unknown> = {}
  if (Object.keys(attributes).length > 0) node.$ = attributes

  if (children.length === 0) {
    const text = element.textContent?.trim()
    if (text) node._ = text
    return node
  }

  for (const child of children) {
    const key = child.tagName
    const value = elementToObject(child)
    const existing = node[key]
    if (existing === undefined) {
      node[key] = value
      continue
    }
    if (Array.isArray(existing)) {
      existing.push(value)
      continue
    }
    node[key] = [existing, value]
  }

  return node
}

async function fetchXml(
  path: string,
  options?: { signal?: AbortSignal; authToken?: string },
): Promise<Document> {
  let delayMs = 800
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const headers: HeadersInit = {
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
    }
    const authToken = options?.authToken?.trim()
    if (authToken) headers.authorization = `Bearer ${authToken}`

    const response = await fetch(`${BGG_BASE}${path}`, {
      signal: options?.signal,
      headers,
    })

    if (response.status === 202) {
      await sleep(delayMs)
      delayMs = Math.min(5000, Math.round(delayMs * 1.5))
      continue
    }

    if (!response.ok) {
      throw new Error(`BGG request failed: ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    return parseXmlText(xmlText)
  }

  throw new Error('BGG request still processing (202). Please try again.')
}

export function parsePlaysXmlText(xmlText: string): BggPlaysResponse {
  const doc = parseXmlText(xmlText)
  const playsElement = doc.querySelector('plays')
  if (!playsElement) throw new Error('BGG plays XML missing <plays>')

  const username = playsElement.getAttribute('username') || ''
  const total = Number(playsElement.getAttribute('total') || '0')
  const parsedPage = Number(playsElement.getAttribute('page') || '1')
  const userid = playsElement.getAttribute('userid') || undefined
  const raw = elementToObject(playsElement)

  const plays: BggPlay[] = []
  for (const playElement of Array.from(playsElement.getElementsByTagName('play'))) {
    const attributes = elementAttributesToRecord(playElement)
    const id = Number(attributes.id || '0')

    const itemElement = playElement.getElementsByTagName('item')[0]
    const item = itemElement
      ? { attributes: elementAttributesToRecord(itemElement) }
      : undefined

    const playersElement = playElement.getElementsByTagName('players')[0]
    const players = playersElement
      ? Array.from(playersElement.getElementsByTagName('player')).map((el) => ({
          attributes: elementAttributesToRecord(el),
        }))
      : []

    const comments =
      playElement.getElementsByTagName('comments')[0]?.textContent?.trim() || undefined
    const usercomment =
      playElement.getElementsByTagName('usercomment')[0]?.textContent?.trim() || undefined

    plays.push({
      id,
      attributes,
      item,
      players,
      comments,
      usercomment,
      raw: elementToObject(playElement),
    })
  }

  return { username, userid, total, page: parsedPage, raw, plays }
}

export async function fetchUserProfile(
  username: string,
  options?: { signal?: AbortSignal; authToken?: string },
): Promise<BggUserProfile> {
  const query = new URLSearchParams({ name: username })
  const doc = await fetchXml(`/user?${query.toString()}`, options)
  const userElement = doc.querySelector('user')
  if (!userElement) throw new Error('BGG user XML missing <user>')

  const raw = elementToObject(userElement)
  const id = Number(userElement.getAttribute('id') || '0')
  const name = userElement.getAttribute('name') || username

  const fields: Record<string, string> = {}
  for (const child of Array.from(userElement.children)) {
    const value = child.getAttribute('value')
    if (value != null) fields[child.tagName] = value

    for (const attribute of Array.from(child.attributes)) {
      if (attribute.name === 'value') continue
      fields[`${child.tagName}.${attribute.name}`] = attribute.value
    }
  }

  return { id, name, fields, raw }
}

export async function fetchUserPlays(
  username: string,
  page: number,
  options?: { signal?: AbortSignal; authToken?: string },
): Promise<BggPlaysResponse> {
  const query = new URLSearchParams({ username, page: String(page) })
  const doc = await fetchXml(`/plays?${query.toString()}`, options)
  const playsElement = doc.querySelector('plays')
  if (!playsElement) throw new Error('BGG plays XML missing <plays>')

  const total = Number(playsElement.getAttribute('total') || '0')
  const parsedPage = Number(playsElement.getAttribute('page') || String(page))
  const userid = playsElement.getAttribute('userid') || undefined
  const raw = elementToObject(playsElement)

  const plays: BggPlay[] = []
  for (const playElement of Array.from(playsElement.getElementsByTagName('play'))) {
    const attributes = elementAttributesToRecord(playElement)
    const id = Number(attributes.id || '0')

    const itemElement = playElement.getElementsByTagName('item')[0]
    const item = itemElement
      ? { attributes: elementAttributesToRecord(itemElement) }
      : undefined

    const playersElement = playElement.getElementsByTagName('players')[0]
    const players = playersElement
      ? Array.from(playersElement.getElementsByTagName('player')).map((el) => ({
          attributes: elementAttributesToRecord(el),
        }))
      : []

    const comments =
      playElement.getElementsByTagName('comments')[0]?.textContent?.trim() || undefined
    const usercomment =
      playElement.getElementsByTagName('usercomment')[0]?.textContent?.trim() || undefined

    plays.push({
      id,
      attributes,
      item,
      players,
      comments,
      usercomment,
      raw: elementToObject(playElement),
    })
  }

  return { username, userid, total, page: parsedPage, raw, plays }
}

export async function fetchThingSummary(
  id: string,
  options?: { signal?: AbortSignal; authToken?: string },
): Promise<BggThingSummary> {
  const query = new URLSearchParams({ id })
  const doc = await fetchXml(`/thing?${query.toString()}`, options)

  const itemElement = doc.querySelector('items > item') || doc.querySelector('item')
  if (!itemElement) throw new Error('BGG thing XML missing <item>')

  const type = itemElement.getAttribute('type') || undefined
  const thumbnail = itemElement.getElementsByTagName('thumbnail')[0]?.textContent?.trim()
  const image = itemElement.getElementsByTagName('image')[0]?.textContent?.trim()

  const primaryName =
    itemElement
      .querySelector('name[type="primary"]')
      ?.getAttribute('value')
      ?.trim() || undefined

  return {
    id: itemElement.getAttribute('id') || id,
    type,
    primaryName,
    thumbnail: thumbnail || undefined,
    image: image || undefined,
    raw: elementToObject(itemElement),
  }
}
