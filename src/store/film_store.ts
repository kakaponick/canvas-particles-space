import { create } from 'zustand'

// The page's film mode: whether it is open, the film in it and how it plays, a video being saved, and the
// films opened before. The quality, the sound's mute and loudness, the loop, the films opened before and
// where each long film was left outlast a reload; the rest, the pace included, lives with the page
const STORAGE_KEY = 'films-v1'
// Films opened from a file or pasted, kept to open again; the longest text kept, in characters
const RECENT_COUNT = 6
const RECENT_LONGEST = 200_000
// The long films whose place is kept, newest first: the rest are forgotten
const POSITIONS_KEPT = 30

export type FilmQualityChoice = 'medium' | 'high' | 'max'
export const FILM_QUALITIES: readonly FilmQualityChoice[] = ['medium', 'high', 'max']
// The paces the player offers, film seconds a clock second
export const FILM_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const

// A film as it was given: the name it came under and its text, JSON or a script
export interface FilmEntry {
  name: string
  text: string
  // Where it came from: the library's films are not kept among the recent ones
  origin: 'library' | 'file' | 'paste' | 'scene'
  // The address of a sound given with it (a file dropped beside it); a library film finds its own
  audio?: string
}

// The film's sound: none, playing, muted, or held muted by the browser until the person turns it on
export type FilmSound = 'none' | 'on' | 'muted' | 'blocked'

// What the planner says of a loaded film
export interface FilmFacts {
  kind: 'film' | 'fractal' | 'reel'
  duration: number
  fps: number
  width: number
  height: number
  notes: string[]
  // It plays a sound under it
  audio: boolean
  // A reel's clips: each one's name and the second it starts at
  chapters: { name: string, start: number }[]
}

export interface FilmSaving {
  frame: number
  frames: number
  // When the save began, on the page's clock (performance.now), for the time it has left
  startedAt: number
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
  sound: FilmSound
  // The person's mute and loudness (0 to 1), kept across films and reloads
  muted: boolean
  volume: number
  // Film seconds a clock second, for every film until the page reloads
  rate: number
  // A film that ends starts again
  loop: boolean
  quality: FilmQualityChoice
  saving: FilmSaving | null
  saveProblem: string
  recent: { name: string, text: string }[]
  // Where each long film was left, in seconds, by its name
  positions: Record<string, number>
  // The second a long film was taken up at as it opened, while the stage says so
  resumedAt: number | null
  setOpen: (open: boolean) => void
  setQuality: (quality: FilmQualityChoice) => void
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
  setRate: (rate: number) => void
  setLoop: (loop: boolean) => void
  remember: (entry: FilmEntry) => void
  forget: (name: string) => void
  setPosition: (name: string, second: number | null) => void
}

function readStored () {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const quality = FILM_QUALITIES.find(choice => choice === stored.quality) ?? 'high'
    const recent = Array.isArray(stored.recent)
      ? stored.recent.filter((film): film is { name: string, text: string } =>
        typeof film === 'object' && film !== null && typeof film.name === 'string' && typeof film.text === 'string').slice(0, RECENT_COUNT)
      : []
    const volume = typeof stored.volume === 'number' && stored.volume >= 0 && stored.volume <= 1 ? stored.volume : 1
    const positions: Record<string, number> = {}
    if (typeof stored.positions === 'object' && stored.positions !== null) {
      for (const [name, second] of Object.entries(stored.positions)) if (typeof second === 'number' && second > 0) positions[name] = second
    }
    return { quality, recent, muted: stored.muted === true, volume, loop: stored.loop === true, positions }
  } catch {
    return STORED_DEFAULTS
  }
}

const STORED_DEFAULTS = { quality: 'high' as const, recent: [], muted: false, volume: 1, loop: false, positions: {} }

function store (state: Pick<FilmState, 'quality' | 'recent' | 'muted' | 'volume' | 'loop' | 'positions'>) {
  try {
    const kept = { quality: state.quality, recent: state.recent, muted: state.muted, volume: state.volume, loop: state.loop, positions: state.positions }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
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
  sound: 'none',
  rate: 1,
  resumedAt: null,
  ...(typeof window === 'undefined' ? STORED_DEFAULTS : readStored()),
  saving: null,
  saveProblem: '',
  setOpen: (open) => set({ open }),
  setQuality: (quality) => {
    set({ quality })
    store(get())
  },
  setMuted: (muted) => {
    set({ muted })
    store(get())
  },
  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)) })
    store(get())
  },
  setRate: (rate) => set({ rate }),
  setLoop: (loop) => {
    set({ loop })
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
  },
  // The newest first, so the oldest go once there are more than POSITIONS_KEPT
  setPosition: (name, second) => {
    const before = get().positions
    if ((before[name] ?? null) === second) return
    const rest = Object.entries(before).filter(([kept]) => kept !== name)
    const positions = Object.fromEntries(second === null ? rest : [[name, second], ...rest].slice(0, POSITIONS_KEPT))
    set({ positions })
    store(get())
  }
}))
