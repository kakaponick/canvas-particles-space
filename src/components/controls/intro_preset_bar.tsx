import { useState, type FormEvent } from 'react'
import { Check, Layers, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntroDebugStore } from '../../store/intro_debug_store'
import {
  BUILT_IN_INTRO_PRESETS,
  DEFAULT_INTRO_PRESET,
  findIntroPresetByName,
  isReservedIntroPresetName,
  sameIntroSetup,
  useIntroPresetStore,
  type IntroPreset
} from '../../store/intro_preset_store'
import { PRESET_NAME_MAX_LENGTH, normalizePresetName } from '../../lib/simulation_presets'
import ToggleButton from './toggle_button'

const chipAction = cn(
  'flex h-7 w-7 shrink-0 items-center justify-center text-text-light/60 transition-colors duration-150 hover:text-neon-cyan',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan'
)

interface PresetChipProps {
  preset: IntroPreset
  active: boolean
  modified: boolean
}

function PresetChip ({ preset, active, modified }: PresetChipProps) {
  const applyPreset = useIntroPresetStore(state => state.applyPreset)
  const updatePreset = useIntroPresetStore(state => state.updatePreset)
  const deletePreset = useIntroPresetStore(state => state.deletePreset)
  const [confirming, setConfirming] = useState(false)
  const builtIn = preset.builtIn === true

  return (
    <li
      className={cn('flex shrink-0 items-center border', active ? 'border-neon-cyan/60 bg-neon-cyan/10' : 'border-text-light/15')}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        aria-pressed={active}
        title={active && modified ? 'Click to drop the changes and return to this preset' : preset.description}
        onClick={() => applyPreset(preset.id)}
        className={cn(
          'flex h-7 max-w-[14rem] items-center gap-2 px-2 text-left transition-colors duration-150 hover:text-neon-cyan',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
          active ? 'text-neon-cyan' : 'text-text-light/85'
        )}
      >
        <span className="truncate">{preset.name}</span>
        {preset.scene && <Layers aria-label="Saved with the scene" className="h-3 w-3 shrink-0 text-text-light/60" />}
        {active && modified && <span className="shrink-0 text-text-light/60">modified</span>}
      </button>

      {active && modified && !builtIn && (
        <button
          type="button"
          aria-label={`Update ${preset.name} with the current intro`}
          title="Update with the current intro"
          onClick={() => updatePreset(preset.id)}
          className={chipAction}
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
            className="flex h-7 shrink-0 items-center gap-1 px-2 text-neon-magenta transition-colors duration-150
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
            className={chipAction}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ))}
    </li>
  )
}

// Saves the whole intro, its numbers and its title, under a name and brings it back with one click
function IntroPresetBar () {
  const presets = useIntroPresetStore(state => state.presets)
  const activeId = useIntroPresetStore(state => state.activeId)
  const storageFailed = useIntroPresetStore(state => state.storageFailed)
  const savePreset = useIntroPresetStore(state => state.savePreset)
  const withScene = useIntroPresetStore(state => state.withScene)
  const setWithScene = useIntroPresetStore(state => state.setWithScene)
  const [name, setName] = useState('')

  const list = [...BUILT_IN_INTRO_PRESETS, ...presets]
  const active = list.find(preset => preset.id === activeId) ?? DEFAULT_INTRO_PRESET
  // Re-renders only when the answer changes, not on every step of a slider
  const modified = useIntroDebugStore(state => !sameIntroSetup(state.params, state.title, state.hidden, active))

  const cleanName = normalizePresetName(name)
  const reserved = isReservedIntroPresetName(cleanName)
  const replaces = cleanName !== '' && findIntroPresetByName(presets, cleanName) !== undefined

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!cleanName || reserved) return
    savePreset(cleanName)
    setName('')
  }

  return (
    <div role="group" aria-label="Intro presets" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neon-cyan/20 px-3 py-1.5">
      <span className="text-text-light/60">Presets</span>
      <ul className="flex max-h-[4.25rem] min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto">
        {list.map(preset => (
          <PresetChip key={preset.id} preset={preset} active={preset.id === active.id} modified={modified} />
        ))}
      </ul>

      <ToggleButton
        active={withScene}
        aria-pressed={withScene}
        onClick={() => setWithScene(!withScene)}
        title="With the scene: a preset is saved together with the settings panel (particles, colours, black hole), and choosing a preset that has them replaces yours. Off: presets touch only the intro."
        className="h-7 gap-1 px-2 text-xs"
      >
        <Layers className="h-3.5 w-3.5" />
        SCENE
      </ToggleButton>

      <form onSubmit={handleSubmit} className="flex gap-1">
        <input
          type="text"
          value={name}
          maxLength={PRESET_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name for the current intro"
          aria-label="Intro preset name"
          aria-invalid={reserved}
          className="h-7 w-52 min-w-0 border border-neon-cyan/30 bg-black/40 px-2 text-xs text-text-light caret-neon-cyan
            outline-none transition-colors duration-150 placeholder:text-text-light/60 selection:bg-neon-cyan/30 focus:border-neon-cyan"
        />
        <ToggleButton type="submit" active={false} disabled={!cleanName || reserved} className="h-7 w-20 gap-1 px-0 text-xs">
          <Save className="h-3.5 w-3.5" />
          {replaces ? 'REPLACE' : 'SAVE'}
        </ToggleButton>
      </form>

      {reserved && (
        <p role="alert" className="w-full text-neon-yellow/80">
          {cleanName} is built in. Choose another name.
        </p>
      )}
      {storageFailed && (
        <p role="alert" className="w-full text-neon-yellow/80">
          The browser did not store this change, so it lasts until the page reloads.
        </p>
      )}
    </div>
  )
}

export default IntroPresetBar
