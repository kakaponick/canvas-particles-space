import { createWithEqualityFn } from 'zustand/traditional'
import { DEFAULT_INTRO_PARAMS, type IntroParamKey, type IntroParams } from '../lib/intro_params'
import { INTRO_LAYERS, type IntroLayer } from '../lib/intro_tracks'
import { TITLE_FONTS, type TitleFontKey } from '../lib/title_sprite'

export type { IntroLayer }

// The words of the intro title and how they are set; numbers such as weight and size are params
export interface TitleText {
  // Lines are separated by \n
  text: string
  font: TitleFontKey
  uppercase: boolean
}

export const DEFAULT_TITLE_TEXT: Readonly<TitleText> = {
  text: 'Experience\nthe speed of light',
  font: 'unbounded',
  uppercase: true
}

export const TITLE_TEXT_MAX_LENGTH = 120

// Fields of the title that differ from the default
export function getTitleChanges (title: TitleText): Partial<TitleText> {
  return Object.fromEntries(
    (Object.keys(DEFAULT_TITLE_TEXT) as (keyof TitleText)[])
      .filter(key => title[key] !== DEFAULT_TITLE_TEXT[key])
      .map(key => [key, title[key]])
  )
}

export interface IntroReadout {
  time: number
  duration: number
  phase: string
  sourcePower: number
  lightFront: number
  matterFront: number
  remnantRedshift: number
  holeScale: number
  ringdown: number
  titleAlpha: number
  speed: number
  particlesDrawn: number
}

interface IntroDebugState {
  open: boolean
  playing: boolean
  // Playback rate of the whole scene; 0 freezes it
  timeScale: number
  loop: boolean
  hidden: Record<IntroLayer, boolean>
  // Tuned numbers of the opening; applied whether or not the panel is open, kept across reloads
  params: IntroParams
  title: TitleText
  // Commands for the animation loop, consumed on its next frame
  seekRequest: number | null
  restartRequest: number
  stepRequest: number
  readout: IntroReadout

  setOpen: (open: boolean) => void
  togglePlaying: () => void
  setPlaying: (playing: boolean) => void
  setTimeScale: (scale: number) => void
  toggleLoop: () => void
  toggleLayer: (layer: IntroLayer) => void
  // Hides every other layer; on the only layer left, shows them all again
  soloLayer: (layer: IntroLayer) => void
  showAllLayers: () => void
  setParam: (key: IntroParamKey, value: number) => void
  resetParams: (keys?: IntroParamKey[]) => void
  setTitle: (patch: Partial<TitleText>) => void
  resetTitle: () => void
  // Replaces every parameter, the title and the hidden layers at once, as a preset does
  applySetup: (params: IntroParams, title: TitleText, hiddenLayers: readonly IntroLayer[]) => void
  seek: (time: number) => void
  clearSeek: () => void
  restart: () => void
  step: () => void
  setReadout: (readout: IntroReadout) => void
}

const openFromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

const PARAMS_STORAGE_KEY = 'intro-debug-params-v1'
const TITLE_STORAGE_KEY = 'intro-debug-title-v1'

// A stored title survives only field by field, with the right types, so old saves never break it
export function readTitleText (stored: Record<string, unknown>): TitleText {
  const title = { ...DEFAULT_TITLE_TEXT }
  if (typeof stored.text === 'string') title.text = stored.text.slice(0, TITLE_TEXT_MAX_LENGTH)
  if (typeof stored.font === 'string' && stored.font in TITLE_FONTS) title.font = stored.font as TitleFontKey
  if (typeof stored.uppercase === 'boolean') title.uppercase = stored.uppercase
  return title
}

function readStored (key: string): Record<string, unknown> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? '{}') as unknown
    return typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored as Record<string, unknown> : {}
  } catch {
    // Storage blocked or corrupt: fall back to the defaults
    return {}
  }
}

function loadTitle (): TitleText {
  return readTitleText(readStored(TITLE_STORAGE_KEY))
}

function saveTitle (title: TitleText) {
  try {
    const changed = getTitleChanges(title)
    if (Object.keys(changed).length === 0) window.localStorage.removeItem(TITLE_STORAGE_KEY)
    else window.localStorage.setItem(TITLE_STORAGE_KEY, JSON.stringify(changed))
  } catch {
    // Storage blocked: the title holds for this session
  }
}

// Only keys that still exist and hold numbers survive a stored value, so old saves never break the intro
export function readIntroParams (stored: Record<string, unknown>): IntroParams {
  const params = { ...DEFAULT_INTRO_PARAMS }
  for (const key of Object.keys(params) as IntroParamKey[]) {
    const value = stored[key]
    if (typeof value === 'number' && Number.isFinite(value)) params[key] = value
  }
  return params
}

function loadParams (): IntroParams {
  return readIntroParams(readStored(PARAMS_STORAGE_KEY))
}

// Stores only the values that differ from the defaults
function saveParams (params: IntroParams) {
  try {
    const changed = Object.fromEntries(
      (Object.keys(params) as IntroParamKey[])
        .filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key])
        .map(key => [key, params[key]])
    )
    if (Object.keys(changed).length === 0) window.localStorage.removeItem(PARAMS_STORAGE_KEY)
    else window.localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(changed))
  } catch {
    // Storage blocked: tuning still works for this session
  }
}

const allShown = Object.fromEntries(INTRO_LAYERS.map(layer => [layer, false])) as Record<IntroLayer, boolean>

// How the debugger was left: open or closed, looping and its speed, and the layers the intro hides
const SESSION_STORAGE_KEY = 'intro-debug-session-v1'
const MIN_TIME_SCALE = 0.05
const MAX_TIME_SCALE = 2

interface Session {
  open: boolean
  loop: boolean
  timeScale: number
  hidden: Record<IntroLayer, boolean>
}

function loadSession (): Session {
  const stored = typeof window === 'undefined' ? {} : readStored(SESSION_STORAGE_KEY)
  const storedHidden = typeof stored.hidden === 'object' && stored.hidden !== null ? stored.hidden as Record<string, unknown> : {}
  const timeScale = typeof stored.timeScale === 'number' && Number.isFinite(stored.timeScale) ? stored.timeScale : 1
  return {
    // The address always opens it; otherwise it comes back the way it was left
    open: openFromUrl || stored.open === true,
    loop: typeof stored.loop === 'boolean' ? stored.loop : openFromUrl,
    timeScale: Math.min(Math.max(timeScale, MIN_TIME_SCALE), MAX_TIME_SCALE),
    hidden: Object.fromEntries(INTRO_LAYERS.map(layer => [layer, storedHidden[layer] === true])) as Record<IntroLayer, boolean>
  }
}

function saveSession (session: Session) {
  try {
    const { open, loop, timeScale, hidden } = session
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ open, loop, timeScale, hidden }))
  } catch {
    // Storage blocked: the debugger keeps its state for this session
  }
}

const session = loadSession()

export const useIntroDebugStore = createWithEqualityFn<IntroDebugState>((set, get) => ({
  open: session.open,
  playing: true,
  timeScale: session.timeScale,
  loop: session.loop,
  hidden: session.hidden,
  params: typeof window === 'undefined' ? { ...DEFAULT_INTRO_PARAMS } : loadParams(),
  title: typeof window === 'undefined' ? { ...DEFAULT_TITLE_TEXT } : loadTitle(),
  seekRequest: null,
  restartRequest: 0,
  stepRequest: 0,
  readout: {
    time: 0,
    duration: 0,
    phase: '',
    sourcePower: 0,
    lightFront: 0,
    matterFront: 0,
    remnantRedshift: 0,
    holeScale: 0,
    ringdown: 0,
    titleAlpha: 0,
    speed: 0,
    particlesDrawn: 0
  },

  setOpen: (open) => {
    set({ open })
    saveSession(get())
  },
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (playing) => {
    if (get().playing !== playing) set({ playing })
  },
  setTimeScale: (timeScale) => {
    set({ timeScale })
    saveSession(get())
  },
  toggleLoop: () => {
    set((state) => ({ loop: !state.loop }))
    saveSession(get())
  },
  toggleLayer: (layer) => {
    set((state) => ({ hidden: { ...state.hidden, [layer]: !state.hidden[layer] } }))
    saveSession(get())
  },
  soloLayer: (layer) => {
    set((state) => {
      const alone = !state.hidden[layer] && INTRO_LAYERS.every(other => other === layer || state.hidden[other])
      if (alone) return { hidden: allShown }
      return { hidden: Object.fromEntries(INTRO_LAYERS.map(other => [other, other !== layer])) as Record<IntroLayer, boolean> }
    })
    saveSession(get())
  },
  showAllLayers: () => {
    set({ hidden: allShown })
    saveSession(get())
  },
  setParam: (key, value) => set((state) => {
    const params = { ...state.params, [key]: value }
    saveParams(params)
    return { params }
  }),
  resetParams: (keys) => set((state) => {
    const params = { ...state.params }
    for (const key of keys ?? (Object.keys(params) as IntroParamKey[])) params[key] = DEFAULT_INTRO_PARAMS[key]
    saveParams(params)
    return { params }
  }),
  // The readout follows at once, so a seek straight after another starts from the new time
  setTitle: (patch) => set((state) => {
    const title = { ...state.title, ...patch }
    title.text = title.text.slice(0, TITLE_TEXT_MAX_LENGTH)
    saveTitle(title)
    return { title }
  }),
  resetTitle: () => set(() => {
    saveTitle(DEFAULT_TITLE_TEXT)
    return { title: { ...DEFAULT_TITLE_TEXT } }
  }),
  applySetup: (params, title, hiddenLayers) => {
    const hidden = Object.fromEntries(INTRO_LAYERS.map(layer => [layer, hiddenLayers.includes(layer)])) as Record<IntroLayer, boolean>
    const next = { params: { ...params }, title: { ...title }, hidden }
    saveParams(next.params)
    saveTitle(next.title)
    set(next)
    saveSession(get())
  },
  seek: (time) => set((state) => {
    const clamped = Math.min(Math.max(time, 0), state.readout.duration || Infinity)
    return { seekRequest: clamped, readout: { ...state.readout, time: clamped } }
  }),
  clearSeek: () => set({ seekRequest: null }),
  restart: () => set((state) => ({ restartRequest: state.restartRequest + 1 })),
  step: () => set((state) => ({ stepRequest: state.stepRequest + 1, playing: false })),
  setReadout: (readout) => set({ readout })
}))
