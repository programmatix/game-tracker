import type { BggPlay } from '../../bgg'
import { isMageKnightHeroToken, parseMageKnightPlayerColor } from './mageKnight'

export const MAGE_KNIGHT_OBJECT_IDS = new Set(['248562', '96848'])

export type MageKnightEntry = {
  play: BggPlay
  heroes: string[]
  myHero?: string
  quantity: number
  isWin: boolean
}

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
          extraTags: parsed.extraTags,
        }
      })
      .filter((player) => Boolean(player.hero || player.extraTags.length > 0))

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

    result.push({
      play,
      heroes,
      myHero,
      quantity: playQuantity(play),
      isWin: myPlayer?.win === true,
    })
  }

  return result
}
