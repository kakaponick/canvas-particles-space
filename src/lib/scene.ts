// The scene apart from the page: the particle field, the black hole, the intro and the renderer, advanced
// one frame at a time. The page calls `advance` from its animation loop with the time that really passed;
// a film (film_render.ts) calls it in a plain loop with a fixed step. Everything a frame depends on arrives
// in SceneInput, so the scene reads no store and no window, and with the same seed and the same inputs it
// draws the same frames.
import {
  createParticleField,
  createInstanceData,
  createPaletteSampler,
  ensureInstanceCapacity,
  setParticleCount,
  stepParticles,
  type SpawnSettings,
  type StepSettings
} from './particle_simulation'
import { createParticleRenderer, type FrameInput, type ParticleRenderer } from './particle_renderer'
import { createIntroFrame, getRingdownTiming, ringdownWobble, sampleIntro, type IntroFrame, type RingdownTiming } from './intro_timeline'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { RINGDOWN_PHYSICAL_DECAY, RINGDOWN_PHYSICAL_FREQUENCY, type IntroParams } from './intro_params'
import type { SimulationSettings } from './simulation_presets'
import { stepSpring, type Spring2D } from './black_hole_motion'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from './title_sprite'
export type { TitleSprite } from './title_sprite'
import { clearRingEnergy, createRingEnergy, stepRingEnergy } from './ring_energy'
import { createGridSettings, placeGrid } from './space_grid'
import { LIGHT_SPEED, SHADOW_RADII, clearOrbiters, createOrbiters, stepOrbiters } from './orbiters'
import { createPair, stepPair } from './companion'
import { CLOSEST_CAMERA, cameraFor, shadowAngle } from './lens_trace'
import { createShadowShape, updateShadowShape } from './kerr_shadow'
import { createRandom, seedRandom } from './random'
import type { ParticleCrew } from './particle_crew'

// The crumbling title follows the black hole's gravity: at these settings (the defaults) the dust
// travels Dust Pull and turns by this many radians at Dust Swirl 1
const TITLE_REFERENCE_GRAVITY = 2.5
const TITLE_REFERENCE_ORBIT = 40
const TITLE_SWIRL_RADIANS = 0.35
const TITLE_PULL_LIMIT = 4
// CSS pixels the title's words keep from the screen's edges and from the letterbox bars
const TITLE_SAFE_MARGIN = 16
// A ringdown wobble smaller than this share of the radius no longer shows, so the oval is switched off
const MIN_HOLE_OVAL = 1e-4
// The gravitational wave is switched off this many wobble decay times after its front left the screen
const GRAVITY_WAVE_FADES = 6
// Two equal black holes becoming one leave an oval this many times longer than one forming in the intro
const MERGER_RING = 3
// A fired effect is over once everything it shows is fainter than this
const CUE_FADED = 0.002
const DEGREE = Math.PI / 180
// The most a black hole spins, a/M: the top of the Spin slider
const SPIN_MAX = 0.998
// 1 / the camera's distance in Schwarzschild radii with no lens to place it: far enough to be at infinity
const FAR_CAMERA = 1e-3
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
  // Particles simulated: what the adaptive budget allows on the page, the setting itself in a film
  particleCount: number
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
  // Readouts of the last frame: flight speed, ringdown wobble, milliseconds its simulation took
  speed: number
  ringdown: number
  simulationMs: number
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

// With a `crew` the particle field is stepped on several cores (particle_crew.ts); the frames are the same
export function createScene (
  gl: WebGL2RenderingContext,
  seed: number,
  input: SceneInput,
  crew: ParticleCrew | null = null
): Scene | null {
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
  const field = crew ? crew.field : createParticleField()
  const orbiters = createOrbiters(random)
  const pair = createPair()
  const shadowShape = createShadowShape()
  const instances = crew ? crew.instances : createInstanceData()
  const spawn: SpawnSettings = {
    random,
    palette: createPaletteSampler(input.settings.colorPalette),
    farZ: input.settings.farZ,
    speedVariance: input.settings.speedVariance,
    radius: input.settings.spawnRadius
  }
  setParticleCount(field, input.particleCount, spawn)

  const settings: StepSettings = {
    frameScale: 0,
    time: 0,
    speed: 0,
    width: 0,
    height: 0,
    focal: 1,
    vanishX: 0,
    vanishY: 0,
    holeX: NaN,
    holeY: NaN,
    holeRadius: 0,
    captureRadius: 0,
    captureX: 0,
    captureY: 0,
    spinRight: 0,
    spinUp: 0,
    spinToward: 0,
    companionX: 0,
    companionY: 0,
    companionRadius: 0,
    companionCapture: 0,
    ringEnergy,
    gravityReach: 0,
    holeDepth: 0,
    gravityDepth: 1,
    lineWidth: 3,
    gravityStrength: 0,
    orbitalStrength: 0,
    farZ: 1,
    depthFade: 0,
    pulseSpeedMultiplier: 0,
    pulseIntensity: 0,
    baseBrightness: 0,
    minOpacity: 0,
    maxOpacity: 0,
    revealRadius: 0,
    revealX: 0,
    revealY: 0,
    revealFeather: 80,
    opacityScale: 1
  }

  const background: [number, number, number] = [0, 0, 0]
  const frame: FrameInput = {
    background,
    updateScene: true,
    present: true,
    fadeAlpha: 0,
    instances: instances.floats,
    instanceCount: 0,
    instanceRuns: crew ? crew.runs : new Int32Array(0),
    instanceRunCount: 0,
    orbitCount: 0,
    orbitRow: orbiters.row,
    orbitRowNew: true,
    orbitDimmed: 0,
    orbitX: 0,
    orbitY: 0,
    orbitUnit: 1,
    orbitWidth: 1,
    doppler: 0,
    speedGlow: 1,
    frameScale: 1,
    vanishX: 0,
    vanishY: 0,
    ringTexels: ringEnergy.texels,
    ringFed: true,
    title: {
      alpha: 0, x: 0, y: 0, reveal: 1, dissolve: 0, drift: 0, glow: 0, flash: 0, cooling: 1, dust: 0,
      pull: 0, swirl: 0, reach: 0, capture: 0, scale: 1, fringe: 0, halo: 0, redshift: 0, grain: 1, burn: 0, fall: 0,
      tidal: 2, spiral: 1, spread: 0.75, stream: 0.5, order: 0.3, trail: 0.8, heat: 1.6
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
      waveRadius: 0,
      waveStrength: 0,
      waveWidth: 1,
      remnantGlow: 0,
      remnantRedshift: 0,
      remnantRadius: 1,
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
      dustScale: 220,
      dustThreshold: 0.5,
      lightDustContrast: 1,
      dustSweep: 1,
      echoFloor: 0,
      dustShock: 0,
      dustBlow: 0,
      dustDrift: 0,
      skyGrid: 0,
      gridCell: 64,
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
      letterbox: 0
    },
    grid: createGridSettings()
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
    field.count = 0
    clearOrbiters(orbiters)
    clearRingEnergy(ringEnergy)
    syncSpawn(from.settings)
    setParticleCount(field, from.particleCount, spawn)
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

  function drawIdle () {
    if (!renderer) return
    frame.instanceCount = 0
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
    // Every front is measured to the corner farthest from the explosion
    const explosionReach = Math.hypot(Math.max(originX, viewportWidth - originX), Math.max(originY, viewportHeight - originY)) * 1.15
    const lightSpeed = explosionReach / params.lightCrossTime
    // The horizon rings as a real black hole of its size would, scaled by the intro's multipliers
    // A second black hole turns with the main one around the place the black hole stands; the main one
    // grows as it takes the companion in
    const shadowShare = state.blackHoleSize / 100
    stepPair(pair, state.companionSize, state.companionDistance, state.companionSpeed, state.companionWaves, shadowShare, dt, scene.time)
    const shadowRadius = shadowShare * shortSide * pair.growth
    getRingdownTiming(params, shadowRadius, lightSpeed, ringTiming)

    sampleIntro(scene.introTime, reducedMotion, params, ringTiming, intro)
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
    // last turns of the pair, the merger and the ringing are one motion
    const sinceMerger = pair.mergedAt >= 0 ? scene.time - pair.mergedAt : -1
    const pairLight = LIGHT_SPEED * shortSide
    const pairRate = Math.max(Math.abs(state.companionSpeed), 0.01)
    mergerRing.frequency = RINGDOWN_PHYSICAL_FREQUENCY * pair.ringPitch * pairRate * pairLight / Math.max(shadowRadius, 4)
    mergerRing.decay = RINGDOWN_PHYSICAL_DECAY * pair.ringLength * Math.max(shadowRadius, 4) / (pairRate * pairLight)
    let drawnOut = 0
    let drawnAlong = 0
    let ringing = 0
    if (pair.companion > 0 && !hidden.ringdown) {
      const most = params.ringdownAmplitude * MERGER_RING * pair.symmetry
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
    if (from.particleCount !== field.count) setParticleCount(field, from.particleCount, spawn)
    ensureInstanceCapacity(instances, field.capacity)

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
    const holeX = hole.x + pair.mainX * pairUnit
    const holeY = hole.y + pair.mainY * pairUnit
    const companionRadius = pair.companion * pairUnit

    // Spin: the hole's own and, as two black holes merge, that of the hole they leave, about the axis of
    // their orbit, which faces the camera since the pair turns in the plane of the screen. The two add as
    // vectors (right, up, toward the camera) in the share the merger has come
    const ownTilt = state.spinTilt * DEGREE
    const ownAxis = state.spinAxis * DEGREE
    const keep = 1 - pair.merged
    const spinRight = -state.blackHoleSpin * Math.sin(ownTilt) * Math.sin(ownAxis) * keep
    const spinUp = state.blackHoleSpin * Math.sin(ownTilt) * Math.cos(ownAxis) * keep
    // A pair turning the way the screen's angles run, clockwise to the eye, spins away from the camera
    const spinToward = state.blackHoleSpin * Math.cos(ownTilt) * keep + pair.spin * pair.merged * (pair.omega > 0 ? -1 : 1)
    const across = Math.sqrt(spinRight * spinRight + spinUp * spinUp)
    const spin = horizon > 0 ? Math.min(Math.sqrt(across * across + spinToward * spinToward), SPIN_MAX) : 0
    const spinTilt = Math.atan2(across, spinToward)
    const spinAxis = across > 0 ? Math.atan2(-spinRight, spinUp) : ownAxis
    // Where the camera stands: the Ray Traced lens and the shadow's outline see the hole from there. A hole
    // still growing, or grown by a merger, is a lighter or heavier one seen from the same place
    const mass = horizon / (shadowShare * shortSide)
    const cameraU = Math.min((state.lensingRadius > 0 ? cameraFor(state.lensingRadius) : FAR_CAMERA) * mass, 1 / CLOSEST_CAMERA)
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
    // The newborn field flies out of the explosion, not out of the screen centre
    settings.vanishX = centerX + (originX - centerX) * intro.vanishAtOrigin
    settings.vanishY = centerY + (originY - centerY) * intro.vanishAtOrigin
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
    settings.spinRight = spinRight * dragShare
    settings.spinUp = spinUp * dragShare
    settings.spinToward = spinToward * dragShare
    // With the feed off the simulation stops collecting light, and old light does not return later
    const ringFed = state.ringEnabled && state.ringFeedEnabled
    if (ringWasFed && !ringFed) clearRingEnergy(ringEnergy)
    ringWasFed = ringFed
    settings.ringEnergy = ringFed ? ringEnergy : null
    frame.ringFed = ringFed
    settings.gravityReach = horizon * state.gravityReach
    settings.holeDepth = state.farZ * state.blackHoleDepth / 100
    settings.gravityDepth = state.farZ * state.gravityDepth / 100
    settings.lineWidth = state.particleSize
    settings.gravityStrength = hidden.gravity ? 0 : state.gravityStrength
    settings.orbitalStrength = hidden.gravity ? 0 : state.orbitalStrength
    settings.farZ = state.farZ
    settings.depthFade = state.depthFade
    settings.pulseSpeedMultiplier = state.pulseSpeedMultiplier
    settings.pulseIntensity = state.pulseIntensity
    settings.baseBrightness = state.baseBrightness
    settings.minOpacity = state.minOpacity
    settings.maxOpacity = state.maxOpacity
    settings.revealRadius = intro.reveal >= 1 ? Infinity : explosionReach * intro.reveal
    settings.revealX = originX
    settings.revealY = originY
    settings.revealFeather = params.revealFeather
    settings.opacityScale = intro.opacityScale

    // A frozen frame keeps the scene texture; only the composite (lens, flash, title) is redrawn
    frame.updateScene = frameScale > 0
    frame.present = present
    if (frame.updateScene) {
      const simStart = performance.now()
      if (crew) {
        frame.instanceCount = crew.step(settings, spawn)
        frame.instanceRunCount = crew.runCount
      } else {
        frame.instanceCount = stepParticles(field, settings, spawn, instances)
      }
      // The orbiting stars circle the hole at its full size and light up as it forms. The renderer keeps
      // the stretches they fly and draws the traces from them, around the hole as it is this frame
      frame.orbitCount = stepOrbiters(
        orbiters, state.orbitCount, state.orbitSize, state.orbitEccentricity, state.orbitSpeed, dt,
        shadowRadius, shadowRadius * state.horizonScale, spinToward, shortSide,
        Math.min(holeGrowth, 1), state.orbitTrail, spawn.palette, settings.ringEnergy
      )
      frame.orbitRowNew = orbiters.rowNew
      frame.orbitDimmed = orbiters.dimmed
      frame.orbitX = holeX
      frame.orbitY = holeY
      frame.orbitUnit = shadowRadius / SHADOW_RADII
      frame.orbitWidth = state.orbitStarSize
      if (ringFed) stepRingEnergy(ringEnergy, dt, state.ringAfterglow, reducedMotion ? 0 : state.ringFlowSpeed)
      frame.instances = instances.floats
      scene.simulationMs = performance.now() - simStart
    }
    frame.speedGlow = state.speedGlow
    if (frameScale > 0) frame.frameScale = frameScale
    frame.doppler = hidden.doppler ? 0 : Math.min(Math.max((speed - 2) / 10, 0), 1) * (reducedMotion ? 0.5 : 1)
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
    let zoomX = originX
    let zoomY = originY
    const zoomed = 1 - 1 / cameraZoom
    if (state.cameraZoom !== 1 && Math.abs(zoomed) > 1e-6) {
      const own = 1 - 1 / state.cameraZoom
      const shared = 1 / state.cameraZoom - 1 / cameraZoom
      zoomX = (hole.x * own + originX * shared) / zoomed
      zoomY = (hole.y * own + originY * shared) / zoomed
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
      const lookX = (inPair > 0 ? settings.companionX - hole.x : hole.x - holeX) * inPair + state.cameraX * shadowRadius
      const lookY = (inPair > 0 ? settings.companionY - hole.y : hole.y - holeY) * inPair - state.cameraY * shadowRadius
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
      const widest = Math.max(viewportWidth - 2 * TITLE_SAFE_MARGIN, 1) / (titleSprite.textWidth * cameraZoom)
      titleScale = Math.min(titleScale, widest)
      const bar = hidden.camera ? 0 : params.letterbox * viewportHeight
      const halfWidth = titleSprite.textWidth * 0.5 * titleScale * cameraZoom
      const halfHeight = titleSprite.textHeight * 0.5 * titleScale * cameraZoom
      titleX = zoomX + (keepInside(zoomX + (titleX - zoomX) * cameraZoom, halfWidth, TITLE_SAFE_MARGIN, viewportWidth) - zoomX) / cameraZoom
      titleY = zoomY + (keepInside(zoomY + (titleY - zoomY) * cameraZoom, halfHeight, bar + TITLE_SAFE_MARGIN, viewportHeight) - zoomY) / cameraZoom
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
    title.pull = horizon > 0 ? Math.min(Math.max(settings.gravityStrength / TITLE_REFERENCE_GRAVITY, -TITLE_PULL_LIMIT), TITLE_PULL_LIMIT) : 0
    title.swirl = title.pull * Math.min(Math.max(settings.orbitalStrength / TITLE_REFERENCE_ORBIT, -TITLE_PULL_LIMIT), TITLE_PULL_LIMIT) *
      TITLE_SWIRL_RADIANS * params.titleSwirl
    title.reach = settings.gravityReach
    title.capture = captureRadius
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

    const composite = frame.composite
    composite.time = animationTime
    composite.holeX = holeX
    composite.holeY = holeY
    composite.horizon = horizon
    composite.einstein = state.lensingEnabled && !hidden.lens ? horizon * state.lensingRadius * intro.lensScale : 0
    // Ray Traced: the Einstein Radius places the camera (cameraU above); the scale keeps the shadow a hole
    // of this mass would cast without spin the size the shadow is drawn
    if (state.lensingTraced && composite.einstein > 0) {
      composite.traceU = cameraU
      composite.traceScale = horizon / Math.tan(0.5 * shadowAngle(cameraU))
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
    composite.companionRadius = companionRadius
    composite.companionEinstein = companionRadius > 0 ? composite.einstein * pair.companion / pair.growth : 0
    composite.pairX = hole.x
    composite.pairY = hole.y
    composite.pairPhase = pair.phase
    composite.pairPitch = pair.omega / (LIGHT_SPEED * shortSide)
    composite.ring = hidden.ring || !state.ringEnabled ? 0 : state.ringBrightness * ringPower
    composite.ringWidth = state.ringWidth
    composite.ringGlow = state.ringGlow
    composite.ringDoppler = state.ringDoppler
    composite.ringSide = state.ringSide
    composite.ringPhase = ringEnergy.phase
    composite.ringBase = ringFed ? state.ringBase : 1
    composite.ringFeed = ringFed ? state.ringFeed : 0
    composite.centerX = blastAtHole ? hole.x : originX
    composite.centerY = blastAtHole ? hole.y : originY
    composite.starGlow = intro.starGlow
    composite.starRadius = intro.starRadius * shortSide
    composite.sourcePower = intro.sourcePower
    composite.glareRadius = params.glareRadius * shortSide
    composite.exposure = intro.exposure
    composite.lightRadius = intro.lightFront * explosionReach
    composite.lightWidth = params.lightWidth * shortSide
    composite.lightPower = intro.lightPower
    composite.lightSpeed = lightSpeed
    composite.lightDustContrast = params.lightDustContrast
    composite.echoPower = intro.echoPower
    composite.echoDecay = params.echoDecay
    composite.dustScale = params.dustScale
    composite.dustThreshold = params.dustThreshold
    composite.dustSweep = params.dustSweep
    composite.echoFloor = params.echoFloor
    composite.dustShock = hidden.echo ? 0 : intro.dustShock
    composite.dustBlow = params.dustBlow
    composite.dustDrift = reducedMotion ? 0 : params.dustDrift
    composite.waveRadius = intro.matterFront * explosionReach
    composite.waveStrength = intro.waveStrength * params.waveRefraction
    composite.waveWidth = params.waveWidth * shortSide
    composite.remnantGlow = intro.remnantGlow
    composite.remnantRedshift = intro.remnantRedshift
    composite.remnantRadius = params.remnantRadius * shortSide
    // The ringing horizon is an oval, long along the axis the two numbers turn it to
    const oval = horizon > 0 && Math.abs(ovalX) + Math.abs(ovalY) > MIN_HOLE_OVAL
    composite.holeOvalX = oval ? ovalX : 0
    composite.holeOvalY = oval ? ovalY : 0
    // The gravitational wave is that wobble carried outward at the speed of light: every point shows the
    // wobble the horizon had when the wave left it. It is off once its last ripples are past the far corner
    const waveLife = params.lightCrossTime / 1.15 + ringTiming.decay * GRAVITY_WAVE_FADES
    const introWave = intro.ringdownTime > 0 && intro.ringdownTime <= waveLife
    // Two that became one send the ringing of the hole they leave, from where they met and at the pair's
    // own speed of light, once the intro's wave is gone. It starts as strong as the pair's spiral had
    // grown, which flies on ahead of it until its last arm is past the far corner
    const farthest = Math.hypot(Math.max(hole.x, viewportWidth - hole.x), Math.max(hole.y, viewportHeight - hole.y))
    const pairWave = hidden.gravityWave ? 0 : pair.wave * pairUnit
    const mergerWave = !introWave && pairWave > 0 && sinceMerger >= 0 && sinceMerger <= farthest / pairLight + mergerRing.decay * GRAVITY_WAVE_FADES
    composite.pairWave = sinceMerger >= 0 && sinceMerger * pairLight > farthest + shadowRadius ? 0 : pairWave
    composite.pairFront = mergerWave ? sinceMerger : -1
    composite.pairFrontSoft = 0.25 / mergerRing.frequency
    // A fired wave leaves the black hole as the newborn hole's did, once the other two are gone
    const cueWave = !introWave && !mergerWave && (cue.ringLayers & GRAVITY_WAVE) !== 0 && sinceCueRing > 0 && sinceCueRing <= waveLife
    if (sinceCueRing > Math.max(waveLife, ringTiming.decay * GRAVITY_WAVE_FADES)) cue.ringLayers = 0
    composite.gravityWaveAmplitude = hidden.gravityWave || !(introWave || mergerWave || cueWave)
      ? 0
      : mergerWave ? pairWave : params.gravityWaveGain * params.ringdownAmplitude * shadowRadius
    composite.gravityWaveTime = mergerWave ? sinceMerger : cueWave ? sinceCueRing : intro.ringdownTime
    composite.gravityWaveX = mergerWave || cueWave ? hole.x : originX
    composite.gravityWaveY = mergerWave || cueWave ? hole.y : originY
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
    composite.shakeX = shake * (Math.sin(animationTime * 83.1) + 0.6 * Math.sin(animationTime * 47.3)) / 1.6
    composite.shakeY = shake * (Math.sin(animationTime * 71.7 + 1.3) + 0.6 * Math.sin(animationTime * 39.9 + 0.4)) / 1.6
    composite.lensFringe = params.lensFringe * film
    composite.vignette = params.vignette * film
    composite.filmGrain = params.filmGrain * film
    composite.letterbox = params.letterbox * viewportHeight * film

    // The space grid: the flat one is read through the lens in the composite pass, the sheet is laid
    // over the frame with its well under the black hole
    const gridCell = state.gridCell / 100 * shortSide
    composite.skyGrid = state.gridSky
    composite.gridCell = gridCell
    frame.grid.brightness = state.gridSheet
    if (state.gridSheet > 0) {
      placeGrid(
        frame.grid, state.gridTilt, state.gridDepth, gridCell, viewportWidth, viewportHeight, holeX, holeY, horizon,
        settings.companionX, settings.companionY, companionRadius, hole.x, hole.y, pair.mergedPhase
      )
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
    simulationMs: 0,
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
    reseed: (next) => seedRandom(random, next),
    advance,
    drawIdle,
    loseContext: () => {
      renderer = null
    },
    restoreContext: (from) => {
      renderer = createParticleRenderer(gl)
      if (renderer && titleSprite) renderer.setTitle(titleSprite)
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
