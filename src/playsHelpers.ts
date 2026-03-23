import type { BggPlay, BggPlaysResponse } from './bgg'

export type PlaysCacheV1 = {
  version: 1
  fetchedAtMs: number
  data: Pick<BggPlaysResponse, 'username' | 'userid' | 'total' | 'plays' | 'raw'>
}

export type PlaysByGameRow = {
  key: string
  objectid?: string
  objecttype?: string
  name: string
  plays: number
  mostRecentDate?: string
}

export function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

export function compareIsoDatesDesc(a?: string, b?: string): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  if (a === b) return 0
  return a > b ? -1 : 1
}

export function gameKeyFromPlay(play: {
  item?: { attributes: Record<string, string> }
}): string {
  const objectid = play.item?.attributes.objectid
  const objecttype = play.item?.attributes.objecttype
  const name = play.item?.attributes.name || 'Unknown'
  return objectid ? `${objecttype || 'thing'}:${objectid}` : `name:${name}`
}

export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function getBggPlayerDisplayName(attributes: Record<string, string>): string {
  const username = (attributes.username || '').trim()
  if (username) return username
  const name = (attributes.name || '').trim()
  if (name) return name
  return 'Unknown player'
}

export function getBggPlayerResult(attributes: Record<string, string>): string {
  if (attributes.win === '1') return 'Win'
  if (attributes.win === '0') return 'Loss'
  return ''
}

export function getPlayerColorForUser(
  play: { players: Array<{ attributes: Record<string, string> }> },
  username: string,
): string {
  const user = username.toLowerCase()
  const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
  return player?.attributes.color || ''
}

export function getPlayerResultForUser(
  play: { players: Array<{ attributes: Record<string, string> }> },
  username: string,
): string {
  const user = username.toLowerCase()
  const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
  return player ? getBggPlayerResult(player.attributes) : ''
}

export function getOtherPlayersSummary(
  play: { players: Array<{ attributes: Record<string, string> }> },
  username: string,
): string {
  const user = username.toLowerCase()
  const others = play.players.filter((p) => (p.attributes.username || '').toLowerCase() !== user)
  if (others.length === 0) return '—'
  return others
    .map((player) => {
      const who = getBggPlayerDisplayName(player.attributes)
      const color = (player.attributes.color || '').trim()
      const result = getBggPlayerResult(player.attributes)
      const details = [color || '—', result].filter(Boolean).join(' • ')
      return `${who}: ${details}`
    })
    .join(' | ')
}

export function bggPlayUrl(playId: number): string {
  return `https://boardgamegeek.com/play/details/${playId}`
}

export function hasRecordedPlayLength(attributes: Record<string, string>): boolean {
  const parsed = Number(attributes.length || '0')
  return Number.isFinite(parsed) && parsed > 0
}

export function groupPlaysByGame(plays: BggPlay[]): PlaysByGameRow[] {
  const groups = new Map<string, PlaysByGameRow>()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid
    const objecttype = play.item?.attributes.objecttype
    const name = play.item?.attributes.name || 'Unknown'
    const key = gameKeyFromPlay(play)
    const qty = playQuantity(play)
    const date = play.attributes.date || undefined

    const existing = groups.get(key)
    if (existing) {
      existing.plays += qty
      if (date && compareIsoDatesDesc(date, existing.mostRecentDate) < 0) {
        existing.mostRecentDate = date
      }
      continue
    }

    groups.set(key, {
      key,
      objectid,
      objecttype,
      name,
      plays: qty,
      mostRecentDate: date,
    })
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (b.plays !== a.plays) return b.plays - a.plays
    return a.name.localeCompare(b.name)
  })
}

export function readPlaysCache(key: string): PlaysCacheV1 | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed != null &&
      'version' in parsed &&
      (parsed as { version: unknown }).version === 1 &&
      'fetchedAtMs' in parsed &&
      typeof (parsed as { fetchedAtMs: unknown }).fetchedAtMs === 'number' &&
      'data' in parsed &&
      typeof (parsed as { data: unknown }).data === 'object'
    ) {
      return parsed as PlaysCacheV1
    }
    return null
  } catch {
    return null
  }
}

export function writePlaysCache(key: string, cache: PlaysCacheV1) {
  try {
    localStorage.setItem(key, JSON.stringify(cache))
  } catch {
    // ignore quota / storage failures
  }
}

export function isPlaysCacheFresh(cache: PlaysCacheV1 | null, ttlMs: number): boolean {
  if (!cache) return false
  return Date.now() - cache.fetchedAtMs <= ttlMs
}
