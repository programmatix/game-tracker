import type { BggPlay } from '../../bgg'
import { isBulletBossToken, isBulletHeroineToken, parseBulletPlayerColor } from './bullet'

export const BULLET_OBJECT_ID = '307305'

export type BulletEntry = {
  play: BggPlay
  boss: string
  heroines: string[]
  myHeroine?: string
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

export function getBulletEntries(plays: BggPlay[], username: string): BulletEntry[] {
  const result: BulletEntry[] = []
  const user = username.toLowerCase()

  for (const play of plays) {
    const objectid = play.item?.attributes.objectid || ''
    const name = play.item?.attributes.name || ''
    const isBullet = objectid === BULLET_OBJECT_ID || /^Bullet/.test(name)
    if (!isBullet) continue

    const parsedPlayers = play.players
      .map((player) => {
        const rawColor = player.attributes.color || ''
        const parsed = parseBulletPlayerColor(rawColor)
        return {
          username: (player.attributes.username || '').toLowerCase(),
          win: player.attributes.win === '1',
          heroine: parsed.heroine,
          boss: parsed.boss,
          extraTags: parsed.extraTags,
        }
      })
      .filter((player) => Boolean(player.heroine || player.boss || player.extraTags.length > 0))

    const heroinesSet = new Map<string, string>()
    for (const player of parsedPlayers) {
      const heroine = player.heroine?.trim()
      if (heroine && isBulletHeroineToken(heroine)) heroinesSet.set(heroine.toLowerCase(), heroine)

      for (const tag of player.extraTags) {
        if (!isBulletHeroineToken(tag)) continue
        heroinesSet.set(tag.toLowerCase(), tag)
      }
    }
    const heroines = [...heroinesSet.values()]

    const myPlayer = parsedPlayers.find((p) => p.username === user)
    const myHeroine = myPlayer?.heroine && isBulletHeroineToken(myPlayer.heroine) ? myPlayer.heroine : undefined
    const isWin = myPlayer?.win === true

    const bossCandidates = parsedPlayers
      .flatMap((p) => [p.boss, ...p.extraTags])
      .filter(Boolean)
      .map((value) => value!.trim())
      .filter((value) => isBulletBossToken(value))

    const boss = chooseMostCommonOrFirst(bossCandidates) || 'Unknown boss'

    result.push({
      play,
      boss,
      heroines,
      myHeroine,
      quantity: playQuantity(play),
      isWin,
    })
  }

  return result
}

