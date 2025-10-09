import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface SliderControlProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
  variant?: 'default' | 'inline'
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
  variant = 'default'
}: SliderControlProps) {
  if (variant === 'inline') {
    return (
      <div className="relative">
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onChange(values[0])}
          className="w-full [&>span:first-child]:h-8 [&>span:last-child]:hidden"
        />
        <div className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none">
          <span className="text-neon-cyan mix-blend-difference font-mono text-xs">
            {label}
          </span>
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
        <Label htmlFor={id} className="text-text-light font-mono text-sm">
          {label}
        </Label>
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
        className="w-full"
      />
    </div>
  )
}

export default SliderControl

