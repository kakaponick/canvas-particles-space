import { useId, type ReactNode } from 'react'
import { useParticleStore } from '../store/particle_store'
import { hexToRgb, rgbToHex } from '../lib/utils'
import { FLOW_KEYS } from '../lib/flows'
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
function ParticlesSection ({ children }: { children: ReactNode }) {
  const on = useParticleStore(state => state.fieldEnabled)
  const toggle = useParticleStore(state => state.toggleField)
  return (
    <SettingsSection id="particles" title="Particles" dimmed={!on} action={<SettingsSwitch on={on} onToggle={toggle} label="Particle field" />}>
      {children}
    </SettingsSection>
  )
}

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
          {/* Where the camera stands and looks beyond its circle, the column, how the lens takes over what lies
              behind the holes and how what stands in front of them is laid over them, then how the camera
              gets to its place and what counts as its cut */}
          <SettingSlider field="cameraRoll" />
          <SettingSlider field="cameraLookYaw" />
          <SettingSlider field="cameraLookPitch" />
          <SettingSlider field="cameraMoveRight" />
          <SettingSlider field="cameraMoveUp" />
          <SettingSlider field="cameraMoveIn" />
          <SettingSlider field="threeDEndFade" />
          <SettingSlider field="threeDFrontDepth" />
          <SettingSlider field="threeDFrontCurve" />
          <SettingSlider field="threeDFrontBend" />
          <SettingSlider field="threeDFrontBetween" />
          <SettingSlider field="threeDFrontReach" />
          <SettingSlider field="threeDFrontReachBare" />
          <SettingSlider field="threeDFrontLetGo" />
          <SettingSlider field="threeDFrontAdd" />
          <SettingSlider field="threeDFrontWaves" />
          <SettingSlider field="threeDNearest" />
          <SettingSlider field="threeDEase" />
          <SettingSlider field="cameraCutTurn" />
        </SettingsFine>
      </ThreeDSection>

      <ParticlesSection>
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
          <SettingSlider field="fieldAtHole" />
          <SettingSlider field="particleSizeMin" />
        </SettingsFine>
      </ParticlesSection>

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
          <SettingColor field="flightTintBehind" />
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
          {/* How the pull falls, then the spin's drag: its sweep, its push along the sight, its fall, and the
              axis it gives the swirl, then what counts as a cut of the camera */}
          <SettingSlider field="gravityFalloff" />
          <SettingSlider field="gravityDepthBell" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="frameDragSweep" />
            <SettingSlider field="frameDragSight" />
            <SettingSlider field="frameDragFalloff" />
            <SettingSlider field="orbitalSpinFollow" />
            <SettingSlider field="orbitalSpinFollowCurve" />
          </div>
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
          {/* The plane of the orbit, the last turns, what the merger leaves, the second hole's own spin, its ring and
              lens, how two at different depths see each other, then the plane a hole alone rings in */}
          <SettingSlider field="companionTilt" />
          <SettingSlider field="companionNode" />
          <SettingSlider field="companionClosest" />
          <SettingSlider field="companionSpin" />
          <SettingSlider field="companionOval" />
          <SettingSlider field="companionHandover" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="companionOwnSpin" />
            <SettingSlider field="companionSpinTilt" />
            <SettingSlider field="companionSpinAxis" />
            <SettingSlider field="companionPrecession" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="companionRingFeed" />
            <SettingSlider field="companionRingSides" />
            <SettingSlider field="companionLensCore" />
            <SettingSlider field="companionLensStyle" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="companionLensDepth" />
            <SettingSlider field="companionHideDepth" />
            <SettingSlider field="companionWaveLens" />
            <SettingSlider field="companionFlatDepth" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="loneTilt" />
            <SettingSlider field="loneNode" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <PhotonRingSection>
        <SettingSlider field="ringBrightness" />
        <SettingSlider field="ringGlow" />
        <SettingSlider field="ringWidth" />
        <SettingSlider field="ringDoppler" />
        <SettingSlider field="ringSide" />
        <SettingSlider field="ringSpinFollow" />
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
        <SettingSlider field="lensingFromCamera" />
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
        <SettingsFine id="lensing">
          <StylizedLens>
            <SettingSlider field="lensingBubble" />
          </StylizedLens>
        </SettingsFine>
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
          <SettingSlider field="orbitInclination" />
          <SettingSlider field="orbitTiltSky" />
          <SettingSlider field="orbitNodeSpread" />
          <SettingSlider field="orbitRetrograde" />
          <SettingSlider field="orbitClosest" />
          <SettingSlider field="orbitEscape" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="orbitDrag" />
            <SettingSlider field="orbitFadeIn" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="flows" title="Flows">
        {/* Three bands of matter told where to go: each its brightness, its count, its path and its colour */}
        {FLOW_KEYS.map((keys, index) => (
          <div key={keys.slot} className={index > 0 ? 'mt-3 flex flex-col gap-1' : 'flex flex-col gap-1'}>
            <SettingSlider field={keys.brightness} />
            <SettingSlider field={keys.count} />
            <SettingSlider field={keys.from} />
            <SettingSlider field={keys.to} />
            <SettingSlider field={keys.swirl} />
            <SettingSlider field={keys.life} />
            <SettingSlider field={keys.tilt} />
            <SettingColor field={keys.color} />
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-1">
          <SettingSlider field="flowTrace" />
        </div>
        <SettingsFine id="flows">
          {/* The band's width, the trail and the stroke of each flow, which hole it turns round, the side its tilt brings up and how far it faces the camera, its path's law, and its thickness and the disc's shape */}
          {FLOW_KEYS.map((keys, index) => (
            <div key={keys.slot} className={index > 0 ? 'mt-3 flex flex-col gap-1' : 'flex flex-col gap-1'}>
              <SettingSlider field={keys.spread} />
              <SettingSlider field={keys.trail} />
              <SettingSlider field={keys.size} />
              <SettingSlider field={keys.pair} />
              <SettingSlider field={keys.node} />
              <SettingSlider field={keys.face} />
              <SettingSlider field={keys.fall} />
              <SettingSlider field={keys.falloff} />
              <SettingSlider field={keys.thick} />
              <SettingSlider field={keys.flare} />
              <SettingSlider field={keys.bell} />
            </div>
          ))}
          {/* What every flow shares: the plane round a pair, the draws of a disc's heights, the fades, brightness and trail, the 3D near fade, the seed and the ring; then how the traced disc hides and shifts */}
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="flowPairPlane" />
            <SettingSlider field="flowLiftPower" />
            <SettingSlider field="flowPhaseSpread" />
            <SettingSlider field="flowLiftRenew" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="flowFadeIn" />
            <SettingSlider field="flowFadeOut" />
            <SettingSlider field="flowDimmest" />
            <SettingSlider field="flowTrailFade" />
            <SettingSlider field="flowNearFade" />
            <SettingSlider field="flowNearGone" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="flowSeed" />
            <SettingSlider field="flowRingFeed" />
            <SettingSlider field="flowRingFlicker" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="flowTraceHide" />
            <SettingSlider field="flowTraceDoppler" />
            <SettingSlider field="flowTraceBeam" />
            <SettingSlider field="flowTraceTint" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="space-grid" title="Space Grid">
        {/* The sheet and its shape, the lattice and its shape, the grid behind the lens and its pull, then the cell the sheet and that grid share, the grid on the horizon and its cells, then the colour of all four */}
        <SettingSlider field="gridSheet" />
        <SettingSlider field="gridTilt" />
        <SettingSlider field="gridDepth" />
        <SettingSlider field="gridRings" />
        <SettingSlider field="gridRide" />
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
          <SettingSlider field="gridHorizon" />
          <SettingSlider field="gridHorizonCells" />
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <SettingColor field="gridColor" />
        </div>
        <SettingsFine id="space-grid">
          {/* The sheet (its lines, its flat camera, its edges, the wave, the slab its particles ride in, then its laws: rings, lift, second well, lens, 3D ease, and how the particles ride), the lattice, the grid behind the lens and the grid on the horizon */}
          <div className="flex flex-col gap-1">
            <SettingSlider field="gridSpokes" />
            <SettingSlider field="gridLine" />
            <SettingSlider field="gridLineNear" />
            <SettingSlider field="gridDistance" />
            <SettingSlider field="gridNear" />
            <SettingSlider field="gridSpan" />
            <SettingSlider field="gridFade" />
            <SettingSlider field="gridClearing" />
            <SettingSlider field="gridClearingEdge" />
            <SettingSlider field="gridWaveLift" />
            <SettingSlider field="gridWaveOrbit" />
            <SettingSlider field="gridRideDepth" />
            <SettingSlider field="gridRingSpacing" />
            <SettingSlider field="gridLift" />
            <SettingSlider field="gridWell2Bottom" />
            <SettingSlider field="gridLensed" />
            <SettingSlider field="gridEaseTurn" />
            <SettingSlider field="gridRideSoft" />
            <SettingSlider field="gridRideFar" />
            <SettingSlider field="gridRideWave" />
            <SettingSlider field="gridRideCut" />
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
            <SettingSlider field="gridSkySphere" />
            <SettingSlider field="gridSkySlant" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="gridHorizonPace" />
            <SettingSlider field="gridHorizonLine" />
            <SettingSlider field="gridHorizonHaze" />
            <SettingSlider field="gridHorizonHazeFrom" />
            <SettingSlider field="gridHorizonHazeTo" />
            <SettingSlider field="gridHorizonCellsAround" />
            <SettingSlider field="gridHorizonShift" />
            <SettingSlider field="gridHorizonCompanion" />
          </div>
        </SettingsFine>
      </SettingsSection>

      <SettingsSection id="stars" title="Background Stars">
        <SettingSlider field="starsBrightness" />
        <SettingSlider field="starDensity" />
        <SettingSlider field="starCell" />
        <SettingsFine id="stars">
          {/* A star's tints, its size and spread of brightness, then its twinkle; how stars fill their cells; the sky's centre, its sphere and how the flat backdrop turns into it */}
          <SettingColor field="starsColorWarm" />
          <SettingColor field="starsColorCool" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="starsSize" />
            <SettingSlider field="starsFaintest" />
            <SettingSlider field="starsTwinkle" />
            <SettingSlider field="starsTwinkleSpeed" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="starsPlacement" />
            <SettingSlider field="starsPerCell" />
            <SettingSlider field="starsNeighbors" />
            <SettingSlider field="starsCellWarp" />
            <SettingSlider field="starsSkyEven" />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="skyCenter" />
            <SettingSlider field="skySize" />
            <SettingSlider field="skyEaseBend" />
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
          {/* The clouds' look, their drift, the second colour's patches, where the core colour starts, then the layers of noise they are made of */}
          <SettingSlider field="nebulaEdge" />
          <SettingSlider field="nebulaWarp" />
          <SettingSlider field="nebulaContrast" />
          <SettingSlider field="nebulaGrain" />
          <SettingSlider field="nebulaDrift" />
          <SettingSlider field="nebulaDriftAngle" />
          <SettingSlider field="nebulaDriftFollow" />
          <SettingSlider field="nebulaPatch" />
          <SettingSlider field="nebulaPatchShare" />
          <SettingSlider field="nebulaPatchSoftness" />
          <SettingSlider field="nebulaCoreFrom" />
          <div className="mt-3 flex flex-col gap-1">
            <SettingSlider field="nebulaDetail" />
            <SettingSlider field="nebulaLacunarity" />
            <SettingSlider field="nebulaRoughness" />
            <SettingSlider field="nebulaCurlSize" />
            <SettingSlider field="nebulaGrainSize" />
          </div>
        </SettingsFine>
      </SettingsSection>
    </div>
  )
}

export default SettingsBody
