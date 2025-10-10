import { useState, useEffect } from 'react'
import { useParticleStore } from '../../store/particle_store'

function StartOverlay () {
  const [show, setShow] = useState(!import.meta.env.DEV)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Auto-start animation in development mode
      useParticleStore.getState().startAnimation()
    }
  }, [])

  const handleStart = () => {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen failed, continue anyway
    })
    useParticleStore.getState().startAnimation()
    
    // Start fade animation
    setIsFading(true)
    
    // Hide overlay after fade completes
    setTimeout(() => {
      setShow(false)
    }, 2000) // 2 second fade duration
  }

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 bg-[rgba(2,2,5,0.95)] z-[10000] flex flex-col justify-center items-center cursor-pointer transition-opacity duration-[2000ms] ease-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleStart}
    >
      <div className={`font-orbitron text-4xl text-neon-cyan mb-2 tracking-[2px] transition-all duration-[2000ms] ease-out ${
        isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-[text-pulse_2s_infinite]'
      }`}>
        CLICK TO START
      </div>
      <div className={`font-mono text-sm text-text-dim tracking-[1px] transition-all duration-[2000ms] ease-out ${
        isFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}>
        experience the speed of light
      </div>
    </div>
  )
}

export default StartOverlay

