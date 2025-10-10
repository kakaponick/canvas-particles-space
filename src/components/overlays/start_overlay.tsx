import { useState } from 'react'
import { useParticleStore } from '../../store/particle_store'

function StartOverlay () {
  const [show, setShow] = useState(true)

  const handleStart = () => {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen failed, continue anyway
    })
    useParticleStore.getState().startAnimation()
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(2,2,5,0.95)] z-[10000] flex flex-col justify-center items-center cursor-pointer transition-opacity duration-500"
      onClick={handleStart}
    >
      <div className="font-orbitron text-4xl text-neon-cyan animate-[text-pulse_2s_infinite] mb-2 tracking-[2px]">
        CLICK TO START
      </div>
      <div className="font-mono text-sm text-text-dim tracking-[1px]">
        experience the speed of light
      </div>
    </div>
  )
}

export default StartOverlay

