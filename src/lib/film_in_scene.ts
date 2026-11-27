// Plays a film inside the page's own scene: every frame, the film's tracks at its second are written into the
// scene's settings, so the person at the page sits inside the film, sees the simulation it makes as it runs
// and can still turn the camera. Only the settings move: captions, graphics, cues, the film's frame and its
// pace are the film mode's (film_live.ts). Opened by window.space.film.live, or by ?live=<film> in the
// address, which plays that film of the library and starts it again after every reload of the page.
import { applyTracks, planFilm, type FilmPlan } from './film'
import { writeFilm } from './film_script'
import { isLibraryFilm, libraryText } from './film_library'
import { SETTING_KEYS, fail, parseSettings, type Patch } from './agent_values'
import { useParticleStore } from '../store/particle_store'

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
  // The settings that move, written each frame; the rest is written once at every start
  moving: string[]
  loop: boolean
  // performance.now() at the film's second 0
  zero: number
  frame: number
  // The scene's settings before the film, put back by stop
  before: Patch
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

function startAt (state: Playing, second: number) {
  applyTracks(state.plan, second)
  write({ ...settingsOf(state.plan, SETTING_KEYS), blackHoleFollowing: false })
  state.zero = performance.now() - second * 1000
}

function step () {
  const state = playing
  if (!state) return
  let second = (performance.now() - state.zero) / 1000
  if (second > state.plan.duration) {
    if (!state.loop) {
      state.frame = 0
      return
    }
    startAt(state, 0)
    second = 0
  }
  applyTracks(state.plan, second)
  write(settingsOf(state.plan, state.moving))
  state.frame = requestAnimationFrame(step)
}

// Plays a film (its JSON or its script as a string, or the name of a film of the library) in the scene
export async function playInScene (source: unknown, options: SceneFilmOptions = {}) {
  let film = source
  if (typeof source === 'string' && isLibraryFilm(source.trim())) film = await libraryText(source.trim())
  if (typeof film === 'string') film = writeFilm(film, options.input ?? {}).film
  if (typeof film === 'object' && film !== null && 'clips' in film) fail('A reel plays in the film mode; play its clips here one by one')
  const plan = planFilm(film)
  const before = playing?.before ?? getSettings()
  stopInScene({ keep: true })
  const moving = [...new Set(plan.tracks.filter(track => track.target === 'settings').map(track => track.key))]
  playing = { plan, moving, loop: options.loop ?? true, zero: 0, frame: 0, before }
  startAt(playing, Math.max(0, Math.min(options.from ?? 0, plan.duration)))
  playing.frame = requestAnimationFrame(step)
  return { duration: plan.duration, moving, notes: plan.notes, only: 'settings: captions, graphics and cues show only in the film mode' }
}

function getSettings (): Patch {
  const state = useParticleStore.getState() as unknown as Patch
  return Object.fromEntries(SETTING_KEYS.map(key => [key, state[key]]))
}

// Stops the film; the scene's settings from before it come back unless `keep` is asked
export function stopInScene (options: { keep?: boolean } = {}) {
  const state = playing
  if (!state) return { stopped: false }
  if (state.frame) cancelAnimationFrame(state.frame)
  playing = null
  if (!options.keep) useParticleStore.setState(state.before as never)
  return { stopped: true, kept: Boolean(options.keep) }
}

// The second the film is at, or null when none plays
export function sceneFilmTime () {
  return playing ? { second: +((performance.now() - playing.zero) / 1000).toFixed(2), duration: playing.plan.duration, running: playing.frame !== 0 } : null
}

// The film named by ?live= in the address, when the page opens with one
export function playFromAddress () {
  const name = new URL(window.location.href).searchParams.get(LIVE_PARAM)
  if (!name) return
  const file = [name, `${name}.js`, `${name}.json`].find(isLibraryFilm)
  if (!file) {
    console.warn(`?live=${name}: the library has no such film`)
    return
  }
  void playInScene(file).catch(error => console.warn(`?live=${name}:`, error))
}
