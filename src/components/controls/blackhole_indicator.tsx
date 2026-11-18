import { useEffect, useRef, useState } from 'react'
import { useParticleStore } from '../../store/particle_store'

// Confirms a click that anchors or releases the black hole; silent on page load
function BlackHoleIndicator () {
  const [show, setShow] = useState(false)
  const blackHoleFollowing = useParticleStore((state) => state.blackHoleFollowing)
  const shownValue = useRef(blackHoleFollowing)

  useEffect(() => {
    if (shownValue.current === blackHoleFollowing) return
    shownValue.current = blackHoleFollowing
    setShow(true)
    const timeout = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(timeout)
  }, [blackHoleFollowing])

  return (
    <div
      role="status"
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[500] font-orbitron text-xs whitespace-nowrap
        px-4 py-2 bg-[rgba(0,0,0,0.7)] border rounded-md pointer-events-none transition-opacity duration-300
        ${show ? 'opacity-100' : 'opacity-0'} tracking-[1px]`}
      style={{
        color: blackHoleFollowing ? '#00ffff' : '#ff00ff',
        textShadow: blackHoleFollowing ? '0 0 8px #00ffff' : '0 0 8px #ff00ff',
        borderColor: blackHoleFollowing ? '#00ffff' : '#ff00ff'
      }}
    >
      {blackHoleFollowing ? 'BLACK HOLE: FOLLOWING' : 'BLACK HOLE: ANCHORED'}
    </div>
  )
}

export default BlackHoleIndicator
