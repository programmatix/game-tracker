const PIN_STORAGE_VERSION = 'v1'

function storageKey(username: string): string {
  return `achievementPins:${PIN_STORAGE_VERSION}:${username}`
}

export function readPinnedAchievementIds(username: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(username))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.filter((id) => typeof id === 'string'))
    return new Set()
  } catch {
    return new Set()
  }
}

export function writePinnedAchievementIds(username: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify([...ids]))
  } catch {
    // ignore quota / storage failures
  }
}
