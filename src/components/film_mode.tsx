import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  Check, ChevronRight, Clapperboard, Copy, Download, FastForward, FileDown, FolderOpen, Pause, Play, Rewind, RotateCcw, Volume2, VolumeX, WandSparkles, X
} from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn, isTextEntry } from '@/lib/utils'
import { FILM_QUALITIES, useFilmStore } from '../store/film_store'
import { useParticleStore } from '../store/particle_store'
import { useFractalStore } from '../store/fractal_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { closeIntroDebugger } from '../lib/intro_dock'
import { LIBRARY, libraryDetails, libraryFilmOf, loadLibraryDetails, type LibraryFilm } from '../lib/film_library'
import {
  FILM_SEEK_LONG_STEP, FILM_SEEK_STEP, attachStage, cancelVideo, copyFilmText, leaveFilms, openFiles, openFilm, openFromAddress,
  openFromScene, openLibraryFilm, openPasted, saveFilmFile, saveVideo, seekFilm, seekFilmBy, stepFilm, toggleMuted, togglePlaying
} from '../lib/film_session'
import ToggleButton from './controls/toggle_button'
import { SettingsRow } from './controls/settings_section'

// The page's film mode: a film played live on a stage beside its panel, from a file, a drop, a paste, the
// library of this repository's films or the scene itself, and saved as its file or an mp4. What it does is
// film_session.ts; the engine loads with the first film. The button that opens it sits in the scene toolbar
// (control_panel.tsx)

const PANEL_ID = 'films-panel'
const TOGGLE_SELECTOR = '[data-films-toggle]'
const ACCEPT = '.json,.js,.png,.jpg,.jpeg,.webp,.gif,.avif,.m4a,.mp3,.wav,.ogg,.opus,.aac,.flac,.webm'
const QUALITY_LABELS = { medium: 'Medium', high: 'High', max: 'Max' } as const
const KIND_LABELS = { film: 'Film', fractal: 'Mandelbrot film', reel: 'Reel' } as const
const COPIED_MS = 1500

const canSaveVideo = typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'

const ACTION = 'h-7 gap-1.5 border-neon-cyan/50 px-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'
const QUIET_ACTION = 'h-7 gap-1.5 border-text-light/40 px-2 font-mono text-xs text-text-light/80 hover:bg-neon-cyan/20 hover:text-neon-cyan'

// m:ss, the way a player shows time; with tenths, m:ss.t, where a seek or a frame step must read
function clock (seconds: number, tenths = false) {
  if (tenths) {
    const at = Math.max(0, Math.floor(seconds * 10)) / 10
    return `${Math.floor(at / 60)}:${(at % 60).toFixed(1).padStart(4, '0')}`
  }
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The share of the track a second stands at, in percent
const shareOf = (second: number, duration: number) => duration > 0 ? Math.max(0, Math.min(100, second / duration * 100)) : 0
// How far a finger moves sideways on the timeline before it seeks, so a scroll that lands on it does not
const TOUCH_SLOP = 8

const spokenSeconds = (seconds: number) => `${Math.floor(seconds)} seconds`

// The toolbar button, the one place the mode opens and closes. A leaf: opening the mode re-renders this
// button and nothing else of the toolbar
export function FilmToggle ({ className }: { className: string }) {
  const open = useFilmStore(state => state.open)
  const setOpen = useFilmStore(state => state.setOpen)
  return (
    <Button
      variant="outline"
      size="icon"
      data-films-toggle=""
      aria-label="Films"
      aria-expanded={open}
      aria-controls={open ? PANEL_ID : undefined}
      title={open ? 'Close films' : 'Films'}
      onClick={() => setOpen(!open)}
      className={className}
    >
      <Clapperboard aria-hidden="true" className="h-4 w-4" />
    </Button>
  )
}

// One hidden picker for the page, so every Open button and the empty stage open the same dialog
let picker: HTMLInputElement | null = null
function pickFiles () {
  if (!picker) {
    picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = ACCEPT
    picker.multiple = true
    picker.addEventListener('change', () => {
      const files = [...(picker?.files ?? [])]
      if (picker) picker.value = ''
      if (files.length > 0) void openFiles(files)
    })
  }
  picker.click()
}

// A film dropped anywhere on the page opens in the mode. Always mounted, and it opens the film the
// address names when the page starts with one
export function FilmDrop () {
  const [over, setOver] = useState(false)

  useEffect(() => {
    openFromAddress()
    // dragenter and dragleave fire for every element crossed; the count says whether the drag is still over the page
    let depth = 0
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth++
      setOver(true)
    }
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const overPage = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth = 0
      setOver(false)
      const files = [...(event.dataTransfer?.files ?? [])]
      if (files.length > 0) void openFiles(files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overPage)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overPage)
      window.removeEventListener('drop', drop)
    }
  }, [])

  if (!over) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-[80] flex items-center justify-center border-2 border-dashed border-neon-cyan bg-[rgba(10,10,15,0.96)]">
      <p className="font-orbitron text-sm tracking-[1px] text-neon-cyan">DROP TO PLAY THE FILM</p>
    </div>
  )
}

// The time shown and the film's length, in its own leaf: it changes as the film plays
function TimeReadout () {
  const time = useFilmStore(state => state.time)
  const duration = useFilmStore(state => state.facts?.duration ?? 0)
  const seeking = useFilmStore(state => state.seekTo !== null)
  return (
    <span className={cn('shrink-0 font-mono text-xs tabular-nums', seeking ? 'text-neon-cyan' : 'text-text-light/90')}>
      {clock(time, true)}<span className="text-text-light/50"> / {clock(duration)}</span>
    </span>
  )
}

// Keys the timeline takes while it has the focus, as a slider does: the seconds each moves by, or a frame
type SeekKey = { by: number } | { to: 'start' | 'end' } | { frames: number }
const TIMELINE_KEYS: Record<string, SeekKey> = {
  ArrowLeft: { by: -FILM_SEEK_STEP },
  ArrowDown: { by: -FILM_SEEK_STEP },
  ArrowRight: { by: FILM_SEEK_STEP },
  ArrowUp: { by: FILM_SEEK_STEP },
  PageDown: { by: -FILM_SEEK_LONG_STEP },
  PageUp: { by: FILM_SEEK_LONG_STEP },
  Home: { to: 'start' },
  End: { to: 'end' },
  ',': { frames: -1 },
  '.': { frames: 1 }
}

function seekByKey (key: SeekKey, duration: number) {
  if ('by' in key) seekFilmBy(key.by)
  else if ('to' in key) seekFilm(key.to === 'start' ? 0 : duration)
  else stepFilm(key.frames)
}

// Where the film is and where it can go: a click or a drag on the track seeks there (on release, so a drag
// across the film starts no work until it ends), a finger only after a sideways slop or a tap, and the keys of
// a slider while it has the focus. A seek far ahead or behind takes the time the frames before it take to
// step: the track shows how much of that is done, and the frame stays until the new one is there
function Timeline () {
  const time = useFilmStore(state => state.time)
  const duration = useFilmStore(state => state.facts?.duration ?? 0)
  const seekTo = useFilmStore(state => state.seekTo)
  const seekDone = useFilmStore(state => state.seekDone)
  // Nothing to seek while a film loads or its player is made: the track stays, idle
  const waiting = useFilmStore(state => state.waiting || state.status !== 'ready')
  const track = useRef<HTMLDivElement>(null)
  // The second under a pointer that drags, and under one that only hovers
  const [scrub, setScrub] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  // A finger that landed and has not yet shown which way it goes
  const touch = useRef<{ id: number, x: number, y: number } | null>(null)

  const secondAt = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || box.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * duration
  }
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setScrub(secondAt(event.clientX))
  }
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (waiting || event.button !== 0) return
    if (event.pointerType === 'touch') {
      touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      return
    }
    event.preventDefault()
    event.currentTarget.focus()
    startDrag(event)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const landed = touch.current
    if (landed && landed.id === event.pointerId && scrub === null) {
      const dx = Math.abs(event.clientX - landed.x)
      const dy = Math.abs(event.clientY - landed.y)
      if (dy > TOUCH_SLOP && dy >= dx) touch.current = null
      else if (dx > TOUCH_SLOP) {
        touch.current = null
        startDrag(event)
      }
      return
    }
    if (scrub !== null) setScrub(secondAt(event.clientX))
    else if (event.pointerType === 'mouse') setHover(secondAt(event.clientX))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const landed = touch.current
    touch.current = null
    if (scrub !== null) {
      seekFilm(secondAt(event.clientX))
      setScrub(null)
    } else if (landed && landed.id === event.pointerId) {
      // A tap seeks where it fell
      seekFilm(secondAt(event.clientX))
    }
  }
  const onPointerCancel = () => {
    touch.current = null
    setScrub(null)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey || waiting) return
    // Space and K play and pause here too, as on the page
    if (!event.repeat && (event.key === ' ' || event.key.toLowerCase() === 'k')) {
      event.preventDefault()
      togglePlaying()
      return
    }
    const key = TIMELINE_KEYS[event.key]
    if (!key) return
    event.preventDefault()
    seekByKey(key, duration)
  }

  const shown = scrub ?? time
  const share = shareOf(shown, duration)
  const label = scrub ?? hover
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(shown * 10) / 10}
      aria-valuetext={`${spokenSeconds(shown)} of ${spokenSeconds(duration)}${seekTo !== null ? ', seeking' : ''}`}
      aria-disabled={waiting || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End , ."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={() => setScrub(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className="group relative h-8 min-w-0 flex-1 cursor-pointer touch-pan-y select-none outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-text-light/10 transition-[height] duration-100 group-hover:h-2">
        <div className="absolute inset-y-0 left-0 bg-neon-cyan" style={{ width: `${share}%` }} />
      </div>
      {seekTo !== null && (
        // How much of the frames before the sought one are stepped
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0.5 h-0.5 bg-text-light/10">
          <div className="absolute inset-y-0 left-0 bg-neon-cyan/70" style={{ width: `${Math.round(seekDone * 100)}%` }} />
        </div>
      )}
      <div aria-hidden="true" className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-neon-cyan" style={{ left: `${share}%` }} />
      {label !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-6 -translate-x-1/2 whitespace-nowrap bg-[rgb(10,10,15)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-neon-cyan"
          style={{ left: `${shareOf(label, duration)}%` }}
        >
          {clock(label, true)}
        </span>
      )}
      <span role="status" className="sr-only">{seekTo !== null ? `Seeking to ${spokenSeconds(seekTo)}` : ''}</span>
    </div>
  )
}

const TRANSPORT_BUTTON = 'h-8 w-8 shrink-0 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'

// The sound's switch, in its own leaf, for a film that has a sound. A sound the browser held muted, since the
// person had not touched the page yet, asks to be turned on with a solid fill
function SoundButton () {
  const sound = useFilmStore(state => state.sound)
  if (sound === 'none') return null
  const label = sound === 'on' ? 'Mute' : 'Turn the sound on'
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      aria-pressed={sound !== 'on'}
      aria-keyshortcuts="M"
      title={`${label} (M)`}
      onClick={toggleMuted}
      className={cn(TRANSPORT_BUTTON, sound === 'blocked' && 'bg-neon-cyan text-black hover:bg-neon-cyan/80 hover:text-black')}
    >
      {sound === 'on' ? <Volume2 aria-hidden="true" className="h-4 w-4" /> : <VolumeX aria-hidden="true" className="h-4 w-4" />}
    </Button>
  )
}

function Transport () {
  const playing = useFilmStore(state => state.playing)
  const ended = useFilmStore(state => state.ended)
  const waiting = useFilmStore(state => state.waiting || state.status !== 'ready')
  const label = playing ? 'Pause' : ended ? 'Play again' : 'Play'
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-t border-neon-cyan/20 bg-[rgba(10,10,15,0.95)] px-3">
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        aria-keyshortcuts="Space"
        title={`${label} (Space)`}
        disabled={waiting}
        onClick={togglePlaying}
        className={TRANSPORT_BUTTON}
      >
        {playing
          ? <Pause aria-hidden="true" className="h-4 w-4" />
          : ended ? <RotateCcw aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Back ${FILM_SEEK_STEP} seconds`}
        aria-keyshortcuts="ArrowLeft"
        title={`Back ${FILM_SEEK_STEP} s (←)`}
        disabled={waiting}
        onClick={() => seekFilmBy(-FILM_SEEK_STEP)}
        className={TRANSPORT_BUTTON}
      >
        <Rewind aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Forward ${FILM_SEEK_STEP} seconds`}
        aria-keyshortcuts="ArrowRight"
        title={`Forward ${FILM_SEEK_STEP} s (→)`}
        disabled={waiting}
        onClick={() => seekFilmBy(FILM_SEEK_STEP)}
        className={TRANSPORT_BUTTON}
      >
        <FastForward aria-hidden="true" className="h-4 w-4" />
      </Button>
      <TimeReadout />
      <Timeline />
      <SoundButton />
    </div>
  )
}

// What the stage says while it has no picture: how to bring a film, why one could not play, or that it is coming
function StageMessage () {
  const status = useFilmStore(state => state.status)
  const problem = useFilmStore(state => state.problem)
  const needs = useFilmStore(state => state.needs)
  const waiting = useFilmStore(state => state.waiting)

  if (status === 'loading' || (status === 'ready' && waiting)) {
    return <p role="status" className="font-mono text-xs text-text-light/80">Preparing the film…</p>
  }
  if (status === 'failed') {
    return (
      <div role="alert" className="flex max-w-xl flex-col items-center gap-3 text-center">
        <p className="font-orbitron text-xs tracking-[1px] text-neon-cyan">{needs.length > 0 ? 'FILES MISSING' : 'THE FILM DID NOT LOAD'}</p>
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap text-left font-mono text-xs leading-5 text-text-light/90">{problem}</pre>
        <Button variant="outline" onClick={pickFiles} className={ACTION}>
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          {needs.length > 0 ? 'OPEN THE FILES' : 'OPEN ANOTHER FILM'}
        </Button>
      </div>
    )
  }
  if (status === 'empty') {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-neon-cyan/40 px-10 py-8 text-center">
        <Clapperboard aria-hidden="true" className="h-6 w-6 text-neon-cyan" />
        <p className="font-orbitron text-xs tracking-[1px] text-neon-cyan">DROP A FILM HERE</p>
        <p className="font-mono text-xs text-text-light/80">A .json or .js film, or paste its text</p>
        <Button variant="outline" onClick={pickFiles} className={ACTION}>
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          OPEN FILE
        </Button>
      </div>
    )
  }
  return null
}

// A problem met while the film plays, over the picture's foot, so the frame it stopped on stays in view
function PlayProblem () {
  const status = useFilmStore(state => state.status)
  const problem = useFilmStore(state => state.problem)
  if (status !== 'ready' || !problem) return null
  return <p role="alert" className="absolute inset-x-3 bottom-3 bg-[rgba(10,10,15,0.9)] p-2 font-mono text-xs text-text-light/90">{problem}</p>
}

// Where the film plays: right of the panel, clear of the toolbar above it, with its transport at the foot
function Stage () {
  const ready = useFilmStore(state => state.status === 'ready')
  const hasFilm = useFilmStore(state => state.entry !== null)
  const waiting = useFilmStore(state => state.waiting)
  const host = useCallback((node: HTMLDivElement | null) => attachStage(node), [])
  return (
    <div className="fixed inset-y-0 left-[340px] right-0 z-40 flex flex-col bg-black max-sm:inset-x-0 max-sm:bottom-[45vh] max-sm:left-0">
      <div className="relative min-h-0 flex-1 px-3 pb-3 pt-[60px]">
        <div ref={host} className={cn('h-full w-full', (!ready || waiting) && 'invisible')} />
        <div className="absolute inset-0 flex items-center justify-center px-6 pt-[48px]">
          <StageMessage />
        </div>
        <PlayProblem />
      </div>
      {/* The transport stays while one film gives way to the next, so the stage keeps its height */}
      {hasFilm && <Transport />}
    </div>
  )
}

// A heading of the panel, on the same edge as the rows below it
function Heading ({ id, children }: { id: string, children: ReactNode }) {
  return <h3 id={id} className="pl-3 pt-1 font-orbitron text-xs tracking-[0.5px] text-neon-cyan">{children}</h3>
}

/// What the second row of the card says of a film from outside the library
const ORIGIN_LABELS = { library: '', file: 'opened from a file', paste: 'pasted', scene: 'made from the scene' } as const

// What a film of the library's meta.json says beyond its title: there at once once the film mode has fetched
// the meta files (loadLibraryDetails, asked as the mode opens), and read again the moment they arrive
function useDetails (path: string | null) {
  const [, setArrived] = useState(false)
  useEffect(() => {
    let current = true
    void loadLibraryDetails().then(() => { if (current) setArrived(true) })
    return () => { current = false }
  }, [])
  return path ? libraryDetails(path) : null
}

// The film in the mode: its title, where it is from, its line, its frame and length, who made it and what the
// planner changed in it. Every row has its height whatever the film, whether it is still loading and
// whether its meta.json has come, so switching films moves nothing below the card; only the notes, opened on
// request, grow it
function NowLoaded () {
  const entry = useFilmStore(state => state.entry)
  const facts = useFilmStore(state => state.facts)
  const status = useFilmStore(state => state.status)
  const notesId = useId()
  // The film whose notes are open, so a new film opens with them closed
  const [notesOf, setNotesOf] = useState<string | null>(null)
  // A film of the library is told by its meta.json: its title, its line and who made it
  const film = entry?.origin === 'library' ? libraryFilmOf(entry.name) : null
  const details = useDetails(film && entry ? entry.name : null)
  if (!entry) return null
  const own = film !== null && film.path === entry.name.toLowerCase()
  const title = film?.title ?? entry.name
  const where = film ? (own ? film.name : entry.name) : ORIGIN_LABELS[entry.origin]
  const about = film ? (own ? details?.about ?? '' : `A part of ${film.title}`) : ''
  const makers = [...new Set(details?.made.map(line => line.model) ?? [])]
  const made = film && !details ? '' : makers.length > 0 ? `Made by ${makers.join(', ')}` : 'Maker not recorded'
  const factsLine = facts
    ? `${KIND_LABELS[facts.kind]} · ${facts.width}×${facts.height} · ${facts.fps} fps · ${clock(facts.duration)}${facts.audio ? ' · sound' : ''}`
    : status === 'failed' ? 'Did not load' : 'Reading the film…'
  const notes = facts?.notes ?? []
  const notesOpen = notesOf === entry.name && notes.length > 0
  return (
    <div className="flex flex-col bg-text-light/[0.06] px-3 py-2">
      <p className="h-5 truncate text-sm leading-5 text-text-light" title={title}>{title}</p>
      <p className="h-5 truncate font-mono text-xs leading-5 text-text-light/70" title={entry.name}>{where}</p>
      <p className="mt-1 line-clamp-2 h-10 text-xs leading-5 text-text-light/80" title={about || undefined}>{about}</p>
      <p className="mt-1 h-5 truncate font-mono text-xs leading-5 text-text-light/70">{factsLine}</p>
      <div className="flex h-5 items-center gap-2 font-mono text-xs leading-5 text-text-light/70">
        <span className="min-w-0 flex-1 truncate" title={made || undefined}>{made}</span>
        {notes.length > 0 && (
          <button
            type="button"
            aria-expanded={notesOpen}
            aria-controls={notesId}
            onClick={() => setNotesOf(notesOpen ? null : entry.name)}
            className="shrink-0 underline decoration-text-light/30 underline-offset-2 hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
          >
            {notes.length === 1 ? '1 note' : `${notes.length} notes`}
          </button>
        )}
      </div>
      {notesOpen && (
        <ul id={notesId} className="mt-1 flex list-disc flex-col gap-1 pl-4 font-mono text-xs text-text-light/70">
          {notes.map((note, index) => <li key={index}>{note}</li>)}
        </ul>
      )}
    </div>
  )
}

function OpenActions () {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <Heading id={headingId}>OPEN</Heading>
      <div className="grid grid-cols-2 gap-1">
        <div data-hint="A .json or .js film; drop or paste works" data-hint-label="Open file">
          <Button variant="outline" onClick={pickFiles} className={cn(ACTION, 'w-full')}>
            <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
            OPEN FILE
          </Button>
        </div>
        <div data-hint="A film of the scene as it is set now" data-hint-label="From scene">
          <Button variant="outline" onClick={() => { void openFromScene() }} className={cn(ACTION, 'w-full')}>
            <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
            FROM SCENE
          </Button>
        </div>
      </div>
    </section>
  )
}

interface FilmRowProps {
  name: string
  current: boolean
  onOpen: () => void
  onForget?: () => void
  // Quiet words after the name: a film's kind, a take's makers
  aside?: string
  // The parts of a film, opened and closed by a button at the row's end
  parts?: { open: boolean, onToggle: () => void, controls: string }
}

const ROW_SIDE_BUTTON = 'flex w-7 items-center justify-center bg-text-light/[0.06] text-text-light/60 hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan'

// One film to open: the one in the mode is marked as current
function FilmRow ({ name, current, onOpen, onForget, aside, parts }: FilmRowProps) {
  return (
    <div className="flex h-7 items-stretch">
      <button
        type="button"
        aria-current={current || undefined}
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 border-l-2 pl-[10px] pr-2 text-left font-mono text-xs transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan',
          current ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan' : 'border-transparent bg-text-light/[0.06] text-text-light/90 hover:bg-neon-cyan/10 hover:text-neon-cyan'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {aside && <span className="shrink-0 text-[11px] text-text-light/50">{aside}</span>}
      </button>
      {parts && (
        <button
          type="button"
          aria-label={`Parts of ${name}`}
          aria-expanded={parts.open}
          aria-controls={parts.controls}
          title={parts.open ? 'Hide parts' : 'Show parts'}
          onClick={parts.onToggle}
          className={ROW_SIDE_BUTTON}
        >
          <ChevronRight aria-hidden="true" className={cn('h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none', parts.open && 'rotate-90')} />
        </button>
      )}
      {onForget && (
        <button
          type="button"
          aria-label={`Remove ${name} from recent films`}
          title="Remove from recent"
          onClick={onForget}
          className={ROW_SIDE_BUTTON}
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// What the library's list says of a kind beside a film's title; a plain film needs no word
const KIND_ASIDE = { film: '', fractal: 'fractal', reel: 'reel' } as const

// A film of the library by its title, with its parts (a reel's clips, other voices, posters, takes) under it
// on request; a film whose part is open shows its parts from the start
function LibraryRow ({ film, current }: { film: LibraryFilm, current: string | undefined }) {
  const partsId = useId()
  const holdsCurrent = current !== undefined && film.parts.some(part => part.path === current)
  const [open, setOpen] = useState(holdsCurrent)
  useEffect(() => {
    if (holdsCurrent) setOpen(true)
  }, [holdsCurrent])
  return (
    <li className="flex flex-col gap-px">
      <FilmRow
        name={film.title}
        aside={film.kind ? KIND_ASIDE[film.kind] : undefined}
        current={film.path === current}
        onOpen={() => { void openLibraryFilm(film.path) }}
        parts={film.parts.length > 0 ? { open, onToggle: () => setOpen(!open), controls: partsId } : undefined}
      />
      {film.parts.length > 0 && open && (
        <ul id={partsId} aria-label={`Parts of ${film.title}`} className="flex flex-col gap-px pl-3">
          {film.parts.map(part => (
            <li key={part.path}>
              <FilmRow
                name={part.label}
                current={part.path === current}
                onOpen={() => { void openLibraryFilm(part.path) }}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Library () {
  const recent = useFilmStore(state => state.recent)
  const forget = useFilmStore(state => state.forget)
  const current = useFilmStore(state => state.entry?.name)
  const recentId = useId()
  const libraryId = useId()
  return (
    <>
      {recent.length > 0 && (
        <section aria-labelledby={recentId} className="flex flex-col gap-1">
          <Heading id={recentId}>RECENT</Heading>
          <ul className="flex flex-col gap-px">
            {recent.map(film => (
              <li key={film.name}>
                <FilmRow
                  name={film.name}
                  current={film.name === current}
                  onOpen={() => { void openFilm({ name: film.name, text: film.text, origin: 'file' }) }}
                  onForget={() => forget(film.name)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby={libraryId} className="flex flex-col gap-1">
        <Heading id={libraryId}>LIBRARY</Heading>
        <ul className="flex flex-col gap-px">
          {LIBRARY.map(film => <LibraryRow key={film.name} film={film} current={current?.toLowerCase()} />)}
        </ul>
      </section>
    </>
  )
}

function QualityChoice ({ disabled }: { disabled: boolean }) {
  const quality = useFilmStore(state => state.quality)
  const setQuality = useFilmStore(state => state.setQuality)
  return (
    <SettingsRow label="Video quality" help="Higher: sharper video, larger file">
      {(describedBy) => (
        <div role="radiogroup" aria-label="Video quality" aria-describedby={describedBy} className="flex">
          {FILM_QUALITIES.map(choice => (
            <ToggleButton
              key={choice}
              role="radio"
              aria-checked={quality === choice}
              aria-pressed={undefined}
              active={quality === choice}
              disabled={disabled}
              onClick={() => setQuality(choice)}
              className="h-7 w-[3.75rem] px-0 font-mono text-xs"
            >
              {QUALITY_LABELS[choice]}
            </ToggleButton>
          ))}
        </div>
      )}
    </SettingsRow>
  )
}

function SaveVideo () {
  const saving = useFilmStore(state => state.saving)
  const ready = useFilmStore(state => state.status === 'ready')
  const problem = useFilmStore(state => state.saveProblem)
  const share = saving ? Math.round(saving.frame / Math.max(1, saving.frames) * 100) : 0
  return (
    <>
      <QualityChoice disabled={!canSaveVideo || saving !== null} />
      {saving
        ? (
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-label="Saving video"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share}
              className="relative h-7 min-w-0 flex-1 bg-text-light/[0.06]"
            >
              <div className="absolute inset-y-0 left-0 bg-neon-cyan/20" style={{ width: `${share}%` }} />
              <div className="absolute inset-y-0 w-px bg-neon-cyan" style={{ left: `${share}%` }} />
              <span className="absolute inset-0 flex items-center px-3 font-mono text-xs text-text-light/90">Saving {share}%</span>
            </div>
            <Button variant="outline" onClick={() => { void cancelVideo() }} className={QUIET_ACTION}>
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              CANCEL
            </Button>
          </div>
        )
        : (
          <div data-hint={canSaveVideo ? 'Renders the film on this device' : 'Saving video needs Chrome or Edge'} data-hint-label="Save MP4">
            <Button variant="outline" disabled={!canSaveVideo || !ready} onClick={() => { void saveVideo() }} className={cn(ACTION, 'w-full')}>
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              SAVE MP4
            </Button>
          </div>
        )}
      {problem && <p role="alert" className="pl-3 font-mono text-[11px] leading-5 text-text-light/80">{problem}</p>}
    </>
  )
}

function SaveText () {
  const entry = useFilmStore(state => state.entry)
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    if (!await copyFilmText()) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }
  return (
    <div className="grid grid-cols-2 gap-1">
      <div data-hint="The film's own file, to edit or share" data-hint-label="Film file">
        <Button variant="outline" disabled={!entry} onClick={saveFilmFile} className={cn(QUIET_ACTION, 'w-full')}>
          <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
          FILM FILE
        </Button>
      </div>
      <div data-hint="Copies the film's text to the clipboard" data-hint-label="Copy">
        <Button variant="outline" disabled={!entry} onClick={() => { void copy() }} className={cn(QUIET_ACTION, 'w-full')}>
          {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
          {copied ? 'COPIED' : 'COPY'}
        </Button>
      </div>
      <span role="status" className="sr-only">{copied ? 'Film copied' : ''}</span>
    </div>
  )
}

function ExportActions () {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <Heading id={headingId}>SAVE</Heading>
      <SaveVideo />
      <SaveText />
    </section>
  )
}

// Space and K play and pause, as in a video player, unless the focus is on a control that takes the key itself
function takesKeys (target: EventTarget | null) {
  return isTextEntry(target) ||
    (target instanceof Element && target.closest('button, a[href], summary, [role="slider"], [role="radio"], [role="switch"]') !== null)
}

// The arrows, J, L, the comma and the full stop seek, as in a video player, unless the focus is on a control
// that moves with them itself; a button does not, so they seek with the focus on Play
function takesSeekKeys (target: EventTarget | null) {
  return isTextEntry(target) ||
    (target instanceof Element && target.closest('[role="slider"], [role="radio"], [role="radiogroup"], [role="switch"], select') !== null)
}

// The page's own seek keys: the seconds or frames each moves by, beside Home and End
const PAGE_SEEK_KEYS: Record<string, SeekKey> = {
  ArrowLeft: { by: -FILM_SEEK_STEP },
  ArrowRight: { by: FILM_SEEK_STEP },
  j: { by: -FILM_SEEK_LONG_STEP },
  l: { by: FILM_SEEK_LONG_STEP },
  ',': { frames: -1 },
  '.': { frames: 1 },
  Home: { to: 'start' },
  End: { to: 'end' }
}

function FilmMode () {
  const open = useFilmStore(state => state.open)
  const setOpen = useFilmStore(state => state.setOpen)

  // The particle scene rests while the mode is open, and comes back as it was; the Mandelbrot mode and the
  // intro debugger give way to it
  useEffect(() => {
    if (!open) return
    const wasPaused = useParticleStore.getState().isPaused
    useParticleStore.setState({ isPaused: true })
    useFractalStore.getState().setOpen(false)
    closeIntroDebugger()
    return () => {
      leaveFilms()
      useParticleStore.setState({ isPaused: wasPaused })
      // A video still being saved goes with the mode
      if (useFilmStore.getState().saving) void cancelVideo()
    }
  }, [open])

  // The Mandelbrot mode and the intro debugger stand in for the film: opening either leaves the mode
  useEffect(() => {
    const leave = () => useFilmStore.getState().setOpen(false)
    const offFractal = useFractalStore.subscribe((state, before) => { if (state.open && !before.open) leave() })
    const offDebugger = useIntroDebugStore.subscribe((state, before) => { if (state.open && !before.open) leave() })
    return () => {
      offFractal()
      offDebugger()
    }
  }, [])

  // While the mode is open: Space or K plays and pauses, the seek keys seek, and a film pasted onto the page
  // opens. A seek key held down repeats; a seek asked for while one runs takes its place
  useEffect(() => {
    if (!open) return
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
      const state = useFilmStore.getState()
      if (state.status !== 'ready' || state.waiting) return
      // M mutes and unmutes, wherever the focus is but in a text field
      if (event.key.toLowerCase() === 'm' && !event.repeat && !isTextEntry(event.target)) {
        if (state.sound === 'none') return
        event.preventDefault()
        toggleMuted()
        return
      }
      const seek = PAGE_SEEK_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
      if (seek) {
        if (takesSeekKeys(event.target)) return
        event.preventDefault()
        seekByKey(seek, state.facts?.duration ?? 0)
        return
      }
      if (event.repeat || (event.key !== ' ' && event.key.toLowerCase() !== 'k')) return
      if (takesKeys(event.target)) return
      event.preventDefault()
      togglePlaying()
    }
    const paste = (event: ClipboardEvent) => {
      if (isTextEntry(event.target) || !event.clipboardData) return
      const files = [...event.clipboardData.files]
      const text = event.clipboardData.getData('text/plain')
      if (files.length > 0) void openFiles(files)
      else if (text.trim() !== '') openPasted(text)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('paste', paste)
    }
  }, [open])

  return (
    <>
      {open && <Stage />}
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          id={PANEL_ID}
          side="left"
          hideClose
          // The panel closes only on request, so the film can be watched while the panel is used
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement).focus()
          }}
          // Back to the toolbar button only when the focus was in the panel, which is gone by now
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!document.activeElement || document.activeElement === document.body) {
              document.querySelector<HTMLElement>(TOGGLE_SELECTOR)?.focus()
            }
          }}
          // A column at the left beside the stage; on a narrow screen a strip along the bottom, under the stage
          className="flex w-[min(340px,100vw)] max-h-screen flex-col gap-3 overflow-y-auto bg-[rgba(10,10,15,0.98)] p-3 pointer-events-auto outline-none sm:max-w-none
            max-sm:top-auto max-sm:bottom-0 max-sm:h-[45vh] max-sm:w-full max-sm:border-r-0 max-sm:border-t motion-reduce:!animate-none"
        >
          <SheetHeader className="sticky -top-3 z-10 -mx-3 -mt-3 min-h-[49px] flex-row items-center gap-2 space-y-0 border-b border-neon-cyan/20 bg-[rgb(10,10,15)] px-3 pb-2 pt-3 text-left sm:text-left">
            <SheetTitle className="font-orbitron text-neon-cyan text-sm tracking-[1px]" style={{ textShadow: '0 0 10px #00ffff' }}>
              FILMS
            </SheetTitle>
            <SheetDescription className="sr-only">
              Plays a film live in the browser. Open a .json or .js film, drop it on the page or paste its text; Space plays and
              pauses, the left and right arrows seek 5 seconds, J and L 10, comma and full stop a frame, Home and End to the
              start and the end, M mutes a film's sound; a sound file dropped beside a film plays under it. Escape or the Films button at the top right closes it and brings the particle scene back.
            </SheetDescription>
          </SheetHeader>
          <NowLoaded />
          <OpenActions />
          <ExportActions />
          <Library />
        </SheetContent>
      </Sheet>
    </>
  )
}

export default FilmMode
