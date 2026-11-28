import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, Clapperboard, Copy, Download, FileDown, FolderOpen, Link2, Play, Search, WandSparkles, X } from 'lucide-react'
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
  cancelVideo, copyFilmLink, copyFilmText, leaveFilms, openFiles, openFilm, openFromAddress, openFromScene, openLibraryFilm, openPasted,
  saveFilmFile, saveVideo, seekFilm
} from '../lib/film_session'
import ToggleButton from './controls/toggle_button'
import { LIBRARY_SEARCH_ID, Stage } from './film_player'
import { clock, pickFiles, playerHoldsEscape, saveLeft } from '../lib/film_ui'

// The page's film mode: a film played live on a stage beside its panel, from a file, a drop, a paste, the
// library of this repository's films or the scene itself, and saved as its file or an mp4. The stage and its
// transport are film_player.tsx, what they do film_session.ts; the engine loads with the first film. The
// button that opens it sits in the scene toolbar (control_panel.tsx)

const PANEL_ID = 'films-panel'
const TOGGLE_SELECTOR = '[data-films-toggle]'
const QUALITY_LABELS = { medium: 'Medium', high: 'High', max: 'Max' } as const
const KIND_LABELS = { film: 'Film', fractal: 'Mandelbrot film', reel: 'Reel' } as const
const COPIED_MS = 1500

const canSaveVideo = typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'

const ACTION = 'h-7 gap-1.5 border-neon-cyan/50 px-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan [@media(pointer:coarse)]:h-10'
const QUIET_ACTION = 'h-7 gap-1.5 border-text-light/40 px-2 font-mono text-xs text-text-light/80 hover:bg-neon-cyan/20 hover:text-neon-cyan [@media(pointer:coarse)]:h-10'

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

// A disclosure of the card: a quiet underlined word that opens a list under the card's rows
function CardToggle ({ open, controls, onToggle, children }: { open: boolean, controls: string, onToggle: () => void, children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="shrink-0 underline decoration-text-light/30 underline-offset-2 hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
    >
      {children}
    </button>
  )
}

// A reel's clips, each a button that goes to its start; the one playing is marked. A leaf, since the time
// it follows changes as the film plays
function ChapterList ({ id, chapters }: { id: string, chapters: { name: string, start: number }[] }) {
  const playing = useFilmStore(state => {
    let index = 0
    chapters.forEach((chapter, at) => { if (state.time >= chapter.start) index = at })
    return index
  })
  return (
    <ol id={id} aria-label="Chapters" className="mt-1 flex flex-col gap-px">
      {chapters.map((chapter, index) => (
        <li key={chapter.start}>
          <button
            type="button"
            aria-current={index === playing || undefined}
            onClick={() => seekFilm(chapter.start)}
            className={cn(
              'flex h-7 w-full items-center gap-2 px-2 text-left font-mono text-xs transition-colors duration-150 [@media(pointer:coarse)]:h-10',
              'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan',
              index === playing ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-text-light/80 hover:bg-neon-cyan/10 hover:text-neon-cyan'
            )}
          >
            <span className="w-10 shrink-0 tabular-nums text-text-light/60">{clock(chapter.start)}</span>
            <span className="min-w-0 flex-1 truncate">{chapter.name}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

// The film in the mode: its title, where it is from, its line, its frame and length, who made it, a reel's
// chapters and what the planner changed in it. Every row has its height whatever the film, whether it is
// still loading and whether its meta.json has come, so switching films moves nothing below the card; only
// the chapters and the notes, opened on request, grow it
function NowLoaded () {
  const entry = useFilmStore(state => state.entry)
  const facts = useFilmStore(state => state.facts)
  const status = useFilmStore(state => state.status)
  const notesId = useId()
  const chaptersId = useId()
  // The film whose notes or chapters are open, so a new film opens with them closed
  const [notesOf, setNotesOf] = useState<string | null>(null)
  const [chaptersOf, setChaptersOf] = useState<string | null>(null)
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
  const chapters = facts?.chapters ?? []
  const notesOpen = notesOf === entry.name && notes.length > 0
  const chaptersOpen = chaptersOf === entry.name && chapters.length > 0
  return (
    <div className="flex flex-col bg-text-light/[0.06] px-3 py-2">
      <p className="h-5 truncate text-sm leading-5 text-text-light" title={title}>{title}</p>
      <p className="h-5 truncate font-mono text-xs leading-5 text-text-light/70" title={entry.name}>{where}</p>
      <p className="mt-1 line-clamp-2 h-10 text-xs leading-5 text-text-light/80" title={about || undefined}>{about}</p>
      <p className="mt-1 h-5 truncate font-mono text-xs leading-5 text-text-light/70">{factsLine}</p>
      <div className="flex h-5 items-center gap-3 font-mono text-xs leading-5 text-text-light/70">
        <span className="min-w-0 flex-1 truncate" title={made || undefined}>{made}</span>
        {chapters.length > 0 && (
          <CardToggle open={chaptersOpen} controls={chaptersId} onToggle={() => setChaptersOf(chaptersOpen ? null : entry.name)}>
            {`${chapters.length} chapters`}
          </CardToggle>
        )}
        {notes.length > 0 && (
          <CardToggle open={notesOpen} controls={notesId} onToggle={() => setNotesOf(notesOpen ? null : entry.name)}>
            {notes.length === 1 ? '1 note' : `${notes.length} notes`}
          </CardToggle>
        )}
      </div>
      {chaptersOpen && <ChapterList id={chaptersId} chapters={chapters} />}
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

const ROW_SIDE_BUTTON = 'flex w-7 items-center justify-center bg-text-light/[0.06] text-text-light/60 hover:text-neon-cyan [@media(pointer:coarse)]:w-10 ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan'

// One film to open: the one in the mode is marked with the play sign and the accent
function FilmRow ({ name, current, onOpen, onForget, aside, parts }: FilmRowProps) {
  return (
    <div data-film-row={current ? 'current' : undefined} className="flex h-7 items-stretch [@media(pointer:coarse)]:h-10">
      <button
        type="button"
        aria-current={current || undefined}
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 pl-2 pr-2 text-left font-mono text-xs transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan',
          current ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-text-light/[0.06] text-text-light/90 hover:bg-neon-cyan/10 hover:text-neon-cyan'
        )}
      >
        <span aria-hidden="true" className="flex w-2.5 shrink-0 justify-center">
          {current && <Play className="h-2.5 w-2.5 fill-current" />}
        </span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {aside && <span className="shrink-0 text-[11px] text-text-light/60">{aside}</span>}
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

// The words a search looks for, in lower case: what the list shows, and the folder's name
const searchText = (film: LibraryFilm) => `${film.title} ${film.name}`.toLowerCase()

// A film of the library by its title, with its parts (a reel's clips, other voices, posters, takes) under it
// on request; a film whose part is open shows its parts from the start, and so does one whose parts a search
// found
function LibraryRow ({ film, current, parts }: { film: LibraryFilm, current: string | undefined, parts: LibraryFilm['parts'] }) {
  const partsId = useId()
  const holdsCurrent = current !== undefined && film.parts.some(part => part.path === current)
  const searched = parts.length < film.parts.length
  const [open, setOpen] = useState(holdsCurrent)
  useEffect(() => {
    if (holdsCurrent) setOpen(true)
  }, [holdsCurrent])
  const shown = open || (searched && parts.length > 0)
  return (
    <li className="flex flex-col gap-px">
      <FilmRow
        name={film.title}
        aside={film.kind ? KIND_ASIDE[film.kind] : undefined}
        current={film.path === current}
        onOpen={() => { void openLibraryFilm(film.path) }}
        parts={parts.length > 0 ? { open: shown, onToggle: () => setOpen(!shown), controls: partsId } : undefined}
      />
      {parts.length > 0 && shown && (
        <ul id={partsId} aria-label={`Parts of ${film.title}`} className="flex flex-col gap-px pl-3">
          {parts.map(part => (
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

// The library's search: a film by its title or folder, a part by its name. Escape clears it first
function LibrarySearch ({ query, onQuery, found }: { query: string, onQuery: (query: string) => void, found: number }) {
  return (
    <div className="relative" data-hint="Finds a film by its title or a part's name" data-hint-label="Search the library">
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-light/60" />
      <input
        id={LIBRARY_SEARCH_ID}
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query !== '') {
            event.preventDefault()
            onQuery('')
          }
        }}
        placeholder={`Search ${LIBRARY.length} films`}
        aria-label="Search the library"
        aria-keyshortcuts="/"
        autoComplete="off"
        spellCheck={false}
        className="h-8 w-full border border-text-light/25 bg-text-light/[0.04] pl-8 pr-8 font-mono text-xs text-text-light placeholder:text-text-light/60
          focus-visible:border-neon-cyan focus-visible:outline-none [@media(pointer:coarse)]:h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {query !== ''
        ? (
          <button
            type="button"
            aria-label="Clear the search"
            onClick={() => {
              onQuery('')
              document.getElementById(LIBRARY_SEARCH_ID)?.focus()
            }}
            className="absolute right-0 top-0 flex h-full w-8 items-center justify-center text-text-light/60 hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )
        : <kbd aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border border-text-light/25 px-1 font-mono text-[10px] leading-4 text-text-light/60 [@media(pointer:coarse)]:hidden">/</kbd>}
      <span role="status" className="sr-only">{query !== '' ? `${found} ${found === 1 ? 'film' : 'films'} found` : ''}</span>
    </div>
  )
}

function Library () {
  const recent = useFilmStore(state => state.recent)
  const forget = useFilmStore(state => state.forget)
  const current = useFilmStore(state => state.entry?.name)
  const recentId = useId()
  const libraryId = useId()
  const [query, setQuery] = useState('')
  const list = useRef<HTMLUListElement>(null)
  const words = query.trim().toLowerCase()
  const matches = LIBRARY.map(film => {
    if (!words || searchText(film).includes(words)) return { film, parts: film.parts }
    const parts = film.parts.filter(part => part.label.toLowerCase().includes(words))
    return parts.length > 0 ? { film, parts } : null
  }).filter(match => match !== null)

  // A film opened from outside the list (the next film, the keys) comes into view in it. Not the film the
  // panel opens with, so the card of the film playing stays at the top
  const shownFirst = useRef(current)
  useEffect(() => {
    if (current === shownFirst.current) return
    shownFirst.current = undefined
    list.current?.querySelector('[data-film-row="current"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

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
        <LibrarySearch query={query} onQuery={setQuery} found={matches.length} />
        <ul ref={list} className="flex flex-col gap-px">
          {matches.map(({ film, parts }) => <LibraryRow key={film.name} film={film} parts={parts} current={current?.toLowerCase()} />)}
        </ul>
        {matches.length === 0 && (
          <div className="flex flex-col items-start gap-2 px-3 py-2 font-mono text-xs text-text-light/80">
            <p>No film matches “{query.trim()}”.</p>
            <button type="button" onClick={() => setQuery('')} className="text-neon-cyan underline underline-offset-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan">
              Show every film
            </button>
          </div>
        )}
      </section>
    </>
  )
}

function QualityChoice ({ disabled }: { disabled: boolean }) {
  const quality = useFilmStore(state => state.quality)
  const setQuality = useFilmStore(state => state.setQuality)
  return (
    <div data-hint="Higher: sharper video, larger file" data-hint-label="Video quality">
      <div role="radiogroup" aria-label="Video quality" className="flex">
        {FILM_QUALITIES.map(choice => (
          <ToggleButton
            key={choice}
            role="radio"
            aria-checked={quality === choice}
            aria-pressed={undefined}
            active={quality === choice}
            disabled={disabled}
            onClick={() => setQuality(choice)}
            className="h-7 px-2 font-mono text-xs [@media(pointer:coarse)]:h-10"
          >
            {QUALITY_LABELS[choice]}
          </ToggleButton>
        ))}
      </div>
    </div>
  )
}

function SaveVideo () {
  const saving = useFilmStore(state => state.saving)
  const ready = useFilmStore(state => state.status === 'ready')
  const problem = useFilmStore(state => state.saveProblem)
  const share = saving ? Math.round(saving.frame / Math.max(1, saving.frames) * 100) : 0
  return (
    <>
      {saving
        ? (
          <div className="flex items-center gap-1">
            <div
              role="progressbar"
              aria-label="Saving video"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share}
              className="relative h-7 min-w-0 flex-1 bg-text-light/[0.06] [@media(pointer:coarse)]:h-10"
            >
              <div className="absolute inset-y-0 left-0 bg-neon-cyan/20" style={{ width: `${share}%` }} />
              <div className="absolute inset-y-0 w-px bg-neon-cyan" style={{ left: `${share}%` }} />
              <span className="absolute inset-0 flex items-center truncate whitespace-nowrap px-3 font-mono text-xs tabular-nums text-text-light/90">{share}%{saveLeft(saving) && ` · ${saveLeft(saving)}`}</span>
            </div>
            <Button variant="outline" onClick={() => { void cancelVideo() }} className={QUIET_ACTION}>
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              CANCEL
            </Button>
          </div>
        )
        : (
          <div className="flex gap-1">
            <QualityChoice disabled={!canSaveVideo} />
            <div className="min-w-0 flex-1" data-hint={canSaveVideo ? 'Renders the film on this device' : 'Saving video needs Chrome or Edge'} data-hint-label="Save MP4">
              <Button variant="outline" disabled={!canSaveVideo || !ready} onClick={() => { void saveVideo() }} className={cn(ACTION, 'w-full')}>
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                SAVE MP4
              </Button>
            </div>
          </div>
        )}
      {problem && <p role="alert" className="pl-3 font-mono text-[11px] leading-5 text-text-light/80">{problem}</p>}
    </>
  )
}

// A button that copies, and says so for a moment
function CopyButton ({ label, done, hint, disabled, copy, icon }: { label: string, done: string, hint: string, disabled: boolean, copy: () => Promise<boolean>, icon: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const press = async () => {
    if (!await copy()) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }
  return (
    <div data-hint={hint} data-hint-label={label}>
      <Button variant="outline" disabled={disabled} onClick={() => { void press() }} className={cn(QUIET_ACTION, 'w-full', copied && 'border-neon-cyan/60 text-neon-cyan')}>
        {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : icon}
        {copied ? 'COPIED' : label.toUpperCase()}
      </Button>
      <span role="status" className="sr-only">{copied ? done : ''}</span>
    </div>
  )
}

function SaveText () {
  const entry = useFilmStore(state => state.entry)
  const linkable = entry?.origin === 'library'
  return (
    <div className="grid grid-cols-3 gap-1">
      <div data-hint="The film's own file, to edit or share" data-hint-label="Film file">
        <Button variant="outline" disabled={!entry} onClick={saveFilmFile} className={cn(QUIET_ACTION, 'w-full')}>
          <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
          FILE
        </Button>
      </div>
      <CopyButton
        label="Text"
        done="Film text copied"
        hint="Copies the film's text to the clipboard"
        disabled={!entry}
        copy={copyFilmText}
        icon={<Copy aria-hidden="true" className="h-3.5 w-3.5" />}
      />
      <CopyButton
        label="Link"
        done="Link to this moment copied"
        hint={linkable ? 'Copies a link to this film at this moment' : 'Only a library film has a link'}
        disabled={!linkable}
        copy={copyFilmLink}
        icon={<Link2 aria-hidden="true" className="h-3.5 w-3.5" />}
      />
    </div>
  )
}

function ExportActions () {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <Heading id={headingId}>SAVE &amp; SHARE</Heading>
      <SaveVideo />
      <SaveText />
    </section>
  )
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

  // While the mode is open a film pasted onto the page opens; the player's keys are film_player.tsx's
  useEffect(() => {
    if (!open) return
    const paste = (event: ClipboardEvent) => {
      if (isTextEntry(event.target) || !event.clipboardData) return
      const files = [...event.clipboardData.files]
      const text = event.clipboardData.getData('text/plain')
      if (files.length > 0) void openFiles(files)
      else if (text.trim() !== '') openPasted(text)
      else return
      event.preventDefault()
    }
    window.addEventListener('paste', paste)
    return () => window.removeEventListener('paste', paste)
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
          // Escape closes the panel the focus is in (CLAUDE.md, UX), so one pressed on the stage leaves the film
          // playing; a menu of the transport closes first, and a search is cleared before the panel goes
          onEscapeKeyDown={(event) => {
            const target = event.target
            const inPanel = target instanceof Node && document.getElementById(PANEL_ID)?.contains(target) === true
            const searching = target instanceof HTMLInputElement && target.id === LIBRARY_SEARCH_ID && target.value !== ''
            if (!inPanel || playerHoldsEscape() || searching) event.preventDefault()
          }}
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
              Plays a film live in the browser. Pick one from the library, open a .json or .js film, drop it on the page or paste
              its text; a sound file dropped beside a film plays under it. Space plays and pauses, the question mark lists every key.
              Escape or the Films button at the top right closes it and brings the particle scene back.
            </SheetDescription>
          </SheetHeader>
          <NowLoaded />
          <ExportActions />
          <OpenActions />
          <Library />
        </SheetContent>
      </Sheet>
    </>
  )
}

export default FilmMode
