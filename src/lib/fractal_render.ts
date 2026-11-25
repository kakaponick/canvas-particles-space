// Plays a fractal film (fractal.ts): the film renderer (film_render.ts) forked for the Mandelbrot zoom. It
// takes the same turn as a particle film, reports through the same progress and is encoded, captioned and
// laid on a contact sheet by the same code; only the frames are its own. A frame depends on its second
// alone, so a preview draws just the frames it shows, and they are the frames the render makes.
import { clamp, type Patch } from './agent_values'
import {
  DEFAULT_SHEET_FRAMES, MAX_SHEET_FRAMES, checkCancelled, createSheet, encodeVideo, exclusively, framesAt, progress,
  readQuality, sheetLayout, type PreviewOptions, type RenderOptions
} from './film_render'
import { drawCaptions, loadCaptionFonts, type CaptionFrame, type CaptionPlan } from './film_captions'
import { trackValue } from './film'
import { FRACTAL_TRACK_KEYS, fractalView, planFractal, type FractalFrameView, type FractalPlan } from './fractal'
import { magnification } from './fractal_catalog'
import { writeFractal } from './film_script'
import { createFractalRenderer } from './fractal_renderer'

const HUD_FONT = 'Geist Mono'
const FONT_WAIT_MS = 8000
// How far from the target a caption that points at it starts its line, as a share of the frame's height
const POINTER_RADIUS = 0.03

// A fractal film as it was given: the object itself, or what a script writes, with what the script adjusted
export function readFractal (source: unknown, input?: unknown): { film: unknown, notes: string[] } {
  if (typeof source !== 'string') return { film: source, notes: [] }
  const written = writeFractal(source, input)
  return { film: written.film, notes: written.notes }
}

function planOf (source: unknown, input?: unknown) {
  const read = readFractal(source, input)
  const plan = planFractal(read.film)
  plan.notes.unshift(...read.notes)
  return plan
}

async function loadFonts (plan: FractalPlan) {
  const loads: Promise<unknown>[] = [loadCaptionFonts(plan)]
  if (plan.hud) loads.push(document.fonts.load(`500 32px "${HUD_FONT}"`))
  await Promise.race([Promise.all(loads), new Promise(resolve => setTimeout(resolve, FONT_WAIT_MS))])
}

// What captions read of a fractal film: its frame, its captions, and its numbers as they stand at the frame
function captionPlan (plan: FractalPlan) {
  const end = fractalView(plan, plan.duration)
  const begin = fractalView(plan, 0)
  const numbers: Record<string, number> = { depth: 0, steps: 0 }
  // The longest a number comes to be, so a caption with one keeps its place while its digits change
  const reach = (key: string, values: number[]) => ({ key, target: 'settings' as const, color: false, toggle: false, times: values.map(() => 0), values, eases: values.map(() => 'ease' as const) })
  const caption: CaptionPlan = {
    width: plan.width,
    height: plan.height,
    duration: plan.duration,
    captions: plan.captions,
    tracks: [
      ...plan.tracks,
      reach('depth', [begin.depth, end.depth, plan.from, plan.depth]),
      reach('steps', [begin.maxIter, end.maxIter])
    ],
    settings: numbers,
    params: {}
  }
  const frame: CaptionFrame = {
    letterbox: 0, cameraZoom: 1, holeX: plan.width / 2, holeY: plan.height / 2, horizon: plan.height * POINTER_RADIUS,
    einstein: 0, companionRadius: 0, companionX: 0, companionY: 0, shakeX: 0, shakeY: 0, zoomX: 0, zoomY: 0
  }
  const update = (view: FractalFrameView) => {
    numbers.depth = view.depth
    numbers.steps = view.maxIter
    for (const key of FRACTAL_TRACK_KEYS) numbers[key] = view[key]
  }
  return { caption, frame, update }
}

// The film's renderer at `pixel` device pixels a film pixel, and the 2D canvas its frames land on
function createFractalPlayer (plan: FractalPlan, pixel: number) {
  const width = Math.max(2, Math.round(plan.width * pixel / 2) * 2)
  const height = Math.max(2, Math.round(plan.height * pixel / 2) * 2)
  const renderer = createFractalRenderer(width, height)
  try {
    renderer.setOrbit(plan.orbit)
  } catch (error) {
    renderer.dispose()
    throw error
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    renderer.dispose()
    throw new Error('A 2D canvas is not available')
  }
  const captions = captionPlan(plan)

  const drawHud = (depth: number) => {
    const { lead, power } = magnification(depth)
    const size = Math.round(height * 0.032)
    const x = Math.round(height * 0.04)
    const y = height - x
    ctx.font = `500 ${size}px "${HUD_FONT}", monospace`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
    ctx.shadowBlur = size * 0.4
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fillText(lead, x, y)
    if (power) {
      const after = x + ctx.measureText(lead).width + size * 0.08
      ctx.font = `500 ${Math.round(size * 0.62)}px "${HUD_FONT}", monospace`
      ctx.fillText(power, after, y - size * 0.45)
    }
    ctx.shadowBlur = 0
  }

  const drawFrame = async (index: number) => {
    const time = index / plan.fps
    const view = fractalView(plan, time, height)
    const exponent = Math.floor(view.pixelLog2)
    await renderer.draw({
      pixelMant: 2 ** (view.pixelLog2 - exponent),
      pixelExp: exponent,
      angle: view.angle,
      maxIter: view.maxIter,
      samples: plan.samples,
      center: plan.center,
      stops: plan.stops,
      cycle: view.cycle,
      phase: view.phase,
      inside: plan.inside,
      edge: view.edge,
      glow: view.glow
    })
    ctx.drawImage(renderer.canvas, 0, 0)
    if (plan.hud) drawHud(view.depth)
    // The fade darkens the picture and leaves the captions, so words can stand on black
    const dark = plan.fade ? trackValue(plan.fade, time) : 0
    if (dark > 0) {
      ctx.globalAlpha = dark
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
    if (plan.captions.length > 0) {
      captions.update(view)
      drawCaptions(ctx, captions.caption, time, captions.frame, width / plan.width)
    }
    return view
  }

  return { canvas, drawFrame, dispose: renderer.dispose }
}

// What a fractal film will be, without drawing it
export function checkFractal (source: unknown, input?: unknown) {
  const plan = planOf(source, input)
  return {
    duration: plan.duration,
    fps: plan.fps,
    frames: plan.frames,
    width: plan.width * plan.scale,
    height: plan.height * plan.scale,
    target: plan.target,
    bits: plan.bits,
    shots: plan.shots.map(shot => shot.name),
    tracks: plan.tracks.map(track => track.key),
    captions: plan.captions.length,
    timeline: plan.timeline,
    notes: plan.notes
  }
}

// Draws the whole fractal film into an mp4
export async function renderFractal (source: unknown, options: RenderOptions & { input?: unknown } = {}) {
  const plan = planOf(source, options.input)
  readQuality(options)

  return exclusively(plan.frames, async () => {
    const started = performance.now()
    await loadFonts(plan)
    const player = createFractalPlayer(plan, plan.scale)
    try {
      const job = { canvas: player.canvas, fps: plan.fps, frames: plan.frames, duration: plan.duration, draw: player.drawFrame }
      const { blob, facts } = await encodeVideo(job, options, started)
      const deepest = fractalView(plan, plan.duration)
      return {
        blob,
        summary: { ...facts, depth: `10^${deepest.depth.toFixed(1)}`, bits: plan.bits, notes: plan.notes }
      }
    } finally {
      player.dispose()
    }
  })
}

// Draws frames of the fractal film side by side on one picture, each with its second and magnification. A
// film cut into shots is shown as its storyboard, a frame from the middle of each with the shot's name
export async function previewFractal (source: unknown, options: PreviewOptions & { input?: unknown } = {}) {
  const plan = planOf(source, options.input)
  const count = clamp(Math.round(options.frames ?? DEFAULT_SHEET_FRAMES), 1, MAX_SHEET_FRAMES)
  const at = Array.isArray(options.at) && options.at.length > 0 ? options.at : null
  const board = at === null && options.frames === undefined && plan.shots.length > 1
  const wanted = at
    ? at.slice(0, MAX_SHEET_FRAMES).map(Number)
    : board
      ? plan.shots.slice(0, MAX_SHEET_FRAMES).map(shot => (shot.from + shot.to) / 2)
      : Array.from({ length: count }, (_, index) => (index + 0.5) / count * plan.duration)
  const indices = framesAt(wanted, plan.fps, plan.frames)
  const { columns, rows, tileWidth } = sheetLayout(indices.length, plan.width / plan.height, plan.width * plan.scale)

  return exclusively(indices.length, async () => {
    await loadFonts(plan)
    const player = createFractalPlayer(plan, tileWidth / plan.width)
    try {
      const tile = player.canvas
      const sheet = createSheet(tile.width, tile.height, columns, rows)
      progress.phase = 'rendering'
      const started = performance.now()
      for (let slot = 0; slot < indices.length; slot++) {
        checkCancelled()
        const view = await player.drawFrame(indices[slot])
        const second = indices[slot] / plan.fps
        const shot = board ? plan.shots.find(entry => second >= entry.from && second <= entry.to) : undefined
        const { lead, power } = magnification(view.depth)
        sheet.place(slot, tile, `${second.toFixed(1)}s  ${lead}${power ? '^' + power : ''}  ${view.maxIter} steps${shot ? '  ' + shot.name : ''}`)
        progress.frame = slot + 1
      }
      return {
        ...sheet.finish(),
        times: indices.map(index => Number((index / plan.fps).toFixed(2))),
        columns,
        // Milliseconds a tile took, for a guess at what the render will take
        msPerTile: Math.round((performance.now() - started) / indices.length),
        film: { duration: plan.duration, fps: plan.fps, frames: plan.frames, width: plan.width * plan.scale, height: plan.height * plan.scale },
        timeline: plan.timeline,
        notes: plan.notes
      }
    } finally {
      player.dispose()
    }
  })
}

// The film a live view stands for, from its second 0: what the page's Save Video turns into an mp4
export function liveFilm (state: { target: string, palette: string, rate: number, depth: number, seconds: number }): Patch {
  return {
    duration: state.seconds,
    target: state.target,
    palette: state.palette,
    from: Math.max(0, +state.depth.toFixed(3)),
    rate: state.rate,
    hud: true
  }
}
