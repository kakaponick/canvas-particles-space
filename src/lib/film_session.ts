// What the film mode does (film_mode.tsx): opens a film from a file, a drop, a paste, the library or the
// scene, plays it on the stage, and saves it as a file or an mp4. The engine (film_live.ts) and the
// renderer behind it load when the first film is opened, so a visitor who never opens one downloads neither.
import { useFilmStore, type FilmEntry } from '../store/film_store'
import { LIBRARY, addressName, baseName, libraryAudio, libraryFilmOf, libraryText, resolveLibraryFilm } from './film_library'
import type { GivenFile, LivePlayer, LoadedFilm } from './film_live'

const engine = () => import('./film_live')
const PROGRESS_MS = 250
// The address that opens a film of the library straight away, at a second when it names one:
// ?film=kerr_around&t=12. A film's folder names it, a part its path in films/ (fourth_dimension_pop/clips/01_down)
const FILM_PARAM = 'film'
const TIME_PARAM = 't'
// After the viewer lets go of the camera it waits this long, in ms, then eases back to the film's own at
// this rate (the share of the way left it goes in a second, as 1 - e^-rate)
const LOOK_BACK_AFTER_MS = 1000
const LOOK_BACK_RATE = 5
// A turn this small, in degrees, is the film's own camera again
const LOOK_SETTLED = 0.05
// How far up or down a viewer can turn: from any Elevation to either end of its range (film_render.ts)
const LOOK_PITCH_REACH = 178
// The step of the seek keys and buttons, in seconds, and of J and L
const SEEK_STEP = 5
const SEEK_LONG_STEP = 10
// A film at least this long, in seconds, is taken up where it was left; not within RESUME_EDGE seconds of
// its start or its end, and the place is written down at most every POSITION_MS
const RESUME_LONGER = 120
const RESUME_EDGE = 5
const POSITION_MS = 5000

const FILM_FILE = /\.(json|m?js)$/i
// A sound given beside a film, played under it: what the browser's <audio> plays
const SOUND_FILE = /\.(m4a|mp3|wav|ogg|opus|aac|flac|webm)$/i
const PICTURE_FILE = /\.(png|jpe?g|webp|gif|avif)$/i

// Files opened beside a film, by name, for the files it names; they last as long as the page
const given = new Map<string, GivenFile>()
let loaded: LoadedFilm | null = null
let player: LivePlayer | null = null
let stage: HTMLElement | null = null
// The second the next player starts at: the address's ?t=, once
let startSecond = 0
// Bumped by every new film, and by every new player or stage, so work begun for an older one drops its result
let loads = 0
let players = 0

const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)

// The address bar names a film of the library while it is open, so the address can be shared
function nameInAddress (name: string | null) {
  const url = new URL(window.location.href)
  if (name) url.searchParams.set(FILM_PARAM, name)
  else url.searchParams.delete(FILM_PARAM)
  url.searchParams.delete(TIME_PARAM)
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
}

// Writes down where a long film is, for the next time it opens: forgotten once it has played to its end
let positionAt = -Infinity
function keepPosition (now: boolean) {
  const { entry, facts, time, ended, setPosition } = useFilmStore.getState()
  if (!entry || !facts || facts.duration < RESUME_LONGER || !player) return
  const at = performance.now()
  if (!now && at - positionAt < POSITION_MS) return
  positionAt = at
  setPosition(entry.name, ended || time < RESUME_EDGE || time > facts.duration - RESUME_EDGE ? null : Math.floor(time))
}

// The player goes; `keep` writes down where its film was first
function stopPlayer (keep = true) {
  if (keep) keepPosition(true)
  settleLook()
  players++
  player?.dispose()
  player = null
  stage?.replaceChildren()
}

// Makes the player for the loaded film on the stage, paused on its first frame unless it may start
async function startPlayer () {
  stopPlayer(false)
  const film = loaded
  const host = stage
  if (!film || !host) return
  const mine = players
  // A long film starts where it was left, unless the address names a second
  const { entry, positions } = useFilmStore.getState()
  const kept = entry && film.duration >= RESUME_LONGER && startSecond === 0 ? positions[entry.name] ?? 0 : 0
  if (kept > 0) startSecond = kept
  useFilmStore.setState({ waiting: true, playing: false, ended: false, time: 0, seekTo: null, seekDone: 0, sound: 'none', looks: false })
  const { createLivePlayer, livePixel } = await engine()
  const ratio = window.devicePixelRatio || 1
  // Drawn for the larger of the stage and the screen, so the film stays sharp when it goes full screen; never
  // above the film's own size (livePixel)
  const width = Math.max(host.clientWidth, window.screen.width) * ratio
  const height = Math.max(host.clientHeight, window.screen.height) * ratio
  const { muted, volume, rate, loop } = useFilmStore.getState()
  try {
    const made = await createLivePlayer(
      film,
      livePixel(film, width, height),
      state => {
        if (mine !== players) return
        useFilmStore.setState(state)
        keepPosition(state.ended)
      },
      problem => { if (mine === players) useFilmStore.setState({ problem, playing: false }) },
      { audio: film.audio, muted, volume, rate, loop }
    )
    if (mine !== players) {
      made.dispose()
      return
    }
    player = made
    made.canvas.className = 'h-full w-full object-contain'
    made.canvas.setAttribute('role', 'img')
    made.canvas.setAttribute('aria-label', `The film ${useFilmStore.getState().entry?.name ?? ''}`)
    host.replaceChildren(made.canvas)
    useFilmStore.setState({ waiting: false, resumedAt: kept > 0 ? kept : null })
    if (startSecond > 0) made.seek(startSecond)
    startSecond = 0
    // Motion waits for Play when reduced motion is asked for
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) made.play()
  } catch (error) {
    if (mine === players) useFilmStore.setState({ status: 'failed', problem: messageOf(error), waiting: false })
  }
}

// Reads the film, checks it and plays it. The film stays in the mode until another one is opened
export async function openFilm (entry: FilmEntry) {
  const mine = ++loads
  stopPlayer()
  loaded = null
  useFilmStore.setState({ open: true, entry, status: 'loading', facts: null, problem: '', needs: [], playing: false, ended: false, time: 0, seekTo: null, seekDone: 0, saveProblem: '', resumedAt: null })
  nameInAddress(entry.origin === 'library' ? addressName(entry.name) : null)
  try {
    const { loadFilm, MissingFiles } = await engine()
    try {
      // A library film's sound is named in its meta.json; another's came beside it
      const audio = entry.origin === 'library' ? await libraryAudio(entry.name) : entry.audio ?? null
      if (mine !== loads) return
      const film = await loadFilm(entry.name, entry.text, given, audio)
      if (mine !== loads) return
      loaded = film
      useFilmStore.setState({
        status: 'ready',
        facts: {
          kind: film.kind,
          duration: film.duration,
          fps: film.fps,
          width: film.width,
          height: film.height,
          notes: film.notes,
          audio: film.audio !== null,
          chapters: film.chapters
        }
      })
      useFilmStore.getState().remember(entry)
      void startPlayer()
    } catch (error) {
      if (mine !== loads) return
      useFilmStore.setState({ status: 'failed', problem: messageOf(error), needs: error instanceof MissingFiles ? error.names : [] })
    }
  } catch {
    if (mine === loads) useFilmStore.setState({ status: 'failed', problem: 'The film player could not be loaded' })
  }
}

// A film of the library by its folder's name or its path in films/; it is kept under its path
export async function openLibraryFilm (name: string) {
  const path = resolveLibraryFilm(name)
  const text = path ? await libraryText(path) : null
  if (path === null || text === null) {
    useFilmStore.setState({ open: true, status: 'failed', problem: `The library has no film called ${name}` })
    return
  }
  await openFilm({ name: path, text, origin: 'library' })
}

// Files from the picker or a drop: films, the films a reel names, the pictures a film draws and a sound to
// play under it. The film to play is a reel when one came, else the first film; with no film among them they
// complete the one waiting, and a sound alone goes under the film in the mode
export async function openFiles (files: File[]) {
  const films: FilmEntry[] = []
  const ignored: string[] = []
  let audio: string | undefined
  for (const file of files) {
    if (FILM_FILE.test(file.name)) {
      const text = await file.text()
      given.set(baseName(file.name), { text })
      films.push({ name: file.name, text, origin: 'file' })
    } else if (PICTURE_FILE.test(file.name) || file.type.startsWith('image/')) {
      given.set(baseName(file.name), { url: URL.createObjectURL(file) })
    } else if (!audio && (SOUND_FILE.test(file.name) || file.type.startsWith('audio/'))) {
      audio = URL.createObjectURL(file)
    } else {
      ignored.push(file.name)
    }
  }
  if (films.length > 0) {
    const reel = films.find(film => /"clips"\s*:/.test(film.text))
    await openFilm({ ...(reel ?? films[0]), audio })
    return
  }
  const state = useFilmStore.getState()
  if (state.entry && audio) {
    await openFilm({ ...state.entry, origin: state.entry.origin === 'library' ? 'file' : state.entry.origin, audio })
  } else if (state.entry && state.needs.length > 0) {
    await openFilm(state.entry)
  } else if (ignored.length > 0) {
    useFilmStore.setState({ open: true, status: state.status === 'ready' ? 'ready' : 'failed', problem: `${ignored.join(', ')}: not a film. A film is a .json or .js file` })
  }
}

// Text pasted onto the page: a film's JSON or its script
export function openPasted (text: string) {
  const json = text.trim().startsWith('{')
  void openFilm({ name: json ? 'pasted.json' : 'pasted.js', text, origin: 'paste' })
}

// The scene on the page as a film, to play, edit or render
export async function openFromScene () {
  const { filmFromScene } = await engine()
  void openFilm({ name: 'scene.json', text: JSON.stringify(filmFromScene(), null, 2) + '\n', origin: 'scene' })
}

// The film named in the address, when the page opens with one
export function openFromAddress () {
  const params = new URL(window.location.href).searchParams
  const name = params.get(FILM_PARAM)
  if (!name) return
  const file = resolveLibraryFilm(name)
  if (!file) return
  startSecond = Math.max(0, Number(params.get(TIME_PARAM)) || 0)
  void openLibraryFilm(file)
}

// The stage the film plays on: given when the mode opens, taken back when it closes
export function attachStage (host: HTMLElement | null) {
  stopPlayer()
  if (!host) {
    stage = null
    return
  }
  stage = host
  if (loaded) void startPlayer()
}

// Mutes or unmutes the film's sound, and remembers it; a sound the browser held muted is turned on
export function toggleMuted () {
  const { muted, sound, setMuted } = useFilmStore.getState()
  const next = sound === 'blocked' ? false : !muted
  setMuted(next)
  player?.setMuted(next)
}

// The sound's loudness, 0 to 1, remembered; a loudness above nothing turns a muted sound on, as a player does
export function setFilmVolume (volume: number) {
  const level = Math.max(0, Math.min(1, volume))
  const { muted, sound, setVolume } = useFilmStore.getState()
  setVolume(level)
  player?.setVolume(level)
  if (level > 0 && (muted || sound === 'blocked')) toggleMuted()
}

// Film seconds a clock second, for this film and the next until the page reloads
export function setFilmRate (rate: number) {
  useFilmStore.getState().setRate(rate)
  player?.setRate(rate)
}

// Whether a film that ends starts again, remembered
export function toggleLoop () {
  const loop = !useFilmStore.getState().loop
  useFilmStore.getState().setLoop(loop)
  player?.setLoop(loop)
}

export function togglePlaying () {
  if (!player) return
  if (useFilmStore.getState().playing) player.pause()
  else player.play()
}

// The viewer's own turn of a 3D film's camera, in degrees over the film's Orbit and Elevation: view only, as
// film_render.ts says, and never in a saved video
const look = { yaw: 0, pitch: 0 }
let lookTimer = 0
let lookFrame = 0

function showLook () {
  player?.setLook(look.yaw, look.pitch)
  const turned = look.yaw !== 0 || look.pitch !== 0
  if (useFilmStore.getState().turned !== turned) useFilmStore.setState({ turned })
}

// The camera is the film's own again at once, with nothing waiting to ease it back
function settleLook () {
  window.clearTimeout(lookTimer)
  cancelAnimationFrame(lookFrame)
  look.yaw = 0
  look.pitch = 0
  showLook()
}

// Turns the camera by these degrees: right and up are positive. Whatever was easing it back stops
export function turnFilm (yaw: number, pitch: number) {
  window.clearTimeout(lookTimer)
  cancelAnimationFrame(lookFrame)
  look.yaw += yaw
  look.pitch = Math.max(-LOOK_PITCH_REACH, Math.min(LOOK_PITCH_REACH, look.pitch + pitch))
  showLook()
}

// The viewer has let go: after a moment the camera eases back to the film's, the short way round; with
// reduced motion asked for, or `now`, it is back at once
export function releaseLook (now = false) {
  window.clearTimeout(lookTimer)
  cancelAnimationFrame(lookFrame)
  if (look.yaw === 0 && look.pitch === 0) return
  if (now || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settleLook()
    return
  }
  // A whole turn is the same camera: the way back is never longer than half of one
  look.yaw -= 360 * Math.round(look.yaw / 360)
  lookTimer = window.setTimeout(() => {
    let last = performance.now()
    const ease = (at: number) => {
      const keep = Math.exp(-LOOK_BACK_RATE * Math.max(0, at - last) / 1000)
      last = at
      look.yaw *= keep
      look.pitch *= keep
      if (Math.abs(look.yaw) < LOOK_SETTLED && Math.abs(look.pitch) < LOOK_SETTLED) {
        settleLook()
        return
      }
      showLook()
      lookFrame = requestAnimationFrame(ease)
    }
    lookFrame = requestAnimationFrame(ease)
  }, LOOK_BACK_AFTER_MS)
}

// Goes to the film's second `second`; it plays on from there if it was playing
export function seekFilm (second: number) {
  player?.seek(Math.max(0, second))
}

// Moves by `seconds` from the second shown or sought: the seek buttons and keys
export function seekFilmBy (seconds: number) {
  if (!player) return
  seekFilm(useFilmStore.getState().time + seconds)
}

// Moves by whole frames: a frame back or on, while the film is paused
export function stepFilm (frames: number) {
  player?.step(frames)
}

export const FILM_SEEK_STEP = SEEK_STEP
export const FILM_SEEK_LONG_STEP = SEEK_LONG_STEP

// The film of the library before or after the one in the mode, in the library's order: a part counts as
// the film it belongs to. Null for a film from outside the library, and at either end
export function libraryNeighbour (step: 1 | -1) {
  const entry = useFilmStore.getState().entry
  if (entry?.origin !== 'library') return null
  const key = entry.name.toLowerCase()
  const index = LIBRARY.findIndex(film => film.path === key || film === libraryFilmOf(key))
  return index < 0 ? null : LIBRARY[index + step] ?? null
}

export async function openNeighbour (step: 1 | -1) {
  const film = libraryNeighbour(step)
  if (film) await openLibraryFilm(film.path)
}

// The address that opens the film in the mode at the second on screen, for a film of the library; null for
// another, which has no address
export function filmLink () {
  const { entry, time } = useFilmStore.getState()
  if (entry?.origin !== 'library') return null
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(FILM_PARAM, addressName(entry.name))
  const second = Math.floor(time)
  if (second > 0) url.searchParams.set(TIME_PARAM, String(second))
  return url.href
}

export async function copyFilmLink () {
  const link = filmLink()
  if (!link) return false
  try {
    await navigator.clipboard.writeText(link)
    return true
  } catch {
    return false
  }
}

// The mode is closed: the film rests and the address forgets it; the film stays loaded for next time
export function leaveFilms () {
  attachStage(null)
  nameInAddress(null)
}

export function saveFilmFile () {
  const entry = useFilmStore.getState().entry
  if (!entry) return
  const type = /\.json$/i.test(entry.name) ? 'application/json' : 'text/javascript'
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([entry.text], { type }))
  link.download = baseName(entry.name)
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
}

export async function copyFilmText () {
  const entry = useFilmStore.getState().entry
  if (!entry) return false
  try {
    await navigator.clipboard.writeText(entry.text)
    return true
  } catch {
    return false
  }
}

// Draws the film into an mp4 on this device and saves it; the stage holds still meanwhile
export async function saveVideo () {
  const { entry, quality } = useFilmStore.getState()
  const film = loaded
  if (!entry || !film) return
  const startedAt = performance.now()
  useFilmStore.setState({ saving: { frame: 0, frames: film.frames, startedAt }, saveProblem: '' })
  player?.hold(true)
  const [{ renderLoaded }, { filmProgress }] = await Promise.all([engine(), import('./film_render')])
  const timer = window.setInterval(() => {
    const progress = filmProgress()
    if (progress.frames > 0) useFilmStore.setState({ saving: { frame: progress.frame, frames: progress.frames, startedAt } })
  }, PROGRESS_MS)
  try {
    await renderLoaded(film, quality, `${baseName(entry.name).replace(/\.(json|m?js)$/i, '')}.mp4`)
  } catch (error) {
    const message = messageOf(error)
    if (!/cancelled/i.test(message)) useFilmStore.setState({ saveProblem: message.split('\n')[0] })
  } finally {
    window.clearInterval(timer)
    useFilmStore.setState({ saving: null })
    player?.hold(false)
  }
}

export async function cancelVideo () {
  const { cancelFilm } = await import('./film_render')
  cancelFilm()
}
