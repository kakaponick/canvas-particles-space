import {
  ATTRIBUTE_LOCATIONS,
  QUAD_VERTICES,
  QUAD_VERTEX_COUNT,
  createProgram,
  fadeVertexShaderSource,
  fadeFragmentShaderSource,
  particleVertexShaderSource,
  particleFragmentShaderSource,
  orbitVertexShaderSource,
  compositeVertexShaderSource,
  compositeFragmentShaderSource,
  gridVertexShaderSource,
  gridFragmentShaderSource,
  latticeVertexShaderSource,
  flowVertexShaderSource
} from './webgl_shaders'
import { INSTANCE_FLOATS } from './particle_simulation'
import { RING_LIGHT_TEXTURE_UNIT, createFieldFeedback, type FieldFeedback, type FieldInput } from './field_feedback'
import type { SceneColor } from './scene_color'
import { MAX_ORBITERS, STRETCH_SECONDS } from './orbiters'
import type { TitleSprite } from './title_sprite'
import { RING_BINS } from './ring_energy'
import { SHADOW_SAMPLES, type ShadowShape } from './kerr_shadow'
import { GRID_INSTANCE_COUNT, GRID_INSTANCE_FLOATS, GRID_LINES_PER_SIDE, createGridInstances, type GridSettings } from './space_grid'
import { LATTICE_INSTANCE_COUNT, LATTICE_INSTANCE_FLOATS, createLatticeInstances, type LatticeSettings } from './space_lattice'
import { FLOW_CAPACITY, FLOW_CORNER_FLOATS, FLOW_SEED_FLOATS, FLOW_VERTEX_COUNT, createFlowCorners, createFlowSeeds, type FlowSettings } from './flows'

const INSTANCE_STRIDE = INSTANCE_FLOATS * 4
const INSTANCED_ATTRIBUTES = [ATTRIBUTE_LOCATIONS.segment, ATTRIBUTE_LOCATIONS.style, ATTRIBUTE_LOCATIONS.color]

const SCENE_TEXTURE_UNIT = 0
const TITLE_TEXTURE_UNIT = 1
const RING_TEXTURE_UNIT = 2
const ORBIT_TEXTURE_UNIT = 3
const SHADOW_TEXTURE_UNIT = 4

// The longest trace a star may leave, seconds (the top of the Orbit Trail setting)
const LONGEST_TRACE = 60
// Rows of stretches the longest traces take, and one more for the row being flown
const TRACE_ROWS = Math.ceil(LONGEST_TRACE / STRETCH_SECONDS) + 1
// Room for every star's longest trace
const TRACE_CAPACITY = TRACE_ROWS * MAX_ORBITERS
// The levels of the nebula's noise its clouds start at with Sparseness 0 (haze everywhere) and 1 (a few
// thin wisps), the same span the opening's dust takes
const NEBULA_LEVEL_LOW = 0.2
const NEBULA_LEVEL_HIGH = 0.62

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
  // The Ray Traced lens: 1 / the camera's distance in Schwarzschild radii (0 = the stylized lens), the
  // stereographic scale (a direction theta from the hole lies traceScale * tan(theta / 2) from it) and the
  // share of the bend shown
  traceU: number
  traceScale: number
  traceShare: number
  // The hole's spin (a/M, 0 = none), the angle between its axis and the line to the camera and the turn
  // of the axis on the screen from up, radians; the outline of its shadow (kerr_shadow.ts)
  spin: number
  spinTilt: number
  spinAxis: number
  shadowShape: ShadowShape
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
  // The line: its width at Thickness 0 in screen pixels, how far outside the shadow's edge it stands in
  // its own widths, how far from the hole the ring and its glow are drawn, in shadow radii, and the width
  // of the bell of light that draws the line, as a share of the line's own
  ringLineMin: number
  ringOffset: number
  ringReach: number
  ringSoftness: number
  // The glow: how far its tight core and its wide skirt reach, in black hole radii, and the share of the
  // glow each holds at the line
  ringGlowCore: number
  ringGlowSkirt: number
  ringGlowCoreShare: number
  ringGlowSkirtShare: number
  // The ring's colour and what its approaching and receding sides turn toward
  ringColor: SceneColor
  ringApproaching: SceneColor
  ringReceding: SceneColor
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
  // How long thin haze and the thickest cloud hold the light, in multiples of echoDecay; how long the glow
  // takes to swell, as a multiple of echoDecay and the seconds added to it; and the distance at which the
  // glow is half as bright, as a share of the frame's width
  echoHoldThin: number
  echoHoldThick: number
  echoSwell: number
  echoSwellMin: number
  echoReach: number
  waveRadius: number
  waveStrength: number
  waveWidth: number
  remnantGlow: number
  remnantRedshift: number
  remnantRadius: number
  // The core's colours: the share of the redshift at which it is the ember, how much of the flash colour
  // the ember keeps, the brightness of the deep colour it ends at and how much it has dimmed by then
  remnantEmberAt: number
  remnantWhiteness: number
  remnantDeep: number
  remnantDim: number
  // Oval wobble of the ringing horizon: a share of its radius, times the cosine and the sine of twice the
  // angle of its long axis; zeros leave it round
  holeOvalX: number
  holeOvalY: number
  // The gravitational wave carries that wobble outward: pixels the sky is slid at the shadow's edge (0
  // turns it off), seconds since it left the hole, the wobble's frequency in Hz and decay in seconds, and
  // the shadow radius beyond which it weakens with distance
  gravityWaveAmplitude: number
  gravityWaveTime: number
  gravityWaveFrequency: number
  gravityWaveDecay: number
  gravityWaveRadius: number
  // The way the oval turns as it rings (1 or -1; 0 = it wobbles in place), the angle its long axis had as
  // the ringing began, and the pixels the wave travels a second
  gravityWaveSpin: number
  gravityWaveAngle: number
  gravityWaveSpeed: number
  // Where that wave left from
  gravityWaveX: number
  gravityWaveY: number
  // A second black hole: its centre, shadow radius (0 = none) and Einstein radius
  companionX: number
  companionY: number
  companionRadius: number
  companionEinstein: number
  // The centre the two turn around, and their spiral gravitational wave: pixels of stretch at the
  // shadow's edge (0 = off), the pair's angle, and how far its arms turn per pixel of distance
  pairX: number
  pairY: number
  pairWave: number
  pairPhase: number
  pairPitch: number
  // Once the two are one: seconds since then (negative before), and the seconds over which the pair's
  // wave gives way to the ringing that follows it out
  pairFront: number
  pairFrontSoft: number
  // How much larger than at the pivot's distance the camera sees the pair's centre, and the place the
  // ringing's wave left from: a wave's lengths on the screen grow with it (1 in the flat mode)
  pairScale: number
  waveScale: number
  // Two holes at different depths: the share of the companion's bend the main hole is seen through (the
  // companion the nearer), the share of the main lens's bend the companion is seen through (the companion
  // the farther), and which stands in front, from -1 (the main hole, wholly) to 1 (the companion, wholly).
  // Zeros in the flat mode, where the two stand side by side
  pairLensMain: number
  pairLensCompanion: number
  pairNearer: number
  // The 3D camera's turn, row by row: where its right, its down and its line of sight point in the scene
  // (the scene's own axes in the flat mode). The sky, the waves and the ringing oval are seen through it
  turn: Float32Array
  backgroundStars: number
  starCell: number
  starDensity: number
  starFlare: number
  // The nebula's brightness (0 turns it off) and its two colours; CSS pixels the 3D camera's turn slides
  // it by, and the CSS pixels of a full turn, over which it blends into itself (0 in the flat mode)
  nebula: number
  nebulaColor: SceneColor
  nebulaColorDeep: SceneColor
  nebulaColorCore: SceneColor
  // Its clouds: CSS pixels across, sparseness and edge (0..1 of the noise), how curled, how much denser in
  // the middle, grain; CSS pixels a second they are read further along; the second colour's patches (in
  // clouds across, share of the sky, softness); how far the thickest cloud turns to the core colour, and
  // from what thickness
  nebulaScale: number
  nebulaSparseness: number
  nebulaEdge: number
  nebulaWarp: number
  nebulaContrast: number
  nebulaGrain: number
  nebulaDriftX: number
  nebulaDriftY: number
  nebulaPatch: number
  nebulaPatchShare: number
  nebulaPatchSoftness: number
  nebulaCore: number
  nebulaCoreFrom: number
  nebulaShiftX: number
  nebulaShiftY: number
  nebulaWrap: number
  // A background star: the two colours its tint lies between, the spread of its bell of light (the square
  // of its radius, CSS pixels), the share of its light that twinkles and the rate of that as a multiple of
  // its own, and the brightness of the faintest star as a share of the brightest
  starWarm: SceneColor
  starCool: SceneColor
  starSpread: number
  starTwinkle: number
  starTwinkleSpeed: number
  starFaintest: number
  // Seconds a star stays flared after the light front passes it
  starFlareDecay: number
  dustScale: number
  dustThreshold: number
  lightDustContrast: number
  dustSweep: number
  echoFloor: number
  dustShock: number
  // CSS pixels, and CSS pixels per second
  dustBlow: number
  dustDrift: number
  // Seconds the blast takes to push the dust most of its way, and the way the dust is read from as it drifts
  dustBlowTime: number
  dustDriftX: number
  dustDriftY: number
  // The flare where the matter front strikes the dust: how far outside the front's middle it stands, in
  // the front's widths, how thin it is, and its colour between the dust's (0) and the light's (1)
  dustShockOffset: number
  dustShockSharpness: number
  dustShockTint: number
  // Brightness of the flat grid on the sky behind the black hole (0 turns it off) and its cell size
  skyGrid: number
  gridCell: number
  // How far that grid is drawn in towards the hole (0 leaves it flat), and the colour of every grid
  gridPull: number
  gridColor: SceneColor
  // CSS pixels a cell of it pulled in shrinks to before its lines start to merge into a haze, and the share
  // of that by which the haze is whole
  gridHaze: number
  gridHazeSpan: number
  // The width of that grid's lines in CSS pixels
  skyGridLine: number
  // CSS pixels the 3D camera's turn slides the sky by: the background stars, then the lensed grid; zeros
  // in the flat mode
  starShiftX: number
  starShiftY: number
  // A 3D camera's roll, in radians (positive: the picture turns anticlockwise); the sky turns with it
  // about the middle of the screen
  skyRoll: number
  gridShiftX: number
  gridShiftY: number
  // Colours of the intro, 0xRRGGBB
  colorFlash: number
  colorLight: number
  colorDust: number
  colorTitle: number
  colorEmber: number
  // Camera and film
  cameraZoom: number
  // The point of the frame the zoom leaves where it is
  zoomX: number
  zoomY: number
  shakeX: number
  shakeY: number
  lensFringe: number
  vignette: number
  filmGrain: number
  // Height of each black bar
  letterbox: number
  // Where the vignette starts and where it is darkest, in half sizes of the frame from its middle
  vignetteStart: number
  vignetteEnd: number
  // Brightness above which highlights are rolled off
  filmKnee: number
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
  // The specks: their size and the width of the currents they share, CSS pixels; the speed of dust beyond
  // gravity's reach as a share; the share of the fall a speck takes to wink out
  speckSize: number
  currentSize: number
  beyondSpeed: number
  wink: number
  // The winding at spiral 1: the distance that turns as set, a share of the frame's height, and the least
  // and the most any part winds round
  spiralRadius: number
  spiralMin: number
  spiralMax: number
  // The burning: its ragged edge's two grains, CSS pixels; how much it eats in from the ends; its rim's
  // brightness in ember colours and width
  burnGrain: number
  burnFine: number
  burnEnds: number
  burnRim: number
  burnRimWidth: number
  // The falling dust's finer shape: how much the currents differ in speed, the share of the frame's height
  // the order of vanishing spans, the width of the horizon's edge as a share of its radius, and the width
  // gravity's reach fades over in reaches
  currentContrast: number
  orderReach: number
  captureEdge: number
  reachFade: number
  // The grain of the letters: CSS pixels across its clumps, the share of it that follows them, and the
  // grain below which a letter is empty and above which it is solid
  dustSize: number
  dustClumps: number
  dustLow: number
  dustHigh: number
  // The fire's edge: the share of its large grain in it, and how soft it is
  burnMix: number
  burnEdge: number
}

export interface FrameInput extends FieldInput {
  background: readonly [number, number, number]
  // False keeps the scene texture as it is (a frozen frame) and only recomposites it
  updateScene: boolean
  // False draws into the scene only and shows nothing: a film's extra step between two of its frames
  present: boolean
  fadeAlpha: number
  // Stars in orbit: `orbitRow` holds the stretch each of the `orbitCount` stars is flying, in
  // Schwarzschild radii from the black hole. The renderer keeps the stretches and draws the traces from them
  orbitCount: number
  orbitRow: Float32Array
  // True when the row is a new one, kept beside the earlier rows; false when it redraws the last row
  orbitRowNew: boolean
  // Brightness every trace has lost since the traces began; a stretch is dark once this has grown by 1
  // since it was flown
  orbitDimmed: number
  // The black hole the orbits circle, CSS pixels in a Schwarzschild radius, and the width of a trace
  orbitX: number
  orbitY: number
  orbitUnit: number
  orbitWidth: number
  // In 3D the orbits lie across the line of flight and the camera sees them at an angle: the columns of
  // its turn for that plane (x then y, three numbers each), its focal length in CSS pixels (0 in the flat
  // mode, which draws them flat) and the black hole's distance in the same pixels
  orbitTurn: Float32Array
  orbitFocal: number
  orbitDepth: number
  doppler: number
  // The tint that shift gives the particles: its colours round the vanishing point and toward the edges,
  // how fast it turns from one to the other per half screen diagonal, and the most of a colour it replaces
  tintAhead: SceneColor
  tintEdge: SceneColor
  tintGradient: number
  tintLimit: number
  // How strongly brightness follows speed, the speed (CSS pixels per 60 Hz frame) that lights a particle
  // half way, and the frame length in 60 Hz reference frames it is judged by
  speedGlow: number
  speedKnee: number
  frameScale: number
  // Vanishing point of the particle field in CSS pixels, the centre of its doppler tint
  vanishX: number
  vanishY: number
  // A camera that zooms by more than this ratio in one frame, or moves the picture by more than this many
  // CSS pixels, has cut: the particles' strokes then start afresh instead of crossing the screen
  cutZoom: number
  cutShift: number
  // Photon ring energy around the circle, RING_BINS values
  ringTexels: Uint8Array
  // False while nothing feeds the ring: its energy is not read then, so it is not uploaded
  ringFed: boolean
  title: TitleSettings
  composite: CompositeSettings
  // The space sheet, drawn over the finished frame
  grid: GridSettings
  // The space lattice, drawn into the orbits' layer and read through the lens
  lattice: LatticeSettings
  // The flows (flows.ts), drawn into that layer too: one record for each slot. In 3D they lie where the
  // orbits do (orbitTurn)
  flows: FlowSettings[]
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

// e^(x * factor) for the composite shader, which takes it as 2^(x * rate). The shader's compiler turns
// exp(x) into 2^(x * log2 e) and, where the factor is a number written in the shader, folds the two into
// one constant in single precision. A uniform cannot be folded, so the same fold is done here: the number
// the code held gives the bytes it gave
const LOG2_E = Math.fround(Math.LOG2E)
const expRate = (factor: number) => Math.fround(Math.fround(factor) * LOG2_E)
// The same for e^(-x / seconds), a fall to about a third in that time
const decayRate = (seconds: number) => -Math.fround(Math.fround(1 / Math.fround(seconds)) * LOG2_E)

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

function setUniform3f (gl: WebGL2RenderingContext, uniform: CachedUniform, x: number, y: number, z: number) {
  if (uniform.x === x && uniform.y === y && uniform.z === z) return
  uniform.x = x
  uniform.y = y
  uniform.z = z
  gl.uniform3f(uniform.location, x, y, z)
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
 *    brighter of the particle and the scene, and draws the traces of the orbiting stars into their layer,
 *    both already at the camera's zoom,
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
  const orbitProgram = createProgram(gl, orbitVertexShaderSource, particleFragmentShaderSource, {
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
  const latticeProgram = createProgram(gl, latticeVertexShaderSource, particleFragmentShaderSource, {
    a_position: ATTRIBUTE_LOCATIONS.position,
    a_latticeLine: ATTRIBUTE_LOCATIONS.latticeLine
  })
  const flowProgram = createProgram(gl, flowVertexShaderSource, particleFragmentShaderSource, {
    a_flowCorner: ATTRIBUTE_LOCATIONS.flowCorner,
    a_flowSeed: ATTRIBUTE_LOCATIONS.flowSeed
  })
  const programs = [fadeProgram, particleProgram, orbitProgram, compositeProgram, gridProgram, latticeProgram, flowProgram]

  if (!fadeProgram || !particleProgram || !orbitProgram || !compositeProgram || !gridProgram || !latticeProgram || !flowProgram) {
    for (const program of programs) {
      if (program) gl.deleteProgram(program)
    }
    return null
  }

  // The particle field: its buffers and the passes that step it
  const madeField = createFieldFeedback(gl)
  if (!madeField) {
    for (const program of programs) gl.deleteProgram(program)
    return null
  }
  const field: FieldFeedback = madeField
  // Whether the composite pass reads the ring's light from the field this frame
  let ringLit = false

  const fadeUniforms = getUniforms(gl, fadeProgram, ['color'] as const)
  const particleUniforms = getUniforms(gl, particleProgram, ['resolution', 'pixelRatio', 'center', 'doppler', 'speedGlow', 'speedKnee', 'tintAhead', 'tintEdge', 'tint', 'frameScale', 'zoom', 'zoomFrom'] as const)
  const orbitUniforms = getUniforms(gl, orbitProgram, ['resolution', 'zoom', 'orbit', 'dimmed', 'turnX', 'turnY'] as const)
  const compositeUniforms = getUniforms(gl, compositeProgram, [
    'resolution', 'pixelRatio', 'time', 'hole', 'horizon', 'einstein', 'falloff', 'falloffPivot', 'lensCore', 'maxBend', 'lensReach', 'twistLimit', 'swirl', 'absorption', 'trace', 'spin', 'ring',
    'ringWidth', 'ringGlow', 'ringDoppler', 'ringSide', 'ringPhase', 'ringField', 'ringBase', 'ringFeed', 'ringLine', 'ringGlowShape', 'ringColor', 'ringApproaching', 'ringReceding',
    'center', 'starGlow', 'starRadius', 'sourcePower', 'glareRadius', 'exposure',
    'lightRadius', 'lightWidth', 'lightPower', 'lightSpeed', 'echoPower', 'echoDecay',
    'waveRadius', 'waveStrength', 'waveWidth', 'remnantGlow', 'remnantRedshift', 'remnantRadius',
    'holeOval', 'gravityWaveAmplitude', 'gravityWaveTime', 'gravityWaveOmega', 'gravityWaveInvDecay', 'gravityWaveRadius', 'gravityWaveCenter', 'gravityWaveTurn', 'companion', 'pair', 'pairWave', 'pairFront', 'pairDepth', 'turnRight', 'turnDown', 'turnAhead', 'backgroundStars',
    'starCell', 'starDensity', 'starFlare', 'starWarm', 'starCool', 'starLook', 'dustScale', 'dustThreshold', 'lightDustContrast',
    'titleCenter', 'titleHalfSize', 'titleAlpha', 'titleReveal', 'titleDissolve', 'titleDrift', 'titleGlow',
    'titleFlash', 'titleCooling', 'titleDust', 'titlePull', 'titleSwirl', 'titleReach', 'titleCapture', 'titleScale',
    'titleFringe', 'titleHalo', 'titleRedshift', 'titleGrain', 'titleBurn', 'titleFall', 'titleTidal', 'titleSpiral', 'titleSpread', 'titleStream', 'titleOrder', 'titleTrail', 'titleHeat', 'dustSweep', 'echoFloor', 'dustShock', 'dustBlow', 'dustDrift',
    'titleSpeck', 'titleWinkRest', 'titleWind', 'titleBurnShape', 'titleBurnRimWidth', 'titleFallShape', 'titleDustShape', 'titleDustCut', 'titleBurnEdge',
    'echoShape', 'echoSwell', 'dustMotion', 'dustFlare', 'starFlareRate', 'remnantShape', 'vignetteSpan', 'knee',
    'skyGrid', 'gridCell', 'skyGridLine', 'skyShift', 'skyRoll', 'orbits', 'nebula', 'nebulaColor', 'nebulaColorDeep', 'nebulaColorCore', 'nebulaShape', 'nebulaLook', 'nebulaPatch', 'nebulaDrift', 'gridPull', 'gridColor', 'gridHaze',
    'colorFlash', 'colorLight', 'colorDust', 'colorTitle', 'colorEmber',
    'cameraZoom', 'zoomCenter', 'layerZoom', 'shake', 'lensFringe', 'vignette', 'filmGrain', 'letterbox'
  ] as const)
  const gridUniforms = getUniforms(gl, gridProgram, [
    'resolution', 'pixelRatio', 'view', 'camera', 'well', 'lines', 'wave', 'waveSpread', 'waveTurn', 'lens', 'jolt', 'color', 'shadow', 'frame', 'well2', 'pairWave', 'pairAt', 'pairFront', 'shadow2', 'spin', 'roll', 'sheet', 'clearing', 'rings'
  ] as const)

  const latticeUniforms = getUniforms(gl, latticeProgram, [
    'resolution', 'zoom', 'row0', 'row1', 'row2', 'shift', 'vanish', 'hole', 'companion', 'lattice', 'anchor', 'color', 'fade'
  ] as const)

  const flowUniforms = getUniforms(gl, flowProgram, [
    'resolution', 'zoom', 'place', 'turnX', 'turnY', 'path', 'age', 'light', 'ride', 'sheetView', 'sheetTilt', 'sheetWell', 'sheetWell2', 'rideHole'
  ] as const)

  gl.useProgram(compositeProgram)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_image'), SCENE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_title'), TITLE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringEnergy'), RING_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_orbitTrails'), ORBIT_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_shadowShape'), SHADOW_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringLight'), RING_LIGHT_TEXTURE_UNIT)

  // Shared quad at location 0, bound once for every program
  const quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0)

  // A stroke is read one record an instance: the field's from the buffer its step wrote (field_feedback.ts),
  // an orbit's trace from the ring of rows. Points the three attributes at the trace `offset` bytes into
  // the trace buffer, which must be bound
  function pointInstances (offset: number) {
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.segment, 4, gl.FLOAT, false, INSTANCE_STRIDE, offset)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.style, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset + 16)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.color, 4, gl.UNSIGNED_BYTE, true, INSTANCE_STRIDE, offset + 24)
  }
  for (const location of INSTANCED_ATTRIBUTES) gl.vertexAttribDivisor(location, 1)

  // The lines of the space sheet never change: the grid vertex shader places them
  const gridBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, createGridInstances(), gl.STATIC_DRAW)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.gridLine, GRID_INSTANCE_FLOATS, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.gridLine, 1)

  // The lattice's lines never change either; they get their buffer the first time the lattice is shown
  const latticeBuffer = gl.createBuffer()
  let latticeFilled = false

  // The flows' particles and the pieces of a trail never change; they get their buffers the first time a
  // flow is shown
  const flowSeedBuffer = gl.createBuffer()
  const flowCornerBuffer = gl.createBuffer()
  let flowFilled = false
  // Whether the layer of lines holds the flows as they now stand. A step that is not shown leaves them
  // out: they have no past to keep, so only a frame that is seen pays for them
  let flowsLaid = false

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
  // The outline of a spinning hole's shadow, its radius all the way round; it repeats so the outline has no
  // seam. Half floats are filterable in WebGL2, and a radius needs more than 8 bits
  const shadowTexture = createLinearTexture(SHADOW_TEXTURE_UNIT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SHADOW_SAMPLES, 1, 0, gl.RED, gl.FLOAT, null)
  let shadowVersion = -1
  const titleTexture = createLinearTexture(TITLE_TEXTURE_UNIT)
  let titleWidth = 0
  let titleHeight = 0

  // The traces of the orbiting stars, a layer of its own that the composite pass reads through the lens.
  // It gets its full size only when the first star is drawn, and again after a resize
  const orbitTexture = createLinearTexture(ORBIT_TEXTURE_UNIT)
  const orbitFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, orbitTexture, 0)
  let orbitSized = false
  // Whether the layer may hold light, and whether the composite pass reads it this frame
  let orbitLit = false
  let orbitsShown = false

  // The stretches the stars have flown, a ring of records the layer is drawn from every frame. Rows of
  // them are written one after another and start again at the front when the end is reached, over the
  // oldest; the ring gets its room when the first star is drawn
  const traceBuffer = gl.createBuffer()
  let traceSized = false
  // Where each kept row begins, how many stretches it holds and how far the traces had dimmed when it was last flown, oldest first
  const rowStart = new Int32Array(TRACE_ROWS)
  const rowSize = new Uint8Array(TRACE_ROWS)
  const rowFlown = new Float64Array(TRACE_ROWS)
  let oldestRow = 0
  let rowCount = 0
  let traceDimmed = 0

  // The zoom the particles and the orbits were last drawn at: its fixed point in CSS pixels and the zoom
  let layerZoomX = 0
  let layerZoomY = 0
  let layerZoom = 1
  // The same for the frame before, which is where the particles' strokes start
  let fromZoomX = 0
  let fromZoomY = 0
  let fromZoom = 1

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
    flowsLaid = false
    // The picture is drawn again at the new size; the orbits' traces are lines and outlast it
    wipeScene(background)

    gl.useProgram(particleProgram)
    setUniform2f(gl, particleUniforms.resolution, width, height)
    setUniform1f(gl, particleUniforms.pixelRatio, ratio)
    gl.useProgram(orbitProgram)
    setUniform2f(gl, orbitUniforms.resolution, width, height)
    gl.useProgram(compositeProgram)
    setUniform2f(gl, compositeUniforms.resolution, width, height)
    setUniform1f(gl, compositeUniforms.pixelRatio, ratio)
    gl.useProgram(gridProgram)
    setUniform2f(gl, gridUniforms.resolution, width, height)
    setUniform1f(gl, gridUniforms.pixelRatio, ratio)
    gl.useProgram(latticeProgram)
    setUniform2f(gl, latticeUniforms.resolution, width, height)
    gl.useProgram(flowProgram)
    setUniform2f(gl, flowUniforms.resolution, width, height)
  }

  function wipeScene (background: readonly [number, number, number]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
    gl.clearColor(background[0] / 255, background[1] / 255, background[2] / 255, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    clearOrbits()
  }

  // A scene that starts over: the trails and the orbits' traces both go
  function clearScene (background: readonly [number, number, number]) {
    wipeScene(background)
    dropTraces()
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
    if (field.count() === 0) return
    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, frame.doppler)
    setUniform1f(gl, particleUniforms.speedGlow, frame.speedGlow)
    setUniform1f(gl, particleUniforms.speedKnee, frame.speedKnee)
    setUniform3f(gl, particleUniforms.tintAhead, frame.tintAhead.r, frame.tintAhead.g, frame.tintAhead.b)
    setUniform3f(gl, particleUniforms.tintEdge, frame.tintEdge.r, frame.tintEdge.g, frame.tintEdge.b)
    setUniform2f(gl, particleUniforms.tint, frame.tintGradient, frame.tintLimit)
    setUniform1f(gl, particleUniforms.frameScale, frame.frameScale)
    setUniform2f(gl, particleUniforms.center, frame.vanishX, frame.vanishY)
    setUniform4f(gl, particleUniforms.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform4f(gl, particleUniforms.zoomFrom, fromZoomX * ratio, fromZoomY * ratio, fromZoom, 0)
    field.bindStrokes()
    stampSegments(field.count())
  }

  // Forgets every trace
  function dropTraces () {
    oldestRow = 0
    rowCount = 0
  }

  // Takes the row of stretches the stars are flying into the ring: over the last row while they go on
  // with it, after it when a new one begins
  function keepRow (frame: FrameInput) {
    // The measure going back means the stars were made anew: their old traces are gone
    if (frame.orbitDimmed < traceDimmed) dropTraces()
    traceDimmed = frame.orbitDimmed

    const count = frame.orbitCount
    let newest = (oldestRow + rowCount - 1) % TRACE_ROWS
    if (rowCount === 0 || frame.orbitRowNew || rowSize[newest] !== count) {
      let start = rowCount === 0 ? 0 : rowStart[newest] + rowSize[newest]
      if (start + count > TRACE_CAPACITY) start = 0
      // The oldest rows give way where the new one lands, and when there is no row left to name it
      while (rowCount > 0 && (rowCount === TRACE_ROWS ||
        (rowStart[oldestRow] < start + count && rowStart[oldestRow] + rowSize[oldestRow] > start))) {
        oldestRow = (oldestRow + 1) % TRACE_ROWS
        rowCount--
      }
      newest = (oldestRow + rowCount) % TRACE_ROWS
      rowStart[newest] = start
      rowSize[newest] = count
      rowCount++
    }
    rowFlown[newest] = frame.orbitDimmed

    gl.bindBuffer(gl.ARRAY_BUFFER, traceBuffer)
    if (!traceSized) {
      traceSized = true
      gl.bufferData(gl.ARRAY_BUFFER, TRACE_CAPACITY * INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, rowStart[newest] * INSTANCE_STRIDE, frame.orbitRow, 0, count * INSTANCE_FLOATS)

    // Rows that have gone dark are let go, oldest first
    while (rowCount > 1 && frame.orbitDimmed - rowFlown[oldestRow] > 1) {
      oldestRow = (oldestRow + 1) % TRACE_ROWS
      rowCount--
    }
  }

  // The orbiting stars' layer is drawn anew every frame from the stretches kept: each is a line placed
  // around the black hole as it is now and at the camera's zoom, dimmed by its age in the vertex shader,
  // so the traces are sharp at any zoom, follow the hole and all reach black
  // Makes the layer of lines ready for this frame's orbits and lattice: its full size, cleared, bound
  function openLines () {
    if (!orbitSized) {
      orbitSized = true
      gl.activeTexture(gl.TEXTURE0 + ORBIT_TEXTURE_UNIT)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    orbitLit = true
  }

  function drawOrbits (frame: FrameInput) {
    keepRow(frame)
    gl.useProgram(orbitProgram)
    setUniform4f(gl, orbitUniforms.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform4f(gl, orbitUniforms.orbit, frame.orbitX * ratio, frame.orbitY * ratio, frame.orbitUnit * ratio, frame.orbitWidth * ratio)
    setUniform1f(gl, orbitUniforms.dimmed, frame.orbitDimmed)
    const turn = frame.orbitTurn
    setUniform4f(gl, orbitUniforms.turnX, turn[0], turn[1], turn[2], frame.orbitFocal * ratio)
    setUniform4f(gl, orbitUniforms.turnY, turn[3], turn[4], turn[5], frame.orbitDepth * ratio)

    // The kept rows lie in one run of the ring, or in two when they pass its end
    const newest = (oldestRow + rowCount - 1) % TRACE_ROWS
    const from = rowStart[oldestRow]
    const to = rowStart[newest] + rowSize[newest]
    gl.bindBuffer(gl.ARRAY_BUFFER, traceBuffer)
    if (from < to) {
      pointInstances(from * INSTANCE_STRIDE)
      stampSegments(to - from)
    } else {
      pointInstances(from * INSTANCE_STRIDE)
      stampSegments(TRACE_CAPACITY - from)
      pointInstances(0)
      stampSegments(to)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  // The lattice is drawn anew every frame into the layer of lines, bent towards the holes and seen by the
  // camera at its zoom, the brighter of a line and what is there so crossings do not add up
  function drawLattice (lattice: LatticeSettings, color: SceneColor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, latticeBuffer)
    if (!latticeFilled) {
      latticeFilled = true
      gl.bufferData(gl.ARRAY_BUFFER, createLatticeInstances(), gl.STATIC_DRAW)
      gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.latticeLine, LATTICE_INSTANCE_FLOATS, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.latticeLine, 1)
    }
    const u = latticeUniforms
    const turn = lattice.turn
    gl.useProgram(latticeProgram)
    setUniform4f(gl, u.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform4f(gl, u.row0, turn[0], turn[1], turn[2], lattice.focal * ratio)
    setUniform4f(gl, u.row1, turn[3], turn[4], turn[5], lattice.pivot)
    setUniform4f(gl, u.row2, turn[6], turn[7], turn[8], lattice.near)
    setUniform3f(gl, u.shift, turn[9], turn[10], turn[11])
    setUniform2f(gl, u.vanish, lattice.vanishX * ratio, lattice.vanishY * ratio)
    setUniform4f(gl, u.hole, lattice.holeX, lattice.holeY, lattice.holeZ, lattice.edge)
    setUniform4f(gl, u.companion, lattice.companionX, lattice.companionY, lattice.companionZ, lattice.companionEdge)
    setUniform4f(gl, u.lattice, lattice.cell, lattice.reach, lattice.warp, lattice.lineWidth * ratio)
    setUniform4f(gl, u.anchor, lattice.anchorX, lattice.anchorY, lattice.anchorZ, 0)
    setUniform3f(gl, u.fade, lattice.fadeFrom, lattice.farthest, lattice.gone)
    const light = lattice.brightness * lattice.gain
    setUniform4f(gl, u.color, Math.min(color.r * light, 1), Math.min(color.g * light, 1), Math.min(color.b * light, 1), 1)
    gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.latticeLine)
    gl.blendEquationSeparate(gl.MAX, gl.FUNC_ADD)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, LATTICE_INSTANCE_COUNT)
    gl.blendEquation(gl.FUNC_ADD)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.latticeLine)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  // The flows are drawn anew every frame into the layer of lines: every particle and its trail are placed by
  // the vertex shader from the flow's clock, the brighter of a stroke and what is there
  function drawFlows (frame: FrameInput) {
    if (!flowFilled) {
      flowFilled = true
      gl.bindBuffer(gl.ARRAY_BUFFER, flowCornerBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, createFlowCorners(), gl.STATIC_DRAW)
      gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.flowCorner, FLOW_CORNER_FLOATS, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, flowSeedBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, createFlowSeeds(), gl.STATIC_DRAW)
      gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.flowSeed, 1)
    }
    const u = flowUniforms
    const turn = frame.orbitTurn
    gl.useProgram(flowProgram)
    setUniform4f(gl, u.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform4f(gl, u.turnX, turn[0], turn[1], turn[2], frame.orbitFocal * ratio)
    // Particles on Sheet lays the flows on the sheet the particles were stepped with
    const step = frame.step
    if (step.ride > 0) {
      setUniform4f(gl, u.ride, step.ride, step.rideCos, step.rideSin, step.sheetNear)
      setUniform4f(gl, u.sheetView, step.sheetViewX, step.sheetViewY, step.sheetDistance, ratio)
      setUniform4f(gl, u.sheetTilt, step.sheetSin, step.sheetCos, step.sheetRollCos, step.sheetRollSin)
      setUniform4f(gl, u.sheetWell, step.sheetWellX, step.sheetWellZ, step.sheetThroat, step.sheetDepth)
      setUniform4f(gl, u.sheetWell2, step.sheetWell2X, step.sheetWell2Z, step.sheetThroat2, step.sheetDepth2)
      setUniform2f(gl, u.rideHole, step.holeX * ratio, step.holeY * ratio)
    } else {
      setUniform4f(gl, u.ride, 0, 1, 0, 0)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, flowSeedBuffer)
    gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.flowCorner)
    gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.flowSeed)
    gl.blendEquationSeparate(gl.MAX, gl.FUNC_ADD)
    for (let slot = 0; slot < frame.flows.length; slot++) {
      const flow = frame.flows[slot]
      if (!(flow.brightness > 0) || flow.count === 0) continue
      // Each flow reads its own stretch of the particles' numbers
      gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.flowSeed, FLOW_SEED_FLOATS, gl.FLOAT, false, 0, slot * FLOW_CAPACITY * FLOW_SEED_FLOATS * 4)
      setUniform4f(gl, u.place, flow.x * ratio, flow.y * ratio, flow.unit * ratio, flow.size * ratio)
      setUniform4f(gl, u.turnY, turn[3], turn[4], turn[5], frame.orbitFocal > 0 ? flow.depth * ratio : 1)
      setUniform4f(gl, u.path, flow.from, flow.to, flow.spread, flow.wound)
      setUniform3f(gl, u.age, flow.phase, flow.lives, flow.piece)
      setUniform4f(gl, u.light, flow.color.r, flow.color.g, flow.color.b, flow.brightness)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, FLOW_VERTEX_COUNT, flow.count)
    }
    gl.blendEquation(gl.FUNC_ADD)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.flowCorner)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.flowSeed)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
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
      setUniform4f(gl, u.titleSpeck, 1 / Math.max(title.speckSize, 0.1), 1 / Math.max(title.currentSize, 0.1), title.beyondSpeed, Math.max(title.wink, 0.001))
      setUniform1f(gl, u.titleWinkRest, 1 - title.wink)
      setUniform3f(gl, u.titleWind, title.spiralRadius, title.spiralMin, Math.max(title.spiralMax, title.spiralMin))
      setUniform4f(gl, u.titleBurnShape, Math.max(title.burnGrain, 0.1), Math.max(title.burnFine, 0.1), title.burnEnds, title.burnRim)
      setUniform1f(gl, u.titleBurnRimWidth, Math.max(title.burnRimWidth, 0.001))
      setUniform4f(gl, u.titleFallShape, title.currentContrast, Math.max(title.orderReach, 0.001), 1 + Math.max(title.captureEdge, 0), 1 + Math.max(title.reachFade, 0.001))
      setUniform3f(gl, u.titleDustShape, Math.max(title.dustSize, 0.1), title.dustClumps, 1 - title.dustClumps)
      setUniform2f(gl, u.titleDustCut, title.dustLow, Math.max(title.dustHigh, title.dustLow + 0.001))
      setUniform3f(gl, u.titleBurnEdge, title.burnMix, 1 - title.burnMix, Math.max(title.burnEdge, 0.001))
    }
    setUniformColor(gl, u.colorFlash, settings.colorFlash)
    setUniformColor(gl, u.colorLight, settings.colorLight)
    setUniformColor(gl, u.colorDust, settings.colorDust)
    setUniformColor(gl, u.colorTitle, settings.colorTitle)
    setUniformColor(gl, u.colorEmber, settings.colorEmber)
    setUniform1f(gl, u.cameraZoom, Math.max(settings.cameraZoom, 0.05))
    setUniform2f(gl, u.zoomCenter, settings.zoomX * ratio, settings.zoomY * ratio)
    setUniform4f(gl, u.layerZoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform2f(gl, u.shake, settings.shakeX * ratio, settings.shakeY * ratio)
    setUniform1f(gl, u.lensFringe, settings.lensFringe * ratio)
    setUniform1f(gl, u.vignette, settings.vignette)
    setUniform1f(gl, u.filmGrain, settings.filmGrain)
    setUniform1f(gl, u.letterbox, settings.letterbox * ratio)
    setUniform2f(gl, u.vignetteSpan, settings.vignetteStart, Math.max(settings.vignetteEnd, settings.vignetteStart + 0.001))
    // The knee and the room above it, which the roll-off fills
    const knee = Math.min(settings.filmKnee, 0.999)
    setUniform3f(gl, u.knee, knee, 1 - knee, decayRate(1 - knee))
    setUniform1f(gl, u.time, settings.time)
    setUniform2f(gl, u.hole, settings.holeX * ratio, settings.holeY * ratio)
    setUniform1f(gl, u.horizon, settings.horizon * ratio)
    setUniform2f(gl, u.holeOval, settings.holeOvalX, settings.holeOvalY)
    setUniform1f(gl, u.einstein, settings.einstein * ratio)
    setUniform1f(gl, u.falloff, settings.falloff)
    setUniform1f(gl, u.falloffPivot, Math.max(settings.falloffPivot * ratio, 1))
    setUniform1f(gl, u.lensCore, settings.lensCore)
    setUniform1f(gl, u.maxBend, settings.maxBend)
    setUniform1f(gl, u.lensReach, settings.lensReach)
    setUniform1f(gl, u.twistLimit, settings.twistLimit)
    setUniform1f(gl, u.swirl, settings.swirl)
    setUniform1f(gl, u.absorption, settings.absorption)
    setUniform4f(gl, u.trace, settings.traceU, settings.traceScale * ratio, settings.traceShare, 0)
    setUniform4f(gl, u.spin, settings.spin, Math.cos(settings.spinTilt), Math.sin(settings.spinTilt), settings.spinAxis)
    if (settings.shadowShape.version !== shadowVersion) {
      shadowVersion = settings.shadowShape.version
      gl.activeTexture(gl.TEXTURE0 + SHADOW_TEXTURE_UNIT)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SHADOW_SAMPLES, 1, gl.RED, gl.FLOAT, settings.shadowShape.table)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
    }
    setUniform1f(gl, u.ring, settings.ring)
    setUniform1f(gl, u.ringWidth, settings.ringWidth)
    setUniform1f(gl, u.ringGlow, settings.ringGlow)
    setUniform1f(gl, u.ringDoppler, settings.ringDoppler)
    setUniform1f(gl, u.ringSide, settings.ringSide)
    setUniform1f(gl, u.ringPhase, settings.ringPhase)
    setUniform1f(gl, u.ringField, ringLit ? 1 : 0)
    setUniform1f(gl, u.ringBase, settings.ringBase)
    setUniform1f(gl, u.ringFeed, settings.ringFeed)
    setUniform4f(gl, u.ringLine, settings.ringLineMin, settings.ringOffset, settings.ringReach, settings.ringSoftness)
    setUniform4f(gl, u.ringGlowShape, settings.ringGlowCore, settings.ringGlowSkirt, settings.ringGlowCoreShare, settings.ringGlowSkirtShare)
    setUniform3f(gl, u.ringColor, settings.ringColor.r, settings.ringColor.g, settings.ringColor.b)
    setUniform3f(gl, u.ringApproaching, settings.ringApproaching.r, settings.ringApproaching.g, settings.ringApproaching.b)
    setUniform3f(gl, u.ringReceding, settings.ringReceding.r, settings.ringReceding.g, settings.ringReceding.b)
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
    setUniform4f(gl, u.echoShape, Math.max(settings.echoHoldThin, 0.001), Math.max(settings.echoHoldThick, 0.001),
      Math.max(settings.echoHoldThin, settings.echoHoldThick, 0.001), Math.max(settings.echoReach, 0.001))
    setUniform2f(gl, u.echoSwell, settings.echoSwell, Math.max(settings.echoSwellMin, 0.001))
    setUniform1f(gl, u.waveRadius, settings.waveRadius * ratio)
    setUniform1f(gl, u.waveStrength, settings.waveStrength * ratio)
    setUniform1f(gl, u.waveWidth, Math.max(settings.waveWidth * ratio, 1))
    setUniform1f(gl, u.remnantGlow, settings.remnantGlow)
    setUniform1f(gl, u.remnantRedshift, settings.remnantRedshift)
    setUniform1f(gl, u.remnantRadius, Math.max(settings.remnantRadius * ratio, 0.5))
    setUniform4f(gl, u.remnantShape, Math.min(Math.max(settings.remnantEmberAt, 0.001), 0.999), settings.remnantWhiteness, settings.remnantDeep, settings.remnantDim)
    // A wave's lengths are those of the place it left from, as large as the camera sees that place
    const waveRatio = ratio * settings.waveScale
    setUniform1f(gl, u.gravityWaveAmplitude, settings.gravityWaveAmplitude * waveRatio)
    if (settings.gravityWaveAmplitude > 0) {
      setUniform1f(gl, u.gravityWaveTime, settings.gravityWaveTime)
      setUniform1f(gl, u.gravityWaveOmega, 2 * Math.PI * settings.gravityWaveFrequency)
      setUniform1f(gl, u.gravityWaveInvDecay, 1 / Math.max(settings.gravityWaveDecay, 0.001))
      setUniform1f(gl, u.gravityWaveRadius, Math.max(settings.gravityWaveRadius * waveRatio, 1))
      setUniform2f(gl, u.gravityWaveCenter, settings.gravityWaveX * ratio, settings.gravityWaveY * ratio)
      setUniform4f(gl, u.gravityWaveTurn, Math.cos(2 * settings.gravityWaveAngle), Math.sin(2 * settings.gravityWaveAngle),
        settings.gravityWaveSpin, Math.max(settings.gravityWaveSpeed * waveRatio, 1))
    }
    setUniform4f(gl, u.companion, settings.companionX * ratio, settings.companionY * ratio, settings.companionRadius * ratio, settings.companionEinstein * ratio)
    setUniform3f(gl, u.pairDepth, settings.pairLensMain, settings.pairLensCompanion, settings.pairNearer)
    setUniform3f(gl, u.turnRight, settings.turn[0], settings.turn[1], settings.turn[2])
    setUniform3f(gl, u.turnDown, settings.turn[3], settings.turn[4], settings.turn[5])
    setUniform3f(gl, u.turnAhead, settings.turn[6], settings.turn[7], settings.turn[8])
    if (settings.pairWave > 0) {
      const pairRatio = Math.max(ratio * settings.pairScale, 0.0001)
      setUniform4f(gl, u.pairWave, settings.pairWave * pairRatio, settings.pairPhase, settings.pairPitch / pairRatio, Math.max(settings.gravityWaveRadius * pairRatio, 1))
      setUniform2f(gl, u.pair, settings.pairX * ratio, settings.pairY * ratio)
      setUniform4f(gl, u.pairFront, settings.pairFront, Math.max(settings.gravityWaveSpeed * pairRatio, 1), Math.max(settings.pairFrontSoft, 0.001), 0)
    } else {
      setUniform4f(gl, u.pairWave, 0, 0, 0, 1)
    }
    setUniform1f(gl, u.backgroundStars, settings.backgroundStars)
    setUniform1f(gl, u.starCell, Math.max(settings.starCell, 1))
    setUniform1f(gl, u.starDensity, settings.starDensity)
    setUniform1f(gl, u.starFlare, settings.starFlare)
    setUniform4f(gl, u.nebula, settings.nebula, settings.nebulaShiftX, settings.nebulaShiftY, settings.nebulaWrap)
    if (settings.nebula > 0) {
      setUniform3f(gl, u.nebulaColor, settings.nebulaColor.r, settings.nebulaColor.g, settings.nebulaColor.b)
      setUniform3f(gl, u.nebulaColorDeep, settings.nebulaColorDeep.r, settings.nebulaColorDeep.g, settings.nebulaColorDeep.b)
      setUniform3f(gl, u.nebulaColorCore, settings.nebulaColorCore.r, settings.nebulaColorCore.g, settings.nebulaColorCore.b)
      // Sparseness slides the level the clouds start at across the noise, which spans 0..0.875 around 0.44
      setUniform4f(gl, u.nebulaShape, Math.max(settings.nebulaScale, 1), NEBULA_LEVEL_LOW + (NEBULA_LEVEL_HIGH - NEBULA_LEVEL_LOW) * settings.nebulaSparseness,
        Math.max(settings.nebulaEdge, 0.001), settings.nebulaWarp)
      setUniform4f(gl, u.nebulaLook, settings.nebulaContrast, settings.nebulaGrain, settings.nebulaCore, Math.min(settings.nebulaCoreFrom, 0.999))
      // The share of the sky the second colour takes moves the level its patches turn at from above the noise
      // to below it
      const soft = Math.max(settings.nebulaPatchSoftness, 0.001)
      const middle = 1 + soft / 2 - settings.nebulaPatchShare * (1 + soft)
      setUniform3f(gl, u.nebulaPatch, Math.max(settings.nebulaPatch * settings.nebulaScale, 1), middle - soft / 2, middle + soft / 2)
      setUniform2f(gl, u.nebulaDrift, settings.nebulaDriftX, settings.nebulaDriftY)
    }
    if (settings.backgroundStars > 0) {
      const warm = settings.starWarm
      const cool = settings.starCool
      setUniform4f(gl, u.starWarm, warm.r, warm.g, warm.b, settings.starFaintest)
      setUniform4f(gl, u.starCool, cool.r, cool.g, cool.b, 1 - settings.starFaintest)
      setUniform4f(gl, u.starLook, settings.starSpread, 1 - settings.starTwinkle, settings.starTwinkle, settings.starTwinkleSpeed)
    }
    setUniform1f(gl, u.starFlareRate, decayRate(Math.max(settings.starFlareDecay, 0.001)))
    setUniform1f(gl, u.dustScale, Math.max(settings.dustScale, 1))
    setUniform1f(gl, u.dustThreshold, Math.min(settings.dustThreshold, 0.99))
    setUniform1f(gl, u.lightDustContrast, settings.lightDustContrast)
    setUniform1f(gl, u.dustSweep, settings.dustSweep)
    setUniform1f(gl, u.echoFloor, settings.echoFloor)
    setUniform1f(gl, u.dustShock, settings.dustShock)
    setUniform1f(gl, u.dustBlow, settings.dustBlow)
    setUniform1f(gl, u.dustDrift, settings.dustDrift)
    setUniform3f(gl, u.dustMotion, settings.dustDriftX, settings.dustDriftY, decayRate(Math.max(settings.dustBlowTime, 0.001)))
    setUniform3f(gl, u.dustFlare, settings.dustShockOffset, expRate(-settings.dustShockSharpness), settings.dustShockTint)
    setUniform1f(gl, u.orbits, orbitsShown ? 1 : 0)
    setUniform1f(gl, u.skyGrid, settings.skyGrid)
    if (settings.skyGrid > 0) {
      setUniform1f(gl, u.gridCell, Math.max(settings.gridCell, 1))
      setUniform1f(gl, u.gridPull, settings.gridPull)
      if (settings.gridPull > 0) {
        const haze = Math.max(settings.gridHaze, 0.1) * ratio
        setUniform2f(gl, u.gridHaze, haze, haze * (1 - Math.min(Math.max(settings.gridHazeSpan, 0.05), 0.95)))
      }
      setUniform3f(gl, u.gridColor, settings.gridColor.r, settings.gridColor.g, settings.gridColor.b)
      setUniform1f(gl, u.skyGridLine, settings.skyGridLine * 0.5)
    }
    setUniform4f(gl, u.skyShift, settings.starShiftX, settings.starShiftY, settings.gridShiftX, settings.gridShiftY)
    setUniform3f(gl, u.skyRoll, Math.cos(settings.skyRoll), Math.sin(settings.skyRoll), settings.skyRoll !== 0 ? 1 : 0)
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
    setUniform4f(gl, u.spin, grid.spinCos, grid.spinSin, grid.spun, 0)
    setUniform3f(gl, u.roll, grid.rollCos, grid.rollSin, grid.rolled)
    setUniform2f(gl, u.lines, Math.max(grid.cell, 1), Math.max(grid.span, 1))
    setUniform4f(gl, u.sheet, grid.near, grid.lineScale, grid.fadeFrom, 0)
    // A spoke is half of a line through the hole
    setUniform2f(gl, u.rings, Math.min(Math.floor(grid.rings), GRID_LINES_PER_SIDE), Math.min(Math.floor(grid.spokes / 2), GRID_LINES_PER_SIDE))
    // Whole no nearer than gone
    setUniform2f(gl, u.clearing, grid.clearFrom, Math.max(grid.clearTo, grid.clearFrom))
    if (settings.gravityWaveAmplitude > 0) {
      setUniform4f(gl, u.wave, settings.gravityWaveAmplitude * grid.waveLift, settings.gravityWaveTime,
        2 * Math.PI * settings.gravityWaveFrequency, 1 / Math.max(settings.gravityWaveDecay, 0.001))
      setUniform2f(gl, u.waveSpread, Math.max(settings.gravityWaveRadius, 1), Math.max(settings.gravityWaveSpeed, 1))
      // The sheet looks at the scene from the other side of the screen's plane, so the oval turns the other way
      setUniform4f(gl, u.waveTurn, Math.cos(2 * grid.ringPhase), Math.sin(2 * grid.ringPhase), -settings.gravityWaveSpin, 0)
    } else {
      setUniform4f(gl, u.wave, 0, 0, 0, 0)
    }
    setUniform4f(gl, u.well2, grid.well2X, grid.well2Z, grid.throat2, grid.depth2)
    // The sheet looks at the pair from the other side of the screen's plane, so its wave turns the other way
    if (settings.pairWave > 0 && grid.throat2 > 0) {
      setUniform4f(gl, u.pairWave, settings.pairWave * grid.waveLift, grid.pairPhase, -settings.pairPitch, Math.max(settings.gravityWaveRadius, 1))
      setUniform2f(gl, u.pairAt, grid.pairX, grid.pairZ)
      setUniform4f(gl, u.pairFront, settings.pairFront, Math.max(settings.gravityWaveSpeed, 1), Math.max(settings.pairFrontSoft, 0.001), 0)
    } else {
      setUniform4f(gl, u.pairWave, 0, 0, 0, 1)
    }
    setUniform4f(gl, u.lens, settings.zoomX, settings.zoomY, zoom, 0)
    setUniform2f(gl, u.jolt, settings.shakeX, settings.shakeY)
    setUniform4f(gl, u.color, settings.gridColor.r * grid.brightness, settings.gridColor.g * grid.brightness, settings.gridColor.b * grid.brightness, 1)
    // Where the composite pass put the black hole on the frame
    setUniform4f(gl, u.shadow,
      (settings.zoomX + (settings.holeX - settings.shakeX - settings.zoomX) * zoom) * ratio,
      (settings.zoomY + (settings.holeY - settings.shakeY - settings.zoomY) * zoom) * ratio,
      settings.horizon * zoom * ratio, 0)
    setUniform4f(gl, u.shadow2,
      (settings.zoomX + (settings.companionX - settings.shakeX - settings.zoomX) * zoom) * ratio,
      (settings.zoomY + (settings.companionY - settings.shakeY - settings.zoomY) * zoom) * ratio,
      settings.companionRadius * zoom * ratio, 0)
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
      // The particles and the orbits are drawn magnified, so a zoom shows them sharp. A camera that
      // pulls back (a zoom below 1) is left to the composite pass, which then reads a wider view
      fromZoom = layerZoom
      fromZoomX = layerZoomX
      fromZoomY = layerZoomY
      layerZoom = Math.max(frame.composite.cameraZoom, 1)
      layerZoomX = layerZoom > 1 ? frame.composite.zoomX : 0
      layerZoomY = layerZoom > 1 ? frame.composite.zoomY : 0
      const turned = layerZoom / fromZoom
      const shifted = (Math.abs(layerZoomX - fromZoomX) + Math.abs(layerZoomY - fromZoomY)) * (Math.max(layerZoom, fromZoom) - 1)
      if (turned > frame.cutZoom || turned * frame.cutZoom < 1 || shifted > frame.cutShift) {
        fromZoom = layerZoom
        fromZoomX = layerZoomX
        fromZoomY = layerZoomY
      }
      // The field is stepped on the graphics card, and what it left lights the photon ring
      field.step(frame)
      field.lightRing(frame)
      ringLit = field.ringKept && frame.step.ringEnergy !== null
      gl.viewport(0, 0, width, height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer)
      if (frame.fadeAlpha > 0) {
        gl.useProgram(fadeProgram)
        setUniform4f(gl, fadeUniforms.color, r / 255, g / 255, b / 255, frame.fadeAlpha)
        gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
      }
      drawParticles(frame)
      // The orbits' traces, the lattice and the flows share one layer of lines
      const latticeShown = frame.lattice.brightness > 0
      let flowsShown = false
      for (let slot = 0; slot < frame.flows.length; slot++) {
        if (frame.flows[slot].brightness > 0 && frame.flows[slot].count > 0) flowsShown = true
      }
      flowsLaid = flowsShown && frame.present
      const linesShown = latticeShown || flowsLaid
      if (frame.orbitCount > 0 || linesShown) openLines()
      if (frame.orbitCount > 0) drawOrbits(frame)
      if (latticeShown) drawLattice(frame.lattice, frame.composite.gridColor)
      if (flowsLaid) drawFlows(frame)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      // The last star gone, its traces go with it
      if (frame.orbitCount === 0) {
        if (!linesShown) clearOrbits()
        dropTraces()
      }
      orbitsShown = frame.orbitCount > 0 || linesShown

      if (frame.ringFed) {
        gl.activeTexture(gl.TEXTURE0 + RING_TEXTURE_UNIT)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RING_BINS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame.ringTexels)
        gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
      }
    }
    // A flow is whole in the frame it is first asked for, a still one too: a frame that moves nothing and
    // is shown lays the flows into the layer of lines, over the orbits and the lattice if they are there
    if (!frame.updateScene && frame.present && !flowsLaid) {
      let flowsShown = false
      for (let slot = 0; slot < frame.flows.length; slot++) {
        if (frame.flows[slot].brightness > 0 && frame.flows[slot].count > 0) flowsShown = true
      }
      if (flowsShown) {
        if (orbitLit) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, orbitFramebuffer)
        } else {
          openLines()
          if (frame.lattice.brightness > 0) drawLattice(frame.lattice, frame.composite.gridColor)
        }
        drawFlows(frame)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        flowsLaid = true
        orbitsShown = true
      }
    }
    if (!frame.present) return
    composite(frame.composite, frame.title)
    if (frame.grid.brightness > 0) drawGrid(frame.grid, frame.composite)
  }

  function dispose () {
    for (const location of INSTANCED_ATTRIBUTES) gl.vertexAttribDivisor(location, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.gridLine, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.latticeLine, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.flowSeed, 0)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(sceneFramebuffer)
    gl.deleteTexture(sceneTexture)
    gl.deleteFramebuffer(orbitFramebuffer)
    gl.deleteTexture(orbitTexture)
    gl.deleteTexture(titleTexture)
    gl.deleteTexture(ringTexture)
    gl.deleteTexture(shadowTexture)
    gl.deleteBuffer(quadBuffer)
    field.dispose()
    gl.deleteBuffer(traceBuffer)
    gl.deleteBuffer(gridBuffer)
    gl.deleteBuffer(latticeBuffer)
    gl.deleteBuffer(flowSeedBuffer)
    gl.deleteBuffer(flowCornerBuffer)
    for (const program of programs) gl.deleteProgram(program)
  }

  return { resize, setTitle, clearScene, render, dispose }
}
