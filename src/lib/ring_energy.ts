// Light of the photon ring fed by the simulation: matter that falls into the black hole or skims past
// it leaves energy at its direction around the ring. The energy fades over time and the whole pattern
// turns with the flow; the composite shader reads it as a one-row texture.

export const RING_BINS = 256
const BIN_MASK = RING_BINS - 1
const FULL_TURN = Math.PI * 2

export interface RingEnergy {
  bins: Float32Array
  // The energy compressed into 0..255 for the shader
  texels: Uint8Array
  // Radians the stored pattern has turned
  phase: number
}

export function createRingEnergy (): RingEnergy {
  return { bins: new Float32Array(RING_BINS), texels: new Uint8Array(RING_BINS), phase: 0 }
}

export function clearRingEnergy (ring: RingEnergy) {
  ring.bins.fill(0)
  ring.texels.fill(0)
  ring.phase = 0
}

// Adds energy in the direction (x, y) from the black hole, spread over three neighbouring bins
export function depositRingEnergy (ring: RingEnergy, x: number, y: number, amount: number) {
  const turns = (Math.atan2(y, x) - ring.phase) / FULL_TURN
  const index = Math.floor((turns - Math.floor(turns)) * RING_BINS) & BIN_MASK
  ring.bins[index] += amount * 0.5
  ring.bins[(index + 1) & BIN_MASK] += amount * 0.25
  ring.bins[(index - 1) & BIN_MASK] += amount * 0.25
}

// Fades the energy by `afterglow` seconds per e-fold and turns the pattern at `flowSpeed` radians a second
export function stepRingEnergy (ring: RingEnergy, dt: number, afterglow: number, flowSpeed: number) {
  ring.phase = (ring.phase + flowSpeed * dt) % FULL_TURN
  const keep = Math.exp(-dt / Math.max(afterglow, 0.01))
  const { bins, texels } = ring
  for (let i = 0; i < RING_BINS; i++) {
    const energy = bins[i] * keep
    bins[i] = energy
    // Saturates softly, so a burst of infall cannot clip the ring
    texels[i] = 255 * energy / (1 + energy)
  }
}
