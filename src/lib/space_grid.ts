// The space sheet: a square grid drawn as a surface of the scene, dented where the black hole sits. The
// sheet is a piece of the main hole's equator (the plane matter and the flows follow): a point of it is the
// hole's place, plus its two coordinates in that plane, plus its depth in the well along the way the plane
// faces, away from a camera that looks down the flight. The dent is drawn in the picture's own measure: a
// point of the sheet stands where light passing the hole at that distance is seen, and lies as deep as time
// is slowed at the nearest that light comes to the hole. Far away that is the Newtonian well. At the
// shadow's edge the light skims the photon sphere, where a clock runs at 58% of its rate, and the sheet
// stands vertical, because light seen any closer never came back (dent() in webgl_shaders.ts).
// The sheet is seen through a pose, as a particle is: in 3D the scene's own camera, so it moves, turns and
// comes near with everything else; in the flat mode, which has no camera to move, a camera of its own
// tipped by Sheet Tilt and set so that the well's bottom lands on the hole. While 3D eases in, the one pose
// turns into the other. SHEET_GLSL in webgl_shaders.ts places and sees the surface; the grid program, the
// field's step and the flows all read it from the numbers laid out here.
// The lines are a static buffer of segments the grid vertex shader places, so the sheet costs the main
// thread a few numbers per frame and nothing while it is off.

// Lines on each side of the black hole, in both directions, and the pieces each line is drawn in
export const GRID_LINES_PER_SIDE = 112
export const GRID_SEGMENTS = 192
export const GRID_INSTANCE_FLOATS = 4
export const GRID_INSTANCE_COUNT = 2 * (2 * GRID_LINES_PER_SIDE + 1) * GRID_SEGMENTS

// The well's bottom is never closer to the flat camera than this share of the camera's distance
const MIN_CAMERA_SHARE = 0.05
// Slots of a pose: where its camera sends the plane's first direction, its focal length; the second
// direction, its near plane; the way the well goes down, the x of the picture's centre; the main hole's
// place, the y of the picture's centre. Directions and places are in the camera's space (right, down,
// ahead), in units of the plane
export const SHEET_POSE_SLOTS = 16

// Lengths on the plane are its units: CSS pixels seen straight on at the black hole's distance in 3D, the
// flat camera's own pixels in the flat mode (see `unit`)
export interface GridSettings {
  // Brightness of the lines; 0 draws nothing
  brightness: number
  cell: number
  // How far from the black hole the lines reach, and the distance from it they begin to fade out at
  span: number
  fadeFrom: number
  // Width of a line where the camera looks, and the most it widens near the camera
  lineWidth: number
  lineScale: number
  // The radii of a black hole's shadow inside which the lines are gone and beyond which they are whole
  clearFrom: number
  clearTo: number
  // How many times the stretch a gravitational wave gives the sky lifts the sheet
  waveLift: number
  // Rings drawn around the black hole in place of the square cells, at equal steps of the well's depth
  // (0 keeps the cells), and the spokes across them
  rings: number
  spokes: number
  // The pose the surface is seen through (SHEET_POSE_SLOTS)
  pose: Float32Array
  // The main hole's well, at the middle of the plane: the radius it ends at and its depth there
  throat: number
  depth: number
  // A second black hole's well where its place falls on the plane, from the main hole; a depth of 0 is none
  well2X: number
  well2Y: number
  throat2: number
  depth2: number
  // The centre the two turn around, on the plane from the main hole, and the angle of the second well
  pairX: number
  pairY: number
  pairPhase: number
  // The angle on the sheet of the line the two stood on as they became one
  ringPhase: number
  // A place the lines are counted from, which stays put in the scene while the hole moves across the sheet
  anchorX: number
  anchorY: number
  // Units of the plane in a CSS pixel seen straight on at the hole's distance: 1 in 3D, in the flat mode
  // the flat camera's pixels at the well over those of the screen
  unit: number
  // How far the sheet is seen by the scene's own camera: 0 by the flat one, 1 by the 3D camera's pose
  shared: number
  // The equator in the scene, row by row: its two directions and the way it faces
  equator: Float32Array
}

export function createGridSettings (): GridSettings {
  return {
    brightness: 0,
    cell: 64,
    span: 1,
    fadeFrom: 0.5,
    lineWidth: 1.25,
    lineScale: 3,
    clearFrom: 1.04,
    clearTo: 1.2,
    waveLift: 4,
    rings: 0,
    spokes: 24,
    pose: new Float32Array([1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
    throat: 0,
    depth: 0,
    well2X: 0,
    well2Y: 0,
    throat2: 0,
    depth2: 0,
    pairX: 0,
    pairY: 0,
    pairPhase: 0,
    ringPhase: 0,
    anchorX: 0,
    anchorY: 0,
    unit: 1,
    shared: 0,
    equator: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  }
}

// One record per piece of a line: the line's number counted from the one nearest the black hole, where
// the piece starts and ends along it (-1..1), and whether the line runs along the plane's first direction
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

// The sheet as one of its two cameras lays it out, before the two are blended
interface SheetLayout {
  pose: Float64Array
  throat: number
  depth: number
  well2X: number
  well2Y: number
  throat2: number
  depth2: number
  pairX: number
  pairY: number
  // The direction of the line the pair stood on as it became one, on the plane
  ringX: number
  ringY: number
  anchorX: number
  anchorY: number
  unit: number
}

function createLayout (): SheetLayout {
  return {
    pose: new Float64Array(SHEET_POSE_SLOTS), throat: 0, depth: 0, well2X: 0, well2Y: 0, throat2: 0, depth2: 0,
    pairX: 0, pairY: 0, ringX: 1, ringY: 0, anchorX: 0, anchorY: 0, unit: 1
  }
}

// Kept at module level so that laying the sheet out allocates nothing
const flat = createLayout()
const space = createLayout()
let wellAcross = 0
let wellAway = 0
let wellThroat = 0
let wellDepth = 0
let wellScale = 1

// Puts a well where its bottom lands, through the flat camera, on a black hole standing at this place of
// the screen, measured from the screen's centre, with its mouth as wide as the shadow there
function settleWell (screenX: number, screenY: number, horizon: number, depthInRadii: number, distance: number, sin: number, cos: number) {
  const nearest = distance * MIN_CAMERA_SHARE
  // The well's size on the sheet depends on how far its bottom is from the camera, which depends on
  // its size; two rounds settle it to well under a pixel
  let scale = 1
  let throat = horizon
  let depth = 0
  let away = 0
  let behind = distance
  for (let round = 0; round < 3; round++) {
    depth = depthInRadii * throat
    away = (screenY * (distance + depth * cos) - distance * depth * sin) / Math.max(distance * cos + screenY * sin, nearest)
    behind = Math.max(distance + depth * cos - away * sin, nearest)
    if (round < 2) {
      scale = behind / distance
      throat = horizon * scale
    }
  }
  wellAcross = screenX * behind / distance
  wellAway = away
  wellThroat = throat
  wellDepth = depth
  wellScale = scale
}

/**
 * Lays the sheet out for the flat mode's camera: it looks at the screen's centre from `cameraSides` long
 * screen sides away, tipped by `tiltDegrees` (0 looks straight down the well), and cuts the sheet off nearer
 * than `nearShare` of that distance. The well is put where its bottom lands on the black hole (`holeX`,
 * `holeY` on the screen, its shadow `horizon` pixels), so the sheet's lines stay put on the screen while the
 * hole moves across them. A second black hole (radius above 0) gets a well of its own; `pairX`, `pairY` is
 * the place on screen the two turn around, and `ringAngle` the angle on screen of the line they stood on as
 * they became one.
 */
export function layFlatSheet (
  tiltDegrees: number,
  depthInRadii: number,
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
  ringAngle: number,
  cameraSides: number,
  nearShare: number
) {
  const distance = cameraSides * Math.max(width, height)
  const tilt = tiltDegrees * Math.PI / 180
  const sin = Math.sin(tilt)
  const cos = Math.cos(tilt)
  const centerX = width / 2
  const centerY = height / 2

  settleWell(holeX - centerX, holeY - centerY, horizon, depthInRadii, distance, sin, cos)
  const wellX = wellAcross
  const wellY = wellAway
  flat.throat = wellThroat
  flat.depth = wellDepth
  flat.unit = wellScale
  // The camera tipped about the screen's horizontal: the plane's first direction stays across the screen,
  // the second rises away from the camera, the well goes down and away; the hole is where its well was put
  const pose = flat.pose
  pose[0] = 1
  pose[1] = 0
  pose[2] = 0
  pose[3] = distance
  pose[4] = 0
  pose[5] = cos
  pose[6] = -sin
  pose[7] = nearShare * distance
  pose[8] = 0
  pose[9] = sin
  pose[10] = cos
  pose[11] = centerX
  pose[12] = wellX
  pose[13] = cos * wellY
  pose[14] = distance - sin * wellY
  pose[15] = centerY
  // The lines are counted from the screen's centre
  flat.anchorX = -wellX
  flat.anchorY = -wellY

  // A direction on screen lies further round on the tilted sheet, which is seen from the other side
  flat.ringX = Math.cos(ringAngle)
  flat.ringY = -Math.sin(ringAngle) / cos
  flat.throat2 = 0
  flat.depth2 = 0
  flat.well2X = 0
  flat.well2Y = 0
  flat.pairX = 0
  flat.pairY = 0
  if (companionRadius > 0) {
    settleWell(companionX - centerX, companionY - centerY, companionRadius, depthInRadii, distance, sin, cos)
    flat.well2X = wellAcross - wellX
    flat.well2Y = wellAway - wellY
    flat.throat2 = wellThroat
    flat.depth2 = wellDepth
    // The centre of the pair lies on the flat sheet
    settleWell(pairX - centerX, pairY - centerY, 0, 0, distance, sin, cos)
    flat.pairX = wellAcross - wellX
    flat.pairY = wellAway - wellY
  }
}

/**
 * Lays the sheet out in the scene, seen by the 3D camera's pose (`pose`, camera_pose.ts, about the point
 * at `pivot` on the line of flight; its focal length `focal` and the vanishing point, CSS pixels). Places
 * are in scene units, `worldPerPixel` of them in a CSS pixel at the pivot's distance; `equator` is the
 * plane's two directions and the way it faces, row by row. The main hole stands at `holeX`..`holeZ` with
 * its shadow `horizon` pixels at the pivot; a second one (radius above 0) at `companionX`..`companionZ`,
 * the two turning round `pairX`..`pairZ`, and `ringX`..`ringZ` the direction they stood in as they became one.
 */
export function laySpaceSheet (
  pose: ArrayLike<number>,
  pivot: number,
  focal: number,
  vanishX: number,
  vanishY: number,
  worldPerPixel: number,
  nearest: number,
  equator: ArrayLike<number>,
  holeX: number,
  holeY: number,
  holeZ: number,
  horizon: number,
  depthInRadii: number,
  companionX: number,
  companionY: number,
  companionZ: number,
  companionRadius: number,
  pairX: number,
  pairY: number,
  pairZ: number,
  ringX: number,
  ringY: number,
  ringZ: number
) {
  // The well goes down along the way the plane faces, on the side away from a camera that looks down the flight
  const down = equator[8] < 0 ? -1 : 1
  const out = space.pose
  for (let row = 0; row < 3; row++) {
    const a = pose[row * 3]
    const b = pose[row * 3 + 1]
    const c = pose[row * 3 + 2]
    out[row] = a * equator[0] + b * equator[1] + c * equator[2]
    out[4 + row] = a * equator[3] + b * equator[4] + c * equator[5]
    out[8 + row] = (a * equator[6] + b * equator[7] + c * equator[8]) * down
    // The hole's place in the camera's space, in the plane's units
    out[12 + row] = (a * holeX + b * holeY + c * (holeZ - pivot) + pose[9 + row]) / worldPerPixel
  }
  out[3] = focal
  out[7] = nearest / worldPerPixel
  out[11] = vanishX
  out[15] = vanishY
  space.unit = 1
  space.throat = horizon
  space.depth = depthInRadii * horizon
  // The lines are counted from the point the camera circles
  const scale = 1 / worldPerPixel
  space.anchorX = onPlane(equator, 0, -holeX, -holeY, pivot - holeZ) * scale
  space.anchorY = onPlane(equator, 3, -holeX, -holeY, pivot - holeZ) * scale
  space.throat2 = 0
  space.depth2 = 0
  space.well2X = 0
  space.well2Y = 0
  space.pairX = 0
  space.pairY = 0
  if (companionRadius > 0) {
    space.well2X = onPlane(equator, 0, companionX - holeX, companionY - holeY, companionZ - holeZ) * scale
    space.well2Y = onPlane(equator, 3, companionX - holeX, companionY - holeY, companionZ - holeZ) * scale
    space.throat2 = companionRadius
    space.depth2 = depthInRadii * companionRadius
    space.pairX = onPlane(equator, 0, pairX - holeX, pairY - holeY, pairZ - holeZ) * scale
    space.pairY = onPlane(equator, 3, pairX - holeX, pairY - holeY, pairZ - holeZ) * scale
  }
  // The line the pair stood on, as it falls on the plane; the sheet's waves count their angles the other
  // way round, as the flat camera sees them
  space.ringX = onPlane(equator, 0, ringX, ringY, ringZ)
  space.ringY = -onPlane(equator, 3, ringX, ringY, ringZ)
}

// A direction of the scene along one of the equator's rows (0: its first direction, 3: its second)
function onPlane (equator: ArrayLike<number>, row: number, x: number, y: number, z: number) {
  return x * equator[row] + y * equator[row + 1] + z * equator[row + 2]
}

/**
 * Sets the sheet for this frame from the two layouts: `shared` of the way from the flat camera's (0) to the
 * 3D camera's (1), so switching 3D on turns the sheet from its diagram view to where it lies in the scene.
 * A layout not taken part in is not read. The lines are `cell` apart and reach `spanSides` long screen sides
 * from the hole, fading out over the share `fade` of that.
 */
export function placeSheet (
  grid: GridSettings,
  shared: number,
  equator: ArrayLike<number>,
  cell: number,
  width: number,
  height: number,
  spanSides: number,
  fade: number
) {
  const from = shared >= 1 ? space : flat
  const to = shared <= 0 ? flat : space
  const share = shared <= 0 ? 0 : Math.min(shared, 1)
  for (let slot = 0; slot < SHEET_POSE_SLOTS; slot++) grid.pose[slot] = mix(from.pose[slot], to.pose[slot], share)
  grid.throat = mix(from.throat, to.throat, share)
  grid.depth = mix(from.depth, to.depth, share)
  grid.well2X = mix(from.well2X, to.well2X, share)
  grid.well2Y = mix(from.well2Y, to.well2Y, share)
  // A well that is there in only one of the two grows in place
  grid.throat2 = mix(from.throat2, to.throat2, share)
  grid.depth2 = mix(from.depth2, to.depth2, share)
  grid.pairX = mix(from.pairX, to.pairX, share)
  grid.pairY = mix(from.pairY, to.pairY, share)
  grid.pairPhase = Math.atan2(grid.well2Y, grid.well2X)
  grid.ringPhase = Math.atan2(mix(from.ringY, to.ringY, share), mix(from.ringX, to.ringX, share))
  grid.anchorX = mix(from.anchorX, to.anchorX, share)
  grid.anchorY = mix(from.anchorY, to.anchorY, share)
  grid.unit = mix(from.unit, to.unit, share)
  grid.shared = share
  for (let slot = 0; slot < 9; slot++) grid.equator[slot] = equator[slot]
  grid.cell = cell
  grid.span = Math.min(spanSides * Math.max(width, height), GRID_LINES_PER_SIDE * cell)
  grid.fadeFrom = (1 - fade) * grid.span
}

// Between two numbers, by a share
function mix (a: number, b: number, share: number) {
  return a + (b - a) * share
}

// The uniforms SHEET_GLSL reads, by their names without u_, as a program holds them
type SheetUniforms<U> = Record<'sheetU' | 'sheetV' | 'sheetN' | 'sheetO' | 'sheetWell' | 'sheetWell2', U>

// Hands the surface and its pose to a program that reads SHEET_GLSL, through that program's setter
export function sendSheet<U> (set: (uniform: U, x: number, y: number, z: number, w: number) => void, u: SheetUniforms<U>, grid: GridSettings) {
  const pose = grid.pose
  set(u.sheetU, pose[0], pose[1], pose[2], pose[3])
  set(u.sheetV, pose[4], pose[5], pose[6], pose[7])
  set(u.sheetN, pose[8], pose[9], pose[10], pose[11])
  set(u.sheetO, pose[12], pose[13], pose[14], pose[15])
  set(u.sheetWell, grid.throat, grid.depth, 0, 0)
  set(u.sheetWell2, grid.well2X, grid.well2Y, grid.throat2, grid.depth2)
}
