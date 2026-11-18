import {
  ATTRIBUTE_LOCATIONS,
  QUAD_VERTICES,
  QUAD_VERTEX_COUNT,
  createProgram,
  fadeVertexShaderSource,
  fadeFragmentShaderSource,
  particleVertexShaderSource,
  particleFragmentShaderSource,
  compositeVertexShaderSource,
  compositeFragmentShaderSource
} from './webgl_shaders'
import { INSTANCE_FLOATS } from './particle_simulation'
import type { TitleSprite } from './title_sprite'
import { RING_BINS } from './ring_energy'

const INSTANCE_STRIDE = INSTANCE_FLOATS * 4
const INSTANCED_ATTRIBUTES = [ATTRIBUTE_LOCATIONS.segment, ATTRIBUTE_LOCATIONS.style, ATTRIBUTE_LOCATIONS.color]

const SCENE_TEXTURE_UNIT = 0
const TITLE_TEXTURE_UNIT = 1
const RING_TEXTURE_UNIT = 2

// The output is opaque and fully redrawn every frame, so the context skips alpha, depth and MSAA
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance'
}

// Every length here is in CSS pixels; the renderer scales to device pixels
export interface CompositeSettings {
  time: number
  holeX: number
  holeY: number
  horizon: number
  einstein: number
  falloff: number
  // Distance from the black hole at which falloff leaves the pull unchanged
  falloffPivot: number
  // In Einstein radii
  lensCore: number
  maxBend: number
  twistLimit: number
  swirl: number
  absorption: number
  ring: number
  // In black hole radii
  ringWidth: number
  ringDoppler: number
  // Radians
  ringSide: number
  // Radians the energy pattern has turned
  ringPhase: number
  ringBase: number
  ringFeed: number
  // Explosion center and its light
  centerX: number
  centerY: number
  starGlow: number
  starRadius: number
  sourcePower: number
  glareRadius: number
  exposure: number
  lightRadius: number
  lightWidth: number
  lightPower: number
  lightSpeed: number
  echoPower: number
  echoDecay: number
  waveRadius: number
  waveStrength: number
  waveWidth: number
  remnantGlow: number
  remnantRedshift: number
  remnantRadius: number
  gravityWaveRadius: number
  gravityWaveAmplitude: number
  gravityWaveWidth: number
  gravityWaveCycles: number
  backgroundStars: number
  starCell: number
  starDensity: number
  starFlare: number
  dustScale: number
  dustThreshold: number
  lightDustContrast: number
}

export interface TitleSettings {
  alpha: number
  // Centre in CSS pixels
  x: number
  y: number
  reveal: number
  dissolve: number
  // CSS pixels
  drift: number
  glow: number
  flash: number
  // Seconds
  cooling: number
  dust: number
}

export interface FrameInput {
  background: readonly [number, number, number]
  // False keeps the scene texture as it is (a frozen frame) and only recomposites it
  updateScene: boolean
  fadeAlpha: number
  instances: Float32Array
  instanceCount: number
  doppler: number
  // How strongly brightness follows speed, and the frame length in 60 Hz reference frames it is judged by
  speedGlow: number
  frameScale: number
  // Photon ring energy around the circle, RING_BINS values
  ringTexels: Uint8Array
  title: TitleSettings
  composite: CompositeSettings
}

export interface ParticleRenderer {
  resize: (width: number, height: number, pixelRatio: number, background: readonly [number, number, number]) => void
  setTitle: (sprite: TitleSprite) => void
  clearScene: (background: readonly [number, number, number]) => void
  render: (frame: FrameInput) => void
  dispose: () => void
}

interface Instancing {
  setDivisor: (location: number, divisor: number) => void
  draw: (vertexCount: number, instanceCount: number) => void
}

interface CachedUniform {
  location: WebGLUniformLocation | null
  x: number
  y: number
  z: number
  w: number
}

export function getRenderingContext (canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  return canvas.getContext('webgl2', CONTEXT_ATTRIBUTES) ?? canvas.getContext('webgl', CONTEXT_ATTRIBUTES)
}

function isWebGL2 (gl: WebGLRenderingContext): gl is WebGL2RenderingContext {
  return typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
}

function getInstancing (gl: WebGLRenderingContext): Instancing | null {
  if (isWebGL2(gl)) {
    return {
      setDivisor: (location, divisor) => gl.vertexAttribDivisor(location, divisor),
      draw: (vertexCount, instanceCount) => gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount)
    }
  }

  const extension = gl.getExtension('ANGLE_instanced_arrays')
  if (!extension) return null
  return {
    setDivisor: (location, divisor) => extension.vertexAttribDivisorANGLE(location, divisor),
    draw: (vertexCount, instanceCount) => extension.drawArraysInstancedANGLE(gl.TRIANGLES, 0, vertexCount, instanceCount)
  }
}

function getUniform (gl: WebGLRenderingContext, program: WebGLProgram, name: string): CachedUniform {
  return { location: gl.getUniformLocation(program, name), x: NaN, y: NaN, z: NaN, w: NaN }
}

// Uniform setters skip the GL call when the value has not changed since the last frame
function setUniform1f (gl: WebGLRenderingContext, uniform: CachedUniform, x: number) {
  if (uniform.x === x) return
  uniform.x = x
  gl.uniform1f(uniform.location, x)
}

function setUniform2f (gl: WebGLRenderingContext, uniform: CachedUniform, x: number, y: number) {
  if (uniform.x === x && uniform.y === y) return
  uniform.x = x
  uniform.y = y
  gl.uniform2f(uniform.location, x, y)
}

function setUniform4f (gl: WebGLRenderingContext, uniform: CachedUniform, x: number, y: number, z: number, w: number) {
  if (uniform.x === x && uniform.y === y && uniform.z === z && uniform.w === w) return
  uniform.x = x
  uniform.y = y
  uniform.z = z
  uniform.w = w
  gl.uniform4f(uniform.location, x, y, z, w)
}

function getUniforms<T extends string> (gl: WebGLRenderingContext, program: WebGLProgram, names: readonly T[]) {
  const uniforms = {} as Record<T, CachedUniform>
  for (const name of names) uniforms[name] = getUniform(gl, program, `u_${name}`)
  return uniforms
}

/**
 * Draws the particle field with WebGL:
 * 1. fades the persistent scene texture toward the background (the motion trail),
 * 2. draws every particle segment as one instanced, anti-aliased round-capped quad,
 * 3. composites the scene to the screen through the black hole shader, which also lays the
 *    intro title behind the lens so it bends like starlight.
 * Returns null when the context lacks instancing or a program fails to build.
 */
export function createParticleRenderer (gl: WebGLRenderingContext): ParticleRenderer | null {
  const supportedInstancing = getInstancing(gl)
  if (!supportedInstancing) {
    console.warn('Instanced drawing is not supported, particles will not render')
    return null
  }
  const instancing: Instancing = supportedInstancing

  const position = { a_position: ATTRIBUTE_LOCATIONS.position }
  const fadeProgram = createProgram(gl, fadeVertexShaderSource, fadeFragmentShaderSource, position)
  const particleProgram = createProgram(gl, particleVertexShaderSource, particleFragmentShaderSource, {
    ...position,
    a_segment: ATTRIBUTE_LOCATIONS.segment,
    a_style: ATTRIBUTE_LOCATIONS.style,
    a_color: ATTRIBUTE_LOCATIONS.color
  })
  const compositeProgram = createProgram(gl, compositeVertexShaderSource, compositeFragmentShaderSource, position)
  const programs = [fadeProgram, particleProgram, compositeProgram]

  if (!fadeProgram || !particleProgram || !compositeProgram) {
    for (const program of programs) {
      if (program) gl.deleteProgram(program)
    }
    return null
  }

  const fadeUniforms = getUniforms(gl, fadeProgram, ['color'] as const)
  const particleUniforms = getUniforms(gl, particleProgram, ['resolution', 'pixelRatio', 'center', 'doppler', 'speedGlow', 'frameScale'] as const)
  const compositeUniforms = getUniforms(gl, compositeProgram, [
    'resolution', 'pixelRatio', 'time', 'hole', 'horizon', 'einstein', 'falloff', 'falloffPivot', 'lensCore', 'maxBend', 'twistLimit', 'swirl', 'absorption', 'ring',
    'ringWidth', 'ringDoppler', 'ringSide', 'ringPhase', 'ringBase', 'ringFeed',
    'center', 'starGlow', 'starRadius', 'sourcePower', 'glareRadius', 'exposure',
    'lightRadius', 'lightWidth', 'lightPower', 'lightSpeed', 'echoPower', 'echoDecay',
    'waveRadius', 'waveStrength', 'waveWidth', 'remnantGlow', 'remnantRedshift', 'remnantRadius',
    'gravityWaveRadius', 'gravityWaveAmplitude', 'gravityWaveWidth', 'gravityWaveCycles', 'backgroundStars',
    'starCell', 'starDensity', 'starFlare', 'dustScale', 'dustThreshold', 'lightDustContrast',
    'titleCenter', 'titleHalfSize', 'titleAlpha', 'titleReveal', 'titleDissolve', 'titleDrift', 'titleGlow',
    'titleFlash', 'titleCooling', 'titleDust'
  ] as const)

  gl.useProgram(compositeProgram)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_image'), SCENE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_title'), TITLE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringEnergy'), RING_TEXTURE_UNIT)

  // Shared quad at location 0, bound once for every program
  const quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0)

  // Per-particle attributes read one record per instance from the interleaved buffer
  const instanceBuffer = gl.createBuffer()
  let instanceCapacity = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.segment, 4, gl.FLOAT, false, INSTANCE_STRIDE, 0)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.style, 2, gl.FLOAT, false, INSTANCE_STRIDE, 16)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.color, 4, gl.UNSIGNED_BYTE, true, INSTANCE_STRIDE, 24)
  for (const location of INSTANCED_ATTRIBUTES) instancing.setDivisor(location, 1)

  function createLinearTexture (unit: number) {
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    return texture
  }

  // Each texture keeps its own unit, so no draw ever rebinds one
  // One row around the ring; it repeats so the pattern has no seam
  const ringTexture = createLinearTexture(RING_TEXTURE_UNIT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, RING_BINS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null)
  const titleTexture = createLinearTexture(TITLE_TEXTURE_UNIT)
  let titleWidth = 0
  let titleHeight = 0

  // Persistent scene texture: the trail lives here between frames
  const sceneTexture = createLinearTexture(SCENE_TEXTURE_UNIT)
  const sceneFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Canvas 2D source-over: color blends by its alpha, the scene alpha stays opaque
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  let width = 1
  let height = 1
  let ratio = 1

  function resize (cssWidth: number, cssHeight: number, pixelRatio: number, background: readonly [number, number, number]) {
    ratio = pixelRatio
    width = Math.max(1, Math.round(cssWidth * pixelRatio))
    height = Math.max(1, Math.round(cssHeight * pixelRatio))
    if (gl.canvas.width !== width) gl.canvas.width = width
    if (gl.canvas.height !== height) gl.canvas.height = height

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    gl.viewport(0, 0, width, height)
    clearScene(background)

    gl.useProgram(particleProgram)
    setUniform2f(gl, particleUniforms.resolution, width, height)
    setUniform1f(gl, particleUniforms.pixelRatio, ratio)
    setUniform2f(gl, particleUniforms.center, cssWidth / 2, cssHeight / 2)
    gl.useProgram(compositeProgram)
    setUniform2f(gl, compositeUniforms.resolution, width, height)
    setUniform1f(gl, compositeUniforms.pixelRatio, ratio)
  }

  function clearScene (background: readonly [number, number, number]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
    gl.clearColor(background[0] / 255, background[1] / 255, background[2] / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function setTitle (sprite: TitleSprite) {
    titleWidth = sprite.width
    titleHeight = sprite.height
    gl.activeTexture(gl.TEXTURE0 + TITLE_TEXTURE_UNIT)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sprite.canvas)
    gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
  }

  function drawParticles (instances: Float32Array, count: number, doppler: number, speedGlow: number, frameScale: number) {
    if (count === 0) return

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    if (count > instanceCapacity) {
      instanceCapacity = Math.ceil(count * 1.5)
      gl.bufferData(gl.ARRAY_BUFFER, instanceCapacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances.subarray(0, count * INSTANCE_FLOATS))

    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, doppler)
    setUniform1f(gl, particleUniforms.speedGlow, speedGlow)
    setUniform1f(gl, particleUniforms.frameScale, frameScale)
    for (const location of INSTANCED_ATTRIBUTES) gl.enableVertexAttribArray(location)
    instancing.draw(QUAD_VERTEX_COUNT, count)
    for (const location of INSTANCED_ATTRIBUTES) gl.disableVertexAttribArray(location)
  }

  function composite (settings: CompositeSettings, title: TitleSettings) {
    const u = compositeUniforms
    gl.useProgram(compositeProgram)
    const titleVisible = title.alpha > 0 && titleWidth > 0
    setUniform1f(gl, u.titleAlpha, titleVisible ? title.alpha : 0)
    if (titleVisible) {
      setUniform2f(gl, u.titleCenter, title.x * ratio, title.y * ratio)
      setUniform2f(gl, u.titleHalfSize, titleWidth * 0.5 * ratio, titleHeight * 0.5 * ratio)
      setUniform1f(gl, u.titleReveal, title.reveal)
      setUniform1f(gl, u.titleDissolve, title.dissolve)
      setUniform1f(gl, u.titleDrift, title.drift * ratio)
      setUniform1f(gl, u.titleGlow, title.glow)
      setUniform1f(gl, u.titleFlash, title.flash)
      setUniform1f(gl, u.titleCooling, Math.max(title.cooling, 0.01))
      setUniform1f(gl, u.titleDust, title.dust)
    }
    setUniform1f(gl, u.time, settings.time)
    setUniform2f(gl, u.hole, settings.holeX * ratio, settings.holeY * ratio)
    setUniform1f(gl, u.horizon, settings.horizon * ratio)
    setUniform1f(gl, u.einstein, settings.einstein * ratio)
    setUniform1f(gl, u.falloff, settings.falloff)
    setUniform1f(gl, u.falloffPivot, Math.max(settings.falloffPivot * ratio, 1))
    setUniform1f(gl, u.lensCore, settings.lensCore)
    setUniform1f(gl, u.maxBend, settings.maxBend)
    setUniform1f(gl, u.twistLimit, settings.twistLimit)
    setUniform1f(gl, u.swirl, settings.swirl)
    setUniform1f(gl, u.absorption, settings.absorption)
    setUniform1f(gl, u.ring, settings.ring)
    setUniform1f(gl, u.ringWidth, settings.ringWidth)
    setUniform1f(gl, u.ringDoppler, settings.ringDoppler)
    setUniform1f(gl, u.ringSide, settings.ringSide)
    setUniform1f(gl, u.ringPhase, settings.ringPhase)
    setUniform1f(gl, u.ringBase, settings.ringBase)
    setUniform1f(gl, u.ringFeed, settings.ringFeed)
    setUniform2f(gl, u.center, settings.centerX * ratio, settings.centerY * ratio)
    setUniform1f(gl, u.starGlow, settings.starGlow)
    setUniform1f(gl, u.starRadius, Math.max(settings.starRadius * ratio, 0.5))
    setUniform1f(gl, u.sourcePower, settings.sourcePower)
    setUniform1f(gl, u.glareRadius, Math.max(settings.glareRadius * ratio, 0.5))
    setUniform1f(gl, u.exposure, settings.exposure)
    setUniform1f(gl, u.lightRadius, settings.lightRadius * ratio)
    setUniform1f(gl, u.lightWidth, Math.max(settings.lightWidth * ratio, 1))
    setUniform1f(gl, u.lightPower, settings.lightPower)
    setUniform1f(gl, u.lightSpeed, settings.lightSpeed * ratio)
    setUniform1f(gl, u.echoPower, settings.echoPower)
    setUniform1f(gl, u.echoDecay, Math.max(settings.echoDecay, 0.01))
    setUniform1f(gl, u.waveRadius, settings.waveRadius * ratio)
    setUniform1f(gl, u.waveStrength, settings.waveStrength * ratio)
    setUniform1f(gl, u.waveWidth, Math.max(settings.waveWidth * ratio, 1))
    setUniform1f(gl, u.remnantGlow, settings.remnantGlow)
    setUniform1f(gl, u.remnantRedshift, settings.remnantRedshift)
    setUniform1f(gl, u.remnantRadius, Math.max(settings.remnantRadius * ratio, 0.5))
    setUniform1f(gl, u.gravityWaveRadius, settings.gravityWaveRadius * ratio)
    setUniform1f(gl, u.gravityWaveAmplitude, settings.gravityWaveAmplitude * ratio)
    setUniform1f(gl, u.gravityWaveWidth, Math.max(settings.gravityWaveWidth * ratio, 1))
    setUniform1f(gl, u.gravityWaveCycles, settings.gravityWaveCycles)
    setUniform1f(gl, u.backgroundStars, settings.backgroundStars)
    setUniform1f(gl, u.starCell, Math.max(settings.starCell, 1))
    setUniform1f(gl, u.starDensity, settings.starDensity)
    setUniform1f(gl, u.starFlare, settings.starFlare)
    setUniform1f(gl, u.dustScale, Math.max(settings.dustScale, 1))
    setUniform1f(gl, u.dustThreshold, Math.min(settings.dustThreshold, 0.99))
    setUniform1f(gl, u.lightDustContrast, settings.lightDustContrast)
    gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
  }

  function render (frame: FrameInput) {
    const [r, g, b] = frame.background

    if (frame.updateScene) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
      if (frame.fadeAlpha > 0) {
        gl.useProgram(fadeProgram)
        setUniform4f(gl, fadeUniforms.color, r / 255, g / 255, b / 255, frame.fadeAlpha)
        gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
      }
      drawParticles(frame.instances, frame.instanceCount, frame.doppler, frame.speedGlow, frame.frameScale)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      gl.activeTexture(gl.TEXTURE0 + RING_TEXTURE_UNIT)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RING_BINS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.ringTexels)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
    }
    composite(frame.composite, frame.title)
  }

  function dispose () {
    for (const location of INSTANCED_ATTRIBUTES) instancing.setDivisor(location, 0)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(sceneFramebuffer)
    gl.deleteTexture(sceneTexture)
    gl.deleteTexture(titleTexture)
    gl.deleteTexture(ringTexture)
    gl.deleteBuffer(quadBuffer)
    gl.deleteBuffer(instanceBuffer)
    for (const program of programs) gl.deleteProgram(program)
  }

  return { resize, setTitle, clearScene, render, dispose }
}
