import { useState, useRef, useEffect } from 'react'
import { useControlPanelStore } from '../hooks/use_control_panel_store'
import ColorPalette from './color_palette'
import SliderControl from './slider_control'
import ColorPickerInput from './color_picker_input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { hexToRgb, rgbToHex } from '../lib/utils'

function ControlPanel () {
  const [isOpen, setIsOpen] = useState(false)
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current += 1
    console.log(`ControlPanel render count: ${renderCount.current}`)
  })

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
    setNumParticles,
    setBaseSpeed,
    setGravityStrength,
    setOrbitalStrength,
    setEventHorizon,
    setMouseRadius,
    setPulseIntensity,
    setBackgroundColor,
    setLensingMass,
    toggleLensing
  } = useControlPanelStore()

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
          {/* <Settings className="w-5 h-5 text-neon-cyan" /> */}
          SETTINGS
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="bg-[rgba(10,10,15,0.98)] min-w-[380px] max-h-screen overflow-y-auto pointer-events-auto">
        <SheetHeader>
          <SheetTitle className="font-orbitron text-neon-cyan text-xl text-center" style={{ textShadow: '0 0 10px #00ffff' }}>
            SETTINGS
          </SheetTitle>
          <SheetDescription className="text-center text-text-light/70 text-xs">
            Adjust particle simulation parameters
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">

        <h3 className="font-orbitron text-neon-cyan text-base mb-2">Physics</h3>

          <SliderControl
            id="particles"
            label="Particles"
            value={numParticles}
            min={1000}
            max={20000}
            step={1000}
            onChange={setNumParticles}
            variant="inline"
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
          />

          <SliderControl
            id="mouse-radius"
            label="Back Hole Radius"
            value={mouseRadius}
            min={0}
            max={1000}
            step={50}
            onChange={setMouseRadius}
            variant="inline"
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
          />

          <div className="mt-5">
            <h3 className="font-orbitron text-neon-cyan text-base mb-2">Gravitational Lensing</h3>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-light/90 text-sm">Enable Lensing</span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLensing}
                className={`${
                  lensingEnabled
                    ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
                    : 'bg-transparent border-text-light/30 text-text-light/50'
                } hover:bg-neon-cyan/30`}
              >
                {lensingEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>

            <SliderControl
              id="lensing-mass"
              label="Lensing Mass"
              value={lensingMass}
              min={0}
              max={10000}
              step={10}
              onChange={setLensingMass}
              variant="inline"
            />
          </div>

        </div>

        <div className="mt-5">
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

      </SheetContent>
    </Sheet>
  )
}

export default ControlPanel
