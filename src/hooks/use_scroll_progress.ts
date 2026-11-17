import { useEffect, useState } from 'react'

function readScrollProgress () {
  const maxScroll = document.body.scrollHeight - window.innerHeight
  return maxScroll > 0 ? window.scrollY / maxScroll : 0
}

/**
 * Calls `listener` with the page scroll progress (0..1) now and on every scroll.
 * Returns the unsubscribe function. Use it directly where no re-render is needed.
 */
export function subscribeScrollProgress (listener: (progress: number) => void) {
  const handleScroll = () => listener(readScrollProgress())
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
  return () => window.removeEventListener('scroll', handleScroll)
}

export function useScrollProgress () {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => subscribeScrollProgress(setScrollProgress), [])

  return scrollProgress
}
