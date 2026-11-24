import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Read once at load: the intro's moments and the debugger's timeline follow the setting the page opened with
export const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'password', 'tel', 'number'])

// A field that takes typed characters, so a single-key shortcut must leave its keys alone. A color swatch
// or a checkbox types nothing, so Escape and the shortcuts still work on it
export function isTextEntry (target: EventTarget | null) {
  return (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)) || target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
}

export function hexToRgb (hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

export function rgbToHex (r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

