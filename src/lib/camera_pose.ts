// The 3D camera: where it stands and looks. The step of the field (field_step.ts), the lattice and the scene
// see the scene through these numbers; straight on, at a turn and an elevation of 0, they draw what the flat
// view draws.

// The turn from scene space to the camera's, a row-major 3 × 3: q = M (p - C) + C, where C is the point
// the camera circles. Yaw turns the camera around the screen's vertical (positive: the near side moves
// right), pitch raises it (positive: seen from above). Its transpose turns the camera's space back
export function cameraTurn (yaw: number, pitch: number, out: Float64Array) {
  const ca = Math.cos(yaw)
  const sa = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  out[0] = ca
  out[1] = 0
  out[2] = -sa
  out[3] = -sp * sa
  out[4] = cp
  out[5] = -sp * ca
  out[6] = cp * sa
  out[7] = sp
  out[8] = cp * ca
}

// Slots of a pose (cameraPose): the turn A row by row, then the offset b
export const POSE_SLOTS = 12

// Where the camera stands and looks, beyond its circle round the pivot c = (0, 0, pivot): a point p of the
// scene is at q = A (p - c) + b in the camera's space (across, down, ahead of it). The circle's turn M
// (cameraTurn) puts it as before; then the camera moves in its own axes (right, up, in toward what it
// looks at, in scene units), turns its head (to the right, then up) and rolls about its line of sight
// (positive turns the picture anticlockwise): A = R H M, b = R H ((0, 0, pivot) - move). With the move,
// the head and the roll at 0 it is the circle alone, number for number
export function cameraPose (
  yaw: number,
  pitch: number,
  roll: number,
  lookYaw: number,
  lookPitch: number,
  moveRight: number,
  moveUp: number,
  moveIn: number,
  pivot: number,
  out: Float64Array
) {
  cameraTurn(yaw, pitch, out)
  // The scene's y runs down, so a camera that rises sees everything lower
  out[9] = -moveRight
  out[10] = moveUp
  out[11] = pivot - moveIn
  // Looking to the right moves what is ahead to the left: x and z turn about the vertical
  if (lookYaw !== 0) {
    const c = Math.cos(lookYaw)
    const s = Math.sin(lookYaw)
    for (let column = 0; column < 4; column++) {
      const xi = column < 3 ? column : 9
      const zi = column < 3 ? column + 6 : 11
      const qx = out[xi]
      const qz = out[zi]
      out[xi] = c * qx - s * qz
      out[zi] = s * qx + c * qz
    }
  }
  // Looking up moves what is ahead down: y and z turn about the camera's own right
  if (lookPitch !== 0) {
    const c = Math.cos(lookPitch)
    const s = Math.sin(lookPitch)
    for (let column = 0; column < 4; column++) {
      const yi = column < 3 ? column + 3 : 10
      const zi = column < 3 ? column + 6 : 11
      const qy = out[yi]
      const qz = out[zi]
      out[yi] = c * qy + s * qz
      out[zi] = -s * qy + c * qz
    }
  }
  // The roll turns the picture about the line of sight
  if (roll !== 0) {
    const c = Math.cos(roll)
    const s = Math.sin(roll)
    for (let column = 0; column < 4; column++) {
      const xi = column < 3 ? column : 9
      const yi = column < 3 ? column + 3 : 10
      const qx = out[xi]
      const qy = out[yi]
      out[xi] = c * qx + s * qy
      out[yi] = -s * qx + c * qy
    }
  }
}

/**
 * Turns the direction `x`, `y`, `z` by the shortest turn that takes the unit direction `from` onto the
 * unit direction `to`, into `out` at `offset`. Two opposite directions are turned half round a
 * direction across them.
 */
export function turnOnto (
  fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number, x: number, y: number, z: number,
  out: Float64Array, offset: number
) {
  let kx = fromY * toZ - fromZ * toY
  let ky = fromZ * toX - fromX * toZ
  let kz = fromX * toY - fromY * toX
  const cos = fromX * toX + fromY * toY + fromZ * toZ
  let sin = Math.sqrt(kx * kx + ky * ky + kz * kz)
  if (sin < 1e-9) {
    if (cos > 0) {
      out[offset] = x
      out[offset + 1] = y
      out[offset + 2] = z
      return
    }
    // Half round: about the direction across `from` that lies nearest the screen's
    kx = Math.abs(fromX) < 0.9 ? 0 : -fromY
    ky = Math.abs(fromX) < 0.9 ? -fromZ : fromX
    kz = Math.abs(fromX) < 0.9 ? fromY : 0
    sin = Math.sqrt(kx * kx + ky * ky + kz * kz)
    kx /= sin
    ky /= sin
    kz /= sin
    sin = 0
  } else {
    kx /= sin
    ky /= sin
    kz /= sin
  }
  const along = (kx * x + ky * y + kz * z) * (1 - cos)
  out[offset] = x * cos + (ky * z - kz * y) * sin + kx * along
  out[offset + 1] = y * cos + (kz * x - kx * z) * sin + ky * along
  out[offset + 2] = z * cos + (kx * y - ky * x) * sin + kz * along
}
