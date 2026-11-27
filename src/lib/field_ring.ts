// The dashed circle Light Front draws round the main hole where its field for light ends (gridFrontField,
// shown at gridFrontFieldLine): the textbook's "strong gravitational field" drawn as a zone. Each dash is one
// row of a photon table (photons.ts layout), a short arc of the circle sampled by its length, so the photon
// program draws it on the sheet's surface as it draws photons, hidden behind the hole's shadow; it is filled
// once when the circle's radius changes, never per frame

import { PHOTON_COLUMNS, PHOTON_SAMPLES, PHOTON_TICK } from './photons'
import { createPhotonSettings, type PhotonSettings } from './photon_program'

// How many dashes go round the circle, and the share of each dash's place they fill
export const FIELD_RING_DASHES = 56
export const FIELD_RING_FILL = 0.55

export interface FieldRingSettings extends PhotonSettings {
  // The circle's radius, in throat radii from the hole
  radius: number
}

export function createFieldRingSettings (): FieldRingSettings {
  return { ...createPhotonSettings(), radius: 0 }
}

/** Every dash into the table: row i starts at its own angle and runs along the circle, a sample a tick of arc */
export function traceFieldRing (table: Float32Array, count: number, ring: FieldRingSettings) {
  const radius = Math.max(ring.radius, 0.01)
  for (let row = 0; row < count; row++) {
    const base = row * PHOTON_COLUMNS * 2
    const start = row / count * 2 * Math.PI
    for (let s = 0; s < PHOTON_SAMPLES; s++) {
      const angle = start + s * PHOTON_TICK / radius
      table[base + 2 * s] = radius * Math.cos(angle)
      table[base + 2 * s + 1] = radius * Math.sin(angle)
    }
    table[base + 2 * PHOTON_SAMPLES] = 0
    table[base + 2 * PHOTON_SAMPLES + 1] = 0
    table[base + 2 * PHOTON_SAMPLES + 2] = -1
    table[base + 2 * PHOTON_SAMPLES + 3] = 0
  }
}
