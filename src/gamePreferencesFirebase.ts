import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseFirestore, isFirebaseConfigured } from './firebase'
import {
  normalizeStoredGamePreferencesById,
  type StoredGamePreferencesById,
} from './gamePreferences'

function preferencesDoc(user: User) {
  return doc(getFirebaseFirestore(), 'userPreferences', user.uid)
}

export async function fetchStoredGamePreferences(user: User): Promise<StoredGamePreferencesById> {
  if (!isFirebaseConfigured()) return {}

  try {
    const prefDoc = preferencesDoc(user)
    const snapshot = await getDoc(prefDoc)
    if (!snapshot.exists()) return {}

    const data = snapshot.data() as { gamePreferencesById?: unknown } | undefined
    return normalizeStoredGamePreferencesById(data?.gamePreferencesById)
  } catch (error) {
    console.error('fetchStoredGamePreferences', error)
    return {}
  }
}

export async function saveStoredGamePreferences(
  user: User,
  preferences: StoredGamePreferencesById,
): Promise<void> {
  if (!isFirebaseConfigured()) return

  await setDoc(
    preferencesDoc(user),
    {
      gamePreferencesById: normalizeStoredGamePreferencesById(preferences),
      gamePreferencesByIdUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
