import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface SliderControlProps {
  id: string
  label: string
  // Name for screen readers when the visible label alone does not say what the slider sets
  ariaLabel?: string
  value: number
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
  // In the slider's context menu (hint_menu.tsx), and always read by screen readers
  description?: string
  // Fills the range with this colour instead of the accent
  fillColor?: string
  // The value a double-click returns to, marked on the track. A slider whose range crosses zero
  // returns to zero without it
  resetValue?: number
}

// A slider whose range crosses zero holds on to zero: a drag this close to it, as a share of the
// range, lands on it. The mouse wheel still reaches the values in between
const ZERO_SNAP_SHARE = 0.02
// Wheel distance in pixels for one step, so a trackpad swipe moves a few steps rather than to the end
const WHEEL_STEP_PX = 50
// A finger may be scrolling the panel, so a touch moves the value only once it goes sideways this far
const TOUCH_SLOP = 6
// A short tap that stays within the slop sets the value where it lands, so a finger needs no drag (WCAG
// 2.5.7); a tap that lands while the panel is still scrolling only stops the scroll
const TAP_MS = 250
const SCROLL_SETTLE_MS = 150

// When anything on the page last scrolled, read by the tap above
let lastScrollAt = -Infinity
if (typeof document !== 'undefined') {
  document.addEventListener('scroll', (event) => { lastScrollAt = event.timeStamp }, { capture: true, passive: true })
}

const CURSOR = 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2300ffff" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="2"/><path d="M12 8v8"/><path d="m10 10 2-2 2 2"/><path d="m10 14 2 2 2-2"/></svg>\') 12 12, ew-resize'

// Relative luminance under about 0.25: the color shows too little against the near-black track
function isDark (hex: string) {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5) < 0.25
}

const decimalsOf = (step: number) => Math.max(0, Math.min(6, Math.ceil(-Math.log10(step) - 1e-9)))

// One row: the name on the left and the value on the right, over a quiet fill that shows where the value
// sits in its range. The text never crosses a strong colour, so it reads the same at any value
function SliderControl ({
  id,
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  formatValue = (val) => String(val),
  onChange,
  description,
  fillColor,
  resetValue
}: SliderControlProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const crossesZero = min < 0 && max > 0
  const markValue = resetValue ?? (crossesZero ? 0 : undefined)
  const markPosition = markValue === undefined ? 0 : Math.min(Math.max((markValue - min) / (max - min), 0), 1) * 100
  const snapToZero = (next: number) =>
    crossesZero && Math.abs(next) <= (max - min) * ZERO_SNAP_SHARE ? 0 : next

  // The listeners are attached once and read the current props from here
  const live = useRef({ value, min, max, step, onChange, crossesZero, markValue })
  live.current = { value, min, max, step, onChange, crossesZero, markValue }
  // A finger on the slider: where and when it landed, whether it drags, and the slider's box for the drag
  const touch = useRef<{ id: number, x: number, y: number, at: number, dragging: boolean, rect: DOMRect | null } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let travel = 0
    let blocking = false

    // The wheel scrolls the panel; it changes the value only while the slider has the keyboard focus or
    // with Shift or Alt held, so scrolling past a slider, or on after dragging one, never changes it
    const handleWheel = (event: WheelEvent) => {
      const focused = container.querySelector('[role="slider"]')?.matches(':focus-visible') ?? false
      if (!focused && !event.shiftKey && !event.altKey) return
      // Only a focused slider holds the wheel back from the panel; Shift and Alt have no scroll to stop
      if (blocking) event.preventDefault()
      event.stopPropagation()
      // Shift turns the wheel sideways in some browsers
      const delta = event.deltaY || event.deltaX
      if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
        travel += delta
        if (Math.abs(travel) < WHEEL_STEP_PX) return
      }
      travel = 0
      const { value: current, min: low, max: high, step: size, onChange: change, crossesZero: zero } = live.current
      const stepped = Math.min(high, Math.max(low, current + (delta < 0 ? size : -size)))
      // Steps added one by one drift off the grid; the step that should land on zero does land on it
      const next = zero && Math.abs(stepped) < size / 2 ? 0 : Number(stepped.toFixed(decimalsOf(size)))
      if (next !== current) change(next)
    }

    // Passive while the slider has no focus, so scrolling past it never waits for the main thread
    const listen = (block: boolean) => {
      container.removeEventListener('wheel', handleWheel)
      blocking = block
      container.addEventListener('wheel', handleWheel, { passive: !block })
    }
    // A slider focused by a click or a drag keeps the wheel passive; only keyboard focus takes it
    const handleFocusIn = () => {
      if (container.querySelector('[role="slider"]')?.matches(':focus-visible')) listen(true)
    }
    const handleFocusOut = () => listen(false)
    // Reset from the context menu
    const handleReset = () => {
      const { value: current, onChange: change, markValue: mark } = live.current
      if (mark !== undefined && mark !== current) change(mark)
    }
    listen(false)
    container.addEventListener('focusin', handleFocusIn)
    container.addEventListener('focusout', handleFocusOut)
    container.addEventListener('hint-reset', handleReset)
    return () => {
      container.removeEventListener('hint-reset', handleReset)
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('focusin', handleFocusIn)
      container.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  const valueAt = (clientX: number, measured?: DOMRect | null) => {
    const rect = measured ?? containerRef.current!.getBoundingClientRect()
    const share = Math.min(Math.max((clientX - rect.left) / Math.max(rect.width, 1), 0), 1)
    const raw = min + share * (max - min)
    const stepped = Math.min(max, Math.max(min, min + Math.round((raw - min) / step) * step))
    return snapToZero(Number(stepped.toFixed(decimalsOf(step))))
  }
  const touchTo = (clientX: number, rect?: DOMRect | null) => {
    const next = valueAt(clientX, rect)
    if (next !== value) onChange(next)
  }

  // Touch is handled here instead of by the slider, which would take every finger that lands on it
  const touchHandlers = {
    onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      // The slider would take any button; a right-click opens the hint menu and must not move the value
      if (event.pointerType !== 'touch' && event.button !== 0) {
        event.stopPropagation()
        return
      }
      if (event.pointerType !== 'touch') return
      event.stopPropagation()
      // A finger that lands while the panel scrolls is stopping the scroll, and taps nothing
      const tapAt = event.timeStamp - lastScrollAt > SCROLL_SETTLE_MS ? event.timeStamp : -Infinity
      touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: tapAt, dragging: false, rect: null }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const pending = touch.current
      if (!pending || pending.id !== event.pointerId) return
      if (!pending.dragging) {
        const dx = Math.abs(event.clientX - pending.x)
        const dy = Math.abs(event.clientY - pending.y)
        if (dy > TOUCH_SLOP && dy >= dx) {
          touch.current = null
          return
        }
        if (dx <= TOUCH_SLOP) return
        pending.dragging = true
        // Measured once for the whole drag, not on every move right after the fill has changed
        pending.rect = event.currentTarget.getBoundingClientRect()
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      touchTo(event.clientX, pending.rect)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      const pending = touch.current
      if (pending?.id !== event.pointerId) return
      touch.current = null
      if (!pending.dragging && event.timeStamp - pending.at < TAP_MS) touchTo(event.clientX)
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (touch.current?.id === event.pointerId) touch.current = null
    }
  }

  // A dark color's own edge would vanish on the dark track, so its position edge is drawn in cyan
  const rangeStyle = fillColor
    ? { backgroundColor: `color-mix(in srgb, ${fillColor} 14%, transparent)`, borderColor: isDark(fillColor) ? '#00ffff' : fillColor }
    : undefined

  return (
    <div className="min-w-0 flex-1">
      <div
        ref={containerRef}
        className="group/slider relative touch-pan-y hover:bg-neon-cyan/[0.04]
          has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-neon-cyan"
        onDoubleClick={markValue === undefined ? undefined : () => onChange(markValue)}
        // Delete or Backspace on the focused slider is the keyboard's double-click
        onKeyDown={markValue === undefined
          ? undefined
          : (event) => {
            if (event.key !== 'Delete' && event.key !== 'Backspace') return
            event.preventDefault()
            if (markValue !== value) onChange(markValue)
          }}
        title={markValue === undefined
          ? (description ? 'Right-click: what it does' : undefined)
          : `Double-click or Delete: back to ${formatValue(markValue)}${description ? ' · Right-click: what it does' : ''}`}
        data-hint={description}
        data-hint-label={description ? (ariaLabel ?? label) : undefined}
        data-hint-reset={description && markValue !== undefined ? formatValue(markValue) : undefined}
        style={{ cursor: CURSOR }}
        {...touchHandlers}
      >
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onChange(snapToZero(values[0]))}
          trackHeight="h-7 rounded-none bg-text-light/[0.06]"
          // The fill shows the value; the thumb stays invisible but takes the focus and the arrow keys
          thumbSize="h-7 w-px opacity-0"
          thumbLabel={ariaLabel ?? label}
          thumbDescribedBy={descriptionId}
          thumbValueText={formatValue(value)}
          thumbKeyShortcuts={markValue === undefined ? undefined : 'Delete'}
          rangeClassName={cn('border-b-2', fillColor ? '' : 'border-neon-cyan bg-neon-cyan/[0.08]')}
          rangeStyle={rangeStyle}
          className="w-full touch-pan-y"
        />
        {markValue !== undefined && (
          // Short ticks on both edges, so the mark never runs through the text
          // Pulled back by its own width toward the end, so a mark at the top of the range stays inside the row
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px" style={{ left: `calc(${markPosition}% - ${markPosition / 100}px)` }}>
            <span className="absolute inset-x-0 top-0 h-1 bg-neon-cyan/70" />
            <span className="absolute inset-x-0 bottom-0 h-1 bg-neon-cyan/70" />
          </span>
        )}
        {/* The slider itself carries the name and the value for screen readers */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-3 font-mono text-xs">
          <span className="min-w-0 truncate text-text-light/90">{label}</span>
          <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-neon-cyan">{formatValue(value)}</span>
        </div>
      </div>
      {description && <p id={descriptionId} className="sr-only">{description}</p>}
    </div>
  )
}

export default SliderControl
