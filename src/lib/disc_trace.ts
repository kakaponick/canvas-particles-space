// The traced disc: where a ray of the Ray Traced lens (lens_trace.ts) crosses the main hole's equator, and how
// far from the hole it is there. The composite shader carries the same arithmetic in GLSL (DISC_GLSL in
// disc_glsl.ts, the same steps under the same names) and runs it for every pixel while the traced disc is
// on; this copy, in double precision, is what the shader is checked against.
//
// A ray past a hole that does not spin keeps to the plane of the camera, the hole and its own direction.
// Followed back from the camera it sweeps an angle phi round the hole, 0 at the camera, and its orbit obeys
// (du/dphi)^2 = 1/b^2 - u^2 + u^3 = (u - u1)(u - u2)(u - u3), u = 1 / r in Schwarzschild radii. The equator
// cuts that plane along a line through the hole, so the ray crosses it at phi0, phi0 + pi, phi0 + 2 pi and
// so on, as long as it has not fallen in or gone off to infinity; what is new here is r at those angles.
// It is a closed form in Jacobi's functions, for either kind of ray:
// - A ray that turns (b above the photon sphere's, three real roots u1 < 0 < u2 <= u3) has
//   u = u1 + (u2 - u1) sn^2(K - gamma (phi - phiClosest)), with gamma = sqrt(u3 - u1) / 2, parameter
//   (u2 - u1) / (u3 - u1) and K its quarter period: u2, the nearest it comes, at phiClosest, and 0 at the end
//   of its sweep. The roots and the sweep are traceSweep's, written so that none is the small difference of
//   two large numbers.
// - A ray that falls in, or one that faces away and only climbs out (b below it: one real root u1 < 0 and
//   two complex ones m +- i n), has u = u1 + A (1 - cn(w)) / (1 + cn(w)), A^2 = (m - u1)^2 + n^2, with w =
//   wCamera +- sqrt(A) phi and parameter (A + m - u1) / (2A) (Byrd and Friedman 239.00): u runs from u1 at
//   w = 0 to infinity at w = 2K. It falls in at u = 1, the horizon.
// Jacobi's functions come from the descending chain of arithmetic and geometric means (Numerical Recipes'
// sncndn with a fixed count), which takes the complement of the parameter, a quantity that is never written
// as 1 less something near 1 here: it is gap / (u3 - u1) for a ray that turns, and n^2 / (2 A (A + m - u1))
// for one that does not, both small by themselves as the ray nears the photon sphere.
import { CRITICAL_IMPACT, carlsonRF } from './lens_trace'

// How many crossings a ray is followed through: the disc's direct picture, the one of light that went
// round under the hole, and the first of the thin rings
export const DISC_CROSSINGS = 3
// Steps of the chain of means. Six hold the functions to float precision down to a complement of 1e-6, a
// ray about a millionth of the shadow's radius off its edge
export const DISC_MEANS = 6
// Texels along each side of the map of the equator the flows are drawn into, which spans the traced flows'
// outer edge each way: 2048 holds a flow out to 8 black hole radii at 128 texels to a radius, as fine as
// the stroke of a hole drawn 64 CSS pixels wide at a pixel ratio of 2
export const DISC_MAP_SIZE = 2048
// The nearest a disc's matter has a circular orbit for its colour and its shift, Schwarzschild radii: just
// outside the photon sphere, where the orbit's speed reaches that of light
export const DISC_CLOSEST_ORBIT = 1.55

// The chain of means for a parameter of this complement: the a's and the square roots of the b's it took,
// and its last mean; K = PI / (2 end)
function means (complement: number, steps: number) {
  const meanA: number[] = []
  const meanB: number[] = []
  let a = 1
  let c = 1
  for (let i = 0; i < steps; i++) {
    meanA.push(a)
    complement = Math.sqrt(complement)
    meanB.push(complement)
    c = 0.5 * (a + complement)
    complement *= a
    a = c
  }
  return { meanA, meanB, end: c }
}

type Means = ReturnType<typeof means>

// sn and cn for an argument within a quarter period of 0, by the chain worked back from its end
function jacobiNear (t: number, chain: Means) {
  const angle = chain.end * t
  const sine = Math.sin(angle)
  const side = sine < 0 ? -1 : 1
  let a = Math.cos(angle) / (side * Math.max(Math.abs(sine), 1e-300))
  let c = chain.end * a
  let dn = 1
  for (let i = chain.meanA.length - 1; i >= 0; i--) {
    const b = chain.meanA[i]
    a *= c
    c *= dn
    dn = (chain.meanB[i] + a) / (b + a)
    a = c / b
  }
  const sn = side / Math.sqrt(c * c + 1)
  return { sn, cn: c * sn }
}

// sn and cn for any argument: whole half periods 2K come off it, each turning the sign of both
function jacobi (t: number, chain: Means) {
  const half = Math.PI / chain.end
  const halves = Math.floor(t / half + 0.5)
  const near = jacobiNear(t - half * halves, chain)
  const sign = halves % 2 === 0 ? 1 : -1
  return { sn: near.sn * sign, cn: near.cn * sign }
}

export interface DiscRay {
  // 1: the ray turns round the hole and goes off; 0: it falls in, or faces away and climbs out
  turns: boolean
  // Its smallest root, and the factor of the Jacobi function: u2 - u1 for a ray that turns, A otherwise
  u1: number
  scale: number
  // The chain of means of its parameter
  chain: Means
  // A ray that turns: gamma, the angle it comes nearest at and the angle it is gone at. One that does not:
  // sqrt(A) times +1 inward or -1 outward, w at the camera, and 2K
  rate: number
  start: number
  end: number
  inward: boolean
}

/**
 * The orbit of the ray that leaves a camera 1 / u Schwarzschild radii from the hole at `slope`, tan(theta / 2)
 * of its angle theta from the direction of the hole, as the Ray Traced lens measures a pixel. A ray that
 * turns uses traceSweep's roots; one aimed inside the photon sphere is followed in, not taken just outside it
 */
export function discRay (slope: number, u: number, steps = 16): DiscRay {
  const sine = 2 * slope / (1 + slope * slope)
  const inward = slope < 1
  const b = Math.max(sine / (u * Math.sqrt(1 - u)), 1e-4)
  if (b > CRITICAL_IMPACT) {
    const angle = 2 * Math.asin(CRITICAL_IMPACT / b)
    const sixth = Math.sin(angle / 6)
    const u1 = -4 / 3 * Math.sin(Math.PI / 3 - angle / 6) * sixth
    const u2 = 4 / 3 * Math.sin(Math.PI / 3 + angle / 6) * sixth
    const gap = 2 / Math.sqrt(3) * Math.sin(Math.PI / 3 - angle / 3)
    const spread = u2 - u1
    const away = 2 * Math.sqrt(u2) * carlsonRF(-u1 * gap, spread * gap, (gap + u2) * spread)
    // cot theta from the slope: (1 - s^2) / 2s
    const cotangent = (1 - slope * slope) / (2 * slope)
    const left = u * u * (1 - u) * cotangent * cotangent / ((u - u1) * (u2 + gap - u))
    const near = 2 * Math.sqrt(left) * carlsonRF((u - u1) * gap, spread * gap, (gap + left) * spread)
    const closest = inward ? near : -near
    return {
      turns: true, u1, scale: spread, chain: means(gap / (gap + spread), steps),
      rate: 0.5 * Math.sqrt(gap + spread), start: closest, end: closest + away, inward
    }
  }
  // The real root of u^3 - u^2 + 1/b^2, which is -1/3 on the photon sphere: 1/3 - cosh(y / 3) 2/3 with
  // cosh y = 13.5 / b^2 - 1, the cosh written through the exponential
  const x = 13.5 / (b * b) - 1
  const grown = Math.cbrt(x + Math.sqrt((13.5 / (b * b) - 2) * (x + 1)))
  const u1 = (1 - grown - 1 / grown) / 3
  // The other two are m +- i n; A^2 = (m - u1)^2 + n^2 = u1 (3 u1 - 2), and the complement of the parameter,
  // (A - (m - u1)) / 2A, from n^2 = (1 - u1)(-3 u1 - 1) / 4 so that it is not a difference
  const scale = Math.sqrt(u1 * (3 * u1 - 2))
  const lift = 0.5 * (1 - 3 * u1)
  const n2 = 0.25 * (1 - u1) * (-3 * u1 - 1)
  const complement = n2 / (2 * scale * (scale + lift))
  const chain = means(complement, steps)
  const quarter = 0.5 * Math.PI / chain.end
  // w at the camera: cn(w) = (A - d) / (A + d), d = u - u1, and w = F(am, k), the integral by R_F; past a
  // quarter period it is 2K less the same
  const d = u - u1
  const cosAm = (scale - d) / (scale + d)
  const sinAm = 2 * Math.sqrt(scale * d) / (scale + d)
  const part = sinAm * carlsonRF(cosAm * cosAm, complement + (1 - complement) * cosAm * cosAm, 1)
  const start = cosAm >= 0 ? part : 2 * quarter - part
  return { turns: false, u1, scale, chain, rate: Math.sqrt(scale) * (inward ? 1 : -1), start, end: 2 * quarter, inward }
}

/**
 * How far from the hole, in Schwarzschild radii, the ray is `phi` radians round from the camera; 0 where it
 * is no longer there: gone off to infinity, or fallen through the horizon
 */
export function discRadius (ray: DiscRay, phi: number) {
  if (ray.turns) {
    if (phi >= ray.end) return 0
    const t = 0.5 * Math.PI / ray.chain.end - ray.rate * (phi - ray.start)
    const sn = jacobi(t, ray.chain).sn
    const u = ray.u1 + ray.scale * sn * sn
    return u > 0 ? 1 / u : 0
  }
  const w = ray.start + ray.rate * phi
  if (w >= ray.end || w <= 0) return 0
  const cn = jacobi(w, ray.chain).cn
  const u = ray.u1 + ray.scale * (1 - cn) / (1 + cn)
  if (ray.inward ? u > 1 : u <= 0) return 0
  return 1 / u
}

/**
 * The crossings of the equator, nearest the camera first: for each, the radius (0: none) and the angle round
 * from the camera. `across` and `ahead` are the parts of the equator's axis along the pixel's direction from
 * the hole on the screen and along the line from the hole to the camera; the plane is crossed where
 * cos(phi) ahead + sin(phi) across = 0, first in (0, pi]
 */
export function discCrossings (slope: number, u: number, across: number, ahead: number) {
  const ray = discRay(slope, u)
  let first = Math.atan2(ahead, -across)
  if (first <= 0) first += Math.PI
  const crossings: { radius: number, phi: number }[] = []
  for (let i = 0; i < DISC_CROSSINGS; i++) {
    const phi = first + i * Math.PI
    crossings.push({ radius: discRadius(ray, phi), phi })
  }
  return crossings
}

/**
 * The shift of light from matter on a circular orbit r Schwarzschild radii from the hole, received far away:
 * g = sqrt(1 - 1.5 / r) / (1 - Omega L), Omega = sqrt(0.5 / r^3) the orbit's rate as seen from afar and L the
 * photon's angular momentum about the orbit's axis, in units of its energy; above 1 bluer and brighter.
 * Inside DISC_CLOSEST_ORBIT the orbit is taken there
 */
export function discShift (r: number, angularMomentum: number) {
  const radius = Math.max(r, DISC_CLOSEST_ORBIT)
  return Math.sqrt(1 - 1.5 / radius) / (1 - Math.sqrt(0.5 / (radius * radius * radius)) * angularMomentum)
}
