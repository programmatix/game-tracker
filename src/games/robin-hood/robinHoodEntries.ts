import type { BggPlay } from '../../bgg'
import { parseRobinHoodPlayerColor } from './robinHood'

export const ROBIN_HOOD_OBJECT_ID = '326494'

export type RobinHoodEntry = {
  play: BggPlay
  adventure: string
  characters: string[]
  myCharacters: string[]
  quantity: number
  isWin: boolean
  continuedFromPrevious: boolean
}

function playQuantity(play: BggPlay): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function compareRobinHoodPlaysAsc(a: BggPlay, b: BggPlay): number {
  const dateA = a.attributes.date || ''
  const dateB = b.attributes.date || ''
  if (dateA !== dateB) return dateA.localeCompare(dateB)
  return a.id - b.id
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

function isRobinHoodPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = (play.item?.attributes.name || '').trim()
  return objectid === ROBIN_HOOD_OBJECT_ID || name === 'The Adventures of Robin Hood'
}

export function getRobinHoodEntries(plays: BggPlay[], username: string): RobinHoodEntry[] {
  const result: RobinHoodEntry[] = []
  const user = username.toLowerCase()
  const robinHoodPlays = plays.filter(isRobinHoodPlay).slice().sort(compareRobinHoodPlaysAsc)
  let previousResolved: { adventure?: string; characters: string[] } | null = null

  for (const play of robinHoodPlays) {
    const parsedPlayers = play.players.map((player) => {
      const parsed = parseRobinHoodPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        adventure: parsed.adventure,
        characters: parsed.characters,
        continuePrevious: parsed.continuePrevious,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const adventures = parsedPlayers.map((player) => player.adventure).filter(Boolean) as string[]
    const allCharacters = [...new Set(parsedPlayers.flatMap((player) => player.characters).filter(Boolean))]

    let adventure = myPlayer?.adventure?.trim() || chooseMostCommonOrFirst(adventures)
    let myCharacters = [...(myPlayer?.characters ?? [])]
    const continuedFromPrevious = parsedPlayers.some((player) => player.continuePrevious)

    if (continuedFromPrevious && previousResolved) {
      if (!adventure && previousResolved.adventure) adventure = previousResolved.adventure
      if (myCharacters.length === 0) myCharacters = [...previousResolved.characters]
    }

    const characters = [...new Set([...allCharacters, ...myCharacters])]

    const entry: RobinHoodEntry = {
      play,
      adventure: adventure || 'Unknown adventure',
      characters,
      myCharacters,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      continuedFromPrevious,
    }

    result.push(entry)

    if (entry.adventure !== 'Unknown adventure' || entry.myCharacters.length > 0) {
      const previousAdventure: string | undefined =
        previousResolved === null ? undefined : previousResolved.adventure
      const previousCharacters: string[] =
        previousResolved === null ? [] : previousResolved.characters
      previousResolved = {
        adventure: entry.adventure !== 'Unknown adventure' ? entry.adventure : previousAdventure,
        characters: entry.myCharacters.length > 0 ? [...entry.myCharacters] : [...previousCharacters],
      }
    }
  }

  return result
}
