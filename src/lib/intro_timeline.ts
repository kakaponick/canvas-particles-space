// Choreography of the opening seconds: a star collapses, a shockwave births the field,
// a black hole forms and swallows the title, then drifts to the visitor's cursor.

export interface IntroFrame {
  starGlow: number
  // Star radius as a share of the viewport's short side
  starRadius: number
  flash: number
  // Shockwave progress 0..1; the front travels past the screen corners
  wave: number
  waveStrength: number
  // Share of the field already revealed behind the front; 1 shows everything
  reveal: number
  opacityScale: number
  speedBoost: number
  holeScale: number
  titleAlpha: number
  titleScale: number
  titleSpin: number
  // While true the black hole stays at the screen center
  holdAtCenter: boolean
  done: boolean
}

const COLLAPSE_AT = 0.6
const WAVE_END = 2.4
const INTRO_END = 5
const REDUCED_INTRO_END = 2.6

function progress (t: number, start: number, end: number) {
  return Math.min(Math.max((t - start) / (end - start), 0), 1)
}

const easeInCubic = (p: number) => p * p * p
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutBack = (p: number) => {
  const overshoot = 1.4
  const q = p - 1
  return 1 + (overshoot + 1) * q * q * q + overshoot * q * q
}

export function createIntroFrame (): IntroFrame {
  return {
    starGlow: 0,
    starRadius: 0,
    flash: 0,
    wave: 0,
    waveStrength: 0,
    reveal: 0,
    opacityScale: 1,
    speedBoost: 1,
    holeScale: 0,
    titleAlpha: 0,
    titleScale: 1,
    titleSpin: 0,
    holdAtCenter: true,
    done: false
  }
}

function sampleFullIntro (t: number, frame: IntroFrame) {
  const charge = progress(t, 0.1, COLLAPSE_AT)
  frame.starGlow = 1.4 * charge * charge * (1 - progress(t, COLLAPSE_AT, COLLAPSE_AT + 0.15))
  frame.starRadius = 0.004 + 0.01 * charge

  frame.flash = t < COLLAPSE_AT
    ? 0
    : 0.9 * progress(t, COLLAPSE_AT, COLLAPSE_AT + 0.06) * Math.exp(-Math.max(t - COLLAPSE_AT - 0.06, 0) * 3.2)

  const wave = easeOutCubic(progress(t, COLLAPSE_AT, WAVE_END))
  frame.wave = wave
  frame.waveStrength = t >= COLLAPSE_AT && t < WAVE_END ? 1 - wave : 0
  frame.reveal = t < COLLAPSE_AT ? 0 : t >= WAVE_END ? 1 : wave
  frame.opacityScale = 1
  frame.speedBoost = t < COLLAPSE_AT ? 1 : 1 + 5 * (1 - easeOutCubic(progress(t, COLLAPSE_AT, 3)))

  frame.holeScale = easeOutBack(progress(t, 1.3, 2.9))

  const swallow = progress(t, 3.2, 4.5)
  frame.titleAlpha = progress(t, 1.7, 2.3) * (1 - progress(t, 4.1, 4.5))
  frame.titleScale = 1 - easeInCubic(swallow)
  frame.titleSpin = easeInCubic(swallow) * 2.6

  frame.holdAtCenter = t < 4.6
  frame.done = t >= INTRO_END
}

// Reduced motion: no flash, no shockwave, no spin; the field and the hole fade in
function sampleReducedIntro (t: number, frame: IntroFrame) {
  frame.starGlow = 0
  frame.starRadius = 0
  frame.flash = 0
  frame.wave = 1
  frame.waveStrength = 0
  frame.reveal = 1
  frame.opacityScale = easeOutCubic(progress(t, 0, 1.2))
  frame.speedBoost = 1
  frame.holeScale = easeOutCubic(progress(t, 0.2, 1.4))
  frame.titleAlpha = progress(t, 0.6, 1) * (1 - progress(t, 2, 2.5))
  frame.titleScale = 1
  frame.titleSpin = 0
  frame.holdAtCenter = t < REDUCED_INTRO_END
  frame.done = t >= REDUCED_INTRO_END
}

export interface IntroMarker {
  time: number
  label: string
}

// Phase boundaries, for the intro debugger's timeline
const FULL_MARKERS: IntroMarker[] = [
  { time: 0, label: 'dark' },
  { time: 0.1, label: 'star' },
  { time: COLLAPSE_AT, label: 'collapse' },
  { time: 1.3, label: 'hole forms' },
  { time: 1.7, label: 'title' },
  { time: WAVE_END, label: 'wave out' },
  { time: 3.2, label: 'swallow' },
  { time: 4.6, label: 'release' },
  { time: INTRO_END, label: 'end' }
]

const REDUCED_MARKERS: IntroMarker[] = [
  { time: 0, label: 'fade in' },
  { time: 0.6, label: 'title' },
  { time: 2, label: 'title out' },
  { time: REDUCED_INTRO_END, label: 'end' }
]

export function getIntroMarkers (reducedMotion: boolean) {
  return reducedMotion ? REDUCED_MARKERS : FULL_MARKERS
}

export function getIntroDuration (reducedMotion: boolean) {
  return reducedMotion ? REDUCED_INTRO_END : INTRO_END
}

export function getIntroPhase (t: number, reducedMotion: boolean) {
  const markers = getIntroMarkers(reducedMotion)
  let phase = markers[0].label
  for (const marker of markers) {
    if (t >= marker.time) phase = marker.label
  }
  return phase
}

export function sampleIntro (t: number, reducedMotion: boolean, frame: IntroFrame) {
  if (reducedMotion) sampleReducedIntro(t, frame)
  else sampleFullIntro(t, frame)
  return frame
}
