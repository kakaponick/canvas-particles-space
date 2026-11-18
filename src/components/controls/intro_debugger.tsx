import { useEffect } from 'react'
import { Pause, Play, Repeat, RotateCcw, StepForward, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useIntroDebugStore, INTRO_LAYERS } from '../../store/intro_debug_store'
import { getIntroMarkers } from '../../lib/intro_timeline'
import SliderControl from './slider_control'
import ToggleButton from './toggle_button'

const SPEED_PRESETS = [0, 0.1, 0.25, 0.5, 1, 2]
const SEEK_STEP = 0.1
const FRAME = 1 / 60

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function formatSpeed (speed: number) {
  return speed === 0 ? 'STOPPED' : `${speed.toFixed(2)}×`
}

function isTyping (target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

// Replays the opening seconds with a timeline, playback speed down to a full stop, and layer switches
function IntroDebugger () {
  const open = useIntroDebugStore(state => state.open)
  const playing = useIntroDebugStore(state => state.playing)
  const timeScale = useIntroDebugStore(state => state.timeScale)
  const loop = useIntroDebugStore(state => state.loop)
  const hidden = useIntroDebugStore(state => state.hidden)
  const readout = useIntroDebugStore(state => state.readout)
  const actions = useIntroDebugStore.getState()

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

  if (!open) return null

  const markers = getIntroMarkers(reducedMotion)
  const duration = readout.duration || markers[markers.length - 1].time
  const values: [string, string][] = [
    ['star', readout.starGlow.toFixed(2)],
    ['flash', readout.flash.toFixed(2)],
    ['wave', readout.wave.toFixed(2)],
    ['reveal', readout.reveal.toFixed(2)],
    ['burst', `${readout.speedBoost.toFixed(2)}×`],
    ['hole scale', readout.holeScale.toFixed(2)],
    ['title α', readout.titleAlpha.toFixed(2)],
    ['flight speed', readout.speed.toFixed(2)],
    ['segments', readout.particlesDrawn.toLocaleString('en-US')]
  ]

  return (
    <TooltipProvider delayDuration={500}>
      <section
        aria-label="Intro debugger"
        className="fixed top-4 right-4 z-[600] w-[min(360px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto
          bg-[rgba(10,10,15,0.94)] border border-neon-cyan/40 p-4 font-mono text-xs text-text-light space-y-4"
      >
        <header className="flex items-center justify-between">
          <h2 className="font-orbitron text-neon-cyan text-sm tracking-[1px]">INTRO DEBUG</h2>
          <div className="flex items-center gap-3">
            <span className="text-text-light/50">Shift+D</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close intro debugger"
              onClick={() => actions.setOpen(false)}
              className="h-6 w-6 text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex gap-1">
          <ToggleButton active={false} onClick={actions.restart} aria-label="Restart intro (R)" className="px-2">
            <RotateCcw className="w-4 h-4" />
          </ToggleButton>
          <ToggleButton active={playing} onClick={actions.togglePlaying} className="flex-1 gap-2">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'PAUSE' : 'PLAY'}
          </ToggleButton>
          <ToggleButton active={false} onClick={actions.step} className="gap-2">
            <StepForward className="w-4 h-4" />
            FRAME
          </ToggleButton>
          <ToggleButton active={loop} onClick={actions.toggleLoop} className="gap-2">
            <Repeat className="w-4 h-4" />
            LOOP
          </ToggleButton>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between tabular-nums">
            <span className="text-neon-cyan">{readout.phase || '—'}</span>
            <span>{readout.time.toFixed(2)} s / {duration.toFixed(2)} s</span>
          </div>
          <div className="relative pb-3">
            <Slider
              aria-label="Intro time"
              min={0}
              max={duration}
              step={0.01}
              value={[Math.min(readout.time, duration)]}
              onValueChange={(value) => actions.seek(value[0])}
              trackHeight="h-2"
              thumbSize="h-3.5 w-3.5"
            />
            {markers.map(marker => (
              <span
                key={marker.label}
                aria-hidden="true"
                className="absolute bottom-0 h-2 w-px bg-neon-cyan/60"
                style={{ left: `${marker.time / duration * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {markers.map(marker => (
              <button
                key={marker.label}
                type="button"
                onClick={() => actions.seek(marker.time)}
                className={`px-1.5 py-0.5 border tabular-nums transition-colors ${
                  readout.phase === marker.label
                    ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/15'
                    : 'border-text-light/20 text-text-light/70 hover:border-neon-cyan/60 hover:text-neon-cyan'
                }`}
              >
                {marker.time.toFixed(1)} {marker.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <SliderControl
            id="intro-speed"
            label="Playback Speed"
            value={timeScale}
            min={0}
            max={2}
            step={0.05}
            formatValue={formatSpeed}
            onChange={actions.setTimeScale}
            variant="inline"
            description="Speed of the whole scene while the debugger is open. 0 stops everything; the lens, flash and title still follow the timeline when you scrub."
          />
          <div className="flex gap-1">
            {SPEED_PRESETS.map(speed => (
              <ToggleButton
                key={speed}
                active={timeScale === speed}
                onClick={() => actions.setTimeScale(speed)}
                className="flex-1 px-0 text-xs"
              >
                {speed === 0 ? 'STOP' : `${speed}×`}
              </ToggleButton>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
          {values.map(([name, value]) => (
            <div key={name} className="flex justify-between gap-2">
              <dt className="text-text-light/60">{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-1.5">
          <h3 className="text-text-light/60">Layers — switch one off to see what it adds</h3>
          <div className="flex flex-wrap gap-1">
            {INTRO_LAYERS.map(layer => (
              <ToggleButton
                key={layer.key}
                active={!hidden[layer.key]}
                onClick={() => actions.toggleLayer(layer.key)}
                className="px-2 text-xs"
              >
                {layer.label}
              </ToggleButton>
            ))}
          </div>
        </div>

        <p className="text-text-light/50 leading-relaxed">
          Space play/pause · ←/→ seek 0.1 s (Shift: one frame) · . step · R restart
        </p>
      </section>
    </TooltipProvider>
  )
}

export default IntroDebugger
