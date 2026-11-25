import { useId, type ReactNode } from 'react'
import { useParticleStore } from '../store/particle_store'
import { hexToRgb, rgbToHex } from '../lib/utils'
import ColorPalette from './controls/color_palette'
import SettingSlider from './controls/setting_slider'
import SettingColor from './controls/setting_color'
import ColorPickerInput from './controls/color_picker_input'
import SettingsSection, { SettingsFine, SettingsRow, SettingsSwitch } from './controls/settings_section'
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

function RayTracedRow () {
  const on = useParticleStore(state => state.lensingTraced)
  const toggle = useParticleStore(state => state.toggleLensingTraced)

  return (
    <SettingsRow label="Ray Traced" help="Exact light paths of a still black hole">
      {(describedBy) => <SettingsSwitch on={on} onToggle={toggle} label="Ray traced lens" describedBy={describedBy} />}
    </SettingsRow>
  )
}

// The settings only the stylized lens reads. Under Ray Traced they say so in words, as a switched-off
// section does, and stay editable for when it is turned off
function StylizedLens ({ children }: { children: ReactNode }) {
  const traced = useParticleStore(state => state.lensingTraced)
  const noteId = useId()
  return (
    <div role="group" aria-label="Stylized lens" aria-describedby={traced ? noteId : undefined} className="mt-3 flex flex-col gap-1">
      {traced && <p id={noteId} className="pl-3 font-mono text-[11px] leading-5 text-text-light/80">STYLIZED ONLY · Ray Traced ignores these</p>}
      {children}
    </div>
  )
}

// The 3D switch heads its section: the camera's sliders below it only matter while it is on
function ThreeDSection ({ children }: { children: ReactNode }) {
  const on = useParticleStore(state => state.threeD)
  const toggle = useParticleStore(state => state.toggleThreeD)
  return (
    <SettingsSection
      id="three-d"
      title="3D View"
      help="Drag the scene or use arrows to circle"
      dimmed={!on}
      action={<SettingsSwitch on={on} onToggle={toggle} label="3D view" />}
    >
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

      <ThreeDSection>
        <SettingSlider field="cameraYaw" />
        <SettingSlider field="cameraPitch" />
        <SettingSlider field="cameraSpin" />
        <SettingsFine id="three-d">
          {/* The column, then how the camera gets to its place and what counts as its cut */}
          <SettingSlider field="threeDEndFade" />
          <SettingSlider field="threeDNearest" />
          <SettingSlider field="threeDEase" />
          <SettingSlider field="cameraCutTurn" />
        </SettingsFine>
      </ThreeDSection>

      <SettingsSection id="particles" title="Particles">
        {/* The field, then its motion, then the look of a particle */}
        <SettingSlider field="numParticles" />
        <SettingSlider field="farZ" />
        <SettingSlider field="spawnRadius" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="baseSpeed" />
          <SettingSlider field="speedVariance" />
          <SettingSlider field="scrollSpeedStep" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="particleSize" />
          <SettingSlider field="trailIntensity" />
        </div>
        <SettingsFine id="particles">
          <SettingSlider field="particleSizeMin" />
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="lighting" title="Particle Lighting">
        {/* Brightness, then the opacity range, then the pulse */}
        <SettingSlider field="baseBrightness" />
        <SettingSlider field="speedGlow" />
        <SettingSlider field="depthFade" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="minOpacity" />
          <SettingSlider field="maxOpacity" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="pulseIntensity" />
          <SettingSlider field="pulseSpeedMultiplier" />
        </div>
        <SettingsFine id="lighting">
          <SettingSlider field="speedGlowKnee" />
        </SettingsFine>
      </SettingsSection>

      <SettingsSection
        id="colors"
        title="Colors"
        help="Swatch: color · bar: how often · eye: hide"
      >
        <ColorPalette />
        <BackgroundColorControl />
        <SettingsFine id="colors">
          {/* The tint of a fast flight: its two colors, then where and when it shows */}
          <SettingColor field="flightTintAhead" />
          <SettingColor field="flightTintEdge" />
          <SettingSlider field="flightTintGradient" />
          <SettingSlider field="flightTintLimit" />
          <SettingSlider field="flightTintFrom" />
          <SettingSlider field="flightTintFull" />
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="black-hole" title="Black Hole" defaultOpen>
        {/* The hole itself and its spin, then its pull, then where it sits */}
        <SettingSlider field="blackHoleSize" />
        <SettingSlider field="horizonScale" />
        <SettingSlider field="blackHoleDepth" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="blackHoleSpin" />
          <SettingSlider field="spinTilt" />
          <SettingSlider field="spinAxis" />
          <SettingSlider field="frameDrag" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="gravityStrength" />
          <SettingSlider field="orbitalStrength" />
          <SettingSlider field="gravityInertia" />
          <SettingSlider field="gravityReach" />
          <SettingSlider field="gravityDepth" />
        </div>
        <FollowCursorRow />
        <SettingSlider field="followFrequency" />
        <SettingSlider field="blackHoleX" setter="setBlackHoleX" />
        <SettingSlider field="blackHoleY" setter="setBlackHoleY" />
        <SettingSlider field="cameraZoom" />
        <SettingSlider field="cameraX" />
        <SettingSlider field="cameraY" />
        <SettingSlider field="cameraPair" />
        <SettingsFine id="black-hole">
          {/* The spin's sweep, then what counts as a cut of the camera */}
          <SettingSlider field="frameDragSweep" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="cameraCutZoom" />
            <SettingSlider field="cameraCutShift" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="companion" title="Second Black Hole">
        <SettingSlider field="companionSize" />
        <SettingSlider field="companionDistance" />
        <SettingSlider field="companionSpeed" />
        <SettingSlider field="companionWaves" />
        <SettingsFine id="companion">
          {/* The last turns, then what the merger leaves */}
          <SettingSlider field="companionClosest" />
          <SettingSlider field="companionSpin" />
          <SettingSlider field="companionOval" />
          <SettingSlider field="companionHandover" />
        </SettingsFine>
      </SettingsSection>

      <PhotonRingSection>
        <SettingSlider field="ringBrightness" />
        <SettingSlider field="ringGlow" />
        <SettingSlider field="ringWidth" />
        <SettingSlider field="ringDoppler" />
        <SettingSlider field="ringSide" />
        <InfallFeedRow />
        <SettingSlider field="ringBase" />
        <SettingSlider field="ringFeed" />
        <SettingSlider field="ringAfterglow" />
        <SettingSlider field="ringFlowSpeed" />
        <SettingsFine id="photon-ring">
          {/* Its colors, the line, the glow's shape, then what feeds it */}
          <SettingColor field="ringColor" />
          <SettingColor field="ringColorApproaching" />
          <SettingColor field="ringColorReceding" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="ringWidthMin" />
            <SettingSlider field="ringOffset" />
            <SettingSlider field="ringSoftness" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="ringGlowCore" />
            <SettingSlider field="ringGlowCoreShare" />
            <SettingSlider field="ringGlowSkirt" />
            <SettingSlider field="ringGlowSkirtShare" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="ringFeedCapture" />
            <SettingSlider field="ringFeedSkim" />
            <SettingSlider field="ringFeedReach" />
            <SettingSlider field="ringStarFlare" />
            <SettingSlider field="ringStarSpread" />
            <SettingSlider field="ringStarSides" />
          </div>
        </SettingsFine>
      </PhotonRingSection>

      <LensingSection>
        {/* The mode, what both modes read, then what only the stylized lens reads: reach, the falloff,
            the twist and the limits near the hole */}
        <RayTracedRow />
        <SettingSlider field="lensingRadius" />
        <SettingSlider field="lensingAbsorption" />
        <StylizedLens>
          <SettingSlider field="lensingReach" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="lensingFalloff" />
            <SettingSlider field="lensingPivot" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="lensingRotation" />
            <SettingSlider field="lensingTwistLimit" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="lensingMaxBend" />
            <SettingSlider field="lensingCore" />
          </div>
        </StylizedLens>
      </LensingSection>

      <SettingsSection id="orbiting-stars" title="Orbiting Stars">
        {/* How many and on what orbits, their pace, then their look */}
        <SettingSlider field="orbitCount" />
        <SettingSlider field="orbitSize" />
        <SettingSlider field="orbitEccentricity" />
        <SettingSlider field="orbitSpeed" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="orbitTrail" />
          <SettingSlider field="orbitStarSize" />
        </div>
        <SettingsFine id="orbiting-stars">
          {/* How the orbits are made, then what the stars do on them */}
          <SettingSlider field="orbitSizeSpread" />
          <SettingSlider field="orbitEccentricitySpread" />
          <SettingSlider field="orbitClosest" />
          <SettingSlider field="orbitEscape" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="orbitDrag" />
            <SettingSlider field="orbitFadeIn" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="space-grid" title="Space Grid">
        {/* The sheet and its shape, the lattice and its shape, the grid behind the lens and its pull, then the cell the sheet and that grid share, then the colour of all three */}
        <SettingSlider field="gridSheet" />
        <SettingSlider field="gridTilt" />
        <SettingSlider field="gridDepth" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="gridLattice" />
          <SettingSlider field="gridLatticeCell" />
          <SettingSlider field="gridLatticeWarp" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="gridSky" />
          <SettingSlider field="gridSkyPull" />
          <SettingSlider field="gridCell" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingColor field="gridColor" />
        </div>
        <SettingsFine id="space-grid">
          {/* The sheet (its lines, its camera, its edges, the wave, 3D), the lattice and the grid behind the lens */}
          <div className="flex flex-col gap-1">
            <SettingSlider field="gridLine" />
            <SettingSlider field="gridLineNear" />
            <SettingSlider field="gridDistance" />
            <SettingSlider field="gridNear" />
            <SettingSlider field="gridSpan" />
            <SettingSlider field="gridFade" />
            <SettingSlider field="gridClearing" />
            <SettingSlider field="gridClearingEdge" />
            <SettingSlider field="gridWaveLift" />
            <SettingSlider field="gridTiltLimit" />
            <SettingSlider field="gridTiltFade" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="gridLatticeLine" />
            <SettingSlider field="gridLatticeGain" />
            <SettingSlider field="gridLatticeReach" />
            <SettingSlider field="gridLatticeFade" />
            <SettingSlider field="gridLatticeNear" />
            <SettingSlider field="gridLatticeFar" />
            <SettingSlider field="gridLatticeNearEdge" />
            <SettingSlider field="gridLatticeUnit" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="gridSkyLine" />
            <SettingSlider field="gridSkyHaze" />
            <SettingSlider field="gridSkyHazeSpan" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SettingSlider field="starsBrightness" />
        <SettingSlider field="starDensity" />
        <SettingSlider field="starCell" />
        <SettingsFine id="stars">
          {/* A star's tints, its size and spread of brightness, then its twinkle */}
          <SettingColor field="starsColorWarm" />
          <SettingColor field="starsColorCool" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="starsSize" />
            <SettingSlider field="starsFaintest" />
            <SettingSlider field="starsTwinkle" />
            <SettingSlider field="starsTwinkleSpeed" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="nebula" title="Nebula">
        {/* How bright, the clouds' size and fill, then its colours and how far the thickest cloud takes the third */}
        <SettingSlider field="nebula" />
        <SettingSlider field="nebulaScale" />
        <SettingSlider field="nebulaSparseness" />
        <div className="mt-3 flex flex-col gap-1">
          <SettingColor field="nebulaColor" />
          <SettingColor field="nebulaColorDeep" />
          <SettingColor field="nebulaColorCore" />
          <SettingSlider field="nebulaCore" />
        </div>
        <SettingsFine id="nebula">
          {/* The clouds' look, their drift, the second colour's patches, where the core colour starts */}
          <SettingSlider field="nebulaEdge" />
          <SettingSlider field="nebulaWarp" />
          <SettingSlider field="nebulaContrast" />
          <SettingSlider field="nebulaGrain" />
          <SettingSlider field="nebulaDrift" />
          <SettingSlider field="nebulaDriftAngle" />
          <SettingSlider field="nebulaPatch" />
          <SettingSlider field="nebulaPatchShare" />
          <SettingSlider field="nebulaPatchSoftness" />
          <SettingSlider field="nebulaCoreFrom" />
        </SettingsFine>
      </SettingsSection>
    </div>
  )
}

export default SettingsBody
