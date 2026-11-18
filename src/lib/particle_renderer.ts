import {
  ATTRIBUTE_LOCATIONS,
  QUAD_VERTICES,
  QUAD_VERTEX_COUNT,
  createProgram,
  fadeVertexShaderSource,
  fadeFragmentShaderSource,
  particleVertexShaderSource,
  particleFragmentShaderSource,
  spriteVertexShaderSource,
  spriteFragmentShaderSource,
  compositeVertexShaderSource,
  compositeFragmentShaderSource
} from './webgl_shaders'
import { INSTANCE_FLOATS } from './particle_simulation'
import type { TitleSprite } from './title_sprite'

const INSTANCE_STRIDE = INSTANCE_FLOATS * 4
const INSTANCED_ATTRIBUTES = [ATTRIBUTE_LOCATIONS.segment, ATTRIBUTE_LOCATIONS.style, ATTRIBUTE_LOCATIONS.color]

const SCENE_TEXTURE_UNIT = 0
const SPRITE_TEXTURE_UNIT = 1

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
  holeX: number
  holeY: number
  horizon: number
  einstein: number
  falloff: number
  swirl: number
  absorption: number
  ring: number
  time: number
  starGlow: number
  starRadius: number
  waveRadius: number
  waveStrength: number
  waveWidth: number
  flash: number
}

export interface TitleSettings {
  alpha: number
  x: number
  y: number
  scale: number
  rotation: number
}

export interface FrameInput {
  background: readonly [number, number, number]
  fadeAlpha: number
  instances: Float32Array
  instanceCount: number
  doppler: number
  title: TitleSettings
  composite: CompositeSettings
}

export interface ParticleRenderer {
  resize: (width: number, height: number, pixelRatio: number, background: readonly [number, number, number]) => void
  setTitle: (sprite: TitleSprite) => void
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
 * 3. draws the intro title into the scene so the lens bends it like starlight,
 * 4. composites the scene to the screen through the black hole shader.
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
  const spriteProgram = createProgram(gl, spriteVertexShaderSource, spriteFragmentShaderSource, position)
  const compositeProgram = createProgram(gl, compositeVertexShaderSource, compositeFragmentShaderSource, position)
  const programs = [fadeProgram, particleProgram, spriteProgram, compositeProgram]

  if (!fadeProgram || !particleProgram || !spriteProgram || !compositeProgram) {
    for (const program of programs) {
      if (program) gl.deleteProgram(program)
    }
    return null
  }

  const fadeUniforms = getUniforms(gl, fadeProgram, ['color'] as const)
  const particleUniforms = getUniforms(gl, particleProgram, ['resolution', 'pixelRatio', 'center', 'doppler'] as const)
  const spriteUniforms = getUniforms(gl, spriteProgram, ['resolution', 'center', 'halfSize', 'rotation', 'color'] as const)
  const compositeUniforms = getUniforms(gl, compositeProgram, [
    'resolution', 'hole', 'horizon', 'einstein', 'falloff', 'swirl', 'absorption', 'ring', 'time',
    'starGlow', 'starRadius', 'waveRadius', 'waveStrength', 'waveWidth', 'flash'
  ] as const)

  gl.useProgram(compositeProgram)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_image'), SCENE_TEXTURE_UNIT)
  gl.useProgram(spriteProgram)
  gl.uniform1i(gl.getUniformLocation(spriteProgram, 'u_sprite'), SPRITE_TEXTURE_UNIT)

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
  const spriteTexture = createLinearTexture(SPRITE_TEXTURE_UNIT)
  let spriteWidth = 0
  let spriteHeight = 0

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

    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
    gl.viewport(0, 0, width, height)
    gl.clearColor(background[0] / 255, background[1] / 255, background[2] / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    gl.useProgram(particleProgram)
    setUniform2f(gl, particleUniforms.resolution, width, height)
    setUniform1f(gl, particleUniforms.pixelRatio, ratio)
    setUniform2f(gl, particleUniforms.center, cssWidth / 2, cssHeight / 2)
    gl.useProgram(spriteProgram)
    setUniform2f(gl, spriteUniforms.resolution, width, height)
    gl.useProgram(compositeProgram)
    setUniform2f(gl, compositeUniforms.resolution, width, height)
  }

  function setTitle (sprite: TitleSprite) {
    spriteWidth = sprite.width
    spriteHeight = sprite.height
    gl.activeTexture(gl.TEXTURE0 + SPRITE_TEXTURE_UNIT)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sprite.canvas)
    gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
  }

  function drawParticles (instances: Float32Array, count: number, doppler: number) {
    if (count === 0) return

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    if (count > instanceCapacity) {
      instanceCapacity = Math.ceil(count * 1.5)
      gl.bufferData(gl.ARRAY_BUFFER, instanceCapacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances.subarray(0, count * INSTANCE_FLOATS))

    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, doppler)
    for (const location of INSTANCED_ATTRIBUTES) gl.enableVertexAttribArray(location)
    instancing.draw(QUAD_VERTEX_COUNT, count)
    for (const location of INSTANCED_ATTRIBUTES) gl.disableVertexAttribArray(location)
  }

  function drawTitle (title: TitleSettings) {
    if (title.alpha <= 0 || title.scale <= 0 || spriteWidth === 0) return
    gl.useProgram(spriteProgram)
    setUniform2f(gl, spriteUniforms.center, title.x * ratio, title.y * ratio)
    setUniform2f(gl, spriteUniforms.halfSize, spriteWidth * 0.5 * title.scale * ratio, spriteHeight * 0.5 * title.scale * ratio)
    setUniform1f(gl, spriteUniforms.rotation, title.rotation)
    setUniform4f(gl, spriteUniforms.color, 1, 0.95, 0.9, title.alpha)
    gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
  }

  function composite (settings: CompositeSettings) {
    const u = compositeUniforms
    gl.useProgram(compositeProgram)
    setUniform2f(gl, u.hole, settings.holeX * ratio, settings.holeY * ratio)
    setUniform1f(gl, u.horizon, settings.horizon * ratio)
    setUniform1f(gl, u.einstein, settings.einstein * ratio)
    setUniform1f(gl, u.falloff, settings.falloff)
    setUniform1f(gl, u.swirl, settings.swirl)
    setUniform1f(gl, u.absorption, settings.absorption)
    setUniform1f(gl, u.ring, settings.ring)
    setUniform1f(gl, u.time, settings.time)
    setUniform1f(gl, u.starGlow, settings.starGlow)
    setUniform1f(gl, u.starRadius, Math.max(settings.starRadius * ratio, 0.5))
    setUniform1f(gl, u.waveRadius, settings.waveRadius * ratio)
    setUniform1f(gl, u.waveStrength, settings.waveStrength * ratio)
    setUniform1f(gl, u.waveWidth, Math.max(settings.waveWidth * ratio, 1))
    setUniform1f(gl, u.flash, settings.flash)
    gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
  }

  function render (frame: FrameInput) {
    const [r, g, b] = frame.background

    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
    if (frame.fadeAlpha > 0) {
      gl.useProgram(fadeProgram)
      setUniform4f(gl, fadeUniforms.color, r / 255, g / 255, b / 255, frame.fadeAlpha)
      gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
    }
    drawParticles(frame.instances, frame.instanceCount, frame.doppler)
    drawTitle(frame.title)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    composite(frame.composite)
  }

  function dispose () {
    for (const location of INSTANCED_ATTRIBUTES) instancing.setDivisor(location, 0)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(sceneFramebuffer)
    gl.deleteTexture(sceneTexture)
    gl.deleteTexture(spriteTexture)
    gl.deleteBuffer(quadBuffer)
    gl.deleteBuffer(instanceBuffer)
    for (const program of programs) gl.deleteProgram(program)
  }

  return { resize, setTitle, render, dispose }
}
