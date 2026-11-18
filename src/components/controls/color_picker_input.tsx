import { useState, useRef } from 'react'

interface ColorPickerInputProps {
  value: string
  onChange: (color: string) => void
  label?: string
  showLabel?: boolean
}

function ColorPickerInput ({ value, onChange, label, showLabel = true }: ColorPickerInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`
        flex h-7 min-w-0 flex-1 items-center gap-2 px-1
        bg-[rgba(0,0,0,0.3)]
        border transition-all duration-200
        ${isFocused ? 'border-neon-cyan shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'border-neon-cyan/30'}
        cursor-pointer hover:border-neon-cyan/60
      `}
      onClick={() => inputRef.current?.click()}
    >
      {/* Color Preview */}
      <div
        className="h-5 w-5 flex-shrink-0"
        style={{
          backgroundColor: value,
          boxShadow: `0 0 8px ${value}40`
        }}
      />

      {/* Color Value */}
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-light/85">
        {label && showLabel ? label : 'Selected Color'}
      </span>
      <span className="font-mono text-xs tracking-wider text-neon-cyan">
        {value.toUpperCase()}
      </span>

      {/* Hidden Native Color Input */}
      <input
        ref={inputRef}
        type="color"
        value={value}
        aria-label={label ?? 'Selected color'}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-0 h-0 opacity-0 absolute pointer-events-none"
      />

      {/* Edit Icon */}
      <div className="font-mono text-[0.65rem] text-neon-cyan/70">
        EDIT
      </div>
    </div>
  )
}

export default ColorPickerInput
