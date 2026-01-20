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
import { getBulletEntries } from './bulletEntries'
import { bulletContent } from './content'

export function computeBulletAchievements(plays: BggPlay[], username: string) {
  const entries = getBulletEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const bosses = buildCanonicalCounts({
    preferredItems: bulletContent.bosses.map((boss) => buildAchievementItem(boss)),
    observed: entries
      .filter((e) => e.boss !== 'Unknown boss')
      .map((e) => ({ item: buildAchievementItem(e.boss), amount: e.isWin ? e.quantity : 0 })),
  })

  const heroines = buildCanonicalCounts({
    preferredItems: bulletContent.heroines.map((heroine) => buildAchievementItem(heroine)),
    observed: entries
      .filter((e) => Boolean(e.myHeroine))
      .map((e) => ({ item: buildAchievementItem(e.myHeroine!), amount: e.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const detailParts = [entry.boss !== 'Unknown boss' ? entry.boss : undefined, entry.myHeroine].filter(Boolean)
        return buildCompletionFromPlay(entry.play, detailParts.join(' • ') || 'Play')
      },
    },
  ]

  if (bosses.items.length > 0) {
    const bossLabelById = new Map(bosses.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'bossWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'boss'),
        verb: 'Defeat',
        itemNoun: 'boss',
        unitSingular: 'win',
        items: bosses.items,
        countsByItemId: bosses.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'bossWins',
        verb: 'Defeat',
        itemNoun: 'boss',
        unitSingular: 'win',
        items: bosses.items,
        countsByItemId: bosses.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? bossLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && e.boss !== 'Unknown boss' && normalizeKey(e.boss) === labelKey,
            })
            if (!entry) return undefined
            const heroine = entry.myHeroine ? ` • ${entry.myHeroine}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.boss}${heroine}`)
          },
        }
      }),
    )
  }

  if (heroines.items.length > 0) {
    const heroineLabelById = new Map(heroines.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroinePlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'heroine'),
        verb: 'Play',
        itemNoun: 'heroine',
        unitSingular: 'time',
        items: heroines.items,
        countsByItemId: heroines.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroinePlays',
        verb: 'Play',
        itemNoun: 'heroine',
        unitSingular: 'time',
        items: heroines.items,
        countsByItemId: heroines.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? heroineLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => Boolean(e.myHeroine) && normalizeKey(e.myHeroine!) === labelKey,
            })
            if (!entry) return undefined
            const boss = entry.boss !== 'Unknown boss' ? ` • ${entry.boss}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.myHeroine}${boss}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'bullet',
    gameName: 'Bullet',
    tracks,
  })
}

