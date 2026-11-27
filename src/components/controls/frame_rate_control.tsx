import { cn } from '@/lib/utils'
import { FRAME_RATE_CAP_MAX, FRAME_RATE_CAP_MIN } from '@/lib/particle_simulation'
import { useParticleStore } from '../../store/particle_store'
import { SettingsRow, SettingsSwitch } from './settings_section'
import SliderControl from './slider_control'

const MIN_FRAME_RATE = FRAME_RATE_CAP_MIN
const MAX_FRAME_RATE = FRAME_RATE_CAP_MAX
// The track holds the range as the square of the way along it (SliderControl's curve), so the rates displays
// run at, 30 to 240, keep most of it
const TRACK_CURVE = 2
// The slider's last stop, one past the highest limit, is no limit at all (a cap of 0): the scene
// follows the display's refresh rate
const AUTO_POSITION = MAX_FRAME_RATE + 1

const toPosition = (cap: number) => cap <= 0 ? AUTO_POSITION : Math.min(Math.max(cap, MIN_FRAME_RATE), MAX_FRAME_RATE)
const formatPosition = (position: number) => position >= AUTO_POSITION ? 'AUTO' : `${position} FPS`

// The frame rate the scene reaches, in the Playback header so it shows while the section is closed too,
// and in the scene toolbar while FPS Counter is on. Kept in a leaf of its own, so its updates every half
// second re-render nothing else
export function MeasuredFps ({ className = 'pr-3' }: { className?: string }) {
  const measuredFps = useParticleStore(state => state.measuredFps)
  return (
    <span className={cn('font-mono text-xs tabular-nums text-text-light/70', className)} title="Frames per second the scene reaches now">
      {measuredFps > 0 ? `${measuredFps} FPS` : '—'}
    </span>
  )
}

function FrameRateSlider () {
  const frameRateCap = useParticleStore(state => state.frameRateCap)
  const setFrameRateCap = useParticleStore(state => state.setFrameRateCap)

  return (
    <SliderControl
      id="frame-rate-cap"
      label="FPS Limit"
      value={toPosition(frameRateCap)}
      min={MIN_FRAME_RATE}
      max={AUTO_POSITION}
      step={1}
      curve={TRACK_CURVE}
      formatValue={formatPosition}
      onChange={(position) => setFrameRateCap(position >= AUTO_POSITION ? 0 : position)}
      resetValue={AUTO_POSITION}
      description="AUTO = display rate; lower saves power"
    />
  )
}

function FpsCounterRow () {
  const on = useParticleStore(state => state.fpsCounter)
  const toggle = useParticleStore(state => state.toggleFpsCounter)

  return (
    <SettingsRow label="FPS Counter" help="Shows the frame rate at the top right">
      {(describedBy) => <SettingsSwitch on={on} onToggle={toggle} label="FPS counter" describedBy={describedBy} />}
    </SettingsRow>
  )
}

function FrameRateControl () {
  return (
    <>
      <FrameRateSlider />
      <FpsCounterRow />
    </>
  )
}

export default FrameRateControl
