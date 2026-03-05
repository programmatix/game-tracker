import type { BggPlay } from '../../bgg'
import { parseCloudspirePlayerColor } from './cloudspire'

export const CLOUDSPIRE_OBJECT_ID = '262211'

export type CloudspireEntry = {
  play: BggPlay
  myFaction: string
  opponentFaction: string
  mode: string
  soloScenario: string
  unknownTags: string[]
  quantity: number
  isWin: boolean
}

type ParsedPlayer = {
  username: string
  isWin: boolean
  myFaction?: string
  opponentFaction?: string
  mode?: string
  soloScenario?: string
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

function isCloudspirePlay(play: BggPlay): boolean {
  const objectid = play.item?.attributes.objectid || ''
  if (objectid === CLOUDSPIRE_OBJECT_ID) return true

  const name = (play.item?.attributes.name || '').trim().toLowerCase()
  if (!name) return false
  return name === 'cloudspire' || name.startsWith('cloudspire:') || name.includes('cloudspire')
}

export function getCloudspireEntries(plays: BggPlay[], username: string): CloudspireEntry[] {
  const result: CloudspireEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    if (!isCloudspirePlay(play)) continue

    const parsedPlayers: ParsedPlayer[] = play.players.map((player) => {
      const parsed = parseCloudspirePlayerColor(playerTagsText(player.attributes))
      return {
        username: (player.attributes.username || '').toLowerCase(),
        isWin: player.attributes.win === '1',
        myFaction: parsed.myFaction,
        opponentFaction: parsed.opponentFaction,
        mode: parsed.mode,
        soloScenario: parsed.soloScenario,
        extraTags: parsed.extraTags,
      }
    })

    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const myFaction = myPlayer?.myFaction || myPlayer?.opponentFaction
    const mode =
      myPlayer?.mode ||
      chooseMostCommonOrFirst(parsedPlayers.map((player) => player.mode).filter(Boolean) as string[])
    const soloScenario =
      myPlayer?.soloScenario ||
      chooseMostCommonOrFirst(
        parsedPlayers.map((player) => player.soloScenario).filter(Boolean) as string[],
      )

    const opponentCandidates = parsedPlayers
      .flatMap((player) => [player.opponentFaction, player.myFaction])
      .filter(Boolean)
      .map((value) => value!.trim())
      .filter((value) => !myFaction || value.toLowerCase() !== myFaction.toLowerCase())

    const opponentFaction = chooseMostCommonOrFirst(opponentCandidates)

    const unknownTags = [
      ...new Set(
        parsedPlayers
          .flatMap((player) => player.extraTags)
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ]

    result.push({
      play,
      myFaction: myFaction || 'Unknown faction',
      opponentFaction: opponentFaction || 'Unknown opponent',
      mode: mode || 'Unknown mode',
      soloScenario: soloScenario || 'Unknown solo scenario',
      unknownTags,
      quantity: playQuantity(play),
      isWin: myPlayer?.isWin === true,
    })
  }

  return result
}
