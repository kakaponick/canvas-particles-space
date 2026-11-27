// The flash of Light Front (gridFront) on the space sheet, as light from a flash runs near a Schwarzschild
// hole. For light a static hole is a medium: in isotropic coordinates space is conformally flat, light keeps
// to Fermat's principle with the index n(ρ) = (1 + rs / 4ρ)³ / (1 - rs / 4ρ), and the coordinate time it
// takes is its optical path, t = ∫ n dl. Far from the hole n is 1 and a run of L radii is L radii. The
// sheet's plane round the main hole is that isotropic plane, scaled by the shadow: the critical impact
// parameter, 3√3 / 2 rs, is the shadow's radius, the throat, so rs is 2 / (3√3) throat radii and the
// horizon stands at rs / 4. The time T at which the flash's first light reaches a place solves the eikonal
// equation |∇T| = n with T = 0 at the flash; this module solves it by fast marching, once each time the
// flash's distance from the hole changes, never per frame. Its first light bends round the hole, lags by the
// Shapiro delay along rays that pass near it and closes behind it from both sides, meeting on the line from
// the flash through the hole with a cusp, the start of the Einstein ring's caustic.
//
// The field depends on the flash's distance alone and turns with its direction, so it is solved in the
// hole's frame with the flash on the first axis, on a polar grid mirrored across that axis: angles from the
// flash's side, 0 to π, and radii evenly spaced in their logarithm, closest where the light bends. In
// (u = ln ρ, θ) the plane's metric is ρ² (du² + dθ²), conformal, so the equation stays isotropic there,
// T_u² + T_θ² = (ρ n)², and the march is the plain one on an even grid, second order where two known nodes
// stand in a row (Sethian 1999). The nodes round the flash are set by the straight way, along which the index
// is averaged. scripts/light_front_check.mjs checks the field against rays traced through the medium.
// What it hands the renderer is the delay, T less the straight distance, in throat radii: small and smooth,
// so a half float holds it and linear filtering reads it between the nodes; the grid vertex shader adds the
// straight distance back, worked out exactly.

// The field's nodes: angles from the flash's side over 0..π, and radii out from the innermost one. What the
// time of a solve holds them to (light_front_check.mjs prints both)
export const FRONT_FIELD_ANGLES = 112
export const FRONT_FIELD_RADII = 192

// The Schwarzschild radius in throat radii, and the horizon's isotropic radius
export const FRONT_RS = 2 / (3 * Math.sqrt(3))
const HORIZON = FRONT_RS / 4

// The innermost radius solved, in throat radii: inside the photon sphere (rs (2 + √3) / 4, 0.359), where no
// ray from outside turns back out, so nothing of the sheet is reached through what lies within
const FIELD_FLOOR = 0.3

// The radius the flash's nodes are set within by the straight way, in nodes' spacings: far enough out for the
// march's second-order steps to start from the cone's own shape, near enough that the light's bend there
// is far below the band's width
const SOURCE_NODES = 4

// A delay for a place no light reaches, which a half float still holds
export const FRONT_UNREACHED = 10000

// The index of the hole's medium at an isotropic radius, in throat radii
export function frontIndex (rho: number): number {
  const q = HORIZON / rho
  return (1 + q) * (1 + q) * (1 + q) / (1 - q)
}

export interface FrontField {
  // The delay at each node, the arrival time less the straight distance from the flash, in throat radii:
  // FRONT_FIELD_RADII a row, one row an angle, from the flash's side (0) to the far side (π)
  readonly delay: Float32Array
  // ln of the innermost and outermost radius solved, in throat radii
  inner: number
  outer: number
  // The flash's distance from the hole the field was solved for, in throat radii; 0 while none is solved
  flash: number
  // Solves the field for a flash `flash` throat radii from the hole, out to `reach` and in to `floor` (a
  // star's surface, which takes the light that meets it; the photon sphere's floor at least). False, with no
  // field, when the flash is not outside the floor
  solve: (flash: number, reach: number, floor: number) => boolean
  // The arrival time at a place of the plane given from the hole, in throat radii, the flash on the first
  // axis, read between the nodes as the shader reads it: for checks
  arrival: (x: number, y: number) => number
}

// A field of the size the renderer uploads; a check may ask for another
export function createFrontField (radii = FRONT_FIELD_RADII, angles = FRONT_FIELD_ANGLES): FrontField {
  const count = radii * angles
  const delay = new Float32Array(count)
  // The march's own: arrival times and each node's state (0 far, 1 trial, 2 known); a heap of the trial
  // nodes by time, and where each sits in it
  const time = new Float64Array(count)
  const state = new Uint8Array(count)
  const heap = new Int32Array(count)
  const place = new Int32Array(count)
  let heapSize = 0
  // Per radius: the radius and ρ n there; per angle: its cosine and sine
  const radius = new Float64Array(radii)
  const slowness = new Float64Array(radii)
  const cosine = new Float64Array(angles)
  const sine = new Float64Array(angles)
  const angleStep = Math.PI / (angles - 1)
  for (let j = 0; j < angles; j++) {
    cosine[j] = Math.cos(j * angleStep)
    sine[j] = Math.sin(j * angleStep)
  }
  let logStep = 1
  // One axis's contribution to an update: the neighbour's time as the derivative sees it and the step it is
  // taken over (a second-order derivative (3T - 4T1 + T2) / 2h is a first-order one toward (4T1 - T2) / 3
  // over 2h / 3); a time of Infinity is no known neighbour that way
  let reachU = 0
  let stepU = 0
  let reachT = 0
  let stepT = 0

  function rise (at: number) {
    const node = heap[at]
    const key = time[node]
    while (at > 0) {
      const up = (at - 1) >> 1
      const above = heap[up]
      if (time[above] <= key) break
      heap[at] = above
      place[above] = at
      at = up
    }
    heap[at] = node
    place[node] = at
  }

  function take (): number {
    const top = heap[0]
    heapSize--
    if (heapSize > 0) {
      const node = heap[heapSize]
      const key = time[node]
      let at = 0
      for (;;) {
        let child = 2 * at + 1
        if (child >= heapSize) break
        if (child + 1 < heapSize && time[heap[child + 1]] < time[heap[child]]) child++
        if (time[heap[child]] >= key) break
        heap[at] = heap[child]
        place[heap[at]] = at
        at = child
      }
      heap[at] = node
      place[node] = at
    }
    place[top] = -1
    return top
  }

  // A row of nodes along one axis from the node: the nearer and the farther, -1 where there is none or it is
  // not known. The angles are mirrored at 0 and π, so a node past either is the one as far inside
  function mirrored (j: number): number {
    if (j < 0) return -j
    if (j > angles - 1) return 2 * (angles - 1) - j
    return j
  }

  // The best known neighbour along u from node (i, j): its time as the derivative takes it, and the step
  function alongU (i: number, j: number) {
    reachU = Infinity
    stepU = logStep
    const row = j * radii
    for (let side = -1; side <= 1; side += 2) {
      const one = i + side
      if (one < 0 || one > radii - 1 || state[row + one] !== 2) continue
      const t1 = time[row + one]
      const two = i + 2 * side
      let value = t1
      let step = logStep
      if (two >= 0 && two <= radii - 1 && state[row + two] === 2 && time[row + two] <= t1) {
        value = (4 * t1 - time[row + two]) / 3
        step = logStep * 2 / 3
      }
      // The nearer arrival is the upwind one; between equals the second-order one
      if (t1 < reachU || (t1 === reachU && step < stepU)) {
        reachU = value
        stepU = step
      }
    }
  }

  function alongT (i: number, j: number) {
    reachT = Infinity
    stepT = angleStep
    for (let side = -1; side <= 1; side += 2) {
      const one = mirrored(j + side) * radii + i
      if (state[one] !== 2) continue
      const t1 = time[one]
      const two = mirrored(j + 2 * side) * radii + i
      let value = t1
      let step = angleStep
      if (state[two] === 2 && time[two] <= t1) {
        value = (4 * t1 - time[two]) / 3
        step = angleStep * 2 / 3
      }
      if (t1 < reachT || (t1 === reachT && step < stepT)) {
        reachT = value
        stepT = step
      }
    }
  }

  // The arrival time at node (i, j) from its known neighbours: ((T - a) / h)² + ((T - b) / k)² = m² with
  // both axes when the root comes after both, else the one axis that gives the earlier time
  function update (i: number, j: number) {
    const node = j * radii + i
    const m = slowness[i]
    alongU(i, j)
    alongT(i, j)
    let arrival = Infinity
    if (reachU < Infinity && reachT < Infinity) {
      const wu = 1 / (stepU * stepU)
      const wt = 1 / (stepT * stepT)
      const a = wu + wt
      const b = reachU * wu + reachT * wt
      const c = reachU * reachU * wu + reachT * reachT * wt - m * m
      const square = b * b - a * c
      if (square >= 0) {
        const both = (b + Math.sqrt(square)) / a
        if (both >= reachU && both >= reachT) arrival = both
      }
    }
    if (arrival === Infinity) arrival = Math.min(reachU + m * stepU, reachT + m * stepT)
    if (!(arrival < time[node])) return
    time[node] = arrival
    if (state[node] === 0) {
      state[node] = 1
      heap[heapSize] = node
      heapSize++
      rise(heapSize - 1)
    } else {
      rise(place[node])
    }
  }

  function settle (node: number) {
    state[node] = 2
    const i = node % radii
    const j = (node - i) / radii
    if (i > 0 && state[node - 1] !== 2) update(i - 1, j)
    if (i < radii - 1 && state[node + 1] !== 2) update(i + 1, j)
    if (j > 0 && state[node - radii] !== 2) update(i, j - 1)
    if (j < angles - 1 && state[node + radii] !== 2) update(i, j + 1)
  }

  const field: FrontField = {
    delay,
    inner: 0,
    outer: 1,
    flash: 0,
    solve (flash, reach, floor) {
      const innermost = Math.max(floor, FIELD_FLOOR)
      field.flash = 0
      if (!(flash > innermost * 1.05)) return false
      const inner = Math.log(innermost)
      const outer = Math.log(Math.max(reach, flash * 1.25, innermost * 2))
      logStep = (outer - inner) / (radii - 1)
      for (let i = 0; i < radii; i++) {
        const rho = Math.exp(inner + i * logStep)
        radius[i] = rho
        slowness[i] = rho * frontIndex(rho)
      }
      // The flash's nodes, set by the straight way: the index's mean along it, the ends and the middle by
      // Simpson's rule
      const flashIndex = frontIndex(flash)
      const near = SOURCE_NODES * flash * Math.max(logStep, angleStep)
      heapSize = 0
      for (let j = 0; j < angles; j++) {
        for (let i = 0; i < radii; i++) {
          const node = j * radii + i
          const rho = radius[i]
          const straight = Math.sqrt(Math.max(rho * rho + flash * flash - 2 * rho * flash * cosine[j], 0))
          place[node] = -1
          if (straight <= near) {
            const middle = Math.hypot(0.5 * (rho * cosine[j] + flash), 0.5 * rho * sine[j])
            time[node] = straight * (flashIndex + 4 * frontIndex(middle) + frontIndex(rho)) / 6
            state[node] = 2
          } else {
            time[node] = Infinity
            state[node] = 0
          }
        }
      }
      for (let node = 0; node < count; node++) {
        if (state[node] === 2) settle(node)
      }
      while (heapSize > 0) settle(take())
      for (let j = 0; j < angles; j++) {
        for (let i = 0; i < radii; i++) {
          const node = j * radii + i
          const rho = radius[i]
          const straight = Math.sqrt(Math.max(rho * rho + flash * flash - 2 * rho * flash * cosine[j], 0))
          const arrival = time[node]
          delay[node] = arrival < Infinity ? Math.min(arrival - straight, FRONT_UNREACHED) : FRONT_UNREACHED
        }
      }
      field.inner = inner
      field.outer = outer
      field.flash = flash
      return true
    },
    arrival (x, y) {
      const rho = Math.hypot(x, y)
      if (field.flash <= 0 || rho < Math.exp(field.inner)) return Infinity
      const s = Math.min(Math.max((Math.log(rho) - field.inner) / logStep, 0), radii - 1)
      const t = Math.atan2(Math.abs(y), x) / angleStep
      const i = Math.min(Math.floor(s), radii - 2)
      const j = Math.min(Math.floor(t), angles - 2)
      const fs = s - i
      const ft = t - j
      const at = j * radii + i
      const lag = (delay[at] * (1 - fs) + delay[at + 1] * fs) * (1 - ft) + (delay[at + radii] * (1 - fs) + delay[at + radii + 1] * fs) * ft
      return Math.hypot(x - field.flash, y) + lag
    }
  }
  return field
}
