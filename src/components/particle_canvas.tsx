import { useEffect, useRef, useState } from 'react'
import { useParticleStore } from '../store/particle_store'
import { toFrameScale, REFERENCE_FPS } from '../lib/particle_simulation'
import { getRenderingContext } from '../lib/particle_renderer'
import { createScene, type Scene, type SceneInput } from '../lib/scene'
import { getIntroDuration } from '../lib/intro_timeline'
import { getIntroPhase } from '../lib/intro_tracks'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { createSpeedDial, turnSpeedDial, wheelPixels, SWIPE_GAIN } from '../lib/base_speed'
import { createFramePacer, pacedFrameMs } from '../lib/frame_pacing'
import type { TitleStyle } from '../lib/title_sprite'
import { createParticleBudget, updateParticleBudget } from '../lib/particle_budget'
import { randomSeed } from '../lib/random'

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

function getRenderScale (width: number, height: number) {
  const budgetScale = Math.sqrt(PIXEL_BUDGET / Math.max(width * height, 1))
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, budgetScale))
}

// The page's side of the scene (scene.ts): the animation loop and its clock, the frame rate cap, the
// particle budget, pointer and touch input, and what the loop publishes to the stores
function ParticleCanvas () {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const initialState = useParticleStore.getState()
    const initialDebug = useIntroDebugStore.getState()
    const particleBudget = createParticleBudget(initialState.numParticles)
    // What the scene draws a frame from: the stores as they are, read again for every frame
    const input: SceneInput = {
      settings: initialState,
      params: initialDebug.params,
      hidden: initialDebug.hidden,
      reducedMotion: motionQuery.matches,
      particleCount: particleBudget.active
    }

    const gl = getRenderingContext(canvas)
    const created = gl ? createScene(gl, randomSeed(), input) : null
    if (!created) {
      setUnsupported(true)
      return
    }
    const scene: Scene = created
    const { hole, pointer } = scene

    let disposed = false
    let resizeFrameId = 0

    // Interaction state lives here, not in the store: nothing else renders it
    let draggingTouch = -1
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

    // Loop timing
    let frameId = 0
    let lastFrameTime = -1
    let nextFrameSlot = 0
    // Playback speed with the debugger closed: the debugger's speed during the intro, 1 after it
    let closedRate = initialDebug.timeScale
    const framePacer = createFramePacer()
    let fpsFrames = 0
    let fpsWindowStart = 0
    let lastReadoutTime = 0
    let handledRestart = initialDebug.restartRequest
    let handledStep = initialDebug.stepRequest

    function readInput () {
      const debug = useIntroDebugStore.getState()
      input.settings = useParticleStore.getState()
      input.params = debug.params
      input.hidden = debug.hidden
      input.particleCount = particleBudget.active
      return input
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

    function rebuildTitle (force = false) {
      void scene.setTitle(readTitleStyle(), TITLE_FONT_TIMEOUT_MS, force)
    }

    // Replays the opening from its first frame with a fresh particle field
    function restartIntro () {
      scene.restart(readInput())
      rebuildTitle()
      useParticleStore.getState().setIntroComplete(false)
    }

    function applyViewportSize (force = false) {
      resizeFrameId = 0
      const width = window.innerWidth
      const height = window.innerHeight
      if (!scene.resize(width, height, getRenderScale(width, height), readInput(), force)) return
      // Resizing clears the canvas; while the loop is idle, show the background right away
      if (!frameId) scene.drawIdle()
    }

    function scheduleViewportSize () {
      if (!resizeFrameId) resizeFrameId = requestAnimationFrame(() => applyViewportSize())
    }

    function shouldAnimate () {
      return scene.ready() && !useParticleStore.getState().isPaused && !document.hidden
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
      if (!scene.ready()) return

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
      const introDuration = getIntroDuration(input.reducedMotion, params)
      if (debug.restartRequest !== handledRestart) {
        handledRestart = debug.restartRequest
        restartIntro()
      }
      if (debug.seekRequest !== null) {
        scene.introTime = Math.min(Math.max(debug.seekRequest, 0), introDuration)
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
        const targetRate = scene.introTime < introDuration ? debug.timeScale : 1
        closedRate += (targetRate - closedRate) * Math.min(motionMs / SPEED_RETURN_MS, 1)
      }
      const playbackRate = stepping ? 1 : debugging ? (debug.playing ? debug.timeScale : 0) : closedRate
      const frameScale = stepping ? 1 : toFrameScale(motionMs) * playbackRate
      const dt = frameScale / REFERENCE_FPS
      if (debugging && debug.loop && scene.introTime + dt >= introDuration + LOOP_HOLD_SECONDS) restartIntro()

      scene.advance(frameScale, dt, readInput())

      const intro = scene.intro
      if (intro.done && !state.introComplete) state.setIntroComplete(true)
      // Only the debugger's timeline reads how the horizon rings, so it is published only while the
      // debugger is open
      const ringTiming = scene.ringTiming
      const shownRing = debug.ringTiming
      if (debugging && (Math.abs(shownRing.frequency - ringTiming.frequency) > ringTiming.frequency * 1e-3 ||
        Math.abs(shownRing.decay - ringTiming.decay) > ringTiming.decay * 1e-3)) debug.setRingTiming(ringTiming)
      if (scene.frame.updateScene) {
        const active = updateParticleBudget(
          particleBudget, state.numParticles, scene.simulationMs, elapsedMs, now, state.adaptiveParticles
        )
        if (active !== state.activeParticles) state.setActiveParticles(active)
      }

      if (debugging && now - lastReadoutTime >= READOUT_INTERVAL_MS) {
        lastReadoutTime = now
        debug.setReadout({
          time: scene.introTime,
          duration: introDuration,
          phase: getIntroPhase(scene.introTime, input.reducedMotion, params),
          sourcePower: intro.sourcePower,
          lightFront: intro.lightFront,
          matterFront: intro.matterFront,
          remnantRedshift: intro.remnantRedshift,
          holeScale: intro.holeScale,
          ringdown: scene.ringdown,
          titleAlpha: scene.frame.title.alpha,
          speed: scene.speed,
          particlesDrawn: scene.frame.instanceCount
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
      if (useParticleStore.getState().blackHoleFollowing || scene.frame.composite.horizon <= 0) return false
      const grabRadius = Math.max(scene.frame.composite.horizon * MOUSE_GRAB_SHADOWS, MIN_MOUSE_GRAB_RADIUS)
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
      pointer.x = Math.min(Math.max(event.clientX + grabOffsetX, 0), scene.width)
      pointer.y = Math.min(Math.max(event.clientY + grabOffsetY, 0), scene.height)
    }

    // Over the debugger dock the cursor is working the timeline, not steering the black hole
    const handleMouseMove = (event: MouseEvent) => {
      if (mouseGrabbed && !mouseDragging && Math.hypot(event.clientX - pressX, event.clientY - pressY) > MOUSE_DRAG_THRESHOLD) {
        mouseDragging = true
        pointer.holding = true
        setCanvasCursor('grabbing')
      }
      if (mouseDragging) {
        carryHole(event)
        return
      }
      if (event.target instanceof Element && event.target.closest('[data-intro-dock]')) return
      if (lastPointerType !== 'mouse') return
      if (useParticleStore.getState().blackHoleFollowing) {
        pointer.x = event.clientX
        pointer.y = event.clientY
      }
      if (event.target === canvas) showHoverCursor(event.clientX, event.clientY)
      else setCanvasCursor('')
    }

    // The black hole stays where it was dropped, anchored, and the place is saved with the settings
    const dropHole = () => {
      mouseGrabbed = false
      if (!mouseDragging) return
      mouseDragging = false
      pointer.holding = false
      swallowClick = true
      if (scene.width > 0 && scene.height > 0) {
        useParticleStore.getState().anchorBlackHoleAt(pointer.x / scene.width, pointer.y / scene.height)
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
        pointer.x = hole.x
        pointer.y = hole.y
        // The place it was anchored at is saved with the settings
        if (scene.width > 0 && scene.height > 0) state.setBlackHolePosition(hole.x / scene.width, hole.y / scene.height)
      } else {
        pointer.x = event.clientX
        pointer.y = event.clientY
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
      const grabRadius = Math.max(scene.frame.composite.horizon * 2.2, MIN_TOUCH_GRAB_RADIUS)
      if (Math.hypot(touch.clientX - hole.x, touch.clientY - hole.y) > grabRadius) {
        if (swipingTouch === -1) {
          swipingTouch = touch.identifier
          swipeY = touch.clientY
        }
        return
      }
      draggingTouch = touch.identifier
      pointer.holding = true
      pointer.x = touch.clientX
      pointer.y = touch.clientY
      event.preventDefault()
    }

    const handleTouchMove = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === swipingTouch) {
          changeBaseSpeed((swipeY - touch.clientY) * SWIPE_GAIN)
          swipeY = touch.clientY
        }
        if (touch.identifier !== draggingTouch) continue
        pointer.x = touch.clientX
        pointer.y = touch.clientY
        event.preventDefault()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === draggingTouch) {
          draggingTouch = -1
          pointer.holding = mouseDragging
          // Where the finger left the black hole is saved with the settings
          if (scene.width > 0 && scene.height > 0) {
            useParticleStore.getState().setBlackHolePosition(pointer.x / scene.width, pointer.y / scene.height)
          }
        }
        if (touch.identifier === swipingTouch) swipingTouch = -1
      }
    }

    const handleMotionChange = () => {
      input.reducedMotion = motionQuery.matches
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      scene.loseContext()
      syncLoop()
    }

    const handleContextRestored = () => {
      scene.restoreContext(readInput())
      syncLoop()
    }

    applyViewportSize(true)
    rebuildTitle()
    scene.placeHole(readInput())

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
      scene.dispose()
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full touch-pinch-zoom" aria-hidden="true" />
      {unsupported && (
        <div role="alert" className="fixed inset-0 flex items-center justify-center p-8 text-center font-mono text-sm text-text-light">
          This experience needs WebGL 2. Turn on hardware acceleration in your browser settings, or open the page in an up-to-date browser.
        </div>
      )}
    </>
  )
}

export default ParticleCanvas
