import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Settings, Maximize, Minimize } from 'lucide-react'
import SettingsBody from './settings_body'

// The panel closes only on request, so the scene can be used while settings are being tuned
function keepOpen (event: Event) {
  event.preventDefault()
}

function isTextEntry (target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
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

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.log('Fullscreen toggle failed:', error)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // The open panel closes on Escape by itself and marks the key as handled; this opens it again
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat) return
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || isTextEntry(event.target)) return
      setIsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <div className="fixed bottom-5 left-5 flex gap-2 z-40" style={{
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
            className="bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono"
            style={{
              boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono"
          style={{
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
          }}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>

      <SheetContent
        side="left"
        onInteractOutside={keepOpen}
        className="w-[min(340px,100vw)] max-h-screen overflow-y-auto bg-[rgba(10,10,15,0.98)] p-3 pointer-events-auto sm:max-w-none">
        <SheetHeader className="h-7 flex-row items-center gap-2 text-left sm:text-left">
          <SheetTitle className="font-orbitron text-neon-cyan text-sm tracking-[1px]" style={{ textShadow: '0 0 10px #00ffff' }}>
            SETTINGS
          </SheetTitle>
          <kbd aria-hidden="true" className="border border-neon-cyan/30 px-1 font-mono text-[0.65rem] leading-4 text-text-light/70">ESC</kbd>
          <SheetDescription className="sr-only">
            Adjust particle simulation parameters
          </SheetDescription>
        </SheetHeader>
        <PreparedSettings host={settingsHost} />
      </SheetContent>
      {createPortal(<SettingsBody active={isOpen} />, settingsHost)}
    </Sheet>
  )
}

export default ControlPanel
