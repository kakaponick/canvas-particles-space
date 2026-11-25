// The page's live Mandelbrot zoom: the fractal renderer drawing a fall into a target in a loop of its own,
// while the particle scene rests. Loaded only when the Mandelbrot mode is opened.
//
// A live view can fall forever without growing anything: a Misiurewicz target's orbit is its preperiod and
// one turn of its cycle, found once, and the frame's depth is a number of powers of two. Its frame time is
// held near the display's by the frame's size: the canvas is drawn at a share of the screen's pixels that
// shrinks when frames come late and grows back when they keep the display's pace. A paused view is drawn
// again at the full size with 2x2 samples, a band of rows at a time, so the still picture is sharp.
import { findMisiurewicz, misiurewiczOrbit, type ReferenceOrbit } from './fractal_orbit'
import { createFractalRenderer, type FractalRenderer, type FractalView } from './fractal_renderer'
import { FRACTAL_PALETTES, FRACTAL_TARGETS, MAX_DEPTH, paletteStops } from './fractal_catalog'
import { LOG2_10, stepsFor } from './fractal'

// The live view's frame: at most this many device pixels, and never less than this share of them
const LIVE_PIXEL_BUDGET = 3_000_000
const MAX_PIXEL_RATIO = 2
const MIN_SCALE = 0.25
// A frame this much slower than the display's shrinks the next ones; frames at the display's pace for
// this long let them grow back, and each shrink makes the next growth wait longer
const LATE = 1.45
const STEADY_MS = 1500
const SHRINK = 0.8
const GROW = 1.1
// Bits the live view's target is placed with: its orbit only needs a double's worth
const LIVE_BITS = 192
// The view at magnification 1 is this high, in units of the plane
const START_HEIGHT = 3
const READOUT_MS = 250
const EDGE = 0.7
const STILL_SAMPLES = 2
// The fewest steps a live pixel takes: the channels between the bulbs, which a shallow view shows, escape slowly
const LEAST_STEPS = 1500

export interface LiveSettings {
  target: string
  palette: string
  rate: number
  playing: boolean
}

export interface LiveView {
  set: (settings: LiveSettings) => void
  restart: () => void
  // Stops drawing, so a video being saved has the graphics card to itself
  hold: (held: boolean) => void
  dispose: () => void
}

interface Target {
  orbit: ReferenceOrbit
  center: [number, number]
  cycle: number
}

const targets = new Map<string, Target>()

// A target's orbit, found once a page: its growth table reaches the deepest a view may go
function targetFor (name: string): Target {
  const known = targets.get(name)
  if (known) return known
  const spec = FRACTAL_TARGETS[name] ?? FRACTAL_TARGETS.spiral
  const c = findMisiurewicz(spec.near, spec.preperiod, spec.period, LIVE_BITS)
  const orbit = misiurewiczOrbit(c, LIVE_BITS, spec.preperiod, spec.period, MAX_DEPTH * LOG2_10 + 40)
  const made = { orbit, center: spec.near, cycle: spec.cycle }
  targets.set(name, made)
  return made
}

export function createLiveView (canvas: HTMLCanvasElement, onDepth: (depth: number) => void): LiveView {
  let settings: LiveSettings = { target: 'spiral', palette: 'classic', rate: 0.5, playing: true }
  let target = targetFor(settings.target)
  let renderer: FractalRenderer | null = null
  let zoom = 0
  let scale = 0.6
  let frameId = 0
  let last = 0
  let refreshMs = 1000 / 60
  let slowSince = 0
  let steadySince = 0
  let growWait = STEADY_MS
  let lastReadout = 0
  let shownDepth = -1
  let held = false
  let dirty = true
  // The still picture being sharpened, and whether it is to stop
  let stilling: Promise<void> | null = null
  let stillCancelled = false
  let stillDone = false

  const view: FractalView = {
    pixelMant: 1, pixelExp: 0, angle: 0, maxIter: 400, samples: 1, center: [0, 0],
    stops: paletteStops(FRACTAL_PALETTES.classic), cycle: 8, phase: 0, inside: [0, 0, 0], edge: EDGE, glow: 0
  }

  const fullSize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    let width = Math.max(1, Math.round(window.innerWidth * ratio))
    let height = Math.max(1, Math.round(window.innerHeight * ratio))
    const over = Math.sqrt(width * height / LIVE_PIXEL_BUDGET)
    if (over > 1) {
      width = Math.round(width / over)
      height = Math.round(height / over)
    }
    return { width, height }
  }

  const build = () => {
    const { width, height } = fullSize()
    renderer = createFractalRenderer(Math.round(width * scale), Math.round(height * scale), { canvas })
    renderer.setOrbit(target.orbit)
    dirty = true
  }

  // The view at the canvas's present size
  const aim = (height: number, samples: number) => {
    const pixelLog2 = Math.log2(START_HEIGHT) - zoom - Math.log2(height)
    const exponent = Math.floor(pixelLog2)
    view.pixelMant = 2 ** (pixelLog2 - exponent)
    view.pixelExp = exponent
    view.maxIter = stepsFor(target.orbit, pixelLog2, LEAST_STEPS)
    view.samples = samples
  }

  const cancelStill = () => {
    stillCancelled = true
    stillDone = false
  }

  // The paused picture again at the full size and 2x2 samples, a band of rows at a time
  const sharpen = () => {
    if (!renderer || stilling) return
    const drawing = renderer
    const { width, height } = fullSize()
    stillCancelled = false
    drawing.resize(width, height)
    aim(height, 1)
    stilling = drawing.draw(view, () => stillCancelled)
      .then(() => {
        if (stillCancelled) return
        aim(height, STILL_SAMPLES)
        return drawing.draw(view, () => stillCancelled)
      })
      .then(() => { stillDone = !stillCancelled })
      .catch(() => undefined)
      .finally(() => { stilling = null })
  }

  const readout = (now: number) => {
    const depth = zoom / LOG2_10
    if (now - lastReadout < READOUT_MS || Math.abs(depth - shownDepth) < 0.005) return
    lastReadout = now
    shownDepth = depth
    onDepth(depth)
  }

  const frame = (now: number) => {
    frameId = requestAnimationFrame(frame)
    const elapsed = last > 0 ? now - last : refreshMs
    last = now
    if (held || !renderer || stilling) return

    if (!settings.playing) {
      if (dirty || !stillDone) {
        dirty = false
        sharpen()
      }
      readout(now)
      return
    }

    // The display's own pace is the quickest frame seen lately
    refreshMs = Math.min(Math.max(refreshMs * 1.002, 1000 / 240), Math.max(elapsed, 1000 / 240))
    if (elapsed > refreshMs * LATE) {
      steadySince = now
      if (slowSince === 0) slowSince = now
      // Late for a few frames running, not for one stall
      if (now - slowSince > 120 && scale > MIN_SCALE) {
        scale = Math.max(MIN_SCALE, scale * SHRINK)
        slowSince = 0
        growWait = Math.min(growWait * 2, 20_000)
      }
    } else {
      slowSince = 0
      if (now - steadySince > growWait && scale < 1) {
        scale = Math.min(1, scale * GROW)
        steadySince = now
      }
    }

    zoom += settings.rate * LOG2_10 * Math.min(elapsed, 100) / 1000
    // The deepest a view may go is far, but not without end: past it the fall starts again from the top
    if (zoom > MAX_DEPTH * LOG2_10) zoom = 0
    const { width, height } = fullSize()
    const drawWidth = Math.max(1, Math.round(width * scale))
    const drawHeight = Math.max(1, Math.round(height * scale))
    renderer.resize(drawWidth, drawHeight)
    aim(drawHeight, 1)
    renderer.drawNow(view)
    readout(now)
  }

  const handleLost = (event: Event) => {
    event.preventDefault()
    cancelStill()
    renderer = null
  }
  const handleRestored = () => {
    try {
      build()
    } catch {
      renderer = null
    }
  }
  const handleResize = () => {
    cancelStill()
    dirty = true
  }
  canvas.addEventListener('webglcontextlost', handleLost)
  canvas.addEventListener('webglcontextrestored', handleRestored)
  window.addEventListener('resize', handleResize)
  build()
  frameId = requestAnimationFrame(frame)

  return {
    set (next) {
      const targetChanged = next.target !== settings.target
      const paletteChanged = next.palette !== settings.palette
      if (targetChanged || paletteChanged || next.playing !== settings.playing) cancelStill()
      settings = { ...next }
      if (targetChanged) {
        target = targetFor(settings.target)
        renderer?.setOrbit(target.orbit)
        zoom = 0
      }
      view.center = target.center
      view.cycle = target.cycle
      view.stops = paletteStops(FRACTAL_PALETTES[settings.palette] ?? FRACTAL_PALETTES.classic)
      dirty = true
    },
    restart () {
      cancelStill()
      zoom = 0
      dirty = true
    },
    hold (next) {
      held = next
      if (held) cancelStill()
      dirty = true
    },
    dispose () {
      cancelAnimationFrame(frameId)
      cancelStill()
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
      window.removeEventListener('resize', handleResize)
      renderer?.dispose()
      renderer = null
    }
  }
}
