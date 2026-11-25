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
import { createIntroFrame, getRingdownTiming, sampleIntro, type IntroFrame, type RingdownTiming } from './intro_timeline'
import type { IntroLayer } from './intro_tracks'
import type { IntroParams } from './intro_params'
import type { SimulationSettings } from './simulation_presets'
import { stepSpring, type Spring2D } from './black_hole_motion'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from './title_sprite'
import { clearRingEnergy, createRingEnergy, stepRingEnergy } from './ring_energy'
import { createGridSettings, placeGrid } from './space_grid'
import { MAX_ORBITERS, createOrbiters, stepOrbiters } from './orbiters'
import { createRandom, seedRandom } from './random'

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
  // False while the WebGL context is lost
  ready: () => boolean
  // Returns whether the size changed
  resize: (width: number, height: number, pixelRatio: number, input: SceneInput, force?: boolean) => boolean
  // Draws the title's words for the lens; resolves once they are in place or the wait for the face is over
  setTitle: (style: TitleStyle, fontTimeoutMs: number, force?: boolean) => Promise<void>
  // Starts again with a fresh particle field, at this moment of the intro
  restart: (input: SceneInput, introTime?: number) => void
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
  // Levels of brightness the orbiting stars' traces still owe; they are taken off in whole levels
  let orbitFadeBacklog = 0

  const intro = createIntroFrame()
  const ringTiming: RingdownTiming = { frequency: 1, decay: 1 }

  const random = createRandom(seed)
  const ringEnergy = createRingEnergy()
  let ringWasFed = true
  const field = createParticleField()
  const orbiters = createOrbiters(random)
  const instances = createInstanceData()
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
    orbitCount: 0,
    orbitFade: 0,
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
      holeOval: 0,
      gravityWaveAmplitude: 0,
      gravityWaveTime: -1,
      gravityWaveFrequency: 1,
      gravityWaveDecay: 1,
      gravityWaveRadius: 1,
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

  function restart (from: SceneInput, introTime = 0) {
    scene.introTime = introTime
    fadeBacklog = 0
    orbitFadeBacklog = 0
    field.count = 0
    orbiters.count = 0
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
    const shadowRadius = state.blackHoleSize / 100 * shortSide
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
    // The photon ring flickers with the ringdown wobble; the RINGDOWN layer removes both
    const ringdown = hidden.ringdown ? 0 : intro.ringdown
    const ringPower = intro.ringFade * Math.max(1 + params.ringFlicker * ringdown, 0)
    scene.ringdown = ringdown

    syncSpawn(state)
    if (from.particleCount !== field.count) setParticleCount(field, from.particleCount, spawn)
    // Room for every particle and, after them, the orbiting stars
    ensureInstanceCapacity(instances, field.capacity + MAX_ORBITERS)

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
    settings.holeX = hole.x
    settings.holeY = hole.y
    settings.holeRadius = horizon
    settings.captureRadius = captureRadius
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
      frame.instanceCount = stepParticles(field, settings, spawn, instances)
      // The orbiting stars circle the hole at its full size and light up as it forms; their segments
      // follow the particles'. Their traces fade by a level of brightness at a time
      frame.orbitCount = state.orbitCount > 0
        ? stepOrbiters(
          orbiters, state.orbitCount, state.orbitSize, state.orbitEccentricity, state.orbitSpeed, dt,
          hole.x, hole.y, shadowRadius, shadowRadius * state.horizonScale, shortSide,
          state.orbitStarSize, Math.min(holeGrowth, 1), spawn.palette, settings.ringEnergy, instances, frame.instanceCount
        )
        : 0
      orbitFadeBacklog += dt * 255 / Math.max(state.orbitTrail, 1 / 255)
      frame.orbitFade = Math.floor(orbitFadeBacklog)
      orbitFadeBacklog -= frame.orbitFade
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
    const cameraZoom = hidden.camera ? 1 : intro.cameraZoom
    let titleScale = 1 + params.titlePush * intro.titleAge
    let titleX = centerX
    let titleY = centerY + params.titleOffset * shortSide
    if (titleSprite && titleSprite.textWidth > 0) {
      const widest = Math.max(viewportWidth - 2 * TITLE_SAFE_MARGIN, 1) / (titleSprite.textWidth * cameraZoom)
      titleScale = Math.min(titleScale, widest)
      const bar = hidden.camera ? 0 : params.letterbox * viewportHeight
      const halfWidth = titleSprite.textWidth * 0.5 * titleScale * cameraZoom
      const halfHeight = titleSprite.textHeight * 0.5 * titleScale * cameraZoom
      titleX = originX + (keepInside(originX + (titleX - originX) * cameraZoom, halfWidth, TITLE_SAFE_MARGIN, viewportWidth) - originX) / cameraZoom
      titleY = originY + (keepInside(originY + (titleY - originY) * cameraZoom, halfHeight, bar + TITLE_SAFE_MARGIN, viewportHeight) - originY) / cameraZoom
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
    composite.holeX = hole.x
    composite.holeY = hole.y
    composite.horizon = horizon
    composite.einstein = state.lensingEnabled && !hidden.lens ? horizon * state.lensingRadius * intro.lensScale : 0
    composite.falloff = state.lensingFalloff
    composite.falloffPivot = state.lensingPivot / 100 * shortSide
    composite.lensCore = state.lensingCore
    composite.maxBend = state.lensingMaxBend
    composite.lensReach = state.lensingReach
    composite.twistLimit = state.lensingTwistLimit
    composite.swirl = state.lensingRotation
    composite.absorption = state.lensingAbsorption
    composite.ring = hidden.ring || !state.ringEnabled ? 0 : state.ringBrightness * ringPower
    composite.ringWidth = state.ringWidth
    composite.ringGlow = state.ringGlow
    composite.ringDoppler = state.ringDoppler
    composite.ringSide = state.ringSide
    composite.ringPhase = ringEnergy.phase
    composite.ringBase = ringFed ? state.ringBase : 1
    composite.ringFeed = ringFed ? state.ringFeed : 0
    composite.centerX = originX
    composite.centerY = originY
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
    // The ringing horizon is an oval, stretched sideways while the wobble is positive
    composite.holeOval = horizon > 0 && Math.abs(ringdown) > MIN_HOLE_OVAL ? ringdown : 0
    // The gravitational wave is that wobble carried outward at the speed of light: every point shows the
    // wobble the horizon had when the wave left it. It is off once its last ripples are past the far corner
    const waveTime = intro.ringdownTime
    const waveOut = waveTime > params.lightCrossTime / 1.15 + ringTiming.decay * GRAVITY_WAVE_FADES
    composite.gravityWaveAmplitude = hidden.gravityWave || waveTime <= 0 || waveOut
      ? 0
      : params.gravityWaveGain * params.ringdownAmplitude * shadowRadius
    composite.gravityWaveTime = waveTime
    composite.gravityWaveFrequency = ringTiming.frequency
    composite.gravityWaveDecay = ringTiming.decay
    composite.gravityWaveRadius = shadowRadius
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
    const film = hidden.camera ? 0 : intro.film
    const shake = hidden.camera ? 0 : intro.shake
    composite.cameraZoom = cameraZoom
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
      placeGrid(frame.grid, state.gridTilt, state.gridDepth, gridCell, viewportWidth, viewportHeight, hole.x, hole.y, horizon)
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
    ready: () => renderer !== null,
    resize,
    setTitle,
    restart,
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
