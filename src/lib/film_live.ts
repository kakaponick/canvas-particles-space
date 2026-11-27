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
  // The address of the sound it plays under it from its first second, or null
  audio: string | null
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
export async function loadFilm (name: string, text: string, files: GivenFiles, audio: string | null = null): Promise<LoadedFilm> {
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
    notes: [...read.notes, ...plan.notes],
    audio
  }
}

// What the live player needs of a film's own player. A particle film steps every frame before the one it
// shows, from its first; a fractal film draws any frame by itself; a reel reaches any later frame by itself
// (its clip steps to it) and an earlier one only from a new player
interface FramePlayer {
  canvas: HTMLCanvasElement
  stepsEvery: boolean
  // Frames before the newest drawn can be drawn again by the same player
  goesBack: boolean
  draw: (index: number, show: boolean) => unknown
  dispose: () => void
}

// `first`: the frame the player is made for, so a reel opens the clip that frame is in first
async function makePlayer (film: LoadedFilm, pixel: number, first = 0): Promise<FramePlayer> {
  if (film.kind === 'film') {
    // A fresh plan each time: a player writes the tracks into its plan as it plays
    const player = await createFilmPlayer(planFilm(film.source), pixel, film.images)
    return { canvas: player.canvas, stepsEvery: true, goesBack: false, draw: (index, show) => player.drawFrame(index, show), dispose: player.dispose }
  }
  if (film.kind === 'fractal') {
    const plan = planFractal(film.source)
    await loadFonts(plan)
    const player = createFractalPlayer(plan, pixel)
    return { canvas: player.canvas, stepsEvery: false, goesBack: true, draw: (index, show) => show ? player.drawFrame(index) : undefined, dispose: player.dispose }
  }
  const plan = planReel(film.source)
  const player = await createReelPlayer(plan, pixel, { images: film.images }, Math.min(first, plan.frames - 1))
  return { canvas: player.canvas, stepsEvery: false, goesBack: false, draw: (index, show) => show ? player.drawFrame(index) : undefined, dispose: player.dispose }
}

// Video pixels per film pixel for a film shown in a box of this many device pixels: its own scale, or less
// when the box is smaller than the video, which draws the same frame on fewer pixels
export function livePixel (film: LoadedFilm, width: number, height: number) {
  const fit = Math.min(width / film.width, height / film.height)
  return film.scale * Math.min(1, Math.max(0.1, fit))
}

// The film's sound as the panel shows it: none, playing, muted by the person, or held muted by the browser
// until the person touches the page (a film opened from the address starts before they have)
export type LiveSound = 'none' | 'on' | 'muted' | 'blocked'

export interface LiveState {
  // The second of the film on screen, or the one a seek is going to
  time: number
  playing: boolean
  // The film has reached its last frame; Play starts it again
  ended: boolean
  // The second a seek is going to, while the frames before it are stepped; null when none is
  seekTo: number | null
  // How much of that seek's stepping is done, 0 to 1
  seekDone: number
  sound: LiveSound
}

export interface LiveOptions {
  // The address of the sound played under the film from its first second
  audio?: string | null
  muted?: boolean
}

// Seconds between two reports of the time while the film plays, so the panel re-renders a few times a second
const REPORT_MS = 100
// The main thread's share of one tick spent stepping toward a seek's frame, in milliseconds: the page stays
// responsive (the pointer, the transport) while a long seek runs. A step's own cost sets how many fit
const SEEK_SLICE_MS = 12
// The most steps one tick of a seek issues, so the graphics card's queue never runs far ahead of the slice
const SEEK_MOST_STEPS = 240
// How far the picture may stray from the sound before it is set by it, in seconds: under the 45 ms a sound
// ahead of its picture starts to show at
const SOUND_DRIFT_S = 0.04

// Plays `film` on its own canvas, drawn at `pixel` video pixels a film pixel, paused on its first frame.
// `report` hears the time and the state; `problem` hears a frame that could not be drawn, and the film
// pauses there. A seek goes to any frame: a scene only goes forward, so a particle film steps the frames
// before it unshown, from its start again when it lies behind, and every frame shown is still the render's.
// A film with a sound plays it in an <audio> element, which the browser fetches a piece at a time and decodes
// off the main thread; while it plays it is the clock, and the picture follows it. A picture that falls
// behind holds the sound until it is back, as a video waits for its data
export async function createLivePlayer (film: LoadedFilm, pixel: number, report: (state: LiveState) => void, problem: (message: string) => void, options: LiveOptions = {}) {
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
  // Work in flight (frames, a new player), so the clock never starts more beside it
  let busy = false
  // The clock: frame `anchorFrame` was on screen at `anchorAt`
  let anchorAt = 0
  let anchorFrame = 0
  let reportedAt = -Infinity
  let raf = 0
  // Frames one tick may catch up by before the film slows instead
  const maxLag = Math.max(2, Math.ceil(film.fps / 15))
  // The frame a seek goes to, and the frame its stepping started after; steps a tick of it may take
  let wanted: number | null = null
  let seekFrom = 0
  let seekSteps = 4

  // The sound: muted by the person, held muted by the browser, held while the picture catches up, or broken
  const sound = options.audio ? document.createElement('audio') : null
  let muted = options.muted ?? false
  let blocked = false
  let stalled = false
  let broken = false
  if (sound && options.audio) {
    sound.preload = 'auto'
    sound.muted = muted
    sound.src = options.audio
    sound.addEventListener('error', () => {
      broken = true
      send(true)
    })
  }
  const soundState = (): LiveSound => !sound || broken ? 'none' : blocked ? 'blocked' : muted ? 'muted' : 'on'

  const send = (force: boolean) => {
    const now = performance.now()
    if (!force && now - reportedAt < REPORT_MS) return
    reportedAt = now
    const done = wanted !== null && wanted > seekFrom ? (drawn - seekFrom) / (wanted - seekFrom) : 0
    report({
      // The last frame stands for the film's end, so a film played through reads its whole length
      time: wanted !== null ? wanted / film.fps : shown >= last ? film.duration : Math.max(0, shown) / film.fps,
      playing,
      ended: wanted === null && shown >= last && !playing,
      seekTo: wanted !== null ? wanted / film.fps : null,
      seekDone: Math.max(0, Math.min(1, done)),
      sound: soundState()
    })
  }
  const anchor = () => {
    anchorAt = performance.now()
    anchorFrame = Math.max(0, shown)
  }

  // Starts the sound at the frame on screen, while the film plays and nothing holds it. A browser that lets
  // no sound play before the person has touched the page plays it muted, as the clock, until they turn it on
  const startSound = () => {
    stalled = false
    if (!sound || broken || !playing || held || wanted !== null) return
    const second = Math.max(0, shown) / film.fps
    // Past the sound's end the film runs on its own clock
    if (Number.isFinite(sound.duration) && second >= sound.duration) return
    // A seek of the element costs a fetch and a decode: only when it is not already there
    if (Math.abs(sound.currentTime - second) > SOUND_DRIFT_S / 2) sound.currentTime = second
    sound.play().catch((error: unknown) => {
      if (disposed || !sound || sound.muted || !(error instanceof DOMException) || error.name !== 'NotAllowedError') return
      blocked = true
      sound.muted = true
      send(true)
      sound.play().catch(() => {})
    })
  }
  const stopSound = () => {
    stalled = false
    sound?.pause()
  }
  // While the sound plays it sets the clock: a picture more than SOUND_DRIFT_S from it is put where the sound
  // is. A sound still fetching its next piece stands still, and so does the picture with it
  const followSound = (now: number) => {
    if (!sound || broken || sound.paused || sound.ended || sound.seeking) return
    const frame = sound.currentTime * film.fps
    if (Math.abs(frame - (anchorFrame + (now - anchorAt) / 1000 * film.fps)) > SOUND_DRIFT_S * film.fps) {
      anchorAt = now
      anchorFrame = frame
    }
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
        wanted = null
        stopSound()
        problem(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        busy = false
        if (!disposed) send(true)
      })
  }

  // A new player, made for frame `first`: the way back, since a scene only goes forward
  const renew = async (first: number) => {
    player.dispose()
    player = await makePlayer(film, pixel, first)
    if (disposed) player.dispose()
    drawn = -1
  }

  // The seek has shown its frame: the clock and the sound go on from there
  const arrive = (target: number) => {
    if (wanted === target) wanted = null
    anchor()
    startSound()
    send(true)
  }

  // One tick of a seek: a slice of the steps toward its frame, or the frame itself
  const seekTick = () => {
    const target = wanted
    if (target === null) return
    if (target === shown && target === drawn) return arrive(target)
    if (!player.stepsEvery) {
      run(async () => {
        if (target <= drawn && !player.goesBack) await renew(target)
        if (disposed) return
        await drawUpTo(target)
        arrive(target)
      })
      return
    }
    if (target <= drawn) {
      // Behind the scene: from its start again. The canvas keeps the frame it shows until the new one is there
      run(async () => {
        await renew(0)
        seekFrom = -1
      })
      return
    }
    run(async () => {
      const started = performance.now()
      const until = Math.min(target, drawn + seekSteps)
      for (let index = drawn + 1; index <= until; index++) {
        await player.draw(index, index === target)
        drawn = index
      }
      if (disposed) return
      // As many steps next tick as fit the slice at this tick's pace
      const spent = Math.max(0.5, performance.now() - started)
      seekSteps = Math.max(1, Math.min(SEEK_MOST_STEPS, Math.round(seekSteps * Math.min(2, SEEK_SLICE_MS / spent))))
      if (drawn === target) {
        ctx.drawImage(player.canvas, 0, 0)
        shown = drawn
        arrive(target)
      } else {
        send(false)
      }
    })
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (busy || held) return
    if (wanted !== null) {
      seekTick()
      return
    }
    if (!playing) return
    if (shown >= last) {
      playing = false
      stopSound()
      send(true)
      return
    }
    followSound(now)
    const due = Math.min(last, Math.floor(anchorFrame + (now - anchorAt) / 1000 * film.fps))
    if (due <= drawn) return
    const target = Math.min(due, drawn + maxLag)
    if (target < due) {
      // Behind by more than a tick can catch up: the film slows down here instead of jumping ahead, and the
      // sound waits for it
      anchorAt = now
      anchorFrame = target
      if (sound && !sound.paused) {
        sound.pause()
        stalled = true
      }
    } else if (stalled) {
      // Caught up: the sound goes on from the picture
      startSound()
    }
    run(async () => {
      await drawUpTo(target)
      send(false)
    })
  }

  // Goes to frame `frame`; a seek asked for while another runs takes its place
  const seekFrame = (frame: number) => {
    const target = Math.max(0, Math.min(last, Math.round(frame)))
    if (wanted === null && target === shown) return
    // A seek that keeps going the same way keeps its start, so its share done stays true
    if (wanted === null || target <= drawn) seekFrom = target > drawn ? drawn : -1
    wanted = target
    stopSound()
    send(true)
  }

  await drawUpTo(0)
  raf = requestAnimationFrame(tick)

  return {
    canvas,
    play () {
      playing = true
      // From the end, Play starts the film again
      if (wanted === null && shown >= last) {
        seekFrame(0)
      } else {
        anchor()
        startSound()
      }
      send(true)
    },
    pause () {
      playing = false
      stopSound()
      send(true)
    },
    // Goes to the film's second `second`, playing on from there if it was playing
    seek (second: number) {
      seekFrame(second * film.fps)
    },
    // Moves by `frames` frames from the frame shown or sought
    step (frames: number) {
      seekFrame((wanted ?? Math.max(0, shown)) + frames)
    },
    // Mutes or unmutes the sound; turning it on from a click is what lets a held sound be heard
    setMuted (on: boolean) {
      muted = on
      if (!on) blocked = false
      if (sound) sound.muted = on
      send(true)
    },
    // Stops the clock without letting the film go, while a render takes the machine
    hold (on: boolean) {
      held = on
      if (on) {
        stopSound()
      } else {
        anchor()
        startSound()
      }
    },
    dispose () {
      disposed = true
      cancelAnimationFrame(raf)
      player.dispose()
      if (sound) {
        // Lets the browser drop the fetch and the decoder at once
        sound.pause()
        sound.removeAttribute('src')
        sound.load()
      }
    }
  }
}


export type LivePlayer = Awaited<ReturnType<typeof createLivePlayer>>

// Draws the whole film into an mp4 the browser saves under `name`
export async function renderLoaded (film: LoadedFilm, quality: FilmQuality, name: string) {
  // The sound goes into the mp4 as it does through the film server
  const options = { quality, download: name, images: film.images, audio: film.audio ?? undefined }
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
