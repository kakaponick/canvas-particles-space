import { useScrollProgress } from '../hooks/use_scroll_progress'

function ScrollIndicator () {
  const scrollProgress = useScrollProgress()

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] text-center">
      <div className="font-orbitron text-xs text-neon-cyan mb-2.5 tracking-[1px]"
        style={{ textShadow: '0 0 10px #00ffff' }}>
        SCROLL TO REACH SPEED OF LIGHT
      </div>
      <div className="w-full h-0.5 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-neon-cyan"
          style={{ 
            width: `${scrollProgress * 100}%`,
            boxShadow: '0 0 10px #00ffff'
          }}
        />
      </div>
    </div>
  )
}

export default ScrollIndicator

