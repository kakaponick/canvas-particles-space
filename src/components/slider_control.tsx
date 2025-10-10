import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

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
      <div className="relative group flex-1 min-w-0">
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      type="button" 
                      className="pointer-events-auto"
                    >
                      <HelpCircle className="h-4 w-4 text-neon-cyan mix-blend-difference" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    className="max-w-xs bg-[rgba(10,10,15,0.98)] border-neon-cyan/30 text-text-light text-xs"
                  >
                    <p>{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    type="button" 
                    className="opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-neon-cyan/70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="max-w-xs bg-[rgba(10,10,15,0.98)] border-neon-cyan/30 text-text-light text-xs"
                >
                  <p>{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

