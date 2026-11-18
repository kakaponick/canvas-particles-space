import { useInteractionHints } from '../../hooks/use_interaction_hints'
import { useParticleStore } from '../../store/particle_store'

const isTouchScreen = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// Bottom line of hints for the interactions the visitor has not tried yet
function InteractionHints () {
  const introComplete = useParticleStore(state => state.introComplete)
  const used = useInteractionHints()

  const hints = isTouchScreen
    ? [!used.drag && 'DRAG THE BLACK HOLE']
    : [!used.move && 'MOVE TO BEND LIGHT', !used.click && 'CLICK TO ANCHOR']
  const label = hints.filter(Boolean).join(' · ')

  return (
    <div
      className={`fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-[500] w-[min(84vw,640px)] text-center
        font-orbitron text-[11px] leading-relaxed text-neon-cyan tracking-[1px] text-balance
        pointer-events-none transition-opacity duration-700 ease-out ${introComplete && label ? 'opacity-100' : 'opacity-0'}`}
      style={{ marginBottom: 'var(--intro-dock-height, 0px)', textShadow: '0 0 10px #00ffff' }}
    >
      {label}
    </div>
  )
}

export default InteractionHints
