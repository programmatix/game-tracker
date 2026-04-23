import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  sumQuantities,
} from '../../achievements/gameUtils'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import { leviathanWildsContent } from './content'
import { getLeviathanWildsEntries } from './leviathanWildsEntries'

function playSummary(entry: ReturnType<typeof getLeviathanWildsEntries>[number]): string {
  return [entry.leviathan, entry.character, entry.className].filter(Boolean).join(' • ')
}

export function computeLeviathanWildsAchievements(plays: BggPlay[], username: string) {
  const entries = getLeviathanWildsEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const leviathanPlays = buildCanonicalCounts({
    preferredItems: leviathanWildsContent.leviathans.map((leviathan) => buildAchievementItem(leviathan)),
    observed: entries
      .filter((entry) => entry.leviathan !== 'Unknown leviathan')
      .map((entry) => ({ item: buildAchievementItem(entry.leviathan), amount: entry.quantity })),
  })
  const characterPlays = buildCanonicalCounts({
    preferredItems: leviathanWildsContent.characters.map((character) => buildAchievementItem(character)),
    observed: entries
      .filter((entry) => Boolean(entry.character))
      .map((entry) => ({ item: buildAchievementItem(entry.character!), amount: entry.quantity })),
  })
  const classPlays = buildCanonicalCounts({
    preferredItems: leviathanWildsContent.classes.map((className) => buildAchievementItem(className)),
    observed: entries
      .filter((entry) => Boolean(entry.className))
      .map((entry) => ({ item: buildAchievementItem(entry.className!), amount: entry.quantity })),
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
    buildPerItemTrack({
      trackId: 'leviathanPlays',
      achievementBaseId: buildPerItemAchievementBaseId('Play', 'leviathan'),
      verb: 'Play',
      itemNoun: 'leviathan',
      unitSingular: 'time',
      items: leviathanPlays.items,
      countsByItemId: leviathanPlays.countsByItemId,
    }),
    buildPerItemTrack({
      trackId: 'characterPlays',
      achievementBaseId: buildPerItemAchievementBaseId('Play', 'character'),
      verb: 'Play',
      itemNoun: 'character',
      unitSingular: 'time',
      items: characterPlays.items,
      countsByItemId: characterPlays.countsByItemId,
    }),
    buildPerItemTrack({
      trackId: 'classPlays',
      achievementBaseId: buildPerItemAchievementBaseId('Play', 'class'),
      verb: 'Play',
      itemNoun: 'class',
      unitSingular: 'time',
      items: classPlays.items,
      countsByItemId: classPlays.countsByItemId,
    }),
  ]

  return buildUnlockedAchievementsForGame({
    gameId: 'leviathanWilds',
    gameName: 'Leviathan Wilds',
    tracks,
  })
}
