// Named setups of the intro: every tuned number of the opening together with the title's words, font
// and case. They are kept in this browser, next to the setup that is being edited.
import { createWithEqualityFn } from 'zustand/traditional'
import { DEFAULT_INTRO_PARAMS, type IntroParamKey, type IntroParams } from '../lib/intro_params'
import { normalizePresetName } from '../lib/simulation_presets'
import {
  DEFAULT_TITLE_TEXT,
  readIntroParams,
  readTitleText,
  useIntroDebugStore,
  type TitleText
} from './intro_debug_store'

const STORAGE_KEY = 'intro-presets-v1'
const ACTIVE_STORAGE_KEY = 'intro-preset-active-v1'

export const DEFAULT_INTRO_PRESET_ID = 'default'
export const DEFAULT_INTRO_PRESET_NAME = 'Default'

export interface IntroPreset {
  id: string
  name: string
  params: IntroParams
  title: TitleText
}

export const DEFAULT_INTRO_PRESET: Readonly<IntroPreset> = {
  id: DEFAULT_INTRO_PRESET_ID,
  name: DEFAULT_INTRO_PRESET_NAME,
  params: DEFAULT_INTRO_PARAMS,
  title: DEFAULT_TITLE_TEXT
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// A corrupt entry is skipped and the rest survive; a preset saved before a parameter existed gets
// that parameter's default
function loadPresets (): IntroPreset[] {
  let stored: unknown
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(stored)) return []

  const presets: IntroPreset[] = []
  const seen = new Set<string>()
  for (const entry of stored as unknown[]) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') continue
    const name = normalizePresetName(entry.name)
    const nameKey = name.toLowerCase()
    if (!name || seen.has(nameKey) || seen.has(entry.id) || nameKey === DEFAULT_INTRO_PRESET_NAME.toLowerCase()) continue
    seen.add(nameKey)
    seen.add(entry.id)
    presets.push({
      id: entry.id,
      name,
      params: readIntroParams(isRecord(entry.params) ? entry.params : {}),
      title: readTitleText(isRecord(entry.title) ? entry.title : {})
    })
  }
  return presets
}

function loadActiveId (presets: IntroPreset[]) {
  try {
    const stored = window.localStorage.getItem(ACTIVE_STORAGE_KEY)
    return presets.some(preset => preset.id === stored) ? stored as string : DEFAULT_INTRO_PRESET_ID
  } catch {
    return DEFAULT_INTRO_PRESET_ID
  }
}

// Returns false when the browser refuses to store them
function storePresets (presets: IntroPreset[], activeId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    if (activeId === DEFAULT_INTRO_PRESET_ID) window.localStorage.removeItem(ACTIVE_STORAGE_KEY)
    else window.localStorage.setItem(ACTIVE_STORAGE_KEY, activeId)
    return true
  } catch {
    return false
  }
}

let nextId = 0
const createPresetId = () => `intro-${Date.now().toString(36)}-${(nextId++).toString(36)}`

export function isReservedIntroPresetName (name: string) {
  return normalizePresetName(name).toLowerCase() === DEFAULT_INTRO_PRESET_NAME.toLowerCase()
}

export function findIntroPresetByName (presets: IntroPreset[], name: string) {
  const key = normalizePresetName(name).toLowerCase()
  return presets.find(preset => preset.name.toLowerCase() === key)
}

export function sameIntroSetup (params: IntroParams, title: TitleText, preset: IntroPreset) {
  return (Object.keys(DEFAULT_INTRO_PARAMS) as IntroParamKey[]).every(key => params[key] === preset.params[key]) &&
    title.text === preset.title.text && title.font === preset.title.font && title.uppercase === preset.title.uppercase
}

interface IntroPresetState {
  presets: IntroPreset[]
  // The preset the current setup started from
  activeId: string
  // The last change could not be written to the browser's storage
  storageFailed: boolean
  // Saves the current setup under this name, replacing a preset that already has it
  savePreset: (name: string) => void
  // Replaces a preset's setup with the current one
  updatePreset: (id: string) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
}

const initialPresets = typeof window === 'undefined' ? [] : loadPresets()

export const useIntroPresetStore = createWithEqualityFn<IntroPresetState>((set, get) => {
  const commit = (presets: IntroPreset[], activeId: string) => {
    set({ presets, activeId, storageFailed: !storePresets(presets, activeId) })
  }
  const currentSetup = () => {
    const { params, title } = useIntroDebugStore.getState()
    return { params: { ...params }, title: { ...title } }
  }

  return {
    presets: initialPresets,
    activeId: typeof window === 'undefined' ? DEFAULT_INTRO_PRESET_ID : loadActiveId(initialPresets),
    storageFailed: false,

    savePreset: (rawName) => {
      const name = normalizePresetName(rawName)
      if (!name || isReservedIntroPresetName(name)) return
      const { presets } = get()
      const existing = findIntroPresetByName(presets, name)
      if (existing) {
        commit(presets.map(preset => preset.id === existing.id ? { ...preset, name, ...currentSetup() } : preset), existing.id)
        return
      }
      const preset = { id: createPresetId(), name, ...currentSetup() }
      commit([...presets, preset], preset.id)
    },

    updatePreset: (id) => {
      const { presets } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.map(preset => preset.id === id ? { ...preset, ...currentSetup() } : preset), id)
    },

    applyPreset: (id) => {
      const { presets } = get()
      const preset = id === DEFAULT_INTRO_PRESET_ID ? DEFAULT_INTRO_PRESET : presets.find(entry => entry.id === id)
      if (!preset) return
      useIntroDebugStore.getState().applySetup(preset.params, preset.title)
      commit(presets, preset.id)
    },

    deletePreset: (id) => {
      const { presets, activeId } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.filter(preset => preset.id !== id), activeId === id ? DEFAULT_INTRO_PRESET_ID : activeId)
    }
  }
})
