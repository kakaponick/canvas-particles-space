// Stars in orbit around the black hole. Unlike the particle field they have velocity, so they keep real
// orbits: ellipses that turn a little further round on every pass (the pericentre precession S2 shows
// around Sagittarius A*), tight ones that swing close to the speed of light, and none that last inside
// three Schwarzschild radii. Gravity is the Paczynski-Wiita potential, -GM / (r - rs), by the true distance:
// Newton's with the Schwarzschild radius cut out, which puts the last stable orbit and the plunge where
// relativity does. A spinning hole adds the gravitomagnetic field of a spinning mass (Lense-Thirring),
// which turns each orbit's plane about the spin's axis as well as the orbit within its plane.
//
// The state is kept in Schwarzschild radii and units of the speed of light, relative to the black hole, in
// the scene's three coordinates (x right, y down, z away from the flat camera), so the orbits scale with the
// hole and move with it. A star is born in the hole's equator, tipped out of it about a node of its own;
// after that it is the motion alone that moves it, so a spin axis that turns later precesses its orbit.
//
// The trace of an orbit is kept as lines, not as a picture: a star hands the renderer the stretch it is
// flying, from where the stretch began to where the star is now, in the same Schwarzschild radii. The
// renderer keeps every stretch and draws them all anew each frame, so the traces follow the hole, grow
// with it and stay sharp at any zoom.
import { nextRandom, type Random } from './random'
import { depositRingEnergy, type RingEnergy } from './ring_energy'
import { samplePaletteColor, type PaletteSampler } from './particle_simulation'

export const MAX_ORBITERS = 64
// A stretch: its start and how far the traces had dimmed when it was last flown, its end and its
// brightness, its colour as four bytes
export const STRETCH_FLOATS = 9
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
const DEGREE = Math.PI / 180
// How the orbits are made and held, beyond their number, size and pace: the Fine Tuning of the Orbiting
// Stars and the stars' part of the Photon Ring's. Made once with the scene, which fills it in every frame
export interface OrbitTuning {
  // How much the orbits differ from the size and eccentricity set: each gets a share of them
  sizeSpread: number
  eccentricitySpread: number
  // The widest an orbit's plane is tipped out of the hole's equator, in degrees
  inclination: number
  // Closest pericentre an orbit is given, in Schwarzschild radii; closer ones exist only as plunges
  closest: number
  // A star this far out, in Schwarzschild radii, has escaped and is replaced
  escape: number
  // Seconds a new star takes to light up
  fadeIn: number
  // How hard the hole's spin swings the orbits, as a multiple of what the spin gives (Lense-Thirring)
  drag: number
  // Light a captured star leaves in the photon ring, many times a particle's, how far round it spreads to
  // each side, and the light in each side as a multiple of the middle's
  flare: number
  flareSpread: number
  flareSides: number
}

// The values the code had before they were settings
export function createOrbitTuning (): OrbitTuning {
  return { sizeSpread: 0.8, eccentricitySpread: 0.4, inclination: 20, closest: 1.3, escape: 400, fadeIn: 0.6, drag: 1, flare: 6, flareSpread: 0.2, flareSides: 0.5 }
}

export interface Orbiters {
  count: number
  // Position in Schwarzschild radii and velocity in units of the speed of light, from the black hole
  x: Float64Array
  y: Float64Array
  z: Float64Array
  vx: Float64Array
  vy: Float64Array
  vz: Float64Array
  // Where the star was drawn last; NaN before it has been drawn
  drawnX: Float64Array
  drawnY: Float64Array
  drawnZ: Float64Array
  // Where the stretch the star is flying began
  fromX: Float64Array
  fromY: Float64Array
  fromZ: Float64Array
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
  sizeSpread: number
  eccentricitySpread: number
  inclination: number
  closest: number
}

export function createOrbiters (random: Random): Orbiters {
  const row = new Float32Array(MAX_ORBITERS * STRETCH_FLOATS)
  return {
    random,
    count: 0,
    fromX: new Float64Array(MAX_ORBITERS),
    fromY: new Float64Array(MAX_ORBITERS),
    fromZ: new Float64Array(MAX_ORBITERS),
    row,
    rowColors: new Uint32Array(row.buffer),
    rowNew: true,
    rowCount: 0,
    rowSeconds: 0,
    dimmed: 0,
    x: new Float64Array(MAX_ORBITERS),
    y: new Float64Array(MAX_ORBITERS),
    z: new Float64Array(MAX_ORBITERS),
    vx: new Float64Array(MAX_ORBITERS),
    vy: new Float64Array(MAX_ORBITERS),
    vz: new Float64Array(MAX_ORBITERS),
    drawnX: new Float64Array(MAX_ORBITERS),
    drawnY: new Float64Array(MAX_ORBITERS),
    drawnZ: new Float64Array(MAX_ORBITERS),
    age: new Float32Array(MAX_ORBITERS),
    color: new Uint32Array(MAX_ORBITERS),
    size: 0,
    eccentricity: 0,
    sizeSpread: 0,
    eccentricitySpread: 0,
    inclination: 0,
    closest: 0
  }
}

const potential = (r: number) => -0.5 / (r - 1)

// Puts a star at a random point of a random orbit of about the size and eccentricity set. Energy and
// angular momentum follow from the orbit's two turning points, which holds for any central force, so
// the star is on that orbit wherever along it it starts. The orbit lies in the equator (its two
// directions, then the one it faces) tipped by up to `inclination` radians about a node of its own
function spawnOrbiter (
  orbiters: Orbiters, i: number, size: number, eccentricity: number, inclination: number, equator: ArrayLike<number>, palette: PaletteSampler
) {
  const random = orbiters.random
  const { sizeSpread, eccentricitySpread } = orbiters
  const semiMajor = size * SHADOW_RADII * (1 - sizeSpread / 2 + sizeSpread * nextRandom(random))
  const e = eccentricity * (1 - eccentricitySpread + eccentricitySpread * nextRandom(random))
  const pericentre = Math.max(semiMajor * (1 - e), orbiters.closest)
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
  // The plane: the node is a direction in the equator, and the orbit's second direction is the equator's
  // one across the node, turned out of it toward the way the equator faces by the inclination
  const node = nextRandom(random) * Math.PI * 2
  const tip = nextRandom(random) * inclination
  const nodeCos = Math.cos(node)
  const nodeSin = Math.sin(node)
  const tipCos = Math.cos(tip)
  const tipSin = Math.sin(tip)
  const nx = nodeCos * equator[0] + nodeSin * equator[3]
  const ny = nodeCos * equator[1] + nodeSin * equator[4]
  const nz = nodeCos * equator[2] + nodeSin * equator[5]
  const qx = tipCos * (nodeCos * equator[3] - nodeSin * equator[0]) + tipSin * equator[6]
  const qy = tipCos * (nodeCos * equator[4] - nodeSin * equator[1]) + tipSin * equator[7]
  const qz = tipCos * (nodeCos * equator[5] - nodeSin * equator[2]) + tipSin * equator[8]
  // Where along the orbit it starts, measured from the node
  const angle = nextRandom(random) * Math.PI * 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const out = outward * cos - around * sin
  const side = outward * sin + around * cos
  orbiters.x[i] = r * (cos * nx + sin * qx)
  orbiters.y[i] = r * (cos * ny + sin * qy)
  orbiters.z[i] = r * (cos * nz + sin * qz)
  orbiters.vx[i] = out * nx + side * qx
  orbiters.vy[i] = out * ny + side * qy
  orbiters.vz[i] = out * nz + side * qz
  orbiters.drawnX[i] = NaN
  orbiters.drawnY[i] = NaN
  orbiters.drawnZ[i] = NaN
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

// The star being stepped: its place, then its velocity. Made once, so a step allocates nothing
const star = new Float64Array(6)

// Half a kick of the leapfrog, `h` long, at the star's place: half the pull, the turn the spin's field gives
// the velocity over the whole of `h`, the other half of the pull. The turn is Boris's: it keeps the speed
// as the field leaves it and runs backwards exactly, so the leapfrog still does. (jx, jy, jz) is the hole's
// angular momentum in the scene, in Schwarzschild radii and the speed of light; 0 leaves the pull alone
function kick (h: number, jx: number, jy: number, jz: number) {
  const px = star[0]
  const py = star[1]
  const pz = star[2]
  const r = Math.sqrt(px * px + py * py + pz * pz)
  const clearance = r - 1 > MIN_CLEARANCE ? r - 1 : MIN_CLEARANCE
  const pull = -0.5 / (clearance * clearance * r) * h * 0.5
  let vx = star[3] + pull * px
  let vy = star[4] + pull * py
  let vz = star[5] + pull * pz
  if (jx !== 0 || jy !== 0 || jz !== 0) {
    // The gravitomagnetic field of a spinning mass, B = (3 (J.r) r / r^2 - J) / r^3, held at the
    // Schwarzschild radius, pushes 2 B x v: a star moving with the hole's turn is pushed out and one against
    // it pulled in, and the plane of an orbit turns about the spin's axis at 2 J / r^3 (the node's
    // precession), the same way the field's particles are carried round. The velocity turns about -2 B
    const held = r > 1 ? r : 1
    const inv = 1 / (held * held * held)
    const along = 3 * (jx * px + jy * py + jz * pz) / (held * held)
    const t = -h * inv
    const tx = (along * px - jx) * t
    const ty = (along * py - jy) * t
    const tz = (along * pz - jz) * t
    const s = 2 / (1 + tx * tx + ty * ty + tz * tz)
    const wx = vx + (vy * tz - vz * ty)
    const wy = vy + (vz * tx - vx * tz)
    const wz = vz + (vx * ty - vy * tx)
    vx += (wy * tz - wz * ty) * s
    vy += (wz * tx - wx * tz) * s
    vz += (wx * ty - wy * tx) * s
  }
  star[3] = vx + pull * px
  star[4] = vy + pull * py
  star[5] = vz + pull * pz
}

/**
 * Advances the stars by `dt` seconds and writes the stretch each is flying into `orbiters.row`. Lengths
 * are CSS pixels; `speed` is the rate of their time, and its sign their direction; (spinX, spinY, spinZ)
 * is the hole's spin (a/M) along its axis as it stands in the scene; `equator` is the plane new stars are
 * born near (two directions in it, then the one it faces); `trail` is the seconds a trace stays lit;
 * `tuning` is how the orbits are made and held; `turn` is the camera's turn, row by row, through which a
 * swallowed star is seen round the hole. Returns the number of stars.
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
  spinX: number,
  spinY: number,
  spinZ: number,
  equator: ArrayLike<number>,
  shortSide: number,
  opacity: number,
  trail: number,
  palette: PaletteSampler,
  ringEnergy: RingEnergy | null,
  tuning: OrbitTuning,
  turn: ArrayLike<number>
): number {
  const count = Math.min(Math.max(Math.floor(requested), 0), MAX_ORBITERS)
  if (count === 0 || shadowRadius <= 0) {
    clearOrbiters(orbiters)
    return 0
  }

  // New settings make every orbit again; a higher count only adds stars
  const remade = size !== orbiters.size || eccentricity !== orbiters.eccentricity || tuning.sizeSpread !== orbiters.sizeSpread ||
    tuning.eccentricitySpread !== orbiters.eccentricitySpread || tuning.inclination !== orbiters.inclination || tuning.closest !== orbiters.closest
  orbiters.size = size
  orbiters.eccentricity = eccentricity
  orbiters.sizeSpread = tuning.sizeSpread
  orbiters.eccentricitySpread = tuning.eccentricitySpread
  orbiters.inclination = tuning.inclination
  orbiters.closest = tuning.closest
  const inclination = tuning.inclination * DEGREE
  for (let i = remade ? 0 : orbiters.count; i < count; i++) spawnOrbiter(orbiters, i, size, eccentricity, inclination, equator, palette)
  orbiters.count = count

  // The stars go on with the stretch they are flying until it is long enough; a change in their number
  // begins a new row of them
  const fresh = orbiters.rowCount !== count || orbiters.rowSeconds >= STRETCH_SECONDS
  orbiters.rowNew = fresh
  orbiters.rowCount = count
  orbiters.rowSeconds = fresh ? dt : orbiters.rowSeconds + dt
  orbiters.dimmed += dt / Math.max(trail, SHORTEST_TRACE)
  const dimmed = orbiters.dimmed

  const { x, y, z, vx, vy, vz, drawnX, drawnY, drawnZ, fromX, fromY, fromZ, age, color, row, rowColors } = orbiters
  const radius = shadowRadius / SHADOW_RADII
  const capture = captureRadius / radius
  const elapsed = dt * speed * LIGHT_SPEED * shortSide / radius
  const steps = Math.min(Math.max(Math.ceil(Math.abs(elapsed) / MAX_STEP), 1), MAX_STEPS)
  const step = elapsed / steps
  const halfStep = step * 0.5
  // The hole's angular momentum: J = spin M^2 = spin / 4 in Schwarzschild radii, times Spin Drag
  const share = 0.25 * tuning.drag
  const jx = spinX * share
  const jy = spinY * share
  const jz = spinZ * share
  const { escape, fadeIn, flare, flareSpread } = tuning
  const flareSide = flare * tuning.flareSides

  for (let i = 0; i < count; i++) {
    star[0] = x[i]
    star[1] = y[i]
    star[2] = z[i]
    star[3] = vx[i]
    star[4] = vy[i]
    star[5] = vz[i]
    // Leapfrog: half a kick, a drift, half a kick. It keeps an orbit's energy over thousands of turns
    // and runs backwards as well as forwards, which is how a negative speed reverses the orbits
    for (let s = 0; s < steps; s++) {
      kick(halfStep, jx, jy, jz)
      star[0] += star[3] * step
      star[1] += star[4] * step
      star[2] += star[5] * step
      kick(halfStep, jx, jy, jz)
    }
    let px = star[0]
    let py = star[1]
    let pz = star[2]
    const r = Math.sqrt(px * px + py * py + pz * pz)

    if (r < capture || r > escape || r !== r) {
      // What crosses the radius of no return lights the photon ring where the camera sees it go in, round
      // the hole as the ring is drawn
      if (ringEnergy && r < capture) {
        const seenX = turn[0] * px + turn[1] * py + turn[2] * pz
        const seenY = turn[3] * px + turn[4] * py + turn[5] * pz
        depositRingEnergy(ringEnergy, seenX, seenY, flare)
        depositRingEnergy(ringEnergy, seenX - seenY * flareSpread, seenY + seenX * flareSpread, flareSide)
        depositRingEnergy(ringEnergy, seenX + seenY * flareSpread, seenY - seenX * flareSpread, flareSide)
      }
      spawnOrbiter(orbiters, i, size, eccentricity, inclination, equator, palette)
      px = x[i]
      py = y[i]
      pz = z[i]
    } else {
      x[i] = px
      y[i] = py
      z[i] = pz
      vx[i] = star[3]
      vy[i] = star[4]
      vz[i] = star[5]
      age[i] += dt
    }

    // A new stretch begins where the star was drawn last; a star that has just appeared begins at itself
    const drawn = drawnX[i] === drawnX[i]
    if (fresh || !drawn) {
      fromX[i] = drawn ? drawnX[i] : px
      fromY[i] = drawn ? drawnY[i] : py
      fromZ[i] = drawn ? drawnZ[i] : pz
    }
    drawnX[i] = px
    drawnY[i] = py
    drawnZ[i] = pz
    const o = i * STRETCH_FLOATS
    row[o] = fromX[i]
    row[o + 1] = fromY[i]
    row[o + 2] = fromZ[i]
    row[o + 3] = dimmed
    row[o + 4] = px
    row[o + 5] = py
    row[o + 6] = pz
    row[o + 7] = opacity * (age[i] < fadeIn ? age[i] / fadeIn : 1)
    rowColors[o + 8] = color[i]
  }

  return count
}
