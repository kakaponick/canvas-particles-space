// Flows: matter that is told where to go. A flow is a band of particles around the black hole that appear
// at one radius and leave at another, turning as they go: a ring where the two radii are the same, a fall
// from every side where they close in, a spiral with Swirl, an outflow where the second radius is the
// larger. Up to three stand in a scene at once, each with its own count, colour and motion.
// A particle of a flow has no state. Where it stands is worked out from its number and from how far the
// flow's clock has run, in the flow vertex shader, and its trail is the stretch of that same path it has
// just come along, drawn anew every frame. So a flow is whole in the first frame it is asked for, with
// nothing to gather and no history to play through, and it costs the main thread a few numbers a frame
// while it is on and nothing while it is off.
// The path is the textbook's: matter falling from rest far away keeps r^1.5 falling evenly with time, and
// matter in orbit turns at a rate that falls as r^-1.5, Kepler's law.
// The particles' own numbers are a static buffer, made the first time a flow is shown; the pieces of a
// trail are a second one, shared by every particle. They are drawn into the layer the orbits' traces live
// in, which the composite pass reads through the lens, so a flow behind the hole is bent by it and the
// shadow covers it.
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
// The share of its life a particle takes to appear, and to leave
export const FLOW_EDGE = 0.06
// In 3D a stroke nearer the camera than this share of the black hole's distance fades, and is gone at the second
export const FLOW_NEAR_FADE = 0.5
export const FLOW_NEAR_GONE = 0.2
// The nearest the hole's centre a flow is followed to, in black hole radii: an orbit's rate has no end there
const FLOW_NEAREST = 0.05
// What sets the particles' own numbers; the same in every scene, so a flow is the same picture in every film
const FLOW_SEED = 0x5f10e5

// The numeric settings of one flow, by the end of their keys: `flowA` is its brightness, `flowACount` how
// many particles it holds, and so on
const FLOW_PARTS = ['', 'Count', 'From', 'To', 'Spread', 'Swirl', 'Life', 'Trail', 'Size'] as const
type FlowPart = typeof FLOW_PARTS[number]
export type FlowSliderKey = `flow${FlowSlot}${FlowPart}`
export type FlowColorKey = `flow${FlowSlot}Color`
export type FlowState = Record<FlowSliderKey, number> & Record<FlowColorKey, string>

// A new flow, until it is told otherwise, is off, and once lit a fall into the hole from twelve radii
const FLOW_DEFAULTS: Record<FlowPart, number> = { '': 0, Count: 6000, From: 12, To: 1, Spread: 4, Swirl: 0.3, Life: 6, Trail: 0.4, Size: 1.5 }
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
  color: `flow${slot}Color`
}))

export const FLOW_SLIDER_KEYS: readonly FlowSliderKey[] = FLOW_SLOTS.flatMap(slot => FLOW_PARTS.map((part): FlowSliderKey => `flow${slot}${part}`))
export const FLOW_COLOR_KEYS: readonly FlowColorKey[] = FLOW_SLOTS.map((slot): FlowColorKey => `flow${slot}Color`)
export const FLOW_SETTING_KEYS: readonly (FlowSliderKey | FlowColorKey)[] = [...FLOW_SLIDER_KEYS, ...FLOW_COLOR_KEYS]

// The flows' settings as the store first holds them
export function createFlowState (): FlowState {
  const state = {} as FlowState
  for (const slot of FLOW_SLOTS) {
    for (const part of FLOW_PARTS) state[`flow${slot}${part}`] = FLOW_DEFAULTS[part]
    state[`flow${slot}Color`] = FLOW_DEFAULT_COLORS[slot]
  }
  return state
}

// One flow as the renderer draws it. Radii are in black hole radii
export interface FlowSettings {
  // Brightness of its particles; 0 draws nothing
  brightness: number
  // How many particles it draws, FLOW_CAPACITY at most
  count: number
  // The radius its matter appears at and the one it leaves at, each to the power 1.5, which is what falls
  // evenly with time; and the width of the band it appears in, as a share of the first radius
  from: number
  to: number
  spread: number
  // Radians a particle at one radius turns in the seconds of a life
  wound: number
  // How far the flow's clock has run, in lives: the share of the life now running and the whole lives before
  phase: number
  lives: number
  // The share of a life one piece of a trail spans
  piece: number
  // Width of a stroke, in CSS pixels
  size: number
  color: SceneColor
}

export function createFlowSettings (): FlowSettings {
  return { brightness: 0, count: 0, from: 1, to: 1, spread: 0, wound: 0, phase: 0, lives: 0, piece: 0, size: 1, color: createSceneColor() }
}

/**
 * Sets a flow for this frame from its settings and moves its clock on by `dt` seconds. The clock runs in
 * lives, so a Life that changes along a film's track changes how fast the particles go and never where
 * they are.
 */
export function stepFlow (
  flow: FlowSettings, dt: number, brightness: number, count: number, from: number, to: number, spread: number,
  swirl: number, life: number, trail: number, size: number
) {
  flow.brightness = brightness
  flow.count = Math.min(Math.max(Math.floor(count), 0), FLOW_CAPACITY)
  const first = Math.max(from, FLOW_NEAREST)
  flow.from = first * Math.sqrt(first)
  const last = Math.max(to, FLOW_NEAREST)
  flow.to = last * Math.sqrt(last)
  flow.spread = spread / first
  const seconds = Math.max(life, 0.01)
  flow.wound = swirl * seconds * Math.PI * 2
  flow.piece = trail / seconds / FLOW_SEGMENTS
  flow.size = size
  const turn = flow.phase + dt / seconds
  const whole = Math.floor(turn)
  flow.phase = turn - whole
  flow.lives += whole
}

// Starts a flow's clock again
export function resetFlow (flow: FlowSettings) {
  flow.phase = 0
  flow.lives = 0
}

// Four numbers from 0 to 1 for every particle of every flow: when in a life it is, where round the hole it
// appears, where across the band, and how bright it is among the others. A flow reads its own stretch of them
export function createFlowSeeds (): Float32Array {
  const random = createRandom(FLOW_SEED)
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
