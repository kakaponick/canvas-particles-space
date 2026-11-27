import { create } from 'zustand'

// The page's film mode: whether it is open, the film in it and how it plays, a video being saved, and the
// films opened before. The quality and the films opened before outlast a reload; the rest lives with the page
const STORAGE_KEY = 'films-v1'
// Films opened from a file or pasted, kept to open again; the longest text kept, in characters
const RECENT_COUNT = 6
const RECENT_LONGEST = 200_000

export type FilmQualityChoice = 'medium' | 'high' | 'max'
export const FILM_QUALITIES: readonly FilmQualityChoice[] = ['medium', 'high', 'max']

// A film as it was given: the name it came under and its text, JSON or a script
export interface FilmEntry {
  name: string
  text: string
  // Where it came from: the library's films are not kept among the recent ones
  origin: 'library' | 'file' | 'paste' | 'scene'
}

// What the planner says of a loaded film
export interface FilmFacts {
  kind: 'film' | 'fractal' | 'reel'
  duration: number
  fps: number
  width: number
  height: number
  notes: string[]
}

export interface FilmSaving {
  frame: number
  frames: number
}

interface FilmState {
  open: boolean
  entry: FilmEntry | null
  status: 'empty' | 'loading' | 'ready' | 'failed'
  facts: FilmFacts | null
  // Why the film could not be read or drawn; one problem a line
  problem: string
  // Files the film names that have to be opened beside it
  needs: string[]
  playing: boolean
  ended: boolean
  // A new player is being made: before the first frame, or to start again
  waiting: boolean
  // The second on screen, or the one a seek goes to: written a few times a second while it changes
  time: number
  // The second a seek goes to while the frames before it are stepped, and how much of that is done (0 to 1)
  seekTo: number | null
  seekDone: number
  quality: FilmQualityChoice
  saving: FilmSaving | null
  saveProblem: string
  recent: { name: string, text: string }[]
  setOpen: (open: boolean) => void
  setQuality: (quality: FilmQualityChoice) => void
  remember: (entry: FilmEntry) => void
  forget: (name: string) => void
}

function readStored () {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const quality = FILM_QUALITIES.find(choice => choice === stored.quality) ?? 'high'
    const recent = Array.isArray(stored.recent)
      ? stored.recent.filter((film): film is { name: string, text: string } =>
        typeof film === 'object' && film !== null && typeof film.name === 'string' && typeof film.text === 'string').slice(0, RECENT_COUNT)
      : []
    return { quality, recent }
  } catch {
    return { quality: 'high' as const, recent: [] }
  }
}

function store (state: Pick<FilmState, 'quality' | 'recent'>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ quality: state.quality, recent: state.recent }))
  } catch {
    // Storage blocked or full: the choices last until the page reloads
  }
}

export const useFilmStore = create<FilmState>((set, get) => ({
  open: false,
  entry: null,
  status: 'empty',
  facts: null,
  problem: '',
  needs: [],
  playing: false,
  ended: false,
  waiting: false,
  time: 0,
  seekTo: null,
  seekDone: 0,
  ...(typeof window === 'undefined' ? { quality: 'high' as const, recent: [] } : readStored()),
  saving: null,
  saveProblem: '',
  setOpen: (open) => set({ open }),
  setQuality: (quality) => {
    set({ quality })
    store(get())
  },
  // The newest first, one entry a name
  remember: (entry) => {
    if (entry.origin === 'library' || entry.text.length > RECENT_LONGEST) return
    const recent = [{ name: entry.name, text: entry.text }, ...get().recent.filter(film => film.name !== entry.name)].slice(0, RECENT_COUNT)
    set({ recent })
    store(get())
  },
  forget: (name) => {
    set(state => ({ recent: state.recent.filter(film => film.name !== name) }))
    store(get())
  }
}))
