import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { Check, ChevronRight, Copy, Eye, EyeOff, RotateCcw, TriangleAlert } from 'lucide-react'
import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { cn, prefersReducedMotion } from '@/lib/utils'
import { useIntroDebugStore, getTitleChanges, type TitleText } from '../../store/intro_debug_store'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, colorToCss, cssToColor, formatParam, type IntroParamKey, type IntroParams } from '../../lib/intro_params'
import { INTRO_TRACKS, getCachedIntroMarkers, type IntroMarker, type IntroSpan, type IntroTrack } from '../../lib/intro_tracks'
import type { RingdownTiming } from '../../lib/intro_timeline'
import ColorPickerInput from './color_picker_input'
import SliderControl from './slider_control'
import TitleTextEditor from './title_text_editor'

// Horizontal inset of every lane, so markers at 0 s and at the end are not cut in half.
// Lanes, the ruler and the playhead all map time with the same geometry
const LANE_PAD = 12
const RULER_STEP = 0.5
// PageUp and PageDown on the seek bar jump this far; ArrowUp and ArrowDown step like the side arrows
const PAGE_STEP = 1
const ARROW_STEP = 0.1
const FRAME_STEP = 1 / 60

const share = (time: number, duration: number) => Math.min(Math.max(time / duration, 0), 1)
const percent = (time: number, duration: number) => `${share(time, duration) * 100}%`
// Moves a lane-wide element by a share of its own width, so placing a time changes no layout
const slide = (time: number, duration: number) => `translateX(${share(time, duration) * 100}%)`

// The ruler takes the focus when the control that held it disappears
const focusRuler = () => document.querySelector<HTMLElement>('[data-intro-ruler]')?.focus()

// The time under a mouse over the timeline, or null. The hover line and its label subscribe to it outside
// React and write to the DOM themselves, so a pointer moving over the timeline renders nothing
const useTimelineHover = createWithEqualityFn<{ time: number | null }>(() => ({ time: null }))
const setHoverTime = (time: number | null) => {
  if (useTimelineHover.getState().time !== time) useTimelineHover.setState({ time })
}

// A finger on a lane may be scrolling the track list, so it seeks only once it moves sideways this far,
// or where it lifts after a tap. The seek bar does not scroll, and a finger scrubs it at once
const TOUCH_SCRUB_SLOP = 6

// Pointer down on a lane or the ruler seeks there; dragging scrubs. Playback holds while the pointer
// is down, so the frame under it stays put, and goes on from there once it is released. A mouse over
// the timeline shows where a press would land
function useScrub (duration: number) {
  const seek = useIntroDebugStore(state => state.seek)
  const setPlaying = useIntroDebugStore(state => state.setPlaying)
  const resumeOnRelease = useRef(false)
  const pendingTouch = useRef<{ id: number, x: number, y: number } | null>(null)
  // The time axis of the lane under the pointer, measured when the pointer enters or presses it rather than on
  // every move; a lane only moves up and down while the pointer is on it, as the list scrolls
  const lane = useRef<{ target: Element | null, left: number, width: number }>({ target: null, left: 0, width: 1 })
  return useMemo(() => {
    const measure = (target: Element) => {
      const rect = target.getBoundingClientRect()
      lane.current.target = target
      lane.current.left = rect.left + LANE_PAD
      lane.current.width = Math.max(rect.width - LANE_PAD * 2, 1)
    }
    const timeAt = (event: ReactPointerEvent<HTMLElement>) => {
      if (lane.current.target !== event.currentTarget) measure(event.currentTarget)
      const position = Math.min(Math.max((event.clientX - lane.current.left) / lane.current.width, 0), 1)
      return Math.round(position * duration * 100) / 100
    }
    const startScrub = (event: ReactPointerEvent<HTMLElement>) => {
      measure(event.currentTarget)
      event.currentTarget.setPointerCapture(event.pointerId)
      // Only a timeline that was running when it was pressed starts again on release
      resumeOnRelease.current = useIntroDebugStore.getState().playing
      setPlaying(false)
      seek(timeAt(event))
    }
    const isPendingTouch = (event: ReactPointerEvent<HTMLElement>) => pendingTouch.current?.id === event.pointerId
    return {
      onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => measure(event.currentTarget),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        if (event.pointerType === 'touch' && !event.currentTarget.hasAttribute('data-intro-ruler')) {
          pendingTouch.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
          return
        }
        startScrub(event)
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const pending = pendingTouch.current
        if (pending && isPendingTouch(event)) {
          const dx = Math.abs(event.clientX - pending.x)
          const dy = Math.abs(event.clientY - pending.y)
          if (dx > TOUCH_SCRUB_SLOP && dx > dy) {
            pendingTouch.current = null
            startScrub(event)
          } else if (dy > TOUCH_SCRUB_SLOP) {
            // A scroll: the browser takes the finger and the timeline stays where it is
            pendingTouch.current = null
          }
          return
        }
        const scrubbing = event.currentTarget.hasPointerCapture(event.pointerId)
        if (!scrubbing && event.pointerType === 'touch') return
        const time = timeAt(event)
        if (scrubbing) seek(time)
        setHoverTime(time)
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        if (!isPendingTouch(event)) return
        pendingTouch.current = null
        seek(timeAt(event))
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        if (isPendingTouch(event)) pendingTouch.current = null
      },
      onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) return
        setHoverTime(null)
        lane.current.target = null
      },
      // The capture ends on release, on a cancelled touch and when the window loses the pointer
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return
        if (event.pointerType === 'touch') setHoverTime(null)
        if (!resumeOnRelease.current) return
        resumeOnRelease.current = false
        setPlaying(true)
      }
    }
  }, [duration, seek, setPlaying])
}

type Scrub = ReturnType<typeof useScrub>

// While the intro plays, the playhead and the seek bar's handle glide between the readout's updates, which
// come every 66 ms, instead of jumping by a frame's worth each time. A seek, a step back, the loop's wrap, a
// scrub and a paused timeline land at once, so a keyboard step is never smeared, and reduced motion has no glide
const GLIDE_MAX_STEP = 0.3
const glide = 'motion-safe:data-[playing]:transition-transform motion-safe:data-[playing]:duration-[66ms] motion-safe:data-[playing]:ease-linear'
// The fill keeps the thickening it has in index.css alongside the glide
const glideClip = 'motion-safe:data-[playing]:[transition:scale_150ms_cubic-bezier(0.16,1,0.3,1),clip-path_66ms_linear]'

// `data-playing` for a strip that follows `time`: set only while the clock runs forward by playback
function useGlide (time: number) {
  const playing = useIntroDebugStore(state => state.playing)
  // A seek moves the readout and leaves its request pending until the loop takes it
  const seeking = useIntroDebugStore(state => state.seekRequest !== null)
  const shown = useRef(time)
  useLayoutEffect(() => {
    shown.current = time
  })
  const step = time - shown.current
  return playing && !seeking && step > 0 && step < GLIDE_MAX_STEP ? '' : undefined
}

// The played part of the seek bar and its handle, which follow the clock. The fill is clipped and the handle
// slides, so neither changes the layout
function SeekProgress ({ duration }: { duration: number }) {
  const time = useIntroDebugStore(state => Math.min(state.readout.time, duration))
  const gliding = useGlide(time)
  return (
    <>
      {/* The fill glides with the handle, so its end never runs ahead of it */}
      <span
        aria-hidden="true"
        data-playing={gliding}
        className={cn('seek-fill absolute inset-x-0 rounded-l-full bg-neon-cyan', glideClip)}
        style={{ clipPath: `inset(0 ${100 - share(time, duration) * 100}% 0 0)` }}
      />
      {/* The clip takes in the bar's padding too, so the handle at either end is drawn whole */}
      <span aria-hidden="true" className="pointer-events-none absolute -inset-x-3 inset-y-0 z-[2] overflow-hidden">
        <span data-playing={gliding} className={cn('absolute inset-y-0 left-3 right-3 will-change-transform', glide)} style={{ transform: slide(time, duration) }}>
          <span className="seek-thumb absolute left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-neon-cyan ring-2 ring-bg-panel" />
        </span>
      </span>
    </>
  )
}

// The phase that a moment in time falls in, from a sorted list of the intro's moments
function phaseAt (markers: readonly IntroMarker[], time: number) {
  let phase = ''
  for (const marker of markers) {
    if (time < marker.time) break
    phase = marker.label
  }
  return phase
}

// Room the label keeps beside its text for a time that grows a digit
const LABEL_SLACK = 8

// Where a press would seek to, with the moment of the intro it falls in. A zero-width anchor slides along the
// bar with a transform; the bar's width is measured when a hover starts, and the label's own width only when
// its phase changes, so a pointer moving along the bar causes no layout
function SeekHoverLabel ({ duration }: { duration: number }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const phaseRef = useRef<HTMLSpanElement>(null)
  const durationRef = useRef(duration)
  durationRef.current = duration
  useEffect(() => {
    let barWidth = 0
    let halfLabel = 0
    let shownPhase: string | null = null
    const show = (time: number | null) => {
      const anchor = anchorRef.current
      const label = labelRef.current
      if (!anchor || !label || !timeRef.current || !phaseRef.current) return
      if (time === null) {
        anchor.style.visibility = 'hidden'
        barWidth = 0
        shownPhase = null
        return
      }
      if (!barWidth) barWidth = anchor.parentElement?.clientWidth ?? 0
      timeRef.current.textContent = `${time.toFixed(2)} s`
      const phase = phaseAt(getCachedIntroMarkers(prefersReducedMotion, useIntroDebugStore.getState().params), time)
      if (phase !== shownPhase) {
        shownPhase = phase
        phaseRef.current.textContent = phase ? ` · ${phase}` : ''
        halfLabel = label.offsetWidth / 2 + LABEL_SLACK
      }
      // The label may use the bar's padding, never more
      const low = halfLabel - LANE_PAD
      const high = Math.max(barWidth + LANE_PAD - halfLabel, low)
      const x = Math.min(Math.max(share(time, durationRef.current) * barWidth, low), high)
      anchor.style.transform = `translateX(${x}px)`
      anchor.style.visibility = 'visible'
    }
    show(useTimelineHover.getState().time)
    return useTimelineHover.subscribe(state => show(state.time))
  }, [])
  return (
    <span ref={anchorRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-[3px] z-[3] w-0 will-change-transform">
      <span
        ref={labelRef}
        className="absolute left-0 top-0 -translate-x-1/2 whitespace-nowrap border border-neon-cyan/50 bg-bg-panel px-1.5
          text-[11px] leading-[14px] text-text-light tabular-nums"
      >
        <span ref={timeRef} />
        <span ref={phaseRef} className="text-neon-cyan" />
      </span>
    </span>
  )
}

const sameNumbers = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index])

// Everything the seek bar draws: time labels, the track, the played part and the moments as gaps. It renders
// apart from the bar, so a change of the value the bar announces touches only the bar's own attributes
const RulerTrack = memo(function RulerTrack ({ duration }: { duration: number }) {
  // The cuts between chapters, worked out once per change of the parameters so the readout's frequent store
  // updates reuse them
  const cuts = useRef<{ params: IntroParams | null, duration: number, times: number[] }>({ params: null, duration: 0, times: [] })
  const moments = useIntroDebugStore(state => {
    const last = cuts.current
    if (last.params !== state.params || last.duration !== duration) {
      cuts.current = {
        params: state.params,
        duration,
        times: getCachedIntroMarkers(prefersReducedMotion, state.params)
          .filter(moment => moment.time > 0.01 && moment.time < duration - 0.01)
          .map(moment => moment.time)
      }
    }
    return cuts.current.times
  }, sameNumbers)
  const ticks = useMemo(() => {
    const list: number[] = []
    for (let t = 0; t <= duration + 1e-6; t += RULER_STEP) list.push(Math.round(t * 10) / 10)
    return list
  }, [duration])
  return (
    <div className="relative h-full">
      {ticks.map(tick => {
        const whole = Number.isInteger(tick)
        return (
          <span key={tick} aria-hidden="true" className="absolute top-[18px] -translate-x-1/2" style={{ left: percent(tick, duration) }}>
            {whole && <span className="absolute bottom-full left-1/2 mb-[3px] -translate-x-1/2 whitespace-nowrap text-[11px] leading-none text-text-light/80 tabular-nums">{tick} s</span>}
            <span className={`block w-px ${whole ? 'h-1.5 bg-text-light/50' : 'h-1 bg-text-light/25'}`} />
          </span>
        )
      })}
      <span aria-hidden="true" className="seek-track absolute inset-x-0 rounded-full bg-neon-cyan/40" />
      <SeekProgress duration={duration} />
      {/* The intro's moments cut the bar into chapters, the way [ and ] step between them */}
      {moments.map((time, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="seek-cut absolute z-[1] w-[2px] -translate-x-1/2 bg-bg-panel"
          style={{ left: percent(time, duration) }}
        />
      ))}
      <SeekHoverLabel duration={duration} />
    </div>
  )
})

// The timeline's main seek bar: time labels, the played part, the moments of the intro as gaps, and
// the playhead's handle. It is the keyboard's way to seek too
function Ruler ({ duration, scrub }: { duration: number, scrub: Scrub }) {
  const seek = useIntroDebugStore(state => state.seek)
  // While playing, the value a screen reader hears moves once a second instead of with every readout
  const playing = useIntroDebugStore(state => state.playing)
  const spoken = useIntroDebugStore(state => {
    const time = Math.min(state.readout.time, duration)
    return state.playing ? Math.floor(time) : Math.round(time * 100) / 100
  })
  const phase = useIntroDebugStore(state => state.readout.phase)

  // The side arrows, Home and End seek through the debugger's own shortcuts; these are the rest of a slider's keys
  const seekWithKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const arrow = event.shiftKey ? FRAME_STEP : ARROW_STEP
    let delta: number
    switch (event.key) {
    case 'PageUp': delta = PAGE_STEP; break
    case 'PageDown': delta = -PAGE_STEP; break
    case 'ArrowUp': delta = arrow; break
    case 'ArrowDown': delta = -arrow; break
    default: return
    }
    event.preventDefault()
    seek(Math.min(useIntroDebugStore.getState().readout.time, duration) + delta)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      data-intro-ruler=""
      aria-label="Intro time"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 100) / 100}
      aria-valuenow={spoken}
      aria-valuetext={`${playing ? spoken : spoken.toFixed(2)} of ${duration.toFixed(2)} seconds, ${phase || 'start'}`}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight PageUp PageDown Home End"
      className="seek-bar group/seek relative h-9 cursor-pointer touch-none select-none outline-none"
      style={{ paddingInline: LANE_PAD }}
      onKeyDown={seekWithKeys}
      {...scrub}
    >
      <RulerTrack duration={duration} />
    </div>
  )
}

// A line across every lane: a lane-wide strip slides by a share of its own width with the line at its left
// edge, clipped to the lane column
const laneClip = 'pointer-events-none absolute inset-y-0 left-[var(--label-w)] right-0 z-10 overflow-hidden'
const laneStrip = { left: LANE_PAD, right: LANE_PAD }

// Vertical line through every lane at the current time. The scene keeps running after the intro ends;
// the line stops at the end, and so does this component's re-rendering
function Playhead ({ duration }: { duration: number }) {
  const time = useIntroDebugStore(state => Math.min(state.readout.time, duration))
  const gliding = useGlide(time)
  return (
    <span aria-hidden="true" className={laneClip}>
      <span data-playing={gliding} className={cn('absolute inset-y-0 will-change-transform', glide)} style={{ ...laneStrip, transform: slide(time, duration) }}>
        <span className="absolute inset-y-0 left-0 w-px bg-neon-cyan/80" />
      </span>
    </span>
  )
}

// A fainter line where a press would seek to
function HoverLine ({ duration }: { duration: number }) {
  const clipRef = useRef<HTMLSpanElement>(null)
  const stripRef = useRef<HTMLSpanElement>(null)
  const durationRef = useRef(duration)
  durationRef.current = duration
  useEffect(() => {
    const show = (time: number | null) => {
      if (!clipRef.current || !stripRef.current) return
      clipRef.current.style.visibility = time === null ? 'hidden' : 'visible'
      if (time !== null) stripRef.current.style.transform = slide(time, durationRef.current)
    }
    show(useTimelineHover.getState().time)
    return useTimelineHover.subscribe(state => show(state.time))
  }, [])
  return (
    <span ref={clipRef} aria-hidden="true" className={cn(laneClip, 'invisible')}>
      <span ref={stripRef} className="absolute inset-y-0 will-change-transform" style={laneStrip}>
        <span className="absolute inset-y-0 left-0 w-px bg-text-light/35" />
      </span>
    </span>
  )
}

type TrackReadout = NonNullable<IntroTrack['readout']>

// Room for the widest value in ch: two whole digits, three for a percentage that reaches 100, then the
// decimals and the unit. The number changes at loop rate inside a box that never changes size
const valueWidth = (readout: TrackReadout) =>
  `${(readout.scale === 100 && readout.digits === 0 ? 3 : 2) + (readout.digits > 0 ? readout.digits + 1 : 0) + (readout.unit?.length ?? 0)}ch`

// The live number a track publishes, after its one-word name, and in full for the pointer and for screen
// readers; a phone has no room for it
function TrackValue ({ readout }: { readout: TrackReadout }) {
  const value = useIntroDebugStore(state => state.readout[readout.key])
  return (
    <span className="flex shrink-0 items-center gap-1 tabular-nums text-text-light/70 max-sm:hidden" title={readout.name}>
      <span aria-hidden="true" className="text-text-light/60">{readout.short}</span>
      <span className="sr-only">{readout.name}: </span>
      <span className="inline-block text-right [contain:layout_paint]" style={{ width: valueWidth(readout) }}>
        {(value * (readout.scale ?? 1)).toFixed(readout.digits)}{readout.unit}
      </span>
    </span>
  )
}

// Bright while the playhead is inside the span; a span that holds keeps a dim tail to the end
function SpanBar ({ span, duration }: { span: IntroSpan, duration: number }) {
  const active = useIntroDebugStore(state => state.readout.time >= span.start && (span.holds || state.readout.time <= span.end))
  const width = share(span.end, duration) - share(span.start, duration)
  return (
    <>
      {width > 0 && (
        <span
          className={`absolute top-[17px] h-2 rounded-[2px] border transition-colors duration-150 ${
            active ? 'border-neon-cyan bg-neon-cyan/55' : 'border-neon-cyan/45 bg-neon-cyan/20'
          }`}
          style={{ left: percent(span.start, duration), width: `${width * 100}%` }}
        />
      )}
      {span.holds && (
        <span
          className={`absolute right-0 top-[19px] h-1 rounded-r-[2px] transition-colors duration-150 ${active ? 'bg-neon-cyan/30' : 'bg-neon-cyan/10'}`}
          style={{ left: percent(span.end, duration) }}
        />
      )}
    </>
  )
}

// Labels near the right edge flip to the left of their diamond so they stay on the lane
const FLIP_LABEL_AT = 0.86

// Approximate width of a marker's label in pixels, with its offset from the diamond
const labelWidth = (label: string) => label.length * 7 + 16

// Which groups of a lane can show their label: one that runs right must end before the next diamond, one
// flipped to the left must start after the previous diamond and the label that runs right of it
function labelsThatFit (groups: IntroMarker[][], duration: number, secondsPerPx: number) {
  const shown = groups.map(() => true)
  if (secondsPerPx <= 0) return shown
  let reach = -Infinity
  groups.forEach((group, index) => {
    const time = group[0].time
    const span = labelWidth(group[0].label) * secondsPerPx
    if (share(time, duration) > FLIP_LABEL_AT) {
      const previous = groups[index - 1]
      shown[index] = !previous || time - span >= Math.max(previous[0].time, reach)
    } else {
      const next = groups[index + 1]
      shown[index] = !next || next[0].time - time >= span
      if (shown[index]) reach = time + span
    }
  })
  return shown
}

// One diamond on a lane for a moment that cannot be moved, or for moments too close together to tell apart on
// a narrow lane, and then it seeks to the first of them and is named for all of them. It is out of the tab
// order: the seek bar and [ ] reach every moment from the keyboard. Its label hides when it would run into a
// neighbour; the name and the tooltip keep every moment
function MarkerButton ({ group, duration, showLabel }: { group: IntroMarker[], duration: number, showLabel: boolean }) {
  const seek = useIntroDebugStore(state => state.seek)
  const isPhase = useIntroDebugStore(state => group.some(marker => marker.label === state.readout.phase))
  const first = group[0]
  const labels = group.map(marker => marker.label).join(', then ')
  const flip = share(first.time, duration) > FLIP_LABEL_AT
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Seek to ${labels}, ${first.time.toFixed(2)} s`}
      title={group.map(marker => `${marker.label} · ${marker.time.toFixed(2)} s`).join(', ')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => seek(first.time)}
      // 24 px wide, a full target, with the diamond in its middle
      className="group/marker absolute inset-y-0 z-[1] w-6 -translate-x-1/2 focus-visible:outline-none"
      style={{ left: percent(first.time, duration) }}
    >
      <span
        className={cn(
          'absolute left-1/2 top-[16.5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-neon-cyan transition-colors duration-150',
          'group-hover/marker:bg-neon-cyan group-focus-visible/marker:bg-neon-cyan',
          'group-focus-visible/marker:outline group-focus-visible/marker:outline-1 group-focus-visible/marker:outline-offset-2 group-focus-visible/marker:outline-neon-cyan',
          isPhase ? 'bg-neon-cyan' : 'bg-bg-dark'
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-1 whitespace-nowrap text-[11px] leading-none transition-colors duration-150',
          !showLabel && 'hidden',
          'group-hover/marker:text-neon-cyan group-focus-visible/marker:text-neon-cyan',
          flip ? 'right-3.5' : 'left-3.5',
          isPhase ? 'text-neon-cyan' : 'text-text-light/70'
        )}
      >
        {first.label}
      </span>
    </button>
  )
}


// A moment set by one parameter can be moved on its lane. The arrows step it, Shift by the parameter's own
// step; Page keys move half a second, Home and End to the ends of its range
const MOMENT_STEP = 0.05
const MOMENT_PAGE_STEP = 0.5
// A press that moves less than this is a click, which seeks to the moment
const MOMENT_DRAG_SLOP = 3

const stepDecimals = (step: number) => Math.max(0, Math.min(6, Math.ceil(-Math.log10(step) - 1e-9)))

// A moment the user can move: drag the diamond along its lane, or focus it and use the arrows, and its
// parameter follows on its slider's step and range. A click or Enter still seeks to it, Delete puts it back.
// It is a slider for screen readers, valued in seconds, and its hint menu names the parameter it moves
function MovableMarker ({ marker, duration, showLabel }: { marker: IntroMarker, duration: number, showLabel: boolean }) {
  const seek = useIntroDebugStore(state => state.seek)
  const setParam = useIntroDebugStore(state => state.setParam)
  const isPhase = useIntroDebugStore(state => marker.label === state.readout.phase)
  const param = marker.param!
  const spec = INTRO_PARAM_SPECS[param]
  const base = marker.base ?? 0
  const fallback = DEFAULT_INTRO_PARAMS[param]
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number, startX: number, startTime: number, base: number, width: number, duration: number, moved: boolean, next: number | null, frame: number } | null>(null)

  // The moment at `time`, counted from `from`, onto the parameter's step and range
  const moveTo = (time: number, from = base) => {
    const raw = Math.round((time - from) / spec.step) * spec.step
    const value = Number(Math.min(spec.max, Math.max(spec.min, raw)).toFixed(stepDecimals(spec.step)))
    if (value !== useIntroDebugStore.getState().params[param]) setParam(param, value)
  }

  // Reset from the hint menu
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const reset = () => setParam(param, fallback)
    element.addEventListener('hint-reset', reset)
    return () => element.removeEventListener('hint-reset', reset)
  }, [param, fallback, setParam])

  useEffect(() => () => {
    if (drag.current) window.cancelAnimationFrame(drag.current.frame)
  }, [])

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const pending = drag.current
    if (!pending || pending.id !== event.pointerId) return
    drag.current = null
    window.cancelAnimationFrame(pending.frame)
    if (pending.moved) {
      if (commit && pending.next !== null) moveTo(pending.next, pending.base)
      setDragging(false)
    } else if (commit) {
      seek(marker.time)
    }
  }

  const time = marker.time
  const coarse = Math.max(spec.step, MOMENT_STEP)
  const flip = share(time, duration) > FLIP_LABEL_AT
  const name = spec.spokenName ?? spec.label

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={`Moment: ${marker.label}`}
      aria-valuemin={Math.round((base + spec.min) * 100) / 100}
      aria-valuemax={Math.round((base + spec.max) * 100) / 100}
      aria-valuenow={Math.round(time * 100) / 100}
      aria-valuetext={`${time.toFixed(2)} s`}
      aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight PageUp PageDown Home End Enter Delete"
      title={`${marker.label} · ${time.toFixed(2)} s · drag or ← → to move · click or Enter to seek · Delete: back to ${(base + fallback).toFixed(2)} s`}
      data-hint={spec.hint}
      data-hint-label={name}
      data-hint-reset={`${(base + fallback).toFixed(2)} s`}
      onPointerDown={(event) => {
        // The lane under it would seek and scrub
        event.stopPropagation()
        if (event.button !== 0) return
        const lane = event.currentTarget.parentElement
        drag.current = {
          id: event.pointerId,
          startX: event.clientX,
          startTime: time,
          base,
          width: Math.max(lane?.getBoundingClientRect().width ?? 1, 1),
          // The scale of the lane when the drag starts: moving the last moment changes the timeline's length
          duration,
          moved: false,
          next: null,
          frame: 0
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const pending = drag.current
        if (!pending || pending.id !== event.pointerId) return
        const dx = event.clientX - pending.startX
        if (!pending.moved) {
          if (Math.abs(dx) < MOMENT_DRAG_SLOP) return
          pending.moved = true
          setDragging(true)
        }
        pending.next = pending.startTime + dx / pending.width * pending.duration
        // One change of the parameter per frame, however fast the pointer reports
        if (pending.frame) return
        pending.frame = window.requestAnimationFrame(() => {
          pending.frame = 0
          if (pending.next !== null) moveTo(pending.next, pending.base)
        })
      }}
      onPointerUp={(event) => endDrag(event, true)}
      onPointerCancel={(event) => endDrag(event, false)}
      onKeyDown={(event) => {
        switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          moveTo(time - (event.shiftKey ? spec.step : coarse))
          break
        case 'ArrowRight':
        case 'ArrowUp':
          moveTo(time + (event.shiftKey ? spec.step : coarse))
          break
        case 'PageDown':
          moveTo(time - MOMENT_PAGE_STEP)
          break
        case 'PageUp':
          moveTo(time + MOMENT_PAGE_STEP)
          break
        case 'Home':
          moveTo(base + spec.min)
          break
        case 'End':
          moveTo(base + spec.max)
          break
        case 'Enter':
          seek(time)
          break
        case 'Delete':
        case 'Backspace':
          if (useIntroDebugStore.getState().params[param] !== fallback) setParam(param, fallback)
          break
        default:
          return
        }
        event.preventDefault()
        event.stopPropagation()
      }}
      // 24 px wide, a full target, with the diamond in its middle. A finger drags it sideways at once
      className="group/marker absolute inset-y-0 z-[2] w-6 -translate-x-1/2 cursor-ew-resize touch-none focus-visible:outline-none"
      style={{ left: percent(time, duration) }}
    >
      <span
        className={cn(
          'absolute left-1/2 top-[16.5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-neon-cyan transition-[background-color,transform] duration-150',
          'group-hover/marker:scale-125 group-hover/marker:bg-neon-cyan group-focus-visible/marker:bg-neon-cyan',
          'group-focus-visible/marker:outline group-focus-visible/marker:outline-1 group-focus-visible/marker:outline-offset-2 group-focus-visible/marker:outline-neon-cyan',
          'motion-reduce:transition-none',
          isPhase || dragging ? 'scale-125 bg-neon-cyan' : 'bg-bg-dark'
        )}
      />
      {/* While it moves, the label carries the time it lands on, and shows even where it would crowd a neighbour */}
      <span
        className={cn(
          'pointer-events-none absolute top-1 whitespace-nowrap text-[11px] leading-none tabular-nums transition-colors duration-150',
          !showLabel && !dragging && 'hidden',
          'group-hover/marker:text-neon-cyan group-focus-visible/marker:text-neon-cyan',
          flip ? 'right-3.5' : 'left-3.5',
          isPhase || dragging ? 'text-neon-cyan' : 'text-text-light/70',
          dragging && 'z-[3] bg-bg-panel px-1'
        )}
      >
        {dragging ? `${marker.label} ${time.toFixed(2)} s` : marker.label}
      </span>
    </div>
  )
}

// Moments of one track closer than `gap` seconds share one diamond; a gap of 0 keeps every moment apart. A
// moment that can be moved keeps its own diamond, so dragging it past a neighbour never merges it away
function groupMarkers (markers: IntroMarker[], gap: number): IntroMarker[][] {
  const groups: IntroMarker[][] = []
  for (const marker of markers) {
    const last = groups[groups.length - 1]
    if (last && gap > 0 && !marker.param && !last[0].param && marker.time - last[0].time < gap) last.push(marker)
    else groups.push([marker])
  }
  return groups
}

const NO_MARKERS: IntroMarker[] = []
const NO_KEYS: IntroParamKey[] = []

// One parameter of an expanded track. It reads its own value, so dragging it re-renders this control alone
const IntroParamControl = memo(function IntroParamControl ({ paramKey }: { paramKey: IntroParamKey }) {
  const value = useIntroDebugStore(state => state.params[paramKey])
  const setParam = useIntroDebugStore(state => state.setParam)
  const spec = INTRO_PARAM_SPECS[paramKey]
  const id = `intro-param-${paramKey}`
  // One line in the control's context menu; the default is the mark on the bar and the double-click's target
  const description = spec.hint
  if (spec.color) {
    return (
      <ColorPickerInput
        label={spec.label}
        ariaLabel={spec.spokenName}
        value={colorToCss(value)}
        onChange={(css) => setParam(paramKey, cssToColor(css))}
        description={description}
      />
    )
  }
  if (spec.options) {
    return (
      <div className="min-w-0" data-hint={description} data-hint-label={spec.spokenName ?? spec.label}>
        <label
          className="flex h-7 min-w-0 items-center gap-2 border border-neon-cyan/40 bg-black/30 pl-3 pr-1 font-mono text-xs
            transition-colors duration-150 hover:border-neon-cyan/70
            focus-within:border-neon-cyan focus-within:outline focus-within:outline-1 focus-within:outline-neon-cyan"
        >
          <span className="shrink-0 text-text-light/90">{spec.label}</span>
          <select
            id={id}
            aria-label={spec.spokenName}
            aria-describedby={`${id}-description`}
            value={Math.round(value)}
            onChange={(event) => setParam(paramKey, Number(event.target.value))}
            className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-right font-semibold text-neon-cyan outline-none"
          >
            {spec.options.map((option, index) => (
              <option key={option} value={index} className="bg-bg-panel text-left font-normal text-text-light">{option}</option>
            ))}
          </select>
        </label>
        <p id={`${id}-description`} className="sr-only">{description}</p>
      </div>
    )
  }
  return (
    <SliderControl
      id={id}
      label={spec.label}
      ariaLabel={spec.spokenName}
      value={value}
      min={spec.min}
      max={spec.max}
      step={spec.step}
      formatValue={(next) => formatParam(next, spec)}
      onChange={(next) => setParam(paramKey, next)}
      resetValue={DEFAULT_INTRO_PARAMS[paramKey]}
      description={description}
    />
  )
})

interface TrackDerived {
  params: IntroParams
  ringTiming: RingdownTiming
  spans: IntroSpan[]
  markers: IntroMarker[]
  // The track's parameters that differ from their defaults
  changed: IntroParamKey[]
}
const sameSpans = (a: IntroSpan[], b: IntroSpan[]) =>
  a.length === b.length && a.every((span, index) => span.start === b[index].start && span.end === b[index].end && span.holds === b[index].holds)
const sameMarkers = (a: IntroMarker[], b: IntroMarker[]) =>
  a.length === b.length && a.every((marker, index) =>
    marker.time === b[index].time && marker.label === b[index].label && marker.base === b[index].base)

// When a track is active, in words, for screen readers on its name: "runs 1.20–1.85 s", several spans joined
const spanWords = (span: IntroSpan) => {
  if (span.end <= span.start) return span.holds ? (span.start <= 0 ? 'always on' : `on from ${span.start.toFixed(2)} s`) : ''
  return `runs ${span.start.toFixed(2)}–${span.end.toFixed(2)} s${span.holds ? ', then stays on' : ''}`
}
const describeSpans = (spans: IntroSpan[]) => spans.map(spanWords).filter(Boolean).join(', ') || 'not active'

interface TrackRowProps {
  track: IntroTrack
  duration: number
  hidden: boolean
  expanded: boolean
  // Title fields (text, font, case) changed from the default, for the track that edits them
  textChanges: number
  // Moments closer than this many seconds share one diamond; 0 keeps them apart
  markerGap: number
  // Seconds per pixel of the lane, rounded so most changes of its width leave the rows alone; 0 until measured
  secondsPerPx: number
  scrub: Scrub
  onToggleExpanded: (key: string) => void
}

const TrackRow = memo(function TrackRow ({ track, duration, hidden, expanded, textChanges, markerGap, secondsPerPx, scrub, onToggleExpanded }: TrackRowProps) {
  const toggleLayer = useIntroDebugStore(state => state.toggleLayer)
  const soloLayer = useIntroDebugStore(state => state.soloLayer)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const resetTitle = useIntroDebugStore(state => state.resetTitle)
  // A row re-renders only when its own spans, moments or count of changed parameters change, not on every
  // step of a slider; each parameter control reads its own value. They are worked out once per change of
  // the parameters or the ringdown timing, so the readout's frequent store updates reuse them
  const derived = useRef<TrackDerived | null>(null)
  const derive = (state: { params: IntroParams, ringTiming: RingdownTiming }) => {
    const last = derived.current
    if (last && last.params === state.params && last.ringTiming === state.ringTiming) return last
    const changed = track.params.filter(key => state.params[key] !== DEFAULT_INTRO_PARAMS[key])
    const next: TrackDerived = {
      params: state.params,
      ringTiming: state.ringTiming,
      spans: track.spans(state.params, prefersReducedMotion, state.ringTiming),
      markers: track.markers?.(state.params, prefersReducedMotion) ?? NO_MARKERS,
      changed: changed.length > 0 ? changed : NO_KEYS
    }
    derived.current = next
    return next
  }
  const spans = useIntroDebugStore(state => derive(state).spans, sameSpans)
  const markers = useIntroDebugStore(state => derive(state).markers, sameMarkers)
  const changed = useIntroDebugStore(state => derive(state).changed, shallow)
  const changedCount = changed.length + textChanges
  const panelId = `intro-track-${track.key}`
  const markerGroups = groupMarkers(markers, markerGap)
  const labelShown = labelsThatFit(markerGroups, duration, secondsPerPx)
  // Worked out again only when the spans change, which is when the row re-renders for them
  const spanText = useMemo(() => `, ${describeSpans(spans)}`, [spans])
  // The reset button goes once it has done its job, so the focus moves back to the track's name first
  const expandRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={`border-b border-text-light/[0.07] ${expanded ? 'bg-neon-cyan/[0.03]' : ''}`}>
      <div className="grid grid-cols-[var(--label-w)_1fr] hover:bg-neon-cyan/[0.04]">
        <div className="flex h-8 min-w-0 items-center gap-1 border-r border-neon-cyan/10 pl-1 pr-2">
          {track.layer
            ? (
              <button
                type="button"
                // A fixed name with the pressed state saying whether the layer shows; only the tooltip names the action
                aria-pressed={!hidden}
                aria-label={`${track.label} layer`}
                aria-keyshortcuts="Alt+Enter Alt+Space"
                title={`${hidden ? `Show ${track.label}` : `Hide ${track.label} to see what it adds`} · Alt+click or Alt+Enter: only this layer`}
                onClick={(event) => event.altKey ? soloLayer(track.layer!) : toggleLayer(track.layer!)}
                onKeyDown={(event) => {
                  if (!event.altKey || (event.key !== 'Enter' && event.key !== ' ')) return
                  event.preventDefault()
                  soloLayer(track.layer!)
                }}
                className={cn(
                  eyeColumn,
                  'flex h-8 items-center justify-center transition-colors duration-150 hover:text-neon-cyan',
                  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan',
                  hidden ? 'text-text-light/60' : 'text-neon-cyan/80'
                )}
              >
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )
            : <span className={eyeColumn} />}
          {track.params.length > 0
            ? (
              <button
                ref={expandRef}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggleExpanded(track.key)}
                className="flex h-8 min-w-0 flex-1 items-center gap-1 text-left text-text-light/85 transition-colors duration-150 hover:text-neon-cyan
                  focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
                    expanded ? 'rotate-90 text-neon-cyan' : 'text-text-light/50'
                  )}
                />
                <span title={track.label} className={trackName}>{track.label}<span className="sr-only">{spanText}</span></span>
                {changedCount > 0 && <ChangedBadge count={changedCount} />}
              </button>
            )
            : (
              <span title={track.label} className={cn(trackName, 'min-w-0 flex-1 pl-4 text-text-light/85')}>
                {track.label}<span className="sr-only">{spanText}</span>
              </span>
            )}
          {track.readout && <TrackValue readout={track.readout} />}
        </div>
        <div className="h-8 cursor-pointer touch-pan-y select-none" style={{ paddingInline: LANE_PAD }} {...scrub}>
          <div className="relative h-full">
            {/* A hidden layer dims its spans only; its moments stay readable and still seek. The eye says it is off */}
            <span className={cn('absolute inset-0 transition-opacity duration-150', hidden && 'opacity-35')}>
              {spans.map((span, index) => <SpanBar key={index} span={span} duration={duration} />)}
            </span>
            {markerGroups.map((group, index) => group.length === 1 && group[0].param
              ? <MovableMarker key={group[0].label} marker={group[0]} duration={duration} showLabel={labelShown[index]} />
              : <MarkerButton key={group[0].label} group={group} duration={duration} showLabel={labelShown[index]} />)}
          </div>
        </div>
      </div>

      {/* The parameters take the whole row, starting under the track's name, so every cell holds its name and
          value on one line. It sits above the playhead, which passes behind it instead of through its text */}
      {expanded && (
        <div id={panelId} role="group" aria-label={`${track.label} parameters`} className="relative z-[11] bg-bg-panel">
          <div className="bg-neon-cyan/[0.03] pb-2 pl-[52px] pr-3 pt-1">
            {track.editsText && <TitleTextEditor />}
            <div className="intro-param-grid grid gap-1">
              {track.params.map(key => <IntroParamControl key={key} paramKey={key} />)}
              {changedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    expandRef.current?.focus()
                    if (changed.length > 0) resetParams(changed)
                    if (textChanges > 0) resetTitle()
                  }}
                  className="flex h-7 items-center gap-1.5 justify-self-start px-3 text-text-light/70 transition-colors duration-150
                    hover:text-neon-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset {track.label.toLowerCase()}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// A phone's label column fits every name on one line; a name that also carries its changed count wraps onto
// a second line there instead of being cut short
const trackName = 'truncate max-sm:whitespace-normal max-sm:line-clamp-2 max-sm:text-[11px] max-sm:leading-[1.15]'
// The layer switch, or the room it would take: a phone narrows it to give the name its line
const eyeColumn = 'w-7 shrink-0 max-sm:w-6'

function ChangedBadge ({ count }: { count: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-neon-cyan" title={`${count} changed from the defaults`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-neon-cyan" />
      {count}
      <span className="sr-only"> changed</span>
    </span>
  )
}

const headerAction = cn(
  'flex items-center gap-1 text-text-light/60 transition-colors duration-150 hover:text-neon-cyan',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan'
)

// Count of the values off their built-in defaults over all tracks, with copy for pasting into the defaults
// and a reset of everything, which takes a second press
function ChangedSummary ({ titleChanges, hiddenCount }: { titleChanges: Partial<TitleText>, hiddenCount: number }) {
  const params = useIntroDebugStore(state => state.params)
  const showAllLayers = useIntroDebugStore(state => state.showAllLayers)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const resetTitle = useIntroDebugStore(state => state.resetTitle)
  // What the last copy did, said to screen readers and shown on the button for a moment
  const [copyStatus, setCopyStatus] = useState<'' | 'copied' | 'blocked'>('')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const statusTimer = useRef(0)
  const statusFrame = useRef(0)
  const actionsRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  // Escape takes the focus from the confirmation back to the reset button, once it is drawn again
  const refocusReset = useRef(false)
  useEffect(() => () => {
    window.clearTimeout(statusTimer.current)
    window.cancelAnimationFrame(statusFrame.current)
  }, [])
  useLayoutEffect(() => {
    if (confirmingReset || !refocusReset.current) return
    refocusReset.current = false
    resetRef.current?.focus()
  }, [confirmingReset])
  const changedKeys = (Object.keys(params) as IntroParamKey[]).filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key])
  const titleCount = Object.keys(titleChanges).length
  const count = changedKeys.length + titleCount
  const none = count === 0
  // A reset from elsewhere drops a pending confirmation, so it never comes back with the next change
  if (none && confirmingReset) setConfirmingReset(false)

  // With nothing changed, copy and reset keep their place but do not show. One that held the focus hands it
  // to the ruler before it hides, whatever brought the count to zero
  useLayoutEffect(() => {
    if (none && actionsRef.current?.contains(document.activeElement)) focusRuler()
  }, [none])

  const resetAll = () => {
    focusRuler()
    setConfirmingReset(false)
    resetParams()
    resetTitle()
  }

  const copyChanged = async () => {
    if (none) return
    const changed: Record<string, unknown> = Object.fromEntries(changedKeys.map(key => [key, params[key]]))
    if (titleCount > 0) changed.title = titleChanges
    let status: 'copied' | 'blocked' = 'copied'
    try {
      await navigator.clipboard.writeText(JSON.stringify(changed, null, 2))
    } catch {
      // Clipboard blocked; the changed values stay marked on their tracks
      status = 'blocked'
    }
    // Cleared first and set on the next frame, so a second copy in a row is announced again
    window.clearTimeout(statusTimer.current)
    window.cancelAnimationFrame(statusFrame.current)
    flushSync(() => setCopyStatus(''))
    statusFrame.current = window.requestAnimationFrame(() => {
      setCopyStatus(status)
      statusTimer.current = window.setTimeout(() => setCopyStatus(''), 1500)
    })
  }

  const statusText = copyStatus === 'copied' ? 'Changed values copied as JSON' : copyStatus === 'blocked' ? 'Copy blocked by the browser' : ''

  return (
    <div
      className="flex min-w-0 items-center border-r border-neon-cyan/10 pl-2 pr-1 sm:pl-[52px]"
      // A pointer leaving drops a confirmation it started; one reached from the keyboard stays until Escape or blur.
      // A confirmation that held the focus hands it back to the reset button rather than to the page
      onMouseLeave={() => {
        const confirm = confirmRef.current
        if (!confirm || confirm.matches(':focus-visible')) return
        if (document.activeElement === confirm) refocusReset.current = true
        setConfirmingReset(false)
      }}
    >
      {/* Empty while nothing differs from the defaults, the way copy and reset hide then */}
      <span className="mr-auto min-w-0 truncate tabular-nums text-neon-cyan max-sm:text-[11px]" title={none ? undefined : `${count} off the defaults`}>
        {none ? '' : `${count} off default`}
      </span>
      <span role="status" className="sr-only">{statusText}</span>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => {
            focusRuler()
            showAllLayers()
          }}
          aria-label={`Show the ${hiddenCount} hidden ${hiddenCount === 1 ? 'layer' : 'layers'}`}
          title={`${hiddenCount} hidden · click to show every layer`}
          className={cn(headerAction, 'h-6 shrink-0 px-1 tabular-nums text-neon-cyan')}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hiddenCount}
        </button>
      )}
      {/* With nothing changed there is nothing to copy or reset: the two keep their place but do not show */}
      <div ref={actionsRef} className={cn('flex shrink-0 items-center', none && 'invisible')}>
        <button
          type="button"
          aria-disabled={none}
          onClick={copyChanged}
          aria-label="Copy the changed values as JSON"
          title={statusText || 'Copy the changed values as JSON'}
          className={cn(
            headerAction,
            'h-6 w-6 shrink-0 justify-center',
            copyStatus === 'copied' && 'text-neon-cyan',
            copyStatus === 'blocked' && 'text-neon-yellow hover:text-neon-yellow'
          )}
        >
          {copyStatus === 'copied'
            ? <Check className="h-3.5 w-3.5" />
            : copyStatus === 'blocked' ? <TriangleAlert className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {confirmingReset
          ? (
            <button
              ref={confirmRef}
              type="button"
              autoFocus
              data-escape-cancels=""
              aria-label="Reset everything to defaults now"
              // A press keeps the focus here, so the blur below never cancels the press that confirms
              onMouseDown={(event) => event.preventDefault()}
              onClick={resetAll}
              onBlur={() => setConfirmingReset(false)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                // Handled here, so the page does not take Escape as the key that opens Settings
                event.preventDefault()
                event.stopPropagation()
                refocusReset.current = true
                setConfirmingReset(false)
              }}
              className="flex h-6 shrink-0 items-center gap-1 px-1 text-neon-magenta transition-colors duration-150
                hover:text-text-light focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-magenta"
            >
              <Check className="h-3.5 w-3.5" />
              RESET
            </button>
          )
          : (
            <button
              ref={resetRef}
              type="button"
              aria-disabled={none}
              onClick={() => {
                if (!none) setConfirmingReset(true)
              }}
              aria-label="Reset every parameter and the title to defaults"
              title="Reset every parameter and the title to defaults"
              className={cn(headerAction, 'h-6 w-6 shrink-0 justify-center')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
      </div>
    </div>
  )
}

// Diamonds closer than their 24 px target overlap
const MARKER_TARGET = 24

// Width of the label column: a phone gives the lanes most of the row, from sm up the names get their room
const WIDE_QUERY = '(min-width: 640px)'
const LABEL_WIDTH_PHONE = 176
const LABEL_WIDTH = 248

// The label column's width, which follows the sm breakpoint; set on the list as --label-w
function useLabelWidth () {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY)
    const handleChange = () => setWide(query.matches)
    handleChange()
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])
  return wide ? LABEL_WIDTH : LABEL_WIDTH_PHONE
}

// The width of the lanes, in pixels, measured on the track list: the list's width less the label column and
// the lanes' padding. It follows the dock, which Settings narrows, not only the window. Dragging the dock's
// height resizes the list too, and leaves the lanes alone
function useLaneWidth (labelWidth: number) {
  const listRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let listWidth = -1
    const measure = () => {
      if (list.clientWidth === listWidth) return
      listWidth = list.clientWidth
      setWidth(Math.max(Math.round(listWidth - labelWidth - LANE_PAD * 2), 1))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [labelWidth])
  return [listRef, width] as const
}

// Every element of the opening on one timeline: its layer switch, when it is active, its moments,
// its live value, and its parameters on demand
function IntroTrackList ({ duration }: { duration: number }) {
  const hidden = useIntroDebugStore(state => state.hidden)
  const title = useIntroDebugStore(state => state.title)
  const titleChanges = useMemo(() => getTitleChanges(title), [title])
  const textChanges = Object.keys(titleChanges).length
  const hiddenCount = Object.values(hidden).filter(Boolean).length
  const scrub = useScrub(duration)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  // Moments of one track closer than a diamond's target share one diamond, at any lane width. Rounded to a
  // hundredth of a second, so most changes of the width leave the rows alone
  const labelWidth = useLabelWidth()
  const [listRef, laneWidth] = useLaneWidth(labelWidth)
  const markerGap = laneWidth > 1 ? Math.round(MARKER_TARGET * duration / laneWidth * 100) / 100 : 0
  // Rounded up in steps of 1/2000 s, so a label is judged a little wide rather than too narrow
  const secondsPerPx = laneWidth > 1 ? Math.ceil(duration / laneWidth * 2000) / 2000 : 0

  const toggleExpanded = useMemo(() => (key: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // The scroll padding keeps a row that the focus reaches out from under the sticky seek bar
  return (
    <div
      ref={listRef}
      data-intro-tracks=""
      // As tall as its tracks, and shrinking to scroll when the dock's height runs out (intro_debugger.tsx)
      className="min-h-0 flex-initial scroll-pt-10 overflow-y-auto overscroll-contain"
      style={{ '--label-w': `${labelWidth}px` } as CSSProperties}
    >
      <div className="relative">
        <div className="sticky top-0 z-20 grid grid-cols-[var(--label-w)_1fr] border-b border-neon-cyan/20 bg-bg-panel">
          <ChangedSummary titleChanges={titleChanges} hiddenCount={hiddenCount} />
          <Ruler duration={duration} scrub={scrub} />
        </div>
        {INTRO_TRACKS.map(track => (
          <TrackRow
            key={track.key}
            track={track}
            duration={duration}
            hidden={track.layer ? hidden[track.layer] : false}
            expanded={expanded.has(track.key)}
            textChanges={track.editsText ? textChanges : 0}
            markerGap={markerGap}
            secondsPerPx={secondsPerPx}
            scrub={scrub}
            onToggleExpanded={toggleExpanded}
          />
        ))}
        <HoverLine duration={duration} />
        <Playhead duration={duration} />
      </div>
    </div>
  )
}

export default memo(IntroTrackList)
