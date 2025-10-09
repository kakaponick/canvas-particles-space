import { useState, useRef, useEffect } from 'react'
import { useControlPanelStore } from '../hooks/use_control_panel_store'
import ColorPalette from './color_palette'
import SliderControl from './slider_control'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

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
    setNumParticles,
    setBaseSpeed,
    setGravityStrength,
    setOrbitalStrength,
    setEventHorizon,
    setMouseRadius,
    setPulseIntensity
  } = useControlPanelStore()

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="fixed top-5 right-5 bg-[rgba(10,10,15,0.95)] border-neon-cyan text-neon-cyan z-[999] hover:bg-[rgba(0,255,255,0.1)] hover:text-neon-cyan font-mono"
          style={{ boxShadow: isOpen ? '0 0 30px rgba(0, 255, 255, 0.5)' : '0 0 20px rgba(0, 255, 255, 0.3)' }}
        >
          <Settings className="w-5 h-5 text-neon-cyan" />
          CONTROLS
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-[rgba(10,10,15,0.98)] border-neon-cyan backdrop-blur-[10px] min-w-[380px] max-h-screen overflow-y-auto pointer-events-auto"
        style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)' }}
      >
        <SheetHeader>
          <SheetTitle className="font-orbitron text-neon-cyan text-xl text-center" style={{ textShadow: '0 0 10px #00ffff' }}>
            PARTICLE CONTROLS
          </SheetTitle>
          <SheetDescription className="text-center text-text-light/70 text-xs">
            Adjust particle simulation parameters
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Color Palette Section */}
          <ColorPalette />

          <SliderControl
            id="particles"
            label="Particles"
            value={numParticles}
            min={1000}
            max={10000}
            step={500}
            onChange={setNumParticles}
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
          />

          <SliderControl
            id="base-speed"
            label="Base Speed"
            value={baseSpeed}
            min={0.5}
            max={10}
            step={0.5}
            formatValue={(val) => val.toFixed(1)}
            onChange={setBaseSpeed}
          />

          <SliderControl
            id="mouse-radius"
            label="Back hole Radius"
            value={mouseRadius}
            min={10}
            max={1000}
            step={50}
            onChange={setMouseRadius}
          />

          <SliderControl
            id="gravity"
            label="Gravity"
            value={gravityStrength}
            min={0}
            max={20}
            step={1}
            onChange={setGravityStrength}
          />

          <SliderControl
            id="orbital-force"
            label="Orbital Force"
            value={orbitalStrength}
            min={0}
            max={1000}
            step={10}
            onChange={setOrbitalStrength}
          />

          <SliderControl
            id="event-horizon"
            label="Event Horizon"
            value={eventHorizon}
            min={10}
            max={300}
            step={10}
            onChange={setEventHorizon}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default ControlPanel
