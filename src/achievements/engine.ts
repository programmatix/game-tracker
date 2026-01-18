import type { Achievement, AchievementTrack } from './types'

export function buildUnlockedAchievementsForTrack(input: {
  gameId: string
  gameName: string
  track: AchievementTrack
}): Achievement[] {
  const achievements: Achievement[] = []
  let isStillUnlocking = true

  for (const level of input.track.levels) {
    if (!isStillUnlocking) break

    const progress = input.track.progressForLevel(level)
    const status = progress.isComplete ? 'completed' : 'available'

    achievements.push({
      id: `${input.gameId}:${input.track.trackId}:${level}`,
      gameId: input.gameId,
      gameName: input.gameName,
      trackId: input.track.trackId,
      kind: input.track.kind,
      status,
      title: input.track.titleForLevel(level),
      level,
      remainingPlays: progress.remainingPlays,
      progressValue: progress.progressValue,
      progressTarget: progress.progressTarget,
      progressLabel: progress.progressLabel,
    })

    if (!progress.isComplete) isStillUnlocking = false
  }

  return achievements
}

export function buildUnlockedAchievementsForGame(input: {
  gameId: string
  gameName: string
  tracks: AchievementTrack[]
}): Achievement[] {
  const achievements: Achievement[] = []
  for (const track of input.tracks) {
    achievements.push(
      ...buildUnlockedAchievementsForTrack({ gameId: input.gameId, gameName: input.gameName, track }),
    )
  }
  return achievements
}

export function sortUnlockedAchievements(
  achievements: Achievement[],
): { available: Achievement[]; completed: Achievement[] } {
  const available = achievements
    .filter((achievement) => achievement.status === 'available')
    .slice()
    .sort((a, b) => {
      if (b.remainingPlays !== a.remainingPlays) return b.remainingPlays - a.remainingPlays
      return a.title.localeCompare(b.title)
    })

  const completed = achievements
    .filter((achievement) => achievement.status === 'completed')
    .slice()
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level
      return a.title.localeCompare(b.title)
    })

  return { available, completed }
}

