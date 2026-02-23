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
  groupAchievementItemsByLabel,
  slugifyTrackId,
  sumQuantities,
} from '../../achievements/gameUtils'
import { normalizeAchievementItemLabel } from '../../achievements/progress'
import { cloudspireContent } from './content'
import { getCloudspireEntries } from './cloudspireEntries'

export function computeCloudspireAchievements(plays: BggPlay[], username: string) {
  const entries = getCloudspireEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const factionPlays = buildCanonicalCounts({
    preferredItems: cloudspireContent.factions.map((faction) => buildAchievementItem(faction)),
    observed: entries
      .filter((e) => e.myFaction !== 'Unknown faction')
      .map((e) => ({ item: buildAchievementItem(e.myFaction), amount: e.quantity })),
  })

  const factionWins = buildCanonicalCounts({
    preferredItems: cloudspireContent.factions.map((faction) => buildAchievementItem(faction)),
    observed: entries
      .filter((e) => e.myFaction !== 'Unknown faction')
      .map((e) => ({ item: buildAchievementItem(e.myFaction), amount: e.isWin ? e.quantity : 0 })),
  })

  const opponentPlays = buildCanonicalCounts({
    preferredItems: cloudspireContent.factions.map((faction) => buildAchievementItem(faction)),
    observed: entries
      .filter((e) => e.opponentFaction !== 'Unknown opponent')
      .map((e) => ({ item: buildAchievementItem(e.opponentFaction), amount: e.quantity })),
  })

  const opponentWins = buildCanonicalCounts({
    preferredItems: cloudspireContent.factions.map((faction) => buildAchievementItem(faction)),
    observed: entries
      .filter((e) => e.opponentFaction !== 'Unknown opponent')
      .map((e) => ({ item: buildAchievementItem(e.opponentFaction), amount: e.isWin ? e.quantity : 0 })),
  })

  const modePlays = buildCanonicalCounts({
    preferredItems: cloudspireContent.modes.map((mode) => buildAchievementItem(mode)),
    observed: entries
      .filter((e) => e.mode !== 'Unknown mode')
      .map((e) => ({ item: buildAchievementItem(e.mode), amount: e.quantity })),
  })

  const boxCounts = buildCanonicalCounts({
    preferredItems: [...new Set(cloudspireContent.factionGroupByName.values())].map((box) =>
      buildAchievementItem(box),
    ),
    observed: entries
      .filter((e) => e.myFaction !== 'Unknown faction')
      .map((e) => {
        const box = cloudspireContent.factionGroupByName.get(e.myFaction)
        return box ? { item: buildAchievementItem(box), amount: e.quantity } : null
      })
      .filter((row): row is { item: { id: string; label: string }; amount: number } => Boolean(row)),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(
          entry.play,
          `${entry.myFaction} vs ${entry.opponentFaction} (${entry.mode})`,
        )
      },
    },
  ]

  if (factionPlays.items.length > 0) {
    const labelById = new Map(factionPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'factionPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'faction'),
        verb: 'Play',
        itemNoun: 'faction',
        unitSingular: 'time',
        items: factionPlays.items,
        countsByItemId: factionPlays.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'factionPlays',
        verb: 'Play',
        itemNoun: 'faction',
        unitSingular: 'time',
        items: factionPlays.items,
        countsByItemId: factionPlays.countsByItemId,
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
              predicate: (e) => normalizeKey(e.myFaction) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.myFaction} vs ${entry.opponentFaction}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: factionPlays.items,
      groupByItemLabel: cloudspireContent.factionGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `factionPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-faction-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `faction in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: factionPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (factionWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'factionWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'faction'),
        verb: 'Defeat',
        itemNoun: 'faction',
        unitSingular: 'win',
        items: factionWins.items,
        countsByItemId: factionWins.countsByItemId,
      }),
    )
  }

  if (opponentPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'opponentPlays',
        achievementBaseId: 'play-against-each-faction',
        verb: 'Play',
        itemNoun: 'opposing faction',
        unitSingular: 'time',
        items: opponentPlays.items,
        countsByItemId: opponentPlays.countsByItemId,
      }),
    )
  }

  if (opponentWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'opponentWins',
        achievementBaseId: 'defeat-each-opposing-faction',
        verb: 'Defeat',
        itemNoun: 'opposing faction',
        unitSingular: 'win',
        items: opponentWins.items,
        countsByItemId: opponentWins.countsByItemId,
      }),
    )
  }

  if (modePlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'modePlays',
        achievementBaseId: 'play-each-mode',
        verb: 'Play',
        itemNoun: 'mode',
        unitSingular: 'time',
        items: modePlays.items,
        countsByItemId: modePlays.countsByItemId,
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
    gameId: 'cloudspire',
    gameName: 'Cloudspire',
    tracks,
  })
}
