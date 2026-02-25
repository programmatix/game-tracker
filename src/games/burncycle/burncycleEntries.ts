import type { BggPlay } from '../../bgg'
import { parseBurncyclePlayerColor } from './burncycle'

export const BURNCYCLE_OBJECT_ID = '322656'

export type BurncycleEntry = {
  play: BggPlay
  bot: string
  corporation: string
  captain: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function isBurncyclePlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === BURNCYCLE_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'burncycle' || name.startsWith('burncycle:') || name.includes('burncycle')
}

export function getBurncycleEntries(plays: BggPlay[], username: string): BurncycleEntry[] {
  const result: BurncycleEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isBurncyclePlay(play)) continue

    const player = play.players.find((p) => (p.attributes.username || '').toLowerCase() === user)
    const parsed = parseBurncyclePlayerColor(player?.attributes.color || '')

    result.push({
      play,
      bot: parsed.bot || 'Unknown bot',
      corporation: parsed.corporation || 'Unknown corporation',
      captain: parsed.captain || 'Unknown captain',
      quantity: playQuantity(play),
      isWin: player?.attributes.win === '1',
    })
  }

  return result
}
