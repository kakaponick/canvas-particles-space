import { useState, type FormEvent } from 'react'
import { Check, Save, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useParticleStore } from '../../store/particle_store'
import {
  DEFAULT_PRESET,
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_NAME,
  findPresetByName,
  isReservedPresetName,
  usePresetStore
} from '../../store/preset_store'
import {
  PRESET_NAME_MAX_LENGTH,
  normalizePresetName,
  sameSimulationSettings,
  selectSimulationSettings,
  type SimulationPreset
} from '../../lib/simulation_presets'
import ToggleButton from './toggle_button'

const rowAction = cn(
  'flex h-7 w-7 shrink-0 items-center justify-center text-text-light/60 transition-colors duration-150 hover:text-neon-cyan',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan'
)

interface PresetRowProps {
  preset: SimulationPreset
  active: boolean
  modified: boolean
}

function PresetRow ({ preset, active, modified }: PresetRowProps) {
  const applyPreset = usePresetStore(state => state.applyPreset)
  const updatePreset = usePresetStore(state => state.updatePreset)
  const deletePreset = usePresetStore(state => state.deletePreset)
  const [confirming, setConfirming] = useState(false)
  const builtIn = preset.id === DEFAULT_PRESET_ID

  return (
    <li
      className={cn('flex items-center border', active ? 'border-neon-cyan/60 bg-neon-cyan/10' : 'border-text-light/15')}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={() => applyPreset(preset.id)}
        className={cn(
          'flex h-7 min-w-0 flex-1 items-center gap-2 px-2 text-left font-mono text-xs transition-colors duration-150 hover:text-neon-cyan',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
          active ? 'text-neon-cyan' : 'text-text-light/85'
        )}
      >
        <span className="truncate">{preset.name}</span>
        {active && modified && <span className="shrink-0 text-text-light/60">modified</span>}
      </button>

      {active && modified && !builtIn && (
        <button
          type="button"
          aria-label={`Update ${preset.name} with the current settings`}
          title="Update with the current settings"
          onClick={() => updatePreset(preset.id)}
          className={rowAction}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      )}

      {!builtIn && (confirming
        ? (
          <button
            type="button"
            autoFocus
            aria-label={`Confirm deleting ${preset.name}`}
            onClick={() => deletePreset(preset.id)}
            onBlur={() => setConfirming(false)}
            className="flex h-7 shrink-0 items-center gap-1 px-2 font-mono text-xs text-neon-magenta transition-colors duration-150
              hover:text-text-light focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-magenta"
          >
            <Check className="h-3.5 w-3.5" />
            Delete
          </button>
        )
        : (
          <button
            type="button"
            aria-label={`Delete ${preset.name}`}
            title="Delete"
            onClick={() => setConfirming(true)}
            className={rowAction}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ))}
    </li>
  )
}

// Saves the whole simulation setup under a name and brings it back with one click
function PresetControl () {
  const presets = usePresetStore(state => state.presets)
  const activeId = usePresetStore(state => state.activeId)
  const storageFailed = usePresetStore(state => state.storageFailed)
  const savePreset = usePresetStore(state => state.savePreset)
  const current = useParticleStore(useShallow(selectSimulationSettings))
  const [name, setName] = useState('')

  const list = [DEFAULT_PRESET, ...presets]
  const active = list.find(preset => preset.id === activeId) ?? DEFAULT_PRESET
  const modified = !sameSimulationSettings(current, active.settings)

  const cleanName = normalizePresetName(name)
  const reserved = isReservedPresetName(cleanName)
  const replaces = cleanName !== '' && findPresetByName(presets, cleanName) !== undefined

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!cleanName || reserved) return
    savePreset(cleanName)
    setName('')
  }

  return (
    <div role="group" aria-label="Simulation presets">
      <ul className="mb-1 max-h-32 space-y-1 overflow-y-auto">
        {list.map(preset => (
          <PresetRow key={preset.id} preset={preset} active={preset.id === active.id} modified={modified} />
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex gap-1">
        <input
          type="text"
          value={name}
          maxLength={PRESET_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name for the current settings"
          aria-label="Preset name"
          aria-invalid={reserved}
          className="h-7 min-w-0 flex-1 border border-neon-cyan/30 bg-black/40 px-2 font-mono text-xs text-text-light caret-neon-cyan
            outline-none transition-colors duration-150 placeholder:text-text-light/60 selection:bg-neon-cyan/30 focus:border-neon-cyan"
        />
        <ToggleButton type="submit" active={false} disabled={!cleanName || reserved} className="h-7 w-20 gap-1 px-0 font-mono text-xs">
          <Save className="h-3.5 w-3.5" />
          {replaces ? 'REPLACE' : 'SAVE'}
        </ToggleButton>
      </form>

      {reserved && (
        <p role="alert" className="mt-1.5 font-mono text-xs text-neon-yellow/80">
          {DEFAULT_PRESET_NAME} is built in. Choose another name.
        </p>
      )}
      {storageFailed && (
        <p role="alert" className="mt-1.5 font-mono text-xs text-neon-yellow/80">
          The browser did not store this change, so it lasts until the page reloads.
        </p>
      )}
    </div>
  )
}

export default PresetControl
