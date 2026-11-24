import { memo, useCallback, useEffect, useRef } from 'react'
import { Layers } from 'lucide-react'
import { useIntroDebugStore, type TitleText } from '../../store/intro_debug_store'
import {
  BUILT_IN_INTRO_PRESETS,
  DEFAULT_INTRO_PRESET,
  findIntroPresetByName,
  isReservedIntroPresetName,
  sameIntroSetup,
  useIntroPresetStore,
  type IntroPreset
} from '../../store/intro_preset_store'
import type { IntroParams } from '../../lib/intro_params'
import type { IntroLayer } from '../../lib/intro_tracks'
import ToggleButton from './toggle_button'
import PresetItem, { PresetStorageAlert } from './preset_item'
import PresetSaveForm from './preset_save_form'

interface ModifiedCheck {
  params: IntroParams
  title: TitleText
  hidden: Record<IntroLayer, boolean>
  preset: IntroPreset
  modified: boolean
}

// The vertical wheel scrolls the one-row preset list sideways, so a mouse without a side wheel reaches every
// preset. The listener blocks the page's scroll, so it is attached only while the row overflows, and at either
// end of the row the wheel goes on to the page
function scrollSidewaysOnWheel (list: HTMLUListElement) {
  let attached = false
  const handleWheel = (event: WheelEvent) => {
    if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    const atStart = list.scrollLeft <= 0
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1
    if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return
    event.preventDefault()
    list.scrollLeft += event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
  }
  const check = () => {
    const overflows = list.scrollWidth > list.clientWidth
    if (overflows === attached) return
    attached = overflows
    if (overflows) list.addEventListener('wheel', handleWheel, { passive: false })
    else list.removeEventListener('wheel', handleWheel)
  }
  const observer = new ResizeObserver(check)
  observer.observe(list)
  return {
    check,
    detach: () => {
      observer.disconnect()
      list.removeEventListener('wheel', handleWheel)
    }
  }
}

// Saves the whole intro, its numbers and its title, under a name and brings it back with one click
function IntroPresetBar () {
  const wheel = useRef<ReturnType<typeof scrollSidewaysOnWheel> | null>(null)
  const listRef = useCallback((list: HTMLUListElement | null) => {
    wheel.current?.detach()
    wheel.current = list ? scrollSidewaysOnWheel(list) : null
  }, [])
  const presets = useIntroPresetStore(state => state.presets)
  const activeId = useIntroPresetStore(state => state.activeId)
  const storageFailed = useIntroPresetStore(state => state.storageFailed)
  const savePreset = useIntroPresetStore(state => state.savePreset)
  const applyPreset = useIntroPresetStore(state => state.applyPreset)
  const updatePreset = useIntroPresetStore(state => state.updatePreset)
  const deletePreset = useIntroPresetStore(state => state.deletePreset)
  const withScene = useIntroPresetStore(state => state.withScene)
  const setWithScene = useIntroPresetStore(state => state.setWithScene)

  const list = [...BUILT_IN_INTRO_PRESETS, ...presets]
  const active = list.find(preset => preset.id === activeId) ?? DEFAULT_INTRO_PRESET
  // Re-renders only when the answer changes, not on every step of a slider. The answer is worked out again
  // only when the setup or the preset changes, so the readout's frequent store updates skip the comparison
  const check = useRef<ModifiedCheck | null>(null)
  const modified = useIntroDebugStore(state => {
    const last = check.current
    if (last && last.params === state.params && last.title === state.title && last.hidden === state.hidden && last.preset === active) {
      return last.modified
    }
    const next = { params: state.params, title: state.title, hidden: state.hidden, preset: active, modified: !sameIntroSetup(state.params, state.title, state.hidden, active) }
    check.current = next
    return next.modified
  })

  // A preset added, removed or marked as changed alters the row's content but not its box, which the observer
  // watches, so the overflow is checked again here
  useEffect(() => {
    wheel.current?.check()
  }, [list.length, activeId, modified])

  return (
    <div role="group" aria-label="Intro presets" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neon-cyan/20 px-3 py-1.5 max-sm:gap-x-1">
      {/* The presets keep to one row that scrolls sideways and fades at its end, so the timeline keeps its
          room at any width; a phone puts SETTINGS and SAVE AS, as icons, at the end of that row */}
      <ul ref={listRef} className="preset-scroller flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        {list.map(preset => (
          <PresetItem
            key={preset.id}
            name={preset.name}
            description={preset.description}
            active={preset.id === active.id}
            modified={modified}
            builtIn={preset.builtIn === true}
            subject="the current intro"
            badge={preset.scene && <Layers aria-label="Saved with Settings" className="h-3 w-3 shrink-0 text-text-light/60" />}
            onApply={() => applyPreset(preset.id)}
            onUpdate={() => updatePreset(preset.id)}
            onDelete={() => deletePreset(preset.id)}
            className="shrink-0"
            nameClassName="max-w-[14rem]"
          />
        ))}
      </ul>

      <ToggleButton
        active={withScene}
        aria-pressed={withScene}
        onClick={() => setWithScene(!withScene)}
        aria-label="Settings: presets also save and load the Settings panel"
        title="Presets also save and load Settings"
        className="h-7 gap-1 px-2 text-xs max-sm:w-7 max-sm:px-0"
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="max-sm:hidden">SETTINGS</span>
      </ToggleButton>

      <PresetSaveForm
        subject="the current intro"
        isReserved={isReservedIntroPresetName}
        isTaken={(name) => findIntroPresetByName(presets, name) !== undefined}
        onSave={savePreset}
        compact
        formClassName="max-sm:basis-full"
      />

      {storageFailed && <PresetStorageAlert className="w-full" />}
    </div>
  )
}

export default memo(IntroPresetBar)
