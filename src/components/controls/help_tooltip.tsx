import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  iconClassName?: string
  buttonClassName?: string
}

function HelpTooltip({ 
  content, 
  side = 'right', 
  className,
  iconClassName,
  buttonClassName
}: HelpTooltipProps) {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} className={cn('pointer-events-auto', buttonClassName)}>
          <HelpCircle className={cn('h-4 w-4 text-neon-cyan/50 hover:text-neon-cyan cursor-help', iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        className={cn("max-w-xs bg-[rgba(10,10,15,0.98)] border-neon-cyan/30 text-text-light text-xs z-[60]", className)}
      >
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default HelpTooltip

