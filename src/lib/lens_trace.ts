// The Ray Traced lens: the exact path of light past a black hole that does not spin (Schwarzschild). A ray
// keeps to the plane of the camera, the hole and its own direction, so all that bends it is its impact
// parameter b, and how far round the hole it travels is an elliptic integral, written here in Carlson's
// form R_F. The composite shader carries the same sweep in GLSL (traceSweep in webgl_shaders.ts) and runs it
// for every pixel; this copy runs on the main thread only to place the camera for an Einstein Radius.
//
// Lengths are in Schwarzschild radii and u is 1 / the camera's distance. The picture is a stereographic
// projection around the hole: a direction theta from the hole lies 2F tan(theta / 2) from it on the screen,
// which keeps stars round and puts every direction but the one straight behind the camera on the plane.

// Impact parameter of the photon sphere: a ray aimed closer falls in, and that is the shadow's edge
export const CRITICAL_IMPACT = Math.sqrt(27) / 2
// The nearest the camera may stand, outside the photon sphere at 1.5
export const CLOSEST_CAMERA = 2
const FARTHEST_CAMERA = 1e5

function carlsonRF (x: number, y: number, z: number) {
  for (let i = 0; i < 7; i++) {
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

// Radians a ray travels round the hole from the camera until it is off to infinity, for a ray that leaves the
// camera theta from the direction of the hole. Its orbit obeys (du/dphi)^2 = 1/b^2 - u^2 + u^3, whose roots
// u1 < 0 < u2 <= u3 are written so that none of them is the small difference of two large numbers; u2 is the
// closest the ray comes. A ray aimed at the hole closer than the photon sphere is taken just outside it: the
// shadow covers it
export function traceSweep (theta: number, u: number) {
  let b = Math.sin(theta) / (u * Math.sqrt(1 - u))
  const inward = theta < 0.5 * Math.PI
  if (inward) b = Math.max(b, CRITICAL_IMPACT * 1.00001)
  if (b > CRITICAL_IMPACT) {
    const angle = 2 * Math.asin(CRITICAL_IMPACT / b)
    const sixth = Math.sin(angle / 6)
    const u1 = -4 / 3 * Math.sin(Math.PI / 3 - angle / 6) * sixth
    const u2 = 4 / 3 * Math.sin(Math.PI / 3 + angle / 6) * sixth
    const gap = 2 / Math.sqrt(3) * Math.sin(Math.PI / 3 - angle / 3)
    const spread = u2 - u1
    const away = 2 * Math.sqrt(u2) * carlsonRF(-u1 * gap, spread * gap, (gap + u2) * spread)
    // How far the ray still has to fall, u2 - u, from the orbit's equation at the camera,
    // (u2 - u)(u - u1)(u3 - u) = u^2 (1 - u) cot^2 theta, rather than as a difference: a ray leaving square
    // to the hole is at its closest already, and in float32 on the GPU the difference is lost there
    const cotangent = Math.cos(theta) / Math.sin(theta)
    const left = u * u * (1 - u) * cotangent * cotangent / ((u - u1) * (u2 + gap - u))
    const near = 2 * Math.sqrt(left) * carlsonRF((u - u1) * gap, spread * gap, (gap + left) * spread)
    return away + (inward ? near : -near)
  }
  // Facing away from the hole with b below the photon sphere's: the ray only climbs out, and the integral is
  // smooth enough for four Gauss-Legendre points
  return 0.5 * u * (0.3478548451 * (climb(b, u * 0.0694318442) + climb(b, u * 0.9305681558)) +
    0.6521451549 * (climb(b, u * 0.3300094782) + climb(b, u * 0.6699905218)))
}

// dphi/du of a ray climbing out through 1 / v
function climb (b: number, v: number) {
  return b / Math.sqrt(1 - b * b * v * v * (1 - v))
}

// The shadow's angular radius seen from the camera
export function shadowAngle (u: number) {
  return Math.asin(CRITICAL_IMPACT * u * Math.sqrt(1 - u))
}

// The Einstein ring's angular radius: the inward ray that comes out straight behind the hole
function ringAngle (u: number) {
  let lo = shadowAngle(u)
  let hi = 0.5 * Math.PI
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi)
    if (traceSweep(mid, u) > Math.PI) lo = mid
    else hi = mid
  }
  return 0.5 * (lo + hi)
}

// The Einstein ring's radius on the screen in shadow radii, for a camera at 1 / u
export function ringRatio (u: number) {
  return Math.tan(0.5 * ringAngle(u)) / Math.tan(0.5 * shadowAngle(u))
}

// The Einstein ring in shadow radii for a camera at 1 / u, as ringRatio, worked out again only when u
// changes: a camera that stands still costs nothing
let ratioU = NaN
let ratioAtU = 1
export function einsteinRatioAt (u: number) {
  if (u !== ratioU) {
    ratioU = u
    ratioAtU = ringRatio(u)
  }
  return ratioAtU
}

// 1 / the distance the camera stands at for an Einstein ring of this many shadow radii. The ring grows as the
// camera backs away, so the distance is found by halving; below what the nearest camera sees it stays there.
// Worked out again only when the Einstein Radius changes
let lastRatio = NaN
let lastU = 1 / CLOSEST_CAMERA
export function cameraFor (einsteinRatio: number) {
  if (einsteinRatio === lastRatio) return lastU
  let near = Math.log(CLOSEST_CAMERA)
  let far = Math.log(FARTHEST_CAMERA)
  if (einsteinRatio <= ringRatio(1 / CLOSEST_CAMERA)) far = near
  for (let i = 0; i < 36 && far - near > 1e-6; i++) {
    const mid = 0.5 * (near + far)
    if (ringRatio(Math.exp(-mid)) < einsteinRatio) near = mid
    else far = mid
  }
  lastRatio = einsteinRatio
  lastU = Math.exp(-0.5 * (near + far))
  return lastU
}
