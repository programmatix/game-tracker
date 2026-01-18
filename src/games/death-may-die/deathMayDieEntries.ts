import type { BggPlay } from '../../bgg'
import {
  normalizeDeathMayDieElderOne,
  normalizeDeathMayDieInvestigator,
  normalizeDeathMayDieScenario,
  isDeathMayDieInvestigatorToken,
  parseDeathMayDiePlayerColor,
} from './deathMayDie'

export const DEATH_MAY_DIE_OBJECT_ID = '253344'

export type DeathMayDieEntry = {
  play: BggPlay
  elderOne: string
  scenario: string
  investigators: string[]
  myInvestigator?: string
  quantity: number
  isWin: boolean
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

export function getDeathMayDieEntries(plays: BggPlay[], username: string): DeathMayDieEntry[] {
  const result: DeathMayDieEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isDeathMayDie = objectid === DEATH_MAY_DIE_OBJECT_ID || name === 'Cthulhu: Death May Die'
    if (!isDeathMayDie) continue

    const parsedPlayers = play.players
      .map((player) => {
        const rawColor = player.attributes.color || ''
        const parsed = parseDeathMayDiePlayerColor(rawColor)
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          investigator: parsed.investigator,
          elderOne: parsed.elderOne,
          scenario: parsed.scenario,
          extraTags: parsed.extraTags,
        }
      })
      .filter((player) => Boolean(player.investigator || player.elderOne || player.scenario))

    const investigatorsSet = new Map<string, string>()
    for (const player of parsedPlayers) {
      const inv = player.investigator?.trim()
      if (inv) investigatorsSet.set(inv.toLowerCase(), inv)

      for (const tag of player.extraTags) {
        if (!isDeathMayDieInvestigatorToken(tag)) continue
        const normalized = normalizeDeathMayDieInvestigator(tag)
        if (!normalized) continue
        investigatorsSet.set(normalized.toLowerCase(), normalized)
      }
    }
    const investigators = [...investigatorsSet.values()]

    const myPlayer = parsedPlayers.find((p) => p.username === user)
    const myInvestigator = myPlayer?.investigator
    const isWin = myPlayer?.win === true

    const elderCandidates = parsedPlayers
      .map((p) => p.elderOne)
      .filter(Boolean)
      .map((token) => normalizeDeathMayDieElderOne(token!))

    const scenarioCandidates = parsedPlayers
      .map((p) => p.scenario)
      .filter(Boolean)
      .map((token) => normalizeDeathMayDieScenario(token!) || token!)

    const elderOne = chooseMostCommonOrFirst(elderCandidates) || 'Unknown elder one'
    const scenario = chooseMostCommonOrFirst(scenarioCandidates) || 'Unknown scenario'

    result.push({
      play,
      elderOne,
      scenario,
      investigators,
      myInvestigator,
      quantity: playQuantity(play),
      isWin,
    })
  }

  return result
}



