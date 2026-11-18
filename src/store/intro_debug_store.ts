import { createWithEqualityFn } from 'zustand/traditional'

// Pieces of the opening that can be switched off one by one to see what each contributes
export const INTRO_LAYERS = [
  { key: 'star', label: 'STAR' },
  { key: 'flash', label: 'FLASH' },
  { key: 'shockwave', label: 'WAVE' },
  { key: 'reveal', label: 'REVEAL' },
  { key: 'burst', label: 'BURST' },
  { key: 'title', label: 'TITLE' },
  { key: 'hole', label: 'HOLE' },
  { key: 'lens', label: 'LENS' },
  { key: 'ring', label: 'RING' },
  { key: 'gravity', label: 'GRAVITY' },
  { key: 'doppler', label: 'DOPPLER' }
] as const

export type IntroLayer = typeof INTRO_LAYERS[number]['key']

export interface IntroReadout {
  time: number
  duration: number
  phase: string
  starGlow: number
  flash: number
  wave: number
  reveal: number
  speedBoost: number
  holeScale: number
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
  seek: (time: number) => void
  clearSeek: () => void
  restart: () => void
  step: () => void
  setReadout: (readout: IntroReadout) => void
}

const openFromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

const allShown = Object.fromEntries(INTRO_LAYERS.map(layer => [layer.key, false])) as Record<IntroLayer, boolean>

export const useIntroDebugStore = createWithEqualityFn<IntroDebugState>((set) => ({
  open: openFromUrl,
  playing: true,
  timeScale: 1,
  loop: openFromUrl,
  hidden: allShown,
  seekRequest: null,
  restartRequest: 0,
  stepRequest: 0,
  readout: {
    time: 0,
    duration: 0,
    phase: '',
    starGlow: 0,
    flash: 0,
    wave: 0,
    reveal: 0,
    speedBoost: 1,
    holeScale: 0,
    titleAlpha: 0,
    speed: 0,
    particlesDrawn: 0
  },

  setOpen: (open) => set({ open }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  setTimeScale: (timeScale) => set({ timeScale }),
  toggleLoop: () => set((state) => ({ loop: !state.loop })),
  toggleLayer: (layer) => set((state) => ({ hidden: { ...state.hidden, [layer]: !state.hidden[layer] } })),
  seek: (time) => set({ seekRequest: time }),
  clearSeek: () => set({ seekRequest: null }),
  restart: () => set((state) => ({ restartRequest: state.restartRequest + 1 })),
  step: () => set((state) => ({ stepRequest: state.stepRequest + 1, playing: false })),
  setReadout: (readout) => set({ readout })
}))
