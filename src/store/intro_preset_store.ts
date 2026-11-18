// Named setups of the intro: every tuned number of the opening together with the title's words, font
// and case. They are kept in this browser, next to the setup that is being edited.
import { createWithEqualityFn } from 'zustand/traditional'
import { DEFAULT_INTRO_PARAMS, type IntroParamKey, type IntroParams } from '../lib/intro_params'
import { INTRO_LOOKS } from '../lib/intro_presets'
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
  // Ships with the page: it cannot be changed or deleted
  builtIn?: boolean
  // Sets the title's face and case and leaves its words as they are
  keepsText?: boolean
  description?: string
}

export const DEFAULT_INTRO_PRESET: Readonly<IntroPreset> = {
  id: DEFAULT_INTRO_PRESET_ID,
  name: DEFAULT_INTRO_PRESET_NAME,
  params: DEFAULT_INTRO_PARAMS,
  title: DEFAULT_TITLE_TEXT,
  builtIn: true,
  description: 'The intro as it ships, with its own title.'
}

// Default first, then the looks that ship with the page
export const BUILT_IN_INTRO_PRESETS: readonly IntroPreset[] = [
  DEFAULT_INTRO_PRESET,
  ...INTRO_LOOKS.map(look => ({
    id: `look-${look.id}`,
    name: look.name,
    params: look.params,
    title: { text: DEFAULT_TITLE_TEXT.text, font: look.font, uppercase: look.uppercase },
    builtIn: true,
    keepsText: true,
    description: look.description
  }))
]

const builtInNames = new Set(BUILT_IN_INTRO_PRESETS.map(preset => preset.name.toLowerCase()))

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
    if (!name || seen.has(nameKey) || seen.has(entry.id) || builtInNames.has(nameKey)) continue
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
    const known = presets.some(preset => preset.id === stored) || BUILT_IN_INTRO_PRESETS.some(preset => preset.id === stored)
    return known ? stored as string : DEFAULT_INTRO_PRESET_ID
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
  return builtInNames.has(normalizePresetName(name).toLowerCase())
}

export function findIntroPresetByName (presets: IntroPreset[], name: string) {
  const key = normalizePresetName(name).toLowerCase()
  return presets.find(preset => preset.name.toLowerCase() === key)
}

export function sameIntroSetup (params: IntroParams, title: TitleText, preset: IntroPreset) {
  return (Object.keys(DEFAULT_INTRO_PARAMS) as IntroParamKey[]).every(key => params[key] === preset.params[key]) &&
    (preset.keepsText || title.text === preset.title.text) && title.font === preset.title.font && title.uppercase === preset.title.uppercase
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
      const preset = BUILT_IN_INTRO_PRESETS.find(entry => entry.id === id) ?? presets.find(entry => entry.id === id)
      if (!preset) return
      const debug = useIntroDebugStore.getState()
      debug.applySetup(preset.params, preset.keepsText ? { ...preset.title, text: debug.title.text } : preset.title)
      // Choosing a preset shows it: the intro starts over and runs, even from a pause
      debug.restart()
      if (!debug.playing) debug.togglePlaying()
      commit(presets, preset.id)
    },

    deletePreset: (id) => {
      const { presets, activeId } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.filter(preset => preset.id !== id), activeId === id ? DEFAULT_INTRO_PRESET_ID : activeId)
    }
  }
})
