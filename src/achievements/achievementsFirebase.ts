import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseFirestore, isFirebaseConfigured } from '../firebase'
import type { Achievement } from './types'

type AchievementStore = {
  seenCompletedAchievementIds: Set<string>
}

function normalizeIds(ids: unknown): Set<string> {
  if (!Array.isArray(ids)) return new Set()
  return new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))
}

function achievementsDoc(user: User) {
  return doc(getFirebaseFirestore(), 'userAchievements', user.uid)
}

export async function fetchAchievementStore(user: User): Promise<AchievementStore> {
  if (!isFirebaseConfigured()) {
    return { seenCompletedAchievementIds: new Set() }
  }

  try {
    const snapshot = await getDoc(achievementsDoc(user))
    if (!snapshot.exists()) {
      return { seenCompletedAchievementIds: new Set() }
    }

    const data = snapshot.data() as { seenCompletedAchievementIds?: unknown } | undefined
    return {
      seenCompletedAchievementIds: normalizeIds(data?.seenCompletedAchievementIds),
    }
  } catch (error) {
    console.error('fetchAchievementStore', error)
    return { seenCompletedAchievementIds: new Set() }
  }
}

export async function saveSeenCompletedAchievementIds(
  user: User,
  ids: Iterable<string>,
): Promise<void> {
  if (!isFirebaseConfigured()) return

  await setDoc(
    achievementsDoc(user),
    {
      seenCompletedAchievementIds: [...ids],
      seenCompletedAchievementIdsUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function saveAchievementsSnapshot(
  user: User,
  achievements: Achievement[],
): Promise<void> {
  if (!isFirebaseConfigured()) return

  await setDoc(
    achievementsDoc(user),
    {
      achievementsSnapshot: {
        version: 1,
        savedAt: serverTimestamp(),
        achievements: achievements.map((achievement) => ({
          id: achievement.id,
          status: achievement.status,
          gameId: achievement.gameId,
          trackId: achievement.trackId,
          level: achievement.level,
          remainingPlays: achievement.remainingPlays,
          playsSoFar: achievement.playsSoFar,
        })),
      },
    },
    { merge: true },
  )
}
