import type { BggPlay } from '../bgg'
import type { AchievementTrack } from './types'
import { defaultAchievementLevels } from './levels'
import { computeCounterProgress, computePerItemProgress, isMeaningfulAchievementItem, normalizeAchievementItemLabel, pluralize } from './progress'
import { buildUnlockedAchievementsForGame } from './engine'
import { getFinalGirlEntries, ownedFinalGirlContent } from '../games/final-girl/finalGirlEntries'
import { getOwnedFinalGirlFinalGirls, getOwnedFinalGirlLocations, getOwnedFinalGirlVillains, normalizeFinalGirlName } from '../games/final-girl/ownedContent'
import { getSpiritIslandEntries, spiritIslandMappings } from '../games/spirit-island/spiritIslandEntries'
import { getMistfallEntries, mistfallMappings } from '../games/mistfall/mistfallEntries'
import { getDeathMayDieEntries } from '../games/death-may-die/deathMayDieEntries'
import { deathMayDieContent } from '../games/death-may-die/content'

export type GameId = 'finalGirl' | 'spiritIsland' | 'mistfall' | 'deathMayDie'

export type GameAchievementSummary = {
  gameId: GameId
  gameName: string
  achievements: ReturnType<typeof buildUnlockedAchievementsForGame>
}

type AchievementItem = { id: string; label: string }

function sumQuantities(entries: Array<{ quantity: number }>): number {
  return entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0)
}

function buildCanonicalCounts(input: {
  preferredItems: AchievementItem[]
  observed: Array<{ item: AchievementItem; amount: number }>
}): { items: AchievementItem[]; countsByItemId: Record<string, number> } {
  const canonicalByNormalized = new Map<string, AchievementItem>()
  const countsByItemId: Record<string, number> = {}

  for (const rawItem of input.preferredItems) {
    const label = normalizeAchievementItemLabel(rawItem.label)
    if (!isMeaningfulAchievementItem(label)) continue
    const normalized = label.toLowerCase()
    if (canonicalByNormalized.has(normalized)) continue
    canonicalByNormalized.set(normalized, { id: rawItem.id, label })
  }

  for (const row of input.observed) {
    const label = normalizeAchievementItemLabel(row.item.label)
    if (!isMeaningfulAchievementItem(label)) continue
    const normalized = label.toLowerCase()

    let canonical = canonicalByNormalized.get(normalized)
    if (!canonical) {
      canonical = { id: row.item.id, label }
      canonicalByNormalized.set(normalized, canonical)
    }

    countsByItemId[canonical.id] = (countsByItemId[canonical.id] ?? 0) + (row.amount || 0)
  }

  const items = [...canonicalByNormalized.values()]
  for (const item of items) countsByItemId[item.id] ??= 0
  return { items, countsByItemId }
}

function buildCanonicalMaxValues(input: {
  preferredItems: string[]
  observed: Array<{ item: string; amount: number }>
}): { items: string[]; countsByItem: Record<string, number> } {
  const canonicalByNormalized = new Map<string, string>()
  const countsByItem: Record<string, number> = {}

  for (const rawItem of input.preferredItems) {
    const item = normalizeAchievementItemLabel(rawItem)
    if (!isMeaningfulAchievementItem(item)) continue
    const normalized = item.toLowerCase()
    if (canonicalByNormalized.has(normalized)) continue
    canonicalByNormalized.set(normalized, item)
  }

  for (const row of input.observed) {
    const item = normalizeAchievementItemLabel(row.item)
    if (!isMeaningfulAchievementItem(item)) continue
    const normalized = item.toLowerCase()

    let canonical = canonicalByNormalized.get(normalized)
    if (!canonical) {
      canonical = item
      canonicalByNormalized.set(normalized, canonical)
    }

    const amount = Math.max(0, row.amount || 0)
    countsByItem[canonical] = Math.max(countsByItem[canonical] ?? 0, amount)
  }

  const items = [...canonicalByNormalized.values()]
  for (const item of items) countsByItem[item] ??= 0
  return { items, countsByItem }
}

function buildPlayCountTrack(input: {
  trackId: string
  achievementBaseId: string
  currentPlays: number
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  return {
    trackId: input.trackId,
    achievementBaseId: input.achievementBaseId,
    kind: 'counter',
    levels,
    titleForLevel: (level) => `Play ${level} ${pluralize(level, 'time')}`,
    progressForLevel: (level) => computeCounterProgress({ current: input.currentPlays, target: level, unitSingular: 'play' }),
  }
}

function slugifyTrackId(value: string): string {
  const slug = normalizeAchievementItemLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return slug || 'unknown'
}

function buildItemIdLookup(map: Map<string, string>): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const [id, label] of map.entries()) {
    const normalized = normalizeAchievementItemLabel(label).toLowerCase()
    if (!normalized) continue
    if (!lookup.has(normalized)) lookup.set(normalized, id)
  }
  return lookup
}

function buildAchievementItem(label: string, labelToId?: Map<string, string>): AchievementItem {
  const normalizedLabel = normalizeAchievementItemLabel(label)
  const normalizedKey = normalizedLabel.toLowerCase()
  const id = labelToId?.get(normalizedKey) ?? slugifyTrackId(normalizedLabel)
  return { id, label: normalizedLabel || label }
}

function itemsFromMap(map: Map<string, string>): AchievementItem[] {
  return [...map.entries()].map(([id, label]) => ({
    id,
    label: normalizeAchievementItemLabel(label),
  }))
}

function buildPerItemAchievementBaseId(verb: 'Play' | 'Defeat', itemNoun: string): string {
  const verbKey = verb === 'Play' ? 'play' : 'defeat'
  const nounKey = slugifyTrackId(itemNoun)
  return `${verbKey}-each-${nounKey}`
}

function buildNamedCountTrack(input: {
  trackId: string
  achievementBaseId: string
  current: number
  unitSingular: string
  titleForLevel: (level: number) => string
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  return {
    trackId: input.trackId,
    achievementBaseId: input.achievementBaseId,
    kind: 'counter',
    levels,
    titleForLevel: input.titleForLevel,
    progressForLevel: (level) =>
      computeCounterProgress({ current: input.current, target: level, unitSingular: input.unitSingular }),
  }
}

function buildIndividualItemTracks(input: {
  trackIdPrefix: string
  verb: 'Play' | 'Defeat'
  itemNoun: string
  items: AchievementItem[]
  countsByItemId: Record<string, number>
  unitSingular: string
  formatItem?: (item: string) => string
  levels?: number[]
}): AchievementTrack[] {
  const tracks: AchievementTrack[] = []
  const formatItem = input.formatItem ?? ((value: string) => value)
  const verbKey = input.verb === 'Play' ? 'play' : 'defeat'
  const nounKey = slugifyTrackId(input.itemNoun)
  for (const item of input.items) {
    const current = input.countsByItemId[item.id] ?? 0
    tracks.push(
      buildNamedCountTrack({
        trackId: `${input.trackIdPrefix}:${item.id}`,
        achievementBaseId: `${verbKey}-${nounKey}-${item.id}`,
        current,
        unitSingular: input.unitSingular,
        titleForLevel: (level) =>
          `${input.verb} ${formatItem(item.label)} ${level} ${pluralize(level, input.unitSingular)}`,
        levels: input.levels,
      }),
    )
  }
  return tracks
}

function buildPerItemTrack(input: {
  trackId: string
  achievementBaseId: string
  verb: 'Play' | 'Defeat'
  itemNoun: string
  unitSingular: string
  items: AchievementItem[]
  countsByItemId: Record<string, number>
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  const noun = input.itemNoun.trim()

  return {
    trackId: input.trackId,
    achievementBaseId: input.achievementBaseId,
    kind: 'perItem',
    levels,
    titleForLevel: (level) =>
      `${input.verb} each ${noun} ${level} ${pluralize(level, input.unitSingular)}`,
    progressForLevel: (level) =>
      computePerItemProgress({
        items: input.items.map((item) => item.id),
        countsByItem: input.countsByItemId,
        targetPerItem: level,
        unitSingular: input.unitSingular,
      }),
  }
}

function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

const SPIRIT_ISLAND_LEVELS = [1, 2, 3, 4, 5, 6]

function parseAdversaryLevelLabel(
  value: string,
): { adversary: string; level: number } | null {
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

function computeFinalGirlAchievements(plays: BggPlay[], username: string) {
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
    finalGirlBoxByNormalized.set(
      normalized,
      box,
    )
  }
  for (const entry of entries) {
    const finalGirl = normalizeAchievementItemLabel(entry.finalGirl)
    const location = normalizeAchievementItemLabel(entry.location)
    if (!isMeaningfulAchievementItem(finalGirl)) continue
    if (!isMeaningfulAchievementItem(location)) continue
    const normalized = finalGirl.toLowerCase()
    if (finalGirlBoxByNormalized.has(normalized)) continue
    const box = ownedFinalGirlContent.locationBoxesByName.get(normalizeFinalGirlName(location)) ?? location
    finalGirlBoxByNormalized.set(
      normalized,
      box,
    )
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

function computeSpiritIslandAchievements(plays: BggPlay[], username: string) {
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

function computeMistfallAchievements(plays: BggPlay[], username: string) {
  const entries = getMistfallEntries(plays, username)
  const totalPlays = sumQuantities(entries)

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
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (questWins.items.length > 0) {
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
      }),
    )
  }

  if (quests.items.length > 0) {
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
      }),
    )
  }

  if (heroes.items.length > 0) {
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
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'mistfall', gameName: 'Mistfall', tracks })
}

function computeDeathMayDieAchievements(plays: BggPlay[], username: string) {
  const entries = getDeathMayDieEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const elderOnes = buildCanonicalCounts({
    preferredItems: deathMayDieContent.elderOnes.map((elderOne) =>
      buildAchievementItem(elderOne),
    ),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.elderOne),
      amount: e.isWin ? e.quantity : 0,
    })),
  })

  const scenarios = buildCanonicalCounts({
    preferredItems: deathMayDieContent.scenarios.map((scenario) =>
      buildAchievementItem(scenario),
    ),
    observed: entries.map((e) => ({
      item: buildAchievementItem(e.scenario),
      amount: e.quantity,
    })),
  })

  const myInvestigators = buildCanonicalCounts({
    preferredItems: deathMayDieContent.investigators.map((investigator) =>
      buildAchievementItem(investigator),
    ),
    observed: entries
      .filter((e) => Boolean(e.myInvestigator))
      .map((e) => ({ item: buildAchievementItem(e.myInvestigator!), amount: e.quantity })),
  })

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', achievementBaseId: 'plays', currentPlays: totalPlays }),
  ]

  if (elderOnes.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'elderOneWins',
        achievementBaseId: buildPerItemAchievementBaseId('Defeat', 'elder one'),
        verb: 'Defeat',
        itemNoun: 'elder one',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItemId: elderOnes.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'elderOneWins',
        verb: 'Defeat',
        itemNoun: 'elder one',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItemId: elderOnes.countsByItemId,
      }),
    )
  }

  if (scenarios.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'scenario'),
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItemId: scenarios.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioPlays',
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItemId: scenarios.countsByItemId,
      }),
    )
  }

  if (myInvestigators.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'investigatorPlays',
        achievementBaseId: buildPerItemAchievementBaseId('Play', 'investigator'),
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItemId: myInvestigators.countsByItemId,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'investigatorPlays',
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItemId: myInvestigators.countsByItemId,
      }),
    )
  }

  return buildUnlockedAchievementsForGame({
    gameId: 'deathMayDie',
    gameName: 'Cthulhu: Death May Die',
    tracks,
  })
}

export function computeGameAchievements(gameId: GameId, plays: BggPlay[], username: string) {
  if (gameId === 'finalGirl') return computeFinalGirlAchievements(plays, username)
  if (gameId === 'spiritIsland') return computeSpiritIslandAchievements(plays, username)
  if (gameId === 'mistfall') return computeMistfallAchievements(plays, username)
  if (gameId === 'deathMayDie') return computeDeathMayDieAchievements(plays, username)
  return []
}

export function computeAllGameAchievementSummaries(
  plays: BggPlay[],
  username: string,
): GameAchievementSummary[] {
  const summaries: GameAchievementSummary[] = [
    { gameId: 'finalGirl', gameName: 'Final Girl', achievements: computeFinalGirlAchievements(plays, username) },
    { gameId: 'spiritIsland', gameName: 'Spirit Island', achievements: computeSpiritIslandAchievements(plays, username) },
    { gameId: 'mistfall', gameName: 'Mistfall', achievements: computeMistfallAchievements(plays, username) },
    { gameId: 'deathMayDie', gameName: 'Cthulhu: Death May Die', achievements: computeDeathMayDieAchievements(plays, username) },
  ]

  return summaries
}
