import { useEffect, useRef } from 'react'
import { useParticleStore } from '../store/particle_store'
import { useScrollProgress } from '../hooks/use_scroll_progress'

function ParticleCanvas () {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const storeRef = useRef(useParticleStore.getState())
  
  // Use scroll progress hook to update particle store
  useScrollProgress({
    onScroll: (progress) => {
      useParticleStore.getState().setScrollSpeed(progress * 0.1)
    }
  })
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Track if animation has been started
    let hasAnimationStarted = false

    // Subscribe to store changes
    const unsubscribe = useParticleStore.subscribe((state) => {
      storeRef.current = state
      
      // Start animation when isAnimationStarted becomes true
      if (state.isAnimationStarted && !hasAnimationStarted) {
        hasAnimationStarted = true
        animateParticles(performance.now())
      }
    })

    // Canvas sizing
    let canvasWidth = canvas.width = window.innerWidth
    let canvasHeight = canvas.height = window.innerHeight
    let halfW = canvasWidth * 0.5
    let halfH = canvasHeight * 0.5

    const FAR_Z = 5000
    let animationTime = 0
    let lastFrameTime = performance.now()
    let NUM_PARTICLES = storeRef.current.numParticles
    let prevNumParticles = NUM_PARTICLES

    // Particle state
    let px: Float32Array
    let py: Float32Array
    let pz: Float32Array
    let prevPX: Float32Array
    let prevPY: Float32Array
    let pColor: any[]
    let pAlpha: Float32Array
    let pPulsePhase: Float32Array
    let pPulseSpeed: Float32Array

    ctx.lineCap = 'round'

    function randSpan2000 () {
      return (Math.random() - 0.5) * 2000
    }

    function getActiveColors () {
      return storeRef.current.colorPalette.filter(c => c.enabled)
    }

    function getRandomWeightedColor () {
      const activeColors = getActiveColors()
      if (activeColors.length === 0) return { r: 255, g: 255, b: 255 }
      
      const totalWeight = activeColors.reduce((sum, color) => sum + color.percent, 0)
      let random = Math.random() * totalWeight
      
      for (let i = 0; i < activeColors.length; i++) {
        random -= activeColors[i].percent
        if (random <= 0) {
          return activeColors[i]
        }
      }
      
      return activeColors[activeColors.length - 1]
    }

    function setParticleProperties (i: number, z: number) {
      const x = randSpan2000()
      const y = randSpan2000()

      px[i] = x
      py[i] = y
      pz[i] = z

      pColor[i] = getRandomWeightedColor()
      pAlpha[i] = 0.3 + Math.random() * 0.7
      pPulsePhase[i] = Math.random() * Math.PI * 2
      pPulseSpeed[i] = 0.5 + Math.random() * 1.5

      prevPX[i] = (x / z) * halfW + halfW
      prevPY[i] = (y / z) * halfH + halfH
    }

    function initParticles () {
      NUM_PARTICLES = storeRef.current.numParticles
      px = new Float32Array(NUM_PARTICLES)
      py = new Float32Array(NUM_PARTICLES)
      pz = new Float32Array(NUM_PARTICLES)
      prevPX = new Float32Array(NUM_PARTICLES)
      prevPY = new Float32Array(NUM_PARTICLES)
      pColor = new Array(NUM_PARTICLES)
      pAlpha = new Float32Array(NUM_PARTICLES)
      pPulsePhase = new Float32Array(NUM_PARTICLES)
      pPulseSpeed = new Float32Array(NUM_PARTICLES)

      for (let i = 0; i < NUM_PARTICLES; i++) {
        setParticleProperties(i, Math.random() * FAR_Z)
      }
    }

    function resetParticle (i: number) {
      setParticleProperties(i, FAR_Z)
    }

    function animateParticles (currentTime: number) {
      if (!ctx) return
      
      const deltaTime = (currentTime - lastFrameTime) / 1000 // Convert to seconds
      lastFrameTime = currentTime
      animationTime += deltaTime
      
      const state = storeRef.current
      
      // Check if particle count changed and reinitialize if needed
      if (state.numParticles !== prevNumParticles) {
        prevNumParticles = state.numParticles
        initParticles()
      }
      
      const speed = state.baseSpeed + state.scrollSpeed * 100
      const speedFactor = Math.min(speed / 20, 1)
      const trailIntensity = 0.05 + (1 - speedFactor) * 0.15
      
      ctx.globalAlpha = 1
      ctx.fillStyle = `rgba(${state.backgroundR}, ${state.backgroundG}, ${state.backgroundB}, ${trailIntensity})`
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      const halfWLocal = halfW
      const halfHLocal = halfH
      const localMouseX = state.mouseX
      const localMouseY = state.mouseY
      const mouseRadiusSq = state.mouseRadius * state.mouseRadius
      const rSq = mouseRadiusSq

      for (let i = 0; i < NUM_PARTICLES; i++) {
        const startX = (px[i] / pz[i]) * halfWLocal + halfWLocal
        const startY = (py[i] / pz[i]) * halfHLocal + halfHLocal
        prevPX[i] = startX
        prevPY[i] = startY

        let z = pz[i] - speed
        if (z <= 0) {
          resetParticle(i)
          continue
        }

        let endX = (px[i] / z) * halfWLocal + halfWLocal
        let endY = (py[i] / z) * halfHLocal + halfHLocal

        if (localMouseX === localMouseX && localMouseY === localMouseY) {
          const dx = localMouseX - endX
          const dy = localMouseY - endY
          const distSq = dx * dx + dy * dy

          if (distSq < rSq && distSq > 0.0001) {
            const distance = Math.sqrt(distSq)
            
            if (distance < state.eventHorizon) {
              resetParticle(i)
              continue
            }

            const gravityForce = state.gravityStrength / (distSq * 0.01)
            const invDistance = 1 / distance
            const closeFactor = 1 - z / FAR_Z

            const attractX = dx * invDistance * gravityForce * closeFactor
            const attractY = dy * invDistance * gravityForce * closeFactor

            const tangentX = -dy * invDistance * gravityForce * state.orbitalStrength * closeFactor
            const tangentY = dx * invDistance * gravityForce * state.orbitalStrength * closeFactor

            px[i] += attractX + tangentX
            py[i] += attractY + tangentY

            const warpFactor = (1 - distance / state.mouseRadius) * 0.5
            const warpAngle = Math.atan2(dy, dx)
            px[i] += Math.cos(warpAngle) * warpFactor * closeFactor * 20
            py[i] += Math.sin(warpAngle) * warpFactor * closeFactor * 20

            endX = (px[i] / z) * halfWLocal + halfWLocal
            endY = (py[i] / z) * halfHLocal + halfHLocal
          }
        }

        pz[i] = z

        const depthFactor = 1 - z / FAR_Z
        const size = Math.max(0.3, depthFactor * 3)
        const distanceFactor = z / FAR_Z
        const pulseValue = Math.sin(animationTime * pPulseSpeed[i] + pPulsePhase[i])
        const pulseFactor = 1 + (pulseValue * state.pulseIntensity * distanceFactor)
        
        let opacity = depthFactor * pAlpha[i] * pulseFactor
        opacity = Math.max(0.05, Math.min(1, opacity))

        const color = pColor[i]
        ctx.globalAlpha = opacity
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`
        ctx.lineWidth = size
        ctx.beginPath()
        ctx.moveTo(prevPX[i], prevPY[i])
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      animationFrameRef.current = requestAnimationFrame(animateParticles)
    }

    initParticles()

    const handleMouseMove = (event: MouseEvent) => {
      if (storeRef.current.blackHoleAttached) {
        useParticleStore.getState().setMousePosition(event.clientX, event.clientY)
      }
    }

    const handleMouseOut = () => {
      if (storeRef.current.blackHoleAttached) {
        useParticleStore.getState().setMousePosition(NaN, NaN)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const wasAttached = storeRef.current.blackHoleAttached
      useParticleStore.getState().toggleBlackHole()
      if (!wasAttached) {
        useParticleStore.getState().setMousePosition(event.clientX, event.clientY)
      }
    }

    const handleResize = () => {
      canvasWidth = canvas.width = window.innerWidth
      canvasHeight = canvas.height = window.innerHeight
      halfW = canvasWidth * 0.5
      halfH = canvasHeight * 0.5
      initParticles()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)
    canvas.addEventListener('click', handleClick)
    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribe()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      canvas.removeEventListener('click', handleClick)
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full" />
  )
}

export default ParticleCanvas

