import type { ComponentProps } from 'react'
import { useParticleStore, type ParticleState } from '../../store/particle_store'
import SliderControl from './slider_control'

type NumberSetting = {
  [Key in keyof ParticleState]: ParticleState[Key] extends number ? Key : never
}[keyof ParticleState]

type NumberSetter = {
  [Key in keyof ParticleState]: Key extends `set${string}`
    ? ParticleState[Key] extends (value: number) => void ? Key : never
    : never
}[keyof ParticleState]

interface SettingSliderProps extends Omit<ComponentProps<typeof SliderControl>, 'value' | 'onChange'> {
  field: NumberSetting
  setter: NumberSetter
}

// A slider bound to one setting: changing the setting re-renders this slider and no other
function SettingSlider ({ field, setter, ...slider }: SettingSliderProps) {
  const value = useParticleStore(state => state[field])
  const onChange = useParticleStore(state => state[setter])

  return <SliderControl {...slider} value={value} onChange={onChange} />
}

export default SettingSlider
