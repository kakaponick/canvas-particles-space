import { memo, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, ChevronRight, Copy, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntroDebugStore, getTitleChanges, type TitleText } from '../../store/intro_debug_store'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, formatParam, type IntroParamKey, type IntroParams } from '../../lib/intro_params'
import { INTRO_TRACKS, type IntroMarker, type IntroSpan, type IntroTrack, type IntroTrackReadout } from '../../lib/intro_tracks'
import SliderControl from './slider_control'
import TitleTextEditor from './title_text_editor'

// Horizontal inset of every lane, so markers at 0 s and at the end are not cut in half.
// Lanes, the ruler and the playhead all map time with the same geometry
const LANE_PAD = 12
const RULER_STEP = 0.5

const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const share = (time: number, duration: number) => Math.min(Math.max(time / duration, 0), 1)
const percent = (time: number, duration: number) => `${share(time, duration) * 100}%`

// Pointer down on a lane or the ruler seeks there; dragging scrubs
function useScrub (duration: number) {
  const seek = useIntroDebugStore(state => state.seek)
  return useMemo(() => {
    const seekFrom = (event: ReactPointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const width = Math.max(rect.width - LANE_PAD * 2, 1)
      const position = Math.min(Math.max((event.clientX - rect.left - LANE_PAD) / width, 0), 1)
      seek(Math.round(position * duration * 100) / 100)
    }
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        seekFrom(event)
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFrom(event)
      }
    }
  }, [duration, seek])
}

type Scrub = ReturnType<typeof useScrub>

function Ruler ({ duration, scrub }: { duration: number, scrub: Scrub }) {
  const time = useIntroDebugStore(state => state.readout.time)
  const phase = useIntroDebugStore(state => state.readout.phase)
  const ticks = useMemo(() => {
    const list: number[] = []
    for (let t = 0; t <= duration + 1e-6; t += RULER_STEP) list.push(Math.round(t * 10) / 10)
    return list
  }, [duration])

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Intro time"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={Math.round(time * 100) / 100}
      aria-valuetext={`${time.toFixed(2)} seconds, ${phase || 'start'}`}
      className="relative h-6 cursor-ew-resize touch-none select-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
      style={{ paddingInline: LANE_PAD }}
      {...scrub}
    >
      <div className="relative h-full">
        {ticks.map(tick => {
          const whole = Number.isInteger(tick)
          return (
            <span key={tick} aria-hidden="true" className="absolute bottom-0 -translate-x-1/2" style={{ left: percent(tick, duration) }}>
              {whole && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] leading-none text-text-light/60 tabular-nums">{tick}s</span>}
              <span className={`block w-px ${whole ? 'h-1.5 bg-text-light/50' : 'h-1 bg-text-light/25'}`} />
            </span>
          )
        })}
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-neon-cyan"
          style={{ left: percent(time, duration) }}
        />
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
      style={{ left: `calc(var(--label-w) + ${LANE_PAD}px + (100% - var(--label-w) - ${LANE_PAD * 2}px) * ${share(time, duration)})` }}
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
          'pointer-events-none absolute top-1 whitespace-nowrap text-[10px] leading-none transition-colors duration-150',
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

interface TrackRowProps {
  track: IntroTrack
  duration: number
  params: IntroParams
  hidden: boolean
  expanded: boolean
  // Title fields (text, font, case) changed from the default, for the track that edits them
  textChanges: number
  scrub: Scrub
  onToggleExpanded: (key: string) => void
}

const TrackRow = memo(function TrackRow ({ track, duration, params, hidden, expanded, textChanges, scrub, onToggleExpanded }: TrackRowProps) {
  const toggleLayer = useIntroDebugStore(state => state.toggleLayer)
  const setParam = useIntroDebugStore(state => state.setParam)
  const resetParams = useIntroDebugStore(state => state.resetParams)
  const resetTitle = useIntroDebugStore(state => state.resetTitle)
  const spans = track.spans(params, reducedMotion)
  const markers = track.markers?.(params, reducedMotion) ?? []
  const changed = track.params.filter(key => params[key] !== DEFAULT_INTRO_PARAMS[key])
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
                title={hidden ? `Show ${track.label}` : `Hide ${track.label} to see what it adds`}
                onClick={() => toggleLayer(track.layer!)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-150 hover:text-neon-cyan
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
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-text-light/85 transition-colors duration-150 hover:text-neon-cyan
                  focus-visible:outline focus-visible:outline-1 focus-visible:outline-neon-cyan"
              >
                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90 text-neon-cyan' : 'text-text-light/50'}`} />
                <span className={`truncate ${hidden ? 'text-text-light/45 line-through' : ''}`}>{track.label}</span>
                {changedCount > 0 && <ChangedBadge count={changedCount} />}
              </button>
            )
            : <span className={`min-w-0 flex-1 truncate pl-4 text-text-light/85 ${hidden ? 'text-text-light/45 line-through' : ''}`}>{track.label}</span>}
          {track.readout && <TrackValue readout={track.readout.key} digits={track.readout.digits} />}
        </div>
        <div className="h-8 cursor-ew-resize touch-none select-none" style={{ paddingInline: LANE_PAD }} {...scrub}>
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
              {track.params.map(key => {
                const spec = INTRO_PARAM_SPECS[key]
                return (
                  <SliderControl
                    key={key}
                    id={`intro-param-${key}`}
                    label={spec.label}
                    value={params[key]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    formatValue={(value) => formatParam(value, spec)}
                    onChange={(value) => setParam(key, value)}
                    variant="inline"
                    description={`${spec.description} Default: ${formatParam(DEFAULT_INTRO_PARAMS[key], spec)}.`}
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
function ChangedSummary ({ params, titleChanges }: { params: IntroParams, titleChanges: Partial<TitleText> }) {
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
    <div className="flex min-w-0 items-center gap-3 border-r border-neon-cyan/10 px-2">
      <span className={cn('mr-auto truncate tabular-nums', none ? 'text-text-light/60' : 'text-neon-cyan')}>
        {none ? 'All defaults' : `${count} changed`}
      </span>
      <button type="button" disabled={none} onClick={copyChanged} title="Copy the changed values as JSON" className={headerAction}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? 'copied' : 'copy'}
      </button>
      <button type="button" disabled={none} onClick={() => {
        resetParams()
        resetTitle()
      }} title="Reset every parameter and the title" className={headerAction}>
        <RotateCcw className="h-3 w-3" />
        reset
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
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [--label-w:168px] sm:[--label-w:248px]">
      <div className="relative">
        <div className="sticky top-0 z-20 grid grid-cols-[var(--label-w)_1fr] border-b border-neon-cyan/20 bg-[#0b0b11]">
          <ChangedSummary params={params} titleChanges={titleChanges} />
          <Ruler duration={duration} scrub={scrub} />
        </div>
        {INTRO_TRACKS.map(track => (
          <TrackRow
            key={track.key}
            track={track}
            duration={duration}
            params={params}
            hidden={track.layer ? hidden[track.layer] : false}
            expanded={expanded.has(track.key)}
            textChanges={track.editsText ? textChanges : 0}
            scrub={scrub}
            onToggleExpanded={toggleExpanded}
          />
        ))}
        <Playhead duration={duration} />
      </div>
    </div>
  )
}

export default IntroTrackList
