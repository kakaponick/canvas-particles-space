import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ToggleButtonProps extends ButtonProps {
  active: boolean
}

// Outline button that glows cyan while its option is on
function ToggleButton ({ active, className, ...props }: ToggleButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={active}
      className={cn(
        active
          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
          : 'bg-transparent border-text-light/30 text-text-light/60',
        'hover:bg-neon-cyan/30',
        className
      )}
      {...props}
    />
  )
}

export default ToggleButton
