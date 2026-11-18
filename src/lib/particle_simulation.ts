import type { ParticleColor } from '../store/particle_store'
import { depositRingEnergy, type RingEnergy } from './ring_energy'

// Simulation runs in 60 Hz frame units: speeds and forces are tuned per 1/60 s
export const REFERENCE_FPS = 60

// Longest step one frame may advance, so a stall does not teleport the field
const MAX_FRAME_SCALE = 6
// Energy a captured particle leaves in the photon ring
const RING_CAPTURE_ENERGY = 0.9
// Particles closer than this many black hole radii warm the ring as they pass, per 60 Hz frame
const RING_SKIM_REACH = 1.5
const RING_SKIM_ENERGY = 0.0005

// Segments are clipped to the viewport plus at least this margin, wide enough to hide their ends
const MIN_CLIP_MARGIN = 4
// Thinnest stroke, in CSS pixels; the far end of the field is drawn this wide
const MIN_LINE_WIDTH = 0.3

// Random spawns tried for a captured particle before it is placed right outside the event horizon
const RESPAWN_TRIES = 4
const RESPAWN_RIM_SPREAD = 0.5

// Per-instance layout shared with the renderer: x0, y0, x1, y1, width, opacity, packed rgba
export const INSTANCE_FLOATS = 7

export interface ParticleField {
  count: number
  capacity: number
  x: Float32Array
  y: Float32Array
  z: Float32Array
  alpha: Float32Array
  pulsePhase: Float32Array
  pulseSpeed: Float32Array
  speedMultiplier: Float32Array
  color: Uint32Array
}

export interface PaletteSampler {
  source: ParticleColor[]
  colors: Uint32Array
  cumulativeWeights: Float32Array
  totalWeight: number
}

export interface SpawnSettings {
  palette: PaletteSampler
  farZ: number
  speedVariance: number
  // Particles spawn in a disc of this radius, so the tunnel reads round on every aspect ratio. The
  // radius sets how many bright strokes pass close to the camera
  radius: number
}

export interface StepSettings {
  frameScale: number
  time: number
  speed: number
  width: number
  height: number
  // Shared focal length in pixels, so both axes project with the same scale
  focal: number
  // Black hole on screen; NaN coordinates or a zero radius mean there is none. The radius sets
  // the strength of gravity; particles closer than the capture radius are recycled
  holeX: number
  holeY: number
  holeRadius: number
  captureRadius: number
  // Collects the light of matter falling in or skimming past; null leaves the photon ring unfed
  ringEnergy: RingEnergy | null
  gravityReach: number
  // Depth of the plane where the black hole pulls hardest
  holeDepth: number
  // Scale of the depth band the black hole pulls in; gravity ends two scales away from its plane
  gravityDepth: number
  // Stroke width of the nearest particles, in CSS pixels
  lineWidth: number
  gravityStrength: number
  orbitalStrength: number
  farZ: number
  depthFade: number
  pulseSpeedMultiplier: number
  pulseIntensity: number
  baseBrightness: number
  minOpacity: number
  maxOpacity: number
  // Only particles within this distance of the screen center are drawn (the intro shockwave)
  revealRadius: number
  revealFeather: number
  opacityScale: number
}

export interface InstanceData {
  capacity: number
  floats: Float32Array
  colors: Uint32Array
}

const isLittleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

// Packs a color so its bytes read r, g, b, a in memory, the order the GPU attribute expects
export function packColor (r: number, g: number, b: number): number {
  return isLittleEndian
    ? (r | (g << 8) | (b << 16) | (255 << 24)) >>> 0
    : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0
}

const WHITE = packColor(255, 255, 255)

// Elapsed milliseconds expressed in reference frames, capped against stalls
export function toFrameScale (elapsedMs: number): number {
  return Math.min(Math.max(elapsedMs, 0) * REFERENCE_FPS / 1000, MAX_FRAME_SCALE)
}

export function createPaletteSampler (palette: ParticleColor[]): PaletteSampler {
  const active = palette.filter(color => color.enabled)
  const colors = new Uint32Array(active.length)
  const cumulativeWeights = new Float32Array(active.length)
  let totalWeight = 0

  active.forEach((color, i) => {
    colors[i] = packColor(color.r, color.g, color.b)
    totalWeight += color.percent
    cumulativeWeights[i] = totalWeight
  })

  return { source: palette, colors, cumulativeWeights, totalWeight }
}

function samplePaletteColor (palette: PaletteSampler): number {
  const last = palette.colors.length - 1
  if (last < 0) return WHITE

  const target = Math.random() * palette.totalWeight
  for (let i = 0; i < last; i++) {
    if (target <= palette.cumulativeWeights[i]) return palette.colors[i]
  }
  return palette.colors[last]
}

function spawnParticle (field: ParticleField, i: number, z: number, spawn: SpawnSettings) {
  const angle = Math.random() * Math.PI * 2
  const radius = spawn.radius * Math.sqrt(Math.random())
  field.x[i] = Math.cos(angle) * radius
  field.y[i] = Math.sin(angle) * radius
  field.z[i] = z
  field.color[i] = samplePaletteColor(spawn.palette)
  field.alpha[i] = 0.3 + Math.random() * 0.7
  field.pulsePhase[i] = Math.random() * Math.PI * 2
  field.pulseSpeed[i] = 0.5 + Math.random() * 1.5

  // 99% of particles stay near the base speed, 1% reach up to 100x
  const r = Math.random()
  field.speedMultiplier[i] = 1 + spawn.speedVariance * (2 + r * r * r * r * r * 98)
}

// Brings a captured particle back outside the event horizon, so a horizon wider than the spawn disc
// cannot swallow the whole field. The hole is given relative to the vanishing point
function respawnBeyondHorizon (
  field: ParticleField,
  i: number,
  spawn: SpawnSettings,
  holeOffsetX: number,
  holeOffsetY: number,
  captureRadius: number,
  spawnScale: number
) {
  const captureRadiusSq = captureRadius * captureRadius
  for (let attempt = 0; attempt < RESPAWN_TRIES; attempt++) {
    spawnParticle(field, i, spawn.farZ, spawn)
    const dx = field.x[i] * spawnScale - holeOffsetX
    const dy = field.y[i] * spawnScale - holeOffsetY
    if (dx * dx + dy * dy >= captureRadiusSq) return
  }
  const angle = Math.random() * Math.PI * 2
  const radius = captureRadius * (1 + Math.random() * RESPAWN_RIM_SPREAD)
  field.x[i] = (holeOffsetX + Math.cos(angle) * radius) / spawnScale
  field.y[i] = (holeOffsetY + Math.sin(angle) * radius) / spawnScale
}

function growFloats (source: Float32Array, capacity: number): Float32Array {
  const grown = new Float32Array(capacity)
  grown.set(source)
  return grown
}

export function createParticleField (): ParticleField {
  return {
    count: 0,
    capacity: 0,
    x: new Float32Array(0),
    y: new Float32Array(0),
    z: new Float32Array(0),
    alpha: new Float32Array(0),
    pulsePhase: new Float32Array(0),
    pulseSpeed: new Float32Array(0),
    speedMultiplier: new Float32Array(0),
    color: new Uint32Array(0)
  }
}

// Changes the particle count, keeping existing particles; storage only ever grows
export function setParticleCount (field: ParticleField, count: number, spawn: SpawnSettings) {
  if (count > field.capacity) {
    field.capacity = count
    field.x = growFloats(field.x, count)
    field.y = growFloats(field.y, count)
    field.z = growFloats(field.z, count)
    field.alpha = growFloats(field.alpha, count)
    field.pulsePhase = growFloats(field.pulsePhase, count)
    field.pulseSpeed = growFloats(field.pulseSpeed, count)
    field.speedMultiplier = growFloats(field.speedMultiplier, count)
    const color = new Uint32Array(count)
    color.set(field.color)
    field.color = color
  }

  for (let i = field.count; i < count; i++) {
    spawnParticle(field, i, Math.random() * spawn.farZ, spawn)
  }
  field.count = count
}

export function createInstanceData (): InstanceData {
  return { capacity: 0, floats: new Float32Array(0), colors: new Uint32Array(0) }
}

export function ensureInstanceCapacity (data: InstanceData, capacity: number) {
  if (capacity <= data.capacity) return
  const buffer = new ArrayBuffer(capacity * INSTANCE_FLOATS * 4)
  data.capacity = capacity
  data.floats = new Float32Array(buffer)
  data.colors = new Uint32Array(buffer)
}

// Liang-Barsky clipping state, kept at module level so the hot loop allocates nothing
let clipStart = 0
let clipEnd = 1

function clipAgainst (p: number, q: number): boolean {
  if (p === 0) return q >= 0
  const t = q / p
  if (p < 0) {
    if (t > clipEnd) return false
    if (t > clipStart) clipStart = t
  } else {
    if (t < clipStart) return false
    if (t < clipEnd) clipEnd = t
  }
  return true
}

/**
 * Advances every particle by one frame and writes the visible segments into `out`.
 * Returns the number of instances written.
 */
export function stepParticles (
  field: ParticleField,
  settings: StepSettings,
  spawn: SpawnSettings,
  out: InstanceData
): number {
  const { x, y, z, alpha, pulsePhase, pulseSpeed, speedMultiplier, color } = field
  const { floats, colors } = out
  const {
    frameScale, time, width, height, focal, holeX, holeY, holeRadius, holeDepth,
    gravityStrength, orbitalStrength, farZ, depthFade, pulseIntensity, baseBrightness,
    minOpacity, maxOpacity, revealRadius, revealFeather, opacityScale
  } = settings

  const halfW = width * 0.5
  const halfH = height * 0.5
  const step = settings.speed * frameScale
  const pulseRate = settings.pulseSpeedMultiplier
  const invFarZ = 1 / farZ
  const hasHole = holeRadius > 0 && holeX === holeX && holeY === holeY
  const reachSq = settings.gravityReach * settings.gravityReach
  const holeRadiusSq = holeRadius * holeRadius
  const captureRadius = settings.captureRadius
  const captureRadiusSq = captureRadius * captureRadius
  const spawnScale = focal / spawn.farZ
  const ringEnergy = settings.ringEnergy
  const skimRadius = holeRadius * RING_SKIM_REACH
  const skimRadiusSq = skimRadius * skimRadius
  const skimEnergy = RING_SKIM_ENERGY * frameScale
  // Gravity acts within a depth band around the hole's plane; particles far behind only get lensed,
  // though the event horizon takes them at any depth.
  // The band is a compact bell, (1 - u^2 / 4)^3, close to exp(-u^2) but zero beyond |u| = 2 and
  // free of Math.exp, so most particles leave the gravity path after one subtraction
  const depthBand = Math.max(settings.gravityDepth, 1e-6)
  const holeDepthNear = holeDepth - depthBand * 2
  const holeDepthFar = holeDepth + depthBand * 2
  const invDepthBand = 1 / depthBand
  const nearLineWidth = settings.lineWidth
  // Gravity does not depend on the flight speed: at Base Speed 0 the particles it moves are the only
  // ones that light up, and the rest of the field goes dark
  const pullScale = gravityStrength * 0.6 * frameScale * holeRadiusSq
  const orbitScale = orbitalStrength * 0.02
  const invFocal = 1 / focal
  const revealing = revealRadius < Infinity
  const pulsing = pulseIntensity !== 0
  const revealRadiusSq = revealRadius * revealRadius
  const invRevealFeather = 1 / Math.max(revealFeather, 1)
  const clipMargin = Math.max(MIN_CLIP_MARGIN, nearLineWidth * 0.5 + 2)
  const minX = -clipMargin
  const minY = -clipMargin
  const maxX = width + clipMargin
  const maxY = height + clipMargin

  let written = 0

  for (let i = 0; i < field.count; i++) {
    let px = x[i]
    let py = y[i]
    const startZ = z[i]
    const startScale = focal / startZ
    const startX = px * startScale + halfW
    const startY = py * startScale + halfH

    const pz = startZ - step * speedMultiplier[i]
    if (pz <= 0) {
      spawnParticle(field, i, farZ, spawn)
      continue
    }

    const endScale = focal / pz
    let endX = px * endScale + halfW
    let endY = py * endScale + halfH

    if (hasHole) {
      const dx = holeX - endX
      const dy = holeY - endY
      const distSq = dx * dx + dy * dy

      if (distSq < reachSq) {
        if (distSq < captureRadiusSq) {
          if (ringEnergy) depositRingEnergy(ringEnergy, -dx, -dy, RING_CAPTURE_ENERGY)
          respawnBeyondHorizon(field, i, spawn, holeX - halfW, holeY - halfH, captureRadius, spawnScale)
          continue
        }

        if (pz > holeDepthNear && pz < holeDepthFar) {
          const depthOffset = (pz - holeDepth) * invDepthBand
          const bell = 1 - depthOffset * depthOffset * 0.25
          const depthWeight = bell * bell * bell

          if (ringEnergy && distSq < skimRadiusSq) depositRingEnergy(ringEnergy, -dx, -dy, skimEnergy * depthWeight)

          // Pull and orbit are screen-space pixels per frame, converted back to world units at this depth.
          // Pull falls off as (radius / distance)^2, so it needs the squared distance, not the distance
          const clampedSq = distSq > 1 ? distSq : 1
          const invDistance = 1 / Math.sqrt(clampedSq)
          const pull = pullScale / clampedSq * depthWeight
          const orbit = pull * orbitScale
          const toWorld = pz * invFocal * invDistance

          px += (dx * pull - dy * orbit) * toWorld
          py += (dy * pull + dx * orbit) * toWorld
          x[i] = px
          y[i] = py

          endX = px * endScale + halfW
          endY = py * endScale + halfH
        }
      }
    }

    z[i] = pz

    // A particle that did not move draws nothing, which also saves its stroke
    if (endX === startX && endY === startY) continue

    const distanceFactor = pz * invFarZ
    const depthFactor = 1 - distanceFactor * depthFade
    const depthWidth = (1 - distanceFactor) * nearLineWidth
    const lineWidth = depthWidth > MIN_LINE_WIDTH ? depthWidth : MIN_LINE_WIDTH

    // The sine is the costliest step of a particle that only flies, so it is skipped when it changes nothing
    const pulseFactor = pulsing
      ? 1 + Math.sin(time * pulseSpeed[i] * pulseRate + pulsePhase[i]) * pulseIntensity * distanceFactor
      : 1

    let opacity = depthFactor * alpha[i] * pulseFactor * baseBrightness
    if (opacity > maxOpacity) opacity = maxOpacity
    if (opacity < minOpacity) opacity = minOpacity
    opacity *= opacityScale

    if (revealing) {
      const rx = endX - halfW
      const ry = endY - halfH
      const radialSq = rx * rx + ry * ry
      if (radialSq > revealRadiusSq) continue
      const edge = (revealRadius - Math.sqrt(radialSq)) * invRevealFeather
      if (edge < 1) opacity *= edge
    }
    if (opacity <= 0) continue

    let x0 = startX
    let y0 = startY
    let x1 = endX
    let y1 = endY

    const startInside = x0 >= minX && x0 <= maxX && y0 >= minY && y0 <= maxY
    const endInside = x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY
    if (!startInside || !endInside) {
      const dx = x1 - x0
      const dy = y1 - y0
      clipStart = 0
      clipEnd = 1
      if (
        !clipAgainst(-dx, x0 - minX) ||
        !clipAgainst(dx, maxX - x0) ||
        !clipAgainst(-dy, y0 - minY) ||
        !clipAgainst(dy, maxY - y0)
      ) continue

      x1 = x0 + clipEnd * dx
      y1 = y0 + clipEnd * dy
      x0 += clipStart * dx
      y0 += clipStart * dy
    }

    const o = written * INSTANCE_FLOATS
    floats[o] = x0
    floats[o + 1] = y0
    floats[o + 2] = x1
    floats[o + 3] = y1
    floats[o + 4] = lineWidth
    floats[o + 5] = opacity
    colors[o + 6] = color[i]
    written++
  }

  return written
}
