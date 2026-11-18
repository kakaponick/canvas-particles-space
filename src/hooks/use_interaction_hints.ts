import { useEffect, useState } from 'react'

export interface InteractionsUsed {
  move: boolean
  click: boolean
  drag: boolean
  scroll: boolean
}

// Pointer travel that counts as "the visitor found out the black hole follows"
const MOVE_DISTANCE = 120
const SCROLL_PROGRESS = 0.05

/**
 * Tracks which of the canvas interactions the visitor has already tried,
 * so their hints can retire one by one.
 */
export function useInteractionHints (scrollProgress: number): InteractionsUsed {
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
    }
    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) mark('click')
    }
    // The canvas cancels the touches it uses to drag the black hole
    const handleTouchMove = (event: TouchEvent) => {
      if (event.defaultPrevented) mark('drag')
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('touchmove', handleTouchMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  useEffect(() => {
    if (scrollProgress > SCROLL_PROGRESS) setUsed(prev => (prev.scroll ? prev : { ...prev, scroll: true }))
  }, [scrollProgress])

  return used
}
