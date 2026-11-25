// Plays a fractal film (fractal.ts): the film renderer (film_render.ts) forked for the Mandelbrot zoom. It
// takes the same turn as a particle film, reports through the same progress and is encoded and laid on a
// contact sheet by the same code; only the frames are its own. A frame depends on its second alone, so a
// preview draws just the frames it shows, and they are the frames the render makes.
import { clamp } from './agent_values'
import {
  DEFAULT_SHEET_FRAMES, MAX_SHEET_FRAMES, checkCancelled, createSheet, encodeVideo, exclusively, framesAt, progress,
  readQuality, sheetLayout, type PreviewOptions, type RenderOptions
} from './film_render'
import { fractalView, magnification, planFractal, type FractalPlan } from './fractal'
import { createFractalRenderer } from './fractal_renderer'

const HUD_FONT = 'Geist Mono'
const FONT_WAIT_MS = 8000

async function loadHudFont (plan: FractalPlan) {
  if (!plan.hud) return
  await Promise.race([
    document.fonts.load(`500 32px "${HUD_FONT}"`),
    new Promise(resolve => setTimeout(resolve, FONT_WAIT_MS))
  ])
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

  const drawHud = (zoom: number) => {
    const { lead, power } = magnification(zoom)
    const size = Math.round(height * 0.032)
    const x = Math.round(height * 0.04)
    const y = height - x
    ctx.font = `500 ${size}px "${HUD_FONT}", monospace`
    ctx.textBaseline = 'alphabetic'
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
      cycle: plan.cycle,
      phase: view.phase,
      inside: plan.inside,
      edge: plan.edge,
      glow: plan.glow
    })
    ctx.drawImage(renderer.canvas, 0, 0)
    if (plan.hud) drawHud(view.zoom)
    return view
  }

  return { canvas, drawFrame, dispose: renderer.dispose }
}

// What a fractal film will be, without drawing it
export function checkFractal (source: unknown) {
  const plan = planFractal(source)
  return {
    duration: plan.duration,
    fps: plan.fps,
    frames: plan.frames,
    width: plan.width * plan.scale,
    height: plan.height * plan.scale,
    target: plan.target,
    bits: plan.bits,
    timeline: plan.timeline,
    notes: plan.notes
  }
}

// Draws the whole fractal film into an mp4
export async function renderFractal (source: unknown, options: RenderOptions = {}) {
  const plan = planFractal(source)
  readQuality(options)

  return exclusively(plan.frames, async () => {
    const started = performance.now()
    await loadHudFont(plan)
    const player = createFractalPlayer(plan, plan.scale)
    try {
      const job = { canvas: player.canvas, fps: plan.fps, frames: plan.frames, duration: plan.duration, draw: player.drawFrame }
      const { blob, facts } = await encodeVideo(job, options, started)
      const deepest = fractalView(plan, plan.duration)
      return {
        blob,
        summary: { ...facts, depth: `10^${(deepest.zoom / Math.log2(10)).toFixed(1)}`, bits: plan.bits, notes: plan.notes }
      }
    } finally {
      player.dispose()
    }
  })
}

// Draws frames of the fractal film side by side on one picture, each with its second and magnification
export async function previewFractal (source: unknown, options: PreviewOptions = {}) {
  const plan = planFractal(source)
  const count = clamp(Math.round(options.frames ?? DEFAULT_SHEET_FRAMES), 1, MAX_SHEET_FRAMES)
  const at = Array.isArray(options.at) && options.at.length > 0 ? options.at : null
  const wanted = at
    ? at.slice(0, MAX_SHEET_FRAMES).map(Number)
    : Array.from({ length: count }, (_, index) => (index + 0.5) / count * plan.duration)
  const indices = framesAt(wanted, plan.fps, plan.frames)
  const { columns, rows, tileWidth } = sheetLayout(indices.length, plan.width / plan.height, plan.width * plan.scale)

  return exclusively(indices.length, async () => {
    await loadHudFont(plan)
    const player = createFractalPlayer(plan, tileWidth / plan.width)
    try {
      const tile = player.canvas
      const sheet = createSheet(tile.width, tile.height, columns, rows)
      progress.phase = 'rendering'
      const started = performance.now()
      for (let slot = 0; slot < indices.length; slot++) {
        checkCancelled()
        const view = await player.drawFrame(indices[slot])
        const { lead, power } = magnification(view.zoom)
        sheet.place(slot, tile, `${(indices[slot] / plan.fps).toFixed(1)}s  ${lead}${power ? '^' + power : ''}  ${view.maxIter} steps`)
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
