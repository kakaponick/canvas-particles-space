// The opening as tracks for the intro debugger: one track per element of the scene, owning its layer
// switch, its tunable numbers, its moments on the timeline and when it is active. The phase markers
// and the phase names come from here too, so every element is described in exactly one place.
import type { IntroParamKey, IntroParams } from './intro_params'
import { REDUCED_INTRO_END } from './intro_timeline'

// Pieces of the opening that can be switched off one by one to see what each contributes
export const INTRO_LAYERS = [
  'star', 'glare', 'light', 'echo', 'stars', 'shockwave', 'reveal', 'burst', 'remnant',
  'ringdown', 'gravityWave', 'title', 'hole', 'lens', 'ring', 'gravity', 'doppler', 'camera'
] as const

export type IntroLayer = typeof INTRO_LAYERS[number]

// Live values the debugger shows beside a track; a subset of the readout the animation loop publishes
export type IntroTrackReadout = 'sourcePower' | 'lightFront' | 'matterFront' | 'remnantRedshift' | 'holeScale' | 'ringdown' | 'titleAlpha' | 'speed'

export interface IntroMarker {
  time: number
  label: string
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
  readout?: { key: IntroTrackReadout, digits: number }
  spans: (p: IntroParams, reduced: boolean) => IntroSpan[]
  markers?: (p: IntroParams, reduced: boolean) => IntroMarker[]
}

// An exponential fade counts as over after three time constants, when it is down to 5%
const FADED = 3

const matterOut = (p: IntroParams) => p.collapseAt + p.lightCrossTime / p.matterSpeed
const ringdownAt = (p: IntroParams) => p.horizonAt + p.horizonGrowth
// The light front lights the title from the explosion on; any other entrance has its own start
const titleStart = (p: IntroParams) => Math.round(p.titleEntrance) === 0 ? p.collapseAt : p.titleInAt
const full = (reduced: boolean, spans: IntroSpan[]) => reduced ? [] : spans

// Reduced motion fades the field and the black hole in over the same stretch
const REDUCED_FADE: IntroSpan = { start: 0.2, end: 1.4, holds: true }

export const INTRO_TRACKS: IntroTrack[] = [
  {
    key: 'stars',
    label: 'Far stars',
    layer: 'stars',
    params: ['starsInitial', 'starsFadeIn', 'starFlare'],
    spans: (p, reduced) => [{ start: 0, end: reduced ? 1.2 : p.starsFadeIn, holds: true }]
  },
  {
    key: 'star',
    label: 'Progenitor star',
    layer: 'star',
    params: ['starChargeStart', 'collapseAt', 'starPeakGlow', 'starRadiusStart', 'starRadiusGrowth', 'colorFlash'],
    spans: (p, reduced) => full(reduced, [{ start: p.starChargeStart, end: p.collapseAt }]),
    markers: (p, reduced) => reduced ? [] : [{ time: p.starChargeStart, label: 'star' }, { time: p.collapseAt, label: 'collapse' }]
  },
  {
    key: 'glare',
    label: 'Glare',
    layer: 'glare',
    params: ['glareRise', 'glarePeak', 'glareDecay', 'glareRadius', 'exposureDip'],
    readout: { key: 'sourcePower', digits: 2 },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.glareRise + p.glareDecay * FADED }])
  },
  {
    key: 'light',
    label: 'Light front',
    layer: 'light',
    params: ['lightCrossTime', 'lightPower', 'lightPowerDecay', 'lightWidth', 'lightDustContrast', 'colorLight'],
    readout: { key: 'lightFront', digits: 2 },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.lightCrossTime }]),
    markers: (p, reduced) => reduced ? [] : [{ time: p.collapseAt + p.lightCrossTime, label: 'light out' }]
  },
  {
    key: 'echo',
    label: 'Dust echo',
    layer: 'echo',
    params: ['echoPower', 'echoPowerDecay', 'echoDecay', 'dustScale', 'dustThreshold', 'dustBlow', 'dustDrift', 'dustSweep', 'colorDust'],
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.collapseAt + p.echoPowerDecay * FADED }])
  },
  {
    key: 'shockwave',
    label: 'Matter wave',
    layer: 'shockwave',
    params: ['matterSpeed', 'waveRefraction', 'waveWidth'],
    readout: { key: 'matterFront', digits: 2 },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: matterOut(p) }]),
    markers: (p, reduced) => reduced ? [] : [{ time: matterOut(p), label: 'matter out' }]
  },
  {
    key: 'reveal',
    label: 'Particle birth',
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
    label: 'Collapsing core',
    layer: 'remnant',
    params: ['remnantAt', 'remnantDecay', 'redshiftDuration', 'remnantRadius', 'colorEmber'],
    readout: { key: 'remnantRedshift', digits: 2 },
    spans: (p, reduced) => full(reduced, [{ start: p.collapseAt, end: p.remnantAt + p.remnantDecay * FADED }]),
    markers: (p, reduced) => reduced ? [] : [{ time: p.remnantAt, label: 'redshift' }]
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
    label: 'Horizon',
    layer: 'hole',
    params: ['horizonAt', 'horizonGrowth'],
    readout: { key: 'holeScale', digits: 2 },
    spans: (p, reduced) => [reduced ? REDUCED_FADE : { start: p.horizonAt, end: ringdownAt(p), holds: true }],
    markers: (p, reduced) => reduced ? [] : [{ time: p.horizonAt, label: 'horizon' }]
  },
  {
    key: 'ring',
    label: 'Photon ring',
    layer: 'ring',
    params: ['ringDelay', 'ringFadeIn'],
    spans: (p, reduced) => [reduced ? REDUCED_FADE : { start: p.horizonAt + p.ringDelay, end: p.horizonAt + p.ringDelay + p.ringFadeIn, holds: true }]
  },
  {
    key: 'ringdown',
    label: 'Ringdown',
    layer: 'ringdown',
    params: ['ringdownAmplitude', 'ringdownFrequency', 'ringdownDecay', 'ringFlicker'],
    readout: { key: 'ringdown', digits: 3 },
    spans: (p, reduced) => full(reduced, [{ start: ringdownAt(p), end: ringdownAt(p) + p.ringdownDecay * FADED }]),
    markers: (p, reduced) => reduced ? [] : [{ time: ringdownAt(p), label: 'ringdown' }]
  },
  {
    key: 'gravityWave',
    label: 'Gravitational wave',
    layer: 'gravityWave',
    params: ['gravityWaveDelay', 'gravityWaveAmplitude', 'gravityWaveWidth', 'gravityWaveDecay', 'gravityWaveCycles'],
    spans: (p, reduced) => {
      // The wave leaves the screen at 1.3 crossings even if it has not faded yet
      const start = ringdownAt(p) + p.gravityWaveDelay
      return full(reduced, [{ start, end: start + Math.min(p.gravityWaveDecay * FADED, p.lightCrossTime * 1.3) }])
    }
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
      'titleExit', 'dissolveAt', 'dissolveDuration', 'titleGrain', 'titleDrift', 'titleTidal', 'titleSwirl', 'titleSpiral',
      'titleSpread', 'titleStream', 'titleOrder', 'titleTrail', 'titleHeat', 'titleRedshift'
    ],
    readout: { key: 'titleAlpha', digits: 2 },
    spans: (p, reduced) => [reduced ? { start: 0.6, end: 2.5 } : { start: titleStart(p), end: p.dissolveAt + p.dissolveDuration }],
    markers: (p, reduced) => reduced
      ? [{ time: 0.6, label: 'title' }, { time: 2, label: 'title out' }]
      : Math.round(p.titleEntrance) === 0
        ? [{ time: p.dissolveAt, label: 'dissolve' }]
        : [{ time: p.titleInAt, label: 'title in' }, { time: p.dissolveAt, label: 'dissolve' }]
  },
  {
    key: 'camera',
    label: 'Camera and film',
    layer: 'camera',
    params: ['cameraZoom', 'cameraSettle', 'cameraKick', 'shakeAmount', 'shakeDecay', 'lensFringe', 'vignette', 'filmGrain', 'letterbox'],
    spans: (p, reduced) => full(reduced, [{ start: 0, end: p.introEnd }])
  },
  {
    key: 'motion',
    label: 'Black hole motion',
    params: ['releaseAt', 'introEnd', 'centerHoldFrequency', 'originAtHole'],
    spans: (p, reduced) => [{ start: 0, end: reduced ? REDUCED_INTRO_END : p.releaseAt }],
    markers: (p, reduced) => reduced
      ? [{ time: REDUCED_INTRO_END, label: 'end' }]
      : [{ time: p.releaseAt, label: 'release' }, { time: p.introEnd, label: 'end' }]
  },
  {
    key: 'flight',
    label: 'Flight',
    params: [],
    readout: { key: 'speed', digits: 2 },
    spans: () => [{ start: 0, end: 0, holds: true }]
  },
  {
    key: 'doppler',
    label: 'Doppler shift',
    layer: 'doppler',
    params: [],
    spans: () => [{ start: 0, end: 0, holds: true }]
  },
  {
    key: 'gravity',
    label: 'Particle gravity',
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

export function getIntroPhase (t: number, reducedMotion: boolean, p: IntroParams) {
  let phase = ''
  for (const marker of getIntroMarkers(reducedMotion, p)) {
    if (t >= marker.time) phase = marker.label
  }
  return phase
}
