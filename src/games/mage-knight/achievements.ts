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
import { mageKnightContent } from './content'
import { getMageKnightEntries } from './mageKnightEntries'

export function computeMageKnightAchievements(plays: BggPlay[], username: string) {
  const entries = getMageKnightEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const heroes = buildCanonicalCounts({
    preferredItems: mageKnightContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.myHero))
      .map((entry) => ({ item: buildAchievementItem(entry.myHero!), amount: entry.quantity })),
  })

  const heroWins = buildCanonicalCounts({
    preferredItems: mageKnightContent.heroes.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => Boolean(entry.myHero))
      .map((entry) => ({
        item: buildAchievementItem(entry.myHero!),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const scenarios = buildCanonicalCounts({
    preferredItems: mageKnightContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => Boolean(entry.scenario))
      .map((entry) => ({ item: buildAchievementItem(entry.scenario!), amount: entry.quantity })),
  })

  const scenarioWins = buildCanonicalCounts({
    preferredItems: mageKnightContent.scenarios.map((scenario) => buildAchievementItem(scenario)),
    observed: entries
      .filter((entry) => Boolean(entry.scenario))
      .map((entry) => ({
        item: buildAchievementItem(entry.scenario!),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, entry.myHero || 'Play')
      },
    },
  ]

  if (heroes.items.length > 0) {
    const heroLabelById = new Map(heroes.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'hero'),
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroes.items,
        countsByItemId: heroes.countsByItemId,
        typeLabel: buildPerItemTypeLabel('Play', 'hero', 'time'),
        futureLevelsToShow: 5,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroPlays',
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroes.items,
        countsByItemId: heroes.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? heroLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => Boolean(e.myHero) && normalizeKey(e.myHero!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, entry.myHero || 'Play')
          },
        }
      }),
    )
  }

  if (heroWins.items.length > 0) {
    const heroWinLabelById = new Map(heroWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroWins',
        verb: 'Defeat',
        itemNoun: 'hero',
        unitSingular: 'win',
        items: heroWins.items,
        countsByItemId: heroWins.countsByItemId,
        formatItem: (item) => `as ${item}`,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? heroWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && Boolean(e.myHero) && normalizeKey(e.myHero!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.myHero} win`)
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
              predicate: (e) => Boolean(e.scenario) && normalizeKey(e.scenario!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, entry.scenario || 'Scenario')
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
              predicate: (e) => e.isWin && Boolean(e.scenario) && normalizeKey(e.scenario!) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.scenario} win`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'mageKnight',
    gameName: 'Mage Knight',
    tracks,
  })
}
