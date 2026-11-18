import { createWithEqualityFn } from 'zustand/traditional'
import { DEFAULT_INTRO_PARAMS, type IntroParamKey, type IntroParams } from '../lib/intro_params'
import { INTRO_LAYERS, type IntroLayer } from '../lib/intro_tracks'

export type { IntroLayer }

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
  // Commands for the animation loop, consumed on its next frame
  seekRequest: number | null
  restartRequest: number
  stepRequest: number
  readout: IntroReadout

  setOpen: (open: boolean) => void
  togglePlaying: () => void
  setTimeScale: (scale: number) => void
  toggleLoop: () => void
  toggleLayer: (layer: IntroLayer) => void
  setParam: (key: IntroParamKey, value: number) => void
  resetParams: (keys?: IntroParamKey[]) => void
  seek: (time: number) => void
  clearSeek: () => void
  restart: () => void
  step: () => void
  setReadout: (readout: IntroReadout) => void
}

const openFromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

const PARAMS_STORAGE_KEY = 'intro-debug-params-v1'

// Only keys that still exist and hold numbers survive a stored value, so old saves never break the intro
function loadParams (): IntroParams {
  const params = { ...DEFAULT_INTRO_PARAMS }
  try {
    const stored = JSON.parse(window.localStorage.getItem(PARAMS_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    for (const key of Object.keys(params) as IntroParamKey[]) {
      const value = stored[key]
      if (typeof value === 'number' && Number.isFinite(value)) params[key] = value
    }
  } catch {
    // Storage blocked or corrupt: fall back to the defaults
  }
  return params
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

export const NOTHING_HIDDEN: Readonly<Record<IntroLayer, boolean>> = allShown

export const useIntroDebugStore = createWithEqualityFn<IntroDebugState>((set) => ({
  open: openFromUrl,
  playing: true,
  timeScale: 1,
  loop: openFromUrl,
  hidden: allShown,
  params: typeof window === 'undefined' ? { ...DEFAULT_INTRO_PARAMS } : loadParams(),
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

  setOpen: (open) => set({ open }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  setTimeScale: (timeScale) => set({ timeScale }),
  toggleLoop: () => set((state) => ({ loop: !state.loop })),
  toggleLayer: (layer) => set((state) => ({ hidden: { ...state.hidden, [layer]: !state.hidden[layer] } })),
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
  seek: (time) => set({ seekRequest: time }),
  clearSeek: () => set({ seekRequest: null }),
  restart: () => set((state) => ({ restartRequest: state.restartRequest + 1 })),
  step: () => set((state) => ({ stepRequest: state.stepRequest + 1, playing: false })),
  setReadout: (readout) => set({ readout })
}))
