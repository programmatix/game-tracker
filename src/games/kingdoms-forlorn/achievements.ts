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
  slugifyTrackId,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { kingdomsForlornContent } from './content'
import { getKingdomsForlornEntries } from './kingdomsForlornEntries'

function playSummary(entry: ReturnType<typeof getKingdomsForlornEntries>[number]): string {
  return `${entry.kingdom} • ${entry.myKnight || 'Unknown knight'}`
}

export function computeKingdomsForlornAchievements(plays: BggPlay[], username: string) {
  const entries = getKingdomsForlornEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const kingdoms = buildCanonicalCounts({
    preferredItems: kingdomsForlornContent.kingdoms.map((kingdom) => buildAchievementItem(kingdom)),
    observed: entries
      .filter((entry) => entry.kingdom !== 'Unknown kingdom')
      .map((entry) => ({ item: buildAchievementItem(entry.kingdom), amount: entry.quantity })),
  })

  const kingdomWins = buildCanonicalCounts({
    preferredItems: kingdomsForlornContent.kingdoms.map((kingdom) => buildAchievementItem(kingdom)),
    observed: entries
      .filter((entry) => entry.kingdom !== 'Unknown kingdom')
      .map((entry) => ({
        item: buildAchievementItem(entry.kingdom),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const knights = buildCanonicalCounts({
    preferredItems: kingdomsForlornContent.knights.map((knight) => buildAchievementItem(knight)),
    observed: entries
      .filter((entry) => Boolean(entry.myKnight))
      .map((entry) => ({ item: buildAchievementItem(entry.myKnight!), amount: entry.quantity })),
  })

  const knightWins = buildCanonicalCounts({
    preferredItems: kingdomsForlornContent.knights.map((knight) => buildAchievementItem(knight)),
    observed: entries
      .filter((entry) => Boolean(entry.myKnight))
      .map((entry) => ({
        item: buildAchievementItem(entry.myKnight!),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const knightQuestPlaysByKnight = new Map<
    string,
    { items: { id: string; label: string }[]; countsByItemId: Record<string, number> }
  >()

  if (kingdomsForlornContent.quests.length > 0) {
    for (const knight of kingdomsForlornContent.knights) {
      const knightKey = normalizeKey(knight)
      const preferredItems = kingdomsForlornContent.quests.map((quest) =>
        buildAchievementItem(`${knight} vs ${quest}`),
      )
      const observed = entries
        .filter((entry) => normalizeKey(entry.myKnight || '') === knightKey && Boolean(entry.quest))
        .map((entry) => ({
          item: buildAchievementItem(`${knight} vs ${entry.quest!}`),
          amount: entry.quantity,
        }))

      knightQuestPlaysByKnight.set(knight, buildCanonicalCounts({ preferredItems, observed }))
    }
  }

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({
        trackId: 'plays',
        achievementBaseId: 'plays',
        currentPlays: totalPlays,
      }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, playSummary(entry))
      },
    },
  ]

  if (kingdoms.items.length > 0) {
    const labelById = new Map(kingdoms.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'kingdomPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'kingdom'),
        verb: 'Play',
        itemNoun: 'kingdom',
        unitSingular: 'time',
        items: kingdoms.items,
        countsByItemId: kingdoms.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'kingdomPlays',
        verb: 'Play',
        itemNoun: 'kingdom',
        unitSingular: 'time',
        items: kingdoms.items,
        countsByItemId: kingdoms.countsByItemId,
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
              predicate: (e) => normalizeKey(e.kingdom) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, playSummary(entry))
          },
        }
      }),
    )
  }

  if (kingdomWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'kingdomWins',
        achievementBaseId: 'defeat-each-kingdom',
        verb: 'Defeat',
        itemNoun: 'kingdom',
        unitSingular: 'win',
        items: kingdomWins.items,
        countsByItemId: kingdomWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (knights.items.length > 0) {
    const labelById = new Map(knights.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'knightPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'knight'),
        verb: 'Play',
        itemNoun: 'knight',
        unitSingular: 'time',
        items: knights.items,
        countsByItemId: knights.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'knightPlays',
        verb: 'Play',
        itemNoun: 'knight',
        unitSingular: 'time',
        items: knights.items,
        countsByItemId: knights.countsByItemId,
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
              predicate: (e) => normalizeKey(e.myKnight || '') === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, playSummary(entry))
          },
        }
      }),
    )
  }

  if (knightWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'knightWins',
        achievementBaseId: 'defeat-each-knight',
        verb: 'Defeat',
        itemNoun: 'knight',
        unitSingular: 'win',
        items: knightWins.items,
        countsByItemId: knightWins.countsByItemId,
        levels: [1, 3, 10],
      }),
    )
  }

  if (kingdomsForlornContent.quests.length > 0) {
    for (const knight of kingdomsForlornContent.knights) {
      const matchup = knightQuestPlaysByKnight.get(knight)
      if (!matchup || matchup.items.length === 0) continue
      const knightSlug = slugifyTrackId(knight)

      tracks.push(
        buildPerItemTrack({
          trackId: `knightQuestPlays:${knightSlug}`,
          achievementBaseId: `play-each-quest-for-${knightSlug}`,
          verb: 'Play',
          itemNoun: `quest for ${knight}`,
          unitSingular: 'time',
          items: matchup.items,
          countsByItemId: matchup.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'kingdomsForlorn',
    gameName: 'Kingdoms Forlorn',
    tracks,
  })
}
