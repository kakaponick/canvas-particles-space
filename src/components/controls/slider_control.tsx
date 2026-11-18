import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import HelpTooltip from './help_tooltip'
import { useRef, useEffect } from 'react'

interface SliderControlProps {
  id: string
  label?: string
  value: number
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
  variant?: 'default' | 'inline' | 'progress'
  trackHeight?: string
  thumbSize?: string
  description?: string
  // Inline variant: fills the track with this color instead of the accent
  fillColor?: string
  // Inline variant: the value a double-click returns to, marked on the track. A slider whose range
  // crosses zero returns to zero without it
  resetValue?: number
}

// A slider whose range crosses zero holds on to zero: a drag this close to it, as a share of the
// range, lands on it. The mouse wheel still reaches the values in between
const ZERO_SNAP_SHARE = 0.02

function SliderControl ({
  id,
  label,
  value,
  min,
  max,
  step,
  formatValue = (val) => String(val),
  onChange,
  variant = 'default',
  trackHeight = 'h-1',
  thumbSize = 'h-4 w-4',
  description,
  fillColor,
  resetValue
}: SliderControlProps) {
  // Text over the track is blended by difference, so white stays readable on any fill
  const textColor = fillColor ? 'text-white' : 'text-neon-cyan'
  const containerRef = useRef<HTMLDivElement>(null)
  const crossesZero = min < 0 && max > 0
  const markValue = resetValue ?? (crossesZero ? 0 : undefined)
  const markPosition = markValue === undefined ? 0 : Math.min(Math.max((markValue - min) / (max - min), 0), 1) * 100
  const snapToZero = (next: number) =>
    crossesZero && Math.abs(next) <= (max - min) * ZERO_SNAP_SHARE ? 0 : next

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation() // Prevent scroll from bubbling to parent containers
      
      const delta = event.deltaY < 0 ? step : -step // Scroll up = positive, scroll down = negative
      const stepped = Math.min(max, Math.max(min, value + delta))
      // Steps added one by one drift off the grid; the step that should land on zero does land on it
      const newValue = crossesZero && Math.abs(stepped) < step / 2 ? 0 : stepped
      
      if (newValue !== value) {
        onChange(newValue)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [value, min, max, step, onChange, crossesZero])

  if (variant === 'inline') {

    return (
      <div 
        ref={containerRef}
        className="relative group flex-1 min-w-0 transition-all hover:bg-neon-cyan/5 rounded"
        onDoubleClick={markValue === undefined ? undefined : () => onChange(markValue)}
        title={markValue === undefined ? undefined : resetValue === undefined ? 'Double-click to reset to 0' : 'Double-click to reset to the default'}
        style={{
          cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" style="mix-blend-mode:difference" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2300ffff" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="2"/><path d="M12 8v8"/><path d="m10 10 2-2 2 2"/><path d="m10 14 2 2 2-2"/></svg>') 12 12, auto`
        }}
      >
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onChange(snapToZero(values[0]))}
          trackHeight="h-7"
          thumbSize="hidden"
          className={fillColor ? 'w-full [&>span:first-child>span]:!bg-current' : 'w-full'}
          style={fillColor ? { color: fillColor } : undefined}
        />
        {markValue !== undefined && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-neon-cyan/60 mix-blend-difference"
            style={{ left: `${markPosition}%` }}
          />
        )}
        <div className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className={`${textColor} mix-blend-difference font-mono text-xs`}>
              {label}
            </span>
            {description && (<HelpTooltip 
                  content={description}
                  iconClassName="mix-blend-difference"
                />
            )}
          </div>
          <span className={`${textColor} mix-blend-difference font-bold font-mono text-xs tabular-nums`}>
            {formatValue(value)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-text-light font-mono text-sm">
            {label}
          </Label>
          {description && (<HelpTooltip content={description} iconClassName="h-3.5 w-3.5 text-neon-cyan/70" />)}
        </div>
        <span className="text-neon-magenta font-bold font-mono text-sm">
          {formatValue(value)}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        trackHeight={trackHeight}
        thumbSize={thumbSize}
        className="w-full"
      />
    </div>
  )
}

export default SliderControl

