import type { ComponentProps } from 'react'
import { useParticleStore, type ParticleState } from '../../store/particle_store'
import { SIMULATION_SETTING_SPECS, type SimulationSliderKey } from '../../lib/simulation_specs'
import SliderControl from './slider_control'

type NumberSetter = {
  [Key in keyof ParticleState]: Key extends `set${string}`
    ? ParticleState[Key] extends (value: number) => void ? Key : never
    : never
}[keyof ParticleState]

interface SettingSliderProps extends Omit<ComponentProps<typeof SliderControl>, 'value' | 'onChange' | 'label' | 'min' | 'max' | 'step' | 'description'> {
  field: SimulationSliderKey
  setter: NumberSetter
}

// A slider bound to one setting: changing the setting re-renders this slider and no other. Its name, range
// and description come from the settings registry, which the agent API reads too
function SettingSlider ({ field, setter, ...slider }: SettingSliderProps) {
  const value = useParticleStore(state => state[field])
  const onChange = useParticleStore(state => state[setter])
  const { label, min, max, step, description } = SIMULATION_SETTING_SPECS[field]

  return <SliderControl {...slider} label={label} min={min} max={max} step={step} description={description} value={value} onChange={onChange} />
}

export default SettingSlider
