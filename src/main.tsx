import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import { startSettingsPersistence } from './store/settings_persistence'
import './index.css'

startSettingsPersistence()

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
