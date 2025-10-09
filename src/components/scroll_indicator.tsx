import { useEffect, useState } from 'react'

function ScrollIndicator () {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = document.body.scrollHeight - window.innerHeight
      const progress = (scrollY / maxScroll) * 100
      setScrollProgress(Math.min(100, Math.max(0, progress)))
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] text-center pointer-events-none">
      <div className="font-orbitron text-xs text-neon-cyan mb-2.5 tracking-[1px]"
        style={{ textShadow: '0 0 10px #00ffff' }}>
        SCROLL TO REACH SPEED OF LIGHT
      </div>
      <div className="w-25 h-1 bg-[rgba(0,255,255,0.2)] rounded-sm mx-auto overflow-hidden border border-[rgba(0,255,255,0.3)]">
        <div
          className="h-full bg-neon-cyan transition-[width] duration-100"
          style={{
            width: `${scrollProgress}%`,
            boxShadow: '0 0 10px #00ffff'
          }}
        />
      </div>
    </div>
  )
}

export default ScrollIndicator

