import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'

// A control that has a hint carries it on its row:
//   data-hint        the one-line hint
//   data-hint-label  the control's full name, the menu's title
//   data-hint-reset  its default, formatted, when it can go back to one; the menu's Reset sends the row
//                    a `hint-reset` event
// The panels draw no hint lines: the hint sits here, a right-click, Shift+F10 or a long press away, and
// screen readers read the same text from the control's aria-describedby

// A finger held this long without moving opens the menu, as a right-click would
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP = 8
// Gap between the menu and the point or row it opens from, and the menu's margin from the window's edges
const OFFSET = 4
const EDGE = 8

interface OpenMenu {
  source: HTMLElement
  label: string
  hint: string
  reset: string | undefined
  x: number
  y: number
  // The point is a row's bottom-left corner (keyboard), not a pointer; the menu may flip above the row
  anchorTop: number
  returnFocus: HTMLElement | null
}

function readRow (row: HTMLElement) {
  return {
    label: row.dataset.hintLabel ?? '',
    hint: row.dataset.hint ?? '',
    reset: row.dataset.hintReset
  }
}

// The one context menu of the page, mounted once: it reads the row it opens on, so no row builds a menu
// of its own and opening it costs one render
function HintMenu () {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [position, setPosition] = useState<{ left: number, top: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  const hintId = 'hint-menu-text'

  useEffect(() => {
    // When a long press opened the menu, the native menu and the click that follow it belong to it too
    let pressOpenedAt = -Infinity
    let pressPointer = -1
    let suppressClickUntil = -Infinity
    let press: { id: number, x: number, y: number, timer: number } | null = null

    const open = (row: HTMLElement, x: number, y: number, fromPointer: boolean) => {
      const rect = row.getBoundingClientRect()
      const inside = fromPointer && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      const active = document.activeElement
      setMenu({
        source: row,
        ...readRow(row),
        x: inside ? x : rect.left,
        y: inside ? y + OFFSET : rect.bottom + OFFSET,
        anchorTop: inside ? y - OFFSET : rect.top - OFFSET,
        returnFocus: active instanceof HTMLElement && active !== document.body ? active : null
      })
    }

    const rowAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('[data-hint]') : null

    const handleContextMenu = (event: MouseEvent) => {
      if (event.timeStamp - pressOpenedAt < 1000) {
        event.preventDefault()
        return
      }
      const row = rowAt(event.target)
      if (!row?.dataset.hint) return
      event.preventDefault()
      // A browser that opens its own menu on a long press got there first; the timer stands down
      cancelPress()
      // Shift+F10 and the Menu key fire with no pointer, at the focused control or at 0,0
      open(row, event.clientX, event.clientY, event.button === 2 || event.clientX !== 0 || event.clientY !== 0)
    }

    const cancelPress = () => {
      if (!press) return
      window.clearTimeout(press.timer)
      press = null
    }

    // Capture phase: a slider stops the touches it handles from bubbling past it
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      cancelPress()
      const row = rowAt(event.target)
      if (!row?.dataset.hint) return
      const { clientX: x, clientY: y } = event
      press = {
        id: event.pointerId,
        x,
        y,
        timer: window.setTimeout(() => {
          press = null
          pressOpenedAt = performance.now()
          pressPointer = event.pointerId
          open(row, x, y, true)
        }, LONG_PRESS_MS)
      }
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) cancelPress()
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (press?.id === event.pointerId) cancelPress()
      // The finger that held the press lifts: the click it makes next is not a tap
      if (event.pointerId === pressPointer) {
        pressPointer = -1
        suppressClickUntil = event.timeStamp + 400
      }
    }
    // The finger lifted after a long press would click the row's control (a switch, a swatch)
    const handleClick = (event: MouseEvent) => {
      if (event.timeStamp > suppressClickUntil) return
      event.preventDefault()
      event.stopPropagation()
      suppressClickUntil = -Infinity
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true })
    document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true })
    document.addEventListener('pointerup', handlePointerEnd, { capture: true, passive: true })
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true, passive: true })
    document.addEventListener('scroll', cancelPress, { capture: true, passive: true })
    document.addEventListener('click', handleClick, true)
    return () => {
      cancelPress()
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('pointermove', handlePointerMove, { capture: true })
      document.removeEventListener('pointerup', handlePointerEnd, { capture: true })
      document.removeEventListener('pointercancel', handlePointerEnd, { capture: true })
      document.removeEventListener('scroll', cancelPress, { capture: true })
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  // Kept inside the window: flipped above the point or row when there is no room below
  useLayoutEffect(() => {
    const element = menuRef.current
    if (!menu || !element) {
      setPosition(null)
      return
    }
    const { width, height } = element.getBoundingClientRect()
    const left = Math.max(EDGE, Math.min(menu.x, window.innerWidth - width - EDGE))
    const below = menu.y + height <= window.innerHeight - EDGE
    const top = below ? menu.y : Math.max(EDGE, menu.anchorTop - height)
    setPosition({ left, top })
    ;(resetRef.current ?? element).focus({ preventScroll: true })
  }, [menu])

  // Any press outside, a scroll, a resize or Escape closes it
  useEffect(() => {
    if (!menu) return
    const close = (restore: boolean) => {
      setMenu(null)
      if (restore && menu.returnFocus?.isConnected) menu.returnFocus.focus({ preventScroll: true })
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close(false)
    }
    // On the window in the capture phase, ahead of the document listener that closes Settings on Escape
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Escape here closes the menu, not Settings or the intro debugger behind it
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close(false)
    }
    const handleResize = () => close(false)
    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleResize)
    }
  }, [menu])

  if (!menu) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={menu.label}
      aria-describedby={hintId}
      tabIndex={-1}
      // Tab away closes it, as it would any menu
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenu(null)
      }}
      className="fixed z-[70] w-max max-w-[min(300px,calc(100vw-16px))] border border-neon-cyan/50 bg-[rgb(12,12,18)] font-mono
        shadow-[0_8px_24px_rgba(0,0,0,0.6)] outline-none"
      // Drawn at its place once measured, so it never flashes at the wrong spot
      style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <div className="px-3 pb-2 pt-2">
        <p className="text-xs font-semibold text-neon-cyan">{menu.label}</p>
        <p id={hintId} className="mt-1 text-xs leading-5 text-text-light">{menu.hint}</p>
      </div>
      {menu.reset !== undefined && (
        <button
          ref={resetRef}
          type="button"
          role="menuitem"
          onClick={() => {
            menu.source.dispatchEvent(new CustomEvent('hint-reset'))
            setMenu(null)
            if (menu.returnFocus?.isConnected) menu.returnFocus.focus({ preventScroll: true })
          }}
          className="flex h-8 w-full items-center gap-2 border-t border-neon-cyan/20 px-3 text-left text-xs text-text-light/90
            transition-colors duration-150 hover:bg-neon-cyan/10 hover:text-neon-cyan
            focus-visible:bg-neon-cyan/10 focus-visible:text-neon-cyan focus-visible:outline-none"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {`Reset to ${menu.reset}`}
        </button>
      )}
    </div>,
    document.body
  )
}

export default HintMenu
