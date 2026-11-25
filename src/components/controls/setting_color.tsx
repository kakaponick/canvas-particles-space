import { memo, useCallback } from 'react'
import { useParticleStore, type ParticleState } from '../../store/particle_store'
import { DEFAULT_PRESET } from '../../store/preset_store'
import { SIMULATION_COLOR_SPECS, type SimulationColorKey, type SimulationColorSpec } from '../../lib/simulation_specs'
import ColorPickerInput from './color_picker_input'

const defaults = DEFAULT_PRESET.settings as Partial<Record<SimulationColorKey, string>>

// A color row bound to one color setting, as SettingSlider is to a number: changing the setting re-renders
// this row and no other. Its name and hint come from the settings registry, which the agent API reads too;
// the default its context menu returns to comes from the Default preset
const SettingColor = memo(function SettingColor ({ field }: { field: SimulationColorKey }) {
  const value = useParticleStore(state => state[field])
  // The store keeps a color in lower case, so a preset and the picker's value compare equal
  const setField = useCallback((next: string) => useParticleStore.setState({ [field]: next.toLowerCase() } as Partial<ParticleState>), [field])
  const { label, hint, spokenName } = SIMULATION_COLOR_SPECS[field] as SimulationColorSpec

  return (
    <ColorPickerInput
      label={label}
      ariaLabel={spokenName}
      description={hint}
      resetValue={defaults[field]}
      value={value}
      onChange={setField}
    />
  )
})

export default SettingColor
