import type { User } from 'firebase/auth'
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { createSignal } from 'solid-js'
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase'

const [authUser, setAuthUser] = createSignal<User | null>(null)
const [authReady, setAuthReady] = createSignal(false)

if (isFirebaseConfigured()) {
  const auth = getFirebaseAuth()
  void getRedirectResult(auth).catch(() => {
    // ignore; sign-in errors are handled by UI actions
  })
  onAuthStateChanged(auth, (user) => {
    setAuthUser(user)
    setAuthReady(true)
  })
} else {
  setAuthReady(true)
}

export { authReady, authUser }

export async function signInWithEmailPassword(email: string, password: string) {
  const auth = getFirebaseAuth()
  return await signInWithEmailAndPassword(auth, email, password)
}

export async function sendResetEmail(email: string) {
  const auth = getFirebaseAuth()
  return await sendPasswordResetEmail(auth, email)
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    return await signInWithPopup(auth, provider)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.includes('auth/popup-blocked') ||
      message.includes('auth/popup-closed-by-user') ||
      message.includes('auth/cancelled-popup-request')
    ) {
      return await signInWithRedirect(auth, provider)
    }
    throw error
  }
}

export async function signOutUser() {
  const auth = getFirebaseAuth()
  return await signOut(auth)
}
