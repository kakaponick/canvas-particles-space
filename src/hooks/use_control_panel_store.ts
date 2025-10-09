import { useParticleStore } from '../store/particle_store'
import { shallow } from 'zustand/shallow'

/**
 * Custom hook that selects only the control panel related values from the store
 * Uses shallow comparison to prevent re-renders when the object shape is the same
 * This prevents re-renders when unrelated store values (like mouseX/mouseY) change
 */
export function useControlPanelStore () {
  return useParticleStore((state) => ({
    // Values
    numParticles: state.numParticles,
    baseSpeed: state.baseSpeed,
    gravityStrength: state.gravityStrength,
    orbitalStrength: state.orbitalStrength,
    eventHorizon: state.eventHorizon,
    mouseRadius: state.mouseRadius,
    pulseIntensity: state.pulseIntensity,
    
    // Setters
    setNumParticles: state.setNumParticles,
    setBaseSpeed: state.setBaseSpeed,
    setGravityStrength: state.setGravityStrength,
    setOrbitalStrength: state.setOrbitalStrength,
    setEventHorizon: state.setEventHorizon,
    setMouseRadius: state.setMouseRadius,
    setPulseIntensity: state.setPulseIntensity
  }), shallow)
}

