import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, hexToRgb, rgbToHex } from '../../lib/utils'
import { useColorPaletteStore } from '../../hooks/use_color_palette_store'
import SliderControl from './slider_control'

// A new color starts white with this weight and opens the picker at once
const NEW_COLOR = { r: 255, g: 255, b: 255, enabled: true, percent: 10 }

const ICON_BUTTON = 'h-7 w-7 shrink-0 border-text-light/30 text-text-light/70 hover:border-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'

// The particle colors: each one's swatch opens the picker, its slider sets how common it is, and the
// bar on top shows the mix the particles are drawn from
function ColorPalette () {
  const { colorPalette, addColor, removeColor, updateColor } = useColorPaletteStore()
  const pickers = useRef<(HTMLInputElement | null)[]>([])
  const [openPicker, setOpenPicker] = useState(-1)

  // Opens the picker of a color that was just added, once its row exists
  useEffect(() => {
    if (openPicker < 0) return
    pickers.current[openPicker]?.click()
    setOpenPicker(-1)
  }, [openPicker])

  const totalWeight = colorPalette.reduce((total, color) => total + (color.enabled ? color.percent : 0), 0)
  const share = (percent: number) => totalWeight > 0 ? Math.round(percent / totalWeight * 100) : 0
  const onlyColor = colorPalette.length <= 1

  return (
    <div className="space-y-1">
      <div
        className="flex h-1.5 overflow-hidden bg-text-light/10"
        role="img"
        aria-label="Mix of the particle colors"
      >
        {colorPalette.map((color, index) => color.enabled && (
          <div
            key={index}
            className="h-full transition-[flex-grow] duration-150"
            style={{ flexGrow: color.percent, backgroundColor: rgbToHex(color.r, color.g, color.b) }}
          />
        ))}
      </div>

      {colorPalette.map((color, index) => {
        const hex = rgbToHex(color.r, color.g, color.b)
        return (
          <div key={index} className="flex items-center gap-1">
            <label
              className="relative h-7 w-7 shrink-0 cursor-pointer border border-text-light/30 transition-colors duration-150
                hover:border-neon-cyan focus-within:border-neon-cyan focus-within:outline focus-within:outline-1 focus-within:outline-neon-cyan"
              style={{ backgroundColor: hex }}
              title="Change color"
            >
              <input
                ref={(element) => { pickers.current[index] = element }}
                type="color"
                value={hex}
                aria-label={`Color ${index + 1}, ${hex}`}
                onChange={(event) => {
                  const rgb = hexToRgb(event.target.value)
                  if (rgb) updateColor(index, rgb)
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <div className={cn('flex min-w-0 flex-1 transition-opacity duration-150', !color.enabled && 'opacity-40')}>
              <SliderControl
                id={`color-weight-${index}`}
                label={hex.toUpperCase()}
                value={color.percent}
                min={1}
                max={100}
                step={1}
                formatValue={() => color.enabled ? `${share(color.percent)}%` : 'OFF'}
                onChange={(percent) => updateColor(index, { percent })}
                variant="inline"
                fillColor={hex}
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              aria-pressed={color.enabled}
              aria-label={color.enabled ? `Hide color ${index + 1}` : `Show color ${index + 1}`}
              title={color.enabled ? 'Leave this color out' : 'Use this color'}
              onClick={() => updateColor(index, { enabled: !color.enabled })}
              className={cn(ICON_BUTTON, color.enabled && 'text-neon-cyan')}
            >
              {color.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Remove color ${index + 1}`}
              title={onlyColor ? 'The last color cannot be removed' : 'Remove color'}
              disabled={onlyColor}
              onClick={() => removeColor(index)}
              className={ICON_BUTTON}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}

      <Button
        variant="outline"
        onClick={() => {
          addColor({ ...NEW_COLOR })
          setOpenPicker(colorPalette.length)
        }}
        className="h-7 w-full gap-1.5 border-neon-cyan/50 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan"
      >
        <Plus className="h-3.5 w-3.5" />
        Add color
      </Button>
    </div>
  )
}

export default ColorPalette
