import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Play, Repeat, RotateCcw, StepForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useIntroDebugStore } from '../../store/intro_debug_store'
import { getIntroMarkers } from '../../lib/intro_tracks'
import SliderControl from './slider_control'
import ToggleButton from './toggle_button'
import HelpTooltip from './help_tooltip'
import IntroTrackList from './intro_track_list'
import IntroPresetBar from './intro_preset_bar'

// Pausing is the PLAY button's job, so the speed never reaches zero
const MIN_SPEED = 0.05
const SPEED_PRESETS = [0.1, 0.25, 0.5, 1, 2]
const SEEK_STEP = 0.1
const FRAME = 1 / 60

// Dock height: dragged by its top edge, kept across reloads
const HEIGHT_STORAGE_KEY = 'intro-debug-dock-height'
const MIN_HEIGHT = 160
const MAX_HEIGHT_SHARE = 0.85
const HEIGHT_STEP = 40

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SHORTCUTS = 'Space: play or pause (a focused button takes Space itself) · ← →: 0.1 s back or forward, with Shift one frame · Page Up, Page Down on the timeline: 1 s · [ ]: previous or next moment · Home, End: start or end · . one frame forward · R: restart · L: loop · Shift+D: open or close'

function formatSpeed (speed: number) {
  return `${speed.toFixed(2)}×`
}

// A slider that has the focus uses the arrow keys itself; the timeline ruler is the one that seeks
function isAdjustingSlider (target: EventTarget | null) {
  return target instanceof HTMLElement && target.getAttribute('role') === 'slider' && !target.hasAttribute('data-intro-ruler')
}

// A focused control that Space or Enter activates keeps those keys; they never play or pause behind it
function isActivatable (target: EventTarget | null) {
  return target instanceof HTMLElement &&
    target.closest('button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]') !== null
}

function isTyping (target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function clampHeight (height: number) {
  return Math.round(Math.min(Math.max(height, MIN_HEIGHT), window.innerHeight * MAX_HEIGHT_SHARE))
}

function loadHeight () {
  let stored = 0
  try {
    stored = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY))
  } catch {
    // Storage blocked: start at the default height
  }
  return clampHeight(Number.isFinite(stored) && stored > 0 ? stored : window.innerHeight * 0.45)
}

function saveHeight (height: number) {
  try {
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(height))
  } catch {
    // Storage blocked: the height holds for this session
  }
}

function TimeReadout ({ duration }: { duration: number }) {
  // The scene keeps running after the intro ends; the timeline stops at its end
  const time = useIntroDebugStore(state => Math.min(state.readout.time, duration))
  const phase = useIntroDebugStore(state => state.readout.phase)
  return (
    <div className="flex items-baseline gap-2 tabular-nums">
      <span className="text-sm text-text-light">{time.toFixed(2)} s</span>
      <span className="text-text-light/60">/ {duration.toFixed(2)} s</span>
      <span className="min-w-[5.5rem] text-neon-cyan">{phase || '—'}</span>
    </div>
  )
}

function SegmentCount () {
  const drawn = useIntroDebugStore(state => state.readout.particlesDrawn)
  return <span className="tabular-nums text-text-light/60" title="Particles drawn in the last frame">{drawn.toLocaleString('en-US')} particles drawn</span>
}

// Replays the opening on a multi-track timeline docked at the bottom: transport and playback speed
// on top, one track per element of the scene below
function IntroDebugger () {
  const open = useIntroDebugStore(state => state.open)
  const playing = useIntroDebugStore(state => state.playing)
  const timeScale = useIntroDebugStore(state => state.timeScale)
  const loop = useIntroDebugStore(state => state.loop)
  const params = useIntroDebugStore(state => state.params)
  const readoutDuration = useIntroDebugStore(state => state.readout.duration)
  const actions = useIntroDebugStore.getState()
  const dockRef = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(() => typeof window === 'undefined' ? 360 : loadHeight())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const debug = useIntroDebugStore.getState()

      if (event.shiftKey && event.code === 'KeyD') {
        debug.setOpen(!debug.open)
        event.preventDefault()
        return
      }
      if (!debug.open) return
      if (event.code === 'Space' && isActivatable(event.target)) return

      const arrow = event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'Home' || event.code === 'End'
      if (arrow && isAdjustingSlider(event.target)) return

      const end = debug.readout.duration
      const time = Math.min(debug.readout.time, end || Infinity)
      const step = event.shiftKey ? FRAME : SEEK_STEP
      const moments = getIntroMarkers(reducedMotion, debug.params)
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
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--intro-dock-height', `${dock.offsetHeight}px`))
    observer.observe(dock)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--intro-dock-height')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleResize = () => setHeight(current => clampHeight(current))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  if (!open) return null

  const markers = getIntroMarkers(reducedMotion, params)
  const duration = readoutDuration || markers[markers.length - 1].time

  const resizeFrom = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    setHeight(clampHeight(window.innerHeight - event.clientY))
  }
  const resizeWithKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowUp' ? HEIGHT_STEP : event.key === 'ArrowDown' ? -HEIGHT_STEP : 0
    if (delta === 0) return
    event.preventDefault()
    event.stopPropagation()
    const next = clampHeight(height + delta)
    setHeight(next)
    saveHeight(next)
  }

  return (
    <TooltipProvider delayDuration={500}>
      <section
        ref={dockRef}
        data-intro-dock=""
        aria-label="Intro debugger"
        className="fixed inset-x-0 bottom-0 z-[45] flex flex-col border-t border-neon-cyan/40 bg-[rgba(10,10,15,0.94)]
          font-mono text-xs text-text-light shadow-[0_-12px_32px_rgba(0,0,0,0.45)]"
        style={{ height }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize intro debugger"
          aria-valuenow={height}
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={Math.round(window.innerHeight * MAX_HEIGHT_SHARE)}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={resizeFrom}
          onPointerUp={() => saveHeight(height)}
          onKeyDown={resizeWithKeys}
          className="group absolute inset-x-0 -top-1.5 z-30 flex h-3 cursor-ns-resize touch-none items-center justify-center
            focus-visible:outline-none"
        >
          <span className="h-[3px] w-10 rounded-full bg-neon-cyan/35 transition-colors duration-150 group-hover:bg-neon-cyan group-focus-visible:bg-neon-cyan" />
        </div>

        <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neon-cyan/20 px-3 py-2">
          <h2 className="font-orbitron text-sm tracking-[1px] text-neon-cyan">INTRO DEBUG</h2>

          <div className="flex gap-1">
            <ToggleButton active={false} aria-pressed={undefined} onClick={actions.restart} aria-label="Restart intro" aria-keyshortcuts="R" title="Restart (R)" className="h-8 px-2">
              <RotateCcw className="h-4 w-4" />
            </ToggleButton>
            {/* The label already says what a press does, so the button is not also announced as pressed */}
            <ToggleButton active={playing} aria-pressed={undefined} aria-keyshortcuts="Space" onClick={actions.togglePlaying} title="Play / pause (Space)" className="h-8 w-[5.5rem] gap-2">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? 'PAUSE' : 'PLAY'}
            </ToggleButton>
            <ToggleButton active={false} aria-pressed={undefined} aria-keyshortcuts="." onClick={actions.step} title="One frame forward (.)" className="h-8 gap-2 px-2">
              <StepForward className="h-4 w-4" />
              FRAME
            </ToggleButton>
            <ToggleButton active={loop} aria-keyshortcuts="L" onClick={actions.toggleLoop} title="Restart at the end (L)" className="h-8 gap-2 px-2">
              <Repeat className="h-4 w-4" />
              LOOP
            </ToggleButton>
          </div>

          <TimeReadout duration={duration} />

          <div className="flex items-center gap-1">
            <div className="w-48">
              <SliderControl
                id="intro-speed"
                label="Speed"
                value={timeScale}
                min={MIN_SPEED}
                max={2}
                step={0.05}
                formatValue={formatSpeed}
                onChange={actions.setTimeScale}
                variant="inline"
                resetValue={1}
                description="Speed of the whole scene while the debugger is open. PAUSE stops everything; the lens, flash and title still follow the timeline when you scrub. A double-click returns to 1×."
              />
            </div>
            {SPEED_PRESETS.map(speed => (
              <ToggleButton
                key={speed}
                active={timeScale === speed}
                aria-label={`Speed ${speed}×`}
                onClick={() => actions.setTimeScale(speed)}
                className="h-8 px-2 text-xs"
              >
                {`${speed}×`}
              </ToggleButton>
            ))}
          </div>

          <SegmentCount />

          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-text-light/60">
              Keys
              <HelpTooltip content={SHORTCUTS} side="top" iconClassName="h-3.5 w-3.5" />
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close intro debugger"
              onClick={() => actions.setOpen(false)}
              className="h-7 w-7 text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <IntroPresetBar />
        <IntroTrackList duration={duration} />
      </section>
    </TooltipProvider>
  )
}

export default IntroDebugger
