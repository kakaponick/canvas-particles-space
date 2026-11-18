import { useParticleStore } from '../store/particle_store'
import { useShallow } from 'zustand/react/shallow'

/**
 * Custom hook that selects only the control panel related values from the store
 * Uses shallow comparison to prevent re-renders when the object shape is the same
 * This prevents re-renders when unrelated store values (like the measured frame rate) change
 */
export function useControlPanelStore () {
  return useParticleStore(useShallow((state) => ({
    // Values
    numParticles: state.numParticles,
    baseSpeed: state.baseSpeed,
    gravityStrength: state.gravityStrength,
    orbitalStrength: state.orbitalStrength,
    blackHoleSize: state.blackHoleSize,
    eventHorizon: state.eventHorizon,
    gravityReach: state.gravityReach,
    pulseIntensity: state.pulseIntensity,
    backgroundR: state.backgroundR,
    backgroundG: state.backgroundG,
    backgroundB: state.backgroundB,
    lensingRadius: state.lensingRadius,
    lensingEnabled: state.lensingEnabled,
    farZ: state.farZ,
    baseBrightness: state.baseBrightness,
    depthFade: state.depthFade,
    minOpacity: state.minOpacity,
    maxOpacity: state.maxOpacity,
    pulseSpeedMultiplier: state.pulseSpeedMultiplier,
    trailIntensity: state.trailIntensity,
    speedVariance: state.speedVariance,
    lensingRotation: state.lensingRotation,
    lensingFalloff: state.lensingFalloff,
    lensingAbsorption: state.lensingAbsorption,
    
    // Setters
    setNumParticles: state.setNumParticles,
    setBaseSpeed: state.setBaseSpeed,
    setGravityStrength: state.setGravityStrength,
    setOrbitalStrength: state.setOrbitalStrength,
    setBlackHoleSize: state.setBlackHoleSize,
    setEventHorizon: state.setEventHorizon,
    setGravityReach: state.setGravityReach,
    setPulseIntensity: state.setPulseIntensity,
    setBackgroundColor: state.setBackgroundColor,
    setLensingRadius: state.setLensingRadius,
    toggleLensing: state.toggleLensing,
    setFarZ: state.setFarZ,
    setBaseBrightness: state.setBaseBrightness,
    setDepthFade: state.setDepthFade,
    setMinOpacity: state.setMinOpacity,
    setMaxOpacity: state.setMaxOpacity,
    setPulseSpeedMultiplier: state.setPulseSpeedMultiplier,
    setTrailIntensity: state.setTrailIntensity,
    setSpeedVariance: state.setSpeedVariance,
    setLensingRotation: state.setLensingRotation,
    setLensingFalloff: state.setLensingFalloff,
    setLensingAbsorption: state.setLensingAbsorption
  })))
}

