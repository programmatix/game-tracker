import type { Achievement } from './types'

type SeenCompletedAchievementIdsV1 = {
  version: 1
  updatedAtMs: number
  completedAchievementIds: string[]
}

type AchievementsSnapshotV1 = {
  version: 1
  savedAtMs: number
  achievements: Array<{
    id: string
    status: Achievement['status']
    gameId: string
    trackId: string
    level: number
    remainingPlays: number
    playsSoFar: number
  }>
}

const SEEN_COMPLETED_KEY = 'achievementsSeenCompletedIds:v1'
const SNAPSHOT_KEY = 'achievementsSnapshot:v1'

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function readSeenCompletedAchievementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_COMPLETED_KEY)
    if (!raw) return new Set()
    const parsed = safeParseJson(raw)
    if (
      typeof parsed === 'object' &&
      parsed != null &&
      'version' in parsed &&
      (parsed as { version: unknown }).version === 1 &&
      'completedAchievementIds' in parsed &&
      Array.isArray((parsed as { completedAchievementIds: unknown }).completedAchievementIds)
    ) {
      const ids = (parsed as SeenCompletedAchievementIdsV1).completedAchievementIds
      return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))
    }
    return new Set()
  } catch {
    return new Set()
  }
}

export function writeSeenCompletedAchievementIds(ids: ReadonlySet<string>) {
  try {
    const payload: SeenCompletedAchievementIdsV1 = {
      version: 1,
      updatedAtMs: Date.now(),
      completedAchievementIds: Array.from(ids),
    }
    localStorage.setItem(SEEN_COMPLETED_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / storage failures
  }
}

function readSnapshotSavedAtMs(): number | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = safeParseJson(raw)
    if (
      typeof parsed === 'object' &&
      parsed != null &&
      'version' in parsed &&
      (parsed as { version: unknown }).version === 1 &&
      'savedAtMs' in parsed &&
      typeof (parsed as { savedAtMs: unknown }).savedAtMs === 'number'
    ) {
      return (parsed as AchievementsSnapshotV1).savedAtMs
    }
    return null
  } catch {
    return null
  }
}

export function maybeWriteAchievementsSnapshot(
  achievements: Achievement[],
  options?: { minIntervalMs?: number },
) {
  const minIntervalMs = options?.minIntervalMs ?? 10 * 60 * 1000
  const savedAtMs = readSnapshotSavedAtMs()
  if (savedAtMs != null && Date.now() - savedAtMs < minIntervalMs) return

  try {
    const payload: AchievementsSnapshotV1 = {
      version: 1,
      savedAtMs: Date.now(),
      achievements: achievements.map((achievement) => ({
        id: achievement.id,
        status: achievement.status,
        gameId: achievement.gameId,
        trackId: achievement.trackId,
        level: achievement.level,
        remainingPlays: achievement.remainingPlays,
        playsSoFar: achievement.playsSoFar,
      })),
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / storage failures
  }
}

