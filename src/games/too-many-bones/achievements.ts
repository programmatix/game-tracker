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

  const tyrantPlays = buildCanonicalCounts({
    preferredItems: tooManyBonesContent.tyrants.map((tyrant) => buildAchievementItem(tyrant)),
    observed: entries
      .filter((e) => e.tyrant !== 'Unknown tyrant')
      .map((e) => ({ item: buildAchievementItem(e.tyrant), amount: e.quantity })),
  })

  const tyrantWins = buildCanonicalCounts({
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

  if (tyrantPlays.items.length > 0) {
    const tyrantPlayLabelById = new Map(tyrantPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'tyrantPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'tyrant'),
        verb: 'Play',
        itemNoun: 'tyrant',
        unitSingular: 'time',
        items: tyrantPlays.items,
        countsByItemId: tyrantPlays.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'tyrantPlays',
        verb: 'Play',
        itemNoun: 'tyrant',
        unitSingular: 'time',
        items: tyrantPlays.items,
        countsByItemId: tyrantPlays.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? tyrantPlayLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => e.tyrant !== 'Unknown tyrant' && normalizeKey(e.tyrant) === labelKey,
            })
            if (!entry) return undefined
            const gearloc = entry.myGearlocs[0] ? ` • ${entry.myGearlocs[0]}` : ''
            return buildCompletionFromPlay(entry.play, `${entry.tyrant}${gearloc}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: tyrantPlays.items,
      groupByItemLabel: tooManyBonesContent.tyrantGroupByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `tyrantPlaysByGroup:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-tyrant-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `tyrant in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: tyrantPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (tyrantWins.items.length > 0) {
    const tyrantWinLabelById = new Map(tyrantWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'tyrantWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'tyrant'),
        verb: 'Defeat',
        itemNoun: 'tyrant',
        unitSingular: 'win',
        items: tyrantWins.items,
        countsByItemId: tyrantWins.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'tyrantWins',
        verb: 'Defeat',
        itemNoun: 'tyrant',
        unitSingular: 'win',
        items: tyrantWins.items,
        countsByItemId: tyrantWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? tyrantWinLabelById.get(itemId) : undefined
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
      items: tyrantWins.items,
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
          countsByItemId: tyrantWins.countsByItemId,
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

  const matchupGroupsByKey = new Map<string, string>()
  for (const group of tooManyBonesContent.gearlocGroupByName.values()) {
    const key = normalizeKey(group)
    if (!key || matchupGroupsByKey.has(key)) continue
    matchupGroupsByKey.set(key, group)
  }

  for (const [groupKey, groupLabel] of matchupGroupsByKey.entries()) {
    const groupGearlocs = tooManyBonesContent.gearlocs.filter(
      (gearloc) => normalizeKey(tooManyBonesContent.gearlocGroupByName.get(gearloc) || '') === groupKey,
    )
    const groupTyrants = tooManyBonesContent.tyrants.filter(
      (tyrant) => normalizeKey(tooManyBonesContent.tyrantGroupByName.get(tyrant) || '') === groupKey,
    )
    if (groupGearlocs.length === 0 || groupTyrants.length === 0) continue

    const groupGearlocKeys = new Set(groupGearlocs.map(normalizeKey))
    const groupTyrantKeys = new Set(groupTyrants.map(normalizeKey))

    const matchupPlays = buildCanonicalCounts({
      preferredItems: groupGearlocs.flatMap((gearloc) =>
        groupTyrants.map((tyrant) => buildAchievementItem(`${gearloc} vs ${tyrant}`)),
      ),
      observed: entries.flatMap((entry) => {
        if (!groupTyrantKeys.has(normalizeKey(entry.tyrant))) return []
        const matchedGearlocs = entry.myGearlocs.filter((gearloc) =>
          groupGearlocKeys.has(normalizeKey(gearloc)),
        )
        return matchedGearlocs.map((gearloc) => ({
          item: buildAchievementItem(`${gearloc} vs ${entry.tyrant}`),
          amount: entry.quantity,
        }))
      }),
    })

    const matchupWins = buildCanonicalCounts({
      preferredItems: groupGearlocs.flatMap((gearloc) =>
        groupTyrants.map((tyrant) => buildAchievementItem(`${gearloc} vs ${tyrant}`)),
      ),
      observed: entries.flatMap((entry) => {
        if (!entry.isWin || !groupTyrantKeys.has(normalizeKey(entry.tyrant))) return []
        const matchedGearlocs = entry.myGearlocs.filter((gearloc) =>
          groupGearlocKeys.has(normalizeKey(gearloc)),
        )
        return matchedGearlocs.map((gearloc) => ({
          item: buildAchievementItem(`${gearloc} vs ${entry.tyrant}`),
          amount: entry.quantity,
        }))
      }),
    })

    tracks.push(
      buildPerItemTrack({
        trackId: `gearlocTyrantMatchupPlaysByGroup:${slugifyTrackId(groupLabel)}`,
        achievementBaseId: `play-each-gearloc-against-each-tyrant-in-${slugifyTrackId(groupLabel)}`,
        verb: 'Play',
        itemNoun: `gearloc against each tyrant in ${groupLabel}`,
        unitSingular: 'time',
        items: matchupPlays.items,
        countsByItemId: matchupPlays.countsByItemId,
      }),
      {
        ...buildPerItemTrack({
          trackId: `gearlocTyrantMatchupWinsByGroup:${slugifyTrackId(groupLabel)}`,
          achievementBaseId: `defeat-each-gearloc-against-each-tyrant-in-${slugifyTrackId(groupLabel)}`,
          verb: 'Defeat',
          itemNoun: `gearloc against each tyrant in ${groupLabel}`,
          unitSingular: 'win',
          items: matchupWins.items,
          countsByItemId: matchupWins.countsByItemId,
        }),
        achievementBaseId: `win-each-gearloc-against-each-tyrant-in-${slugifyTrackId(groupLabel)}`,
        titleForLevel: (level) =>
          `Win each gearloc against each tyrant in ${groupLabel} ${level} ${level === 1 ? 'time' : 'times'}`,
      },
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'tooManyBones',
    gameName: 'Too Many Bones',
    tracks,
  })
}
