/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import AuthGate from './auth/AuthGate.tsx'

if (import.meta.env.DEV) {
  void import('solid-devtools')
}

const root = document.getElementById('root')

render(
  () => (
    <AuthGate>
      <App />
    </AuthGate>
  ),
  root!,
)
