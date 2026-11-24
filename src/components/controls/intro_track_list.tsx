import { memo, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, ChevronRight, Copy, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { cn } from '@/lib/utils'
import { useIntroDebugStore, getTitleChanges, type TitleText } from '../../store/intro_debug_store'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, colorToCss, cssToColor, formatParam, type IntroParamKey, type IntroParams } from '../../lib/intro_params'
import { INTRO_TRACKS, getIntroMarkers, getIntroPhase, type IntroMarker, type IntroSpan, type IntroTrack, type IntroTrackReadout } from '../../lib/intro_tracks'
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

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const share = (time: number, duration: number) => Math.min(Math.max(time / duration, 0), 1)
const percent = (time: number, duration: number) => `${share(time, duration) * 100}%`
// Left edge of a time inside the lane column, for lines drawn across every lane
const laneLeft = (time: number, duration: number) =>
  `calc(var(--label-w) + ${LANE_PAD}px + (100% - var(--label-w) - ${LANE_PAD * 2}px) * ${share(time, duration)})`

// The time under a mouse over the timeline, or null; only the hover line and its label read it
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
  return useMemo(() => {
    const timeAt = (event: ReactPointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const width = Math.max(rect.width - LANE_PAD * 2, 1)
      const position = Math.min(Math.max((event.clientX - rect.left - LANE_PAD) / width, 0), 1)
      return Math.round(position * duration * 100) / 100
    }
    const startScrub = (event: ReactPointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      // Only a timeline that was running when it was pressed starts again on release
      resumeOnRelease.current = useIntroDebugStore.getState().playing
      setPlaying(false)
      seek(timeAt(event))
    }
    const isPendingTouch = (event: ReactPointerEvent<HTMLElement>) => pendingTouch.current?.id === event.pointerId
    return {
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
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) setHoverTime(null)
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

// The played part of the seek bar and its handle, which follow the clock
function SeekProgress ({ duration }: { duration: number }) {
  const time = useIntroDebugStore(state => Math.min(state.readout.time, duration))
  const left = percent(time, duration)
  return (
    <>
      <span aria-hidden="true" className="seek-fill absolute left-0 rounded-l-full bg-neon-cyan" style={{ width: left }} />
      <span
        aria-hidden="true"
        className="seek-thumb absolute z-[2] h-3 w-3 -translate-x-1/2 rounded-full bg-neon-cyan ring-2 ring-bg-panel"
        style={{ left }}
      />
    </>
  )
}

// Where a press would seek to, with the moment of the intro it falls in
function SeekHoverLabel ({ duration, params }: { duration: number, params: IntroParams }) {
  const time = useTimelineHover(state => state.time)
  if (time === null) return null
  const phase = getIntroPhase(time, reducedMotion, params)
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[3px] z-[3] -translate-x-1/2 whitespace-nowrap border border-neon-cyan/50 bg-bg-panel px-1.5
        text-[10px] leading-[14px] text-text-light tabular-nums"
      style={{ left: `clamp(56px, ${percent(time, duration)}, calc(100% - 56px))` }}
    >
      {time.toFixed(2)} s{phase && <span className="text-neon-cyan"> · {phase}</span>}
    </span>
  )
}

// The timeline's main seek bar: time labels, the played part, the moments of the intro as gaps, and
// the playhead's handle. It is the keyboard's way to seek too
function Ruler ({ duration, params, scrub }: { duration: number, params: IntroParams, scrub: Scrub }) {
  const seek = useIntroDebugStore(state => state.seek)
  // While playing, the value a screen reader hears moves once a second instead of with every readout
  const playing = useIntroDebugStore(state => state.playing)
  const spoken = useIntroDebugStore(state => {
    const time = Math.min(state.readout.time, duration)
    return state.playing ? Math.floor(time) : Math.round(time * 100) / 100
  })
  const phase = useIntroDebugStore(state => state.readout.phase)
  const ticks = useMemo(() => {
    const list: number[] = []
    for (let t = 0; t <= duration + 1e-6; t += RULER_STEP) list.push(Math.round(t * 10) / 10)
    return list
  }, [duration])
  const moments = useMemo(
    () => getIntroMarkers(reducedMotion, params).filter(moment => moment.time > 0.01 && moment.time < duration - 0.01),
    [params, duration]
  )

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
      <div className="relative h-full">
        {ticks.map(tick => {
          const whole = Number.isInteger(tick)
          return (
            <span key={tick} aria-hidden="true" className="absolute top-[18px] -translate-x-1/2" style={{ left: percent(tick, duration) }}>
              {whole && <span className="absolute bottom-full left-1/2 mb-[3px] -translate-x-1/2 text-[10px] leading-none text-text-light/60 tabular-nums">{tick}s</span>}
              <span className={`block w-px ${whole ? 'h-1.5 bg-text-light/50' : 'h-1 bg-text-light/25'}`} />
            </span>
          )
        })}
        <span aria-hidden="true" className="seek-track absolute inset-x-0 rounded-full bg-neon-cyan/20" />
        <SeekProgress duration={duration} />
        {/* The intro's moments cut the bar into chapters, the way [ and ] step between them */}
        {moments.map(moment => (
          <span
            key={moment.label}
            aria-hidden="true"
            className="seek-cut absolute z-[1] w-[2px] -translate-x-1/2 bg-bg-panel"
            style={{ left: percent(moment.time, duration) }}
          />
        ))}
        <SeekHoverLabel duration={duration} params={params} />
      </div>
    </div>
  )
}

// Vertical line through every lane at the current time
function Playhead ({ duration }: { duration: number }) {
  const time = useIntroDebugStore(state => state.readout.time)
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-neon-cyan/80"
      style={{ left: laneLeft(time, duration) }}
    />
  )
}

// A fainter line where a press would seek to
function HoverLine ({ duration }: { duration: number }) {
  const time = useTimelineHover(state => state.time)
  if (time === null) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-text-light/35"
      style={{ left: laneLeft(time, duration) }}
    />
  )
}

function TrackValue ({ readout, digits }: { readout: IntroTrackReadout, digits: number }) {
  const value = useIntroDebugStore(state => state.readout[readout])
  return <span className="shrink-0 tabular-nums text-text-light/70">{value.toFixed(digits)}</span>
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

function MarkerButton ({ marker, duration }: { marker: IntroMarker, duration: number }) {
  const seek = useIntroDebugStore(state => state.seek)
  const isPhase = useIntroDebugStore(state => state.readout.phase === marker.label)
  const flip = share(marker.time, duration) > FLIP_LABEL_AT
  return (
    <button
      type="button"
      aria-label={`Seek to ${marker.label}, ${marker.time.toFixed(2)} s`}
      title={`${marker.label} · ${marker.time.toFixed(2)} s`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => seek(marker.time)}
      className="group/marker absolute inset-y-0 z-[1] w-4 -translate-x-1/2 focus-visible:outline-none"
      style={{ left: percent(marker.time, duration) }}
    >
      <span
        className={cn(
          'absolute left-1/2 top-[16.5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-neon-cyan transition-colors duration-150',
          'group-hover/marker:bg-neon-cyan group-focus-visible/marker:bg-neon-cyan',
          isPhase ? 'bg-neon-cyan' : 'bg-bg-dark'
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-1 whitespace-nowrap text-[10px] leading-none transition-colors duration-150 max-sm:hidden',
          'group-hover/marker:text-neon-cyan group-focus-visible/marker:text-neon-cyan',
          flip ? 'right-2.5' : 'left-2.5',
          isPhase ? 'text-neon-cyan' : 'text-text-light/60'
        )}
      >
        {marker.label}
      </span>
    </button>
  )
}

const NO_MARKERS: IntroMarker[] = []

interface TrackDerived {
  params: IntroParams
  ringTiming: RingdownTiming
  spans: IntroSpan[]
  markers: IntroMarker[]
  values: number[]
}
const sameSpans = (a: IntroSpan[], b: IntroSpan[]) =>
  a.length === b.length && a.every((span, index) => span.start === b[index].start && span.end === b[index].end && span.holds === b[index].holds)
const sameMarkers = (a: IntroMarker[], b: IntroMarker[]) =>
  a.length === b.length && a.every((marker, index) => marker.time === b[index].time && marker.label === b[index].label)

interface TrackRowProps {
  track: IntroTrack
  duration: number
  hidden: boolean
  expanded: boolean
  // Title fields (text, font, case) changed from the default, for the track that edits them
  textChanges: number
  scrub: Scrub
  onToggleExpanded: (key: string) => void
}

const TrackRow = memo(function TrackRow ({ track, duration, hidden, expanded, textChanges, scrub, onToggleExpanded }: TrackRowProps) {
  const toggleLayer = useIntroDebugStore(state => state.toggleLayer)
  const soloLayer = useIntroDebugStore(state => state.soloLayer)
  const setParam = useIntroDebugStore(state => state.setParam)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const resetTitle = useIntroDebugStore(state => state.resetTitle)
  // A row re-renders only when its own spans, moments or numbers change, not on every step of a slider
  // on another track. They are worked out once per change of the parameters or the ringdown timing, so
  // the readout's frequent store updates reuse them
  const derived = useRef<TrackDerived | null>(null)
  const derive = (state: { params: IntroParams, ringTiming: RingdownTiming }) => {
    const last = derived.current
    if (last && last.params === state.params && last.ringTiming === state.ringTiming) return last
    const next: TrackDerived = {
      params: state.params,
      ringTiming: state.ringTiming,
      spans: track.spans(state.params, reducedMotion, state.ringTiming),
      markers: track.markers?.(state.params, reducedMotion) ?? NO_MARKERS,
      values: track.params.map(key => state.params[key])
    }
    derived.current = next
    return next
  }
  const spans = useIntroDebugStore(state => derive(state).spans, sameSpans)
  const markers = useIntroDebugStore(state => derive(state).markers, sameMarkers)
  const values = useIntroDebugStore(state => derive(state).values, shallow)
  const changed = track.params.filter((key, index) => values[index] !== DEFAULT_INTRO_PARAMS[key])
  const changedCount = changed.length + textChanges
  const panelId = `intro-track-${track.key}`

  return (
    <div className={`border-b border-text-light/[0.07] ${expanded ? 'bg-neon-cyan/[0.03]' : ''}`}>
      <div className="grid grid-cols-[var(--label-w)_1fr] hover:bg-neon-cyan/[0.04]">
        <div className="flex h-8 min-w-0 items-center gap-1 border-r border-neon-cyan/10 pl-1 pr-2">
          {track.layer
            ? (
              <button
                type="button"
                aria-pressed={!hidden}
                aria-label={`${hidden ? 'Show' : 'Hide'} ${track.label}`}
                title={`${hidden ? `Show ${track.label}` : `Hide ${track.label} to see what it adds`} · Alt+click: only this layer`}
                onClick={(event) => event.altKey ? soloLayer(track.layer!) : toggleLayer(track.layer!)}
                className={`flex h-8 w-7 shrink-0 items-center justify-center transition-colors duration-150 hover:text-neon-cyan
                  focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan ${hidden ? 'text-text-light/40' : 'text-neon-cyan/80'}`}
              >
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )
            : <span className="w-6 shrink-0" />}
          {track.params.length > 0
            ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggleExpanded(track.key)}
                className="flex h-8 min-w-0 flex-1 items-center gap-1 text-left text-text-light/85 transition-colors duration-150 hover:text-neon-cyan
                  focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
              >
                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90 text-neon-cyan' : 'text-text-light/50'}`} />
                <span className={`truncate ${hidden ? 'text-text-light/60 line-through' : ''}`}>{track.label}</span>
                {changedCount > 0 && <ChangedBadge count={changedCount} />}
              </button>
            )
            : <span className={`min-w-0 flex-1 truncate pl-4 text-text-light/85 ${hidden ? 'text-text-light/60 line-through' : ''}`}>{track.label}</span>}
          {track.readout && <TrackValue readout={track.readout.key} digits={track.readout.digits} />}
        </div>
        <div className="h-8 cursor-ew-resize touch-pan-y select-none" style={{ paddingInline: LANE_PAD }} {...scrub}>
          <div className={`relative h-full transition-opacity duration-150 ${hidden ? 'opacity-35' : ''}`}>
            {spans.map((span, index) => <SpanBar key={index} span={span} duration={duration} />)}
            {markers.map(marker => <MarkerButton key={marker.label} marker={marker} duration={duration} />)}
          </div>
        </div>
      </div>

      {expanded && (
        <div id={panelId} className="grid grid-cols-[var(--label-w)_1fr] pb-2">
          <div className="flex items-start justify-end pr-2 pt-1.5">
            {changedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  resetParams(changed)
                  if (textChanges > 0) resetTitle()
                }}
                className="flex items-center gap-1 text-text-light/60 transition-colors duration-150 hover:text-neon-cyan
                  focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
              >
                <RotateCcw className="h-3 w-3" />
                reset {track.label.toLowerCase()}
              </button>
            )}
          </div>
          <div className="pt-1" style={{ paddingInline: LANE_PAD }}>
            {track.editsText && <TitleTextEditor />}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1">
              {track.params.map((key, index) => {
                const spec = INTRO_PARAM_SPECS[key]
                const hint = `${spec.description} Default: ${formatParam(DEFAULT_INTRO_PARAMS[key], spec)}.`
                if (spec.color) {
                  return (
                    <div key={key} className="flex min-w-0" title={hint}>
                      <ColorPickerInput
                        label={spec.label}
                        value={colorToCss(values[index])}
                        onChange={(css) => setParam(key, cssToColor(css))}
                      />
                    </div>
                  )
                }
                if (spec.options) {
                  return (
                    <label
                      key={key}
                      title={hint}
                      className="flex h-7 min-w-0 items-center gap-2 border border-neon-cyan/30 bg-black/30 pl-3 pr-1 font-mono text-xs
                        transition-colors duration-150 focus-within:border-neon-cyan hover:border-neon-cyan/60"
                    >
                      <span className="shrink-0 text-neon-cyan">{spec.label}</span>
                      <select
                        id={`intro-param-${key}`}
                        value={Math.round(values[index])}
                        onChange={(event) => setParam(key, Number(event.target.value))}
                        className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-right font-bold text-text-light outline-none"
                      >
                        {spec.options.map((option, index) => (
                          <option key={option} value={index} className="bg-bg-panel text-left font-normal">{option}</option>
                        ))}
                      </select>
                    </label>
                  )
                }
                return (
                  <SliderControl
                    key={key}
                    id={`intro-param-${key}`}
                    label={spec.label}
                    value={values[index]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    formatValue={(value) => formatParam(value, spec)}
                    onChange={(value) => setParam(key, value)}
                    variant="inline"
                    resetValue={DEFAULT_INTRO_PARAMS[key]}
                    description={`${hint.slice(0, -1)}; the mark on the bar shows it, a double-click returns to it.`}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

function ChangedBadge ({ count }: { count: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-neon-cyan" title={`${count} changed from the defaults`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-neon-cyan" />
      {count}
    </span>
  )
}

const headerAction = cn(
  'flex items-center gap-1 text-text-light/60 transition-colors duration-150 hover:text-neon-cyan',
  'disabled:pointer-events-none disabled:text-text-light/30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan'
)

// Changed count over all tracks, with copy for pasting into the defaults and a reset of everything
function ChangedSummary ({ params, titleChanges, hiddenCount }: { params: IntroParams, titleChanges: Partial<TitleText>, hiddenCount: number }) {
  const showAllLayers = useIntroDebugStore(state => state.showAllLayers)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const resetTitle = useIntroDebugStore(state => state.resetTitle)
  const [copied, setCopied] = useState(false)
  const changedKeys = (Object.keys(params) as IntroParamKey[]).filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key])
  const titleCount = Object.keys(titleChanges).length
  const count = changedKeys.length + titleCount
  const none = count === 0

  const copyChanged = async () => {
    const changed: Record<string, unknown> = Object.fromEntries(changedKeys.map(key => [key, params[key]]))
    if (titleCount > 0) changed.title = titleChanges
    try {
      await navigator.clipboard.writeText(JSON.stringify(changed, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; the changed values stay marked on their tracks
    }
  }

  return (
    <div className="flex min-w-0 items-center border-r border-neon-cyan/10 pl-2 pr-1">
      <span className={cn('mr-auto min-w-0 truncate tabular-nums', none ? 'text-text-light/60' : 'text-neon-cyan')}>
        {none ? 'All defaults' : `${count} changed`}
      </span>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={showAllLayers}
          aria-label={`Show the ${hiddenCount} hidden ${hiddenCount === 1 ? 'layer' : 'layers'}`}
          title={`${hiddenCount} hidden · click to show every layer`}
          className={cn(headerAction, 'h-6 shrink-0 px-1 tabular-nums text-neon-cyan')}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {hiddenCount}
        </button>
      )}
      <button
        type="button"
        disabled={none}
        onClick={copyChanged}
        aria-label="Copy the changed values as JSON"
        title={copied ? 'Copied' : 'Copy the changed values as JSON'}
        className={cn(headerAction, 'h-6 w-6 shrink-0 justify-center', copied && 'text-neon-cyan')}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        disabled={none}
        onClick={() => {
          resetParams()
          resetTitle()
        }}
        aria-label="Reset every parameter and the title"
        title="Reset every parameter and the title"
        className={cn(headerAction, 'h-6 w-6 shrink-0 justify-center')}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// Every element of the opening on one timeline: its layer switch, when it is active, its moments,
// its live value, and its parameters on demand
function IntroTrackList ({ duration }: { duration: number }) {
  const params = useIntroDebugStore(state => state.params)
  const hidden = useIntroDebugStore(state => state.hidden)
  const title = useIntroDebugStore(state => state.title)
  const titleChanges = useMemo(() => getTitleChanges(title), [title])
  const textChanges = Object.keys(titleChanges).length
  const hiddenCount = Object.values(hidden).filter(Boolean).length
  const scrub = useScrub(duration)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const toggleExpanded = useMemo(() => (key: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [--label-w:136px] sm:[--label-w:248px]">
      <div className="relative">
        <div className="sticky top-0 z-20 grid grid-cols-[var(--label-w)_1fr] border-b border-neon-cyan/20 bg-bg-panel">
          <ChangedSummary params={params} titleChanges={titleChanges} hiddenCount={hiddenCount} />
          <Ruler duration={duration} params={params} scrub={scrub} />
        </div>
        {INTRO_TRACKS.map(track => (
          <TrackRow
            key={track.key}
            track={track}
            duration={duration}
            hidden={track.layer ? hidden[track.layer] : false}
            expanded={expanded.has(track.key)}
            textChanges={track.editsText ? textChanges : 0}
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

export default IntroTrackList
