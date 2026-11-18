import { useState } from 'react'
import { useIntroDebugStore } from '../../store/intro_debug_store'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_GROUPS, formatParam, type IntroParamKey } from '../../lib/intro_params'
import SliderControl from './slider_control'
import ToggleButton from './toggle_button'

// Every tunable number of the opening, grouped by what it shapes; changes apply live and persist
function IntroParamGroups () {
  const params = useIntroDebugStore(state => state.params)
  const setParam = useIntroDebugStore(state => state.setParam)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const [copied, setCopied] = useState(false)

  const changedKeys = (Object.keys(params) as IntroParamKey[]).filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key])

  const copyChanged = async () => {
    const changed = Object.fromEntries(changedKeys.map(key => [key, params[key]]))
    try {
      await navigator.clipboard.writeText(JSON.stringify(changed, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; the values stay visible in the panel
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-text-light/60">
          Parameters{changedKeys.length > 0 && <span className="text-neon-cyan"> · {changedKeys.length} changed</span>}
        </h3>
        <div className="flex gap-1">
          <ToggleButton active={false} disabled={changedKeys.length === 0} onClick={copyChanged} className="h-7 px-2 text-xs">
            {copied ? 'COPIED' : 'COPY CHANGED'}
          </ToggleButton>
          <ToggleButton active={false} disabled={changedKeys.length === 0} onClick={() => resetParams()} className="h-7 px-2 text-xs">
            RESET ALL
          </ToggleButton>
        </div>
      </div>

      {INTRO_PARAM_GROUPS.map(group => {
        const groupKeys = group.params.map(spec => spec.key)
        const groupChanged = groupKeys.filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key]).length
        return (
          <details key={group.title} className="group border border-text-light/15 open:border-neon-cyan/40">
            <summary className="flex cursor-pointer select-none items-center justify-between px-2 py-1.5 text-text-light/80 hover:text-neon-cyan">
              <span>
                <span className="inline-block w-3 transition-transform group-open:rotate-90">›</span>
                {group.title}
                {groupChanged > 0 && <span className="text-neon-cyan"> · {groupChanged}</span>}
              </span>
              {groupChanged > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    resetParams(groupKeys)
                  }}
                  className="text-text-light/50 hover:text-neon-cyan"
                >
                  reset
                </button>
              )}
            </summary>
            <div className="space-y-1 px-1 pb-1">
              {group.params.map(spec => (
                <SliderControl
                  key={spec.key}
                  id={`intro-param-${spec.key}`}
                  label={spec.label}
                  value={params[spec.key]}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  formatValue={(value) => formatParam(value, spec)}
                  onChange={(value) => setParam(spec.key, value)}
                  variant="inline"
                  description={`${spec.description} Default: ${formatParam(DEFAULT_INTRO_PARAMS[spec.key], spec)}.`}
                />
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export default IntroParamGroups
