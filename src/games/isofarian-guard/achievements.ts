import type { BggPlay } from '../../bgg'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { isofarianGuardContent } from './content'
import { getIsofarianGuardEntries } from './isofarianGuardEntries'

export function computeIsofarianGuardAchievements(plays: BggPlay[], username: string) {
  const entries = getIsofarianGuardEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const campaignCounts = buildCanonicalCounts({
    preferredItems: isofarianGuardContent.campaigns.map((campaign) => buildAchievementItem(campaign)),
    observed: entries
      .filter((entry) => entry.campaign !== 'Unknown campaign')
      .map((entry) => ({ item: buildAchievementItem(entry.campaign), amount: entry.quantity })),
  })

  const chapterCounts = buildCanonicalCounts({
    preferredItems: isofarianGuardContent.chapters.map((chapter) => buildAchievementItem(chapter)),
    observed: entries
      .filter((entry) => entry.chapter !== 'Unknown chapter')
      .map((entry) => ({ item: buildAchievementItem(entry.chapter), amount: entry.quantity })),
  })

  const guardCounts = buildCanonicalCounts({
    preferredItems: isofarianGuardContent.guards.map((guard) => buildAchievementItem(guard)),
    observed: entries.flatMap((entry) =>
      entry.guards
        .filter((guard) => guard !== 'Unknown guard')
        .map((guard) => ({ item: buildAchievementItem(guard), amount: entry.quantity })),
    ),
  })

  return buildUnlockedAchievementsForGame({
    gameId: 'isofarianGuard',
    gameName: 'Isofarian Guard',
    tracks: [
      buildPlayCountTrack({
        trackId: 'plays',
        achievementBaseId: 'plays',
        currentPlays: totalPlays,
      }),
      buildPerItemTrack({
        trackId: 'campaignPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'campaign'),
        verb: 'Play',
        itemNoun: 'campaign',
        unitSingular: 'time',
        items: campaignCounts.items,
        countsByItemId: campaignCounts.countsByItemId,
        levels: [1, 3, 10],
      }),
      buildPerItemTrack({
        trackId: 'chapterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'chapter'),
        verb: 'Play',
        itemNoun: 'chapter',
        unitSingular: 'time',
        items: chapterCounts.items,
        countsByItemId: chapterCounts.countsByItemId,
        levels: [1, 2, 5],
      }),
      buildPerItemTrack({
        trackId: 'guardPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'guard'),
        verb: 'Play',
        itemNoun: 'guard',
        unitSingular: 'time',
        items: guardCounts.items,
        countsByItemId: guardCounts.countsByItemId,
        levels: [1, 3, 10],
      }),
    ],
  })
}
