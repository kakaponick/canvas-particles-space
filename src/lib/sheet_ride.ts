// Particles on the sheet. With Particles on Sheet above 0 a stroke is drawn where the sheet lies under the
// particle: the particle's place around the black hole, seen straight on, is its place on the sheet, and
// the sheet's own camera (space_grid.ts, onScreen in the grid vertex shader) puts it on the screen, as deep
// in the well as the sheet is there. So matter circles on the surface and goes down the well with it, at
// any tilt. Nothing about the particles' motion changes: this is only where they are drawn. A second black
// hole's well carries them too; the sheet's waves do not.
// Both ends of a stroke are seen through the sheet as it lies now. Seen through the sheet of the frame
// before, as a stroke of the 3D camera is, every slow particle would be drawn as a long line while the sheet
// tilts: a tilt moves the whole picture, and a stroke is as bright as it is long.
// Both hot loops call it for each stroke they draw, and only while it is on.
import type { StepSettings } from './particle_simulation'

// The stroke on the sheet: where it starts and where it ends on the screen, in CSS pixels
export const ridden = new Float64Array(4)

// One step's numbers, read once for the loop so that laying a stroke reads no object
let share = 0
let turnCos = 1
let turnSin = 0
let viewX = 0
let viewY = 0
let distance = 1
let nearest = 0
let tiltSin = 0
let tiltCos = 1
let wellX = 0
let wellZ = 0
let throat = 1
let depth = 0
let rollCos = 1
let rollSin = 0
let well2X = 0
let well2Z = 0
let throat2 = 0
let depth2 = 0

// Takes a step's sheet. Returns whether its strokes are laid on the sheet at all
export function readRide (settings: StepSettings): boolean {
  share = settings.ride
  if (!(share > 0) || !(settings.sheetThroat > 0)) return false
  turnCos = settings.rideCos
  turnSin = settings.rideSin
  viewX = settings.sheetViewX
  viewY = settings.sheetViewY
  distance = settings.sheetDistance
  nearest = settings.sheetNear
  tiltSin = settings.sheetSin
  tiltCos = settings.sheetCos
  wellX = settings.sheetWellX
  wellZ = settings.sheetWellZ
  throat = settings.sheetThroat
  depth = settings.sheetDepth
  rollCos = settings.sheetRollCos
  rollSin = settings.sheetRollSin
  well2X = settings.sheetWell2X
  well2Z = settings.sheetWell2Z
  throat2 = settings.sheetThroat2
  depth2 = settings.sheetDepth2
  return true
}

// dent() of the grid vertex shader: how deep the sheet lies at a distance from a black hole whose shadow
// has the radius `edge`, as a share of its depth at the shadow's edge
function dent (away: number, edge: number): number {
  const x = away > edge ? edge / away : 1
  const kept = 1 - x / (3 * Math.cos(Math.acos(-x) / 3))
  return (1 - Math.sqrt(kept > 0 ? kept : 0)) * 2.3660254
}

/**
 * Lays one stroke on the sheet and leaves it in `ridden`. The stroke is given twice: where it starts and
 * ends around the black hole seen straight on, in CSS pixels from the hole, and where the scene's own
 * camera drew those two points, which is what a share below 1 blends from.
 * Returns false for a stroke nearer the sheet's camera than the sheet is drawn.
 */
export function rideStroke (
  fromX: number, fromY: number, toX: number, toY: number,
  drawnFromX: number, drawnFromY: number, drawnToX: number, drawnToY: number
): boolean {
  // Where the particle stands on the sheet, from the hole, and how deep the sheet lies there. Its start is
  // a frame's flight away, so it lies as deep
  const onX = turnCos * toX - turnSin * toY
  const onY = turnSin * toX + turnCos * toY
  let deep = depth * dent(Math.sqrt(onX * onX + onY * onY), throat)
  if (depth2 > 0) {
    const awayX = onX - well2X
    const awayY = onY - well2Z
    deep += depth2 * dent(Math.sqrt(awayX * awayX + awayY * awayY), throat2)
  }

  const placeY = onY + wellZ
  const behind = distance + deep * tiltCos - placeY * tiltSin
  if (behind < nearest) return false
  const scale = distance / behind
  let endX = (onX + wellX) * scale
  let endY = (placeY * tiltCos + deep * tiltSin) * scale

  const placeYFrom = turnSin * fromX + turnCos * fromY + wellZ
  const behindFrom = distance + deep * tiltCos - placeYFrom * tiltSin
  if (behindFrom < nearest) return false
  const scaleFrom = distance / behindFrom
  let startX = (turnCos * fromX - turnSin * fromY + wellX) * scaleFrom
  let startY = (placeYFrom * tiltCos + deep * tiltSin) * scaleFrom

  // A camera that rolls turns the drawn sheet about the point its camera looks at
  if (rollSin !== 0) {
    const x = endX
    endX = rollCos * x + rollSin * endY
    endY = rollCos * endY - rollSin * x
    const xFrom = startX
    startX = rollCos * xFrom + rollSin * startY
    startY = rollCos * startY - rollSin * xFrom
  }

  ridden[0] = drawnFromX + (viewX + startX - drawnFromX) * share
  ridden[1] = drawnFromY + (viewY + startY - drawnFromY) * share
  ridden[2] = drawnToX + (viewX + endX - drawnToX) * share
  ridden[3] = drawnToY + (viewY + endY - drawnToY) * share
  return true
}
