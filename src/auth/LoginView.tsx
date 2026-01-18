import { Show, createMemo, createSignal } from 'solid-js'
import { firebaseMissingConfigKeys, isFirebaseConfigured } from '../firebase'
import { sendResetEmail, signInWithEmailPassword, signInWithGoogle } from './auth'

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('auth/invalid-credential')) return 'Invalid email or password.'
  if (lower.includes('auth/wrong-password')) return 'Invalid email or password.'
  if (lower.includes('auth/user-not-found')) return 'No account found for that email.'
  if (lower.includes('auth/too-many-requests')) return 'Too many attempts. Try again later.'
  if (lower.includes('auth/popup-closed-by-user')) return 'Sign-in canceled.'
  if (lower.includes('auth/popup-blocked')) return 'Popup blocked. Try again.'
  return message
}

export default function LoginView() {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [resetStatus, setResetStatus] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const missingKeys = createMemo(() => firebaseMissingConfigKeys())

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError(null)
    setResetStatus(null)

    if (!isFirebaseConfigured()) return

    const trimmedEmail = email().trim()
    if (!trimmedEmail) {
      setError('Email is required.')
      return
    }
    if (!password()) {
      setError('Password is required.')
      return
    }

    try {
      setBusy(true)
      await signInWithEmailPassword(trimmedEmail, password())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(friendlyAuthError(message))
    } finally {
      setBusy(false)
    }
  }

  async function onResetPassword() {
    setError(null)
    setResetStatus(null)

    if (!isFirebaseConfigured()) return

    const trimmedEmail = email().trim()
    if (!trimmedEmail) {
      setError('Enter your email above, then click “Reset password”.')
      return
    }

    try {
      setBusy(true)
      await sendResetEmail(trimmedEmail)
      setResetStatus('Password reset email sent (if an account exists).')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(friendlyAuthError(message))
    } finally {
      setBusy(false)
    }
  }

  async function onGoogleSignIn() {
    setError(null)
    setResetStatus(null)

    if (!isFirebaseConfigured()) return

    try {
      setBusy(true)
      await signInWithGoogle()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(friendlyAuthError(message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="authPage">
      <div class="panel authPanel">
        <div class="panelHeader">
          <h2>Sign in</h2>
        </div>

        <Show
          when={isFirebaseConfigured()}
          fallback={
            <div class="authBody">
              <p class="muted">
                Firebase isn’t configured. Add these to your local `.env`:
              </p>
              <ul class="mono authList">
                <Show when={missingKeys().length > 0} fallback={<li>(none)</li>}>
                  {missingKeys().map((key) => (
                    <li>{key}=</li>
                  ))}
                </Show>
              </ul>
            </div>
          }
        >
          <form class="authBody" onSubmit={onSubmit}>
            <label class="authField">
              <span class="muted">Email</span>
              <input
                class="tokenInput mono"
                type="email"
                autocomplete="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                disabled={busy()}
              />
            </label>

            <label class="authField">
              <span class="muted">Password</span>
              <input
                class="tokenInput mono"
                type="password"
                autocomplete="current-password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={busy()}
              />
            </label>

            <Show when={error()}>
              <div class="authError">{error()}</div>
            </Show>
            <Show when={resetStatus()}>
              <div class="authSuccess">{resetStatus()}</div>
            </Show>

            <div class="authActions">
              <button
                class="button"
                type="button"
                onClick={onGoogleSignIn}
                disabled={busy()}
              >
                Continue with Google
              </button>
              <button class="button" type="submit" disabled={busy()}>
                Sign in
              </button>
              <button
                class="linkButton"
                type="button"
                onClick={onResetPassword}
                disabled={busy()}
              >
                Reset password
              </button>
            </div>
          </form>
        </Show>
      </div>
    </div>
  )
}
