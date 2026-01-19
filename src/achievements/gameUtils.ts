import type { AchievementTrack } from './types'
import { defaultAchievementLevels } from './levels'
import {
  computeCounterProgress,
  computePerItemProgress,
  isMeaningfulAchievementItem,
  normalizeAchievementItemLabel,
  pluralize,
} from './progress'

export type AchievementItem = { id: string; label: string }

export function sumQuantities(entries: Array<{ quantity: number }>): number {
  return entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0)
}

export function buildCanonicalCounts(input: {
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

export function buildCanonicalMaxValues(input: {
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

export function buildPlayCountTrack(input: {
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

export function slugifyTrackId(value: string): string {
  const slug = normalizeAchievementItemLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return slug || 'unknown'
}

export function buildItemIdLookup(map: Map<string, string>): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const [id, label] of map.entries()) {
    const normalized = normalizeAchievementItemLabel(label).toLowerCase()
    if (!normalized) continue
    if (!lookup.has(normalized)) lookup.set(normalized, id)
  }
  return lookup
}

export function buildAchievementItem(label: string, labelToId?: Map<string, string>): AchievementItem {
  const normalizedLabel = normalizeAchievementItemLabel(label)
  const normalizedKey = normalizedLabel.toLowerCase()
  const id = labelToId?.get(normalizedKey) ?? slugifyTrackId(normalizedLabel)
  return { id, label: normalizedLabel || label }
}

export function itemsFromMap(map: Map<string, string>): AchievementItem[] {
  return [...map.entries()].map(([id, label]) => ({
    id,
    label: normalizeAchievementItemLabel(label),
  }))
}

export function buildPerItemAchievementBaseId(verb: 'Play' | 'Defeat', itemNoun: string): string {
  const verbKey = verb === 'Play' ? 'play' : 'defeat'
  const nounKey = slugifyTrackId(itemNoun)
  return `${verbKey}-each-${nounKey}`
}

export function buildNamedCountTrack(input: {
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

export function buildIndividualItemTracks(input: {
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

export function buildPerItemTrack(input: {
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

export function stripTrailingLevelLabel(value: string): string {
  return value.replace(/\s+L\d+\s*$/i, '').trim()
}

