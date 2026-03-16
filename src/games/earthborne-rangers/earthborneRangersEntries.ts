import type { BggPlay } from '../../bgg'
import { parseEarthborneRangersPlayerColor } from './earthborneRangers'

export const EARTHBORNE_RANGERS_OBJECT_ID = '342900'

export type EarthborneRangersEntry = {
  play: BggPlay
  day: string
  quantity: number
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isEarthborneRangersPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === EARTHBORNE_RANGERS_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'earthborne rangers' || name.startsWith('earthborne rangers:')
}

export function getEarthborneRangersEntries(plays: BggPlay[], username: string): EarthborneRangersEntry[] {
  const result: EarthborneRangersEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isEarthborneRangersPlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseEarthborneRangersPlayerColor(player?.attributes.color || '')

    result.push({
      play,
      day: parsed.day?.trim() || 'Unknown day',
      quantity: playQuantity(play),
    })
  }

  return result
}
