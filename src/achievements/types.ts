export type AchievementStatus = 'available' | 'completed'

export type AchievementKind = 'counter' | 'perItem'

export type Achievement = {
  id: string
  gameId: string
  gameName: string
  trackId: string
  kind: AchievementKind
  status: AchievementStatus
  title: string
  level: number
  remainingPlays: number
  playsSoFar: number
  progressValue: number
  progressTarget: number
  progressLabel: string
}

export type AchievementTrack = {
  trackId: string
  achievementBaseId: string
  kind: AchievementKind
  titleForLevel: (level: number) => string
  progressForLevel: (level: number) => {
    isComplete: boolean
    remainingPlays: number
    playsSoFar: number
    progressValue: number
    progressTarget: number
    progressLabel: string
  }
  levels: number[]
}
