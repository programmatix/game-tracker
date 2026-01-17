/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  void import('solid-devtools')
}

const root = document.getElementById('root')

render(() => <App />, root!)
