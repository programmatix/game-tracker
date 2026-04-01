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
import { arkhamHorrorLcgContent } from './content'
import { getArkhamHorrorLcgEntries } from './arkhamHorrorLcgEntries'

export function computeArkhamHorrorLcgAchievements(plays: BggPlay[], username: string) {
  const entries = getArkhamHorrorLcgEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const campaignPlays = buildCanonicalCounts({
    preferredItems: arkhamHorrorLcgContent.campaigns.map((campaign) => buildAchievementItem(campaign)),
    observed: entries
      .filter((entry) => entry.campaign !== 'Unknown campaign')
      .map((entry) => ({ item: buildAchievementItem(entry.campaign), amount: entry.quantity })),
  })

  const scenarioPlays = buildCanonicalCounts({
    preferredItems: arkhamHorrorLcgContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => entry.scenario !== 'Unknown scenario')
      .map((entry) => ({ item: buildAchievementItem(entry.scenario), amount: entry.quantity })),
  })

  const investigatorPlays = buildCanonicalCounts({
    preferredItems: arkhamHorrorLcgContent.investigators.map((investigator) => buildAchievementItem(investigator)),
    observed: entries.flatMap((entry) =>
      entry.investigators.map((investigator) => ({
        item: buildAchievementItem(investigator),
        amount: entry.quantity,
      })),
    ),
  })

  const difficultyWins = buildCanonicalCounts({
    preferredItems: arkhamHorrorLcgContent.difficulties.map((difficulty) => buildAchievementItem(difficulty)),
    observed: entries.map((entry) => ({
      item: buildAchievementItem(entry.difficulty),
      amount: entry.isWin ? entry.quantity : 0,
    })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        return entry ? buildCompletionFromPlay(entry.play, `${entry.campaign} • ${entry.scenario}`) : undefined
      },
    },
  ]

  if (campaignPlays.items.length > 0) {
    const labelById = new Map(campaignPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'campaignPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'campaign'),
        verb: 'Play',
        itemNoun: 'campaign',
        unitSingular: 'time',
        items: campaignPlays.items,
        countsByItemId: campaignPlays.countsByItemId,
        levels: [1, 3, 10],
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'campaignPlays',
        verb: 'Play',
        itemNoun: 'campaign',
        unitSingular: 'time',
        items: campaignPlays.items,
        countsByItemId: campaignPlays.countsByItemId,
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
                candidate.campaign !== 'Unknown campaign' && normalizeKey(candidate.campaign) === labelKey,
            })
            return entry ? buildCompletionFromPlay(entry.play, `${entry.campaign} • ${entry.scenario}`) : undefined
          },
        }
      }),
    )
  }

  if (scenarioPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'scenario'),
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarioPlays.items,
        countsByItemId: scenarioPlays.countsByItemId,
        levels: [1, 2, 5],
      }),
    )
  }

  if (investigatorPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'investigatorPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'investigator'),
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: investigatorPlays.items,
        countsByItemId: investigatorPlays.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (difficultyWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'difficultyWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'difficulty'),
        verb: 'Defeat',
        itemNoun: 'difficulty',
        unitSingular: 'win',
        items: difficultyWins.items,
        countsByItemId: difficultyWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'arkhamHorrorLcg',
    gameName: 'Arkham Horror: The Card Game',
    tracks,
  })
}
