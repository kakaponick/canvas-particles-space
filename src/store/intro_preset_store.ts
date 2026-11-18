// Named setups of the intro: every tuned number of the opening, the layers it hides and the title's
// words, font and case; on request the scene settings too. They are kept in this browser, next to
// the setup that is being edited.
import { createWithEqualityFn } from 'zustand/traditional'
import { DEFAULT_INTRO_PARAMS, type IntroParamKey, type IntroParams } from '../lib/intro_params'
import { INTRO_LOOKS } from '../lib/intro_presets'
import { INTRO_LAYERS, type IntroLayer } from '../lib/intro_tracks'
import {
  normalizePresetName,
  pickSimulationSettings,
  readSimulationSettings,
  type SimulationSettings
} from '../lib/simulation_presets'
import {
  DEFAULT_TITLE_TEXT,
  readIntroParams,
  readTitleText,
  useIntroDebugStore,
  type TitleText
} from './intro_debug_store'
import { useParticleStore } from './particle_store'
import { DEFAULT_PRESET } from './preset_store'

const STORAGE_KEY = 'intro-presets-v1'
const ACTIVE_STORAGE_KEY = 'intro-preset-active-v1'
const SCENE_STORAGE_KEY = 'intro-preset-scene-v1'

export const DEFAULT_INTRO_PRESET_ID = 'default'
export const DEFAULT_INTRO_PRESET_NAME = 'Default'

export interface IntroPreset {
  id: string
  name: string
  params: IntroParams
  title: TitleText
  // Layers of the intro this setup leaves out
  hidden: IntroLayer[]
  // The scene settings (particles, colours, black hole) saved with it, when it was saved with them
  scene?: SimulationSettings
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
  hidden: [],
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
    hidden: [...look.hidden],
    builtIn: true,
    keepsText: true,
    description: look.description
  }))
]

const builtInNames = new Set(BUILT_IN_INTRO_PRESETS.map(preset => preset.name.toLowerCase()))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isLayer = (value: unknown): value is IntroLayer => (INTRO_LAYERS as readonly unknown[]).includes(value)

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
    const preset: IntroPreset = {
      id: entry.id,
      name,
      params: readIntroParams(isRecord(entry.params) ? entry.params : {}),
      title: readTitleText(isRecord(entry.title) ? entry.title : {}),
      hidden: Array.isArray(entry.hidden) ? (entry.hidden as unknown[]).filter(isLayer) : []
    }
    if (isRecord(entry.scene)) preset.scene = readSimulationSettings(entry.scene, DEFAULT_PRESET.settings)
    presets.push(preset)
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

function loadWithScene () {
  try {
    return window.localStorage.getItem(SCENE_STORAGE_KEY) === '1'
  } catch {
    return false
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

// The scene is left out: it is applied once and then belongs to the settings panel
export function sameIntroSetup (params: IntroParams, title: TitleText, hidden: Record<IntroLayer, boolean>, preset: IntroPreset) {
  return (Object.keys(DEFAULT_INTRO_PARAMS) as IntroParamKey[]).every(key => params[key] === preset.params[key]) &&
    (preset.keepsText || title.text === preset.title.text) && title.font === preset.title.font && title.uppercase === preset.title.uppercase &&
    INTRO_LAYERS.every(layer => hidden[layer] === preset.hidden.includes(layer))
}

interface IntroPresetState {
  presets: IntroPreset[]
  // The preset the current setup started from
  activeId: string
  // Presets save the scene settings with the intro, and a preset that has them applies them
  withScene: boolean
  // The last change could not be written to the browser's storage
  storageFailed: boolean
  setWithScene: (withScene: boolean) => void
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
  // With the scene switched off a preset keeps the scene it already has
  const currentSetup = (previous?: IntroPreset) => {
    const { params, title, hidden } = useIntroDebugStore.getState()
    const scene = get().withScene ? pickSimulationSettings(useParticleStore.getState()) : previous?.scene
    return {
      params: { ...params },
      title: { ...title },
      hidden: INTRO_LAYERS.filter(layer => hidden[layer]),
      ...(scene ? { scene } : {})
    }
  }

  return {
    presets: initialPresets,
    activeId: typeof window === 'undefined' ? DEFAULT_INTRO_PRESET_ID : loadActiveId(initialPresets),
    withScene: typeof window === 'undefined' ? false : loadWithScene(),
    storageFailed: false,

    setWithScene: (withScene) => {
      set({ withScene })
      try {
        if (withScene) window.localStorage.setItem(SCENE_STORAGE_KEY, '1')
        else window.localStorage.removeItem(SCENE_STORAGE_KEY)
      } catch {
        // Storage blocked: the choice holds for this session
      }
    },

    savePreset: (rawName) => {
      const name = normalizePresetName(rawName)
      if (!name || isReservedIntroPresetName(name)) return
      const { presets } = get()
      const existing = findIntroPresetByName(presets, name)
      if (existing) {
        commit(presets.map(preset => preset.id === existing.id ? { id: preset.id, name, ...currentSetup(preset) } : preset), existing.id)
        return
      }
      const preset: IntroPreset = { id: createPresetId(), name, ...currentSetup() }
      commit([...presets, preset], preset.id)
    },

    updatePreset: (id) => {
      const { presets } = get()
      if (!presets.some(preset => preset.id === id)) return
      commit(presets.map(preset => preset.id === id ? { id: preset.id, name: preset.name, ...currentSetup(preset) } : preset), id)
    },

    applyPreset: (id) => {
      const { presets, withScene } = get()
      const preset = BUILT_IN_INTRO_PRESETS.find(entry => entry.id === id) ?? presets.find(entry => entry.id === id)
      if (!preset) return
      const debug = useIntroDebugStore.getState()
      debug.applySetup(preset.params, preset.keepsText ? { ...preset.title, text: debug.title.text } : preset.title, preset.hidden)
      if (withScene && preset.scene) useParticleStore.setState(pickSimulationSettings(preset.scene))
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
