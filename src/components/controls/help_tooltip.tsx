import { useRef, useState } from 'react'
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
  // With a label the help is a control of its own: it takes the focus, is announced by that name, and a
  // click or a tap opens it, so the keyboard and touch reach it too. Without one it is a hover hint for
  // text the control it sits on already exposes, and stays out of the tab order and the accessibility tree
  label?: string
}

function HelpTooltip ({
  content,
  side = 'right',
  className,
  iconClassName,
  buttonClassName,
  label
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  // Whether the tooltip was open when the current press began; null while no press is in progress
  const openAtPress = useRef<boolean | null>(null)
  const reachable = label !== undefined

  return (
    <Tooltip delayDuration={500} open={reachable ? open : undefined} onOpenChange={reachable ? setOpen : undefined}>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={reachable ? 0 : -1}
          aria-label={label}
          aria-hidden={reachable ? undefined : true}
          // Radix closes a tooltip on pointer down and on click unless told otherwise; here a click opens
          // or closes it on purpose
          onPointerDown={reachable
            ? (event) => {
              openAtPress.current = open
              event.preventDefault()
            }
            : undefined}
          onClick={reachable
            ? (event) => {
              event.preventDefault()
              const wasOpen = openAtPress.current ?? open
              openAtPress.current = null
              setOpen(!wasOpen)
            }
            : undefined}
          className={cn(
            'pointer-events-auto',
            reachable && 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
            buttonClassName
          )}
        >
          <HelpCircle className={cn('h-4 w-4 text-neon-cyan/50 hover:text-neon-cyan cursor-help', iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn('max-w-xs bg-bg-dark/[0.98] border-neon-cyan/30 text-text-light text-xs z-[60]', className)}
      >
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default HelpTooltip
