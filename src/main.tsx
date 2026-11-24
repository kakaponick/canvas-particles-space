import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import { startSettingsPersistence } from './store/settings_persistence'
import './index.css'

startSettingsPersistence()

// The agent API (window.space): always in development, and on a deployed build with ?agent in the address.
// It is a separate chunk, so visitors without ?agent never download it
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('agent')) {
  void import('./lib/scene_api').then(({ installSceneApi }) => installSceneApi())
}
// In development an agent outside the browser reaches window.space through the dev server; production
// builds drop this branch entirely
if (import.meta.env.DEV) {
  void import('./dev/scene_bridge').then(({ startSceneBridge }) => startSceneBridge())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
