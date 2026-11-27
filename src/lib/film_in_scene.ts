// Plays a film inside the page's own scene: every frame, the film's tracks at its second are written into the
// scene's settings and layers, and its graphics, captions and fade are drawn over the frame, so the person at
// the page sits inside the film, sees what it shows as it runs and can still turn the camera. What stays the
// film mode's (film_live.ts): the film's own frame and size (captions stand in shares of the page instead),
// its pace, and the cues that fire the opening's events again. Opened by window.space.film.live, or by
// ?live=<film> in the address, which plays that film of the library and starts it again after every reload.
import { applyTracks, filmFade, planFilm, type FilmPlan } from './film'
import { writeFilm } from './film_script'
import { libraryText, resolveLibraryFilm } from './film_library'
import { drawCaptions, loadCaptionFonts } from './film_captions'
import { drawGraphics, loadGraphicImages, type FilmImages } from './film_graphics'
import { SETTING_KEYS, fail, parseSettings, type Patch } from './agent_values'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { sceneHooks } from './scene_hooks'
import type { Scene } from './scene'
import { useParticleStore } from '../store/particle_store'
import { useIntroDebugStore } from '../store/intro_debug_store'

export interface SceneFilmOptions {
  // The film's second to start from
  from?: number
  // Start again from the beginning after the end; true unless asked otherwise
  loop?: boolean
  // What a script reads as input (a voice's seconds), as for film.check
  input?: unknown
}

const LIVE_PARAM = 'live'

interface Playing {
  plan: FilmPlan
  images: FilmImages
  // The settings that move, written each frame; the rest is written once at every start
  moving: string[]
  loop: boolean
  // performance.now() at the film's second 0
  zero: number
  second: number
  ended: boolean
  // The layers the film hides, as last given to the page, so they are written only when they change
  layers: string
  // The canvas over the scene's that the graphics and captions are drawn on
  overlay: HTMLCanvasElement
  // The scene's settings and hidden layers before the film, put back by stop
  before: Patch
  hiddenBefore: IntroLayer[]
}

let playing: Playing | null = null

// The film's settings the scene takes: every setting key it has, with the hole anchored where the film puts it
function settingsOf (plan: FilmPlan, keys: readonly string[]): Patch {
  const settings = plan.settings as unknown as Patch
  const patch: Patch = {}
  for (const key of keys) if (key in settings && key !== 'blackHoleFollowing') patch[key] = settings[key]
  return patch
}

function write (patch: Patch) {
  const { next } = parseSettings(patch, SETTING_KEYS)
  useParticleStore.setState(next)
}

function writeLayers (state: Playing) {
  const hidden = INTRO_LAYERS.filter(layer => state.plan.hidden[layer])
  const key = hidden.join(',')
  if (key === state.layers) return
  state.layers = key
  const debug = useIntroDebugStore.getState()
  debug.applySetup(debug.params, debug.title, hidden)
}

function startAt (state: Playing, second: number) {
  applyTracks(state.plan, second)
  write({ ...settingsOf(state.plan, SETTING_KEYS), blackHoleFollowing: false })
  writeLayers(state)
  state.zero = performance.now() - second * 1000
  state.second = second
  state.ended = false
}

// Before the scene reads its settings: the film's second, and the tracks at it
function before () {
  const state = playing
  if (!state || state.ended) return
  let second = (performance.now() - state.zero) / 1000
  if (second > state.plan.duration) {
    if (!state.loop) {
      state.ended = true
      return
    }
    startAt(state, 0)
    second = 0
  }
  state.second = second
  applyTracks(state.plan, second)
  write(settingsOf(state.plan, state.moving))
  writeLayers(state)
}

// Once the frame is drawn: the film's fade, graphics and captions over it, in the page's own pixels
function after (scene: Scene) {
  const state = playing
  if (!state) return
  const { overlay, plan } = state
  const ratio = scene.pixelRatio
  const width = Math.round(scene.width * ratio)
  const height = Math.round(scene.height * ratio)
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width
    overlay.height = height
  }
  const ctx = overlay.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  // The page stands in for the film's frame: shares of the frame are shares of the page
  const view = { ...plan, width: scene.width, height: scene.height }
  const dark = plan.fade ? filmFade(plan, state.second) : 0
  if (dark > 0) {
    ctx.globalAlpha = dark
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }
  drawGraphics(ctx, view, state.second, scene.frame.composite, ratio, state.images, scene.frame.grid)
  if (plan.captions.length > 0) drawCaptions(ctx, view, state.second, scene.frame.composite, ratio, scene.frame.grid)
}

function makeOverlay () {
  const overlay = document.createElement('canvas')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.dataset.filmInScene = ''
  // Over the scene's canvas, under the toolbar and the panels, and never in the way of the pointer
  Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' })
  document.body.append(overlay)
  return overlay
}

// Plays a film (its JSON or its script as a string, or the name of a film of the library) in the scene
export async function playInScene (source: unknown, options: SceneFilmOptions = {}) {
  let film = source
  // A film of the library (by its folder, its path or a scratch film's name) is its JSON or its script, by
  // the ending of the file it is found as
  const path = typeof source === 'string' ? resolveLibraryFilm(source.trim()) : null
  if (path !== null) {
    const text = await libraryText(path)
    film = text !== null && path.endsWith('.json') ? JSON.parse(text) : text
  }
  if (typeof film === 'string') film = writeFilm(film, options.input ?? {}).film
  if (typeof film === 'object' && film !== null && 'clips' in film) fail('A reel plays in the film mode; play its clips here one by one')
  const plan = planFilm(film)
  const [images] = await Promise.all([loadGraphicImages(plan), loadCaptionFonts(plan)])
  const before = playing?.before ?? getSettings()
  const hiddenBefore = playing?.hiddenBefore ?? INTRO_LAYERS.filter(layer => useIntroDebugStore.getState().hidden[layer])
  stopInScene({ keep: true })
  const moving = [...new Set(plan.tracks.filter(track => track.target === 'settings').map(track => track.key))]
  playing = { plan, images, moving, loop: options.loop ?? true, zero: 0, second: 0, ended: false, layers: '', overlay: makeOverlay(), before, hiddenBefore }
  startAt(playing, Math.max(0, Math.min(options.from ?? 0, plan.duration)))
  sceneHooks.before = beforeFrame
  sceneHooks.after = afterFrame
  return { duration: plan.duration, moving, notes: plan.notes }
}

// The hooks this module put in, so a stop takes out only its own
const beforeFrame = () => before()
const afterFrame = (scene: Scene) => after(scene)

function getSettings (): Patch {
  const state = useParticleStore.getState() as unknown as Patch
  return Object.fromEntries(SETTING_KEYS.map(key => [key, state[key]]))
}

// Stops the film; the scene's settings and layers from before it come back unless `keep` is asked
export function stopInScene (options: { keep?: boolean } = {}) {
  const state = playing
  if (!state) return { stopped: false }
  playing = null
  if (sceneHooks.before === beforeFrame) sceneHooks.before = null
  if (sceneHooks.after === afterFrame) sceneHooks.after = null
  state.overlay.remove()
  if (!options.keep) {
    useParticleStore.setState(state.before as never)
    const debug = useIntroDebugStore.getState()
    debug.applySetup(debug.params, debug.title, state.hiddenBefore)
  }
  return { stopped: true, kept: Boolean(options.keep) }
}

// The second the film is at, or null when none plays
export function sceneFilmTime () {
  return playing ? { second: +playing.second.toFixed(2), duration: playing.plan.duration, running: !playing.ended } : null
}

// The film named by ?live= in the address, when the page opens with one
export function playFromAddress () {
  const name = new URL(window.location.href).searchParams.get(LIVE_PARAM)
  if (!name) return
  // A film's folder (?live=kerr_around), a path in films/ or a scratch film's name
  const file = resolveLibraryFilm(name)
  if (!file) {
    console.warn(`?live=${name}: the library has no such film`)
    return
  }
  void playInScene(file).catch(error => console.warn(`?live=${name}:`, error))
}
