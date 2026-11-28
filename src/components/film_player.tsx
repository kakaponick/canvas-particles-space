import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ChevronsLeft, ChevronsRight, Clapperboard, FolderOpen, Gauge, Keyboard, LoaderCircle, Maximize, Minimize, Pause, Play, Repeat, RotateCcw,
  RotateCw, SkipForward, Volume1, Volume2, VolumeX, type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn, isTextEntry } from '@/lib/utils'
import { FILM_RATES, useFilmStore } from '../store/film_store'
import { clock, pickFiles, saveLeft, setFilmStage, setMenuHoldsEscape, titleOf } from '../lib/film_ui'
import {
  FILM_SEEK_LONG_STEP, FILM_SEEK_STEP, attachStage, cancelVideo, releaseLook, turnFilm, libraryNeighbour, openNeighbour, seekFilm, seekFilmBy, setFilmRate, setFilmVolume,
  stepFilm, toggleLoop, toggleMuted, togglePlaying
} from '../lib/film_session'

// The film mode's player (film_mode.tsx holds its panel): the stage the film plays on, its transport, what
// stands over the picture (the first Play, the end, a seek under way, the answer to a key), full screen and
// the keys. What each control does is film_session.ts

// The id of the library's search field, which the slash key focuses
export const LIBRARY_SEARCH_ID = 'films-library-search'
// How long the pointer may rest in full screen before the transport and the cursor step aside, in ms
const IDLE_MS = 2500
// How long the sign of an action stays over the picture, in ms: the length of its fade (index.css)
const FLASH_MS = 600
// A seek shorter than this shows no badge, so a step of a few frames does not blink one, in ms
const SEEK_BADGE_DELAY_MS = 300
// The step of the loudness keys
const VOLUME_STEP = 0.05
// How far a finger moves sideways on the timeline before it seeks, so a scroll that lands on it does not
const TOUCH_SLOP = 8
// Two taps of a finger this close in time are a double tap, in ms; a single tap waits this long to be sure
const DOUBLE_TAP_MS = 280
// Looking around a 3D film, as the page's 3D camera turns (particle_canvas.tsx, camera_keys.ts): a drag
// turns it once it has gone this many pixels, by this many degrees a pixel; a key by these degrees
const LOOK_DRAG_SLOP = 4
const LOOK_DEGREES_PER_PIXEL = 0.3
const LOOK_KEY_DEGREES = 5
const LOOK_FINE_KEY_DEGREES = 1
// The keys that turn the camera, as the page's arrows do: right and up are positive
const LOOK_KEYS: Record<string, [number, number]> = { a: [-1, 0], d: [1, 0], w: [0, 1], s: [0, -1] }
// The seconds the end of a film counts down before the next film of the library starts
const UP_NEXT_S = 5
// How long the word that a long film was taken up where it was left stays, in ms
const RESUME_NOTICE_MS = 8000
// A menu of the transport keeps this far from the window's edges, in px, and is never shorter than the least
const MENU_MARGIN = 8
const MENU_LEAST_HEIGHT = 160
// The height the scene's toolbar takes at the top of the window (control_panel.tsx), with a margin, in px
const TOOLBAR_CLEAR = 68
// What stands at the top of the picture out of full screen sits below the toolbar, which covers the stage there
const TOP_CLEAR = 'top-[64px]'

const ACTION = 'h-7 gap-1.5 border-neon-cyan/50 px-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan [@media(pointer:coarse)]:h-10'
const TRANSPORT_BUTTON = 'h-9 w-9 shrink-0 border-transparent bg-transparent text-text-light/90 hover:border-neon-cyan/50 hover:bg-neon-cyan/15 hover:text-neon-cyan ' +
  'focus-visible:border-neon-cyan [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11'
const TRANSPORT_ON = 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'

// A time as a screen reader says it: "1 minute 16 seconds"
function spokenSeconds (seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  const said = `${rest} ${rest === 1 ? 'second' : 'seconds'}`
  return minutes > 0 ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${said}` : said
}
// The share of the track a second stands at, in percent
const shareOf = (second: number, duration: number) => duration > 0 ? Math.max(0, Math.min(100, second / duration * 100)) : 0
const rateLabel = (rate: number) => rate === 1 ? 'Normal' : `${rate}×`

// The sign of an action over the picture, for a key or a click on the picture: the transport's own buttons
// show their change themselves
type FlashKind = 'play' | 'pause' | 'back' | 'forward' | 'volume' | 'muted' | 'rate' | 'jump'
interface Flash { kind: FlashKind, text: string, count: number }
let showFlash: ((flash: Flash) => void) | null = null
let flashes = 0
function flash (kind: FlashKind, text = '') {
  showFlash?.({ kind, text, count: ++flashes })
}

// A jump names where it went and needs no sign
const FLASH_ICONS: Record<FlashKind, LucideIcon | null> = { play: Play, pause: Pause, back: ChevronsLeft, forward: ChevronsRight, volume: Volume2, muted: VolumeX, rate: Gauge, jump: null }

function CenterFlash () {
  const [shown, setShown] = useState<Flash | null>(null)
  useEffect(() => {
    showFlash = setShown
    return () => { showFlash = null }
  }, [])
  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(null), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [shown])
  if (!shown) return null
  const Icon = FLASH_ICONS[shown.kind]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div key={shown.count} className="film-flash flex h-16 min-w-16 items-center justify-center gap-2 bg-black/75 px-4 text-neon-cyan">
        {Icon && <Icon className="h-7 w-7" />}
        {shown.text && <span className="font-mono text-sm tabular-nums">{shown.text}</span>}
      </div>
    </div>
  )
}

// Keys that seek, as a video player's: the seconds or frames each moves by, beside Home and End
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

function seekByKey (key: SeekKey, duration: number) {
  if ('by' in key) {
    seekFilmBy(key.by)
    flash(key.by < 0 ? 'back' : 'forward', `${Math.abs(key.by)} s`)
  } else if ('to' in key) {
    const second = key.to === 'start' ? 0 : duration
    seekFilm(second)
    flash('jump', clock(second))
  } else {
    stepFilm(key.frames)
  }
}

// The keys, as the shortcuts sheet lists them: one list, which the sheet draws and the page keeps
const SHORTCUTS: { group: string, keys: { keys: string[], does: string }[] }[] = [
  {
    group: 'Playback',
    keys: [
      { keys: ['Space', 'K'], does: 'Play or pause' },
      { keys: ['←', '→'], does: `Back or forward ${FILM_SEEK_STEP} s` },
      { keys: ['J', 'L'], does: `Back or forward ${FILM_SEEK_LONG_STEP} s` },
      { keys: [',', '.'], does: 'One frame back or forward' },
      { keys: ['0', '…', '9'], does: 'Jump to 0% … 90% of the film' },
      { keys: ['Home', 'End'], does: 'Start or end' },
      { keys: ['Shift', '←', '→'], does: 'Previous or next chapter of a reel' },
      { keys: ['<', '>'], does: 'Slower or faster' }
    ]
  },
  {
    group: 'Sound',
    keys: [
      { keys: ['M'], does: 'Mute or unmute' },
      { keys: ['↑', '↓'], does: 'Louder or quieter' }
    ]
  },
  {
    group: 'Camera of a 3D film, while it plays',
    keys: [
      { keys: ['W', 'A', 'S', 'D'], does: 'Turn the camera; or drag the film' },
      { keys: ['Shift'], does: 'With W A S D: a finer turn' },
      { keys: ['R'], does: 'Back to the film\'s own camera' }
    ]
  },
  {
    group: 'Films',
    keys: [
      { keys: ['F'], does: 'Full screen; or double-click the film' },
      { keys: ['Shift', 'N'], does: 'Next film of the library' },
      { keys: ['Shift', 'P'], does: 'Previous film of the library' },
      { keys: ['/'], does: 'Search the library' },
      { keys: ['?'], does: 'This list' }
    ]
  }
]

// Space and K play and pause, as in a video player, unless the focus is on a control that takes the key itself
function takesKeys (target: EventTarget | null) {
  return isTextEntry(target) ||
    (target instanceof Element && target.closest('button, a[href], summary, [role="slider"], [role="radio"], [role="switch"], [role="menu"]') !== null)
}

// The arrows, J, L, the comma, the full stop and the digits seek unless the focus is on a control that moves
// with them itself; a button does not, so they seek with the focus on Play
function takesSeekKeys (target: EventTarget | null) {
  return isTextEntry(target) ||
    (target instanceof Element && target.closest('[role="slider"], [role="radio"], [role="radiogroup"], [role="switch"], [role="menu"], select') !== null)
}

// A press back within this many seconds of a chapter's start goes to the chapter before, as a player's does
const CHAPTER_BACK_GRACE = 3

// The chapter of a reel before or after the one playing: its start is sought and its name flashed
function goChapter (step: 1 | -1) {
  const { facts, time } = useFilmStore.getState()
  const chapters = facts?.chapters ?? []
  if (chapters.length === 0) return
  let at = 0
  chapters.forEach((chapter, index) => { if (time >= chapter.start) at = index })
  const target = step > 0 ? at + 1 : Math.max(0, time - chapters[at].start > CHAPTER_BACK_GRACE ? at : at - 1)
  const chapter = chapters[target]
  if (!chapter) return
  seekFilm(chapter.start)
  flash('jump', chapter.name)
}

function nextRate (rate: number, step: 1 | -1) {
  const index = FILM_RATES.findIndex(choice => choice >= rate)
  return FILM_RATES[Math.max(0, Math.min(FILM_RATES.length - 1, (index < 0 ? FILM_RATES.length - 1 : index) + step))]
}

// The page's keys while the mode is open. A seek key held down repeats; a seek asked for while one runs takes
// its place. The keys that need no film (full screen, the list, the library) work while one loads
function usePlayerKeys (toggleFullscreen: () => void, openShortcuts: () => void, sheetOpen: RefObject<boolean>) {
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || isTextEntry(event.target)) return
      // The keys' sheet stands over the film: the film waits until it is closed
      if (sheetOpen.current) return
      const key = event.key
      const take = () => event.preventDefault()
      if (key === '?') {
        take()
        openShortcuts()
        return
      }
      if (key === '/') {
        const search = document.getElementById(LIBRARY_SEARCH_ID)
        if (!search) return
        take()
        search.focus()
        return
      }
      if (event.shiftKey && (key === 'N' || key === 'P')) {
        if (useFilmStore.getState().saving) return
        take()
        void openNeighbour(key === 'N' ? 1 : -1)
        return
      }
      if (key.toLowerCase() === 'f' && !event.repeat) {
        take()
        toggleFullscreen()
        return
      }
      const state = useFilmStore.getState()
      if (state.status !== 'ready' || state.waiting || state.saving) return
      const duration = state.facts?.duration ?? 0
      if (key.toLowerCase() === 'm' && !event.repeat) {
        if (state.sound === 'none') return
        take()
        const muting = state.sound === 'on'
        toggleMuted()
        flash(muting ? 'muted' : 'volume', muting ? '' : `${Math.round(state.volume * 100)}%`)
        return
      }
      if (key === '<' || key === '>') {
        take()
        const rate = nextRate(state.rate, key === '>' ? 1 : -1)
        setFilmRate(rate)
        flash('rate', `${rate}×`)
        return
      }
      if (/^[0-9]$/.test(key)) {
        if (takesSeekKeys(event.target)) return
        take()
        seekFilm(duration * Number(key) / 10)
        flash('jump', clock(duration * Number(key) / 10))
        return
      }
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        if (state.sound === 'none' || takesSeekKeys(event.target)) return
        take()
        // Louder from a muted sound turns it on where it was; quieter leaves it muted
        if (key === 'ArrowDown' && state.sound !== 'on') {
          flash('muted')
          return
        }
        const level = Math.round(Math.max(0, Math.min(1, state.volume + (key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP))) * 100) / 100
        setFilmVolume(level)
        flash(level === 0 ? 'muted' : 'volume', `${Math.round(level * 100)}%`)
        return
      }
      // The camera of a 3D film turns while it plays, and goes back to the film's a moment after the last key
      const turn = LOOK_KEYS[key.toLowerCase()]
      if ((turn || key.toLowerCase() === 'r') && state.looks && state.playing) {
        take()
        if (turn) {
          const degrees = event.shiftKey ? LOOK_FINE_KEY_DEGREES : LOOK_KEY_DEGREES
          turnFilm(turn[0] * degrees, turn[1] * degrees)
          releaseLook()
        } else {
          releaseLook(true)
        }
        return
      }
      if (event.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight') && (state.facts?.chapters.length ?? 0) > 0) {
        if (takesSeekKeys(event.target)) return
        take()
        goChapter(key === 'ArrowRight' ? 1 : -1)
        return
      }
      const seek = PAGE_SEEK_KEYS[key.length === 1 ? key.toLowerCase() : key]
      if (seek) {
        if (takesSeekKeys(event.target)) return
        take()
        seekByKey(seek, duration)
        return
      }
      if (event.repeat || (key !== ' ' && key.toLowerCase() !== 'k')) return
      if (takesKeys(event.target)) return
      take()
      togglePlaying()
      flash(state.playing ? 'pause' : 'play')
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [toggleFullscreen, openShortcuts, sheetOpen])
}

// The film's name in the tab's title, and the system's media keys and controls (a keyboard's play key, the
// lock screen, a headset) on the player, for as long as the mode is open
function useMediaSession () {
  const entry = useFilmStore(state => state.entry)
  const playing = useFilmStore(state => state.playing)
  const title = entry ? titleOf(entry) : null

  useEffect(() => {
    const before = document.title
    if (title) document.title = `${title} · Films`
    return () => { document.title = before }
  }, [title])

  useEffect(() => {
    if (!title || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    session.metadata = new MediaMetadata({ title, artist: 'Films' })
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { if (!useFilmStore.getState().playing) togglePlaying() }],
      ['pause', () => { if (useFilmStore.getState().playing) togglePlaying() }],
      ['seekbackward', details => seekFilmBy(-(details.seekOffset ?? FILM_SEEK_STEP))],
      ['seekforward', details => seekFilmBy(details.seekOffset ?? FILM_SEEK_STEP)],
      ['seekto', details => { if (details.seekTime !== undefined) seekFilm(details.seekTime) }],
      ['previoustrack', () => { void openNeighbour(-1) }],
      ['nexttrack', () => { void openNeighbour(1) }]
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // An action this browser does not know
      }
    }
    return () => {
      session.metadata = null
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // As above
        }
      }
    }
  }, [title])

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])
}

// The stage in full screen, and the way in and out of it
function useFullscreen (stage: RefObject<HTMLDivElement>) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const change = () => setOn(stage.current !== null && document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [stage])
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void stage.current?.requestFullscreen().catch(() => {})
  }, [stage])
  return [on, toggle] as const
}

const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

// The time shown and the film's length, in its own leaf: it changes as the film plays. A press shows the time
// left instead; tenths only while the film stands, where a frame step must read
function TimeReadout () {
  const time = useFilmStore(state => state.time)
  const duration = useFilmStore(state => state.facts?.duration ?? 0)
  const seeking = useFilmStore(state => state.seekTo !== null)
  // Tenths while the film stands somewhere a frame step reads them; not at its end
  const tenths = useFilmStore(state => !state.playing && !state.ended)
  const [left, setLeft] = useState(false)
  const shown = left ? `−${clock(Math.max(0, duration - time), tenths)}` : clock(time, tenths)
  return (
    <button
      type="button"
      aria-label={`${left ? 'Time left' : 'Time played'}: ${shown} of ${clock(duration)}. Press for ${left ? 'time played' : 'time left'}`}
      title={left ? 'Show time played' : 'Show time left'}
      onClick={() => setLeft(!left)}
      className={cn(
        'shrink-0 px-1 font-mono text-xs tabular-nums hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
        seeking ? 'text-neon-cyan' : 'text-text-light/90'
      )}
    >
      {shown}<span className="text-text-light/60"> / {clock(duration)}</span>
    </button>
  )
}

function chapterAt (chapters: { name: string, start: number }[], second: number) {
  let name = ''
  for (const chapter of chapters) {
    if (second < chapter.start) break
    name = chapter.name
  }
  return name
}

const NO_CHAPTERS: { name: string, start: number }[] = []

// Where the film is and where it can go: a click or a drag on the track seeks there (on release, so a drag
// across the film starts no work until it ends), a finger only after a sideways slop or a tap, and the keys of
// a slider while it has the focus. A reel's clips cut the track into chapters, named under the pointer. A seek
// far ahead or behind takes the time the frames before it take to step: the line under the track shows how
// much of that is done, and the frame stays until the new one is there
function Timeline () {
  const time = useFilmStore(state => state.time)
  const duration = useFilmStore(state => state.facts?.duration ?? 0)
  const chapters = useFilmStore(state => state.facts?.chapters ?? NO_CHAPTERS)
  const seekTo = useFilmStore(state => state.seekTo)
  const seekDone = useFilmStore(state => state.seekDone)
  // Nothing to seek while a film loads, its player is made or its video is saved: the track stays, idle
  const waiting = useFilmStore(state => state.waiting || state.status !== 'ready' || state.saving !== null)
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
    else if (event.pointerType === 'mouse' && !waiting) setHover(secondAt(event.clientX))
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
  const labelChapter = label !== null ? chapterAt(chapters, label) : ''
  const nowChapter = chapterAt(chapters, shown)
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(shown * 10) / 10}
      aria-valuetext={`${spokenSeconds(shown)} of ${spokenSeconds(duration)}${nowChapter ? `, chapter: ${nowChapter}` : ''}${seekTo !== null ? ', seeking' : ''}`}
      aria-disabled={waiting || undefined}
      aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End , ."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={() => setScrub(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      style={{ '--seek-line': '14px' } as CSSProperties}
      className={cn('seek-bar relative h-7 min-w-0 touch-pan-y select-none outline-none [@media(pointer:coarse)]:h-9', waiting ? 'cursor-default' : 'cursor-pointer')}
    >
      <span aria-hidden="true" className="seek-track absolute inset-x-0 rounded-full bg-text-light/20" />
      {hover !== null && scrub === null && (
        // Where a press would seek to, up to the pointer
        <span aria-hidden="true" className="seek-fill absolute inset-x-0 rounded-full bg-text-light/25" style={{ clipPath: `inset(0 ${100 - shareOf(hover, duration)}% 0 0)` }} />
      )}
      <span aria-hidden="true" className="seek-fill absolute inset-x-0 rounded-full bg-neon-cyan" style={{ clipPath: `inset(0 ${100 - share}% 0 0)` }} />
      {chapters.filter(chapter => chapter.start > 0.01 && chapter.start < duration - 0.01).map(chapter => (
        <span key={chapter.start} aria-hidden="true" className="seek-cut absolute z-[1] w-[3px] -translate-x-1/2 bg-bg-dark" style={{ left: `${shareOf(chapter.start, duration)}%` }} />
      ))}
      {seekTo !== null && (
        // How much of the frames before the sought one are stepped
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-text-light/10">
          <span className="absolute inset-y-0 left-0 bg-neon-cyan/70" style={{ width: `${Math.round(seekDone * 100)}%` }} />
        </span>
      )}
      {!waiting && (
        <span aria-hidden="true" className="seek-thumb absolute z-[2] h-3 w-3 -translate-x-1/2 rounded-full bg-neon-cyan ring-2 ring-bg-dark" style={{ left: `${share}%` }} />
      )}
      {label !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full z-[3] mb-1 -translate-x-1/2 whitespace-nowrap border border-neon-cyan/50 bg-bg-dark px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-text-light"
          style={{ left: `clamp(3rem, ${shareOf(label, duration)}%, calc(100% - 3rem))` }}
        >
          {labelChapter && <span className="text-neon-cyan">{labelChapter} · </span>}
          {clock(label, true)}
        </span>
      )}
      <span role="status" className="sr-only">{seekTo !== null ? `Seeking to ${spokenSeconds(seekTo)}` : ''}</span>
    </div>
  )
}

interface TransportButtonProps {
  label: string
  // The key, as aria-keyshortcuts writes it, and as the tooltip shows it
  keys?: string
  shown?: string
  onClick: () => void
  disabled?: boolean
  on?: boolean
  pressed?: boolean
  className?: string
  children: ReactNode
}

function TransportButton ({ label, keys, shown, onClick, disabled, on, pressed, className, children }: TransportButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      aria-keyshortcuts={keys}
      aria-pressed={pressed}
      title={shown ? `${label} (${shown})` : label}
      disabled={disabled}
      onClick={onClick}
      className={cn(TRANSPORT_BUTTON, on && TRANSPORT_ON, className)}
    >
      {children}
    </Button>
  )
}

// A step back or forward: the turning arrow with its seconds inside, as players draw it
function SkipIcon ({ forward, seconds }: { forward: boolean, seconds: number }) {
  const Icon = forward ? RotateCw : RotateCcw
  return (
    <span aria-hidden="true" className="relative flex h-5 w-5 items-center justify-center">
      <Icon className="absolute inset-0 h-5 w-5" strokeWidth={1.75} />
      <span className="relative pt-px font-mono text-[8px] font-bold leading-none">{seconds}</span>
    </span>
  )
}

// The sound's switch and loudness, in their own leaf, for a film that has a sound. A sound the browser held
// muted, since the person had not touched the page yet, asks to be turned on with a solid fill. The loudness
// slider is for a pointer that hovers: a phone's loudness is its buttons
function SoundControl () {
  const sound = useFilmStore(state => state.sound)
  const volume = useFilmStore(state => state.volume)
  if (sound === 'none') return null
  const silent = sound !== 'on' || volume === 0
  const label = sound === 'blocked' ? 'Turn the sound on' : sound === 'on' ? 'Mute' : 'Unmute'
  const Icon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const level = silent ? 0 : Math.round(volume * 100)
  return (
    <div className="flex shrink-0 items-center">
      <TransportButton
        label={label}
        keys="M"
        shown="M"
        pressed={sound !== 'on'}
        onClick={toggleMuted}
        className={cn(sound === 'blocked' && 'border-neon-cyan bg-neon-cyan text-black hover:bg-neon-cyan/80 hover:text-black')}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </TransportButton>
      <Slider
        value={[level]}
        min={0}
        max={100}
        step={1}
        onValueChange={([value]) => setFilmVolume(value / 100)}
        thumbLabel="Volume"
        thumbValueText={`${level}%`}
        thumbKeyShortcuts="ArrowUp ArrowDown"
        trackHeight="h-1"
        thumbSize="h-3 w-3"
        className="ml-1 mr-2 w-16 [@media(pointer:coarse)]:hidden"
      />
    </div>
  )
}

interface MenuChoice {
  key: string
  label: string
  // Quiet words at the row's end: a chapter's time
  aside?: string
  checked: boolean
  choose: () => void
}

interface TransportMenuProps {
  // What the button says to a screen reader, and its tooltip
  label: string
  title: string
  keys?: string
  heading: string
  choices: MenuChoice[]
  // The button's own face, and whether it stands lit
  face: ReactNode
  lit: boolean
  className?: string
  menuClassName?: string
}

// A button of the transport that opens a menu of choices above it, one of them checked: the pace, a reel's
// chapter. The arrows move through them, Escape and Tab close it, a press outside does too
function TransportMenu ({ label, title, keys, heading, choices, face, lit, className, menuClassName }: TransportMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuHoldsEscape(open)
    if (!open) return
    // The menu fits the room above its button and stays inside the window, on a phone too
    const list = menu.current
    const face = button.current
    if (list && face) {
      // Out of full screen the scene's toolbar stands over the stage's top
      const clear = document.fullscreenElement ? MENU_MARGIN : TOOLBAR_CLEAR
      list.style.maxHeight = `${Math.max(MENU_LEAST_HEIGHT, face.getBoundingClientRect().top - clear)}px`
      const box = list.getBoundingClientRect()
      const over = Math.max(0, box.right - (window.innerWidth - MENU_MARGIN)) - Math.max(0, MENU_MARGIN - box.left)
      if (over !== 0) list.style.translate = `${-over}px 0`
    }
    const checked = menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    checked?.focus()
    checked?.scrollIntoView({ block: 'nearest' })
    const down = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    return () => {
      setMenuHoldsEscape(false)
      document.removeEventListener('pointerdown', down)
    }
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }
  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (index: number) => items[(index + items.length) % items.length]?.focus()
    switch (event.key) {
    case 'ArrowDown': go(at + 1); break
    case 'ArrowUp': go(at - 1); break
    case 'Home': go(0); break
    case 'End': go(items.length - 1); break
    case 'Escape': close(true); break
    case 'Tab': close(false); return
    default: return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className={cn('relative shrink-0', className)}>
      <Button
        ref={button}
        variant="outline"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-keyshortcuts={keys}
        title={title}
        onClick={() => setOpen(!open)}
        className={cn(TRANSPORT_BUTTON, 'w-auto min-w-9 max-w-full px-2 font-mono text-xs tabular-nums [@media(pointer:coarse)]:w-auto', (open || lit) && TRANSPORT_ON)}
      >
        {face}
      </Button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={heading}
          onKeyDown={onMenuKey}
          className={cn('absolute bottom-full z-20 mb-2 flex flex-col overflow-y-auto border border-neon-cyan/40 bg-bg-dark p-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]', menuClassName)}
        >
          <p aria-hidden="true" className="px-2 pb-1 pt-0.5 font-orbitron text-[11px] tracking-[0.5px] text-neon-cyan">{heading.toUpperCase()}</p>
          {choices.map(choice => (
            <button
              key={choice.key}
              type="button"
              role="menuitemradio"
              aria-checked={choice.checked}
              tabIndex={-1}
              onClick={() => {
                choice.choose()
                close(true)
              }}
              className={cn(
                'flex h-8 shrink-0 items-center gap-3 px-2 text-left font-mono text-xs tabular-nums outline-none [@media(pointer:coarse)]:h-10',
                'hover:bg-neon-cyan/15 hover:text-neon-cyan focus-visible:bg-neon-cyan/15 focus-visible:text-neon-cyan',
                choice.checked ? 'text-neon-cyan' : 'text-text-light/90'
              )}
            >
              {choice.aside !== undefined && <span className="w-10 shrink-0 text-text-light/60">{choice.aside}</span>}
              <span className="min-w-0 flex-1 truncate">{choice.label}</span>
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0', choice.checked && 'bg-neon-cyan')} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// The pace, film seconds a clock second
function SpeedMenu () {
  const rate = useFilmStore(state => state.rate)
  const choices = [...FILM_RATES].reverse().map(choice => ({
    key: String(choice),
    label: rateLabel(choice),
    checked: choice === rate,
    choose: () => setFilmRate(choice)
  }))
  return (
    <TransportMenu
      label={`Speed: ${rateLabel(rate)}`}
      title="Speed (< >)"
      keys="Shift+Period Shift+Comma"
      heading="Speed"
      choices={choices}
      face={`${rate}×`}
      lit={rate !== 1}
      menuClassName="right-0 w-32"
    />
  )
}

// A reel's chapter playing, named in the transport, and its chapters to go to: the way a viewer finds where
// they are in a long reel. Only the chapter's index changes it, not every tick of the time
function ChapterMenu () {
  const chapters = useFilmStore(state => state.facts?.chapters ?? NO_CHAPTERS)
  const playing = useFilmStore(state => {
    const list = state.facts?.chapters ?? NO_CHAPTERS
    let index = 0
    list.forEach((chapter, at) => { if (state.time >= chapter.start) index = at })
    return index
  })
  if (chapters.length === 0) return null
  const now = chapters[playing]
  const choices = chapters.map((chapter, index) => ({
    key: String(chapter.start),
    label: chapter.name,
    aside: clock(chapter.start),
    checked: index === playing,
    choose: () => seekFilm(chapter.start)
  }))
  return (
    <TransportMenu
      label={`Chapter ${playing + 1} of ${chapters.length}: ${now.name}`}
      title="Chapters (Shift+← Shift+→)"
      keys="Shift+ArrowLeft Shift+ArrowRight"
      heading="Chapters"
      choices={choices}
      face={<span className="truncate"><span className="text-text-light/60">{playing + 1}/{chapters.length}</span><span className="max-sm:hidden"> {now.name}</span></span>}
      lit={false}
      className="min-w-0"
      menuClassName="left-0 w-72"
    />
  )
}

function LoopButton () {
  const loop = useFilmStore(state => state.loop)
  return (
    <TransportButton label="Loop" pressed={loop} on={loop} onClick={toggleLoop}>
      <Repeat aria-hidden="true" className="h-[18px] w-[18px]" />
    </TransportButton>
  )
}

// The next film of the library, for a film of the library that has one
function NextFilmButton () {
  useFilmStore(state => state.entry)
  const saving = useFilmStore(state => state.saving !== null)
  const next = libraryNeighbour(1)
  if (!next) return null
  return (
    <TransportButton label={`Next film: ${next.title}`} keys="Shift+N" shown="Shift+N" disabled={saving} onClick={() => { void openNeighbour(1) }} className="max-sm:hidden">
      <SkipForward aria-hidden="true" className="h-[18px] w-[18px]" />
    </TransportButton>
  )
}

interface TransportProps {
  fullscreen: boolean
  hidden: boolean
  onFullscreen: () => void
  onShortcuts: () => void
  transportRef: RefObject<HTMLDivElement>
}

function Transport ({ fullscreen, hidden, onFullscreen, onShortcuts, transportRef }: TransportProps) {
  // A save holds the film: it shows as standing, and nothing moves it until the save ends
  const playing = useFilmStore(state => state.playing && state.saving === null)
  const ended = useFilmStore(state => state.ended)
  const waiting = useFilmStore(state => state.waiting || state.status !== 'ready' || state.saving !== null)
  const label = playing ? 'Pause' : ended ? 'Play again' : 'Play'
  return (
    <div
      ref={transportRef}
      className={cn(
        'z-10 flex shrink-0 flex-col px-3 pb-1.5 transition-opacity duration-300 motion-reduce:transition-none',
        fullscreen
          ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-10'
          : 'border-t border-neon-cyan/20 bg-[rgba(10,10,15,0.95)] pt-1',
        hidden && 'pointer-events-none opacity-0'
      )}
    >
      <Timeline />
      <div className="flex h-10 items-center gap-1 [@media(pointer:coarse)]:h-12">
        <TransportButton label={label} keys="Space" shown="Space" disabled={waiting} onClick={togglePlaying} className="border-neon-cyan/60 text-neon-cyan">
          {playing
            ? <Pause aria-hidden="true" className="h-5 w-5" />
            : ended ? <RotateCcw aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
        </TransportButton>
        <TransportButton label={`Back ${FILM_SEEK_STEP} seconds`} keys="ArrowLeft" shown="←" disabled={waiting} onClick={() => seekFilmBy(-FILM_SEEK_STEP)} className="max-sm:hidden">
          <SkipIcon forward={false} seconds={FILM_SEEK_STEP} />
        </TransportButton>
        <TransportButton label={`Forward ${FILM_SEEK_STEP} seconds`} keys="ArrowRight" shown="→" disabled={waiting} onClick={() => seekFilmBy(FILM_SEEK_STEP)} className="max-sm:hidden">
          <SkipIcon forward seconds={FILM_SEEK_STEP} />
        </TransportButton>
        <NextFilmButton />
        <SoundControl />
        <TimeReadout />
        <ChapterMenu />
        <span className="min-w-0 flex-1" />
        <SpeedMenu />
        <LoopButton />
        <TransportButton label="Keyboard shortcuts" keys="Shift+Slash" shown="?" onClick={onShortcuts} className="[@media(pointer:coarse)]:hidden">
          <Keyboard aria-hidden="true" className="h-5 w-5" />
        </TransportButton>
        {canFullscreen && (
          <TransportButton label={fullscreen ? 'Exit full screen' : 'Full screen'} keys="F" shown="F" onClick={onFullscreen}>
            {fullscreen ? <Minimize aria-hidden="true" className="h-[18px] w-[18px]" /> : <Maximize aria-hidden="true" className="h-[18px] w-[18px]" />}
          </TransportButton>
        )}
      </div>
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
    return (
      <p role="status" className="flex items-center gap-2 font-mono text-xs text-text-light/80">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin text-neon-cyan motion-reduce:animate-none" />
        Preparing the film…
      </p>
    )
  }
  if (status === 'failed') {
    return (
      <div role="alert" className="pointer-events-auto flex max-w-xl flex-col items-center gap-3 text-center">
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
      <div className="pointer-events-auto flex flex-col items-center gap-3 border border-dashed border-neon-cyan/40 px-10 py-8 text-center">
        <Clapperboard aria-hidden="true" className="h-6 w-6 text-neon-cyan" />
        <p className="font-orbitron text-xs tracking-[1px] text-neon-cyan">CHOOSE A FILM</p>
        <p className="font-mono text-xs text-text-light/80">Pick one from the library, or drop a .json or .js film here</p>
        <Button variant="outline" onClick={pickFiles} className={ACTION}>
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          OPEN FILE
        </Button>
      </div>
    )
  }
  return null
}

// The first Play, large in the middle, for a film that waits on its first frame: one opened with reduced
// motion asked for, which does not start by itself
function StartOverlay () {
  const shown = useFilmStore(state => state.status === 'ready' && !state.waiting && !state.playing && !state.ended && state.time === 0 && state.seekTo === null)
  if (!shown) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <button
        type="button"
        aria-label="Play"
        onClick={togglePlaying}
        className="pointer-events-auto flex h-16 w-16 items-center justify-center border border-neon-cyan bg-black/70 text-neon-cyan transition-colors duration-150 hover:bg-neon-cyan hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
      >
        <Play aria-hidden="true" className="ml-1 h-8 w-8" />
      </button>
    </div>
  )
}

// The end of a film that does not loop: watch it again, or go on to the next film of the library, which
// starts by itself after a few seconds unless the person touches anything
function EndOverlay () {
  const shown = useFilmStore(state => state.status === 'ready' && state.ended && !state.playing && !state.loop)
  useFilmStore(state => state.entry)
  const next = shown ? libraryNeighbour(1) : null
  const [left, setLeft] = useState(UP_NEXT_S)
  const [held, setHeld] = useState(false)
  // The fill runs once it is laid out at its start, so it moves rather than appears full
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!next) return
    setLeft(UP_NEXT_S)
    setHeld(false)
    setArmed(false)
    const arm = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)))
    const hold = () => setHeld(true)
    window.addEventListener('pointerdown', hold, true)
    window.addEventListener('keydown', hold, true)
    // The count holds while the tab is hidden, so the next film never starts with nobody there
    const timer = window.setInterval(() => { if (!document.hidden) setLeft(seconds => seconds - 1) }, 1000)
    return () => {
      cancelAnimationFrame(arm)
      window.clearInterval(timer)
      window.removeEventListener('pointerdown', hold, true)
      window.removeEventListener('keydown', hold, true)
    }
  }, [next])

  useEffect(() => {
    if (next && !held && left <= 0) void openNeighbour(1)
  }, [next, held, left])

  if (!shown) return null
  const counting = next !== null && !held
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
      <div className="flex flex-wrap items-center justify-center gap-2 px-4">
        <Button variant="outline" onClick={togglePlaying} className={cn(ACTION, 'h-10 px-4 text-sm')}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          WATCH AGAIN
        </Button>
        {next && (
          <Button
            variant="outline"
            onClick={() => { void openNeighbour(1) }}
            className={cn(ACTION, 'relative h-10 max-w-[24rem] overflow-hidden bg-neon-cyan px-4 text-sm text-black hover:bg-neon-cyan/80 hover:text-black')}
          >
            {counting && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-black/20 transition-[width] ease-linear motion-reduce:hidden"
                style={{ width: armed ? '100%' : '0%', transitionDuration: `${UP_NEXT_S}s` }}
              />
            )}
            <SkipForward aria-hidden="true" className="relative h-4 w-4 shrink-0" />
            <span className="relative truncate">NEXT: {next.title}</span>
            {counting && <span className="relative shrink-0 tabular-nums">· {Math.max(0, left)}</span>}
          </Button>
        )}
      </div>
      <span role="status" className="sr-only">{counting ? `The next film, ${next.title}, starts in ${UP_NEXT_S} seconds; press any key to stay` : ''}</span>
    </div>
  )
}

// A long film taken up where it was left: said for a few seconds, with the way back to its start
function ResumeNotice ({ fullscreen }: { fullscreen: boolean }) {
  const resumedAt = useFilmStore(state => state.resumedAt)
  useEffect(() => {
    if (resumedAt === null) return
    const timer = window.setTimeout(() => useFilmStore.setState({ resumedAt: null }), RESUME_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [resumedAt])
  if (resumedAt === null) return null
  return (
    <div className={cn('absolute left-3 z-[5] flex items-center gap-3 bg-black/80 py-1.5 pl-3 pr-1.5', fullscreen ? 'top-16' : TOP_CLEAR)}>
      <p role="status" className="font-mono text-xs text-text-light">Resumed at {clock(resumedAt)}</p>
      <Button
        variant="outline"
        onClick={() => {
          seekFilm(0)
          useFilmStore.setState({ resumedAt: null })
        }}
        className={ACTION}
      >
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
        START OVER
      </Button>
    </div>
  )
}

// What is playing, at the top of the stage in full screen while the controls show: the film and its chapter
function FullscreenTitle ({ hidden }: { hidden: boolean }) {
  const entry = useFilmStore(state => state.entry)
  const chapter = useFilmStore(state => chapterAt(state.facts?.chapters ?? NO_CHAPTERS, state.time))
  if (!entry) return null
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-[4] flex flex-col gap-0.5 bg-gradient-to-b from-black/85 to-transparent px-5 pb-10 pt-4 transition-opacity duration-300 motion-reduce:transition-none',
        hidden && 'opacity-0'
      )}
    >
      <p className="truncate text-sm text-text-light">{titleOf(entry)}</p>
      {chapter && <p className="truncate font-mono text-xs text-neon-cyan">{chapter}</p>}
    </div>
  )
}

// A video being saved holds the film: the stage says so, how far it has come and how long it has left, with
// the way to stop it, so a picture that stands still is never a mystery (full screen hides the panel's bar)
function SaveBadge ({ fullscreen }: { fullscreen: boolean }) {
  const saving = useFilmStore(state => state.saving)
  if (!saving) return null
  const share = Math.round(saving.frame / Math.max(1, saving.frames) * 100)
  const left = saveLeft(saving)
  return (
    <div className={cn('absolute inset-x-0 z-[5] flex justify-center px-3', fullscreen ? 'top-3' : TOP_CLEAR)}>
      <div className="flex items-center gap-3 bg-black/85 py-1.5 pl-3 pr-1.5">
        <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-neon-cyan motion-reduce:animate-none" />
        <p className="font-mono text-xs tabular-nums text-text-light">
          Saving the video · {share}%{left && <span className="text-text-light/70"> · {left}</span>}
        </p>
        <Button variant="outline" onClick={() => { void cancelVideo() }} className={ACTION}>CANCEL</Button>
      </div>
    </div>
  )
}

// A seek that takes a while, named at the top of the picture with how far it has come
function SeekBadge ({ fullscreen }: { fullscreen: boolean }) {
  const seekTo = useFilmStore(state => state.seekTo)
  const seekDone = useFilmStore(state => state.seekDone)
  const [late, setLate] = useState(false)
  const seeking = seekTo !== null
  useEffect(() => {
    if (!seeking) {
      setLate(false)
      return
    }
    const timer = window.setTimeout(() => setLate(true), SEEK_BADGE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [seeking])
  if (seekTo === null || !late) return null
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 flex justify-center', fullscreen ? 'top-3' : TOP_CLEAR)}>
      <p className="flex items-center gap-2 bg-black/80 px-3 py-1.5 font-mono text-xs tabular-nums text-text-light">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-neon-cyan motion-reduce:animate-none" />
        Going to {clock(seekTo)} · {Math.round(seekDone * 100)}%
      </p>
    </div>
  )
}

// A problem met while the film plays, over the picture's foot, so the frame it stopped on stays in view
function PlayProblem () {
  const status = useFilmStore(state => state.status)
  const problem = useFilmStore(state => state.problem)
  if (status !== 'ready' || !problem) return null
  return <p role="alert" className="absolute inset-x-3 bottom-3 bg-[rgba(10,10,15,0.9)] p-2 font-mono text-xs text-text-light/90">{problem}</p>
}

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  container: HTMLElement | null
  onClosed: () => void
}

// The keys, in a sheet over the stage: inside it, so it shows in full screen too
function ShortcutsDialog ({ open, onOpenChange, container, onClosed }: ShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="absolute inset-0 z-50 bg-black/70" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onClosed()
          }}
          className="absolute left-1/2 top-1/2 z-50 flex max-h-[calc(100%-2rem)] w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto border border-neon-cyan/40 bg-bg-dark p-5 shadow-[0_16px_48px_rgba(0,0,0,0.7)] outline-none"
        >
          <div className="flex flex-col gap-1">
            <Dialog.Title className="font-orbitron text-sm tracking-[1px] text-neon-cyan">KEYBOARD SHORTCUTS</Dialog.Title>
            <Dialog.Description className="font-mono text-xs text-text-light/70">They work anywhere on the page while Films is open.</Dialog.Description>
          </div>
          {SHORTCUTS.map(group => (
            <section key={group.group} className="flex flex-col gap-1.5">
              <h3 className="font-mono text-[11px] uppercase tracking-[1px] text-text-light/60">{group.group}</h3>
              <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5">
                {group.keys.map(row => (
                  <div key={row.does} className="contents">
                    <dt className="flex items-center gap-1">
                      {row.keys.map((key, index) => key === '…'
                        ? <span key={index} aria-hidden="true" className="text-text-light/60">…</span>
                        : <kbd key={index} className="min-w-6 border border-text-light/30 bg-text-light/[0.06] px-1.5 py-0.5 text-center font-mono text-[11px] leading-4 text-text-light">{key}</kbd>)}
                    </dt>
                    <dd className="self-center font-mono text-xs text-text-light/90">{row.does}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <Dialog.Close asChild>
            <Button variant="outline" className={cn(ACTION, 'self-end px-4')}>DONE</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type TapZone = 'left' | 'center' | 'right'

// Where the film plays: right of the panel, clear of the toolbar above it, with its transport at the foot. A
// click on the picture plays and pauses, a double click goes full screen; on a touch screen a tap plays and
// pauses and a double tap at either side seeks ten seconds, again with every further tap there, as a phone's
// player does. In full screen the transport and the cursor step aside while the pointer rests and the film
// plays
export function Stage () {
  const ready = useFilmStore(state => state.status === 'ready')
  const hasFilm = useFilmStore(state => state.entry !== null)
  const waiting = useFilmStore(state => state.waiting)
  const playing = useFilmStore(state => state.playing)
  const stage = useRef<HTMLDivElement>(null)
  const picture = useRef<HTMLDivElement>(null)
  const transport = useRef<HTMLDivElement>(null)
  const [fullscreen, toggleFullscreen] = useFullscreen(stage)
  const [shortcuts, setShortcuts] = useState(false)
  // Where the focus goes back to when the keys' sheet closes: where it was when it opened
  const returnFocus = useRef<HTMLElement | null>(null)
  const openShortcuts = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    setShortcuts(true)
  }, [])
  const shortcutsClosed = useCallback(() => {
    const back = returnFocus.current?.isConnected ? returnFocus.current : stage.current?.querySelector<HTMLElement>('[aria-label="Keyboard shortcuts"]')
    back?.focus()
  }, [])
  const shortcutsOpen = useRef(false)
  shortcutsOpen.current = shortcuts
  const host = useCallback((node: HTMLDivElement | null) => attachStage(node), [])
  usePlayerKeys(toggleFullscreen, openShortcuts, shortcutsOpen)
  useMediaSession()

  // The toolbar's full screen button takes the stage while the mode is open
  useEffect(() => {
    setFilmStage(stage.current)
    return () => setFilmStage(null)
  }, [])

  // The pointer at rest in full screen
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef(0)
  const wake = useCallback(() => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    const rest = () => {
      // A control reached by the keyboard keeps the transport in view
      if (transport.current?.querySelector(':focus-visible, [aria-expanded="true"]')) idleTimer.current = window.setTimeout(rest, IDLE_MS)
      else setIdle(true)
    }
    idleTimer.current = window.setTimeout(rest, IDLE_MS)
  }, [])
  useEffect(() => {
    if (!fullscreen) return
    wake()
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('keydown', wake)
      window.clearTimeout(idleTimer.current)
    }
  }, [fullscreen, wake])
  const hideControls = fullscreen && idle && playing && !shortcuts

  // The kind of pointer that pressed last, and the taps of a finger: when the last landed, the single tap
  // waiting to see whether a second follows, and the side a run of seeking taps is on
  const pointerKind = useRef('mouse')
  // A finger that lands while the controls stand aside in full screen only brings them back
  const wokeControls = useRef(false)
  const taps = useRef<{ at: number, timer: number, run: TapZone | null }>({ at: 0, timer: 0, run: null })
  useEffect(() => () => window.clearTimeout(taps.current.timer), [])

  // A press on a 3D film that turns into a drag looks around: where it is now, and whether it has moved
  // far enough to be a drag, after which its click neither plays nor pauses
  const drag = useRef<{ id: number, x: number, y: number, turning: boolean } | null>(null)
  const dragged = useRef(false)
  const [turning, setTurning] = useState(false)
  const looks = useFilmStore(state => state.looks && state.playing && state.saving === null)

  const onPicturePress = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerKind.current = event.pointerType
    wokeControls.current = event.pointerType === 'touch' && hideControls
    dragged.current = false
    // Any button turns the camera, the right one too, as on the page in 3D
    drag.current = looks && onTheFilm(event) && (event.button === 0 || event.button === 2)
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, turning: false }
      : null
  }
  const onPictureMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = drag.current
    if (!press || press.id !== event.pointerId) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (!press.turning) {
      if (Math.hypot(dx, dy) <= LOOK_DRAG_SLOP) return
      press.turning = true
      dragged.current = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // A pointer already gone: the drag still turns while it moves over the film
      }
      setTurning(true)
    }
    press.x = event.clientX
    press.y = event.clientY
    turnFilm(dx * LOOK_DEGREES_PER_PIXEL, dy * LOOK_DEGREES_PER_PIXEL)
  }
  const endDrag = () => {
    if (drag.current?.turning) releaseLook()
    drag.current = null
    setTurning(false)
  }
  const onTheFilm = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as Node
    return target === event.currentTarget || picture.current?.contains(target) === true
  }
  const playOrPause = () => {
    const state = useFilmStore.getState()
    if (state.status !== 'ready' || state.waiting || state.saving) return
    togglePlaying()
    flash(state.playing ? 'pause' : 'play')
  }
  const onTap = (event: ReactMouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = box.width > 0 ? (event.clientX - box.left) / box.width : 0.5
    const zone: TapZone = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'center'
    const tap = taps.current
    const now = performance.now()
    const quick = now - tap.at < DOUBLE_TAP_MS
    tap.at = now
    window.clearTimeout(tap.timer)
    if (quick && (tap.run === null || tap.run === zone)) {
      if (zone === 'center') {
        tap.run = null
        if (canFullscreen) toggleFullscreen()
        return
      }
      const state = useFilmStore.getState()
      if (state.status !== 'ready' || state.waiting || state.saving) return
      tap.run = zone
      const by = zone === 'left' ? -FILM_SEEK_LONG_STEP : FILM_SEEK_LONG_STEP
      seekFilmBy(by)
      flash(by < 0 ? 'back' : 'forward', `${FILM_SEEK_LONG_STEP} s`)
      tap.timer = window.setTimeout(() => { tap.run = null }, DOUBLE_TAP_MS)
      return
    }
    tap.run = null
    tap.timer = window.setTimeout(playOrPause, DOUBLE_TAP_MS)
  }
  const onPicture = (event: ReactMouseEvent<HTMLDivElement>) => {
    // The click that ends a drag only ends it
    if (dragged.current) {
      dragged.current = false
      return
    }
    if (!onTheFilm(event)) return
    if (wokeControls.current) {
      wokeControls.current = false
      return
    }
    if (pointerKind.current === 'touch') onTap(event)
    else playOrPause()
  }
  const onPictureDouble = (event: ReactMouseEvent<HTMLDivElement>) => {
    // A finger's double tap is onTap's
    if (!onTheFilm(event) || pointerKind.current === 'touch') return
    if (canFullscreen) toggleFullscreen()
  }

  return (
    <div
      ref={stage}
      onPointerMove={fullscreen ? wake : undefined}
      onPointerDown={fullscreen ? wake : undefined}
      className={cn(
        'fixed inset-y-0 left-[340px] right-0 z-40 flex flex-col bg-black max-sm:inset-x-0 max-sm:bottom-[45vh] max-sm:left-0',
        hideControls && 'cursor-none'
      )}
    >
      <div
        onPointerDown={onPicturePress}
        onPointerMove={onPictureMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={onPicture}
        onDoubleClick={onPictureDouble}
        // The right button turns a 3D film's camera, so the browser's menu stays away from the film
        onContextMenu={looks ? (event) => event.preventDefault() : undefined}
        className={cn(
          'relative min-h-0 flex-1 select-none',
          !fullscreen && 'px-3 pb-3 pt-[60px]',
          // A finger drags a 3D film round; on another the page keeps its own gestures
          looks ? 'touch-none' : 'touch-manipulation',
          turning ? 'cursor-grabbing' : looks && !hideControls && 'cursor-grab'
        )}
      >
        <div ref={picture} className="h-full w-full">
          <div ref={host} className={cn('h-full w-full', (!ready || waiting) && 'invisible')} />
        </div>
        <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center px-6', !fullscreen && 'pt-[48px]')}>
          <StageMessage />
        </div>
        {fullscreen && <FullscreenTitle hidden={hideControls} />}
        <StartOverlay />
        <EndOverlay />
        <SeekBadge fullscreen={fullscreen} />
        <SaveBadge fullscreen={fullscreen} />
        <ResumeNotice fullscreen={fullscreen} />
        <CenterFlash />
        <PlayProblem />
      </div>
      {/* The transport stays while one film gives way to the next, so the stage keeps its height */}
      {hasFilm && <Transport fullscreen={fullscreen} hidden={hideControls} onFullscreen={toggleFullscreen} onShortcuts={openShortcuts} transportRef={transport} />}
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} container={stage.current} onClosed={shortcutsClosed} />
    </div>
  )
}
