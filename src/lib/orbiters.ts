// Stars in orbit around the black hole. Unlike the particle field they have velocity, so they keep real
// orbits: ellipses that turn a little further round on every pass (the pericentre precession S2 shows
// around Sagittarius A*), tight ones that swing close to the speed of light, and none that last inside
// three Schwarzschild radii. Gravity is the Paczynski-Wiita potential, -GM / (r - rs): Newton's with the
// Schwarzschild radius cut out, which puts the last stable orbit and the plunge where relativity does.
//
// The state is kept in Schwarzschild radii and units of the speed of light, relative to the black hole, so
// the orbits scale with the hole and move with it. They lie in the plane of the screen.
//
// The trace of an orbit is kept as lines, not as a picture: a star hands the renderer the stretch it is
// flying, from where the stretch began to where the star is now, in the same Schwarzschild radii. The
// renderer keeps every stretch and draws them all anew each frame, so the traces follow the hole, grow
// with it and stay sharp at any zoom.
import { nextRandom, type Random } from './random'
import { depositRingEnergy, type RingEnergy } from './ring_energy'
import { INSTANCE_FLOATS, samplePaletteColor, type PaletteSampler } from './particle_simulation'

export const MAX_ORBITERS = 64
// A stretch has the layout of a particle's record: its start and end, how far the traces had dimmed when
// it was last flown, its brightness, its colour
export const STRETCH_FLOATS = INSTANCE_FLOATS
// A trace never loses its brightness faster than over this many seconds, so a trail of 0 still shows the star
const SHORTEST_TRACE = 0.05
// Seconds a stretch is flown before the next one begins, whatever the frame rate, so the longest trace
// of a star is a known number of them. A hair under one sixtieth: a 60 Hz frame that ran a moment short
// still closes its stretch
export const STRETCH_SECONDS = 0.016

// Schwarzschild radii in the radius of the shadow, sqrt(27) / 2
export const SHADOW_RADII = 2.598
// The speed of light on screen, in short screen sides per second
export const LIGHT_SPEED = 1.2
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
  // Where the stretch the star is flying began
  fromX: Float64Array
  fromY: Float64Array
  // The stretches the stars are flying, one record each, and the same bytes for their colours
  row: Float32Array
  rowColors: Uint32Array
  // True on the frame a new row of stretches begins; false while the stars go on with the last one
  rowNew: boolean
  rowCount: number
  rowSeconds: number
  // Brightness every trace has lost since the traces began, the measure a stretch's age is kept in: it
  // grows by 1 over the seconds a trace stays lit, so a trail that changes length dims what is already
  // there at the new rate from then on. 0 again once the last star is gone
  dimmed: number
  // Seconds since the star appeared
  age: Float32Array
  color: Uint32Array
  // Every random draw of the orbits comes from here, so a seed repeats them
  random: Random
  // The settings the orbits were made for; a change makes them all again
  size: number
  eccentricity: number
}

export function createOrbiters (random: Random): Orbiters {
  const row = new Float32Array(MAX_ORBITERS * STRETCH_FLOATS)
  return {
    random,
    count: 0,
    fromX: new Float64Array(MAX_ORBITERS),
    fromY: new Float64Array(MAX_ORBITERS),
    row,
    rowColors: new Uint32Array(row.buffer),
    rowNew: true,
    rowCount: 0,
    rowSeconds: 0,
    dimmed: 0,
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
  const random = orbiters.random
  const semiMajor = size * SHADOW_RADII * (1 - SIZE_SPREAD / 2 + SIZE_SPREAD * nextRandom(random))
  const e = eccentricity * (1 - ECCENTRICITY_SPREAD + ECCENTRICITY_SPREAD * nextRandom(random))
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
    r = pericentre + (apocentre - pericentre) * nextRandom(random)
  }

  const around = Math.sqrt(momentumSq) / r
  const outward = Math.sqrt(Math.max(2 * (energy - potential(r)) - around * around, 0)) * (nextRandom(random) < 0.5 ? -1 : 1)
  const angle = nextRandom(random) * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  orbiters.x[i] = r * cos
  orbiters.y[i] = r * sin
  orbiters.vx[i] = outward * cos - around * sin
  orbiters.vy[i] = outward * sin + around * cos
  orbiters.drawnX[i] = NaN
  orbiters.drawnY[i] = NaN
  orbiters.age[i] = 0
  orbiters.color[i] = samplePaletteColor(palette, random)
}

// Forgets the stars and the traces they left
export function clearOrbiters (orbiters: Orbiters) {
  orbiters.count = 0
  orbiters.rowCount = 0
  orbiters.rowSeconds = 0
  orbiters.dimmed = 0
}

/**
 * Advances the stars by `dt` seconds and writes the stretch each is flying into `orbiters.row`. Lengths
 * are CSS pixels; `speed` is the rate of their time, and its sign their direction; `trail` is the
 * seconds a trace stays lit. Returns the number of stars.
 */
export function stepOrbiters (
  orbiters: Orbiters,
  requested: number,
  size: number,
  eccentricity: number,
  speed: number,
  dt: number,
  shadowRadius: number,
  captureRadius: number,
  shortSide: number,
  opacity: number,
  trail: number,
  palette: PaletteSampler,
  ringEnergy: RingEnergy | null
): number {
  const count = Math.min(Math.max(Math.floor(requested), 0), MAX_ORBITERS)
  if (count === 0 || shadowRadius <= 0) {
    clearOrbiters(orbiters)
    return 0
  }

  // New settings make every orbit again; a higher count only adds stars
  const remade = size !== orbiters.size || eccentricity !== orbiters.eccentricity
  orbiters.size = size
  orbiters.eccentricity = eccentricity
  for (let i = remade ? 0 : orbiters.count; i < count; i++) spawnOrbiter(orbiters, i, size, eccentricity, palette)
  orbiters.count = count

  // The stars go on with the stretch they are flying until it is long enough; a change in their number
  // begins a new row of them
  const fresh = orbiters.rowCount !== count || orbiters.rowSeconds >= STRETCH_SECONDS
  orbiters.rowNew = fresh
  orbiters.rowCount = count
  orbiters.rowSeconds = fresh ? dt : orbiters.rowSeconds + dt
  orbiters.dimmed += dt / Math.max(trail, SHORTEST_TRACE)
  const dimmed = orbiters.dimmed

  const { x, y, vx, vy, drawnX, drawnY, fromX, fromY, age, color, row, rowColors } = orbiters
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

    // A new stretch begins where the star was drawn last; a star that has just appeared begins at itself
    const drawn = drawnX[i] === drawnX[i]
    if (fresh || !drawn) {
      fromX[i] = drawn ? drawnX[i] : px
      fromY[i] = drawn ? drawnY[i] : py
    }
    drawnX[i] = px
    drawnY[i] = py
    const o = i * STRETCH_FLOATS
    row[o] = fromX[i]
    row[o + 1] = fromY[i]
    row[o + 2] = px
    row[o + 3] = py
    row[o + 4] = dimmed
    row[o + 5] = opacity * (age[i] < FADE_IN ? age[i] / FADE_IN : 1)
    rowColors[o + 6] = color[i]
  }

  return count
}
