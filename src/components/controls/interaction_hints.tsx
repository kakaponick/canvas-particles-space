import { useEffect, useState } from 'react'
import { useInteractionHints } from '../../hooks/use_interaction_hints'
import { useParticleStore } from '../../store/particle_store'

const isTouchScreen = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// Whether the scene holds the keyboard's focus: a Tab landed on it, or a key was pressed on it after a click
function useSceneKeyboardFocus () {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const sync = () => {
      const active = document.activeElement
      setFocused(active instanceof HTMLCanvasElement && active.matches(':focus-visible'))
    }
    window.addEventListener('focusin', sync)
    window.addEventListener('focusout', sync)
    window.addEventListener('keyup', sync)
    return () => {
      window.removeEventListener('focusin', sync)
      window.removeEventListener('focusout', sync)
      window.removeEventListener('keyup', sync)
    }
  }, [])
  return focused
}

// Bottom line of hints: the scene's keys while it holds the keyboard's focus, otherwise the interactions
// the visitor has not tried yet
function InteractionHints () {
  const introComplete = useParticleStore(state => state.introComplete)
  const threeD = useParticleStore(state => state.threeD)
  const used = useInteractionHints()
  const keyboard = useSceneKeyboardFocus()

  const orbit = threeD && !used.orbit && (isTouchScreen ? 'SWIPE TO CIRCLE THE HOLE' : 'DRAG TO CIRCLE THE HOLE')
  const hints = isTouchScreen
    // In 3D a swipe turns the camera instead of changing the speed
    ? [orbit, !used.drag && 'DRAG THE BLACK HOLE', !threeD && !used.scroll && 'SWIPE TO CHANGE SPEED']
    // Only an anchored black hole can be dragged, so that hint waits for the first click
    : [
      orbit,
      !used.move && 'MOVE TO BEND LIGHT',
      !used.click && 'CLICK TO ANCHOR',
      used.click && !used.drag && 'DRAG IT TO MOVE · DOUBLE-CLICK TO CENTER',
      !used.scroll && 'SCROLL TO CHANGE SPEED'
    ]
  const keys = threeD ? 'ARROWS CIRCLE THE HOLE · + − ZOOM · HOME RESETS' : '+ − ZOOM · ARROWS PAN WHEN ZOOMED · HOME RESETS'
  const label = keyboard ? keys : hints.filter(Boolean).join(' · ')

  return (
    <div
      className={`interaction-hints fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 w-[min(84vw,640px)] text-center
        font-orbitron text-[11px] leading-relaxed text-neon-cyan tracking-[1px] text-balance
        pointer-events-none transition-opacity duration-700 ease-out ${introComplete && label ? 'opacity-100' : 'opacity-0'}`}
      style={{ marginBottom: 'var(--intro-dock-height, 0px)', textShadow: '0 0 10px #00ffff' }}
    >
      {label}
    </div>
  )
}

export default InteractionHints
