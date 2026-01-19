import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildIndividualItemTracks,
  buildItemIdLookup,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  itemsFromMap,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { getMistfallEntries, mistfallMappings } from './mistfallEntries'

export function computeMistfallAchievements(plays: BggPlay[], username: string) {
  const entries = getMistfallEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const heroLabelToId = buildItemIdLookup(mistfallMappings.heroesById)
  const questLabelToId = buildItemIdLookup(mistfallMappings.questsById)

  const heroes = buildCanonicalCounts({
    preferredItems: itemsFromMap(mistfallMappings.heroesById),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.hero, heroLabelToId),
      amount: e.quantity,
    })),
  })
  const quests = buildCanonicalCounts({
    preferredItems: itemsFromMap(mistfallMappings.questsById),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.quest, questLabelToId),
      amount: e.quantity,
    })),
  })
  const questWins = buildCanonicalCounts({
    preferredItems: itemsFromMap(mistfallMappings.questsById),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.quest, questLabelToId),
      amount: e.isWin ? e.quantity : 0,
    })),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, `${entry.hero} — ${entry.quest}`)
      },
    },
  ]

  if (questWins.items.length > 0) {
    const questLabelById = new Map(questWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'questWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'quest'),
        verb: 'Defeat',
        itemNoun: 'quest',
        unitSingular: 'win',
        items: questWins.items,
        countsByItemId: questWins.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'questWins',
        verb: 'Defeat',
        itemNoun: 'quest',
        unitSingular: 'win',
        items: questWins.items,
        countsByItemId: questWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? questLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.quest) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `With ${entry.hero}`)
          },
        }
      }),
    )
  }

  if (quests.items.length > 0) {
    const questLabelById = new Map(quests.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'questPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'quest'),
        verb: 'Play',
        itemNoun: 'quest',
        unitSingular: 'time',
        items: quests.items,
        countsByItemId: quests.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'questPlays',
        verb: 'Play',
        itemNoun: 'quest',
        unitSingular: 'time',
        items: quests.items,
        countsByItemId: quests.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? questLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.quest) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `With ${entry.hero}`)
          },
        }
      }),
    )
  }

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
              predicate: (e) => normalizeKey(e.hero) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.quest}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'mistfall', gameName: 'Mistfall', tracks })
}
