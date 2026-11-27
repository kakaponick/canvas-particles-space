import { useRef, useState, type ReactNode } from 'react'
import { Check, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const itemAction = cn(
  'flex h-full w-7 shrink-0 items-center justify-center text-text-light/70 transition-colors duration-150 hover:text-neon-cyan',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan'
)

interface PresetItemProps {
  name: string
  // Shown on the pointer over the name while the preset is not the modified active one
  description?: string
  active: boolean
  // The current setup differs from the active preset
  modified: boolean
  // A built-in preset can be applied, never updated or deleted
  builtIn: boolean
  // What the update saves into the preset: "the current settings", "the current intro"
  subject: string
  // Drawn after the name, such as a mark for a preset saved with the scene
  badge?: ReactNode
  onApply: () => void
  onUpdate: () => void
  onDelete: () => void
  className?: string
  nameClassName?: string
}

// One saved preset: a click applies it; the active one says when the setup has moved away from it and
// offers to save the change into it; deleting takes a second press, and the focus then moves to the
// neighbouring preset instead of falling back to the page
function PresetItem ({
  name,
  description,
  active,
  modified,
  builtIn,
  subject,
  badge,
  onApply,
  onUpdate,
  onDelete,
  className,
  nameClassName
}: PresetItemProps) {
  const [confirming, setConfirming] = useState(false)
  const changed = active && modified
  const applyButton = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const cancelConfirm = () => {
    setConfirming(false)
    // The trash button comes back in place of DELETE; the focus returns to it
    requestAnimationFrame(() => deleteButton.current?.focus())
  }

  return (
    <li
      // 28px with its border, the height of every row and button beside it
      className={cn('flex h-7 items-center border font-mono text-xs', active ? 'border-neon-cyan/60 bg-neon-cyan/10 forced-colors:border-[Highlight]' : 'border-text-light/15', className)}
      // Leaving with the pointer cancels a pending DELETE, unless the keyboard is on it; the focus goes back to
      // the trash button instead of falling to the page
      onMouseLeave={(event) => {
        if (confirming && !event.currentTarget.querySelector(':focus-visible')) cancelConfirm()
      }}
    >
      <button
        ref={applyButton}
        type="button"
        aria-pressed={active}
        title={changed ? 'Click to drop the changes and return to this preset' : description}
        onClick={onApply}
        className={cn(
          // 11px plus the item's 1px border puts the name on the rows' 12px label edge
          'flex h-full min-w-0 items-center gap-2 pl-[11px] pr-3 text-left transition-colors duration-150 hover:text-neon-cyan',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
          active ? 'text-neon-cyan forced-colors:text-[Highlight]' : 'text-text-light/85',
          nameClassName
        )}
      >
        <span className="truncate">{name}</span>
        {badge}
        {changed && <span className="shrink-0 text-text-light/70">modified</span>}
      </button>

      {changed && !builtIn && (
        <button
          type="button"
          aria-label={`Update ${name} with ${subject}`}
          title={`Update with ${subject}`}
          onClick={() => {
            // The button goes away once the preset matches; the focus stays on the preset
            applyButton.current?.focus()
            onUpdate()
          }}
          className={itemAction}
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      )}

      {!builtIn && (confirming
        ? (
          <button
            type="button"
            autoFocus
            aria-label={`Delete ${name} now`}
            onClick={(event) => {
              const item = event.currentTarget.closest('li')
              const neighbour = (item?.nextElementSibling ?? item?.previousElementSibling)?.querySelector('button')
              neighbour?.focus()
              onDelete()
            }}
            onBlur={() => setConfirming(false)}
            data-escape-cancels=""
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              // Escape cancels the delete, not the panel around it
              event.preventDefault()
              event.stopPropagation()
              cancelConfirm()
            }}
            className="flex h-full shrink-0 items-center gap-1 px-2 text-neon-magenta transition-colors duration-150
              hover:text-text-light focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-magenta"
          >
            <Check className="h-3.5 w-3.5" />
            DELETE
          </button>
        )
        : (
          <button
            ref={deleteButton}
            type="button"
            aria-label={`Delete ${name}`}
            title="Delete"
            onClick={() => setConfirming(true)}
            className={itemAction}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ))}
    </li>
  )
}

// The last change to the presets could not be written to the browser's storage
export function PresetStorageAlert ({ className }: { className?: string }) {
  return (
    <p role="alert" className={cn('font-mono text-xs text-neon-yellow/90', className)}>
      Not saved in this browser: lost on reload
    </p>
  )
}

export default PresetItem
