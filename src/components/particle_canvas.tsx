import { useEffect, useRef, useState } from 'react'
import { useParticleStore } from '../store/particle_store'
import { subscribeScrollProgress } from '../hooks/use_scroll_progress'
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
import { createIntroFrame, sampleIntro } from '../lib/intro_timeline'
import {
  createScrollJourney,
  stepScrollJourney,
  stepSpring,
  type JourneyFrame,
  type Spring2D
} from '../lib/black_hole_motion'
import { renderTitleSprite, waitForTitleFont, type TitleSprite } from '../lib/title_sprite'

const TITLE_TEXT = 'EXPERIENCE THE SPEED OF LIGHT'

// rAF timestamps jitter; a frame this close to its slot still counts as on time
const FRAME_SLOT_TOLERANCE_MS = 1
const FPS_SAMPLE_MS = 500

// Device pixels drawn per frame are capped, so HiDPI and 4K screens stay within the GPU's means
const PIXEL_BUDGET = 4_500_000
const MAX_PIXEL_RATIO = 2

const HOLE_FOLLOW_FREQUENCY = 6
const SCROLL_SPEED_GAIN = 10
const REDUCED_SCROLL_SPEED_GAIN = 2
const SHOCKWAVE_REFRACTION = 24
// A touch this close to the black hole drags it instead of scrolling the page
const MIN_TOUCH_GRAB_RADIUS = 48

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

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionQuery.matches

    // Interaction state lives here, not in the store: nothing else renders it
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let scrollProgress = 0
    let draggingTouch = -1
    let lastPointerType = 'mouse'
    const hole: Spring2D = { x: targetX, y: targetY, vx: 0, vy: 0 }

    // Loop timing
    let frameId = 0
    let lastFrameTime = -1
    let nextFrameSlot = 0
    let animationTime = 0
    let introTime = 0
    let fadeBacklog = 0
    let fpsFrames = 0
    let fpsWindowStart = 0

    const intro = createIntroFrame()
    const journey = createScrollJourney()
    const journeyFrame: JourneyFrame = { progress: 0, flash: 0, approach: 1 }

    const initialState = useParticleStore.getState()
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
      fadeAlpha: 0,
      instances: instances.floats,
      instanceCount: 0,
      doppler: 0,
      title: { alpha: 0, x: 0, y: 0, scale: 1, rotation: 0 },
      composite: {
        holeX: 0,
        holeY: 0,
        horizon: 0,
        einstein: 0,
        falloff: 2,
        swirl: 0,
        absorption: 0,
        ring: 0,
        time: 0,
        starGlow: 0,
        starRadius: 0,
        waveRadius: 0,
        waveStrength: 0,
        waveWidth: 1,
        flash: 0
      }
    }

    function readBackground () {
      const state = useParticleStore.getState()
      background[0] = state.backgroundR
      background[1] = state.backgroundG
      background[2] = state.backgroundB
      return background
    }

    function refreshTitleSprite () {
      if (!renderer || intro.done || !titleSprite) return
      titleSprite = renderTitleSprite(TITLE_TEXT, viewportWidth, pixelRatio)
      renderer.setTitle(titleSprite)
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
      refreshTitleSprite()

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
      const frameScale = toFrameScale(elapsedMs)
      const dt = frameScale / REFERENCE_FPS
      animationTime += dt
      introTime += dt
      reportFps(now)

      sampleIntro(introTime, reducedMotion, intro)
      if (intro.done && !state.introComplete) state.setIntroComplete(true)

      stepScrollJourney(journey, scrollProgress, animationTime, dt, journeyFrame)
      if (journey.crossed !== state.horizonCrossed) state.setHorizonCrossed(journey.crossed)

      if (state.colorPalette !== spawn.palette.source) {
        spawn.palette = createPaletteSampler(state.colorPalette)
      }
      spawn.farZ = state.farZ
      spawn.speedVariance = state.speedVariance

      if (state.numParticles !== field.count) {
        setParticleCount(field, state.numParticles, spawn)
      }
      ensureInstanceCapacity(instances, field.capacity)

      // The black hole: born at the center, then pulled toward its target on a spring
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      const shortSide = Math.min(viewportWidth, viewportHeight)
      const halfDiagonal = Math.hypot(centerX, centerY)
      const horizon = state.eventHorizon / 100 * shortSide * intro.holeScale * journeyFrame.approach
      if (intro.holdAtCenter) {
        stepSpring(hole, centerX, centerY, dt, HOLE_FOLLOW_FREQUENCY * 2)
      } else {
        stepSpring(hole, targetX, targetY, dt, HOLE_FOLLOW_FREQUENCY)
      }

      const scrollGain = reducedMotion ? REDUCED_SCROLL_SPEED_GAIN : SCROLL_SPEED_GAIN
      const speed = (state.baseSpeed + journeyFrame.progress * scrollGain) * intro.speedBoost
      const shockwaveRadius = halfDiagonal * 1.15 * intro.wave

      settings.frameScale = frameScale
      settings.time = animationTime
      settings.speed = speed
      settings.width = viewportWidth
      settings.height = viewportHeight
      settings.focal = Math.max(centerX, centerY)
      settings.holeX = hole.x
      settings.holeY = hole.y
      settings.holeRadius = horizon
      settings.gravityReach = horizon * state.gravityReach
      settings.holeDepth = state.farZ * 0.3
      settings.gravityStrength = state.gravityStrength
      settings.orbitalStrength = state.orbitalStrength
      settings.farZ = state.farZ
      settings.depthFade = state.depthFade
      settings.pulseSpeedMultiplier = state.pulseSpeedMultiplier
      settings.pulseIntensity = state.pulseIntensity
      settings.baseBrightness = state.baseBrightness
      settings.minOpacity = state.minOpacity
      settings.maxOpacity = state.maxOpacity
      settings.revealRadius = intro.reveal >= 1 ? Infinity : halfDiagonal * 1.15 * intro.reveal
      settings.opacityScale = intro.opacityScale

      frame.instanceCount = stepParticles(field, settings, spawn, instances)
      frame.instances = instances.floats
      frame.doppler = Math.min(Math.max((speed - 2) / 10, 0), 1) * (reducedMotion ? 0.5 : 1)
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
      title.x = hole.x
      title.y = hole.y
      title.scale = intro.titleScale
      title.rotation = intro.titleSpin

      const composite = frame.composite
      composite.holeX = hole.x
      composite.holeY = hole.y
      composite.horizon = horizon
      composite.einstein = state.lensingEnabled ? horizon * state.lensingRadius : 0
      composite.falloff = state.lensingFalloff
      composite.swirl = state.lensingRotation
      composite.absorption = state.lensingAbsorption
      composite.ring = 0.9
      composite.time = animationTime
      composite.starGlow = intro.starGlow
      composite.starRadius = intro.starRadius * shortSide
      composite.waveRadius = shockwaveRadius
      composite.waveStrength = intro.waveStrength * SHOCKWAVE_REFRACTION
      composite.waveWidth = shortSide * 0.06
      composite.flash = Math.max(intro.flash, reducedMotion ? 0 : journeyFrame.flash * 0.85)

      renderer.render(frame)
    }

    const handlePointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType
    }

    const handleMouseMove = (event: MouseEvent) => {
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

    // On touch screens the black hole is dragged; swipes anywhere else scroll the page
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!touch || draggingTouch !== -1) return
      const grabRadius = Math.max(frame.composite.horizon * 2.2, MIN_TOUCH_GRAB_RADIUS)
      if (Math.hypot(touch.clientX - hole.x, touch.clientY - hole.y) > grabRadius) return
      draggingTouch = touch.identifier
      targetX = touch.clientX
      targetY = touch.clientY
      event.preventDefault()
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (draggingTouch === -1) return
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== draggingTouch) continue
        targetX = touch.clientX
        targetY = touch.clientY
        event.preventDefault()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === draggingTouch) draggingTouch = -1
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

    // The title appears 1.7 s in; waiting longer than that for the font would leave a gap
    waitForTitleFont(1400).then(() => {
      if (disposed || !renderer || intro.done) return
      titleSprite = renderTitleSprite(TITLE_TEXT, viewportWidth, pixelRatio)
      renderer.setTitle(titleSprite)
    })

    const unsubscribeStore = useParticleStore.subscribe(syncLoop)
    const unsubscribeScroll = subscribeScrollProgress((progress) => {
      scrollProgress = progress
    })

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', scheduleViewportSize)
    canvas.addEventListener('click', handleClick)
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
      unsubscribeScroll()
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', scheduleViewportSize)
      canvas.removeEventListener('click', handleClick)
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
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full" aria-hidden="true" />
      {unsupported && (
        <div role="alert" className="fixed inset-0 flex items-center justify-center p-8 text-center font-mono text-sm text-text-light">
          This experience needs WebGL. Turn on hardware acceleration in your browser settings or open the page in another browser.
        </div>
      )}
    </>
  )
}

export default ParticleCanvas
