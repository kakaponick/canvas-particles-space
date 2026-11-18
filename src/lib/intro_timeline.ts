// Choreography of the opening seconds. A star collapses and explodes: its light races outward at
// the on-screen speed of light, lighting dust as it passes, while the ejected matter (the particle
// field) follows more slowly. The core's light reddens away as it collapses, a black hole forms,
// rings down and sends out a gravitational wave, swallows the title, then drifts to the cursor.

export interface IntroTiming {
  // Seconds the light front needs to travel from the center to the screen corner
  lightCrossTime: number
  // Speed of the ejected matter as a share of the speed of light
  matterSpeed: number
}

export const DEFAULT_INTRO_TIMING: IntroTiming = {
  lightCrossTime: 0.8,
  matterSpeed: 0.4
}

// Every front is a share of the distance from the explosion to the farthest screen corner
export interface IntroFrame {
  starGlow: number
  // Star radius as a share of the viewport's short side
  starRadius: number
  // Luminosity of the explosion as seen by the camera, in multiples of a full-white pixel
  sourcePower: number
  // Camera exposure: drops while the explosion is blinding, so nothing whites out
  exposure: number
  lightFront: number
  lightPower: number
  echoPower: number
  // Seconds a lit patch of dust keeps glowing after the light front passes
  echoDecay: number
  matterFront: number
  // Refraction at the matter front, 0..1
  waveStrength: number
  // Share of the field already revealed behind the matter front; 1 shows everything
  reveal: number
  backgroundStars: number
  remnantGlow: number
  // 0 = white-hot core, 1 = fully reddened as its light climbs out of the deepening well
  remnantRedshift: number
  // Black hole size before the ringdown wobble
  holeScale: number
  // Damped oscillation of the new horizon, applied as holeScale * (1 + ringdown)
  ringdown: number
  ringPower: number
  lensScale: number
  gravityWaveFront: number
  gravityWaveAmplitude: number
  opacityScale: number
  speedBoost: number
  titleAlpha: number
  titleScale: number
  titleSpin: number
  // While true the black hole stays at the screen center
  holdAtCenter: boolean
  done: boolean
}

const COLLAPSE_AT = 0.6
const REMNANT_AT = 1
const HORIZON_AT = 1.3
const HORIZON_GROWTH = 0.45
const RINGDOWN_AT = HORIZON_AT + HORIZON_GROWTH
const GRAVITY_WAVE_AT = RINGDOWN_AT
const INTRO_END = 5
const REDUCED_INTRO_END = 2.6

function progress (t: number, start: number, end: number) {
  return Math.min(Math.max((t - start) / (end - start), 0), 1)
}

const easeInCubic = (p: number) => p * p * p
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const smoothstep = (p: number) => p * p * (3 - 2 * p)

export function createIntroFrame (): IntroFrame {
  return {
    starGlow: 0,
    starRadius: 0,
    sourcePower: 0,
    exposure: 1,
    lightFront: 0,
    lightPower: 0,
    echoPower: 0,
    echoDecay: 0.5,
    matterFront: 0,
    waveStrength: 0,
    reveal: 0,
    backgroundStars: 0,
    remnantGlow: 0,
    remnantRedshift: 0,
    holeScale: 0,
    ringdown: 0,
    ringPower: 0,
    lensScale: 0,
    gravityWaveFront: 0,
    gravityWaveAmplitude: 0,
    opacityScale: 1,
    speedBoost: 1,
    titleAlpha: 0,
    titleScale: 1,
    titleSpin: 0,
    holdAtCenter: true,
    done: false
  }
}

function sampleFullIntro (t: number, timing: IntroTiming, frame: IntroFrame) {
  const sinceCollapse = Math.max(t - COLLAPSE_AT, 0)
  const exploded = t >= COLLAPSE_AT

  // The progenitor brightens, then is gone the instant it explodes
  const charge = progress(t, 0.1, COLLAPSE_AT)
  frame.starGlow = 1.4 * charge * charge * (exploded ? 0 : 1)
  frame.starRadius = 0.004 + 0.01 * charge

  // Light curve of the point source: a near-instant rise and a fast decline. It is gone before the
  // horizon forms; what keeps shining afterwards is the expanding matter, not the core
  frame.sourcePower = exploded
    ? progress(t, COLLAPSE_AT, COLLAPSE_AT + 0.04) * 6 * Math.exp(-sinceCollapse / 0.2)
    : 0
  frame.exposure = 1 / (1 + 0.35 * frame.sourcePower)

  // Light and matter fronts: light at c, matter at a fraction of it
  frame.lightFront = sinceCollapse / timing.lightCrossTime
  frame.lightPower = exploded ? 3 * Math.exp(-sinceCollapse / 1.2) : 0
  frame.echoPower = exploded ? 0.9 * Math.exp(-sinceCollapse / 1.5) : 0
  frame.echoDecay = 0.18
  frame.matterFront = frame.lightFront * timing.matterSpeed
  frame.waveStrength = exploded ? Math.max(1 - frame.matterFront, 0) : 0
  frame.reveal = exploded ? Math.min(frame.matterFront, 1) : 0
  frame.speedBoost = exploded ? 1 + 5 * Math.pow(Math.max(1 - frame.matterFront, 0), 2) : 1
  frame.opacityScale = 1

  // Distant stars are there all along; the dark opening only lets the eye find them
  frame.backgroundStars = 0.35 + 0.65 * smoothstep(progress(t, 0, 1.5))

  // The core: white-hot after the blast, then its light reddens and fades as it collapses
  frame.remnantGlow = progress(t, COLLAPSE_AT, REMNANT_AT) * Math.exp(-Math.max(t - REMNANT_AT, 0) / 0.35)
  frame.remnantRedshift = progress(t, REMNANT_AT, HORIZON_AT + 0.4)

  // The horizon: grows without overshoot, then rings down like a struck bell
  frame.holeScale = easeOutCubic(progress(t, HORIZON_AT, RINGDOWN_AT))
  const sinceRing = t - RINGDOWN_AT
  frame.ringdown = sinceRing > 0 ? 0.07 * Math.exp(-sinceRing / 0.35) * Math.sin(2 * Math.PI * 4.5 * sinceRing) : 0
  frame.ringPower = smoothstep(progress(t, HORIZON_AT + 0.1, RINGDOWN_AT + 0.15)) * (1 + 6 * frame.ringdown)
  frame.lensScale = smoothstep(progress(t, REMNANT_AT, RINGDOWN_AT + 0.2))

  // The ringdown radiates a gravitational wave, which also travels at c
  const sinceWave = t - GRAVITY_WAVE_AT
  frame.gravityWaveFront = Math.max(sinceWave, 0) / timing.lightCrossTime
  frame.gravityWaveAmplitude = sinceWave > 0 && frame.gravityWaveFront < 1.3 ? Math.exp(-sinceWave / 1.5) : 0

  const swallow = progress(t, 3.2, 4.5)
  frame.titleAlpha = progress(t, 1.7, 2.3) * (1 - progress(t, 4.1, 4.5))
  frame.titleScale = 1 - easeInCubic(swallow)
  frame.titleSpin = easeInCubic(swallow) * 2.6

  frame.holdAtCenter = t < 4.6
  frame.done = t >= INTRO_END
}

// Reduced motion: no blast, no fronts, no wobble; the field and the black hole fade in
function sampleReducedIntro (t: number, frame: IntroFrame) {
  frame.starGlow = 0
  frame.starRadius = 0
  frame.sourcePower = 0
  frame.exposure = 1
  frame.lightFront = 0
  frame.lightPower = 0
  frame.echoPower = 0
  frame.matterFront = 1
  frame.waveStrength = 0
  frame.reveal = 1
  frame.backgroundStars = easeOutCubic(progress(t, 0, 1.2))
  frame.remnantGlow = 0
  frame.remnantRedshift = 0
  frame.holeScale = easeOutCubic(progress(t, 0.2, 1.4))
  frame.ringdown = 0
  frame.ringPower = frame.holeScale
  frame.lensScale = frame.holeScale
  frame.gravityWaveFront = 0
  frame.gravityWaveAmplitude = 0
  frame.opacityScale = easeOutCubic(progress(t, 0, 1.2))
  frame.speedBoost = 1
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

// Phase boundaries for the intro debugger's timeline, sorted by time
export function getIntroMarkers (reducedMotion: boolean, timing: IntroTiming): IntroMarker[] {
  if (reducedMotion) {
    return [
      { time: 0, label: 'fade in' },
      { time: 0.6, label: 'title' },
      { time: 2, label: 'title out' },
      { time: REDUCED_INTRO_END, label: 'end' }
    ]
  }
  const markers = [
    { time: 0, label: 'dark' },
    { time: 0.1, label: 'star' },
    { time: COLLAPSE_AT, label: 'collapse' },
    { time: COLLAPSE_AT + timing.lightCrossTime, label: 'light out' },
    { time: REMNANT_AT, label: 'redshift' },
    { time: HORIZON_AT, label: 'horizon' },
    { time: RINGDOWN_AT, label: 'ringdown' },
    { time: COLLAPSE_AT + timing.lightCrossTime / timing.matterSpeed, label: 'matter out' },
    { time: 3.2, label: 'swallow' },
    { time: 4.6, label: 'release' },
    { time: INTRO_END, label: 'end' }
  ]
  return markers
    .map(marker => ({ ...marker, time: Math.round(marker.time * 100) / 100 }))
    .sort((a, b) => a.time - b.time)
}

export function getIntroDuration (reducedMotion: boolean) {
  return reducedMotion ? REDUCED_INTRO_END : INTRO_END
}

export function getIntroPhase (t: number, reducedMotion: boolean, timing: IntroTiming) {
  let phase = ''
  for (const marker of getIntroMarkers(reducedMotion, timing)) {
    if (t >= marker.time) phase = marker.label
  }
  return phase
}

export function sampleIntro (t: number, reducedMotion: boolean, timing: IntroTiming, frame: IntroFrame) {
  if (reducedMotion) sampleReducedIntro(t, frame)
  else sampleFullIntro(t, timing, frame)
  return frame
}
