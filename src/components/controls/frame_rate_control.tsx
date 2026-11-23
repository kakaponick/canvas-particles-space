import { useParticleStore } from '../../store/particle_store'
import { SettingsRow, SettingsSwitch } from './settings_section'
import SliderControl from './slider_control'

const MIN_FRAME_RATE = 30
const MAX_FRAME_RATE = 240
// The slider's last stop, one past the highest limit, is no limit at all (a cap of 0): the scene
// follows the display's refresh rate
const AUTO_POSITION = MAX_FRAME_RATE + 1

const toPosition = (cap: number) => cap <= 0 ? AUTO_POSITION : Math.min(Math.max(cap, MIN_FRAME_RATE), MAX_FRAME_RATE)
const formatPosition = (position: number) => position >= AUTO_POSITION ? 'AUTO' : `${position} FPS`

// Kept apart from the measured FPS readout, so the readout's updates do not re-render the slider
function FrameRateSlider () {
  const frameRateCap = useParticleStore(state => state.frameRateCap)
  const setFrameRateCap = useParticleStore(state => state.setFrameRateCap)

  return (
    <SliderControl
      id="frame-rate-cap"
      label="Limit"
      value={toPosition(frameRateCap)}
      min={MIN_FRAME_RATE}
      max={AUTO_POSITION}
      step={1}
      formatValue={formatPosition}
      onChange={(position) => setFrameRateCap(position >= AUTO_POSITION ? 0 : position)}
      variant="inline"
      resetValue={AUTO_POSITION}
    />
  )
}

function FrameRateControl () {
  const measuredFps = useParticleStore(state => state.measuredFps)
  const adaptiveParticles = useParticleStore(state => state.adaptiveParticles)
  const activeParticles = useParticleStore(state => state.activeParticles)
  const numParticles = useParticleStore(state => state.numParticles)
  const toggleAdaptiveParticles = useParticleStore(state => state.toggleAdaptiveParticles)
  const trimmed = adaptiveParticles && activeParticles > 0 && activeParticles < numParticles

  return (
    <>
      <SettingsRow
        label="Frame Rate"
        help={`Limits how many frames per second the scene renders, from ${MIN_FRAME_RATE} to ${MAX_FRAME_RATE}. The far right end of the slider is AUTO: no limit, the scene renders at your display's refresh rate. A lower limit saves power and GPU time; motion speed stays the same at any frame rate. A limit above the display's refresh rate has no effect. A double-click returns the slider to AUTO.`}
      >
        <span className="font-mono text-xs text-text-light/70 tabular-nums">
          {measuredFps > 0 ? `${measuredFps} FPS` : '—'}
        </span>
      </SettingsRow>
      <FrameRateSlider />
      <SettingsRow
        label="Particle Budget"
        help="AUTO lowers the particle count when the simulation takes more than 40% of each frame, so motion stays smooth on a slower processor or a high refresh rate display. It raises the count back to your setting once there is room again. OFF always simulates the full count."
      >
        <span className="font-mono text-xs text-text-light/70 tabular-nums">
          {trimmed ? `${activeParticles.toLocaleString('en-US')} of ${numParticles.toLocaleString('en-US')}` : 'full'}
        </span>
        <SettingsSwitch on={adaptiveParticles} onToggle={toggleAdaptiveParticles} label="Adaptive particle budget" onText="AUTO" />
      </SettingsRow>
    </>
  )
}

export default FrameRateControl
