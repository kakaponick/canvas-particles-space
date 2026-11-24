import { forwardRef } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ToggleButtonProps extends ButtonProps {
  // On or off for a toggle; left out for a plain action, which then announces no pressed state
  active?: boolean
}

// Outline button that glows cyan while its option is on, or a plain outline action without `active`
const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function ToggleButton ({ active, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      aria-pressed={active}
      className={cn(
        active
          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
          : 'bg-transparent border-text-light/40 text-text-light/70',
        'hover:bg-neon-cyan/30',
        className
      )}
      {...props}
    />
  )
})

export default ToggleButton
