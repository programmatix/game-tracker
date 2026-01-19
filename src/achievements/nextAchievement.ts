import type { Achievement } from './types'
import { normalizeAchievementItemLabel } from './progress'

export function slugifyAchievementItemId(value: string): string {
  const slug = normalizeAchievementItemLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return slug || 'unknown'
}

export function buildLabelToIdLookup(items: Array<{ id: string; label: string }>): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const item of items) {
    const normalized = normalizeAchievementItemLabel(item.label).toLowerCase()
    if (!normalized) continue
    if (!lookup.has(normalized)) lookup.set(normalized, item.id)
  }
  return lookup
}

function scoreAchievement(a: Achievement): [number, number, string] {
  return [a.remainingPlays, -a.playsSoFar, a.title]
}

export function pickBestAvailableAchievement(achievements: Achievement[]): Achievement | undefined {
  const available = achievements.filter((achievement) => achievement.status === 'available')
  if (available.length === 0) return undefined
  return available
    .slice()
    .sort((a, b) => {
      const [aRemaining, aSoFar, aTitle] = scoreAchievement(a)
      const [bRemaining, bSoFar, bTitle] = scoreAchievement(b)
      if (aRemaining !== bRemaining) return aRemaining - bRemaining
      if (aSoFar !== bSoFar) return aSoFar - bSoFar
      return aTitle.localeCompare(bTitle)
    })[0]
}

export function pickBestAvailableAchievementForTrackIds(
  achievements: Achievement[],
  trackIds: string[],
): Achievement | undefined {
  if (trackIds.length === 0) return undefined
  const relevant = achievements.filter((achievement) => trackIds.includes(achievement.trackId))
  return pickBestAvailableAchievement(relevant)
}

