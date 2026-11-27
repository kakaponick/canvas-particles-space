// Flows: matter that is told where to go. A flow is a band of particles around the black hole that appear
// at one radius and leave at another, turning as they go: a ring where the two radii are the same, a fall
// from every side where they close in, a spiral with Swirl, an outflow where the second radius is the
// larger. Up to three stand in a scene at once, each with its own count, colour and motion.
// A particle of a flow has no state. Where it stands is worked out from its number and from how far the
// flow's clock has run, in the flow vertex shader, and its trail is the stretch of that same path it has
// just come along, drawn anew every frame. So a flow is whole in the first frame it is asked for, with
// nothing to gather and no history to play through, and it costs the main thread a few numbers a frame
// while it is on and nothing while it is off.
// The path is the textbook's by default: matter falling from rest far away keeps r^1.5 falling evenly with
// time, and matter in orbit turns at a rate that falls as r^-1.5, Kepler's law; Fall Power and Turn Falloff
// set the two powers of each flow.
// The particles' own numbers are a static buffer, made the first time a flow is shown; the pieces of a
// trail are a second one, shared by every particle. They are drawn into the layer the orbits' traces live
// in, which the composite pass reads through the lens, so a flow behind the hole is bent by it and the
// shadow covers it.
// A flow lies in the main hole's equator, the plane a real disc settles into, turned from it toward the
// camera's plane by Face Camera and, round a pair, toward the pair's orbit by Pair Plane, tipped out of it by
// its Tilt toward its Node, and is a disc of its Thickness: orbits each tipped a little, a particle's height its
// own share of that thickness times its radius times the sine of its turn round the hole plus a phase of its
// own; Bell and Flare reshape it, and the shared Height Power, Phase Spread and Redraw Each Life say how those
// shares are drawn.
// With Particles on Sheet a flow lies on the sheet as the field does (RIDE_GLSL in webgl_shaders.ts), a flow
// that ends inside the horizon lights the photon ring, and Around sets a flow round the second black hole
// or the centre the two turn about.
import { createRandom, nextRandom } from './random'
import { createSceneColor, type SceneColor } from './scene_color'

export const FLOW_SLOTS = ['A', 'B', 'C'] as const
export type FlowSlot = typeof FLOW_SLOTS[number]

// The most particles one flow holds, and the pieces a particle's trail is drawn in
export const FLOW_CAPACITY = 40000
export const FLOW_SEGMENTS = 12
export const FLOW_SEED_FLOATS = 4
export const FLOW_CORNER_FLOATS = 3
export const FLOW_VERTEX_COUNT = FLOW_SEGMENTS * 6
// The nearest the hole's centre a flow is followed to, in black hole radii: an orbit's rate has no end there
const FLOW_NEAREST = 0.05
// The least fall power, share of a life to appear or leave in, and share of the hole's distance a near fade
// spans: below them the shader's powers and smoothsteps have no answer
const MIN_FALL = 0.05
const MIN_EDGE = 0.001
const MIN_NEAR = 0.001
// What sets the particles' own numbers at Flow Seed 0, whatever the film's seed, so a flow is the same
// picture in every film until Flow Seed picks another set
const FLOW_SEED = 0x5f10e5

// The numeric settings of one flow, by the end of their keys: `flowA` is its brightness, `flowACount` how
// many particles it holds, and so on
const FLOW_PARTS = [
  '', 'Count', 'From', 'To', 'Spread', 'Swirl', 'Life', 'Trail', 'Size', 'Pair', 'Tilt', 'Node', 'Thick',
  'Fall', 'Falloff', 'Face', 'Flare', 'Bell'
] as const
type FlowPart = typeof FLOW_PARTS[number]
export type FlowSliderKey = `flow${FlowSlot}${FlowPart}`
export type FlowColorKey = `flow${FlowSlot}Color`
// The settings every flow shares: how a flow round a pair turns toward the pair's orbit, how a particle's
// share of the disc's height and its orbit's phase are drawn, how it fades in and out, how its brightness
// spreads, how its trail dims, how near the 3D camera it fades, which set of numbers its particles start
// from, what it leaves in the photon ring, and how far its pace is the pull's (Gravity Pace)
export const FLOW_SHARED_KEYS = [
  'flowPairPlane', 'flowLiftPower', 'flowPhaseSpread', 'flowLiftRenew', 'flowFadeIn', 'flowFadeOut', 'flowDimmest',
  'flowTrailFade', 'flowNearFade', 'flowNearGone', 'flowSeed', 'flowRingFeed', 'flowRingFlicker', 'flowGravity'
] as const
export type FlowSharedKey = typeof FLOW_SHARED_KEYS[number]
export type FlowState = Record<FlowSliderKey, number> & Record<FlowColorKey, string> & Record<FlowSharedKey, number>

// A new flow, until it is told otherwise, is off, and once lit a fall into the hole from twelve radii in
// the hole's equator, a disc whose half height is 6% of its radius, as a thin disc's is, on the textbook's
// path: r^1.5 falling evenly, turning at Kepler's r^-1.5
const FLOW_DEFAULTS: Record<FlowPart, number> = {
  '': 0, Count: 6000, From: 12, To: 1, Spread: 4, Swirl: 0.3, Life: 6, Trail: 0.4, Size: 1.5, Pair: -1, Tilt: 0, Node: 0, Thick: 0.06,
  Fall: 1.5, Falloff: 1.5, Face: 0, Flare: 1, Bell: 0
}
// The shared settings: in the main hole's equator round a pair too; a height share drawn evenly from 0 to the
// whole, a phase all the way round, both anew each life; 6% of a life to appear and to leave; 40% to 100% of
// the flow's brightness; a trail dimming as the square of what is left of it; fading in 3D from half the
// hole's distance, gone at a fifth; the one set of numbers; a particle a life to the ring, each direction a
// half to one and a half times its even share; each flow's pace its own Swirl and Life
const FLOW_SHARED_DEFAULTS: Record<FlowSharedKey, number> = {
  flowPairPlane: 0, flowLiftPower: 1, flowPhaseSpread: 1, flowLiftRenew: 1, flowFadeIn: 0.06, flowFadeOut: 0.06, flowDimmest: 0.4,
  flowTrailFade: 2, flowNearFade: 0.5, flowNearGone: 0.2, flowSeed: 0, flowRingFeed: 1, flowRingFlicker: 0.5, flowGravity: 0
}
export const FLOW_DEFAULT_COLORS: Record<FlowSlot, string> = { A: '#ffd9a8', B: '#a8d4ff', C: '#ff8fb8' }

// The keys of one flow's settings
export interface FlowKeys {
  slot: FlowSlot
  brightness: FlowSliderKey
  count: FlowSliderKey
  from: FlowSliderKey
  to: FlowSliderKey
  spread: FlowSliderKey
  swirl: FlowSliderKey
  life: FlowSliderKey
  trail: FlowSliderKey
  size: FlowSliderKey
  pair: FlowSliderKey
  tilt: FlowSliderKey
  node: FlowSliderKey
  thick: FlowSliderKey
  fall: FlowSliderKey
  falloff: FlowSliderKey
  face: FlowSliderKey
  flare: FlowSliderKey
  bell: FlowSliderKey
  color: FlowColorKey
}

export const FLOW_KEYS: readonly FlowKeys[] = FLOW_SLOTS.map(slot => ({
  slot,
  brightness: `flow${slot}`,
  count: `flow${slot}Count`,
  from: `flow${slot}From`,
  to: `flow${slot}To`,
  spread: `flow${slot}Spread`,
  swirl: `flow${slot}Swirl`,
  life: `flow${slot}Life`,
  trail: `flow${slot}Trail`,
  size: `flow${slot}Size`,
  pair: `flow${slot}Pair`,
  tilt: `flow${slot}Tilt`,
  node: `flow${slot}Node`,
  thick: `flow${slot}Thick`,
  fall: `flow${slot}Fall`,
  falloff: `flow${slot}Falloff`,
  face: `flow${slot}Face`,
  flare: `flow${slot}Flare`,
  bell: `flow${slot}Bell`,
  color: `flow${slot}Color`
}))

export const FLOW_SLIDER_KEYS: readonly FlowSliderKey[] = FLOW_SLOTS.flatMap(slot => FLOW_PARTS.map((part): FlowSliderKey => `flow${slot}${part}`))
export const FLOW_COLOR_KEYS: readonly FlowColorKey[] = FLOW_SLOTS.map((slot): FlowColorKey => `flow${slot}Color`)
export const FLOW_SETTING_KEYS: readonly (FlowSliderKey | FlowColorKey | FlowSharedKey)[] = [...FLOW_SLIDER_KEYS, ...FLOW_COLOR_KEYS, ...FLOW_SHARED_KEYS]

// The flows' settings as the store first holds them
export function createFlowState (): FlowState {
  const state = {} as FlowState
  for (const slot of FLOW_SLOTS) {
    for (const part of FLOW_PARTS) state[`flow${slot}${part}`] = FLOW_DEFAULTS[part]
    state[`flow${slot}Color`] = FLOW_DEFAULT_COLORS[slot]
  }
  for (const key of FLOW_SHARED_KEYS) state[key] = FLOW_SHARED_DEFAULTS[key]
  return state
}

// One flow as the renderer draws it. Radii are in black hole radii
export interface FlowSettings {
  // Brightness of its particles; 0 draws nothing
  brightness: number
  // How many particles it draws, FLOW_CAPACITY at most
  count: number
  // The radius its matter appears at and the one it leaves at, each to the power Fall Power, which is what
  // falls evenly with time; and the width of the band it appears in, as a share of the first radius
  from: number
  to: number
  spread: number
  // Radians a particle at the first radius turns in the seconds of a life
  wound: number
  // The path's law: one over the fall's power, the turn's falloff, one less their ratio (the power the
  // turn's rate is summed along the fall with), and one over the first radius, which the disc flares from
  law: Float32Array
  // How far the flow's clock has run, in lives: the share of the life now running and the whole lives before
  phase: number
  lives: number
  // The share of a life one piece of a trail spans
  piece: number
  // Width of a stroke, in CSS pixels
  size: number
  // The disc's half height as a share of the radius at the first radius, the power of the radius it grows
  // with past there (1 holds it a share of the radius), the share of a bell in the draw of its heights, and
  // the power the even draw of a particle's share of the height is bent by
  shape: Float32Array
  // The draws the flows share: the share of a full turn an orbit's phase is drawn over, whether a life
  // draws anew (1) or a particle keeps its draws (0), the shares of a life to appear and to leave
  draw: Float32Array
  // The light the flows share: the dimmest a particle is drawn among its flow's, the power its trail dims
  // by, and in 3D the shares of the hole's distance a stroke starts to fade at and is gone at
  style: Float32Array
  // Where the camera sends the flow's own three directions, three numbers each: the two that span its
  // plane (its x and y, y down the screen as the scene's is) and the one the plane faces. Straight on, in
  // the flat mode, they are the directions themselves
  turn: Float32Array
  // Particles on Sheet: where a place of the flow (its own three directions) falls in the main hole's
  // equator, row by row: along its first direction, its second and the height off it, each with where the
  // flow's centre stands that way from the main hole (CSS pixels at the hole's distance) last
  plane: Float32Array
  color: SceneColor
  // What it turns round, on the screen in CSS pixels, CSS pixels in one of its radii, and in 3D that
  // point's distance from the camera in CSS pixels (below 0: behind the camera, the flow is not drawn)
  x: number
  y: number
  unit: number
  depth: number
  // The share of it the traced disc draws (0 = none): its light goes to the disc's map at full brightness and
  // that share of it is read along the paths of light, the rest is drawn as strokes as before
  traced: number
}

export function createFlowSettings (): FlowSettings {
  return {
    brightness: 0, count: 0, from: 1, to: 1, spread: 0, wound: 0, law: new Float32Array([2 / 3, 1.5, 0, 1]), phase: 0, lives: 0, piece: 0, size: 1,
    shape: new Float32Array([0, 1, 0, 1]), draw: new Float32Array([1, 1, 0.06, 0.06]), style: new Float32Array([0.4, 2, 0.5, 0.2]),
    turn: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), plane: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]),
    color: createSceneColor(), x: 0, y: 0, unit: 1, depth: 1, traced: 0
  }
}

/**
 * Sets a flow for this frame from its settings and moves its clock on by `dt` seconds. The clock runs in
 * lives, so a Life that changes along a film's track changes how fast the particles go and never where
 * they are.
 */
export function stepFlow (
  flow: FlowSettings, dt: number, brightness: number, count: number, from: number, to: number, spread: number,
  swirl: number, life: number, trail: number, size: number, thick: number, fall: number, falloff: number, flare: number, bell: number
) {
  flow.brightness = brightness
  flow.count = Math.min(Math.max(Math.floor(count), 0), FLOW_CAPACITY)
  const power = Math.max(fall, MIN_FALL)
  const turnPower = Math.max(falloff, 0)
  const first = Math.max(from, FLOW_NEAREST)
  flow.from = Math.pow(first, power)
  const last = Math.max(to, FLOW_NEAREST)
  flow.to = Math.pow(last, power)
  flow.spread = spread / first
  const seconds = Math.max(life, 0.01)
  // Swirl is turns a second at one radius; the falloff carries it to the first radius
  flow.wound = swirl * seconds * Math.PI * 2 * Math.pow(first, -turnPower)
  const law = flow.law
  law[0] = 1 / power
  law[1] = turnPower
  law[2] = 1 - turnPower / power
  law[3] = 1 / first
  const shape = flow.shape
  shape[0] = Math.max(thick, 0)
  shape[1] = flare
  shape[2] = Math.min(Math.max(bell, 0), 1)
  flow.piece = trail / seconds / FLOW_SEGMENTS
  flow.size = size
  const turn = flow.phase + dt / seconds
  const whole = Math.floor(turn)
  flow.phase = turn - whole
  flow.lives += whole
}

/**
 * Turns the plane `from` (nine numbers, row by row: two directions of the scene that span it, then the one
 * it faces) by `share` of the shortest turn that makes it face `face` (a unit direction of the scene), into
 * `out`. Facing straight away from it, it turns over about its own first direction.
 */
export function leanPlane (out: Float64Array, from: ArrayLike<number>, faceX: number, faceY: number, faceZ: number, share: number) {
  for (let slot = 0; slot < 9; slot++) out[slot] = from[slot]
  if (!(share > 0)) return
  const nowX = from[6]
  const nowY = from[7]
  const nowZ = from[8]
  let axisX = nowY * faceZ - nowZ * faceY
  let axisY = nowZ * faceX - nowX * faceZ
  let axisZ = nowX * faceY - nowY * faceX
  const sine = Math.hypot(axisX, axisY, axisZ)
  const cosine = nowX * faceX + nowY * faceY + nowZ * faceZ
  if (sine > 1e-9) {
    axisX /= sine
    axisY /= sine
    axisZ /= sine
  } else if (cosine > 0) {
    return
  } else {
    axisX = from[0]
    axisY = from[1]
    axisZ = from[2]
  }
  const angle = Math.atan2(sine, cosine) * Math.min(share, 1)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  // Each direction turned about the axis (Rodrigues)
  for (let row = 0; row < 3; row++) {
    const x = from[row * 3]
    const y = from[row * 3 + 1]
    const z = from[row * 3 + 2]
    const along = (axisX * x + axisY * y + axisZ * z) * (1 - c)
    out[row * 3] = x * c + (axisY * z - axisZ * y) * s + axisX * along
    out[row * 3 + 1] = y * c + (axisZ * x - axisX * z) * s + axisY * along
    out[row * 3 + 2] = z * c + (axisX * y - axisY * x) * s + axisZ * along
  }
}

/**
 * Lays a flow's plane for this frame: `base` (nine numbers, row by row: two directions of the scene that
 * span it, then the one it faces; the equator, or the plane the equator leans to) tipped by `tilt` radians,
 * the side at `node` radians round it (from its x the way a positive Swirl turns) rising against the way it
 * faces, which is toward the camera seen straight on; then seen through `camera` (nine numbers, row by row:
 * the scene's direction j lands on the camera's axis i at [3i + j]). The flow's directions in the
 * `equator`'s own go to `plane`; where its centre stands there is the caller's.
 */
export function turnFlow (
  flow: FlowSettings, base: ArrayLike<number>, equator: ArrayLike<number>, camera: ArrayLike<number>, tilt: number, node: number
) {
  // The axis it tips about lies in the equator, a quarter turn behind the side that rises: that side,
  // (cos, -sin) in the equator's own x and y, goes to cos(tilt) of itself less sin(tilt) of the face
  const ax = Math.sin(node)
  const ay = Math.cos(node)
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  const k = 1 - c
  const turn = flow.turn
  const plane = flow.plane
  // The flow's three directions in the equator's own, column by column of the turn about that axis
  for (let column = 0; column < 3; column++) {
    let p: number
    let q: number
    let r: number
    if (column === 0) {
      p = c + k * ax * ax
      q = k * ax * ay
      r = -s * ay
    } else if (column === 1) {
      p = k * ax * ay
      q = c + k * ay * ay
      r = s * ax
    } else {
      p = s * ay
      q = -s * ax
      r = c
    }
    // That direction in the scene, where it falls in the equator, then where the camera sends it
    const x = p * base[0] + q * base[3] + r * base[6]
    const y = p * base[1] + q * base[4] + r * base[7]
    const z = p * base[2] + q * base[5] + r * base[8]
    plane[column] = x * equator[0] + y * equator[1] + z * equator[2]
    plane[4 + column] = x * equator[3] + y * equator[4] + z * equator[5]
    plane[8 + column] = x * equator[6] + y * equator[7] + z * equator[8]
    turn[column * 3] = camera[0] * x + camera[1] * y + camera[2] * z
    turn[column * 3 + 1] = camera[3] * x + camera[4] * y + camera[5] * z
    turn[column * 3 + 2] = camera[6] * x + camera[7] * y + camera[8] * z
  }
}

/**
 * Sets what every flow shares for this frame: the draws of a particle's height and phase, its fade in and
 * out, the spread of its brightness, its trail's dimming and the 3D camera's near fade.
 */
export function shareFlow (
  flow: FlowSettings, liftPower: number, phaseSpread: number, liftRenew: number, fadeIn: number, fadeOut: number,
  dimmest: number, trailFade: number, nearFade: number, nearGone: number
) {
  flow.shape[3] = Math.max(liftPower, 0)
  const draw = flow.draw
  draw[0] = phaseSpread
  draw[1] = liftRenew >= 0.5 ? 1 : 0
  draw[2] = Math.max(fadeIn, MIN_EDGE)
  draw[3] = Math.max(fadeOut, MIN_EDGE)
  const style = flow.style
  style[0] = Math.min(Math.max(dimmest, 0), 1)
  style[1] = Math.max(trailFade, 0)
  const gone = Math.max(nearGone, MIN_NEAR)
  style[3] = gone
  style[2] = Math.max(nearFade, gone + MIN_NEAR)
}

// Starts a flow's clock again
export function resetFlow (flow: FlowSettings) {
  flow.phase = 0
  flow.lives = 0
}

// Four numbers from 0 to 1 for every particle of every flow: when in a life it is, where round the hole it
// appears, where across the band, and how bright it is among the others. A flow reads its own stretch of them
// `seed` picks the set: 0 the one set in the code, any other a set of its own
export function createFlowSeeds (seed = 0): Float32Array {
  const random = createRandom(seed === 0 ? FLOW_SEED : FLOW_SEED ^ Math.imul(Math.round(seed), 0x9e3779b1))
  const seeds = new Float32Array(FLOW_SLOTS.length * FLOW_CAPACITY * FLOW_SEED_FLOATS)
  for (let i = 0; i < seeds.length; i++) seeds[i] = nextRandom(random)
  return seeds
}

// The corners of the pieces of one trail, two triangles a piece: 0 at the piece's newer end and 1 at its
// older one, the side of the stroke, and the piece's number from the particle back
export function createFlowCorners (): Float32Array {
  const corners = new Float32Array(FLOW_VERTEX_COUNT * FLOW_CORNER_FLOATS)
  const quad = [0, -1, 1, -1, 0, 1, 0, 1, 1, -1, 1, 1]
  let offset = 0
  for (let piece = 0; piece < FLOW_SEGMENTS; piece++) {
    for (let corner = 0; corner < 6; corner++) {
      corners[offset] = quad[corner * 2]
      corners[offset + 1] = quad[corner * 2 + 1]
      corners[offset + 2] = piece
      offset += FLOW_CORNER_FLOATS
    }
  }
  return corners
}
