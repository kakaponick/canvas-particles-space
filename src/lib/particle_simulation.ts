// The particle field as the scene makes it, and the numbers a step is given. The step itself runs on the
// graphics card (field_step.ts, field_feedback.ts): this file makes a particle when the field grows and
// holds what the step's shader is told.
import type { ParticleColor } from '../store/particle_store'
import type { RingEnergy } from './ring_energy'
import { nextRandom, type Random } from './random'
import { createGridSettings, type GridSettings } from './space_grid'

// Simulation runs in 60 Hz frame units: speeds and forces are tuned per 1/60 s
export const REFERENCE_FPS = 60

// Longest step one frame may advance, so a stall does not teleport the field
const MAX_FRAME_SCALE = 6
// The range of the FPS Limit (frameRateCap): below 10 a frame would take more than the longest step and the
// scene would slow; 500 is about as fast as displays refresh, and a limit above the display's rate is no limit
export const FRAME_RATE_CAP_MIN = REFERENCE_FPS / MAX_FRAME_SCALE
export const FRAME_RATE_CAP_MAX = 500
// A stroke's record in an orbit's trace: x0, y0, x1, y1, width, opacity, packed rgba
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
  // Sideways speed the black holes gave a particle, in world units per 60 Hz frame; kept only while
  // Inertia is above 0
  vx: Float32Array
  vy: Float32Array
  // The same along the depth, which only the 3D loop pulls
  vz: Float32Array
}

export interface PaletteSampler {
  source: ParticleColor[]
  colors: Uint32Array
  cumulativeWeights: Float32Array
  totalWeight: number
}

export interface SpawnSettings {
  // Every random draw of the field comes from here, so a seed repeats it
  random: Random
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
  // Vanishing point on screen, the place the field flies out of: the screen centre, except while the
  // intro's field is born at the place of the explosion
  vanishX: number
  vanishY: number
  // Black hole on screen; NaN coordinates or a zero radius mean there is none. The radius sets
  // the strength of gravity; particles closer than the capture radius are recycled
  holeX: number
  holeY: number
  holeRadius: number
  captureRadius: number
  // Centre of the capture circle: the hole's, except that a spinning hole's shadow, which the particles
  // vanish into, stands off to one side of it
  captureX: number
  captureY: number
  // The hole's spin, a/M, as a vector: to the right on screen, up, and toward the camera, times the Frame
  // Drag setting. Space near the hole turns about it and carries the particles round (DRAG_SHARE); all
  // zero is a hole that does not spin, or one that does not drag
  spinRight: number
  spinUp: number
  spinToward: number
  // A second black hole on screen: its radius sets the strength of its gravity, and particles closer
  // than its capture radius are recycled. A zero radius means there is none
  companionX: number
  companionY: number
  companionRadius: number
  companionCapture: number
  // Its own spin as the main hole's is, the same way: to the right, up and toward the camera, times Frame Drag
  companionSpinRight: number
  companionSpinUp: number
  companionSpinToward: number
  // 1 while what falls into it lights its own ring, which needs the ring fed (`ringEnergy`) too
  companionFed: number
  // Collects the light of matter falling in or skimming past; null leaves the photon ring unfed
  ringEnergy: RingEnergy | null
  // The light a captured particle leaves in the ring, and the light one closer than `ringSkimReach` black
  // hole radii adds as it passes, per 60 Hz frame
  ringCaptureEnergy: number
  ringSkimReach: number
  ringSkimEnergy: number
  gravityReach: number
  // Depth of the plane where the black hole pulls hardest
  holeDepth: number
  // Scale of the depth band the black hole pulls in; gravity ends two scales away from its plane
  gravityDepth: number
  // Stroke width of the nearest particles, in CSS pixels, and of the farthest: the far end of the field is
  // drawn this wide
  lineWidth: number
  minLineWidth: number
  gravityStrength: number
  orbitalStrength: number
  // The power of the distance the pull falls by (2 is Newton's inverse square), and the power of the bell
  // of the flat step's depth band (3: (1 - u^2 / 4)^3; 0 a band with hard edges)
  gravityFalloff: number
  gravityBell: number
  // How many powers of the distance faster than the pull the spin's drag falls, and, in the flat step, the share of the drag along the line of sight that spin
  // lying in the screen gives (1 is the turn of space about the axis; 0 none)
  dragFalloff: number
  dragSight: number
  // The axis the orbital force turns a particle about in space, a unit vector in the scene's axes (x right,
  // y down, z away from the flat camera): (0, 0, -1) is the line of flight, toward the camera, and the
  // spin's axis takes over from it by Swirl Follows Spin. The flat step turns about the line of flight
  swirlX: number
  swirlY: number
  swirlZ: number
  // Share of the sideways speed the black holes give a particle that it keeps from one 60 Hz frame to the
  // next: 0 moves it only while it is pulled, 1 keeps it all, as a body in free fall does
  inertia: number
  farZ: number
  depthFade: number
  pulseSpeedMultiplier: number
  pulseIntensity: number
  baseBrightness: number
  minOpacity: number
  maxOpacity: number
  // Brightness follows the particle's own speed on the screen, per 60 Hz frame: how strongly (0 lights
  // every moving particle in full), and the speed in CSS pixels that lights it half way
  speedGlow: number
  speedKnee: number
  // The light a particle loses climbing out of the holes' wells, as a power of nature's (1 - r_s / r)^2;
  // how much the particles differ in their own light, and in width
  redshift: number
  lightSpread: number
  sizeSpread: number
  // How far a stroke the sheet stretches keeps the light of its own move (Ride Keeps Light)
  rideStretch: number
  // Only particles within this distance of the explosion are drawn (the intro shockwave): on the screen in
  // the flat step, in space from the blast's place at the hole's depth in the 3D one, in CSS pixels there
  revealRadius: number
  revealX: number
  revealY: number
  revealFeather: number
  opacityScale: number
  // 1 steps the field in three dimensions (stepSpace in field_step.ts), 0 with the flat step. The
  // rest is read by the step in space alone: the two black holes in scene units, and the camera turned around
  // the point at holeDepth on the line of flight, in radians, now and in the frame before (where a stroke
  // starts), then where it stands and looks beyond that circle (cameraPose): its roll and the turn of its
  // head, in radians, and its move right, up and in, in scene units, now and in the frame before
  threeD: number
  holeWorldX: number
  holeWorldY: number
  holeWorldZ: number
  companionWorldX: number
  companionWorldY: number
  companionWorldZ: number
  cameraYaw: number
  cameraPitch: number
  cameraYawFrom: number
  cameraPitchFrom: number
  cameraRoll: number
  cameraLookYaw: number
  cameraLookPitch: number
  cameraMoveRight: number
  cameraMoveUp: number
  cameraMoveIn: number
  cameraRollFrom: number
  cameraLookYawFrom: number
  cameraLookPitchFrom: number
  cameraMoveRightFrom: number
  cameraMoveUpFrom: number
  cameraMoveInFrom: number
  // Seen from the side, the 3D column fades over this share of Field Depth at both of its ends, so the
  // place particles are born and the place they leave are not hard edges
  endFade: number
  // In 3D, how far in front of the camera the nearer black hole stands, in CSS pixels seen straight on (scene
  // units over the scene units in a CSS pixel at the pivot's distance): a stroke nearer than that is in
  // front of the holes and is drawn into the layer the lens does not bend. 0 while nothing can be in front
  // (the flat mode, no hole, a hole behind the camera)
  frontAway: number
  // How deep behind that, in the same measure, a stroke passes from in front to behind (Front Depth): the
  // share of it seen through the lens grows over this depth. 0 is a hard plane
  frontDepth: number
  // The radii of the two shadows on the screen in 3D, CSS pixels round holeX, holeY and companionX,
  // companionY (0 for a hole not there): what lies behind the holes and is seen within one is the lens's
  holeSeen: number
  companionSeen: number
  // How far in front of the camera each of the two stands, in frontAway's measure (0 for a hole not there):
  // what stands behind the nearer and before the farther is the nearer one's alone to bend
  holeFront: number
  companionFront: number
  // How far from the nearer hole's centre on the picture, in radii of its shadow, its lens takes what stands
  // behind it and before the farther hole, and the multiple of that by which it lets go
  frontReach: number
  frontLetGo: number
  // The power the thin lens's share across Front Depth is raised to (Front Curve)
  frontPower: number
  // The share of the band behind the nearer hole (Front Bend), and of what stands between two holes (Between
  // Bend), drawn once in front where the nearer lens alone, bent by its share, shows it; the two holes'
  // Einstein radii on the screen, CSS pixels (0 without a lens)
  frontBend: number
  frontBetween: number
  holeEinstein: number
  companionEinstein: number
  // 1 while the main hole spins and something can stand in front of it: the band reads its shadow's
  // outline (kerr_shadow.ts), turned spinTurn radians on the picture
  spinShape: number
  spinTurn: number
  // Particles on Sheet (RIDE_GLSL in webgl_shaders.ts): the share of the way a particle in the slab round
  // the main hole's equator is laid on the sheet, 0 leaving it alone and the rest unread; the slab's half
  // thickness, CSS pixels at the hole's distance; the sheet as it is laid out this frame (space_grid.ts)
  ride: number
  rideDepth: number
  sheet: GridSettings
}

// Inertia for one step: a push of the holes is a change of speed that lasts. Per 60 Hz frame the speed
// keeps the share `inertia` and gains the push, so over a step of `frameScale` frames it keeps `keep`
// and gains the push `gain` times, which at 0 is the push alone, the motion the scene had before
// particles kept any speed. `velocityGain` turns the push of the step back into speed per 60 Hz frame.
// One object, filled each step, so the step allocates nothing
const inertiaStep = { inertial: false, keep: 0, gain: 1, velocityGain: 0 }
export function fillInertiaStep (inertia: number, frameScale: number) {
  const inertial = inertia > 0 && frameScale > 0
  const keep = inertial ? (inertia < 1 ? Math.pow(inertia, frameScale) : 1) : 0
  inertiaStep.inertial = inertial
  inertiaStep.keep = keep
  inertiaStep.gain = inertial && inertia < 1 ? (1 - keep) / (1 - inertia) : inertial ? frameScale : 1
  inertiaStep.velocityGain = inertial ? inertiaStep.gain / frameScale : 0
  return inertiaStep
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

export function samplePaletteColor (palette: PaletteSampler, random: Random): number {
  const last = palette.colors.length - 1
  if (last < 0) return WHITE

  const target = nextRandom(random) * palette.totalWeight
  for (let i = 0; i < last; i++) {
    if (target <= palette.cumulativeWeights[i]) return palette.colors[i]
  }
  return palette.colors[last]
}

export function spawnParticle (field: ParticleField, i: number, z: number, spawn: SpawnSettings) {
  const random = spawn.random
  const angle = nextRandom(random) * Math.PI * 2
  const radius = spawn.radius * Math.sqrt(nextRandom(random))
  field.x[i] = Math.cos(angle) * radius
  field.y[i] = Math.sin(angle) * radius
  field.z[i] = z
  field.vx[i] = 0
  field.vy[i] = 0
  field.vz[i] = 0
  field.color[i] = samplePaletteColor(spawn.palette, random)
  field.alpha[i] = 0.3 + nextRandom(random) * 0.7
  field.pulsePhase[i] = nextRandom(random) * Math.PI * 2
  field.pulseSpeed[i] = 0.5 + nextRandom(random) * 1.5

  // 99% of particles stay near the base speed, 1% reach up to 100x
  const r = nextRandom(random)
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
    color: new Uint32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    vz: new Float32Array(0)
  }
}

// Changes the particle count, keeping existing particles; storage only ever grows
export function setParticleCount (field: ParticleField, requested: number, spawn: SpawnSettings) {
  // A count sizes typed arrays, so it is a whole number whatever a setting or a saved value holds
  const count = Math.max(0, Math.floor(requested))
  if (count > field.capacity) {
    field.capacity = count
    field.x = growFloats(field.x, count)
    field.y = growFloats(field.y, count)
    field.z = growFloats(field.z, count)
    field.alpha = growFloats(field.alpha, count)
    field.pulsePhase = growFloats(field.pulsePhase, count)
    field.pulseSpeed = growFloats(field.pulseSpeed, count)
    field.speedMultiplier = growFloats(field.speedMultiplier, count)
    field.vx = growFloats(field.vx, count)
    field.vy = growFloats(field.vy, count)
    field.vz = growFloats(field.vz, count)
    const color = new Uint32Array(count)
    color.set(field.color)
    field.color = color
  }

  for (let i = field.count; i < count; i++) {
    spawnParticle(field, i, nextRandom(spawn.random) * spawn.farZ, spawn)
  }
  field.count = count
}

// The step's settings as the scene holds them before its first frame: no black hole, nothing lit, and the
// numbers that were constants of the step at the values they had. The scene fills them in every frame
export function createStepSettings (ringEnergy: RingEnergy | null = null): StepSettings {
  return {
    frameScale: 0,
    time: 0,
    speed: 0,
    width: 0,
    height: 0,
    focal: 1,
    vanishX: 0,
    vanishY: 0,
    holeX: NaN,
    holeY: NaN,
    holeRadius: 0,
    captureRadius: 0,
    captureX: 0,
    captureY: 0,
    spinRight: 0,
    spinUp: 0,
    spinToward: 0,
    companionX: 0,
    companionY: 0,
    companionRadius: 0,
    companionCapture: 0,
    companionSpinRight: 0,
    companionSpinUp: 0,
    companionSpinToward: 0,
    companionFed: 0,
    ringEnergy,
    ringCaptureEnergy: 0.9,
    ringSkimReach: 1.5,
    ringSkimEnergy: 0.0005,
    gravityReach: 0,
    holeDepth: 0,
    gravityDepth: 1,
    lineWidth: 3,
    minLineWidth: 0.3,
    gravityStrength: 0,
    orbitalStrength: 0,
    gravityFalloff: 2,
    gravityBell: 3,
    dragFalloff: 1,
    dragSight: 1,
    swirlX: 0,
    swirlY: 0,
    swirlZ: -1,
    inertia: 0,
    farZ: 1,
    depthFade: 0,
    pulseSpeedMultiplier: 0,
    pulseIntensity: 0,
    baseBrightness: 0,
    minOpacity: 0,
    maxOpacity: 0,
    speedGlow: 1,
    speedKnee: 0.15,
    redshift: 0,
    lightSpread: 0,
    sizeSpread: 0,
    rideStretch: 0,
    revealRadius: 0,
    revealX: 0,
    revealY: 0,
    revealFeather: 80,
    opacityScale: 1,
    threeD: 0,
    holeWorldX: 0,
    holeWorldY: 0,
    holeWorldZ: 0,
    companionWorldX: 0,
    companionWorldY: 0,
    companionWorldZ: 0,
    cameraYaw: 0,
    cameraPitch: 0,
    cameraYawFrom: 0,
    cameraPitchFrom: 0,
    cameraRoll: 0,
    cameraLookYaw: 0,
    cameraLookPitch: 0,
    cameraMoveRight: 0,
    cameraMoveUp: 0,
    cameraMoveIn: 0,
    cameraRollFrom: 0,
    cameraLookYawFrom: 0,
    cameraLookPitchFrom: 0,
    cameraMoveRightFrom: 0,
    cameraMoveUpFrom: 0,
    cameraMoveInFrom: 0,
    endFade: 0.12,
    frontAway: 0,
    frontDepth: 0,
    holeSeen: 0,
    companionSeen: 0,
    holeFront: 0,
    companionFront: 0,
    frontReach: 1.5,
    frontLetGo: 2,
    frontPower: 1,
    frontBend: 0,
    frontBetween: 0,
    holeEinstein: 0,
    companionEinstein: 0,
    spinShape: 0,
    spinTurn: 0,
    ride: 0,
    rideDepth: 1,
    sheet: createGridSettings()
  }
}
