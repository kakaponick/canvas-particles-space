import { Play, Pause } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useParticleStore } from '../store/particle_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { cn, hexToRgb, rgbToHex } from '../lib/utils'
import ColorPalette from './controls/color_palette'
import SettingSlider from './controls/setting_slider'
import ColorPickerInput from './controls/color_picker_input'
import SettingsSection, { SettingsRow, SettingsSwitch } from './controls/settings_section'
import ToggleButton from './controls/toggle_button'
import FrameRateControl from './controls/frame_rate_control'
import PresetControl from './controls/preset_control'

function BackgroundColorControl () {
  const backgroundR = useParticleStore(state => state.backgroundR)
  const backgroundG = useParticleStore(state => state.backgroundG)
  const backgroundB = useParticleStore(state => state.backgroundB)
  const setBackgroundColor = useParticleStore(state => state.setBackgroundColor)

  return (
    <ColorPickerInput
      label="Background"
      value={rgbToHex(backgroundR, backgroundG, backgroundB)}
      onChange={(hex) => {
        const rgb = hexToRgb(hex)
        if (rgb) {
          setBackgroundColor(rgb.r, rgb.g, rgb.b)
        }
      }}
    />
  )
}

function SettingsSections () {
  const ringEnabled = useParticleStore(state => state.ringEnabled)
  const ringFeedEnabled = useParticleStore(state => state.ringFeedEnabled)
  const lensingEnabled = useParticleStore(state => state.lensingEnabled)
  const toggleRing = useParticleStore(state => state.toggleRing)
  const toggleRingFeed = useParticleStore(state => state.toggleRingFeed)
  const toggleLensing = useParticleStore(state => state.toggleLensing)
  const blackHoleFollowing = useParticleStore(state => state.blackHoleFollowing)
  const toggleBlackHoleFollowing = useParticleStore(state => state.toggleBlackHoleFollowing)
  const isPaused = useParticleStore(state => state.isPaused)
  const togglePause = useParticleStore(state => state.togglePause)
  const introDebugOpen = useIntroDebugStore(state => state.open)
  const setIntroDebugOpen = useIntroDebugStore(state => state.setOpen)

  return (
    <div>
      <SettingsSection id="presets" title="Presets" help="Save every simulation setting on this panel under a name and switch between setups with one click. Presets stay in this browser. Pause, the frame rate limit and the particle budget are not part of a preset." defaultOpen>
        <PresetControl />
      </SettingsSection>

      <SettingsSection id="playback" title="Playback">
        <SettingsRow
          label="Animation Control"
          help="Manually control animation playback. Animation automatically pauses when the browser tab becomes inactive to save resources and resumes when you return to the tab."
        >
          <ToggleButton active={!isPaused} onClick={togglePause} className="h-6 w-20 gap-1.5 px-0 font-mono text-xs">
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'PLAY' : 'PAUSE'}
          </ToggleButton>
        </SettingsRow>
        <FrameRateControl />
        <SettingsRow
          label="Intro Debugger"
          help="Replays the opening seconds with a timeline, playback speed down to a full stop, and switches for each effect. Shortcut: Shift+D, or open the page with ?debug in the address."
        >
          <SettingsSwitch on={introDebugOpen} onToggle={() => setIntroDebugOpen(!introDebugOpen)} label="Intro debugger" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection id="particles" title="Particles">
        <SettingSlider
          id="particles"
          field="numParticles"
          setter="setNumParticles"
          variant="inline"
        />
        <SettingSlider
          id="far-z"
          field="farZ"
          setter="setFarZ"
          variant="inline"
        />
        <SettingSlider
          id="base-speed"
          field="baseSpeed"
          formatValue={(val) => val.toFixed(1)}
          setter="setBaseSpeed"
          variant="inline"
        />
        <SettingSlider
          id="scroll-speed-step"
          field="scrollSpeedStep"
          formatValue={(val) => val.toFixed(1)}
          setter="setScrollSpeedStep"
          variant="inline"
        />
        <SettingSlider
          id="speed-variance"
          field="speedVariance"
          formatValue={(val) => val.toFixed(2)}
          setter="setSpeedVariance"
          variant="inline"
        />
        <SettingSlider
          id="trail-intensity"
          field="trailIntensity"
          formatValue={(val) => val.toFixed(2)}
          setter="setTrailIntensity"
          variant="inline"
        />
        <SettingSlider
          id="particle-size"
          field="particleSize"
          formatValue={(val) => `${val.toFixed(1)} px`}
          setter="setParticleSize"
          variant="inline"
        />
        <SettingSlider
          id="spawn-radius"
          field="spawnRadius"
          formatValue={(val) => String(val)}
          setter="setSpawnRadius"
          variant="inline"
        />
      </SettingsSection>

      <SettingsSection id="lighting" title="Particle Lighting">
        <SettingSlider
          id="base-brightness"
          field="baseBrightness"
          formatValue={(val) => val.toFixed(1)}
          setter="setBaseBrightness"
          variant="inline"
        />
        <SettingSlider
          id="speed-glow"
          field="speedGlow"
          formatValue={(val) => val.toFixed(2)}
          setter="setSpeedGlow"
          variant="inline"
        />
        <SettingSlider
          id="depth-fade"
          field="depthFade"
          formatValue={(val) => val.toFixed(2)}
          setter="setDepthFade"
          variant="inline"
        />
        <SettingSlider
          id="min-opacity"
          field="minOpacity"
          formatValue={(val) => val.toFixed(2)}
          setter="setMinOpacity"
          variant="inline"
        />
        <SettingSlider
          id="max-opacity"
          field="maxOpacity"
          formatValue={(val) => val.toFixed(2)}
          setter="setMaxOpacity"
          variant="inline"
        />
        <SettingSlider
          id="pulse-intensity"
          field="pulseIntensity"
          formatValue={(val) => val.toFixed(2)}
          setter="setPulseIntensity"
          variant="inline"
        />
        <SettingSlider
          id="pulse-speed"
          field="pulseSpeedMultiplier"
          formatValue={(val) => val.toFixed(1)}
          setter="setPulseSpeedMultiplier"
          variant="inline"
        />
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SettingSlider
          id="stars-brightness"
          field="starsBrightness"
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setStarsBrightness"
          variant="inline"
        />
        <SettingSlider
          id="star-density"
          field="starDensity"
          formatValue={(val) => val.toFixed(2)}
          setter="setStarDensity"
          variant="inline"
        />
        <SettingSlider
          id="star-cell"
          field="starCell"
          formatValue={(val) => `${val} px`}
          setter="setStarCell"
          variant="inline"
        />
      </SettingsSection>

      <SettingsSection id="black-hole" title="Black Hole Physics" defaultOpen>
        <SettingSlider
          id="black-hole-size"
          field="blackHoleSize"
          formatValue={(val) => `${val.toFixed(1)}%`}
          setter="setBlackHoleSize"
          variant="inline"
        />
        <SettingSlider
          id="event-horizon"
          field="eventHorizon"
          formatValue={(val) => `${val.toFixed(1)}%`}
          setter="setEventHorizon"
          variant="inline"
        />
        <SettingSlider
          id="gravity-reach"
          field="gravityReach"
          formatValue={(val) => `${val.toFixed(1)}×`}
          setter="setGravityReach"
          variant="inline"
        />
        <SettingSlider
          id="black-hole-depth"
          field="blackHoleDepth"
          formatValue={(val) => `${val}%`}
          setter="setBlackHoleDepth"
          variant="inline"
        />
        <SettingSlider
          id="gravity-depth"
          field="gravityDepth"
          formatValue={(val) => `${val}%`}
          setter="setGravityDepth"
          variant="inline"
        />
        <SettingSlider
          id="gravity"
          field="gravityStrength"
          setter="setGravityStrength"
          variant="inline"
        />
        <SettingSlider
          id="orbital-force"
          field="orbitalStrength"
          setter="setOrbitalStrength"
          variant="inline"
        />
        <SettingSlider
          id="follow-frequency"
          field="followFrequency"
          formatValue={(val) => val.toFixed(1)}
          setter="setFollowFrequency"
          variant="inline"
        />
        <SettingsRow
          label="Follow Cursor"
          help="ON: the black hole follows the mouse. OFF: it rests at Position X and Y. A click on the scene switches this too and saves the place the black hole was anchored at. An anchored black hole can be dragged to a new place, and a double-click on the scene returns it to the middle."
        >
          <SettingsSwitch on={blackHoleFollowing} onToggle={toggleBlackHoleFollowing} label="Black hole follows the cursor" />
        </SettingsRow>
        <SettingSlider
          id="black-hole-x"
          field="blackHoleX"
          formatValue={(val) => `${Math.round(val * 100)}%`}
          setter="setBlackHoleX"
          variant="inline"
          resetValue={0.5}
        />
        <SettingSlider
          id="black-hole-y"
          field="blackHoleY"
          formatValue={(val) => `${Math.round(val * 100)}%`}
          setter="setBlackHoleY"
          variant="inline"
          resetValue={0.5}
        />
      </SettingsSection>

      <SettingsSection id="photon-ring" title="Photon Ring" dimmed={!ringEnabled} action={<SettingsSwitch on={ringEnabled} onToggle={toggleRing} label="Photon ring" />}>
        <SettingSlider
          id="ring-brightness"
          field="ringBrightness"
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setRingBrightness"
          variant="inline"
        />
        <SettingSlider
          id="ring-width"
          field="ringWidth"
          formatValue={(val) => val.toFixed(3)}
          setter="setRingWidth"
          variant="inline"
        />
        <SettingSlider
          id="ring-doppler"
          field="ringDoppler"
          formatValue={(val) => val.toFixed(2)}
          setter="setRingDoppler"
          variant="inline"
        />
        <SettingSlider
          id="ring-side"
          field="ringSide"
          formatValue={(val) => `${val.toFixed(2)} rad`}
          setter="setRingSide"
          variant="inline"
        />
        <SettingsRow
          label="Infall Feed"
          help="Particles that fall into or skim past the black hole light the ring where they arrive. OFF leaves the ring burning evenly and stops this calculation."
        >
          <SettingsSwitch on={ringFeedEnabled} onToggle={toggleRingFeed} label="Infall feed" />
        </SettingsRow>
        <div className={cn('space-y-1 transition-opacity duration-150', ringEnabled && !ringFeedEnabled && 'opacity-50')}>
          <SettingSlider
            id="ring-base"
            field="ringBase"
            formatValue={(val) => val.toFixed(2)}
            setter="setRingBase"
            variant="inline"
          />
          <SettingSlider
            id="ring-feed"
            field="ringFeed"
            formatValue={(val) => val.toFixed(2)}
            setter="setRingFeed"
            variant="inline"
          />
          <SettingSlider
            id="ring-afterglow"
            field="ringAfterglow"
            formatValue={(val) => `${val.toFixed(2)} s`}
            setter="setRingAfterglow"
            variant="inline"
          />
          <SettingSlider
            id="ring-flow-speed"
            field="ringFlowSpeed"
            formatValue={(val) => `${val.toFixed(2)} rad/s`}
            setter="setRingFlowSpeed"
            variant="inline"
          />
        </div>
      </SettingsSection>

      <SettingsSection id="lensing" title="Gravitational Lensing WebGL" dimmed={!lensingEnabled} action={<SettingsSwitch on={lensingEnabled} onToggle={toggleLensing} label="Gravitational lensing" />}>
        <SettingSlider
          id="lensing-radius"
          field="lensingRadius"
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setLensingRadius"
          variant="inline"
        />
        <SettingSlider
          id="lensing-reach"
          field="lensingReach"
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingReach"
          variant="inline"
        />
        <SettingSlider
          id="lensing-rotation"
          field="lensingRotation"
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingRotation"
          variant="inline"
        />
        <SettingSlider
          id="lensing-twist-limit"
          field="lensingTwistLimit"
          formatValue={(val) => val.toFixed(1)}
          setter="setLensingTwistLimit"
          variant="inline"
        />
        <SettingSlider
          id="lensing-falloff"
          field="lensingFalloff"
          formatValue={(val) => val.toFixed(1)}
          setter="setLensingFalloff"
          variant="inline"
        />
        <SettingSlider
          id="lensing-pivot"
          field="lensingPivot"
          formatValue={(val) => `${val}%`}
          setter="setLensingPivot"
          variant="inline"
        />
        <SettingSlider
          id="lensing-max-bend"
          field="lensingMaxBend"
          formatValue={(val) => String(val)}
          setter="setLensingMaxBend"
          variant="inline"
        />
        <SettingSlider
          id="lensing-core"
          field="lensingCore"
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingCore"
          variant="inline"
        />
        <SettingSlider
          id="lensing-absorption"
          field="lensingAbsorption"
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingAbsorption"
          variant="inline"
        />
      </SettingsSection>

      <SettingsSection id="colors" title="Colors" help="The colors particles are born with. Click a swatch to change a color, drag its bar to make it more or less common, and use the eye to leave it out without losing it. The strip on top shows the resulting mix. A particle keeps the color it was born with, so a change spreads through the field as particles are recycled.">
        <ColorPalette />
        <BackgroundColorControl />
      </SettingsSection>
    </div>
  )
}

// Every setting of the panel. It is built once with the page, so opening the panel builds nothing
function SettingsBody () {
  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={0}>
      <SettingsSections />
    </TooltipProvider>
  )
}

export default SettingsBody
