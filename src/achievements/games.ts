import type { BggPlay } from '../bgg'
import type { AchievementTrack } from './types'
import { defaultAchievementLevels } from './levels'
import { computeCounterProgress, computePerItemProgress, isMeaningfulAchievementItem, normalizeAchievementItemLabel, pluralize } from './progress'
import { buildUnlockedAchievementsForGame } from './engine'
import { getFinalGirlEntries, ownedFinalGirlContent } from '../games/final-girl/finalGirlEntries'
import { getOwnedFinalGirlFinalGirls, getOwnedFinalGirlLocations, getOwnedFinalGirlVillains } from '../games/final-girl/ownedContent'
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

function sumQuantities(entries: Array<{ quantity: number }>): number {
  return entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0)
}

function buildCanonicalCounts(input: {
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

    countsByItem[canonical] = (countsByItem[canonical] ?? 0) + (row.amount || 0)
  }

  const items = [...canonicalByNormalized.values()]
  for (const item of items) countsByItem[item] ??= 0
  return { items, countsByItem }
}

function buildPlayCountTrack(input: {
  trackId: string
  currentPlays: number
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  return {
    trackId: input.trackId,
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

function buildNamedCountTrack(input: {
  trackId: string
  current: number
  unitSingular: string
  titleForLevel: (level: number) => string
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  return {
    trackId: input.trackId,
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
  items: string[]
  countsByItem: Record<string, number>
  unitSingular: string
  formatItem?: (item: string) => string
  levels?: number[]
}): AchievementTrack[] {
  const tracks: AchievementTrack[] = []
  const formatItem = input.formatItem ?? ((value: string) => value)
  for (const item of input.items) {
    const current = input.countsByItem[item] ?? 0
    tracks.push(
      buildNamedCountTrack({
        trackId: `${input.trackIdPrefix}:${slugifyTrackId(item)}`,
        current,
        unitSingular: input.unitSingular,
        titleForLevel: (level) =>
          `${input.verb} ${formatItem(item)} ${level} ${pluralize(level, input.unitSingular)}`,
        levels: input.levels,
      }),
    )
  }
  return tracks
}

function buildPerItemTrack(input: {
  trackId: string
  verb: 'Play' | 'Defeat'
  itemNoun: string
  unitSingular: string
  items: string[]
  countsByItem: Record<string, number>
  levels?: number[]
}): AchievementTrack {
  const levels = input.levels ?? defaultAchievementLevels()
  const noun = input.itemNoun.trim()

  return {
    trackId: input.trackId,
    kind: 'perItem',
    levels,
    titleForLevel: (level) =>
      `${input.verb} each ${noun} ${level} ${pluralize(level, input.unitSingular)}`,
    progressForLevel: (level) =>
      computePerItemProgress({
        items: input.items,
        countsByItem: input.countsByItem,
        targetPerItem: level,
        unitSingular: input.unitSingular,
      }),
  }
}

function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

function computeFinalGirlAchievements(plays: BggPlay[], username: string) {
  const entries = getFinalGirlEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const ownedVillains = getOwnedFinalGirlVillains(ownedFinalGirlContent)
  const ownedLocations = getOwnedFinalGirlLocations(ownedFinalGirlContent)
  const ownedFinalGirls = getOwnedFinalGirlFinalGirls(ownedFinalGirlContent)

  const villainPreferred =
    ownedFinalGirlContent.ownedVillains.size > 0 ? ownedVillains : entries.map((e) => e.villain)
  const locationPreferred =
    ownedFinalGirlContent.ownedLocations.size > 0 ? ownedLocations : entries.map((e) => e.location)
  const finalGirlPreferred =
    ownedFinalGirlContent.ownedFinalGirls.size > 0
      ? ownedFinalGirls
      : entries.map((e) => e.finalGirl)

  const villains = buildCanonicalCounts({
    preferredItems: villainPreferred,
    observed: entries.map((e) => ({ item: e.villain, amount: e.isWin ? e.quantity : 0 })),
  })
  const locations = buildCanonicalCounts({
    preferredItems: locationPreferred,
    observed: entries.map((e) => ({ item: e.location, amount: e.quantity })),
  })
  const finalGirls = buildCanonicalCounts({
    preferredItems: finalGirlPreferred,
    observed: entries.map((e) => ({ item: e.finalGirl, amount: e.quantity })),
  })

  const finalGirlBoxByNormalized = new Map<string, string>()
  for (const [normalized, location] of ownedFinalGirlContent.finalGirlLocationsByName) {
    const canonicalLocation = normalizeAchievementItemLabel(location)
    if (!isMeaningfulAchievementItem(canonicalLocation)) continue
    finalGirlBoxByNormalized.set(normalized, canonicalLocation)
  }
  for (const entry of entries) {
    const finalGirl = normalizeAchievementItemLabel(entry.finalGirl)
    const location = normalizeAchievementItemLabel(entry.location)
    if (!isMeaningfulAchievementItem(finalGirl)) continue
    if (!isMeaningfulAchievementItem(location)) continue
    const normalized = finalGirl.toLowerCase()
    if (finalGirlBoxByNormalized.has(normalized)) continue
    finalGirlBoxByNormalized.set(normalized, location)
  }

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', currentPlays: totalPlays }),
  ]

  if (villains.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'villainWins',
        verb: 'Defeat',
        itemNoun: 'villain',
        unitSingular: 'win',
        items: villains.items,
        countsByItem: villains.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'villainWins',
        verb: 'Defeat',
        unitSingular: 'win',
        items: villains.items,
        countsByItem: villains.countsByItem,
      }),
    )
  }

  if (locations.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'locationPlays',
        verb: 'Play',
        itemNoun: 'location',
        unitSingular: 'time',
        items: locations.items,
        countsByItem: locations.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'locationPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: locations.items,
        countsByItem: locations.countsByItem,
      }),
    )
  }

  if (finalGirls.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'finalGirlPlays',
        verb: 'Play',
        itemNoun: 'final girl',
        unitSingular: 'time',
        items: finalGirls.items,
        countsByItem: finalGirls.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'finalGirlPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: finalGirls.items,
        countsByItem: finalGirls.countsByItem,
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

  const spirits = buildCanonicalCounts({
    preferredItems: [...spiritIslandMappings.spiritsById.values()],
    observed: entries.map((e) => ({ item: e.spirit, amount: e.quantity })),
  })

  const adversariesBase = buildCanonicalCounts({
    preferredItems: [...spiritIslandMappings.adversariesById.values()],
    observed: entries.map((e) => ({
      item: stripTrailingLevelLabel(e.adversary),
      amount: e.isWin ? e.quantity : 0,
    })),
  })

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', currentPlays: totalPlays }),
  ]

  if (adversariesBase.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'adversaryWins',
        verb: 'Defeat',
        itemNoun: 'adversary',
        unitSingular: 'win',
        items: adversariesBase.items,
        countsByItem: adversariesBase.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'adversaryWins',
        verb: 'Defeat',
        unitSingular: 'win',
        items: adversariesBase.items,
        countsByItem: adversariesBase.countsByItem,
      }),
    )
  }

  if (spirits.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'spiritPlays',
        verb: 'Play',
        itemNoun: 'spirit',
        unitSingular: 'time',
        items: spirits.items,
        countsByItem: spirits.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'spiritPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: spirits.items,
        countsByItem: spirits.countsByItem,
      }),
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

  const heroes = buildCanonicalCounts({
    preferredItems: mistfallMappings.allHeroes,
    observed: entries.map((e) => ({ item: e.hero, amount: e.quantity })),
  })
  const quests = buildCanonicalCounts({
    preferredItems: mistfallMappings.allQuests,
    observed: entries.map((e) => ({ item: e.quest, amount: e.quantity })),
  })
  const questWins = buildCanonicalCounts({
    preferredItems: mistfallMappings.allQuests,
    observed: entries.map((e) => ({ item: e.quest, amount: e.isWin ? e.quantity : 0 })),
  })

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', currentPlays: totalPlays }),
  ]

  if (questWins.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'questWins',
        verb: 'Defeat',
        itemNoun: 'quest',
        unitSingular: 'win',
        items: questWins.items,
        countsByItem: questWins.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'questWins',
        verb: 'Defeat',
        unitSingular: 'win',
        items: questWins.items,
        countsByItem: questWins.countsByItem,
      }),
    )
  }

  if (quests.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'questPlays',
        verb: 'Play',
        itemNoun: 'quest',
        unitSingular: 'time',
        items: quests.items,
        countsByItem: quests.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'questPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: quests.items,
        countsByItem: quests.countsByItem,
      }),
    )
  }

  if (heroes.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'heroPlays',
        verb: 'Play',
        itemNoun: 'hero',
        unitSingular: 'time',
        items: heroes.items,
        countsByItem: heroes.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'heroPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: heroes.items,
        countsByItem: heroes.countsByItem,
      }),
    )
  }

  return buildUnlockedAchievementsForGame({ gameId: 'mistfall', gameName: 'Mistfall', tracks })
}

function computeDeathMayDieAchievements(plays: BggPlay[], username: string) {
  const entries = getDeathMayDieEntries(plays, username)
  const totalPlays = sumQuantities(entries)

  const elderOnes = buildCanonicalCounts({
    preferredItems: deathMayDieContent.elderOnes,
    observed: entries.map((e) => ({ item: e.elderOne, amount: e.isWin ? e.quantity : 0 })),
  })

  const scenarios = buildCanonicalCounts({
    preferredItems: deathMayDieContent.scenarios,
    observed: entries.map((e) => ({ item: e.scenario, amount: e.quantity })),
  })

  const myInvestigators = buildCanonicalCounts({
    preferredItems: deathMayDieContent.investigators,
    observed: entries
      .filter((e) => Boolean(e.myInvestigator))
      .map((e) => ({ item: e.myInvestigator!, amount: e.quantity })),
  })

  const tracks: AchievementTrack[] = [
    buildPlayCountTrack({ trackId: 'plays', currentPlays: totalPlays }),
  ]

  if (elderOnes.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'elderOneWins',
        verb: 'Defeat',
        itemNoun: 'elder one',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItem: elderOnes.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'elderOneWins',
        verb: 'Defeat',
        unitSingular: 'win',
        items: elderOnes.items,
        countsByItem: elderOnes.countsByItem,
      }),
    )
  }

  if (scenarios.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'scenarioPlays',
        verb: 'Play',
        itemNoun: 'scenario',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItem: scenarios.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'scenarioPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: scenarios.items,
        countsByItem: scenarios.countsByItem,
      }),
    )
  }

  if (myInvestigators.items.length > 0) {
    tracks.push(
      buildPerItemTrack({
        trackId: 'investigatorPlays',
        verb: 'Play',
        itemNoun: 'investigator',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItem: myInvestigators.countsByItem,
      }),
      ...buildIndividualItemTracks({
        trackIdPrefix: 'investigatorPlays',
        verb: 'Play',
        unitSingular: 'time',
        items: myInvestigators.items,
        countsByItem: myInvestigators.countsByItem,
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
