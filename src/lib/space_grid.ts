// The space sheet: a square grid drawn as a surface seen at an angle, dented where the black hole sits.
// The dent is a diagram, not a picture of the hole, and it is drawn in the picture's own measure: a point
// of the sheet stands where light passing the hole at that distance is seen, and lies as deep as time is
// slowed at the nearest that light comes to the hole. Far away that is the Newtonian well. At the shadow's
// edge the light skims the photon sphere, where a clock runs at 58% of its rate, and the sheet stands
// vertical, because light seen any closer never came back (the grid vertex shader's dent()).
// The lines are a static buffer of segments the grid vertex shader places, so the sheet costs the main
// thread a few numbers per frame and nothing while it is off.

// Lines on each side of the black hole, in both directions, and the pieces each line is drawn in
export const GRID_LINES_PER_SIDE = 112
export const GRID_SEGMENTS = 192
export const GRID_INSTANCE_FLOATS = 4
export const GRID_INSTANCE_COUNT = 2 * (2 * GRID_LINES_PER_SIDE + 1) * GRID_SEGMENTS

// Colour of the lines at full brightness, shared with the flat grid behind the lens
export const GRID_COLOR: readonly [number, number, number] = [0.5, 0.74, 1]

// The gravitational wave lifts the sheet by this many times the stretch it gives the sky, so its ripple
// reads on a surface seen at an angle
export const GRID_WAVE_GAIN = 4

// The camera stands this many long screen sides from the point it looks at: far enough for a mild
// perspective, and for the horizon of the most tilted sheet to stay above the screen
const CAMERA_DISTANCE = 2.5
// The sheet reaches this many long screen sides from the black hole and fades out over the outer half
const SHEET_SPAN = 2.2
const LINE_WIDTH = 1.25
// The well's bottom is never closer to the camera than this share of the camera's distance
const MIN_CAMERA_SHARE = 0.05

// Every length is in CSS pixels
export interface GridSettings {
  // Brightness of the lines; 0 draws nothing
  brightness: number
  cell: number
  // How far from the black hole the lines reach
  span: number
  lineWidth: number
  // The point the camera looks at, and its distance from the camera
  viewX: number
  viewY: number
  distance: number
  tiltSin: number
  tiltCos: number
  // The black hole on the sheet, relative to that point: across the screen and away from the camera
  wellX: number
  wellZ: number
  // Radius the well ends at and its depth there
  throat: number
  depth: number
  // A second black hole's well, placed from the first one's; a depth of 0 is none
  well2X: number
  well2Z: number
  throat2: number
  depth2: number
  // The centre the two turn around, from the first well, and the direction of the second from the first
  pairX: number
  pairZ: number
  pairPhase: number
  // The angle on the sheet of the line the two stood on as they became one
  ringPhase: number
}

export function createGridSettings (): GridSettings {
  return {
    brightness: 0,
    cell: 64,
    span: 1,
    lineWidth: LINE_WIDTH,
    viewX: 0,
    viewY: 0,
    distance: 1,
    tiltSin: 0,
    tiltCos: 1,
    wellX: 0,
    wellZ: 0,
    throat: 0,
    depth: 0,
    well2X: 0,
    well2Z: 0,
    throat2: 0,
    depth2: 0,
    pairX: 0,
    pairZ: 0,
    pairPhase: 0,
    ringPhase: 0
  }
}

// One record per piece of a line: the line's number counted from the one nearest the black hole, where
// the piece starts and ends along it (-1..1), and whether the line runs across the screen
export function createGridInstances (): Float32Array {
  const instances = new Float32Array(GRID_INSTANCE_COUNT * GRID_INSTANCE_FLOATS)
  let offset = 0
  for (let crosswise = 0; crosswise < 2; crosswise++) {
    for (let line = -GRID_LINES_PER_SIDE; line <= GRID_LINES_PER_SIDE; line++) {
      for (let piece = 0; piece < GRID_SEGMENTS; piece++) {
        instances[offset] = line
        instances[offset + 1] = piece / GRID_SEGMENTS * 2 - 1
        instances[offset + 2] = (piece + 1) / GRID_SEGMENTS * 2 - 1
        instances[offset + 3] = crosswise
        offset += GRID_INSTANCE_FLOATS
      }
    }
  }
  return instances
}

// Where a well sits on the sheet, kept at module level so that laying the sheet out allocates nothing
let wellAcross = 0
let wellAway = 0
let wellThroat = 0
let wellDepth = 0

// Puts a well where its bottom lands on a black hole standing at this place of the screen, measured
// from the screen's centre, with its mouth as wide as the shadow there
function settleWell (screenX: number, screenY: number, horizon: number, depthInRadii: number, distance: number, sin: number, cos: number) {
  const nearest = distance * MIN_CAMERA_SHARE
  // The well's size on the sheet depends on how far its bottom is from the camera, which depends on
  // its size; two rounds settle it to well under a pixel
  let throat = horizon
  let depth = 0
  let away = 0
  let behind = distance
  for (let round = 0; round < 3; round++) {
    depth = depthInRadii * throat
    away = (screenY * (distance + depth * cos) - distance * depth * sin) / Math.max(distance * cos + screenY * sin, nearest)
    behind = Math.max(distance + depth * cos - away * sin, nearest)
    if (round < 2) throat = horizon * behind / distance
  }
  wellAcross = screenX * behind / distance
  wellAway = away
  wellThroat = throat
  wellDepth = depth
}

// Lays the sheet out for one frame: the camera looks at the screen centre from above, tilted, and the
// well is put where its bottom lands on the black hole. The sheet stays where it is on screen while the
// black hole moves across it. A second black hole (radius above 0) gets a well of its own; `pairX`,
// `pairY` is the place on screen the two turn around, and `ringAngle` the angle on screen of the line they
// stood on as they became one
export function placeGrid (
  grid: GridSettings,
  tiltDegrees: number,
  depthInRadii: number,
  cell: number,
  width: number,
  height: number,
  holeX: number,
  holeY: number,
  horizon: number,
  companionX: number,
  companionY: number,
  companionRadius: number,
  pairX: number,
  pairY: number,
  ringAngle: number
) {
  const longSide = Math.max(width, height)
  const distance = CAMERA_DISTANCE * longSide
  const tilt = tiltDegrees * Math.PI / 180
  const sin = Math.sin(tilt)
  const cos = Math.cos(tilt)
  const centerX = width / 2
  const centerY = height / 2

  settleWell(holeX - centerX, holeY - centerY, horizon, depthInRadii, distance, sin, cos)
  grid.cell = cell
  grid.span = Math.min(SHEET_SPAN * longSide, GRID_LINES_PER_SIDE * cell)
  grid.viewX = centerX
  grid.viewY = centerY
  grid.distance = distance
  grid.tiltSin = sin
  grid.tiltCos = cos
  grid.wellX = wellAcross
  grid.wellZ = wellAway
  grid.throat = wellThroat
  grid.depth = wellDepth

  // A direction on screen lies further round on the tilted sheet, which is seen from the other side
  grid.ringPhase = Math.atan2(-Math.sin(ringAngle) / cos, Math.cos(ringAngle))
  grid.throat2 = 0
  grid.depth2 = 0
  if (companionRadius > 0) {
    settleWell(companionX - centerX, companionY - centerY, companionRadius, depthInRadii, distance, sin, cos)
    grid.well2X = wellAcross - grid.wellX
    grid.well2Z = wellAway - grid.wellZ
    grid.throat2 = wellThroat
    grid.depth2 = wellDepth
    grid.pairPhase = Math.atan2(grid.well2Z, grid.well2X)
    // The centre of the pair lies on the flat sheet
    settleWell(pairX - centerX, pairY - centerY, 0, 0, distance, sin, cos)
    grid.pairX = wellAcross - grid.wellX
    grid.pairZ = wellAway - grid.wellZ
  }
}
