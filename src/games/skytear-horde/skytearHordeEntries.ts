import type { BggPlay } from '../../bgg'
import { parseSkytearHordePlayerColor } from './skytearHorde'

export const SKYTEAR_HORDE_OBJECT_ID = '344789'
export const SKYTEAR_HORDE_MONOLITHS_OBJECT_ID = '385325'

export type SkytearHordeEntry = {
  play: BggPlay
  heroPrecon: string
  enemyPrecon: string
  enemyLevel?: number
  quantity: number
  isWin: boolean
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isSkytearHordePlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = play.item?.attributes.name || ''
  if (objectid === SKYTEAR_HORDE_OBJECT_ID) return true
  if (objectid === SKYTEAR_HORDE_MONOLITHS_OBJECT_ID) return true
  if (name === 'Skytear Horde') return true
  if (name === 'Skytear Horde: Monoliths') return true
  return false
}

export function getSkytearHordeEntries(plays: BggPlay[], username: string): SkytearHordeEntry[] {
  const result: SkytearHordeEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isSkytearHordePlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseSkytearHordePlayerColor(player?.attributes.color || '')

    result.push({
      play,
      heroPrecon: parsed.heroPrecon?.trim() || 'Unknown hero precon',
      enemyPrecon: parsed.enemyPrecon?.trim() || 'Unknown enemy precon',
      enemyLevel: parsed.enemyLevel,
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}

