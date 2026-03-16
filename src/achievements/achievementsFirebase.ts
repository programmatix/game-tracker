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
    console.log('fetchAchievementStore', 'firebase not configured')
    return { seenCompletedAchievementIds: new Set() }
  }

  try {
    const achievementStoreDoc = achievementsDoc(user)
    console.log('fetchAchievementStore:start', achievementStoreDoc.path, user.uid)
    const snapshot = await getDoc(achievementStoreDoc)
    if (!snapshot.exists()) {
      console.log('fetchAchievementStore:no snapshot', achievementStoreDoc.path, user.uid)
      return { seenCompletedAchievementIds: new Set() }
    }

    const data = snapshot.data() as { seenCompletedAchievementIds?: unknown } | undefined
    const normalizedIds = normalizeIds(data?.seenCompletedAchievementIds)
    console.log(
      'fetchAchievementStore:success',
      achievementStoreDoc.path,
      user.uid,
      'seenCompletedAchievementIds',
      normalizedIds.size,
      [...normalizedIds],
      'raw',
      data,
    )
    return {
      seenCompletedAchievementIds: normalizedIds,
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

  const normalizedIds = [...new Set(ids)]
  const achievementStoreDoc = achievementsDoc(user)
  console.log(
    'saveSeenCompletedAchievementIds:start',
    achievementStoreDoc.path,
    user.uid,
    normalizedIds.length,
    normalizedIds,
  )
  await setDoc(
    achievementStoreDoc,
    {
      seenCompletedAchievementIds: normalizedIds,
      seenCompletedAchievementIdsUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  console.log(
    'saveSeenCompletedAchievementIds:success',
    achievementStoreDoc.path,
    user.uid,
    normalizedIds.length,
  )
}

export async function saveAchievementsSnapshot(
  user: User,
  achievements: Achievement[],
): Promise<void> {
  if (!isFirebaseConfigured()) return

  const achievementStoreDoc = achievementsDoc(user)
  console.log(
    'saveAchievementsSnapshot:start',
    achievementStoreDoc.path,
    user.uid,
    achievements.length,
  )
  await setDoc(
    achievementStoreDoc,
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
  console.log(
    'saveAchievementsSnapshot:success',
    achievementStoreDoc.path,
    user.uid,
    achievements.length,
  )
}
