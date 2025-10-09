import { create } from 'zustand'

export interface ParticleColor {
  r: number
  g: number
  b: number
  enabled: boolean
  percent: number
  name: string
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
}

export const useParticleStore = create<ParticleState>((set) => ({
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
  colorPalette: [
    { r: 255, g: 0, b: 0, enabled: true, percent: 20, name: 'red' },
    { r: 0, g: 255, b: 255, enabled: true, percent: 20, name: 'cyan' },
    { r: 153, g: 69, b: 255, enabled: true, percent: 20, name: 'purple' },
    { r: 255, g: 255, b: 255, enabled: true, percent: 20, name: 'white' },
    { r: 255, g: 255, b: 0, enabled: true, percent: 20, name: 'yellow' }
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
  }))
}))

