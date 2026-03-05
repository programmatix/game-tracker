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

type ParsedPlayer = {
  username: string
  isWin: boolean
  bot?: string
  corporation?: string
  captain?: string
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function chooseMostCommonOrFirst(candidates: string[]): string | undefined {
  const normalized = candidates.map((value) => value.trim()).filter(Boolean)
  if (normalized.length === 0) return undefined

  const counts = new Map<string, number>()
  for (const value of normalized) counts.set(value, (counts.get(value) ?? 0) + 1)

  let best: { value: string; count: number } | undefined
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count }
  }

  return best?.value ?? normalized[0]
}

function playerTagsText(attributes: Record<string, string>): string {
  return [attributes.color, attributes.startposition, attributes.score]
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .join('／')
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

    const parsedPlayers: ParsedPlayer[] = play.players.map((player) => {
      const parsed = parseBurncyclePlayerColor(playerTagsText(player.attributes))
      return {
        username: (player.attributes.username || '').toLowerCase(),
        isWin: player.attributes.win === '1',
        bot: parsed.bot,
        corporation: parsed.corporation,
        captain: parsed.captain,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const bot =
      myPlayer?.bot ||
      chooseMostCommonOrFirst(parsedPlayers.map((player) => player.bot).filter(Boolean) as string[])
    const corporation =
      myPlayer?.corporation ||
      chooseMostCommonOrFirst(
        parsedPlayers.map((player) => player.corporation).filter(Boolean) as string[],
      )
    const captain =
      myPlayer?.captain ||
      chooseMostCommonOrFirst(parsedPlayers.map((player) => player.captain).filter(Boolean) as string[])

    result.push({
      play,
      bot: bot || 'Unknown bot',
      corporation: corporation || 'Unknown corporation',
      captain: captain || 'Unknown captain',
      quantity: playQuantity(play),
      isWin: myPlayer?.isWin === true,
    })
  }

  return result
}
