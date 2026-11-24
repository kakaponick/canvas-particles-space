import { useId, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  // What the switch controls, for screen readers; the visible ON/OFF is its state
  label: string
  describedBy?: string
}

// Small ON/OFF switch sized for a settings row or a section header
export function SettingsSwitch ({ on, onToggle, label, describedBy }: SettingsSwitchProps) {
  return (
    <ToggleButton
      role="switch"
      aria-checked={on}
      aria-pressed={undefined}
      active={on}
      onClick={onToggle}
      aria-label={label}
      aria-describedby={describedBy}
      // As tall as the row it sits in, so it fills the row's end instead of floating against its edge
      className="h-7 w-12 px-0 font-mono text-xs"
    >
      {on ? 'ON' : 'OFF'}
    </ToggleButton>
  )
}

interface SettingsRowProps {
  label: string
  // What the row does: shown under it while HELP is on, and read with its control
  help?: string
  // Gets the id of the help text, for the control's aria-describedby
  children: (describedBy: string | undefined) => ReactNode
  // Extra room above a row that starts a sub-group, such as the black hole's placement
  className?: string
}

// One line: a label on the left, its control or value on the right, on the same quiet field as a slider,
// so a section reads as one even column of rows
export function SettingsRow ({ label, help, children, className }: SettingsRowProps) {
  const helpId = useId()
  return (
    <div className={className}>
      <div className="flex h-7 items-center justify-between gap-2 bg-text-light/[0.06] pl-3">
        <span className="min-w-0 truncate font-mono text-xs text-text-light/90">{label}</span>
        <div className="flex shrink-0 items-center gap-2">{children(help ? helpId : undefined)}</div>
      </div>
      {help && <p id={helpId} className="setting-description">{help}</p>}
    </div>
  )
}

interface SettingsSectionProps {
  id: string
  title: string
  // What the whole section is for: shown at its top while HELP is on
  help?: string
  // A control or readout kept in the header, reachable while the section is closed
  action?: ReactNode
  // A readout shown in the header only while the section is closed, such as the active preset's name
  collapsedAction?: ReactNode
  defaultOpen?: boolean
  // The section's feature is switched off; its settings stay editable
  dimmed?: boolean
  children: ReactNode
}

// A collapsible group of settings; the panel stays short and every group is one click away
function SettingsSection ({ id, title, help, action, collapsedAction, defaultOpen = false, dimmed = false, children }: SettingsSectionProps) {
  const [open, setOpen] = useState(openSections[id] ?? defaultOpen)
  const baseId = useId()
  const headerId = `${baseId}-header`
  const panelId = `${baseId}-panel`
  const helpId = `${baseId}-help`
  const offId = `${baseId}-off`

  const toggle = () => {
    rememberSection(id, !open)
    setOpen(!open)
  }

  return (
    <section className="border-b border-neon-cyan/20 pb-1 pt-1 first:pt-0">
      <div className="flex h-8 items-center gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            id={headerId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-describedby={help ? helpId : undefined}
            onClick={toggle}
            className="flex h-8 w-full items-center gap-1 text-left font-orbitron text-xs tracking-[0.5px] text-neon-cyan transition-colors duration-150
              hover:text-text-light focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-neon-cyan"
          >
            {/* The chevron sits in the 12px gutter, so the title starts on the same edge as its rows' labels */}
            <ChevronRight aria-hidden="true" className={cn('-ml-1 h-3 w-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')} />
            <span className="truncate">{title}</span>
          </button>
        </h3>
        {collapsedAction && !open && collapsedAction}
        {action}
      </div>
      {help && <p id={helpId} className={cn('setting-description', !open && '!hidden')}>{help}</p>}
      {/* Built with the page and only hidden while closed, so opening a section builds nothing while the scene runs */}
      <div
        id={panelId}
        role="group"
        hidden={!open}
        aria-labelledby={headerId}
        aria-describedby={dimmed ? offId : undefined}
        className="flex flex-col gap-1 pb-2"
      >
        {/* A switched-off feature says so in words; its settings stay editable for when it comes back */}
        {dimmed && <p id={offId} className="pl-3 font-mono text-[11px] leading-5 text-text-light/80">OFF · changes apply once it's back on</p>}
        {/* A flex gap, not space-y, so a row that starts a sub-group can add its own top margin */}
        {children}
      </div>
    </section>
  )
}

export default SettingsSection
