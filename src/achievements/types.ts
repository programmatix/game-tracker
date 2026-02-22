export type AchievementStatus = 'available' | 'completed'

export type AchievementKind = 'counter' | 'perItem'

export type AchievementCompletion = {
  detail: string
  playId?: number
  playDate?: string
}

export type Achievement = {
  id: string
  gameId: string
  gameName: string
  trackId: string
  typeLabel: string
  kind: AchievementKind
  status: AchievementStatus
  title: string
  level: number
  remainingPlays: number
  playsSoFar: number
  progressValue: number
  progressTarget: number
  progressLabel: string
  completion?: AchievementCompletion
}

export type AchievementProgress = {
  isComplete: boolean
  remainingPlays: number
  playsSoFar: number
  progressValue: number
  progressTarget: number
  progressLabel: string
}

export type AchievementTrack = {
  trackId: string
  achievementBaseId: string
  typeLabel?: string
  kind: AchievementKind
  titleForLevel: (level: number) => string
  progressForLevel: (level: number) => AchievementProgress
  completionForLevel?: (level: number) => AchievementCompletion | undefined
  levels: number[]
}
