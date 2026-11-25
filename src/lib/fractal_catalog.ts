// What a Mandelbrot zoom can fall into and be painted with, as plain data: the page's Mandelbrot panel
// reads it with the page, while the code that plans and draws a zoom (fractal.ts, fractal_live.ts) is
// loaded only when a zoom is asked for.

export interface FractalTarget {
  // A double near the point; Newton's method finds the point itself to any depth
  near: [number, number]
  preperiod: number
  period: number
  // A few words for the page's panel
  label: string
  about: string
  // Steps of the escape count one loop of the palette spans, unless a film names its own
  cycle: number
}

// Targets that fall forever. Each is a Misiurewicz point, placed by Newton's method to any depth
export const FRACTAL_TARGETS: Record<string, FractalTarget> = {
  spiral: {
    near: [-0.7432918908524302, 0.1312405523087976], preperiod: 24, period: 2, cycle: 8,
    label: 'Spiral',
    about: 'deep in seahorse valley: a double spiral of seahorse tails with many turns (the default)'
  },
  seahorse: {
    near: [-0.7467919802471212, 0.1328189889547674], preperiod: 19, period: 5, cycle: 6,
    label: 'Seahorse',
    about: 'the edge of seahorse valley: lace of five-armed spirals beside open space'
  },
  elephant: {
    near: [0.2923332184434171, 0.0167024057264140], preperiod: 31, period: 3, cycle: 6,
    label: 'Elephant',
    about: 'Elephant valley: trunks curling into three-armed spirals'
  },
  triple: {
    near: [-0.1011037579721042, 0.9562940079523541], preperiod: 37, period: 4, cycle: 6,
    label: 'Stars',
    about: 'the top of the set: branching filaments that fork in four at every scale'
  },
  dendrite: {
    near: [0, 1], preperiod: 2, period: 2, cycle: 6,
    label: 'Tree',
    about: 'c = i, the tip of the top antenna: a bare tree of filaments, the same at every depth'
  }
}

export const DEFAULT_TARGET = 'spiral'

// Palettes as colours around a loop; the last runs back into the first
export const FRACTAL_PALETTES: Record<string, string[]> = {
  classic: ['#000764', '#206bcb', '#edffff', '#ffaa00', '#000200'],
  fire: ['#050000', '#5c0a05', '#c4300a', '#ff8c1a', '#ffe08a', '#fffbe8', '#ff8c1a', '#5c0a05'],
  ice: ['#02060f', '#0b2a4a', '#2f7fb5', '#a9e4ff', '#ffffff', '#5aa0c8', '#123a5e'],
  neon: ['#0b0221', '#7a04eb', '#ff00a0', '#ffdb00', '#00e5ff', '#1a0640'],
  gold: ['#0d0a05', '#4a2c0a', '#c08a2c', '#f8e1a0', '#fffaf0', '#8a5a1c'],
  mono: ['#000000', '#ffffff'],
  aurora: ['#020812', '#06373d', '#11a37f', '#b6f56b', '#f2f7d5', '#6b3fa0', '#1c0b3a']
}

export const DEFAULT_PALETTE = 'classic'

// The palettes' names as the page's panel says them
export const PALETTE_LABELS: Record<string, string> = {
  classic: 'Classic', fire: 'Fire', ice: 'Ice', neon: 'Neon', gold: 'Gold', mono: 'Black and white', aurora: 'Aurora'
}

// Powers of ten a second the camera falls by unless told otherwise, and the most a zoom may reach: about
// 6 700 bits of precision for the target
export const DEFAULT_RATE = 0.5
export const MAX_DEPTH = 2000

// A palette's colours as 0..1 RGB triples, one after another, as the shader takes them
export function paletteStops (colors: readonly string[]): number[] {
  return colors.flatMap(color => {
    const hex = color.replace('#', '')
    const full = hex.length === 3 ? hex.split('').map(digit => digit + digit).join('') : hex
    return [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16) / 255)
  })
}

// The magnification as "2.4 × 10" and the power to raise after it ("41"); under a thousand it is written out
export function magnification (decades: number) {
  const power = Math.floor(decades)
  const lead = 10 ** (decades - power)
  return power < 3
    ? { lead: `×${Math.round(10 ** decades).toLocaleString('en-US')}`, power: '' }
    : { lead: `${lead.toFixed(1)} × 10`, power: String(power) }
}
