import type { BggPlay } from '../../bgg'
import { parseUndauntedNormandyPlayerColor } from './undauntedNormandy'

export const UNDAUNTED_NORMANDY_OBJECT_ID = '268864'

export type UndauntedNormandyEntry = {
  play: BggPlay
  scenario: string
  side: string
  quantity: number
  isWin: boolean
}

function playQuantity(play: BggPlay): number {
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

function isUndauntedNormandyPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = play.item?.attributes.name || ''
  return objectid === UNDAUNTED_NORMANDY_OBJECT_ID || name === 'Undaunted: Normandy'
}

export function getUndauntedNormandyEntries(
  plays: BggPlay[],
  username: string,
): UndauntedNormandyEntry[] {
  const result: UndauntedNormandyEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isUndauntedNormandyPlay(play)) continue

    const parsedPlayers = play.players.map((player) => {
      const parsed = parseUndauntedNormandyPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        scenario: parsed.scenario,
        side: parsed.side,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)

    const scenarios = parsedPlayers.map((player) => player.scenario).filter(Boolean) as string[]
    const sides = parsedPlayers.map((player) => player.side).filter(Boolean) as string[]

    result.push({
      play,
      scenario: myPlayer?.scenario?.trim() || chooseMostCommonOrFirst(scenarios) || 'Unknown scenario',
      side: myPlayer?.side?.trim() || chooseMostCommonOrFirst(sides) || 'Unknown side',
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    })
  }

  return result
}
