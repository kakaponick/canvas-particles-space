// A second black hole. The two circle their common centre of mass, which is where the scene's black hole
// used to be, at the rate Kepler gives for their masses and distance, so the pair turns faster as it
// closes in. Their mass is their size. As their shadows overlap the main one takes the companion's mass
// and grows by it; at distance 0 they are one black hole.
//
// On the way in the pair sends out gravitational waves: a two-armed spiral that turns with it and
// strengthens as it tightens, the pattern a binary radiates in the plane of its orbit. The wave is
// strongest as the two become one, and from then on it is the ringing of the hole they leave: a spinning
// one, which rings higher and longer than a hole that formed alone, as an oval that keeps turning the way
// the two circled.
import { LIGHT_SPEED, SHADOW_RADII } from './orbiters'

// The pair never turns faster than it would this share of the way in from touching, so the last moment
// before the merger does not spin without bound
const CLOSEST_ORBIT = 0.6
// Stretch of the sky by the spiral wave at the shadow's edge while the two touch, in black hole radii
const WAVE_SHARE = 0.16
// The spin two black holes without spin leave behind, as a share of the most a hole can have, from their
// symmetric mass ratio m1 m2 / (m1 + m2)^2 (Buonanno, Kidder and Lehner 2008, as fitted by Barausse and
// Rezzolla 2009): 0.69 for two equal ones
const SPIN_FIT = [3.4641, -3.871, 4.028] as const
// The strongest tone of a spinning hole, its l = m = 2 mode (Berti, Cardoso and Will 2006): pitch
// f1 + f2 (1 - spin)^f3 in c^3 / GM, and the wobbles it rings for, q1 + q2 (1 - spin)^q3
const TONE_FIT = [1.5251, -1.1568, 0.1292] as const
const QUALITY_FIT = [0.7, 1.4187, -0.499] as const
// The same two for no spin, which is what the scene's ringdown is measured against
const TONE_STILL = TONE_FIT[0] + TONE_FIT[1]
const QUALITY_STILL = QUALITY_FIT[0] + QUALITY_FIT[1]

// Everything here is in radii of the main black hole before it grows, and relative to the pair's centre
export interface Pair {
  // Angle of the companion as seen from the main hole, radians on screen
  phase: number
  // Second of the scene the two became one; negative while they are apart
  mergedAt: number
  // The companion's radius; 0 while there is none
  companion: number
  // How much the main hole has grown by taking the companion in: 1 apart, 1 + its size when merged
  growth: number
  mainX: number
  mainY: number
  companionX: number
  companionY: number
  // Radians per second the pair turns; its sign is its direction
  omega: number
  // Stretch of the sky by the spiral wave at the shadow's edge
  wave: number
  // How far the two have become one: 0 until their shadows touch, 1 as one black hole
  merged: number
  // 4 m1 m2 / (m1 + m2)^2: 1 for two equal black holes, less the more they differ
  symmetry: number
  // The angle of the pair as the two became one, and the way they were turning: 1 or -1
  mergedPhase: number
  mergedTurn: number
  // The ringing of the hole they leave against that of a hole of its size without spin: how many times
  // higher its pitch is, and how many times longer it rings
  ringPitch: number
  ringLength: number
}

export function createPair (): Pair {
  return {
    phase: 0, mergedAt: -1, companion: 0, growth: 1, mainX: 0, mainY: 0, companionX: 0, companionY: 0, omega: 0, wave: 0,
    merged: 0, symmetry: 0, mergedPhase: 0, mergedTurn: 1, ringPitch: 1, ringLength: 1
  }
}

/**
 * Advances the pair by `dt` seconds. `size` is the companion's radius and `distance` the gap between the
 * centres, both in main hole radii; `speed` is the rate of the pair's time; `shadowShare` is the main
 * hole's radius as a share of the screen's short side; `time` is the scene's clock.
 */
export function stepPair (pair: Pair, size: number, distance: number, speed: number, waves: number, shadowShare: number, dt: number, time: number) {
  if (size <= 0 || shadowShare <= 0) {
    pair.companion = 0
    pair.growth = 1
    pair.mainX = 0
    pair.mainY = 0
    pair.wave = 0
    pair.omega = 0
    pair.mergedAt = -1
    pair.merged = 0
    return
  }

  // The shadows overlap from here on in
  const touching = 1 + size
  const merge = distance < touching ? 1 - Math.max(distance, 0) / touching : 0
  const merged = merge * merge * (3 - 2 * merge)
  pair.growth = 1 + size * merged
  pair.companion = size
  pair.merged = merged

  // Kepler's third law for the two masses, in Schwarzschild radii of the main hole and the speed of light
  const orbit = Math.max(distance, touching * CLOSEST_ORBIT) * SHADOW_RADII
  pair.omega = speed * LIGHT_SPEED * SHADOW_RADII / shadowShare * Math.sqrt((1 + size) / (2 * orbit * orbit * orbit))
  pair.phase += pair.omega * dt
  if (merge >= 1) {
    if (pair.mergedAt < 0) {
      pair.mergedAt = time
      pair.mergedPhase = pair.phase
      pair.mergedTurn = pair.omega < 0 ? -1 : 1
    }
  } else {
    pair.mergedAt = -1
  }

  const cos = Math.cos(pair.phase)
  const sin = Math.sin(pair.phase)
  const mainOffset = -distance * size / (1 + size)
  const companionOffset = distance / (1 + size)
  pair.mainX = cos * mainOffset
  pair.mainY = sin * mainOffset
  pair.companionX = cos * companionOffset
  pair.companionY = sin * companionOffset

  // Strongest for equal masses, growing as the two close in and at its most as they become one: the
  // ringing of the hole they leave starts from there
  const symmetry = 4 * size / ((1 + size) * (1 + size))
  pair.symmetry = symmetry
  pair.wave = waves * WAVE_SHARE * symmetry * Math.min(touching / Math.max(distance, touching), 1)

  const share = symmetry / 4
  const spin = Math.min(share * (SPIN_FIT[0] + share * (SPIN_FIT[1] + share * SPIN_FIT[2])), 0.95)
  const tone = TONE_FIT[0] + TONE_FIT[1] * Math.pow(1 - spin, TONE_FIT[2])
  const quality = QUALITY_FIT[0] + QUALITY_FIT[1] * Math.pow(1 - spin, QUALITY_FIT[2])
  pair.ringPitch = tone / TONE_STILL
  // It fades by e in 2 quality / tone
  pair.ringLength = quality * TONE_STILL / (tone * QUALITY_STILL)
}
