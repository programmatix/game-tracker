import type { BggPlay } from '../../bgg'
import { parseTaintedGrailPlayerColor } from './taintedGrail'

export const TAINTED_GRAIL_OBJECT_ID = '264220'

export type TaintedGrailEntry = {
  play: BggPlay
  chapter: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isTaintedGrailPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === TAINTED_GRAIL_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'tainted grail: the fall of avalon'
}

export function getTaintedGrailEntries(plays: BggPlay[], username: string): TaintedGrailEntry[] {
  const result: TaintedGrailEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isTaintedGrailPlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseTaintedGrailPlayerColor(player?.attributes.color || '')

    result.push({
      play,
      chapter: parsed.chapter?.trim() || 'Unknown chapter',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
