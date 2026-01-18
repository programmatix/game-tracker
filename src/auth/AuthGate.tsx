import { type ParentProps, Show } from 'solid-js'
import { authReady, authUser } from './auth'
import LoginView from './LoginView'
import './auth.css'

export default function AuthGate(props: ParentProps) {
  return (
    <Show
      when={authReady()}
      fallback={
        <div class="authPage">
          <div class="panel authPanel">
            <div class="panelHeader">
              <h2>Loading…</h2>
            </div>
          </div>
        </div>
      }
    >
      <Show when={authUser()} fallback={<LoginView />}>
        {props.children}
      </Show>
    </Show>
  )
}

