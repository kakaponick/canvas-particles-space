import { useState } from 'react'
import { useColorPaletteStore } from '../../hooks/use_color_palette_store'
import { hexToRgb, rgbToHex } from '../../lib/utils'
import ColorPickerInput from './color_picker_input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { X } from 'lucide-react'

function ColorPalette () {
  const [selectedColor, setSelectedColor] = useState('#00ffff')
  const { colorPalette, addColor, removeColor, updateColor } = useColorPaletteStore()

  const handleAddColor = () => {
    const rgb = hexToRgb(selectedColor)
    if (rgb) {
      addColor({
        ...rgb,
        enabled: true,
        percent: 10
      })
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-1">
        {colorPalette.map((color, index) => (
          <div
            key={index}
            className={`
              flex items-center gap-2 p-1 bg-[rgba(255,255,255,0.05)] 
              border border-[rgba(255,255,255,0.1)] transition-all duration-200
              ${!color.enabled ? 'opacity-40' : ''} 
              hover:bg-[rgba(255,255,255,0.1)] hover:border-neon-cyan/50
            `}
          >
            {/* Color preview - clickable to toggle */}
            <div
              onClick={() => updateColor(index, { enabled: !color.enabled })}
              className="w-6 h-6 flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-110 relative group"
              style={{ 
                backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
                opacity: color.enabled ? 1 : 0.5,
                boxShadow: color.enabled ? `0 0 8px rgba(${color.r}, ${color.g}, ${color.b}, 0.5)` : 'none'
              }}
              title={color.enabled ? 'Click to disable' : 'Click to enable'}
            >
              {!color.enabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="w-5 h-0.5 bg-white rotate-45 absolute"></div>
                  <div className="w-5 h-0.5 bg-white -rotate-45 absolute"></div>
                </div>
              )}
            </div>
            
            {/* Color info and slider */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.65rem] font-mono text-text-light/70 truncate uppercase">
                  {rgbToHex(color.r, color.g, color.b)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[0.6rem] text-text-light/50 font-mono">Amount:</span>
                  <span className="text-[0.65rem] font-mono text-neon-cyan tabular-nums">
                    {color.percent}%
                  </span>
                </div>
              </div>
              
              <Slider
                min={1}
                max={100}
                step={1}
                value={[color.percent]}
                onValueChange={(values) => updateColor(index, { percent: values[0] })}
                className="w-full [&_span[role=slider]]:!bg-current [&_span[role=slider]]:!shadow-[0_0_10px_currentColor] [&>span:first-child>span]:!bg-current"
                style={{ color: `rgb(${color.r}, ${color.g}, ${color.b})` }}
              />
            </div>
            
            {/* Delete button */}
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                if (colorPalette.length > 1) {
                  removeColor(index)
                } else {
                  alert('You must have at least one color!')
                }
              }}
              className="flex-shrink-0 w-6 h-6 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan hover:text-bg-dark hover:border-neon-cyan hover:shadow-[0_0_8px_#00ffff]"
              title="Remove color"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        <ColorPickerInput
          value={selectedColor}
          onChange={setSelectedColor}
          showLabel={false}
        />
        <Button
          variant="outline"
          onClick={handleAddColor}
          className="h-8 w-16 shrink-0 border-neon-cyan text-neon-cyan font-orbitron text-xs px-0 hover:bg-neon-cyan hover:text-bg-dark hover:shadow-[0_0_12px_#00ffff]"
        >
          + ADD
        </Button>
      </div>

    </div>
  )
}

export default ColorPalette

