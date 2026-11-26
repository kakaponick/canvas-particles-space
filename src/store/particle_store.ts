import { createWithEqualityFn } from 'zustand/traditional'
import { createFlowState, type FlowState } from '../lib/flows'

export interface ParticleColor {
  r: number
  g: number
  b: number
  enabled: boolean
  percent: number
}

// The flows' settings (flows.ts) are the same nine numbers and a colour for each of its slots
export interface ParticleState extends FlowState {
  numParticles: number
  // The particle field itself: off, no particle of it is stepped or drawn, and the flows, the grids and
  // the lens are the whole scene
  fieldEnabled: boolean
  baseSpeed: number
  gravityStrength: number
  orbitalStrength: number
  // 3D: how far the orbital force's axis turns from the line of flight to the spin's axis as it stands in
  // the scene, the more the faster the hole spins; 0 keeps the line of flight
  orbitalSpinFollow: number
  gravityInertia: number
  // Visible black hole: radius of its shadow, % of the viewport's short side. The photon ring,
  // the lens and the strength and reach of gravity scale with it
  blackHoleSize: number
  // Radius of no return, in multiples of the black hole's size: what crosses it is recycled. 1 is the
  // edge of the shadow, where a real black hole captures light
  horizonScale: number
  // How fast the black hole turns (a/M, 0 to 0.998), the angle between its axis and the line to the camera
  // and the turn of the axis on the screen from up, both in degrees
  blackHoleSpin: number
  spinTilt: number
  spinAxis: number
  frameDrag: number
  // How hard spin that lies in the screen sweeps the particles nearer than the hole and those beyond it
  // apart, as a multiple of how hard spin toward the camera swirls them; the flat mode only
  frameDragSweep: number
  // Reach of the black hole's gravity, in multiples of its size
  gravityReach: number
  ringEnabled: boolean
  // Whether particles falling in light the ring; off leaves it burning evenly
  ringFeedEnabled: boolean
  // Photon ring: brightness, line thickness in black hole radii, contrast between its sides,
  // and the direction of its bright side in radians
  ringBrightness: number
  // Strength of the soft light around the ring's line; 0 leaves the bare line
  ringGlow: number
  ringWidth: number
  ringDoppler: number
  ringSide: number
  // Share of the bright side and its contrast taken from the spin as the camera sees it, not from the two
  // settings above
  ringSpinFollow: number
  // Photon ring fed by the simulation: share of its light that always shines, share added by infalling
  // matter, seconds that light lingers, and radians per second the pattern turns
  ringBase: number
  ringFeed: number
  ringAfterglow: number
  ringFlowSpeed: number
  // The ring's own colour and the tints of its approaching and receding sides, '#rrggbb'
  ringColor: string
  ringColorApproaching: string
  ringColorReceding: string
  // The line: its width at Thickness 0 in screen pixels, and how far outside the shadow's edge it stands,
  // in its own widths, and the width of the bell of light that draws it, as a share of its own
  ringWidthMin: number
  ringOffset: number
  ringSoftness: number
  // The glow's shape: how far its tight core and its wide skirt reach, in black hole radii, and the share
  // of Glow each holds at the line
  ringGlowCore: number
  ringGlowCoreShare: number
  ringGlowSkirt: number
  ringGlowSkirtShare: number
  // What feeds the ring: the light a captured particle leaves, the light one passing within Skim Reach
  // black hole radii adds per 60 Hz frame, the light a captured orbiting star leaves, how far round the
  // ring that flare spreads, radians, and the light in each of its sides as a multiple of its middle
  ringFeedCapture: number
  ringFeedSkim: number
  ringFeedReach: number
  ringStarFlare: number
  ringStarSpread: number
  ringStarSides: number
  // How quickly the black hole catches up with its target, radians per second
  followFrequency: number
  // Static background stars: brightness, share of grid cells holding a star, grid cell size in CSS pixels
  starsBrightness: number
  starDensity: number
  starCell: number
  // The nebula behind the stars: its brightness (0 turns it off), its three colours ('#rrggbb'), its clouds
  // (CSS pixels across, how sparse, how soft their edges, how curled, how much denser in the middle, how
  // grained), their drift (CSS pixels a second, degrees: 0 right, 90 up), the patches of the second colour
  // (in clouds across, the share of the sky, how soft) and how far the thickest cloud turns to the core
  // colour, from what thickness
  nebula: number
  nebulaColor: string
  nebulaColorDeep: string
  nebulaColorCore: string
  nebulaScale: number
  nebulaSparseness: number
  nebulaEdge: number
  nebulaWarp: number
  nebulaContrast: number
  nebulaGrain: number
  nebulaDrift: number
  nebulaDriftAngle: number
  nebulaPatch: number
  nebulaPatchShare: number
  nebulaPatchSoftness: number
  nebulaCore: number
  nebulaCoreFrom: number
  // A background star: its width in CSS pixels, the two colours its tint lies between, '#rrggbb', how much
  // of its light the twinkle takes, the twinkle's rate as a multiple of its own, and the brightness of the
  // faintest star as a share of the brightest
  starsSize: number
  starsColorWarm: string
  starsColorCool: string
  starsTwinkle: number
  starsTwinkleSpeed: number
  starsFaintest: number
  pulseIntensity: number
  blackHoleFollowing: boolean
  // Where the black hole rests when it does not follow the cursor, as shares of the viewport's width
  // and height. The intro can start from here too
  blackHoleX: number
  blackHoleY: number
  colorPalette: ParticleColor[]
  backgroundR: number
  backgroundG: number
  backgroundB: number
  // Einstein ring radius, in multiples of the black hole radius
  lensingRadius: number
  // Share of the lens's camera taken from where the scene's camera stands, in place of Einstein Radius
  lensingFromCamera: number
  lensingEnabled: boolean
  // The exact light paths of a black hole that does not spin (lens_trace.ts) in place of the stylized lens
  lensingTraced: boolean
  farZ: number
  baseBrightness: number
  depthFade: number
  minOpacity: number
  maxOpacity: number
  pulseSpeedMultiplier: number
  trailIntensity: number
  // How strongly a particle's brightness follows its speed: 0 lights every moving particle in full,
  // 1 is the original canvas, higher values dim slow particles further
  speedGlow: number
  // Speed at which a particle reaches half its brightness, CSS pixels per 60 Hz frame
  speedGlowKnee: number
  // The tint of a fast flight (the doppler layer): its colours ahead and at the edges of the frame,
  // '#rrggbb', how fast it turns from one to the other outward from the vanishing point, the most of a
  // particle's colour it replaces, and the flight speeds at which it begins and is whole
  flightTintAhead: string
  flightTintEdge: string
  flightTintGradient: number
  flightTintLimit: number
  flightTintFrom: number
  flightTintFull: number
  // Stroke width of the nearest particles and of the farthest, CSS pixels
  particleSize: number
  particleSizeMin: number
  // Radius of the disc particles spawn in, world units
  spawnRadius: number
  fieldAtHole: number
  // Depth of the black hole's plane and the scale of the depth band its gravity acts in, % of the render depth
  blackHoleDepth: number
  gravityDepth: number
  // Base Speed one wheel notch over the scene adds
  scrollSpeedStep: number
  speedVariance: number
  isPaused: boolean
  lensingRotation: number
  lensingFalloff: number
  // Distance from the black hole at which Falloff leaves the pull unchanged, % of the viewport's short side
  lensingPivot: number
  // Closest a bent ray gets to the point right behind the hole, in Einstein radii
  lensingCore: number
  // Cap on the lens's pull; 1 leaves no nested rings inside the Einstein ring
  lensingMaxBend: number
  // Shape of the lens outside its ring: 0 is the compact bubble of the original canvas, 1 a point mass
  lensingReach: number
  // Cap on the pull that Twist follows; the pull is 1 at the Einstein ring and grows inward
  lensingTwistLimit: number
  lensingAbsorption: number
  // Space grid: cell size as % of the viewport's short side, shared by both grids; brightness of the
  // sheet dented by the black hole, its tilt in degrees and the depth of its well in black hole radii;
  // brightness of the flat grid seen through the lens. A brightness of 0 turns that grid off
  gridCell: number
  gridSheet: number
  gridTilt: number
  gridDepth: number
  // Rings the sheet is drawn with in place of its square cells, at equal steps of the well's depth (0 keeps
  // the cells), and the spokes drawn across them
  gridRings: number
  gridSpokes: number
  // The share of the way the particles are moved from where they fly onto the sheet's surface
  gridRide: number
  gridSky: number
  // How far the Lensed Grid is drawn in towards the hole (0 leaves it flat), and the colour of every grid
  gridSkyPull: number
  gridColor: string
  // The sheet's look: its camera's distance and how far it reaches from the hole, in long screen sides, the
  // share of that reach it fades out over, how many times the stretch a gravitational wave gives the sky
  // lifts it, the width of its lines in CSS pixels and the most they widen near the camera, the share of
  // the camera's distance nearer than which it is cut off, and the black hole radii its lines are gone
  // inside and whole beyond
  gridDistance: number
  gridSpan: number
  gridFade: number
  gridWaveLift: number
  gridLine: number
  gridLineNear: number
  gridNear: number
  gridClearing: number
  gridClearingEdge: number
  // In 3D the most the sheet is seen tilted, degrees, and the degrees past that over which it fades out
  gridTiltLimit: number
  gridTiltFade: number
  // Width of the lensed grid's lines, CSS pixels; the CSS pixels a cell of it pulled in shrinks to before its
  // lines start to merge into a haze, and the share of that by which the haze is whole
  gridSkyLine: number
  gridSkyHaze: number
  gridSkyHazeSpan: number
  // The space lattice (space_lattice.ts): brightness (0 = off), its cell in black hole radii, and how
  // strongly its nodes are pulled in, in shadow radii of the slowing of time
  gridLattice: number
  gridLatticeCell: number
  gridLatticeWarp: number
  // The lattice's look: the width of its lines in CSS pixels, how many times brighter than the grids'
  // colour they are, how many cells from the hole it reaches and the share of that it fades out over, the
  // share of the way to the point the camera circles nearer than which it fades, and the share of their
  // light lines far behind that point keep; the share of the near fade's distance a line is gone at, and
  // the shadow its cells are measured from with no black hole, as a share of the short side
  gridLatticeLine: number
  gridLatticeGain: number
  gridLatticeReach: number
  gridLatticeFade: number
  gridLatticeNear: number
  gridLatticeFar: number
  gridLatticeNearEdge: number
  gridLatticeUnit: number
  // Stars in orbit around the black hole (orbiters.ts): how many (0 = none), the mean size of their
  // orbits in black hole radii, how stretched the orbits are, the rate of their time (its sign is their
  // direction), seconds an orbit's trace stays lit, and their width in CSS pixels
  orbitCount: number
  orbitSize: number
  orbitEccentricity: number
  orbitSpeed: number
  orbitTrail: number
  orbitStarSize: number
  // How the orbits are made and held: how hard the hole's spin swings them, as a multiple of what the spin
  // gives; how much they differ from the size and the eccentricity set; the closest a new orbit comes and
  // the distance at which a star has escaped, both in Schwarzschild radii; seconds a new star takes to light up
  orbitDrag: number
  orbitSizeSpread: number
  orbitEccentricitySpread: number
  // The widest an orbit's plane is tipped out of the hole's equator, in degrees
  orbitInclination: number
  orbitClosest: number
  orbitEscape: number
  orbitFadeIn: number
  // A second black hole (companion.ts): its radius in main hole radii (0 = none), the gap between the
  // two centres in main hole radii, the rate of the pair's time (its sign is its direction) and the
  // strength of the gravitational waves the pair sends out
  companionSize: number
  companionDistance: number
  companionSpeed: number
  companionWaves: number
  // The plane the pair circles in: degrees it tilts from the plane across the line of flight, and the side
  // of the screen it tips away from the camera (0 the top, 90 the left)
  companionTilt: number
  companionNode: number
  // The merger: the share of touching inside which the pair turns no faster, the spin the merged hole
  // keeps as a multiple of what two holes without spin leave, how many times longer its oval is than that of
  // a hole forming in the opening, and the wobbles over which its ringing takes over from the pair's wave
  companionClosest: number
  companionSpin: number
  companionOval: number
  companionHandover: number
  // How much the camera magnifies the scene around the black hole; 1 is no zoom
  cameraZoom: number
  // Where the camera looks while it is zoomed in: black hole radii to the right of the black hole and
  // above it, and in a pair the share of the way from its centre to the second hole (below 0, to the main one)
  cameraX: number
  cameraY: number
  cameraPair: number
  // A camera that in one frame zooms by more than this share, moves the picture by more than this many CSS
  // pixels or, in 3D, turns by more than this many radians has cut: the trails start afresh
  cameraCutZoom: number
  cameraCutShift: number
  cameraCutTurn: number
  // The field as a volume in space (stepSpace in field_step.ts), with a camera that circles the black hole:
  // degrees around it, degrees above it, and degrees a second it turns on its own
  threeD: boolean
  cameraYaw: number
  cameraPitch: number
  cameraSpin: number
  // Where the 3D camera stands and looks beyond its circle: degrees it rolls (positive turns the picture
  // anticlockwise), degrees its head turns right and up from the black hole, and black hole radii it moves
  // right, up and in toward what it circles
  cameraRoll: number
  cameraLookYaw: number
  cameraLookPitch: number
  cameraMoveRight: number
  cameraMoveUp: number
  cameraMoveIn: number
  // Share of Field Depth over which the 3D column of particles fades at both its ends, seen from the side
  threeDEndFade: number
  // Seconds the 3D camera takes between the flat view and its place, and the nearest point it circles, as
  // a share of Field Depth
  threeDEase: number
  threeDNearest: number
  frameRateCap: number
  measuredFps: number
  // Show the measured frame rate in the scene toolbar
  fpsCounter: boolean
  introComplete: boolean

  setBaseSpeed: (speed: number) => void
  toggleRing: () => void
  toggleRingFeed: () => void
  toggleBlackHoleFollowing: () => void
  // Moving a position slider anchors the black hole there
  setBlackHoleX: (x: number) => void
  setBlackHoleY: (y: number) => void
  setBlackHolePosition: (x: number, y: number) => void
  // Drops the black hole at a place on the screen, as shares of its width and height, and anchors it
  anchorBlackHoleAt: (x: number, y: number) => void
  addColor: (color: ParticleColor) => void
  removeColor: (index: number) => void
  updateColor: (index: number, updates: Partial<ParticleColor>) => void
  setBackgroundColor: (r: number, g: number, b: number) => void
  toggleLensing: () => void
  toggleLensingTraced: () => void
  togglePause: () => void
  toggleThreeD: () => void
  toggleField: () => void
  setFrameRateCap: (fps: number) => void
  setMeasuredFps: (fps: number) => void
  toggleFpsCounter: () => void
  setIntroComplete: (complete: boolean) => void
}

// A position on screen as a share of its size, kept to a tenth of a percent so presets compare equal
const toShare = (value: number) => Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000

// Phones get half the particles: the simulation runs on the CPU every frame
const isSmallScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

export const useParticleStore = createWithEqualityFn<ParticleState>((set) => ({
  numParticles: isSmallScreen ? 12000 : 24000,
  fieldEnabled: true,
  baseSpeed: 1.5,
  gravityStrength: 2.5,
  orbitalStrength: 40,
  orbitalSpinFollow: 1,
  gravityInertia: 0,
  blackHoleSize: 8,
  horizonScale: 1,
  blackHoleSpin: 0,
  spinTilt: 80,
  spinAxis: 0,
  frameDrag: 1,
  frameDragSweep: 1,
  gravityReach: 5,
  ringEnabled: true,
  ringFeedEnabled: true,
  ringBrightness: 1,
  ringGlow: 0.3,
  ringWidth: 0,
  ringDoppler: 0.2,
  ringSide: 1.9,
  ringSpinFollow: 0,
  ringBase: 0.8,
  ringFeed: 0.9,
  ringAfterglow: 0.6,
  ringFlowSpeed: 0.6,
  ringColor: '#ffffff',
  ringColorApproaching: '#cce6ff',
  ringColorReceding: '#ff6b29',
  ringWidthMin: 1.5,
  ringOffset: 0.7,
  ringSoftness: 0.45,
  ringGlowCore: 0.035,
  ringGlowCoreShare: 0.3,
  ringGlowSkirt: 0.18,
  ringGlowSkirtShare: 0.12,
  ringFeedCapture: 0.9,
  ringFeedSkim: 0.0005,
  ringFeedReach: 1.5,
  ringStarFlare: 6,
  ringStarSpread: 0.2,
  ringStarSides: 0.5,
  followFrequency: 6,
  starsBrightness: 1,
  starDensity: 0.12,
  starCell: 26,
  nebula: 0,
  nebulaColor: '#1c8c78',
  nebulaColorDeep: '#2a4fb0',
  nebulaColorCore: '#d8e88a',
  nebulaScale: 220,
  nebulaSparseness: 0.55,
  nebulaEdge: 0.22,
  nebulaWarp: 0.9,
  nebulaContrast: 0.55,
  nebulaGrain: 0.3,
  nebulaDrift: 10,
  nebulaDriftAngle: -143,
  nebulaPatch: 3,
  nebulaPatchShare: 0.5,
  nebulaPatchSoftness: 0.4,
  nebulaCore: 0,
  nebulaCoreFrom: 0.6,
  starsSize: 1.55,
  starsColorWarm: '#ffd19e',
  starsColorCool: '#bfd9ff',
  starsTwinkle: 0.15,
  starsTwinkleSpeed: 1,
  starsFaintest: 0.25,
  pulseIntensity: 1,
  blackHoleFollowing: true,
  blackHoleX: 0.5,
  blackHoleY: 0.5,
  backgroundR: 0,
  backgroundG: 0,
  backgroundB: 0,
  lensingRadius: 1.7,
  lensingFromCamera: 0,
  lensingEnabled: true,
  lensingTraced: true,
  farZ: 5000,
  baseBrightness: 1.0,
  depthFade: 1.0,
  minOpacity: 0.02,
  maxOpacity: 1.0,
  pulseSpeedMultiplier: 1.0,
  trailIntensity: 0.15,
  speedGlow: 1,
  speedGlowKnee: 0.15,
  flightTintAhead: '#99c2ff',
  flightTintEdge: '#ff946b',
  flightTintGradient: 1.7,
  flightTintLimit: 0.8,
  flightTintFrom: 2,
  flightTintFull: 12,
  particleSize: 3,
  particleSizeMin: 0.3,
  spawnRadius: 700,
  fieldAtHole: 0,
  blackHoleDepth: 30,
  gravityDepth: 18,
  scrollSpeedStep: 0.5,
  speedVariance: 0.15,
  isPaused: false,
  lensingRotation: 0.15,
  lensingFalloff: 2.0,
  lensingPivot: 100,
  lensingCore: 0.3,
  lensingMaxBend: 64,
  lensingReach: 0,
  lensingTwistLimit: 3,
  lensingAbsorption: 0.25,
  gridCell: 4,
  gridSheet: 0,
  gridTilt: 65,
  gridDepth: 2.5,
  gridRings: 0,
  gridSpokes: 24,
  gridRide: 0,
  gridSky: 0,
  gridSkyPull: 0,
  gridColor: '#80bdff',
  gridLattice: 0,
  gridLatticeCell: 1,
  gridLatticeWarp: 3,
  gridDistance: 2.5,
  gridSpan: 2.2,
  gridFade: 0.5,
  gridWaveLift: 4,
  gridLine: 1.25,
  gridLineNear: 3,
  gridNear: 0.2,
  gridClearing: 1.04,
  gridClearingEdge: 1.2,
  gridTiltLimit: 75,
  gridTiltFade: 15,
  gridSkyLine: 1.5,
  gridSkyHaze: 6,
  gridSkyHazeSpan: 0.5,
  gridLatticeLine: 1.5,
  gridLatticeGain: 1.6,
  gridLatticeReach: 6,
  gridLatticeFade: 0.5,
  gridLatticeNear: 0.5,
  gridLatticeFar: 0.3,
  gridLatticeNearEdge: 0.25,
  gridLatticeUnit: 0.08,
  cameraZoom: 1,
  cameraX: 0,
  cameraY: 0,
  cameraPair: 0,
  threeD: false,
  cameraYaw: 40,
  cameraPitch: 20,
  cameraSpin: 0,
  cameraRoll: 0,
  cameraLookYaw: 0,
  cameraLookPitch: 0,
  cameraMoveRight: 0,
  cameraMoveUp: 0,
  cameraMoveIn: 0,
  threeDEndFade: 0.12,
  threeDEase: 1.2,
  threeDNearest: 0.05,
  cameraCutZoom: 0.08,
  cameraCutShift: 80,
  cameraCutTurn: 0.35,
  companionSize: 0,
  companionDistance: 8,
  companionSpeed: 1,
  companionWaves: 1,
  companionTilt: 0,
  companionNode: 0,
  companionClosest: 0.6,
  companionSpin: 1,
  companionOval: 3,
  companionHandover: 0.25,
  orbitCount: 0,
  orbitSize: 4,
  orbitEccentricity: 0.5,
  orbitSpeed: 1,
  orbitTrail: 8,
  orbitStarSize: 5,
  orbitDrag: 1,
  orbitSizeSpread: 0.8,
  orbitEccentricitySpread: 0.4,
  orbitInclination: 20,
  orbitClosest: 1.3,
  orbitEscape: 400,
  orbitFadeIn: 0.6,
  ...createFlowState(),
  frameRateCap: 0,
  measuredFps: 0,
  fpsCounter: false,
  introComplete: false,
  // Star colors by temperature, from ~3500 K amber to ~12000 K blue-white
  colorPalette: [
    { r: 255, g: 196, b: 137, enabled: true, percent: 12 },
    { r: 255, g: 222, b: 190, enabled: true, percent: 22 },
    { r: 255, g: 249, b: 251, enabled: true, percent: 32 },
    { r: 222, g: 230, b: 255, enabled: true, percent: 22 },
    { r: 196, g: 213, b: 255, enabled: true, percent: 12 }
  ],

  setBaseSpeed: (speed) => set({ baseSpeed: speed }),
  toggleRing: () => set((state) => ({ ringEnabled: !state.ringEnabled })),
  toggleRingFeed: () => set((state) => ({ ringFeedEnabled: !state.ringFeedEnabled })),
  toggleBlackHoleFollowing: () => set((state) => ({ blackHoleFollowing: !state.blackHoleFollowing })),
  setBlackHoleX: (x) => set({ blackHoleX: toShare(x), blackHoleFollowing: false }),
  setBlackHoleY: (y) => set({ blackHoleY: toShare(y), blackHoleFollowing: false }),
  setBlackHolePosition: (x, y) => set({ blackHoleX: toShare(x), blackHoleY: toShare(y) }),
  anchorBlackHoleAt: (x, y) => set({ blackHoleX: toShare(x), blackHoleY: toShare(y), blackHoleFollowing: false }),
  toggleLensing: () => set((state) => ({ lensingEnabled: !state.lensingEnabled })),
  toggleLensingTraced: () => set((state) => ({ lensingTraced: !state.lensingTraced })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  toggleThreeD: () => set((state) => ({ threeD: !state.threeD })),
  toggleField: () => set((state) => ({ fieldEnabled: !state.fieldEnabled })),
  setFrameRateCap: (fps) => set({ frameRateCap: fps }),
  setMeasuredFps: (fps) => set({ measuredFps: fps }),
  toggleFpsCounter: () => set((state) => ({ fpsCounter: !state.fpsCounter })),
  setIntroComplete: (complete) => set({ introComplete: complete }),

  addColor: (color) => set((state) => ({
    colorPalette: [...state.colorPalette, color]
  })),

  removeColor: (index) => set((state) => ({
    colorPalette: state.colorPalette.filter((_, i) => i !== index)
  })),

  updateColor: (index, updates) => set((state) => ({
    colorPalette: state.colorPalette.map((color, i) =>
      i === index ? { ...color, ...updates } : color
    )
  })),

  setBackgroundColor: (r, g, b) => set({ backgroundR: r, backgroundG: g, backgroundB: b })
}))
