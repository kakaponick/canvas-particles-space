// The exact half of a Mandelbrot zoom: where the camera flies to, found to as many bits as the deepest
// frame needs, and the orbit of that point, which every pixel is measured against (perturbation, see
// fractal_shaders.ts). Numbers here are fixed-point complex numbers on BigInt: a value times 2^bits.
//
// A Misiurewicz point is the target a zoom can fall into forever: its orbit lands on a repelling cycle
// after `preperiod` steps and repeats every `period` steps, so the set around it is the same picture at
// every depth, turned and shrunk by the cycle's multiplier. Its orbit is stored once, preperiod and cycle,
// and the shader loops over the cycle; nothing about it grows with the depth but the bits of Newton's
// method that place it. Any other point is stored as its orbit up to where it escapes or the length asked for.
import { fail } from './agent_values'

export interface Fixed { re: bigint, im: bigint }

// Bits kept beyond the deepest frame's own: what the orbit and Newton's method lose to rounding
export const GUARD_BITS = 64
// Newton's method stops when a step moves the point by less than this many units of the last bit
const NEWTON_SETTLED = 1n << 12n
const NEWTON_STEPS = 80
// A point closer than this to its own orbit `period` steps on is on its cycle (doubles)
const CYCLE_MATCH = 1e-9

const add = (a: Fixed, b: Fixed): Fixed => ({ re: a.re + b.re, im: a.im + b.im })
const sub = (a: Fixed, b: Fixed): Fixed => ({ re: a.re - b.re, im: a.im - b.im })

function mul (a: Fixed, b: Fixed, bits: bigint): Fixed {
  return { re: (a.re * b.re - a.im * b.im) >> bits, im: (a.re * b.im + a.im * b.re) >> bits }
}

function square (a: Fixed, bits: bigint): Fixed {
  return { re: (a.re * a.re - a.im * a.im) >> bits, im: (2n * a.re * a.im) >> bits }
}

function div (a: Fixed, b: Fixed, bits: bigint): Fixed {
  const den = b.re * b.re + b.im * b.im
  if (den === 0n) fail('Newton\'s method met a flat spot; give the target nearer to the point')
  return { re: ((a.re * b.re + a.im * b.im) << bits) / den, im: ((a.im * b.re - a.re * b.im) << bits) / den }
}

const abs = (value: bigint) => value < 0n ? -value : value

// A decimal number written as text ("-0.743643887037158704752191506114774", "1.5e-3") as a fixed-point
// value of `bits` bits, exactly as written: every digit given is kept
export function parseDecimal (text: string, bits: number): bigint {
  const match = /^\s*([+-])?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?\s*$/.exec(text)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) fail(`"${text}" is not a number`)
  const [, sign, whole, fraction = '', exponent = '0'] = match
  const digits = BigInt((whole || '0') + fraction)
  const power = Number(exponent) - fraction.length
  let value: bigint
  if (power >= 0) {
    value = (digits * 10n ** BigInt(power)) << BigInt(bits)
  } else {
    const scale = 10n ** BigInt(-power)
    // Rounded to the nearest last bit
    value = ((digits << BigInt(bits + 1)) / scale + 1n) >> 1n
  }
  return sign === '-' ? -value : value
}

// A fixed-point value as decimal text with `digits` digits after the point
export function toDecimal (value: bigint, bits: number, digits: number): string {
  const negative = value < 0n
  const scaled = (abs(value) * 10n ** BigInt(digits) + (1n << BigInt(bits - 1))) >> BigInt(bits)
  const text = scaled.toString().padStart(digits + 1, '0')
  return `${negative ? '-' : ''}${text.slice(0, -digits)}.${text.slice(-digits)}`
}

export const fromNumber = (value: number, bits: number) => parseDecimal(value.toPrecision(17), bits)

// A fixed-point value as the nearest double, at any number of bits
export function toNumber (value: bigint, bits: number): number {
  if (bits <= 60) return Number(value) / 2 ** bits
  return Number(value >> BigInt(bits - 60)) / 2 ** 60
}

// The Misiurewicz point of this preperiod and period nearest the double `near`: Newton's method on
// z(k + p) - z(k), first in doubles and then to `bits` bits. Fails with what it found instead when the point
// it settles on has a shorter preperiod or period than asked
export function findMisiurewicz (near: [number, number], preperiod: number, period: number, bits: number): Fixed {
  let [cr, ci] = near
  for (let step = 0; step < NEWTON_STEPS; step++) {
    let zr = 0, zi = 0, dr = 0, di = 0, ar = 0, ai = 0, adr = 0, adi = 0
    for (let n = 0; n < preperiod + period; n++) {
      const ndr = 2 * (zr * dr - zi * di) + 1
      di = 2 * (zr * di + zi * dr)
      dr = ndr
      const nzr = zr * zr - zi * zi + cr
      zi = 2 * zr * zi + ci
      zr = nzr
      if (n + 1 === preperiod) { ar = zr; ai = zi; adr = dr; adi = di }
    }
    const fr = zr - ar, fi = zi - ai, gr = dr - adr, gi = di - adi
    const den = gr * gr + gi * gi
    if (!Number.isFinite(den) || den === 0) fail(`Newton's method found no Misiurewicz point of preperiod ${preperiod} and period ${period} near ${near[0]}, ${near[1]}`)
    const ur = (fr * gr + fi * gi) / den, ui = (fi * gr - fr * gi) / den
    cr -= ur
    ci -= ui
    if (Math.hypot(ur, ui) < 1e-15 * Math.max(1, Math.hypot(cr, ci))) break
  }
  checkMisiurewicz(cr, ci, preperiod, period, near)

  const shift = BigInt(bits)
  const one: Fixed = { re: 1n << shift, im: 0n }
  let c: Fixed = { re: fromNumber(cr, bits), im: fromNumber(ci, bits) }
  for (let step = 0; step < NEWTON_STEPS; step++) {
    let z: Fixed = { re: 0n, im: 0n }
    let dz: Fixed = { re: 0n, im: 0n }
    let atPre = z
    let dzAtPre = dz
    for (let n = 0; n < preperiod + period; n++) {
      dz = add(mul(z, dz, shift), mul(z, dz, shift))
      dz = add(dz, one)
      z = add(square(z, shift), c)
      if (n + 1 === preperiod) { atPre = z; dzAtPre = dz }
    }
    const move = div(sub(z, atPre), sub(dz, dzAtPre), shift)
    c = sub(c, move)
    if (abs(move.re) < NEWTON_SETTLED && abs(move.im) < NEWTON_SETTLED) return c
  }
  return fail(`Newton's method did not settle on the Misiurewicz point near ${near[0]}, ${near[1]}`)
}

// The point found is the one asked for: on its cycle after exactly `preperiod` steps, with no shorter period
function checkMisiurewicz (cr: number, ci: number, preperiod: number, period: number, near: [number, number]) {
  const orbit: [number, number][] = []
  let zr = 0, zi = 0
  for (let n = 0; n <= preperiod + period; n++) {
    orbit.push([zr, zi])
    const nzr = zr * zr - zi * zi + cr
    zi = 2 * zr * zi + ci
    zr = nzr
  }
  const apart = (a: number, b: number) => Math.hypot(orbit[a][0] - orbit[b][0], orbit[a][1] - orbit[b][1])
  const at = `near ${near[0]}, ${near[1]}`
  if (!Number.isFinite(cr) || apart(preperiod + period, preperiod) > CYCLE_MATCH) {
    fail(`No Misiurewicz point of preperiod ${preperiod} and period ${period} was found ${at}`)
  }
  for (let shorter = 1; shorter < period; shorter++) {
    if (period % shorter === 0 && apart(preperiod + shorter, preperiod) < CYCLE_MATCH) {
      fail(`The point ${at} repeats every ${shorter} steps, not ${period}: give period ${shorter}`)
    }
  }
  if (preperiod > 0 && apart(preperiod - 1 + period, preperiod - 1) < CYCLE_MATCH) {
    fail(`The point ${at} lands on its cycle before step ${preperiod}: give a smaller preperiod`)
  }
  if (orbit.slice(preperiod, preperiod + period).some(([r, i]) => Math.hypot(r, i) < CYCLE_MATCH)) {
    fail(`The point ${at} is the centre of a bulb, not a Misiurewicz point: its cycle passes through 0`)
  }
}

export interface ReferenceOrbit {
  // Four floats an entry: the orbit's real and imaginary parts as float32, then what float32 rounded off
  values: Float32Array
  length: number
  // Where the orbit goes on after its last entry: the start of the cycle, or -1 when it ends (escaped,
  // or as long as was asked) and a pixel still on it starts over from 0
  loopFrom: number
  // The cycle's multiplier, the product of 2z around it: how much the picture shrinks (`size`) and turns
  // (`turn`, radians) from one copy of itself to the next. Null for a point that is not Misiurewicz
  multiplier: { size: number, turn: number } | null
  // log2 of the most |dz/dc| has reached by each step: how many steps a pixel this far from the target takes
  growth: Float32Array
}

// Steps of |dz/dc| kept for the iteration budget at most
const MAX_GROWTH_STEPS = 1 << 20

// `reach` is the log2 of |dz/dc| the deepest frame needs: a looping orbit is followed around its cycle
// until it gets there, an ending one to its end
function storeOrbit (points: [number, number][], loopFrom: number, reach: number): Omit<ReferenceOrbit, 'multiplier'> {
  const values = new Float32Array(points.length * 4)
  points.forEach(([re, im], index) => {
    const hiRe = Math.fround(re)
    const hiIm = Math.fround(im)
    values.set([hiRe, hiIm, Math.fround(re - hiRe), Math.fround(im - hiIm)], index * 4)
  })
  // |dz/dc| along the orbit in doubles, its exponent kept apart so it never overflows
  const steps = Math.min(MAX_GROWTH_STEPS, loopFrom >= 0 ? MAX_GROWTH_STEPS : points.length)
  const growth = new Float32Array(steps)
  let dr = 0, di = 0, exponent = 0, most = -Infinity, at = 0, n = 0
  for (; n < steps && (loopFrom < 0 || most < reach); n++) {
    const [zr, zi] = points[at]
    const ndr = 2 * (zr * dr - zi * di) + 2 ** -exponent
    di = 2 * (zr * di + zi * dr)
    dr = ndr
    const size = Math.hypot(dr, di)
    if (size > 2 ** 64) {
      dr /= 2 ** 64
      di /= 2 ** 64
      exponent += 64
    }
    most = Math.max(most, Math.log2(Math.hypot(dr, di)) + exponent)
    growth[n] = most
    at++
    if (at === points.length) at = loopFrom >= 0 ? loopFrom : 0
  }
  return { values, length: points.length, loopFrom, growth: growth.slice(0, n) }
}

// The orbit of a Misiurewicz point: its preperiod and one turn of its cycle. `reach` is the log2 of |dz/dc|
// the iteration budget of the deepest frame needs
export function misiurewiczOrbit (c: Fixed, bits: number, preperiod: number, period: number, reach: number): ReferenceOrbit {
  const shift = BigInt(bits)
  const points: [number, number][] = []
  let z: Fixed = { re: 0n, im: 0n }
  for (let n = 0; n < preperiod + period; n++) {
    points.push([toNumber(z.re, bits), toNumber(z.im, bits)])
    z = add(square(z, shift), c)
  }
  let mr = 1, mi = 0
  for (let n = preperiod; n < preperiod + period; n++) {
    const [zr, zi] = points[n]
    const nmr = 2 * (mr * zr - mi * zi)
    mi = 2 * (mr * zi + mi * zr)
    mr = nmr
  }
  return { ...storeOrbit(points, preperiod, reach), multiplier: { size: Math.hypot(mr, mi), turn: Math.atan2(mi, mr) } }
}

// The orbit of any point, `bits` bits exact, until it leaves the disc of radius 2 or reaches `limit` steps
export function pointOrbit (c: Fixed, bits: number, limit: number): ReferenceOrbit {
  const shift = BigInt(bits)
  const four = 4n << shift
  const points: [number, number][] = []
  let z: Fixed = { re: 0n, im: 0n }
  for (let n = 0; n < limit; n++) {
    points.push([toNumber(z.re, bits), toNumber(z.im, bits)])
    if ((z.re * z.re + z.im * z.im) >> shift > four) break
    z = add(square(z, shift), c)
  }
  return { ...storeOrbit(points, -1, Infinity), multiplier: null }
}

// Steps a pixel `log2Distance` (log2 of plane units) from the target takes before |dz/dc| times its distance
// passes `reach`: about when it escapes. Past the steps kept, the last one
export function stepsToReach (orbit: ReferenceOrbit, log2Distance: number, reach: number) {
  const { growth } = orbit
  const wanted = reach - log2Distance
  let low = 0
  let high = growth.length - 1
  if (growth.length === 0 || growth[high] < wanted) return growth.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (growth[middle] >= wanted) high = middle
    else low = middle + 1
  }
  return low + 1
}
