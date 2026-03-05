import type { BggPlay } from '../../bgg'
import { parseStarTrekCaptainsChairPlayerColor } from './starTrekCaptainsChair'

export const STAR_TREK_CAPTAINS_CHAIR_OBJECT_ID = '422541'

export type StarTrekCaptainsChairEntry = {
  play: BggPlay
  scenario: string
  captain: string
  allCaptains: string[]
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

function isStarTrekCaptainsChairPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = play.item?.attributes.name || ''
  return objectid === STAR_TREK_CAPTAINS_CHAIR_OBJECT_ID || name === "Star Trek: Captain's Chair"
}

export function getStarTrekCaptainsChairEntries(
  plays: BggPlay[],
  username: string,
): StarTrekCaptainsChairEntry[] {
  const result: StarTrekCaptainsChairEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isStarTrekCaptainsChairPlay(play)) continue

    const parsedPlayers = play.players.map((player) => {
      const parsed = parseStarTrekCaptainsChairPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        captain: parsed.captain,
        scenario: parsed.scenario,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const scenarios = parsedPlayers.map((player) => player.scenario).filter(Boolean) as string[]
    const captains = parsedPlayers.map((player) => player.captain).filter(Boolean) as string[]

    result.push({
      play,
      scenario: myPlayer?.scenario?.trim() || chooseMostCommonOrFirst(scenarios) || 'Unknown scenario',
      captain: myPlayer?.captain?.trim() || 'Unknown captain',
      allCaptains: [...new Set(captains)],
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    })
  }

  return result
}
