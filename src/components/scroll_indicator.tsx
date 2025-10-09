import { useEffect, useState } from 'react'
import { Slider } from './ui/slider'

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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] text-center w-[250px]">
      <div className="font-orbitron text-xs text-neon-cyan mb-2.5 tracking-[1px]"
        style={{ textShadow: '0 0 10px #00ffff' }}>
        SCROLL TO REACH SPEED OF LIGHT
      </div>
      <Slider 
        value={[scrollProgress]} 
        max={100}
        className="[&>span[role=slider]]:hidden [&>span:first-child]:border [&>span:first-child]:border-neon-cyan/30 [&>span:first-child]:h-2"
      />
    </div>
  )
}

export default ScrollIndicator

