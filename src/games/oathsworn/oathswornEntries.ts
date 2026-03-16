import type { BggPlay } from '../../bgg'
import { parseOathswornPlayerColor } from './oathsworn'

export const OATHSWORN_OBJECT_ID = '251661'

export type OathswornEntry = {
  play: BggPlay
  story: string
  encounter: string
  characters: string[]
  myCharacters: string[]
  quantity: number
  isWin: boolean
  unknownTags: string[]
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

function isOathswornPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === OATHSWORN_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'oathsworn: into the deepwood' || name.startsWith('oathsworn')
}

export function getOathswornEntries(plays: BggPlay[], username: string): OathswornEntry[] {
  const result: OathswornEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isOathswornPlay(play)) continue

    const parsedPlayers = play.players.map((player) => {
      const parsed = parseOathswornPlayerColor(player.attributes.color || '')
      return {
        username: (player.attributes.username || '').toLowerCase(),
        win: player.attributes.win === '1',
        story: parsed.story,
        encounter: parsed.encounter,
        characters: parsed.characters,
        extraTags: parsed.extraTags,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const stories = parsedPlayers.map((player) => player.story).filter(Boolean) as string[]
    const encounters = parsedPlayers.map((player) => player.encounter).filter(Boolean) as string[]
    const allCharacters = [
      ...new Set(parsedPlayers.flatMap((player) => player.characters).filter(Boolean)),
    ]
    const myCharacters = [...(myPlayer?.characters ?? [])]
    const unknownTags = [
      ...new Set(
        parsedPlayers.flatMap((player) => player.extraTags).map((tag) => tag.trim()).filter(Boolean),
      ),
    ]

    result.push({
      play,
      story: myPlayer?.story?.trim() || chooseMostCommonOrFirst(stories) || 'Unknown story',
      encounter:
        myPlayer?.encounter?.trim() || chooseMostCommonOrFirst(encounters) || 'Unknown encounter',
      characters: allCharacters,
      myCharacters,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
      unknownTags,
    })
  }

  return result
}
