import { useEffect, useState } from 'react'
import { useParticleStore } from '../store/particle_store'

function BlackHoleIndicator () {
  const [show, setShow] = useState(false)
  const blackHoleAttached = useParticleStore((state) => state.blackHoleAttached)

  useEffect(() => {
    setShow(true)
    const timeout = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(timeout)
  }, [blackHoleAttached])

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[500] font-orbitron text-xs 
        px-4 py-2 bg-[rgba(0,0,0,0.7)] border rounded-md pointer-events-none transition-opacity duration-300
        ${show ? 'opacity-100' : 'opacity-0'} tracking-[1px]`}
      style={{
        color: blackHoleAttached ? '#00ffff' : '#ff00ff',
        textShadow: blackHoleAttached ? '0 0 8px #00ffff' : '0 0 8px #ff00ff',
        borderColor: blackHoleAttached ? '#00ffff' : '#ff00ff'
      }}
    >
      {blackHoleAttached ? '⚫ BLACK HOLE: ATTACHED' : '⭕ BLACK HOLE: DETACHED'}
    </div>
  )
}

export default BlackHoleIndicator

