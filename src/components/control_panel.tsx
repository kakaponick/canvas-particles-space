import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Settings, Maximize, Minimize, X } from 'lucide-react'
import SettingsBody from './settings_body'
import { isTextEntry } from '@/lib/utils'
import DescriptionsToggle from './controls/descriptions_toggle'

// The panel closes only on request, so the scene can be used while settings are being tuned
function keepOpen (event: Event) {
  event.preventDefault()
}

// The two round buttons over the scene
const SCENE_BUTTON = 'bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan'

// Escape that belongs to something smaller than the panel: a text field or a pending confirmation
function keepsEscape (target: EventTarget | null) {
  return isTextEntry(target) ||
    (target instanceof HTMLElement && target.closest('[data-escape-cancels]') !== null)
}

// Puts the settings, already built off-screen, into the open panel
function PreparedSettings ({ host }: { host: HTMLElement }) {
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (node) node.appendChild(host)
  }, [host])

  return <div ref={attach} />
}

function ControlPanel () {
  const [isOpen, setIsOpen] = useState(false)
  const [settingsHost] = useState(() => document.createElement('div'))
  const [isFullscreen, setIsFullscreen] = useState(false)

  // The fullscreenchange listener below follows the result, Esc and the browser's own exit included
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Tells the page Settings is open, so the intro debugger can move over on a wide screen (index.css)
  useEffect(() => {
    const root = document.documentElement
    if (isOpen) root.dataset.settingsOpen = ''
    else delete root.dataset.settingsOpen
    return () => { delete root.dataset.settingsOpen }
  }, [isOpen])

  // The open panel closes on Escape by itself and marks the key as handled; this opens it again. Escape in
  // the intro debugger never opens it: there the key only ever dismisses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || isTextEntry(event.target)) return
      if (event.target instanceof Element && event.target.closest('[data-intro-dock]')) return
      setIsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
      {/* scene-buttons: on a phone with the intro debugger open they move to the top, off the title (index.css) */}
      <div className="scene-buttons fixed bottom-5 left-5 z-40 flex gap-2" style={{
        marginBottom: 'var(--intro-dock-height, 0px)',
        opacity: isOpen ? 0 : 1,
        pointerEvents: isOpen ? 'none' : 'auto',
        visibility: isOpen ? 'hidden' : 'visible',
        transition: 'opacity 300ms, visibility 300ms'
      }}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Settings"
            aria-keyshortcuts="Escape"
            title="Settings (Esc)"
            className={SCENE_BUTTON}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className={SCENE_BUTTON}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>

      <SheetContent
        side="left"
        hideClose
        onInteractOutside={keepOpen}
        // Escape in a text field or on a pending confirmation is theirs, not the panel's
        onEscapeKeyDown={(event) => { if (keepsEscape(event.target)) event.preventDefault() }}
        // Open on the panel itself rather than on its first control, so no focus ring greets a mouse user
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).focus()
        }}
        // Back to the Settings button only when the focus was in the panel, which is gone by now; focus that
        // is elsewhere, such as in the intro debugger, stays where it is
        onCloseAutoFocus={(event) => {
          if (document.activeElement && document.activeElement !== document.body) event.preventDefault()
        }}
        // The scroll padding keeps a row reached by Shift+Tab clear of the sticky header
        className="w-[min(340px,100vw)] max-h-screen scroll-pt-14 gap-2 overflow-y-auto bg-[rgba(10,10,15,0.98)] p-3 pointer-events-auto outline-none sm:max-w-none
          motion-reduce:!animate-none">
        {/* Stays at the top while the panel scrolls, so HELP and close are always in reach; -top-3 because a
            sticky element stops at the scroll padding, and the panel has p-3 */}
        <SheetHeader className="sticky -top-3 z-10 -mx-3 -mt-3 flex-row items-center gap-2 space-y-0 border-b border-neon-cyan/20 bg-[rgb(10,10,15)] px-3 pb-2 pt-3 text-left sm:text-left">
          <SheetTitle className="font-orbitron text-neon-cyan text-sm tracking-[1px]" style={{ textShadow: '0 0 10px #00ffff' }}>
            SETTINGS
          </SheetTitle>
          {/* The key is a hint like the others: shown with HELP, and never on a touch screen */}
          <kbd title="Esc opens and closes Settings" className="help-only border border-neon-cyan/40 px-1 font-mono text-[11px] leading-4 text-text-light/70">ESC</kbd>
          <SheetDescription className="sr-only">
            Adjust particle simulation parameters. Escape opens and closes this panel.
          </SheetDescription>
          <DescriptionsToggle className="ml-auto" />
          <SheetClose
            aria-label="Close Settings"
            className="flex h-7 w-7 shrink-0 items-center justify-center text-neon-cyan opacity-80 transition-opacity hover:opacity-100
              focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </SheetClose>
        </SheetHeader>
        <PreparedSettings host={settingsHost} />
      </SheetContent>
      {createPortal(<SettingsBody />, settingsHost)}
    </Sheet>
  )
}

export default ControlPanel
