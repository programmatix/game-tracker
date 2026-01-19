import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseFirestore, isFirebaseConfigured } from '../firebase'

function normalizeIds(ids: unknown): Set<string> {
  if (!Array.isArray(ids)) return new Set()
  return new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))
}

function preferencesDoc(user: User) {
  return doc(getFirebaseFirestore(), 'userPreferences', user.uid)
}

export async function fetchPinnedAchievementIds(user: User): Promise<Set<string>> {
  if (!isFirebaseConfigured()) return new Set()

  try {
    const prefDoc = preferencesDoc(user)
    console.log('fetchPinnedAchievementIds', prefDoc.path, user.uid)
    const snapshot = await getDoc(prefDoc)
    if (!snapshot.exists()) {
      console.log('fetchPinnedAchievementIds', prefDoc.path, user.uid, 'no snapshot')
      return new Set()
    }
    const data = snapshot.data() as { pinnedAchievementIds?: unknown } | undefined
    console.log('fetchPinnedAchievementIds', prefDoc.path, user.uid, 'data', data)
    return normalizeIds(data?.pinnedAchievementIds)
  } catch (error) {
    console.error('fetchPinnedAchievementIds', error)
    return new Set()
  }
}

export async function savePinnedAchievementIds(user: User, ids: Iterable<string>): Promise<void> {
  if (!isFirebaseConfigured()) return

  await setDoc(
    preferencesDoc(user),
    {
      pinnedAchievementIds: [...ids],
      pinnedAchievementIdsUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
