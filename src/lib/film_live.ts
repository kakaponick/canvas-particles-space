// Plays a film on the page as it runs: the film mode's engine (film_mode.tsx), loaded when a film is first
// opened. It draws with the players the renderer draws an mp4 with (film_render.ts, fractal_render.ts,
// reel_render.ts), so every frame shown is the frame the render makes; it only paces them by the clock. A
// frame the machine has no time for is stepped and not shown, and when even that falls behind, the film
// slows down rather than jumping.
import { fail, type Patch } from './agent_values'
import { FILM_KEYS, planFilm } from './film'
import { writeFilm, writeFractal } from './film_script'
import { FRACTAL_KEYS, planFractal } from './fractal'
import { isReel, planReel } from './reel'
import { createFilmPlayer, renderFilm, type FilmQuality } from './film_render'
import { createFractalPlayer, loadFonts, renderFractal } from './fractal_render'
import { createReelPlayer, renderReel } from './reel_render'
import { baseName, libraryPicture, libraryText } from './film_library'
import { useParticleStore } from '../store/particle_store'
import { DEFAULT_PRESET } from '../store/preset_store'
import { SIMULATION_SETTING_KEYS } from './simulation_presets'

export type FilmKind = 'film' | 'fractal' | 'reel'

// A file the user gave beside a film: its text when it is a film or a reel's clip, its address when it is
// a picture. Found by the name a film refers to it by
export interface GivenFile {
  text?: string
  url?: string
}
export type GivenFiles = ReadonlyMap<string, GivenFile>

// A film read, checked and ready to play or render: always as its JSON, a script already written
export interface LoadedFilm {
  kind: FilmKind
  source: Patch
  duration: number
  fps: number
  frames: number
  // The video's own frame in its pixels, and video pixels per film pixel
  width: number
  height: number
  scale: number
  // Where each picture of the film is read from, by the "src" it was written with
  images: Record<string, string>
  // What the planner changed in the film, and what a script adjusted
  notes: string[]
}

// Files the film names that were not given and are not in the library
export class MissingFiles extends Error {
  constructor (readonly names: string[]) {
    super(`The film needs ${names.join(', ')}: open ${names.length > 1 ? 'them' : 'it'} together with the film`)
  }
}

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)
// Keys only a fractal film has, which tell one apart from a particle film
const FRACTAL_ONLY = new Set(FRACTAL_KEYS.filter(key => !FILM_KEYS.includes(key)))
// A reel's clip that names a file, as reel.ts reads it
const FILE_NAME = /^[\w ./\\:~-]+\.(json|js)$/i
const OWN_ADDRESS = ['data:', 'blob:', 'http://', 'https://']

const SCRIPT_READERS = { film: writeFilm, fractal: writeFractal } as const

// What kind of film a text is and the film itself: JSON is taken as it is; a script is written by the kind
// its head points to, and by the other when that refuses it
function readText (name: string, text: string): { kind: FilmKind, source: Patch, notes: string[] } {
  const trimmed = text.trim()
  if (trimmed === '') fail(`${name} is empty`)
  const asJson = /\.json$/i.test(name) || (!/\.m?js$/i.test(name) && trimmed.startsWith('{'))
  if (!asJson) return readScript(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    if (/\.json$/i.test(name)) fail(`${name} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    // Pasted text that only looked like JSON is a script
    return readScript(text)
  }
  if (!isObject(parsed)) fail(`${name} is not a film: a film is a JSON object`)
  const kind: FilmKind = isReel(parsed) ? 'reel' : Object.keys(parsed).some(key => FRACTAL_ONLY.has(key)) ? 'fractal' : 'film'
  return { kind, source: parsed, notes: [] }
}

function readScript (text: string): { kind: FilmKind, source: Patch, notes: string[] } {
  // A fractal script names its target in film(); a particle film never has one
  const order = /\bfilm\s*\(\s*\{[^)]*\btarget\s*:/.test(text) ? (['fractal', 'film'] as const) : (['film', 'fractal'] as const)
  let refused: unknown
  for (const kind of order) {
    try {
      const written = SCRIPT_READERS[kind](text)
      return { kind, source: written.film, notes: written.notes }
    } catch (error) {
      refused ??= error
    }
  }
  throw refused instanceof Error ? refused : new Error(String(refused))
}

// A reel's clips that name files get those files, a .json as its object and a .js as its script, as the
// film server gives them: one given beside the reel first, then the library's
async function resolveClips (reel: Patch, files: GivenFiles, missing: string[]) {
  if (!Array.isArray(reel.clips)) return reel
  const clips = await Promise.all(reel.clips.map(async (clip: unknown) => {
    if (!isObject(clip)) return clip
    const resolved = { ...clip }
    for (const kind of ['film', 'fractal']) {
      const named = clip[kind]
      if (typeof named !== 'string' || !FILE_NAME.test(named.trim())) continue
      const text = files.get(baseName(named))?.text ?? await libraryText(named)
      if (text === null) {
        missing.push(baseName(named))
      } else if (/\.json$/i.test(named.trim())) {
        try {
          resolved[kind] = JSON.parse(text)
        } catch (error) {
          fail(`${baseName(named)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        resolved[kind] = text
      }
    }
    return resolved
  }))
  return { ...reel, clips }
}

// The addresses of a film's pictures: a file given beside it, then the library's
async function resolvePictures (sources: string[], files: GivenFiles, missing: string[]) {
  const images: Record<string, string> = {}
  for (const src of new Set(sources)) {
    if (OWN_ADDRESS.some(start => src.toLowerCase().startsWith(start))) continue
    const url = files.get(baseName(src))?.url ?? await libraryPicture(src)
    if (url) images[src] = url
    else missing.push(baseName(src))
  }
  return images
}

const pictures = (graphics: { kind: string, src: string }[]) => graphics.filter(graphic => graphic.kind === 'image').map(graphic => graphic.src)

// Reads a film from its text, finds the files it names, and checks it with the planner the renderer uses,
// so a film that loads here renders. Throws the planner's problems, or MissingFiles
export async function loadFilm (name: string, text: string, files: GivenFiles): Promise<LoadedFilm> {
  const read = readText(name, text)
  const missing: string[] = []
  const source = read.kind === 'reel' ? await resolveClips(read.source, files, missing) : read.source
  if (missing.length > 0) throw new MissingFiles([...new Set(missing)])

  const plan = read.kind === 'film' ? planFilm(source) : read.kind === 'fractal' ? planFractal(source) : planReel(source)
  const sources = 'graphics' in plan
    ? pictures(plan.graphics)
    : 'clips' in plan ? plan.clips.flatMap(clip => clip.kind === 'film' ? pictures(clip.plan.graphics) : []) : []
  const images = await resolvePictures(sources, files, missing)
  if (missing.length > 0) throw new MissingFiles([...new Set(missing)])
  return {
    kind: read.kind,
    source,
    duration: plan.duration,
    fps: plan.fps,
    frames: plan.frames,
    width: Math.round(plan.width * plan.scale),
    height: Math.round(plan.height * plan.scale),
    scale: plan.scale,
    images,
    notes: [...read.notes, ...plan.notes]
  }
}

// What the live player needs of a film's own player. A particle film steps every frame before the one it
// shows; a reel and a fractal film reach a frame by themselves
interface FramePlayer {
  canvas: HTMLCanvasElement
  stepsEvery: boolean
  draw: (index: number, show: boolean) => unknown
  dispose: () => void
}

async function makePlayer (film: LoadedFilm, pixel: number): Promise<FramePlayer> {
  if (film.kind === 'film') {
    // A fresh plan each time: a player writes the tracks into its plan as it plays
    const player = await createFilmPlayer(planFilm(film.source), pixel, film.images)
    return { canvas: player.canvas, stepsEvery: true, draw: (index, show) => player.drawFrame(index, show), dispose: player.dispose }
  }
  if (film.kind === 'fractal') {
    const plan = planFractal(film.source)
    await loadFonts(plan)
    const player = createFractalPlayer(plan, pixel)
    return { canvas: player.canvas, stepsEvery: false, draw: (index, show) => show ? player.drawFrame(index) : undefined, dispose: player.dispose }
  }
  const player = await createReelPlayer(planReel(film.source), pixel, { images: film.images }, 0)
  return { canvas: player.canvas, stepsEvery: false, draw: (index, show) => show ? player.drawFrame(index) : undefined, dispose: player.dispose }
}

// Video pixels per film pixel for a film shown in a box of this many device pixels: its own scale, or less
// when the box is smaller than the video, which draws the same frame on fewer pixels
export function livePixel (film: LoadedFilm, width: number, height: number) {
  const fit = Math.min(width / film.width, height / film.height)
  return film.scale * Math.min(1, Math.max(0.1, fit))
}

export interface LiveState {
  // The second of the film on screen
  time: number
  playing: boolean
  // The film has reached its last frame; Play starts it again
  ended: boolean
  // A new player is being made, before the first frame or to start again
  waiting: boolean
}

// Seconds between two reports of the time while the film plays, so the panel re-renders a few times a second
const REPORT_MS = 100

// Plays `film` on its own canvas, drawn at `pixel` video pixels a film pixel, paused on its first frame.
// `report` hears the time and the state; `problem` hears a frame that could not be drawn, and the film
// pauses there
export async function createLivePlayer (film: LoadedFilm, pixel: number, report: (state: LiveState) => void, problem: (message: string) => void) {
  let player = await makePlayer(film, pixel)
  const canvas = document.createElement('canvas')
  canvas.width = player.canvas.width
  canvas.height = player.canvas.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    player.dispose()
    fail('A 2D canvas is not available')
  }

  const last = film.frames - 1
  // The newest frame the player has drawn or stepped, and the one on the canvas
  let drawn = -1
  let shown = -1
  let playing = false
  let held = false
  let disposed = false
  let waiting = false
  // Work in flight (frames, a new player), so the clock never starts more beside it
  let busy = false
  // The clock: frame `anchorFrame` was on screen at `anchorAt`
  let anchorAt = 0
  let anchorFrame = 0
  let reportedAt = -Infinity
  let raf = 0
  // Frames one tick may catch up by before the film slows instead
  const maxLag = Math.max(2, Math.ceil(film.fps / 15))

  const send = (force: boolean) => {
    const now = performance.now()
    if (!force && now - reportedAt < REPORT_MS) return
    reportedAt = now
    // The last frame stands for the film's end, so a film played through reads its whole length
    report({ time: shown >= last ? film.duration : Math.max(0, shown) / film.fps, playing, ended: shown >= last && !playing, waiting })
  }
  const anchor = () => {
    anchorAt = performance.now()
    anchorFrame = Math.max(0, shown)
  }

  // Brings the player on to frame `target` and shows it
  const drawUpTo = async (target: number) => {
    if (player.stepsEvery) {
      for (let index = drawn + 1; index <= target; index++) {
        await player.draw(index, index === target)
        drawn = index
      }
    } else {
      await player.draw(target, true)
      drawn = target
    }
    if (disposed) return
    ctx.drawImage(player.canvas, 0, 0)
    shown = drawn
  }

  const run = (work: () => Promise<unknown>) => {
    busy = true
    work()
      .catch((error: unknown) => {
        if (disposed) return
        playing = false
        problem(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        busy = false
        if (!disposed) send(true)
      })
  }

  // The film from its start again: a scene only goes forward, so it is a new player
  const restart = () => run(async () => {
    waiting = true
    send(true)
    player.dispose()
    player = await makePlayer(film, pixel)
    if (disposed) {
      player.dispose()
      return
    }
    drawn = -1
    await drawUpTo(0)
    waiting = false
    anchor()
  })

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (busy || held || !playing) return
    if (shown >= last) {
      playing = false
      send(true)
      return
    }
    const due = Math.min(last, anchorFrame + Math.floor((now - anchorAt) / 1000 * film.fps))
    if (due <= drawn) return
    const target = Math.min(due, drawn + maxLag)
    // Behind by more than a tick can catch up: the film slows down here instead of jumping ahead
    if (target < due) {
      anchorAt = now
      anchorFrame = target
    }
    run(async () => {
      await drawUpTo(target)
      send(false)
    })
  }

  await drawUpTo(0)
  raf = requestAnimationFrame(tick)

  return {
    canvas,
    play () {
      playing = true
      if (shown >= last) restart()
      else anchor()
      send(true)
    },
    pause () {
      playing = false
      send(true)
    },
    // Stops the clock without letting the film go, while a render takes the machine
    hold (on: boolean) {
      held = on
      if (!on) anchor()
    },
    dispose () {
      disposed = true
      cancelAnimationFrame(raf)
      player.dispose()
    }
  }
}

export type LivePlayer = Awaited<ReturnType<typeof createLivePlayer>>

// Draws the whole film into an mp4 the browser saves under `name`
export async function renderLoaded (film: LoadedFilm, quality: FilmQuality, name: string) {
  const options = { quality, download: name, images: film.images }
  if (film.kind === 'film') return (await renderFilm(film.source, options)).summary
  if (film.kind === 'fractal') return (await renderFractal(film.source, options)).summary
  return (await renderReel(film.source, options)).summary
}

// A film of the scene as it stands on the page: its settings where they differ from the defaults, the black
// hole resting where it is, and no opening. A start to edit, play or render
export function filmFromScene (seconds = 20) {
  const state = useParticleStore.getState() as unknown as Patch
  const defaults = DEFAULT_PRESET.settings as unknown as Patch
  const settings: Patch = {}
  for (const key of SIMULATION_SETTING_KEYS) {
    // A film has no cursor: the hole rests where it is drawn
    if (key === 'blackHoleFollowing') continue
    if (JSON.stringify(state[key]) !== JSON.stringify(defaults[key])) settings[key] = state[key]
  }
  return { duration: seconds, fps: 60, size: '1080p', seed: 1, intro: false, settings }
}
