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
  buildPerItemTypeLabel,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { aeonTrespassOdysseyContent } from './content'
import { getAeonTrespassOdysseyEntries } from './aeonTrespassOdysseyEntries'

function playSummary(entry: ReturnType<typeof getAeonTrespassOdysseyEntries>[number]): string {
  return `${entry.campaign} • ${aeonTrespassOdysseyContent.dayShortLabelByName.get(entry.day) ?? entry.day}`
}

export function computeAeonTrespassOdysseyAchievements(plays: BggPlay[], username: string) {
  const entries = getAeonTrespassOdysseyEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const dayPlays = buildCanonicalCounts({
    preferredItems: aeonTrespassOdysseyContent.days.map((day) => buildAchievementItem(day)),
    observed: entries
      .filter((entry) => entry.day !== 'Unknown day')
      .map((entry) => ({ item: buildAchievementItem(entry.day), amount: entry.quantity })),
  })

  const cyclePlays = buildCanonicalCounts({
    preferredItems: aeonTrespassOdysseyContent.cycles.map((cycle) => buildAchievementItem(cycle)),
    observed: entries
      .filter((entry) => entry.campaign !== 'Unknown cycle')
      .map((entry) => ({ item: buildAchievementItem(entry.campaign), amount: entry.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        return entry ? buildCompletionFromPlay(entry.play, playSummary(entry)) : undefined
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
        levels: [1],
        typeLabel: buildPerItemTypeLabel('Play', 'day', 'time'),
        futureLevelsToShow: 5,
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
            return entry ? buildCompletionFromPlay(entry.play, playSummary(entry)) : undefined
          },
        }
      }),
    )
  }

  if (cyclePlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'cyclePlays',
        achievementBaseId: 'play-each-cycle',
        verb: 'Play',
        itemNoun: 'cycle',
        unitSingular: 'time',
        items: cyclePlays.items,
        countsByItemId: cyclePlays.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'aeonTrespassOdyssey',
    gameName: 'Aeon Trespass: Odyssey',
    tracks,
  })
}
