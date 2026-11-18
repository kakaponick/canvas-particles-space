// Keeps the current settings in this browser across reloads. Only what differs from the defaults is
// stored, so a setting the visitor never touched keeps following the defaults of the page.
import { useParticleStore, type ParticleState } from './particle_store'
import { DEFAULT_PRESET, DEFAULT_PRESET_ID, usePresetStore } from './preset_store'
import {
  SIMULATION_SETTING_KEYS,
  changedSimulationSettings,
  readSimulationSettings
} from '../lib/simulation_presets'

const STORAGE_KEY = 'simulation-settings-v1'
// A slider drag or a scroll writes once, after it settles
const SAVE_DELAY_MS = 250
// The write waits for an idle moment between frames, but no longer than this
const SAVE_IDLE_TIMEOUT_MS = 1000

interface StoredSettings {
  settings?: Record<string, unknown>
  frameRateCap?: unknown
  adaptiveParticles?: unknown
  activePresetId?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Captured before the stored values are applied
const { frameRateCap: defaultFrameRateCap, adaptiveParticles: defaultAdaptiveParticles } = useParticleStore.getState()

function readStoredSettings (): StoredSettings | null {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isRecord(stored) ? stored : null
  } catch {
    return null
  }
}

function restoreSettings () {
  const stored = readStoredSettings()
  if (!stored) return

  const { frameRateCap, adaptiveParticles, activePresetId } = stored
  useParticleStore.setState({
    ...readSimulationSettings(isRecord(stored.settings) ? stored.settings : {}, DEFAULT_PRESET.settings),
    frameRateCap: typeof frameRateCap === 'number' && Number.isFinite(frameRateCap) && frameRateCap >= 0 ? frameRateCap : defaultFrameRateCap,
    adaptiveParticles: typeof adaptiveParticles === 'boolean' ? adaptiveParticles : defaultAdaptiveParticles
  })
  if (usePresetStore.getState().presets.some(preset => preset.id === activePresetId)) {
    usePresetStore.setState({ activeId: activePresetId as string })
  }
}

function saveSettings () {
  const state = useParticleStore.getState()
  const { activeId } = usePresetStore.getState()
  const settings = changedSimulationSettings(state, DEFAULT_PRESET.settings)

  const stored: StoredSettings = {}
  if (Object.keys(settings).length > 0) stored.settings = settings
  if (state.frameRateCap !== defaultFrameRateCap) stored.frameRateCap = state.frameRateCap
  if (state.adaptiveParticles !== defaultAdaptiveParticles) stored.adaptiveParticles = state.adaptiveParticles
  if (activeId !== DEFAULT_PRESET_ID) stored.activePresetId = activeId

  try {
    if (Object.keys(stored).length === 0) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage blocked: the settings still apply until the page reloads
  }
}

// Runs on every store write, the frame rate readout included, so it only compares values
function settingsChanged (state: ParticleState, previous: ParticleState) {
  if (state.frameRateCap !== previous.frameRateCap || state.adaptiveParticles !== previous.adaptiveParticles) return true
  for (const key of SIMULATION_SETTING_KEYS) {
    if (state[key] !== previous[key]) return true
  }
  return false
}

// Applies the stored settings and keeps them up to date; call before the first render
export function startSettingsPersistence () {
  restoreSettings()

  let saveTimer = 0
  let unsaved = false
  const saveIfNeeded = () => {
    if (!unsaved) return
    unsaved = false
    saveSettings()
  }
  const scheduleSave = () => {
    unsaved = true
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      // Safari has no idle callback
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(saveIfNeeded, { timeout: SAVE_IDLE_TIMEOUT_MS })
      } else {
        saveIfNeeded()
      }
    }, SAVE_DELAY_MS)
  }
  // A change made right before leaving the page must not wait for the delay
  const saveNow = () => {
    window.clearTimeout(saveTimer)
    saveIfNeeded()
  }

  useParticleStore.subscribe((state, previous) => {
    if (settingsChanged(state, previous)) scheduleSave()
  })
  usePresetStore.subscribe((state, previous) => {
    if (state.activeId !== previous.activeId) scheduleSave()
  })
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow()
  })
}
