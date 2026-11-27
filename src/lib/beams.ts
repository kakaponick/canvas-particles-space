// Sheet Beams (gridBeams): two beams of light that run along the space sheet's dented surface at one pace,
// side by side across the main hole's well, the textbook's picture of why light past a mass comes late: the
// far beam keeps to the flat sheet, the near one runs down the well's wall and back up, so the same run along
// the surface takes it less far ahead. A picture, not general relativity's delay (that is Light Front's
// eikonal, light_front.ts): here only the sheet's drawn depth lengthens the way, and the beams go straight
// across the plane, unbent. Each beam fills one row of a photon table (photons.ts layout), so the photon
// program draws it, riding the sheet as the photons do; it is filled once when the beams' lanes, their start or
// the well change, never per frame

import { PHOTON_COLUMNS, PHOTON_SAMPLES, PHOTON_TICK } from './photons'
import { sheetDent } from './space_grid'
import { createPhotonSettings, type PhotonSettings } from './photon_program'

// The step the walk along the surface takes across the plane, in throat radii: far finer than a tick of run
const WALK_STEP = 0.004

export interface BeamSettings extends PhotonSettings {
  // Where both beams start across the plane, in throat radii from the hole along its first direction, and how
  // far from the hole's line each runs, in throat radii (the near beam on one side, the far one on the other)
  start: number
  near: number
  far: number
  // The well's depth at the throat in throat radii, and a star's surface in throat radii (0: a hole), as the
  // sheet's dent takes them
  depth: number
  star: number
}

export function createBeamSettings (): BeamSettings {
  return { ...createPhotonSettings(), start: -12, near: 1.3, far: 8, depth: 0, star: 0 }
}

// The depth of the sheet at a place, in throat radii, as SHEET_GLSL's sheetDepth gives it for the main hole
function depthAt (x: number, y: number, depth: number, star: number) {
  return depth * sheetDent(Math.hypot(x, y), 1, star)
}

// One beam into table row `row`: its place across the plane at every tick of run along the surface, starting
// at (start, lane) and running along the plane's first direction. A beam that meets the throat stops there
function walk (table: Float32Array, row: number, start: number, lane: number, depth: number, star: number) {
  const base = row * PHOTON_COLUMNS * 2
  let x = start
  let z = depthAt(x, lane, depth, star)
  let run = 0
  let taken = -1
  table[base] = x
  table[base + 1] = lane
  for (let s = 1; s < PHOTON_SAMPLES; s++) {
    const target = s * PHOTON_TICK
    while (taken < 0 && run < target) {
      const nextX = x + WALK_STEP
      if (Math.hypot(nextX, lane) <= 1) {
        taken = run
        break
      }
      const nextZ = depthAt(nextX, lane, depth, star)
      const step = Math.hypot(WALK_STEP, nextZ - z)
      // The last step is cut where the run reaches the tick, so the sample stands on it
      if (run + step >= target) {
        const share = (target - run) / step
        x += WALK_STEP * share
        z += (nextZ - z) * share
        run = target
        break
      }
      x = nextX
      z = nextZ
      run += step
    }
    table[base + 2 * s] = x
    table[base + 2 * s + 1] = lane
  }
  // Past the table it flies on along the plane; one taken stays at the throat
  table[base + 2 * PHOTON_SAMPLES] = taken < 0 ? 1 : 0
  table[base + 2 * PHOTON_SAMPLES + 1] = 0
  table[base + 2 * PHOTON_SAMPLES + 2] = taken
  table[base + 2 * PHOTON_SAMPLES + 3] = 0
}

/** Both beams into the table: row 0 the near one, row 1 the far one on the other side of the hole, so it never runs across the near one's dip on the screen */
export function traceBeams (table: Float32Array, count: number, beams: BeamSettings) {
  walk(table, 0, beams.start, beams.near, beams.depth, beams.star)
  if (count > 1) walk(table, 1, beams.start, -beams.far, beams.depth, beams.star)
}
