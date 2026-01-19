import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
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
import { getMistfallEntries, mistfallMappings } from './mistfallEntries'

export function computeMistfallAchievements(plays: BggPlay[], username: string) {
  const entries = getMistfallEntries(plays, username)
  const totalPlays = sumQuantities(entries)

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
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (questWins.items.length > 0) {
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
      }),
    )
  }

  if (quests.items.length > 0) {
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
      }),
    )
  }

  if (heroes.items.length > 0) {
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
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'mistfall', gameName: 'Mistfall', tracks })
}

