import { useParticleStore } from '../../store/particle_store'
import HelpTooltip from './help_tooltip'
import ToggleButton from './toggle_button'

// 0 follows the display refresh rate
const FRAME_RATE_OPTIONS = [
  { value: 0, label: 'AUTO' },
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 90, label: '90' },
  { value: 120, label: '120' },
  { value: 144, label: '144' }
]

function FrameRateControl () {
  const frameRateCap = useParticleStore(state => state.frameRateCap)
  const measuredFps = useParticleStore(state => state.measuredFps)
  const setFrameRateCap = useParticleStore(state => state.setFrameRateCap)
  const adaptiveParticles = useParticleStore(state => state.adaptiveParticles)
  const activeParticles = useParticleStore(state => state.activeParticles)
  const numParticles = useParticleStore(state => state.numParticles)
  const toggleAdaptiveParticles = useParticleStore(state => state.toggleAdaptiveParticles)
  const trimmed = adaptiveParticles && activeParticles > 0 && activeParticles < numParticles

  return (
    <div className="mb-4 pb-4 border-b border-neon-cyan/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-orbitron text-neon-cyan text-base">Frame Rate</h3>
          <HelpTooltip
            content="AUTO renders at your display's refresh rate. A fixed limit saves power and GPU time; motion speed stays the same at any frame rate. A limit above the display's refresh rate has no effect."
          />
        </div>
        <span className="font-mono text-xs text-text-light/70 tabular-nums">
          {measuredFps > 0 ? `${measuredFps} FPS` : '—'}
        </span>
      </div>
      <div className="flex gap-1">
        {FRAME_RATE_OPTIONS.map(option => (
          <ToggleButton
            key={option.value}
            active={frameRateCap === option.value}
            onClick={() => setFrameRateCap(option.value)}
            className="flex-1 px-0 font-mono text-xs"
          >
            {option.label}
          </ToggleButton>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span className="font-orbitron text-neon-cyan text-sm">Particle Budget</span>
          <HelpTooltip
            content="AUTO lowers the particle count when the simulation takes more than 40% of each frame, so motion stays smooth on a slower processor or a high refresh rate display. It raises the count back to your setting once there is room again. OFF always simulates the full count."
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-light/70 tabular-nums">
            {trimmed ? `${activeParticles.toLocaleString('en-US')} of ${numParticles.toLocaleString('en-US')}` : 'full'}
          </span>
          <ToggleButton active={adaptiveParticles} onClick={toggleAdaptiveParticles} className="w-16 font-mono text-xs">
            {adaptiveParticles ? 'AUTO' : 'OFF'}
          </ToggleButton>
        </div>
      </div>
    </div>
  )
}

export default FrameRateControl
