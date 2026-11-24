import { useParticleStore } from '../../store/particle_store'
import {
  DEFAULT_PRESET,
  DEFAULT_PRESET_ID,
  findPresetByName,
  isReservedPresetName,
  usePresetStore
} from '../../store/preset_store'
import { sameSimulationSettings } from '../../lib/simulation_presets'
import PresetItem, { PresetStorageAlert } from './preset_item'
import PresetSaveForm from './preset_save_form'

// The last answer of the comparison below: the closed header and the list both ask on every store update,
// the measured frame rate's included, and the second one gets it for free
let compared: { state: unknown, settings: unknown, modified: boolean } | null = null
function differsFromPreset (state: Parameters<typeof sameSimulationSettings>[0], settings: Parameters<typeof sameSimulationSettings>[1]) {
  if (compared?.state !== state || compared.settings !== settings) {
    compared = { state, settings, modified: !sameSimulationSettings(state, settings) }
  }
  return compared.modified
}

// The active preset and whether the settings have moved away from it. The answer re-renders its reader only
// when it flips, not on every change of a setting
function useActivePreset () {
  const presets = usePresetStore(state => state.presets)
  const activeId = usePresetStore(state => state.activeId)
  const list = [DEFAULT_PRESET, ...presets]
  const active = list.find(preset => preset.id === activeId) ?? DEFAULT_PRESET
  const modified = useParticleStore(state => differsFromPreset(state, active.settings))
  return { presets, list, active, modified }
}

// The active preset's name, for the closed Presets header, so the panel can open with the section closed
// and still say which setup is on
export function ActivePresetName () {
  const { active, modified } = useActivePreset()

  return (
    <span className="min-w-0 truncate pr-3 font-mono text-xs text-text-light/70">
      <span className="text-neon-cyan">{active.name}</span>
      {modified && ' · modified'}
    </span>
  )
}

// Saves the whole simulation setup under a name and brings it back with one click
function PresetControl () {
  const { presets, list, active, modified } = useActivePreset()
  const storageFailed = usePresetStore(state => state.storageFailed)
  const savePreset = usePresetStore(state => state.savePreset)
  const applyPreset = usePresetStore(state => state.applyPreset)
  const updatePreset = usePresetStore(state => state.updatePreset)
  const deletePreset = usePresetStore(state => state.deletePreset)

  return (
    <div role="group" aria-label="Simulation presets" className="flex flex-col gap-1">
      {/* No scroll box of its own: the section collapses, and a list inside the scrolling panel would trap the wheel */}
      <ul className="flex flex-col gap-1">
        {list.map(preset => (
          <PresetItem
            key={preset.id}
            name={preset.name}
            active={preset.id === active.id}
            modified={modified}
            builtIn={preset.id === DEFAULT_PRESET_ID}
            subject="the current settings"
            onApply={() => applyPreset(preset.id)}
            onUpdate={() => updatePreset(preset.id)}
            onDelete={() => deletePreset(preset.id)}
            className="shrink-0"
            nameClassName="flex-1"
          />
        ))}
      </ul>

      <PresetSaveForm
        subject="the current settings"
        isReserved={isReservedPresetName}
        isTaken={(name) => findPresetByName(presets, name) !== undefined}
        onSave={savePreset}
        className="w-full justify-center"
      />

      {storageFailed && <PresetStorageAlert />}
    </div>
  )
}

export default PresetControl
