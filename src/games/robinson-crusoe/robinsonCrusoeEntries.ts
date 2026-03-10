import type { BggPlay } from '../../bgg'
import { parseRobinsonCrusoePlayerColor } from './robinsonCrusoe'

export const ROBINSON_CRUSOE_OBJECT_ID = '121921'

export type RobinsonCrusoeEntry = {
  play: BggPlay
  scenario: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isRobinsonCrusoePlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === ROBINSON_CRUSOE_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'robinson crusoe: adventures on the cursed island'
}

export function getRobinsonCrusoeEntries(
  plays: BggPlay[],
  username: string,
): RobinsonCrusoeEntry[] {
  const result: RobinsonCrusoeEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isRobinsonCrusoePlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseRobinsonCrusoePlayerColor(player?.attributes.color || '')

    result.push({
      play,
      scenario: parsed.scenario?.trim() || 'Unknown scenario',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
