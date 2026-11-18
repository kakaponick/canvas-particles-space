import { memo, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useControlPanelStore } from '../hooks/use_control_panel_store'
import { useParticleStore } from '../store/particle_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { cn, hexToRgb, rgbToHex } from '../lib/utils'
import { BASE_SPEED_MAX, BASE_SPEED_MIN, BASE_SPEED_STEP } from '../lib/base_speed'
import ColorPalette from './controls/color_palette'
import SliderControl from './controls/slider_control'
import ColorPickerInput from './controls/color_picker_input'
import SettingsSection, { SettingsRow, SettingsSwitch } from './controls/settings_section'
import ToggleButton from './controls/toggle_button'
import FrameRateControl from './controls/frame_rate_control'
import PresetControl from './controls/preset_control'

type ControlPanelSettings = ReturnType<typeof useControlPanelStore>

const SettingsSections = memo(function SettingsSections ({ settings }: { settings: ControlPanelSettings }) {
  const {
    numParticles,
    baseSpeed,
    gravityStrength,
    orbitalStrength,
    blackHoleSize,
    eventHorizon,
    gravityReach,
    ringEnabled,
    ringFeedEnabled,
    ringBrightness,
    ringWidth,
    ringDoppler,
    ringSide,
    ringBase,
    ringFeed,
    ringAfterglow,
    ringFlowSpeed,
    followFrequency,
    starsBrightness,
    starDensity,
    starCell,
    pulseIntensity,
    backgroundR,
    backgroundG,
    backgroundB,
    lensingRadius,
    lensingEnabled,
    farZ,
    baseBrightness,
    depthFade,
    minOpacity,
    maxOpacity,
    pulseSpeedMultiplier,
    trailIntensity,
    speedVariance,
    setNumParticles,
    setBaseSpeed,
    setGravityStrength,
    setOrbitalStrength,
    setBlackHoleSize,
    setEventHorizon,
    setGravityReach,
    toggleRing,
    toggleRingFeed,
    setRingBrightness,
    setRingWidth,
    setRingDoppler,
    setRingSide,
    setRingBase,
    setRingFeed,
    setRingAfterglow,
    setRingFlowSpeed,
    setFollowFrequency,
    setStarsBrightness,
    setStarDensity,
    setStarCell,
    setPulseIntensity,
    setBackgroundColor,
    setLensingRadius,
    toggleLensing,
    setFarZ,
    setBaseBrightness,
    setDepthFade,
    setMinOpacity,
    setMaxOpacity,
    setPulseSpeedMultiplier,
    setTrailIntensity,
    setSpeedVariance,
    lensingRotation,
    lensingFalloff,
    lensingAbsorption,
    setLensingRotation,
    setLensingFalloff,
    setLensingAbsorption
  } = settings

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
        <SliderControl
          id="particles"
          label="Particles"
          value={numParticles}
          min={1000}
          max={50000}
          step={1000}
          onChange={setNumParticles}
          variant="inline"
          description="Total number of particles rendered in the scene. Higher values create denser visuals but may impact performance."
        />
        <SliderControl
          id="far-z"
          label="Particle Render Depth"
          value={farZ}
          min={1000}
          max={20000}
          step={1000}
          onChange={setFarZ}
          variant="inline"
          description="Maximum depth distance for particle field. Controls how far particles travel before recycling. Larger values create a deeper sense of space."
        />
        <SliderControl
          id="base-speed"
          label="Base Speed"
          value={baseSpeed}
          min={BASE_SPEED_MIN}
          max={BASE_SPEED_MAX}
          step={BASE_SPEED_STEP}
          formatValue={(val) => val.toFixed(1)}
          onChange={setBaseSpeed}
          variant="inline"
          description="Speed of the flight through space. Scrolling over the scene changes it too: down is faster, up is slower."
        />
        <SliderControl
          id="speed-variance"
          label="Speed Variance"
          value={speedVariance}
          min={0}
          max={1}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          onChange={setSpeedVariance}
          variant="inline"
          description="Randomizes individual particle speeds. 0 = uniform speed, higher values create more speed variation for organic, natural movement."
        />
        <SliderControl
          id="trail-intensity"
          label="Trail Length"
          value={trailIntensity}
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          onChange={setTrailIntensity}
          variant="inline"
          description="Controls motion blur trail effect. Lower values create longer, more pronounced trails. Higher values produce shorter, crisper trails."
        />
      </SettingsSection>

      <SettingsSection id="lighting" title="Particle Lighting">
        <SliderControl
          id="base-brightness"
          label="Base Brightness"
          value={baseBrightness}
          min={0}
          max={3}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          onChange={setBaseBrightness}
          variant="inline"
          description="Global brightness multiplier for all particles. Values above 1.0 increase luminosity, below 1.0 create dimmer effects."
        />
        <SliderControl
          id="depth-fade"
          label="Depth Fade"
          value={depthFade}
          min={0}
          max={1}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          onChange={setDepthFade}
          variant="inline"
          description="Controls how much particle opacity decreases with distance. 0 = uniform brightness, 1 = far particles fade significantly."
        />
        <SliderControl
          id="min-opacity"
          label="Min Opacity"
          value={minOpacity}
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          onChange={setMinOpacity}
          variant="inline"
          description="Minimum allowed opacity for particles. Prevents particles from becoming completely invisible at maximum depth."
        />
        <SliderControl
          id="max-opacity"
          label="Max Opacity"
          value={maxOpacity}
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          onChange={setMaxOpacity}
          variant="inline"
          description="Maximum allowed opacity for particles. Useful for creating subtle, semi-transparent effects at close range."
        />
        <SliderControl
          id="pulse-intensity"
          label="Pulse Intensity"
          value={pulseIntensity}
          min={0}
          max={1}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          onChange={setPulseIntensity}
          variant="inline"
          description="Amplitude of the pulsating brightness effect. Higher values create more dramatic oscillations in particle luminosity."
        />
        <SliderControl
          id="pulse-speed"
          label="Pulse Speed"
          value={pulseSpeedMultiplier}
          min={0}
          max={5}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          onChange={setPulseSpeedMultiplier}
          variant="inline"
          description="Speed multiplier for the pulsating effect. Higher values create faster breathing animations. Set to 0 to disable pulsation."
        />
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SliderControl
          id="stars-brightness"
          label="Stars Brightness"
          value={starsBrightness}
          min={0}
          max={3}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          onChange={setStarsBrightness}
          variant="inline"
          description="Overall brightness of the distant background stars."
        />
        <SliderControl
          id="star-density"
          label="Stars Density"
          value={starDensity}
          min={0}
          max={0.6}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          onChange={setStarDensity}
          variant="inline"
          description="Share of the star grid cells that hold a star."
        />
        <SliderControl
          id="star-cell"
          label="Stars Spacing"
          value={starCell}
          min={8}
          max={80}
          step={1}
          formatValue={(val) => `${val} px`}
          onChange={setStarCell}
          variant="inline"
          description="Size of one star grid cell; smaller cells mean more, closer stars."
        />
      </SettingsSection>

      <SettingsSection id="black-hole" title="Black Hole Physics" defaultOpen>
        <SliderControl
          id="black-hole-size"
          label="Black Hole Size"
          value={blackHoleSize}
          min={2}
          max={20}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}%`}
          onChange={setBlackHoleSize}
          variant="inline"
          description="Radius of the black hole's shadow as a share of the screen's short side. The photon ring, the lens and the strength and reach of gravity grow with it."
        />
        <SliderControl
          id="event-horizon"
          label="Event Horizon"
          value={eventHorizon}
          min={0}
          max={20}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}%`}
          onChange={setEventHorizon}
          variant="inline"
          description="Radius of no return as a share of the screen's short side. Particles that cross it are destroyed and recycled. Below the black hole size they vanish inside the shadow; above it they vanish before reaching it; 0 lets them fly through."
        />
        <SliderControl
          id="gravity-reach"
          label="Gravity Reach"
          value={gravityReach}
          min={1}
          max={12}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}×`}
          onChange={setGravityReach}
          variant="inline"
          description="How far the black hole's gravity reaches, in multiples of its size. Particles within this distance are affected by gravity and orbital forces."
        />
        <SliderControl
          id="gravity"
          label="Gravity"
          value={gravityStrength}
          min={0}
          max={10}
          step={0.5}
          onChange={setGravityStrength}
          variant="inline"
          description="Strength of gravitational attraction toward the black hole center. Higher values create stronger inward pull on particles."
        />
        <SliderControl
          id="orbital-force"
          label="Orbital Force"
          value={orbitalStrength}
          min={0}
          max={200}
          step={5}
          onChange={setOrbitalStrength}
          variant="inline"
          description="Tangential force that causes particles to orbit around the black hole. Creates swirling, accretion disk-like motion patterns."
        />
        <SliderControl
          id="follow-frequency"
          label="Follow Stiffness"
          value={followFrequency}
          min={0.5}
          max={30}
          step={0.5}
          formatValue={(val) => val.toFixed(1)}
          onChange={setFollowFrequency}
          variant="inline"
          description="How quickly the black hole catches up with the cursor; lower values feel heavier."
        />
      </SettingsSection>

      <SettingsSection id="photon-ring" title="Photon Ring" dimmed={!ringEnabled} action={<SettingsSwitch on={ringEnabled} onToggle={toggleRing} label="Photon ring" />}>
        <SliderControl
          id="ring-brightness"
          label="Ring Brightness"
          value={ringBrightness}
          min={0}
          max={3}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          onChange={setRingBrightness}
          variant="inline"
          description="Brightness of the photon ring at the edge of the shadow."
        />
        <SliderControl
          id="ring-width"
          label="Ring Thickness"
          value={ringWidth}
          min={0.004}
          max={0.06}
          step={0.001}
          formatValue={(val) => val.toFixed(3)}
          onChange={setRingWidth}
          variant="inline"
          description="Thickness of the photon ring in black hole radii. It never gets thinner than about a pixel and a half."
        />
        <SliderControl
          id="ring-doppler"
          label="Doppler Contrast"
          value={ringDoppler}
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          onChange={setRingDoppler}
          variant="inline"
          description="How much brighter and bluer the approaching side of the ring is than the dim, red receding side."
        />
        <SliderControl
          id="ring-side"
          label="Bright Side"
          value={ringSide}
          min={0}
          max={6.28}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)} rad`}
          onChange={setRingSide}
          variant="inline"
          description="Direction of the bright, approaching side around the ring."
        />
        <SettingsRow
          label="Infall Feed"
          help="Particles that fall into or skim past the black hole light the ring where they arrive. OFF leaves the ring burning evenly and stops this calculation."
        >
          <SettingsSwitch on={ringFeedEnabled} onToggle={toggleRingFeed} label="Infall feed" />
        </SettingsRow>
        <div className={cn('space-y-1 transition-opacity duration-150', ringEnabled && !ringFeedEnabled && 'opacity-50')}>
          <SliderControl
            id="ring-base"
            label="Ring Base Light"
            value={ringBase}
            min={0}
            max={1}
            step={0.01}
            formatValue={(val) => val.toFixed(2)}
            onChange={setRingBase}
            variant="inline"
            description="How brightly the photon ring shines when nothing is falling into the black hole."
          />
          <SliderControl
            id="ring-feed"
            label="Infall Response"
            value={ringFeed}
            min={0}
            max={2}
            step={0.01}
            formatValue={(val) => val.toFixed(2)}
            onChange={setRingFeed}
            variant="inline"
            description="How much the ring lights up where particles fall into or skim past the black hole."
          />
          <SliderControl
            id="ring-afterglow"
            label="Ring Afterglow"
            value={ringAfterglow}
            min={0.1}
            max={6}
            step={0.1}
            formatValue={(val) => `${val.toFixed(1)} s`}
            onChange={setRingAfterglow}
            variant="inline"
            description="How long the light left by infalling particles lingers on the ring."
          />
          <SliderControl
            id="ring-flow-speed"
            label="Ring Flow Speed"
            value={ringFlowSpeed}
            min={0}
            max={4}
            step={0.05}
            formatValue={(val) => `${val.toFixed(2)} rad/s`}
            onChange={setRingFlowSpeed}
            variant="inline"
            description="How fast the bright patches travel around the ring."
          />
        </div>
      </SettingsSection>

      <SettingsSection id="lensing" title="Gravitational Lensing WebGL" dimmed={!lensingEnabled} action={<SettingsSwitch on={lensingEnabled} onToggle={toggleLensing} label="Gravitational lensing" />}>
        <SliderControl
          id="lensing-radius"
          label="Lensing Radius"
          value={lensingRadius}
          min={1}
          max={3}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          onChange={setLensingRadius}
          variant="inline"
          description="Radius of the Einstein ring, in multiples of the black hole radius. Light from behind the black hole is bent into a ring this size; larger values distort more of the sky."
        />
        <SliderControl
          id="lensing-rotation"
          label="Angular Deflection"
          value={lensingRotation}
          min={0}
          max={2}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          onChange={setLensingRotation}
          variant="inline"
          description="Controls the rotational/swirling distortion around the black hole. 0 = no rotation, higher values create spiral vortex effects like light orbiting the event horizon."
        />
        <SliderControl
          id="lensing-falloff"
          label="Lensing Falloff"
          value={lensingFalloff}
          min={1}
          max={3}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          onChange={setLensingFalloff}
          variant="inline"
          description="How the pull of the lens changes with distance. 1 almost removes the lens, 2 is a point mass (realistic), 3 widens the lens and its dark zone far around the black hole."
        />
        <SliderControl
          id="lensing-absorption"
          label="Light Absorption"
          value={lensingAbsorption}
          min={0}
          max={1}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          onChange={setLensingAbsorption}
          variant="inline"
          description="How much light the pull of the lens removes around the black hole. 0 = none; higher values open a wider dark zone around the shadow. The zone also grows with Lensing Radius and Lensing Falloff."
        />
      </SettingsSection>

      <SettingsSection id="colors" title="Colors">
        <ColorPalette />
        <ColorPickerInput
          label="Background Color"
          value={rgbToHex(backgroundR, backgroundG, backgroundB)}
          onChange={(hex) => {
            const rgb = hexToRgb(hex)
            if (rgb) {
              setBackgroundColor(rgb.r, rgb.g, rgb.b)
            }
          }}
        />
      </SettingsSection>
    </div>
  )
})

interface SettingsBodyProps {
  // While the panel is closed the sections keep their last values and skip the work of updating
  active: boolean
}

// Every setting of the panel. It is built once with the page, so opening the panel builds nothing
function SettingsBody ({ active }: SettingsBodyProps) {
  const current = useControlPanelStore()
  const shown = useRef(current)
  if (active) shown.current = current

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={0}>
      <SettingsSections settings={shown.current} />
    </TooltipProvider>
  )
}

export default SettingsBody
