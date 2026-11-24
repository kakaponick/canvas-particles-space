import { useEffect, useRef, useState } from 'react'
import { useParticleStore } from '../store/particle_store'
import {
  createParticleField,
  createInstanceData,
  createPaletteSampler,
  ensureInstanceCapacity,
  setParticleCount,
  stepParticles,
  toFrameScale,
  REFERENCE_FPS,
  type SpawnSettings,
  type StepSettings
} from '../lib/particle_simulation'
import {
  createParticleRenderer,
  getRenderingContext,
  type FrameInput,
  type ParticleRenderer
} from '../lib/particle_renderer'
import { createIntroFrame, getIntroDuration, getRingdownTiming, sampleIntro, type RingdownTiming } from '../lib/intro_timeline'
import { getIntroPhase } from '../lib/intro_tracks'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { stepSpring, type Spring2D } from '../lib/black_hole_motion'
import { createSpeedDial, turnSpeedDial, wheelPixels, SWIPE_GAIN } from '../lib/base_speed'
import { createFramePacer, pacedFrameMs } from '../lib/frame_pacing'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from '../lib/title_sprite'
import { createParticleBudget, updateParticleBudget } from '../lib/particle_budget'
import { clearRingEnergy, createRingEnergy, stepRingEnergy } from '../lib/ring_energy'
import { answerFrameCaptures, captureRequests } from '../lib/scene_capture'

// The light front reaches the title about 0.85 s in; a face that is not ready by then is swapped in later
const TITLE_FONT_TIMEOUT_MS = 700

// rAF timestamps jitter; a frame this close to its slot still counts as on time
const FRAME_SLOT_TOLERANCE_MS = 1
const FPS_SAMPLE_MS = 500

// Device pixels drawn per frame are capped, so HiDPI and 4K screens stay within the GPU's means
const PIXEL_BUDGET = 4_500_000
const MAX_PIXEL_RATIO = 2

// The crumbling title follows the black hole's gravity: at these settings (the defaults) the dust
// travels Dust Drift and turns by this many radians at Dust Swirl 1
const TITLE_REFERENCE_GRAVITY = 2.5
const TITLE_REFERENCE_ORBIT = 40
const TITLE_SWIRL_RADIANS = 0.35
const TITLE_PULL_LIMIT = 4
// CSS pixels the title's words keep from the screen's edges and from the letterbox bars
const TITLE_SAFE_MARGIN = 16

// The centre of something `half` wide, moved as little as needed for it to lie between `inset` and
// `size - inset`; centred when there is not enough room
function keepInside (center: number, half: number, inset: number, size: number) {
  const low = inset + half
  const high = size - inset - half
  return low > high ? size / 2 : Math.min(Math.max(center, low), high)
}

// A touch this close to the black hole drags it
const MIN_TOUCH_GRAB_RADIUS = 48
// An anchored black hole is grabbed by a mouse press this close to it, or within its shadow when that
// is larger
const MIN_MOUSE_GRAB_RADIUS = 24
const MOUSE_GRAB_SHADOWS = 1.5
// A press on the black hole becomes a drag once the mouse moves this far; less is still a click
const MOUSE_DRAG_THRESHOLD = 4
// With looping on, the debugger holds the finished intro this long before replaying it
const LOOP_HOLD_SECONDS = 1
const READOUT_INTERVAL_MS = 66
// With the debugger closed the intro plays at the debugger's speed; once it is over the scene eases back
// to full speed over about this long, instead of jumping
const SPEED_RETURN_MS = 800
// A ringdown wobble smaller than this share of the radius no longer shows, so the oval is switched off
const MIN_HOLE_OVAL = 1e-4
// The gravitational wave is switched off this many wobble decay times after its front left the screen
const GRAVITY_WAVE_FADES = 6

function getRenderScale (width: number, height: number) {
  const budgetScale = Math.sqrt(PIXEL_BUDGET / Math.max(width * height, 1))
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, budgetScale))
}

function ParticleCanvas () {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = getRenderingContext(canvas)
    let renderer: ParticleRenderer | null = gl ? createParticleRenderer(gl) : null
    if (!gl || !renderer) {
      setUnsupported(true)
      return
    }

    let disposed = false
    let viewportWidth = 0
    let viewportHeight = 0
    let pixelRatio = 1
    let resizeFrameId = 0
    let titleSprite: TitleSprite | null = null
    let titleKey = ''
    let titleBuild = 0

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionQuery.matches

    // Interaction state lives here, not in the store: nothing else renders it
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let draggingTouch = -1
    // A finger or the mouse is carrying the black hole: it heads for the pointer, not its anchor
    let holding = false
    // A mouse press landed on the anchored black hole; it turns into a drag once the mouse moves
    let mouseGrabbed = false
    let mouseDragging = false
    let pressX = 0
    let pressY = 0
    // Where on the black hole it was grabbed, so it does not jump to the cursor
    let grabOffsetX = 0
    let grabOffsetY = 0
    // The click that ends a drag is the drop, not a switch between following and anchored
    let swallowClick = false
    let canvasCursor = ''
    let swipingTouch = -1
    let swipeY = 0
    const speedDial = createSpeedDial()
    let lastPointerType = 'mouse'
    const hole: Spring2D = { x: targetX, y: targetY, vx: 0, vy: 0 }
    // The saved resting place of the black hole and the place the intro happens, in CSS pixels
    let anchorX = targetX
    let anchorY = targetY
    let originX = targetX
    let originY = targetY

    // Loop timing
    let frameId = 0
    let lastFrameTime = -1
    let nextFrameSlot = 0
    let animationTime = 0
    let introTime = 0
    // Playback speed with the debugger closed: the debugger's speed during the intro, 1 after it
    let closedRate = useIntroDebugStore.getState().timeScale
    let fadeBacklog = 0
    const framePacer = createFramePacer()
    let fpsFrames = 0
    let fpsWindowStart = 0
    let lastReadoutTime = 0
    const initialDebug = useIntroDebugStore.getState()
    let handledRestart = initialDebug.restartRequest
    let handledStep = initialDebug.stepRequest

    const intro = createIntroFrame()
    const ringTiming: RingdownTiming = { frequency: 1, decay: 1 }

    const initialState = useParticleStore.getState()
    const particleBudget = createParticleBudget(initialState.numParticles)
    const ringEnergy = createRingEnergy()
    let ringWasFed = true
    const field = createParticleField()
    const instances = createInstanceData()
    const spawn: SpawnSettings = {
      palette: createPaletteSampler(initialState.colorPalette),
      farZ: initialState.farZ,
      speedVariance: initialState.speedVariance,
      radius: initialState.spawnRadius
    }
    setParticleCount(field, initialState.numParticles, spawn)

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
      fadeAlpha: 0,
      instances: instances.floats,
      instanceCount: 0,
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
      }
    }

    function readBackground () {
      const state = useParticleStore.getState()
      background[0] = state.backgroundR
      background[1] = state.backgroundG
      background[2] = state.backgroundB
      return background
    }

    // The intro happens at the screen centre, at the saved black hole position, or between the two
    function locateHole () {
      const state = useParticleStore.getState()
      const share = useIntroDebugStore.getState().params.originAtHole
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      anchorX = state.blackHoleX * viewportWidth
      anchorY = state.blackHoleY * viewportHeight
      originX = centerX + (anchorX - centerX) * share
      originY = centerY + (anchorY - centerY) * share
    }

    // The black hole is born where the intro happens and heads for its resting place once released
    function placeHoleAtOrigin () {
      locateHole()
      hole.x = originX
      hole.y = originY
      hole.vx = 0
      hole.vy = 0
      targetX = anchorX
      targetY = anchorY
    }

    // Replays the opening from its first frame with a fresh particle field
    function restartIntro () {
      const state = useParticleStore.getState()
      introTime = 0
      fadeBacklog = 0
      field.count = 0
      clearRingEnergy(ringEnergy)
      setParticleCount(field, particleBudget.active, spawn)
      placeHoleAtOrigin()
      renderer?.clearScene(readBackground())
      rebuildTitle()
      state.setIntroComplete(false)
    }

    function readTitleStyle (): TitleStyle {
      const { title, params } = useIntroDebugStore.getState()
      return {
        ...title,
        weight: params.titleWeight,
        tracking: params.titleTracking,
        size: params.titleSize,
        // No glow, no blur to draw
        haloRadius: params.titleHalo > 0 ? params.titleHaloRadius : 0,
        haloStreak: params.titleStreak
      }
    }

    // Rebuilds the title mask when its text, face, layout or the viewport changes, once the face
    // has the glyphs. Only the latest request draws, so fast typing never shows an older text
    function rebuildTitle (force = false) {
      if (!renderer) return
      const style = readTitleStyle()
      const key = `${JSON.stringify(style)}|${viewportWidth}|${pixelRatio}`
      if (!force && key === titleKey) return
      titleKey = key
      const build = ++titleBuild
      waitForTitleFont(style, TITLE_FONT_TIMEOUT_MS).then(() => {
        if (disposed || !renderer || build !== titleBuild) return
        titleSprite = renderTitleSprite(style, viewportWidth, pixelRatio)
        renderer.setTitle(titleSprite)
      })
    }

    // World coordinates do not depend on the viewport, so a resize only reallocates GPU buffers
    function applyViewportSize (force = false) {
      resizeFrameId = 0
      const width = window.innerWidth
      const height = window.innerHeight
      if (!renderer || (!force && width === viewportWidth && height === viewportHeight)) return

      // Keep the anchored black hole at the same relative spot
      if (viewportWidth > 0 && viewportHeight > 0) {
        const scaleX = width / viewportWidth
        const scaleY = height / viewportHeight
        targetX *= scaleX
        targetY *= scaleY
        hole.x *= scaleX
        hole.y *= scaleY
      }

      viewportWidth = width
      viewportHeight = height
      pixelRatio = getRenderScale(width, height)
      renderer.resize(width, height, pixelRatio, readBackground())
      rebuildTitle()

      // Resizing clears the canvas; while the loop is idle, show the background right away
      if (!frameId) {
        frame.instanceCount = 0
        frame.fadeAlpha = 0
        renderer.render(frame)
      }
    }

    function scheduleViewportSize () {
      if (!resizeFrameId) resizeFrameId = requestAnimationFrame(() => applyViewportSize())
    }

    function shouldAnimate () {
      return renderer !== null && !useParticleStore.getState().isPaused && !document.hidden
    }

    function syncLoop () {
      const animate = shouldAnimate()
      if (animate && !frameId) {
        lastFrameTime = -1
        nextFrameSlot = 0
        fpsFrames = 0
        fpsWindowStart = performance.now()
        frameId = requestAnimationFrame(renderFrame)
      } else if (!animate && frameId) {
        cancelAnimationFrame(frameId)
        frameId = 0
        useParticleStore.getState().setMeasuredFps(0)
      }
    }

    function reportFps (now: number) {
      fpsFrames++
      const elapsed = now - fpsWindowStart
      if (elapsed < FPS_SAMPLE_MS) return

      const fps = Math.round(fpsFrames * 1000 / elapsed)
      fpsFrames = 0
      fpsWindowStart = now
      const state = useParticleStore.getState()
      if (state.measuredFps !== fps) state.setMeasuredFps(fps)
    }

    function renderFrame (now: number) {
      frameId = requestAnimationFrame(renderFrame)
      if (!renderer) return

      const state = useParticleStore.getState()

      // Optional frame rate cap; 0 follows the display refresh rate
      if (state.frameRateCap > 0) {
        if (now < nextFrameSlot - FRAME_SLOT_TOLERANCE_MS) return
        nextFrameSlot = Math.max(nextFrameSlot + 1000 / state.frameRateCap, now)
      }

      const elapsedMs = lastFrameTime < 0 ? 1000 / REFERENCE_FPS : now - lastFrameTime
      lastFrameTime = now
      reportFps(now)

      // Intro debugger: playback rate, seeking and single steps apply while it is open
      const debug = useIntroDebugStore.getState()
      const debugging = debug.open
      const params = debug.params
      const introDuration = getIntroDuration(reducedMotion, params)
      if (debug.restartRequest !== handledRestart) {
        handledRestart = debug.restartRequest
        restartIntro()
      }
      if (debug.seekRequest !== null) {
        introTime = Math.min(Math.max(debug.seekRequest, 0), introDuration)
        debug.clearSeek()
      }
      const stepping = debug.stepRequest !== handledStep
      handledStep = debug.stepRequest
      const motionMs = pacedFrameMs(framePacer, elapsedMs)
      // The debugger's speed is the intro's speed whether the debugger is open or not. Open, it holds
      // the whole scene and PAUSE stops it; closed, it holds the intro only, and the scene eases back
      // to full speed once the intro is over. Pause belongs to the open debugger
      if (debugging) {
        closedRate = debug.timeScale
      } else {
        const targetRate = introTime < introDuration ? debug.timeScale : 1
        closedRate += (targetRate - closedRate) * Math.min(motionMs / SPEED_RETURN_MS, 1)
      }
      const playbackRate = stepping ? 1 : debugging ? (debug.playing ? debug.timeScale : 0) : closedRate
      const frameScale = stepping ? 1 : toFrameScale(motionMs) * playbackRate
      const dt = frameScale / REFERENCE_FPS
      // Hidden layers are part of the intro's look, so they stay hidden with the debugger closed
      const hidden = debug.hidden

      animationTime += dt
      introTime += dt
      if (debugging && debug.loop && introTime >= introDuration + LOOP_HOLD_SECONDS) restartIntro()

      // The explosion and the black hole's resting place, and how fast light crosses from one to the far corner
      const shortSide = Math.min(viewportWidth, viewportHeight)
      locateHole()
      // Every front is measured to the corner farthest from the explosion
      const explosionReach = Math.hypot(Math.max(originX, viewportWidth - originX), Math.max(originY, viewportHeight - originY)) * 1.15
      const lightSpeed = explosionReach / params.lightCrossTime
      // The horizon rings as a real black hole of its size would, scaled by the intro's multipliers
      const shadowRadius = state.blackHoleSize / 100 * shortSide
      getRingdownTiming(params, shadowRadius, lightSpeed, ringTiming)
      // Only the debugger's timeline reads it, so it is published only while the debugger is open
      const shownRing = debug.ringTiming
      if (debug.open && (Math.abs(shownRing.frequency - ringTiming.frequency) > ringTiming.frequency * 1e-3 ||
        Math.abs(shownRing.decay - ringTiming.decay) > ringTiming.decay * 1e-3)) debug.setRingTiming(ringTiming)

      sampleIntro(introTime, reducedMotion, params, ringTiming, intro)
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
      if (intro.done && !state.introComplete) state.setIntroComplete(true)

      if (state.colorPalette !== spawn.palette.source) {
        spawn.palette = createPaletteSampler(state.colorPalette)
      }
      spawn.farZ = state.farZ
      spawn.speedVariance = state.speedVariance
      spawn.radius = state.spawnRadius

      if (particleBudget.active !== field.count) {
        setParticleCount(field, particleBudget.active, spawn)
      }
      ensureInstanceCapacity(instances, field.capacity)

      // The black hole: born where the intro happens, then pulled toward its target on a spring.
      // An anchored hole rests at its saved position, which a slider or a preset may have just moved
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      if (!state.blackHoleFollowing && !holding) {
        targetX = anchorX
        targetY = anchorY
      }
      // The visible size and the radius of no return are set apart; both grow as the horizon forms.
      // The ringdown does not resize the horizon: it squashes it into an oval (composite.holeOval)
      const holeGrowth = hidden.hole ? 0 : intro.holeScale
      const horizon = shadowRadius * holeGrowth
      const captureRadius = state.eventHorizon / 100 * shortSide * holeGrowth
      if (intro.holdAtCenter) {
        stepSpring(hole, originX, originY, dt, params.centerHoldFrequency)
      } else {
        stepSpring(hole, targetX, targetY, dt, state.followFrequency)
      }

      const speed = state.baseSpeed * intro.speedBoost

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
      if (frame.updateScene) {
        const simStart = performance.now()
        frame.instanceCount = stepParticles(field, settings, spawn, instances)
        if (ringFed) stepRingEnergy(ringEnergy, dt, state.ringAfterglow, reducedMotion ? 0 : state.ringFlowSpeed)
        frame.instances = instances.floats
        const active = updateParticleBudget(
          particleBudget, state.numParticles, performance.now() - simStart, elapsedMs, now, state.adaptiveParticles
        )
        if (active !== state.activeParticles) state.setActiveParticles(active)
      }
      frame.speedGlow = state.speedGlow
      if (frameScale > 0) frame.frameScale = frameScale
      frame.doppler = hidden.doppler ? 0 : Math.min(Math.max((speed - 2) / 10, 0), 1) * (reducedMotion ? 0.5 : 1)
      readBackground()
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

      renderer.render(frame)
      // A frame the agent API asked for is read now, while the drawing buffer still holds it
      if (captureRequests.length > 0 && canvas) answerFrameCaptures(canvas)

      if (debugging && now - lastReadoutTime >= READOUT_INTERVAL_MS) {
        lastReadoutTime = now
        debug.setReadout({
          time: introTime,
          duration: introDuration,
          phase: getIntroPhase(introTime, reducedMotion, params),
          sourcePower: intro.sourcePower,
          lightFront: intro.lightFront,
          matterFront: intro.matterFront,
          remnantRedshift: intro.remnantRedshift,
          holeScale: intro.holeScale,
          ringdown,
          titleAlpha: title.alpha,
          speed,
          particlesDrawn: frame.instanceCount
        })
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType
    }

    const setCanvasCursor = (cursor: string) => {
      if (cursor === canvasCursor) return
      canvasCursor = cursor
      canvas.style.cursor = cursor
    }

    // An anchored black hole can be picked up; a following one already moves with the cursor, and one
    // that has no size yet (or at all) is not there to grab
    const isOverAnchoredHole = (x: number, y: number) => {
      if (useParticleStore.getState().blackHoleFollowing || frame.composite.horizon <= 0) return false
      const grabRadius = Math.max(frame.composite.horizon * MOUSE_GRAB_SHADOWS, MIN_MOUSE_GRAB_RADIUS)
      return Math.hypot(x - hole.x, y - hole.y) <= grabRadius
    }

    const showHoverCursor = (x: number, y: number) => {
      setCanvasCursor(mouseDragging ? 'grabbing' : isOverAnchoredHole(x, y) ? 'grab' : '')
    }

    const handleMouseDown = (event: MouseEvent) => {
      swallowClick = false
      if (event.button !== 0 || lastPointerType !== 'mouse') return
      if (!isOverAnchoredHole(event.clientX, event.clientY)) return
      mouseGrabbed = true
      pressX = event.clientX
      pressY = event.clientY
      grabOffsetX = hole.x - event.clientX
      grabOffsetY = hole.y - event.clientY
      // Keeps the drag from selecting text on the panels it passes over
      event.preventDefault()
    }

    // Carries the black hole with the cursor; it stays on screen
    const carryHole = (event: MouseEvent) => {
      targetX = Math.min(Math.max(event.clientX + grabOffsetX, 0), viewportWidth)
      targetY = Math.min(Math.max(event.clientY + grabOffsetY, 0), viewportHeight)
    }

    // Over the debugger dock the cursor is working the timeline, not steering the black hole
    const handleMouseMove = (event: MouseEvent) => {
      if (mouseGrabbed && !mouseDragging && Math.hypot(event.clientX - pressX, event.clientY - pressY) > MOUSE_DRAG_THRESHOLD) {
        mouseDragging = true
        holding = true
        setCanvasCursor('grabbing')
      }
      if (mouseDragging) {
        carryHole(event)
        return
      }
      if (event.target instanceof Element && event.target.closest('[data-intro-dock]')) return
      if (lastPointerType !== 'mouse') return
      if (useParticleStore.getState().blackHoleFollowing) {
        targetX = event.clientX
        targetY = event.clientY
      }
      if (event.target === canvas) showHoverCursor(event.clientX, event.clientY)
      else setCanvasCursor('')
    }

    // The black hole stays where it was dropped, anchored, and the place is saved with the settings
    const dropHole = () => {
      mouseGrabbed = false
      if (!mouseDragging) return
      mouseDragging = false
      holding = false
      swallowClick = true
      if (viewportWidth > 0 && viewportHeight > 0) {
        useParticleStore.getState().anchorBlackHoleAt(targetX / viewportWidth, targetY / viewportHeight)
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return
      const dropped = mouseDragging
      dropHole()
      // A dropped black hole is still catching up with the cursor that holds it
      if (dropped) setCanvasCursor(event.target === canvas ? 'grab' : '')
      else showHoverCursor(event.clientX, event.clientY)
    }

    // Leaving the window mid-drag drops the black hole where it is
    const handleWindowBlur = () => {
      dropHole()
      setCanvasCursor('')
    }

    // Double-click returns the black hole to the middle of the screen and anchors it there
    const handleDoubleClick = () => {
      useParticleStore.getState().anchorBlackHoleAt(0.5, 0.5)
      setCanvasCursor('')
    }

    // Click anchors the black hole where it is, or sets it following again from the click point
    const handleClick = (event: MouseEvent) => {
      if (swallowClick) {
        swallowClick = false
        return
      }
      // The second click of a double-click is the reset, not another switch
      if (lastPointerType !== 'mouse' || event.detail > 1) return
      const state = useParticleStore.getState()
      const wasFollowing = state.blackHoleFollowing
      state.toggleBlackHoleFollowing()
      if (wasFollowing) {
        targetX = hole.x
        targetY = hole.y
        // The place it was anchored at is saved with the settings
        if (viewportWidth > 0 && viewportHeight > 0) state.setBlackHolePosition(hole.x / viewportWidth, hole.y / viewportHeight)
      } else {
        targetX = event.clientX
        targetY = event.clientY
      }
      showHoverCursor(event.clientX, event.clientY)
    }

    // The store is written only when the setting moves by a whole step
    const changeBaseSpeed = (pixels: number) => {
      const state = useParticleStore.getState()
      const baseSpeed = turnSpeedDial(speedDial, state.baseSpeed, pixels, state.scrollSpeedStep)
      if (baseSpeed !== state.baseSpeed) state.setBaseSpeed(baseSpeed)
    }

    const handleWheel = (event: WheelEvent) => {
      // Ctrl with the wheel, or a trackpad pinch, zooms the page
      if (event.ctrlKey) return
      changeBaseSpeed(wheelPixels(event.deltaY, event.deltaMode, window.innerHeight))
    }

    // On touch screens the black hole is dragged; a swipe anywhere else changes the speed
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!touch || draggingTouch !== -1) return
      const grabRadius = Math.max(frame.composite.horizon * 2.2, MIN_TOUCH_GRAB_RADIUS)
      if (Math.hypot(touch.clientX - hole.x, touch.clientY - hole.y) > grabRadius) {
        if (swipingTouch === -1) {
          swipingTouch = touch.identifier
          swipeY = touch.clientY
        }
        return
      }
      draggingTouch = touch.identifier
      holding = true
      targetX = touch.clientX
      targetY = touch.clientY
      event.preventDefault()
    }

    const handleTouchMove = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === swipingTouch) {
          changeBaseSpeed((swipeY - touch.clientY) * SWIPE_GAIN)
          swipeY = touch.clientY
        }
        if (touch.identifier !== draggingTouch) continue
        targetX = touch.clientX
        targetY = touch.clientY
        event.preventDefault()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === draggingTouch) {
          draggingTouch = -1
          holding = mouseDragging
          // Where the finger left the black hole is saved with the settings
          if (viewportWidth > 0 && viewportHeight > 0) {
            useParticleStore.getState().setBlackHolePosition(targetX / viewportWidth, targetY / viewportHeight)
          }
        }
        if (touch.identifier === swipingTouch) swipingTouch = -1
      }
    }

    const handleMotionChange = () => {
      reducedMotion = motionQuery.matches
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      renderer = null
      syncLoop()
    }

    const handleContextRestored = () => {
      renderer = createParticleRenderer(gl)
      if (renderer && titleSprite) renderer.setTitle(titleSprite)
      applyViewportSize(true)
      syncLoop()
    }

    applyViewportSize(true)
    placeHoleAtOrigin()

    // A face that missed the timeout is swapped in once every pending font has loaded
    document.fonts?.ready.then(() => {
      if (!disposed) rebuildTitle(true)
    })
    let lastTitle = useIntroDebugStore.getState().title
    let lastParams = useIntroDebugStore.getState().params
    const unsubscribeTitle = useIntroDebugStore.subscribe((state) => {
      if (state.title === lastTitle && state.params === lastParams) return
      lastTitle = state.title
      lastParams = state.params
      rebuildTitle()
    })

    const unsubscribeStore = useParticleStore.subscribe(syncLoop)

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('resize', scheduleViewportSize)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: true })
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchcancel', handleTouchEnd)
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    document.addEventListener('visibilitychange', syncLoop)
    motionQuery.addEventListener('change', handleMotionChange)

    syncLoop()

    return () => {
      disposed = true
      unsubscribeStore()
      unsubscribeTitle()
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('resize', scheduleViewportSize)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      document.removeEventListener('visibilitychange', syncLoop)
      motionQuery.removeEventListener('change', handleMotionChange)
      if (frameId) cancelAnimationFrame(frameId)
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
      renderer?.dispose()
      renderer = null
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full touch-pinch-zoom" aria-hidden="true" />
      {unsupported && (
        <div role="alert" className="fixed inset-0 flex items-center justify-center p-8 text-center font-mono text-sm text-text-light">
          This experience needs WebGL. Turn on hardware acceleration in your browser settings or open the page in another browser.
        </div>
      )}
    </>
  )
}

export default ParticleCanvas
