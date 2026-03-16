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
import { earthborneRangersContent } from './content'
import { getEarthborneRangersEntries } from './earthborneRangersEntries'

export function computeEarthborneRangersAchievements(plays: BggPlay[], username: string) {
  const entries = getEarthborneRangersEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const dayPlays = buildCanonicalCounts({
    preferredItems: earthborneRangersContent.days.map((day) => buildAchievementItem(day)),
    observed: entries
      .filter((entry) => entry.day !== 'Unknown day')
      .map((entry) => ({ item: buildAchievementItem(entry.day), amount: entry.quantity })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(earthborneRangersContent.dayBoxByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .map((entry) => {
        const box = earthborneRangersContent.dayBoxByName.get(entry.day)
        return box ? { item: buildAchievementItem(box), amount: entry.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        return entry ? buildCompletionFromPlay(entry.play, entry.day) : undefined
      },
    },
  ]

  if (dayPlays.items.length > 0) {
    const labelById = new Map(dayPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'dayPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'day'),
        verb: 'Play',
        itemNoun: 'day',
        unitSingular: 'time',
        items: dayPlays.items,
        countsByItemId: dayPlays.countsByItemId,
        levels: [1, 3, 10],
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'dayPlays',
        verb: 'Play',
        itemNoun: 'day',
        unitSingular: 'time',
        items: dayPlays.items,
        countsByItemId: dayPlays.countsByItemId,
        levels: [1, 3, 10],
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (candidate) =>
                candidate.day !== 'Unknown day' && normalizeKey(candidate.day) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, entry.day) : undefined
          },
        }
      }),
    )
  }

  if (boxCounts.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'boxPlays',
        achievementBaseId: 'play-each-box',
        verb: 'Play',
        itemNoun: 'box',
        unitSingular: 'time',
        items: boxCounts.items,
        countsByItemId: boxCounts.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'earthborneRangers',
    gameName: 'Earthborne Rangers',
    tracks,
  })
}
