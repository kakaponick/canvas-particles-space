import { useScrollProgress } from '../../hooks/use_scroll_progress'
import { useInteractionHints } from '../../hooks/use_interaction_hints'
import { useParticleStore } from '../../store/particle_store'

const isTouchScreen = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// Bottom HUD: hints for the interactions not yet tried, the speed bar, and the crossing message
function ScrollIndicator () {
  const scrollProgress = useScrollProgress()
  const introComplete = useParticleStore(state => state.introComplete)
  const horizonCrossed = useParticleStore(state => state.horizonCrossed)
  const used = useInteractionHints(scrollProgress)

  const hints = isTouchScreen
    ? [!used.drag && 'DRAG THE BLACK HOLE', !used.scroll && 'SCROLL TO REACH SPEED OF LIGHT']
    : [
      !used.move && 'MOVE TO BEND LIGHT',
      !used.click && 'CLICK TO ANCHOR',
      !used.scroll && 'SCROLL TO REACH SPEED OF LIGHT'
    ]
  const label = horizonCrossed
    ? 'EVENT HORIZON CROSSED · SCROLL UP TO RETURN'
    : hints.filter(Boolean).join(' · ')

  return (
    <div
      className={`fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[500] w-[min(84vw,640px)] text-center
        pointer-events-none transition-opacity duration-700 ease-out ${introComplete ? 'opacity-100' : 'opacity-0'}`}
      style={{ marginBottom: 'var(--intro-dock-height, 0px)' }}
    >
      <div
        className={`font-orbitron text-[11px] leading-relaxed text-neon-cyan mb-2.5 tracking-[1px] text-balance
          transition-opacity duration-500 ${label ? 'opacity-100' : 'opacity-0'}`}
        style={{ textShadow: '0 0 10px #00ffff' }}
      >
        {label || ' '}
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
