import { useEffect, useRef } from 'react'
import { useParticleStore } from '../store/particle_store'
import { useScrollProgress } from '../hooks/use_scroll_progress'
import {
  initWebGLProgram,
  setupGeometry,
  setupTexCoords,
  createTexture,
  type WebGLShaderProgram
} from '../lib/webgl_shaders'

function ParticleCanvas () {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)
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
    const webglCanvas = webglCanvasRef.current
    if (!canvas || !webglCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize WebGL
    const gl = (webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) {
      console.warn('WebGL not supported, lensing effects will be disabled')
    }

    let webglProgram: WebGLShaderProgram | null = null
    let webglTexture: WebGLTexture | null = null
    let webglStartTime = performance.now()

    if (gl) {
      webglProgram = initWebGLProgram(gl)
      if (webglProgram) {
        gl.useProgram(webglProgram.program)
        setupGeometry(gl, webglProgram.locations.position)
        setupTexCoords(gl, webglProgram.locations.texCoord)
        webglTexture = createTexture(gl)
        
        // Set initial uniforms
        gl.uniform2f(webglProgram.locations.resolution, webglCanvas.width, webglCanvas.height)
        gl.uniform1i(webglProgram.locations.image, 0)
      }
    }

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
    webglCanvas.width = canvasWidth
    webglCanvas.height = canvasHeight
    let halfW = canvasWidth * 0.5
    let halfH = canvasHeight * 0.5

    if (gl) {
      gl.viewport(0, 0, canvasWidth, canvasHeight)
      if (webglProgram) {
        gl.uniform2f(webglProgram.locations.resolution, canvasWidth, canvasHeight)
      }
    }

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
    let pSpeedMultiplier: Float32Array

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
      
      // Optimized speed variance: 99% normal, 1% extreme (up to 100x)
      const variance = storeRef.current.speedVariance
      const r = Math.random()
      pSpeedMultiplier[i] = 1 + variance * (2 + r * r * r * r * r * 98)

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
      pSpeedMultiplier = new Float32Array(NUM_PARTICLES)

      for (let i = 0; i < NUM_PARTICLES; i++) {
        setParticleProperties(i, Math.random() * storeRef.current.farZ)
      }
    }

    function resetParticle (i: number) {
      setParticleProperties(i, storeRef.current.farZ)
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
      
      ctx.globalAlpha = 1
      ctx.fillStyle = `rgba(${state.backgroundR}, ${state.backgroundG}, ${state.backgroundB}, ${state.trailIntensity})`
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

        // Apply per-particle speed multiplier
        let z = pz[i] - speed * pSpeedMultiplier[i]
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
            const closeFactor = 1 - z / state.farZ

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

        // Calculate depth factor with adjustable fade influence
        const rawDepthFactor = 1 - z / state.farZ
        const depthFactor = 1 - (1 - rawDepthFactor) * state.depthFade
        const size = Math.max(0.3, rawDepthFactor * 3)
        
        // Calculate pulse effect with adjustable speed
        const distanceFactor = z / state.farZ
        const pulseValue = Math.sin(animationTime * pPulseSpeed[i] * state.pulseSpeedMultiplier + pPulsePhase[i])
        const pulseFactor = 1 + (pulseValue * state.pulseIntensity * distanceFactor)
        
        // Calculate final opacity with all controls
        let opacity = depthFactor * pAlpha[i] * pulseFactor * state.baseBrightness
        opacity = Math.max(state.minOpacity, Math.min(state.maxOpacity, opacity))

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

      // Apply WebGL gravitational lensing effect
      if (gl && webglProgram && webglTexture && state.lensingEnabled && canvas) {
        const currentWebGLTime = (currentTime - webglStartTime) / 1000

        // Update texture from 2D canvas
        gl.bindTexture(gl.TEXTURE_2D, webglTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)

        // Update uniforms - use original mouse coordinates
        const mouseX = !isNaN(state.mouseX) ? state.mouseX : canvasWidth / 2
        const mouseY = !isNaN(state.mouseY) ? state.mouseY : canvasHeight / 2
        
        gl.uniform2f(webglProgram.locations.mouse, mouseX, mouseY)
        gl.uniform1f(webglProgram.locations.mass, state.lensingMass * 0.00001)
        gl.uniform1f(webglProgram.locations.time, currentWebGLTime)
        gl.uniform1f(webglProgram.locations.eventHorizon, state.eventHorizon)
        gl.uniform1f(webglProgram.locations.active, 1.0)

        // Draw the lensed scene
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      } else if (gl && webglProgram && webglTexture && canvas) {
        // If lensing is disabled, just pass through the original canvas
        gl.bindTexture(gl.TEXTURE_2D, webglTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
        
        gl.uniform1f(webglProgram.locations.active, 0.0)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }

      animationFrameRef.current = requestAnimationFrame(animateParticles)
    }

    initParticles()

    const handleMouseMove = (event: MouseEvent) => {
      if (storeRef.current.blackHoleFollowing) {
        useParticleStore.getState().setMousePosition(event.clientX, event.clientY)
      }
    }

    const handleMouseOut = () => {
      if (storeRef.current.blackHoleFollowing) {
        useParticleStore.getState().setMousePosition(NaN, NaN)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const wasFollowing = storeRef.current.blackHoleFollowing
      useParticleStore.getState().toggleBlackHoleFollowing()
      if (!wasFollowing) {
        useParticleStore.getState().setMousePosition(event.clientX, event.clientY)
      }
    }

    const handleResize = () => {
      canvasWidth = canvas.width = window.innerWidth
      canvasHeight = canvas.height = window.innerHeight
      webglCanvas.width = canvasWidth
      webglCanvas.height = canvasHeight
      halfW = canvasWidth * 0.5
      halfH = canvasHeight * 0.5
      initParticles()

      if (gl && webglProgram) {
        gl.viewport(0, 0, canvasWidth, canvasHeight)
        gl.uniform2f(webglProgram.locations.resolution, canvasWidth, canvasHeight)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)
    webglCanvas.addEventListener('click', handleClick)
    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribe()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      webglCanvas.removeEventListener('click', handleClick)
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full hidden pointer-events-none" />
      <canvas ref={webglCanvasRef} className="fixed top-0 left-0 w-full h-full" />
    </>
  )
}

export default ParticleCanvas

