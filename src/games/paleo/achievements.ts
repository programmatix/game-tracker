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
import { getPaleoEntries } from './paleoEntries'
import { paleoContent } from './content'

export function computePaleoAchievements(plays: BggPlay[], username: string) {
  const entries = getPaleoEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const modulePlays = buildCanonicalCounts({
    preferredItems: paleoContent.modules.map((module) => buildAchievementItem(module)),
    observed: entries
      .flatMap((entry) => [...new Set([entry.moduleA, entry.moduleB])].map((module) => ({ module, entry })))
      .filter((row) => row.module !== 'Unknown module')
      .map((row) => ({ item: buildAchievementItem(row.module), amount: row.entry.quantity })),
  })

  const moduleWins = buildCanonicalCounts({
    preferredItems: paleoContent.modules.map((module) => buildAchievementItem(module)),
    observed: entries
      .flatMap((entry) => [...new Set([entry.moduleA, entry.moduleB])].map((module) => ({ module, entry })))
      .filter((row) => row.module !== 'Unknown module')
      .map((row) => ({
        item: buildAchievementItem(row.module),
        amount: row.entry.isWin ? row.entry.quantity : 0,
      })),
  })

  const scenarioPlays = buildCanonicalCounts({
    preferredItems: paleoContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => entry.scenario !== 'Unknown scenario')
      .map((entry) => ({ item: buildAchievementItem(entry.scenario), amount: entry.quantity })),
  })

  const scenarioWins = buildCanonicalCounts({
    preferredItems: paleoContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => entry.scenario !== 'Unknown scenario')
      .map((entry) => ({
        item: buildAchievementItem(entry.scenario),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(paleoContent.moduleGroupByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .flatMap((entry) => [...new Set([entry.moduleA, entry.moduleB])].map((module) => ({ module, entry })))
      .map((row) => {
        const box = paleoContent.moduleGroupByName.get(row.module)
        return box ? { item: buildAchievementItem(box), amount: row.entry.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, `${entry.moduleA} + ${entry.moduleB} • ${entry.scenario}`)
      },
    },
  ]

  if (modulePlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'modulePlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'module'),
        verb: 'Play',
        itemNoun: 'module',
        unitSingular: 'time',
        items: modulePlays.items,
        countsByItemId: modulePlays.countsByItemId,
      }),
    )
  }

  if (moduleWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'moduleWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'module'),
        verb: 'Defeat',
        itemNoun: 'module',
        unitSingular: 'win',
        items: moduleWins.items,
        countsByItemId: moduleWins.countsByItemId,
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
        levels: [1, 3, 10],
      }),
    )
  }

  if (scenarioWins.items.length > 0) {
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
    gameId: 'paleo',
    gameName: 'Paleo',
    tracks,
  })
}
