import { useRef, useState, type ReactNode } from 'react'
import { Portal } from '@radix-ui/react-tooltip'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  // The name the button is announced by; it contains the button's visible text
  label: string
  // What the button shows
  children: ReactNode
  content: ReactNode
  buttonClassName?: string
}

// Help that is a control of its own: it takes the focus, is announced by its name, and a click or a tap
// opens or closes it, so the keyboard and touch reach it as well as a pointer resting on it
function HelpTooltip ({ label, children, content, buttonClassName }: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  // Whether the tooltip was open when the current press began; null while no press is in progress
  const openAtPress = useRef<boolean | null>(null)

  return (
    <Tooltip delayDuration={500} open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // Radix closes a tooltip on pointer down and on click unless told otherwise; here a click opens
          // or closes it on purpose
          onPointerDown={(event) => {
            openAtPress.current = open
            event.preventDefault()
          }}
          onClick={(event) => {
            event.preventDefault()
            const wasOpen = openAtPress.current ?? open
            openAtPress.current = null
            setOpen(!wasOpen)
          }}
          className={cn(
            'pointer-events-auto cursor-help focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
            buttonClassName
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      {/* Out of the page's flow: a header with container queries is a containing block for fixed elements,
          which would throw the tooltip's position off */}
      <Portal>
        <TooltipContent side="top" className="z-[60] max-w-xs border-neon-cyan/30 bg-bg-dark/[0.98] font-mono text-xs text-text-light">
          {content}
        </TooltipContent>
      </Portal>
    </Tooltip>
  )
}

export default HelpTooltip
