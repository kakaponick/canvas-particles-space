import type { ParticleColor } from '../store/particle_store'

// Simulation runs in 60 Hz frame units: speeds and forces are tuned per 1/60 s
export const REFERENCE_FPS = 60

// Longest step one frame may advance, so a stall does not teleport the field
const MAX_FRAME_SCALE = 6

// Segments are clipped to the viewport plus this margin, wide enough to hide the widest cap
const CLIP_MARGIN = 4

const SPAWN_SPAN = 2000

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
}

export interface StepSettings {
  frameScale: number
  time: number
  speed: number
  width: number
  height: number
  mouseX: number
  mouseY: number
  mouseRadius: number
  eventHorizon: number
  gravityStrength: number
  orbitalStrength: number
  farZ: number
  depthFade: number
  pulseSpeedMultiplier: number
  pulseIntensity: number
  baseBrightness: number
  minOpacity: number
  maxOpacity: number
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
  field.x[i] = (Math.random() - 0.5) * SPAWN_SPAN
  field.y[i] = (Math.random() - 0.5) * SPAWN_SPAN
  field.z[i] = z
  field.color[i] = samplePaletteColor(spawn.palette)
  field.alpha[i] = 0.3 + Math.random() * 0.7
  field.pulsePhase[i] = Math.random() * Math.PI * 2
  field.pulseSpeed[i] = 0.5 + Math.random() * 1.5

  // 99% of particles stay near the base speed, 1% reach up to 100x
  const r = Math.random()
  field.speedMultiplier[i] = 1 + spawn.speedVariance * (2 + r * r * r * r * r * 98)
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
    frameScale, time, width, height, mouseX, mouseY, eventHorizon, gravityStrength, orbitalStrength,
    farZ, depthFade, pulseIntensity, baseBrightness, minOpacity, maxOpacity
  } = settings

  const halfW = width * 0.5
  const halfH = height * 0.5
  const step = settings.speed * frameScale
  const pulseRate = settings.pulseSpeedMultiplier
  const invFarZ = 1 / farZ
  const hasMouse = mouseX === mouseX && mouseY === mouseY
  const radiusSq = settings.mouseRadius * settings.mouseRadius
  const invMouseRadius = settings.mouseRadius > 0 ? 1 / settings.mouseRadius : 0
  const minX = -CLIP_MARGIN
  const minY = -CLIP_MARGIN
  const maxX = width + CLIP_MARGIN
  const maxY = height + CLIP_MARGIN

  let written = 0

  for (let i = 0; i < field.count; i++) {
    let px = x[i]
    let py = y[i]
    const startZ = z[i]
    const startX = (px / startZ) * halfW + halfW
    const startY = (py / startZ) * halfH + halfH

    const pz = startZ - step * speedMultiplier[i]
    if (pz <= 0) {
      spawnParticle(field, i, farZ, spawn)
      continue
    }

    let endX = (px / pz) * halfW + halfW
    let endY = (py / pz) * halfH + halfH

    if (hasMouse) {
      const dx = mouseX - endX
      const dy = mouseY - endY
      const distSq = dx * dx + dy * dy

      if (distSq < radiusSq && distSq > 0.0001) {
        const distance = Math.sqrt(distSq)
        if (distance < eventHorizon) {
          spawnParticle(field, i, farZ, spawn)
          continue
        }

        const invDistance = 1 / distance
        const towardX = dx * invDistance
        const towardY = dy * invDistance
        const closeFactor = 1 - pz * invFarZ
        const pull = gravityStrength / (distSq * 0.01) * closeFactor * frameScale
        const orbit = pull * orbitalStrength
        const warp = (1 - distance * invMouseRadius) * 0.5 * closeFactor * 20 * frameScale

        px += towardX * (pull + warp) - towardY * orbit
        py += towardY * (pull + warp) + towardX * orbit
        x[i] = px
        y[i] = py

        endX = (px / pz) * halfW + halfW
        endY = (py / pz) * halfH + halfH
      }
    }

    z[i] = pz

    const distanceFactor = pz * invFarZ
    const depthFactor = 1 - distanceFactor * depthFade
    const depthWidth = (1 - distanceFactor) * 3
    const lineWidth = depthWidth > 0.3 ? depthWidth : 0.3

    const pulse = Math.sin(time * pulseSpeed[i] * pulseRate + pulsePhase[i])
    const pulseFactor = 1 + pulse * pulseIntensity * distanceFactor

    let opacity = depthFactor * alpha[i] * pulseFactor * baseBrightness
    if (opacity > maxOpacity) opacity = maxOpacity
    if (opacity < minOpacity) opacity = minOpacity
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
