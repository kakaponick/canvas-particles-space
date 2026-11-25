// One worker of a particle crew (particle_crew.ts). It sleeps until the main thread lays out a step and
// takes pieces of the field until none is left; it never leaves this loop until it is told to quit.
import { createRingEnergy } from './ring_energy'
import { createRandom } from './random'
import type { SpawnSettings, StepSettings } from './particle_simulation'
import {
  BUSY, GENERATION, OPEN, QUIT, createStepNumbers, readStep, workPieces, type PieceMemory
} from './particle_pieces'

self.onmessage = (event: MessageEvent<PieceMemory>) => {
  const memory = event.data
  const { control } = memory
  // Only says that the ring is fed: the light is left for the main thread, as are the respawns, so the
  // random sequence and the palette here are never read
  const ring = createRingEnergy()
  const settings: StepSettings = { ...createStepNumbers(), ringEnergy: null }
  const spawn: SpawnSettings = {
    random: createRandom(0),
    palette: { source: [], colors: new Uint32Array(0), cumulativeWeights: new Float32Array(0), totalWeight: 0 },
    farZ: 1,
    speedVariance: 0,
    radius: 0
  }

  let generation = Atomics.load(control, GENERATION)
  self.postMessage('ready')
  for (;;) {
    Atomics.wait(control, GENERATION, generation)
    generation = Atomics.load(control, GENERATION)
    if (Atomics.load(control, QUIT) === 1) return
    Atomics.add(control, BUSY, 1)
    if (Atomics.load(control, OPEN) === 1) {
      readStep(memory, settings, spawn, ring)
      workPieces(memory, settings, spawn)
    }
    Atomics.sub(control, BUSY, 1)
  }
}
