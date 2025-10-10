import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

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
  iconClassName = 'h-4 w-4 text-neon-cyan/50 hover:text-neon-cyan cursor-help',
  buttonClassName
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={buttonClassName}>
            <HelpCircle className={iconClassName} />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          className={`max-w-xs bg-[rgba(10,10,15,0.98)] border-neon-cyan/30 text-text-light text-xs ${className || ''}`}
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default HelpTooltip

