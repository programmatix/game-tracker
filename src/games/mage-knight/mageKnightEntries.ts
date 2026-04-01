import type { BggPlay } from '../../bgg'
import {
  isMageKnightHeroToken,
  isMageKnightScenarioToken,
  parseMageKnightPlayerColor,
} from './mageKnight'

export const MAGE_KNIGHT_OBJECT_IDS = new Set(['248562', '96848'])

export type MageKnightEntry = {
  play: BggPlay
  heroes: string[]
  myHero?: string
  scenario?: string
  continuedFromPrevious: boolean
  continuedToNext: boolean
  quantity: number
  isWin: boolean
}

const DEFAULT_SOLO_SCENARIO = 'Solo Conquest'

function playQuantity(play: { attributes: Record<string, string> }): number {
  const parsed = Number(play.attributes.quantity || '1')
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

export function getMageKnightEntries(plays: BggPlay[], username: string): MageKnightEntry[] {
  const result: MageKnightEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isMageKnight = MAGE_KNIGHT_OBJECT_IDS.has(objectid) || /^Mage Knight/.test(name)
    if (!isMageKnight) continue

    const parsedPlayers = play.players
      .map((player) => {
        const rawColor = player.attributes.color || ''
        const parsed = parseMageKnightPlayerColor(rawColor)
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          hero: parsed.hero,
          scenario: parsed.scenario,
          continuePrevious: parsed.continuePrevious,
          continueNext: parsed.continueNext,
          extraTags: parsed.extraTags,
        }
      })
      .filter((player) =>
        Boolean(
          player.hero ||
            player.scenario ||
            player.continuePrevious ||
            player.continueNext ||
            player.extraTags.length > 0,
        ),
      )

    const heroesSet = new Map<string, string>()
    for (const player of parsedPlayers) {
      const hero = player.hero?.trim()
      if (hero && isMageKnightHeroToken(hero)) heroesSet.set(hero.toLowerCase(), hero)

      for (const tag of player.extraTags) {
        if (!isMageKnightHeroToken(tag)) continue
        heroesSet.set(tag.toLowerCase(), tag)
      }
    }

    const heroes = [...heroesSet.values()]
    const myPlayer = parsedPlayers.find((player) => player.username === user)
    const myHero = myPlayer?.hero && isMageKnightHeroToken(myPlayer.hero) ? myPlayer.hero : undefined
    const explicitScenario =
      myPlayer?.scenario && isMageKnightScenarioToken(myPlayer.scenario)
        ? myPlayer.scenario
        : undefined
    const continuedFromPrevious = parsedPlayers.some((player) => player.continuePrevious)
    const continuedToNext = parsedPlayers.some((player) => player.continueNext)
    const scenario =
      explicitScenario ||
      (continuedFromPrevious || continuedToNext ? undefined : DEFAULT_SOLO_SCENARIO)

    result.push({
      play,
      heroes,
      myHero,
      scenario,
      continuedFromPrevious,
      continuedToNext,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    })
  }

  return result
}
