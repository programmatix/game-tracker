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
  sumQuantities,
} from '../../achievements/gameUtils'
import { isMeaningfulAchievementItem, normalizeAchievementItemLabel } from '../../achievements/progress'
import { getFinalGirlEntries, ownedFinalGirlContent } from './finalGirlEntries'
import {
  getOwnedFinalGirlFinalGirls,
  getOwnedFinalGirlLocations,
  getOwnedFinalGirlVillains,
  normalizeFinalGirlName,
} from './ownedContent'

export function computeFinalGirlAchievements(plays: BggPlay[], username: string) {
  const entries = getFinalGirlEntries(plays, username)
  const totalPlays = sumQuantities(entries)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

  const ownedVillains = getOwnedFinalGirlVillains(ownedFinalGirlContent)
  const ownedLocations = getOwnedFinalGirlLocations(ownedFinalGirlContent)
  const ownedFinalGirls = getOwnedFinalGirlFinalGirls(ownedFinalGirlContent)

  const villainLabelToId = buildItemIdLookup(
    new Map(
      [...ownedFinalGirlContent.villainsById.entries()].map(([id, info]) => [
        id,
        info.display,
      ]),
    ),
  )
  const locationLabelToId = buildItemIdLookup(ownedFinalGirlContent.locationsById)
  const finalGirlLabelToId = buildItemIdLookup(ownedFinalGirlContent.finalGirlsById)

  const villainPreferred =
    ownedFinalGirlContent.ownedVillains.size > 0
      ? ownedVillains.map((villain) => buildAchievementItem(villain, villainLabelToId))
      : entries.map((e) => buildAchievementItem(e.villain, villainLabelToId))
  const locationPreferred =
    ownedFinalGirlContent.ownedLocations.size > 0
      ? ownedLocations.map((location) => buildAchievementItem(location, locationLabelToId))
      : entries.map((e) => buildAchievementItem(e.location, locationLabelToId))
  const finalGirlPreferred =
    ownedFinalGirlContent.ownedFinalGirls.size > 0
      ? ownedFinalGirls.map((finalGirl) => buildAchievementItem(finalGirl, finalGirlLabelToId))
      : entries.map((e) => buildAchievementItem(e.finalGirl, finalGirlLabelToId))

  const villainPlays = buildCanonicalCounts({
    preferredItems: villainPreferred,
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.villain, villainLabelToId),
      amount: e.quantity,
    })),
  })

  const villainWins = buildCanonicalCounts({
    preferredItems: villainPreferred,
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.villain, villainLabelToId),
      amount: e.isWin ? e.quantity : 0,
    })),
  })
  const locations = buildCanonicalCounts({
    preferredItems: locationPreferred,
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.location, locationLabelToId),
      amount: e.quantity,
    })),
  })
  const finalGirls = buildCanonicalCounts({
    preferredItems: finalGirlPreferred,
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.finalGirl, finalGirlLabelToId),
      amount: e.quantity,
    })),
  })

  const boxPreferred = [
    ...new Set(
      [...ownedFinalGirlContent.locationBoxesByName.values()].map((box) => normalizeAchievementItemLabel(box)),
    ),
  ]
  const villainBoxByName = new Map<string, string>()
  for (const villainInfo of ownedFinalGirlContent.villainsById.values()) {
    if (!villainInfo.location) continue
    const box =
      ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(villainInfo.location)) ??
      normalizeAchievementItemLabel(villainInfo.location)
    villainBoxByName.set(normalizeFinalGirlName(villainInfo.display), box)
  }
  const boxes = buildCanonicalCounts({
    preferredItems: boxPreferred.map((box) => buildAchievementItem(box)),
    observed: entries.flatMap((e) => {
      const boxLabels: string[] = []

      const location = normalizeAchievementItemLabel(e.location)
      if (isMeaningfulAchievementItem(location)) {
        const box =
          ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(location)) ?? location
        boxLabels.push(box)
      }

      const villain = normalizeAchievementItemLabel(e.villain)
      if (isMeaningfulAchievementItem(villain)) {
        const villainParts = villain
          .split(/\s*\+\s*/g)
          .map((part) => normalizeAchievementItemLabel(part))
          .filter((part) => isMeaningfulAchievementItem(part))
        for (const part of villainParts) {
          const box = villainBoxByName.get(normalizeFinalGirlName(part))
          if (box) boxLabels.push(box)
        }
      }

      const uniqueBoxes = [...new Set(boxLabels.map((label) => normalizeAchievementItemLabel(label)).filter(Boolean))]
      return uniqueBoxes.map((box) => ({ item: buildAchievementItem(box), amount: e.quantity }))
    }),
  })

  const finalGirlBoxByNormalized = new Map<string, string>()
  for (const [normalized, location] of ownedFinalGirlContent.finalGirlLocationsByName) {
    const canonicalLocation = normalizeAchievementItemLabel(location)
    if (!isMeaningfulAchievementItem(canonicalLocation)) continue
    const box =
      ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(canonicalLocation)) ??
      canonicalLocation
    finalGirlBoxByNormalized.set(normalized, box)
  }
  for (const entry of entries) {
    const finalGirl = normalizeAchievementItemLabel(entry.finalGirl)
    const location = normalizeAchievementItemLabel(entry.location)
    if (!isMeaningfulAchievementItem(finalGirl)) continue
    if (!isMeaningfulAchievementItem(location)) continue
    const normalized = finalGirl.toLowerCase()
    if (finalGirlBoxByNormalized.has(normalized)) continue
    const box = ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(location)) ?? location
    finalGirlBoxByNormalized.set(normalized, box)
  }

  const boxesForEntry = (entry: { villain: string; location: string }) => {
    const boxLabels: string[] = []

    const location = normalizeAchievementItemLabel(entry.location)
    if (isMeaningfulAchievementItem(location)) {
      const box =
        ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(location)) ?? location
      boxLabels.push(box)
    }

    const villain = normalizeAchievementItemLabel(entry.villain)
    if (isMeaningfulAchievementItem(villain)) {
      const villainParts = villain
        .split(/\s*\+\s*/g)
        .map((part) => normalizeAchievementItemLabel(part))
        .filter((part) => isMeaningfulAchievementItem(part))
      for (const part of villainParts) {
        const box = villainBoxByName.get(normalizeFinalGirlName(part))
        if (box) boxLabels.push(box)
      }
    }

    return [...new Set(boxLabels.map((label) => normalizeAchievementItemLabel(label)).filter(Boolean))]
  }

  const tracks: AchievementTrack[] = [
    {
      ...buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(
          entry.play,
          `${entry.finalGirl} at ${entry.location} vs ${entry.villain}`,
        )
      },
    },
  ]

  if (villainPlays.items.length > 0) {
    const villainPlayLabelById = new Map(villainPlays.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'villainPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'villain'),
        verb: 'Play',
        itemNoun: 'villain',
        unitSingular: 'time',
        items: villainPlays.items,
        countsByItemId: villainPlays.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'villainPlays',
        verb: 'Play',
        itemNoun: 'villain',
        unitSingular: 'time',
        items: villainPlays.items,
        countsByItemId: villainPlays.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? villainPlayLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.villain) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.finalGirl} at ${entry.location}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: villainPlays.items,
      groupByItemLabel: ownedFinalGirlContent.villainSeasonsByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `villainPlaysBySeason:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-villain-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `villain in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: villainPlays.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (villainWins.items.length > 0) {
    const villainWinLabelById = new Map(villainWins.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'villainWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'villain'),
        verb: 'Defeat',
        itemNoun: 'villain',
        unitSingular: 'win',
        items: villainWins.items,
        countsByItemId: villainWins.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'villainWins',
        verb: 'Defeat',
        itemNoun: 'villain',
        unitSingular: 'win',
        items: villainWins.items,
        countsByItemId: villainWins.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? villainWinLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(e.villain) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.finalGirl} at ${entry.location}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: villainWins.items,
      groupByItemLabel: ownedFinalGirlContent.villainSeasonsByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `villainWinsBySeason:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `defeat-each-villain-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Defeat',
          itemNoun: `villain in ${grouped.group}`,
          unitSingular: 'win',
          items: grouped.items,
          countsByItemId: villainWins.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (locations.items.length > 0) {
    const locationLabelById = new Map(locations.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'locationPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'location'),
        verb: 'Play',
        itemNoun: 'location',
        unitSingular: 'time',
        items: locations.items,
        countsByItemId: locations.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'locationPlays',
        verb: 'Play',
        itemNoun: 'location',
        unitSingular: 'time',
        items: locations.items,
        countsByItemId: locations.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? locationLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.location) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.finalGirl} vs ${entry.villain}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: locations.items,
      groupByItemLabel: ownedFinalGirlContent.locationSeasonsByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `locationPlaysBySeason:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-location-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `location in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: locations.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (finalGirls.items.length > 0) {
    const finalGirlLabelById = new Map(finalGirls.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'finalGirlPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'final girl'),
        verb: 'Play',
        itemNoun: 'final girl',
        unitSingular: 'time',
        items: finalGirls.items,
        countsByItemId: finalGirls.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'finalGirlPlays',
        verb: 'Play',
        itemNoun: 'final girl',
        unitSingular: 'time',
        items: finalGirls.items,
        countsByItemId: finalGirls.countsByItemId,
        formatItem: (finalGirl) => {
          const normalized = normalizeAchievementItemLabel(finalGirl).toLowerCase()
          const box = finalGirlBoxByNormalized.get(normalized)
          return box ? `${finalGirl} [${box}]` : finalGirl
        },
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? finalGirlLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.finalGirl) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.location} vs ${entry.villain}`)
          },
        }
      }),
    )

    for (const grouped of groupAchievementItemsByLabel({
      items: finalGirls.items,
      groupByItemLabel: ownedFinalGirlContent.finalGirlSeasonsByName,
    })) {
      tracks.push(
        buildPerItemTrack({
          trackId: `finalGirlPlaysBySeason:${slugifyTrackId(grouped.group)}`,
          achievementBaseId: `play-each-final-girl-in-${slugifyTrackId(grouped.group)}`,
          verb: 'Play',
          itemNoun: `final girl in ${grouped.group}`,
          unitSingular: 'time',
          items: grouped.items,
          countsByItemId: finalGirls.countsByItemId,
          levels: [1],
        }),
      )
    }
  }

  if (boxes.items.length > 0) {
    const boxLabelById = new Map(boxes.items.map((item) => [item.id, item.label]))
    tracks.push(
      buildPerItemTrack({
        trackId: 'boxPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'box'),
        verb: 'Play',
        itemNoun: 'box',
        unitSingular: 'time',
        items: boxes.items,
        countsByItemId: boxes.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'boxPlays',
        verb: 'Play',
        itemNoun: 'box',
        unitSingular: 'time',
        items: boxes.items,
        countsByItemId: boxes.countsByItemId,
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? boxLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => boxesForEntry(e).some((box) => normalizeKey(box) === labelKey),
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `${entry.finalGirl} at ${entry.location} vs ${entry.villain}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'finalGirl', gameName: 'Final Girl', tracks })
}
