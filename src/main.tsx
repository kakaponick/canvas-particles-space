import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import { startSettingsPersistence } from './store/settings_persistence'
import { useIntroDebugStore } from './store/intro_debug_store'
import './index.css'

startSettingsPersistence()

// In development, and on a page that plays a film inside its scene (?live=), the opening is over before the
// first frame: the operator's screen (scripts/screen.mjs) reloads the page on every save, and the opening
// would play each time. ?intro in the address brings it back, and the intro debugger's restart plays it
const address = new URLSearchParams(window.location.search)
if ((import.meta.env.DEV || address.has('live')) && !address.has('intro')) useIntroDebugStore.getState().seek(Number.MAX_VALUE)

// The agent API (window.space): always in development, and on a deployed build with ?agent in the address.
// It is a separate chunk, so visitors without ?agent never download it. Agents reach it through a browser
// tool such as the chrome-devtools MCP server in .mcp.json
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('agent')) {
  void import('./lib/scene_api').then(({ installSceneApi }) => installSceneApi())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
