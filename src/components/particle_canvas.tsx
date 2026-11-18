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
import { createIntroFrame, getIntroDuration, sampleIntro } from '../lib/intro_timeline'
import { getIntroPhase } from '../lib/intro_tracks'
import { useIntroDebugStore, NOTHING_HIDDEN } from '../store/intro_debug_store'
import { stepSpring, type Spring2D } from '../lib/black_hole_motion'
import { createSpeedDial, turnSpeedDial, wheelPixels, SWIPE_GAIN } from '../lib/base_speed'
import { createFramePacer, pacedFrameMs } from '../lib/frame_pacing'
import { renderTitleSprite, waitForTitleFont, type TitleSprite, type TitleStyle } from '../lib/title_sprite'
import { createParticleBudget, updateParticleBudget } from '../lib/particle_budget'
import { clearRingEnergy, createRingEnergy, stepRingEnergy } from '../lib/ring_energy'

// The light front reaches the title about 0.85 s in; a face that is not ready by then is swapped in later
const TITLE_FONT_TIMEOUT_MS = 700

// rAF timestamps jitter; a frame this close to its slot still counts as on time
const FRAME_SLOT_TOLERANCE_MS = 1
const FPS_SAMPLE_MS = 500

// Device pixels drawn per frame are capped, so HiDPI and 4K screens stay within the GPU's means
const PIXEL_BUDGET = 4_500_000
const MAX_PIXEL_RATIO = 2

// A touch this close to the black hole drags it
const MIN_TOUCH_GRAB_RADIUS = 48
// With looping on, the debugger holds the finished intro this long before replaying it
const LOOP_HOLD_SECONDS = 1
const READOUT_INTERVAL_MS = 66

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
    let swipingTouch = -1
    let swipeY = 0
    const speedDial = createSpeedDial()
    let lastPointerType = 'mouse'
    const hole: Spring2D = { x: targetX, y: targetY, vx: 0, vy: 0 }

    // Loop timing
    let frameId = 0
    let lastFrameTime = -1
    let nextFrameSlot = 0
    let animationTime = 0
    let introTime = 0
    let fadeBacklog = 0
    const framePacer = createFramePacer()
    let fpsFrames = 0
    let fpsWindowStart = 0
    let lastReadoutTime = 0
    const initialDebug = useIntroDebugStore.getState()
    let handledRestart = initialDebug.restartRequest
    let handledStep = initialDebug.stepRequest

    const intro = createIntroFrame()

    const initialState = useParticleStore.getState()
    const particleBudget = createParticleBudget(initialState.numParticles)
    const ringEnergy = createRingEnergy()
    let ringWasFed = true
    const field = createParticleField()
    const instances = createInstanceData()
    const spawn: SpawnSettings = {
      palette: createPaletteSampler(initialState.colorPalette),
      farZ: initialState.farZ,
      speedVariance: initialState.speedVariance
    }
    setParticleCount(field, initialState.numParticles, spawn)

    const settings: StepSettings = {
      frameScale: 0,
      time: 0,
      speed: 0,
      width: 0,
      height: 0,
      focal: 1,
      holeX: NaN,
      holeY: NaN,
      holeRadius: 0,
      captureRadius: 0,
      ringEnergy,
      gravityReach: 0,
      holeDepth: 0,
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
      frameScale: 1,
      ringTexels: ringEnergy.texels,
      title: { alpha: 0, x: 0, y: 0, reveal: 1, dissolve: 0, drift: 0, glow: 0, flash: 0, cooling: 1, dust: 0 },
      composite: {
        time: 0,
        holeX: 0,
        holeY: 0,
        horizon: 0,
        einstein: 0,
        falloff: 2,
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
        gravityWaveRadius: 0,
        gravityWaveAmplitude: 0,
        gravityWaveWidth: 1,
        gravityWaveCycles: 5,
        backgroundStars: 0,
        starCell: 26,
        starDensity: 0,
        starFlare: 0,
        dustScale: 220,
        dustThreshold: 0.5,
        lightDustContrast: 1
      }
    }

    function readBackground () {
      const state = useParticleStore.getState()
      background[0] = state.backgroundR
      background[1] = state.backgroundG
      background[2] = state.backgroundB
      return background
    }

    // Replays the opening from its first frame with a fresh particle field
    function restartIntro () {
      const state = useParticleStore.getState()
      introTime = 0
      fadeBacklog = 0
      field.count = 0
      clearRingEnergy(ringEnergy)
      setParticleCount(field, particleBudget.active, spawn)
      hole.x = targetX = viewportWidth / 2
      hole.y = targetY = viewportHeight / 2
      hole.vx = 0
      hole.vy = 0
      renderer?.clearScene(readBackground())
      rebuildTitle()
      state.setIntroComplete(false)
    }

    function readTitleStyle (): TitleStyle {
      const { title, params } = useIntroDebugStore.getState()
      return { ...title, weight: params.titleWeight, tracking: params.titleTracking, size: params.titleSize }
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

      // Intro debugger: playback rate, seeking, single steps and hidden layers apply while it is open
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
      const playbackRate = !debugging || stepping ? 1 : debug.playing ? debug.timeScale : 0
      const motionMs = pacedFrameMs(framePacer, elapsedMs)
      const frameScale = stepping ? 1 : toFrameScale(motionMs) * playbackRate
      const dt = frameScale / REFERENCE_FPS
      const hidden = debugging ? debug.hidden : NOTHING_HIDDEN

      animationTime += dt
      introTime += dt
      if (debugging && debug.loop && introTime >= introDuration + LOOP_HOLD_SECONDS) restartIntro()

      sampleIntro(introTime, reducedMotion, params, intro)
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
      if (hidden.gravityWave) intro.gravityWaveAmplitude = 0
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

      if (particleBudget.active !== field.count) {
        setParticleCount(field, particleBudget.active, spawn)
      }
      ensureInstanceCapacity(instances, field.capacity)

      // The black hole: born at the center, then pulled toward its target on a spring
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      const shortSide = Math.min(viewportWidth, viewportHeight)
      const halfDiagonal = Math.hypot(centerX, centerY)
      const explosionReach = halfDiagonal * 1.15
      // The visible size and the radius of no return are set apart; both grow as the horizon forms
      const holeGrowth = hidden.hole ? 0 : intro.holeScale
      const horizon = state.blackHoleSize / 100 * shortSide * holeGrowth * (1 + ringdown)
      const captureRadius = state.eventHorizon / 100 * shortSide * holeGrowth
      if (intro.holdAtCenter) {
        stepSpring(hole, centerX, centerY, dt, params.centerHoldFrequency)
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
      settings.holeX = hole.x
      settings.holeY = hole.y
      settings.holeRadius = horizon
      settings.captureRadius = captureRadius
      // With the feed off the simulation stops collecting light, and old light does not return later
      const ringFed = state.ringEnabled && state.ringFeedEnabled
      if (ringWasFed && !ringFed) clearRingEnergy(ringEnergy)
      ringWasFed = ringFed
      settings.ringEnergy = ringFed ? ringEnergy : null
      settings.gravityReach = horizon * state.gravityReach
      settings.holeDepth = state.farZ * 0.3
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
      settings.revealFeather = params.revealFeather
      settings.opacityScale = intro.opacityScale

      // A frozen frame keeps the scene texture; only the composite (lens, flash, title) is redrawn
      frame.updateScene = frameScale > 0
      if (frame.updateScene) {
        frame.frameScale = frameScale
        const simStart = performance.now()
        frame.instanceCount = stepParticles(field, settings, spawn, instances)
        if (ringFed) stepRingEnergy(ringEnergy, dt, state.ringAfterglow, reducedMotion ? 0 : state.ringFlowSpeed)
        frame.instances = instances.floats
        const active = updateParticleBudget(
          particleBudget, state.numParticles, performance.now() - simStart, elapsedMs, now, state.adaptiveParticles
        )
        if (active !== state.activeParticles) state.setActiveParticles(active)
      }
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
      title.x = centerX
      title.y = centerY + params.titleOffset * shortSide
      title.reveal = intro.titleReveal
      title.dissolve = intro.titleDissolve
      title.drift = params.titleDrift
      title.glow = params.titleGlow
      title.flash = params.titleFlash
      title.cooling = params.titleCooling
      title.dust = params.titleDust

      const composite = frame.composite
      composite.time = animationTime
      composite.holeX = hole.x
      composite.holeY = hole.y
      composite.horizon = horizon
      composite.einstein = state.lensingEnabled && !hidden.lens ? horizon * state.lensingRadius * intro.lensScale : 0
      composite.falloff = state.lensingFalloff
      composite.swirl = state.lensingRotation
      composite.absorption = state.lensingAbsorption
      composite.ring = hidden.ring || !state.ringEnabled ? 0 : state.ringBrightness * ringPower
      composite.ringWidth = state.ringWidth
      composite.ringDoppler = state.ringDoppler
      composite.ringSide = state.ringSide
      composite.ringPhase = ringEnergy.phase
      composite.ringBase = ringFed ? state.ringBase : 1
      composite.ringFeed = ringFed ? state.ringFeed : 0
      composite.centerX = centerX
      composite.centerY = centerY
      composite.starGlow = intro.starGlow
      composite.starRadius = intro.starRadius * shortSide
      composite.sourcePower = intro.sourcePower
      composite.glareRadius = params.glareRadius * shortSide
      composite.exposure = intro.exposure
      composite.lightRadius = intro.lightFront * explosionReach
      composite.lightWidth = params.lightWidth * shortSide
      composite.lightPower = intro.lightPower
      composite.lightSpeed = explosionReach / params.lightCrossTime
      composite.lightDustContrast = params.lightDustContrast
      composite.echoPower = intro.echoPower
      composite.echoDecay = params.echoDecay
      composite.dustScale = params.dustScale
      composite.dustThreshold = params.dustThreshold
      composite.waveRadius = intro.matterFront * explosionReach
      composite.waveStrength = intro.waveStrength * params.waveRefraction
      composite.waveWidth = params.waveWidth * shortSide
      composite.remnantGlow = intro.remnantGlow
      composite.remnantRedshift = intro.remnantRedshift
      composite.remnantRadius = params.remnantRadius * shortSide
      composite.gravityWaveRadius = intro.gravityWaveFront * explosionReach
      composite.gravityWaveAmplitude = intro.gravityWaveAmplitude * params.gravityWaveAmplitude
      composite.gravityWaveWidth = params.gravityWaveWidth * shortSide
      composite.gravityWaveCycles = params.gravityWaveCycles
      composite.backgroundStars = intro.backgroundStars * state.starsBrightness
      composite.starCell = state.starCell
      composite.starDensity = state.starDensity
      composite.starFlare = params.starFlare

      renderer.render(frame)

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

    // Over the debugger dock the cursor is working the timeline, not steering the black hole
    const handleMouseMove = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-intro-dock]')) return
      if (lastPointerType === 'mouse' && useParticleStore.getState().blackHoleFollowing) {
        targetX = event.clientX
        targetY = event.clientY
      }
    }

    // Click anchors the black hole where it is, or sets it following again from the click point
    const handleClick = (event: MouseEvent) => {
      if (lastPointerType !== 'mouse') return
      const state = useParticleStore.getState()
      const wasFollowing = state.blackHoleFollowing
      state.toggleBlackHoleFollowing()
      if (wasFollowing) {
        targetX = hole.x
        targetY = hole.y
      } else {
        targetX = event.clientX
        targetY = event.clientY
      }
    }

    // The store is written only when the setting moves by a whole step
    const changeBaseSpeed = (pixels: number) => {
      const state = useParticleStore.getState()
      const baseSpeed = turnSpeedDial(speedDial, state.baseSpeed, pixels)
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
        if (touch.identifier === draggingTouch) draggingTouch = -1
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
    window.addEventListener('resize', scheduleViewportSize)
    canvas.addEventListener('click', handleClick)
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
      window.removeEventListener('resize', scheduleViewportSize)
      canvas.removeEventListener('click', handleClick)
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
