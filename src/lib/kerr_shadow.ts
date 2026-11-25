// The outline of a spinning black hole's shadow, as the camera sees it. A hole that does not spin casts a
// round shadow; spin flattens the side that turns toward the camera and pushes the shadow toward the other
// one (the shape Bardeen worked out in 1973). The edge is worked out from the photon orbits by shadowCurve
// (kerr_trace.ts) and kept as its radius at every direction around the hole, in radii of the round shadow
// a hole of the same mass would cast from the same place, so Black Hole Size keeps its meaning: it is the
// mass, and spin changes the shape around it.
//
// The table is laid out in the hole's own angles: chi from the screen's right toward its up when the spin
// axis points up. On the screen it is turned by the axis angle. The composite shader reads it as a texture
// (unit 4) and draws the shadow and the photon ring along it; the particles are captured on the circle that
// fits it best; a caption that points at the shadow starts on it.
import { shadowAngle } from './lens_trace'
import { shadowCurve } from './kerr_trace'

export const SHADOW_SAMPLES = 128
// A camera this much nearer or farther redraws the outline: its shape changes slowly with the distance,
// and the opening's growing hole would otherwise redraw it every frame
const DISTANCE_STEP = 0.02

export interface ShadowShape {
  // Radius of the edge at chi = 2 pi k / SHADOW_SAMPLES, in round-shadow radii; all 1 for no spin
  table: Float32Array
  spin: number
  inclination: number
  u: number
  // The circle that fits the outline: its centre along the hole's right and up, and its radius, in
  // round-shadow radii
  centerRight: number
  centerUp: number
  radius: number
  // Counts the changes of the table, so the renderer uploads it only when it changed
  version: number
}

export function createShadowShape (): ShadowShape {
  return { table: new Float32Array(SHADOW_SAMPLES).fill(1), spin: 0, inclination: 0, u: 0, centerRight: 0, centerUp: 0, radius: 1, version: 0 }
}

const edge = new Float32Array(SHADOW_SAMPLES)

// Brings the outline up to date for this spin, inclination (radians between the spin axis and the camera)
// and camera (u = 1 / its distance in Schwarzschild radii). Returns whether it changed
export function updateShadowShape (shape: ShadowShape, spin: number, inclination: number, u: number) {
  if (spin <= 0) {
    if (shape.spin === 0) return false
    shape.table.fill(1)
    shape.spin = 0
    shape.centerRight = 0
    shape.centerUp = 0
    shape.radius = 1
    shape.version++
    return true
  }
  if (spin === shape.spin && inclination === shape.inclination && Math.abs(u - shape.u) <= DISTANCE_STEP * shape.u) return false
  shape.spin = spin
  shape.inclination = inclination
  shape.u = u
  shadowCurve(spin, inclination, u, SHADOW_SAMPLES, edge)
  const round = Math.tan(0.5 * shadowAngle(u))
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  for (let k = 0; k < SHADOW_SAMPLES; k++) {
    const radius = Math.tan(0.5 * edge[k]) / round
    shape.table[k] = radius
    const chi = 2 * Math.PI * k / SHADOW_SAMPLES
    const x = radius * Math.cos(chi)
    const y = radius * Math.sin(chi)
    if (x < left) left = x
    if (x > right) right = x
    if (y < bottom) bottom = y
    if (y > top) top = y
  }
  shape.centerRight = 0.5 * (left + right)
  shape.centerUp = 0.5 * (top + bottom)
  shape.radius = 0.25 * (right - left + top - bottom)
  shape.version++
  return true
}

// The edge's radius, in round-shadow radii, toward a direction on the screen: `angle` from the screen's
// right toward its up, with the spin axis turned `axis` from up toward the left
export function shadowScaleAt (shape: ShadowShape, angle: number, axis: number) {
  if (shape.spin === 0) return 1
  const turns = (angle - axis) / (2 * Math.PI)
  const at = (turns - Math.floor(turns)) * SHADOW_SAMPLES
  const k = Math.floor(at)
  const share = at - k
  return shape.table[k % SHADOW_SAMPLES] * (1 - share) + shape.table[(k + 1) % SHADOW_SAMPLES] * share
}
