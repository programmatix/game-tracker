import type { BggPlay } from '../bgg'
import type { AchievementCompletion } from './types'

export type EntryWithPlay = {
  play: BggPlay
  quantity: number
}

export function comparePlaysChronological(a: BggPlay, b: BggPlay): number {
  const aDate = a.attributes.date || ''
  const bDate = b.attributes.date || ''
  if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate)
  if (aDate !== bDate) return aDate ? -1 : 1
  return a.id - b.id
}

export function sortEntriesChronological<T extends EntryWithPlay>(entries: T[]): T[] {
  return entries.slice().sort((a, b) => comparePlaysChronological(a.play, b.play))
}

export function buildCompletionFromPlay(
  play: BggPlay,
  detail: string,
): AchievementCompletion {
  return {
    detail,
    playId: play.id,
    playDate: play.attributes.date || undefined,
  }
}

export function findCompletionEntryForCounter<T extends EntryWithPlay>(input: {
  entries: T[]
  target: number
  predicate?: (entry: T) => boolean
}): T | undefined {
  const target = input.target > 0 ? input.target : 1
  const predicate = input.predicate ?? (() => true)
  const sorted = sortEntriesChronological(input.entries)

  let progress = 0
  for (const entry of sorted) {
    if (!predicate(entry)) continue
    progress += Math.max(0, entry.quantity || 0)
    if (progress >= target) return entry
  }

  return undefined
}

