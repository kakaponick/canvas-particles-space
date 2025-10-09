import { useEffect, useState } from 'react'

interface UseScrollProgressOptions {
  onScroll?: (progress: number) => void
}

export function useScrollProgress (options?: UseScrollProgressOptions) {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = document.body.scrollHeight - window.innerHeight
      const progress = maxScroll > 0 ? scrollY / maxScroll : 0
      
      setScrollProgress(progress)
      options?.onScroll?.(progress)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initialize on mount
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [options])

  return scrollProgress
}

