import { type FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'
import { type Functions, getFunctions } from 'firebase/functions'

const DEFAULT_FIRESTORE_DATABASE_ID = '(default)'

type FirebaseEnv = {
  VITE_FIREBASE_API_KEY?: string
  VITE_FIREBASE_AUTH_DOMAIN?: string
  VITE_FIREBASE_PROJECT_ID?: string
  VITE_FIREBASE_APP_ID?: string
  VITE_FIREBASE_STORAGE_BUCKET?: string
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string
}

function readFirebaseEnv(): FirebaseEnv {
  return import.meta.env as unknown as FirebaseEnv
}

function requiredEnv(
  env: FirebaseEnv,
  key: keyof FirebaseEnv,
): { ok: true; value: string } | { ok: false } {
  const value = env[key]
  if (!value || !value.trim()) return { ok: false }
  return { ok: true, value: value.trim() }
}

export function firebaseMissingConfigKeys(): string[] {
  const env = readFirebaseEnv()
  const requiredKeys: Array<keyof FirebaseEnv> = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ]
  return requiredKeys.filter((key) => !requiredEnv(env, key).ok) as string[]
}

export function isFirebaseConfigured(): boolean {
  return firebaseMissingConfigKeys().length === 0
}

let firebaseApp: FirebaseApp | undefined
let firebaseAuth: Auth | undefined
let firebaseFirestore: Firestore | undefined
let firebaseFunctions: Functions | undefined

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      `Firebase config missing: ${firebaseMissingConfigKeys().join(', ')}`,
    )
  }

  if (firebaseApp) return firebaseApp
  if (getApps().length > 0) {
    firebaseApp = getApps()[0]!
    return firebaseApp
  }

  const env = readFirebaseEnv()
  const apiKey = requiredEnv(env, 'VITE_FIREBASE_API_KEY')
  const authDomain = requiredEnv(env, 'VITE_FIREBASE_AUTH_DOMAIN')
  const projectId = requiredEnv(env, 'VITE_FIREBASE_PROJECT_ID')
  const appId = requiredEnv(env, 'VITE_FIREBASE_APP_ID')

  firebaseApp = initializeApp({
    apiKey: apiKey.ok ? apiKey.value : '',
    authDomain: authDomain.ok ? authDomain.value : '',
    projectId: projectId.ok ? projectId.value : '',
    appId: appId.ok ? appId.value : '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
  })
  return firebaseApp
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth
  firebaseAuth = getAuth(getFirebaseApp())
  return firebaseAuth
}

export function getFirebaseFirestore(): Firestore {
  if (firebaseFirestore) return firebaseFirestore
  firebaseFirestore = getFirestore(getFirebaseApp(), DEFAULT_FIRESTORE_DATABASE_ID)
  return firebaseFirestore
}

export function getFirebaseFunctions(): Functions {
  if (firebaseFunctions) return firebaseFunctions
  firebaseFunctions = getFunctions(getFirebaseApp())
  return firebaseFunctions
}
