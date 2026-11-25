// The particle field in three dimensions: a fork of the flat loop (particle_simulation.ts) for the 3D
// switch. The flat loop pulls a particle where it lands on the screen, inside a layer of depth around the
// black hole, and the event horizon takes whatever covers the hole at any depth. Here the black holes are
// points in space: gravity pulls along the true distance and ends at a sphere of Gravity Reach, the orbital
// force turns particles around the line of flight, and the horizon is a sphere. The camera circles the
// point at holeDepth on the line of flight (yaw around the screen's vertical, pitch above or below), so
// the field is a column of particles flowing past the hole that can be seen from any side. Straight on, at
// yaw and pitch 0, it projects as the flat loop does.
//
// The field, the spawn, the segments and what a crew leaves for later are the flat loop's own: a segment
// is still a stroke on the screen, so the renderer draws both the same way.
import { depositRingEnergy } from './ring_energy'
import { nextRandom } from './random'
import {
  DRAG_SHARE, INSTANCE_FLOATS, SPEED_FLOOR_SQ, fillInertiaStep, spawnParticle,
  type InstanceData, type ParticleField, type SpawnSettings, type StepLater, type StepSettings
} from './particle_simulation'

// The flat loop's constants, which this loop keeps
const MIN_CLIP_MARGIN = 4
const RESPAWN_TRIES = 4
const RESPAWN_RIM_SPREAD = 0.5

// Strokes are cut where they pass this close in front of the camera, in scene units
const NEAR = 1

const RESPAWN_FAR = 0
const RESPAWN_HOLE = 1
const RESPAWN_COMPANION = 2

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

// The camera now and in the frame before, kept at module level so the loop allocates nothing
const turn = new Float64Array(9)
const turnFrom = new Float64Array(9)

// Liang-Barsky clipping state, as in the flat loop
let clipStart = 0
let clipEnd = 1

function clipAgainst (p: number, q: number): boolean {
  if (p === 0) return q >= 0
  const t = q / p
  if (p < 0) {
    if (t > clipEnd) return false
    if (t > clipStart) clipStart = t
  } else {
    if (t < clipStart) return false
    if (t < clipEnd) clipEnd = t
  }
  return true
}

// Brings a captured particle back at the far end of the column, outside the horizon's sphere, so a horizon
// that reaches the far end cannot keep the whole field
function respawnBeyondSphere (
  field: ParticleField,
  i: number,
  spawn: SpawnSettings,
  holeX: number,
  holeY: number,
  holeZ: number,
  captureRadius: number
) {
  const captureRadiusSq = captureRadius * captureRadius
  const dz = spawn.farZ - holeZ
  for (let attempt = 0; attempt < RESPAWN_TRIES; attempt++) {
    spawnParticle(field, i, spawn.farZ, spawn)
    const dx = field.x[i] - holeX
    const dy = field.y[i] - holeY
    if (dx * dx + dy * dy + dz * dz >= captureRadiusSq) return
  }
  const angle = nextRandom(spawn.random) * Math.PI * 2
  const radius = captureRadius * (1 + nextRandom(spawn.random) * RESPAWN_RIM_SPREAD)
  field.x[i] = holeX + Math.cos(angle) * radius
  field.y[i] = holeY + Math.sin(angle) * radius
}

/**
 * Advances every particle by one frame in three dimensions and writes the visible segments into `out`.
 * Returns the number of instances written.
 */
export function stepParticles3d (
  field: ParticleField,
  settings: StepSettings,
  spawn: SpawnSettings,
  out: InstanceData
): number {
  return stepRange3d(field, settings, spawn, out, 0, field.count, null)
}

/**
 * The 3D hot loop over the particles `from`..`to`, with the flat loop's contract (stepRange): segments go
 * into `out` from slot `from`, and with `later` the respawns and the ring's light are written down for
 * settleLater3d instead of done.
 * Returns the number of instances written.
 */
export function stepRange3d (
  field: ParticleField,
  settings: StepSettings,
  spawn: SpawnSettings,
  out: InstanceData,
  from: number,
  to: number,
  later: StepLater | null
): number {
  const { x, y, z, alpha, pulsePhase, pulseSpeed, speedMultiplier, color, vx, vy, vz } = field
  const { floats, colors } = out
  const {
    frameScale, time, width, height, focal, vanishX, vanishY, holeRadius, holeDepth,
    gravityStrength, orbitalStrength, farZ, depthFade, pulseIntensity, baseBrightness,
    minOpacity, maxOpacity, revealRadius, revealFeather, opacityScale
  } = settings

  // Lengths around the black hole arrive in CSS pixels at its depth, the place the camera circles; there
  // they are this many scene units
  const pivot = holeDepth
  const worldPerPixel = pivot / focal
  cameraTurn(settings.cameraYaw, settings.cameraPitch, turn)
  cameraTurn(settings.cameraYawFrom, settings.cameraPitchFrom, turnFrom)
  // Row 0 has no y term: yaw turns around the vertical
  const m0 = turn[0]
  const m2 = turn[2]
  const m3 = turn[3]
  const m4 = turn[4]
  const m5 = turn[5]
  const m6 = turn[6]
  const m7 = turn[7]
  const m8 = turn[8]
  const f0 = turnFrom[0]
  const f2 = turnFrom[2]
  const f3 = turnFrom[3]
  const f4 = turnFrom[4]
  const f5 = turnFrom[5]
  const f6 = turnFrom[6]
  const f7 = turnFrom[7]
  const f8 = turnFrom[8]

  const step = settings.speed * frameScale
  const pulseRate = settings.pulseSpeedMultiplier
  const invFarZ = 1 / farZ
  const holeX = settings.holeWorldX
  const holeY = settings.holeWorldY
  const holeZ = settings.holeWorldZ
  const hasHole = holeRadius > 0 && holeX === holeX && holeY === holeY && holeZ === holeZ
  const radius = holeRadius * worldPerPixel
  const reach = settings.gravityReach * worldPerPixel
  const reachSq = reach * reach
  const captureRadius = settings.captureRadius * worldPerPixel
  const captureRadiusSq = captureRadius * captureRadius
  const ringEnergy = settings.ringEnergy
  const captureEnergy = settings.ringCaptureEnergy
  const skimRadius = radius * settings.ringSkimReach
  const skimRadiusSq = skimRadius * skimRadius
  const skimEnergy = settings.ringSkimEnergy * frameScale
  const nearLineWidth = settings.lineWidth
  const minLineWidth = settings.minLineWidth
  // The flat loop's pull, (radius / distance)^2 screen pixels a frame turned into scene units at the
  // hole's depth, along the true distance. It does not depend on the flight speed
  const pullScale = gravityStrength * 0.6 * frameScale * radius * radius * worldPerPixel
  const orbitScale = orbitalStrength * 0.02
  // Frame dragging: space turns about the spin's axis, which in 3D stands in the scene, at a rate that
  // falls as 1 / r^3 and as a share of the pull, as in the flat loop. The spin arrives as (right, up,
  // toward the camera) seen straight on; the scene's y runs down and its z away from the camera
  const dragScale = DRAG_SHARE * radius
  const dragX = settings.spinRight * dragScale
  const dragY = -settings.spinUp * dragScale
  const dragZ = -settings.spinToward * dragScale
  const dragging = hasHole && (dragX !== 0 || dragY !== 0 || dragZ !== 0)
  const { inertial, keep, gain, velocityGain } = fillInertiaStep(settings.inertia, frameScale)
  const companionRadius = settings.companionRadius
  const hasCompanion = hasHole && companionRadius > 0
  const companionX = settings.companionWorldX
  const companionY = settings.companionWorldY
  const companionZ = settings.companionWorldZ
  const companionCapture = settings.companionCapture * worldPerPixel
  const companionCaptureSq = companionCapture * companionCapture
  const companionShare = hasCompanion ? companionRadius / holeRadius : 0
  const companionReachSq = reachSq * companionShare * companionShare
  const companionPullScale = pullScale * companionShare * companionShare
  const revealing = revealRadius < Infinity
  const revealX = settings.revealX
  const revealY = settings.revealY
  const pulsing = pulseIntensity !== 0
  const revealRadiusSq = revealRadius * revealRadius
  const invRevealFeather = 1 / Math.max(revealFeather, 1)
  // Straight on, the ends of the column are the far end and the camera itself, as in the flat loop; the
  // more the camera turns away from that, the more they fade (m8 is the cosine of the angle it turned),
  // over the share of Field Depth the step is given (endFade)
  const endWeight = Math.min(1 - m8, 1)
  const fadingEnds = endWeight > 1e-6 && settings.endFade > 0
  const invEndFade = 1 / (farZ * settings.endFade)
  const clipMargin = Math.max(MIN_CLIP_MARGIN, nearLineWidth * 0.5 + 2)
  const minX = -clipMargin
  const minY = -clipMargin
  const maxX = width + clipMargin
  const maxY = height + clipMargin

  let written = from

  for (let i = from; i < to; i++) {
    let px = x[i]
    let py = y[i]
    const startZ = z[i]
    // Where the particle stood, through the camera of the frame before
    const rz = startZ - pivot
    let sx = f0 * px + f2 * rz
    let sy = f3 * px + f4 * py + f5 * rz
    let sz = f6 * px + f7 * py + f8 * rz + pivot

    let pz = startZ - step * speedMultiplier[i]
    if (pz <= 0) {
      if (later) later.respawns[from + later.respawnCount++] = i * 4 + RESPAWN_FAR
      else spawnParticle(field, i, farZ, spawn)
      continue
    }

    // A particle the holes set moving drifts on with what it kept of that speed
    let speedX = 0
    let speedY = 0
    let speedZ = 0
    if (inertial) {
      speedX = vx[i] * keep
      speedY = vy[i] * keep
      speedZ = vz[i] * keep
      px += speedX * frameScale
      py += speedY * frameScale
      pz += speedZ * frameScale
    }

    if (hasHole) {
      const dx = holeX - px
      const dy = holeY - py
      const dz = holeZ - pz
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq < reachSq) {
        if (distSq < captureRadiusSq) {
          if (ringEnergy) {
            // The light lands on the ring where the particle is seen around the hole
            const ringX = -(m0 * dx + m2 * dz)
            const ringY = -(m3 * dx + m4 * dy + m5 * dz)
            if (later) noteDeposit(later, from, ringX, ringY, captureEnergy)
            else depositRingEnergy(ringEnergy, ringX, ringY, captureEnergy)
          }
          if (later) later.respawns[from + later.respawnCount++] = i * 4 + RESPAWN_HOLE
          else respawnBeyondSphere(field, i, spawn, holeX, holeY, holeZ, captureRadius)
          continue
        }

        if (ringEnergy && distSq < skimRadiusSq) {
          const ringX = -(m0 * dx + m2 * dz)
          const ringY = -(m3 * dx + m4 * dy + m5 * dz)
          if (later) noteDeposit(later, from, ringX, ringY, skimEnergy)
          else depositRingEnergy(ringEnergy, ringX, ringY, skimEnergy)
        }

        // Pull along the distance, orbit around the line of flight through the hole, and space carried
        // round the spin's axis: the axis crossed with where the particle is from the hole
        const clampedSq = distSq > 1 ? distSq : 1
        const distance = Math.sqrt(clampedSq)
        const pull = pullScale / (clampedSq * distance)
        const orbit = pull * orbitScale
        let pushX = dx * pull - dy * orbit
        let pushY = dy * pull + dx * orbit
        let pushZ = dz * pull
        if (dragging) {
          const drag = pull / distance
          pushX -= (dragY * dz - dragZ * dy) * drag
          pushY -= (dragZ * dx - dragX * dz) * drag
          pushZ -= (dragX * dy - dragY * dx) * drag
        }
        if (inertial) {
          speedX += pushX * velocityGain
          speedY += pushY * velocityGain
          speedZ += pushZ * velocityGain
          pushX *= gain
          pushY *= gain
          pushZ *= gain
        }
        px += pushX
        py += pushY
        pz += pushZ
      }
    }

    // The second black hole takes and pulls particles the same way; the light they leave is not tracked
    if (hasCompanion) {
      const dx = companionX - px
      const dy = companionY - py
      const dz = companionZ - pz
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq < companionReachSq) {
        if (distSq < companionCaptureSq) {
          if (later) later.respawns[from + later.respawnCount++] = i * 4 + RESPAWN_COMPANION
          else respawnBeyondSphere(field, i, spawn, companionX, companionY, companionZ, companionCapture)
          continue
        }
        const clampedSq = distSq > 1 ? distSq : 1
        const pull = companionPullScale / (clampedSq * Math.sqrt(clampedSq))
        const orbit = pull * orbitScale
        let pushX = dx * pull - dy * orbit
        let pushY = dy * pull + dx * orbit
        let pushZ = dz * pull
        if (inertial) {
          speedX += pushX * velocityGain
          speedY += pushY * velocityGain
          speedZ += pushZ * velocityGain
          pushX *= gain
          pushY *= gain
          pushZ *= gain
        }
        px += pushX
        py += pushY
        pz += pushZ
      }
    }

    x[i] = px
    y[i] = py
    z[i] = pz
    if (inertial) {
      const moving = speedX * speedX + speedY * speedY + speedZ * speedZ > SPEED_FLOOR_SQ
      vx[i] = moving ? speedX : 0
      vy[i] = moving ? speedY : 0
      vz[i] = moving ? speedZ : 0
    }

    // Where it stands now, through the camera of this frame
    const ez0 = pz - pivot
    let ex = m0 * px + m2 * ez0
    let ey = m3 * px + m4 * py + m5 * ez0
    let ez = m6 * px + m7 * py + m8 * ez0 + pivot

    // A stroke that passes behind the camera is cut where it crosses the near plane
    if (sz < NEAR || ez < NEAR) {
      if (sz < NEAR && ez < NEAR) continue
      const t = (NEAR - sz) / (ez - sz)
      if (sz < NEAR) {
        sx += (ex - sx) * t
        sy += (ey - sy) * t
        sz = NEAR
      } else {
        ex = sx + (ex - sx) * t
        ey = sy + (ey - sy) * t
        ez = NEAR
      }
    }

    const startScale = focal / sz
    const startX = sx * startScale + vanishX
    const startY = sy * startScale + vanishY
    const endScale = focal / ez
    const endX = ex * endScale + vanishX
    const endY = ey * endScale + vanishY

    // A particle that did not move draws nothing, which also saves its stroke
    if (endX === startX && endY === startY) continue

    // Width and the fade with distance follow the distance from the camera, which is the depth straight on
    const distanceFactor = ez < farZ ? ez * invFarZ : 1
    const depthFactor = 1 - distanceFactor * depthFade
    const depthWidth = (1 - distanceFactor) * nearLineWidth
    const lineWidth = depthWidth > minLineWidth ? depthWidth : minLineWidth

    const pulseFactor = pulsing
      ? 1 + Math.sin(time * pulseSpeed[i] * pulseRate + pulsePhase[i]) * pulseIntensity * distanceFactor
      : 1

    let opacity = depthFactor * alpha[i] * pulseFactor * baseBrightness
    if (opacity > maxOpacity) opacity = maxOpacity
    if (opacity < minOpacity) opacity = minOpacity
    opacity *= opacityScale

    if (fadingEnds) {
      const toFar = (farZ - pz) * invEndFade
      const toNear = pz * invEndFade
      const end = toFar < toNear ? toFar : toNear
      if (end < 1) opacity *= 1 - endWeight * (1 - (end > 0 ? end : 0))
    }

    if (revealing) {
      const rx = endX - revealX
      const ry = endY - revealY
      const radialSq = rx * rx + ry * ry
      if (radialSq > revealRadiusSq) continue
      const edge = (revealRadius - Math.sqrt(radialSq)) * invRevealFeather
      if (edge < 1) opacity *= edge
    }
    if (opacity <= 0) continue

    let x0 = startX
    let y0 = startY
    let x1 = endX
    let y1 = endY

    const startInside = x0 >= minX && x0 <= maxX && y0 >= minY && y0 <= maxY
    const endInside = x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY
    if (!startInside || !endInside) {
      const dx = x1 - x0
      const dy = y1 - y0
      clipStart = 0
      clipEnd = 1
      if (
        !clipAgainst(-dx, x0 - minX) ||
        !clipAgainst(dx, maxX - x0) ||
        !clipAgainst(-dy, y0 - minY) ||
        !clipAgainst(dy, maxY - y0)
      ) continue

      x1 = x0 + clipEnd * dx
      y1 = y0 + clipEnd * dy
      x0 += clipStart * dx
      y0 += clipStart * dy
    }

    const o = written * INSTANCE_FLOATS
    floats[o] = x0
    floats[o + 1] = y0
    floats[o + 2] = x1
    floats[o + 3] = y1
    floats[o + 4] = lineWidth
    floats[o + 5] = opacity
    colors[o + 6] = color[i]
    written++
  }

  return written - from
}

function noteDeposit (later: StepLater, from: number, x: number, y: number, amount: number) {
  const o = (from + later.depositCount++) * 3
  later.deposits[o] = x
  later.deposits[o + 1] = y
  later.deposits[o + 2] = amount
}

// Does what stepRange3d wrote down for the part that starts at `from`: the ring's light, then the respawns
export function settleLater3d (
  field: ParticleField,
  settings: StepSettings,
  spawn: SpawnSettings,
  later: StepLater,
  from: number
) {
  const { ringEnergy, holeDepth, focal } = settings
  const { respawns, deposits } = later
  if (ringEnergy) {
    const end = (from + later.depositCount) * 3
    for (let o = from * 3; o < end; o += 3) depositRingEnergy(ringEnergy, deposits[o], deposits[o + 1], deposits[o + 2])
  }
  const worldPerPixel = holeDepth / focal
  for (let slot = from; slot < from + later.respawnCount; slot++) {
    const i = respawns[slot] >> 2
    const kind = respawns[slot] & 3
    if (kind === RESPAWN_FAR) {
      spawnParticle(field, i, settings.farZ, spawn)
    } else if (kind === RESPAWN_HOLE) {
      respawnBeyondSphere(field, i, spawn, settings.holeWorldX, settings.holeWorldY, settings.holeWorldZ, settings.captureRadius * worldPerPixel)
    } else {
      respawnBeyondSphere(
        field, i, spawn, settings.companionWorldX, settings.companionWorldY, settings.companionWorldZ, settings.companionCapture * worldPerPixel
      )
    }
  }
}
