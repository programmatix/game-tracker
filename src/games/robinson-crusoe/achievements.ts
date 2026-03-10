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
import { robinsonCrusoeContent } from './content'
import { getRobinsonCrusoeEntries } from './robinsonCrusoeEntries'

export function computeRobinsonCrusoeAchievements(plays: BggPlay[], username: string) {
  const entries = getRobinsonCrusoeEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const scenarioPlays = buildCanonicalCounts({
    preferredItems: robinsonCrusoeContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => entry.scenario !== 'Unknown scenario')
      .map((entry) => ({ item: buildAchievementItem(entry.scenario), amount: entry.quantity })),
  })

  const scenarioWins = buildCanonicalCounts({
    preferredItems: robinsonCrusoeContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => entry.scenario !== 'Unknown scenario')
      .map((entry) => ({
        item: buildAchievementItem(entry.scenario),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(robinsonCrusoeContent.scenarioBoxByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .map((entry) => {
        const box = robinsonCrusoeContent.scenarioBoxByName.get(entry.scenario)
        return box ? { item: buildAchievementItem(box), amount: entry.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, entry.scenario)
      },
    },
  ]

  if (scenarioPlays.items.length > 0) {
    const labelById = new Map(scenarioPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'scenario'),
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarioPlays.items,
        countsByItemId: scenarioPlays.countsByItemId,
        levels: [1, 3, 10],
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioPlays',
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarioPlays.items,
        countsByItemId: scenarioPlays.countsByItemId,
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
                candidate.scenario !== 'Unknown scenario' &&
                normalizeKey(candidate.scenario) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, entry.scenario) : undefined
          },
        }
      }),
    )
  }

  if (scenarioWins.items.length > 0) {
    const labelById = new Map(scenarioWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'scenario'),
        verb: 'Defeat',
        itemNoun: 'scenario',
        unitSingular: 'win',
        items: scenarioWins.items,
        countsByItemId: scenarioWins.countsByItemId,
        levels: [1, 3, 10],
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioWins',
        verb: 'Defeat',
        itemNoun: 'scenario',
        unitSingular: 'win',
        items: scenarioWins.items,
        countsByItemId: scenarioWins.countsByItemId,
        levels: [1, 3, 10],
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? labelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetWins: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetWins,
              predicate: (candidate) =>
                candidate.isWin &&
                candidate.scenario !== 'Unknown scenario' &&
                normalizeKey(candidate.scenario) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, entry.scenario) : undefined
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
    gameId: 'robinsonCrusoe',
    gameName: 'Robinson Crusoe',
    tracks,
  })
}
