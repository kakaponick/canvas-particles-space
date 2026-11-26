// The scene apart from the page: the particle field, the black hole, the intro and the renderer, advanced
// one frame at a time. The page calls `advance` from its animation loop with the time that really passed;
// a film (film_render.ts) calls it in a plain loop with a fixed step. Everything a frame depends on arrives
// in SceneInput, so the scene reads no store and no window, and with the same seed and the same inputs it
// draws the same frames.
import { createParticleField, createPaletteSampler, createStepSettings, setParticleCount, type SpawnSettings } from './particle_simulation'
import { POSE_SLOTS, cameraPose } from './camera_pose'
import { createParticleRenderer, type FrameInput, type ParticleRenderer } from './particle_renderer'
import { createIntroFrame, getRingdownTiming, ringdownWobble, sampleIntro, type IntroFrame, type RingdownTiming } from './intro_timeline'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { RINGDOWN_PHYSICAL_DECAY, RINGDOWN_PHYSICAL_FREQUENCY, type IntroParams } from './intro_params'
import type { SimulationSettings } from './simulation_presets'
import { stepSpring, type Spring2D } from './black_hole_motion'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from './title_sprite'
export type { TitleSprite } from './title_sprite'
import { clearRingEnergy, createRingEnergy, feedRing, stepRingEnergy } from './ring_energy'
import { createGridSettings, placeGrid, rollGrid, turnGrid } from './space_grid'
import { LATTICE_LINES_PER_SIDE, createLatticeSettings, latticeAnchor } from './space_lattice'
import { FLOW_KEYS, createFlowSettings, resetFlow, stepFlow } from './flows'
import { LIGHT_SPEED, SHADOW_RADII, clearOrbiters, createOrbitTuning, createOrbiters, stepOrbiters } from './orbiters'
import { createPair, stepPair } from './companion'
import { CLOSEST_CAMERA, CRITICAL_IMPACT, cameraFor, einsteinRatioAt, shadowAngle } from './lens_trace'
import { createShadowShape, updateShadowShape } from './kerr_shadow'
import { createRandom, seedRandom } from './random'
import { createSceneColor, readSceneColor } from './scene_color'

// The crumbling title follows the black hole's gravity: at these settings (the defaults) the dust
// travels Dust Pull and turns by this many radians at Dust Swirl 1
const TITLE_REFERENCE_GRAVITY = 2.5
const TITLE_REFERENCE_ORBIT = 40
const TITLE_SWIRL_RADIANS = 0.35
// The camera's shake: two sines a side, the second weaker, at these radians a second at Shake Rate 1
const SHAKE_X = [83.1, 47.3] as const
const SHAKE_Y = [71.7, 39.9] as const
const SHAKE_SECOND = 0.6
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
  resize: (width: number, height: number, pixelRatio: number, input: SceneInput, force?: boolean) => boolean
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
  // Seconds the shake's clock is ahead of the scene's
  let shakeLead = 0

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
  // The particles as they are born; once sent to the graphics card they are stepped there
  const field = createParticleField()
  const orbiters = createOrbiters(random)
  const orbitTuning = createOrbitTuning()
  const pair = createPair()
  const shadowShape = createShadowShape()
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
    blend: 0, spin: 0, yaw: 0, pitch: 0, roll: 0, lookYaw: 0, lookPitch: 0, moveRight: 0, moveUp: 0, moveIn: 0, stepped: false
  }
  // The camera's pose, which sees the scene (cameraPose)
  const pose = new Float64Array(POSE_SLOTS)
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
    orbitTurn: new Float32Array(6),
    orbitFocal: 0,
    orbitDepth: 1,
    doppler: 0,
    tintAhead: createSceneColor(),
    tintEdge: createSceneColor(),
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
      tidal: 2, spiral: 1, spread: 0.75, stream: 0.5, order: 0.3, trail: 0.8, heat: 1.6,
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
      spin: 0,
      spinTilt: 0,
      spinAxis: 0,
      shadowShape,
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
      turn: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      gravityWaveX: 0,
      gravityWaveY: 0,
      companionX: 0,
      companionY: 0,
      companionRadius: 0,
      companionEinstein: 0,
      pairX: 0,
      pairY: 0,
      pairWave: 0,
      pairPhase: 0,
      pairPitch: 0,
      backgroundStars: 0,
      starCell: 26,
      starDensity: 0,
      starFlare: 0,
      nebula: 0,
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
      skyGrid: 0,
      gridCell: 64,
      gridPull: 0,
      gridHaze: 6,
      gridHazeSpan: 0.5,
      gridColor: createSceneColor(),
      skyGridLine: 1.5,
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
      vignette: 0,
      filmGrain: 0,
      letterbox: 0,
      vignetteStart: 0.45,
      vignetteEnd: 1.45,
      filmKnee: 0.8
    },
    grid: createGridSettings(),
    lattice: createLatticeSettings(),
    flows: FLOW_KEYS.map(() => createFlowSettings()),
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
    shakeLead = 0
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
    renderer?.clearScene(readBackground(from.settings))
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
  function resize (width: number, height: number, pixelRatio: number, from: SceneInput, force = false) {
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
    renderer.resize(width, height, pixelRatio, readBackground(from.settings))
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
    // The pair's lengths are in radii of the main hole before it grew; alone, the hole is its centre
    const pairUnit = horizon / pair.growth
    let holeX = hole.x + pair.mainX * pairUnit
    let holeY = hole.y + pair.mainY * pairUnit
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
    if (threeD) {
      view.spin = (view.spin + state.cameraSpin * DEGREE * dt) % FULL_TURN
      const eased = view.blend * view.blend * (3 - 2 * view.blend)
      yaw = eased * (state.cameraYaw * DEGREE + view.spin)
      pitch = eased * state.cameraPitch * DEGREE
      roll = eased * state.cameraRoll * DEGREE
      lookYaw = eased * state.cameraLookYaw * DEGREE
      lookPitch = eased * state.cameraLookPitch * DEGREE
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
    }

    // Spin: the hole's own and, as two black holes merge, that of the hole they leave, about the axis of
    // their orbit, which faces the camera since the pair turns in the plane of the screen. The two add as
    // vectors (right, up, toward the camera) in the share the merger has come
    const ownTilt = state.spinTilt * DEGREE
    const ownAxis = state.spinAxis * DEGREE
    const keep = 1 - pair.merged
    const sceneRight = -state.blackHoleSpin * Math.sin(ownTilt) * Math.sin(ownAxis) * keep
    const sceneUp = state.blackHoleSpin * Math.sin(ownTilt) * Math.cos(ownAxis) * keep
    // A pair turning the way the screen's angles run, clockwise to the eye, spins away from the camera
    const sceneToward = state.blackHoleSpin * Math.cos(ownTilt) * keep + pair.spin * pair.merged * (pair.omega > 0 ? -1 : 1)
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
    // Particles are captured on the circle that fits the outline, which spin shifts off the hole's centre
    const shapeCos = Math.cos(spinAxis)
    const shapeSin = Math.sin(spinAxis)
    const captureX = holeX + horizon * (shadowShape.centerRight * shapeCos - shadowShape.centerUp * shapeSin)
    const captureY = holeY - horizon * (shadowShape.centerRight * shapeSin + shadowShape.centerUp * shapeCos)

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
    settings.companionX = hole.x + pair.companionX * pairUnit
    settings.companionY = hole.y + pair.companionY * pairUnit
    settings.companionRadius = companionRadius
    settings.companionCapture = companionRadius * state.horizonScale
    settings.holeRadius = horizon
    settings.captureRadius = captureRadius * shadowShape.radius
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
    frame.ringFed = ringFed
    settings.gravityReach = horizon * state.gravityReach
    settings.holeDepth = state.farZ * state.blackHoleDepth / 100
    settings.gravityDepth = state.farZ * state.gravityDepth / 100
    settings.lineWidth = state.particleSize
    settings.minLineWidth = state.particleSizeMin
    settings.endFade = state.threeDEndFade
    settings.gravityStrength = hidden.gravity ? 0 : state.gravityStrength
    settings.orbitalStrength = hidden.gravity ? 0 : state.orbitalStrength
    // In space the orbital force turns about the line of flight, toward the camera, and the more the hole
    // spins the more about the spin's axis as it stands in the scene, by Swirl Follows Spin
    const spinLength = Math.hypot(sceneRight, sceneUp, sceneToward)
    const swirlShare = spinLength > 0 ? state.orbitalSpinFollow * Math.min(spinLength, 1) : 0
    const toSpin = spinLength > 0 ? swirlShare / spinLength : 0
    const swirlX = sceneRight * toSpin
    const swirlY = -sceneUp * toSpin
    const swirlZ = -(1 - swirlShare) - sceneToward * toSpin
    const swirlLength = Math.hypot(swirlX, swirlY, swirlZ)
    const swirlHeld = swirlLength > 1e-6
    settings.swirlX = swirlHeld ? swirlX / swirlLength : 0
    settings.swirlY = swirlHeld ? swirlY / swirlLength : 0
    settings.swirlZ = swirlHeld ? swirlZ / swirlLength : -1
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
    let holeScale = 1
    let companionScale = 1
    // The centre a pair turns about, on the screen, and how much larger than at the pivot it looks
    let centreX = hole.x
    let centreY = hole.y
    let centreScale = 1
    // The explosion's place, the same way
    let blastX = originX
    let blastY = originY
    let blastScale = 1
    // The 3D camera's turn and elevation, in radians, for the sheet
    let viewYaw = 0
    let viewPitch = 0
    const composite = frame.composite
    // What the composite pass sees through the camera's turn (the sky, the waves, the ringing oval) and
    // where a swallowed star's light lands: the pose's own turn in 3D, none straight on
    const seenTurn = composite.turn
    for (let slot = 0; slot < 9; slot++) seenTurn[slot] = threeD ? pose[slot] : slot % 4 === 0 ? 1 : 0
    // The particles' tint is measured from the line of flight: the scene's depth seen through that turn
    frame.flightX = seenTurn[2]
    frame.flightY = seenTurn[5]
    frame.flightZ = seenTurn[8]
    frame.flightFocal = settings.focal
    composite.pairLensMain = 0
    composite.pairLensCompanion = 0
    composite.pairNearer = 0
    if (threeD) {
      // The camera never circles a point nearer than a share of Field Depth (pivot, above), so a black hole
      // at depth 0 still has room around it
      const focal = settings.focal
      const worldPerPixel = pivot / focal
      // The pair's centre is a place of the scene: where the flat view shows the black hole, as far away
      // as the pivot. A camera that turns sees it move across the screen as it sees everything else. The
      // two turn around it across the line of flight, a plane the camera sees at an angle
      const pairX = (hole.x - settings.vanishX) * worldPerPixel
      const pairY = (hole.y - settings.vanishY) * worldPerPixel
      const pairZ = pivot
      const unit = pairUnit * worldPerPixel
      settings.holeWorldX = pairX + pair.mainX * unit
      settings.holeWorldY = pairY + pair.mainY * unit
      settings.holeWorldZ = pairZ
      settings.companionWorldX = pairX + pair.companionX * unit
      settings.companionWorldY = pairY + pair.companionY * unit
      settings.companionWorldZ = pairZ
      look(settings.companionWorldX, settings.companionWorldY, pairZ, pivot, focal)
      settings.companionX = seen.x
      settings.companionY = seen.y
      const companionAway = seen.depth
      companionScale = companionAway > NEAR_DEPTH ? pivot / companionAway : 0
      look(settings.holeWorldX, settings.holeWorldY, pairZ, pivot, focal)
      holeX = seen.x
      holeY = seen.y
      // A hole the camera has flown past is not drawn
      const holeAway = seen.depth
      const holeBehind = holeAway <= NEAR_DEPTH
      holeScale = holeBehind ? 0 : pivot / holeAway
      look(pairX, pairY, pairZ, pivot, focal)
      centreX = seen.x
      centreY = seen.y
      centreScale = seen.depth > NEAR_DEPTH ? pivot / seen.depth : 0
      // The explosion happened at a place of the scene too, at the pivot's depth
      look((originX - settings.vanishX) * worldPerPixel, (originY - settings.vanishY) * worldPerPixel, pivot, pivot, focal)
      blastX = seen.x
      blastY = seen.y
      blastScale = seen.depth > NEAR_DEPTH ? pivot / seen.depth : 0
      // Two holes at different depths: the nearer one's lens bends the light of the farther, by the share
      // of the way from the camera to the farther that lies behind the nearer (a thin lens's share of what
      // it does to the sky), and the nearer one's shadow covers the farther one's ring, wholly once they
      // are their two radii apart in depth
      if (companionRadius > 0 && !holeBehind && companionAway > NEAR_DEPTH) {
        const behind = companionAway - holeAway
        composite.pairLensCompanion = behind > 0 ? behind / companionAway : 0
        composite.pairLensMain = behind < 0 ? -behind / holeAway : 0
        const apart = (horizon + companionRadius) * worldPerPixel
        composite.pairNearer = apart > 0 ? Math.min(Math.max(-behind / apart, -1), 1) : 0
      }
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
      viewYaw = yaw
      viewPitch = pitch
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
      // The orbiting stars circle the main hole across the line of flight too: the renderer turns their
      // traces with the camera's columns for that plane and sets them at the hole's distance (below 0: the
      // hole is behind the camera and they are not drawn)
      const orbitTurn = frame.orbitTurn
      orbitTurn[0] = pose[0]
      orbitTurn[1] = pose[3]
      orbitTurn[2] = pose[6]
      orbitTurn[3] = pose[1]
      orbitTurn[4] = pose[4]
      orbitTurn[5] = pose[7]
      frame.orbitFocal = focal
      frame.orbitDepth = holeBehind ? -1 : focal / holeScale
    } else {
      settings.threeD = 0
      frame.orbitFocal = 0
    }

    // The space sheet is laid over the frame with its well under the black hole. It is laid out here, before
    // the particles are stepped, because Particles on Sheet draws them on it.
    // In 3D the sheet is a plane in the scene: the camera's elevation tilts it towards the camera and
    // the camera's turn spins its lines around the point the camera circles. It is seen at its own tilt
    // less the camera's elevation, up to a limit (75 degrees, the top of the Sheet Tilt slider, keeps its
    // horizon above the screen). Past that it fades, and at the default fade it is gone by the time the
    // camera would see it edge-on, so it is never seen from below
    const grid = frame.grid
    const seenTilt = threeD ? state.gridTilt - viewPitch / DEGREE : state.gridTilt
    const sheetTilt = threeD ? Math.min(Math.max(seenTilt, -state.gridTiltLimit), state.gridTiltLimit) : seenTilt
    const sheetLit = threeD && seenTilt > state.gridTiltLimit ? Math.max(1 - (seenTilt - state.gridTiltLimit) / state.gridTiltFade, 0) : 1
    const onSheet = state.gridRide > 0 && horizon * holeScale > 0
    if (state.gridSheet > 0 || onSheet) {
      // A camera that rolls turns the sheet about the middle of the screen: it is laid out for the holes as
      // they stand before the roll, and the roll is turned in when it is drawn
      let sheetHoleX = holeX
      let sheetHoleY = holeY
      let sheetCompanionX = settings.companionX
      let sheetCompanionY = settings.companionY
      let sheetCentreX = centreX
      let sheetCentreY = centreY
      if (roll !== 0) {
        const c = Math.cos(roll)
        const s = Math.sin(roll)
        const hx = holeX - centerX
        const hy = holeY - centerY
        const kx = settings.companionX - centerX
        const ky = settings.companionY - centerY
        sheetHoleX = centerX + c * hx - s * hy
        sheetHoleY = centerY + s * hx + c * hy
        sheetCompanionX = centerX + c * kx - s * ky
        sheetCompanionY = centerY + s * kx + c * ky
        const mx = centreX - centerX
        const my = centreY - centerY
        sheetCentreX = centerX + c * mx - s * my
        sheetCentreY = centerY + s * mx + c * my
      }
      placeGrid(
        grid, sheetTilt, state.gridDepth, state.gridCell / 100 * shortSide, viewportWidth, viewportHeight, sheetHoleX, sheetHoleY, horizon * holeScale,
        sheetCompanionX, sheetCompanionY, companionRadius * companionScale, sheetCentreX, sheetCentreY, pair.mergedPhase,
        state.gridDistance, state.gridSpan, state.gridFade
      )
      turnGrid(grid, viewYaw)
      rollGrid(grid, roll)
    }
    // Particles on Sheet: the step is handed the sheet as its camera sees it. A stroke is laid on it at both
    // of its ends as it lies now: seen through the sheet of the frame before, as a stroke of the 3D camera is,
    // every slow particle would be drawn as a long line while the sheet tilts
    settings.ride = onSheet && grid.throat > 0 ? state.gridRide : 0
    if (settings.ride > 0) {
      const sheetScale = grid.throat / (horizon * holeScale)
      settings.rideCos = sheetScale * grid.spinCos
      settings.rideSin = sheetScale * grid.spinSin
      settings.sheetViewX = grid.viewX
      settings.sheetViewY = grid.viewY
      settings.sheetDistance = grid.distance
      settings.sheetNear = state.gridNear * grid.distance
      settings.sheetSin = grid.tiltSin
      settings.sheetCos = grid.tiltCos
      settings.sheetWellX = grid.wellX
      settings.sheetWellZ = grid.wellZ
      settings.sheetThroat = grid.throat
      settings.sheetDepth = grid.depth
      settings.sheetRollCos = grid.rollCos
      settings.sheetRollSin = grid.rolled * grid.rollSin
      settings.sheetWell2X = grid.well2X
      settings.sheetWell2Z = grid.well2Z
      settings.sheetThroat2 = grid.throat2
      settings.sheetDepth2 = grid.depth2
    }

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
      orbitTuning.closest = state.orbitClosest
      orbitTuning.escape = state.orbitEscape
      orbitTuning.fadeIn = state.orbitFadeIn
      orbitTuning.drag = state.orbitDrag
      orbitTuning.flare = state.ringStarFlare
      orbitTuning.flareSpread = state.ringStarSpread
      orbitTuning.flareSides = state.ringStarSides
      frame.orbitCount = stepOrbiters(
        orbiters, state.orbitCount, state.orbitSize, state.orbitEccentricity, state.orbitSpeed, dt,
        shadowRadius, shadowRadius * state.horizonScale, sceneToward, shortSide,
        Math.min(holeGrowth, 1), state.orbitTrail, spawn.palette, settings.ringEnergy, orbitTuning, seenTurn
      )
      frame.orbitRowNew = orbiters.rowNew
      frame.orbitDimmed = orbiters.dimmed
      frame.orbitX = holeX
      frame.orbitY = holeY
      frame.orbitUnit = shadowRadius / SHADOW_RADII
      frame.orbitWidth = state.orbitStarSize
      if (ringFed) stepRingEnergy(ringEnergy, dt, state.ringAfterglow, reducedMotion ? 0 : state.ringFlowSpeed)
    }
    // The flows turn round the main hole in the plane the orbiting stars circle in, at the size the hole has
    // now; without a hole they keep the lattice's stand-in for its radius. Around moves a flow to the centre
    // a pair turns about and on to the second hole, whose radii it then takes. Their clocks run with the scene
    const flowUnit = shadowRadius > 0 ? horizon : state.gridLatticeUnit * shortSide
    for (let slot = 0; slot < FLOW_KEYS.length; slot++) {
      const keys = FLOW_KEYS[slot]
      const flow = frame.flows[slot]
      const life = state[keys.life]
      stepFlow(
        flow, frame.updateScene ? dt : 0, flowUnit > 0 ? state[keys.brightness] : 0, state[keys.count], state[keys.from], state[keys.to],
        state[keys.spread], state[keys.swirl], life, state[keys.trail], state[keys.size]
      )
      readSceneColor(flow.color, state[keys.color])
      const around = companionRadius > 0 ? state[keys.pair] : -1
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
      // Matter that ends inside the main hole's horizon lights its ring, as much as the field's would:
      // a particle a life, each leaving what a captured particle leaves
      if (ringFed && frame.updateScene && around <= -1 && flow.brightness > 0 && state[keys.to] < state.horizonScale) {
        feedRing(ringEnergy, flow.count / Math.max(life, 0.01) * dt * state.ringFeedCapture * Math.min(flow.brightness, 1))
      }
    }
    // A fast flight tints the particles: from Flight Tint From, growing evenly to its fullest at Flight Tint Full
    const tintSpan = Math.max(state.flightTintFull - state.flightTintFrom, MIN_TINT_SPAN)
    frame.doppler = hidden.doppler ? 0 : Math.min(Math.max((speed - state.flightTintFrom) / tintSpan, 0), 1) * (reducedMotion ? 0.5 : 1)
    readSceneColor(frame.tintAhead, state.flightTintAhead)
    readSceneColor(frame.tintEdge, state.flightTintEdge)
    frame.tintGradient = state.flightTintGradient
    frame.tintLimit = state.flightTintLimit
    readBackground(state)
    // The 8-bit scene texture rounds away fades smaller than half a step, so on fast displays
    // a per-frame fade would leave a grey haze. Fading in whole 60 Hz steps keeps the trail
    // identical at any frame rate.
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
    // Spin bends the outline of the shadow and the photon ring in either lens, and the light itself under
    // Ray Traced
    composite.spin = spin
    composite.spinTilt = spinTilt
    composite.spinAxis = spinAxis
    composite.shadowShape = shadowShape
    composite.falloff = state.lensingFalloff
    composite.falloffPivot = state.lensingPivot / 100 * shortSide
    composite.lensCore = state.lensingCore
    composite.maxBend = state.lensingMaxBend
    composite.lensReach = state.lensingReach
    composite.twistLimit = state.lensingTwistLimit
    composite.swirl = state.lensingRotation
    composite.absorption = state.lensingAbsorption
    composite.companionX = settings.companionX
    composite.companionY = settings.companionY
    composite.companionRadius = companionRadius * companionScale
    composite.companionEinstein = companionRadius > 0 ? einstein * companionScale * pair.companion / pair.growth : 0
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
    composite.ringPhase = ringEnergy.phase
    composite.ringBase = ringFed ? state.ringBase : 1
    composite.ringFeed = ringFed ? state.ringFeed : 0
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
    composite.backgroundStars = intro.backgroundStars * state.starsBrightness
    composite.starCell = state.starCell
    composite.starDensity = state.starDensity
    composite.starFlare = params.starFlare
    // The nebula is part of the sky: it shows as the opening lets the stars show
    composite.nebula = intro.backgroundStars * state.nebula
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
    const shakeTime = animationTime + shakeLead
    composite.shakeX = shake * (Math.sin(shakeTime * SHAKE_X[0]) + SHAKE_SECOND * Math.sin(shakeTime * SHAKE_X[1])) / (1 + SHAKE_SECOND)
    composite.shakeY = shake * (Math.sin(shakeTime * SHAKE_Y[0] + 1.3) + SHAKE_SECOND * Math.sin(shakeTime * SHAKE_Y[1] + 0.4)) / (1 + SHAKE_SECOND)
    composite.lensFringe = params.lensFringe * film
    composite.vignette = params.vignette * film
    composite.filmGrain = params.filmGrain * film
    composite.letterbox = params.letterbox * viewportHeight * film
    composite.vignetteStart = params.vignetteStart
    composite.vignetteEnd = params.vignetteEnd
    composite.filmKnee = params.filmKnee

    // The space grid: the flat one is read through the lens in the composite pass, the sheet is laid
    // over the frame with its well under the black hole
    const gridCell = state.gridCell / 100 * shortSide
    composite.skyGrid = state.gridSky
    composite.gridPull = state.gridSkyPull
    composite.gridHaze = state.gridSkyHaze
    composite.gridHazeSpan = state.gridSkyHazeSpan
    readSceneColor(composite.gridColor, state.gridColor)
    composite.gridCell = gridCell
    composite.skyGridLine = state.gridSkyLine
    // The sheet was laid out before the particles were stepped (above); here is what only its drawing reads
    grid.brightness = state.gridSheet * sheetLit
    if (state.gridSheet > 0) {
      grid.lineWidth = state.gridLine
      grid.lineScale = state.gridLineNear
      grid.near = state.gridNear
      grid.clearFrom = state.gridClearing
      grid.clearTo = state.gridClearingEdge
      grid.waveLift = state.gridWaveLift
      grid.rings = state.gridRings
      grid.spokes = state.gridSpokes
    }

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
      resize(scene.width, scene.height, scene.pixelRatio, from, true)
    },
    dispose: () => {
      disposed = true
      renderer?.dispose()
      renderer = null
    }
  }
  return scene
}
