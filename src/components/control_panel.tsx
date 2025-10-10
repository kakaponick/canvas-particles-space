import { useState } from 'react'
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
import { Play, Pause } from 'lucide-react'
import HelpTooltip from './controls/help_tooltip'

function ControlPanel() {
  const [isOpen, setIsOpen] = useState(false)

  const {
    numParticles,
    baseSpeed,
    gravityStrength,
    orbitalStrength,
    eventHorizon,
    mouseRadius,
    pulseIntensity,
    backgroundR,
    backgroundG,
    backgroundB,
    lensingMass,
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
    setEventHorizon,
    setMouseRadius,
    setPulseIntensity,
    setBackgroundColor,
    setLensingMass,
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
  const togglePause = useParticleStore(state => state.togglePause)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="fixed bottom-5 left-5 bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan z-40 hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono transition-opacity duration-300 data-[state=open]:opacity-0 data-[state=open]:pointer-events-none"
          style={{
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
            opacity: isOpen ? 0 : 1,
            pointerEvents: isOpen ? 'none' : 'auto'
          }}
        >
          SETTINGS
        </Button>
      </SheetTrigger>

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
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                className={`${isPaused
                    ? 'bg-transparent border-text-light/30 text-text-light/50'
                    : 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                  } hover:bg-neon-cyan/30 flex items-center gap-2`}
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
              </Button>
            </div>

            <SliderControl
              id="particles"
              label="Particles"
              value={numParticles}
              min={1000}
              max={20000}
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

            <h3 className="font-orbitron text-neon-cyan text-base mb-2">Black Hole Physics</h3>

            <SliderControl
              id="mouse-radius"
              label="Back Hole Radius"
              value={mouseRadius}
              min={0}
              max={1000}
              step={10}
              onChange={setMouseRadius}
              variant="inline"
              description="Radius of gravitational influence around the black hole. Particles within this distance are affected by gravity and orbital forces."
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
              id="event-horizon"
              label="Event Horizon"
              value={eventHorizon}
              min={0}
              max={100}
              step={5}
              onChange={setEventHorizon}
              variant="inline"
              description="Radius of no return around the black hole. Particles crossing this boundary are immediately destroyed and recycled."
            />

<div className="flex items-center justify-between mb-3">
              <h3 className="font-orbitron text-neon-cyan text-base">Gravitational Lensing WebGL</h3>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLensing}
                className={`${lensingEnabled
                    ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                    : 'bg-transparent border-text-light/30 text-text-light/50'
                  } hover:bg-neon-cyan/30`}
              >
                {lensingEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>

            <SliderControl
              id="lensing-mass"
              label="Lensing Radius"
              value={lensingMass}
              min={0}
              max={10000}
              step={10}
              onChange={setLensingMass}
              variant="inline"
              description="Intensity of WebGL gravitational lensing effect. Higher values create stronger light distortion around the black hole, simulating space-time curvature."
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
              description="Controls how quickly the lensing effect diminishes with distance. 1 = linear falloff (spread out), 2 = quadratic (realistic), 3 = sharp falloff (concentrated)."
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
              description="Controls how much light is absorbed near the black hole. 0 = no darkening, higher values create stronger shadow and darkness around the event horizon."
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
