import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { elderScrollsContent } from './content'
import { getElderScrollsEntries } from './elderScrollsEntries'

export function computeElderScrollsAchievements(plays: BggPlay[], username: string) {
  const entries = getElderScrollsEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const provinces = buildCanonicalCounts({
    preferredItems: elderScrollsContent.provinces.map((province) => buildAchievementItem(province)),
    observed: entries
      .filter((entry) => entry.province !== 'Unknown province')
      .map((entry) => ({ item: buildAchievementItem(entry.province), amount: entry.quantity })),
  })

  const classes = buildCanonicalCounts({
    preferredItems: elderScrollsContent.classes.map((heroClass) => buildAchievementItem(heroClass)),
    observed: entries
      .filter((entry) => entry.heroClass !== 'Unknown class')
      .map((entry) => ({ item: buildAchievementItem(entry.heroClass), amount: entry.quantity })),
  })

  const races = buildCanonicalCounts({
    preferredItems: elderScrollsContent.races.map((race) => buildAchievementItem(race)),
    observed: entries
      .filter((entry) => entry.race !== 'Unknown race')
      .map((entry) => ({ item: buildAchievementItem(entry.race), amount: entry.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(
          entry.play,
          `${entry.province} • ${entry.heroClass} • ${entry.race}`,
        )
      },
    },
  ]

  if (provinces.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'provincePlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'province'),
        verb: 'Play',
        itemNoun: 'province',
        unitSingular: 'time',
        items: provinces.items,
        countsByItemId: provinces.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (classes.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'classPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'class'),
        verb: 'Play',
        itemNoun: 'class',
        unitSingular: 'time',
        items: classes.items,
        countsByItemId: classes.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (races.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'racePlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'race'),
        verb: 'Play',
        itemNoun: 'race',
        unitSingular: 'time',
        items: races.items,
        countsByItemId: races.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'elderScrolls',
    gameName: 'The Elder Scrolls: Betrayal of the Second Era',
    tracks,
  })
}
