import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildIndividualItemTracks,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { mageKnightContent } from './content'
import { getMageKnightEntries } from './mageKnightEntries'

export function computeMageKnightAchievements(plays: BggPlay[], username: string) {
  const entries = getMageKnightEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const heroes = buildCanonicalCounts({
    preferredItems: mageKnightContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.myHero))
      .map((entry) => ({ item: buildAchievementItem(entry.myHero!), amount: entry.quantity })),
  })

  const heroWins = buildCanonicalCounts({
    preferredItems: mageKnightContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.myHero))
      .map((entry) => ({
        item: buildAchievementItem(entry.myHero!),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, entry.myHero || 'Play')
      },
    },
  ]

  if (heroes.items.length > 0) {
    const heroLabelById = new Map(heroes.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'hero'),
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroes.items,
        countsByItemId: heroes.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroPlays',
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroes.items,
        countsByItemId: heroes.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? heroLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => Boolean(e.myHero) && normalizeKey(e.myHero!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, entry.myHero || 'Play')
          },
        }
      }),
    )
  }

  if (heroWins.items.length > 0) {
    const heroWinLabelById = new Map(heroWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroWins',
        verb: 'Defeat',
        itemNoun: 'hero',
        unitSingular: 'win',
        items: heroWins.items,
        countsByItemId: heroWins.countsByItemId,
        formatItem: (item) => `as ${item}`,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? heroWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && Boolean(e.myHero) && normalizeKey(e.myHero!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.myHero} win`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'mageKnight',
    gameName: 'Mage Knight',
    tracks,
  })
}
