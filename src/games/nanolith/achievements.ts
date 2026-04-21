import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPerItemTypeLabel,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { getNanolithEntries } from './nanolithEntries'
import { nanolithContent } from './content'

function playSummary(entry: ReturnType<typeof getNanolithEntries>[number]): string {
  return `${entry.encounter} • ${entry.hero || 'Unknown hero'}`
}

export function computeNanolithAchievements(plays: BggPlay[], username: string) {
  const entries = getNanolithEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const encounterPlays = buildCanonicalCounts({
    preferredItems: nanolithContent.encounters.map((encounter) => buildAchievementItem(encounter)),
    observed: entries
      .filter((entry) => entry.encounter !== 'Unknown encounter')
      .map((entry) => ({ item: buildAchievementItem(entry.encounter), amount: entry.quantity })),
  })

  const encounterWins = buildCanonicalCounts({
    preferredItems: nanolithContent.encounters.map((encounter) => buildAchievementItem(encounter)),
    observed: entries
      .filter((entry) => entry.encounter !== 'Unknown encounter')
      .map((entry) => ({
        item: buildAchievementItem(entry.encounter),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const heroPlays = buildCanonicalCounts({
    preferredItems: nanolithContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.hero))
      .map((entry) => ({ item: buildAchievementItem(entry.hero!), amount: entry.quantity })),
  })

  const heroWins = buildCanonicalCounts({
    preferredItems: nanolithContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.hero))
      .map((entry) => ({
        item: buildAchievementItem(entry.hero!),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, playSummary(entry))
      },
    },
  ]

  if (encounterPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'encounterPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'encounter'),
        verb: 'Play',
        itemNoun: 'encounter',
        unitSingular: 'time',
        items: encounterPlays.items,
        countsByItemId: encounterPlays.countsByItemId,
      }),
    )
  }

  if (encounterWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'encounterWins',
        achievementBaseId: 'defeat-each-encounter',
        verb: 'Defeat',
        itemNoun: 'encounter',
        unitSingular: 'win',
        items: encounterWins.items,
        countsByItemId: encounterWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (heroPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'hero'),
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroPlays.items,
        countsByItemId: heroPlays.countsByItemId,
        typeLabel: buildPerItemTypeLabel('Play', 'hero', 'time'),
        futureLevelsToShow: 5,
      }),
    )
  }

  if (heroWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroWins',
        achievementBaseId: 'defeat-each-hero',
        verb: 'Defeat',
        itemNoun: 'hero',
        unitSingular: 'win',
        items: heroWins.items,
        countsByItemId: heroWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'nanolith',
    gameName: 'Nanolith',
    tracks,
  })
}
