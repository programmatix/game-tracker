import type { BggPlay } from '../bgg'
import { findConfigurableGameIdForOptions } from '../configurableGameMatching'
import { costRegistry } from '../costRegistry'
import {
  effectiveCostForSaleMode,
  formatDurationHoursMinutes,
  hoursNeededForTarget,
} from '../costsShared'
import { totalPlayMinutes } from '../playDuration'
import { playQuantity } from '../playsHelpers'
import { buildUnlockedAchievementsForGame } from './engine'
import { buildNamedCountTrack } from './gameUtils'
import type { Achievement, AchievementTrack } from './types'

const PLAY_TIME_LEVELS = [5, 10, 20, 50, 100]
const COST_PER_HOUR_LEVELS = [1, 2, 5, 10]

function matchedPlaysForGame(gameId: string, plays: BggPlay[]): BggPlay[] {
  return plays.filter(
    (play) =>
      findConfigurableGameIdForOptions({
        name: play.item?.attributes.name || null,
        objectId: play.item?.attributes.objectid || null,
      }) === gameId,
  )
}

function totalHoursForPlays(plays: BggPlay[]): number {
  let minutes = 0
  for (const play of plays) {
    minutes += totalPlayMinutes(play.attributes, playQuantity(play))
  }
  return minutes / 60
}

function buildCostTrack(input: {
  trackId: string
  achievementBaseId: string
  titleSuffix: string
  effectiveCost: number
  hours: number
}): AchievementTrack {
  return {
    trackId: input.trackId,
    achievementBaseId: input.achievementBaseId,
    typeLabel: 'Cost / hour',
    kind: 'counter',
    showAllFutureLevels: true,
    levels: COST_PER_HOUR_LEVELS,
    titleForLevel: (level) => `Get costs to ${level}/h (${input.titleSuffix})`,
    progressForLevel: (level) => {
      const targetHours = hoursNeededForTarget(input.effectiveCost, level) ?? 0
      const currentHours = Math.max(0, input.hours)
      const remainingHours = Math.max(0, targetHours - currentHours)
      const progressValue = targetHours <= 0 ? 1 : Math.min(currentHours, targetHours)

      return {
        isComplete: currentHours >= targetHours,
        remainingPlays: remainingHours,
        playsSoFar: currentHours,
        progressValue,
        progressTarget: targetHours <= 0 ? 1 : targetHours,
        progressLabel:
          targetHours <= 0
            ? '0h needed'
            : `${formatDurationHoursMinutes(progressValue)} / ${formatDurationHoursMinutes(targetHours)}`,
      }
    },
  }
}

export function computeStandardAchievementsForGame(input: {
  gameId: string
  gameName: string
  plays: BggPlay[]
}): Achievement[] {
  const plays = matchedPlaysForGame(input.gameId, input.plays)
  const hours = totalHoursForPlays(plays)
  const tracks: AchievementTrack[] = [
    {
      ...buildNamedCountTrack({
        trackId: 'totalHours',
        achievementBaseId: 'total-hours',
        typeLabel: 'Play time',
        current: hours,
        unitSingular: 'hour',
        titleForLevel: (level) => `Play for ${level} hours`,
        levels: PLAY_TIME_LEVELS,
      }),
      showAllFutureLevels: true,
    },
  ]

  const costEntry = costRegistry.find((entry) => entry.id === input.gameId)
  const totalCost =
    costEntry == null
      ? 0
      : [...costEntry.costs.boxCostsByName.values()].reduce((sum, cost) => sum + cost, 0)

  if (totalCost > 0) {
    tracks.push(
      buildCostTrack({
        trackId: 'costPerHour:sellTwoThirds',
        achievementBaseId: 'cost-per-hour-sell-two-thirds',
        titleSuffix: 'assuming selling for 2/3',
        effectiveCost: effectiveCostForSaleMode(totalCost, 'sellTwoThirds'),
        hours,
      }),
      buildCostTrack({
        trackId: 'costPerHour:none',
        achievementBaseId: 'cost-per-hour-no-sale',
        titleSuffix: 'without selling',
        effectiveCost: effectiveCostForSaleMode(totalCost, 'none'),
        hours,
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: input.gameId,
    gameName: input.gameName,
    tracks,
  })
}
