// The Ray Traced lens of a black hole that spins (Kerr): the exact path of light past it, the reference for
// the copy the composite shader runs for every pixel (KERR_GLSL in kerr_glsl.ts, the same steps line by line).
// Beside lens_trace.ts, which is the hole that does not spin: there a ray keeps to one plane and one integral
// gives its sweep; here the hole drags space round with it, the ray leaves its plane, and its path is three
// integrals, of which two are of the third kind (Carlson's R_J).
//
// Inside, lengths are in M (half a Schwarzschild radius) and the coordinates are Boyer-Lindquist's. A ray
// keeps two numbers for its whole path: lambda, its angular momentum about the spin axis, and eta, Carter's
// constant, both per unit of energy. They split the motion in two: R(r) = (r^2 + a^2 - a lambda)^2 -
// Delta (eta + (lambda - a)^2) carries the radius, Theta = eta + a^2 cos^2 - lambda^2 cot^2 the polar angle,
// and Mino time, the integral of dr / sqrt(R), ties them together.
//
// The camera is a locally non-rotating observer (ZAMO) at 1 / u Schwarzschild radii, `incl` from the spin
// axis. It looks at the hole: forward = -e_r, up = -e_theta (toward the north pole), right = e_phi. A pixel is
// (psi, chi): psi from forward, chi round forward from right toward up. A ray is followed backwards from the
// camera, and what comes back is the direction it came from at infinity, in that same basis.
//
// A ray that turns round outside the hole (R has four real roots, the outermost the turning point) is taken
// in closed form: the radius by Legendre's substitution on the roots, the polar angle by Jacobi's functions.
// A ray that only climbs out with no turning point (looking away from the hole, inside the mirror image of
// the shadow) is a short smooth path with no closed form worth its cases (the roots are complex there, and
// rays that never cross the equator live only there), so it is stepped: 24 Runge-Kutta steps of a point on
// the unit sphere, which has no trouble at the poles.

const PI = Math.PI
const HALF_PI = 0.5 * Math.PI
// Pi in two parts, the first exact in float32, so a whole number of half turns comes off an angle exactly
const PI_HIGH = 3.140625
const PI_LOW = 9.67653589793e-4
const SQRT3 = Math.sqrt(3)
// The camera never stands exactly on the spin axis, where its right and up have no meaning in these
// coordinates: this far off it nothing is seen of the difference
const SIN_FLOOR = 1e-5
// Nor does a ray pass exactly through the axis, where its turn round it would be 0 times infinity
const ELL_FLOOR = 1e-6
// Nor does it lie exactly in the equator's plane, where the polar swing has no amplitude to divide by
const ETA_FLOOR = 1e-14
// Nor does it lie exactly on the shadow's edge: the least third of the angle that parts the two outer roots
const EDGE_FLOOR = 1e-5
const CARLSON_STEPS = 7
const MEAN_STEPS = 4
const CLIMB_STEPS = 24

function carlsonRF (x: number, y: number, z: number) {
  for (let i = 0; i < CARLSON_STEPS; i++) {
    const sx = Math.sqrt(x)
    const sy = Math.sqrt(y)
    const sz = Math.sqrt(z)
    const l = sx * (sy + sz) + sy * sz
    x = 0.25 * (x + l)
    y = 0.25 * (y + l)
    z = 0.25 * (z + l)
  }
  const a = (x + y + z) / 3
  const dx = 1 - x / a
  const dy = 1 - y / a
  const dz = 1 - z / a
  const e2 = dx * dy - dz * dz
  const e3 = dx * dy * dz
  return (1 + (e2 / 24 - 0.1 - 3 * e3 / 44) * e2 + e3 / 14) / Math.sqrt(a)
}

// The arctangent of x >= 0, to the last digits of a float. The GPU's own is a short polynomial, good to four
// digits, and the roots of R are built on this angle; so the argument is halved twice and a series does the rest
function kerrAtan (x: number) {
  const flip = x > 1
  let t = flip ? 1 / x : x
  t = t / (1 + Math.sqrt(1 + t * t))
  t = t / (1 + Math.sqrt(1 + t * t))
  const t2 = t * t
  const angle = 4 * t * (1 + t2 * (-1 / 3 + t2 * (0.2 + t2 * (-1 / 7 + t2 * (1 / 9 + t2 * (-1 / 11 + t2 / 13))))))
  return flip ? HALF_PI - angle : angle
}

// Sine and cosine for an angle within a quarter turn of 0, by their series, for the same reason
function kerrSin (x: number) {
  const x2 = x * x
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156 * (1 - x2 / 210)))))))
}

function kerrCos (x: number) {
  const x2 = x * x
  return 1 - x2 / 2 * (1 - x2 / 12 * (1 - x2 / 30 * (1 - x2 / 56 * (1 - x2 / 90 * (1 - x2 / 132 * (1 - x2 / 182 * (1 - x2 / 240)))))))
}

// Carlson's R_C(1, 1 + e): arctan(sqrt e) / sqrt e, which for e < 0 is the same with the hyperbolic arctangent
function kerrArc (e: number) {
  if (Math.abs(e) < 0.06) return 1 + e * (-1 / 3 + e * (0.2 + e * (-1 / 7 + e * (1 / 9 + e * (-1 / 11 + e / 13)))))
  if (e > 0) {
    const s = Math.sqrt(e)
    return kerrAtan(s) / s
  }
  const s = Math.sqrt(-e)
  return 0.5 * Math.log((1 + s) / Math.max(1 - s, 1e-30)) / s
}

// The end of Carlson's R_J once its arguments have been drawn together: the series round their mean
function kerrTail (x: number, y: number, z: number, p: number, scale: number) {
  const mean = (x + y + z + 2 * p) / 5
  const dx = 1 - x / mean
  const dy = 1 - y / mean
  const dz = 1 - z / mean
  const dp = -0.5 * (dx + dy + dz)
  const e2 = dx * dy + dx * dz + dy * dz - 3 * dp * dp
  const xyz = dx * dy * dz
  const e3 = xyz + 2 * e2 * dp + 4 * dp * dp * dp
  const e4 = (2 * xyz + e2 * dp + 3 * dp * dp * dp) * dp
  const e5 = xyz * dp * dp
  return scale * (1 - 3 * e2 / 14 + e3 / 6 + 9 * e2 * e2 / 88 - 3 * e4 / 22 - 9 * e2 * e3 / 52 + 3 * e5 / 26) / (mean * Math.sqrt(mean))
}

// Carlson's R_F(x, y, z) with R_J(x, y, z, p) and R_J(x, y, z, q) from one run of the duplication, which
// they share: the integrals of the first and the third kind. Left in carlF, carlJ1 and carlJ2
let carlF = 0
let carlJ1 = 0
let carlJ2 = 0
function kerrCarlson (x: number, y: number, z: number, p: number, q: number) {
  const deltaP = (p - x) * (p - y) * (p - z)
  const deltaQ = (q - x) * (q - y) * (q - z)
  let scale = 1
  let sumP = 0
  let sumQ = 0
  for (let i = 0; i < CARLSON_STEPS; i++) {
    const sx = Math.sqrt(x)
    const sy = Math.sqrt(y)
    const sz = Math.sqrt(z)
    const sp = Math.sqrt(p)
    const sq = Math.sqrt(q)
    const l = sx * (sy + sz) + sy * sz
    const dP = (sp + sx) * (sp + sy) * (sp + sz)
    const dQ = (sq + sx) * (sq + sy) * (sq + sz)
    const cube = scale * scale * scale
    sumP += scale * kerrArc(cube * deltaP / (dP * dP)) / dP
    sumQ += scale * kerrArc(cube * deltaQ / (dQ * dQ)) / dQ
    x = 0.25 * (x + l)
    y = 0.25 * (y + l)
    z = 0.25 * (z + l)
    p = 0.25 * (p + l)
    q = 0.25 * (q + l)
    scale *= 0.25
  }
  const a = (x + y + z) / 3
  const dx = 1 - x / a
  const dy = 1 - y / a
  const dz = 1 - z / a
  const e2 = dx * dy - dz * dz
  const e3 = dx * dy * dz
  carlF = (1 + (e2 / 24 - 0.1 - 3 * e3 / 44) * e2 + e3 / 14) / Math.sqrt(a)
  carlJ1 = kerrTail(x, y, z, p, scale) + 6 * sumP
  carlJ2 = kerrTail(x, y, z, q, scale) + 6 * sumQ
}

// Jacobi's sn and cn for the parameter whose complement kerrMeans was given, by the descending chain of
// arithmetic and geometric means (Numerical Recipes' sncndn with a fixed count: the parameter of a ray that
// turns round the hole is below 0.05, and four steps are exact for it). The quarter period is PI / (2 meanEnd)
const meanA = new Float64Array(MEAN_STEPS)
const meanB = new Float64Array(MEAN_STEPS)
let meanEnd = 1
function kerrMeans (complement: number) {
  let a = 1
  let c = 1
  for (let i = 0; i < MEAN_STEPS; i++) {
    meanA[i] = a
    complement = Math.sqrt(complement)
    meanB[i] = complement
    c = 0.5 * (a + complement)
    complement *= a
    a = c
  }
  meanEnd = c
}

// For an argument within a quarter period of 0, so the angle below is within a quarter turn. Left in
// jacobiSn and jacobiCn
let jacobiSn = 0
let jacobiCn = 1
function kerrJacobi (t: number) {
  const angle = meanEnd * t
  const sine = kerrSin(angle)
  const side = sine < 0 ? -1 : 1
  let a = kerrCos(angle) / (side * Math.max(Math.abs(sine), 1e-15))
  let c = meanEnd * a
  let dn = 1
  for (let i = MEAN_STEPS - 1; i >= 0; i--) {
    const b = meanA[i]
    a *= c
    c *= dn
    dn = (meanB[i] + a) / (b + a)
    a = c / b
  }
  jacobiSn = side / Math.sqrt(c * c + 1)
  jacobiCn = c * jacobiSn
}

// How fast a ray with no turning point climbs: the rates of change of the point of the unit sphere it is
// over (n), that point's velocity in Mino time (w) and the turn the spinning hole has dragged it through,
// all per step of s, where 1 / r = reach (1 - s^2) runs from the camera to infinity: the square puts the
// short steps at the camera, next to which the path is bent most (the photon orbits lie just inside the
// nearest camera, and against 24 even steps this is 30 times closer to the truth there). On the sphere the point
// moves as a free one would (speed^2 = eta + lambda^2 + a^2 n_z^2) with a pull toward the poles, a^2 n_z
// across the meridian; nothing in it is singular at a pole, as theta and phi would be. Reads climbState,
// writes climbRate
const climbState = new Float64Array(7)
const climbTrial = new Float64Array(7)
const climbRate = new Float64Array(7)
const climbSum = new Float64Array(7)
let climbReach = 0
let climbSquare = 0
let climbCube = 0
let climbFourth = 0
let climbTotal = 0
let climbSpin = 0
let climbLambda = 0
function kerrClimb (s: number, y: Float64Array) {
  const v = climbReach * (1 - s * s)
  const pace = 2 * s * climbReach / Math.sqrt(Math.max(1 + v * v * (climbSquare + v * (climbCube + v * climbFourth)), 1e-9))
  const a2 = climbSpin * climbSpin
  const speed2 = climbTotal + a2 * y[2] * y[2]
  const pull = a2 * y[2]
  climbRate[0] = pace * y[3]
  climbRate[1] = pace * y[4]
  climbRate[2] = pace * y[5]
  climbRate[3] = pace * (-speed2 * y[0] - pull * y[2] * y[0])
  climbRate[4] = pace * (-speed2 * y[1] - pull * y[2] * y[1])
  climbRate[5] = pace * (-speed2 * y[2] + pull * (1 - y[2] * y[2]))
  climbRate[6] = -pace * climbSpin * v * (2 - climbSpin * climbLambda * v) / (1 - 2 * v + a2 * v * v)
}

// The direction a ray came from, for the pixel (psi, chi) of a camera `incl` from the spin axis of a hole of
// this spin (a / M, 0 to 0.998), 1 / u Schwarzschild radii from it: `out` gets its three parts along the
// camera's right, up and forward. False for a ray that came out of the hole
export function kerrRay (psi: number, chi: number, spin: number, incl: number, u: number, out: Float64Array | number[]) {
  return kerrRayFrom(Math.sin(psi), Math.cos(psi), Math.sin(chi), Math.cos(chi), spin, Math.cos(incl), Math.sin(incl), u, out)
}

// The same from the sines and cosines, which is what a pixel has at hand
export function kerrRayFrom (
  sinPsi: number, cosPsi: number, sinChi: number, cosChi: number,
  spin: number, cosIncl: number, sinIncl: number, u: number, out: Float64Array | number[]
) {
  const a = spin
  const a2 = a * a
  const ci = cosIncl
  const si = Math.max(sinIncl, SIN_FLOOR)
  const rr = 2 / u
  // The camera's frame: Sigma, Delta, A of the metric and the rate omega at which space turns there
  const sigma = rr * rr + a2 * ci * ci
  const delta = rr * rr - 2 * rr + a2
  const big = (rr * rr + a2) * (rr * rr + a2) - a2 * delta * si * si
  const omega = 2 * a * rr / big
  // lambda / sin(incl), which stays finite on the axis where lambda is 0
  const side = -sinPsi * cosChi * big / (sigma * Math.sqrt(delta))
  let ell = side / (1 + omega * si * side)
  if (Math.abs(ell) < ELL_FLOOR) ell = ell < 0 ? -ELL_FLOOR : ELL_FLOOR
  const lambda = si * ell
  // The ray's energy at the camera over its energy at infinity is boost / lapse; p_theta and R at the
  // camera follow from the part of the ray's direction along up and along forward. R at the camera is
  // kept in this form, a square, and never worked out again from lambda and eta
  const boost = 1 - omega * lambda
  const polar = boost * Math.sqrt(big / delta) * sinPsi * sinChi
  const radial = boost * boost * big * cosPsi * cosPsi
  const eta = polar * polar + ci * ci * (ell * ell - a2)

  // R(r) = r^4 + square r^2 + cube r + fourth
  const square = a2 - lambda * lambda - eta
  const cube = 2 * (eta + (lambda - a) * (lambda - a))
  const fourth = -a2 * eta
  // Its roots by Euler: r = (+-sqrt z1 +- sqrt z2 +- sqrt z3) / 2 for the roots z of the cubic
  // z^3 + 2 square z^2 + (square^2 - 4 fourth) z - cube^2. Lengths are scaled so the numbers stay near 1
  // (b^12 would not fit a float32), and the cubic's discriminant is written out as a polynomial, where its
  // leading terms cancel on paper rather than in the arithmetic. Near the shadow's edge it is still the
  // small difference it has to be: it is zero on the edge
  const size2 = Math.abs(eta) + lambda * lambda + a2 + 1e-12
  const size = Math.sqrt(size2)
  const sq = square / size2
  const cu = cube / (size2 * size)
  const fo = fourth / (size2 * size2)
  const rho2 = sq * sq / 9 + 4 * fo / 3
  const inner = sq * sq - 4 * fo
  const discriminant = (4 * fo * inner * inner - sq * sq * sq * cu * cu + 36 * sq * fo * cu * cu) / 27 - 0.25 * cu * cu * cu * cu
  const along = sq * sq * sq / 27 - 4 * sq * fo / 3 + 0.5 * cu * cu
  const horizon = 1 + Math.sqrt(1 - a2)
  let turns = rho2 > 0 && discriminant >= 0
  let z1 = 0
  let z2 = 0
  let third = 0
  let rest = 0
  let rho = 0
  if (turns) {
    // The cubic's angle, a third of which places its roots, and what it lacks to half a turn. Both are
    // wanted near 0: `third` is the gap between the two outer roots of R, which closes at the shadow's edge,
    // `rest` the gap between the two inner ones, which closes far from the hole
    const angle = kerrAtan(Math.sqrt(discriminant) / Math.max(Math.abs(along), 1e-30))
    // On the edge itself the two outer roots are one and the integrals below run off to infinity; a ray is
    // never taken closer to it than this. A ray facing away from the hole that is this close to the mirror
    // image of the edge has nothing to gain from the roots and is stepped instead
    const open = (along > 0 ? angle : PI - angle) / 3
    third = Math.max(open, EDGE_FLOOR)
    rest = (along > 0 ? PI - angle : angle) / 3
    rho = Math.sqrt(rho2)
    z1 = -2 * sq / 3 + 2 * rho * kerrCos(third)
    z2 = -2 * sq / 3 + 2 * rho * kerrSin(PI / 6 - rest)
    turns = z1 > 0 && z2 > 0 && (cosPsi > 0 || open > EDGE_FLOOR)
  }
  let r4 = 0
  let r43 = 0
  let q1 = 0
  let q2 = 0
  let q3 = 0
  if (turns) {
    // The smallest z from the product of the three, cube^2, and every difference of two roots of R as a
    // product of sines: none is the small difference of two large numbers
    const z3 = cu * cu / (z1 * z2)
    q1 = Math.sqrt(z1)
    q2 = Math.sqrt(z2)
    q3 = Math.sqrt(z3)
    r43 = size * 2 * SQRT3 * rho * kerrSin(third) / (q2 + q3)
    r4 = 0.5 * (size * q1 + r43)
    turns = r4 > horizon
  }

  let nx = 0
  let ny = 0
  let nz = 0
  let turn = 0
  if (turns) {
    const r32 = size * 2 * SQRT3 * rho * kerrSin(rest) / (q1 + q2)
    const r42 = size * 2 * SQRT3 * rho * kerrCos(PI / 6 - third) / (q1 + q3)
    q1 *= size
    q2 *= size
    q3 *= size
    const r41 = q1 + q2
    const r31 = q1 + q3
    // The camera's distance from each root. From the turning point it is R at the camera over the other
    // three, not a difference: a ray leaving square to the hole is at its turning point already
    const d1 = rr + 0.5 * (q1 + q2 + q3)
    const d2 = rr + 0.5 * (r32 - q3)
    const d3 = rr - 0.5 * (r32 + q3)
    const d4 = radial / (d1 * d2 * d3)
    const inner4 = r4 - a2 / horizon
    const outer4 = r4 - horizon
    // Legendre's x^2 = (r - r4) r31 / ((r - r3) r41) makes of the integrals over r the standard three. At
    // infinity and at the camera 1 - x^2, 1 - k x^2 and 1 - n x^2 are each a product with r43 in it
    const xFar = Math.sqrt(r31 / r41)
    kerrCarlson(r43 / r41, r43 / r42, 1, r43 / outer4, r43 / inner4)
    let first = xFar * carlF
    let thirdOuter = xFar * xFar * xFar * carlJ1 / 3
    let thirdInner = xFar * xFar * xFar * carlJ2 / 3
    const xNear = Math.sqrt(d4 * r31 / (d3 * r41))
    kerrCarlson(r43 * d1 / (d3 * r41), r43 * d2 / (d3 * r42), 1, r43 * (rr - horizon) / (outer4 * d3), r43 * (rr - a2 / horizon) / (inner4 * d3))
    // A ray that leaves the camera toward the hole goes down to the turning point and out; one that leaves
    // away from it has that first stretch behind it
    const inward = cosPsi > 0 ? 1 : -1
    first += inward * xNear * carlF
    thirdOuter += inward * xNear * xNear * xNear * carlJ1 / 3
    thirdInner += inward * xNear * xNear * xNear * carlJ2 / 3
    const front = 2 / Math.sqrt(r31 * r42)
    // Mino time of the whole path, and the integrals of 1 / (r - horizon) over it for the outer and the
    // inner horizon, each as 1 / (r4 - horizon) less a term that is 0 at the turning point; the turn the
    // hole drags the ray through is their sum in partial fractions
    const mino = front * first
    const outerSweep = (mino - r41 * r43 / (r31 * outer4) * front * thirdOuter) / outer4
    const innerSweep = (mino - r41 * r43 / (r31 * inner4) * front * thirdInner) / inner4
    const drag = a * ((2 * horizon - a * lambda) * outerSweep - (2 * a2 / horizon - a * lambda) * innerSweep) / (2 * Math.sqrt(1 - a2))

    // The polar angle swings between +-acos(sqrt(top)): cos(theta) = sqrt(top) cos(phase), and the phase
    // is Jacobi's amplitude of Mino time. `low` is sin^2 at the swing's ends, from the quadratic for sin^2
    // so that it keeps its digits when the ray passes by a pole
    const etaUp = Math.max(eta, ETA_FLOOR)
    const total = etaUp + a2 + lambda * lambda
    const root = Math.sqrt((etaUp + a2 - lambda * lambda) * (etaUp + a2 - lambda * lambda) + 4 * etaUp * lambda * lambda)
    const rate2 = 0.5 * (total - 2 * a2 + root)
    const top = etaUp / rate2
    const low = 2 * lambda * lambda / (total + root)
    const parameter = a2 * top / (a2 * top + rate2)
    const squeeze = a2 * top / rate2
    // The phase at the camera: its sine from Theta there, which is p_theta^2, and its cosine from the
    // camera's latitude; whichever is the smaller is the one that is trusted
    const sin2 = Math.min(polar * polar * si * si * rate2 / ((a2 * ci * ci + rate2) * etaUp), 1)
    let sinStart = Math.sqrt(sin2)
    let cosStart = (ci < 0 ? -1 : 1) * Math.sqrt(1 - sin2)
    if (sin2 > 0.5) {
      cosStart = Math.max(-1, Math.min(1, ci / Math.sqrt(top)))
      sinStart = Math.sqrt(1 - cosStart * cosStart)
    }
    kerrMeans(1 - parameter)
    const quarter = HALF_PI / meanEnd
    kerrCarlson(sinStart * sinStart, 1 + squeeze * cosStart * cosStart, 1, low + top * sinStart * sinStart, 1)
    const firstStart = sinStart * carlsonRF(cosStart * cosStart, 1 - parameter * sinStart * sinStart, 1)
    const sweepStart = -cosStart * (carlF + top * cosStart * cosStart * carlJ1 / 3)
    // Followed backwards, a ray seen above the hole's centre came down from the north
    const way = sinChi > 0 ? -1 : 1
    const ending = (cosStart >= 0 ? firstStart : 2 * quarter - firstStart) + way * Math.sqrt(a2 * top + rate2) * mino
    const halves = Math.floor(0.5 * ending / quarter + 0.5)
    kerrJacobi(ending - 2 * quarter * halves)
    const odd = halves - 2 * Math.floor(0.5 * halves) > 0.5 ? -1 : 1
    const sn = jacobiSn
    const cn = jacobiCn
    // The integral of 1 / sin^2(theta) over the path, Legendre's third kind measured from the equator, with
    // the whole swings between the two ends counted in
    kerrCarlson(sn * sn, 1 + squeeze * cn * cn, 1, low + top * sn * sn, 1)
    let sweepEnd = -(sn < 0 ? -1 : 1) * cn * (carlF + top * cn * cn * carlJ1 / 3)
    const swings = sn < 0 ? halves - 1 : halves
    if (swings !== 0) {
      kerrCarlson(0, 1 + squeeze, 1, low, 1)
      sweepEnd += 2 * swings * (carlF + top * carlJ1 / 3)
    }
    turn = -(drag + lambda * way * (sweepEnd - sweepStart) / Math.sqrt(rate2))
    nz = Math.sqrt(top) * odd * cn
    nx = Math.sqrt(low + top * sn * sn)
    ny = 0
  } else {
    // No turning point: a ray toward the hole came out of it, a ray away from it is stepped out to infinity
    if (cosPsi > 0) return false
    climbReach = 0.5 * u
    climbSquare = square
    climbCube = cube
    climbFourth = fourth
    climbTotal = eta + lambda * lambda
    climbSpin = a
    climbLambda = lambda
    climbState[0] = si
    climbState[1] = 0
    climbState[2] = ci
    climbState[3] = -polar * ci
    climbState[4] = -ell
    climbState[5] = polar * si
    climbState[6] = 0
    const h = 1 / CLIMB_STEPS
    for (let i = 0; i < CLIMB_STEPS; i++) {
      const s = i * h
      kerrClimb(s, climbState)
      for (let j = 0; j < 7; j++) {
        climbSum[j] = climbRate[j]
        climbTrial[j] = climbState[j] + 0.5 * h * climbRate[j]
      }
      kerrClimb(s + 0.5 * h, climbTrial)
      for (let j = 0; j < 7; j++) {
        climbSum[j] += 2 * climbRate[j]
        climbTrial[j] = climbState[j] + 0.5 * h * climbRate[j]
      }
      kerrClimb(s + 0.5 * h, climbTrial)
      for (let j = 0; j < 7; j++) {
        climbSum[j] += 2 * climbRate[j]
        climbTrial[j] = climbState[j] + h * climbRate[j]
      }
      kerrClimb(s + h, climbTrial)
      for (let j = 0; j < 7; j++) climbState[j] += h / 6 * (climbSum[j] + climbRate[j])
    }
    const length = Math.sqrt(climbState[0] * climbState[0] + climbState[1] * climbState[1] + climbState[2] * climbState[2])
    nx = climbState[0] / length
    ny = climbState[1] / length
    nz = climbState[2] / length
    turn = climbState[6]
  }

  // Turned round the spin axis by the angle the ray swept, then read along the camera's own axes
  const halfTurns = Math.floor(turn / PI + 0.5)
  const within = turn - halfTurns * PI_HIGH - halfTurns * PI_LOW
  const flip = halfTurns - 2 * Math.floor(0.5 * halfTurns) > 0.5 ? -1 : 1
  const sinTurn = flip * kerrSin(within)
  const cosTurn = flip * kerrCos(within)
  const dx = nx * cosTurn - ny * sinTurn
  const dy = nx * sinTurn + ny * cosTurn
  out[0] = dy
  out[1] = si * nz - ci * dx
  out[2] = -(si * dx + ci * nz)
  return true
}

// The two numbers a ray circling the hole at radius r keeps, the spherical photon orbits: every ray on the
// shadow's edge winds onto one of them. Left in edgeLambda and edgeEta
let edgeLambda = 0
let edgeEta = 0
function photonOrbit (r: number, a: number) {
  edgeLambda = -(r * r * r - 3 * r * r + a * a * r + a * a) / (a * (r - 1))
  edgeEta = -r * r * r * (r * r * r - 6 * r * r + 9 * r - 4 * a * a) / (a * a * (r - 1) * (r - 1))
}

// The shadow's edge as this camera sees it: the angle from forward to the edge, written into `out` for
// `chiSamples` directions round forward, chi = 2 PI k / chiSamples. The rays of the edge are those that wind
// onto a photon orbit, between the one that turns with the hole (closest in) and the one against it; each
// orbit's lambda and eta, put through the camera's frame backwards, is a point of the edge, and the points are
// found again at the even steps of chi by halving. The edge is the same above and below the equator's line.
// 128 directions take about 0.1 ms
export function shadowCurve (spin: number, incl: number, u: number, chiSamples: number, out: Float32Array) {
  const rr = 2 / u
  if (spin < 1e-6) {
    const edge = Math.asin(Math.min(1, Math.sqrt(27 * (1 - 2 / rr)) / rr))
    for (let k = 0; k < chiSamples; k++) out[k] = edge
    return
  }
  const a = spin
  const a2 = a * a
  const ci = Math.cos(incl)
  const si = Math.max(Math.sin(incl), SIN_FLOOR)
  const sigma = rr * rr + a2 * ci * ci
  const delta = rr * rr - 2 * rr + a2
  const big = (rr * rr + a2) * (rr * rr + a2) - a2 * delta * si * si
  const omega = 2 * a * rr / big
  const cot2 = ci * ci / (si * si)
  // The orbits this camera can see are those whose rays reach its latitude: Theta >= 0 there. They lie
  // between two radii either side of the orbit that passes over the poles (lambda = 0)
  let near = 2 * (1 + Math.cos(2 / 3 * Math.acos(-a)))
  let far = 2 * (1 + Math.cos(2 / 3 * Math.acos(a)))
  let lo = near
  let hi = far
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    photonOrbit(mid, a)
    if (edgeLambda > 0) lo = mid
    else hi = mid
  }
  const over = 0.5 * (lo + hi)
  lo = near
  hi = over
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    photonOrbit(mid, a)
    if (edgeEta + a2 * ci * ci - edgeLambda * edgeLambda * cot2 < 0) lo = mid
    else hi = mid
  }
  near = hi
  lo = over
  hi = far
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    photonOrbit(mid, a)
    if (edgeEta + a2 * ci * ci - edgeLambda * edgeLambda * cot2 < 0) hi = mid
    else lo = mid
  }
  far = lo
  const half = Math.floor(chiSamples / 2)
  for (let k = 0; k <= half; k++) {
    const chi = 2 * PI * k / chiSamples
    // The orbit whose point of the edge lies at this chi. The radius runs along a cosine, which spreads the
    // points evenly where the edge meets the equator's line
    let from = 0
    let to = PI
    let across = 0
    let up = 0
    for (let i = 0; i < 28; i++) {
      const mid = 0.5 * (from + to)
      photonOrbit(far - 0.5 * (far - near) * (1 - Math.cos(mid)), a)
      const boost = 1 - omega * edgeLambda
      across = -edgeLambda * sigma * Math.sqrt(delta) / (si * big * boost)
      up = Math.sqrt(Math.max(edgeEta + a2 * ci * ci - edgeLambda * edgeLambda * cot2, 0) * delta / big) / boost
      if (Math.atan2(up, across) < chi) from = mid
      else to = mid
    }
    const edge = Math.asin(Math.min(1, Math.sqrt(across * across + up * up)))
    out[k] = edge
    if (k > 0 && k < chiSamples - k) out[chiSamples - k] = edge
  }
}
