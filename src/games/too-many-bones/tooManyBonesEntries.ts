import type { BggPlay } from '../../bgg'
import {
  isTooManyBonesDifficultyToken,
  isTooManyBonesGearlocToken,
  isTooManyBonesTyrantToken,
  normalizeTooManyBonesDifficulty,
  parseTooManyBonesPlayerColor,
} from './tooManyBones'

export const TOO_MANY_BONES_OBJECT_ID = '192135'

export type TooManyBonesEntry = {
  play: BggPlay
  tyrant: string
  difficulty?: string
  gearlocs: string[]
  myGearlocs: string[]
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

export function getTooManyBonesEntries(plays: BggPlay[], username: string): TooManyBonesEntry[] {
  const result: TooManyBonesEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isTooManyBones = objectid === TOO_MANY_BONES_OBJECT_ID || name === 'Too Many Bones'
    if (!isTooManyBones) continue

    const parsedPlayers = play.players
      .map((player) => {
        const rawColor = player.attributes.color || ''
        const parsed = parseTooManyBonesPlayerColor(rawColor)
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          gearloc: parsed.gearloc,
          tyrant: parsed.tyrant,
          difficulty: parsed.difficulty,
          extraTags: parsed.extraTags,
        }
      })
      .filter((player) =>
        Boolean(player.gearloc || player.tyrant || player.difficulty || player.extraTags.length > 0),
      )

    const gearlocsSet = new Map<string, string>()
    for (const player of parsedPlayers) {
      const gearloc = player.gearloc?.trim()
      if (gearloc && isTooManyBonesGearlocToken(gearloc)) gearlocsSet.set(gearloc.toLowerCase(), gearloc)

      for (const tag of player.extraTags) {
        if (!isTooManyBonesGearlocToken(tag)) continue
        gearlocsSet.set(tag.toLowerCase(), tag)
      }
    }
    const gearlocs = [...gearlocsSet.values()]

    const myPlayer = parsedPlayers.find((p) => p.username === user)
    const myGearlocsSet = new Map<string, string>()
    if (myPlayer?.gearloc && isTooManyBonesGearlocToken(myPlayer.gearloc)) {
      myGearlocsSet.set(myPlayer.gearloc.toLowerCase(), myPlayer.gearloc)
    }
    for (const tag of myPlayer?.extraTags ?? []) {
      if (!isTooManyBonesGearlocToken(tag)) continue
      myGearlocsSet.set(tag.toLowerCase(), tag)
    }
    const myGearlocs = [...myGearlocsSet.values()]
    const isWin = myPlayer?.win === true

    const tyrantCandidates = parsedPlayers
      .flatMap((p) => [p.tyrant, ...p.extraTags])
      .filter(Boolean)
      .map((value) => value!.trim())
      .filter((value) => isTooManyBonesTyrantToken(value))

    const tyrant = chooseMostCommonOrFirst(tyrantCandidates) || 'Unknown tyrant'
    const difficultyCandidates = parsedPlayers
      .flatMap((p) => [p.difficulty, ...p.extraTags])
      .filter(Boolean)
      .map((value) => value!.trim())
      .filter((value) => isTooManyBonesDifficultyToken(value))
      .map((value) => normalizeTooManyBonesDifficulty(value) || value)

    const difficulty = chooseMostCommonOrFirst(difficultyCandidates)

    result.push({
      play,
      tyrant,
      difficulty,
      gearlocs,
      myGearlocs,
      quantity: playQuantity(play),
      isWin,
    })
  }

  return result
}
