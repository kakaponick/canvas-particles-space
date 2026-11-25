import { create } from 'zustand'
import { DEFAULT_PALETTE, DEFAULT_RATE, DEFAULT_TARGET, FRACTAL_PALETTES, FRACTAL_TARGETS } from '../lib/fractal_catalog'

// The page's Mandelbrot mode: whether it is on, what it falls into and how, and what the live view and a
// video being saved report. The choices outlast a reload; the rest lives with the page
const STORAGE_KEY = 'mandelbrot-v1'

export interface FractalSaving {
  frame: number
  frames: number
}

interface FractalState {
  open: boolean
  target: string
  palette: string
  // Powers of ten a second the camera falls by
  rate: number
  playing: boolean
  // Powers of ten reached: written by the live view a few times a second, and only while it changes
  depth: number
  // Changes when the fall should start again from the top
  restarts: number
  // A video being saved: the frames done and to do; null while none is
  saving: FractalSaving | null
  setOpen: (open: boolean) => void
  setTarget: (target: string) => void
  setPalette: (palette: string) => void
  setRate: (rate: number) => void
  setPlaying: (playing: boolean) => void
  restart: () => void
  setDepth: (depth: number) => void
  setSaving: (saving: FractalSaving | null) => void
}

function readChoices () {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return {
      target: typeof stored.target === 'string' && stored.target in FRACTAL_TARGETS ? stored.target : DEFAULT_TARGET,
      palette: typeof stored.palette === 'string' && stored.palette in FRACTAL_PALETTES ? stored.palette : DEFAULT_PALETTE,
      rate: typeof stored.rate === 'number' && stored.rate >= 0.1 && stored.rate <= 3 ? stored.rate : DEFAULT_RATE
    }
  } catch {
    return { target: DEFAULT_TARGET, palette: DEFAULT_PALETTE, rate: DEFAULT_RATE }
  }
}

function remember (state: Pick<FractalState, 'target' | 'palette' | 'rate'>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ target: state.target, palette: state.palette, rate: state.rate }))
  } catch {
    // Storage blocked: the choices last until the page reloads
  }
}

export const useFractalStore = create<FractalState>((set, get) => ({
  open: false,
  ...(typeof window === 'undefined' ? { target: DEFAULT_TARGET, palette: DEFAULT_PALETTE, rate: DEFAULT_RATE } : readChoices()),
  playing: true,
  depth: 0,
  restarts: 0,
  saving: null,
  setOpen: (open) => set({ open }),
  // A new target is a new fall, from the top
  setTarget: (target) => {
    set(state => ({ target, restarts: state.restarts + 1, playing: true }))
    remember(get())
  },
  setPalette: (palette) => {
    set({ palette })
    remember(get())
  },
  setRate: (rate) => {
    set({ rate })
    remember(get())
  },
  setPlaying: (playing) => set({ playing }),
  restart: () => set(state => ({ restarts: state.restarts + 1, playing: true })),
  setDepth: (depth) => set({ depth }),
  setSaving: (saving) => set({ saving })
}))
