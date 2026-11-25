// The space lattice: lines along all three axes of the scene around the black hole, drawn in towards it by
// gravity, the classic picture of curved space in three dimensions. Like the sheet it is a diagram: every
// node is pulled towards the hole by as much as time is slowed where it stands, the measure the sheet's well
// uses, so the lattice is straight far away and tightest at the shadow's edge. The lines stay where they are
// in the scene while the black hole moves through them.
// The lines are a static buffer of pieces that the lattice vertex shader bends and sets in front of the
// camera, the 3D camera's or, in the flat mode, the camera straight on. They are drawn into the layer the
// orbits' traces live in, which the composite pass reads through the lens, so the lattice behind the hole
// is bent by it and the shadow covers it. The buffer is made the first time the lattice is shown, and the
// lattice costs the main thread a few numbers a frame while it is on and nothing while it is off.
import { POSE_SLOTS } from './particle_simulation_3d'

// Lines on each side of the black hole across each axis, and the pieces each line is drawn in
export const LATTICE_LINES_PER_SIDE = 6
export const LATTICE_SEGMENTS = 48
export const LATTICE_INSTANCE_FLOATS = 4
const LINES_ACROSS = 2 * LATTICE_LINES_PER_SIDE + 1
export const LATTICE_INSTANCE_COUNT = 3 * LINES_ACROSS * LINES_ACROSS * LATTICE_SEGMENTS

// Lengths in scene units unless said otherwise
export interface LatticeSettings {
  // Brightness of the lines; 0 draws nothing
  brightness: number
  cell: number
  // How far from the black hole the lines reach, and the distance from it they begin to fade out at
  reach: number
  fadeFrom: number
  // How strongly the nodes are pulled in: the slowing of time in shadow radii, times this; 0 leaves the
  // lines straight
  warp: number
  // Where the lattice's nearest node lies from the black hole, as a share of a cell on each axis, so the
  // lines stay put in the scene while the hole moves
  anchorX: number
  anchorY: number
  anchorZ: number
  // The black hole and the radius of its shadow; a radius of 0 pulls nothing
  holeX: number
  holeY: number
  holeZ: number
  edge: number
  // A second black hole, the same way
  companionX: number
  companionY: number
  companionZ: number
  companionEdge: number
  // The camera: its pose (cameraPose: a turn, row-major 3 × 3, around the point at `pivot` on the line of
  // flight, then the offset in the camera's space), its focal length and the vanishing point in CSS pixels,
  // and the distance under which lines fade out as they come close to it
  turn: Float64Array
  pivot: number
  focal: number
  vanishX: number
  vanishY: number
  near: number
  // The distance from the camera a line is gone at: a share of `near`
  gone: number
  // The share of their light lines far behind the point the camera circles keep
  farthest: number
  // Width of a line in CSS pixels, the same at any zoom, and how much brighter than the grids' colour a
  // line is at full brightness: the lattice is read among the particles, not laid over them
  lineWidth: number
  gain: number
}

export function createLatticeSettings (): LatticeSettings {
  const turn = new Float64Array(POSE_SLOTS)
  turn[0] = 1
  turn[4] = 1
  turn[8] = 1
  return {
    brightness: 0,
    cell: 1,
    reach: 1,
    fadeFrom: 0.5,
    warp: 0,
    anchorX: 0,
    anchorY: 0,
    anchorZ: 0,
    holeX: 0,
    holeY: 0,
    holeZ: 1,
    edge: 0,
    companionX: 0,
    companionY: 0,
    companionZ: 1,
    companionEdge: 0,
    turn,
    pivot: 1,
    focal: 1,
    vanishX: 0,
    vanishY: 0,
    near: 1,
    gone: 0.25,
    farthest: 0.3,
    lineWidth: 1.5,
    gain: 1.6
  }
}

// One record per piece of a line: its two line numbers across the line, counted from the black hole, the
// piece's number along it, and the axis the line runs along (0 = x, 1 = y, 2 = z)
export function createLatticeInstances (): Float32Array {
  const instances = new Float32Array(LATTICE_INSTANCE_COUNT * LATTICE_INSTANCE_FLOATS)
  let offset = 0
  for (let axis = 0; axis < 3; axis++) {
    for (let first = -LATTICE_LINES_PER_SIDE; first <= LATTICE_LINES_PER_SIDE; first++) {
      for (let second = -LATTICE_LINES_PER_SIDE; second <= LATTICE_LINES_PER_SIDE; second++) {
        for (let piece = 0; piece < LATTICE_SEGMENTS; piece++) {
          instances[offset] = first
          instances[offset + 1] = second
          instances[offset + 2] = piece
          instances[offset + 3] = axis
          offset += LATTICE_INSTANCE_FLOATS
        }
      }
    }
  }
  return instances
}

// The share of a cell a coordinate lies past the lattice line just below it
export function latticeAnchor (offset: number, cell: number) {
  const cells = offset / cell
  return cells - Math.floor(cells)
}
