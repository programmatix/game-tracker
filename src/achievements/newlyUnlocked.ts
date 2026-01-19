import type { Achievement } from './types'

export function pickCompletedAchievementIds(achievements: Achievement[]): Set<string> {
  const ids = new Set<string>()
  for (const achievement of achievements) {
    if (achievement.status === 'completed') ids.add(achievement.id)
  }
  return ids
}

export function computeNewlyUnlockedAchievements(
  achievements: Achievement[],
  seenCompletedAchievementIds: ReadonlySet<string>,
): Achievement[] {
  return achievements
    .filter(
      (achievement) =>
        achievement.status === 'completed' && !seenCompletedAchievementIds.has(achievement.id),
    )
    .slice()
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level
      if (a.gameName !== b.gameName) return a.gameName.localeCompare(b.gameName)
      return a.title.localeCompare(b.title)
    })
}

export function computeTrackIdsForAchievements(achievements: Achievement[]): string[] {
  const ids = new Set<string>()
  for (const achievement of achievements) ids.add(achievement.trackId)
  return Array.from(ids)
}

