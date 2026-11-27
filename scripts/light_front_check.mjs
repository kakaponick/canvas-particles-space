// Checks the light front's field (src/lib/light_front.ts) against rays traced through the hole's medium:
// node scripts/light_front_check.mjs [flash distance] [impact parameter]
// Lengths are in throat radii (the shadow's radius, the critical impact parameter b_c). A ray of impact
// parameter b keeps ρ n sin ψ = b; it turns at ρ0 where ρ0 n(ρ0) = b, sweeps dθ = b dρ / (ρ √(m² - b²)) and
// takes dt = m² dρ / (ρ √(m² - b²)) with m = ρ n, integrated here with ρ = ρ0 + s² to take the turn's root
// out. The field's arrival time along the ray is compared with the ray's own, and its delay over the straight
// distance with the weak-field Shapiro delay of one way, rs ln(4 rF rP / b²) (n = 1 + rs / r along the
// straight line), which is half the radar echo's 2 rs ln(4 rF rP / b²), the round trip.
import { createFrontField, frontIndex, FRONT_RS, FRONT_FIELD_ANGLES, FRONT_FIELD_RADII } from '../src/lib/light_front.ts'

const flash = Number(process.argv[2] ?? 10)
const impact = Number(process.argv[3] ?? 1.5)
const slowness = (rho) => rho * frontIndex(rho)

// The turning radius: outside the photon sphere, where ρ n is least
const sphere = FRONT_RS * (2 + Math.sqrt(3)) / 4
let lo = sphere
let hi = impact * 2
for (let k = 0; k < 200; k++) {
  const mid = 0.5 * (lo + hi)
  if (slowness(mid) < impact) lo = mid
  else hi = mid
}
const turn = 0.5 * (lo + hi)

// The sweep and the time from the turn out to a radius, by Simpson's rule in s
function leg (out, steps = 20000) {
  const top = Math.sqrt(out - turn)
  const h = top / steps
  let sweep = 0
  let time = 0
  for (let k = 0; k <= steps; k++) {
    const s = k * h
    const rho = turn + s * s
    const m = slowness(rho)
    // √(m² - b²) / s stays finite as s goes to 0: take its limit there
    let root
    if (s < 1e-9) {
      const d = 1e-7
      root = Math.sqrt((slowness(turn + d) ** 2 - impact * impact) / d)
    } else {
      root = Math.sqrt(Math.max(m * m - impact * impact, 0)) / s
    }
    const weight = k === 0 || k === steps ? 1 : k % 2 ? 4 : 2
    sweep += weight * 2 * impact / (rho * root)
    time += weight * 2 * m * m / (rho * root)
  }
  return { sweep: sweep * h / 3, time: time * h / 3 }
}

const sizeR = Number(process.argv[4] ?? FRONT_FIELD_RADII)
const sizeA = Number(process.argv[5] ?? FRONT_FIELD_ANGLES)
const field = createFrontField(sizeR, sizeA)
const reach = 60
const runs = 20
let started = performance.now()
for (let k = 0; k < runs; k++) field.solve(flash * (1 + k * 1e-4), reach, 0)
const perSolve = (performance.now() - started) / runs
field.solve(flash, reach, 0)
console.log(`grid ${sizeR} radii x ${sizeA} angles, reach ${reach}: ${perSolve.toFixed(2)} ms a solve (mean of ${runs})`)
console.log(`flash ${flash} b_c from the hole, ray of impact parameter ${impact} b_c turning at ${turn.toFixed(4)} (rs ${FRONT_RS.toFixed(4)})`)

const from = leg(flash)
// Where the ray crosses the line from the flash through the hole, behind the hole: past it the ray from the
// other side arrives first, and the field, the first light, is that ray's
let inside = turn
let outside = 200
if (from.sweep + leg(outside, 4000).sweep < Math.PI) inside = outside
else {
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (inside + outside)
    if (from.sweep + leg(mid, 4000).sweep < Math.PI) inside = mid
    else outside = mid
  }
}
const crossing = inside
console.log(`the ray crosses the axis behind the hole at rP ${crossing.toFixed(4)}`)
console.log('rP      angle    T ray     T field   field-ray   delay ray  delay field  rs ln(4rFrP/b^2)  2rs ln (radar)')
const outs = [1.2, 1.6, 2, 2.5, 3, 4, 6, 8, 10, 15, 20, 30].filter((out) => out > turn && out < crossing && out <= reach)
if (crossing <= reach) outs.push(crossing * 0.999)
for (const out of outs) {
  const to = leg(out)
  const angle = from.sweep + to.sweep
  const x = out * Math.cos(angle)
  const y = out * Math.sin(angle)
  const straightWay = Math.hypot(x - flash, y)
  const rayTime = from.time + to.time
  const fieldTime = field.arrival(x, y)
  const shapiro = FRONT_RS * Math.log(4 * flash * out / (impact * impact))
  console.log(`${out.toFixed(3).padEnd(7)} ${(angle * 180 / Math.PI).toFixed(1).padStart(6)}°  ${rayTime.toFixed(4).padStart(8)}  ${fieldTime.toFixed(4).padStart(8)}  ${(fieldTime - rayTime).toFixed(4).padStart(9)}  ${(rayTime - straightWay).toFixed(4).padStart(9)}  ${(fieldTime - straightWay).toFixed(4).padStart(10)}  ${shapiro.toFixed(4).padStart(10)}  ${(2 * shapiro).toFixed(4).padStart(14)}`)
}
