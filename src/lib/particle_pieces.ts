// The memory a crew shares (particle_crew.ts) and the work on it, the same code on the main thread and
// in every worker. One step cuts the field into pieces of particles in a row; whoever is free takes the
// next piece and steps it with stepRange, leaving its respawns and the ring's light for the main thread.
import {
  createInstanceData, createParticleField, stepRange,
  type InstanceData, type ParticleField, type SpawnSettings, type StepLater, type StepSettings
} from './particle_simulation'
import { stepRange3d } from './particle_simulation_3d'

type StepNumber = { [Key in keyof StepSettings]: StepSettings[Key] extends number ? Key : never }[keyof StepSettings]

// A list of every numeric step setting; one left out does not compile
const everyNumber = <Keys extends readonly StepNumber[]>(
  keys: Keys & ([StepNumber] extends [Keys[number]] ? unknown : never)
) => keys

// The step's numbers in the order they cross to the workers
const STEP_NUMBERS = everyNumber([
  'frameScale', 'time', 'speed', 'width', 'height', 'focal', 'vanishX', 'vanishY', 'holeX', 'holeY', 'holeRadius',
  'captureRadius', 'captureX', 'captureY', 'spinRight', 'spinUp', 'spinToward', 'companionX', 'companionY', 'companionRadius', 'companionCapture', 'ringCaptureEnergy', 'ringSkimReach', 'ringSkimEnergy', 'gravityReach', 'holeDepth',
  'gravityDepth', 'lineWidth', 'minLineWidth', 'gravityStrength', 'orbitalStrength', 'inertia', 'farZ', 'depthFade', 'pulseSpeedMultiplier',
  'pulseIntensity', 'baseBrightness', 'minOpacity', 'maxOpacity', 'revealRadius', 'revealX', 'revealY', 'revealFeather',
  'opacityScale', 'threeD', 'holeWorldX', 'holeWorldY', 'holeWorldZ', 'companionWorldX', 'companionWorldY',
  'companionWorldZ', 'cameraYaw', 'cameraPitch', 'cameraYawFrom', 'cameraPitchFrom', 'cameraRoll', 'cameraLookYaw',
  'cameraLookPitch', 'cameraMoveRight', 'cameraMoveUp', 'cameraMoveIn', 'cameraRollFrom', 'cameraLookYawFrom',
  'cameraLookPitchFrom', 'cameraMoveRightFrom', 'cameraMoveUpFrom', 'cameraMoveInFrom', 'endFade'
] as const)
// The spawn depth follows the step's numbers
const SPAWN_FAR_Z = STEP_NUMBERS.length

// Slots of `control`. GENERATION counts the steps and is what a worker sleeps on. A step is OPEN while
// it has pieces to take, and BUSY counts the workers inside it: the main thread lays out the next step
// only once this one is closed and nobody is inside, so a worker that wakes late finds either a closed
// step, which it leaves alone, or a whole one
export const GENERATION = 0
const NEXT_PIECE = 1
export const OPEN = 2
export const BUSY = 3
const PIECES = 4
const PIECE_SIZE = 5
const COUNT = 6
const RING_FED = 7
export const QUIT = 8
const CONTROL_SLOTS = 9

// Particles in a piece, at least; a field is cut into no more than MAX_PIECES. Small pieces keep the
// wait for the last one short
const PIECE_PARTICLES = 1024
export const MAX_PIECES = 128
// What a piece reports: segments written, respawns and deposits left for later
const TALLY_SLOTS = 3

export interface PieceMemory {
  field: ParticleField
  instances: InstanceData
  control: Int32Array
  numbers: Float64Array
  tally: Int32Array
  later: StepLater
}

export function createPieceMemory (capacity: number): PieceMemory {
  return {
    field: createParticleField(capacity),
    instances: createInstanceData(capacity),
    control: new Int32Array(new SharedArrayBuffer(CONTROL_SLOTS * 4)),
    numbers: new Float64Array(new SharedArrayBuffer((STEP_NUMBERS.length + 1) * 8)),
    tally: new Int32Array(new SharedArrayBuffer(MAX_PIECES * TALLY_SLOTS * 4)),
    later: {
      respawns: new Int32Array(new SharedArrayBuffer(capacity * 4)),
      respawnCount: 0,
      deposits: new Float64Array(new SharedArrayBuffer(capacity * 3 * 8)),
      depositCount: 0
    }
  }
}

// Lays a step of `count` particles out for everyone. Returns the number of pieces
export function writeStep (memory: PieceMemory, settings: StepSettings, spawn: SpawnSettings, count: number): number {
  const { control, numbers } = memory
  for (let slot = 0; slot < STEP_NUMBERS.length; slot++) numbers[slot] = settings[STEP_NUMBERS[slot]]
  numbers[SPAWN_FAR_Z] = spawn.farZ
  const pieces = Math.min(MAX_PIECES, Math.ceil(count / PIECE_PARTICLES))
  control[PIECES] = pieces
  control[PIECE_SIZE] = Math.ceil(count / pieces)
  control[COUNT] = count
  control[RING_FED] = settings.ringEnergy ? 1 : 0
  Atomics.store(control, NEXT_PIECE, 0)
  return pieces
}

// A worker's copy of the step: its numbers, and whether the ring is fed. The ring itself and the random
// sequence stay on the main thread, which is why a worker leaves them for later
export function readStep (memory: PieceMemory, settings: StepSettings, spawn: SpawnSettings, ring: StepSettings['ringEnergy']) {
  const { control, numbers } = memory
  for (let slot = 0; slot < STEP_NUMBERS.length; slot++) settings[STEP_NUMBERS[slot]] = numbers[slot]
  spawn.farZ = numbers[SPAWN_FAR_Z]
  settings.ringEnergy = control[RING_FED] === 1 ? ring : null
}

export function createStepNumbers (): Omit<StepSettings, 'ringEnergy'> {
  const settings = {} as Record<StepNumber, number>
  for (const key of STEP_NUMBERS) settings[key] = 0
  return settings
}

// Takes pieces until none is left
export function workPieces (memory: PieceMemory, settings: StepSettings, spawn: SpawnSettings) {
  const { field, instances, control, tally, later } = memory
  const pieces = control[PIECES]
  const size = control[PIECE_SIZE]
  const count = control[COUNT]
  for (;;) {
    const piece = Atomics.add(control, NEXT_PIECE, 1)
    if (piece >= pieces) return
    const from = piece * size
    later.respawnCount = 0
    later.depositCount = 0
    const o = piece * TALLY_SLOTS
    tally[o] = (settings.threeD > 0 ? stepRange3d : stepRange)(field, settings, spawn, instances, from, Math.min(from + size, count), later)
    tally[o + 1] = later.respawnCount
    tally[o + 2] = later.depositCount
  }
}

export const pieceStart = (memory: PieceMemory, piece: number) => piece * memory.control[PIECE_SIZE]
export const pieceWritten = (memory: PieceMemory, piece: number) => memory.tally[piece * TALLY_SLOTS]

// Points `later` at what the piece left, for settleLater
export function readPieceLater (memory: PieceMemory, piece: number) {
  memory.later.respawnCount = memory.tally[piece * TALLY_SLOTS + 1]
  memory.later.depositCount = memory.tally[piece * TALLY_SLOTS + 2]
}
