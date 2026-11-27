// Photons of the space sheet's flash (Photons, gridFrontPhotons): particles that are light itself, each flying
// from the flash at the speed of light along the real path of light past the main hole, so the rays bend round
// it, the front lags over it, its two halves cross behind it, a few photons wind round the photon sphere and
// some fall in.
//
// The physics is Light Front's (light_front.ts), its medium and its scale taken from there: a static
// Schwarzschild hole is, for light, a medium, in isotropic coordinates the index n(ρ) = (1 + rs/4ρ)³ /
// (1 − rs/4ρ) (frontIndex), and the coordinate time light takes is the optical path, dt = n ds; the sheet's
// plane is the isotropic plane, the throat the critical impact parameter, so lengths here are in throat
// radii and rs is FRONT_RS. The eikonal there gives the time light's first arrival takes; here a ray is
// d/ds(n dr/ds) = ∇n, the null geodesic itself, written with p = n dr/ds, whose length is n, and coordinate
// time as the clock: dr/dt = p / n², dp/dt = ∇n / n. So the photons' front and the lit band are one front.
//
// The cost. A photon's path depends only on where the flash is from the hole, so the paths are traced once
// when that place or the count changes, on the main thread, into a table of places by coordinate time
// (`tracePhotons`), which goes up to the graphics card as a texture; each frame the photon program
// (photon_program.ts) reads every photon at the run's time and draws its trail back along its own path. No
// frame integrates anything, and the same run draws the same picture. A second hole is not traced: its well
// neither bends nor takes the photons.

import { FRONT_RS, frontIndex } from './light_front'

// The horizon's radius in isotropic coordinates, rs / 4
const HORIZON = FRONT_RS / 4
// Coordinate time never takes light to the horizon: near it the index grows without end and the photon slows
// to a stop. A photon this share of the horizon's radius above it is taken; from there it would need ever
// more time and steps for a move no picture shows (an arithmetic floor, not a look)
const TAKEN_AT = HORIZON * 1.02

// The table: samples of each photon's place every PHOTON_TICK of coordinate time (throat radii of light
// travel), PHOTON_SAMPLES of them, so it spans PHOTON_SAMPLES * PHOTON_TICK = 64 radii of run. Two columns
// follow: the photon's velocity at the last sample, along which it flies on straight beyond the table (64
// radii out the index is 1 to a hundredth), and the time it was taken (or -1). What memory and the trace's
// time hold it to: the table is (PHOTON_SAMPLES + 2) × count × two floats, 4 MB at the most photons, and far
// from the hole a photon takes a step a tick. A tick of a quarter radius follows even the photon sphere's
// orbit (0.36 radii round, crossed at a third of light's far speed) in chords whose bow is 0.003 radii
export const PHOTON_SAMPLES = 256
export const PHOTON_TICK = 0.25
export const PHOTON_COLUMNS = PHOTON_SAMPLES + 2
// The most photons a flash sends, the top of Photon Count
export const MAX_PHOTONS = 4096

// The longest step of the integration, as a share of the photon's height above the horizon: what the arithmetic's
// precision asks for near the hole (an orbit of the photon sphere takes some 300 steps), far away the tick
const STEP_SHARE = 0.02
// The most steps a photon takes in one tick, so a photon that grazes the horizon cannot stall the trace
const MAX_STEPS_PER_TICK = 4000

// n(ρ) and n'(ρ) / n(ρ) at ρ, into a two-slot array
function index (rho: number, out: Float64Array) {
  const u = HORIZON / rho
  out[0] = frontIndex(rho)
  // dn/dρ = -(u / ρ) (1 + u)² (4 - 2u) / (1 - u)², over n
  out[1] = -(u / rho) * (4 - 2 * u) / ((1 + u) * (1 - u))
}

const at = new Float64Array(2)
// One RK4 step's stages: the derivatives of x, y, px, py
const k = new Float64Array(16)

// The derivatives of the state (x, y, px, py) in coordinate time, into k at slot
function slope (x: number, y: number, px: number, py: number, slot: number) {
  const rho = Math.sqrt(x * x + y * y)
  index(rho, at)
  const n = at[0]
  const pull = at[1] / rho
  k[slot] = px / (n * n)
  k[slot + 1] = py / (n * n)
  k[slot + 2] = pull * x
  k[slot + 3] = pull * y
}

/**
 * One photon from (x, y), throat radii from the hole, heading at `angle`: its places every tick into `table`
 * at row `row` (x, y pairs), then its velocity at the last sample and the time it was taken (-1 if never).
 * Returns the time it was taken, or -1
 */
export function tracePhoton (table: Float32Array, row: number, x: number, y: number, angle: number): number {
  const base = row * PHOTON_COLUMNS * 2
  let rho = Math.sqrt(x * x + y * y)
  if (rho <= TAKEN_AT) {
    for (let s = 0; s < PHOTON_SAMPLES; s++) {
      table[base + 2 * s] = x
      table[base + 2 * s + 1] = y
    }
    table[base + 2 * PHOTON_SAMPLES] = 0
    table[base + 2 * PHOTON_SAMPLES + 1] = 0
    table[base + 2 * PHOTON_SAMPLES + 2] = 0
    table[base + 2 * PHOTON_SAMPLES + 3] = 0
    return 0
  }
  index(rho, at)
  let px = at[0] * Math.cos(angle)
  let py = at[0] * Math.sin(angle)
  table[base] = x
  table[base + 1] = y
  let taken = -1
  let s = 1
  for (; s < PHOTON_SAMPLES; s++) {
    let left = PHOTON_TICK
    let steps = 0
    while (left > 0 && taken < 0) {
      index(rho, at)
      // A step of length STEP_SHARE of the height above the horizon, in coordinate time n ds, at most the rest
      // of the tick
      const h = Math.min(left, Math.max(at[0] * STEP_SHARE * (rho - HORIZON), PHOTON_TICK / MAX_STEPS_PER_TICK))
      slope(x, y, px, py, 0)
      slope(x + 0.5 * h * k[0], y + 0.5 * h * k[1], px + 0.5 * h * k[2], py + 0.5 * h * k[3], 4)
      slope(x + 0.5 * h * k[4], y + 0.5 * h * k[5], px + 0.5 * h * k[6], py + 0.5 * h * k[7], 8)
      slope(x + h * k[8], y + h * k[9], px + h * k[10], py + h * k[11], 12)
      x += h / 6 * (k[0] + 2 * k[4] + 2 * k[8] + k[12])
      y += h / 6 * (k[1] + 2 * k[5] + 2 * k[9] + k[13])
      px += h / 6 * (k[2] + 2 * k[6] + 2 * k[10] + k[14])
      py += h / 6 * (k[3] + 2 * k[7] + 2 * k[11] + k[15])
      rho = Math.sqrt(x * x + y * y)
      // The ray's own law keeps |p| = n; holding it there keeps the steps' small errors from adding up
      if (rho > TAKEN_AT) {
        index(rho, at)
        const fix = at[0] / Math.sqrt(px * px + py * py)
        px *= fix
        py *= fix
      } else {
        taken = s * PHOTON_TICK - left + h
      }
      left -= h
      if (++steps >= MAX_STEPS_PER_TICK) left = 0
    }
    table[base + 2 * s] = x
    table[base + 2 * s + 1] = y
    if (taken >= 0) break
  }
  // A photon taken stays where it was taken
  for (let rest = s + 1; rest < PHOTON_SAMPLES; rest++) {
    table[base + 2 * rest] = x
    table[base + 2 * rest + 1] = y
  }
  let vx = 0
  let vy = 0
  if (taken < 0) {
    index(rho, at)
    vx = px / (at[0] * at[0])
    vy = py / (at[0] * at[0])
  }
  table[base + 2 * PHOTON_SAMPLES] = vx
  table[base + 2 * PHOTON_SAMPLES + 1] = vy
  table[base + 2 * PHOTON_SAMPLES + 2] = taken
  table[base + 2 * PHOTON_SAMPLES + 3] = 0
  return taken
}

/**
 * Every photon of a flash at (x, y), throat radii from the hole on the isotropic plane, `count` of them sent
 * evenly in angle: the table `tracePhoton` fills row by row
 */
export function tracePhotons (table: Float32Array, count: number, x: number, y: number) {
  for (let row = 0; row < count; row++) tracePhoton(table, row, x, y, (row + 0.5) / count * 2 * Math.PI)
}

// How far the flash may stand from where its photons were traced, in throat radii, before they are traced
// again: the trace moved with it bends the light round a hole that far off, a pixel where the throat is 100
// pixels wide
export const PHOTON_DRIFT = 0.01

// Where the photons are traced from, kept by the scene, which steps every frame of a film, drawn or not, so a
// still and a video trace at the same places: the place traced (NaN: none) and the flash's place last frame
export interface PhotonTrace {
  x: number
  y: number
  lastX: number
  lastY: number
}

export function createPhotonTrace (): PhotonTrace {
  return { x: NaN, y: NaN, lastX: NaN, lastY: NaN }
}

// Whether a place stands still from one frame to the next, to a double's rounding: an ease's tail moves it a
// little every frame, and a looser test would trace on each of those frames
const still = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), 1)

/**
 * Moves `trace` on by a frame whose flash stands at (x, y), throat radii from the hole, with its light run
 * `run`. Nothing is traced while the light has not run, and the first frame it has is traced where the flash
 * is. While the place keeps moving (a hole dragged after the flash, the sheet's layout turning as 3D eases in)
 * a trace a frame would take a tenth of a second each, so the trace stays and is drawn moved with the flash;
 * the first frame the place stands still, more than PHOTON_DRIFT from the trace, it is traced there
 */
export function followFlash (trace: PhotonTrace, x: number, y: number, run: number) {
  const stands = still(x, trace.lastX) && still(y, trace.lastY)
  trace.lastX = x
  trace.lastY = y
  if (run <= 0) {
    trace.x = NaN
    trace.y = NaN
  } else if (Number.isNaN(trace.x) || (stands && Math.abs(x - trace.x) + Math.abs(y - trace.y) > PHOTON_DRIFT)) {
    trace.x = x
    trace.y = y
  }
}
