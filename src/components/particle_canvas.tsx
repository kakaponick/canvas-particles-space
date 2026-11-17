import { useEffect, useRef } from 'react'
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

// rAF timestamps jitter; a frame this close to its slot still counts as on time
const FRAME_SLOT_TOLERANCE_MS = 1
const FPS_SAMPLE_MS = 500

function ParticleCanvas () {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = getRenderingContext(canvas)
    if (!gl) {
      console.warn('WebGL not supported, particles will not render')
      return
    }

    let renderer: ParticleRenderer | null = createParticleRenderer(gl)
    let viewportWidth = 0
    let viewportHeight = 0
    let resizeFrameId = 0

    // Interaction state lives here, not in the store: nothing else renders it
    let mouseX = NaN
    let mouseY = NaN
    let scrollProgress = 0

    // Loop timing
    let frameId = 0
    let lastFrameTime = -1
    let nextFrameSlot = 0
    let animationTime = 0
    let fadeBacklog = 0
    let fpsFrames = 0
    let fpsWindowStart = 0

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
      mouseX: NaN,
      mouseY: NaN,
      mouseRadius: 0,
      eventHorizon: 0,
      gravityStrength: 0,
      orbitalStrength: 0,
      farZ: 1,
      depthFade: 0,
      pulseSpeedMultiplier: 0,
      pulseIntensity: 0,
      baseBrightness: 0,
      minOpacity: 0,
      maxOpacity: 0
    }

    const background: [number, number, number] = [0, 0, 0]
    const frame: FrameInput = {
      background,
      fadeAlpha: 0,
      instances: instances.floats,
      instanceCount: 0,
      lensing: {
        enabled: false,
        mouseX: NaN,
        mouseY: NaN,
        mass: 0,
        eventHorizon: 0,
        rotation: 0,
        falloff: 0,
        absorption: 0
      }
    }

    function readBackground () {
      const state = useParticleStore.getState()
      background[0] = state.backgroundR
      background[1] = state.backgroundG
      background[2] = state.backgroundB
      return background
    }

    // World coordinates do not depend on the viewport, so a resize only reallocates GPU buffers
    function applyViewportSize (force = false) {
      resizeFrameId = 0
      const width = window.innerWidth
      const height = window.innerHeight
      if (!renderer || (!force && width === viewportWidth && height === viewportHeight)) return

      viewportWidth = width
      viewportHeight = height
      renderer.resize(width, height, readBackground())

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
      const state = useParticleStore.getState()
      return renderer !== null && state.isAnimationStarted && !state.isPaused && !document.hidden
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
      animationTime += frameScale / REFERENCE_FPS
      reportFps(now)

      if (state.colorPalette !== spawn.palette.source) {
        spawn.palette = createPaletteSampler(state.colorPalette)
      }
      spawn.farZ = state.farZ
      spawn.speedVariance = state.speedVariance

      if (state.numParticles !== field.count) {
        setParticleCount(field, state.numParticles, spawn)
      }
      ensureInstanceCapacity(instances, field.capacity)

      settings.frameScale = frameScale
      settings.time = animationTime
      settings.speed = state.baseSpeed + scrollProgress * 10
      settings.width = viewportWidth
      settings.height = viewportHeight
      settings.mouseX = mouseX
      settings.mouseY = mouseY
      settings.mouseRadius = state.mouseRadius
      settings.eventHorizon = state.eventHorizon
      settings.gravityStrength = state.gravityStrength
      settings.orbitalStrength = state.orbitalStrength
      settings.farZ = state.farZ
      settings.depthFade = state.depthFade
      settings.pulseSpeedMultiplier = state.pulseSpeedMultiplier
      settings.pulseIntensity = state.pulseIntensity
      settings.baseBrightness = state.baseBrightness
      settings.minOpacity = state.minOpacity
      settings.maxOpacity = state.maxOpacity

      frame.instanceCount = stepParticles(field, settings, spawn, instances)
      frame.instances = instances.floats
      readBackground()
      // The 8-bit scene texture rounds away fades smaller than half a step, so on fast displays
      // a per-frame fade would leave a grey haze. Fading in whole 60 Hz steps keeps the trail
      // identical at any frame rate.
      fadeBacklog += frameScale
      const fadeSteps = Math.floor(fadeBacklog)
      fadeBacklog -= fadeSteps
      frame.fadeAlpha = fadeSteps > 0 ? 1 - Math.pow(1 - state.trailIntensity, fadeSteps) : 0

      const lensing = frame.lensing
      lensing.enabled = state.lensingEnabled
      lensing.mouseX = mouseX
      lensing.mouseY = mouseY
      lensing.mass = state.lensingMass
      lensing.eventHorizon = state.eventHorizon
      lensing.rotation = state.lensingRotation
      lensing.falloff = state.lensingFalloff
      lensing.absorption = state.lensingAbsorption

      renderer.render(frame)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (useParticleStore.getState().blackHoleFollowing) {
        mouseX = event.clientX
        mouseY = event.clientY
      }
    }

    // mouseout bubbles from every element; only leaving the window has no related target
    const handleMouseOut = (event: MouseEvent) => {
      if (!event.relatedTarget && useParticleStore.getState().blackHoleFollowing) {
        mouseX = NaN
        mouseY = NaN
      }
    }

    const handleClick = (event: MouseEvent) => {
      const state = useParticleStore.getState()
      const wasFollowing = state.blackHoleFollowing
      state.toggleBlackHoleFollowing()
      if (!wasFollowing) {
        mouseX = event.clientX
        mouseY = event.clientY
      }
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      renderer = null
      syncLoop()
    }

    const handleContextRestored = () => {
      renderer = createParticleRenderer(gl)
      applyViewportSize(true)
      syncLoop()
    }

    applyViewportSize(true)

    const unsubscribeStore = useParticleStore.subscribe(syncLoop)
    const unsubscribeScroll = subscribeScrollProgress((progress) => {
      scrollProgress = progress
    })

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('resize', scheduleViewportSize)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    document.addEventListener('visibilitychange', syncLoop)

    // The animation may have been started before this effect subscribed
    syncLoop()

    return () => {
      unsubscribeStore()
      unsubscribeScroll()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('resize', scheduleViewportSize)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      document.removeEventListener('visibilitychange', syncLoop)
      if (frameId) cancelAnimationFrame(frameId)
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
      renderer?.dispose()
      renderer = null
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full" />
  )
}

export default ParticleCanvas
