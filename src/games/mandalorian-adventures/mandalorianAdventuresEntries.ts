import type { BggPlay } from '../../bgg'
import { parseMandalorianAdventuresPlayerColor } from './mandalorianAdventures'

export const MANDALORIAN_ADVENTURES_OBJECT_ID = '420077'

export type MandalorianAdventuresEntry = {
  play: BggPlay
  mission: string
  characters: string[]
  myCharacters: string[]
  encounter?: string
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

function isMandalorianAdventuresPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  const name = play.item?.attributes.name || ''
  return objectid === MANDALORIAN_ADVENTURES_OBJECT_ID || name === 'The Mandalorian: Adventures'
}

export function getMandalorianAdventuresEntries(
  plays: BggPlay[],
  username: string,
): MandalorianAdventuresEntry[] {
  const result: MandalorianAdventuresEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isMandalorianAdventuresPlay(play)) continue

    const parsedPlayers = play.players.map((player) => {
      const parsed = parseMandalorianAdventuresPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        mission: parsed.mission,
        characters: parsed.characters,
        encounter: parsed.encounter,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const missions = parsedPlayers.map((player) => player.mission).filter(Boolean) as string[]
    const encounters = parsedPlayers.map((player) => player.encounter).filter(Boolean) as string[]
    const allCharacters = [
      ...new Set(parsedPlayers.flatMap((player) => player.characters).filter(Boolean)),
    ]
    const myCharacters = [...(myPlayer?.characters ?? [])]

    result.push({
      play,
      mission: myPlayer?.mission?.trim() || chooseMostCommonOrFirst(missions) || 'Unknown mission',
      characters: allCharacters,
      myCharacters,
      encounter: myPlayer?.encounter?.trim() || chooseMostCommonOrFirst(encounters),
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    })
  }

  return result
}
