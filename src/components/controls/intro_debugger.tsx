import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Keyboard, Pause, Play, Repeat, RotateCcw, StepForward } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn, isTextEntry, prefersReducedMotion } from '@/lib/utils'
import { useIntroDebugStore } from '../../store/intro_debug_store'
import { getCachedIntroMarkers } from '../../lib/intro_tracks'
import { INTRO_DOCK_ID, focusIntroToggle, isInDock, toggleIntroDebugger } from '../../lib/intro_dock'
import type { IntroParams } from '../../lib/intro_params'
import SliderControl from './slider_control'
import ToggleButton from './toggle_button'
import HelpTooltip from './help_tooltip'
import IntroTrackList from './intro_track_list'
import IntroPresetBar from './intro_preset_bar'

// Pausing is the PLAY button's job, so the speed never reaches zero
const MIN_SPEED = 0.05
// Read by screen readers only: in the header the hint would push the slider off the transport's line
const SPEED_HINT = 'Intro pace, kept after the debugger closes'
const SEEK_STEP = 0.1
const FRAME = 1 / 60

// Dock height: dragged by its top edge, kept across reloads. A phone gives the timeline more of the screen
const HEIGHT_STORAGE_KEY = 'intro-debug-dock-height'
const MIN_HEIGHT = 160
const MAX_HEIGHT_SHARE = 0.85
const HEIGHT_STEP = 40
const PHONE_WIDTH = 640
// A press on the grip resizes once it moves this far; two presses that stay put this close together switch
// the height
const GRIP_SLOP = 4
const DOUBLE_TAP_MS = 400

// Key, then what it does. The single keys work while the focus is in the debugger; the side arrows, Home and
// End also from the page itself. PageUp and PageDown on the time bar stay in its aria-keyshortcuts only
const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['Space', 'Play or pause'],
  ['← → ↑ ↓', 'Step 0.1 s on the time bar (Shift: 1 frame)'],
  ['[ ]', 'Previous or next moment'],
  ['Home End', 'Jump to start or end'],
  ['.', 'Next frame'],
  ['R', 'Restart'],
  ['L', 'Loop on or off'],
  ['← → on a moment', 'Move it (Shift: fine)'],
  ['Enter on a moment', 'Seek to it, open its setting'],
  ['Delete', 'Reset the focused slider or moment'],
  ['Alt+Enter', 'Show only this layer (on its eye)'],
  ['Esc', 'Close the debugger'],
  ['Alt+Shift+D', 'Open or close, from anywhere']
]

const shortcutList = (
  <div className="py-0.5">
    <p className="mb-1.5 text-text-light/70">While the focus is in the debugger</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {SHORTCUTS.map(([keys, action]) => (
        <Fragment key={keys}>
          <dt className="whitespace-nowrap text-neon-cyan">{keys}</dt>
          <dd>{action}</dd>
        </Fragment>
      ))}
    </dl>
  </div>
)

// The header's buttons share one height: a finger's 32 px on a phone, 28 px from sm up
const transportButton = 'h-8 sm:h-7'

function formatSpeed (speed: number) {
  return `${Number(speed.toFixed(2))}×`
}

// The timeline's length until the loop publishes it: the last moment of the intro. The moments are worked
// out once per change of the parameters, so the readout's frequent store updates only read the last one
function selectDuration (state: { params: IntroParams, readout: { duration: number } }) {
  if (state.readout.duration) return state.readout.duration
  const markers = getCachedIntroMarkers(prefersReducedMotion, state.params)
  return markers[markers.length - 1].time
}

// A slider that has the focus uses the arrow keys itself; the timeline ruler is the one that seeks
function isAdjustingSlider (target: EventTarget | null) {
  return target instanceof HTMLElement && target.getAttribute('role') === 'slider' && !target.hasAttribute('data-intro-ruler')
}

// A focused control that Space or Enter activates keeps those keys; they never play or pause behind it. A text
// field never gets here, so `input` covers the rest, such as a colour swatch, whose picker Space opens
function isActivatable (target: EventTarget | null) {
  return target instanceof HTMLElement &&
    target.closest('button, input, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]') !== null
}

// The seeking keys work while the focus is in the debugger or on the page itself, never behind a control
// elsewhere, such as the Settings panel
function isInDebuggerScope (target: EventTarget | null) {
  return !(target instanceof HTMLElement) || target === document.body || isInDock(target)
}

// Single keys with no modifier act only while the focus is in the debugger, so a stray key press elsewhere on
// the page never restarts or pauses the intro
const SINGLE_KEYS = new Set(['Space', 'KeyR', 'KeyL', 'Period', 'BracketLeft', 'BracketRight'])

// The page-wide open and close: it has modifiers, so it works from a text field too. Matched by the physical
// key, since Option+Shift+D types a character on a Mac and leaves `key` useless
function isToggleShortcut (event: KeyboardEvent) {
  return event.code === 'KeyD' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
}

function publishHeight (dock: HTMLElement) {
  document.documentElement.style.setProperty('--intro-dock-height', `${dock.offsetHeight}px`)
}

// The height the dock would take to show every track with no scrolling: no drag, key or double-click takes
// it past that, so it never ends in empty space
function contentHeight (dock: HTMLElement | null) {
  const list = dock?.querySelector<HTMLElement>('[data-intro-tracks]')
  return dock && list ? dock.offsetHeight - list.clientHeight + list.scrollHeight : Infinity
}

function clampHeight (height: number, content = Infinity) {
  return Math.round(Math.max(MIN_HEIGHT, Math.min(height, window.innerHeight * MAX_HEIGHT_SHARE, content)))
}

function defaultHeight () {
  return clampHeight(window.innerHeight * (window.innerWidth < PHONE_WIDTH ? 0.55 : 0.4))
}

function loadHeight () {
  let stored = 0
  try {
    stored = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY))
  } catch {
    // Storage blocked: start at the default height
  }
  return Number.isFinite(stored) && stored > 0 ? clampHeight(stored) : defaultHeight()
}

function saveHeight (height: number) {
  try {
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(height))
  } catch {
    // Storage blocked: the height holds for this session
  }
}

// The phase name is a status, not a control, so it is not drawn in the accent. From sm up it keeps the width
// of the longest moment's name, so the controls after it stay put while the intro plays; on a phone it ends
// its row and takes what is left
function TimeReadout ({ duration }: { duration: number }) {
  // The scene keeps running after the intro ends; the timeline stops at its end
  const time = useIntroDebugStore(state => Math.min(state.readout.time, duration))
  const phase = useIntroDebugStore(state => state.readout.phase)
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-1.5 tabular-nums [contain:layout_paint] sm:flex-none sm:gap-2">
      <span className="shrink-0 text-sm text-text-light">{time.toFixed(2)} s</span>
      <span className="shrink-0 text-text-light/60">/ {duration.toFixed(2)} s</span>
      <span className="min-w-0 flex-1 truncate text-text-light/80 sm:w-[18ch] sm:flex-none">{phase || '—'}</span>
    </div>
  )
}

// Replays the opening on a multi-track timeline docked at the bottom: transport and playback speed
// on top, one track per element of the scene below
function IntroDebugger () {
  const open = useIntroDebugStore(state => state.open)
  const playing = useIntroDebugStore(state => state.playing)
  const timeScale = useIntroDebugStore(state => state.timeScale)
  const loop = useIntroDebugStore(state => state.loop)
  // A number, so dragging an intro slider does not re-render the header and the preset bar
  const duration = useIntroDebugStore(selectDuration)
  const actions = useIntroDebugStore.getState()
  const dockRef = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(() => typeof window === 'undefined' ? 360 : loadHeight())
  // A drag moves the dock's edge straight through the DOM, once per frame, and the height is committed to
  // React when the drag ends, so the header does not re-render with every pointer move. While it lasts, the
  // height is not published to the controls that sit above the dock either; they follow once it ends
  // A press that has not yet moved past the slop is a click or a tap, and leaves the height alone
  // `content` is the content's height, measured when the press starts
  const drag = useRef<{ active: boolean, moved: boolean, startX: number, startY: number, height: number | null, content: number, frame: number }>(
    { active: false, moved: false, startX: 0, startY: 0, height: null, content: Infinity, frame: 0 }
  )
  // When the last click or tap on the grip ended; a second one soon after is a double-click or double-tap
  const lastTapAt = useRef(-Infinity)
  useEffect(() => () => window.cancelAnimationFrame(drag.current.frame), [])

  // However the dock closes (its toggle, Alt+Shift+D, Escape, the agent API), focus inside it goes back to its
  // toggle instead of falling to the page. A layout effect, so the dock is still in the page and still holds
  // the focus when this runs
  useLayoutEffect(() => {
    if (!open) return
    return () => {
      if (isInDock(document.activeElement)) focusIntroToggle()
    }
  }, [open])

  // Tells the page the dock is open, so the first-visit hints step aside (index.css)
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.dataset.introOpen = ''
    return () => { delete root.dataset.introOpen }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const debug = useIntroDebugStore.getState()
      if (isToggleShortcut(event)) {
        event.preventDefault()
        // Held down, the key repeats; the dock opens or closes once per press
        if (event.repeat) return
        toggleIntroDebugger()
        return
      }
      // Escape closes the panel the focus is in. A confirmation, a text field, the hint menu or an open popover
      // in the dock takes it first; with Settings open, Settings closes the dock for it (control_panel.tsx)
      if (event.key === 'Escape') {
        if (debug.open && isInDock(event.target) && !event.defaultPrevented && !isTextEntry(event.target)) {
          event.preventDefault()
          debug.setOpen(false)
        }
        return
      }
      if (isTextEntry(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (!debug.open || !isInDebuggerScope(event.target)) return
      if (SINGLE_KEYS.has(event.code) && !isInDock(event.target)) return
      if (event.code === 'Space' && isActivatable(event.target)) return

      const arrow = event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'Home' || event.code === 'End'
      if (arrow && isAdjustingSlider(event.target)) return

      const end = debug.readout.duration
      const time = Math.min(debug.readout.time, end || Infinity)
      const step = event.shiftKey ? FRAME : SEEK_STEP
      const moments = getCachedIntroMarkers(prefersReducedMotion, debug.params)
      switch (event.code) {
      case 'Space':
        debug.togglePlaying()
        break
      case 'ArrowLeft':
        debug.seek(time - step)
        break
      case 'ArrowRight':
        debug.seek(time + step)
        break
      case 'Home':
        debug.seek(0)
        break
      case 'End':
        debug.seek(end)
        break
      case 'BracketLeft': {
        const previous = moments.filter(moment => moment.time < time - 0.01).pop()
        debug.seek(previous ? previous.time : 0)
        break
      }
      case 'BracketRight': {
        const next = moments.find(moment => moment.time > time + 0.01)
        debug.seek(next ? next.time : end)
        break
      }
      case 'KeyL':
        debug.toggleLoop()
        break
      case 'Period':
        debug.step()
        break
      case 'KeyR':
        debug.restart()
        break
      default:
        return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Publishes the dock height so bottom-anchored controls can sit above it
  useEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    const observer = new ResizeObserver(() => {
      if (!drag.current.active) publishHeight(dock)
    })
    observer.observe(dock)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--intro-dock-height')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleResize = () => setHeight(current => clampHeight(current))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  if (!open) return null

  const resizeFrom = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const pending = drag.current
    if (!pending.moved) {
      if (Math.abs(event.clientY - pending.startY) < GRIP_SLOP) return
      pending.moved = true
    }
    pending.height = clampHeight(window.innerHeight - event.clientY, pending.content)
    if (pending.frame) return
    pending.frame = window.requestAnimationFrame(() => {
      pending.frame = 0
      if (dockRef.current && pending.height !== null) dockRef.current.style.maxHeight = `${pending.height}px`
    })
  }
  // The capture also ends when a drag is cancelled, and the height reached so far is kept then too
  const commitDrag = () => {
    const pending = drag.current
    window.cancelAnimationFrame(pending.frame)
    pending.active = false
    pending.frame = 0
    if (pending.height === null) return
    const next = pending.height
    pending.height = null
    if (dockRef.current) {
      dockRef.current.style.maxHeight = `${next}px`
      publishHeight(dockRef.current)
    }
    setHeight(next)
    saveHeight(next)
  }
  // A double-click or a double-tap on the grip switches between the default height and the tallest one, so a
  // single pointer needs no drag (WCAG 2.5.7)
  const toggleHeight = () => {
    const pending = drag.current
    window.cancelAnimationFrame(pending.frame)
    pending.frame = 0
    pending.height = null
    const dock = dockRef.current
    const tallest = clampHeight(Infinity, contentHeight(dock))
    const shown = dock?.offsetHeight ?? height
    const next = shown >= tallest - 1 ? Math.min(defaultHeight(), tallest) : tallest
    if (dock) dock.style.maxHeight = `${next}px`
    setHeight(next)
    saveHeight(next)
  }
  const endPress = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pending = drag.current
    const still = !pending.moved && Math.abs(event.clientX - pending.startX) < GRIP_SLOP
    if (still && event.timeStamp - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = -Infinity
      toggleHeight()
    } else {
      lastTapAt.current = still ? event.timeStamp : -Infinity
    }
  }
  // From the height the dock shows, which a short track list keeps under the one set
  const resizeWithKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const dock = dockRef.current
    const content = contentHeight(dock)
    const shown = dock?.offsetHeight ?? height
    let next: number
    switch (event.key) {
    case 'ArrowUp': next = clampHeight(shown + HEIGHT_STEP, content); break
    case 'ArrowDown': next = clampHeight(shown - HEIGHT_STEP, content); break
    case 'Home': next = clampHeight(MIN_HEIGHT, content); break
    case 'End': next = clampHeight(Infinity, content); break
    default: return
    }
    event.preventDefault()
    event.stopPropagation()
    setHeight(next)
    saveHeight(next)
  }

  return (
    <TooltipProvider delayDuration={500}>
      {/* Takes the focus when its toggle opens it, without a ring: the controls inside show theirs */}
      <section
        ref={dockRef}
        id={INTRO_DOCK_ID}
        data-intro-dock=""
        aria-label="Intro debugger"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[45] flex flex-col border-t border-neon-cyan/40 bg-bg-dark/[0.94]
          font-mono text-xs text-text-light shadow-[0_-12px_32px_rgba(0,0,0,0.45)] outline-none"
        // The height set by the grip is a ceiling: with fewer tracks than fit, the dock ends at the last one
        style={{ maxHeight: height }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize intro debugger"
          aria-valuenow={height}
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={Math.round(window.innerHeight * MAX_HEIGHT_SHARE)}
          aria-valuetext={`${Math.round(height / window.innerHeight * 100)}% of the screen`}
          tabIndex={0}
          title="Drag to resize · double-click: tallest or default"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            Object.assign(drag.current, { active: true, moved: false, startX: event.clientX, startY: event.clientY, content: contentHeight(dockRef.current) })
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={resizeFrom}
          onPointerUp={endPress}
          onLostPointerCapture={commitDrag}
          onKeyDown={resizeWithKeys}
          aria-keyshortcuts="ArrowUp ArrowDown Home End"
          className="group absolute inset-x-0 -top-4 z-30 flex h-6 cursor-ns-resize touch-none items-center justify-center pt-2
            focus-visible:outline-none"
        >
          <span className="h-[3px] w-10 rounded-full bg-neon-cyan/60 transition-colors duration-150 group-hover:bg-neon-cyan group-focus-visible:bg-neon-cyan" />
          {/* With the keyboard on it, the whole top edge lights up, over the dock's border */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-4 h-px bg-neon-cyan opacity-0 group-focus-visible:opacity-100" />
        </div>

        {/* The header measures its own width, not the window's: with Settings open the dock is narrower. On a
            wide dock everything sits on one row; on a narrower one the title row keeps KEYS at its
            right end and the transport, time and speed wrap onto the row below it. On a phone the speed joins
            the title row, so the header keeps to two rows: the group around the transport gives way to its
            children there, and the transport and time take the second row */}
        <header className="border-b border-neon-cyan/20 [container-type:inline-size]">
          {/* On a phone the title is a size smaller and the gaps tighter, so the speed's name fits beside it at 390 px */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-3 py-2 sm:gap-x-4">
            <h2 className="shrink-0 font-orbitron text-sm tracking-[1px] text-neon-cyan max-sm:text-xs max-sm:tracking-normal">INTRO DEBUGGER</h2>

            <div className="order-last flex basis-full flex-wrap items-center gap-x-4 gap-y-2 max-sm:contents
              [@container(min-width:69rem)]:order-none [@container(min-width:69rem)]:basis-auto">
              <div className="flex min-w-0 items-center gap-x-3 max-sm:order-last max-sm:basis-full sm:gap-x-4">
                {/* Icons alone on a phone; from sm up each name is visible and part of what is announced */}
                <div className="flex shrink-0 gap-1">
                  <ToggleButton onClick={actions.restart} aria-label="Restart intro" aria-keyshortcuts="R" title="Restart (R)" className={cn(transportButton, 'w-8 px-0')}>
                    <RotateCcw className="h-4 w-4" />
                  </ToggleButton>
                  {/* The label already says what a press does, so the button is not also announced as pressed */}
                  <ToggleButton
                    active={playing}
                    aria-pressed={undefined}
                    aria-label={playing ? 'Pause' : 'Play'}
                    aria-keyshortcuts="Space"
                    onClick={actions.togglePlaying}
                    title="Play / pause (Space)"
                    className={cn(transportButton, 'w-8 gap-2 px-0 sm:w-[5.5rem]')}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span className="max-sm:hidden">{playing ? 'PAUSE' : 'PLAY'}</span>
                  </ToggleButton>
                  <ToggleButton aria-label="One frame forward" aria-keyshortcuts="." onClick={actions.step} title="One frame forward (.)" className={cn(transportButton, 'w-8 gap-2 px-0 sm:w-auto sm:px-2')}>
                    <StepForward className="h-4 w-4" />
                    <span className="max-sm:hidden">FRAME</span>
                  </ToggleButton>
                  <ToggleButton active={loop} aria-label="Loop" aria-keyshortcuts="L" onClick={actions.toggleLoop} title="Restart at the end (L)" className={cn(transportButton, 'w-8 gap-2 px-0 sm:w-auto sm:px-2')}>
                    <Repeat className="h-4 w-4" />
                    <span className="max-sm:hidden">LOOP</span>
                  </ToggleButton>
                </div>

                <TimeReadout duration={duration} />
              </div>

              {/* The slider sets any speed, and a double-click or Delete returns it to 1×. Its hint is in its
                  context menu and read by screen readers */}
              <div className="flex min-w-0 max-sm:flex-1 sm:w-44">
                <SliderControl
                  id="intro-speed"
                  label="Play Speed"
                  value={timeScale}
                  min={MIN_SPEED}
                  max={2}
                  step={0.05}
                  formatValue={formatSpeed}
                  onChange={actions.setTimeScale}
                  resetValue={1}
                  description={SPEED_HINT}
                />
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              {/* The shortcuts are for a keyboard, so a phone goes without them */}
              <HelpTooltip
                label="Keys: keyboard shortcuts"
                content={shortcutList}
                buttonClassName={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'hidden h-7 gap-1 border-text-light/40 bg-transparent px-2 font-mono text-xs text-text-light/70 hover:bg-neon-cyan/30 sm:inline-flex'
                )}
              >
                <Keyboard className="h-3.5 w-3.5" />
                KEYS
              </HelpTooltip>
            </div>

          </div>
        </header>

        <IntroPresetBar />
        <IntroTrackList duration={duration} />
      </section>
    </TooltipProvider>
  )
}

export default IntroDebugger
