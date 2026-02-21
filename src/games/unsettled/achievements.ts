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
import { unsettledContent } from './content'
import { getUnsettledEntries } from './unsettledEntries'

export function computeUnsettledAchievements(plays: BggPlay[], username: string) {
  const entries = getUnsettledEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const planets = buildCanonicalCounts({
    preferredItems: unsettledContent.planets.map((planet) => buildAchievementItem(planet)),
    observed: entries
      .filter((entry) => entry.planet !== 'Unknown planet')
      .map((entry) => ({ item: buildAchievementItem(entry.planet), amount: entry.quantity })),
  })

  const tasks = buildCanonicalCounts({
    preferredItems: unsettledContent.tasks.map((task) => buildAchievementItem(task)),
    observed: entries
      .filter((entry) => entry.task !== 'Unknown task')
      .map((entry) => ({ item: buildAchievementItem(entry.task), amount: entry.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, `${entry.planet} • Task ${entry.task}`)
      },
    },
  ]

  if (planets.items.length > 0) {
    const planetLabelById = new Map(planets.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'planetPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'planet'),
        verb: 'Play',
        itemNoun: 'planet',
        unitSingular: 'time',
        items: planets.items,
        countsByItemId: planets.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'planetPlays',
        verb: 'Play',
        itemNoun: 'planet',
        unitSingular: 'time',
        items: planets.items,
        countsByItemId: planets.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? planetLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => e.planet !== 'Unknown planet' && normalizeKey(e.planet) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.planet} • Task ${entry.task}`)
          },
        }
      }),
    )
  }

  if (tasks.items.length > 0) {
    const taskLabelById = new Map(tasks.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'taskPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'task'),
        verb: 'Play',
        itemNoun: 'task',
        unitSingular: 'time',
        items: tasks.items,
        countsByItemId: tasks.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'taskPlays',
        verb: 'Play',
        itemNoun: 'task',
        unitSingular: 'time',
        items: tasks.items,
        countsByItemId: tasks.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? taskLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => e.task !== 'Unknown task' && normalizeKey(e.task) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.planet} • Task ${entry.task}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'unsettled',
    gameName: 'Unsettled',
    tracks,
  })
}
