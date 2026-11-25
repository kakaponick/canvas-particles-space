import type { ReactNode } from 'react'
import { useParticleStore } from '../store/particle_store'
import { hexToRgb, rgbToHex } from '../lib/utils'
import ColorPalette from './controls/color_palette'
import SettingSlider from './controls/setting_slider'
import ColorPickerInput from './controls/color_picker_input'
import SettingsSection, { SettingsRow, SettingsSwitch } from './controls/settings_section'
import FrameRateControl, { MeasuredFps } from './controls/frame_rate_control'
import PresetControl, { ActivePresetName } from './controls/preset_control'

// Every toggle below is its own small component bound to its own setting, so switching one (or a click on
// the scene, which switches Follow Cursor) re-renders that switch and not the sliders around it

function BackgroundColorControl () {
  const backgroundR = useParticleStore(state => state.backgroundR)
  const backgroundG = useParticleStore(state => state.backgroundG)
  const backgroundB = useParticleStore(state => state.backgroundB)
  const setBackgroundColor = useParticleStore(state => state.setBackgroundColor)

  return (
    <ColorPickerInput
      label="Background"
      description="Color behind the scene"
      value={rgbToHex(backgroundR, backgroundG, backgroundB)}
      onChange={(hex) => {
        const rgb = hexToRgb(hex)
        if (rgb) setBackgroundColor(rgb.r, rgb.g, rgb.b)
      }}
    />
  )
}

// A setting, not a transport: the intro debugger has its own PLAY, so this one reads ON/OFF like the others
function MotionRow () {
  const isPaused = useParticleStore(state => state.isPaused)
  const togglePause = useParticleStore(state => state.togglePause)

  return (
    <SettingsRow label="Scene Motion" help="OFF freezes the scene in place">
      {(describedBy) => <SettingsSwitch on={!isPaused} onToggle={togglePause} label="Scene motion" describedBy={describedBy} />}
    </SettingsRow>
  )
}

function FollowCursorRow () {
  const following = useParticleStore(state => state.blackHoleFollowing)
  const toggle = useParticleStore(state => state.toggleBlackHoleFollowing)

  return (
    <SettingsRow
      label="Follow Cursor"
      help="Hole tracks the cursor; a click toggles it"
      className="mt-3"
    >
      {(describedBy) => <SettingsSwitch on={following} onToggle={toggle} label="Follow cursor" describedBy={describedBy} />}
    </SettingsRow>
  )
}

function InfallFeedRow () {
  const on = useParticleStore(state => state.ringFeedEnabled)
  const toggle = useParticleStore(state => state.toggleRingFeed)

  return (
    <SettingsRow label="Infall Light" help="Infalling particles light up the ring" className="mt-3">
      {(describedBy) => <SettingsSwitch on={on} onToggle={toggle} label="Infall light" describedBy={describedBy} />}
    </SettingsRow>
  )
}

function PhotonRingSection ({ children }: { children: ReactNode }) {
  const on = useParticleStore(state => state.ringEnabled)
  const toggle = useParticleStore(state => state.toggleRing)
  return (
    <SettingsSection id="photon-ring" title="Photon Ring" dimmed={!on} action={<SettingsSwitch on={on} onToggle={toggle} label="Photon ring" />}>
      {children}
    </SettingsSection>
  )
}

function LensingSection ({ children }: { children: ReactNode }) {
  const on = useParticleStore(state => state.lensingEnabled)
  const toggle = useParticleStore(state => state.toggleLensing)
  return (
    <SettingsSection id="lensing" title="Gravitational Lensing" dimmed={!on} action={<SettingsSwitch on={on} onToggle={toggle} label="Gravitational lensing" />}>
      {children}
    </SettingsSection>
  )
}

// Every setting of the panel. It is built once with the page, so opening the panel builds nothing
function SettingsBody () {
  return (
    <div>
      <SettingsSection
        id="presets"
        title="Presets"
        help="Every setting below, saved in this browser"
        collapsedAction={<ActivePresetName />}
      >
        <PresetControl />
      </SettingsSection>

      <SettingsSection id="playback" title="Playback" action={<MeasuredFps />}>
        <MotionRow />
        <FrameRateControl />
      </SettingsSection>

      <SettingsSection id="particles" title="Particles">
        {/* The field, then its motion, then the look of a particle */}
        <SettingSlider field="numParticles" setter="setNumParticles" />
        <SettingSlider field="farZ" setter="setFarZ" />
        <SettingSlider field="spawnRadius" setter="setSpawnRadius" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="baseSpeed" setter="setBaseSpeed" />
          <SettingSlider field="speedVariance" setter="setSpeedVariance" />
          <SettingSlider field="scrollSpeedStep" setter="setScrollSpeedStep" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="particleSize" setter="setParticleSize" />
          <SettingSlider field="trailIntensity" setter="setTrailIntensity" />
        </div>
      </SettingsSection>

      <SettingsSection id="lighting" title="Particle Lighting">
        {/* Brightness, then the opacity range, then the pulse */}
        <SettingSlider field="baseBrightness" setter="setBaseBrightness" />
        <SettingSlider field="speedGlow" setter="setSpeedGlow" />
        <SettingSlider field="depthFade" setter="setDepthFade" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="minOpacity" setter="setMinOpacity" />
          <SettingSlider field="maxOpacity" setter="setMaxOpacity" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="pulseIntensity" setter="setPulseIntensity" />
          <SettingSlider field="pulseSpeedMultiplier" setter="setPulseSpeedMultiplier" />
        </div>
      </SettingsSection>

      <SettingsSection
        id="colors"
        title="Colors"
        help="Swatch: color · bar: how often · eye: hide"
      >
        <ColorPalette />
        <BackgroundColorControl />
      </SettingsSection>

      <SettingsSection id="black-hole" title="Black Hole" defaultOpen>
        {/* The hole itself, then its pull, then where it sits */}
        <SettingSlider field="blackHoleSize" setter="setBlackHoleSize" />
        <SettingSlider field="horizonScale" setter="setHorizonScale" />
        <SettingSlider field="blackHoleDepth" setter="setBlackHoleDepth" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="gravityStrength" setter="setGravityStrength" />
          <SettingSlider field="orbitalStrength" setter="setOrbitalStrength" />
          <SettingSlider field="gravityReach" setter="setGravityReach" />
          <SettingSlider field="gravityDepth" setter="setGravityDepth" />
        </div>
        <FollowCursorRow />
        <SettingSlider field="followFrequency" setter="setFollowFrequency" />
        <SettingSlider field="blackHoleX" setter="setBlackHoleX" />
        <SettingSlider field="blackHoleY" setter="setBlackHoleY" />
        <SettingSlider field="cameraZoom" setter="setCameraZoom" />
      </SettingsSection>

      <SettingsSection id="companion" title="Second Black Hole">
        <SettingSlider field="companionSize" setter="setCompanionSize" />
        <SettingSlider field="companionDistance" setter="setCompanionDistance" />
        <SettingSlider field="companionSpeed" setter="setCompanionSpeed" />
        <SettingSlider field="companionWaves" setter="setCompanionWaves" />
      </SettingsSection>

      <PhotonRingSection>
        <SettingSlider field="ringBrightness" setter="setRingBrightness" />
        <SettingSlider field="ringGlow" setter="setRingGlow" />
        <SettingSlider field="ringWidth" setter="setRingWidth" />
        <SettingSlider field="ringDoppler" setter="setRingDoppler" />
        <SettingSlider field="ringSide" setter="setRingSide" />
        <InfallFeedRow />
        <SettingSlider field="ringBase" setter="setRingBase" />
        <SettingSlider field="ringFeed" setter="setRingFeed" />
        <SettingSlider field="ringAfterglow" setter="setRingAfterglow" />
        <SettingSlider field="ringFlowSpeed" setter="setRingFlowSpeed" />
      </PhotonRingSection>

      <LensingSection>
        {/* Size and reach, the falloff, the twist, then the limits near the hole */}
        <SettingSlider field="lensingRadius" setter="setLensingRadius" />
        <SettingSlider field="lensingReach" setter="setLensingReach" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="lensingFalloff" setter="setLensingFalloff" />
          <SettingSlider field="lensingPivot" setter="setLensingPivot" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="lensingRotation" setter="setLensingRotation" />
          <SettingSlider field="lensingTwistLimit" setter="setLensingTwistLimit" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="lensingMaxBend" setter="setLensingMaxBend" />
          <SettingSlider field="lensingCore" setter="setLensingCore" />
          <SettingSlider field="lensingAbsorption" setter="setLensingAbsorption" />
        </div>
      </LensingSection>

      <SettingsSection id="orbiting-stars" title="Orbiting Stars">
        {/* How many and on what orbits, their pace, then their look */}
        <SettingSlider field="orbitCount" setter="setOrbitCount" />
        <SettingSlider field="orbitSize" setter="setOrbitSize" />
        <SettingSlider field="orbitEccentricity" setter="setOrbitEccentricity" />
        <SettingSlider field="orbitSpeed" setter="setOrbitSpeed" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="orbitTrail" setter="setOrbitTrail" />
          <SettingSlider field="orbitStarSize" setter="setOrbitStarSize" />
        </div>
      </SettingsSection>

      <SettingsSection id="space-grid" title="Space Grid">
        {/* The sheet and its shape, the grid behind the lens, then the cell both share */}
        <SettingSlider field="gridSheet" setter="setGridSheet" />
        <SettingSlider field="gridTilt" setter="setGridTilt" />
        <SettingSlider field="gridDepth" setter="setGridDepth" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="gridSky" setter="setGridSky" />
          <SettingSlider field="gridCell" setter="setGridCell" />
        </div>
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SettingSlider field="starsBrightness" setter="setStarsBrightness" />
        <SettingSlider field="starDensity" setter="setStarDensity" />
        <SettingSlider field="starCell" setter="setStarCell" />
      </SettingsSection>
    </div>
  )
}

export default SettingsBody
