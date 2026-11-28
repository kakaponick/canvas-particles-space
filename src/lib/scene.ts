// The scene apart from the page: the particle field, the black hole, the intro and the renderer, advanced
// one frame at a time. The page calls `advance` from its animation loop with the time that really passed;
// a film (film_render.ts) calls it in a plain loop with a fixed step. Everything a frame depends on arrives
// in SceneInput, so the scene reads no store and no window, and with the same seed and the same inputs it
// draws the same frames.
import { REFERENCE_FPS, createParticleField, createPaletteSampler, createStepSettings, setParticleCount, type SpawnSettings } from './particle_simulation'
import { POSE_SLOTS, cameraPose, turnOnto } from './camera_pose'
import { createParticleRenderer, type FrameInput, type ParticleRenderer } from './particle_renderer'
import { createIntroFrame, getRingdownTiming, ringdownWobble, sampleIntro, type IntroFrame, type RingdownTiming } from './intro_timeline'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { RINGDOWN_PHYSICAL_DECAY, RINGDOWN_PHYSICAL_FREQUENCY, type IntroParams } from './intro_params'
import type { SimulationSettings } from './simulation_presets'
import { stepSpring, type Spring2D } from './black_hole_motion'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from './title_sprite'
export type { TitleSprite } from './title_sprite'
import { clearRingEnergy, createRingEnergy, feedRing, stepRingEnergy } from './ring_energy'
import { layFlatSheet, laySpaceSheet, orbitOnSheet, placeSheet, waveSheet } from './space_grid'
import { createPhotonSettings } from './photon_program'
import { createPhotonTrace, followFlash } from './photons'
import { createBeamSettings } from './beams'
import { FIELD_RING_DASHES, FIELD_RING_FILL, createFieldRingSettings } from './field_ring'
import { LATTICE_LINES_PER_SIDE, createLatticeSettings, latticeAnchor } from './space_lattice'
import { FLOW_KEYS, createFlowSettings, leanPlane, resetFlow, shareFlow, stepFlow, turnFlow } from './flows'
import { LIGHT_SPEED, SHADOW_RADII, clearOrbiters, createOrbitTuning, createOrbiters, stepOrbiters } from './orbiters'
import { createPair, precessPair, precessed, stepPair } from './companion'
import { CLOSEST_CAMERA, CRITICAL_IMPACT, cameraFor, einsteinRatioAt, shadowAngle } from './lens_trace'
import { createShadowShape, updateShadowShape } from './kerr_shadow'
import { createRandom, seedRandom } from './random'
import { createSceneColor, readSceneColor } from './scene_color'

// The crumbling title follows the black hole's gravity: at these settings (the defaults) the dust
// travels Dust Pull and turns by this many radians at Dust Swirl 1
const TITLE_REFERENCE_GRAVITY = 2.5
// Where a neutron star's flowed plasma wraps, in cells of its coarsest veins (see neutronFlowed)
const FLOW_WRAP = 4096
const TITLE_REFERENCE_ORBIT = 40
const TITLE_SWIRL_RADIANS = 0.35
// The camera's shake: two sines a side, the second slower (its weight is Shake Undertone, its pace a multiple
// of its own), at these radians a second at Shake Rate 1
const SHAKE_X = [83.1, 47.3] as const
const SHAKE_Y = [71.7, 39.9] as const
// A ringdown wobble smaller than this share of the radius no longer shows, so the oval is switched off
const MIN_HOLE_OVAL = 1e-4
// The gravitational wave is switched off this many wobble decay times after its front left the screen
const GRAVITY_WAVE_FADES = 6
// The photon ring and its glow are drawn out to this many shadow radii from the hole. That holds a glow
// reaching up to RING_GLOW_HELD radii and a line whose light ends within RING_LINE_HELD of its widths off
// the shadow's edge (its offset and RING_FADES bells of its softness, where a bell has faded out); a glow
// set wider, as many reaches away, or a line set further off or softer gets the room it needs
const RING_REACH = 1.6
const RING_GLOW_HELD = 0.2
const RING_LINE_HELD = 2.5
const RING_FADES = 3
// The tint of a fast flight is at its fullest no nearer than this to the speed it begins at
const MIN_TINT_SPAN = 1e-6
// A fired effect is over once everything it shows is fainter than this
const CUE_FADED = 0.002
const DEGREE = Math.PI / 180
// The most a black hole spins, a/M: the top of the Spin slider
const SPIN_MAX = 0.998
// 1 / the camera's distance in Schwarzschild radii with no lens to place it: far enough to be at infinity
const FAR_CAMERA = 1e-3
// Nothing of a black hole is drawn nearer the camera than this, in scene units
const NEAR_DEPTH = 1
// A background star's light falls as exp(-d * d / spread), d in CSS pixels: at a Star Size of 1.55 the
// spread is the 0.6 the shader held before the size was a setting
const STAR_SIZE = 1.55
const STAR_SPREAD = 0.6
const FULL_TURN = Math.PI * 2
// Camera Bank: seconds over which the swing it leans into is smoothed, and the fastest swing it leans into
// (degrees a second), so a whip leans no further than a fast turn
const BANK_LAG = 0.4
const MAX_SWING = 90
// Camera Float's sway: two sines a little out of step, at most 1 in size, slow enough to read as a hand
const sway = (seconds: number, rate: number, phase: number) => (Math.sin(rate * seconds + phase) + 0.5 * Math.sin(2.3 * rate * seconds + 2 * phase)) / 1.5

// The longitude of the camera's meridian on a horizon whose axis the camera sees along (right, up, toward), a
// unit vector, counted from a meridian that stands in the scene: the one toward the scene's right, or its up
// while the axis lies along the right. axisTurn is the axis's turn on the screen, from up toward the left
function meridianLongitude (pose: ArrayLike<number>, threeD: boolean, axisRight: number, axisUp: number, axisToward: number, axisTurn: number): number {
  // The scene's right, and its up, as the camera sees them
  let refRight = threeD ? pose[0] : 1
  let refUp = threeD ? -pose[3] : 0
  let refToward = threeD ? -pose[6] : 0
  let along = refRight * axisRight + refUp * axisUp + refToward * axisToward
  if (Math.abs(along) > 0.999) {
    refRight = threeD ? -pose[1] : 0
    refUp = threeD ? pose[4] : 1
    refToward = threeD ? pose[7] : 0
    along = refRight * axisRight + refUp * axisUp + refToward * axisToward
  }
  // The camera's meridian runs toward it from the axis: the line to the camera, (0, 0, 1), less its part
  // along the axis. Looking straight down the axis the ray tracer takes it opposite the way the axis
  // points on the screen, and so does this
  let meridianRight = -axisToward * axisRight
  let meridianUp = -axisToward * axisUp
  let meridianToward = 1 - axisToward * axisToward
  if (meridianToward < 1e-9) {
    meridianRight = Math.sin(axisTurn)
    meridianUp = -Math.cos(axisTurn)
    meridianToward = 0
  }
  // Its longitude: along the reference's part across the axis, and along the axis times that
  const firstRight = refRight - along * axisRight
  const firstUp = refUp - along * axisUp
  const firstToward = refToward - along * axisToward
  return Math.atan2(
    meridianRight * (axisUp * firstToward - axisToward * firstUp) + meridianUp * (axisToward * firstRight - axisRight * firstToward) + meridianToward * (axisRight * firstUp - axisUp * firstRight),
    meridianRight * firstRight + meridianUp * firstUp + meridianToward * firstToward
  )
}

// One bit for each layer, for the set of layers a fired effect plays
const LAYER_BIT = Object.fromEntries(INTRO_LAYERS.map((layer, index) => [layer, 1 << index])) as Record<IntroLayer, number>
const STAR = LAYER_BIT.star
const GLARE = LAYER_BIT.glare
const LIGHT = LAYER_BIT.light
const ECHO = LAYER_BIT.echo
const SHOCKWAVE = LAYER_BIT.shockwave
const BURST = LAYER_BIT.burst
const REMNANT = LAYER_BIT.remnant
const CAMERA = LAYER_BIT.camera
const RINGDOWN = LAYER_BIT.ringdown
const GRAVITY_WAVE = LAYER_BIT.gravityWave
const TITLE = LAYER_BIT.title
// What happens around the explosion plays on one clock, what the ringing horizon does on another, so a
// new blast does not cut off a wave that is still crossing the frame
const BLAST_LAYERS = STAR | GLARE | LIGHT | ECHO | SHOCKWAVE | BURST | REMNANT | CAMERA
const RING_LAYERS = RINGDOWN | GRAVITY_WAVE

// The centre of something `half` wide, moved as little as needed for it to lie between `inset` and
// `size - inset`; centred when there is not enough room
/**
 * The plane `tiltDegrees` from the plane across the line of flight, its side `nodeDegrees` round the screen
 * (0 the top, 90 the left) tipped away from the camera: its two directions are the scene's x and y carried
 * there by the shortest turn, then the way it faces, row by row into `out`. At no tilt it is the scene's
 * own axes, and at 180 the same plane faced the other way.
 */
function tiltPlane (tiltDegrees: number, nodeDegrees: number, out: Float64Array) {
  const tilt = tiltDegrees * DEGREE
  const tiltSin = Math.sin(tilt)
  const tiltFold = 1 - Math.cos(tilt)
  const leanX = Math.sin(nodeDegrees * DEGREE)
  const leanY = Math.cos(nodeDegrees * DEGREE)
  out[0] = 1 - tiltFold * leanX * leanX
  out[1] = -tiltFold * leanX * leanY
  out[2] = -tiltSin * leanX
  out[3] = -tiltFold * leanX * leanY
  out[4] = 1 - tiltFold * leanY * leanY
  out[5] = -tiltSin * leanY
  out[6] = tiltSin * leanX
  out[7] = tiltSin * leanY
  out[8] = 1 - tiltFold
}

function keepInside (center: number, half: number, inset: number, size: number) {
  const low = inset + half
  const high = size - inset - half
  return low > high ? size / 2 : Math.min(Math.max(center, low), high)
}

// What one frame is drawn from. The page fills it from its stores, a film from its own values
export interface SceneInput {
  settings: SimulationSettings
  params: IntroParams
  hidden: Record<IntroLayer, boolean>
  reducedMotion: boolean
}

// Where the black hole heads, in CSS pixels, while it follows a pointer or is carried by one
export interface ScenePointer {
  x: number
  y: number
  // A finger or the mouse is carrying the black hole: it heads for the pointer, not its anchor
  holding: boolean
}

export interface Scene {
  // The frame as it was drawn last; read by input handling and readouts
  readonly frame: FrameInput
  readonly hole: Spring2D
  readonly intro: IntroFrame
  readonly ringTiming: RingdownTiming
  readonly pointer: ScenePointer
  // Size of the view in CSS pixels and device pixels per CSS pixel
  width: number
  height: number
  pixelRatio: number
  // Seconds into the intro; a seek writes it
  introTime: number
  // Seconds the scene has run
  time: number
  // Readouts of the last frame: flight speed, ringdown wobble
  speed: number
  ringdown: number
  // How far from its place in the scene the black hole shows on the screen, CSS pixels: the camera
  // looking beside it. The page lays a pointer over the hole with it
  holeShiftX: number
  holeShiftY: number
  // False while the WebGL context is lost
  ready: () => boolean
  // Returns whether the size changed
  resize: (width: number, height: number, pixelRatio: number, force?: boolean) => boolean
  // Draws the title's words for the lens; resolves once they are in place or the wait for the face is over
  setTitle: (style: TitleStyle, fontTimeoutMs: number, force?: boolean) => Promise<void>
  // Draws a title's words ahead of time, and puts words drawn so in place of the current ones at once: a
  // film changes its title at a cue, where there is no waiting for a face
  makeTitle: (style: TitleStyle, fontTimeoutMs: number) => Promise<TitleSprite>
  useTitle: (sprite: TitleSprite) => void
  // Starts again with a fresh particle field, at this moment of the intro
  restart: (input: SceneInput, introTime?: number) => void
  // Plays layers of the opening again on their own, at the black hole and as the opening times them:
  // the clock starts where the earliest of them starts. One blast and one ringing at a time; a new one
  // takes over. Only CUE_LAYERS do anything, and only once the opening itself is over
  fire: (layers: readonly IntroLayer[], input: SceneInput) => void
  // Puts the black hole where the intro happens, or at its resting place
  placeHole: (input: SceneInput, atRest?: boolean) => void
  // Makes every later random draw repeat for this seed
  reseed: (seed: number) => void
  // Advances by `frameScale` reference frames, `dt` seconds, and draws. With `present` false the step
  // goes into the scene's trails only and nothing is shown: a film's extra step between two frames
  advance: (frameScale: number, dt: number, input: SceneInput, present?: boolean) => void
  // Shows the background while nothing animates
  drawIdle: () => void
  loseContext: () => void
  restoreContext: (input: SceneInput) => void
  dispose: () => void
}

export function createScene (gl: WebGL2RenderingContext, seed: number, input: SceneInput): Scene | null {
  let renderer: ParticleRenderer | null = createParticleRenderer(gl)
  if (!renderer) return null

  let disposed = false
  let titleSprite: TitleSprite | null = null
  let titleStyle: TitleStyle | null = null
  let titleFontTimeoutMs = 0
  let titleKey = ''
  let titleBuild = 0
  let titleReady: Promise<void> = Promise.resolve()

  const pointer: ScenePointer = { x: 0, y: 0, holding: false }
  const hole: Spring2D = { x: 0, y: 0, vx: 0, vy: 0 }
  // The saved resting place of the black hole and the place the intro happens, in CSS pixels
  let anchorX = 0
  let anchorY = 0
  let originX = 0
  let originY = 0

  let fadeBacklog = 0
  // Where the sheet's fixed point stood from the hole (grid.anchorX/Y) when Light Front's flash went off, and
  // the place it went off at: a flash stays where it went off on the sheet while the hole moves on. Taken
  // again while Front Run is 0, while the flash is off and when its place changes; kept here, in the step
  // every frame takes, so a film's frames that are stepped and not drawn move it too
  let flashAnchorX = 0
  let flashAnchorY = 0
  let flashPlaceX = NaN
  let flashPlaceY = NaN
  // Where the flash's photons are traced from (photons.ts), moved on with every frame
  const photonTrace = createPhotonTrace()
  // Seconds the shake's clock is ahead of the scene's, and its undertone's ahead of that
  let shakeLead = 0
  // How far the neutron star has turned, in radians: its turns a second, run up on the scene's clock
  let neutronTurned = 0
  // How far its plasma has flowed, in cells of its coarsest veins: Plasma Flow run up on the scene's clock,
  // wrapped at FLOW_WRAP, where the GPU's hash of a noise cell still keeps its precision (a wrap jumps
  // the pattern once in hours at the default flow)
  let neutronFlowed = 0
  let undertoneLead = 0

  const intro = createIntroFrame()
  const ringTiming: RingdownTiming = { frequency: 1, decay: 1 }
  // The ringing of the hole a pair leaves: a real hole's, at the speed of light the pair itself turns by
  const mergerRing: RingdownTiming = { frequency: 1, decay: 1 }
  // Layers of the opening fired again: which are playing and the moment of the opening each clock is at
  const cue = { blastLayers: 0, blastTime: 0, ringLayers: 0, ringTime: 0, title: false, titleTime: 0 }
  const cueFrame = createIntroFrame()

  const random = createRandom(seed)
  const ringEnergy = createRingEnergy()
  let ringWasFed = true
  // Radians the horizon has turned, Omega_H times the hole's own time (Horizon Pace M a second)
  let horizonTurned = 0
  // The radians the second hole's horizon has turned
  let companionTurned = 0
  // CSS pixels of space the 3D sky's clouds have been read further along so far
  const nebulaSpace = [0, 0, 0]
  // The particles as they are born; once sent to the graphics card they are stepped there
  const field = createParticleField()
  const orbiters = createOrbiters(random)
  const orbitTuning = createOrbitTuning()
  const pair = createPair()
  const shadowShape = createShadowShape()
  // The outline of the second hole's shadow, for its own spin
  const companionShape = createShadowShape()
  const spawn: SpawnSettings = {
    random,
    palette: createPaletteSampler(input.settings.colorPalette),
    farZ: input.settings.farZ,
    speedVariance: input.settings.speedVariance,
    radius: input.settings.spawnRadius
  }
  setParticleCount(field, input.settings.fieldEnabled ? input.settings.numParticles : 0, spawn)

  const settings = createStepSettings(ringEnergy)
  // The 3D camera: how far it has eased from the flat view (0) to its place (1), the radians it has turned
  // on its own, the pose the field was last stepped with, and whether that step was in 3D
  const view = {
    blend: 0, spin: 0, yaw: 0, pitch: 0, roll: 0, lookYaw: 0, lookPitch: 0, moveRight: 0, moveUp: 0, moveIn: 0, stepped: false,
    // Camera Bank: the circle's angle last frame (degrees, -1e9 before the first) and how fast it swings, smoothed
    circle: -1e9, swing: 0
  }
  // The camera's pose, which sees the scene (cameraPose)
  const pose = new Float64Array(POSE_SLOTS)
  // The equator: the plane through the main black hole that matter told where to go lies in. Three
  // directions of the scene, row by row: two that span the plane, then the one it faces
  const equator = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  // The plane a pair of black holes circles in, the same way: the two directions their own motion is
  // counted along, then the one it faces, which their orbit turns about
  const pairPlane = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  // Where the two black holes stood when the field was last stepped (scene units in 3D, CSS pixels on the
  // screen flat) and whether that step was in 3D, so matter born round a hole moves with it; a tearing's
  // own number, so each torn star takes another share of the field
  const holeMotion = { stepped: false, threeD: false, x: 0, y: 0, z: 0, companionX: 0, companionY: 0, companionZ: 0 }
  let tearings = 0
  // A flow's own plane before its tilt: the equator leaned toward the pair's orbit, then toward the camera
  const flowLeaned = new Float64Array(9)
  const flowBase = new Float64Array(9)
  // The plane a hole alone rings in, the same way (Lone Ring Tilt and Lone Ring Toward)
  const lonePlane = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
  // The holes' own spins, a/M along the scene's x, y and z: the main one's, then the second one's
  const spins = new Float64Array(6)
  // A direction worked out on the way: the pair's plane's after precession, the orbit laid on the sheet
  const turned = new Float64Array(3)
  // A point of the scene as the camera sees it: CSS pixels and its distance in front of the camera
  const seen = { x: 0, y: 0, depth: 1 }

  const background: [number, number, number] = [0, 0, 0]
  const frame: FrameInput = {
    background,
    updateScene: true,
    present: true,
    fadeAlpha: 0,
    field,
    fieldCount: 0,
    fieldBorn: 0,
    fieldSeed: seed,
    fieldTick: 0,
    palette: spawn.palette,
    spawnRadius: spawn.radius,
    speedVariance: spawn.speedVariance,
    ringTurned: 0,
    ringKeep: 1,
    ringClear: false,
    orbitCount: 0,
    orbitRow: orbiters.row,
    orbitRowNew: true,
    orbitDimmed: 0,
    orbitX: 0,
    orbitY: 0,
    orbitUnit: 1,
    orbitWidth: 1,
    orbitTurn: new Float32Array(9),
    orbitFocal: 0,
    orbitDepth: 1,
    doppler: 0,
    tintAhead: createSceneColor(),
    tintEdge: createSceneColor(),
    tintBehind: createSceneColor(),
    shiftToward: createSceneColor(),
    shiftAway: createSceneColor(),
    tintGradient: 1.7,
    tintLimit: 0.8,
    vanishX: 0,
    vanishY: 0,
    flightX: 0,
    flightY: 0,
    flightZ: 1,
    flightFocal: 1,
    cutZoom: 1.08,
    cutShift: 80,
    ringTexels: ringEnergy.texels,
    ringFed: true,
    title: {
      alpha: 0, x: 0, y: 0, reveal: 1, dissolve: 0, drift: 0, glow: 0, flash: 0, cooling: 1, dust: 0,
      pull: 0, swirl: 0, reach: 0, capture: 0, scale: 1, fringe: 0, halo: 0, redshift: 0, grain: 1, burn: 0, fall: 0,
      tidal: 2, spiral: 1, spread: 0.75, stream: 0.5, order: 0.3, trail: 0.8, trailCopies: 3, trailLag: 0.13, heat: 1.6,
      speckSize: 2, currentSize: 11, beyondSpeed: 0.15, wink: 0.15, spiralRadius: 0.3, spiralMin: 0.4, spiralMax: 3,
      burnGrain: 18, burnFine: 5, burnEnds: 0.45, burnRim: 2.5, burnRimWidth: 0.1,
      currentContrast: 1.8, orderReach: 0.6, captureEdge: 0.25, reachFade: 1,
      dustSize: 2.4, dustClumps: 0.55, dustLow: 0.15, dustHigh: 0.8, burnMix: 0.6, burnEdge: 0.06
    },
    composite: {
      time: 0,
      holeX: 0,
      holeY: 0,
      horizon: 0,
      einstein: 0,
      falloff: 2,
      falloffPivot: 1,
      lensCore: 0.3,
      maxBend: 64,
      lensReach: 0,
      twistLimit: 3,
      swirl: 0,
      absorption: 0,
      traceU: 0,
      traceScale: 1,
      traceShare: 1,
      discShare: 0,
      discHide: 1,
      discDoppler: 1,
      discBeam: 4,
      discTint: 1,
      discReach: 1,
      discTurn: new Float32Array(9),
      spin: 0,
      spinTilt: 0,
      spinAxis: 0,
      shadowShape,
      horizonGrid: 0,
      horizonGridU: FAR_CAMERA,
      horizonGridScale: 1,
      horizonTilt: 0,
      horizonAxis: 0,
      horizonTurn: 0,
      horizonRate: 0,
      horizonCells: 6,
      horizonLine: 1.5,
      horizonHaze: 0.3,
      horizonHazeFrom: 4,
      horizonHazeTo: 1.5,
      horizonCellsAround: 0,
      horizonShift: 0,
      horizonCompanion: 0,
      companionGridScale: 1,
      companionGridTurn: 0,
      companionGridU: FAR_CAMERA,
      companionGridRate: 0,
      companionGridSpin: 0,
      companionGridTilt: 0,
      companionGridAxis: 0,
      ring: 0,
      ringWidth: 0,
      ringGlow: 0,
      ringDoppler: 0,
      ringSide: 0,
      ringPhase: 0,
      ringBase: 1,
      ringFeed: 0,
      ringLineMin: 1.5,
      ringOffset: 0.7,
      ringReach: RING_REACH,
      ringSoftness: 0.45,
      ringGlowCore: 0.035,
      ringGlowSkirt: 0.18,
      ringGlowCoreShare: 0.3,
      ringGlowSkirtShare: 0.12,
      neutron: 0,
      neutronSurface: 0,
      neutronGlow: 0,
      neutronTurn: 0,
      neutronVeins: 1,
      neutronVeinSharp: 1,
      neutronVeinLight: 0,
      neutronLimb: 0,
      neutronShade: 0,
      neutronGlowLight: 0,
      neutronWarp: 0,
      neutronLayers: 1,
      neutronBranch: 0,
      neutronCore: 0,
      neutronStir: 0,
      neutronFlowed: 0,
      neutronCross: 0,
      neutronColor: createSceneColor(),
      neutronVeinColor: createSceneColor(),
      neutronCoreColor: createSceneColor(),
      ringColor: createSceneColor(),
      ringApproaching: createSceneColor(),
      ringReceding: createSceneColor(),
      centerX: 0,
      centerY: 0,
      starGlow: 0,
      starRadius: 0,
      sourcePower: 0,
      glareRadius: 1,
      exposure: 1,
      lightRadius: 0,
      lightWidth: 1,
      lightPower: 0,
      lightSpeed: 1,
      echoPower: 0,
      echoDecay: 0.5,
      echoHoldThin: 0.4,
      echoHoldThick: 1.8,
      echoSwell: 0.15,
      echoSwellMin: 0.02,
      echoReach: 0.5,
      waveRadius: 0,
      waveStrength: 0,
      waveWidth: 1,
      remnantGlow: 0,
      remnantRedshift: 0,
      remnantRadius: 1,
      remnantEmberAt: 0.5,
      remnantWhiteness: 0.25,
      remnantDeep: 0.6,
      remnantDim: 0.7,
      holeOvalX: 0,
      holeOvalY: 0,
      gravityWaveAmplitude: 0,
      gravityWaveTime: -1,
      gravityWaveFrequency: 1,
      gravityWaveDecay: 1,
      gravityWaveRadius: 1,
      gravityWaveSpin: 0,
      gravityWaveAngle: 0,
      gravityWaveSpeed: 1,
      pairFront: -1,
      pairFrontSoft: 1,
      pairScale: 1,
      waveScale: 1,
      pairLensMain: 0,
      pairLensCompanion: 0,
      pairNearer: 0,
      lensBubble: 1,
      companionLensCore: 0.5,
      companionLensStyle: 0,
      companionSpin: 0,
      companionSpinAxis: 0,
      companionShape,
      companionRingDoppler: 0,
      companionRingSide: 0,
      companionRingFeed: 0,
      waveLensCompanion: 0,
      waveLensMain: 0,
      pairPlane: new Float32Array([1, 0, 0, 1]),
      turn: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      skySphere: 0,
      skyCenter: 0,
      skyVanishX: 0,
      skyVanishY: 0,
      skySize: 0,
      skyBend: 0,
      gravityWaveX: 0,
      gravityWaveY: 0,
      companionX: 0,
      companionY: 0,
      companionRadius: 0,
      companionEinstein: 0,
      frontAdd: 0,
      frontWaves: 0,
      pairX: 0,
      pairY: 0,
      pairWave: 0,
      pairPhase: 0,
      pairPitch: 0,
      backgroundStars: 0,
      starCell: 26,
      starDensity: 0,
      starPlacement: 0.6,
      starsPerCell: 1,
      starNeighbors: 0,
      starCellWarp: 1,
      starSkyEven: 1,
      starFlare: 0,
      nebula: 0,
      web: 0,
      webCell: 1,
      webWidth: 0.06,
      webGalaxies: 24,
      webSize: 0.12,
      webHole: 0,
      webColor: createSceneColor(),
      nebulaColor: createSceneColor(),
      nebulaColorDeep: createSceneColor(),
      nebulaColorCore: createSceneColor(),
      nebulaScale: 0,
      nebulaSparseness: 0,
      nebulaEdge: 0,
      nebulaWarp: 0,
      nebulaContrast: 0,
      nebulaGrain: 0,
      nebulaDriftX: 0,
      nebulaDriftY: 0,
      nebulaPatch: 0,
      nebulaPatchShare: 0,
      nebulaPatchSoftness: 0,
      nebulaCore: 0,
      nebulaCoreFrom: 0,
      nebulaSpaceX: 0,
      nebulaSpaceY: 0,
      nebulaSpaceZ: 0,
      nebulaDetail: 3,
      nebulaLacunarity: 2.1,
      nebulaRoughness: 0.5,
      nebulaCurlSize: 0.8,
      nebulaGrainSize: 1.7,
      starWarm: createSceneColor(),
      starCool: createSceneColor(),
      starSpread: STAR_SPREAD,
      starTwinkle: 0.15,
      starTwinkleSpeed: 1,
      starFaintest: 0.25,
      starFlareDecay: 0.18,
      dustScale: 220,
      dustThreshold: 0.5,
      lightDustContrast: 1,
      dustSweep: 1,
      echoFloor: 0,
      dustShock: 0,
      dustBlow: 0,
      dustDrift: 0,
      dustBlowTime: 1.2,
      dustDriftX: 0.8,
      dustDriftY: -0.6,
      dustShockOffset: 0.6,
      dustShockSharpness: 3,
      dustShockTint: 0.5,
      dustLayers: 3,
      dustFineness: 2.1,
      dustRoughness: 0.5,
      dustWarp: 0.9,
      dustWarpScale: 0.8,
      echoTintEase: 2,
      skyGrid: 0,
      gridCell: 64,
      gridPull: 0,
      gridHaze: 6,
      gridHazeSpan: 0.5,
      gridColor: createSceneColor(),
      whiteHole: 0,
      whiteColor: createSceneColor(),
      skyGridLine: 1.5,
      gridSphere: 0,
      gridSlant: 0.75,
      gridDecades: 0,
      gridSide: 1,
      colorFlash: 0xffffff,
      colorLight: 0xffffff,
      colorDust: 0xffffff,
      colorTitle: 0xffffff,
      colorEmber: 0xffffff,
      cameraZoom: 1,
      zoomX: 0,
      zoomY: 0,
      shakeX: 0,
      shakeY: 0,
      lensFringe: 0,
      lensFringeEase: 1,
      vignette: 0,
      filmGrain: 0,
      letterbox: 0,
      vignetteStart: 0.45,
      vignetteEnd: 1.45,
      filmKnee: 0.8
    },
    grid: settings.sheet,
    lattice: createLatticeSettings(),
    flows: FLOW_KEYS.map(() => createFlowSettings()),
    flowSeed: 0,
    bloom: { strength: 0, threshold: 0.3, knee: 0.25, reach: 0.08, tail: 0.85, color: createSceneColor() },
    photons: createPhotonSettings(),
    beams: createBeamSettings(),
    fieldRing: createFieldRingSettings(),
    step: settings
  }

  function readBackground (state: SimulationSettings) {
    background[0] = state.backgroundR
    background[1] = state.backgroundG
    background[2] = state.backgroundB
    return background
  }

  // The intro happens at the screen centre, at the saved black hole position, or between the two
  function locateHole (state: SimulationSettings, params: IntroParams) {
    const share = params.originAtHole
    const centerX = scene.width / 2
    const centerY = scene.height / 2
    anchorX = state.blackHoleX * scene.width
    anchorY = state.blackHoleY * scene.height
    originX = centerX + (anchorX - centerX) * share
    originY = centerY + (anchorY - centerY) * share
  }

  // The black hole is born where the intro happens and heads for its resting place once released
  function placeHole (from: SceneInput, atRest = false) {
    locateHole(from.settings, from.params)
    hole.x = atRest ? anchorX : originX
    hole.y = atRest ? anchorY : originY
    hole.vx = 0
    hole.vy = 0
    pointer.x = anchorX
    pointer.y = anchorY
  }

  function syncSpawn (state: SimulationSettings) {
    if (state.colorPalette !== spawn.palette.source) spawn.palette = createPaletteSampler(state.colorPalette)
    spawn.farZ = state.farZ
    spawn.speedVariance = state.speedVariance
    spawn.radius = state.spawnRadius
  }

  function fire (layers: readonly IntroLayer[], from: SceneInput) {
    const p = from.params
    let blast = 0
    let ring = 0
    let title = false
    let start = Infinity
    for (const layer of layers) {
      const bit = LAYER_BIT[layer]
      if (bit === TITLE) {
        // A title lit by the light front is there from the explosion; any other entrance has its own start
        title = true
        start = Math.min(start, Math.round(p.titleEntrance) === 0 ? p.collapseAt : p.titleInAt)
      } else if ((bit & RING_LAYERS) !== 0) {
        ring |= bit
        start = Math.min(start, p.horizonAt + p.horizonGrowth)
      } else if ((bit & BLAST_LAYERS) !== 0) {
        blast |= bit
        start = Math.min(start, bit === STAR ? p.starChargeStart : p.collapseAt)
      }
    }
    if (blast !== 0) {
      cue.blastLayers = blast
      cue.blastTime = start
    }
    if (ring !== 0) {
      cue.ringLayers = ring
      cue.ringTime = start
    }
    if (title) {
      cue.title = true
      cue.titleTime = start
    }
  }

  async function makeTitle (style: TitleStyle, fontTimeoutMs: number) {
    await waitForTitleFont(style, fontTimeoutMs)
    return renderTitleSprite(style, scene.width, scene.pixelRatio)
  }

  function useTitle (sprite: TitleSprite) {
    titleSprite = sprite
    renderer?.setTitle(sprite)
  }

  function restart (from: SceneInput, introTime = 0) {
    scene.introTime = introTime
    cue.blastLayers = 0
    cue.ringLayers = 0
    cue.title = false
    fadeBacklog = 0
    flashPlaceX = NaN
    photonTrace.x = NaN
    photonTrace.lastX = NaN
    shakeLead = 0
    undertoneLead = 0
    view.spin = 0
    field.count = 0
    frame.fieldBorn = 0
    frame.fieldTick = 0
    frame.ringClear = true
    clearOrbiters(orbiters)
    clearRingEnergy(ringEnergy)
    for (let slot = 0; slot < frame.flows.length; slot++) resetFlow(frame.flows[slot])
    syncSpawn(from.settings)
    setParticleCount(field, from.settings.fieldEnabled ? from.settings.numParticles : 0, spawn)
    placeHole(from)
    readBackground(from.settings)
    renderer?.clearScene()
  }

  // Rebuilds the title mask when its text, face, layout or the view changes, once the face has the
  // glyphs. Only the latest request draws, so fast typing never shows an older text
  function rebuildTitle (force = false) {
    if (!renderer || !titleStyle) return titleReady
    const style = titleStyle
    const key = `${JSON.stringify(style)}|${scene.width}|${scene.pixelRatio}`
    if (!force && key === titleKey) return titleReady
    titleKey = key
    const build = ++titleBuild
    titleReady = waitForTitleFont(style, titleFontTimeoutMs).then(() => {
      if (disposed || !renderer || build !== titleBuild) return
      titleSprite = renderTitleSprite(style, scene.width, scene.pixelRatio)
      renderer.setTitle(titleSprite)
    })
    return titleReady
  }

  function setTitle (style: TitleStyle, fontTimeoutMs: number, force = false) {
    titleStyle = style
    titleFontTimeoutMs = fontTimeoutMs
    return rebuildTitle(force)
  }

  // World coordinates do not depend on the view, so a resize only reallocates GPU buffers
  function resize (width: number, height: number, pixelRatio: number, force = false) {
    if (!renderer || (!force && width === scene.width && height === scene.height && pixelRatio === scene.pixelRatio)) return false

    // Keep the anchored black hole at the same relative spot
    if (scene.width > 0 && scene.height > 0) {
      const scaleX = width / scene.width
      const scaleY = height / scene.height
      pointer.x *= scaleX
      pointer.y *= scaleY
      hole.x *= scaleX
      hole.y *= scaleY
    }

    scene.width = width
    scene.height = height
    scene.pixelRatio = pixelRatio
    renderer.resize(width, height, pixelRatio)
    void rebuildTitle()
    return true
  }

  // Where the 3D camera sees a point of the scene (its pose, around the pivot at this depth), into `seen`
  function look (x: number, y: number, z: number, pivot: number, focal: number) {
    const away = z - pivot
    const depth = pose[6] * x + pose[7] * y + pose[8] * away + pose[11]
    const scale = focal / Math.max(depth, NEAR_DEPTH)
    seen.x = (pose[0] * x + pose[1] * y + pose[2] * away + pose[9]) * scale + settings.vanishX
    seen.y = (pose[3] * x + pose[4] * y + pose[5] * away + pose[10]) * scale + settings.vanishY
    seen.depth = depth
  }

  function drawIdle () {
    if (!renderer) return
    // Nothing is stepped and the ring's light keeps what it has: only the picture is put together again
    frame.fieldCount = 0
    frame.ringKeep = 1
    frame.orbitCount = 0
    frame.fadeAlpha = 0
    frame.present = true
    renderer.render(frame)
  }

  function advance (frameScale: number, dt: number, from: SceneInput, present = true) {
    if (!renderer) return
    const { settings: state, params, hidden, reducedMotion } = from
    const viewportWidth = scene.width
    const viewportHeight = scene.height

    scene.time += dt
    scene.introTime += dt
    const animationTime = scene.time

    // The explosion and the black hole's resting place, and how fast light crosses from one to the far corner
    const shortSide = Math.min(viewportWidth, viewportHeight)
    locateHole(state, params)
    // Every front is measured to the corner farthest from the explosion, and a little past it
    const explosionReach = Math.hypot(Math.max(originX, viewportWidth - originX), Math.max(originY, viewportHeight - originY)) * params.lightReach
    const lightSpeed = explosionReach / params.lightCrossTime
    // The horizon rings as a real black hole of its size would, scaled by the intro's multipliers
    // A second black hole turns with the main one around the place the black hole stands; the main one
    // grows as it takes the companion in
    const shadowShare = state.blackHoleSize / 100
    stepPair(
      pair, state.companionSize, state.companionDistance, state.companionSpeed, state.companionWaves, shadowShare, dt, scene.time,
      state.companionClosest, state.companionSpin
    )
    // The pair circles in a plane of its own, the same in both modes: Orbit Tilt turns it from the plane
    // across the line of flight about a line of the screen, so that the side Tilt Toward points to (0 up,
    // 90 left) goes away from the camera. At no tilt the pair keeps its places, and at 180 it circles the
    // same plane the other way
    tiltPlane(state.companionTilt, state.companionNode, pairPlane)
    // The holes' own spins along the scene's x, y and z (its y runs down, its z away from the camera), as
    // Spin Tilt and Spin Axis, and the second hole's own, set them straight on
    const ownTilt = state.spinTilt * DEGREE
    const ownAxis = state.spinAxis * DEGREE
    const secondTilt = state.companionSpinTilt * DEGREE
    const secondAxis = state.companionSpinAxis * DEGREE
    const secondSpin = pair.companion > 0 ? state.companionOwnSpin : 0
    spins[0] = -state.blackHoleSpin * Math.sin(ownTilt) * Math.sin(ownAxis)
    spins[1] = -state.blackHoleSpin * Math.sin(ownTilt) * Math.cos(ownAxis)
    spins[2] = -state.blackHoleSpin * Math.cos(ownTilt)
    spins[3] = -secondSpin * Math.sin(secondTilt) * Math.sin(secondAxis)
    spins[4] = -secondSpin * Math.sin(secondTilt) * Math.cos(secondAxis)
    spins[5] = -secondSpin * Math.cos(secondTilt)
    // Precession: the spins and the orbit turn each other about their total angular momentum. The plane is
    // carried by the shortest turn from where its tilt sets it to where it now faces, so its own directions,
    // which the pair's angle is counted along, keep their places in it; the spins are turned as they are
    if (pair.companion > 0 && state.companionPrecession > 0 && (state.blackHoleSpin > 0 || secondSpin > 0)) {
      precessPair(
        pair, state.companionSize, state.companionDistance, state.companionSpeed, shadowShare, dt, state.companionClosest,
        state.companionPrecession, pairPlane[6], pairPlane[7], pairPlane[8], spins[0], spins[1], spins[2], spins[3], spins[4], spins[5]
      )
    }
    if (pair.precessed !== 0) {
      const faceX = pairPlane[6]
      const faceY = pairPlane[7]
      const faceZ = pairPlane[8]
      precessed(pair, faceX, faceY, faceZ, turned, 0)
      for (let column = 0; column < 9; column += 3) {
        turnOnto(faceX, faceY, faceZ, turned[0], turned[1], turned[2], pairPlane[column], pairPlane[column + 1], pairPlane[column + 2], pairPlane, column)
      }
      precessed(pair, spins[0], spins[1], spins[2], spins, 0)
      precessed(pair, spins[3], spins[4], spins[5], spins, 3)
    }
    // Where the two stand from their centre, in the scene's x, y and z, in radii of the main hole before it grew
    const mainSceneX = pair.mainX * pairPlane[0] + pair.mainY * pairPlane[3]
    const mainSceneY = pair.mainX * pairPlane[1] + pair.mainY * pairPlane[4]
    const mainSceneZ = pair.mainX * pairPlane[2] + pair.mainY * pairPlane[5]
    const companionSceneX = pair.companionX * pairPlane[0] + pair.companionY * pairPlane[3]
    const companionSceneY = pair.companionX * pairPlane[1] + pair.companionY * pairPlane[4]
    const companionSceneZ = pair.companionX * pairPlane[2] + pair.companionY * pairPlane[5]
    const shadowRadius = shadowShare * shortSide * pair.growth
    getRingdownTiming(params, shadowRadius, lightSpeed, ringTiming)

    sampleIntro(scene.introTime, reducedMotion, params, ringTiming, intro)
    // The opening's own matter front, before a fired blast takes its place: in 3D the field is revealed by
    // a sphere that goes on growing after the front has left the screen
    const openingFront = intro.matterFront
    if (hidden.star) intro.starGlow = 0
    if (hidden.glare) {
      intro.sourcePower = 0
      intro.exposure = 1
    }
    if (hidden.light) intro.lightPower = 0
    if (hidden.echo) intro.echoPower = 0
    if (hidden.stars) intro.backgroundStars = 0
    if (hidden.shockwave) intro.waveStrength = 0
    if (hidden.reveal) intro.reveal = 1
    if (hidden.burst) intro.speedBoost = 1
    if (hidden.remnant) intro.remnantGlow = 0
    if (hidden.title) intro.titleAlpha = 0
    // A fired blast: the opening's own frame at the blast's clock stands in for what the opening shows of
    // these layers, which by now is nothing, and the explosion's place is the black hole
    const blastAtHole = cue.blastLayers !== 0
    if (blastAtHole) {
      const on = cue.blastLayers
      cue.blastTime += dt
      sampleIntro(cue.blastTime, false, params, ringTiming, cueFrame)
      const glare = (on & GLARE) !== 0 && !hidden.glare
      intro.starGlow = (on & STAR) !== 0 && !hidden.star ? cueFrame.starGlow : 0
      intro.starRadius = cueFrame.starRadius
      intro.sourcePower = glare ? cueFrame.sourcePower : 0
      intro.exposure = glare ? cueFrame.exposure : 1
      intro.lightFront = cueFrame.lightFront
      intro.lightPower = (on & LIGHT) !== 0 && !hidden.light ? cueFrame.lightPower : 0
      intro.echoPower = (on & ECHO) !== 0 && !hidden.echo ? cueFrame.echoPower : 0
      intro.matterFront = cueFrame.matterFront
      intro.waveStrength = (on & SHOCKWAVE) !== 0 && !hidden.shockwave ? cueFrame.waveStrength : 0
      intro.dustShock = (on & ECHO) !== 0 ? cueFrame.dustShock : 0
      intro.speedBoost = (on & BURST) !== 0 && !hidden.burst ? cueFrame.speedBoost : 1
      intro.remnantGlow = (on & REMNANT) !== 0 && !hidden.remnant ? cueFrame.remnantGlow : 0
      intro.remnantRedshift = cueFrame.remnantRedshift
      let jolt = 0
      if ((on & CAMERA) !== 0 && !hidden.camera) {
        intro.cameraZoom *= 1 + cueFrame.cameraKick
        intro.shake = cueFrame.shake
        jolt = Math.max(cueFrame.cameraKick, cueFrame.shake)
      }
      const left = Math.max(
        intro.starGlow, intro.sourcePower, intro.lightPower, intro.echoPower, intro.waveStrength,
        intro.speedBoost - 1, intro.remnantGlow, jolt
      )
      // The core only starts to glow after the explosion, so nothing is called over before that
      if (cue.blastTime > Math.max(params.remnantAt, params.collapseAt) + params.glareRise && left < CUE_FADED) cue.blastLayers = 0
    }
    // A fired title lives its life again, from its entrance to its exit
    if (cue.title) {
      cue.titleTime += dt
      sampleIntro(cue.titleTime, false, params, ringTiming, cueFrame)
      intro.titleAlpha = hidden.title ? 0 : cueFrame.titleAlpha
      intro.titleReveal = cueFrame.titleReveal
      intro.titleDissolve = cueFrame.titleDissolve
      intro.titleAge = cueFrame.titleAge
      intro.titleFall = cueFrame.titleFall
      intro.titleGrain = cueFrame.titleGrain
      intro.titleBurn = cueFrame.titleBurn
      intro.titleFly = cueFrame.titleFly
      if (cue.titleTime >= params.dissolveAt + params.dissolveDuration) cue.title = false
    }
    // Seconds since a fired ringing began; negative while its clock is still at an earlier layer
    let sinceCueRing = -1
    if (cue.ringLayers !== 0) {
      cue.ringTime += dt
      sinceCueRing = cue.ringTime - (params.horizonAt + params.horizonGrowth)
    }
    // A hole that formed alone wobbles in place, long sideways and then long upright: the opening's, and
    // one fired again. The RINGDOWN layer removes it and the flicker of the photon ring with it
    let wobble = hidden.ringdown ? 0 : intro.ringdown
    if ((cue.ringLayers & RINGDOWN) !== 0 && !hidden.ringdown) wobble += ringdownWobble(sinceCueRing, params.ringdownAmplitude, ringTiming)
    // Two black holes becoming one are another matter. As their shadows overlap the main one is drawn out
    // along the line between them, the most as they become one. What they leave is a spinning hole, whose
    // oval keeps turning the way the two circled, half a turn a wobble, while it fades. It rings as a real
    // hole of its size and spin does, at the speed of light the pair's own orbit is counted in, so the
    // last turns of the pair, the merger and the ringing are one motion. Two equal holes leave an oval Merger
    // Oval times longer than one forming in the intro
    const sinceMerger = pair.mergedAt >= 0 ? scene.time - pair.mergedAt : -1
    const pairLight = LIGHT_SPEED * shortSide
    const pairRate = Math.max(Math.abs(state.companionSpeed), 0.01)
    mergerRing.frequency = RINGDOWN_PHYSICAL_FREQUENCY * pair.ringPitch * pairRate * pairLight / Math.max(shadowRadius, 4)
    mergerRing.decay = RINGDOWN_PHYSICAL_DECAY * pair.ringLength * Math.max(shadowRadius, 4) / (pairRate * pairLight)
    let drawnOut = 0
    let drawnAlong = 0
    let ringing = 0
    if (pair.companion > 0 && !hidden.ringdown) {
      const most = params.ringdownAmplitude * state.companionOval * pair.symmetry
      if (sinceMerger < 0) {
        drawnOut = most * pair.merged
        drawnAlong = pair.phase
        ringing = drawnOut
      } else {
        drawnOut = most * Math.exp(-sinceMerger / mergerRing.decay)
        drawnAlong = pair.mergedPhase + pair.mergedTurn * Math.PI * mergerRing.frequency * sinceMerger
        ringing = drawnOut * Math.cos(2 * Math.PI * mergerRing.frequency * sinceMerger)
      }
    }
    const ovalX = wobble + drawnOut * Math.cos(2 * drawnAlong)
    const ovalY = drawnOut * Math.sin(2 * drawnAlong)
    const ringdown = wobble + ringing
    const ringPower = intro.ringFade * Math.max(1 + params.ringFlicker * ringdown, 0)
    scene.ringdown = ringdown

    syncSpawn(state)
    // With the field off none of its particles is kept; turned on again it is made anew at every depth
    const fieldCount = state.fieldEnabled ? state.numParticles : 0
    if (fieldCount !== field.count) {
      // The newborn go to the graphics card with the next step
      if (fieldCount > field.count) frame.fieldBorn = Math.min(frame.fieldBorn, field.count)
      setParticleCount(field, fieldCount, spawn)
    }
    frame.fieldCount = field.count
    frame.palette = spawn.palette
    frame.spawnRadius = spawn.radius
    frame.speedVariance = spawn.speedVariance

    // The black hole: born where the intro happens, then pulled toward its target on a spring.
    // An anchored hole rests at its saved position, which a slider or a preset may have just moved
    const centerX = viewportWidth / 2
    const centerY = viewportHeight / 2
    if (!state.blackHoleFollowing && !pointer.holding) {
      pointer.x = anchorX
      pointer.y = anchorY
    }
    // The visible size and the radius of no return are set apart; both grow as the horizon forms.
    // The ringdown does not resize the horizon: it squashes it into an oval (composite.holeOval)
    const holeGrowth = hidden.hole ? 0 : intro.holeScale
    const horizon = shadowRadius * holeGrowth
    const captureRadius = horizon * state.horizonScale
    if (intro.holdAtCenter) {
      stepSpring(hole, originX, originY, dt, params.centerHoldFrequency)
    } else {
      stepSpring(hole, pointer.x, pointer.y, dt, state.followFrequency)
    }
    // The pair's lengths are in radii of the main hole before it grew; alone, the hole is its centre. The
    // flat mode draws the holes at no depth: it shows their orbit as it lies across the screen, and only
    // which of the two is nearer (below) takes the depth from it
    const pairUnit = horizon / pair.growth
    let holeX = hole.x + mainSceneX * pairUnit
    let holeY = hole.y + mainSceneY * pairUnit
    const companionRadius = pair.companion * pairUnit

    // 3D: the field is stepped in space and seen by a camera that circles the point at the black hole's
    // depth on the line of flight. The camera eases between the flat view and its place, so the switch
    // turns the view instead of cutting it; straight on, everything lands where the flat mode puts it
    const blendTarget = state.threeD ? 1 : 0
    if (view.blend !== blendTarget) {
      const move = reducedMotion || !(state.threeDEase > 0) ? 1 : dt / state.threeDEase
      view.blend = blendTarget > view.blend ? Math.min(view.blend + move, 1) : Math.max(view.blend - move, 0)
    }
    const threeD = state.threeD || view.blend > 0
    // The camera's turn and elevation, in radians (0 in the flat view), then where it stands and looks
    // beyond its circle: its roll and the turn of its head, in radians, and its move right, up and in, in
    // scene units. Things have their places in the scene; the pose is how they are seen
    let yaw = 0
    let pitch = 0
    let roll = 0
    let lookYaw = 0
    let lookPitch = 0
    let moveRight = 0
    let moveUp = 0
    let moveIn = 0
    // The point the camera circles, and how much nearer to it than that the camera's move has brought it
    const pivot = Math.max(state.farZ * state.blackHoleDepth / 100, state.farZ * state.threeDNearest)
    let nearer = 1
    // How far the 3D camera has eased in: the sheet's pose turns from the flat camera's to the scene's with it
    let eased = 0
    if (threeD) {
      view.spin = (view.spin + state.cameraSpin * DEGREE * dt) % FULL_TURN
      eased = view.blend * view.blend * (3 - 2 * view.blend)
      yaw = eased * (state.cameraYaw * DEGREE + view.spin)
      pitch = eased * state.cameraPitch * DEGREE
      // Camera Bank: the camera leans into a swing round the hole, by degrees for each degree a second it
      // swings, the swing smoothed over BANK_LAG seconds; a turn of more than Cut at Turn in one frame is a
      // cut and leans nothing
      const circle = state.cameraYaw + view.spin / DEGREE
      if (dt > 0 && view.circle > -1e8) {
        const turn = circle - view.circle
        const swing = Math.abs(turn * DEGREE) > state.cameraCutTurn ? 0 : Math.max(-MAX_SWING, Math.min(turn / dt, MAX_SWING))
        view.swing += (swing - view.swing) * Math.min(dt / BANK_LAG, 1)
      }
      view.circle = circle
      // Camera Float: a hand on the camera, a slow sway of its roll and head of about this many degrees that
      // does not repeat within a film, on the scene's own clock; still under reduced motion
      const hand = reducedMotion ? 0 : state.cameraFloat
      roll = eased * (state.cameraRoll + state.cameraBank * view.swing + hand * sway(scene.time, 0.6, 1)) * DEGREE
      lookYaw = eased * (state.cameraLookYaw + 0.7 * hand * sway(scene.time, 0.45, 2)) * DEGREE
      lookPitch = eased * (state.cameraLookPitch + 0.5 * hand * sway(scene.time, 0.7, 0.5)) * DEGREE
      // The moves are in radii of the hole at its full size, or of the lattice's stand-in without one
      const moveUnit = eased * (shadowRadius > 0 ? shadowRadius : state.gridLatticeUnit * shortSide) * pivot / Math.max(centerX, centerY)
      moveRight = state.cameraMoveRight * moveUnit
      moveUp = state.cameraMoveUp * moveUnit
      moveIn = state.cameraMoveIn * moveUnit
      cameraPose(yaw, pitch, roll, lookYaw, lookPitch, moveRight, moveUp, moveIn, pivot, pose)
      if (moveRight !== 0 || moveUp !== 0 || moveIn !== 0) {
        nearer = pivot / Math.max(Math.hypot(moveRight, moveUp, pivot - moveIn), NEAR_DEPTH)
      }
    } else {
      view.spin = 0
      view.circle = -1e9
      view.swing = 0
    }

    // Flat Depth: the flat mode draws that share of a tilted orbit's depth, in perspective round the pair's
    // centre as 3D straight on does, the nearer hole larger and farther from the centre. Its distance is
    // held to a tenth of the pivot's, where 3D would have flown past it
    let flatHoleScale = 1
    let flatCompanionScale = 1
    if (!threeD && companionRadius > 0 && state.companionFlatDepth > 0) {
      const unit = pairUnit * pivot / Math.max(centerX, centerY)
      const nearest = 0.1 * pivot
      flatHoleScale = 1 + state.companionFlatDepth * (pivot / Math.max(pivot + mainSceneZ * unit, nearest) - 1)
      flatCompanionScale = 1 + state.companionFlatDepth * (pivot / Math.max(pivot + companionSceneZ * unit, nearest) - 1)
      holeX = hole.x + mainSceneX * pairUnit * flatHoleScale
      holeY = hole.y + mainSceneY * pairUnit * flatHoleScale
    }

    // Spin: the hole's own and, as two black holes merge, that of the hole they leave, about the axis of
    // their orbit, the way their plane faces, which keeps the two holes' own spins by the squares of their
    // shares of the mass. They add as vectors in the share the merger has come
    const keep = 1 - pair.merged
    // A pair turning the way its plane's angles run (clockwise to the eye at no tilt) spins the way the
    // plane faces, its third direction; the scene's y runs down and its z away from the camera
    const mergedSpin = pair.spin * pair.merged * (pair.omega > 0 ? 1 : -1)
    const pairMass = 1 + pair.companion
    const mainKept = keep + pair.merged / (pairMass * pairMass)
    const secondKept = pair.merged * pair.companion * pair.companion / (pairMass * pairMass)
    const sceneRight = spins[0] * mainKept + spins[3] * secondKept + mergedSpin * pairPlane[6]
    const sceneUp = -(spins[1] * mainKept + spins[4] * secondKept + mergedSpin * pairPlane[7])
    const sceneToward = -(spins[2] * mainKept + spins[5] * secondKept + mergedSpin * pairPlane[8])
    // Spin Tilt and Spin Axis are seen straight on. In 3D the axis stands in the scene and the camera
    // circles it, so the shadow, the lens and the ring see it turned by the camera (the scene's y runs down
    // and its z away from the camera); the particles and the orbiting stars feel it as it stands
    let spinRight = sceneRight
    let spinUp = sceneUp
    let spinToward = sceneToward
    if (threeD) {
      spinRight = pose[0] * sceneRight - pose[1] * sceneUp - pose[2] * sceneToward
      spinUp = -(pose[3] * sceneRight - pose[4] * sceneUp - pose[5] * sceneToward)
      spinToward = -(pose[6] * sceneRight - pose[7] * sceneUp - pose[8] * sceneToward)
    }
    const across = Math.sqrt(spinRight * spinRight + spinUp * spinUp)
    const spin = horizon > 0 ? Math.min(Math.sqrt(across * across + spinToward * spinToward), SPIN_MAX) : 0
    const spinTilt = Math.atan2(across, spinToward)
    const spinAxis = across > 0 ? Math.atan2(-spinRight, spinUp) : ownAxis
    // The second hole's own spin, fading as it merges, seen the same way
    const secondRight = spins[3] * keep
    const secondUp = -spins[4] * keep
    const secondToward = -spins[5] * keep
    let seenRight = secondRight
    let seenUp = secondUp
    let seenToward = secondToward
    if (threeD) {
      seenRight = pose[0] * secondRight - pose[1] * secondUp - pose[2] * secondToward
      seenUp = -(pose[3] * secondRight - pose[4] * secondUp - pose[5] * secondToward)
      seenToward = -(pose[6] * secondRight - pose[7] * secondUp - pose[8] * secondToward)
    }
    const secondAcross = Math.sqrt(seenRight * seenRight + seenUp * seenUp)
    const companionSpin = companionRadius > 0 ? Math.min(Math.sqrt(secondAcross * secondAcross + seenToward * seenToward), SPIN_MAX) : 0
    const companionSpinTilt = Math.atan2(secondAcross, seenToward)
    const companionSpinAxis = secondAcross > 0 ? Math.atan2(-seenRight, seenUp) : secondAxis
    // The grid on the horizon is drawn about the spin's axis, and about Spin Tilt and Spin Axis while the hole
    // does not spin, seen as the spin is. Its longitudes are counted from a meridian that stands in the
    // scene (the one toward the scene's right, or its up while the axis lies along the right), so the
    // camera's own meridian, the one the ray tracer starts from, is that far round
    let axisRight = spinRight
    let axisUp = spinUp
    let axisToward = spinToward
    if (across === 0 && spinToward === 0) {
      const ownRight = -Math.sin(ownTilt) * Math.sin(ownAxis)
      const ownUp = Math.sin(ownTilt) * Math.cos(ownAxis)
      const ownToward = Math.cos(ownTilt)
      axisRight = ownRight
      axisUp = ownUp
      axisToward = ownToward
      if (threeD) {
        axisRight = pose[0] * ownRight - pose[1] * ownUp - pose[2] * ownToward
        axisUp = -(pose[3] * ownRight - pose[4] * ownUp - pose[5] * ownToward)
        axisToward = -(pose[6] * ownRight - pose[7] * ownUp - pose[8] * ownToward)
      }
    }
    const axisLength = Math.sqrt(axisRight * axisRight + axisUp * axisUp + axisToward * axisToward)
    axisRight /= axisLength
    axisUp /= axisLength
    axisToward /= axisLength
    // The camera's meridian runs toward it from the axis; looking straight down the axis the ray tracer takes it
    // opposite the way the axis points on the screen
    const horizonAxis = axisRight !== 0 || axisUp !== 0 ? Math.atan2(-axisRight, axisUp) : ownAxis
    const cameraLongitude = meridianLongitude(pose, threeD, axisRight, axisUp, axisToward, horizonAxis)
    // Where the camera stands: the Ray Traced lens and the shadow's outline see the hole from there. A hole
    // still growing, or grown by a merger, is a lighter or heavier one seen from the same place, and a 3D
    // camera that moves nearer sees it from nearer
    const mass = horizon / (shadowShare * shortSide)
    let cameraU = Math.min((state.lensingRadius > 0 ? cameraFor(state.lensingRadius) : FAR_CAMERA) * mass * nearer, 1 / CLOSEST_CAMERA)
    // Lens from Camera: the lens sees the hole from where the scene's camera stands, a shadow of `horizon`
    // pixels (2.6 Schwarzschild radii) half the frame's long side away, nearer by the 3D camera's move, in
    // place of where Einstein Radius puts it; between the two the distances are blended on a log scale. The
    // Einstein ring is then the one a camera there sees, for the stylized lens too
    let einsteinRatio = state.lensingRadius
    const fromCamera = horizon > 0 && state.lensingRadius > 0 ? state.lensingFromCamera : 0
    if (fromCamera > 0) {
      const seenU = Math.min(horizon / CRITICAL_IMPACT * nearer / Math.max(centerX, centerY), 1 / CLOSEST_CAMERA)
      cameraU = fromCamera === 1 ? seenU : Math.exp((1 - fromCamera) * Math.log(cameraU) + fromCamera * Math.log(seenU))
      einsteinRatio = einsteinRatioAt(cameraU)
    }
    updateShadowShape(shadowShape, spin, spinTilt, cameraU)
    // The second hole is seen from the same place, a lighter hole by its share of the mass
    updateShadowShape(companionShape, companionSpin, companionSpinTilt, Math.min(cameraU * pair.companion / pair.growth, 1 / CLOSEST_CAMERA))
    // Particles are captured on the circle that fits the outline, which spin shifts off the hole's centre
    const shapeCos = Math.cos(spinAxis)
    const shapeSin = Math.sin(spinAxis)
    const captureX = holeX + horizon * flatHoleScale * (shadowShape.centerRight * shapeCos - shadowShape.centerUp * shapeSin)
    const captureY = holeY - horizon * flatHoleScale * (shadowShape.centerRight * shapeSin + shadowShape.centerUp * shapeCos)

    const speed = state.baseSpeed * intro.speedBoost
    scene.speed = speed

    settings.frameScale = frameScale
    settings.time = animationTime
    settings.speed = speed
    settings.width = viewportWidth
    settings.height = viewportHeight
    settings.focal = Math.max(centerX, centerY)
    // The newborn field flies out of the explosion, not out of the screen centre. Field at Hole then moves
    // the point the field is born around toward the black hole (a pair's centre), wherever that stands
    const fieldX = centerX + (originX - centerX) * intro.vanishAtOrigin
    const fieldY = centerY + (originY - centerY) * intro.vanishAtOrigin
    settings.vanishX = fieldX + (hole.x - fieldX) * state.fieldAtHole
    settings.vanishY = fieldY + (hole.y - fieldY) * state.fieldAtHole
    frame.vanishX = settings.vanishX
    frame.vanishY = settings.vanishY
    settings.holeX = holeX
    settings.holeY = holeY
    settings.companionX = hole.x + companionSceneX * pairUnit * flatCompanionScale
    settings.companionY = hole.y + companionSceneY * pairUnit * flatCompanionScale
    settings.companionRadius = companionRadius
    // Each hole captures on the circle that fits its outline, as large as the flat mode draws it
    settings.companionCapture = companionRadius * state.horizonScale * companionShape.radius * flatCompanionScale
    settings.holeRadius = horizon
    settings.captureRadius = captureRadius * shadowShape.radius * flatHoleScale
    settings.captureX = captureX
    settings.captureY = captureY
    // The particles are dragged round by the spin the shadow is drawn for: the same vector, held to the
    // fastest spin there is, times Frame Drag
    const dragShare = spin > 0 ? spin / Math.sqrt(across * across + spinToward * spinToward) * state.frameDrag : 0
    // The share of spin that lies in the screen sweeps the flat field's near and far particles apart Drag
    // Sweep times as hard; in 3D the axis stands in space and the drag turns round it as it is
    const sweep = threeD ? 1 : state.frameDragSweep
    settings.spinRight = sceneRight * dragShare * sweep
    settings.spinUp = sceneUp * dragShare * sweep
    settings.spinToward = sceneToward * dragShare
    // The second hole drags the particles round its own spin by the same law
    const secondDrag = companionRadius > 0 ? state.frameDrag : 0
    settings.companionSpinRight = secondRight * secondDrag * sweep
    settings.companionSpinUp = secondUp * secondDrag * sweep
    settings.companionSpinToward = secondToward * secondDrag
    // With the feed off the simulation stops collecting light, and old light does not return later
    const ringFed = state.ringEnabled && state.ringFeedEnabled
    if (ringWasFed && !ringFed) {
      clearRingEnergy(ringEnergy)
      frame.ringClear = true
    }
    ringWasFed = ringFed
    settings.ringEnergy = ringFed ? ringEnergy : null
    settings.ringCaptureEnergy = state.ringFeedCapture
    settings.ringSkimReach = state.ringFeedReach
    settings.ringSkimEnergy = state.ringFeedSkim
    settings.companionFed = ringFed && state.companionRingFeed > 0 ? 1 : 0
    frame.ringFed = ringFed
    settings.gravityReach = horizon * state.gravityReach
    settings.holeDepth = state.farZ * state.blackHoleDepth / 100
    settings.gravityDepth = state.farZ * state.gravityDepth / 100
    settings.lineWidth = state.particleSize
    settings.minLineWidth = state.particleSizeMin
    settings.endFade = state.threeDEndFade
    settings.gravityStrength = hidden.gravity ? 0 : state.gravityStrength
    settings.orbitalStrength = hidden.gravity ? 0 : state.orbitalStrength
    settings.gravityFalloff = state.gravityFalloff
    settings.gravityBell = state.gravityDepthBell
    settings.dragFalloff = state.frameDragFalloff
    settings.dragSight = state.frameDragSight
    // In space the orbital force turns about the line of flight, toward the camera, and the more the hole
    // spins the more about the spin's axis as it stands in the scene, by Swirl Follows Spin, along the
    // spin raised to Follow Curve
    const spinLength = Math.hypot(sceneRight, sceneUp, sceneToward)
    const swirlShare = spinLength > 0 ? state.orbitalSpinFollow * Math.pow(Math.min(spinLength, 1), state.orbitalSpinFollowCurve) : 0
    const toSpin = spinLength > 0 ? swirlShare / spinLength : 0
    const swirlX = sceneRight * toSpin
    const swirlY = -sceneUp * toSpin
    const swirlZ = -(1 - swirlShare) - sceneToward * toSpin
    const swirlLength = Math.hypot(swirlX, swirlY, swirlZ)
    const swirlHeld = swirlLength > 1e-6
    settings.swirlX = swirlHeld ? swirlX / swirlLength : 0
    settings.swirlY = swirlHeld ? swirlY / swirlLength : 0
    settings.swirlZ = swirlHeld ? swirlZ / swirlLength : -1
    // The equator faces the way the swirl turns about: down the line of flight while the hole stands still
    // or the scene is flat, the spin's axis as far as the swirl follows it. Its two directions are the
    // scene's x and y carried there by the shortest turn, so a plane that does not tilt keeps its places
    const faceX = threeD ? -settings.swirlX : 0
    const faceY = threeD ? -settings.swirlY : 0
    const faceZ = threeD ? -settings.swirlZ : 1
    if (faceZ > -0.999999) {
      const fold = 1 / (1 + faceZ)
      equator[0] = 1 - faceX * faceX * fold
      equator[1] = -faceX * faceY * fold
      equator[2] = -faceX
      equator[3] = -faceX * faceY * fold
      equator[4] = 1 - faceY * faceY * fold
      equator[5] = -faceY
    } else {
      // Facing straight back up the flight there is no shortest turn: it turns over about the scene's x
      equator[0] = 1
      equator[1] = 0
      equator[2] = 0
      equator[3] = 0
      equator[4] = -1
      equator[5] = 0
    }
    equator[6] = faceX
    equator[7] = faceY
    equator[8] = faceZ
    settings.inertia = state.gravityInertia
    settings.farZ = state.farZ
    settings.depthFade = state.depthFade
    settings.pulseSpeedMultiplier = state.pulseSpeedMultiplier
    settings.pulseIntensity = state.pulseIntensity
    settings.baseBrightness = state.baseBrightness
    settings.minOpacity = state.minOpacity
    settings.maxOpacity = state.maxOpacity
    settings.speedGlow = state.speedGlow
    settings.speedKnee = state.speedGlowKnee
    settings.redshift = state.gravityRedshift
    settings.lightSpread = state.particleLightSpread
    settings.sizeSpread = state.particleSizeSpread
    settings.rideStretch = state.gridRideStretch
    // Flat, the opening reveals what lies within the front on the screen. In 3D it reveals a sphere round
    // the blast's place, which goes on growing after the front has left the screen, until it holds the
    // whole field
    if (threeD) {
      const front = hidden.reveal ? Infinity : intro.reveal < 1 ? intro.reveal : openingFront > 1 ? openingFront : Infinity
      const revealRadius = explosionReach * front
      const worldPerPixel = pivot / settings.focal
      const blastAside = Math.hypot(originX - settings.vanishX, originY - settings.vanishY) * worldPerPixel
      const farthest = Math.hypot(blastAside + spawn.radius, Math.max(pivot, state.farZ - pivot))
      settings.revealRadius = revealRadius * worldPerPixel >= farthest ? Infinity : revealRadius
    } else {
      settings.revealRadius = intro.reveal >= 1 ? Infinity : explosionReach * intro.reveal
    }
    settings.revealX = originX
    settings.revealY = originY
    settings.revealFeather = params.revealFeather
    settings.opacityScale = intro.opacityScale

    // How much larger than at the pivot's distance each black hole looks; 0 hides one behind the camera
    let holeScale = flatHoleScale
    let companionScale = flatCompanionScale
    // The centre a pair turns about, on the screen, and how much larger than at the pivot it looks
    let centreX = hole.x
    let centreY = hole.y
    let centreScale = 1
    // The explosion's place, the same way
    let blastX = originX
    let blastY = originY
    let blastScale = 1
    const composite = frame.composite
    // What the composite pass sees through the camera's turn (the sky, the waves, the ringing oval) and
    // where a swallowed star's light lands: the pose's own turn in 3D, none straight on
    const seenTurn = composite.turn
    for (let slot = 0; slot < 9; slot++) seenTurn[slot] = threeD ? pose[slot] : slot % 4 === 0 ? 1 : 0
    // The flat mode's sky is a backdrop, the 3D camera's a sphere round it; one turns into the other as the
    // camera eases in
    composite.skySphere = threeD ? eased : 0
    // The particles' tint is measured from the line of flight: the scene's depth seen through that turn
    frame.flightX = seenTurn[2]
    frame.flightY = seenTurn[5]
    frame.flightZ = seenTurn[8]
    frame.flightFocal = settings.focal
    composite.pairLensMain = 0
    composite.pairLensCompanion = 0
    composite.pairNearer = 0
    // How far each black hole, and the centre they turn about, stand in front of the camera, in units of
    // the scene
    let holeAway = pivot
    let companionAway = pivot
    let centreAway = pivot
    if (threeD) {
      // The camera never circles a point nearer than a share of Field Depth (pivot, above), so a black hole
      // at depth 0 still has room around it
      const focal = settings.focal
      const worldPerPixel = pivot / focal
      // The pair's centre is a place of the scene: where the flat view shows the black hole, as far away
      // as the pivot. A camera that turns sees it move across the screen as it sees everything else. The
      // two turn around it in the plane of their orbit, which the camera sees at an angle
      const pairX = (hole.x - settings.vanishX) * worldPerPixel
      const pairY = (hole.y - settings.vanishY) * worldPerPixel
      const pairZ = pivot
      const unit = pairUnit * worldPerPixel
      settings.holeWorldX = pairX + mainSceneX * unit
      settings.holeWorldY = pairY + mainSceneY * unit
      settings.holeWorldZ = pairZ + mainSceneZ * unit
      settings.companionWorldX = pairX + companionSceneX * unit
      settings.companionWorldY = pairY + companionSceneY * unit
      settings.companionWorldZ = pairZ + companionSceneZ * unit
      look(settings.companionWorldX, settings.companionWorldY, settings.companionWorldZ, pivot, focal)
      settings.companionX = seen.x
      settings.companionY = seen.y
      companionAway = seen.depth
      companionScale = companionAway > NEAR_DEPTH ? pivot / companionAway : 0
      look(settings.holeWorldX, settings.holeWorldY, settings.holeWorldZ, pivot, focal)
      holeX = seen.x
      holeY = seen.y
      // A hole the camera has flown past is not drawn
      holeAway = seen.depth
      const holeBehind = holeAway <= NEAR_DEPTH
      holeScale = holeBehind ? 0 : pivot / holeAway
      look(pairX, pairY, pairZ, pivot, focal)
      centreX = seen.x
      centreY = seen.y
      centreAway = seen.depth
      centreScale = seen.depth > NEAR_DEPTH ? pivot / seen.depth : 0
      // The explosion happened at a place of the scene too, at the pivot's depth
      look((originX - settings.vanishX) * worldPerPixel, (originY - settings.vanishY) * worldPerPixel, pivot, pivot, focal)
      blastX = seen.x
      blastY = seen.y
      blastScale = seen.depth > NEAR_DEPTH ? pivot / seen.depth : 0
      settings.holeX = holeX
      settings.holeY = holeY
      settings.holeDepth = pivot
      settings.threeD = 1
      settings.cameraYaw = yaw
      settings.cameraPitch = pitch
      settings.cameraRoll = roll
      settings.cameraLookYaw = lookYaw
      settings.cameraLookPitch = lookPitch
      settings.cameraMoveRight = moveRight
      settings.cameraMoveUp = moveUp
      settings.cameraMoveIn = moveIn
      // Strokes start where the particles were seen in the frame before, unless the camera jumped: turned
      // by more than Cut at Turn, or moved by more than Cut at Move would show at the pivot
      let turned = yaw - view.yaw
      turned -= FULL_TURN * Math.round(turned / FULL_TURN)
      const cutTurn = state.cameraCutTurn
      const moved = Math.hypot(moveRight - view.moveRight, moveUp - view.moveUp, moveIn - view.moveIn) / worldPerPixel
      const cut = !view.stepped || Math.abs(turned) > cutTurn || Math.abs(pitch - view.pitch) > cutTurn ||
        Math.abs(roll - view.roll) > cutTurn || Math.abs(lookYaw - view.lookYaw) > cutTurn ||
        Math.abs(lookPitch - view.lookPitch) > cutTurn || moved > state.cameraCutShift
      settings.cameraYawFrom = cut ? yaw : view.yaw
      settings.cameraPitchFrom = cut ? pitch : view.pitch
      settings.cameraRollFrom = cut ? roll : view.roll
      settings.cameraLookYawFrom = cut ? lookYaw : view.lookYaw
      settings.cameraLookPitchFrom = cut ? lookPitch : view.lookPitch
      settings.cameraMoveRightFrom = cut ? moveRight : view.moveRight
      settings.cameraMoveUpFrom = cut ? moveUp : view.moveUp
      settings.cameraMoveInFrom = cut ? moveIn : view.moveIn
      // The orbiting stars circle the main hole: the renderer turns what they draw with the camera's
      // columns (where it sends the scene's x, then y, then z) and sets them and the flows at the hole's
      // distance (below 0: the hole is behind the camera and they are not drawn)
      const orbitTurn = frame.orbitTurn
      orbitTurn[0] = pose[0]
      orbitTurn[1] = pose[3]
      orbitTurn[2] = pose[6]
      orbitTurn[3] = pose[1]
      orbitTurn[4] = pose[4]
      orbitTurn[5] = pose[7]
      orbitTurn[6] = pose[2]
      orbitTurn[7] = pose[5]
      orbitTurn[8] = pose[8]
      frame.orbitFocal = focal
      frame.orbitDepth = holeBehind ? -1 : focal / holeScale
    } else {
      settings.threeD = 0
      frame.orbitFocal = 0
      // Flat, the two stand as far away as the pivot, nearer and farther by their orbit's depth
      const unit = pairUnit * pivot / settings.focal
      holeAway = pivot + mainSceneZ * unit
      companionAway = pivot + companionSceneZ * unit
    }
    // The pull near the horizon, matter born in orbit and the light of a particle's own motion
    // (field_step.ts). Matter in orbit is made anew past its band three times over, past the flight's reach
    // and past a second hole's orbit round the main one, all in the main hole's radii
    settings.relativity = state.gravityRelativity
    settings.orbitShare = state.fieldOrbit
    settings.orbitRadius = state.fieldOrbitRadius
    settings.orbitSpread = state.fieldOrbitSpread
    settings.orbitThick = state.fieldOrbitThick
    settings.orbitScatter = state.fieldOrbitScatter
    settings.orbitSecond = state.fieldOrbitSecond
    settings.orbitSense = state.orbitalStrength < 0 ? -1 : 1
    settings.viscosity = state.fieldViscosity
    const band = state.fieldOrbitRadius + state.fieldOrbitSpread
    settings.orbitEscape = Math.max(state.gravityReach, 3 * band, companionRadius > 0 ? 2 * (state.companionDistance + band) : 0)
    settings.doppler = state.particleDoppler
    settings.beam = state.particleBeam
    settings.shiftTint = state.particleDopplerTint
    settings.burst = 0
    // How fast each hole moves, per 60 Hz frame, from where it stood at the last step; a jump of more than
    // half its radius in a frame (a cut, an anchor moved) is no motion
    {
      const worldPerPixel = threeD ? pivot / settings.focal : 1
      const nowX = threeD ? settings.holeWorldX : settings.holeX
      const nowY = threeD ? settings.holeWorldY : settings.holeY
      const nowZ = threeD ? settings.holeWorldZ : 0
      const secondX = threeD ? settings.companionWorldX : settings.companionX
      const secondY = threeD ? settings.companionWorldY : settings.companionY
      const secondZ = threeD ? settings.companionWorldZ : 0
      const moving = holeMotion.stepped && holeMotion.threeD === threeD && frameScale > 0
      const most = 0.5 * horizon * worldPerPixel * frameScale
      let vx = moving ? nowX - holeMotion.x : 0
      let vy = moving ? nowY - holeMotion.y : 0
      let vz = moving ? nowZ - holeMotion.z : 0
      if (Math.hypot(vx, vy, vz) > most) vx = vy = vz = 0
      settings.holeVelX = vx / Math.max(frameScale, 1e-6)
      settings.holeVelY = vy / Math.max(frameScale, 1e-6)
      settings.holeVelZ = vz / Math.max(frameScale, 1e-6)
      vx = moving && companionRadius > 0 ? secondX - holeMotion.companionX : 0
      vy = moving && companionRadius > 0 ? secondY - holeMotion.companionY : 0
      vz = moving && companionRadius > 0 ? secondZ - holeMotion.companionZ : 0
      if (Math.hypot(vx, vy, vz) > most) vx = vy = vz = 0
      settings.companionVelX = vx / Math.max(frameScale, 1e-6)
      settings.companionVelY = vy / Math.max(frameScale, 1e-6)
      settings.companionVelZ = vz / Math.max(frameScale, 1e-6)
      if (frameScale > 0) {
        holeMotion.stepped = true
        holeMotion.threeD = threeD
        holeMotion.x = nowX
        holeMotion.y = nowY
        holeMotion.z = nowZ
        holeMotion.companionX = secondX
        holeMotion.companionY = secondY
        holeMotion.companionZ = secondZ
      }
    }
    // Two holes at different depths: the nearer one's lens bends the light of the farther, by the share
    // of the way from the camera to the farther that lies behind the nearer (a thin lens's share of what
    // it does to the sky) times Lens Through, and the nearer one's shadow covers the farther one's ring,
    // wholly once they are Hide Depth times their two radii apart in depth. The waves leave the pair's
    // centre, and are read through the nearer lens by the share that centre lies behind it, times Wave
    // Through
    let waveLensCompanion = 0
    let waveLensMain = 0
    if (companionRadius > 0 && holeAway > NEAR_DEPTH && companionAway > NEAR_DEPTH) {
      const behind = companionAway - holeAway
      const through = state.companionLensDepth
      composite.pairLensCompanion = behind > 0 ? Math.min(behind / companionAway * through, 1) : 0
      composite.pairLensMain = behind < 0 ? Math.min(-behind / holeAway * through, 1) : 0
      const apart = (horizon + companionRadius) * pivot / settings.focal * state.companionHideDepth
      composite.pairNearer = apart > 0 ? Math.min(Math.max(-behind / apart, -1), 1) : 0
      const nearest = Math.min(holeAway, companionAway)
      const waveShare = centreAway > nearest ? Math.min((centreAway - nearest) / centreAway * state.companionWaveLens, 1) : 0
      waveLensCompanion = behind < 0 ? waveShare : 0
      waveLensMain = behind > 0 ? waveShare : 0
    }
    // In 3D what stands nearer the camera than the nearer black hole is in front of the holes: its light
    // comes straight to the camera, neither bent by the lens nor covered by a shadow, and the renderer draws
    // it into layers of its own. Something between two holes is behind the nearer alone. The flat law takes
    // whatever covers the hole at any depth, so it has no front, nor has a hole not there or behind the camera
    let frontAway = 0
    if (threeD && horizon > 0 && holeAway > NEAR_DEPTH) {
      const nearest = companionRadius > 0 && companionAway > NEAR_DEPTH ? Math.min(holeAway, companionAway) : holeAway
      frontAway = nearest * settings.focal / pivot
    }
    settings.frontAway = frontAway
    // Behind that plane the share seen through the lens grows over Front Depth, in radii of the hole, but
    // what is seen within a shadow is the lens's whole
    settings.frontDepth = frontAway > 0 ? state.threeDFrontDepth * horizon : 0
    settings.holeSeen = frontAway > 0 ? horizon * holeScale : 0
    const secondBefore = frontAway > 0 && companionRadius > 0 && companionAway > NEAR_DEPTH
    settings.companionSeen = secondBefore ? companionRadius * companionScale : 0
    settings.holeFront = frontAway > 0 ? holeAway * settings.focal / pivot : 0
    settings.companionFront = secondBefore ? companionAway * settings.focal / pivot : 0
    // What stands between the two is the nearer hole's alone to bend, as far over the picture as its lens
    // moves things: Front Reach of its Einstein rings, or Bare Reach of its shadow's radii while there is no
    // lens, whichever is wider, and it lets go by Front Let Go times that
    const lensOn = state.lensingEnabled && !hidden.lens && einsteinRatio > 0
    const bareReach = Math.max(state.threeDFrontReachBare, 0.01)
    settings.frontReach = lensOn ? Math.max(state.threeDFrontReach * einsteinRatio, bareReach) : bareReach
    settings.frontLetGo = Math.max(state.threeDFrontLetGo, 1.01)
    // Front Curve bends the thin lens's share across Front Depth; Front Bend and Between Bend draw a share
    // of the band, and of what stands between two holes, once where the nearer lens shows it, with the
    // lenses' Einstein radii set below; a spinning hole's outline is what hides the band behind it
    settings.frontPower = Math.max(state.threeDFrontCurve, 0.01)
    settings.frontBend = frontAway > 0 ? state.threeDFrontBend : 0
    settings.frontBetween = frontAway > 0 ? state.threeDFrontBetween : 0
    settings.spinShape = frontAway > 0 && spin > 0 ? 1 : 0
    settings.spinTurn = spinAxis
    // The plane the waves and the ringing oval lie in, as the camera sees its two directions (right and
    // down on the picture): the pair's while there is one. A hole alone has no orbit, and its ringing and
    // a wave fired at it keep the plane across the line of flight, the one the opening is seen in
    const planeTurn = composite.pairPlane
    const inPlane = pair.companion > 0
    if (!inPlane) tiltPlane(state.loneTilt, state.loneNode, lonePlane)
    const ringPlane = inPlane ? pairPlane : lonePlane
    for (let side = 0; side < 2; side++) {
      const x = ringPlane[3 * side]
      const y = ringPlane[3 * side + 1]
      const z = ringPlane[3 * side + 2]
      planeTurn[2 * side] = seenTurn[0] * x + seenTurn[1] * y + seenTurn[2] * z
      planeTurn[2 * side + 1] = seenTurn[3] * x + seenTurn[4] * y + seenTurn[5] * z
    }

    // The space sheet is a piece of the main hole's equator. It is laid out here, before the particles are
    // stepped, because Particles on Sheet draws them on it. In 3D it is seen by the scene's own camera, as
    // the particles are; the flat mode sees it through a camera of its own, tipped by Sheet Tilt. Either way
    // its well's bottom is on the hole. While the 3D camera eases in, the sheet's pose turns from the one to
    // the other with it, the bottom kept on the hole
    const grid = frame.grid
    const onSheet = state.gridRide > 0 && horizon > 0
    const wellWidth = Math.max(state.gridWellWidth, 0.01)
    // The flash's photons ride the sheet too, drawn or not
    if (state.gridSheet > 0 || onSheet || state.gridFrontPhotons > 0 || state.gridBeams > 0) {
      const shared = threeD ? eased : 0
      // Wave Turn: the second hole along its orbit laid flat onto each layout's plane, the flat one the
      // scene's x and y, the 3D one the equator
      const orbitShare = companionRadius > 0 ? state.gridWaveOrbit : 0
      if (shared < 1) {
        let orbitX = 0
        let orbitY = 0
        if (orbitShare > 0) {
          orbitOnSheet(pairPlane, pair.phase, 0, 0, 1, turned)
          orbitX = turned[0]
          orbitY = turned[1]
        }
        // Well Width draws the main well as a hole that many times larger would dent it, its depth still in the
        // hole's own radii
        layFlatSheet(
          state.gridTilt, state.gridDepth / wellWidth, viewportWidth, viewportHeight, holeX, holeY, horizon * holeScale * wellWidth,
          settings.companionX, settings.companionY, companionRadius * companionScale, centreX, centreY, pair.mergedPhase,
          state.gridDistance, state.gridNear, orbitX, orbitY, state.gridLift, state.gridWell2Bottom, state.neutronSurface
        )
      }
      if (shared > 0) {
        const worldPerPixel = pivot / settings.focal
        // The line the two stood on as they became one, in the scene
        const ringCos = Math.cos(pair.mergedPhase)
        const ringSin = Math.sin(pair.mergedPhase)
        let orbitX = 0
        let orbitY = 0
        if (orbitShare > 0) {
          orbitOnSheet(pairPlane, pair.phase, equator[6], equator[7], equator[8], turned)
          orbitX = turned[0] * equator[0] + turned[1] * equator[1] + turned[2] * equator[2]
          orbitY = turned[0] * equator[3] + turned[1] * equator[4] + turned[2] * equator[5]
        }
        laySpaceSheet(
          pose, pivot, settings.focal, settings.vanishX, settings.vanishY, worldPerPixel, NEAR_DEPTH, equator,
          settings.holeWorldX, settings.holeWorldY, settings.holeWorldZ, horizon * wellWidth, state.gridDepth / wellWidth,
          settings.companionWorldX, settings.companionWorldY, settings.companionWorldZ, companionRadius,
          (hole.x - settings.vanishX) * worldPerPixel, (hole.y - settings.vanishY) * worldPerPixel, pivot,
          pairPlane[0] * ringCos + pairPlane[3] * ringSin, pairPlane[1] * ringCos + pairPlane[4] * ringSin,
          pairPlane[2] * ringCos + pairPlane[5] * ringSin, orbitX, orbitY, state.gridLift, state.gridWell2Bottom, state.neutronSurface
        )
      }
      placeSheet(
        grid, shared, equator, state.gridCell / 100 * shortSide, viewportWidth, viewportHeight, state.gridSpan, state.gridFade,
        holeX, holeY, orbitShare, state.gridEaseTurn
      )
      grid.waveLift = state.gridWaveLift
    }
    // Particles on Sheet: what flies within Ride Depth of the equator is laid on the sheet as it lies now.
    // Seen through the sheet of the frame before, as a stroke of the 3D camera is, every slow particle would
    // be drawn as a long line while the camera moves
    settings.ride = onSheet ? state.gridRide : 0
    settings.rideDepth = state.gridRideDepth * horizon
    grid.rideSoft = state.gridRideSoft
    grid.rideFar = state.gridRideFar
    grid.rideWave = state.gridRideWave
    grid.rideCut = state.gridRideCut

    // A frozen frame keeps the scene texture; only the composite (lens, flash, title) is redrawn
    frame.updateScene = frameScale > 0
    frame.present = present
    if (frame.updateScene) {
      // The renderer steps the field on the graphics card (field_step.ts) with the numbers gathered above;
      // what it leaves in the photon ring lands where the ring's pattern has turned to, and fades with it
      frame.fieldTick++
      frame.ringTurned = ringEnergy.phase
      frame.ringKeep = Math.exp(-dt / Math.max(state.ringAfterglow, 0.01))
      view.yaw = settings.cameraYaw
      view.pitch = settings.cameraPitch
      view.roll = settings.cameraRoll
      view.lookYaw = settings.cameraLookYaw
      view.lookPitch = settings.cameraLookPitch
      view.moveRight = settings.cameraMoveRight
      view.moveUp = settings.cameraMoveUp
      view.moveIn = settings.cameraMoveIn
      view.stepped = threeD
      // The orbiting stars circle the hole at its full size and light up as it forms. The renderer keeps
      // the stretches they fly and draws the traces from them, around the hole as it is this frame
      orbitTuning.sizeSpread = state.orbitSizeSpread
      orbitTuning.eccentricitySpread = state.orbitEccentricitySpread
      orbitTuning.inclination = state.orbitInclination
      orbitTuning.tiltSky = state.orbitTiltSky
      orbitTuning.nodeSpread = state.orbitNodeSpread
      orbitTuning.retrograde = state.orbitRetrograde
      orbitTuning.closest = state.orbitClosest
      orbitTuning.escape = state.orbitEscape
      orbitTuning.fadeIn = state.orbitFadeIn
      orbitTuning.drag = state.orbitDrag
      orbitTuning.flare = state.ringStarFlare
      orbitTuning.flareSpread = state.ringStarSpread
      orbitTuning.flareSides = state.ringStarSides
      orbitTuning.tidal = state.orbitTidal
      // They feel the spin about its axis as it stands in the scene (x right, y down, z away) and are born
      // near the equator
      frame.orbitCount = stepOrbiters(
        orbiters, state.orbitCount, state.orbitSize, state.orbitEccentricity, state.orbitSpeed, dt,
        shadowRadius, shadowRadius * state.horizonScale, sceneRight, -sceneUp, -sceneToward, equator, shortSide,
        Math.min(holeGrowth, 1), state.orbitTrail, spawn.palette, settings.ringEnergy, orbitTuning, seenTurn
      )
      // A star torn apart this frame: a share of the field becomes its debris, on its orbit (field_step.ts)
      if (orbiters.torn && state.orbitTidalShare > 0) {
        settings.burst = state.orbitTidalShare
        settings.burstX = orbiters.tornAt[0]
        settings.burstY = orbiters.tornAt[1]
        settings.burstZ = orbiters.tornAt[2]
        settings.burstVX = orbiters.tornAt[3]
        settings.burstVY = orbiters.tornAt[4]
        settings.burstVZ = orbiters.tornAt[5]
        settings.burstSpread = state.orbitTidalSpread
        settings.burstSeed = ++tearings % 65536
      }
      frame.orbitRowNew = orbiters.rowNew
      frame.orbitDimmed = orbiters.dimmed
      frame.orbitX = holeX
      frame.orbitY = holeY
      frame.orbitUnit = shadowRadius / SHADOW_RADII
      frame.orbitWidth = state.orbitStarSize
      if (ringFed) stepRingEnergy(ringEnergy, dt, state.ringAfterglow, reducedMotion ? 0 : state.ringFlowSpeed)
    }
    // The flows turn round the main hole in its equator, each tipped out of it by its own Tilt and seen
    // through the camera's turn (none straight on), at the size the hole has now; without a hole they keep
    // the lattice's stand-in for its radius. Around moves a flow to the centre a pair turns about and on to
    // the second hole, whose radii it then takes, its plane leaning toward the pair's orbit by Pair Plane as
    // it goes; Face Camera leans it toward the camera's own plane. Their clocks run with the scene
    const flowUnit = shadowRadius > 0 ? horizon : state.gridLatticeUnit * shortSide
    frame.flowSeed = Math.max(Math.round(state.flowSeed), 0)
    for (let slot = 0; slot < FLOW_KEYS.length; slot++) {
      const keys = FLOW_KEYS[slot]
      const flow = frame.flows[slot]
      // Gravity Pace: the flow turns at Kepler's rate for the hole it turns round, with the pull the field
      // feels: 0.6 Gravity CSS pixels a 60 Hz frame squared at the shadow's edge, falling as the inverse
      // square, so in that hole's radii GM = 0.6 Gravity over its radius in CSS pixels, per frame squared.
      // Its turn falls as Kepler's r^-1.5, and a fall or an outflow takes the time a free fall from rest at
      // infinity takes between its two radii, along the r^1.5 path a flow follows
      let swirl = state[keys.swirl]
      let life = state[keys.life]
      let fall = state[keys.fall]
      let falloff = state[keys.falloff]
      const pace = state.flowGravity
      const paceAround = companionRadius > 0 ? state[keys.pair] : -1
      const paceUnit = paceAround > 0 ? flowUnit + (companionRadius - flowUnit) * paceAround : flowUnit
      if (pace > 0 && settings.gravityStrength > 0 && paceUnit > 0) {
        const pull = 0.6 * settings.gravityStrength / paceUnit * REFERENCE_FPS * REFERENCE_FPS
        swirl += (Math.sign(swirl) * Math.sqrt(pull) / (2 * Math.PI) - swirl) * pace
        fall += (1.5 - fall) * pace
        falloff += (1.5 - falloff) * pace
        const first = state[keys.from]
        const last = state[keys.to]
        if (Math.abs(first - last) > 1e-6) {
          const fallen = 2 / 3 * Math.abs(Math.pow(Math.max(first, 0), 1.5) - Math.pow(Math.max(last, 0), 1.5)) / Math.sqrt(2 * pull)
          life += (fallen - life) * pace
        }
      }
      stepFlow(
        flow, frame.updateScene ? dt : 0, flowUnit > 0 ? state[keys.brightness] : 0, state[keys.count], state[keys.from], state[keys.to],
        state[keys.spread], swirl, life, state[keys.trail], state[keys.size], state[keys.thick],
        fall, falloff, state[keys.flare], state[keys.bell], state[keys.arms], state[keys.armWidth], state.flowArmTurn
      )
      shareFlow(
        flow, state.flowLiftPower, state.flowPhaseSpread, state.flowLiftRenew, state.flowFadeIn, state.flowFadeOut,
        state.flowDimmest, state.flowTrailFade, state.flowNearFade, state.flowNearGone
      )
      const around = companionRadius > 0 ? state[keys.pair] : -1
      const towardPair = around <= -1 ? 0 : Math.min(around + 1, 1)
      leanPlane(flowLeaned, equator, pairPlane[6], pairPlane[7], pairPlane[8], state.flowPairPlane * towardPair)
      leanPlane(flowBase, flowLeaned, seenTurn[6], seenTurn[7], seenTurn[8], state[keys.face])
      turnFlow(flow, flowBase, equator, seenTurn, state[keys.tilt] * DEGREE, state[keys.node] * DEGREE)
      readSceneColor(flow.color, state[keys.color])
      let seenScale = holeScale
      flow.unit = flowUnit
      if (around <= -1) {
        flow.x = holeX
        flow.y = holeY
      } else if (around <= 0) {
        const share = around + 1
        flow.x = holeX + (centreX - holeX) * share
        flow.y = holeY + (centreY - holeY) * share
        seenScale = holeScale + (centreScale - holeScale) * share
      } else {
        flow.x = centreX + (settings.companionX - centreX) * around
        flow.y = centreY + (settings.companionY - centreY) * around
        seenScale = centreScale + (companionScale - centreScale) * around
        flow.unit = flowUnit + (companionRadius - flowUnit) * around
      }
      flow.depth = seenScale > 0 ? settings.focal / seenScale : -1
      // Particles on Sheet lays the flow from its place in the scene: where its centre stands from the main
      // hole in the equator, CSS pixels at the hole's distance. Flat, the scene is seen straight on and that
      // place is the one on the screen
      if (settings.ride > 0) {
        let offX = flow.x - holeX
        let offY = flow.y - holeY
        let offZ = 0
        if (threeD) {
          const worldPerPixel = pivot / settings.focal
          const pairX = (hole.x - settings.vanishX) * worldPerPixel
          const pairY = (hole.y - settings.vanishY) * worldPerPixel
          const toward = around <= -1 ? 0 : around <= 0 ? around + 1 : around
          const fromX = around <= 0 ? settings.holeWorldX : pairX
          const fromY = around <= 0 ? settings.holeWorldY : pairY
          const fromZ = around <= 0 ? settings.holeWorldZ : pivot
          const toX = around <= 0 ? pairX : settings.companionWorldX
          const toY = around <= 0 ? pairY : settings.companionWorldY
          const toZ = around <= 0 ? pivot : settings.companionWorldZ
          offX = (fromX + (toX - fromX) * toward - settings.holeWorldX) / worldPerPixel
          offY = (fromY + (toY - fromY) * toward - settings.holeWorldY) / worldPerPixel
          offZ = (fromZ + (toZ - fromZ) * toward - settings.holeWorldZ) / worldPerPixel
        }
        flow.plane[3] = equator[0] * offX + equator[1] * offY + equator[2] * offZ
        flow.plane[7] = equator[3] * offX + equator[4] * offY + equator[5] * offZ
        flow.plane[11] = equator[6] * offX + equator[7] * offY + equator[8] * offZ
      }
      // Matter that ends inside the main hole's horizon lights its ring, by Ring Feed as much as the field's
      // would: a particle a life, each leaving what a captured particle leaves, unevenly by Ring Flicker
      if (ringFed && frame.updateScene && around <= -1 && flow.brightness > 0 && state[keys.to] < state.horizonScale) {
        feedRing(
          ringEnergy, flow.count / Math.max(life, 0.01) * dt * state.ringFeedCapture * Math.min(flow.brightness, 1) * Math.max(state.flowRingFeed, 0),
          state.flowRingFlicker
        )
      }
    }
    // A fast flight tints the particles: from Flight Tint From, growing evenly to its fullest at Flight Tint Full
    const tintSpan = Math.max(state.flightTintFull - state.flightTintFrom, MIN_TINT_SPAN)
    frame.doppler = hidden.doppler ? 0 : Math.min(Math.max((speed - state.flightTintFrom) / tintSpan, 0), 1) * (reducedMotion ? 0.5 : 1)
    readSceneColor(frame.tintAhead, state.flightTintAhead)
    readSceneColor(frame.tintEdge, state.flightTintEdge)
    readSceneColor(frame.tintBehind, state.flightTintBehind)
    // A particle's light shifted by its own motion turns toward the photon ring's two colours
    readSceneColor(frame.shiftToward, state.ringColorApproaching)
    readSceneColor(frame.shiftAway, state.ringColorReceding)
    frame.tintGradient = state.flightTintGradient
    frame.tintLimit = state.flightTintLimit
    readBackground(state)
    // Each fade takes its share and one 8-bit step besides (FADE_STEP in particle_renderer.ts), so a
    // fade every frame would shorten the trails on fast displays. Fading in whole 60 Hz steps keeps the
    // trail identical at any frame rate.
    fadeBacklog += frameScale
    const fadeSteps = Math.floor(fadeBacklog)
    fadeBacklog -= fadeSteps
    frame.fadeAlpha = fadeSteps > 0 ? 1 - Math.pow(1 - state.trailIntensity, fadeSteps) : 0

    const title = frame.title
    title.alpha = titleSprite ? intro.titleAlpha : 0
    // The words never leave the frame: whatever the title's position, its size, the screen's shape,
    // the camera's zoom and the letterbox bars, they stay clear of the bars and the screen's edges.
    // A title flying past the camera is the one exception, it is meant to outgrow the screen
    const introZoom = hidden.camera ? 1 : intro.cameraZoom
    const cameraZoom = introZoom * state.cameraZoom
    // Two zooms in one: the intro's around the explosion and the Zoom setting's around the black hole
    // together leave one point of the frame where it is
    let zoomX = blastX
    let zoomY = blastY
    const zoomed = 1 - 1 / cameraZoom
    if (state.cameraZoom !== 1 && Math.abs(zoomed) > 1e-6) {
      const own = 1 - 1 / state.cameraZoom
      const shared = 1 / state.cameraZoom - 1 / cameraZoom
      zoomX = (centreX * own + blastX * shared) / zoomed
      zoomY = (centreY * own + blastY * shared) / zoomed
    }
    // The camera looks beside the black hole: the point that far from it (in a pair, a share of the way to either
    // hole, and radii to the right and up) stands where the hole would. It is the zoom's fixed point that
    // moves, and it stays inside the frame, so the camera never looks past the picture the scene draws:
    // the farther in the zoom, the farther it can look, and at no zoom there is nowhere to look
    scene.holeShiftX = 0
    scene.holeShiftY = 0
    if (zoomed > 1e-6) {
      // In a pair the zoom holds their common centre still: towards the second hole above 0, the main one below
      const inPair = pair.companion > 0 ? state.cameraPair : 0
      const lookX = (inPair > 0 ? settings.companionX - centreX : centreX - holeX) * inPair + state.cameraX * shadowRadius
      const lookY = (inPair > 0 ? settings.companionY - centreY : centreY - holeY) * inPair - state.cameraY * shadowRadius
      if (lookX !== 0 || lookY !== 0) {
        const stillX = zoomX
        const stillY = zoomY
        zoomX = Math.min(Math.max(zoomX + lookX / zoomed, 0), viewportWidth)
        zoomY = Math.min(Math.max(zoomY + lookY / zoomed, 0), viewportHeight)
        scene.holeShiftX = (stillX - zoomX) * (cameraZoom - 1)
        scene.holeShiftY = (stillY - zoomY) * (cameraZoom - 1)
      }
    }
    let titleScale = 1 + params.titlePush * intro.titleAge
    let titleX = centerX
    let titleY = centerY + params.titleOffset * shortSide
    if (titleSprite && titleSprite.textWidth > 0) {
      const widest = Math.max(viewportWidth - 2 * params.titleMargin, 1) / (titleSprite.textWidth * cameraZoom)
      titleScale = Math.min(titleScale, widest)
      const bar = hidden.camera ? 0 : params.letterbox * viewportHeight
      const halfWidth = titleSprite.textWidth * 0.5 * titleScale * cameraZoom
      const halfHeight = titleSprite.textHeight * 0.5 * titleScale * cameraZoom
      titleX = zoomX + (keepInside(zoomX + (titleX - zoomX) * cameraZoom, halfWidth, params.titleMargin, viewportWidth) - zoomX) / cameraZoom
      titleY = zoomY + (keepInside(zoomY + (titleY - zoomY) * cameraZoom, halfHeight, bar + params.titleMargin, viewportHeight) - zoomY) / cameraZoom
    }
    title.x = titleX
    title.y = titleY
    title.reveal = intro.titleReveal
    title.dissolve = intro.titleDissolve
    title.drift = params.titleDrift
    title.glow = params.titleGlow
    title.flash = params.titleFlash
    title.cooling = params.titleCooling
    title.dust = params.titleDust
    // The crumbling dust follows the black hole's own settings: no hole, no pull
    const pullLimit = params.titlePullLimit
    title.pull = horizon > 0 ? Math.min(Math.max(settings.gravityStrength / TITLE_REFERENCE_GRAVITY, -pullLimit), pullLimit) : 0
    title.swirl = title.pull * Math.min(Math.max(settings.orbitalStrength / TITLE_REFERENCE_ORBIT, -pullLimit), pullLimit) *
      TITLE_SWIRL_RADIANS * params.titleSwirl
    title.reach = settings.gravityReach * holeScale
    title.capture = captureRadius * holeScale
    title.scale = titleScale * intro.titleFly
    title.fringe = params.titleFringe
    title.halo = params.titleHalo
    title.redshift = params.titleRedshift
    title.grain = intro.titleGrain
    title.burn = intro.titleBurn
    title.fall = intro.titleFall
    title.tidal = params.titleTidal
    title.spiral = params.titleSpiral
    title.spread = params.titleSpread
    title.stream = params.titleStream
    title.order = params.titleOrder
    title.trail = params.titleTrail
    title.trailCopies = params.titleTrailCopies
    title.trailLag = params.titleTrailLag
    title.heat = params.titleHeat
    title.speckSize = params.titleSpeckSize
    title.currentSize = params.titleCurrentSize
    title.beyondSpeed = params.titleBeyondSpeed
    title.wink = params.titleWink
    title.spiralRadius = params.titleSpiralRadius
    title.spiralMin = params.titleSpiralMin
    title.spiralMax = params.titleSpiralMax
    title.burnGrain = params.titleBurnGrain
    title.burnFine = params.titleBurnFine
    title.burnEnds = params.titleBurnEnds
    title.burnRim = params.titleBurnRim
    title.burnRimWidth = params.titleBurnRimWidth
    title.currentContrast = params.titleCurrentContrast
    title.orderReach = params.titleOrderReach
    title.captureEdge = params.titleCaptureEdge
    title.reachFade = params.titleReachFade
    title.dustSize = params.titleDustSize
    title.dustClumps = params.titleDustClumps
    title.dustLow = params.titleDustLow
    title.dustHigh = params.titleDustHigh
    title.burnMix = params.titleBurnMix
    title.burnEdge = params.titleBurnEdge

    composite.time = animationTime
    composite.holeX = holeX
    composite.holeY = holeY
    composite.horizon = horizon * holeScale
    const einstein = state.lensingEnabled && !hidden.lens ? horizon * einsteinRatio * intro.lensScale : 0
    composite.einstein = einstein * holeScale
    // Ray Traced: the Einstein Radius places the camera (cameraU above); the scale keeps the shadow a hole
    // of this mass would cast without spin the size the shadow is drawn, in 3D as it is seen from where the
    // 3D camera stands
    if (state.lensingTraced && composite.einstein > 0) {
      composite.traceU = cameraU
      composite.traceScale = horizon * holeScale / Math.tan(0.5 * shadowAngle(cameraU))
      composite.traceShare = intro.lensScale
    } else {
      composite.traceU = 0
    }
    // The traced disc takes the flows that lie in the main hole's equator: round the main hole, with no Tilt
    // of their own, not turned to face the camera and not laid on the sheet. It is seen along the Ray Traced lens's paths of light, so it
    // needs that lens and a hole in front of the camera; without them every flow is drawn as strokes. Its
    // map reaches the farthest edge of the flows it takes, and it turns the way the brightest of them does
    const traceShare = composite.traceU > 0 && composite.horizon > 0 ? Math.min(Math.max(state.flowTrace, 0), 1) : 0
    let discReach = 0
    let discBrightest = 0
    let discSense = 1
    for (let slot = 0; slot < FLOW_KEYS.length; slot++) {
      const keys = FLOW_KEYS[slot]
      const flow = frame.flows[slot]
      const around = companionRadius > 0 ? state[keys.pair] : -1
      const traced = traceShare > 0 && flow.brightness > 0 && flow.count > 0 && around <= -1 && state[keys.tilt] === 0 && state[keys.face] === 0 && !(settings.ride > 0)
      flow.traced = traced ? traceShare : 0
      if (!traced) continue
      const from = Math.max(state[keys.from], 0.05)
      discReach = Math.max(discReach, Math.max(from, state[keys.to]) * (1 + 0.5 * state[keys.spread] / from))
      if (flow.brightness > discBrightest) {
        discBrightest = flow.brightness
        discSense = state[keys.swirl] < 0 ? -1 : 1
        // The equator as the camera sees it is the turn of a flow that does not tilt; the axis the matter
        // turns about anticlockwise is against the way the equator faces for a positive Swirl
        const turn = flow.turn
        const discTurn = composite.discTurn
        for (let i = 0; i < 6; i++) discTurn[i] = turn[i]
        for (let i = 6; i < 9; i++) discTurn[i] = -discSense * turn[i]
      }
    }
    composite.discShare = discReach > 0 ? traceShare : 0
    // A stroke's width of room past the farthest edge
    composite.discReach = discReach * 1.02
    composite.discHide = Math.min(Math.max(state.flowTraceHide, 0), 1)
    composite.discDoppler = Math.max(state.flowTraceDoppler, 0)
    composite.discBeam = Math.max(state.flowTraceBeam, 0)
    composite.discTint = Math.max(state.flowTraceTint, 0)
    // Spin bends the outline of the shadow and the photon ring in either lens, and the light itself under
    // Ray Traced
    composite.spin = spin
    composite.spinTilt = spinTilt
    composite.spinAxis = spinAxis
    composite.shadowShape = shadowShape
    // The grid on the horizon: the same camera and scale as the Ray Traced lens, for either lens. The
    // horizon's generators turn at Omega_H = a / (2 r+) per M (radii in M), Horizon Pace M a second
    composite.horizonGrid = horizon > 0 ? state.gridHorizon : 0
    // The white hole's surface is the shadow itself, so it needs one (its share is 0 without)
    composite.whiteHole = horizon > 0 ? Math.min(Math.max(state.whiteHole, 0), 1) : 0
    if (composite.whiteHole > 0) readSceneColor(composite.whiteColor, state.whiteHoleColor)
    const horizonRate = spin / (2 * (1 + Math.sqrt(1 - spin * spin)))
    horizonTurned = (horizonTurned + horizonRate * (reducedMotion ? 0 : state.gridHorizonPace) * dt) % (2 * Math.PI)
    if (composite.horizonGrid > 0) {
      composite.horizonGridU = cameraU
      composite.horizonGridScale = horizon * holeScale / Math.tan(0.5 * shadowAngle(cameraU))
      composite.horizonTilt = Math.atan2(Math.sqrt(axisRight * axisRight + axisUp * axisUp), axisToward)
      composite.horizonAxis = horizonAxis
      composite.horizonTurn = cameraLongitude - horizonTurned
      composite.horizonRate = horizonRate
      composite.horizonCells = state.gridHorizonCells
      composite.horizonLine = state.gridHorizonLine
      composite.horizonHaze = state.gridHorizonHaze
      composite.horizonHazeFrom = state.gridHorizonHazeFrom
      composite.horizonHazeTo = state.gridHorizonHazeTo
      composite.horizonCellsAround = state.gridHorizonCellsAround
      composite.horizonShift = state.gridHorizonShift
      composite.horizonCompanion = state.gridHorizonCompanion
    }
    composite.falloff = state.lensingFalloff
    composite.falloffPivot = state.lensingPivot / 100 * shortSide
    composite.lensCore = state.lensingCore
    composite.maxBend = state.lensingMaxBend
    composite.lensReach = state.lensingReach
    composite.lensBubble = state.lensingBubble
    composite.twistLimit = state.lensingTwistLimit
    composite.swirl = state.lensingRotation
    composite.absorption = state.lensingAbsorption
    composite.companionX = settings.companionX
    composite.companionY = settings.companionY
    composite.companionRadius = companionRadius * companionScale
    // The second hole's horizon grid: seen from the same place at its own size and mass, about its own spin's
    // axis, or the main grid's while it does not spin, its horizon turning at its own rate
    const companionRate = companionSpin / (2 * (1 + Math.sqrt(1 - companionSpin * companionSpin)))
    companionTurned = (companionTurned + companionRate * (reducedMotion ? 0 : state.gridHorizonPace) * dt) % FULL_TURN
    if (composite.horizonGrid > 0 && composite.companionRadius > 0) {
      const companionU = Math.min(cameraU * pair.companion / pair.growth, 1 / CLOSEST_CAMERA)
      composite.companionGridScale = composite.companionRadius / Math.tan(0.5 * shadowAngle(companionU))
      composite.companionGridU = companionU
      composite.companionGridRate = companionRate
      composite.companionGridSpin = companionSpin
      if (companionSpin > 0) {
        const length = Math.sqrt(seenRight * seenRight + seenUp * seenUp + seenToward * seenToward)
        composite.companionGridTilt = companionSpinTilt
        composite.companionGridAxis = companionSpinAxis
        composite.companionGridTurn = meridianLongitude(pose, threeD, seenRight / length, seenUp / length, seenToward / length, companionSpinAxis) - companionTurned
      } else {
        composite.companionGridTilt = composite.horizonTilt
        composite.companionGridAxis = horizonAxis
        composite.companionGridTurn = cameraLongitude
      }
    }
    composite.companionEinstein = companionRadius > 0 ? einstein * companionScale * pair.companion / pair.growth : 0
    // The lenses the band behind the nearer hole is bent by where Front Bend or Between Bend draws it, in the
    // step's measure, CSS pixels on the screen
    settings.holeEinstein = settings.frontAway > 0 ? composite.einstein : 0
    settings.companionEinstein = settings.companionSeen > 0 ? composite.companionEinstein : 0
    // How the light in front of the holes is laid over the rest, and how far the waves slide it
    composite.frontAdd = state.threeDFrontAdd
    composite.frontWaves = state.threeDFrontWaves
    composite.companionLensCore = state.companionLensCore
    composite.companionLensStyle = state.companionLensStyle
    composite.companionSpin = companionSpin
    composite.companionSpinAxis = companionSpinAxis
    composite.pairX = centreX
    composite.pairY = centreY
    composite.pairScale = centreScale
    composite.pairPhase = pair.phase
    composite.pairPitch = pair.omega / (LIGHT_SPEED * shortSide)
    composite.ring = hidden.ring || !state.ringEnabled ? 0 : state.ringBrightness * ringPower
    composite.ringWidth = state.ringWidth
    composite.ringGlow = state.ringGlow
    // A rolling 3D camera turns the bright side with the rest of the picture
    composite.ringDoppler = state.ringDoppler
    composite.ringSide = roll === 0 ? state.ringSide : state.ringSide + roll
    // Follow Spin takes the bright side from the spin as the camera sees it, the circle, the head, the roll
    // and a merger's spin included: the limb coming toward the camera lies a half turn from the axis on the
    // screen, and the contrast grows as the sine of the axis's angle to the line of sight, Doppler Contrast
    // side-on. Between 0 and 1 the two sides are blended as arrows of their contrast
    const follow = spin > 0 ? state.ringSpinFollow : 0
    if (follow > 0) {
      const seenSide = Math.PI + spinAxis
      const seenDoppler = state.ringDoppler * Math.sin(spinTilt)
      const x = (1 - follow) * composite.ringDoppler * Math.cos(composite.ringSide) + follow * seenDoppler * Math.cos(seenSide)
      const y = (1 - follow) * composite.ringDoppler * Math.sin(composite.ringSide) + follow * seenDoppler * Math.sin(seenSide)
      composite.ringDoppler = Math.hypot(x, y)
      if (composite.ringDoppler > 0) composite.ringSide = Math.atan2(y, x)
    }
    // The second hole's ring takes the main ring's sides, Ring Sides times as strong, and with Follow Spin
    // the side its own spin turns toward the camera, the same way. Its contrast stops at the main ring's top,
    // 1: past it the tint would run beyond the ring's two colours, and past 2 the dim side below black
    let secondDoppler = Math.min(state.ringDoppler * state.companionRingSides, 1)
    let secondSide = roll === 0 ? state.ringSide : state.ringSide + roll
    const secondFollow = companionSpin > 0 && secondDoppler > 0 ? state.ringSpinFollow : 0
    if (secondFollow > 0) {
      const seenSide = Math.PI + companionSpinAxis
      const seenDoppler = secondDoppler * Math.sin(companionSpinTilt)
      const x = (1 - secondFollow) * secondDoppler * Math.cos(secondSide) + secondFollow * seenDoppler * Math.cos(seenSide)
      const y = (1 - secondFollow) * secondDoppler * Math.sin(secondSide) + secondFollow * seenDoppler * Math.sin(seenSide)
      secondDoppler = Math.hypot(x, y)
      if (secondDoppler > 0) secondSide = Math.atan2(y, x)
    }
    composite.companionRingDoppler = secondDoppler
    composite.companionRingSide = secondSide
    composite.ringPhase = ringEnergy.phase
    composite.ringBase = ringFed ? state.ringBase : 1
    composite.ringFeed = ringFed ? state.ringFeed : 0
    composite.companionRingFeed = ringFed ? state.ringFeed * state.companionRingFeed : 0
    composite.ringLineMin = state.ringWidthMin
    composite.ringOffset = state.ringOffset
    composite.ringSoftness = state.ringSoftness
    // The line's width in shadow radii, at the camera's zoom
    const ringLine = state.ringWidth + state.ringWidthMin / Math.max(composite.horizon * cameraZoom * scene.pixelRatio, 1)
    composite.ringReach = RING_REACH + RING_FADES * Math.max(Math.max(state.ringGlowCore, state.ringGlowSkirt) - RING_GLOW_HELD, 0) +
      Math.max(state.ringOffset + RING_FADES * state.ringSoftness - RING_LINE_HELD, 0) * ringLine
    composite.ringGlowCore = state.ringGlowCore
    composite.ringGlowSkirt = state.ringGlowSkirt
    composite.ringGlowCoreShare = state.ringGlowCoreShare
    composite.ringGlowSkirtShare = state.ringGlowSkirtShare
    readSceneColor(composite.ringColor, state.ringColor)
    readSceneColor(composite.ringApproaching, state.ringColorApproaching)
    // The neutron star in the hole's stead, as its surface stands and its turn has run up
    neutronTurned = (neutronTurned + dt * state.neutronTurn * 2 * Math.PI) % (2 * Math.PI)
    composite.neutron = state.neutronStar
    if (state.neutronStar > 0) {
      composite.neutronSurface = state.neutronSurface
      composite.neutronGlow = state.neutronGlow
      composite.neutronTurn = neutronTurned
      composite.neutronVeins = state.neutronVeins
      composite.neutronVeinSharp = state.neutronVeinSharp
      composite.neutronVeinLight = state.neutronVeinLight
      composite.neutronLimb = state.neutronLimb
      composite.neutronShade = state.neutronShade
      composite.neutronGlowLight = state.neutronGlowLight
      composite.neutronWarp = state.neutronWarp
      composite.neutronLayers = state.neutronLayers
      composite.neutronBranch = state.neutronBranch
      composite.neutronCore = state.neutronCore
      composite.neutronStir = state.neutronStir
      neutronFlowed = (neutronFlowed + dt * state.neutronFlow) % FLOW_WRAP
      composite.neutronFlowed = neutronFlowed
      composite.neutronCross = state.neutronCross
      readSceneColor(composite.neutronColor, state.neutronColor)
      readSceneColor(composite.neutronVeinColor, state.neutronVeinColor)
      readSceneColor(composite.neutronCoreColor, state.neutronCoreColor)
    }
    readSceneColor(composite.ringReceding, state.ringColorReceding)
    // The explosion as the camera sees it: its place, and its fronts as much larger as it stands nearer
    const frontScale = blastAtHole ? centreScale : blastScale
    composite.centerX = blastAtHole ? centreX : blastX
    composite.centerY = blastAtHole ? centreY : blastY
    composite.starGlow = intro.starGlow
    composite.starRadius = intro.starRadius * shortSide
    composite.sourcePower = intro.sourcePower
    composite.glareRadius = params.glareRadius * shortSide
    composite.exposure = intro.exposure
    composite.lightRadius = intro.lightFront * explosionReach * frontScale
    composite.lightWidth = params.lightWidth * shortSide
    composite.lightPower = intro.lightPower
    composite.lightSpeed = lightSpeed * frontScale
    composite.lightDustContrast = params.lightDustContrast
    composite.echoPower = intro.echoPower
    composite.echoDecay = params.echoDecay
    composite.echoHoldThin = params.echoHoldThin
    composite.echoHoldThick = params.echoHoldThick
    composite.echoSwell = params.echoSwell
    composite.echoSwellMin = params.echoSwellMin
    composite.echoReach = params.echoReach
    composite.dustScale = params.dustScale
    composite.dustThreshold = params.dustThreshold
    composite.dustSweep = params.dustSweep
    composite.echoFloor = params.echoFloor
    composite.dustShock = hidden.echo ? 0 : intro.dustShock
    composite.dustBlow = params.dustBlow
    composite.dustDrift = reducedMotion ? 0 : params.dustDrift
    composite.dustBlowTime = params.dustBlowTime
    // The dust is read from where it was, so its picture moves the other way: the way the angle points,
    // on a screen whose y runs down
    const driftAngle = params.dustDriftAngle * Math.PI / 180
    composite.dustDriftX = -Math.cos(driftAngle)
    composite.dustDriftY = Math.sin(driftAngle)
    composite.dustShockOffset = params.dustShockOffset
    composite.dustShockSharpness = params.dustShockSharpness
    composite.dustShockTint = params.dustShockTint
    composite.dustLayers = params.dustLayers
    composite.dustFineness = params.dustFineness
    composite.dustRoughness = params.dustRoughness
    composite.dustWarp = params.dustWarp
    composite.dustWarpScale = params.dustWarpScale
    composite.echoTintEase = params.echoTintEase
    composite.waveRadius = intro.matterFront * explosionReach * frontScale
    composite.waveStrength = intro.waveStrength * params.waveRefraction
    composite.waveWidth = params.waveWidth * shortSide
    composite.remnantGlow = intro.remnantGlow
    composite.remnantRedshift = intro.remnantRedshift
    composite.remnantRadius = params.remnantRadius * shortSide
    composite.remnantEmberAt = params.remnantEmberAt
    composite.remnantWhiteness = params.remnantWhiteness
    composite.remnantDeep = params.remnantDeep
    composite.remnantDim = params.remnantDim
    // The ringing horizon is an oval, long along the axis the two numbers turn it to
    const oval = horizon > 0 && Math.abs(ovalX) + Math.abs(ovalY) > MIN_HOLE_OVAL
    composite.holeOvalX = oval ? ovalX : 0
    composite.holeOvalY = oval ? ovalY : 0
    // The gravitational wave is that wobble carried outward at the speed of light: every point shows the
    // wobble the horizon had when the wave left it. It is off once its last ripples are past the far corner
    const waveLife = params.lightCrossTime / params.lightReach + ringTiming.decay * GRAVITY_WAVE_FADES
    const introWave = intro.ringdownTime > 0 && intro.ringdownTime <= waveLife
    // Two that became one send the ringing of the hole they leave, from where they met and at the pair's
    // own speed of light, once the intro's wave is gone. It starts as strong as the pair's spiral had
    // grown, which flies on ahead of it until its last arm is past the far corner
    const farthest = Math.hypot(Math.max(centreX, viewportWidth - centreX), Math.max(centreY, viewportHeight - centreY)) / Math.max(centreScale, 0.01)
    const pairWave = hidden.gravityWave ? 0 : pair.wave * pairUnit
    const mergerWave = !introWave && pairWave > 0 && sinceMerger >= 0 && sinceMerger <= farthest / pairLight + mergerRing.decay * GRAVITY_WAVE_FADES
    composite.pairWave = sinceMerger >= 0 && sinceMerger * pairLight > farthest + shadowRadius ? 0 : pairWave
    composite.pairFront = mergerWave ? sinceMerger : -1
    composite.pairFrontSoft = state.companionHandover / mergerRing.frequency
    // A fired wave leaves the black hole as the newborn hole's did, once the other two are gone
    const cueWave = !introWave && !mergerWave && (cue.ringLayers & GRAVITY_WAVE) !== 0 && sinceCueRing > 0 && sinceCueRing <= waveLife
    if (sinceCueRing > Math.max(waveLife, ringTiming.decay * GRAVITY_WAVE_FADES)) cue.ringLayers = 0
    composite.gravityWaveAmplitude = hidden.gravityWave || !(introWave || mergerWave || cueWave)
      ? 0
      : mergerWave ? pairWave : params.gravityWaveGain * params.ringdownAmplitude * shadowRadius
    composite.gravityWaveTime = mergerWave ? sinceMerger : cueWave ? sinceCueRing : intro.ringdownTime
    composite.gravityWaveX = mergerWave || cueWave ? centreX : blastX
    composite.gravityWaveY = mergerWave || cueWave ? centreY : blastY
    composite.waveScale = mergerWave || cueWave ? centreScale : blastScale
    composite.gravityWaveFrequency = mergerWave ? mergerRing.frequency : ringTiming.frequency
    composite.gravityWaveDecay = mergerWave ? mergerRing.decay : ringTiming.decay
    composite.gravityWaveRadius = shadowRadius
    composite.gravityWaveSpin = mergerWave ? pair.mergedTurn : 0
    composite.gravityWaveAngle = mergerWave ? pair.mergedPhase : 0
    composite.gravityWaveSpeed = mergerWave ? pairLight : lightSpeed
    // The waves are read through the nearer hole's lens only while one is on
    const waveOn = composite.pairWave > 0 || composite.gravityWaveAmplitude > 0
    composite.waveLensCompanion = waveOn ? waveLensCompanion : 0
    composite.waveLensMain = waveOn ? waveLensMain : 0
    composite.backgroundStars = intro.backgroundStars * state.starsBrightness
    composite.starCell = state.starCell
    composite.starDensity = state.starDensity
    composite.starPlacement = state.starsPlacement
    composite.starsPerCell = state.starsPerCell
    composite.starNeighbors = state.starsNeighbors
    composite.starCellWarp = state.starsCellWarp
    composite.starSkyEven = state.starsSkyEven
    // The sky's centre, its sphere and how the flat backdrop turns into it
    composite.skyCenter = state.skyCenter
    composite.skyVanishX = settings.vanishX
    composite.skyVanishY = settings.vanishY
    composite.skySize = state.skySize
    composite.skyBend = state.skyEaseBend
    composite.starFlare = params.starFlare
    // The nebula is part of the sky: it shows as the opening lets the stars show
    composite.nebula = intro.backgroundStars * state.nebula
    // The cosmic web is part of the sky too
    composite.web = intro.backgroundStars * state.cosmicWeb
    composite.webCell = state.cosmicWebCell / 100 * shortSide
    composite.webWidth = state.cosmicWebWidth
    composite.webGalaxies = state.cosmicWebGalaxies
    composite.webSize = state.cosmicWebSize
    composite.webHole = state.cosmicWebHole / 100 * shortSide
    readSceneColor(composite.webColor, state.cosmicWebColor)
    readSceneColor(composite.nebulaColor, state.nebulaColor)
    readSceneColor(composite.nebulaColorDeep, state.nebulaColorDeep)
    readSceneColor(composite.nebulaColorCore, state.nebulaColorCore)
    composite.nebulaScale = state.nebulaScale
    composite.nebulaSparseness = state.nebulaSparseness
    composite.nebulaEdge = state.nebulaEdge
    composite.nebulaWarp = state.nebulaWarp
    composite.nebulaContrast = state.nebulaContrast
    composite.nebulaGrain = state.nebulaGrain
    // The clouds are read further along the way opposite to their drift; the screen's y runs down
    composite.nebulaDriftX = -state.nebulaDrift * Math.cos(state.nebulaDriftAngle * DEGREE)
    composite.nebulaDriftY = state.nebulaDrift * Math.sin(state.nebulaDriftAngle * DEGREE)
    composite.nebulaPatch = state.nebulaPatch
    composite.nebulaPatchShare = state.nebulaPatchShare
    composite.nebulaPatchSoftness = state.nebulaPatchSoftness
    composite.nebulaCore = state.nebulaCore
    composite.nebulaCoreFrom = state.nebulaCoreFrom
    composite.nebulaDetail = state.nebulaDetail
    composite.nebulaLacunarity = state.nebulaLacunarity
    composite.nebulaRoughness = state.nebulaRoughness
    composite.nebulaCurlSize = state.nebulaCurlSize
    composite.nebulaGrainSize = state.nebulaGrainSize
    // The 3D sky's clouds are read further along through space by the drift, along the scene's own right and
    // down or, by Drift Follows Camera, along the camera's, kept as the way they have come so the camera's
    // turn moves them on from where they are
    const driftFollow = state.nebulaDriftFollow
    const driftTurn = composite.turn
    nebulaSpace[0] += (composite.nebulaDriftX * (1 - driftFollow + driftFollow * driftTurn[0]) + composite.nebulaDriftY * driftFollow * driftTurn[3]) * dt
    nebulaSpace[1] += (composite.nebulaDriftX * driftFollow * driftTurn[1] + composite.nebulaDriftY * (1 - driftFollow + driftFollow * driftTurn[4])) * dt
    nebulaSpace[2] += (composite.nebulaDriftX * driftFollow * driftTurn[2] + composite.nebulaDriftY * driftFollow * driftTurn[5]) * dt
    composite.nebulaSpaceX = nebulaSpace[0]
    composite.nebulaSpaceY = nebulaSpace[1]
    composite.nebulaSpaceZ = nebulaSpace[2]
    const starSize = state.starsSize / STAR_SIZE
    composite.starSpread = STAR_SPREAD * starSize * starSize
    composite.starTwinkle = state.starsTwinkle
    composite.starTwinkleSpeed = state.starsTwinkleSpeed
    composite.starFaintest = state.starsFaintest
    readSceneColor(composite.starWarm, state.starsColorWarm)
    readSceneColor(composite.starCool, state.starsColorCool)
    composite.starFlareDecay = params.starFlareDecay
    composite.colorFlash = params.colorFlash
    composite.colorLight = params.colorLight
    composite.colorDust = params.colorDust
    composite.colorTitle = params.colorTitle
    composite.colorEmber = params.colorEmber
    // The camera and the film belong to the intro: its layer switch removes them, and they are gone
    // by the time the intro ends
    // The film look lifts as the intro ends, except for the share that is kept after it
    const film = hidden.camera ? 0 : intro.film + (1 - intro.film) * params.filmHold
    const shake = hidden.camera ? 0 : intro.shake
    composite.cameraZoom = cameraZoom
    composite.zoomX = zoomX
    composite.zoomY = zoomY
    // A camera that jumps further than this in a frame has cut, and the trails start afresh
    frame.cutZoom = 1 + state.cameraCutZoom
    frame.cutShift = state.cameraCutShift
    // The shake's own clock runs at Shake Rate; kept as its lead over the scene's, which is none at rate 1,
    // so the rate can move along a film without the tremor jumping
    shakeLead += dt * (params.shakeRate - 1)
    undertoneLead += dt * params.shakeRate * (params.shakeSecondRate - 1)
    const shakeTime = animationTime + shakeLead
    const undertoneTime = shakeTime + undertoneLead
    const second = Math.max(params.shakeSecond, 0)
    composite.shakeX = shake * (Math.sin(shakeTime * SHAKE_X[0]) + second * Math.sin(undertoneTime * SHAKE_X[1])) / (1 + second)
    composite.shakeY = shake * params.shakeVertical * (Math.sin(shakeTime * SHAKE_Y[0] + 1.3) + second * Math.sin(undertoneTime * SHAKE_Y[1] + 0.4)) / (1 + second)
    composite.lensFringe = params.lensFringe * film
    composite.lensFringeEase = params.lensFringeEase
    composite.vignette = params.vignette * film
    composite.filmGrain = params.filmGrain * film
    composite.letterbox = params.letterbox * viewportHeight * film
    composite.vignetteStart = params.vignetteStart
    composite.vignetteEnd = params.vignetteEnd
    composite.filmKnee = params.filmKnee
    // The bloom over the finished frame, the sheet included
    const bloom = frame.bloom
    bloom.strength = state.bloom
    if (state.bloom > 0) {
      bloom.threshold = state.bloomThreshold
      bloom.knee = state.bloomKnee
      bloom.reach = state.bloomReach
      bloom.tail = state.bloomTail
      readSceneColor(bloom.color, state.bloomColor)
    }

    // The space grid: the flat one is read through the lens in the composite pass, the sheet is laid
    // over the frame with its well under the black hole
    const gridCell = state.gridCell / 100 * shortSide
    // Grid Zoom shrinks the lensed grid by powers of ten; with the decades only its part after the point,
    // which they draw seamlessly, so the cell never grows back on a track's way between two keys
    const gridZoom = state.gridSkyDecades > 0 ? state.gridSkyZoom - Math.floor(state.gridSkyZoom) : state.gridSkyZoom
    composite.skyGrid = state.gridSky
    composite.gridPull = state.gridSkyPull
    composite.gridHaze = state.gridSkyHaze
    composite.gridHazeSpan = state.gridSkyHazeSpan
    readSceneColor(composite.gridColor, state.gridColor)
    composite.gridCell = gridCell * Math.pow(10, -gridZoom)
    composite.skyGridLine = state.gridSkyLine
    composite.gridSphere = state.gridSkySphere
    composite.gridSlant = state.gridSkySlant
    composite.gridDecades = state.gridSkyDecades
    composite.gridSide = shortSide
    // The flash on the sheet, which Light Front's band and the photons both run from: its place from the
    // main hole in the plane's units, against the plane's second direction as sheetPoint takes it. It is read
    // from the hole while Front Run is 0 and then held on the sheet: the anchor (where the sheet's fixed point
    // stood from the hole, grid.anchorX/Y) is taken again while the run is 0, while neither draws and when the
    // place changes, and every place fixed on the sheet moves against the hole as its fixed point does
    const flashing = (state.gridSheet > 0 && state.gridFront > 0) || state.gridFrontPhotons > 0
    let flashX = 0
    let flashY = 0
    if (flashing) {
      if (state.gridFrontRun <= 0 || state.gridFrontX !== flashPlaceX || state.gridFrontY !== flashPlaceY) {
        flashAnchorX = grid.anchorX
        flashAnchorY = grid.anchorY
        flashPlaceX = state.gridFrontX
        flashPlaceY = state.gridFrontY
      }
      flashX = state.gridFrontX * grid.throat + grid.anchorX - flashAnchorX
      flashY = -state.gridFrontY * grid.throat + grid.anchorY - flashAnchorY
    } else {
      flashPlaceX = NaN
    }
    // The sheet was laid out before the particles were stepped (above); here is what only its drawing reads
    grid.brightness = state.gridSheet
    if (state.gridSheet > 0) {
      grid.lineWidth = state.gridLine
      grid.lineScale = state.gridLineNear
      grid.clearFrom = state.gridClearing
      grid.clearTo = state.gridClearingEdge
      grid.rings = state.gridRings
      grid.spokes = state.gridSpokes
      grid.ringSpacing = state.gridRingSpacing
      grid.lensed = state.gridLensed
      grid.throatGlow = state.gridThroatGlow
      grid.star = state.neutronSurface
      grid.throatCurve = state.gridThroatCurve
      grid.light = state.gridLight
      grid.lightReach = state.gridLightReach
      readSceneColor(grid.lightColor, state.gridLightColor)
      grid.front = state.gridFront
      if (state.gridFront > 0) {
        grid.frontX = flashX
        grid.frontY = flashY
        grid.frontRun = state.gridFrontRun
        const width = Math.max(state.gridFrontWidth, 0.01)
        const lead = Math.min(Math.max(state.gridFrontLead, 0), 1)
        grid.frontLead = width * lead
        grid.frontTail = width * (1 - lead)
        grid.frontGhost = Math.min(Math.max(state.gridFrontGhost, 0), 1)
        grid.frontPulses = Math.min(Math.max(Math.round(state.gridFrontPulses), 1), 16)
        grid.frontPulseGap = Math.max(state.gridFrontPulseGap, 0.1)
        grid.frontStrength = Math.max(state.gridFrontStrength, 1)
        grid.frontField = Math.max(state.gridFrontField, 0)
        grid.frontFieldEven = Math.min(Math.max(state.gridFrontFieldEven, 0), 1)
        readSceneColor(grid.frontColor, state.gridFrontColor)
      }
    }
    // The flash's photons (photons.ts), at the flash's place and run, riding the sheet as its lit lines do
    const photons = frame.photons
    photons.brightness = state.gridFrontPhotons
    // A frame with no photons, or a sheet with no throat, starts their trace afresh
    followFlash(photonTrace, flashX / Math.max(grid.throat, 1e-6), flashY / Math.max(grid.throat, 1e-6),
      state.gridFrontPhotons > 0 && grid.throat > 0 ? state.gridFrontRun : 0)
    if (state.gridFrontPhotons > 0) {
      photons.count = state.gridPhotonCount
      photons.x = photonTrace.lastX
      photons.y = photonTrace.lastY
      photons.traceX = photonTrace.x
      photons.traceY = photonTrace.y
      photons.run = state.gridFrontRun
      photons.trail = state.gridPhotonTrail
      photons.width = state.gridPhotonWidth
      photons.fade = state.gridPhotonFade
      readSceneColor(photons.color, state.gridPhotonColor)
    }
    // The sheet's waves, which the grid program draws and the particles and photons on the sheet ride, from the sky's
    // Sheet Beams (beams.ts): two beams along the dented surface, one near the well and one far, at one pace
    const beams = frame.beams
    beams.brightness = grid.throat > 0 ? state.gridBeams : 0
    if (beams.brightness > 0) {
      beams.count = 2
      beams.x = 0
      beams.y = 0
      beams.traceX = 0
      beams.traceY = 0
      beams.run = state.gridBeamRun
      beams.trail = state.gridBeamTrail
      beams.width = state.gridBeamWidth
      beams.fade = 1
      const depth = grid.depth / grid.throat
      if (beams.start !== state.gridBeamX || beams.near !== state.gridBeamNear || beams.far !== state.gridBeamFar || beams.depth !== depth || beams.star !== grid.star) {
        beams.start = state.gridBeamX
        beams.near = state.gridBeamNear
        beams.far = state.gridBeamFar
        beams.depth = depth
        beams.star = grid.star
        beams.version++
      }
      readSceneColor(beams.color, state.gridBeamColor)
    }
    // The dashed circle where Light Front's field for light ends (field_ring.ts), white at Field Line
    const ring = frame.fieldRing
    ring.brightness = grid.throat > 0 && state.gridFrontField > 0 ? state.gridFrontFieldLine : 0
    if (ring.brightness > 0) {
      ring.count = FIELD_RING_DASHES
      ring.x = 0
      ring.y = 0
      ring.traceX = 0
      ring.traceY = 0
      const dash = FIELD_RING_FILL * 2 * Math.PI * state.gridFrontField / FIELD_RING_DASHES
      ring.run = dash
      ring.trail = dash
      ring.width = 2
      ring.fade = 1
      if (ring.radius !== state.gridFrontField) {
        ring.radius = state.gridFrontField
        ring.version++
      }
      ring.color.r = 1
      ring.color.g = 1
      ring.color.b = 1
    }
    if (state.gridSheet > 0 || (settings.ride > 0 && state.gridRideWave > 0) || state.gridFrontPhotons > 0 || state.gridBeams > 0 || ring.brightness > 0) waveSheet(grid, composite)

    // The lattice stands in the scene around the black hole and is seen by the 3D camera, or straight on
    // in the flat mode. Its cells are counted in the hole's full radius, so it is there before the hole
    // forms; the pull grows with the hole
    const lattice = frame.lattice
    lattice.brightness = state.gridLattice
    if (state.gridLattice > 0) {
      const worldPerPixel = pivot / settings.focal
      const latticeTurn = lattice.turn
      if (threeD) {
        latticeTurn.set(pose)
        lattice.holeX = settings.holeWorldX
        lattice.holeY = settings.holeWorldY
        lattice.holeZ = settings.holeWorldZ
        lattice.companionX = settings.companionWorldX
        lattice.companionY = settings.companionWorldY
        lattice.companionZ = settings.companionWorldZ
      } else {
        latticeTurn.fill(0)
        latticeTurn[0] = 1
        latticeTurn[4] = 1
        latticeTurn[8] = 1
        latticeTurn[11] = pivot
        lattice.holeX = (holeX - settings.vanishX) * worldPerPixel
        lattice.holeY = (holeY - settings.vanishY) * worldPerPixel
        lattice.holeZ = pivot
        lattice.companionX = (settings.companionX - settings.vanishX) * worldPerPixel
        lattice.companionY = (settings.companionY - settings.vanishY) * worldPerPixel
        lattice.companionZ = pivot
      }
      // With no black hole the cells are measured from a shadow that is a share of the short side
      const unit = (shadowRadius > 0 ? shadowRadius : state.gridLatticeUnit * shortSide) * worldPerPixel
      lattice.cell = state.gridLatticeCell * unit
      // No farther than its lines go
      lattice.reach = Math.min(state.gridLatticeReach, LATTICE_LINES_PER_SIDE) * lattice.cell
      lattice.fadeFrom = (1 - state.gridLatticeFade) * lattice.reach
      lattice.warp = state.gridLatticeWarp
      lattice.edge = horizon * worldPerPixel
      lattice.companionEdge = companionRadius * worldPerPixel
      lattice.anchorX = latticeAnchor(lattice.holeX, lattice.cell)
      lattice.anchorY = latticeAnchor(lattice.holeY, lattice.cell)
      lattice.anchorZ = latticeAnchor(lattice.holeZ - pivot, lattice.cell)
      // Line n across lies n less its anchor cells from the hole, and one past the reach is not lit
      const reachCells = Math.min(state.gridLatticeReach, LATTICE_LINES_PER_SIDE)
      lattice.lines = Math.min(LATTICE_LINES_PER_SIDE, Math.floor(reachCells + Math.max(lattice.anchorX, lattice.anchorY, lattice.anchorZ)))
      lattice.pivot = pivot
      lattice.focal = settings.focal
      lattice.vanishX = settings.vanishX
      lattice.vanishY = settings.vanishY
      // The lines fade out as they come nearer the camera than a share of the distance to that point
      lattice.near = pivot * state.gridLatticeNear
      lattice.gone = lattice.near * state.gridLatticeNearEdge
      lattice.farthest = state.gridLatticeFar
      lattice.lineWidth = state.gridLatticeLine
      lattice.gain = state.gridLatticeGain
    }

    renderer.render(frame)
  }

  const scene: Scene = {
    frame,
    hole,
    intro,
    ringTiming,
    pointer,
    width: 0,
    height: 0,
    pixelRatio: 1,
    introTime: 0,
    time: 0,
    speed: 0,
    ringdown: 0,
    holeShiftX: 0,
    holeShiftY: 0,
    ready: () => renderer !== null,
    resize,
    setTitle,
    makeTitle,
    useTitle,
    restart,
    fire,
    placeHole,
    reseed: (next) => {
      seedRandom(random, next)
      frame.fieldSeed = next
    },
    advance,
    drawIdle,
    loseContext: () => {
      renderer = null
    },
    restoreContext: (from) => {
      renderer = createParticleRenderer(gl)
      if (renderer && titleSprite) renderer.setTitle(titleSprite)
      // The field's particles were on the card that was lost: they go up again as they were born
      frame.fieldBorn = 0
      readBackground(from.settings)
      resize(scene.width, scene.height, scene.pixelRatio, true)
    },
    dispose: () => {
      disposed = true
      renderer?.dispose()
      renderer = null
    }
  }
  return scene
}
