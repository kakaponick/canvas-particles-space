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
}

function SliderControl ({
  id,
  label,
  value,
  min,
  max,
  step,
  formatValue = (val) => String(val),
  onChange
}: SliderControlProps) {
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

