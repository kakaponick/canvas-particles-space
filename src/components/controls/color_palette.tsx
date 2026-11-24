import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, hexToRgb, rgbToHex } from '../../lib/utils'
import { useColorPaletteStore } from '../../hooks/use_color_palette_store'
import SliderControl from './slider_control'

// A new color starts white with this weight and opens the picker at once
const NEW_COLOR = { r: 255, g: 255, b: 255, enabled: true, percent: 10 }

const ICON_BUTTON = 'h-7 w-7 shrink-0 border-text-light/40 text-text-light/70 hover:border-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan'

// The particle colors: each one's swatch opens the picker, its slider sets how common it is, and its value
// is its share of the mix the particles are drawn from
function ColorPalette () {
  const { colorPalette, addColor, removeColor, updateColor } = useColorPaletteStore()
  const pickers = useRef<(HTMLInputElement | null)[]>([])
  const [openPicker, setOpenPicker] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

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
    // Each row shows its color's share of the mix, so the list itself is the mix
    <div ref={listRef} className="space-y-1">
      {colorPalette.map((color, index) => {
        const hex = rgbToHex(color.r, color.g, color.b)
        return (
          <div key={index} className="flex items-center gap-1">
            <label
              className="relative h-7 w-7 shrink-0 cursor-pointer border border-text-light/40 transition-colors duration-150
                hover:border-neon-cyan focus-within:border-neon-cyan focus-within:outline focus-within:outline-1 focus-within:outline-neon-cyan"
              style={{ backgroundColor: hex }}
              title="Change color"
            >
              <input
                ref={(element) => { pickers.current[index] = element }}
                type="color"
                value={hex}
                aria-label={`Color ${index + 1}`}
                onChange={(event) => {
                  const rgb = hexToRgb(event.target.value)
                  if (rgb) updateColor(index, rgb)
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <div className="flex min-w-0 flex-1">
              <SliderControl
                id={`color-weight-${index}`}
                label={hex.toUpperCase()}
                ariaLabel={`Color ${index + 1} ${hex.toUpperCase()} share`}
                value={color.percent}
                min={1}
                max={100}
                step={1}
                formatValue={() => color.enabled ? `${share(color.percent)}%` : 'OFF'}
                onChange={(percent) => updateColor(index, { percent })}
                fillColor={hex}
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              aria-pressed={color.enabled}
              aria-label={`Use color ${index + 1}`}
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
              onClick={() => {
                // The rows are keyed by position, so after the removal the Remove button at this index belongs
                // to the color that moved up and the focus stays on it, ready for the next removal; it goes to
                // ADD COLOR when the last row went or the one color left cannot be removed
                const toAdd = index >= colorPalette.length - 1 || colorPalette.length <= 2
                removeColor(index)
                requestAnimationFrame(() => {
                  const target = toAdd
                    ? listRef.current?.querySelector<HTMLElement>('[data-add-color]')
                    : listRef.current?.querySelector<HTMLElement>(`[aria-label="Remove color ${index + 1}"]`)
                  target?.focus()
                })
              }}
              className={ICON_BUTTON}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}

      <Button
        data-add-color=""
        variant="outline"
        onClick={() => {
          addColor({ ...NEW_COLOR })
          setOpenPicker(colorPalette.length)
        }}
        className="h-7 w-full gap-1.5 border-neon-cyan/50 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/20 hover:text-neon-cyan"
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        ADD COLOR
      </Button>
    </div>
  )
}

export default ColorPalette
