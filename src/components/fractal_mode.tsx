import { useEffect, useId, useRef, useState } from 'react'
import { Download, Pause, Play, RotateCcw, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFractalStore } from '../store/fractal_store'
import { useParticleStore } from '../store/particle_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { closeIntroDebugger } from '../lib/intro_dock'
import { FRACTAL_PALETTES, FRACTAL_TARGETS, PALETTE_LABELS, magnification } from '../lib/fractal_catalog'
import type { LiveView } from '../lib/fractal_live'
import SliderControl from './controls/slider_control'
import ToggleButton from './controls/toggle_button'
import { SettingsRow } from './controls/settings_section'

// The page's Mandelbrot mode: a live zoom into the Mandelbrot set drawn over the resting particle scene, and
// its panel. The code that draws it is loaded when the mode is first opened, so visitors who never open it
// never download it. The button that opens it sits in the scene toolbar (control_panel.tsx)

const PANEL_ID = 'mandelbrot-panel'
const TOGGLE_SELECTOR = '[data-mandelbrot-toggle]'
const VIDEO_SECONDS = [15, 30, 60] as const
const PROGRESS_MS = 250

const SPEED = { min: 0.1, max: 3, step: 0.05, reset: 0.5 }
const formatSpeed = (rate: number) => {
  const factor = 10 ** rate
  return `×${factor < 10 ? factor.toFixed(1) : Math.round(factor)}/s`
}

const canSaveVideo = typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'

// How deep the camera is: its own leaf, the one part of the panel that changes as the camera falls
function DepthReadout ({ describedBy }: { describedBy: string }) {
  const depth = useFractalStore(state => state.depth)
  const { lead, power } = magnification(depth)
  const spoken = power ? `${lead.replace(' × 10', '')} times 10 to the power of ${power}` : `${lead.replace('×', '')} times`
  return (
    <p className="flex min-w-0 flex-1 items-baseline gap-2 truncate" aria-describedby={describedBy}>
      <span className="font-mono text-xs text-text-light/90">Zoom</span>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className="font-mono text-lg tabular-nums text-neon-cyan">{lead}{power && <sup className="ml-0.5 text-xs">{power}</sup>}</span>
    </p>
  )
}

function Transport () {
  const playing = useFractalStore(state => state.playing)
  const setPlaying = useFractalStore(state => state.setPlaying)
  const restart = useFractalStore(state => state.restart)
  const readoutHelp = useId()
  const iconButton = 'h-8 w-8 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'
  return (
    <div className="flex items-center gap-2 pl-3" data-hint="How far the camera has zoomed in" data-hint-label="Zoom">
      <DepthReadout describedBy={readoutHelp} />
      <p id={readoutHelp} className="sr-only">How far the camera has zoomed in</p>
      <Button
        variant="outline"
        size="icon"
        aria-label={playing ? 'Pause the zoom' : 'Resume the zoom'}
        title={playing ? 'Pause' : 'Play'}
        onClick={() => setPlaying(!playing)}
        className={iconButton}
      >
        {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
      </Button>
      <Button variant="outline" size="icon" aria-label="Restart the zoom" title="Restart zoom" onClick={restart} className={iconButton}>
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  )
}

// A labelled group of choices, its hint behind a right-click like any row's
function ChoiceGroup ({ label, help, children }: { label: string, help: string, children: React.ReactNode }) {
  const labelId = useId()
  const helpId = useId()
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={helpId} data-hint={help} data-hint-label={label} className="flex flex-col gap-1">
      <span id={labelId} className="pl-3 font-mono text-xs text-text-light/90">{label}</span>
      <p id={helpId} className="sr-only">{help}</p>
      {children}
    </div>
  )
}

function TargetChoice () {
  const target = useFractalStore(state => state.target)
  const setTarget = useFractalStore(state => state.setTarget)
  return (
    <ChoiceGroup label="Target" help="Where the zoom heads; it never ends">
      <div className="grid grid-cols-3 gap-1">
        {Object.entries(FRACTAL_TARGETS).map(([name, spec]) => (
          <ToggleButton key={name} active={target === name} title={spec.about} onClick={() => setTarget(name)} className="h-7 px-1 font-mono text-xs">
            {spec.label}
          </ToggleButton>
        ))}
      </div>
    </ChoiceGroup>
  )
}

function PaletteChoice () {
  const palette = useFractalStore(state => state.palette)
  const setPalette = useFractalStore(state => state.setPalette)
  return (
    <ChoiceGroup label="Colors" help="Colors the zoom is painted in">
      <div className="grid grid-cols-7 gap-1">
        {Object.entries(FRACTAL_PALETTES).map(([name, colors]) => (
          <button
            key={name}
            type="button"
            aria-pressed={palette === name}
            aria-label={PALETTE_LABELS[name] ?? name}
            title={PALETTE_LABELS[name] ?? name}
            onClick={() => setPalette(name)}
            className={cn(
              'h-7 border transition-colors duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-neon-cyan',
              palette === name ? 'border-neon-cyan outline outline-1 outline-neon-cyan' : 'border-text-light/30 hover:border-neon-cyan/70'
            )}
            style={{ backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})` }}
          />
        ))}
      </div>
    </ChoiceGroup>
  )
}

function SpeedSlider () {
  const rate = useFractalStore(state => state.rate)
  const setRate = useFractalStore(state => state.setRate)
  // In a block of its own: the slider fills the width of what holds it, and the panel is a column
  return (
    <div>
      <SliderControl
        id="mandelbrot-speed"
        label="Zoom speed"
        ariaLabel="Zoom speed"
        min={SPEED.min}
        max={SPEED.max}
        step={SPEED.step}
        formatValue={formatSpeed}
        description="Magnification per second. Higher: faster"
        resetValue={SPEED.reset}
        value={rate}
        onChange={setRate}
      />
    </div>
  )
}

// Saves the zoom from where the camera is as an mp4, drawn on this device with the film renderer
function SaveVideo ({ live }: { live: React.MutableRefObject<LiveView | null> }) {
  const saving = useFractalStore(state => state.saving)
  const setSaving = useFractalStore(state => state.setSaving)
  const [seconds, setSeconds] = useState<typeof VIDEO_SECONDS[number]>(30)
  const [problem, setProblem] = useState('')

  const save = async () => {
    setProblem('')
    const state = useFractalStore.getState()
    setSaving({ frame: 0, frames: 1 })
    live.current?.hold(true)
    const [{ liveFilm, renderFractal }, { filmProgress }] = await Promise.all([import('../lib/fractal_render'), import('../lib/film_render')])
    const timer = window.setInterval(() => {
      const progress = filmProgress()
      if (progress.frames > 0) setSaving({ frame: progress.frame, frames: progress.frames })
    }, PROGRESS_MS)
    try {
      const film = liveFilm({ target: state.target, palette: state.palette, rate: state.rate, depth: state.depth, seconds })
      await renderFractal(film, { download: `mandelbrot-${state.target}.mp4` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/cancelled/i.test(message)) setProblem(message.split('\n')[0])
    } finally {
      window.clearInterval(timer)
      setSaving(null)
      live.current?.hold(false)
    }
  }

  const cancel = async () => {
    const { cancelFilm } = await import('../lib/film_render')
    cancelFilm()
  }

  const share = saving ? Math.round(saving.frame / Math.max(1, saving.frames) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <SettingsRow label="Video length" help={canSaveVideo ? 'Saves the zoom from here as an MP4' : 'Saving video needs Chrome or Edge'}>
        {(describedBy) => (
          <div role="radiogroup" aria-label="Video length in seconds" aria-describedby={describedBy} className="flex">
            {VIDEO_SECONDS.map(length => (
              <ToggleButton
                key={length}
                role="radio"
                aria-checked={seconds === length}
                aria-pressed={undefined}
                active={seconds === length}
                disabled={!canSaveVideo || saving !== null}
                onClick={() => setSeconds(length)}
                className="h-7 w-11 px-0 font-mono text-xs"
              >
                {length} s
              </ToggleButton>
            ))}
          </div>
        )}
      </SettingsRow>
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
              <div className="absolute inset-y-0 left-0 w-px bg-neon-cyan" style={{ left: `${share}%` }} />
              <span className="absolute inset-0 flex items-center px-3 font-mono text-xs text-text-light/90">Saving {share}%</span>
            </div>
            <Button variant="outline" onClick={cancel} className="h-7 gap-1 border-text-light/40 px-2 font-mono text-xs text-text-light/80 hover:bg-neon-cyan/20 hover:text-neon-cyan">
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              CANCEL
            </Button>
          </div>
        )
        : (
          <Button
            variant="outline"
            disabled={!canSaveVideo}
            onClick={() => { void save() }}
            className="h-7 w-full gap-1.5 border-neon-cyan/50 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            SAVE MP4
          </Button>
        )}
      {problem && <p role="alert" className="pl-3 font-mono text-[11px] leading-5 text-text-light/80">{problem}</p>}
    </div>
  )
}

// The live view's canvas and the engine that draws into it, while the mode is open
function LiveCanvas ({ live }: { live: React.MutableRefObject<LiveView | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let disposed = false
    let unsubscribe = () => {}
    void import('../lib/fractal_live').then(({ createLiveView }) => {
      const canvas = canvasRef.current
      if (disposed || !canvas) return
      try {
        const view = createLiveView(canvas, depth => useFractalStore.getState().setDepth(depth))
        live.current = view
        const apply = (state = useFractalStore.getState()) => view.set({ target: state.target, palette: state.palette, rate: state.rate, playing: state.playing })
        apply()
        let restarts = useFractalStore.getState().restarts
        unsubscribe = useFractalStore.subscribe(state => {
          if (state.restarts !== restarts) {
            restarts = state.restarts
            view.restart()
          }
          apply(state)
        })
      } catch (error) {
        setFailed(error instanceof Error ? error.message : String(error))
      }
    }).catch(() => setFailed('The Mandelbrot zoom could not be loaded'))
    return () => {
      disposed = true
      unsubscribe()
      live.current?.dispose()
      live.current = null
    }
  }, [live])

  return (
    <>
      <canvas ref={canvasRef} role="img" aria-label="A live zoom into the Mandelbrot set" className="fixed inset-0 z-40 h-full w-full bg-black" />
      {failed && (
        <div role="alert" className="fixed inset-0 z-40 flex items-center justify-center p-8 text-center font-mono text-sm text-text-light">
          {failed}
        </div>
      )}
    </>
  )
}

function FractalMode () {
  const open = useFractalStore(state => state.open)
  const setOpen = useFractalStore(state => state.setOpen)
  const live = useRef<LiveView | null>(null)

  // The particle scene rests while the mode is open, and comes back as it was
  useEffect(() => {
    if (!open) return
    const wasPaused = useParticleStore.getState().isPaused
    useParticleStore.setState({ isPaused: true })
    closeIntroDebugger()
    // A fall is motion: with reduced motion asked for it waits for Play
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) useFractalStore.getState().setPlaying(false)
    return () => {
      useParticleStore.setState({ isPaused: wasPaused })
      // A video still being saved goes with the mode
      if (useFractalStore.getState().saving) void import('../lib/film_render').then(({ cancelFilm }) => cancelFilm())
    }
  }, [open])

  // The intro debugger belongs to the particle scene: opening it leaves the mode
  useEffect(() => useIntroDebugStore.subscribe((state, before) => {
    if (state.open && !before.open) useFractalStore.getState().setOpen(false)
  }), [])

  return (
    <>
      {open && <LiveCanvas live={live} />}
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          id={PANEL_ID}
          side="left"
          hideClose
          // The panel closes only on request, so the zoom can be watched while it is tuned
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
          // As tall as what it holds, so the zoom stays in view: a card at the top left, and on a narrow screen a strip
          // along the bottom, clear of the toolbar
          className="bottom-auto flex h-auto w-[min(340px,100vw)] max-h-screen flex-col gap-3 overflow-y-auto border-b bg-[rgba(10,10,15,0.98)] p-3 pointer-events-auto outline-none sm:max-w-none
            max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[60vh] max-sm:w-full max-sm:border-r-0 max-sm:border-b-0 max-sm:border-t motion-reduce:!animate-none"
        >
          <SheetHeader className="sticky -top-3 z-10 -mx-3 -mt-3 min-h-[49px] flex-row items-center gap-2 space-y-0 border-b border-neon-cyan/20 bg-[rgb(10,10,15)] px-3 pb-2 pt-3 text-left sm:text-left">
            <SheetTitle className="font-orbitron text-neon-cyan text-sm tracking-[1px]" style={{ textShadow: '0 0 10px #00ffff' }}>
              MANDELBROT
            </SheetTitle>
            <SheetDescription className="sr-only">
              A live zoom into the Mandelbrot set, as deep as it goes. Escape or the Mandelbrot button at the top right closes it and
              brings the particle scene back.
            </SheetDescription>
          </SheetHeader>
          <Transport />
          <TargetChoice />
          <PaletteChoice />
          <SpeedSlider />
          <SaveVideo live={live} />
        </SheetContent>
      </Sheet>
    </>
  )
}

export default FractalMode
