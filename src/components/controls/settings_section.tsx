import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import HelpTooltip from './help_tooltip'
import ToggleButton from './toggle_button'

const STORAGE_KEY = 'settings-open-sections-v1'

function readOpenSections (): Record<string, boolean> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown
    return stored && typeof stored === 'object' ? stored as Record<string, boolean> : {}
  } catch {
    return {}
  }
}

// The panel unmounts when it closes, so which sections are open lives outside it
const openSections = typeof window === 'undefined' ? {} : readOpenSections()

function rememberSection (id: string, open: boolean) {
  openSections[id] = open
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openSections))
  } catch {
    // Storage blocked: the sections stay as they are until the page reloads
  }
}

interface SettingsSwitchProps {
  on: boolean
  onToggle: () => void
  // What the switch controls, for screen readers
  label: string
  onText?: string
}

// Small ON/OFF button sized for a settings row or a section header
export function SettingsSwitch ({ on, onToggle, label, onText = 'ON' }: SettingsSwitchProps) {
  return (
    <ToggleButton active={on} onClick={onToggle} aria-label={label} className="h-6 w-12 px-0 font-mono text-xs">
      {on ? onText : 'OFF'}
    </ToggleButton>
  )
}

interface SettingsRowProps {
  label: string
  help?: string
  children: ReactNode
}

// One line: a label on the left, its control or value on the right
export function SettingsRow ({ label, help, children }: SettingsRowProps) {
  return (
    <div className="flex h-7 items-center justify-between gap-2 px-1">
      <div className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-text-light/85">
        <span className="truncate">{label}</span>
        {help && <HelpTooltip content={help} iconClassName="h-3.5 w-3.5" />}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

interface SettingsSectionProps {
  id: string
  title: string
  help?: string
  // A control kept in the header, reachable while the section is closed
  action?: ReactNode
  defaultOpen?: boolean
  // The section's feature is switched off; its settings stay editable
  dimmed?: boolean
  children: ReactNode
}

// A collapsible group of settings; the panel stays short and every group is one click away
function SettingsSection ({ id, title, help, action, defaultOpen = false, dimmed = false, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(openSections[id] ?? defaultOpen)
  const panelId = useId()

  const toggle = () => {
    rememberSection(id, !open)
    setOpen(!open)
  }

  return (
    <section className="border-b border-neon-cyan/15">
      <div className="flex h-8 items-center gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={toggle}
            className="flex h-8 w-full items-center gap-1.5 text-left font-orbitron text-xs text-neon-cyan transition-colors duration-150
              hover:text-text-light focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-150', open && 'rotate-90')} />
            <span className="truncate">{title}</span>
          </button>
        </h3>
        {help && <HelpTooltip content={help} iconClassName="h-3.5 w-3.5" />}
        {action}
      </div>
      {open && (
        <div id={panelId} className={cn('space-y-1 pb-2 transition-opacity duration-150', dimmed && 'opacity-50')}>
          {children}
        </div>
      )}
    </section>
  )
}

export default SettingsSection
