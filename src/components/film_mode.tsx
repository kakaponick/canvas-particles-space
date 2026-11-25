import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, Clapperboard, Copy, Download, FileDown, FolderOpen, Pause, Play, RotateCcw, WandSparkles, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn, isTextEntry } from '@/lib/utils'
import { FILM_QUALITIES, useFilmStore } from '../store/film_store'
import { useParticleStore } from '../store/particle_store'
import { useFractalStore } from '../store/fractal_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { closeIntroDebugger } from '../lib/intro_dock'
import { LIBRARY_FILMS } from '../lib/film_library'
import {
  attachStage, cancelVideo, copyFilmText, leaveFilms, openFiles, openFilm, openFromAddress, openFromScene, openLibraryFilm,
  openPasted, saveFilmFile, saveVideo, togglePlaying
} from '../lib/film_session'
import ToggleButton from './controls/toggle_button'
import { SettingsRow } from './controls/settings_section'

// The page's film mode: a film played live on a stage beside its panel, from a file, a drop, a paste, the
// library of this repository's films or the scene itself, and saved as its file or an mp4. What it does is
// film_session.ts; the engine loads with the first film. The button that opens it sits in the scene toolbar
// (control_panel.tsx)

const PANEL_ID = 'films-panel'
const TOGGLE_SELECTOR = '[data-films-toggle]'
const ACCEPT = '.json,.js,.png,.jpg,.jpeg,.webp,.gif,.avif'
const QUALITY_LABELS = { medium: 'Medium', high: 'High', max: 'Max' } as const
const KIND_LABELS = { film: 'Film', fractal: 'Mandelbrot film', reel: 'Reel' } as const
const COPIED_MS = 1500

const canSaveVideo = typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'

const ACTION = 'h-7 gap-1.5 border-neon-cyan/50 px-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'
const QUIET_ACTION = 'h-7 gap-1.5 border-text-light/40 px-2 font-mono text-xs text-text-light/80 hover:bg-neon-cyan/20 hover:text-neon-cyan'

// m:ss, the way a player shows time
function clock (seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

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

// How far the film has come, in its own leaf: the one part of the mode that changes as the film plays
function Progress () {
  const time = useFilmStore(state => state.time)
  const duration = useFilmStore(state => state.facts?.duration ?? 0)
  const share = duration > 0 ? Math.min(100, time / duration * 100) : 0
  return (
    <>
      <span className="shrink-0 font-mono text-xs tabular-nums text-text-light/90">
        {clock(time)}<span className="text-text-light/50"> / {clock(duration)}</span>
      </span>
      <div
        role="progressbar"
        aria-label="Film progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${spokenSeconds(time)} of ${spokenSeconds(duration)}`}
        className="relative h-1.5 min-w-0 flex-1 bg-text-light/10"
      >
        <div className="absolute inset-y-0 left-0 bg-neon-cyan" style={{ width: `${share}%` }} />
      </div>
    </>
  )
}

function Transport () {
  const playing = useFilmStore(state => state.playing)
  const ended = useFilmStore(state => state.ended)
  const waiting = useFilmStore(state => state.waiting)
  const label = playing ? 'Pause' : ended ? 'Play again' : 'Play'
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-neon-cyan/20 bg-[rgba(10,10,15,0.95)] px-3">
      <Button
        variant="outline"
        size="icon"
        aria-label={label}
        aria-keyshortcuts="Space"
        title={`${label} (Space)`}
        disabled={waiting}
        onClick={togglePlaying}
        className="h-8 w-8 shrink-0 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan"
      >
        {playing
          ? <Pause aria-hidden="true" className="h-4 w-4" />
          : ended ? <RotateCcw aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
      </Button>
      <Progress />
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
      {ready && <Transport />}
    </div>
  )
}

// A heading of the panel, on the same edge as the rows below it
function Heading ({ id, children }: { id: string, children: ReactNode }) {
  return <h3 id={id} className="pl-3 pt-1 font-orbitron text-xs tracking-[0.5px] text-neon-cyan">{children}</h3>
}

// The film in the mode: its name, its frame and length, and what the planner changed in it
function NowLoaded () {
  const entry = useFilmStore(state => state.entry)
  const facts = useFilmStore(state => state.facts)
  if (!entry) return null
  return (
    <div className="flex flex-col gap-1 bg-text-light/[0.06] px-3 py-2">
      <p className="truncate font-mono text-sm text-text-light" title={entry.name}>{entry.name}</p>
      {facts && (
        <p className="font-mono text-xs text-text-light/70">
          {KIND_LABELS[facts.kind]} · {facts.width}×{facts.height} · {facts.fps} fps · {clock(facts.duration)}
        </p>
      )}
      {facts && facts.notes.length > 0 && (
        <details className="font-mono text-xs text-text-light/70">
          <summary className="cursor-pointer hover:text-neon-cyan">{facts.notes.length === 1 ? '1 note' : `${facts.notes.length} notes`}</summary>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {facts.notes.map((note, index) => <li key={index}>{note}</li>)}
          </ul>
        </details>
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

// One film to open: the one in the mode is marked as current
function FilmRow ({ name, current, onOpen, onForget }: { name: string, current: boolean, onOpen: () => void, onForget?: () => void }) {
  return (
    <li className="flex h-7 items-stretch">
      <button
        type="button"
        aria-current={current || undefined}
        onClick={onOpen}
        className={cn(
          'min-w-0 flex-1 truncate border-l-2 pl-[10px] pr-2 text-left font-mono text-xs transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan',
          current ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan' : 'border-transparent bg-text-light/[0.06] text-text-light/90 hover:bg-neon-cyan/10 hover:text-neon-cyan'
        )}
      >
        {name}
      </button>
      {onForget && (
        <button
          type="button"
          aria-label={`Remove ${name} from recent films`}
          title="Remove from recent"
          onClick={onForget}
          className="flex w-7 items-center justify-center bg-text-light/[0.06] text-text-light/60 hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
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
              <FilmRow
                key={film.name}
                name={film.name}
                current={film.name === current}
                onOpen={() => { void openFilm({ name: film.name, text: film.text, origin: 'file' }) }}
                onForget={() => forget(film.name)}
              />
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby={libraryId} className="flex flex-col gap-1">
        <Heading id={libraryId}>LIBRARY</Heading>
        <ul className="flex flex-col gap-px">
          {LIBRARY_FILMS.map(name => (
            <FilmRow key={name} name={name} current={name === current} onOpen={() => { void openLibraryFilm(name) }} />
          ))}
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

  // While the mode is open: Space or K plays and pauses, and a film pasted onto the page opens
  useEffect(() => {
    if (!open) return
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key !== ' ' && event.key.toLowerCase() !== 'k') return
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
              pauses. Escape or the Films button at the top right closes it and brings the particle scene back.
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
