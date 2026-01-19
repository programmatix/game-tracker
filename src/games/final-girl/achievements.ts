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

  const villains = buildCanonicalCounts({
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

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (villains.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'villainWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'villain'),
        verb: 'Defeat',
        itemNoun: 'villain',
        unitSingular: 'win',
        items: villains.items,
        countsByItemId: villains.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'villainWins',
        verb: 'Defeat',
        itemNoun: 'villain',
        unitSingular: 'win',
        items: villains.items,
        countsByItemId: villains.countsByItemId,
      }),
    )
  }

  if (locations.items.length > 0) {
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
      }),
    )
  }

  if (finalGirls.items.length > 0) {
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
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'finalGirl', gameName: 'Final Girl', tracks })
}

