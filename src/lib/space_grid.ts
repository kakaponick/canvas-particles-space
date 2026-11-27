// The space sheet: a square grid drawn as a surface of the scene, dented where the black hole sits. The
// sheet is a piece of the main hole's equator (the plane matter and the flows follow), lifted so that the
// bottom of the hole's well is the hole, as a textbook draws it: a point of it is the hole's place, plus its
// two coordinates in that plane, plus its depth in the well less the depth at the bottom, along the way the
// plane faces, away from a camera that looks down the flight. Inside the throat, below the horizon, nothing
// of it is drawn. The dent is drawn in the picture's own measure: a point of the sheet stands where light
// passing the hole at that distance is seen, and lies as deep as time is slowed at the nearest that light
// comes to the hole. Far away that is the Newtonian well. At the
// shadow's edge the light skims the photon sphere, where a clock runs at 58% of its rate, and the sheet
// stands vertical, because light seen any closer never came back (dent() in webgl_shaders.ts).
// The sheet is seen through a pose, as a particle is: in 3D the scene's own camera, so it moves, turns and
// comes near with everything else; in the flat mode, which has no camera to move, a camera of its own
// tipped by Sheet Tilt and set so that the well's bottom lands on the hole. While 3D eases in, the one pose
// turns into the other. SHEET_GLSL in webgl_shaders.ts places and sees the surface; the grid program, the
// field's step and the flows all read it from the numbers laid out here.
// The lines are a static buffer of segments the grid vertex shader places, so the sheet costs the main
// thread a few numbers per frame and nothing while it is off.
import { turnOnto } from './camera_pose'
import { createSceneColor, type SceneColor } from './scene_color'

// Lines on each side of the black hole, in both directions, and the pieces each line is drawn in
export const GRID_LINES_PER_SIDE = 112
export const GRID_SEGMENTS = 192
export const GRID_INSTANCE_FLOATS = 4
export const GRID_INSTANCE_COUNT = 2 * (2 * GRID_LINES_PER_SIDE + 1) * GRID_SEGMENTS

// The well's bottom is never closer to the flat camera than this share of the camera's distance
const MIN_CAMERA_SHARE = 0.05
// Slots of a pose: where its camera sends the plane's first direction, its focal length; the second
// direction, its near plane; the way the well goes down, the x of the picture's centre; the plane's place
// over the main hole, whose well's bottom is the hole, the y of the picture's centre. Directions and places
// are in the camera's space (right, down, ahead), in units of the plane
export const SHEET_POSE_SLOTS = 16
// The sheet's waves: six slots of four numbers (GridSettings.wave)
const SHEET_WAVE_FLOATS = 24

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
  // (0 keeps the cells), and the spokes across them; the share of the way the rings are moved from equal
  // steps of depth to equal steps of radius
  rings: number
  spokes: number
  ringSpacing: number
  // How many times brighter a line is where time is slowed most, at a throat (0: even), and the power of
  // that slowing it follows; the light the holes shed on the sheet (0: none), the shadow radii it falls to
  // half at, and its colour
  throatGlow: number
  throatCurve: number
  light: number
  lightReach: number
  lightColor: SceneColor
  // The share of the sheet behind the holes drawn into the layer the lens reads, the rest over the frame
  lensed: number
  // The sheet's waves for SHEET_GLSL, six slots of four (sendSheet): the ringing hole's wave, how it
  // spreads, how its oval turns, the pair's spiral wave, the pair's centre, the merger's front. Heights are
  // already lifted by waveLift; a height of 0 is no wave
  wave: Float32Array
  // Particles on Sheet: the share of the slab the ride fades over, the slab's half thickness on the side the
  // well goes down as a multiple of the near side's, the share of the waves the riders go with, and the most
  // of a ridden stroke nearer than the near plane that is cut there rather than dropped
  rideSoft: number
  rideFar: number
  rideWave: number
  rideCut: number
  // The pose the surface is seen through (SHEET_POSE_SLOTS)
  pose: Float32Array
  // The main hole's well, at the middle of the plane: the radius it ends at and its depth there; the depth
  // the hole itself stands at, the share of it the sheet is lifted by (1: the well's bottom)
  throat: number
  depth: number
  holeDepth: number
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
  // The equator in the scene, row by row: its two directions and the way the well goes down (the way it
  // faces, turned away from a camera looking down the flight), and that turn: 1, or -1 where it is turned
  equator: Float32Array
  down: number
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
    ringSpacing: 0,
    throatGlow: 0,
    throatCurve: 1,
    light: 0,
    lightReach: 1,
    lightColor: createSceneColor(),
    lensed: 0,
    wave: new Float32Array(SHEET_WAVE_FLOATS),
    rideSoft: 1,
    rideFar: 1,
    rideWave: 1,
    rideCut: 1,
    pose: new Float32Array([1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
    throat: 0,
    depth: 0,
    holeDepth: 0,
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
    equator: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    down: 1
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
  // The depth the main hole stands at, below the plane
  holeDepth: number
  well2X: number
  well2Y: number
  throat2: number
  depth2: number
  pairX: number
  pairY: number
  // The direction of the line the pair stood on as it became one, on the plane
  ringX: number
  ringY: number
  // The direction the second hole stands in along its orbit laid flat onto the plane (orbitOnSheet)
  orbitX: number
  orbitY: number
  anchorX: number
  anchorY: number
  unit: number
}

function createLayout (): SheetLayout {
  return {
    pose: new Float64Array(SHEET_POSE_SLOTS), throat: 0, depth: 0, holeDepth: 0, well2X: 0, well2Y: 0, throat2: 0, depth2: 0,
    pairX: 0, pairY: 0, ringX: 1, ringY: 0, orbitX: 1, orbitY: 0, anchorX: 0, anchorY: 0, unit: 1
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

// Puts a well where the point `lift` of the way down it lands, through the flat camera, on a black hole
// standing at this place of the screen, measured from the screen's centre, with its mouth as wide as the
// shadow there
function settleWell (screenX: number, screenY: number, horizon: number, depthInRadii: number, lift: number, distance: number, sin: number, cos: number) {
  const nearest = distance * MIN_CAMERA_SHARE
  // The well's size on the sheet depends on how far the point put on the hole is from the camera, which
  // depends on its size; two rounds settle it to well under a pixel
  let scale = 1
  let throat = horizon
  let depth = 0
  let away = 0
  let behind = distance
  for (let round = 0; round < 3; round++) {
    depth = depthInRadii * throat
    const down = depth * lift
    away = (screenY * (distance + down * cos) - distance * down * sin) / Math.max(distance * cos + screenY * sin, nearest)
    behind = Math.max(distance + down * cos - away * sin, nearest)
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
 * than `nearShare` of that distance. The well is put where the point `lift` of the way down it lands on the
 * black hole (`holeX`, `holeY` on the screen, its shadow `horizon` pixels), so the sheet's lines stay put on
 * the screen while the hole moves across them. A second black hole (radius above 0) gets a well of its own,
 * put on it the same way, which drops its own depth below the sheet in all, the main dent there included,
 * `bottom` of the way from leaving that out (0); `pairX`, `pairY` is the place on screen the two turn
 * around, and `ringAngle` the angle on screen of the line they stood on as they became one; `orbitX`, `orbitY` is where the second hole
 * stands along its orbit laid flat onto the plane (orbitOnSheet).
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
  nearShare: number,
  orbitX: number,
  orbitY: number,
  lift: number,
  bottom: number
) {
  const distance = cameraSides * Math.max(width, height)
  const tilt = tiltDegrees * Math.PI / 180
  const sin = Math.sin(tilt)
  const cos = Math.cos(tilt)
  const centerX = width / 2
  const centerY = height / 2

  settleWell(holeX - centerX, holeY - centerY, horizon, depthInRadii, lift, distance, sin, cos)
  const wellX = wellAcross
  const wellY = wellAway
  flat.throat = wellThroat
  flat.depth = wellDepth
  flat.holeDepth = wellDepth * lift
  flat.unit = wellScale
  // The camera tipped about the screen's horizontal: the plane's first direction stays across the screen,
  // the second rises away from the camera, the well goes down and away; the plane's place over the hole is
  // where its well was put
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
  flat.orbitX = orbitX
  flat.orbitY = orbitY
  flat.throat2 = 0
  flat.depth2 = 0
  flat.well2X = 0
  flat.well2Y = 0
  flat.pairX = 0
  flat.pairY = 0
  if (companionRadius > 0) {
    settleWell(companionX - centerX, companionY - centerY, companionRadius, depthInRadii, lift, distance, sin, cos)
    flat.well2X = wellAcross - wellX
    flat.well2Y = wellAway - wellY
    flat.throat2 = wellThroat
    // Its own depth, from which reaching its hole takes away what the main well has already dented there
    const reached = Math.max(wellDepth - flat.depth * dent(Math.hypot(flat.well2X, flat.well2Y), flat.throat), 0)
    flat.depth2 = mix(wellDepth, reached, bottom)
    // The centre of the pair lies on the flat sheet
    settleWell(pairX - centerX, pairY - centerY, 0, 0, 0, distance, sin, cos)
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
 * the two turning round `pairX`..`pairZ`, and `ringX`..`ringZ` the direction they stood in as they became one;
 * `orbitX`, `orbitY` is where the second hole stands along its orbit laid flat onto the plane (orbitOnSheet).
 * The plane is lifted toward a camera looking down the flight by `lift` of the main well's depth, and the
 * second well is deep enough to reach its hole `bottom` of the way from its own depth (0).
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
  ringZ: number,
  orbitX: number,
  orbitY: number,
  lift: number,
  bottom: number
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
  space.holeDepth = space.depth * lift
  // The well's bottom stands at the hole, as the flat camera sets it: the plane is lifted along the way it
  // faces by the depth there, so its flat part lies that much nearer a camera looking down the flight; by
  // a share of it, the hole stands that share of the way down the well
  for (let row = 0; row < 3; row++) out[12 + row] -= out[8 + row] * space.holeDepth
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
    // Its own depth, or as deep as its bottom must go to reach the hole: from the lifted plane, less what the
    // main well has dented there, down to the hole's height off the equator the way the well goes
    const height = onPlane(equator, 6, companionX - holeX, companionY - holeY, companionZ - holeZ) * down * scale
    const reached = Math.max(height + space.holeDepth - space.depth * dent(Math.hypot(space.well2X, space.well2Y), horizon), 0)
    space.depth2 = mix(depthInRadii * companionRadius, reached, bottom)
    space.pairX = onPlane(equator, 0, pairX - holeX, pairY - holeY, pairZ - holeZ) * scale
    space.pairY = onPlane(equator, 3, pairX - holeX, pairY - holeY, pairZ - holeZ) * scale
  }
  // The line the pair stood on, as it falls on the plane; the sheet's waves count their angles the other
  // way round, as the flat camera sees them
  space.ringX = onPlane(equator, 0, ringX, ringY, ringZ)
  space.ringY = -onPlane(equator, 3, ringX, ringY, ringZ)
  space.orbitX = orbitX
  space.orbitY = orbitY
}

/**
 * The direction the second hole stands in along its orbit, laid flat onto a plane facing `normalX`..
 * `normalZ`: the orbit's plane turned onto it by the shortest turn, so that it turns there at the pair's own
 * even pace, where its shadow on the plane sweeps round unevenly. `plane` is the pair's plane (two
 * directions, then the way it faces), `phase` the pair's angle; `out` takes the direction in the scene.
 */
export function orbitOnSheet (plane: ArrayLike<number>, phase: number, normalX: number, normalY: number, normalZ: number, out: Float64Array) {
  const cos = Math.cos(phase)
  const sin = Math.sin(phase)
  const x = plane[0] * cos + plane[3] * sin
  const y = plane[1] * cos + plane[4] * sin
  const z = plane[2] * cos + plane[5] * sin
  // Onto the side of the plane the orbit faces, so the two turn the same way round
  const side = plane[6] * normalX + plane[7] * normalY + plane[8] * normalZ < 0 ? -1 : 1
  turnOnto(plane[6], plane[7], plane[8], normalX * side, normalY * side, normalZ * side, x, y, z, out, 0)
}

// A direction of the scene along one of the equator's rows (0: its first direction, 3: its second, 6: the
// way it faces)
function onPlane (equator: ArrayLike<number>, row: number, x: number, y: number, z: number) {
  return x * equator[row] + y * equator[row + 1] + z * equator[row + 2]
}

// dent() of DENT_GLSL (webgl_shaders.ts): how deep the sheet lies this far from a hole whose shadow has the
// radius `edge`, as a share of its depth at the shadow's edge
function dent (away: number, edge: number) {
  if (!(edge > 0)) return 0
  const x = Math.min(edge / Math.max(away, edge), 1)
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}

/**
 * Where a point lying on the sheet as it was last placed is seen on the scene's frame, in CSS pixels before
 * the scene camera's zoom and shake: `x`, `y` in the main well's radii from its middle, along the plane's
 * first direction and against its second (to the right and away from the flat camera), sunk into the wells
 * as the surface is; their waves are left out. Null while no sheet is laid, and for a point nearer than its
 * near plane.
 */
export function sheetPoint (grid: GridSettings, x: number, y: number): { x: number, y: number } | null {
  if (!(grid.throat > 0)) return null
  const pose = grid.pose
  const alongX = x * grid.throat
  const alongY = -y * grid.throat
  const depth = grid.depth * dent(Math.hypot(alongX, alongY), grid.throat) +
    (grid.depth2 > 0 ? grid.depth2 * dent(Math.hypot(alongX - grid.well2X, alongY - grid.well2Y), grid.throat2) : 0)
  const seenX = pose[0] * alongX + pose[4] * alongY + pose[8] * depth + pose[12]
  const seenY = pose[1] * alongX + pose[5] * alongY + pose[9] * depth + pose[13]
  const seenZ = pose[2] * alongX + pose[6] * alongY + pose[10] * depth + pose[14]
  if (!(seenZ > pose[7])) return null
  return { x: pose[11] + seenX * pose[3] / seenZ, y: pose[15] + seenY * pose[3] / seenZ }
}

/**
 * Sets the sheet for this frame from the two layouts: `shared` of the way from the flat camera's (0) to the
 * 3D camera's (1), so switching 3D on turns the sheet from its diagram view to where it lies in the scene.
 * The pair's spiral wave turns with the line between the two wells, or `orbitShare` of the way toward the
 * orbit itself laid flat onto the sheet.
 * A layout not taken part in is not read. Between the two the pose is turned from the one to the other
 * `turn` of the way from mixing its numbers each on its own (0), and the lines slide that share of the way
 * from the whole way to the nearest line. The lines are `cell` apart and reach `spanSides` long screen
 * sides from the hole, fading out over the share `fade` of that. `holeX`, `holeY` is where the main hole is
 * drawn (CSS pixels), which the hole's point of the well stays on as the one pose turns into the other.
 */
export function placeSheet (
  grid: GridSettings,
  shared: number,
  equator: ArrayLike<number>,
  cell: number,
  width: number,
  height: number,
  spanSides: number,
  fade: number,
  holeX: number,
  holeY: number,
  orbitShare: number,
  turn: number
) {
  const from = shared >= 1 ? space : flat
  const to = shared <= 0 ? flat : space
  const share = shared <= 0 ? 0 : Math.min(shared, 1)
  const pose = grid.pose
  for (let slot = 0; slot < SHEET_POSE_SLOTS; slot++) pose[slot] = mix(from.pose[slot], to.pose[slot], share)
  grid.throat = mix(from.throat, to.throat, share)
  grid.depth = mix(from.depth, to.depth, share)
  grid.holeDepth = mix(from.holeDepth, to.holeDepth, share)
  let anchorX = to.anchorX - from.anchorX
  let anchorY = to.anchorY - from.anchorY
  if (share > 0 && share < 1) {
    if (turn > 0) {
      turnPose(from.pose, to.pose, share)
      for (let slot = 0; slot < 11; slot++) {
        if (slot !== 3 && slot !== 7) pose[slot] = mix(pose[slot], turned[slot], turn)
      }
      // The lines move to the nearest line of the other count rather than the whole way
      const cellSize = Math.max(cell, 1)
      anchorX -= turn * cellSize * Math.round(anchorX / cellSize)
      anchorY -= turn * cellSize * Math.round(anchorY / cellSize)
    }
    // Both layouts put the hole's point of the well on the hole, but a blend of their places is seen off it
    // through the blended pose: that point takes the blended distance and the hole's place on the screen,
    // and the plane hangs from it
    const away = mix(from.pose[14] + from.pose[10] * from.holeDepth, to.pose[14] + to.pose[10] * to.holeDepth, share)
    if (away > 0 && pose[3] > 0) {
      const pointX = (holeX - pose[11]) * away / pose[3]
      const pointY = (holeY - pose[15]) * away / pose[3]
      pose[12] = pointX - pose[8] * grid.holeDepth
      pose[13] = pointY - pose[9] * grid.holeDepth
      pose[14] = away - pose[10] * grid.holeDepth
    }
  }
  grid.well2X = mix(from.well2X, to.well2X, share)
  grid.well2Y = mix(from.well2Y, to.well2Y, share)
  // A well that is there in only one of the two grows in place
  grid.throat2 = mix(from.throat2, to.throat2, share)
  grid.depth2 = mix(from.depth2, to.depth2, share)
  grid.pairX = mix(from.pairX, to.pairX, share)
  grid.pairY = mix(from.pairY, to.pairY, share)
  grid.pairPhase = Math.atan2(grid.well2Y, grid.well2X)
  if (orbitShare > 0) {
    const wells = Math.hypot(grid.well2X, grid.well2Y)
    const orbitX = mix(from.orbitX, to.orbitX, share)
    const orbitY = mix(from.orbitY, to.orbitY, share)
    const orbit = Math.hypot(orbitX, orbitY)
    if (wells > 0 && orbit > 0) {
      grid.pairPhase = Math.atan2(mix(grid.well2Y / wells, orbitY / orbit, orbitShare), mix(grid.well2X / wells, orbitX / orbit, orbitShare))
    }
  }
  grid.ringPhase = Math.atan2(mix(from.ringY, to.ringY, share), mix(from.ringX, to.ringX, share))
  grid.anchorX = from.anchorX + anchorX * share
  grid.anchorY = from.anchorY + anchorY * share
  grid.unit = mix(from.unit, to.unit, share)
  grid.shared = share
  // Particles on Sheet measures a height the way the well goes down, as the flat mode's step does
  const down = equator[8] < 0 ? -1 : 1
  grid.down = down
  for (let slot = 0; slot < 9; slot++) grid.equator[slot] = slot < 6 ? equator[slot] : equator[slot] * down
  grid.cell = cell
  grid.span = Math.min(spanSides * Math.max(width, height), GRID_LINES_PER_SIDE * cell)
  grid.fadeFrom = (1 - fade) * grid.span
}

// The pose's three directions turned `share` of the way from one layout's to the other's, kept at module
// level so that turning allocates nothing: the plane's first direction in 0..2, its second in 4..6, the way
// the wells go down in 8..10
const turned = new Float64Array(SHEET_POSE_SLOTS)

// Turns the plane's first direction and the way the wells go down from one pose to the other about the one
// axis that takes both there, as a camera turns, and sets the plane's second direction square to the two,
// on the side each pose has it: a pose seen from its other side (the 3D camera's, with the equator facing
// the camera) passes through the line between, as a mix of the numbers does
function turnPose (a: ArrayLike<number>, b: ArrayLike<number>, share: number) {
  // Each pose's turn as three columns: the first direction, the way down, and the third square to them
  frame(a, frameA)
  frame(b, frameB)
  // The turn from the one to the other, R = B Aᵀ, row by row
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      relative[row * 3 + column] = frameB[row] * frameA[column] + frameB[3 + row] * frameA[3 + column] + frameB[6 + row] * frameA[6 + column]
    }
  }
  const trace = relative[0] + relative[4] + relative[8]
  const angle = Math.acos(Math.min(Math.max((trace - 1) / 2, -1), 1))
  let ax = relative[7] - relative[5]
  let ay = relative[2] - relative[6]
  let az = relative[3] - relative[1]
  let length = Math.hypot(ax, ay, az)
  if (length < 1e-6) {
    // No turn, or half a turn, where the axis is read from the diagonal: the largest of its parts and the
    // others from the row of it
    if (angle < 1) {
      ax = 0
      ay = 0
      az = 1
    } else {
      const xx = Math.max((relative[0] + 1) / 2, 0)
      const yy = Math.max((relative[4] + 1) / 2, 0)
      const zz = Math.max((relative[8] + 1) / 2, 0)
      if (xx >= yy && xx >= zz) {
        ax = Math.sqrt(xx)
        ay = (relative[1] + relative[3]) / (4 * ax)
        az = (relative[2] + relative[6]) / (4 * ax)
      } else if (yy >= zz) {
        ay = Math.sqrt(yy)
        ax = (relative[1] + relative[3]) / (4 * ay)
        az = (relative[5] + relative[7]) / (4 * ay)
      } else {
        az = Math.sqrt(zz)
        ax = (relative[2] + relative[6]) / (4 * az)
        ay = (relative[5] + relative[7]) / (4 * az)
      }
    }
    length = Math.hypot(ax, ay, az) || 1
  }
  ax /= length
  ay /= length
  az /= length
  const theta = angle * share
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  // Rodrigues: v cos + (k × v) sin + k (k · v)(1 - cos), for the first direction and the way down
  for (let column = 0; column < 2; column++) {
    const vx = frameA[column * 3]
    const vy = frameA[column * 3 + 1]
    const vz = frameA[column * 3 + 2]
    const along = (ax * vx + ay * vy + az * vz) * (1 - cos)
    const slot = column === 0 ? 0 : 8
    turned[slot] = vx * cos + (ay * vz - az * vy) * sin + ax * along
    turned[slot + 1] = vy * cos + (az * vx - ax * vz) * sin + ay * along
    turned[slot + 2] = vz * cos + (ax * vy - ay * vx) * sin + az * along
  }
  // The second direction is the way down across the first, on the side of each pose's, blended
  const side = mix(handed(a), handed(b), share)
  turned[4] = (turned[9] * turned[2] - turned[10] * turned[1]) * side
  turned[5] = (turned[10] * turned[0] - turned[8] * turned[2]) * side
  turned[6] = (turned[8] * turned[1] - turned[9] * turned[0]) * side
}

const frameA = new Float64Array(9)
const frameB = new Float64Array(9)
const relative = new Float64Array(9)

// A pose's first direction, its way down and the third direction square to both, as the columns of a turn
function frame (pose: ArrayLike<number>, out: Float64Array) {
  const ux = pose[0]
  const uy = pose[1]
  const uz = pose[2]
  const nx = pose[8]
  const ny = pose[9]
  const nz = pose[10]
  out[0] = ux
  out[1] = uy
  out[2] = uz
  out[3] = nx
  out[4] = ny
  out[5] = nz
  out[6] = uy * nz - uz * ny
  out[7] = uz * nx - ux * nz
  out[8] = ux * ny - uy * nx
}

// 1 where a pose's second direction is the way down across its first, -1 where it is the other way
function handed (pose: ArrayLike<number>) {
  const cx = pose[9] * pose[2] - pose[10] * pose[1]
  const cy = pose[10] * pose[0] - pose[8] * pose[2]
  const cz = pose[8] * pose[1] - pose[9] * pose[0]
  return cx * pose[4] + cy * pose[5] + cz * pose[6] < 0 ? -1 : 1
}

// Between two numbers, by a share
function mix (a: number, b: number, share: number) {
  return a + (b - a) * share
}

// The waves the composite pass slides the sky by, as the scene hands them over (CompositeSettings)
export interface SheetWaveSource {
  gravityWaveAmplitude: number
  gravityWaveTime: number
  gravityWaveFrequency: number
  gravityWaveDecay: number
  gravityWaveRadius: number
  gravityWaveSpeed: number
  gravityWaveSpin: number
  pairWave: number
  pairPitch: number
  pairFront: number
  pairFrontSoft: number
}

/**
 * Sets the sheet's waves for this frame from the sky's (`waves`), each lifted `waveLift` times as high: the
 * wave of a ringing hole, and the pair's spiral wave while there is a second well. Once a frame, after the
 * sheet is placed; the grid program, the field's step and the flows all read them (SHEET_GLSL)
 */
export function waveSheet (grid: GridSettings, waves: SheetWaveSource) {
  const wave = grid.wave
  wave.fill(0)
  if (waves.gravityWaveAmplitude > 0 && grid.waveLift > 0) {
    wave[0] = waves.gravityWaveAmplitude * grid.waveLift
    wave[1] = waves.gravityWaveTime
    wave[2] = 2 * Math.PI * waves.gravityWaveFrequency
    wave[3] = 1 / Math.max(waves.gravityWaveDecay, 0.001)
    wave[4] = Math.max(waves.gravityWaveRadius, 1)
    wave[5] = Math.max(waves.gravityWaveSpeed, 1)
    // The sheet's waves count their angles the other way round, so the oval turns the other way
    wave[8] = Math.cos(2 * grid.ringPhase)
    wave[9] = Math.sin(2 * grid.ringPhase)
    wave[10] = -waves.gravityWaveSpin
  }
  wave[15] = 1
  // The sheet's waves count their angles the other way round, so the pair's turns the other way
  if (waves.pairWave > 0 && grid.throat2 > 0 && grid.waveLift > 0) {
    wave[12] = waves.pairWave * grid.waveLift
    wave[13] = grid.pairPhase
    wave[14] = -waves.pairPitch
    wave[15] = Math.max(waves.gravityWaveRadius, 1)
    wave[16] = grid.pairX
    wave[17] = grid.pairY
    wave[20] = waves.pairFront
    wave[21] = Math.max(waves.gravityWaveSpeed, 1)
    wave[22] = Math.max(waves.pairFrontSoft, 0.001)
  }
}

// The uniforms SHEET_GLSL reads, by their names without u_, as a program holds them
type SheetUniforms<U> = Record<'sheetU' | 'sheetV' | 'sheetN' | 'sheetO' | 'sheetWell' | 'sheetWell2' | 'sheetWave' | 'sheetWaveSpread' |
  'sheetWaveTurn' | 'sheetPairWave' | 'sheetPairAt' | 'sheetPairFront', U>

// The names of those uniforms, for a program to look them up
export const SHEET_UNIFORMS = [
  'sheetU', 'sheetV', 'sheetN', 'sheetO', 'sheetWell', 'sheetWell2', 'sheetWave', 'sheetWaveSpread', 'sheetWaveTurn', 'sheetPairWave', 'sheetPairAt', 'sheetPairFront'
] as const

// Hands the surface, its pose and its waves to a program that reads SHEET_GLSL, through that program's setter
export function sendSheet<U> (set: (uniform: U, x: number, y: number, z: number, w: number) => void, u: SheetUniforms<U>, grid: GridSettings) {
  const pose = grid.pose
  set(u.sheetU, pose[0], pose[1], pose[2], pose[3])
  set(u.sheetV, pose[4], pose[5], pose[6], pose[7])
  set(u.sheetN, pose[8], pose[9], pose[10], pose[11])
  set(u.sheetO, pose[12], pose[13], pose[14], pose[15])
  set(u.sheetWell, grid.throat, grid.depth, grid.holeDepth, 0)
  set(u.sheetWell2, grid.well2X, grid.well2Y, grid.throat2, grid.depth2)
  const wave = grid.wave
  set(u.sheetWave, wave[0], wave[1], wave[2], wave[3])
  set(u.sheetWaveSpread, wave[4], wave[5], wave[6], wave[7])
  set(u.sheetWaveTurn, wave[8], wave[9], wave[10], wave[11])
  set(u.sheetPairWave, wave[12], wave[13], wave[14], wave[15])
  set(u.sheetPairAt, wave[16], wave[17], wave[18], wave[19])
  set(u.sheetPairFront, wave[20], wave[21], wave[22], wave[23])
}
