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
import { tooManyBonesContent } from './content'
import { getTooManyBonesEntries } from './tooManyBonesEntries'

export function computeTooManyBonesAchievements(plays: BggPlay[], username: string) {
  const entries = getTooManyBonesEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const tyrants = buildCanonicalCounts({
    preferredItems: tooManyBonesContent.tyrants.map((tyrant) => buildAchievementItem(tyrant)),
    observed: entries
      .filter((e) => e.tyrant !== 'Unknown tyrant')
      .map((e) => ({ item: buildAchievementItem(e.tyrant), amount: e.isWin ? e.quantity : 0 })),
  })

  const gearlocs = buildCanonicalCounts({
    preferredItems: tooManyBonesContent.gearlocs.map((gearloc) => buildAchievementItem(gearloc)),
    observed: entries.flatMap((e) =>
      e.myGearlocs.map((gearloc) => ({ item: buildAchievementItem(gearloc), amount: e.quantity })),
    ),
  })

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const detailParts = [
          entry.tyrant !== 'Unknown tyrant' ? entry.tyrant : undefined,
          entry.myGearlocs[0],
        ].filter(Boolean)
        return buildCompletionFromPlay(entry.play, detailParts.join(' • ') || 'Play')
      },
    },
  ]

  if (tyrants.items.length > 0) {
    const tyrantLabelById = new Map(tyrants.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'tyrantWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'tyrant'),
        verb: 'Defeat',
        itemNoun: 'tyrant',
        unitSingular: 'win',
        items: tyrants.items,
        countsByItemId: tyrants.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'tyrantWins',
        verb: 'Defeat',
        itemNoun: 'tyrant',
        unitSingular: 'win',
        items: tyrants.items,
        countsByItemId: tyrants.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? tyrantLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && e.tyrant !== 'Unknown tyrant' && normalizeKey(e.tyrant) === labelKey,
            })
            if (!entry) return undefined
            const gearloc = entry.myGearlocs[0] ? ` • ${entry.myGearlocs[0]}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.tyrant}${gearloc}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: tyrants.items,
      groupByItemLabel: tooManyBonesContent.tyrantGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `tyrantWinsByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `defeat-each-tyrant-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Defeat',
          itemNoun: `tyrant in ${grouped.group}`,
          unitSingular: 'win',
          items: grouped.items,
          countsByItemId: tyrants.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (gearlocs.items.length > 0) {
    const gearlocLabelById = new Map(gearlocs.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'gearlocPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'gearloc'),
        verb: 'Play',
        itemNoun: 'gearloc',
        unitSingular: 'time',
        items: gearlocs.items,
        countsByItemId: gearlocs.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'gearlocPlays',
        verb: 'Play',
        itemNoun: 'gearloc',
        unitSingular: 'time',
        items: gearlocs.items,
        countsByItemId: gearlocs.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? gearlocLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) =>
                e.myGearlocs.some((gearloc) => normalizeKey(gearloc) === labelKey),
            })
            if (!entry) return undefined
            const detailGearloc =
              entry.myGearlocs.find((gearloc) => normalizeKey(gearloc) === labelKey) ?? entry.myGearlocs[0]
            const tyrant = entry.tyrant !== 'Unknown tyrant' ? ` • ${entry.tyrant}` : ''
            return buildCompletionFromPlay(entry.play, `${detailGearloc}${tyrant}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: gearlocs.items,
      groupByItemLabel: tooManyBonesContent.gearlocGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `gearlocPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-gearloc-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `gearloc in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: gearlocs.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'tooManyBones',
    gameName: 'Too Many Bones',
    tracks,
  })
}
