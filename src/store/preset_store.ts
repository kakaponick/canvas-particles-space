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
  return normalizePresetName(name).toLowerCase() === DEFAULT_PRESET_NAME.toLowerCase()
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
      const preset = id === DEFAULT_PRESET_ID ? DEFAULT_PRESET : get().presets.find(entry => entry.id === id)
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
