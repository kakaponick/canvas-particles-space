import { useEffect, useState } from 'react'

export interface InteractionsUsed {
  move: boolean
  click: boolean
  drag: boolean
  scroll: boolean
}

// Pointer travel that counts as "the visitor found out the black hole follows"
const MOVE_DISTANCE = 120

/**
 * Tracks which of the canvas interactions the visitor has already tried,
 * so their hints can retire one by one.
 */
export function useInteractionHints (): InteractionsUsed {
  const [used, setUsed] = useState<InteractionsUsed>({ move: false, click: false, drag: false, scroll: false })

  useEffect(() => {
    let travelled = 0
    let lastX = NaN
    let lastY = NaN
    const mark = (key: keyof InteractionsUsed) => setUsed(prev => (prev[key] ? prev : { ...prev, [key]: true }))

    const handleMouseMove = (event: MouseEvent) => {
      if (lastX === lastX) travelled += Math.hypot(event.clientX - lastX, event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY
      if (travelled > MOVE_DISTANCE) mark('move')
      // The canvas shows the grabbing cursor while the mouse carries the black hole
      if (event.buttons & 1 && event.target instanceof HTMLCanvasElement && event.target.style.cursor === 'grabbing') mark('drag')
    }
    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) mark('click')
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof HTMLCanvasElement) mark('scroll')
    }
    // The canvas cancels the touches it uses to drag the black hole; the others swipe the speed
    const handleTouchMove = (event: TouchEvent) => {
      if (event.defaultPrevented) mark('drag')
      else if (event.target instanceof HTMLCanvasElement) mark('scroll')
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchmove', handleTouchMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return used
}
