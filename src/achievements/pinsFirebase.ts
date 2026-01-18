import type { User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions, isFirebaseConfigured } from '../firebase'

type GetPinnedAchievementIdsResponse = { ids: string[] }
type SetPinnedAchievementIdsRequest = { ids: string[] }

function normalizeIds(ids: unknown): Set<string> {
  if (!Array.isArray(ids)) return new Set()
  return new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))
}

export async function fetchPinnedAchievementIds(_user: User): Promise<Set<string>> {
  if (!isFirebaseConfigured()) return new Set()

  try {
    const fn = httpsCallable<undefined, GetPinnedAchievementIdsResponse>(
      getFirebaseFunctions(),
      'getPinnedAchievementIds',
    )
    const result = await fn()
    return normalizeIds(result.data?.ids)
  } catch {
    return new Set()
  }
}

export async function savePinnedAchievementIds(_user: User, ids: Iterable<string>): Promise<void> {
  if (!isFirebaseConfigured()) return

  const fn = httpsCallable<SetPinnedAchievementIdsRequest, { ok: boolean }>(
    getFirebaseFunctions(),
    'setPinnedAchievementIds',
  )

  await fn({ ids: [...ids] })
}
