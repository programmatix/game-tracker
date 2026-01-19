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
import { getDeathMayDieEntries } from './deathMayDieEntries'
import { deathMayDieContent } from './content'

export function computeDeathMayDieAchievements(plays: BggPlay[], username: string) {
  const entries = getDeathMayDieEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const elderOnes = buildCanonicalCounts({
    preferredItems: deathMayDieContent.elderOnes.map((elderOne) => buildAchievementItem(elderOne)),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.elderOne),
      amount: e.isWin ? e.quantity : 0,
    })),
  })

  const scenarios = buildCanonicalCounts({
    preferredItems: deathMayDieContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.scenario),
      amount: e.quantity,
    })),
  })

  const myInvestigators = buildCanonicalCounts({
    preferredItems: deathMayDieContent.investigators.map((investigator) => buildAchievementItem(investigator)),
    observed: entries
      .filter((e) => Boolean(e.myInvestigator))
      .map((e) => ({ item: buildAchievementItem(e.myInvestigator!), amount: e.quantity })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const investigator = entry.myInvestigator ? ` • ${entry.myInvestigator}` : ''
        return buildCompletionFromPlay(entry.play, `${entry.scenario}${investigator}`)
      },
    },
  ]

  if (elderOnes.items.length > 0) {
    const elderOneLabelById = new Map(elderOnes.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'elderOneWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'elder one'),
        verb: 'Defeat',
        itemNoun: 'elder one',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItemId: elderOnes.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'elderOneWins',
        verb: 'Defeat',
        itemNoun: 'elder one',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItemId: elderOnes.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? elderOneLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.elderOne) === labelKey,
            })
            if (!entry) return undefined
            const investigator = entry.myInvestigator ? ` • ${entry.myInvestigator}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.scenario}${investigator}`)
          },
        }
      }),
    )
  }

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
            const investigator = entry.myInvestigator ? ` • ${entry.myInvestigator}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.elderOne}${investigator}`)
          },
        }
      }),
    )
  }

  if (myInvestigators.items.length > 0) {
    const investigatorLabelById = new Map(myInvestigators.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'investigatorPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'investigator'),
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItemId: myInvestigators.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'investigatorPlays',
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItemId: myInvestigators.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? investigatorLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => Boolean(e.myInvestigator) && normalizeKey(e.myInvestigator!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.scenario} • ${entry.elderOne}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'deathMayDie',
    gameName: 'Cthulhu: Death May Die',
    tracks,
  })
}
