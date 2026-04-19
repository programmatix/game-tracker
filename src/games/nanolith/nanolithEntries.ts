import type { BggPlay } from '../../bgg'
import { parseNanolithPlayerColor } from './nanolith'

export const NANOLITH_OBJECT_ID = '338164'

export type NanolithEntry = {
  play: BggPlay
  encounter: string
  hero?: string
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

function compareNanolithPlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
}

function isNanolithPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === NANOLITH_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'nanolith' || name.startsWith('nanolith:')
}

export function getNanolithEntries(plays: BggPlay[], username: string): NanolithEntry[] {
  const user = username.toLowerCase()
  const result = plays.filter(isNanolithPlay).slice().sort(compareNanolithPlaysAsc).map((play) => {
    const parsedPlayers = play.players.map((player) => {
      const parsed = parseNanolithPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        hero: parsed.hero,
        encounter: parsed.encounter,
        continuePrevious: parsed.continuePrevious,
        continueNext: parsed.continueNext,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const encounterCandidates = parsedPlayers.map((player) => player.encounter).filter(Boolean) as string[]
    const heroCandidates = parsedPlayers.map((player) => player.hero).filter(Boolean) as string[]

    return {
      play,
      encounter: myPlayer?.encounter?.trim() || encounterCandidates[0]?.trim() || '',
      hero: myPlayer?.hero?.trim() || heroCandidates[0]?.trim() || undefined,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      continuedFromPrevious: parsedPlayers.some((player) => player.continuePrevious),
      continuedToNext: parsedPlayers.some((player) => player.continueNext),
    }
  })

  let previousResolved: { encounter?: string; hero?: string } | null = null
  for (const entry of result) {
    if (entry.continuedFromPrevious && previousResolved) {
      if (!entry.encounter && previousResolved.encounter) entry.encounter = previousResolved.encounter
      if (!entry.hero && previousResolved.hero) entry.hero = previousResolved.hero
    }
    if (entry.encounter || entry.hero) {
      const priorEncounter: string | undefined = previousResolved ? previousResolved.encounter : undefined
      const priorHero: string | undefined = previousResolved ? previousResolved.hero : undefined
      previousResolved = {
        encounter: entry.encounter || priorEncounter,
        hero: entry.hero || priorHero,
      }
    }
  }

  let nextResolved: { encounter?: string; hero?: string } | null = null
  for (let index = result.length - 1; index >= 0; index -= 1) {
    const entry = result[index]!
    if (entry.continuedToNext && nextResolved) {
      if (!entry.encounter && nextResolved.encounter) entry.encounter = nextResolved.encounter
      if (!entry.hero && nextResolved.hero) entry.hero = nextResolved.hero
    }
    if (entry.encounter || entry.hero) {
      const priorEncounter: string | undefined = nextResolved ? nextResolved.encounter : undefined
      const priorHero: string | undefined = nextResolved ? nextResolved.hero : undefined
      nextResolved = {
        encounter: entry.encounter || priorEncounter,
        hero: entry.hero || priorHero,
      }
    }
  }

  for (const entry of result) {
    if (!entry.encounter) entry.encounter = 'Unknown encounter'
  }

  return result
}
