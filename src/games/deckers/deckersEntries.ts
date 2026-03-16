import type { BggPlay } from '../../bgg'
import { parseDeckersPlayerColor } from './deckers'

export const DECKERS_OBJECT_ID = '443306'

export type DeckersEntry = {
  play: BggPlay
  smc: string
  deckers: string[]
  myDeckers: string[]
  unknownTags: string[]
  quantity: number
  isWin: boolean
}

type ParsedPlayer = {
  username: string
  isWin: boolean
  smc?: string
  deckers: string[]
  extraTags: string[]
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

function isDeckersPlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === DECKERS_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  return name === 'deckers'
}

export function getDeckersEntries(plays: BggPlay[], username: string): DeckersEntry[] {
  const result: DeckersEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isDeckersPlay(play)) continue

    const parsedPlayers: ParsedPlayer[] = play.players.map((player) => {
      const parsed = parseDeckersPlayerColor(playerTagsText(player.attributes))
      return {
        username: (player.attributes.username || '').toLowerCase(),
        isWin: player.attributes.win === '1',
        smc: parsed.smc,
        deckers: parsed.deckers,
        extraTags: parsed.extraTags,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const smc =
      myPlayer?.smc ||
      chooseMostCommonOrFirst(parsedPlayers.map((player) => player.smc).filter(Boolean) as string[])
    const deckers = [
      ...new Set(parsedPlayers.flatMap((player) => player.deckers).map((value) => value.trim()).filter(Boolean)),
    ]
    const unknownTags = [
      ...new Set(parsedPlayers.flatMap((player) => player.extraTags).map((value) => value.trim()).filter(Boolean)),
    ]

    result.push({
      play,
      smc: smc || 'Unknown SMC',
      deckers,
      myDeckers: [...(myPlayer?.deckers ?? [])],
      unknownTags,
      quantity: playQuantity(play),
      isWin: myPlayer?.isWin === true,
    })
  }

  return result
}
