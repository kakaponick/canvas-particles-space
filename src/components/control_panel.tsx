import { useState, useEffect } from 'react'
import { useControlPanelStore } from '../hooks/use_control_panel_store'
import { useParticleStore } from '../store/particle_store'
import ColorPalette from './controls/color_palette'
import SliderControl from './controls/slider_control'
import ColorPickerInput from './controls/color_picker_input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { hexToRgb, rgbToHex } from '../lib/utils'
import { Play, Pause, Settings, Maximize, Minimize } from 'lucide-react'
import HelpTooltip from './controls/help_tooltip'
import ToggleButton from './controls/toggle_button'
import FrameRateControl from './controls/frame_rate_control'
import { useIntroDebugStore } from '../store/intro_debug_store'

function ControlPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.log('Fullscreen toggle failed:', error)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const {
    numParticles,
    baseSpeed,
    gravityStrength,
    orbitalStrength,
    blackHoleSize,
    eventHorizon,
    gravityReach,
    ringBrightness,
    ringWidth,
    ringDoppler,
    ringSide,
    ringBase,
    ringFeed,
    ringAfterglow,
    ringFlowSpeed,
    followFrequency,
    scrollSpeedGain,
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
    setRingBrightness,
    setRingWidth,
    setRingDoppler,
    setRingSide,
    setRingBase,
    setRingFeed,
    setRingAfterglow,
    setRingFlowSpeed,
    setFollowFrequency,
    setScrollSpeedGain,
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
  } = useControlPanelStore()

  const isPaused = useParticleStore(state => state.isPaused)
  const introDebugOpen = useIntroDebugStore(state => state.open)
  const setIntroDebugOpen = useIntroDebugStore(state => state.setOpen)
  const togglePause = useParticleStore(state => state.togglePause)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <div className="fixed bottom-5 left-5 flex gap-2 z-40" style={{
        marginBottom: 'var(--intro-dock-height, 0px)',
        opacity: isOpen ? 0 : 1,
        pointerEvents: isOpen ? 'none' : 'auto',
        transition: 'opacity 300ms'
      }}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono"
            style={{
              boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          className="bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono"
          style={{
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
          }}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>

      <SheetContent
        side="left"
        className="bg-[rgba(10,10,15,0.98)] min-w-[380px] max-h-screen overflow-y-auto pointer-events-auto">
        <TooltipProvider delayDuration={500} skipDelayDuration={0}>
          <SheetHeader>
            <SheetTitle className="font-orbitron text-neon-cyan text-xl text-center" style={{ textShadow: '0 0 10px #00ffff' }}>
              SETTINGS
            </SheetTitle>
            <SheetDescription className="text-center text-text-light/70 text-xs">
              Adjust particle simulation parameters
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">

            {/* Play/Pause Control */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neon-cyan/20">
              <div className="flex items-center gap-2">
                <h3 className="font-orbitron text-neon-cyan text-base">Animation Control</h3>
                <HelpTooltip
                  content="Manually control animation playback. Animation automatically pauses when the browser tab becomes inactive to save resources and resumes when you return to the tab."
                />
              </div>
              <ToggleButton
                active={!isPaused}
                onClick={togglePause}
                className="flex items-center gap-2"
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    PLAY
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    PAUSE
                  </>
                )}
              </ToggleButton>
            </div>

            <FrameRateControl />

            <div className="flex items-center justify-between mb-4 pb-4 border-b border-neon-cyan/20">
              <div className="flex items-center gap-2">
                <h3 className="font-orbitron text-neon-cyan text-base">Intro Debugger</h3>
                <HelpTooltip
                  content="Replays the opening seconds with a timeline, playback speed down to a full stop, and switches for each effect. Shortcut: Shift+D, or open the page with ?debug in the address."
                />
              </div>
              <ToggleButton active={introDebugOpen} onClick={() => setIntroDebugOpen(!introDebugOpen)}>
                {introDebugOpen ? 'ON' : 'OFF'}
              </ToggleButton>
            </div>

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
              min={0}
              max={20}
              step={0.1}
              formatValue={(val) => val.toFixed(1)}
              onChange={setBaseSpeed}
              variant="inline"
              description="Base velocity of particles moving through space. Combined with scroll speed for final movement rate."
            />

            <SliderControl
              id="scroll-speed-gain"
              label="Scroll Speed Gain"
              value={scrollSpeedGain}
              min={0}
              max={40}
              step={0.5}
              formatValue={(val) => `${val.toFixed(1)}×`}
              onChange={setScrollSpeedGain}
              variant="inline"
              description="Flight speed added when the page is scrolled all the way down."
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



            <h3 className="font-orbitron text-neon-cyan text-base mb-2 mt-4">Particle Lighting</h3>

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

            <div className="flex gap-2 items-stretch">
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
            </div>

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

            <h3 className="font-orbitron text-neon-cyan text-base mb-2">Background Stars</h3>

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

            <h3 className="font-orbitron text-neon-cyan text-base mb-2">Black Hole Physics</h3>

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

<div className="flex items-center justify-between mb-3">
              <h3 className="font-orbitron text-neon-cyan text-base">Gravitational Lensing WebGL</h3>
              
              <ToggleButton active={lensingEnabled} onClick={toggleLensing}>
                {lensingEnabled ? 'ON' : 'OFF'}
              </ToggleButton>
            </div>

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
          </div>

          <div className="mt-6">
            
          </div>

          <div className="mt-6">
            <ColorPalette />

            {/* Background Color Controls */}
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
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}

export default ControlPanel
