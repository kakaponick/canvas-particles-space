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
  // Visible black hole: radius of its shadow, % of the viewport's short side. The photon ring,
  // the lens and the strength and reach of gravity scale with it
  blackHoleSize: number
  // Radius of no return, % of the viewport's short side: particles crossing it are recycled
  eventHorizon: number
  // Reach of the black hole's gravity, in multiples of its size
  gravityReach: number
  ringEnabled: boolean
  // Whether particles falling in light the ring; off leaves it burning evenly
  ringFeedEnabled: boolean
  // Photon ring: brightness, line thickness in black hole radii, contrast between its sides,
  // and the direction of its bright side in radians
  ringBrightness: number
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
  // Distance from the black hole at which Lensing Falloff leaves the pull unchanged, % of the viewport's short side
  lensingPivot: number
  // Closest a bent ray gets to the point right behind the hole, in Einstein radii
  lensingCore: number
  // Cap on the lens's pull; 1 leaves no nested rings inside the Einstein ring
  lensingMaxBend: number
  // Shape of the lens outside its ring: 0 is the compact bubble of the original canvas, 1 a point mass
  lensingReach: number
  // Cap on the pull that Angular Deflection follows; the pull is 1 at the Einstein ring and grows inward
  lensingTwistLimit: number
  lensingAbsorption: number
  frameRateCap: number
  measuredFps: number
  // Lower the particle count automatically when the simulation overruns the frame
  adaptiveParticles: boolean
  // Particles actually simulated; below numParticles while the adaptive budget holds it back
  activeParticles: number
  introComplete: boolean

  setNumParticles: (num: number) => void
  setBaseSpeed: (speed: number) => void
  setGravityStrength: (gravity: number) => void
  setOrbitalStrength: (orbital: number) => void
  setBlackHoleSize: (size: number) => void
  setEventHorizon: (horizon: number) => void
  setGravityReach: (reach: number) => void
  toggleRing: () => void
  toggleRingFeed: () => void
  setRingBrightness: (value: number) => void
  setRingWidth: (value: number) => void
  setRingDoppler: (value: number) => void
  setRingSide: (value: number) => void
  setRingBase: (value: number) => void
  setRingFeed: (value: number) => void
  setRingAfterglow: (value: number) => void
  setRingFlowSpeed: (value: number) => void
  setFollowFrequency: (value: number) => void
  setStarsBrightness: (value: number) => void
  setStarDensity: (value: number) => void
  setStarCell: (value: number) => void
  setPulseIntensity: (intensity: number) => void
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
  setLensingRadius: (radius: number) => void
  toggleLensing: () => void
  setFarZ: (farZ: number) => void
  setBaseBrightness: (brightness: number) => void
  setDepthFade: (fade: number) => void
  setMinOpacity: (opacity: number) => void
  setMaxOpacity: (opacity: number) => void
  setPulseSpeedMultiplier: (multiplier: number) => void
  setTrailIntensity: (intensity: number) => void
  setSpeedGlow: (value: number) => void
  setParticleSize: (value: number) => void
  setSpawnRadius: (value: number) => void
  setBlackHoleDepth: (value: number) => void
  setGravityDepth: (value: number) => void
  setScrollSpeedStep: (value: number) => void
  setSpeedVariance: (variance: number) => void
  togglePause: () => void
  setLensingRotation: (rotation: number) => void
  setLensingFalloff: (falloff: number) => void
  setLensingPivot: (value: number) => void
  setLensingCore: (value: number) => void
  setLensingMaxBend: (value: number) => void
  setLensingReach: (value: number) => void
  setLensingTwistLimit: (value: number) => void
  setLensingAbsorption: (absorption: number) => void
  setFrameRateCap: (fps: number) => void
  setMeasuredFps: (fps: number) => void
  toggleAdaptiveParticles: () => void
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
  blackHoleSize: 8,
  eventHorizon: 8,
  gravityReach: 5,
  ringEnabled: true,
  ringFeedEnabled: true,
  ringBrightness: 0.9,
  ringWidth: 0.012,
  ringDoppler: 0.45,
  ringSide: 1.9,
  ringBase: 0.45,
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
  frameRateCap: 0,
  measuredFps: 0,
  adaptiveParticles: true,
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

  setNumParticles: (num) => set({ numParticles: num }),
  setBaseSpeed: (speed) => set({ baseSpeed: speed }),
  setGravityStrength: (gravity) => set({ gravityStrength: gravity }),
  setOrbitalStrength: (orbital) => set({ orbitalStrength: orbital }),
  setBlackHoleSize: (size) => set({ blackHoleSize: size }),
  setEventHorizon: (horizon) => set({ eventHorizon: horizon }),
  setGravityReach: (reach) => set({ gravityReach: reach }),
  toggleRing: () => set((state) => ({ ringEnabled: !state.ringEnabled })),
  toggleRingFeed: () => set((state) => ({ ringFeedEnabled: !state.ringFeedEnabled })),
  setRingBrightness: (value) => set({ ringBrightness: value }),
  setRingWidth: (value) => set({ ringWidth: value }),
  setRingDoppler: (value) => set({ ringDoppler: value }),
  setRingSide: (value) => set({ ringSide: value }),
  setRingBase: (value) => set({ ringBase: value }),
  setRingFeed: (value) => set({ ringFeed: value }),
  setRingAfterglow: (value) => set({ ringAfterglow: value }),
  setRingFlowSpeed: (value) => set({ ringFlowSpeed: value }),
  setFollowFrequency: (value) => set({ followFrequency: value }),
  setStarsBrightness: (value) => set({ starsBrightness: value }),
  setStarDensity: (value) => set({ starDensity: value }),
  setStarCell: (value) => set({ starCell: value }),
  setPulseIntensity: (intensity) => set({ pulseIntensity: intensity }),
  toggleBlackHoleFollowing: () => set((state) => ({ blackHoleFollowing: !state.blackHoleFollowing })),
  setBlackHoleX: (x) => set({ blackHoleX: toShare(x), blackHoleFollowing: false }),
  setBlackHoleY: (y) => set({ blackHoleY: toShare(y), blackHoleFollowing: false }),
  setBlackHolePosition: (x, y) => set({ blackHoleX: toShare(x), blackHoleY: toShare(y) }),
  anchorBlackHoleAt: (x, y) => set({ blackHoleX: toShare(x), blackHoleY: toShare(y), blackHoleFollowing: false }),
  setLensingRadius: (radius) => set({ lensingRadius: radius }),
  toggleLensing: () => set((state) => ({ lensingEnabled: !state.lensingEnabled })),
  setFarZ: (farZ) => set({ farZ }),
  setBaseBrightness: (brightness) => set({ baseBrightness: brightness }),
  setDepthFade: (fade) => set({ depthFade: fade }),
  setMinOpacity: (opacity) => set({ minOpacity: opacity }),
  setMaxOpacity: (opacity) => set({ maxOpacity: opacity }),
  setPulseSpeedMultiplier: (multiplier) => set({ pulseSpeedMultiplier: multiplier }),
  setTrailIntensity: (intensity) => set({ trailIntensity: intensity }),
  setSpeedGlow: (value) => set({ speedGlow: value }),
  setParticleSize: (value) => set({ particleSize: value }),
  setSpawnRadius: (value) => set({ spawnRadius: value }),
  setBlackHoleDepth: (value) => set({ blackHoleDepth: value }),
  setGravityDepth: (value) => set({ gravityDepth: value }),
  setScrollSpeedStep: (value) => set({ scrollSpeedStep: value }),
  setSpeedVariance: (variance) => set({ speedVariance: variance }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setLensingRotation: (rotation) => set({ lensingRotation: rotation }),
  setLensingFalloff: (falloff) => set({ lensingFalloff: falloff }),
  setLensingPivot: (value) => set({ lensingPivot: value }),
  setLensingCore: (value) => set({ lensingCore: value }),
  setLensingMaxBend: (value) => set({ lensingMaxBend: value }),
  setLensingReach: (value) => set({ lensingReach: value }),
  setLensingTwistLimit: (value) => set({ lensingTwistLimit: value }),
  setLensingAbsorption: (absorption) => set({ lensingAbsorption: absorption }),
  setFrameRateCap: (fps) => set({ frameRateCap: fps }),
  setMeasuredFps: (fps) => set({ measuredFps: fps }),
  toggleAdaptiveParticles: () => set((state) => ({ adaptiveParticles: !state.adaptiveParticles })),
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
