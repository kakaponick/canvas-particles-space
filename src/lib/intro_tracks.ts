// The opening as tracks for the intro debugger: one track per element of the scene, owning its layer
// switch, its tunable numbers, its moments on the timeline and when it is active. The phase markers
// and the phase names come from here too, so every element is described in exactly one place.
import type { IntroParamKey, IntroParams } from './intro_params'
import { REDUCED_INTRO_END, matterOut, type RingdownTiming } from './intro_timeline'

// Pieces of the opening that can be switched off one by one to see what each contributes
export const INTRO_LAYERS = [
  'star', 'glare', 'light', 'echo', 'stars', 'shockwave', 'reveal', 'burst', 'remnant',
  'ringdown', 'gravityWave', 'title', 'hole', 'lens', 'ring', 'gravity', 'doppler', 'camera'
] as const

export type IntroLayer = typeof INTRO_LAYERS[number]

// The layers that are one event of the opening and can be played again on their own, at the black hole,
// once the opening is over (scene.fire; a film's cues). The rest are states: they are switched, not fired
export const CUE_LAYERS = ['star', 'glare', 'light', 'echo', 'shockwave', 'burst', 'remnant', 'ringdown', 'gravityWave', 'camera'] as const

export type CueLayer = typeof CUE_LAYERS[number]

// What each layer is, in a line an agent reads before it hides, switches or fires one
export const INTRO_LAYER_NOTES: Record<IntroLayer, string> = {
  star: 'the progenitor star brightening until it explodes',
  glare: 'the blinding flash of the explosion and the dip of the exposure under it',
  light: 'the light front racing outward at the speed of light',
  echo: 'the dust that keeps glowing behind the light front',
  stars: 'the background stars, as the dark opening lets them show',
  shockwave: 'the matter front that bends what lies under it',
  reveal: 'the particle field born behind the matter front',
  burst: 'the rush of flight speed at the explosion',
  remnant: 'the core left behind, white-hot and then reddening away',
  ringdown: 'the newborn horizon wobbling as an oval, and the ring flickering with it',
  gravityWave: 'the gravitational wave that carries the wobble outward and ripples the sky and the sheet',
  title: 'the words of the opening',
  hole: 'the shadow of the black hole',
  lens: 'the bending of light around the black hole',
  ring: 'the photon ring',
  gravity: 'the pull and swirl on the particles',
  doppler: 'the colour shift of fast flight',
  camera: 'the opening\'s camera and film stock; fired, the jolt and shake of the blast alone'
}

// Live values the debugger shows beside a track; a subset of the readout the animation loop publishes
export type IntroTrackReadout = 'sourcePower' | 'lightFront' | 'matterFront' | 'remnantRedshift' | 'holeScale' | 'ringdown' | 'titleAlpha' | 'speed'

export interface IntroMarker {
  time: number
  label: string
  // The parameter that places this moment, so the debugger can move it: the parameter holds `time - base`,
  // where `base` is the moment it is counted from (0 for a moment set in seconds from the start)
  param?: IntroParamKey
  base?: number
}

// When a track is doing something; `holds` means it stays on after `end` instead of being over
export interface IntroSpan {
  start: number
  end: number
  holds?: boolean
}

export interface IntroTrack {
  key: string
  label: string
  layer?: IntroLayer
  // The track also edits the title's text, font and case
  editsText?: boolean
  params: IntroParamKey[]
  // `name` says what the number is, for its tooltip and for screen readers; `short` is the one word shown
  // before it. The value is multiplied by `scale` (100 shows a 0..1 share as a percentage)
  // and `unit` follows the number
  readout?: { key: IntroTrackReadout, digits: number, short: string, name: string, unit?: string, scale?: number }
  // The ringdown's timing follows the black hole's size, so the animation loop measures it
  spans: (p: IntroParams, reduced: boolean, ring: RingdownTiming) => IntroSpan[]
  markers?: (p: IntroParams, reduced: boolean) => IntroMarker[]
}

// An exponential fade counts as over after three time constants, when it is down to 5%
const FADED = 3

const ringdownAt = (p: IntroParams) => p.horizonAt + p.horizonGrowth
// The light front lights the title from the explosion on; any other entrance has its own start
const titleStart = (p: IntroParams) => Math.round(p.titleEntrance) === 0 ? p.collapseAt : p.titleInAt
const full = (reduced: boolean, spans: IntroSpan[]) => reduced ? [] : spans

// Reduced motion fades the field and the black hole in over the same stretch
const REDUCED_FADE: IntroSpan = { start: 0.2, end: 1.4, holds: true }

export const INTRO_TRACKS: IntroTrack[] = [
  {
    key: 'stars',
    label: 'Background Stars',
    layer: 'stars',
    params: ['starsInitial', 'starsFadeIn', 'starFlare'],
    spans: (p, reduced) => [{ start: 0, end: reduced ? 1.2 : p.starsFadeIn, holds: true }]
  },
  {
    key: 'star',
    label: 'Progenitor Star',
    layer: 'star',
    params: ['starChargeStart', 'collapseAt', 'starPeakGlow', 'starRadiusStart', 'starRadiusGrowth', 'colorFlash'],
    spans: (p, reduced) => full(reduced, [{ start: p.starChargeStart, end: p.collapseAt }]),
    markers: (p, reduced) => reduced
      ? []
      : [{ time: p.starChargeStart, label: 'star', param: 'starChargeStart' }, { time: p.collapseAt, label: 'explosion', param: 'collapseAt' }]
  },
  {
    key: 'glare',
    label: 'Glare',
    layer: 'glare',
    params: ['glareRise', 'glarePeak', 'glareDecay', 'glareRadius', 'exposureDip'],
    readout: { key: 'sourcePower', digits: 2, short: 'bright', name: 'Explosion brightness', unit: '×' },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.glareRise + p.glareDecay * FADED }])
  },
  {
    key: 'light',
    label: 'Light Front',
    layer: 'light',
    params: ['lightCrossTime', 'lightPower', 'lightPowerDecay', 'lightWidth', 'lightDustContrast', 'colorLight'],
    readout: { key: 'lightFront', digits: 0, short: 'reach', scale: 100, unit: '%', name: 'Light front reach, % of farthest corner' },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.lightCrossTime }]),
    markers: (p, reduced) => reduced ? [] : [{ time: p.collapseAt + p.lightCrossTime, label: 'light off-screen', param: 'lightCrossTime', base: p.collapseAt }]
  },
  {
    key: 'echo',
    label: 'Dust Echo',
    layer: 'echo',
    params: ['echoPower', 'echoPowerDecay', 'echoDecay', 'echoFloor', 'dustShock', 'dustScale', 'dustThreshold', 'dustBlow', 'dustDrift', 'dustSweep', 'colorDust'],
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.echoPowerDecay * FADED }])
  },
  {
    key: 'shockwave',
    label: 'Matter Wave',
    layer: 'shockwave',
    params: ['matterSpeed', 'waveRefraction', 'waveWidth'],
    readout: { key: 'matterFront', digits: 0, short: 'reach', scale: 100, unit: '%', name: 'Matter front reach, % of farthest corner' },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: matterOut(p) }]),
    markers: (p, reduced) => reduced ? [] : [{ time: matterOut(p), label: 'matter off-screen' }]
  },
  {
    key: 'reveal',
    label: 'Particle Birth',
    layer: 'reveal',
    params: ['revealFeather'],
    spans: (p, reduced) => reduced ? [{ start: 0, end: 1.2, holds: true }] : [{ start: p.collapseAt, end: matterOut(p), holds: true }]
  },
  {
    key: 'burst',
    label: 'Burst',
    layer: 'burst',
    params: ['burstPeak', 'burstCurve'],
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: matterOut(p) }])
  },
  {
    key: 'remnant',
    label: 'Collapsing Core',
    layer: 'remnant',
    params: ['remnantAt', 'remnantDecay', 'redshiftDuration', 'remnantRadius', 'colorEmber'],
    readout: { key: 'remnantRedshift', digits: 2, short: 'red', name: 'Core redshift: 0 = white-hot · 1 = deep red' },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.remnantAt + p.remnantDecay * FADED }]),
    markers: (p, reduced) => reduced ? [] : [{ time: p.remnantAt, label: 'core fades', param: 'remnantAt' }]
  },
  {
    key: 'lens',
    label: 'Lens',
    layer: 'lens',
    params: ['lensDuration'],
    spans: (p, reduced) => [reduced ? REDUCED_FADE : { start: p.remnantAt, end: p.remnantAt + p.lensDuration, holds: true }]
  },
  {
    key: 'hole',
    label: 'Shadow',
    layer: 'hole',
    params: ['horizonAt', 'horizonGrowth'],
    readout: { key: 'holeScale', digits: 2, short: 'size', unit: '×', name: 'Shadow size, 1× = full size' },
    spans: (p, reduced) => [reduced ? REDUCED_FADE : { start: p.horizonAt, end: ringdownAt(p), holds: true }],
    markers: (p, reduced) => reduced ? [] : [{ time: p.horizonAt, label: 'shadow', param: 'horizonAt' }]
  },
  {
    key: 'ring',
    label: 'Photon Ring',
    layer: 'ring',
    params: ['ringDelay', 'ringFadeIn'],
    spans: (p, reduced) => [reduced ? REDUCED_FADE : { start: p.horizonAt + p.ringDelay, end: p.horizonAt + p.ringDelay + p.ringFadeIn, holds: true }]
  },
  {
    key: 'ringdown',
    label: 'Ringdown',
    layer: 'ringdown',
    params: ['ringdownAmplitude', 'ringdownPitch', 'ringdownLength', 'ringFlicker'],
    readout: { key: 'ringdown', digits: 1, short: 'wobble', scale: 100, unit: '%', name: 'Shadow wobble, % of its radius' },
    spans: (p, reduced, ring) => full(reduced, [{ start: ringdownAt(p), end: ringdownAt(p) + ring.decay * FADED }]),
    markers: (p, reduced) => reduced ? [] : [{ time: ringdownAt(p), label: 'ringdown', param: 'horizonGrowth', base: p.horizonAt }]
  },
  {
    key: 'gravityWave',
    label: 'Gravitational Wave',
    layer: 'gravityWave',
    params: ['gravityWaveGain'],
    // The wobble leaves the hole as the ringdown starts; its last ripples pass the farthest corner,
    // one light crossing away, after the wobble has faded
    spans: (p, reduced, ring) => full(reduced, [{ start: ringdownAt(p), end: ringdownAt(p) + p.lightCrossTime / 1.15 + ring.decay * FADED }])
  },
  {
    key: 'title',
    label: 'Title',
    layer: 'title',
    editsText: true,
    params: [
      'titleOffset', 'titleSize', 'titleWeight', 'titleTracking', 'colorTitle', 'titleGlow', 'titleFlash', 'titleCooling',
      'titleDust', 'titlePush', 'titleHalo', 'titleHaloRadius', 'titleStreak', 'titleFringe',
      'titleEntrance', 'titleInAt', 'titleInDuration',
      'titleExit', 'dissolveAt', 'dissolveDuration', 'titleGrain', 'titleFallEase', 'titleDrift', 'titleTidal', 'titleSwirl', 'titleSpiral',
      'titleSpread', 'titleStream', 'titleOrder', 'titleTrail', 'titleHeat', 'titleRedshift'
    ],
    readout: { key: 'titleAlpha', digits: 0, short: 'opacity', scale: 100, unit: '%', name: 'Title opacity' },
    spans: (p, reduced) => [reduced ? { start: 0.6, end: 2.5 } : { start: titleStart(p), end: p.dissolveAt + p.dissolveDuration }],
    markers: (p, reduced) => reduced
      ? [{ time: 0.6, label: 'title' }, { time: 2, label: 'title out' }]
      : Math.round(p.titleEntrance) === 0
        ? [{ time: p.dissolveAt, label: 'title out', param: 'dissolveAt' }]
        : [{ time: p.titleInAt, label: 'title in', param: 'titleInAt' }, { time: p.dissolveAt, label: 'title out', param: 'dissolveAt' }]
  },
  {
    key: 'camera',
    label: 'Camera and Film',
    layer: 'camera',
    params: ['cameraZoom', 'cameraSettle', 'cameraKick', 'shakeAmount', 'shakeDecay', 'lensFringe', 'vignette', 'filmGrain', 'letterbox'],
    spans: (p, reduced) => full(reduced, [{ start: 0, end: p.introEnd }])
  },
  {
    key: 'motion',
    label: 'Black Hole Motion',
    params: ['releaseAt', 'introEnd', 'centerHoldFrequency', 'originAtHole'],
    spans: (p, reduced) => [{ start: 0, end: reduced ? REDUCED_INTRO_END : p.releaseAt }],
    markers: (p, reduced) => reduced
      ? [{ time: REDUCED_INTRO_END, label: 'end' }]
      : [{ time: p.releaseAt, label: 'release', param: 'releaseAt' }, { time: p.introEnd, label: 'end', param: 'introEnd' }]
  },
  {
    key: 'flight',
    label: 'Flight',
    params: [],
    readout: { key: 'speed', digits: 2, short: 'speed', name: 'Flight speed' },
    spans: () => [{ start: 0, end: 0, holds: true }]
  },
  {
    key: 'doppler',
    label: 'Doppler Shift',
    layer: 'doppler',
    params: [],
    spans: () => [{ start: 0, end: 0, holds: true }]
  },
  {
    key: 'gravity',
    label: 'Particle Gravity',
    layer: 'gravity',
    params: [],
    spans: () => [{ start: 0, end: 0, holds: true }]
  }
]

// Phase boundaries, sorted by time; each phase is named after the marker that opens it
export function getIntroMarkers (reducedMotion: boolean, p: IntroParams): IntroMarker[] {
  const markers = [{ time: 0, label: reducedMotion ? 'fade in' : 'dark' }]
  for (const track of INTRO_TRACKS) {
    if (track.markers) markers.push(...track.markers(p, reducedMotion))
  }
  return markers
    .map(marker => ({ ...marker, time: Math.round(marker.time * 100) / 100 }))
    .sort((a, b) => a.time - b.time)
}

// The last list worked out, reused while the parameters stay the same object: a pointer over the timeline
// and the readout ask for the phase far more often than the parameters change. Shared, so never mutated
let cachedParams: IntroParams | null = null
let cachedReduced = false
let cachedMarkers: readonly IntroMarker[] = []
export function getCachedIntroMarkers (reducedMotion: boolean, p: IntroParams): readonly IntroMarker[] {
  if (p !== cachedParams || reducedMotion !== cachedReduced) {
    cachedMarkers = getIntroMarkers(reducedMotion, p)
    cachedParams = p
    cachedReduced = reducedMotion
  }
  return cachedMarkers
}

export function getIntroPhase (t: number, reducedMotion: boolean, p: IntroParams) {
  let phase = ''
  for (const marker of getCachedIntroMarkers(reducedMotion, p)) {
    if (t >= marker.time) phase = marker.label
    else break
  }
  return phase
}
