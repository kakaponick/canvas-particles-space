import { useParticleStore } from '../store/particle_store'
import { shallow } from 'zustand/shallow'

/**
 * Custom hook that selects only the color palette related values from the store
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useColorPaletteStore () {
  return useParticleStore((state) => ({
    colorPalette: state.colorPalette,
    addColor: state.addColor,
    removeColor: state.removeColor,
    updateColor: state.updateColor
  }), shallow)
}

