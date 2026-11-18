import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Play, Repeat, RotateCcw, StepForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useIntroDebugStore } from '../../store/intro_debug_store'
import { getIntroMarkers } from '../../lib/intro_tracks'
import SliderControl from './slider_control'
import ToggleButton from './toggle_button'
import IntroTrackList from './intro_track_list'

const SPEED_PRESETS = [0, 0.1, 0.25, 0.5, 1, 2]
const SEEK_STEP = 0.1
const FRAME = 1 / 60

// Dock height: dragged by its top edge, kept across reloads
const HEIGHT_STORAGE_KEY = 'intro-debug-dock-height'
const MIN_HEIGHT = 160
const MAX_HEIGHT_SHARE = 0.85
const HEIGHT_STEP = 40

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function formatSpeed (speed: number) {
  return speed === 0 ? 'STOPPED' : `${speed.toFixed(2)}×`
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
  const time = useIntroDebugStore(state => state.readout.time)
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
  return <span className="tabular-nums text-text-light/60">{drawn.toLocaleString('en-US')} segments</span>
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

      const time = debug.readout.time
      const step = event.shiftKey ? FRAME : SEEK_STEP
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
            <ToggleButton active={false} onClick={actions.restart} aria-label="Restart intro (R)" title="Restart (R)" className="h-8 px-2">
              <RotateCcw className="h-4 w-4" />
            </ToggleButton>
            <ToggleButton active={playing} onClick={actions.togglePlaying} title="Play / pause (Space)" className="h-8 w-[5.5rem] gap-2">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? 'PAUSE' : 'PLAY'}
            </ToggleButton>
            <ToggleButton active={false} onClick={actions.step} title="One frame forward (.)" className="h-8 gap-2 px-2">
              <StepForward className="h-4 w-4" />
              FRAME
            </ToggleButton>
            <ToggleButton active={loop} onClick={actions.toggleLoop} title="Restart at the end" className="h-8 gap-2 px-2">
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
                min={0}
                max={2}
                step={0.05}
                formatValue={formatSpeed}
                onChange={actions.setTimeScale}
                variant="inline"
                description="Speed of the whole scene while the debugger is open. 0 stops everything; the lens, flash and title still follow the timeline when you scrub."
              />
            </div>
            {SPEED_PRESETS.map(speed => (
              <ToggleButton
                key={speed}
                active={timeScale === speed}
                onClick={() => actions.setTimeScale(speed)}
                className="h-8 px-2 text-xs"
              >
                {speed === 0 ? 'STOP' : `${speed}×`}
              </ToggleButton>
            ))}
          </div>

          <SegmentCount />

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-text-light/60 lg:inline" title="Space play/pause · ←/→ seek 0.1 s (Shift: one frame) · . step · R restart">
              Shift+D
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

        <IntroTrackList duration={duration} />
      </section>
    </TooltipProvider>
  )
}

export default IntroDebugger
