import { useEffect, useId, useRef } from 'react'

interface ColorPickerInputProps {
  value: string
  onChange: (color: string) => void
  label: string
  // Name for screen readers when the visible label alone does not say what the color is for
  ariaLabel?: string
  // In the row's context menu (hint_menu.tsx), and always read by screen readers
  description?: string
  // The color the context menu's Reset returns to; a row without one offers no reset
  resetValue?: string
}

// One row: name, swatch and hex; the whole row opens the browser's color picker
function ColorPickerInput ({ value, onChange, label, ariaLabel, description, resetValue }: ColorPickerInputProps) {
  const descriptionId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  // The listener is attached once and reads the current props from here
  const live = useRef({ value, onChange, resetValue })
  live.current = { value, onChange, resetValue }

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    // Reset from the context menu
    const handleReset = () => {
      const { value: current, onChange: change, resetValue: reset } = live.current
      if (reset !== undefined && reset !== current) change(reset)
    }
    row.addEventListener('hint-reset', handleReset)
    return () => row.removeEventListener('hint-reset', handleReset)
  }, [])

  return (
    <div
      ref={rowRef}
      className="min-w-0 flex-1"
      data-hint={description}
      data-hint-label={description ? (ariaLabel ?? label) : undefined}
      data-hint-reset={description && resetValue !== undefined ? resetValue.toUpperCase() : undefined}
    >
      <label
        className="relative flex h-7 min-w-0 cursor-pointer items-center gap-2 bg-text-light/[0.06] px-3 font-mono text-xs
          transition-colors duration-150 hover:bg-neon-cyan/[0.08]
          focus-within:outline focus-within:outline-1 focus-within:outline-neon-cyan"
      >
        {/* The label starts on the rows' 12px edge; the swatch goes with the value it shows */}
        <span className="min-w-0 flex-1 truncate text-text-light/90">{label}</span>
        <span aria-hidden="true" className="h-4 w-4 shrink-0 border border-text-light/30" style={{ backgroundColor: value }} />
        <span aria-hidden="true" className="shrink-0 font-semibold tabular-nums text-neon-cyan">{value.toUpperCase()}</span>
        <input
          type="color"
          value={value}
          aria-label={ariaLabel}
          aria-describedby={description ? descriptionId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </label>
      {description && <p id={descriptionId} className="sr-only">{description}</p>}
    </div>
  )
}

export default ColorPickerInput
