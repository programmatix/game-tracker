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
import { starTrekCaptainsChairContent } from './content'
import { getStarTrekCaptainsChairEntries } from './starTrekCaptainsChairEntries'

export function computeStarTrekCaptainsChairAchievements(plays: BggPlay[], username: string) {
  const entries = getStarTrekCaptainsChairEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const scenarios = buildCanonicalCounts({
    preferredItems: starTrekCaptainsChairContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries.map((entry) => ({ item: buildAchievementItem(entry.scenario), amount: entry.quantity })),
  })

  const scenarioWins = buildCanonicalCounts({
    preferredItems: starTrekCaptainsChairContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries.map((entry) => ({
      item: buildAchievementItem(entry.scenario),
      amount: entry.isWin ? entry.quantity : 0,
    })),
  })

  const captains = buildCanonicalCounts({
    preferredItems: starTrekCaptainsChairContent.captains.map((captain) => buildAchievementItem(captain)),
    observed: entries.map((entry) => ({ item: buildAchievementItem(entry.captain), amount: entry.quantity })),
  })

  const captainWins = buildCanonicalCounts({
    preferredItems: starTrekCaptainsChairContent.captains.map((captain) => buildAchievementItem(captain)),
    observed: entries.map((entry) => ({
      item: buildAchievementItem(entry.captain),
      amount: entry.isWin ? entry.quantity : 0,
    })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, `${entry.captain} • ${entry.scenario}`)
      },
    },
  ]

  if (scenarios.items.length > 0) {
    const scenarioLabelById = new Map(scenarios.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'scenario'),
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItemId: scenarios.countsByItemId,
        typeLabel: buildPerItemTypeLabel('Play', 'scenario', 'time'),
        futureLevelsToShow: 5,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioPlays',
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItemId: scenarios.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? scenarioLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.scenario) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.captain} • ${entry.scenario}`)
          },
        }
      }),
    )
  }

  if (scenarioWins.items.length > 0) {
    const scenarioWinLabelById = new Map(scenarioWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'scenario'),
        verb: 'Defeat',
        itemNoun: 'scenario',
        unitSingular: 'win',
        items: scenarioWins.items,
        countsByItemId: scenarioWins.countsByItemId,
        typeLabel: buildPerItemTypeLabel('Defeat', 'scenario', 'win'),
        futureLevelsToShow: 5,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioWins',
        verb: 'Defeat',
        itemNoun: 'scenario',
        unitSingular: 'win',
        items: scenarioWins.items,
        countsByItemId: scenarioWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? scenarioWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.scenario) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.captain} • ${entry.scenario}`)
          },
        }
      }),
    )
  }

  if (captains.items.length > 0) {
    const captainLabelById = new Map(captains.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'captainPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'captain'),
        verb: 'Play',
        itemNoun: 'captain',
        unitSingular: 'time',
        items: captains.items,
        countsByItemId: captains.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'captainPlays',
        verb: 'Play',
        itemNoun: 'captain',
        unitSingular: 'time',
        items: captains.items,
        countsByItemId: captains.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? captainLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.captain) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.captain} • ${entry.scenario}`)
          },
        }
      }),
    )
  }

  if (captainWins.items.length > 0) {
    const captainWinLabelById = new Map(captainWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'captainWins',
        verb: 'Defeat',
        itemNoun: 'captain',
        unitSingular: 'win',
        items: captainWins.items,
        countsByItemId: captainWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? captainWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.captain) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.captain} • ${entry.scenario}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'starTrekCaptainsChair',
    gameName: "Star Trek: Captain's Chair",
    tracks,
  })
}
