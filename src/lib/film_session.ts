// What the film mode does (film_mode.tsx): opens a film from a file, a drop, a paste, the library or the
// scene, plays it on the stage, and saves it as a file or an mp4. The engine (film_live.ts) and the
// renderer behind it load when the first film is opened, so a visitor who never opens one downloads neither.
import { useFilmStore, type FilmEntry } from '../store/film_store'
import { baseName, isLibraryFilm, libraryText } from './film_library'
import type { GivenFile, LivePlayer, LoadedFilm } from './film_live'

const engine = () => import('./film_live')
const PROGRESS_MS = 250
// The address that opens a film of the library straight away: ?film=kerr_around
const FILM_PARAM = 'film'

const FILM_FILE = /\.(json|m?js)$/i
const PICTURE_FILE = /\.(png|jpe?g|webp|gif|avif)$/i

// Files opened beside a film, by name, for the files it names; they last as long as the page
const given = new Map<string, GivenFile>()
let loaded: LoadedFilm | null = null
let player: LivePlayer | null = null
let stage: HTMLElement | null = null
// Bumped by every new film, and by every new player or stage, so work begun for an older one drops its result
let loads = 0
let players = 0

const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)

// The address bar names a film of the library while it is open, so the address can be shared
function nameInAddress (name: string | null) {
  const url = new URL(window.location.href)
  if (name) url.searchParams.set(FILM_PARAM, name.replace(/\.(json|js)$/i, ''))
  else url.searchParams.delete(FILM_PARAM)
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
}

function stopPlayer () {
  players++
  player?.dispose()
  player = null
  stage?.replaceChildren()
}

// Makes the player for the loaded film on the stage, paused on its first frame unless it may start
async function startPlayer () {
  stopPlayer()
  const film = loaded
  const host = stage
  if (!film || !host) return
  const mine = players
  useFilmStore.setState({ waiting: true, playing: false, ended: false, time: 0 })
  const { createLivePlayer, livePixel } = await engine()
  const ratio = window.devicePixelRatio || 1
  try {
    const made = await createLivePlayer(
      film,
      livePixel(film, host.clientWidth * ratio, host.clientHeight * ratio),
      state => { if (mine === players) useFilmStore.setState(state) },
      problem => { if (mine === players) useFilmStore.setState({ problem, playing: false }) }
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
    useFilmStore.setState({ waiting: false })
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
  useFilmStore.setState({ open: true, entry, status: 'loading', facts: null, problem: '', needs: [], playing: false, ended: false, time: 0, saveProblem: '' })
  nameInAddress(entry.origin === 'library' ? entry.name : null)
  try {
    const { loadFilm, MissingFiles } = await engine()
    try {
      const film = await loadFilm(entry.name, entry.text, given)
      if (mine !== loads) return
      loaded = film
      useFilmStore.setState({
        status: 'ready',
        facts: { kind: film.kind, duration: film.duration, fps: film.fps, width: film.width, height: film.height, notes: film.notes }
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

export async function openLibraryFilm (name: string) {
  const text = await libraryText(name)
  if (text === null) {
    useFilmStore.setState({ open: true, status: 'failed', problem: `The library has no film called ${name}` })
    return
  }
  await openFilm({ name, text, origin: 'library' })
}

// Files from the picker or a drop: films, the films a reel names and the pictures a film draws. The film to
// play is a reel when one came, else the first film; with no film among them they complete the one waiting
export async function openFiles (files: File[]) {
  const films: FilmEntry[] = []
  const ignored: string[] = []
  for (const file of files) {
    if (FILM_FILE.test(file.name)) {
      const text = await file.text()
      given.set(baseName(file.name), { text })
      films.push({ name: file.name, text, origin: 'file' })
    } else if (PICTURE_FILE.test(file.name) || file.type.startsWith('image/')) {
      given.set(baseName(file.name), { url: URL.createObjectURL(file) })
    } else {
      ignored.push(file.name)
    }
  }
  if (films.length > 0) {
    const reel = films.find(film => /"clips"\s*:/.test(film.text))
    await openFilm(reel ?? films[0])
    return
  }
  const state = useFilmStore.getState()
  if (state.entry && state.needs.length > 0) {
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
  const name = new URL(window.location.href).searchParams.get(FILM_PARAM)
  if (!name) return
  const file = [name, `${name}.js`, `${name}.json`].find(isLibraryFilm)
  if (file) void openLibraryFilm(file)
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

export function togglePlaying () {
  if (!player) return
  if (useFilmStore.getState().playing) player.pause()
  else player.play()
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
  link.download = entry.name
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
  useFilmStore.setState({ saving: { frame: 0, frames: film.frames }, saveProblem: '' })
  player?.hold(true)
  const [{ renderLoaded }, { filmProgress }] = await Promise.all([engine(), import('./film_render')])
  const timer = window.setInterval(() => {
    const progress = filmProgress()
    if (progress.frames > 0) useFilmStore.setState({ saving: { frame: progress.frame, frames: progress.frames } })
  }, PROGRESS_MS)
  try {
    await renderLoaded(film, quality, `${entry.name.replace(/\.(json|m?js)$/i, '')}.mp4`)
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
