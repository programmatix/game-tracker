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
import { skytearHordeContent } from './content'
import { getSkytearHordeEntries } from './skytearHordeEntries'

export function computeSkytearHordeAchievements(plays: BggPlay[], username: string) {
  const entries = getSkytearHordeEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const heroPrecons = buildCanonicalCounts({
    preferredItems: skytearHordeContent.heroPrecons.map((hero) => buildAchievementItem(hero)),
    observed: entries
      .filter((entry) => entry.heroPrecon !== 'Unknown hero precon')
      .map((entry) => ({ item: buildAchievementItem(entry.heroPrecon), amount: entry.quantity })),
  })

  const enemyPreconPlays = buildCanonicalCounts({
    preferredItems: skytearHordeContent.enemyPrecons.map((enemy) => buildAchievementItem(enemy)),
    observed: entries
      .filter((entry) => entry.enemyPrecon !== 'Unknown enemy precon')
      .map((entry) => ({
        item: buildAchievementItem(entry.enemyPrecon),
        amount: entry.quantity,
      })),
  })

  const enemyPreconWins = buildCanonicalCounts({
    preferredItems: skytearHordeContent.enemyPrecons.map((enemy) => buildAchievementItem(enemy)),
    observed: entries
      .filter((entry) => entry.enemyPrecon !== 'Unknown enemy precon')
      .map((entry) => ({
        item: buildAchievementItem(entry.enemyPrecon),
        amount: entry.isWin ? entry.quantity : 0,
      })),
  })

  const enemyBoxKeys = new Set(
    [...skytearHordeContent.enemyBoxByPrecon.values()].map(normalizeKey).filter(Boolean),
  )
  const matchupBoxesByKey = new Map<string, string>()
  for (const box of skytearHordeContent.heroBoxByPrecon.values()) {
    const key = normalizeKey(box)
    if (!key || !enemyBoxKeys.has(key) || matchupBoxesByKey.has(key)) continue
    matchupBoxesByKey.set(key, box)
  }

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        const detailParts = [entry.heroPrecon, entry.enemyPrecon]
        return buildCompletionFromPlay(entry.play, detailParts.join(' vs '))
      },
    },
  ]

  if (heroPrecons.items.length > 0) {
    const heroLabelById = new Map(heroPrecons.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroPreconPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'hero precon'),
        verb: 'Play',
        itemNoun: 'hero precon',
        unitSingular: 'time',
        items: heroPrecons.items,
        countsByItemId: heroPrecons.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroPreconPlays',
        verb: 'Play',
        itemNoun: 'hero precon',
        unitSingular: 'time',
        items: heroPrecons.items,
        countsByItemId: heroPrecons.countsByItemId,
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
              predicate: (e) =>
                e.heroPrecon !== 'Unknown hero precon' && normalizeKey(e.heroPrecon) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.heroPrecon} vs ${entry.enemyPrecon}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: heroPrecons.items,
      groupByItemLabel: skytearHordeContent.heroBoxByPrecon,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `heroPreconPlaysByBox:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-hero-precon-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `hero precon in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: heroPrecons.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (enemyPreconPlays.items.length > 0) {
    const enemyPlayLabelById = new Map(enemyPreconPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'enemyPreconPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'enemy precon'),
        verb: 'Play',
        itemNoun: 'enemy precon',
        unitSingular: 'time',
        items: enemyPreconPlays.items,
        countsByItemId: enemyPreconPlays.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'enemyPreconPlays',
        verb: 'Play',
        itemNoun: 'enemy precon',
        unitSingular: 'time',
        items: enemyPreconPlays.items,
        countsByItemId: enemyPreconPlays.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? enemyPlayLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) =>
                e.enemyPrecon !== 'Unknown enemy precon' && normalizeKey(e.enemyPrecon) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.heroPrecon} vs ${entry.enemyPrecon}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: enemyPreconPlays.items,
      groupByItemLabel: skytearHordeContent.enemyBoxByPrecon,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `enemyPreconPlaysByBox:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-enemy-precon-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `enemy precon in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: enemyPreconPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (enemyPreconWins.items.length > 0) {
    const enemyWinLabelById = new Map(enemyPreconWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'enemyPreconWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'enemy precon'),
        verb: 'Defeat',
        itemNoun: 'enemy precon',
        unitSingular: 'win',
        items: enemyPreconWins.items,
        countsByItemId: enemyPreconWins.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'enemyPreconWins',
        verb: 'Defeat',
        itemNoun: 'enemy precon',
        unitSingular: 'win',
        items: enemyPreconWins.items,
        countsByItemId: enemyPreconWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? enemyWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) =>
                e.isWin &&
                e.enemyPrecon !== 'Unknown enemy precon' &&
                normalizeKey(e.enemyPrecon) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.heroPrecon} vs ${entry.enemyPrecon}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: enemyPreconWins.items,
      groupByItemLabel: skytearHordeContent.enemyBoxByPrecon,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `enemyPreconWinsByBox:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `defeat-each-enemy-precon-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Defeat',
          itemNoun: `enemy precon in ${grouped.group}`,
          unitSingular: 'win',
          items: grouped.items,
          countsByItemId: enemyPreconWins.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  for (const [groupKey, groupLabel] of matchupBoxesByKey.entries()) {
    const groupHeroes = skytearHordeContent.heroPrecons.filter(
      (hero) => normalizeKey(skytearHordeContent.heroBoxByPrecon.get(hero) || '') === groupKey,
    )
    const groupEnemies = skytearHordeContent.enemyPrecons.filter(
      (enemy) => normalizeKey(skytearHordeContent.enemyBoxByPrecon.get(enemy) || '') === groupKey,
    )
    if (groupHeroes.length === 0 || groupEnemies.length === 0) continue

    const groupHeroKeys = new Set(groupHeroes.map(normalizeKey))
    const groupEnemyKeys = new Set(groupEnemies.map(normalizeKey))

    const matchupPlays = buildCanonicalCounts({
      preferredItems: groupHeroes.flatMap((hero) =>
        groupEnemies.map((enemy) => buildAchievementItem(`${hero} vs ${enemy}`)),
      ),
      observed: entries
        .filter(
          (entry) =>
            entry.heroPrecon !== 'Unknown hero precon' &&
            entry.enemyPrecon !== 'Unknown enemy precon' &&
            groupHeroKeys.has(normalizeKey(entry.heroPrecon)) &&
            groupEnemyKeys.has(normalizeKey(entry.enemyPrecon)),
        )
        .map((entry) => ({
          item: buildAchievementItem(`${entry.heroPrecon} vs ${entry.enemyPrecon}`),
          amount: entry.quantity,
        })),
    })

    const matchupWins = buildCanonicalCounts({
      preferredItems: groupHeroes.flatMap((hero) =>
        groupEnemies.map((enemy) => buildAchievementItem(`${hero} vs ${enemy}`)),
      ),
      observed: entries
        .filter(
          (entry) =>
            entry.isWin &&
            entry.heroPrecon !== 'Unknown hero precon' &&
            entry.enemyPrecon !== 'Unknown enemy precon' &&
            groupHeroKeys.has(normalizeKey(entry.heroPrecon)) &&
            groupEnemyKeys.has(normalizeKey(entry.enemyPrecon)),
        )
        .map((entry) => ({
          item: buildAchievementItem(`${entry.heroPrecon} vs ${entry.enemyPrecon}`),
          amount: entry.quantity,
        })),
    })

    tracks.push(
      buildPerItemTrack({
        trackId: `preconMatchupPlaysByBox:${slugifyTrackId(groupLabel)}`,
        achievementBaseId: `play-each-hero-precon-against-each-enemy-precon-in-${slugifyTrackId(groupLabel)}`,
        verb: 'Play',
        itemNoun: `hero precon against each enemy precon in ${groupLabel}`,
        unitSingular: 'time',
        items: matchupPlays.items,
        countsByItemId: matchupPlays.countsByItemId,
      }),
      {
        ...buildPerItemTrack({
          trackId: `preconMatchupWinsByBox:${slugifyTrackId(groupLabel)}`,
          achievementBaseId: `defeat-each-hero-precon-against-each-enemy-precon-in-${slugifyTrackId(groupLabel)}`,
          verb: 'Defeat',
          itemNoun: `hero precon against each enemy precon in ${groupLabel}`,
          unitSingular: 'win',
          items: matchupWins.items,
          countsByItemId: matchupWins.countsByItemId,
        }),
        achievementBaseId: `win-each-hero-precon-against-each-enemy-precon-in-${slugifyTrackId(groupLabel)}`,
        titleForLevel: (level) =>
          `Win each hero precon against each enemy precon in ${groupLabel} ${level} ${level === 1 ? 'time' : 'times'}`,
      },
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'skytearHorde',
    gameName: 'Skytear Horde',
    tracks,
  })
}
