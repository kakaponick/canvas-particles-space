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
import { ChartGantt, Settings, Maximize, Minimize } from 'lucide-react'
import SettingsBody from './settings_body'
import { cn, isTextEntry } from '@/lib/utils'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { useParticleStore } from '../store/particle_store'
import { MeasuredFps } from './controls/frame_rate_control'
import { INTRO_DOCK_ID, closeIntroDebugger, isInDock, toggleIntroDebugger } from '../lib/intro_dock'
import HintMenu from './controls/hint_menu'
import { FilmToggle } from './film_mode'
import { fullscreenTarget } from '../lib/film_ui'
import { useFractalStore } from '../store/fractal_store'
import { useFilmStore } from '../store/film_store'

// The panel closes only on request, so the scene can be used while settings are being tuned
function keepOpen (event: Event) {
  event.preventDefault()
}

// The scene toolbar's buttons. A panel's button opens and closes it from the same spot and shows it open in
// solid cyan, so the way back is always where the way in was. Forced colours drop that fill, so there the
// open panel's button takes the system's highlight
const SCENE_BUTTON = cn(
  'h-9 w-9 border-neon-cyan bg-[rgba(10,10,15,0.95)] text-neon-cyan shadow-[0_0_16px_rgba(0,255,255,0.25)]',
  'hover:bg-[rgba(0,255,255,0.12)] hover:text-neon-cyan',
  'aria-expanded:bg-neon-cyan aria-expanded:text-bg-dark aria-expanded:hover:bg-neon-cyan/85 aria-expanded:hover:text-bg-dark',
  'forced-colors:aria-expanded:bg-[Highlight] forced-colors:aria-expanded:text-[HighlightText] forced-colors:aria-expanded:hover:bg-[Highlight] forced-colors:aria-expanded:hover:text-[HighlightText]',
  'focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark'
)

// A leaf, so opening and closing the dock re-renders this button and nothing else
function IntroDebuggerToggle () {
  const open = useIntroDebugStore(state => state.open)
  return (
    <Button
      variant="outline"
      size="icon"
      data-intro-toggle=""
      aria-label="Intro debugger"
      aria-expanded={open}
      aria-controls={open ? INTRO_DOCK_ID : undefined}
      aria-keyshortcuts="Alt+Shift+D"
      title={open ? 'Close intro debugger (Alt+Shift+D)' : 'Intro debugger (Alt+Shift+D)'}
      onClick={toggleIntroDebugger}
      className={SCENE_BUTTON}
    >
      <ChartGantt aria-hidden="true" className="h-4 w-4" />
    </Button>
  )
}

// The frame rate on the scene itself, while FPS Counter in Playback is on. A readout, not a button: no
// border and no glow, only a dark backing so it reads over a bright scene, and a fixed width so the buttons
// beside it do not move as the digits change. This leaf follows the switch and MeasuredFps the number, so
// neither re-renders the toolbar
function SceneFps () {
  const shown = useParticleStore(state => state.fpsCounter)
  if (!shown) return null
  return (
    <div className="flex h-9 min-w-[4.5rem] items-center justify-center bg-[rgba(10,10,15,0.8)] px-2">
      <MeasuredFps className="text-text-light/90" />
    </div>
  )
}

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
      if (!document.fullscreenElement) await fullscreenTarget().requestFullscreen()
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

  // Settings belongs to the particle scene and the Mandelbrot and film modes stand in for it: opening one closes the others
  useEffect(() => {
    if (!isOpen) return
    useFractalStore.getState().setOpen(false)
    useFilmStore.getState().setOpen(false)
  }, [isOpen])
  useEffect(() => {
    const offFractal = useFractalStore.subscribe((state, before) => { if (state.open && !before.open) setIsOpen(false) })
    const offFilms = useFilmStore.subscribe((state, before) => { if (state.open && !before.open) setIsOpen(false) })
    return () => {
      offFractal()
      offFilms()
    }
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
      {/* The scene toolbar: one place to open and close each panel. Top right, where neither panel reaches on
          a wide screen; on a narrow one it sits over the Settings header's empty end. It never hides, and its
          order is the tab order */}
      <div role="group" aria-label="Scene controls" className="fixed right-3 top-3 z-[60] flex gap-2">
        <SceneFps />
        <FilmToggle className={SCENE_BUTTON} />
        <IntroDebuggerToggle />
        {/* The trigger toggles: it opens Settings and, pressed again, closes it */}
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Settings"
            aria-keyshortcuts="Escape"
            title={isOpen ? 'Close Settings (Esc)' : 'Settings (Esc)'}
            className={SCENE_BUTTON}
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className={SCENE_BUTTON}
        >
          {isFullscreen ? <Minimize aria-hidden="true" className="h-4 w-4" /> : <Maximize aria-hidden="true" className="h-4 w-4" />}
        </Button>
      </div>

      <SheetContent
        side="left"
        hideClose
        onInteractOutside={keepOpen}
        // Escape closes the panel the focus is in: in a text field or on a pending confirmation it is theirs, and
        // in the intro debugger it closes the debugger, not Settings
        onEscapeKeyDown={(event) => {
          if (keepsEscape(event.target)) {
            event.preventDefault()
          } else if (isInDock(event.target)) {
            event.preventDefault()
            closeIntroDebugger()
          }
        }}
        // Open on the panel itself rather than on its first control, so no focus ring greets a mouse user
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).focus()
        }}
        // Back to the Settings button only when the focus was in the panel, which is gone by now; focus that
        // is elsewhere, such as on the toolbar or in the intro debugger, stays where it is
        onCloseAutoFocus={(event) => {
          if (document.activeElement && document.activeElement !== document.body) event.preventDefault()
        }}
        // The scroll padding keeps a row reached by Shift+Tab clear of the sticky header
        className="w-[min(340px,100vw)] max-h-screen scroll-pt-14 gap-2 overflow-y-auto bg-[rgba(10,10,15,0.98)] p-3 pointer-events-auto outline-none sm:max-w-none
          motion-reduce:!animate-none">
        {/* Stays at the top while the panel scrolls; -top-3 because a sticky element stops at the scroll
            padding, and the panel has p-3. Its height matches the toolbar's reach (12 px + 36 px), so on a narrow
            screen the toolbar over its end never covers a row */}
        <SheetHeader className="sticky -top-3 z-10 -mx-3 -mt-3 min-h-[49px] flex-row items-center gap-2 space-y-0 border-b border-neon-cyan/20 bg-[rgb(10,10,15)] px-3 pb-2 pt-3 text-left sm:text-left">
          <SheetTitle className="font-orbitron text-neon-cyan text-sm tracking-[1px]" style={{ textShadow: '0 0 10px #00ffff' }}>
            SETTINGS
          </SheetTitle>
          <SheetDescription className="sr-only">
            Escape or the Settings button at the top right closes this panel. Shift+F10 on a setting opens its
            menu with a reset to the default.
          </SheetDescription>
        </SheetHeader>
        <PreparedSettings host={settingsHost} />
      </SheetContent>
      {createPortal(<SettingsBody />, settingsHost)}
      {/* The hint behind a right-click, Shift+F10 or a long press, for both panels */}
      <HintMenu />
    </Sheet>
  )
}

export default ControlPanel
