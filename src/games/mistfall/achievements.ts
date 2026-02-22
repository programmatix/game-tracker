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
  groupAchievementItemsByLabel,
  slugifyTrackId,
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

    for (const grouped of groupAchievementItemsByLabel({
      items: questWins.items,
      groupByItemLabel: mistfallMappings.questGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `questWinsByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `defeat-each-quest-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Defeat',
          itemNoun: `quest in ${grouped.group}`,
          unitSingular: 'win',
          items: grouped.items,
          countsByItemId: questWins.countsByItemId,
          levels: [1],
        }),
      )
    }
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

    for (const grouped of groupAchievementItemsByLabel({
      items: quests.items,
      groupByItemLabel: mistfallMappings.questGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `questPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-quest-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `quest in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: quests.countsByItemId,
          levels: [1],
        }),
      )
    }
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

    for (const grouped of groupAchievementItemsByLabel({
      items: heroes.items,
      groupByItemLabel: mistfallMappings.heroGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `heroPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-hero-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `hero in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: heroes.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  const matchupGroupsByKey = new Map<string, string>()
  for (const group of mistfallMappings.heroGroupByName.values()) {
    const key = normalizeKey(group)
    if (!key || matchupGroupsByKey.has(key)) continue
    matchupGroupsByKey.set(key, group)
  }

  for (const [groupKey, groupLabel] of matchupGroupsByKey.entries()) {
    const groupHeroes = mistfallMappings.allHeroes.filter(
      (hero) => normalizeKey(mistfallMappings.heroGroupByName.get(hero) || '') === groupKey,
    )
    const groupQuests = mistfallMappings.allQuests.filter(
      (quest) => normalizeKey(mistfallMappings.questGroupByName.get(quest) || '') === groupKey,
    )
    if (groupHeroes.length === 0 || groupQuests.length === 0) continue

    const groupHeroKeys = new Set(groupHeroes.map(normalizeKey))
    const groupQuestKeys = new Set(groupQuests.map(normalizeKey))

    const matchupPlays = buildCanonicalCounts({
      preferredItems: groupHeroes.flatMap((hero) =>
        groupQuests.map((quest) => buildAchievementItem(`${hero} vs ${quest}`)),
      ),
      observed: entries
        .filter(
          (entry) =>
            groupHeroKeys.has(normalizeKey(entry.hero)) && groupQuestKeys.has(normalizeKey(entry.quest)),
        )
        .map((entry) => ({
          item: buildAchievementItem(`${entry.hero} vs ${entry.quest}`),
          amount: entry.quantity,
        })),
    })

    const matchupWins = buildCanonicalCounts({
      preferredItems: groupHeroes.flatMap((hero) =>
        groupQuests.map((quest) => buildAchievementItem(`${hero} vs ${quest}`)),
      ),
      observed: entries
        .filter(
          (entry) =>
            entry.isWin &&
            groupHeroKeys.has(normalizeKey(entry.hero)) &&
            groupQuestKeys.has(normalizeKey(entry.quest)),
        )
        .map((entry) => ({
          item: buildAchievementItem(`${entry.hero} vs ${entry.quest}`),
          amount: entry.quantity,
        })),
    })

    tracks.push(
      buildPerItemTrack({
        trackId: `heroQuestMatchupPlaysByGroup:${slugifyTrackId(groupLabel)}`,
        achievementBaseId: `play-each-hero-against-each-quest-in-${slugifyTrackId(groupLabel)}`,
        verb: 'Play',
        itemNoun: `hero against each quest in ${groupLabel}`,
        unitSingular: 'time',
        items: matchupPlays.items,
        countsByItemId: matchupPlays.countsByItemId,
      }),
      {
        ...buildPerItemTrack({
          trackId: `heroQuestMatchupWinsByGroup:${slugifyTrackId(groupLabel)}`,
          achievementBaseId: `defeat-each-hero-against-each-quest-in-${slugifyTrackId(groupLabel)}`,
          verb: 'Defeat',
          itemNoun: `hero against each quest in ${groupLabel}`,
          unitSingular: 'win',
          items: matchupWins.items,
          countsByItemId: matchupWins.countsByItemId,
        }),
        achievementBaseId: `win-each-hero-against-each-quest-in-${slugifyTrackId(groupLabel)}`,
        titleForLevel: (level) =>
          `Win each hero against each quest in ${groupLabel} ${level} ${level === 1 ? 'time' : 'times'}`,
      },
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'mistfall', gameName: 'Mistfall', tracks })
}
