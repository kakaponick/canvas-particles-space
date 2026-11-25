// Stars in orbit around the black hole. Unlike the particle field they have velocity, so they keep real
// orbits: ellipses that turn a little further round on every pass (the pericentre precession S2 shows
// around Sagittarius A*), tight ones that swing close to the speed of light, and none that last inside
// three Schwarzschild radii. Gravity is the Paczynski-Wiita potential, -GM / (r - rs): Newton's with the
// Schwarzschild radius cut out, which puts the last stable orbit and the plunge where relativity does.
//
// The state is kept in Schwarzschild radii and units of the speed of light, relative to the black hole, so
// the orbits scale with the hole and move with it. They lie in the plane of the screen. A star writes one
// segment per frame into the particle instance array; the renderer stamps those into a layer of their own
// that fades slowly, which is the trace of the orbit.
import { depositRingEnergy, type RingEnergy } from './ring_energy'
import { INSTANCE_FLOATS, samplePaletteColor, type InstanceData, type PaletteSampler } from './particle_simulation'

export const MAX_ORBITERS = 64

// Schwarzschild radii in the radius of the shadow, sqrt(27) / 2
const SHADOW_RADII = 2.598
// The speed of light on screen, in short screen sides per second
const LIGHT_SPEED = 1.2
// Longest step of the integrator, in rs / c; a frame is split into as many as it takes, up to the cap
const MAX_STEP = 0.12
const MAX_STEPS = 24
// Gravity is cut off this close to the Schwarzschild radius, where the potential diverges
const MIN_CLEARANCE = 0.15
// Closest pericentre an orbit is given, in Schwarzschild radii; closer ones exist only as plunges
const MIN_PERICENTRE = 1.3
// A star this far out, in Schwarzschild radii, has escaped and is replaced
const ESCAPE_RADIUS = 400
// How much the orbits differ from the size and eccentricity set: each gets a share of them
const SIZE_SPREAD = 0.8
const ECCENTRICITY_SPREAD = 0.4
// Seconds a new star takes to light up
const FADE_IN = 0.6
// Light a captured star leaves in the photon ring, many times a particle's, and how far round it spreads
const CAPTURE_ENERGY = 6
const CAPTURE_SPREAD = 0.2

export interface Orbiters {
  count: number
  // Position in Schwarzschild radii and velocity in units of the speed of light, from the black hole
  x: Float64Array
  y: Float64Array
  vx: Float64Array
  vy: Float64Array
  // Where the star was drawn last; NaN before it has been drawn
  drawnX: Float64Array
  drawnY: Float64Array
  // Seconds since the star appeared
  age: Float32Array
  color: Uint32Array
  // The settings the orbits were made for; a change makes them all again
  size: number
  eccentricity: number
}

export function createOrbiters (): Orbiters {
  return {
    count: 0,
    x: new Float64Array(MAX_ORBITERS),
    y: new Float64Array(MAX_ORBITERS),
    vx: new Float64Array(MAX_ORBITERS),
    vy: new Float64Array(MAX_ORBITERS),
    drawnX: new Float64Array(MAX_ORBITERS),
    drawnY: new Float64Array(MAX_ORBITERS),
    age: new Float32Array(MAX_ORBITERS),
    color: new Uint32Array(MAX_ORBITERS),
    size: 0,
    eccentricity: 0
  }
}

const potential = (r: number) => -0.5 / (r - 1)

// Puts a star at a random point of a random orbit of about the size and eccentricity set. Energy and
// angular momentum follow from the orbit's two turning points, which holds for any central force, so
// the star is on that orbit wherever along it it starts
function spawnOrbiter (orbiters: Orbiters, i: number, size: number, eccentricity: number, palette: PaletteSampler) {
  const semiMajor = size * SHADOW_RADII * (1 - SIZE_SPREAD / 2 + SIZE_SPREAD * Math.random())
  const e = eccentricity * (1 - ECCENTRICITY_SPREAD + ECCENTRICITY_SPREAD * Math.random())
  const pericentre = Math.max(semiMajor * (1 - e), MIN_PERICENTRE)
  const apocentre = Math.max(semiMajor * (1 + e), pericentre)

  let r = apocentre
  let momentumSq: number
  let energy: number
  if (apocentre - pericentre < 1e-3 * apocentre) {
    // A circle: the pull is the centripetal force
    momentumSq = 0.5 * r * r * r / ((r - 1) * (r - 1))
    energy = momentumSq / (2 * r * r) + potential(r)
  } else {
    momentumSq = 2 * (potential(pericentre) - potential(apocentre)) / (1 / (apocentre * apocentre) - 1 / (pericentre * pericentre))
    energy = momentumSq / (2 * apocentre * apocentre) + potential(apocentre)
    r = pericentre + (apocentre - pericentre) * Math.random()
  }

  const around = Math.sqrt(momentumSq) / r
  const outward = Math.sqrt(Math.max(2 * (energy - potential(r)) - around * around, 0)) * (Math.random() < 0.5 ? -1 : 1)
  const angle = Math.random() * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  orbiters.x[i] = r * cos
  orbiters.y[i] = r * sin
  orbiters.vx[i] = outward * cos - around * sin
  orbiters.vy[i] = outward * sin + around * cos
  orbiters.drawnX[i] = NaN
  orbiters.drawnY[i] = NaN
  orbiters.age[i] = 0
  orbiters.color[i] = samplePaletteColor(palette)
}

/**
 * Advances the stars by `dt` seconds and writes one segment for each into `out`, starting at the record
 * `offset`. Lengths are CSS pixels; `speed` is the rate of their time, and its sign their direction.
 * Returns the number of segments written.
 */
export function stepOrbiters (
  orbiters: Orbiters,
  requested: number,
  size: number,
  eccentricity: number,
  speed: number,
  dt: number,
  holeX: number,
  holeY: number,
  shadowRadius: number,
  captureRadius: number,
  shortSide: number,
  width: number,
  opacity: number,
  palette: PaletteSampler,
  ringEnergy: RingEnergy | null,
  out: InstanceData,
  offset: number
): number {
  const count = Math.min(Math.max(Math.floor(requested), 0), MAX_ORBITERS)
  if (count === 0 || shadowRadius <= 0) {
    orbiters.count = 0
    return 0
  }

  // New settings make every orbit again; a higher count only adds stars
  const remade = size !== orbiters.size || eccentricity !== orbiters.eccentricity
  orbiters.size = size
  orbiters.eccentricity = eccentricity
  for (let i = remade ? 0 : orbiters.count; i < count; i++) spawnOrbiter(orbiters, i, size, eccentricity, palette)
  orbiters.count = count

  const { x, y, vx, vy, drawnX, drawnY, age, color } = orbiters
  const { floats, colors } = out
  const radius = shadowRadius / SHADOW_RADII
  const capture = captureRadius / radius
  const elapsed = dt * speed * LIGHT_SPEED * shortSide / radius
  const steps = Math.min(Math.max(Math.ceil(Math.abs(elapsed) / MAX_STEP), 1), MAX_STEPS)
  const step = elapsed / steps
  const halfStep = step * 0.5

  for (let i = 0; i < count; i++) {
    let px = x[i]
    let py = y[i]
    let pvx = vx[i]
    let pvy = vy[i]
    let r = Math.sqrt(px * px + py * py)

    // Leapfrog: half a kick, a drift, half a kick. It keeps an orbit's energy over thousands of turns
    // and runs backwards as well as forwards, which is how a negative speed reverses the orbits
    let clearance = r - 1 > MIN_CLEARANCE ? r - 1 : MIN_CLEARANCE
    let pull = -0.5 / (clearance * clearance * r)
    for (let s = 0; s < steps; s++) {
      pvx += pull * px * halfStep
      pvy += pull * py * halfStep
      px += pvx * step
      py += pvy * step
      r = Math.sqrt(px * px + py * py)
      clearance = r - 1 > MIN_CLEARANCE ? r - 1 : MIN_CLEARANCE
      pull = -0.5 / (clearance * clearance * r)
      pvx += pull * px * halfStep
      pvy += pull * py * halfStep
    }

    if (r < capture || r > ESCAPE_RADIUS || r !== r) {
      // What crosses the radius of no return lights the photon ring where it went in
      if (ringEnergy && r < capture) {
        depositRingEnergy(ringEnergy, px, py, CAPTURE_ENERGY)
        depositRingEnergy(ringEnergy, px - py * CAPTURE_SPREAD, py + px * CAPTURE_SPREAD, CAPTURE_ENERGY * 0.5)
        depositRingEnergy(ringEnergy, px + py * CAPTURE_SPREAD, py - px * CAPTURE_SPREAD, CAPTURE_ENERGY * 0.5)
      }
      spawnOrbiter(orbiters, i, size, eccentricity, palette)
      px = x[i]
      py = y[i]
    } else {
      x[i] = px
      y[i] = py
      vx[i] = pvx
      vy[i] = pvy
      age[i] += dt
    }

    // The segment runs from where the star was drawn last; both ends are placed from where the black
    // hole is now, so a moving hole carries its stars without smearing them
    const fromX = drawnX[i] === drawnX[i] ? drawnX[i] : px
    const fromY = drawnY[i] === drawnY[i] ? drawnY[i] : py
    drawnX[i] = px
    drawnY[i] = py
    const o = (offset + i) * INSTANCE_FLOATS
    floats[o] = holeX + fromX * radius
    floats[o + 1] = holeY + fromY * radius
    floats[o + 2] = holeX + px * radius
    floats[o + 3] = holeY + py * radius
    floats[o + 4] = width
    floats[o + 5] = opacity * (age[i] < FADE_IN ? age[i] / FADE_IN : 1)
    colors[o + 6] = color[i]
  }

  return count
}
