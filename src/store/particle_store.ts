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
  eventHorizon: number
  mouseRadius: number
  pulseIntensity: number
  scrollSpeed: number
  mouseX: number
  mouseY: number
  blackHoleAttached: boolean
  colorPalette: ParticleColor[]
  backgroundR: number
  backgroundG: number
  backgroundB: number
  isAnimationStarted: boolean
  lensingMass: number
  lensingEnabled: boolean
  
  setNumParticles: (num: number) => void
  setBaseSpeed: (speed: number) => void
  setGravityStrength: (gravity: number) => void
  setOrbitalStrength: (orbital: number) => void
  setEventHorizon: (horizon: number) => void
  setMouseRadius: (radius: number) => void
  setPulseIntensity: (intensity: number) => void
  setScrollSpeed: (speed: number) => void
  setMousePosition: (x: number, y: number) => void
  toggleBlackHole: () => void
  addColor: (color: ParticleColor) => void
  removeColor: (index: number) => void
  updateColor: (index: number, updates: Partial<ParticleColor>) => void
  setBackgroundColor: (r: number, g: number, b: number) => void
  startAnimation: () => void
  setLensingMass: (mass: number) => void
  toggleLensing: () => void
}

export const useParticleStore = createWithEqualityFn<ParticleState>((set) => ({
  numParticles: 10000,
  baseSpeed: 1,
  gravityStrength: 0,
  orbitalStrength: 0,
  eventHorizon: 10,
  mouseRadius: 50,
  pulseIntensity: 1,
  scrollSpeed: 0,
  mouseX: NaN,
  mouseY: NaN,
  blackHoleAttached: true,
  backgroundR: 0,
  backgroundG: 0,
  backgroundB: 0,
  isAnimationStarted: false,
  lensingMass: 10,
  lensingEnabled: true,
  colorPalette: [
    { r: 255, g: 0, b: 0, enabled: true, percent: 20 },
    { r: 0, g: 255, b: 255, enabled: true, percent: 20 },
    { r: 153, g: 69, b: 255, enabled: true, percent: 20 },
    { r: 255, g: 255, b: 255, enabled: true, percent: 20 },
    { r: 255, g: 255, b: 0, enabled: true, percent: 20 }
  ],

  setNumParticles: (num) => set({ numParticles: num }),
  setBaseSpeed: (speed) => set({ baseSpeed: speed }),
  setGravityStrength: (gravity) => set({ gravityStrength: gravity }),
  setOrbitalStrength: (orbital) => set({ orbitalStrength: orbital }),
  setEventHorizon: (horizon) => set({ eventHorizon: horizon }),
  setMouseRadius: (radius) => set({ mouseRadius: radius }),
  setPulseIntensity: (intensity) => set({ pulseIntensity: intensity }),
  setScrollSpeed: (speed) => set({ scrollSpeed: speed }),
  setMousePosition: (x, y) => set({ mouseX: x, mouseY: y }),
  toggleBlackHole: () => set((state) => ({ blackHoleAttached: !state.blackHoleAttached })),
  setLensingMass: (mass) => set({ lensingMass: mass }),
  toggleLensing: () => set((state) => ({ lensingEnabled: !state.lensingEnabled })),
  
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
  
  setBackgroundColor: (r, g, b) => set({ backgroundR: r, backgroundG: g, backgroundB: b }),
  startAnimation: () => set({ isAnimationStarted: true })
}))

