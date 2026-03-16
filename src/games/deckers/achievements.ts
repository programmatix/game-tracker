import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { deckersContent } from './content'
import { getDeckersEntries } from './deckersEntries'

export function computeDeckersAchievements(plays: BggPlay[], username: string) {
  const entries = getDeckersEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const deckerPlays = buildCanonicalCounts({
    preferredItems: deckersContent.deckers.map((decker) => buildAchievementItem(decker)),
    observed: entries
      .flatMap((entry) =>
        entry.deckers.map((decker) => ({
          item: buildAchievementItem(decker),
          amount: entry.quantity,
        })),
      ),
  })

  const smcPlays = buildCanonicalCounts({
    preferredItems: deckersContent.smcs.map((smc) => buildAchievementItem(smc)),
    observed: entries
      .filter((entry) => entry.smc !== 'Unknown SMC')
      .map((entry) => ({ item: buildAchievementItem(entry.smc), amount: entry.quantity })),
  })

  const smcWins = buildCanonicalCounts({
    preferredItems: deckersContent.smcs.map((smc) => buildAchievementItem(smc)),
    observed: entries
      .filter((entry) => entry.smc !== 'Unknown SMC')
      .map((entry) => ({
        item: buildAchievementItem(entry.smc),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const colorCounts = buildCanonicalCounts({
    preferredItems: deckersContent.deckerGroups.map((group) => buildAchievementItem(group)),
    observed: entries
      .flatMap((entry) => [...new Set(entry.deckers)].map((decker) => ({ decker, entry })))
      .map((row) => {
        const group = deckersContent.deckerGroupByName.get(row.decker)
        return group ? { item: buildAchievementItem(group), amount: row.entry.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const deckerSummary = entry.deckers.length > 0 ? entry.deckers.join(' + ') : 'Unknown decker'
        return buildCompletionFromPlay(entry.play, `${deckerSummary} vs ${entry.smc}`)
      },
    },
  ]

  if (deckerPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'deckerPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'decker'),
        verb: 'Play',
        itemNoun: 'decker',
        unitSingular: 'time',
        items: deckerPlays.items,
        countsByItemId: deckerPlays.countsByItemId,
      }),
    )
  }

  if (smcPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'smcPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'smc'),
        verb: 'Play',
        itemNoun: 'SMC',
        unitSingular: 'time',
        items: smcPlays.items,
        countsByItemId: smcPlays.countsByItemId,
      }),
    )
  }

  if (smcWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'smcWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'smc'),
        verb: 'Defeat',
        itemNoun: 'SMC',
        unitSingular: 'win',
        items: smcWins.items,
        countsByItemId: smcWins.countsByItemId,
      }),
    )
  }

  if (colorCounts.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'colorPlays',
        achievementBaseId: 'play-each-color',
        verb: 'Play',
        itemNoun: 'color pair',
        unitSingular: 'time',
        items: colorCounts.items,
        countsByItemId: colorCounts.countsByItemId,
        levels: [1, 3, 5],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'deckers',
    gameName: 'Deckers',
    tracks,
  })
}
