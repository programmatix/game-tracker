import type { BggPlay } from '../../bgg'
import type { AchievementTrack } from '../../achievements/types'
import { buildUnlockedAchievementsForGame } from '../../achievements/engine'
import { buildCompletionFromPlay, findCompletionEntryForCounter } from '../../achievements/completion'
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
import {
  computePerItemProgress,
  isMeaningfulAchievementItem,
  normalizeAchievementItemLabel,
  pluralize,
} from '../../achievements/progress'
import { defaultAchievementLevels } from '../../achievements/levels'
import type { SpiritIslandSession } from './mindwanderer'
import { getSpiritIslandEntriesFromSessions, spiritIslandMappings } from './spiritIslandEntries'

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

function buildPerItemWinTrack(input: {
  trackId: string
  achievementBaseId: string
  items: Array<{ id: string }>
  winsByItemId: Record<string, number>
  noun: string
  levels?: number[]
}): AchievementTrack {
  return {
    trackId: input.trackId,
    achievementBaseId: input.achievementBaseId,
    kind: 'perItem',
    levels: input.levels ?? defaultAchievementLevels(),
    titleForLevel: (level) =>
      `Win with each ${input.noun} ${level} ${pluralize(level, 'win')}`,
    progressForLevel: (level) =>
      computePerItemProgress({
        items: input.items.map((item) => item.id),
        countsByItem: input.winsByItemId,
        targetPerItem: level,
        unitSingular: 'win',
      }),
  }
}

export function computeSpiritIslandAchievements(
  plays: BggPlay[],
  username: string,
  sessions?: SpiritIslandSession[],
) {
  void plays
  void username
  const entries = sessions ? getSpiritIslandEntriesFromSessions(sessions) : []
  const totalPlays = sumQuantities(entries)

  const spiritLabelToId = buildItemIdLookup(spiritIslandMappings.spiritsById)
  const adversaryLabelToId = buildItemIdLookup(spiritIslandMappings.adversariesById)
  const normalizeKey = (value: string) => normalizeAchievementItemLabel(value).toLowerCase()

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

  const lowComplexitySpiritKeys = new Set(
    spiritIslandMappings.spirits
      .filter((spirit) => spirit.complexity === 'Low')
      .map((spirit) => normalizeKey(spirit.display)),
  )
  const lowComplexityPreferred = spiritIslandMappings.spirits
    .filter((spirit) => spirit.complexity === 'Low')
    .map((spirit) => buildAchievementItem(spirit.display, spiritLabelToId))

  const lowComplexitySpiritPlays = buildCanonicalCounts({
    preferredItems: lowComplexityPreferred,
    observed: entries
      .filter((e) => lowComplexitySpiritKeys.has(normalizeKey(e.spirit)))
      .map((e) => ({
        item: buildAchievementItem(e.spirit, spiritLabelToId),
        amount: e.quantity,
      })),
  })

  const lowComplexitySpiritWins = buildCanonicalCounts({
    preferredItems: lowComplexityPreferred,
    observed: entries
      .filter((e) => e.isWin && lowComplexitySpiritKeys.has(normalizeKey(e.spirit)))
      .map((e) => ({
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
    {
      ...buildPlayCountTrack({
        trackId: 'plays',
        achievementBaseId: 'plays',
        currentPlays: totalPlays,
      }),
      completionForLevel: (level) => {
        const entry = findCompletionEntryForCounter({ entries, target: level })
        if (!entry) return undefined
        return buildCompletionFromPlay(entry.play, `With ${entry.spirit} vs ${entry.adversary}`)
      },
    },
  ]

  if (lowComplexitySpiritPlays.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'lowComplexitySpiritPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'low complexity spirit'),
        verb: 'Play',
        itemNoun: 'low complexity spirit',
        unitSingular: 'time',
        items: lowComplexitySpiritPlays.items,
        countsByItemId: lowComplexitySpiritPlays.countsByItemId,
      }),
    )
  }

  if (lowComplexitySpiritWins.items.length > 0) {
    tracks.push(
      buildPerItemWinTrack({
        trackId: 'lowComplexitySpiritWins',
        achievementBaseId: `win-each-${slugifyTrackId('low complexity spirit')}`,
        items: lowComplexitySpiritWins.items,
        winsByItemId: lowComplexitySpiritWins.countsByItemId,
        noun: 'low complexity spirit',
      }),
    )
  }

  if (adversariesBase.items.length > 0) {
    const adversaryLevelTracks: AchievementTrack[] = []
    for (const adversary of adversaryLevelBases) {
      const canonical = normalizeAchievementItemLabel(adversary)
      if (!isMeaningfulAchievementItem(canonical)) continue
      for (const difficulty of SPIRIT_ISLAND_LEVELS) {
        const label = `${adversary} L${difficulty}`
        adversaryLevelTracks.push(
          {
            ...buildNamedCountTrack({
            trackId: `adversaryLevelWin:${slugifyTrackId(adversary)}-l${difficulty}`,
            achievementBaseId: `spirit-island-adversary-level-win-${slugifyTrackId(adversary)}-l${difficulty}`,
            current: adversaryLevelWinsByLabel.get(label) ?? 0,
            unitSingular: 'win',
            levels: [1],
            titleForLevel: (_winsTarget) => `Defeat ${adversary} on Level ${difficulty}`,
            }),
            completionForLevel: (_winsTarget) => {
              const adversaryKey = normalizeKey(adversary)
              const entry = findCompletionEntryForCounter({
                entries,
                target: 1,
                predicate: (e) => {
                  if (!e.isWin) return false
                  const parsed = parseAdversaryLevelLabel(e.adversary)
                  if (!parsed || parsed.level !== difficulty) return false
                  return normalizeKey(parsed.adversary) === adversaryKey
                },
              })
              if (!entry) return undefined
              return buildCompletionFromPlay(entry.play, `With ${entry.spirit}`)
            },
          },
        )
      }
    }

    const adversaryLabelById = new Map(adversariesBase.items.map((item) => [item.id, item.label]))
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
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? adversaryLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (winsTarget: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: winsTarget,
              predicate: (e) => e.isWin && normalizeKey(stripTrailingLevelLabel(e.adversary)) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `With ${entry.spirit}`)
          },
        }
      }),
    )
  }

  if (spirits.items.length > 0) {
    const spiritLabelById = new Map(spirits.items.map((item) => [item.id, item.label]))
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
      }).map((track) => {
        const itemId = /:([^:]+)$/.exec(track.trackId)?.[1]
        const label = itemId ? spiritLabelById.get(itemId) : undefined
        if (!label) return track
        const labelKey = normalizeKey(label)
        return {
          ...track,
          completionForLevel: (targetPlays: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: targetPlays,
              predicate: (e) => normalizeKey(e.spirit) === labelKey,
            })
            if (!entry) return undefined
            return buildCompletionFromPlay(entry.play, `Vs ${entry.adversary}`)
          },
        }
      }),
    )
  }

  if (adversarySpiritLevels.items.length > 0) {
    tracks.push(
      ...adversarySpiritLevels.items.map((pair) => {
        const [spirit, adversary] = pair.split('×').map((value) => normalizeAchievementItemLabel(value))
        const spiritKey = normalizeKey(spirit || '')
        const adversaryKey = normalizeKey(adversary || '')
        return {
          ...buildNamedCountTrack({
          trackId: `spiritAdversaryLevels:${slugifyTrackId(pair)}`,
          achievementBaseId: `spirit-island-spirit-adversary-levels-${slugifyTrackId(pair)}`,
          current: adversarySpiritLevels.countsByItem[pair] ?? 0,
          unitSingular: 'level',
          titleForLevel: (level) => `Defeat ${pair} at level ${level}`,
          levels: SPIRIT_ISLAND_LEVELS,
          }),
          completionForLevel: (targetLevel: number) => {
            const entry = findCompletionEntryForCounter({
              entries,
              target: 1,
              predicate: (e) => {
                if (!e.isWin) return false
                if (normalizeKey(e.spirit) !== spiritKey) return false
                if (normalizeKey(stripTrailingLevelLabel(e.adversary)) !== adversaryKey) return false
                const wonLevel = parseSpiritIslandAdversaryLevel(e.adversary)
                return Boolean(wonLevel && wonLevel >= targetLevel)
              },
            })
            if (!entry) return undefined
            const wonLevel = parseSpiritIslandAdversaryLevel(entry.adversary)
            const suffix = wonLevel ? ` (won L${wonLevel})` : ''
            return buildCompletionFromPlay(entry.play, `With ${entry.spirit}${suffix}`)
          },
        }
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'spiritIsland',
    gameName: 'Spirit Island',
    tracks,
  })
}
