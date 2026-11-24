import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRESET_NAME_MAX_LENGTH, normalizePresetName } from '../../lib/simulation_presets'
import ToggleButton from './toggle_button'

interface PresetSaveFormProps {
  // What is saved, for the field: "the current settings", "the current intro"
  subject: string
  isReserved: (name: string) => boolean
  // A saved preset already has this name, so saving replaces it
  isTaken: (name: string) => boolean
  onSave: (name: string) => void
  className?: string
  // Classes for the open name field only, such as taking a row of its own
  formClassName?: string
  // On a phone the closed button shows its icon alone
  compact?: boolean
}

// Saving is rare, so the panel shows one SAVE AS button; it opens the name field, and Escape or leaving
// the field empty closes it again
function PresetSaveForm ({ subject, isReserved, isTaken, onSave, className, formClassName, compact = false }: PresetSaveFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const cleanName = normalizePresetName(name)
  const reserved = isReserved(cleanName)
  const replaces = cleanName !== '' && isTaken(cleanName)
  const errorId = `preset-name-error-${subject.replace(/\W+/g, '-')}`
  // After SAVE, Cancel or Escape the focus goes back to SAVE AS instead of falling to the page
  const openButton = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)

  useEffect(() => {
    if (open || !refocus.current) return
    refocus.current = false
    openButton.current?.focus()
  }, [open])

  const close = (returnFocus = true) => {
    refocus.current = returnFocus
    setOpen(false)
    setName('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!cleanName || reserved) return
    onSave(cleanName)
    close()
  }

  const handleBlur = (event: FocusEvent<HTMLFormElement>) => {
    // Leaving an empty field for somewhere else closes it and keeps the focus where it went
    if (cleanName === '' && !event.currentTarget.contains(event.relatedTarget as Node | null)) close(false)
  }

  if (!open) {
    return (
      <ToggleButton
        ref={openButton}
        // Named by its visible words, so it is announced the same with the words hidden on a phone
        aria-label={compact ? 'Save as new preset' : undefined}
        onClick={() => setOpen(true)}
        className={cn('h-7 gap-1 px-2 font-mono text-xs', compact && 'max-sm:w-7 max-sm:px-0', className)}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className={cn(compact && 'max-sm:hidden')}>SAVE AS</span>
      </ToggleButton>
    )
  }

  return (
    <form onSubmit={handleSubmit} onBlur={handleBlur} className={cn('flex min-w-0 flex-wrap gap-1', className, formClassName)}>
      <input
        type="text"
        autoFocus
        value={name}
        maxLength={PRESET_NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
        placeholder={`Name for ${subject}`}
        aria-label={`Preset name for ${subject}`}
        aria-invalid={reserved}
        aria-describedby={reserved ? errorId : undefined}
        className="h-7 min-w-0 flex-1 basis-40 border border-neon-cyan/40 bg-black/40 px-2 font-mono text-xs text-text-light caret-neon-cyan
          outline-none transition-colors duration-150 placeholder:text-text-light/60 selection:bg-neon-cyan/30 focus:border-neon-cyan"
      />
      <ToggleButton type="submit" aria-pressed={undefined} active={cleanName !== '' && !reserved} disabled={!cleanName || reserved} className="h-7 w-[5.5rem] gap-1 px-0 font-mono text-xs">
        <Save className="h-3.5 w-3.5" />
        {replaces ? 'REPLACE' : 'SAVE'}
      </ToggleButton>
      <ToggleButton onClick={() => close()} aria-label="Cancel saving" title="Cancel (Esc)" className="h-7 w-7 px-0">
        <X className="h-3.5 w-3.5" />
      </ToggleButton>
      {reserved && (
        <p id={errorId} role="alert" className="w-full font-mono text-xs text-neon-yellow/90">
          {cleanName} is built in. Choose another name.
        </p>
      )}
    </form>
  )
}

export default PresetSaveForm
