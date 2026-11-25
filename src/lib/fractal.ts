// A fractal film: a zoom into the Mandelbrot set as a short video, described by one JSON object. It names
// where the camera falls (a Misiurewicz point, which has structure at every depth, or any point written
// out in decimals), how deep it goes and how fast, the palette and the frame, and is a timeline like a
// particle film: values that move along keyframes (tracks), a fade to black, captions and named shots.
// planFractal checks it, finds the target to the bits the deepest frame needs (fractal_orbit.ts) and
// returns a plan the renderer (fractal_render.ts) draws frame by frame; a frame is a function of its second
// alone, so the same film is the same video. This is the particle film's renderer forked for another
// picture: the same frame sizes, encoder, progress, captions and contact sheet, none of the scene. A script
// (film_script.ts, writeFractal) is a shorter way to write the same object.
import {
  FILM_SIZES, MAX_DURATION, MIN_DURATION, inRange, readCaptions, readFrame, readKeyframes, readPace, readShots,
  takeKnown, trackValue, type Attempt, type FilmCaption, type FilmShot, type FilmTrack
} from './film'
import { asBoolean, asNumber, clamp, fail, unknownKey, type Patch } from './agent_values'
import {
  GUARD_BITS, findMisiurewicz, misiurewiczOrbit, parseDecimal, pointOrbit, stepsToReach, toDecimal, toNumber,
  type Fixed, type ReferenceOrbit
} from './fractal_orbit'
import { FRACTAL_MAX_STOPS } from './fractal_shaders'
import {
  DEFAULT_PALETTE, DEFAULT_RATE, DEFAULT_TARGET, FRACTAL_PALETTES, FRACTAL_TARGETS, MAX_DEPTH, paletteStops
} from './fractal_catalog'

export { FRACTAL_PALETTES, FRACTAL_TARGETS, MAX_DEPTH } from './fractal_catalog'

const MIN_FPS = 12
const MAX_FPS = 120
export const LOG2_10 = Math.log2(10)
const DEFAULT_START = 3
const DEFAULT_EASE_IN = 2
const DEFAULT_LOOP_DEPTH = 24
const DEFAULT_EDGE = 0.7
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
// A value that moves along keyframes and is summed over time (the pace, the turn, the colours' flow) is
// summed at this many points a second
const SUM_RATE = 240
// The camera may pull back past its first view by this many powers of two, no further
const MOST_PULLED_BACK = -4

// Values a fractal film can move along keyframes, with their ranges. rate, spin and drift are paces: what
// the film shows is their sum over time (the depth, the turn, the colours' place)
export const FRACTAL_TRACKS = {
  rate: { min: -5, max: 20, about: 'powers of ten a second the camera falls by; 0 hovers, below 0 pulls back' },
  spin: { min: -360, max: 360, about: 'degrees a second the view turns by' },
  drift: { min: -10, max: 10, about: 'palette loops a second, so the colours flow' },
  edge: { min: 0, max: 1, about: 'how dark the filaments are drawn' },
  glow: { min: 0, max: 1, about: 'light around the filaments' },
  cycle: { min: 1, max: 10_000, about: 'steps of the escape count one loop of the palette spans' }
} as const
export type FractalTrackKey = keyof typeof FRACTAL_TRACKS
export const FRACTAL_TRACK_KEYS = Object.keys(FRACTAL_TRACKS) as FractalTrackKey[]

// Numbers a caption's #{key} can show: the film's own values as the tracks leave them, the depth reached
// (powers of ten) and the steps a pixel takes
export const FRACTAL_NUMBERS = ['depth', 'steps', ...FRACTAL_TRACK_KEYS] as const
// Where a caption can stand; "hole" points at the target, the centre of the frame
export const FRACTAL_CAPTION_PLACES = ['bottom', 'top', 'center', 'hole'] as const

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
  // log2 of the view's height in plane units at magnification 1; where the film starts, in powers of ten;
  // where it ends (or where a loop sits) and its pace
  startLog2: number
  from: number
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
  // Values moving along keyframes, and the sums of the paces among them, SUM_RATE points a second
  tracks: FilmTrack[]
  sums: Partial<Record<'rate' | 'spin' | 'drift', Float64Array>>
  fade: FilmTrack | null
  captions: FilmCaption[]
  shots: FilmShot[]
  timeline: string[]
  notes: string[]
}

export const FRACTAL_KEYS = [
  'duration', 'fps', 'size', 'width', 'height', 'scale', 'target', 'from', 'depth', 'rate', 'start', 'easeIn', 'loop',
  'angle', 'spin', 'palette', 'cycle', 'drift', 'inside', 'edge', 'glow', 'iterations', 'samples', 'hud',
  'tracks', 'fade', 'captions', 'shots'
]
// What a script's film() takes: everything set once, before anything is played
export const FRACTAL_HEAD_KEYS = [
  'size', 'width', 'height', 'scale', 'fps', 'target', 'from', 'start', 'easeIn', 'loop', 'depth', 'angle', 'palette',
  'inside', 'samples', 'iterations', 'hud'
]
const TARGET_KEYS = ['re', 'im', 'preperiod', 'period']

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)

function asColor (key: string, value: unknown): [number, number, number] {
  const text = String(value).trim()
  if (!/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.test(text)) fail(`${key} takes a colour like "#ffaa00", got ${JSON.stringify(value)}`)
  return paletteStops([text]) as [number, number, number]
}

function readPalette (value: unknown): number[] {
  if (value === undefined) return paletteStops(FRACTAL_PALETTES[DEFAULT_PALETTE])
  if (typeof value === 'string') {
    const named = FRACTAL_PALETTES[value.toLowerCase()]
    if (!named) unknownKey(value, Object.keys(FRACTAL_PALETTES))
    return paletteStops(named)
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
    const name = value === undefined ? DEFAULT_TARGET : value.toLowerCase()
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

function readFractalTracks (source: unknown, duration: number, notes: string[], attempt: Attempt): FilmTrack[] {
  if (source === undefined) return []
  if (!isObject(source)) fail(`tracks take an object: { rate: [[seconds, value], ...] }; keys: ${FRACTAL_TRACK_KEYS.join(', ')}`)
  return Object.entries(source).flatMap(([key, keyframes]) => attempt<FilmTrack[]>(() => {
    if (!(key in FRACTAL_TRACKS)) unknownKey(`tracks.${key}`, FRACTAL_TRACK_KEYS)
    const { min, max } = FRACTAL_TRACKS[key as FractalTrackKey]
    const read = (value: unknown) => inRange(`tracks.${key}`, value, min, max, notes)
    return [{ key, target: 'settings' as const, color: false, toggle: false, ...readKeyframes(`tracks.${key}`, keyframes, duration, read) }]
  }, []))
}

// The running sum of a pace over the film, SUM_RATE points a second, by the trapezoid rule
function sumTrack (track: FilmTrack, duration: number) {
  const count = Math.ceil(duration * SUM_RATE)
  const sums = new Float64Array(count + 1)
  let before = trackValue(track, 0)
  for (let index = 1; index <= count; index++) {
    const value = trackValue(track, Math.min(duration, index / SUM_RATE))
    sums[index] = sums[index - 1] + (before + value) / 2 / SUM_RATE
    before = value
  }
  return sums
}

// A running sum read at a second, between its points
function sumAt (sums: Float64Array, time: number) {
  const place = clamp(time * SUM_RATE, 0, sums.length - 1)
  const index = Math.min(Math.floor(place), sums.length - 2)
  if (index < 0) return 0
  return sums[index] + (sums[index + 1] - sums[index]) * (place - index)
}

// The values a film starts from before any track moves them: what a script's moves begin at
export function fractalStart (head: Patch) {
  const named = typeof head.target === 'string' ? FRACTAL_TARGETS[head.target.toLowerCase()] : head.target === undefined ? FRACTAL_TARGETS[DEFAULT_TARGET] : undefined
  const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return {
    rate: number(head.rate, DEFAULT_RATE),
    spin: number(head.spin, 0),
    drift: number(head.drift, 0),
    edge: number(head.edge, DEFAULT_EDGE),
    glow: number(head.glow, 0),
    cycle: number(head.cycle, named?.cycle ?? 8),
    fade: 0
  } as Record<FractalTrackKey | 'fade', number>
}

export function planFractal (source: unknown): FractalPlan {
  if (!isObject(source)) fail('A fractal film is an object: { duration, target, depth, palette }. See fractal.guide()')
  const problems: string[] = []
  const attempt: Attempt = (work, fallback) => {
    try {
      return work()
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
      return fallback
    }
  }
  takeKnown(source, FRACTAL_KEYS, '', attempt)
  const notes: string[] = []

  const duration = attempt(() => inRange('duration', source.duration ?? 30, MIN_DURATION, MAX_DURATION, notes), 30)
  const fps = attempt(() => Math.round(inRange('fps', source.fps ?? 30, MIN_FPS, MAX_FPS, notes)), 30)
  const { width, height, scale } = attempt(() => readFrame(source, notes), { width: 1920, height: 1080, scale: 1 })
  const target = attempt(() => readTarget(source.target), null)
  const loop = attempt(() => source.loop === undefined ? false : asBoolean('loop', source.loop), false)
  const tracks = attempt(() => readFractalTracks(source.tracks, duration, notes, attempt), [])
  const track = (key: FractalTrackKey) => tracks.find(entry => entry.key === key) ?? null
  const paced = track('rate') !== null

  const start = attempt(() => source.start === undefined ? DEFAULT_START : inRange('start', source.start, 1e-6, 8, notes), DEFAULT_START)
  const from = loop ? 0 : attempt(() => source.from === undefined ? 0 : inRange('from', source.from, 0, MAX_DEPTH, notes), 0)
  if (loop && source.from !== undefined) notes.push('a loop sits at depth; from is for a fall, so it is left out')
  if (paced && source.easeIn !== undefined) notes.push('tracks.rate sets the pace from second 0, so easeIn is left out')
  const easeIn = loop || paced ? 0 : attempt(() => inRange('easeIn', source.easeIn ?? Math.min(DEFAULT_EASE_IN, duration / 3), 0, duration / 2, notes), 0)
  if (paced && !loop && (source.depth !== undefined || source.rate !== undefined)) {
    attempt(() => fail('tracks.rate sets the pace, and the depth follows from it: leave out rate and depth'), undefined)
  } else if (source.depth !== undefined && source.rate !== undefined && !loop) {
    attempt(() => fail('give depth (how deep the film ends) or rate (how fast it falls), not both'), undefined)
  }
  // Powers of ten: how far the film zooms, or where a loop sits; and how many a second
  let rate = attempt(() => source.rate === undefined ? DEFAULT_RATE : inRange('rate', source.rate, 0.01, 20, notes), DEFAULT_RATE)
  let depth = attempt(() => source.depth === undefined
    ? (loop ? DEFAULT_LOOP_DEPTH : from + rate * (duration - easeIn / 2))
    : inRange('depth', source.depth, 0.1, MAX_DEPTH, notes), 10)
  if (!loop && !paced && source.depth !== undefined) {
    if (depth <= from) attempt(() => fail(`depth (${depth}) is where the film ends and from (${from}) where it starts: depth must be deeper`), undefined)
    rate = (depth - from) / (duration - easeIn / 2)
  }

  // A value given once and moved by a track too: the track decides
  for (const key of ['spin', 'drift', 'edge', 'glow', 'cycle'] as const) {
    if (source[key] !== undefined && track(key)) notes.push(`tracks.${key} moves ${key} along the film, so the ${key} given once is left out`)
  }
  const angle = attempt(() => asNumber('angle', source.angle ?? 0), 0) * Math.PI / 180
  const spin = attempt(() => asNumber('spin', source.spin ?? 0), 0) * Math.PI / 180
  const stops = attempt(() => readPalette(source.palette), [0, 0, 0, 1, 1, 1])
  const drift = attempt(() => asNumber('drift', source.drift ?? 0), 0)
  const inside = attempt(() => asColor('inside', source.inside ?? '#000000'), [0, 0, 0] as [number, number, number])
  const edge = attempt(() => inRange('edge', source.edge ?? DEFAULT_EDGE, 0, 1, notes), DEFAULT_EDGE)
  const glow = attempt(() => inRange('glow', source.glow ?? 0, 0, 1, notes), 0)
  const iterations = attempt(() => source.iterations === undefined || source.iterations === 'auto'
    ? null
    : Math.round(inRange('iterations', source.iterations, MIN_STEPS, MAX_STEPS, notes)), null)
  const samples = attempt(() => Math.round(inRange('samples', source.samples ?? 2, 1, 4, notes)), 2)
  let hud = attempt(() => source.hud === undefined ? false : asBoolean('hud', source.hud), false)
  const cycle = attempt(() => source.cycle === undefined ? target?.cycle ?? 8 : inRange('cycle', source.cycle, 1, 10_000, notes), 8)
  const fade = attempt(() => readPace('fade', source.fade, duration, 1, 0, notes), null)
  const captions = attempt(() => readCaptions(source.captions, duration, notes, attempt, { places: FRACTAL_CAPTION_PLACES, numbers: FRACTAL_NUMBERS }), [])
  const shots = attempt(() => readShots(source.shots, duration, attempt), [])

  if (loop && target && target.kind !== 'misiurewicz') {
    attempt(() => fail('loop needs a Misiurewicz target (a name, or re and im with preperiod and period): only its picture repeats as it shrinks'), undefined)
  }
  if (loop) {
    const breaking = tracks.filter(entry => ['rate', 'spin', 'drift', 'cycle'].includes(entry.key)).map(entry => entry.key)
    if (breaking.length > 0) {
      attempt(() => fail(`a loop sets its own pace, turn and colours so its last frame leads into its first: leave out tracks.${breaking.join(', tracks.')}`), undefined)
    }
  }
  if (loop && (source.spin !== undefined || source.drift !== undefined)) notes.push('a loop turns and shifts its colours by itself, so spin and drift are left out')
  if (loop && hud) {
    notes.push('a loop has no depth of its own to show, so hud is left out')
    hud = false
  }
  if (problems.length > 0 || !target) {
    fail(problems.length === 1 ? problems[0] : `The fractal film has ${problems.length} problems:\n${problems.map((text, index) => `${index + 1}. ${text}`).join('\n')}`)
  }

  // The paces that move are summed once; the depth a rate track reaches is its sum's deepest point
  const sums: FractalPlan['sums'] = {}
  for (const key of ['rate', 'spin', 'drift'] as const) {
    const moving = track(key)
    if (moving) sums[key] = sumTrack(moving, duration)
  }
  let deepest = loop ? depth + rate * duration * 1.5 + 4 : Math.max(from, depth)
  if (sums.rate) {
    let most = 0
    for (const value of sums.rate) most = Math.max(most, value)
    depth = from + sumAt(sums.rate, duration)
    deepest = from + most
    rate = duration > 0 ? (depth - from) / duration : 0
    if (deepest > MAX_DEPTH) fail(`tracks.rate falls to 10^${deepest.toFixed(1)}, deeper than 10^${MAX_DEPTH}, the deepest a film may go`)
  }

  // The deepest pixel decides the bits: log2 of the plane units it spans, then the guard
  const pixels = height * scale
  const startLog2 = Math.log2(start)
  const deepestLog2Pixel = startLog2 - deepest * LOG2_10 - Math.log2(pixels)
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
    if (digits < deepest + 3) {
      notes.push(`the target is written to ${digits} decimals and the film goes to 10^${deepest.toFixed(1)}: past its digits the camera falls towards that exact number, which is rarely on the set's edge, so the picture may end in one flat colour; a Misiurewicz target (preperiod and period) has structure at every depth`)
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
    from,
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
    tracks,
    sums,
    fade,
    captions,
    shots,
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
  const from = plan.from * LOG2_10
  if (plan.sums.rate) return Math.max(MOST_PULLED_BACK, from + sumAt(plan.sums.rate, time) * LOG2_10)
  if (plan.easeIn > 0 && time < plan.easeIn) {
    // The pace grows smoothly from rest over the ease-in
    const share = time / plan.easeIn
    return from + speed * plan.easeIn * (share ** 3 - share ** 4 / 2)
  }
  return from + speed * (plan.easeIn / 2 + (time - plan.easeIn))
}

export interface FractalFrameView {
  zoom: number
  // Powers of ten the camera has zoomed by
  depth: number
  pixelLog2: number
  angle: number
  phase: number
  maxIter: number
  // The values the tracks leave at this second
  rate: number
  spin: number
  drift: number
  edge: number
  glow: number
  cycle: number
}

// What the camera sees at this second: the plane units a pixel spans, the turn, the colours' place, the
// steps, and every moving value as it stands
export function fractalView (plan: FractalPlan, time: number, pixels = plan.height * plan.scale): FractalFrameView {
  const value = (key: FractalTrackKey, fixed: number) => {
    const moving = plan.tracks.find(entry => entry.key === key)
    return moving ? trackValue(moving, time) : fixed
  }
  const zoom = zoomAt(plan, time)
  const pixelLog2 = plan.startLog2 - zoom - Math.log2(pixels)
  const cycle = value('cycle', plan.cycle)
  let angle = plan.angle + (plan.sums.spin ? sumAt(plan.sums.spin, time) * Math.PI / 180 : plan.spin * time)
  let phase = plan.sums.drift ? sumAt(plan.sums.drift, time) : plan.drift * time
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
  return {
    zoom,
    depth: zoom / LOG2_10,
    pixelLog2,
    angle,
    phase,
    maxIter,
    rate: plan.loopCopies > 0 ? plan.rate : value('rate', plan.rate),
    spin: plan.loopCopies > 0 ? 0 : value('spin', plan.spin * 180 / Math.PI),
    drift: plan.loopCopies > 0 ? 0 : value('drift', plan.drift),
    edge: value('edge', plan.edge),
    glow: value('glow', plan.glow),
    cycle
  }
}

// The steps a pixel takes at a view this many powers of two deep, on this orbit, and never fewer than
// `least`: for the live view, whose shallow frames show the slow channels of the valleys whole
export function stepsFor (orbit: ReferenceOrbit, pixelLog2: number, least = MIN_STEPS) {
  return clamp(Math.ceil(stepsToReach(orbit, pixelLog2, ESCAPE_REACH) * STEP_HEADROOM) + EXTRA_STEPS, least, MAX_STEPS)
}

const seconds = (value: number) => +value.toFixed(2)

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
  const deepest = end.depth.toFixed(1)
  const at = plan.from > 0 ? `from 10^${plan.from.toFixed(1)}` : `a view ${2 ** plan.startLog2} high`
  if (plan.loopCopies > 0) {
    lines.push(`0-${plan.duration} s  a seamless loop at 10^${(plan.depth).toFixed(1)}: ${plan.loopCopies} copies deeper, to 10^${deepest}, then the first frame again`)
  } else if (plan.sums.rate) {
    lines.push(`0-${plan.duration} s  ${at}, at the pace tracks.rate sets, to a magnification of 10^${deepest}`)
  } else {
    if (plan.easeIn > 0) lines.push(`0-${seconds(plan.easeIn)} s  the camera starts to fall, ${at}`)
    lines.push(`${seconds(plan.easeIn)}-${plan.duration} s  ${plan.rate.toFixed(2)} powers of ten a second, to a magnification of 10^${deepest}`)
  }
  for (const track of plan.tracks) {
    const keys = track.values.length > 24
      ? `${track.values.length} keys from ${track.values[0]} to ${track.values[track.values.length - 1]}`
      : track.values.map(value => +value.toFixed(3)).join(' > ')
    lines.push(`${seconds(track.times[0])}-${seconds(track.times[track.times.length - 1])} s  ${track.key}: ${keys}`)
  }
  if (plan.fade) lines.push(`fade: ${plan.fade.times.map((time, index) => `${seconds(time)} s ${plan.fade?.values[index]}`).join(', ')}`)
  for (const shot of plan.shots) lines.push(`${seconds(shot.from)}-${seconds(shot.to)} s  shot "${shot.name}"`)
  for (const caption of plan.captions) lines.push(`${seconds(caption.from)}-${seconds(caption.to)} s  caption "${caption.text.replace(/\n/g, ' / ')}"`)
  lines.push(`steps a pixel: ${begin.maxIter} at the start, ${end.maxIter} at the end; ${plan.samples}×${plan.samples} samples a pixel`)
  if (plan.spin !== 0 && !plan.sums.spin) lines.push(`turning ${(plan.spin * 180 / Math.PI).toFixed(1)}° a second`)
  return lines
}

export const FRACTAL_GUIDE = `A fractal film is one JSON object; it renders a zoom into the Mandelbrot set to an mp4, the same video for the same film.
It is drawn with perturbation on the graphics card against an orbit found to as many bits as the deepest frame needs,
so a zoom goes as deep as asked: 10^15, where ordinary doubles end, 10^100 or 10^${MAX_DEPTH}.

  {
    "duration": 60,                       // seconds, ${MIN_DURATION}-${MAX_DURATION}
    "fps": 30,                            // ${MIN_FPS}-${MAX_FPS}
    "size": "1080p",                      // ${Object.keys(FILM_SIZES).join(' | ')}; or "width" and "height"; "scale" 0.5-2
    "target": "${DEFAULT_TARGET}",                   // a name below, or { "re": "-0.7467...", "im": "0.1328...", "preperiod": 19, "period": 5 }
    "depth": 30,                          // the magnification the film ends at, as a power of ten (up to ${MAX_DEPTH})
    "rate": 0.5,                          // or: powers of ten a second (default ${DEFAULT_RATE}); give depth or rate
    "from": 0,                            // the magnification the film starts at, as a power of ten
    "start": ${DEFAULT_START},                           // height of the view at magnification 1, in units of the plane
    "easeIn": 2,                          // seconds the fall takes to reach its pace
    "loop": false,                        // true: a seamless loop that falls forever (see below)
    "angle": 0, "spin": 0,                // the view's turn in degrees, and degrees a second
    "palette": "${DEFAULT_PALETTE}",                 // ${Object.keys(FRACTAL_PALETTES).join(' | ')}; or 2-${FRACTAL_MAX_STOPS} colours ["#000764", "#ffaa00", ...]
    "cycle": 8,                           // steps of the escape count one loop of the palette spans (each target has its own)
    "drift": 0,                           // palette loops a second, so the colours flow
    "edge": ${DEFAULT_EDGE},                          // 0-1: how dark the set's filaments are drawn (distance estimate)
    "glow": 0,                            // 0-1: light around the filaments
    "inside": "#000000",                  // the colour of the set itself
    "samples": 2,                         // 1-4 samples a pixel along each side: 2 smooths the edges, 1 is 4x faster
    "iterations": "auto",                 // or a fixed number of steps a pixel; auto follows the depth
    "hud": false,                         // the magnification in the corner
    "tracks": { "rate": [[0, 0.3], [20, 2, "in"], [30, 0]] },   // values that move along keyframes, below
    "fade": [[0, 1], [2, 0]],             // a share of black over the picture, under the captions: a number or keyframes
    "captions": [{ "text": "×10^{#{depth:0}}", "from": 2, "to": 30, "at": "top" }],
    "shots": [{ "name": "the fall", "from": 0, "to": 30 }]   // names for stretches; a preview shows one frame of each
  }

Tracks: keyframes [[seconds, value], [seconds, value, ease], ...], eases ease | linear | in | out | hold, for
${FRACTAL_TRACK_KEYS.map(key => `  ${key}  ${FRACTAL_TRACKS[key].min}..${FRACTAL_TRACKS[key].max}: ${FRACTAL_TRACKS[key].about}`).join('\n')}
rate, spin and drift are paces: the film shows their sum over time, so a rate track that slows to 0 holds the camera
at the depth it reached, and one below 0 pulls it back. With tracks.rate the depth follows from it: leave out rate,
depth and easeIn.

Captions are a particle film's captions (film.guide()): text with marks, places, fades, reveals, plates. They stand at
${FRACTAL_CAPTION_PLACES.join(' | ')} (the target, at the centre) or [x, y], and #{key} shows a number of the film:
${FRACTAL_NUMBERS.join(', ')} (depth is the powers of ten reached, steps the steps a pixel takes), seconds, or the
caption's own "values".

Targets (each a Misiurewicz point, where the set has the same picture at every depth, turned and shrunk):
${Object.entries(FRACTAL_TARGETS).map(([name, target]) => `  ${name}  M${target.preperiod},${target.period} near ${target.near[0]}, ${target.near[1]}: ${target.about}`).join('\n')}

Your own target:
  { "re": "...", "im": "...", "preperiod": k, "period": p } finds the Misiurewicz point nearest re, im whose orbit lands
  on a cycle of p steps after k steps (Newton's method), to any depth. Without preperiod and period the camera falls to
  re, im exactly as written: text keeps every digit given, and past its digits the picture usually ends in one colour.

A loop: "loop": true sits at "depth" (default ${DEFAULT_LOOP_DEPTH}) and zooms a whole number of copies of the picture over the film,
turning and shifting its colours with them, so the last frame leads into the first and the video, played on repeat,
falls forever. "rate" sets its pace; spin, drift, hud and the tracks of rate, spin, drift and cycle are left out.

Cost: a frame takes milliseconds to a second on a graphics card, growing with samples², the frame's pixels and the
steps (about the depth times a few per power of ten). Preview first: fractal.preview(film, { at: [0, 10, 30] }).`
