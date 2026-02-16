import type { BggPlay } from '../../bgg'
import { parseUnsettledPlayerColor } from './unsettled'

export const UNSETTLED_OBJECT_ID = '290484'

export type UnsettledEntry = {
  play: BggPlay
  planet: string
  task: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

export function getUnsettledEntries(plays: BggPlay[], username: string): UnsettledEntry[] {
  const result: UnsettledEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isUnsettled = objectid === UNSETTLED_OBJECT_ID || name === 'Unsettled'
    if (!isUnsettled) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseUnsettledPlayerColor(player?.attributes.color || '')

    result.push({
      play,
      planet: parsed.planet?.trim() || 'Unknown planet',
      task: parsed.task?.trim() || 'Unknown task',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}

