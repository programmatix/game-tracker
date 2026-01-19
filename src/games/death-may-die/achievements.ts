import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildIndividualItemTracks,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { getDeathMayDieEntries } from './deathMayDieEntries'
import { deathMayDieContent } from './content'

export function computeDeathMayDieAchievements(plays: BggPlay[], username: string) {
  const entries = getDeathMayDieEntries(plays, username)
  const totalPlays = sumQuantities(entries)

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
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (elderOnes.items.length > 0) {
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
      }),
    )
  }

  if (scenarios.items.length > 0) {
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
      }),
    )
  }

  if (myInvestigators.items.length > 0) {
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
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'deathMayDie',
    gameName: 'Cthulhu: Death May Die',
    tracks,
  })
}

