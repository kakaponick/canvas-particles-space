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
  compositeFragmentShaderSource,
  gridVertexShaderSource,
  gridFragmentShaderSource
} from './webgl_shaders'
import { INSTANCE_FLOATS } from './particle_simulation'
import type { TitleSprite } from './title_sprite'
import { RING_BINS } from './ring_energy'
import { GRID_COLOR, GRID_INSTANCE_COUNT, GRID_INSTANCE_FLOATS, GRID_WAVE_GAIN, createGridInstances, type GridSettings } from './space_grid'

const INSTANCE_STRIDE = INSTANCE_FLOATS * 4
const INSTANCED_ATTRIBUTES = [ATTRIBUTE_LOCATIONS.segment, ATTRIBUTE_LOCATIONS.style, ATTRIBUTE_LOCATIONS.color]

const SCENE_TEXTURE_UNIT = 0
const TITLE_TEXTURE_UNIT = 1
const RING_TEXTURE_UNIT = 2
const ORBIT_TEXTURE_UNIT = 3

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
  lensReach: number
  twistLimit: number
  swirl: number
  absorption: number
  ring: number
  // In black hole radii
  ringWidth: number
  // Strength of the soft light around the line; 0 leaves the bare line
  ringGlow: number
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
  // Oval wobble of the ringing horizon, a share of its radius; 0 leaves it round
  holeOval: number
  // The gravitational wave carries that wobble outward: pixels of stretch at the shadow's edge (0 turns
  // it off), seconds since it left the hole, the wobble's frequency in Hz and decay in seconds, and the
  // shadow radius beyond which it weakens with distance
  gravityWaveAmplitude: number
  gravityWaveTime: number
  gravityWaveFrequency: number
  gravityWaveDecay: number
  gravityWaveRadius: number
  backgroundStars: number
  starCell: number
  starDensity: number
  starFlare: number
  dustScale: number
  dustThreshold: number
  lightDustContrast: number
  dustSweep: number
  echoFloor: number
  dustShock: number
  // CSS pixels, and CSS pixels per second
  dustBlow: number
  dustDrift: number
  // Brightness of the flat grid on the sky behind the black hole (0 turns it off) and its cell size
  skyGrid: number
  gridCell: number
  // Colours of the intro, 0xRRGGBB
  colorFlash: number
  colorLight: number
  colorDust: number
  colorTitle: number
  colorEmber: number
  // Camera and film
  cameraZoom: number
  shakeX: number
  shakeY: number
  lensFringe: number
  vignette: number
  filmGrain: number
  // Height of each black bar
  letterbox: number
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
  // The black hole's gravity relative to its default; 0 leaves the crumbling dust where it is
  pull: number
  // Radians the falling dust turns around the hole
  swirl: number
  // Reach of gravity and radius of no return, CSS pixels
  reach: number
  capture: number
  // Size of the title relative to its sprite
  scale: number
  // CSS pixels
  fringe: number
  halo: number
  redshift: number
  grain: number
  // 0..1 progress of the title burning away
  burn: number
  // 0..1 how far the title has been drawn towards the hole
  fall: number
  // How the fall into the hole looks; see the uniforms of the same names
  tidal: number
  spiral: number
  spread: number
  stream: number
  order: number
  trail: number
  heat: number
}

export interface FrameInput {
  background: readonly [number, number, number]
  // False keeps the scene texture as it is (a frozen frame) and only recomposites it
  updateScene: boolean
  // False draws into the scene only and shows nothing: a film's extra step between two of its frames
  present: boolean
  fadeAlpha: number
  instances: Float32Array
  instanceCount: number
  // Stars in orbit: their segments follow the particles' in `instances`. They are stamped into a layer
  // of their own, which loses `orbitFade` of its 255 levels of brightness this frame
  orbitCount: number
  orbitFade: number
  doppler: number
  // How strongly brightness follows speed, and the frame length in 60 Hz reference frames it is judged by
  speedGlow: number
  frameScale: number
  // Vanishing point of the particle field in CSS pixels, the centre of its doppler tint
  vanishX: number
  vanishY: number
  // Photon ring energy around the circle, RING_BINS values
  ringTexels: Uint8Array
  // False while nothing feeds the ring: its energy is not read then, so it is not uploaded
  ringFed: boolean
  title: TitleSettings
  composite: CompositeSettings
  // The space sheet, drawn over the finished frame
  grid: GridSettings
}

export interface ParticleRenderer {
  resize: (width: number, height: number, pixelRatio: number, background: readonly [number, number, number]) => void
  setTitle: (sprite: TitleSprite) => void
  clearScene: (background: readonly [number, number, number]) => void
  render: (frame: FrameInput) => void
  dispose: () => void
}

interface CachedUniform {
  location: WebGLUniformLocation | null
  x: number
  y: number
  z: number
  w: number
}

export function getRenderingContext (canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext('webgl2', CONTEXT_ATTRIBUTES)
}

function getUniform (gl: WebGL2RenderingContext, program: WebGLProgram, name: string): CachedUniform {
  return { location: gl.getUniformLocation(program, name), x: NaN, y: NaN, z: NaN, w: NaN }
}

// Uniform setters skip the GL call when the value has not changed since the last frame
function setUniform1f (gl: WebGL2RenderingContext, uniform: CachedUniform, x: number) {
  if (uniform.x === x) return
  uniform.x = x
  gl.uniform1f(uniform.location, x)
}

function setUniform2f (gl: WebGL2RenderingContext, uniform: CachedUniform, x: number, y: number) {
  if (uniform.x === x && uniform.y === y) return
  uniform.x = x
  uniform.y = y
  gl.uniform2f(uniform.location, x, y)
}

// A colour arrives as 0xRRGGBB
function setUniformColor (gl: WebGL2RenderingContext, uniform: CachedUniform, color: number) {
  if (uniform.x === color) return
  uniform.x = color
  gl.uniform3f(uniform.location, (color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255)
}

function setUniform4f (gl: WebGL2RenderingContext, uniform: CachedUniform, x: number, y: number, z: number, w: number) {
  if (uniform.x === x && uniform.y === y && uniform.z === z && uniform.w === w) return
  uniform.x = x
  uniform.y = y
  uniform.z = z
  uniform.w = w
  gl.uniform4f(uniform.location, x, y, z, w)
}

function getUniforms<T extends string> (gl: WebGL2RenderingContext, program: WebGLProgram, names: readonly T[]) {
  const uniforms = {} as Record<T, CachedUniform>
  for (const name of names) uniforms[name] = getUniform(gl, program, `u_${name}`)
  return uniforms
}

/**
 * Draws the particle field with WebGL:
 * 1. fades the persistent scene texture toward the background (the motion trail),
 * 2. stamps every particle segment as one instanced, anti-aliased round-capped quad, keeping the
 *    brighter of the particle and the scene,
 * 3. composites the scene to the screen through the black hole shader, which also lays the
 *    intro title behind the lens so it bends like starlight,
 * 4. while the space sheet is on, draws its lines over the frame, keeping the brighter of the two.
 * Returns null when a program fails to build.
 */
export function createParticleRenderer (gl: WebGL2RenderingContext): ParticleRenderer | null {
  const position = { a_position: ATTRIBUTE_LOCATIONS.position }
  const fadeProgram = createProgram(gl, fadeVertexShaderSource, fadeFragmentShaderSource, position)
  const particleProgram = createProgram(gl, particleVertexShaderSource, particleFragmentShaderSource, {
    ...position,
    a_segment: ATTRIBUTE_LOCATIONS.segment,
    a_style: ATTRIBUTE_LOCATIONS.style,
    a_color: ATTRIBUTE_LOCATIONS.color
  })
  const compositeProgram = createProgram(gl, compositeVertexShaderSource, compositeFragmentShaderSource, position)
  const gridProgram = createProgram(gl, gridVertexShaderSource, gridFragmentShaderSource, {
    ...position,
    a_gridLine: ATTRIBUTE_LOCATIONS.gridLine
  })
  const programs = [fadeProgram, particleProgram, compositeProgram, gridProgram]

  if (!fadeProgram || !particleProgram || !compositeProgram || !gridProgram) {
    for (const program of programs) {
      if (program) gl.deleteProgram(program)
    }
    return null
  }

  const fadeUniforms = getUniforms(gl, fadeProgram, ['color'] as const)
  const particleUniforms = getUniforms(gl, particleProgram, ['resolution', 'pixelRatio', 'center', 'doppler', 'speedGlow', 'frameScale'] as const)
  const compositeUniforms = getUniforms(gl, compositeProgram, [
    'resolution', 'pixelRatio', 'time', 'hole', 'horizon', 'einstein', 'falloff', 'falloffPivot', 'lensCore', 'maxBend', 'lensReach', 'twistLimit', 'swirl', 'absorption', 'ring',
    'ringWidth', 'ringGlow', 'ringDoppler', 'ringSide', 'ringPhase', 'ringBase', 'ringFeed',
    'center', 'starGlow', 'starRadius', 'sourcePower', 'glareRadius', 'exposure',
    'lightRadius', 'lightWidth', 'lightPower', 'lightSpeed', 'echoPower', 'echoDecay',
    'waveRadius', 'waveStrength', 'waveWidth', 'remnantGlow', 'remnantRedshift', 'remnantRadius',
    'holeOval', 'gravityWaveAmplitude', 'gravityWaveTime', 'gravityWaveOmega', 'gravityWaveInvDecay', 'gravityWaveRadius', 'backgroundStars',
    'starCell', 'starDensity', 'starFlare', 'dustScale', 'dustThreshold', 'lightDustContrast',
    'titleCenter', 'titleHalfSize', 'titleAlpha', 'titleReveal', 'titleDissolve', 'titleDrift', 'titleGlow',
    'titleFlash', 'titleCooling', 'titleDust', 'titlePull', 'titleSwirl', 'titleReach', 'titleCapture', 'titleScale',
    'titleFringe', 'titleHalo', 'titleRedshift', 'titleGrain', 'titleBurn', 'titleFall', 'titleTidal', 'titleSpiral', 'titleSpread', 'titleStream', 'titleOrder', 'titleTrail', 'titleHeat', 'dustSweep', 'echoFloor', 'dustShock', 'dustBlow', 'dustDrift',
    'skyGrid', 'gridCell', 'orbits',
    'colorFlash', 'colorLight', 'colorDust', 'colorTitle', 'colorEmber',
    'cameraZoom', 'shake', 'lensFringe', 'vignette', 'filmGrain', 'letterbox'
  ] as const)
  const gridUniforms = getUniforms(gl, gridProgram, [
    'resolution', 'pixelRatio', 'view', 'camera', 'well', 'lines', 'wave', 'waveSpread', 'lens', 'jolt', 'color', 'shadow', 'frame'
  ] as const)

  gl.useProgram(compositeProgram)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_image'), SCENE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_title'), TITLE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringEnergy'), RING_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_orbitTrails'), ORBIT_TEXTURE_UNIT)

  // Shared quad at location 0, bound once for every program
  const quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0)

  // Per-particle attributes read one record per instance from the interleaved buffer
  const instanceBuffer = gl.createBuffer()
  let instanceCapacity = 0
  // Points the per-instance attributes at the record `offset` bytes into the instance buffer, which
  // must be bound
  function pointInstances (offset: number) {
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.segment, 4, gl.FLOAT, false, INSTANCE_STRIDE, offset)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.style, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset + 16)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.color, 4, gl.UNSIGNED_BYTE, true, INSTANCE_STRIDE, offset + 24)
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
  pointInstances(0)
  for (const location of INSTANCED_ATTRIBUTES) gl.vertexAttribDivisor(location, 1)

  // The lines of the space sheet never change: the grid vertex shader places them
  const gridBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, createGridInstances(), gl.STATIC_DRAW)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.gridLine, GRID_INSTANCE_FLOATS, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.gridLine, 1)

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

  // The traces of the orbiting stars, a layer of its own so they can outlast the particles' trails. It
  // gets its full size only when the first star is drawn, and again after a resize
  const orbitTexture = createLinearTexture(ORBIT_TEXTURE_UNIT)
  const orbitFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, orbitTexture, 0)
  let orbitSized = false
  // Whether the layer may hold light, and whether the composite pass reads it this frame
  let orbitLit = false
  let orbitsShown = false

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
    orbitSized = false
    orbitLit = false
    clearScene(background)

    gl.useProgram(particleProgram)
    setUniform2f(gl, particleUniforms.resolution, width, height)
    setUniform1f(gl, particleUniforms.pixelRatio, ratio)
    gl.useProgram(compositeProgram)
    setUniform2f(gl, compositeUniforms.resolution, width, height)
    setUniform1f(gl, compositeUniforms.pixelRatio, ratio)
    gl.useProgram(gridProgram)
    setUniform2f(gl, gridUniforms.resolution, width, height)
    setUniform1f(gl, gridUniforms.pixelRatio, ratio)
  }

  function clearScene (background: readonly [number, number, number]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
    gl.clearColor(background[0] / 255, background[1] / 255, background[2] / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    clearOrbits()
  }

  function clearOrbits () {
    if (!orbitLit) return
    orbitLit = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
    gl.clearColor(0, 0, 0, 1)
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

  // One upload for the frame: the particles' segments, then the orbiting stars'
  function uploadInstances (frame: FrameInput) {
    const count = frame.instanceCount + frame.orbitCount
    if (count === 0) return

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    if (count > instanceCapacity) {
      instanceCapacity = Math.ceil(count * 1.5)
      gl.bufferData(gl.ARRAY_BUFFER, instanceCapacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    }
    // A range of the array goes up as it is, with no view made for it
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, frame.instances, 0, count * INSTANCE_FLOATS)
  }

  // Stamps `count` segments into the bound target, keeping the brighter of a segment and what is already
  // there, so stamps do not add up
  function stampSegments (count: number) {
    for (const location of INSTANCED_ATTRIBUTES) gl.enableVertexAttribArray(location)
    gl.blendEquationSeparate(gl.MAX, gl.FUNC_ADD)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, count)
    gl.blendEquation(gl.FUNC_ADD)
    for (const location of INSTANCED_ATTRIBUTES) gl.disableVertexAttribArray(location)
  }

  function drawParticles (frame: FrameInput) {
    if (frame.instanceCount === 0) return
    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, frame.doppler)
    setUniform1f(gl, particleUniforms.speedGlow, frame.speedGlow)
    setUniform1f(gl, particleUniforms.frameScale, frame.frameScale)
    setUniform2f(gl, particleUniforms.center, frame.vanishX, frame.vanishY)
    stampSegments(frame.instanceCount)
  }

  // The orbiting stars' layer: what is there dims by whole levels of brightness, a straight fade that
  // reaches black (a share of what is left would stall in 8 bits and leave a haze), then every star
  // stamps the stretch it moved this frame
  function drawOrbits (frame: FrameInput) {
    if (!orbitSized) {
      orbitSized = true
      gl.activeTexture(gl.TEXTURE0 + ORBIT_TEXTURE_UNIT)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
      orbitLit = true
      clearOrbits()
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
    if (frame.orbitFade > 0 && orbitLit) {
      const level = Math.min(frame.orbitFade, 255) / 255
      gl.useProgram(fadeProgram)
      setUniform4f(gl, fadeUniforms.color, level, level, level, 0)
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
      gl.blendEquation(gl.FUNC_ADD)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
    orbitLit = true

    // The stars' records follow the particles'. A star is lit in full whatever its speed, with no tint
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    pointInstances(frame.instanceCount * INSTANCE_STRIDE)
    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, 0)
    setUniform1f(gl, particleUniforms.speedGlow, 0)
    setUniform1f(gl, particleUniforms.frameScale, frame.frameScale)
    stampSegments(frame.orbitCount)
    pointInstances(0)
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
      setUniform1f(gl, u.titlePull, title.pull)
      setUniform1f(gl, u.titleSwirl, title.swirl)
      setUniform1f(gl, u.titleReach, title.reach * ratio)
      setUniform1f(gl, u.titleCapture, title.capture * ratio)
      setUniform1f(gl, u.titleScale, Math.max(title.scale, 0.01))
      setUniform1f(gl, u.titleFringe, title.fringe * ratio)
      setUniform1f(gl, u.titleHalo, title.halo)
      setUniform1f(gl, u.titleRedshift, title.redshift)
      setUniform1f(gl, u.titleGrain, title.grain)
      setUniform1f(gl, u.titleBurn, title.burn)
      setUniform1f(gl, u.titleFall, title.fall)
      setUniform1f(gl, u.titleTidal, Math.max(title.tidal, 1))
      setUniform1f(gl, u.titleSpiral, title.spiral)
      setUniform1f(gl, u.titleSpread, title.spread)
      setUniform1f(gl, u.titleStream, title.stream)
      setUniform1f(gl, u.titleOrder, title.order)
      setUniform1f(gl, u.titleTrail, title.trail)
      setUniform1f(gl, u.titleHeat, title.heat)
    }
    setUniformColor(gl, u.colorFlash, settings.colorFlash)
    setUniformColor(gl, u.colorLight, settings.colorLight)
    setUniformColor(gl, u.colorDust, settings.colorDust)
    setUniformColor(gl, u.colorTitle, settings.colorTitle)
    setUniformColor(gl, u.colorEmber, settings.colorEmber)
    setUniform1f(gl, u.cameraZoom, Math.max(settings.cameraZoom, 0.05))
    setUniform2f(gl, u.shake, settings.shakeX * ratio, settings.shakeY * ratio)
    setUniform1f(gl, u.lensFringe, settings.lensFringe * ratio)
    setUniform1f(gl, u.vignette, settings.vignette)
    setUniform1f(gl, u.filmGrain, settings.filmGrain)
    setUniform1f(gl, u.letterbox, settings.letterbox * ratio)
    setUniform1f(gl, u.time, settings.time)
    setUniform2f(gl, u.hole, settings.holeX * ratio, settings.holeY * ratio)
    setUniform1f(gl, u.horizon, settings.horizon * ratio)
    setUniform1f(gl, u.holeOval, settings.holeOval)
    setUniform1f(gl, u.einstein, settings.einstein * ratio)
    setUniform1f(gl, u.falloff, settings.falloff)
    setUniform1f(gl, u.falloffPivot, Math.max(settings.falloffPivot * ratio, 1))
    setUniform1f(gl, u.lensCore, settings.lensCore)
    setUniform1f(gl, u.maxBend, settings.maxBend)
    setUniform1f(gl, u.lensReach, settings.lensReach)
    setUniform1f(gl, u.twistLimit, settings.twistLimit)
    setUniform1f(gl, u.swirl, settings.swirl)
    setUniform1f(gl, u.absorption, settings.absorption)
    setUniform1f(gl, u.ring, settings.ring)
    setUniform1f(gl, u.ringWidth, settings.ringWidth)
    setUniform1f(gl, u.ringGlow, settings.ringGlow)
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
    setUniform1f(gl, u.gravityWaveAmplitude, settings.gravityWaveAmplitude * ratio)
    if (settings.gravityWaveAmplitude > 0) {
      setUniform1f(gl, u.gravityWaveTime, settings.gravityWaveTime)
      setUniform1f(gl, u.gravityWaveOmega, 2 * Math.PI * settings.gravityWaveFrequency)
      setUniform1f(gl, u.gravityWaveInvDecay, 1 / Math.max(settings.gravityWaveDecay, 0.001))
      setUniform1f(gl, u.gravityWaveRadius, Math.max(settings.gravityWaveRadius * ratio, 1))
    }
    setUniform1f(gl, u.backgroundStars, settings.backgroundStars)
    setUniform1f(gl, u.starCell, Math.max(settings.starCell, 1))
    setUniform1f(gl, u.starDensity, settings.starDensity)
    setUniform1f(gl, u.starFlare, settings.starFlare)
    setUniform1f(gl, u.dustScale, Math.max(settings.dustScale, 1))
    setUniform1f(gl, u.dustThreshold, Math.min(settings.dustThreshold, 0.99))
    setUniform1f(gl, u.lightDustContrast, settings.lightDustContrast)
    setUniform1f(gl, u.dustSweep, settings.dustSweep)
    setUniform1f(gl, u.echoFloor, settings.echoFloor)
    setUniform1f(gl, u.dustShock, settings.dustShock)
    setUniform1f(gl, u.dustBlow, settings.dustBlow)
    setUniform1f(gl, u.dustDrift, settings.dustDrift)
    setUniform1f(gl, u.orbits, orbitsShown ? 1 : 0)
    setUniform1f(gl, u.skyGrid, settings.skyGrid)
    if (settings.skyGrid > 0) setUniform1f(gl, u.gridCell, Math.max(settings.gridCell, 1))
    gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
  }

  // The sheet is a diagram laid over the frame: it follows the scene camera's zoom and shake and the
  // letterbox, ripples with the gravitational wave and stops at the black hole's shadow
  function drawGrid (grid: GridSettings, settings: CompositeSettings) {
    const u = gridUniforms
    const zoom = Math.max(settings.cameraZoom, 0.05)
    gl.useProgram(gridProgram)
    setUniform2f(gl, u.view, grid.viewX, grid.viewY)
    setUniform4f(gl, u.camera, grid.distance, grid.tiltSin, grid.tiltCos, grid.lineWidth)
    setUniform4f(gl, u.well, grid.wellX, grid.wellZ, grid.throat, grid.depth)
    setUniform2f(gl, u.lines, Math.max(grid.cell, 1), Math.max(grid.span, 1))
    if (settings.gravityWaveAmplitude > 0) {
      setUniform4f(gl, u.wave, settings.gravityWaveAmplitude * GRID_WAVE_GAIN, settings.gravityWaveTime,
        2 * Math.PI * settings.gravityWaveFrequency, 1 / Math.max(settings.gravityWaveDecay, 0.001))
      setUniform2f(gl, u.waveSpread, Math.max(settings.gravityWaveRadius, 1), Math.max(settings.lightSpeed, 1))
    } else {
      setUniform4f(gl, u.wave, 0, 0, 0, 0)
    }
    setUniform4f(gl, u.lens, settings.centerX, settings.centerY, zoom, 0)
    setUniform2f(gl, u.jolt, settings.shakeX, settings.shakeY)
    setUniform4f(gl, u.color, GRID_COLOR[0] * grid.brightness, GRID_COLOR[1] * grid.brightness, GRID_COLOR[2] * grid.brightness, 1)
    // Where the composite pass put the black hole on the frame
    setUniform4f(gl, u.shadow,
      (settings.centerX + (settings.holeX - settings.shakeX - settings.centerX) * zoom) * ratio,
      (settings.centerY + (settings.holeY - settings.shakeY - settings.centerY) * zoom) * ratio,
      settings.horizon * zoom * ratio, 0)
    setUniform2f(gl, u.frame, height, settings.letterbox * ratio)

    gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.gridLine)
    // Brighter of the line and the frame, so crossings and the joints of a line do not add up
    gl.blendEquation(gl.MAX)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, GRID_INSTANCE_COUNT)
    gl.blendEquation(gl.FUNC_ADD)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.gridLine)
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
      uploadInstances(frame)
      drawParticles(frame)
      if (frame.orbitCount > 0) drawOrbits(frame)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      // The last star gone, its traces go with it
      if (frame.orbitCount === 0) clearOrbits()
      orbitsShown = frame.orbitCount > 0

      if (frame.ringFed) {
        gl.activeTexture(gl.TEXTURE0 + RING_TEXTURE_UNIT)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RING_BINS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.ringTexels)
        gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
      }
    }
    if (!frame.present) return
    composite(frame.composite, frame.title)
    if (frame.grid.brightness > 0) drawGrid(frame.grid, frame.composite)
  }

  function dispose () {
    for (const location of INSTANCED_ATTRIBUTES) gl.vertexAttribDivisor(location, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.gridLine, 0)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(sceneFramebuffer)
    gl.deleteTexture(sceneTexture)
    gl.deleteFramebuffer(orbitFramebuffer)
    gl.deleteTexture(orbitTexture)
    gl.deleteTexture(titleTexture)
    gl.deleteTexture(ringTexture)
    gl.deleteBuffer(quadBuffer)
    gl.deleteBuffer(instanceBuffer)
    gl.deleteBuffer(gridBuffer)
    for (const program of programs) gl.deleteProgram(program)
  }

  return { resize, setTitle, clearScene, render, dispose }
}
