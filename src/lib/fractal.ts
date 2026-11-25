// A fractal film: a zoom into the Mandelbrot set as a short video, described by one JSON object. It names
// where the camera falls (a Misiurewicz point, which has structure at every depth, or any point written
// out in decimals), how deep it goes and how fast, the palette and the frame. planFractal checks it, finds
// the target to the bits the deepest frame needs (fractal_orbit.ts) and returns a plan the renderer
// (fractal_render.ts) draws frame by frame; a frame is a function of its second alone, so the same film is
// the same video. This is the particle film's renderer forked for another picture: the same frame sizes,
// encoder, progress and contact sheet, none of the scene.
import { FILM_SIZES, MAX_DURATION, MIN_DURATION, inRange, readFrame } from './film'
import { asBoolean, asNumber, clamp, fail, unknownKey, type Patch } from './agent_values'
import {
  GUARD_BITS, findMisiurewicz, misiurewiczOrbit, parseDecimal, pointOrbit, stepsToReach, toDecimal, toNumber,
  type Fixed, type ReferenceOrbit
} from './fractal_orbit'
import { FRACTAL_MAX_STOPS } from './fractal_shaders'

const MIN_FPS = 12
const MAX_FPS = 120
const LOG2_10 = Math.log2(10)
// The deepest a film may go, in powers of ten: about 6 700 bits of precision for the target
export const MAX_DEPTH = 2000
const DEFAULT_RATE = 0.5
const DEFAULT_START = 3
const DEFAULT_EASE_IN = 2
const DEFAULT_LOOP_DEPTH = 24
// The steps a pixel is given past the estimate of when it escapes: for the filaments and the small copies
// of the set beside the target, which take longer than the target's own neighbourhood
const STEP_HEADROOM = 1.15
const EXTRA_STEPS = 400
const MIN_STEPS = 200
const MAX_STEPS = 200_000
// The orbit of a target that is not a Misiurewicz point is followed this far at most
const POINT_ORBIT_STEPS = 60_000
// log2 of |dz/dc| times the distance at which a pixel is taken to have escaped
const ESCAPE_REACH = 3
const DIGITS_SHOWN = 40

export interface FractalTarget {
  near: [number, number]
  preperiod: number
  period: number
  about: string
  // Steps of the escape count one loop of the palette spans, unless the film names its own
  cycle: number
}

// Targets that fall forever. Each is a Misiurewicz point, placed by Newton's method to any depth
export const FRACTAL_TARGETS: Record<string, FractalTarget> = {
  spiral: {
    near: [-0.7432918908524302, 0.1312405523087976], preperiod: 24, period: 2, cycle: 8,
    about: 'deep in seahorse valley: a double spiral of seahorse tails with many turns (the default)'
  },
  seahorse: {
    near: [-0.7467919802471212, 0.1328189889547674], preperiod: 19, period: 5, cycle: 6,
    about: 'the edge of seahorse valley: lace of five-armed spirals beside open space'
  },
  elephant: {
    near: [0.2923332184434171, 0.0167024057264140], preperiod: 31, period: 3, cycle: 6,
    about: 'Elephant valley: trunks curling into three-armed spirals'
  },
  triple: {
    near: [-0.1011037579721042, 0.9562940079523541], preperiod: 37, period: 4, cycle: 6,
    about: 'the top of the set: branching filaments that fork in four at every scale'
  },
  dendrite: {
    near: [0, 1], preperiod: 2, period: 2, cycle: 6,
    about: 'c = i, the tip of the top antenna: a bare tree of filaments, the same at every depth'
  }
}

// Palettes as colours around a loop; the last runs back into the first
export const FRACTAL_PALETTES: Record<string, string[]> = {
  classic: ['#000764', '#206bcb', '#edffff', '#ffaa00', '#000200'],
  fire: ['#050000', '#5c0a05', '#c4300a', '#ff8c1a', '#ffe08a', '#fffbe8', '#ff8c1a', '#5c0a05'],
  ice: ['#02060f', '#0b2a4a', '#2f7fb5', '#a9e4ff', '#ffffff', '#5aa0c8', '#123a5e'],
  neon: ['#0b0221', '#7a04eb', '#ff00a0', '#ffdb00', '#00e5ff', '#1a0640'],
  gold: ['#0d0a05', '#4a2c0a', '#c08a2c', '#f8e1a0', '#fffaf0', '#8a5a1c'],
  mono: ['#000000', '#ffffff'],
  aurora: ['#020812', '#06373d', '#11a37f', '#b6f56b', '#f2f7d5', '#6b3fa0', '#1c0b3a']
}

export interface FractalPlan {
  duration: number
  fps: number
  frames: number
  width: number
  height: number
  scale: number
  target: {
    name: string | null
    // The target as decimals, as far as they are shown
    re: string
    im: string
    preperiod: number | null
    period: number | null
    multiplier: { size: number, turn: number } | null
  }
  center: [number, number]
  bits: number
  orbit: ReferenceOrbit
  // log2 of the view's height in plane units at second 0, and the zoom's pace
  startLog2: number
  depth: number
  rate: number
  easeIn: number
  // A loop: the zoom over the film is `loopCopies` turns of the multiplier, so the last frame leads into the first
  loopCopies: number
  angle: number
  spin: number
  stops: number[]
  cycle: number
  drift: number
  inside: [number, number, number]
  edge: number
  glow: number
  iterations: number | null
  samples: number
  hud: boolean
  timeline: string[]
  notes: string[]
}

const FRACTAL_KEYS = [
  'duration', 'fps', 'size', 'width', 'height', 'scale', 'target', 'depth', 'rate', 'start', 'easeIn', 'loop',
  'angle', 'spin', 'palette', 'cycle', 'drift', 'inside', 'edge', 'glow', 'iterations', 'samples', 'hud'
]
const TARGET_KEYS = ['re', 'im', 'preperiod', 'period']

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)

function asColor (key: string, value: unknown): [number, number, number] {
  const text = String(value).trim()
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(text)
  if (!match) fail(`${key} takes a colour like "#ffaa00", got ${JSON.stringify(value)}`)
  const hex = match[1].length === 3 ? match[1].split('').map(digit => digit + digit).join('') : match[1]
  return [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number]
}

function readPalette (value: unknown): number[] {
  if (value === undefined) return FRACTAL_PALETTES.classic.flatMap(color => asColor('palette', color))
  if (typeof value === 'string') {
    const named = FRACTAL_PALETTES[value.toLowerCase()]
    if (!named) unknownKey(value, Object.keys(FRACTAL_PALETTES))
    return named.flatMap(color => asColor('palette', color))
  }
  if (!Array.isArray(value) || value.length < 2 || value.length > FRACTAL_MAX_STOPS) {
    fail(`palette takes a name (${Object.keys(FRACTAL_PALETTES).join(', ')}) or 2 to ${FRACTAL_MAX_STOPS} colours`)
  }
  return value.flatMap((color, index) => asColor(`palette[${index}]`, color))
}

// A number given as text keeps every digit; a number given as a number keeps a double's
const asDecimalText = (key: string, value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toPrecision(17)
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return fail(`${key} takes a number, or decimals as text for more digits than a number holds`)
}

const digitsOf = (text: string) => (text.split(/[eE]/)[0].split('.')[1] ?? '').length

interface ReadTarget {
  name: string | null
  kind: 'misiurewicz' | 'point'
  near: [number, number]
  re: string
  im: string
  preperiod: number
  period: number
  cycle: number | null
}

function readTarget (value: unknown): ReadTarget {
  if (value === undefined || typeof value === 'string') {
    const name = value === undefined ? 'spiral' : value.toLowerCase()
    const known = FRACTAL_TARGETS[name]
    if (!known) unknownKey(String(value), Object.keys(FRACTAL_TARGETS))
    return { name, kind: 'misiurewicz', near: known.near, re: '', im: '', preperiod: known.preperiod, period: known.period, cycle: known.cycle }
  }
  if (!isObject(value)) fail('target takes a name or { re, im } with preperiod and period for a Misiurewicz point')
  for (const key of Object.keys(value)) if (!TARGET_KEYS.includes(key)) unknownKey(`target.${key}`, TARGET_KEYS)
  const re = asDecimalText('target.re', value.re)
  const im = asDecimalText('target.im', value.im)
  parseDecimal(re, 8)
  parseDecimal(im, 8)
  const near: [number, number] = [Number(re), Number(im)]
  if ((value.preperiod === undefined) !== (value.period === undefined)) fail('target takes both preperiod and period, or neither')
  if (value.preperiod === undefined) return { name: null, kind: 'point', near, re, im, preperiod: 0, period: 0, cycle: null }
  const preperiod = Math.round(asNumber('target.preperiod', value.preperiod))
  const period = Math.round(asNumber('target.period', value.period))
  if (preperiod < 1 || preperiod > 500) fail('target.preperiod takes 1..500')
  if (period < 1 || period > 500) fail('target.period takes 1..500')
  return { name: null, kind: 'misiurewicz', near, re, im, preperiod, period, cycle: null }
}

export function planFractal (source: unknown): FractalPlan {
  if (!isObject(source)) fail('A fractal film is an object: { duration, target, depth, palette }. See fractal.guide()')
  const problems: string[] = []
  const attempt = <T>(work: () => T, fallback: T): T => {
    try {
      return work()
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
      return fallback
    }
  }
  for (const key of Object.keys(source)) if (!FRACTAL_KEYS.includes(key)) attempt(() => unknownKey(key, FRACTAL_KEYS), undefined)
  const notes: string[] = []

  const duration = attempt(() => inRange('duration', source.duration ?? 30, MIN_DURATION, MAX_DURATION, notes), 30)
  const fps = attempt(() => Math.round(inRange('fps', source.fps ?? 30, MIN_FPS, MAX_FPS, notes)), 30)
  const { width, height, scale } = attempt(() => readFrame(source, notes), { width: 1920, height: 1080, scale: 1 })
  const target = attempt(() => readTarget(source.target), null)
  const loop = attempt(() => source.loop === undefined ? false : asBoolean('loop', source.loop), false)

  const start = attempt(() => source.start === undefined ? DEFAULT_START : inRange('start', source.start, 1e-6, 8, notes), DEFAULT_START)
  const easeIn = loop ? 0 : attempt(() => inRange('easeIn', source.easeIn ?? Math.min(DEFAULT_EASE_IN, duration / 3), 0, duration / 2, notes), 0)
  if (source.depth !== undefined && source.rate !== undefined && !loop) {
    attempt(() => fail('give depth (how deep the film ends) or rate (how fast it falls), not both'), undefined)
  }
  // Powers of ten: how far the film zooms, or where a loop sits; and how many a second
  let rate = attempt(() => source.rate === undefined ? DEFAULT_RATE : inRange('rate', source.rate, 0.01, 20, notes), DEFAULT_RATE)
  const depth = attempt(() => source.depth === undefined
    ? (loop ? DEFAULT_LOOP_DEPTH : rate * (duration - easeIn / 2))
    : inRange('depth', source.depth, 0.1, MAX_DEPTH, notes), 10)
  if (!loop && source.depth !== undefined) rate = depth / (duration - easeIn / 2)

  const angle = attempt(() => asNumber('angle', source.angle ?? 0), 0) * Math.PI / 180
  const spin = attempt(() => asNumber('spin', source.spin ?? 0), 0) * Math.PI / 180
  const stops = attempt(() => readPalette(source.palette), [0, 0, 0, 1, 1, 1])
  const drift = attempt(() => asNumber('drift', source.drift ?? 0), 0)
  const inside = attempt(() => asColor('inside', source.inside ?? '#000000'), [0, 0, 0] as [number, number, number])
  const edge = attempt(() => inRange('edge', source.edge ?? 0.7, 0, 1, notes), 0.7)
  const glow = attempt(() => inRange('glow', source.glow ?? 0, 0, 1, notes), 0)
  const iterations = attempt(() => source.iterations === undefined || source.iterations === 'auto'
    ? null
    : Math.round(inRange('iterations', source.iterations, MIN_STEPS, MAX_STEPS, notes)), null)
  const samples = attempt(() => Math.round(inRange('samples', source.samples ?? 2, 1, 4, notes)), 2)
  let hud = attempt(() => source.hud === undefined ? false : asBoolean('hud', source.hud), false)
  const cycle = attempt(() => source.cycle === undefined ? target?.cycle ?? 8 : inRange('cycle', source.cycle, 1, 10_000, notes), 8)

  if (loop && target && target.kind !== 'misiurewicz') {
    attempt(() => fail('loop needs a Misiurewicz target (a name, or re and im with preperiod and period): only its picture repeats as it shrinks'), undefined)
  }
  if (loop && (source.spin !== undefined || source.drift !== undefined)) notes.push('a loop turns and shifts its colours by itself, so spin and drift are left out')
  if (loop && hud) {
    notes.push('a loop has no depth of its own to show, so hud is left out')
    hud = false
  }
  if (problems.length > 0 || !target) {
    fail(problems.length === 1 ? problems[0] : `The fractal film has ${problems.length} problems:\n${problems.map((text, index) => `${index + 1}. ${text}`).join('\n')}`)
  }

  // The deepest pixel decides the bits: log2 of the plane units it spans, then the guard
  const pixels = height * scale
  const startLog2 = Math.log2(start)
  const loopReach = loop ? rate * duration * 1.5 + 4 : 0
  const deepestLog2Pixel = startLog2 - (depth + loopReach) * LOG2_10 - Math.log2(pixels)
  const bits = Math.max(GUARD_BITS * 2, Math.ceil(-deepestLog2Pixel) + GUARD_BITS)

  let c: Fixed
  let orbit: ReferenceOrbit
  if (target.kind === 'misiurewicz') {
    c = findMisiurewicz(target.near, target.preperiod, target.period, bits)
    orbit = misiurewiczOrbit(c, bits, target.preperiod, target.period, -deepestLog2Pixel + ESCAPE_REACH + 8)
  } else {
    c = { re: parseDecimal(target.re, bits), im: parseDecimal(target.im, bits) }
    orbit = pointOrbit(c, bits, iterations ?? POINT_ORBIT_STEPS)
    const digits = Math.min(digitsOf(target.re), digitsOf(target.im))
    if (digits < depth + 3) {
      notes.push(`the target is written to ${digits} decimals and the film goes to 10^${depth.toFixed(1)}: past its digits the camera falls towards that exact number, which is rarely on the set's edge, so the picture may end in one flat colour; a Misiurewicz target (preperiod and period) has structure at every depth`)
    }
    if (orbit.length < (iterations ?? POINT_ORBIT_STEPS)) {
      notes.push(`the target's orbit escapes after ${orbit.length} steps: it lies outside the set, so once the view is smaller than its distance from the set the zoom ends in a smooth colour`)
    }
  }

  // A loop zooms by whole copies of the picture: as many as come nearest the pace asked for
  let loopCopies = 0
  if (loop && orbit.multiplier) {
    const copyDecades = Math.log10(orbit.multiplier.size)
    loopCopies = Math.max(1, Math.round(rate * duration / copyDecades))
    rate = loopCopies * copyDecades / duration
    notes.push(`the loop zooms ${loopCopies} cop${loopCopies === 1 ? 'y' : 'ies'} of the picture deep (×${orbit.multiplier.size.toFixed(3)} each), ${rate.toFixed(3)} powers of ten a second, so its last frame leads into its first`)
  }

  const frames = Math.max(1, Math.round(duration * fps))
  const plan: FractalPlan = {
    duration,
    fps,
    frames,
    width,
    height,
    scale,
    target: {
      name: target.name,
      re: toDecimal(c.re, bits, Math.min(DIGITS_SHOWN, Math.floor(bits / LOG2_10))),
      im: toDecimal(c.im, bits, Math.min(DIGITS_SHOWN, Math.floor(bits / LOG2_10))),
      preperiod: target.kind === 'misiurewicz' ? target.preperiod : null,
      period: target.kind === 'misiurewicz' ? target.period : null,
      multiplier: orbit.multiplier
    },
    center: [toNumber(c.re, bits), toNumber(c.im, bits)],
    bits,
    orbit,
    startLog2,
    depth,
    rate,
    easeIn,
    loopCopies,
    angle,
    spin,
    stops,
    cycle,
    drift,
    inside,
    edge,
    glow,
    iterations,
    samples,
    hud,
    timeline: [],
    notes
  }
  plan.timeline = describeFractal(plan)
  return plan
}

// Powers of two the camera has zoomed by at this second of the film
export function zoomAt (plan: FractalPlan, time: number) {
  const speed = plan.rate * LOG2_10
  if (plan.loopCopies > 0) return plan.depth * LOG2_10 + speed * time
  if (plan.easeIn > 0 && time < plan.easeIn) {
    // The pace grows smoothly from rest over the ease-in
    const share = time / plan.easeIn
    return speed * plan.easeIn * (share ** 3 - share ** 4 / 2)
  }
  return speed * (plan.easeIn / 2 + (time - plan.easeIn))
}

export interface FractalFrameView {
  zoom: number
  pixelLog2: number
  angle: number
  phase: number
  maxIter: number
}

// What the camera sees at this second: the plane units a pixel spans, the turn, the colours' place, the steps
export function fractalView (plan: FractalPlan, time: number, pixels = plan.height * plan.scale): FractalFrameView {
  const zoom = zoomAt(plan, time)
  const pixelLog2 = plan.startLog2 - zoom - Math.log2(pixels)
  let angle = plan.angle + plan.spin * time
  let phase = plan.drift * time
  if (plan.loopCopies > 0 && plan.target.multiplier && plan.target.period) {
    // Each copy deeper is the picture turned by the multiplier's angle, its count `period` steps on
    const copies = plan.loopCopies * time / plan.duration
    angle = plan.angle - copies * plan.target.multiplier.turn
    phase = -copies * plan.target.period / plan.cycle
  }
  // A loop gives every frame the steps of its deepest, so its last frame is drawn as its first
  const reach = plan.loopCopies > 0 ? plan.startLog2 - zoomAt(plan, plan.duration) - Math.log2(pixels) : pixelLog2
  const maxIter = plan.iterations ?? clamp(
    Math.ceil(stepsToReach(plan.orbit, reach, ESCAPE_REACH) * STEP_HEADROOM) + EXTRA_STEPS, MIN_STEPS, MAX_STEPS)
  return { zoom, pixelLog2, angle, phase, maxIter }
}

// The magnification as "2.4 × 10^41", parted for drawing the power raised
export function magnification (zoom: number) {
  const decades = zoom / LOG2_10
  const power = Math.floor(decades)
  const lead = 10 ** (decades - power)
  return power < 3 ? { lead: `×${Math.round(10 ** decades).toLocaleString('en-US')}`, power: '' } : { lead: `${lead.toFixed(1)} × 10`, power: String(power) }
}

function describeFractal (plan: FractalPlan): string[] {
  const { target } = plan
  const end = fractalView(plan, plan.duration)
  const begin = fractalView(plan, 0)
  const where = target.name ? `"${target.name}", ` : ''
  const kind = target.preperiod !== null
    ? `Misiurewicz point M${target.preperiod},${target.period}` + (target.multiplier
      ? `: the picture repeats every ×${target.multiplier.size.toFixed(3)}, turned ${(target.multiplier.turn * 180 / Math.PI).toFixed(1)}°`
      : '')
    : 'a point as written'
  const lines = [
    `target ${where}${kind}`,
    `  re ${target.re}`,
    `  im ${target.im}`,
    `precision ${plan.bits} bits; orbit of ${plan.orbit.length} steps${plan.orbit.loopFrom >= 0 ? `, looping from step ${plan.orbit.loopFrom}` : ''}`
  ]
  const deepest = (end.zoom / LOG2_10).toFixed(1)
  if (plan.loopCopies > 0) {
    lines.push(`0-${plan.duration} s  a seamless loop at 10^${(plan.depth).toFixed(1)}: ${plan.loopCopies} copies deeper, to 10^${deepest}, then the first frame again`)
  } else {
    if (plan.easeIn > 0) lines.push(`0-${+plan.easeIn.toFixed(2)} s  the camera starts to fall, a view ${2 ** plan.startLog2} high`)
    lines.push(`${+plan.easeIn.toFixed(2)}-${plan.duration} s  ${plan.rate.toFixed(2)} powers of ten a second, to a magnification of 10^${deepest}`)
  }
  lines.push(`steps a pixel: ${begin.maxIter} at the start, ${end.maxIter} at the end; ${plan.samples}×${plan.samples} samples a pixel`)
  if (plan.spin !== 0) lines.push(`turning ${(plan.spin * 180 / Math.PI).toFixed(1)}° a second`)
  return lines
}

export const FRACTAL_GUIDE = `A fractal film is one JSON object; it renders a zoom into the Mandelbrot set to an mp4, the same video for the same film.
It is drawn with perturbation on the graphics card against an orbit found to as many bits as the deepest frame needs,
so a zoom goes as deep as asked: 10^15, where ordinary doubles end, 10^100 or 10^${MAX_DEPTH}.

  {
    "duration": 60,                       // seconds, ${MIN_DURATION}-${MAX_DURATION}
    "fps": 30,                            // ${MIN_FPS}-${MAX_FPS}
    "size": "1080p",                      // ${Object.keys(FILM_SIZES).join(' | ')}; or "width" and "height"; "scale" 0.5-2
    "target": "spiral",                   // a name below, or { "re": "-0.7467...", "im": "0.1328...", "preperiod": 19, "period": 5 }
    "depth": 30,                          // the magnification the film ends at, as a power of ten (up to ${MAX_DEPTH})
    "rate": 0.5,                          // or: powers of ten a second (default ${DEFAULT_RATE}); give depth or rate
    "start": ${DEFAULT_START},                           // height of the first view, in units of the plane
    "easeIn": 2,                          // seconds the fall takes to reach its pace
    "loop": false,                        // true: a seamless loop that falls forever (see below)
    "angle": 0, "spin": 0,                // the view's turn in degrees, and degrees a second
    "palette": "classic",                 // ${Object.keys(FRACTAL_PALETTES).join(' | ')}; or 2-${FRACTAL_MAX_STOPS} colours ["#000764", "#ffaa00", ...]
    "cycle": 8,                           // steps of the escape count one loop of the palette spans (each target has its own)
    "drift": 0,                           // palette loops a second, so the colours flow
    "edge": 0.7,                          // 0-1: how dark the set's filaments are drawn (distance estimate)
    "glow": 0,                            // 0-1: light around the filaments
    "inside": "#000000",                  // the colour of the set itself
    "samples": 2,                         // 1-4 samples a pixel along each side: 2 smooths the edges, 1 is 4x faster
    "iterations": "auto",                 // or a fixed number of steps a pixel; auto follows the depth
    "hud": false                          // the magnification in the corner
  }

Targets (each a Misiurewicz point, where the set has the same picture at every depth, turned and shrunk):
${Object.entries(FRACTAL_TARGETS).map(([name, target]) => `  ${name}  M${target.preperiod},${target.period} near ${target.near[0]}, ${target.near[1]}: ${target.about}`).join('\n')}

Your own target:
  { "re": "...", "im": "...", "preperiod": k, "period": p } finds the Misiurewicz point nearest re, im whose orbit lands
  on a cycle of p steps after k steps (Newton's method), to any depth. Without preperiod and period the camera falls to
  re, im exactly as written: text keeps every digit given, and past its digits the picture usually ends in one colour.

A loop: "loop": true sits at "depth" (default ${DEFAULT_LOOP_DEPTH}) and zooms a whole number of copies of the picture over the film,
turning and shifting its colours with them, so the last frame leads into the first and the video, played on repeat,
falls forever. "rate" sets its pace; spin, drift and hud are left out.

Cost: a frame takes milliseconds to a second on a graphics card, growing with samples², the frame's pixels and the
steps (about the depth times a few per power of ten). Preview first: fractal.preview(film, { at: [0, 10, 30] }).`
