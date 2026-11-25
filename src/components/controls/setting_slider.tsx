import { memo, useCallback } from 'react'
import { useParticleStore, type ParticleState } from '../../store/particle_store'
import { DEFAULT_PRESET } from '../../store/preset_store'
import { SIMULATION_SETTING_SPECS, type SimulationSettingSpec, type SimulationSliderKey } from '../../lib/simulation_specs'
import SliderControl from './slider_control'

type NumberSetter = {
  [Key in keyof ParticleState]: Key extends `set${string}`
    ? ParticleState[Key] extends (value: number) => void ? Key : never
    : never
}[keyof ParticleState]

interface SettingSliderProps {
  field: SimulationSliderKey
  // Only for a setting that does more than store its value (the hole's place also stops it following the
  // cursor); a slider without one sets its field
  setter?: NumberSetter
}

const defaults = DEFAULT_PRESET.settings as Partial<Record<SimulationSliderKey, number>>

// A slider bound to one setting: changing the setting re-renders this slider and no other. Its name, range,
// format and one-line hint come from the settings registry, which the agent API reads too; the default it
// marks and returns to on a double-click comes from the Default preset
const SettingSlider = memo(function SettingSlider ({ field, setter }: SettingSliderProps) {
  const value = useParticleStore(state => state[field])
  const ownSetter = useParticleStore(state => (setter ? state[setter] : null))
  const setField = useCallback((next: number) => useParticleStore.setState({ [field]: next } as Partial<ParticleState>), [field])
  const onChange = ownSetter ?? setField
  const { label, min, max, step, format, hint, spokenName } = SIMULATION_SETTING_SPECS[field] as SimulationSettingSpec

  return (
    <SliderControl
      id={`setting-${field}`}
      label={label}
      ariaLabel={spokenName}
      min={min}
      max={max}
      step={step}
      formatValue={format}
      description={hint}
      resetValue={defaults[field]}
      value={value}
      onChange={onChange}
    />
  )
})

export default SettingSlider
