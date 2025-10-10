import { useState, useRef } from 'react'

interface ColorPickerInputProps {
  value: string
  onChange: (color: string) => void
  label?: string
  showLabel?: boolean
}

function ColorPickerInput({ value, onChange, label, showLabel = true }: ColorPickerInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1.5">
      {label && showLabel && (
        <h3 className="text-neon-cyan font-orbitron text-sm">{label}</h3>
      )}
      
      <div 
        className={`
          flex items-center gap-2.5 p-2
          bg-[rgba(0,0,0,0.3)] 
          border transition-all duration-200
          ${isFocused ? 'border-neon-cyan shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'border-neon-cyan/30'}
          cursor-pointer hover:border-neon-cyan/60
        `}
        onClick={() => inputRef.current?.click()}
      >
        {/* Color Preview */}
        <div 
          className="w-9 h-9 flex-shrink-0 transition-transform duration-200 hover:scale-110"
          style={{ 
            backgroundColor: value,
            boxShadow: `0 0 8px ${value}40`
          }}
        />
        
        {/* Color Value */}
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[0.65rem] text-text-light/50 font-mono uppercase">
            Selected Color
          </span>
          <span className="text-xs font-mono text-neon-cyan tracking-wider">
            {value.toUpperCase()}
          </span>
        </div>

        {/* Hidden Native Color Input */}
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        
        {/* Edit Icon */}
        <div className="text-neon-cyan/70 text-[0.65rem] font-mono">
          EDIT
        </div>
      </div>
    </div>
  )
}

export default ColorPickerInput

