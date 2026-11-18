import { createWithEqualityFn } from 'zustand/traditional'

export interface ParticleColor {
  r: number
  g: number
  b: number
  enabled: boolean
  percent: number
}

interface ParticleState {
  numParticles: number
  baseSpeed: number
  gravityStrength: number
  orbitalStrength: number
  // Black hole shadow radius, % of the viewport's short side
  eventHorizon: number
  // Reach of the black hole's gravity, in multiples of its radius
  gravityReach: number
  pulseIntensity: number
  blackHoleFollowing: boolean
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
  speedVariance: number
  isPaused: boolean
  lensingRotation: number
  lensingFalloff: number
  lensingAbsorption: number
  frameRateCap: number
  measuredFps: number
  introComplete: boolean
  horizonCrossed: boolean

  setNumParticles: (num: number) => void
  setBaseSpeed: (speed: number) => void
  setGravityStrength: (gravity: number) => void
  setOrbitalStrength: (orbital: number) => void
  setEventHorizon: (horizon: number) => void
  setGravityReach: (reach: number) => void
  setPulseIntensity: (intensity: number) => void
  toggleBlackHoleFollowing: () => void
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
  setSpeedVariance: (variance: number) => void
  togglePause: () => void
  setLensingRotation: (rotation: number) => void
  setLensingFalloff: (falloff: number) => void
  setLensingAbsorption: (absorption: number) => void
  setFrameRateCap: (fps: number) => void
  setMeasuredFps: (fps: number) => void
  setIntroComplete: (complete: boolean) => void
  setHorizonCrossed: (crossed: boolean) => void
}

// Phones get half the particles: the simulation runs on the CPU every frame
const isSmallScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

export const useParticleStore = createWithEqualityFn<ParticleState>((set) => ({
  numParticles: isSmallScreen ? 12000 : 24000,
  baseSpeed: 1.5,
  gravityStrength: 2.5,
  orbitalStrength: 40,
  eventHorizon: 8,
  gravityReach: 5,
  pulseIntensity: 1,
  blackHoleFollowing: true,
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
  speedVariance: 0.15,
  isPaused: false,
  lensingRotation: 0.15,
  lensingFalloff: 2.0,
  lensingAbsorption: 0.25,
  frameRateCap: 0,
  measuredFps: 0,
  introComplete: false,
  horizonCrossed: false,
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
  setEventHorizon: (horizon) => set({ eventHorizon: horizon }),
  setGravityReach: (reach) => set({ gravityReach: reach }),
  setPulseIntensity: (intensity) => set({ pulseIntensity: intensity }),
  toggleBlackHoleFollowing: () => set((state) => ({ blackHoleFollowing: !state.blackHoleFollowing })),
  setLensingRadius: (radius) => set({ lensingRadius: radius }),
  toggleLensing: () => set((state) => ({ lensingEnabled: !state.lensingEnabled })),
  setFarZ: (farZ) => set({ farZ }),
  setBaseBrightness: (brightness) => set({ baseBrightness: brightness }),
  setDepthFade: (fade) => set({ depthFade: fade }),
  setMinOpacity: (opacity) => set({ minOpacity: opacity }),
  setMaxOpacity: (opacity) => set({ maxOpacity: opacity }),
  setPulseSpeedMultiplier: (multiplier) => set({ pulseSpeedMultiplier: multiplier }),
  setTrailIntensity: (intensity) => set({ trailIntensity: intensity }),
  setSpeedVariance: (variance) => set({ speedVariance: variance }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setLensingRotation: (rotation) => set({ lensingRotation: rotation }),
  setLensingFalloff: (falloff) => set({ lensingFalloff: falloff }),
  setLensingAbsorption: (absorption) => set({ lensingAbsorption: absorption }),
  setFrameRateCap: (fps) => set({ frameRateCap: fps }),
  setMeasuredFps: (fps) => set({ measuredFps: fps }),
  setIntroComplete: (complete) => set({ introComplete: complete }),
  setHorizonCrossed: (crossed) => set({ horizonCrossed: crossed }),

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
