import { useParticleStore } from '../store/particle_store'
import { useShallow } from 'zustand/react/shallow'

/**
 * Custom hook that selects only the color palette related values from the store
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useColorPaletteStore () {
  return useParticleStore(useShallow((state) => ({
    colorPalette: state.colorPalette,
    addColor: state.addColor,
    removeColor: state.removeColor,
    updateColor: state.updateColor
  })))
}

