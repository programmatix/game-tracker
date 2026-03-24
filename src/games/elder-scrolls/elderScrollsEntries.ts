import type { BggPlay } from '../../bgg'
import { parseElderScrollsPlayerColor } from './elderScrolls'

export const ELDER_SCROLLS_OBJECT_ID = '356080'

export type ElderScrollsEntry = {
  play: BggPlay
  province: string
  race: string
  heroClass: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isElderScrollsPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = (play.item?.attributes.name || '').trim()
  return objectid === ELDER_SCROLLS_OBJECT_ID || name === 'The Elder Scrolls: Betrayal of the Second Era'
}

export function getElderScrollsEntries(plays: BggPlay[], username: string): ElderScrollsEntry[] {
  const result: ElderScrollsEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isElderScrollsPlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseElderScrollsPlayerColor(player?.attributes.color || '')

    result.push({
      play,
      province: parsed.province?.trim() || 'Unknown province',
      race: parsed.race?.trim() || 'Unknown race',
      heroClass: parsed.heroClass?.trim() || 'Unknown class',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
