import type { BggPlay } from '../../bgg'
import { parseArkhamHorrorLcgPlayerColor } from './arkhamHorrorLcg'

export const ARKHAM_HORROR_LCG_OBJECT_ID = '205637'

export type ArkhamHorrorLcgEntry = {
  play: BggPlay
  campaign: string
  scenario: string
  difficulty: string
  investigators: string[]
  quantity: number
  isWin: boolean
  continuedFromPrevious: boolean
  continuedToNext: boolean
}

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function compareArkhamPlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isArkhamPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === ARKHAM_HORROR_LCG_OBJECT_ID) return true
  return (play.item?.attributes.name || '').trim() === 'Arkham Horror: The Card Game'
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

function mergeUnique(values: string[][]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const group of values) {
    for (const value of group) {
      const trimmed = value.trim()
      if (!trimmed) continue
      const normalized = trimmed.toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      merged.push(trimmed)
    }
  }
  return merged
}

export function getArkhamHorrorLcgEntries(plays: BggPlay[], username: string): ArkhamHorrorLcgEntry[] {
  const user = username.toLowerCase()
  const arkhamPlays = plays.filter(isArkhamPlay).slice().sort(compareArkhamPlaysAsc)
  const result = arkhamPlays.map((play) => {
    const parsedPlayers = play.players.map((player) => {
      const parsed = parseArkhamHorrorLcgPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        campaign: parsed.campaign,
        scenario: parsed.scenario,
        difficulty: parsed.difficulty,
        investigators: parsed.investigators,
        continuePrevious: parsed.continuePrevious,
        continueNext: parsed.continueNext,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)

    return {
      play,
      campaign:
        myPlayer?.campaign?.trim() ||
        chooseMostCommonOrFirst(parsedPlayers.map((player) => player.campaign || '')) ||
        '',
      scenario:
        myPlayer?.scenario?.trim() ||
        chooseMostCommonOrFirst(parsedPlayers.map((player) => player.scenario || '')) ||
        '',
      difficulty:
        myPlayer?.difficulty?.trim() ||
        chooseMostCommonOrFirst(parsedPlayers.map((player) => player.difficulty || '')) ||
        '',
      investigators: mergeUnique(
        myPlayer?.investigators?.length ? [myPlayer.investigators] : parsedPlayers.map((player) => player.investigators),
      ),
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
      continuedToNext: parsedPlayers.some((player) => player.continueNext),
    }
  })

  let previousResolved: Pick<ArkhamHorrorLcgEntry, 'campaign' | 'scenario' | 'difficulty' | 'investigators'> | undefined
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.campaign) entry.campaign = previousResolved.campaign
      if (!entry.scenario) entry.scenario = previousResolved.scenario
      if (!entry.difficulty) entry.difficulty = previousResolved.difficulty
      if (entry.investigators.length === 0) entry.investigators = previousResolved.investigators.slice()
    }
    if (entry.campaign || entry.scenario || entry.difficulty || entry.investigators.length > 0) {
      previousResolved = {
        campaign: entry.campaign,
        scenario: entry.scenario,
        difficulty: entry.difficulty,
        investigators: entry.investigators.slice(),
      }
    }
  }

  let nextResolved: Pick<ArkhamHorrorLcgEntry, 'campaign' | 'scenario' | 'difficulty' | 'investigators'> | undefined
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.campaign) entry.campaign = nextResolved.campaign
      if (!entry.scenario) entry.scenario = nextResolved.scenario
      if (!entry.difficulty) entry.difficulty = nextResolved.difficulty
      if (entry.investigators.length === 0) entry.investigators = nextResolved.investigators.slice()
    }
    if (entry.campaign || entry.scenario || entry.difficulty || entry.investigators.length > 0) {
      nextResolved = {
        campaign: entry.campaign,
        scenario: entry.scenario,
        difficulty: entry.difficulty,
        investigators: entry.investigators.slice(),
      }
    }
  }

  for (const entry of result) {
    if (!entry.campaign) entry.campaign = 'Unknown campaign'
    if (!entry.scenario) entry.scenario = 'Unknown scenario'
    if (!entry.difficulty) entry.difficulty = 'Unknown difficulty'
  }

  return result
}
