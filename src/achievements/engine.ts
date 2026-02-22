import type { Achievement, AchievementTrack } from './types'

function humanizeTrackFamily(value: string): string {
  const spaced = value
    .replace(/[:_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  if (!spaced) return 'Other'
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getTypeLabel(track: AchievementTrack): string {
  if (track.typeLabel?.trim()) return track.typeLabel.trim()
  const trackFamily = track.trackId.split(':')[0] || track.trackId
  return humanizeTrackFamily(trackFamily)
}

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
    const completion =
      status === 'completed' ? input.track.completionForLevel?.(level) : undefined

    achievements.push({
      id: `${input.gameId}-${input.track.achievementBaseId}-${level}`,
      gameId: input.gameId,
      gameName: input.gameName,
      trackId: input.track.trackId,
      typeLabel: getTypeLabel(input.track),
      kind: input.track.kind,
      status,
      title: input.track.titleForLevel(level),
      level,
      remainingPlays: progress.remainingPlays,
      playsSoFar: progress.playsSoFar,
      progressValue: progress.progressValue,
      progressTarget: progress.progressTarget,
      progressLabel: progress.progressLabel,
      completion,
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
  options?: { pinnedAchievementIds?: ReadonlySet<string> },
): { available: Achievement[]; completed: Achievement[] } {
  const pinnedAchievementIds = options?.pinnedAchievementIds ?? new Set<string>()
  const locked = achievements
    .filter(
      (achievement) =>
        achievement.status === 'available' || pinnedAchievementIds.has(achievement.id),
    )
    .slice()
    .sort((a, b) => {
      const aPinned = pinnedAchievementIds.has(a.id)
      const bPinned = pinnedAchievementIds.has(b.id)
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      if (a.remainingPlays !== b.remainingPlays) return a.remainingPlays - b.remainingPlays
      if (a.playsSoFar !== b.playsSoFar) return b.playsSoFar - a.playsSoFar
      return a.title.localeCompare(b.title)
    })

  const completed = achievements
    .filter(
      (achievement) =>
        achievement.status === 'completed' && !pinnedAchievementIds.has(achievement.id),
    )
    .slice()
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level
      return a.title.localeCompare(b.title)
    })

  return { available: locked, completed }
}
