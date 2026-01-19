import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import {
  buildAchievementItem,
  buildCanonicalCounts,
  buildCanonicalMaxValues,
  buildIndividualItemTracks,
  buildItemIdLookup,
  buildNamedCountTrack,
  buildPerItemAchievementBaseId,
  buildPerItemTrack,
  buildPlayCountTrack,
  itemsFromMap,
  slugifyTrackId,
  stripTrailingLevelLabel,
  sumQuantities,
} from '../../achievements/gameUtils'
import { isMeaningfulAchievementItem, normalizeAchievementItemLabel } from '../../achievements/progress'
import { getSpiritIslandEntries, spiritIslandMappings } from './spiritIslandEntries'

const SPIRIT_ISLAND_LEVELS = [1, 2, 3, 4, 5, 6]

function parseAdversaryLevelLabel(value: string): { adversary: string; level: number } | null {
  const match = /^(?<adversary>.*)\s+L(?<level>\d+)\s*$/i.exec(value.trim())
  if (!match?.groups?.adversary || !match?.groups?.level) return null
  const level = Number(match.groups.level)
  if (!Number.isFinite(level)) return null
  return { adversary: match.groups.adversary.trim(), level }
}

function parseSpiritIslandAdversaryLevel(value: string): number | undefined {
  const match = /\bL\s*(\d+)\b/i.exec(value)
  if (!match?.[1]) return undefined
  const level = Number(match[1])
  if (!Number.isFinite(level) || level <= 0) return undefined
  return level
}

function formatSpiritIslandPairLabel(spirit: string, adversary: string): string {
  const spiritLabel = normalizeAchievementItemLabel(spirit)
  const adversaryLabel = normalizeAchievementItemLabel(adversary)
  return `${spiritLabel} × ${adversaryLabel}`
}

export function computeSpiritIslandAchievements(plays: BggPlay[], username: string) {
  const entries = getSpiritIslandEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const spiritLabelToId = buildItemIdLookup(spiritIslandMappings.spiritsById)
  const adversaryLabelToId = buildItemIdLookup(spiritIslandMappings.adversariesById)

  const adversaryLevelWinsByLabel = new Map<string, number>()
  const adversaryLevelBases = new Set<string>(spiritIslandMappings.adversariesById.values())
  for (const entry of entries) {
    const parsed = parseAdversaryLevelLabel(entry.adversary)
    if (!parsed) continue
    if (!SPIRIT_ISLAND_LEVELS.includes(parsed.level)) continue
    adversaryLevelBases.add(parsed.adversary)
    if (!entry.isWin) continue
    const label = `${parsed.adversary} L${parsed.level}`
    adversaryLevelWinsByLabel.set(label, (adversaryLevelWinsByLabel.get(label) ?? 0) + entry.quantity)
  }

  const spirits = buildCanonicalCounts({
    preferredItems: itemsFromMap(spiritIslandMappings.spiritsById),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.spirit, spiritLabelToId),
      amount: e.quantity,
    })),
  })

  const adversariesBase = buildCanonicalCounts({
    preferredItems: itemsFromMap(spiritIslandMappings.adversariesById),
    observed: entries.map((e) => ({
      item: buildAchievementItem(stripTrailingLevelLabel(e.adversary), adversaryLabelToId),
      amount: e.isWin ? e.quantity : 0,
    })),
  })

  const pairPreferred: string[] = []
  for (const spirit of spiritIslandMappings.spiritsById.values()) {
    for (const adversary of spiritIslandMappings.adversariesById.values()) {
      pairPreferred.push(formatSpiritIslandPairLabel(spirit, adversary))
    }
  }

  const adversarySpiritLevels = buildCanonicalMaxValues({
    preferredItems: pairPreferred,
    observed: entries
      .filter((entry) => entry.isWin)
      .map((entry) => {
        const level = parseSpiritIslandAdversaryLevel(entry.adversary)
        if (!level || !SPIRIT_ISLAND_LEVELS.includes(level)) return null
        const adversary = stripTrailingLevelLabel(entry.adversary)
        return {
          item: formatSpiritIslandPairLabel(entry.spirit, adversary),
          amount: level,
        }
      })
      .filter((entry): entry is { item: string; amount: number } => Boolean(entry)),
  })

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (adversariesBase.items.length > 0) {
    const adversaryLevelTracks: AchievementTrack[] = []
    for (const adversary of adversaryLevelBases) {
      const canonical = normalizeAchievementItemLabel(adversary)
      if (!isMeaningfulAchievementItem(canonical)) continue
      for (const difficulty of SPIRIT_ISLAND_LEVELS) {
        const label = `${adversary} L${difficulty}`
        adversaryLevelTracks.push(
          buildNamedCountTrack({
            trackId: `adversaryLevelWin:${slugifyTrackId(adversary)}-l${difficulty}`,
            achievementBaseId: `spirit-island-adversary-level-win-${slugifyTrackId(adversary)}-l${difficulty}`,
            current: adversaryLevelWinsByLabel.get(label) ?? 0,
            unitSingular: 'win',
            levels: [1],
            titleForLevel: (_winsTarget) => `Defeat ${adversary} on Level ${difficulty}`,
          }),
        )
      }
    }

    tracks.push(
      buildPerItemTrack({
        trackId: 'adversaryWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'adversary'),
        verb: 'Defeat',
        itemNoun: 'adversary',
        unitSingular: 'win',
        items: adversariesBase.items,
        countsByItemId: adversariesBase.countsByItemId,
      }),
      ...adversaryLevelTracks,
      ...buildIndividualItemTracks({
        trackIdPrefix: 'adversaryWins',
        verb: 'Defeat',
        itemNoun: 'adversary',
        unitSingular: 'win',
        items: adversariesBase.items,
        countsByItemId: adversariesBase.countsByItemId,
      }),
    )
  }

  if (spirits.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'spiritPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'spirit'),
        verb: 'Play',
        itemNoun: 'spirit',
        unitSingular: 'time',
        items: spirits.items,
        countsByItemId: spirits.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'spiritPlays',
        verb: 'Play',
        itemNoun: 'spirit',
        unitSingular: 'time',
        items: spirits.items,
        countsByItemId: spirits.countsByItemId,
      }),
    )
  }

  if (adversarySpiritLevels.items.length > 0) {
    tracks.push(
      ...adversarySpiritLevels.items.map((pair) =>
        buildNamedCountTrack({
          trackId: `spiritAdversaryLevels:${slugifyTrackId(pair)}`,
          achievementBaseId: `spirit-island-spirit-adversary-levels-${slugifyTrackId(pair)}`,
          current: adversarySpiritLevels.countsByItem[pair] ?? 0,
          unitSingular: 'level',
          titleForLevel: (level) => `Defeat ${pair} at level ${level}`,
          levels: SPIRIT_ISLAND_LEVELS,
        }),
      ),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'spiritIsland',
    gameName: 'Spirit Island',
    tracks,
  })
}

