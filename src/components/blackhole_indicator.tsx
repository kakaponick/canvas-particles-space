import { useEffect, useState } from 'react'
import { useParticleStore } from '../store/particle_store'

function BlackHoleIndicator () {
  const [show, setShow] = useState(false)
  const blackHoleFollowing = useParticleStore((state) => state.blackHoleFollowing)

  useEffect(() => {
    setShow(true)
    const timeout = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(timeout)
  }, [blackHoleFollowing])

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[500] font-orbitron text-xs 
        px-4 py-2 bg-[rgba(0,0,0,0.7)] border rounded-md pointer-events-none transition-opacity duration-300
        ${show ? 'opacity-100' : 'opacity-0'} tracking-[1px]`}
      style={{
        color: blackHoleFollowing ? '#00ffff' : '#ff00ff',
        textShadow: blackHoleFollowing ? '0 0 8px #00ffff' : '0 0 8px #ff00ff',
        borderColor: blackHoleFollowing ? '#00ffff' : '#ff00ff'
      }}
    >
      {blackHoleFollowing ? '⚫ BLACK HOLE: FOLLOWING' : '⭕ BLACK HOLE: FIXED'}
    </div>
  )
}

export default BlackHoleIndicator

