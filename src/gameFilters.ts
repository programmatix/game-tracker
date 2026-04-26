import {
  GAME_STATUS_OPTIONS,
  isGameStatus,
  type GameStatus,
} from './gamePreferences'

export function allGameStatuses(): GameStatus[] {
  return GAME_STATUS_OPTIONS.map((option) => option.value)
}

export function orderVisibleGameStatuses(statuses: readonly GameStatus[]): GameStatus[] {
  const visible = new Set(statuses)
  return GAME_STATUS_OPTIONS.map((option) => option.value).filter((value) => visible.has(value))
}

export function toggleVisibleGameStatus(
  current: readonly GameStatus[],
  status: GameStatus,
): GameStatus[] {
  const next = current.includes(status)
    ? current.filter((value) => value !== status)
    : [...current, status]

  return orderVisibleGameStatuses(next)
}

export function readStoredVisibleGameStatuses(storageKey: string): GameStatus[] {
  if (typeof window === 'undefined') return allGameStatuses()

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return allGameStatuses()

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return allGameStatuses()
    if (parsed.length === 0) return []

    const visibleStatuses = parsed.filter(isGameStatus)
    return visibleStatuses.length > 0
      ? orderVisibleGameStatuses(visibleStatuses)
      : allGameStatuses()
  } catch {
    return allGameStatuses()
  }
}

export function readStoredChecklistOnly(storageKey: string): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(storageKey) === 'true'
  } catch {
    return false
  }
}
