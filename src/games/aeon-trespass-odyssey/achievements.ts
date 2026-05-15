import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildNamedCountTrack,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { aeonTrespassOdysseyContent } from './content'
import { getAeonTrespassOdysseyEntries } from './aeonTrespassOdysseyEntries'

function playSummary(entry: ReturnType<typeof getAeonTrespassOdysseyEntries>[number]): string {
  const start = entry.startDayNumber === undefined ? '?' : `D${entry.startDayNumber}`
  const end = entry.endDayNumber === undefined ? '?' : `D${entry.endDayNumber}`
  const range = start === end ? end : `${start}-${end}`
  return `${entry.campaign} • ${range}`
}

export function computeAeonTrespassOdysseyAchievements(plays: BggPlay[], username: string) {
  const entries = getAeonTrespassOdysseyEntries(plays, username)
  const campaignEntries = entries.filter((entry) => !entry.isLearnToPlay)
  const totalPlays = sumQuantities(campaignEntries)
  const currentDay = campaignEntries.reduce((max, entry) => Math.max(max, entry.endDayNumber ?? 0), 0)

  const cyclePlays = buildCanonicalCounts({
    preferredItems: aeonTrespassOdysseyContent.cycles.map((cycle) => buildAchievementItem(cycle)),
    observed: campaignEntries
      .filter((entry) => entry.campaign !== 'Unknown cycle')
      .map((entry) => ({ item: buildAchievementItem(entry.campaign), amount: entry.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries: campaignEntries, target: level })
        return entry ? buildCompletionFromPlay(entry.play, playSummary(entry)) : undefined
      },
    },
    {
      ...buildNamedCountTrack({
        trackId: 'campaignProgress',
        achievementBaseId: 'reach-day',
        typeLabel: 'Campaign progress',
        current: currentDay,
        unitSingular: 'day',
        levels: [10, 20, 30, 40, 50, 60, 70, 80],
        titleForLevel: (level) => `Reach day ${level}`,
        formatProgress: (value, target) => `${value.toLocaleString()} / ${target.toLocaleString()} days`,
        formatRemaining: (remaining) => `${remaining.toLocaleString()} days left`,
      }),
      showAllFutureLevels: true,
      completionForLevel: (level) => {
        const entry = campaignEntries.find((candidate) => (candidate.endDayNumber ?? 0) >= level)
        return entry ? buildCompletionFromPlay(entry.play, playSummary(entry)) : undefined
      },
    },
  ]

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
