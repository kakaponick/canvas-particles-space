import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDescriptionsStore } from '../../store/descriptions_store'
import ToggleButton from './toggle_button'

// Shows or hides the description under every setting, in Settings and in the intro debugger at once
function DescriptionsToggle ({ className }: { className?: string }) {
  const shown = useDescriptionsStore(state => state.shown)
  const toggle = useDescriptionsStore(state => state.toggle)

  return (
    <ToggleButton
      active={shown}
      onClick={toggle}
      aria-label="Help hints"
      title={shown ? 'Hide the hints' : 'Show a one-line hint under every setting'}
      className={cn('descriptions-toggle h-7 gap-1 px-2 font-mono text-xs', className)}
    >
      <HelpCircle className="h-3.5 w-3.5" />
      HELP
    </ToggleButton>
  )
}

export default DescriptionsToggle
