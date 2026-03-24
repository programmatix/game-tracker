/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import AuthGate from './auth/AuthGate.tsx'
import { loadPurchaseSpreadsheet } from './purchaseSpreadsheet'

if (import.meta.env.DEV) {
  void import('solid-devtools')
}

void loadPurchaseSpreadsheet().catch((error) => {
  console.error('Failed to load purchase spreadsheet.', error)
})

const root = document.getElementById('root')

render(
  () => (
    <AuthGate>
      <App />
    </AuthGate>
  ),
  root!,
)
