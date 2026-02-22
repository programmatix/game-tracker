import type { User } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getFirebaseFirestore, isFirebaseConfigured } from '../firebase'

export type FeedbackStatus = 'open' | 'resolved'

export type FeedbackItem = {
  id: string
  message: string
  status: FeedbackStatus
  ownerUid: string
  ownerEmail: string
  ownerDisplayName: string
  resolvedByUid: string | null
  resolvedByEmail: string | null
  createdAtMs: number | null
  updatedAtMs: number | null
  resolvedAtMs: number | null
}

type FeedbackDocData = {
  message?: unknown
  status?: unknown
  ownerUid?: unknown
  ownerEmail?: unknown
  ownerDisplayName?: unknown
  resolvedByUid?: unknown
  resolvedByEmail?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  resolvedAt?: unknown
}

function feedbackCollection() {
  return collection(getFirebaseFirestore(), 'feedback')
}

function toMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const maybeTimestamp = value as Timestamp
  if (typeof maybeTimestamp.toMillis === 'function') {
    return maybeTimestamp.toMillis()
  }
  return null
}

function toFeedbackItem(id: string, data: FeedbackDocData): FeedbackItem {
  return {
    id,
    message: typeof data.message === 'string' ? data.message : '',
    status: data.status === 'resolved' ? 'resolved' : 'open',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : '',
    ownerDisplayName: typeof data.ownerDisplayName === 'string' ? data.ownerDisplayName : '',
    resolvedByUid: typeof data.resolvedByUid === 'string' ? data.resolvedByUid : null,
    resolvedByEmail: typeof data.resolvedByEmail === 'string' ? data.resolvedByEmail : null,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
    resolvedAtMs: toMillis(data.resolvedAt),
  }
}

function sortNewestFirst(items: FeedbackItem[]) {
  items.sort((a, b) => {
    const left = a.createdAtMs ?? 0
    const right = b.createdAtMs ?? 0
    return right - left
  })
  return items
}

export function subscribeFeedbackForUser(
  user: User,
  onItems: (items: FeedbackItem[]) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onItems([])
    return () => {}
  }

  const q = query(feedbackCollection(), where('ownerUid', '==', user.uid))
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((entry) =>
      toFeedbackItem(entry.id, entry.data() as FeedbackDocData),
    )
    onItems(sortNewestFirst(items))
  })
}

export function subscribeAllFeedback(onItems: (items: FeedbackItem[]) => void): () => void {
  if (!isFirebaseConfigured()) {
    onItems([])
    return () => {}
  }

  return onSnapshot(feedbackCollection(), (snapshot) => {
    const items = snapshot.docs.map((entry) =>
      toFeedbackItem(entry.id, entry.data() as FeedbackDocData),
    )
    onItems(sortNewestFirst(items))
  })
}

export async function createFeedback(user: User, message: string) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.')

  const trimmedMessage = message.trim()
  if (!trimmedMessage) throw new Error('Feedback is required.')
  if (!user.email) throw new Error('Your account email is missing.')

  const ownerDisplayName = user.displayName?.trim() || user.email

  await addDoc(feedbackCollection(), {
    message: trimmedMessage,
    status: 'open',
    ownerUid: user.uid,
    ownerEmail: user.email,
    ownerDisplayName,
    resolvedByUid: null,
    resolvedByEmail: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  })
}

export async function resolveFeedback(feedbackId: string, adminUser: User) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.')
  if (!adminUser.email) throw new Error('Admin account email is missing.')

  await updateDoc(doc(getFirebaseFirestore(), 'feedback', feedbackId), {
    status: 'resolved',
    resolvedByUid: adminUser.uid,
    resolvedByEmail: adminUser.email,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
