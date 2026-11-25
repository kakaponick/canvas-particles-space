import { createWithEqualityFn } from 'zustand/traditional'

export interface ParticleColor {
  r: number
  g: number
  b: number
  enabled: boolean
  percent: number
}

export interface ParticleState {
  numParticles: number
  baseSpeed: number
  gravityStrength: number
  orbitalStrength: number
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
  // Photon ring fed by the simulation: share of its light that always shines, share added by infalling
  // matter, seconds that light lingers, and radians per second the pattern turns
  ringBase: number
  ringFeed: number
  ringAfterglow: number
  ringFlowSpeed: number
  // How quickly the black hole catches up with its target, radians per second
  followFrequency: number
  // Static background stars: brightness, share of grid cells holding a star, grid cell size in CSS pixels
  starsBrightness: number
  starDensity: number
  starCell: number
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
  // Stroke width of the nearest particles, CSS pixels
  particleSize: number
  // Radius of the disc particles spawn in, world units
  spawnRadius: number
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
  gridSky: number
  // The space lattice (space_lattice.ts): brightness (0 = off), its cell in black hole radii, and how
  // strongly its nodes are pulled in, in shadow radii of the slowing of time
  gridLattice: number
  gridLatticeCell: number
  gridLatticeWarp: number
  // Stars in orbit around the black hole (orbiters.ts): how many (0 = none), the mean size of their
  // orbits in black hole radii, how stretched the orbits are, the rate of their time (its sign is their
  // direction), seconds an orbit's trace stays lit, and their width in CSS pixels
  orbitCount: number
  orbitSize: number
  orbitEccentricity: number
  orbitSpeed: number
  orbitTrail: number
  orbitStarSize: number
  // A second black hole (companion.ts): its radius in main hole radii (0 = none), the gap between the
  // two centres in main hole radii, the rate of the pair's time (its sign is its direction) and the
  // strength of the gravitational waves the pair sends out
  companionSize: number
  companionDistance: number
  companionSpeed: number
  companionWaves: number
  // How much the camera magnifies the scene around the black hole; 1 is no zoom
  cameraZoom: number
  // Where the camera looks while it is zoomed in: black hole radii to the right of the black hole and
  // above it, and in a pair the share of the way from its centre to the second hole (below 0, to the main one)
  cameraX: number
  cameraY: number
  cameraPair: number
  // The field as a volume in space (particle_simulation_3d.ts), with a camera that circles the black hole:
  // degrees around it, degrees above it, and degrees a second it turns on its own
  threeD: boolean
  cameraYaw: number
  cameraPitch: number
  cameraSpin: number
  frameRateCap: number
  measuredFps: number
  // Lower the particle count automatically when the simulation overruns the frame
  adaptiveParticles: boolean
  // Show the measured frame rate in the scene toolbar
  fpsCounter: boolean
  // Particles actually simulated; below numParticles while the adaptive budget holds it back
  activeParticles: number
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
  setFrameRateCap: (fps: number) => void
  setMeasuredFps: (fps: number) => void
  toggleAdaptiveParticles: () => void
  toggleFpsCounter: () => void
  setActiveParticles: (count: number) => void
  setIntroComplete: (complete: boolean) => void
}

// A position on screen as a share of its size, kept to a tenth of a percent so presets compare equal
const toShare = (value: number) => Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000

// Phones get half the particles: the simulation runs on the CPU every frame
const isSmallScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

export const useParticleStore = createWithEqualityFn<ParticleState>((set) => ({
  numParticles: isSmallScreen ? 12000 : 24000,
  baseSpeed: 1.5,
  gravityStrength: 2.5,
  orbitalStrength: 40,
  gravityInertia: 0,
  blackHoleSize: 8,
  horizonScale: 1,
  blackHoleSpin: 0,
  spinTilt: 80,
  spinAxis: 0,
  frameDrag: 1,
  gravityReach: 5,
  ringEnabled: true,
  ringFeedEnabled: true,
  ringBrightness: 1,
  ringGlow: 0.3,
  ringWidth: 0,
  ringDoppler: 0.2,
  ringSide: 1.9,
  ringBase: 0.8,
  ringFeed: 0.9,
  ringAfterglow: 0.6,
  ringFlowSpeed: 0.6,
  followFrequency: 6,
  starsBrightness: 1,
  starDensity: 0.12,
  starCell: 26,
  pulseIntensity: 1,
  blackHoleFollowing: true,
  blackHoleX: 0.5,
  blackHoleY: 0.5,
  backgroundR: 0,
  backgroundG: 0,
  backgroundB: 0,
  lensingRadius: 1.7,
  lensingEnabled: true,
  lensingTraced: false,
  farZ: 5000,
  baseBrightness: 1.0,
  depthFade: 1.0,
  minOpacity: 0.02,
  maxOpacity: 1.0,
  pulseSpeedMultiplier: 1.0,
  trailIntensity: 0.15,
  speedGlow: 1,
  particleSize: 3,
  spawnRadius: 700,
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
  gridSky: 0,
  gridLattice: 0,
  gridLatticeCell: 1,
  gridLatticeWarp: 3,
  cameraZoom: 1,
  cameraX: 0,
  cameraY: 0,
  cameraPair: 0,
  threeD: false,
  cameraYaw: 40,
  cameraPitch: 20,
  cameraSpin: 0,
  companionSize: 0,
  companionDistance: 8,
  companionSpeed: 1,
  companionWaves: 1,
  orbitCount: 0,
  orbitSize: 4,
  orbitEccentricity: 0.5,
  orbitSpeed: 1,
  orbitTrail: 8,
  orbitStarSize: 5,
  frameRateCap: 0,
  measuredFps: 0,
  adaptiveParticles: true,
  fpsCounter: false,
  activeParticles: 0,
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
  setFrameRateCap: (fps) => set({ frameRateCap: fps }),
  setMeasuredFps: (fps) => set({ measuredFps: fps }),
  toggleAdaptiveParticles: () => set((state) => ({ adaptiveParticles: !state.adaptiveParticles })),
  toggleFpsCounter: () => set((state) => ({ fpsCounter: !state.fpsCounter })),
  setActiveParticles: (count) => set({ activeParticles: count }),
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
