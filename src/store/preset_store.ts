import { createWithEqualityFn } from 'zustand/traditional'
import { useParticleStore } from './particle_store'
import {
  normalizePresetName,
  parseSimulationPresets,
  pickSimulationSettings,
  type SimulationPreset,
  type SimulationSettings
} from '../lib/simulation_presets'

const STORAGE_KEY = 'simulation-presets-v1'

export const DEFAULT_PRESET_ID = 'default'
export const DEFAULT_PRESET_NAME = 'Default'

// The settings the page opens with; captured before anything can change them
const defaultSettings: SimulationSettings = pickSimulationSettings(useParticleStore.getState())

export const DEFAULT_PRESET: Readonly<SimulationPreset> = { id: DEFAULT_PRESET_ID, name: DEFAULT_PRESET_NAME, settings: defaultSettings }

// A black hole as general relativity has it, as far as the scene can show one, where Default is tuned for
// the look. The lens is a point mass: the whole sky is pulled, with one mirrored image inside the Einstein
// ring, no twist (the hole does not rotate) and no light taken away outside the shadow. The Einstein ring
// is as wide as a camera about 20 Schwarzschild radii away sees it. What reaches the edge of the shadow is
// captured, and nothing swirls the particles around the hole
export const SCHWARZSCHILD_PRESET: Readonly<SimulationPreset> = {
  id: 'schwarzschild',
  name: 'Schwarzschild',
  description: 'A real non-rotating black hole: point-mass lens, no twist',
  settings: {
    ...pickSimulationSettings(defaultSettings),
    horizonScale: 1,
    orbitalStrength: 0,
    lensingRadius: 2.5,
    lensingReach: 1,
    lensingFalloff: 2,
    lensingRotation: 0,
    lensingAbsorption: 0,
    lensingCore: 0.1,
    lensingMaxBend: 256
  }
}

// Presets that come with the page: they can be applied, never changed or deleted
export const BUILT_IN_PRESETS: readonly Readonly<SimulationPreset>[] = [DEFAULT_PRESET, SCHWARZSCHILD_PRESET]

export const isBuiltInPreset = (id: string) => BUILT_IN_PRESETS.some(preset => preset.id === id)

function loadPresets (): SimulationPreset[] {
  try {
    return parseSimulationPresets(window.localStorage.getItem(STORAGE_KEY), defaultSettings)
  } catch {
    return []
  }
}

// Returns false when the browser refuses to store them
function storePresets (presets: SimulationPreset[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    return true
  } catch {
    return false
  }
}

let nextId = 0
const createPresetId = () => `preset-${Date.now().toString(36)}-${(nextId++).toString(36)}`

export function isReservedPresetName (name: string) {
  const key = normalizePresetName(name).toLowerCase()
  return BUILT_IN_PRESETS.some(preset => preset.name.toLowerCase() === key)
}

export function findPresetByName (presets: SimulationPreset[], name: string) {
  const key = normalizePresetName(name).toLowerCase()
  return presets.find(preset => preset.name.toLowerCase() === key)
}

interface PresetState {
  presets: SimulationPreset[]
  // The preset the current settings started from
  activeId: string
  // The last change could not be written to the browser's storage
  storageFailed: boolean
  // Saves the current settings under this name, replacing a preset that already has it
  savePreset: (name: string) => void
  // Replaces a preset's settings with the current ones
  updatePreset: (id: string) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
}

export const usePresetStore = createWithEqualityFn<PresetState>((set, get) => {
  const commit = (presets: SimulationPreset[], activeId: string) => {
    set({ presets, activeId, storageFailed: !storePresets(presets) })
  }
  const currentSettings = () => pickSimulationSettings(useParticleStore.getState())

  return {
    presets: typeof window === 'undefined' ? [] : loadPresets(),
    activeId: DEFAULT_PRESET_ID,
    storageFailed: false,

    savePreset: (rawName) => {
      const name = normalizePresetName(rawName)
      if (!name || isReservedPresetName(name)) return
      const { presets } = get()
      const existing = findPresetByName(presets, name)
      if (existing) {
        commit(presets.map(preset => preset.id === existing.id ? { ...preset, name, settings: currentSettings() } : preset), existing.id)
        return
      }
      const preset = { id: createPresetId(), name, settings: currentSettings() }
      commit([...presets, preset], preset.id)
    },

    updatePreset: (id) => {
      const { presets } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.map(preset => preset.id === id ? { ...preset, settings: currentSettings() } : preset), id)
    },

    applyPreset: (id) => {
      const preset = BUILT_IN_PRESETS.find(entry => entry.id === id) ?? get().presets.find(entry => entry.id === id)
      if (!preset) return
      useParticleStore.setState(pickSimulationSettings(preset.settings))
      set({ activeId: preset.id })
    },

    deletePreset: (id) => {
      const { presets, activeId } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.filter(preset => preset.id !== id), activeId === id ? DEFAULT_PRESET_ID : activeId)
    }
  }
})
