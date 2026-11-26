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
  flowVertexShaderSource,
  NEBULA_LAYERS,
  STARS_PER_CELL,
  STAR_RINGS
} from './webgl_shaders'
import { RING_LIGHT_TEXTURE_UNIT, SHADOW_TEXTURE_UNIT, createFieldFeedback, type FieldFeedback, type FieldInput } from './field_feedback'
import type { SceneColor } from './scene_color'
import type { StepSettings } from './particle_simulation'
import { MAX_ORBITERS, STRETCH_FLOATS, STRETCH_SECONDS } from './orbiters'
import type { TitleSprite } from './title_sprite'
import { RING_BINS } from './ring_energy'
import { SHADOW_SAMPLES, type ShadowShape } from './kerr_shadow'
import { GRID_INSTANCE_COUNT, GRID_INSTANCE_FLOATS, GRID_LINES_PER_SIDE, createGridInstances, sendSheet, SHEET_UNIFORMS, type GridSettings } from './space_grid'
import { LATTICE_INSTANCE_COUNT, LATTICE_INSTANCE_FLOATS, createLatticeInstances, type LatticeSettings } from './space_lattice'
import { FLOW_CAPACITY, FLOW_CORNER_FLOATS, FLOW_SEED_FLOATS, FLOW_VERTEX_COUNT, createFlowCorners, createFlowSeeds, type FlowSettings } from './flows'

const STRETCH_STRIDE = STRETCH_FLOATS * 4
const INSTANCED_ATTRIBUTES = [ATTRIBUTE_LOCATIONS.segment, ATTRIBUTE_LOCATIONS.style, ATTRIBUTE_LOCATIONS.color]

const SCENE_TEXTURE_UNIT = 0
const TITLE_TEXTURE_UNIT = 1
const RING_TEXTURE_UNIT = 2
const ORBIT_TEXTURE_UNIT = 3
// 3D: what stands nearer the camera than the black holes, the particles' trails and the lines, each a
// layer of its own that the composite pass lays over the holes unbent
const FRONT_TEXTURE_UNIT = 6
const FRONT_LINES_TEXTURE_UNIT = 7

// What is left of the brightest trail in front of the holes, a share of full, once the front has ended,
// when that layer is let go: below half a step of its 8 bits
const FRONT_DARK = 0.5 / 255

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
  // The power of the pull whose cosine shapes the stylized lens's bubble
  lensBubble: number
  twistLimit: number
  swirl: number
  absorption: number
  // 3D: the share of the light in front of the holes added to what is there instead of the brighter of the
  // two (Front Add), and the share of the waves' and the matter front's slide it takes (Front Waves)
  frontAdd: number
  frontWaves: number
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
  // The grid on the horizon: its brightness (0 turns it off); the camera it is seen from and the scale of the
  // picture, as traceU and traceScale but for either lens; the axis it is drawn about, as spinTilt and
  // spinAxis but kept while the hole does not spin; the longitude of the camera's meridian less the turn the
  // horizon has made, radians, and the horizon's rate of turn, radians per M; its cells from pole to pole;
  // the width of its lines in CSS pixels and the most light lines too dense to draw give
  horizonGrid: number
  horizonGridU: number
  horizonGridScale: number
  horizonTilt: number
  horizonAxis: number
  horizonTurn: number
  horizonRate: number
  horizonCells: number
  horizonLine: number
  horizonHaze: number
  // The cell size in CSS pixels below which its lines start to turn to haze and that at which the haze is
  // whole; its cells round the equator; the share of the shift the horizon's turn gives its light; the share
  // of its brightness the second hole's grid has, seen at companionGridScale pixels of tan(angle / 2) from
  // that hole (CSS pixels) by a camera 1 / companionGridU of its Schwarzschild radii away, about an axis tilted
  // companionGridTilt from the line to the camera and turned companionGridAxis on the screen, with the
  // camera's meridian at companionGridTurn less the turn its horizon has made, its spin companionGridSpin and
  // that horizon turning at companionGridRate radians per M
  horizonHazeFrom: number
  horizonHazeTo: number
  horizonCellsAround: number
  horizonShift: number
  horizonCompanion: number
  companionGridScale: number
  companionGridTurn: number
  companionGridU: number
  companionGridRate: number
  companionGridSpin: number
  companionGridTilt: number
  companionGridAxis: number
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
  // Its lens: the radius it pulls no harder inside, in its shadow's radii, and 0 a point mass .. 1 the
  // stylized lens; its own spin (a/M, 0 = none), the turn of its axis on the screen and its shadow's
  // outline; its ring's Doppler contrast, the angle of the bright side and the light of what falls in
  companionLensCore: number
  companionLensStyle: number
  companionSpin: number
  companionSpinAxis: number
  companionShape: ShadowShape
  companionRingDoppler: number
  companionRingSide: number
  companionRingFeed: number
  // The share of the nearer hole's bend the waves are read through: the second hole's, the main one's
  waveLensCompanion: number
  waveLensMain: number
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
  // Zeros while the two stand side by side
  pairLensMain: number
  pairLensCompanion: number
  pairNearer: number
  // The plane the waves and the ringing oval lie in (the pair's orbit, or the plane across the line of
  // flight for a hole alone), as the camera sees its two directions: the first's right and down on the
  // picture, then the second's
  pairPlane: Float32Array
  // The 3D camera's turn, row by row: where its right, its down and its line of sight point in the scene
  // (the scene's own axes in the flat mode). The sky is seen through it
  turn: Float32Array
  // How far the sky has turned from the flat mode's backdrop (0) to the sphere round the 3D camera (1): the
  // share the 3D camera has eased in by
  skySphere: number
  // The sky's centre, as a share of the way from the middle of the screen to the field's vanishing point
  // (skyVanishX, skyVanishY, CSS pixels); its sphere's radius in CSS pixels, 0 the focal length; the share by
  // which the flat backdrop is read on the plane ahead while 3D eases in
  skyCenter: number
  skyVanishX: number
  skyVanishY: number
  skySize: number
  skyBend: number
  backgroundStars: number
  starCell: number
  starDensity: number
  // The share of its cell a star may stand in, the stars a cell may hold, the rings of neighbouring cells a
  // star is drawn from; the 3D sky's cells from equal lengths on a face (0) to equal angles (1), and how far
  // a cell's chance follows the share of sky it covers
  starPlacement: number
  starsPerCell: number
  starNeighbors: number
  starCellWarp: number
  starSkyEven: number
  starFlare: number
  // The nebula's brightness (0 turns it off) and its colours
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
  // The CSS pixels of space the 3D sky's clouds have been read further along so far
  nebulaSpaceX: number
  nebulaSpaceY: number
  nebulaSpaceZ: number
  // Its layers of noise: how many, each how many times finer, with what share of the light of the one before;
  // the curling noise's size as a share of the clouds', the grain's as a multiple of the finest layer's
  nebulaDetail: number
  nebulaLacunarity: number
  nebulaRoughness: number
  nebulaCurlSize: number
  nebulaGrainSize: number
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
  // The noise of the dust's clouds: its layers (a share brings the last in partly), how much finer and how
  // much fainter each is than the one before, how far a slower noise curls them and how fine that one is
  // next to the clouds; and the power of the freshness of struck dust's glow that is the light's colour in it
  dustLayers: number
  dustFineness: number
  dustRoughness: number
  dustWarp: number
  dustWarpScale: number
  echoTintEase: number
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
  // The share by which it lies on the sky's sphere in latitudes and longitudes rather than on its box, and the
  // power of the slant its lines keep their width by
  gridSphere: number
  gridSlant: number
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
  // How the fringe grows from the middle to the corners: the power of the distance, 1 evenly
  lensFringeEase: number
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
  // The streak's copies and how far each lags the one before, a share of the fall
  trailCopies: number
  trailLag: number
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
  // Stars in orbit: `orbitRow` holds the stretch each of the `orbitCount` stars is flying, in the scene's
  // three coordinates, in Schwarzschild radii from the black hole. The renderer keeps the stretches and
  // draws the traces from them
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
  // In 3D the camera sees the orbits at an angle: the columns of its turn (where it sends the scene's
  // x, then y, then z, three numbers each), its focal length in CSS pixels (0 in the flat mode, which
  // draws them and the flows flat) and the black hole's distance in the same pixels, which the flows are
  // set at too
  orbitTurn: Float32Array
  orbitFocal: number
  orbitDepth: number
  doppler: number
  // The tint that shift gives the particles: its colours round the vanishing point and toward the edges,
  // how fast it turns from one to the other per half screen diagonal, and the most of a colour it replaces
  tintAhead: SceneColor
  tintEdge: SceneColor
  // the colour it turns past a quarter turn off the line of flight, whole straight behind it
  tintBehind: SceneColor
  tintGradient: number
  tintLimit: number
  // Vanishing point of the particle field in CSS pixels, then the line of flight the doppler tint is
  // measured from: where the field's far end lies for the camera (the scene's +z through the camera's
  // turn, 0, 0, 1 straight on) and the focal length in CSS pixels
  vanishX: number
  vanishY: number
  flightX: number
  flightY: number
  flightZ: number
  flightFocal: number
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
  // The flows (flows.ts), drawn into that layer too: one record for each slot, each with its own plane as
  // the camera sees it, set at the black hole's distance with orbitFocal
  flows: FlowSettings[]
  // Which set of numbers the flows' particles start from (Flow Seed, a whole number; 0 the set in the code)
  flowSeed: number
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

// The uniforms every line program takes its side of the holes by (SIDE_GLSL)
type SideUniforms = Record<'side' | 'sideMain' | 'sideSecond' | 'sideBend' | 'sideShape', CachedUniform>

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
 *    In 3D, while something can stand in front of the black holes, what lies nearer the camera than them
 *    goes into a second scene texture, faded the same way, and a second layer of lines: one draw
 *    writes both targets, each stroke into the one on its side,
 * 3. composites the scene to the screen through the black hole shader, which also lays the
 *    intro title behind the lens so it bends like starlight, and lays the front layers over the holes
 *    where the pixel is, unbent and uncovered,
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
  // A trace's start and end take the places of a stroke's segment and style
  const orbitProgram = createProgram(gl, orbitVertexShaderSource, particleFragmentShaderSource, {
    ...position,
    a_from: ATTRIBUTE_LOCATIONS.segment,
    a_to: ATTRIBUTE_LOCATIONS.style,
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
  const particleUniforms = getUniforms(gl, particleProgram, ['resolution', 'pixelRatio', 'center', 'flight', 'doppler', 'tintAhead', 'tintEdge', 'tintBehind', 'tint', 'zoom', 'zoomFrom'] as const)
  const orbitUniforms = getUniforms(gl, orbitProgram, ['resolution', 'zoom', 'orbit', 'dimmed', 'turnX', 'turnY', 'turnZ', 'orbitFrom', 'side', 'sideMain', 'sideSecond', 'sideBend', 'sideShape'] as const)
  const compositeUniforms = getUniforms(gl, compositeProgram, [
    'resolution', 'pixelRatio', 'time', 'hole', 'horizon', 'einstein', 'falloff', 'falloffPivot', 'lensCore', 'maxBend', 'lensReach', 'lensBubble', 'twistLimit', 'swirl', 'absorption', 'trace', 'spin', 'horizonGrid', 'horizonAxis', 'horizonTurn', 'horizonLook', 'companionGrid', 'companionHole', 'ring',
    'ringWidth', 'ringGlow', 'ringDoppler', 'ringSide', 'ringPhase', 'ringField', 'ringBase', 'ringFeed', 'ringLine', 'ringGlowShape', 'ringColor', 'ringApproaching', 'ringReceding',
    'center', 'starGlow', 'starRadius', 'sourcePower', 'glareRadius', 'exposure',
    'lightRadius', 'lightWidth', 'lightPower', 'lightSpeed', 'echoPower', 'echoDecay',
    'waveRadius', 'waveStrength', 'waveWidth', 'remnantGlow', 'remnantRedshift', 'remnantRadius',
    'holeOval', 'gravityWaveAmplitude', 'gravityWaveTime', 'gravityWaveOmega', 'gravityWaveInvDecay', 'gravityWaveRadius', 'gravityWaveCenter', 'gravityWaveTurn', 'companion', 'companionLens', 'companionSpin', 'companionRing', 'waveLens', 'pair', 'pairWave', 'pairFront', 'pairDepth', 'pairPlane', 'turnRight', 'turnDown', 'turnAhead', 'skySphere', 'skyLens', 'skyBend', 'backgroundStars',
    'starCell', 'starDensity', 'starGrid', 'starSphere', 'starFlare', 'starWarm', 'starCool', 'starLook', 'dustScale', 'dustThreshold', 'lightDustContrast',
    'titleCenter', 'titleHalfSize', 'titleAlpha', 'titleReveal', 'titleDissolve', 'titleDrift', 'titleGlow',
    'titleFlash', 'titleCooling', 'titleDust', 'titlePull', 'titleSwirl', 'titleReach', 'titleCapture', 'titleScale',
    'titleFringe', 'titleHalo', 'titleRedshift', 'titleGrain', 'titleBurn', 'titleFall', 'titleTidal', 'titleSpiral', 'titleSpread', 'titleStream', 'titleOrder', 'titleTrail', 'titleTrailShape', 'titleHeat', 'dustSweep', 'echoFloor', 'dustShock', 'dustBlow', 'dustDrift',
    'titleSpeck', 'titleWinkRest', 'titleWind', 'titleBurnShape', 'titleBurnRimWidth', 'titleFallShape', 'titleDustShape', 'titleDustCut', 'titleBurnEdge',
    'echoShape', 'echoSwell', 'dustMotion', 'dustFlare', 'dustNoise', 'dustWarp', 'echoTintEase', 'starFlareRate', 'remnantShape', 'vignetteSpan', 'knee',
    'skyGrid', 'gridCell', 'skyGridLine', 'orbits', 'front', 'nebula', 'nebulaColor', 'nebulaColorDeep', 'nebulaColorCore', 'nebulaShape', 'nebulaLook', 'nebulaPatch', 'nebulaDrift', 'nebulaSpace', 'nebulaNoise', 'nebulaNorm', 'gridPull', 'gridColor', 'gridHaze', 'gridShape',
    'colorFlash', 'colorLight', 'colorDust', 'colorTitle', 'colorEmber',
    'cameraZoom', 'zoomCenter', 'layerZoom', 'shake', 'lensFringe', 'lensFringeEase', 'vignette', 'filmGrain', 'letterbox'
  ] as const)
  const gridUniforms = getUniforms(gl, gridProgram, [
    'resolution', 'pixelRatio', ...SHEET_UNIFORMS, 'lines', 'lens', 'jolt', 'color',
    'shadow', 'frame', 'shadow2', 'sheet', 'clearing', 'rings', 'front', 'kept'
  ] as const)

  const latticeUniforms = getUniforms(gl, latticeProgram, [
    'resolution', 'zoom', 'row0', 'row1', 'row2', 'shift', 'vanish', 'hole', 'companion', 'lattice', 'anchor', 'color', 'fade', 'side', 'sideMain', 'sideSecond', 'sideBend', 'sideShape'
  ] as const)

  const flowUniforms = getUniforms(gl, flowProgram, [
    'resolution', 'zoom', 'place', 'turnX', 'turnY', 'turnZ', 'law', 'shape', 'draw', 'style', 'path', 'age', 'light', 'ride', 'rideShape', ...SHEET_UNIFORMS, 'inPlaneU', 'inPlaneV', 'inPlaneH', 'flowFrom', 'side', 'sideMain', 'sideSecond', 'sideBend', 'sideShape'
  ] as const)
  // The sheet's surface and pose go to the grid and flow programs through the same setter
  const setSheetUniform = (uniform: CachedUniform, x: number, y: number, z: number, w: number) => setUniform4f(gl, uniform, x, y, z, w)

  gl.useProgram(compositeProgram)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_image'), SCENE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_title'), TITLE_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringEnergy'), RING_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_orbitTrails'), ORBIT_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_shadowShape'), SHADOW_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_ringLight'), RING_LIGHT_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_frontImage'), FRONT_TEXTURE_UNIT)
  gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_frontLines'), FRONT_LINES_TEXTURE_UNIT)
  // The line programs read a spinning hole's outline in the band behind it
  for (const program of [orbitProgram, latticeProgram, flowProgram]) {
    gl.useProgram(program)
    gl.uniform1i(gl.getUniformLocation(program, 'u_behindShape'), SHADOW_TEXTURE_UNIT)
  }

  // Shared quad at location 0, bound once for every program
  const quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
  gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.position, 2, gl.FLOAT, false, 0, 0)

  // A stroke is read one record an instance: the field's from the buffer its step wrote (field_feedback.ts),
  // an orbit's trace from the ring of rows. Points the three attributes at the trace `offset` bytes into
  // the trace buffer, which must be bound: its start in the scene and the dimming, its end and brightness,
  // its colour
  function pointTraces (offset: number) {
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.segment, 4, gl.FLOAT, false, STRETCH_STRIDE, offset)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.style, 4, gl.FLOAT, false, STRETCH_STRIDE, offset + 16)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.color, 4, gl.UNSIGNED_BYTE, true, STRETCH_STRIDE, offset + 32)
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

  // The pieces of a trail never change, and the particles' numbers only with Flow Seed; they get their
  // buffers the first time a flow is shown, the numbers again when the seed changes
  const flowSeedBuffer = gl.createBuffer()
  const flowCornerBuffer = gl.createBuffer()
  let flowFilled = false
  let flowSeeded = Number.NaN
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
  // The outline of a spinning hole's shadow, its radius all the way round, a row for the main hole and one
  // for the second; it repeats so the outline has no seam. Half floats are filterable in WebGL2, and a
  // radius needs more than 8 bits
  const shadowTexture = createLinearTexture(SHADOW_TEXTURE_UNIT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SHADOW_SAMPLES, 2, 0, gl.RED, gl.FLOAT, null)
  let shadowVersion = -1
  let companionShapeVersion = -1
  const titleTexture = createLinearTexture(TITLE_TEXTURE_UNIT)
  let titleWidth = 0
  let titleHeight = 0

  // A layer the scene draws into besides the scene texture: a texture on its own unit and the frame buffer
  // that draws into it. It gets its full size only when it is first opened, and again after a resize;
  // `lit` says it may hold light
  interface Layer {
    texture: WebGLTexture | null
    framebuffer: WebGLFramebuffer | null
    unit: number
    sized: boolean
    lit: boolean
  }

  function createLayer (unit: number): Layer {
    const texture = createLinearTexture(unit)
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { texture, framebuffer, unit, sized: false, lit: false }
  }

  // Makes a layer ready to draw into: its full size, black, and bound
  function openLayer (layer: Layer) {
    if (!layer.sized) {
      layer.sized = true
      gl.activeTexture(gl.TEXTURE0 + layer.unit)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    layer.lit = true
  }

  // Puts out a layer that may hold light, and leaves the screen bound
  function clearLayer (layer: Layer) {
    if (!layer.lit) return
    layer.lit = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // The layer of lines: the orbiting stars' traces, the lattice and the flows, drawn anew every frame and
  // read by the composite pass through the lens; whether it reads it this frame
  const lines = createLayer(ORBIT_TEXTURE_UNIT)
  let orbitsShown = false
  // Whether that layer holds the sheet Sheet Through Lens draws into it
  let sheetLaid = false
  // 3D, while something can stand in front of the black holes (frontAway in the step's numbers): the
  // particles nearer the camera than the holes keep their trails in a scene texture of their own, which
  // fades as the scene texture does and is lit while the composite pass reads it; the lines nearer than the
  // holes go into a layer of lines of their own, and whether that holds this frame's lines. Whether the last
  // stepped frame had a front, whose sides a frame that only lays the flows takes; and what is left of the
  // brightest trail in front since the front ended, which is kept and faded until it is dark
  const frontScene = createLayer(FRONT_TEXTURE_UNIT)
  const frontLines = createLayer(FRONT_LINES_TEXTURE_UNIT)
  let frontLinesShown = false
  let frontSides = false
  let frontLeft = 0

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

  // A frame buffer that holds a layer the lens reads and its layer in front of the black holes side by
  // side: the stroke programs write both in one draw, each stroke into the one on its side. Both textures
  // must be open (openLayer) at one size before it is bound
  function createBoth (behind: WebGLTexture | null, before: WebGLTexture | null) {
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, behind, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, before, 0)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return framebuffer
  }
  const sceneBoth = createBoth(sceneTexture, frontScene.texture)
  const linesBoth = createBoth(lines.texture, frontLines.texture)

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
    // The layers get their new size when they are next opened: the lines are drawn anew then, and the
    // trails in front of the holes start again black, as the scene's do here
    for (const layer of [lines, frontScene, frontLines]) {
      layer.sized = false
      layer.lit = false
    }
    flowsLaid = false
    frontLinesShown = false
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
    clearLayer(lines)
    sheetLaid = false
    // The trails in front of the holes go too: unread until the next stepped frame opens their layer black
    frontScene.lit = false
  }

  // A scene that starts over: the trails and the orbits' traces both go
  function clearScene (background: readonly [number, number, number]) {
    wipeScene(background)
    dropTraces()
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

  // Stamps the field's strokes into the bound target. Into the two layers bound side by side, each stroke
  // goes on its side of the black holes: the step writes the opacity of one in front of them below 0
  function drawParticles (frame: FrameInput) {
    if (field.count() === 0) return
    gl.useProgram(particleProgram)
    setUniform1f(gl, particleUniforms.doppler, frame.doppler)
    setUniform3f(gl, particleUniforms.tintAhead, frame.tintAhead.r, frame.tintAhead.g, frame.tintAhead.b)
    setUniform3f(gl, particleUniforms.tintEdge, frame.tintEdge.r, frame.tintEdge.g, frame.tintEdge.b)
    setUniform3f(gl, particleUniforms.tintBehind, frame.tintBehind.r, frame.tintBehind.g, frame.tintBehind.b)
    setUniform2f(gl, particleUniforms.tint, frame.tintGradient, frame.tintLimit)
    setUniform2f(gl, particleUniforms.center, frame.vanishX, frame.vanishY)
    setUniform4f(gl, particleUniforms.flight, frame.flightX, frame.flightY, frame.flightZ, frame.flightFocal)
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
      gl.bufferData(gl.ARRAY_BUFFER, TRACE_CAPACITY * STRETCH_STRIDE, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, rowStart[newest] * STRETCH_STRIDE, frame.orbitRow, 0, count * STRETCH_FLOATS)

    // Rows that have gone dark are let go, oldest first
    while (rowCount > 1 && frame.orbitDimmed - rowFlown[oldestRow] > 1) {
      oldestRow = (oldestRow + 1) % TRACE_ROWS
      rowCount--
    }
  }

  // The side a line program's piece takes of the holes (SIDE_GLSL): `front` 1 while the layer in front of
  // them is bound beside the layer of lines, Front Depth, the nearer hole's reach and how it lets go, and the
  // two shadows where the layers of lines hold them, at the camera's zoom, with the two lenses' Einstein
  // radii, Front Bend and Between Bend, Front Curve and a spinning hole's outline (BEHIND_GLSL). `depth`
  // turns the step's measure of a hole's distance from the camera into the shader's own
  function sendSides (u: SideUniforms, front: number, step: StepSettings, depth: number) {
    const scale = ratio * layerZoom
    setUniform4f(gl, u.side, front, step.frontDepth * depth, step.frontReach, step.frontLetGo)
    setUniform4f(gl, u.sideBend, step.frontBend, step.frontBetween, step.holeEinstein * scale, step.companionEinstein * scale)
    setUniform3f(gl, u.sideShape, step.frontPower, step.spinShape, step.spinTurn)
    const main = u.sideMain
    const second = u.sideSecond
    const x = layerZoomX * ratio
    const y = layerZoomY * ratio
    if (step.holeSeen > 0) {
      setUniform4f(gl, main, x + (step.holeX * ratio - x) * layerZoom, y + (step.holeY * ratio - y) * layerZoom, step.holeSeen * scale, step.holeFront * depth)
    } else {
      setUniform4f(gl, main, 0, 0, 0, 0)
    }
    if (step.companionSeen > 0) {
      setUniform4f(gl, second, x + (step.companionX * ratio - x) * layerZoom, y + (step.companionY * ratio - y) * layerZoom, step.companionSeen * scale,
        step.companionFront * depth)
    } else {
      setUniform4f(gl, second, 0, 0, 0, 0)
    }
  }

  // The orbiting stars' layer is drawn anew every frame from the stretches kept (keepRow, once a frame): each
  // is a line placed around the black hole as it is now and at the camera's zoom, dimmed by its age in the
  // vertex shader, so the traces are sharp at any zoom, follow the hole and all reach black. `front` is 1
  // while the layer in front of the holes is bound beside the layer of lines, and each piece goes on its side
  function drawOrbits (frame: FrameInput, front: number) {
    gl.useProgram(orbitProgram)
    // The nearer hole's distance in the device pixels the stars' depth is measured in
    sendSides(orbitUniforms, front, frame.step, ratio)
    setUniform4f(gl, orbitUniforms.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    setUniform4f(gl, orbitUniforms.orbit, frame.orbitX * ratio, frame.orbitY * ratio, frame.orbitUnit * ratio, frame.orbitWidth * ratio)
    setUniform1f(gl, orbitUniforms.dimmed, frame.orbitDimmed)
    const turn = frame.orbitTurn
    setUniform4f(gl, orbitUniforms.turnX, turn[0], turn[1], turn[2], frame.orbitFocal * ratio)
    setUniform4f(gl, orbitUniforms.turnY, turn[3], turn[4], turn[5], frame.orbitDepth * ratio)
    setUniform3f(gl, orbitUniforms.turnZ, turn[6], turn[7], turn[8])
    // Each point is seen in its own perspective, the hole off the line of sight by its place on the picture
    setUniform2f(gl, orbitUniforms.orbitFrom, (frame.orbitX - frame.vanishX) * ratio, (frame.orbitY - frame.vanishY) * ratio)

    // The kept rows lie in one run of the ring, or in two when they pass its end
    const newest = (oldestRow + rowCount - 1) % TRACE_ROWS
    const from = rowStart[oldestRow]
    const to = rowStart[newest] + rowSize[newest]
    gl.bindBuffer(gl.ARRAY_BUFFER, traceBuffer)
    if (from < to) {
      pointTraces(from * STRETCH_STRIDE)
      stampSegments(to - from)
    } else {
      pointTraces(from * STRETCH_STRIDE)
      stampSegments(TRACE_CAPACITY - from)
      pointTraces(0)
      stampSegments(to)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  // The lattice is drawn anew every frame into the layer of lines, bent towards the holes and seen by the
  // camera at its zoom, the brighter of a line and what is there so crossings do not add up; `front` as for
  // the orbits, with the nearer hole `frontAway` CSS pixels seen straight on from the camera and Front Depth
  // `frontDepth` of them behind it
  function drawLattice (lattice: LatticeSettings, color: SceneColor, front: number, step: StepSettings) {
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
    // The lattice's depth is in scene units, pivot / focal of them in a CSS pixel
    const sceneUnits = lattice.pivot / Math.max(lattice.focal, 1)
    sendSides(u, front, step, sceneUnits)
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
  // the vertex shader from the flow's clock, the brighter of a stroke and what is there; `front` as for the
  // orbits
  function drawFlows (frame: FrameInput, front: number) {
    if (!flowFilled) {
      flowFilled = true
      gl.bindBuffer(gl.ARRAY_BUFFER, flowCornerBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, createFlowCorners(), gl.STATIC_DRAW)
      gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.flowCorner, FLOW_CORNER_FLOATS, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.flowSeed, 1)
    }
    if (frame.flowSeed !== flowSeeded) {
      flowSeeded = frame.flowSeed
      gl.bindBuffer(gl.ARRAY_BUFFER, flowSeedBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, createFlowSeeds(flowSeeded), gl.STATIC_DRAW)
    }
    const u = flowUniforms
    gl.useProgram(flowProgram)
    setUniform4f(gl, u.zoom, layerZoomX * ratio, layerZoomY * ratio, layerZoom, 0)
    // Particles on Sheet lays the flows on the sheet the particles were stepped with
    const step = frame.step
    const riding = step.ride > 0
    if (riding) {
      setUniform4f(gl, u.ride, step.ride, Math.max(step.rideDepth, 0.001), step.sheet.unit, step.sheet.shared)
      setUniform4f(gl, u.rideShape, step.sheet.rideSoft, step.sheet.rideFar, step.sheet.rideWave, step.sheet.rideCut)
      sendSheet(setSheetUniform, u, step.sheet)
    } else {
      setUniform4f(gl, u.ride, 0, 1, 1, 0)
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
      // Its own plane as the camera sees it, and the disc's thickness
      const turn = flow.turn
      setUniform4f(gl, u.turnX, turn[0], turn[1], turn[2], frame.orbitFocal * ratio)
      setUniform4f(gl, u.turnY, turn[3], turn[4], turn[5], frame.orbitFocal > 0 ? flow.depth * ratio : 1)
      setUniform4f(gl, u.turnZ, turn[6], turn[7], turn[8], ratio)
      // A flow's depth is a share of its centre's distance from the camera
      const share = flow.depth > 0 ? 1 / flow.depth : 0
      sendSides(u, front, step, share)
      setUniform2f(gl, u.flowFrom, (flow.x - frame.vanishX) * ratio, (flow.y - frame.vanishY) * ratio)
      if (riding) {
        // Where its own places fall in the equator: a device pixel of the flow is a CSS pixel over the ratio;
        // its height is measured the way the well goes down
        const plane = flow.plane
        const down = step.sheet.down
        setUniform4f(gl, u.inPlaneU, plane[0] / ratio, plane[1] / ratio, plane[2] / ratio, plane[3])
        setUniform4f(gl, u.inPlaneV, plane[4] / ratio, plane[5] / ratio, plane[6] / ratio, plane[7])
        setUniform4f(gl, u.inPlaneH, plane[8] * down / ratio, plane[9] * down / ratio, plane[10] * down / ratio, plane[11] * down)
      }
      const law = flow.law
      setUniform4f(gl, u.law, law[0], law[1], law[2], law[3])
      const shape = flow.shape
      setUniform4f(gl, u.shape, shape[0], shape[1], shape[2], shape[3])
      const draw = flow.draw
      setUniform4f(gl, u.draw, draw[0], draw[1], draw[2], draw[3])
      const style = flow.style
      setUniform4f(gl, u.style, style[0], style[1], style[2], style[3])
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
      // The copies' brightness falls evenly to none past the last, the whole as Trail sets it at any count
      const copies = Math.min(Math.max(Math.round(title.trailCopies), 0), 8)
      setUniform3f(gl, u.titleTrailShape, copies, Math.max(title.trailLag, 0), copies > 0 ? 1.8 / (copies * (copies + 1)) : 0)
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
    setUniform1f(gl, u.lensFringeEase, Math.max(settings.lensFringeEase, 0.01))
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
    setUniform1f(gl, u.lensBubble, settings.lensBubble)
    setUniform1f(gl, u.twistLimit, settings.twistLimit)
    setUniform1f(gl, u.swirl, settings.swirl)
    setUniform1f(gl, u.absorption, settings.absorption)
    setUniform4f(gl, u.trace, settings.traceU, settings.traceScale * ratio, settings.traceShare, 0)
    setUniform4f(gl, u.spin, settings.spin, Math.cos(settings.spinTilt), Math.sin(settings.spinTilt), settings.spinAxis)
    setUniform4f(gl, u.horizonGrid, settings.horizonGrid, settings.horizonGridU, settings.horizonGridScale * ratio, 0.5 * settings.horizonLine * ratio)
    if (settings.horizonGrid > 0) {
      const cellsPerRadian = settings.horizonCells / Math.PI
      setUniform4f(gl, u.horizonAxis, Math.cos(settings.horizonTilt), Math.sin(settings.horizonTilt), settings.horizonAxis, settings.horizonHaze)
      // Cells round the equator: Horizon Cells Around, or twice those from pole to pole, which keeps them square there
      const around = settings.horizonCellsAround > 0 ? Math.max(Math.round(settings.horizonCellsAround), 1) : 2 * settings.horizonCells
      setUniform4f(gl, u.horizonTurn, settings.horizonTurn, settings.horizonRate, cellsPerRadian, around)
      const hazeFrom = Math.max(settings.horizonHazeFrom, 0.02)
      setUniform4f(gl, u.horizonLook, hazeFrom * ratio, Math.min(Math.max(settings.horizonHazeTo, 0), hazeFrom - 0.01) * ratio,
        settings.horizonShift, settings.horizonCompanion)
      setUniform4f(gl, u.companionGrid, Math.max(settings.companionGridScale * ratio, 0.0001), settings.companionGridAxis, settings.companionGridTurn, settings.companionGridRate)
      setUniform4f(gl, u.companionHole, settings.companionGridSpin, Math.cos(settings.companionGridTilt), Math.sin(settings.companionGridTilt), settings.companionGridU)
    }
    if (settings.shadowShape.version !== shadowVersion) {
      shadowVersion = settings.shadowShape.version
      gl.activeTexture(gl.TEXTURE0 + SHADOW_TEXTURE_UNIT)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SHADOW_SAMPLES, 1, gl.RED, gl.FLOAT, settings.shadowShape.table)
      gl.activeTexture(gl.TEXTURE0 + SCENE_TEXTURE_UNIT)
    }
    if (settings.companionShape.version !== companionShapeVersion) {
      companionShapeVersion = settings.companionShape.version
      gl.activeTexture(gl.TEXTURE0 + SHADOW_TEXTURE_UNIT)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, SHADOW_SAMPLES, 1, gl.RED, gl.FLOAT, settings.companionShape.table)
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
    setUniform2f(gl, u.companionLens, Math.max(settings.companionLensCore, 0.001), settings.companionLensStyle)
    setUniform2f(gl, u.companionSpin, settings.companionSpin, settings.companionSpinAxis)
    setUniform3f(gl, u.companionRing, settings.companionRingDoppler, settings.companionRingSide, ringLit ? settings.companionRingFeed : 0)
    setUniform2f(gl, u.waveLens, settings.waveLensCompanion, settings.waveLensMain)
    setUniform3f(gl, u.pairDepth, settings.pairLensMain, settings.pairLensCompanion, settings.pairNearer)
    setUniform4f(gl, u.pairPlane, settings.pairPlane[0], settings.pairPlane[1], settings.pairPlane[2], settings.pairPlane[3])
    setUniform3f(gl, u.turnRight, settings.turn[0], settings.turn[1], settings.turn[2])
    setUniform3f(gl, u.turnDown, settings.turn[3], settings.turn[4], settings.turn[5])
    setUniform3f(gl, u.turnAhead, settings.turn[6], settings.turn[7], settings.turn[8])
    setUniform1f(gl, u.skySphere, settings.skySphere)
    // The sky's centre, moved from the middle of the screen toward the field's vanishing point by Sky Centre, the
    // focal length it is seen through, half the long side, and its sphere's radius, all CSS pixels
    const skyMiddleX = 0.5 * width / ratio
    const skyMiddleY = 0.5 * height / ratio
    const skyFocal = Math.max(skyMiddleX, skyMiddleY)
    const skyRadius = settings.skySize > 0 ? settings.skySize : skyFocal
    setUniform4f(gl, u.skyLens, skyMiddleX + (settings.skyVanishX - skyMiddleX) * settings.skyCenter,
      skyMiddleY + (settings.skyVanishY - skyMiddleY) * settings.skyCenter, skyFocal, skyRadius)
    // The flat backdrop is bent onto the plane ahead only while both skies are drawn
    setUniform1f(gl, u.skyBend, settings.skySphere > 0 && settings.skySphere < 1 ? settings.skyBend : 0)
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
    setUniform1f(gl, u.nebula, settings.nebula)
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
      setUniform3f(gl, u.nebulaSpace, settings.nebulaSpaceX, settings.nebulaSpaceY, settings.nebulaSpaceZ)
      // Its layers, and what brings their sum to the 0.875 of three halving ones, the span Sparseness is cut in
      const layers = Math.min(Math.max(settings.nebulaDetail, 1), NEBULA_LAYERS)
      const roughness = Math.min(Math.max(settings.nebulaRoughness, 0.05), 0.95)
      let sum = 0
      let amplitude = 0.5
      for (let layer = 0; layer < NEBULA_LAYERS && layers > layer; layer++) {
        sum += amplitude * Math.min(layers - layer, 1)
        amplitude *= roughness
      }
      setUniform4f(gl, u.nebulaNoise, layers, Math.max(settings.nebulaLacunarity, 1.01), roughness, Math.max(settings.nebulaCurlSize, 0.01))
      setUniform2f(gl, u.nebulaNorm, Math.max(settings.nebulaGrainSize, 0.01), 0.875 / sum)
    }
    if (settings.backgroundStars > 0) {
      const warm = settings.starWarm
      const cool = settings.starCool
      setUniform4f(gl, u.starWarm, warm.r, warm.g, warm.b, settings.starFaintest)
      setUniform4f(gl, u.starCool, cool.r, cool.g, cool.b, 1 - settings.starFaintest)
      setUniform4f(gl, u.starLook, settings.starSpread, 1 - settings.starTwinkle, settings.starTwinkle, settings.starTwinkleSpeed)
      setUniform3f(gl, u.starGrid, Math.min(Math.max(settings.starPlacement, 0), 1), Math.min(Math.max(Math.round(settings.starsPerCell), 1), STARS_PER_CELL),
        Math.min(Math.max(Math.round(settings.starNeighbors), 0), STAR_RINGS))
      // Half a face's angle, scaled by the warp, and its tangent
      const warp = Math.min(Math.max(settings.starCellWarp, 0.01), 1) * Math.PI / 4
      setUniform3f(gl, u.starSphere, warp, Math.tan(warp), Math.min(Math.max(settings.starSkyEven, 0), 1))
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
    setUniform3f(gl, u.dustNoise, Math.min(Math.max(settings.dustLayers, 1), 6), Math.max(settings.dustFineness, 1), Math.max(settings.dustRoughness, 0.01))
    setUniform2f(gl, u.dustWarp, settings.dustWarp, Math.max(settings.dustWarpScale, 0.01))
    setUniform1f(gl, u.echoTintEase, Math.max(settings.echoTintEase, 0.01))
    setUniform1f(gl, u.orbits, orbitsShown ? 1 : 0)
    // The front layers are read while they hold light: the trails in front until they are dark, the lines
    // while the last stepped frame drew them; Front Add and Front Waves say how they are laid over the rest
    setUniform4f(gl, u.front, frontScene.lit ? 1 : 0, frontScene.lit && frontLinesShown ? 1 : 0, settings.frontAdd, settings.frontWaves)
    setUniform1f(gl, u.skyGrid, settings.skyGrid)
    if (settings.skyGrid > 0 || settings.horizonGrid > 0) setUniform3f(gl, u.gridColor, settings.gridColor.r, settings.gridColor.g, settings.gridColor.b)
    if (settings.skyGrid > 0) {
      setUniform1f(gl, u.gridCell, Math.max(settings.gridCell, 1))
      setUniform1f(gl, u.gridPull, settings.gridPull)
      if (settings.gridPull > 0) {
        const haze = Math.max(settings.gridHaze, 0.1) * ratio
        setUniform2f(gl, u.gridHaze, haze, haze * (1 - Math.min(Math.max(settings.gridHazeSpan, 0.05), 0.95)))
      }
      setUniform1f(gl, u.skyGridLine, settings.skyGridLine * 0.5)
      // On the sphere a latitude is a cell of the sky's sphere apart, a longitude as near that as a whole
      // number of them round the equator allows
      const gridCell = Math.max(settings.gridCell, 1)
      const around = Math.max(Math.round(2 * Math.PI * skyRadius / gridCell), 1)
      setUniform4f(gl, u.gridShape, Math.min(Math.max(settings.gridSphere, 0), 1), Math.max(settings.gridSlant, 0), gridCell / skyRadius, 2 * Math.PI / around)
    }
    gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
  }

  // The sheet is drawn over the frame, seen through its pose: it follows the scene camera's zoom and shake
  // and the letterbox, ripples with the gravitational wave and stops at the black hole's shadow, unless it
  // passes in front of the holes: nearer the camera than the nearer hole, `front` as a share of the main
  // hole's distance (0 = nothing is in front). The share of it behind the holes that Sheet Through Lens
  // takes is drawn instead into the layer of lines (`intoLayer`), at the layer's zoom and with no shake,
  // which the composite pass reads through the lens and lays the shadow over
  function drawGrid (grid: GridSettings, settings: CompositeSettings, front: number, intoLayer: boolean) {
    const u = gridUniforms
    const zoom = Math.max(settings.cameraZoom, 0.05)
    const lensed = Math.min(Math.max(grid.lensed, 0), 1)
    gl.useProgram(gridProgram)
    sendSheet(setSheetUniform, u, grid)
    setUniform1f(gl, u.front, front)
    setUniform4f(gl, u.lines, Math.max(grid.cell, 1), Math.max(grid.span, 1), grid.anchorX, grid.anchorY)
    setUniform4f(gl, u.sheet, grid.lineWidth, grid.lineScale, grid.fadeFrom, grid.shared)
    // A spoke is half of a line through the hole
    setUniform4f(gl, u.rings, Math.min(Math.floor(grid.rings), GRID_LINES_PER_SIDE), Math.min(Math.floor(grid.spokes / 2), GRID_LINES_PER_SIDE),
      Math.min(Math.max(grid.ringSpacing, 0), 1), 0)
    // Whole no nearer than gone
    setUniform2f(gl, u.clearing, grid.clearFrom, Math.max(grid.clearTo, grid.clearFrom))
    setUniform4f(gl, u.color, settings.gridColor.r * grid.brightness, settings.gridColor.g * grid.brightness, settings.gridColor.b * grid.brightness, 1)
    if (intoLayer) {
      setUniform2f(gl, u.kept, lensed, 0)
      setUniform4f(gl, u.lens, layerZoomX, layerZoomY, layerZoom, 0)
      setUniform2f(gl, u.jolt, 0, 0)
      setUniform4f(gl, u.shadow, 0, 0, 0, 0)
      setUniform4f(gl, u.shadow2, 0, 0, 0, 0)
      setUniform2f(gl, u.frame, height, 0)
    } else {
      setUniform2f(gl, u.kept, 1 - lensed, 1)
      setUniform4f(gl, u.lens, settings.zoomX, settings.zoomY, zoom, 0)
      setUniform2f(gl, u.jolt, settings.shakeX, settings.shakeY)
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
    }

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
      // 3D, while something can stand in front of the holes: the strokes in front go into their own scene
      // texture, bound beside the scene's, so one fade and one draw of the strokes serve both. It fades
      // toward black, the light it holds being laid over the rest. A front that begins starts black; one
      // that ends (3D eased out, the hole gone or behind the camera) draws nothing more into it, and its
      // trails fade on as the scene's do until they are dark, when it is no longer read
      const frontAway = frame.step.frontAway
      const inFront = frontAway > 0
      frontSides = inFront
      if (inFront) {
        if (!frontScene.lit) openLayer(frontScene)
        frontLeft = 1
      } else if (frontScene.lit) {
        frontLeft *= 1 - frame.fadeAlpha
        if (frontLeft < FRONT_DARK) frontScene.lit = false
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, frontScene.lit ? sceneBoth : sceneFramebuffer)
      if (frame.fadeAlpha > 0) {
        gl.useProgram(fadeProgram)
        setUniform4f(gl, fadeUniforms.color, r / 255, g / 255, b / 255, frame.fadeAlpha)
        gl.drawArrays(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT)
      }
      drawParticles(frame)
      // The orbits' traces, the lattice and the flows share one layer of lines, and those in front of the
      // holes another
      const latticeShown = frame.lattice.brightness > 0
      let flowsShown = false
      for (let slot = 0; slot < frame.flows.length; slot++) {
        if (frame.flows[slot].brightness > 0 && frame.flows[slot].count > 0) flowsShown = true
      }
      flowsLaid = flowsShown && frame.present
      // Sheet Through Lens draws the sheet behind the holes into the same layer
      const sheetLensed = frame.grid.brightness > 0 && frame.grid.lensed > 0
      const linesShown = latticeShown || flowsLaid || sheetLensed
      const anyLines = frame.orbitCount > 0 || linesShown
      if (frame.orbitCount > 0) keepRow(frame)
      if (anyLines) {
        // Both layers start black, and one draw of each kind of line writes the two
        openLayer(lines)
        if (inFront) {
          openLayer(frontLines)
          gl.bindFramebuffer(gl.FRAMEBUFFER, linesBoth)
        }
        const front = inFront ? 1 : 0
        if (frame.orbitCount > 0) drawOrbits(frame, front)
        if (latticeShown) drawLattice(frame.lattice, frame.composite.gridColor, front, frame.step)
        if (flowsLaid) drawFlows(frame, front)
        if (sheetLensed) {
          // The sheet's program writes one target: the layer behind the holes alone
          if (inFront) gl.bindFramebuffer(gl.FRAMEBUFFER, lines.framebuffer)
          drawGrid(frame.grid, frame.composite, sheetFront(frame), true)
        }
      }
      sheetLaid = sheetLensed
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      // The last star gone, its traces go with it
      if (frame.orbitCount === 0) {
        if (!linesShown) clearLayer(lines)
        dropTraces()
      }
      orbitsShown = anyLines
      frontLinesShown = inFront && anyLines
      if (!frontLinesShown) clearLayer(frontLines)

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
        // The sides are those of the last stepped frame
        const inFront = frontSides
        // A layer that holds nothing yet starts black, with the lattice in it
        const fresh = !lines.lit || (inFront && !frontLines.lit)
        if (!lines.lit) openLayer(lines)
        if (inFront && !frontLines.lit) openLayer(frontLines)
        gl.bindFramebuffer(gl.FRAMEBUFFER, inFront ? linesBoth : lines.framebuffer)
        const front = inFront ? 1 : 0
        if (fresh && frame.lattice.brightness > 0) drawLattice(frame.lattice, frame.composite.gridColor, front, frame.step)
        drawFlows(frame, front)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        flowsLaid = true
        orbitsShown = true
        frontLinesShown = inFront
        if (fresh) sheetLaid = false
      }
    }
    // The sheet through the lens the same way, into the layer behind the holes
    if (!frame.updateScene && frame.present && !sheetLaid && frame.grid.brightness > 0 && frame.grid.lensed > 0) {
      if (!lines.lit) openLayer(lines)
      gl.bindFramebuffer(gl.FRAMEBUFFER, lines.framebuffer)
      drawGrid(frame.grid, frame.composite, sheetFront(frame), true)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      sheetLaid = true
      orbitsShown = true
    }
    if (!frame.present) return
    composite(frame.composite, frame.title)
    if (frame.grid.brightness > 0) drawGrid(frame.grid, frame.composite, sheetFront(frame), false)
  }

  // The share of the main hole's distance the nearer hole stands at, which the sheet's pieces in front of
  // the holes are told by; the orbits are set at the former (0 = nothing is in front)
  function sheetFront (frame: FrameInput) {
    const frontAway = frame.step.frontAway
    return frontAway > 0 && frame.orbitDepth > 0 ? frontAway / frame.orbitDepth : 0
  }

  function dispose () {
    for (const location of INSTANCED_ATTRIBUTES) gl.vertexAttribDivisor(location, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.gridLine, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.latticeLine, 0)
    gl.vertexAttribDivisor(ATTRIBUTE_LOCATIONS.flowSeed, 0)
    gl.disableVertexAttribArray(ATTRIBUTE_LOCATIONS.position)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(sceneFramebuffer)
    gl.deleteFramebuffer(sceneBoth)
    gl.deleteFramebuffer(linesBoth)
    gl.deleteTexture(sceneTexture)
    for (const layer of [lines, frontScene, frontLines]) {
      gl.deleteFramebuffer(layer.framebuffer)
      gl.deleteTexture(layer.texture)
    }
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
