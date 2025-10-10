import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import HelpTooltip from './help_tooltip'

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
}

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
  description
}: SliderControlProps) {

  if (variant === 'inline') {

    return (
      <div 
        className="relative group flex-1 min-w-0 transition-all hover:bg-neon-cyan/5 rounded"
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
          onValueChange={(values) => onChange(values[0])}
          trackHeight="h-8"
          thumbSize="hidden"
          className="w-full"
        />
        <div className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="text-neon-cyan mix-blend-difference font-mono text-xs">
              {label}
            </span>
            {description && (
              <HelpTooltip 
                content={description}
                iconClassName="h-4 w-4 text-neon-cyan mix-blend-difference"
              />
            )}
          </div>
          <span className="text-neon-cyan mix-blend-difference font-bold font-mono text-xs tabular-nums">
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
          {description && (
            <HelpTooltip 
              content={description}
              iconClassName="h-3.5 w-3.5 text-neon-cyan/70"
            />
          )}
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

