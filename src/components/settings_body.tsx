import { Play, Pause } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useParticleStore } from '../store/particle_store'
import { useIntroDebugStore } from '../store/intro_debug_store'
import { cn, hexToRgb, rgbToHex } from '../lib/utils'
import { BASE_SPEED_MAX, BASE_SPEED_MIN, BASE_SPEED_STEP } from '../lib/base_speed'
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
          label="Particles"
          field="numParticles"
          min={500}
          max={200000}
          step={500}
          setter="setNumParticles"
          variant="inline"
          description="Total number of particles rendered in the scene. Higher values create denser visuals but may impact performance; with Particle Budget on AUTO the count is trimmed to what your processor keeps up with."
        />
        <SettingSlider
          id="far-z"
          label="Particle Render Depth"
          field="farZ"
          min={500}
          max={50000}
          step={500}
          setter="setFarZ"
          variant="inline"
          description="Maximum depth distance for particle field. Controls how far particles travel before recycling. Larger values create a deeper sense of space."
        />
        <SettingSlider
          id="base-speed"
          label="Base Speed"
          field="baseSpeed"
          min={BASE_SPEED_MIN}
          max={BASE_SPEED_MAX}
          step={BASE_SPEED_STEP}
          formatValue={(val) => val.toFixed(1)}
          setter="setBaseSpeed"
          variant="inline"
          description="Speed of the flight through space. Scrolling over the scene changes it too: down is faster, up is slower."
        />
        <SettingSlider
          id="scroll-speed-step"
          label="Scroll Speed Step"
          field="scrollSpeedStep"
          min={0}
          max={10}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          setter="setScrollSpeedStep"
          variant="inline"
          description="How much one notch of the mouse wheel over the scene changes Base Speed; a swipe on a touch screen follows it too. 0 turns scrolling the speed off."
        />
        <SettingSlider
          id="speed-variance"
          label="Speed Variance"
          field="speedVariance"
          min={0}
          max={3}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setSpeedVariance"
          variant="inline"
          description="Randomizes individual particle speeds. 0 = uniform speed, higher values create more speed variation for organic, natural movement. Above 1 a few particles turn into very fast streaks."
        />
        <SettingSlider
          id="trail-intensity"
          label="Trail Length"
          field="trailIntensity"
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          setter="setTrailIntensity"
          variant="inline"
          description="Controls motion blur trail effect. Lower values create longer, more pronounced trails. Higher values produce shorter, crisper trails."
        />
        <SettingSlider
          id="particle-size"
          label="Particle Size"
          field="particleSize"
          min={0.3}
          max={20}
          step={0.1}
          formatValue={(val) => `${val.toFixed(1)} px`}
          setter="setParticleSize"
          variant="inline"
          description="Stroke width of the nearest particles. Particles get thinner with distance, down to 0.3 px at the far end of the field."
        />
        <SettingSlider
          id="spawn-radius"
          label="Spawn Radius"
          field="spawnRadius"
          min={50}
          max={5000}
          step={50}
          formatValue={(val) => String(val)}
          setter="setSpawnRadius"
          variant="inline"
          description="Radius of the disc particles are born in. A smaller disc keeps more particles on screen and close to the camera, a larger one spreads them out and sends more of them past the edges. Particles already flying keep their place until they are recycled."
        />
      </SettingsSection>

      <SettingsSection id="lighting" title="Particle Lighting">
        <SettingSlider
          id="base-brightness"
          label="Base Brightness"
          field="baseBrightness"
          min={0}
          max={10}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          setter="setBaseBrightness"
          variant="inline"
          description="Global brightness multiplier for all particles. Values above 1.0 increase luminosity, below 1.0 create dimmer effects."
        />
        <SettingSlider
          id="speed-glow"
          label="Speed Glow"
          field="speedGlow"
          min={0}
          max={5}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setSpeedGlow"
          variant="inline"
          description="How strongly brightness follows a particle's speed. 0 = every moving particle is fully lit, 1 = slow particles are dimmer and fast ones brighter, higher values leave only the fast ones glowing. A particle that stands still is always dark."
        />
        <SettingSlider
          id="depth-fade"
          label="Depth Fade"
          field="depthFade"
          min={-1}
          max={3}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setDepthFade"
          variant="inline"
          description="Controls how much particle opacity decreases with distance. 0 = uniform brightness, 1 = far particles fade out, above 1 they vanish sooner, below 0 far particles are the brighter ones."
        />
        <SettingSlider
          id="min-opacity"
          label="Min Opacity"
          field="minOpacity"
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          setter="setMinOpacity"
          variant="inline"
          description="Minimum allowed opacity for particles. Prevents particles from becoming completely invisible at maximum depth."
        />
        <SettingSlider
          id="max-opacity"
          label="Max Opacity"
          field="maxOpacity"
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          setter="setMaxOpacity"
          variant="inline"
          description="Maximum allowed opacity for particles. Useful for creating subtle, semi-transparent effects at close range."
        />
        <SettingSlider
          id="pulse-intensity"
          label="Pulse Intensity"
          field="pulseIntensity"
          min={0}
          max={3}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setPulseIntensity"
          variant="inline"
          description="Amplitude of the pulsating brightness effect. Higher values create more dramatic oscillations in particle luminosity."
        />
        <SettingSlider
          id="pulse-speed"
          label="Pulse Speed"
          field="pulseSpeedMultiplier"
          min={0}
          max={20}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          setter="setPulseSpeedMultiplier"
          variant="inline"
          description="Speed multiplier for the pulsating effect. Higher values create faster breathing animations. Set to 0 to disable pulsation."
        />
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SettingSlider
          id="stars-brightness"
          label="Stars Brightness"
          field="starsBrightness"
          min={0}
          max={10}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setStarsBrightness"
          variant="inline"
          description="Overall brightness of the distant background stars."
        />
        <SettingSlider
          id="star-density"
          label="Stars Density"
          field="starDensity"
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          setter="setStarDensity"
          variant="inline"
          description="Share of the star grid cells that hold a star."
        />
        <SettingSlider
          id="star-cell"
          label="Stars Spacing"
          field="starCell"
          min={4}
          max={200}
          step={1}
          formatValue={(val) => `${val} px`}
          setter="setStarCell"
          variant="inline"
          description="Size of one star grid cell; smaller cells mean more, closer stars."
        />
      </SettingsSection>

      <SettingsSection id="black-hole" title="Black Hole Physics" defaultOpen>
        <SettingSlider
          id="black-hole-size"
          label="Black Hole Size"
          field="blackHoleSize"
          min={0}
          max={60}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}%`}
          setter="setBlackHoleSize"
          variant="inline"
          description="Radius of the black hole's shadow as a share of the screen's short side. The photon ring, the lens and the strength and reach of gravity grow with it. 0 removes the black hole."
        />
        <SettingSlider
          id="event-horizon"
          label="Event Horizon"
          field="eventHorizon"
          min={0}
          max={60}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}%`}
          setter="setEventHorizon"
          variant="inline"
          description="Radius of no return as a share of the screen's short side. Particles that cross it are destroyed and recycled. Below the black hole size they vanish inside the shadow; above it they vanish before reaching it; 0 lets them fly through."
        />
        <SettingSlider
          id="gravity-reach"
          label="Gravity Reach"
          field="gravityReach"
          min={0}
          max={40}
          step={0.5}
          formatValue={(val) => `${val.toFixed(1)}×`}
          setter="setGravityReach"
          variant="inline"
          description="How far the black hole's gravity reaches, in multiples of its size. Particles within this distance are affected by gravity and orbital forces."
        />
        <SettingSlider
          id="black-hole-depth"
          label="Black Hole Depth"
          field="blackHoleDepth"
          min={0}
          max={100}
          step={1}
          formatValue={(val) => `${val}%`}
          setter="setBlackHoleDepth"
          variant="inline"
          description="How deep in the particle field the black hole sits, as a share of Particle Render Depth. Its gravity is strongest for particles at this depth."
        />
        <SettingSlider
          id="gravity-depth"
          label="Gravity Depth"
          field="gravityDepth"
          min={1}
          max={100}
          step={1}
          formatValue={(val) => `${val}%`}
          setter="setGravityDepth"
          variant="inline"
          description="How thick the layer of particles that gravity acts on is, as a share of Particle Render Depth. Gravity fades with distance from the black hole's depth and ends at twice this value; 50% and above reaches the whole field."
        />
        <SettingSlider
          id="gravity"
          label="Gravity"
          field="gravityStrength"
          min={-20}
          max={50}
          step={0.5}
          setter="setGravityStrength"
          variant="inline"
          description="Strength of gravitational attraction toward the black hole center. Higher values create stronger inward pull on particles. Negative values push them away."
        />
        <SettingSlider
          id="orbital-force"
          label="Orbital Force"
          field="orbitalStrength"
          min={-500}
          max={500}
          step={5}
          setter="setOrbitalStrength"
          variant="inline"
          description="Tangential force that causes particles to orbit around the black hole. Creates swirling, accretion disk-like motion patterns. Negative values swirl the other way."
        />
        <SettingSlider
          id="follow-frequency"
          label="Follow Stiffness"
          field="followFrequency"
          min={0.1}
          max={60}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          setter="setFollowFrequency"
          variant="inline"
          description="How quickly the black hole catches up with the cursor; lower values feel heavier."
        />
      </SettingsSection>

      <SettingsSection id="photon-ring" title="Photon Ring" dimmed={!ringEnabled} action={<SettingsSwitch on={ringEnabled} onToggle={toggleRing} label="Photon ring" />}>
        <SettingSlider
          id="ring-brightness"
          label="Ring Brightness"
          field="ringBrightness"
          min={0}
          max={10}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setRingBrightness"
          variant="inline"
          description="Brightness of the photon ring at the edge of the shadow."
        />
        <SettingSlider
          id="ring-width"
          label="Ring Thickness"
          field="ringWidth"
          min={0.001}
          max={0.25}
          step={0.001}
          formatValue={(val) => val.toFixed(3)}
          setter="setRingWidth"
          variant="inline"
          description="Thickness of the photon ring in black hole radii. It never gets thinner than about a pixel and a half."
        />
        <SettingSlider
          id="ring-doppler"
          label="Doppler Contrast"
          field="ringDoppler"
          min={0}
          max={1}
          step={0.01}
          formatValue={(val) => val.toFixed(2)}
          setter="setRingDoppler"
          variant="inline"
          description="How much brighter and bluer the approaching side of the ring is than the dim, red receding side."
        />
        <SettingSlider
          id="ring-side"
          label="Bright Side"
          field="ringSide"
          min={0}
          max={6.28}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)} rad`}
          setter="setRingSide"
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
          <SettingSlider
            id="ring-base"
            label="Ring Base Light"
            field="ringBase"
            min={0}
            max={3}
            step={0.01}
            formatValue={(val) => val.toFixed(2)}
            setter="setRingBase"
            variant="inline"
            description="How brightly the photon ring shines when nothing is falling into the black hole."
          />
          <SettingSlider
            id="ring-feed"
            label="Infall Response"
            field="ringFeed"
            min={0}
            max={10}
            step={0.01}
            formatValue={(val) => val.toFixed(2)}
            setter="setRingFeed"
            variant="inline"
            description="How much the ring lights up where particles fall into or skim past the black hole."
          />
          <SettingSlider
            id="ring-afterglow"
            label="Ring Afterglow"
            field="ringAfterglow"
            min={0.05}
            max={30}
            step={0.05}
            formatValue={(val) => `${val.toFixed(2)} s`}
            setter="setRingAfterglow"
            variant="inline"
            description="How long the light left by infalling particles lingers on the ring."
          />
          <SettingSlider
            id="ring-flow-speed"
            label="Ring Flow Speed"
            field="ringFlowSpeed"
            min={-10}
            max={10}
            step={0.05}
            formatValue={(val) => `${val.toFixed(2)} rad/s`}
            setter="setRingFlowSpeed"
            variant="inline"
            description="How fast the bright patches travel around the ring. Negative values turn them the other way."
          />
        </div>
      </SettingsSection>

      <SettingsSection id="lensing" title="Gravitational Lensing WebGL" dimmed={!lensingEnabled} action={<SettingsSwitch on={lensingEnabled} onToggle={toggleLensing} label="Gravitational lensing" />}>
        <SettingSlider
          id="lensing-radius"
          label="Lensing Radius"
          field="lensingRadius"
          min={0}
          max={8}
          step={0.05}
          formatValue={(val) => `${val.toFixed(2)}×`}
          setter="setLensingRadius"
          variant="inline"
          description="Radius of the Einstein ring, in multiples of the black hole radius. Light from behind the black hole is bent into a ring this size; larger values distort more of the sky. 0 turns the lens off."
        />
        <SettingSlider
          id="lensing-reach"
          label="Lens Reach"
          field="lensingReach"
          min={0}
          max={1}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingReach"
          variant="inline"
          description="How far the lens is felt outside its ring. 0 = a compact bubble, as in the original version: the distortion dies off quickly and the rest of the sky stays in place. 1 = a point mass (realistic): the whole sky is pulled, weaker with distance."
        />
        <SettingSlider
          id="lensing-rotation"
          label="Angular Deflection"
          field="lensingRotation"
          min={-10}
          max={10}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingRotation"
          variant="inline"
          description="Controls the rotational/swirling distortion around the black hole. 0 = no rotation, higher values create spiral vortex effects like light orbiting the event horizon, negative values twist the other way."
        />
        <SettingSlider
          id="lensing-twist-limit"
          label="Twist Limit"
          field="lensingTwistLimit"
          min={0}
          max={64}
          step={0.5}
          formatValue={(val) => val.toFixed(1)}
          setter="setLensingTwistLimit"
          variant="inline"
          description="How far Angular Deflection winds up toward the black hole. The twist equals Angular Deflection at the Einstein ring and grows inward up to this many times. Low values keep a larger Lensing Radius a bigger bubble with the same gentle twist; high values wind the inside of a wide lens into a tight spiral. 0 removes the twist."
        />
        <SettingSlider
          id="lensing-falloff"
          label="Lensing Falloff"
          field="lensingFalloff"
          min={0.5}
          max={4}
          step={0.1}
          formatValue={(val) => val.toFixed(1)}
          setter="setLensingFalloff"
          variant="inline"
          description="How the pull of the lens changes with distance. Below 1 the lens almost disappears, 2 is a point mass (realistic), 3 and above widen the lens and its dark zone far around the black hole."
        />
        <SettingSlider
          id="lensing-pivot"
          label="Falloff Pivot"
          field="lensingPivot"
          min={1}
          max={300}
          step={1}
          formatValue={(val) => `${val}%`}
          setter="setLensingPivot"
          variant="inline"
          description="Distance from the black hole, as a share of the screen's short side, where Lensing Falloff changes nothing. Closer than this a higher falloff pulls harder, farther away it pulls less. At 100% a higher falloff strengthens the lens over the whole screen; set it to the Einstein ring's radius (Black Hole Size times Lensing Radius) and falloff reshapes the lens without resizing it."
        />
        <SettingSlider
          id="lensing-max-bend"
          label="Inner Rings"
          field="lensingMaxBend"
          min={1}
          max={256}
          step={1}
          formatValue={(val) => String(val)}
          setter="setLensingMaxBend"
          variant="inline"
          description="Cap on how hard the lens can pull. Inside the Einstein ring a stronger pull folds the sky into more nested, mirrored rings; 1 leaves none, higher values allow more of them toward the centre."
        />
        <SettingSlider
          id="lensing-core"
          label="Lens Core"
          field="lensingCore"
          min={0}
          max={2}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingCore"
          variant="inline"
          description="How far from the point right behind the black hole the bent rays stay, in Einstein ring radii. 0 smears that single point into a flat band along the ring; higher values fill the ring with detail from farther around it."
        />
        <SettingSlider
          id="lensing-absorption"
          label="Light Absorption"
          field="lensingAbsorption"
          min={0}
          max={5}
          step={0.05}
          formatValue={(val) => val.toFixed(2)}
          setter="setLensingAbsorption"
          variant="inline"
          description="How much light the pull of the lens removes around the black hole. 0 = none; higher values open a wider dark zone around the shadow. The zone also grows with Lensing Radius and Lensing Falloff."
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
