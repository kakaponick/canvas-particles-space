// Steps the particle field on several processor cores. The particles do not act on each other, so the
// field is cut into pieces that the main thread and a few workers step side by side with the hot loop
// itself (stepRange). What ties the particles together is left for the main thread, which does it in
// particle order once every piece is done: the respawns, which draw from the scene's one random sequence,
// and the light for the photon ring. A piece's segments stay where it wrote them, a run of its own; the
// renderer uploads the runs one after another. The field, the ring and the segments on the graphics card
// are then, to the bit, what stepParticles makes, so a film is the same film.
// A step is one call that returns when it is done. It needs memory shared between threads, which a
// browser gives only to a page served with the two isolation headers; the film server sends them.
import {
  settleLater, stepParticles, type InstanceData, type ParticleField, type SpawnSettings, type StepSettings
} from './particle_simulation'
import { settleLater3d, stepParticles3d } from './particle_simulation_3d'
import {
  BUSY, GENERATION, MAX_PIECES, OPEN, QUIT, createPieceMemory, pieceStart, pieceWritten, readPieceLater, workPieces, writeStep
} from './particle_pieces'

// Workers beside the main thread: half the logical cores are left to the browser's own threads, and
// more than seven workers step a field no faster
const MAX_WORKERS = 7
// A field smaller than this is stepped faster by the plain loop than a crew is woken
const MIN_CREW_PARTICLES = 6000
const START_MS = 10_000
// A worker that died would otherwise hang the page for good
const BUSY_MS = 10_000
const SPINS_PER_CLOCK = 1 << 14

export interface ParticleCrew {
  // The field and the segments the crew works on; the scene uses these instead of making its own
  field: ParticleField
  instances: InstanceData
  // Where the last step left its segments: a start slot and a count for each of `runCount` runs, in
  // particle order. No runs: the segments lie together from slot 0, as stepParticles leaves them
  runs: Int32Array
  runCount: number
  // The same as stepParticles on the crew's field
  step: (settings: StepSettings, spawn: SpawnSettings) => number
  dispose: () => void
}

// A crew for a field of up to `capacity` particles, or null where threads cannot share memory
export async function createParticleCrew (capacity: number): Promise<ParticleCrew | null> {
  if (typeof SharedArrayBuffer === 'undefined' || !globalThis.crossOriginIsolated) return null
  const workerCount = Math.min(MAX_WORKERS, Math.floor(navigator.hardwareConcurrency / 2) - 1)
  if (workerCount < 1) return null

  const memory = createPieceMemory(capacity)
  const { field, instances, control } = memory
  const workers: Worker[] = []
  const dispose = () => {
    Atomics.store(control, QUIT, 1)
    Atomics.add(control, GENERATION, 1)
    Atomics.notify(control, GENERATION)
    for (const worker of workers) worker.terminate()
    workers.length = 0
  }

  try {
    await Promise.all(Array.from({ length: workerCount }, () => new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./particle_crew_worker.ts', import.meta.url), { type: 'module' })
      workers.push(worker)
      const timer = setTimeout(() => reject(new Error('A particle worker did not start')), START_MS)
      worker.onmessage = () => {
        clearTimeout(timer)
        resolve()
      }
      worker.onerror = () => {
        clearTimeout(timer)
        reject(new Error('A particle worker failed'))
      }
      worker.postMessage(memory)
    })))
  } catch {
    dispose()
    return null
  }

  const crew: ParticleCrew = { field, instances, runs: new Int32Array(MAX_PIECES * 2), runCount: 0, step, dispose }

  function step (settings: StepSettings, spawn: SpawnSettings) {
    const count = field.count
    // A field that outgrew the shared memory is no longer the one the workers see
    if (count < MIN_CREW_PARTICLES || field.capacity !== capacity || workers.length === 0) {
      crew.runCount = 0
      return (settings.threeD > 0 ? stepParticles3d : stepParticles)(field, settings, spawn, instances)
    }

    const pieces = writeStep(memory, settings, spawn, count)
    Atomics.store(control, OPEN, 1)
    Atomics.add(control, GENERATION, 1)
    Atomics.notify(control, GENERATION)
    workPieces(memory, settings, spawn)
    // Every piece is taken; the step is done when the workers still inside have finished theirs. The
    // wait is a spin, no longer than a piece takes
    Atomics.store(control, OPEN, 0)
    let spins = 0
    let since = 0
    while (Atomics.load(control, BUSY) !== 0) {
      if (++spins % SPINS_PER_CLOCK !== 0) continue
      const now = performance.now()
      if (since === 0) since = now
      if (now - since > BUSY_MS) {
        dispose()
        throw new Error('The particle workers stopped answering')
      }
    }

    const { runs } = crew
    let written = 0
    const settle = settings.threeD > 0 ? settleLater3d : settleLater
    for (let piece = 0; piece < pieces; piece++) {
      const from = pieceStart(memory, piece)
      readPieceLater(memory, piece)
      settle(field, settings, spawn, memory.later, from)
      const segments = pieceWritten(memory, piece)
      runs[piece * 2] = from
      runs[piece * 2 + 1] = segments
      written += segments
    }
    crew.runCount = pieces
    return written
  }

  return crew
}
