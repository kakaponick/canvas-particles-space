// Choreography of the opening seconds. A star collapses and explodes: its light races outward at
// the on-screen speed of light, lighting dust as it passes, while the ejected matter (the particle
// field) follows more slowly. The core's light reddens away as it collapses, a black hole forms,
// rings down and sends out a gravitational wave, crumbles the title, then drifts to the cursor.
// The ringdown is the black hole's own: its pitch and length follow the hole's size, and the
// gravitational wave is that same wobble carried outward at the speed of light.
// Every number comes from IntroParams so the intro debugger can tune it live.

import { RINGDOWN_PHYSICAL_DECAY, RINGDOWN_PHYSICAL_FREQUENCY, type IntroParams } from './intro_params'

// How the new horizon rings, in absolute units for the current black hole and screen
export interface RingdownTiming {
  // Wobbles per second
  frequency: number
  // Seconds for the wobble to fade by e
  decay: number
}

// The ringdown of a black hole whose shadow has this radius, seen on a screen where light moves this fast;
// both lengths in the same pixels. The multipliers scale what a real black hole of that size does
export function getRingdownTiming (p: IntroParams, shadowRadius: number, lightSpeed: number, out: RingdownTiming) {
  const radius = Math.max(shadowRadius, 4)
  out.frequency = p.ringdownPitch * RINGDOWN_PHYSICAL_FREQUENCY * lightSpeed / radius
  out.decay = p.ringdownLength * RINGDOWN_PHYSICAL_DECAY * radius / Math.max(lightSpeed, 1)
  return out
}

// The horizon's oval wobble s seconds into the ringdown, as a share of its radius. The gravitational
// wave reads the same function at the time each point of space was reached
export function ringdownWobble (s: number, amplitude: number, ring: RingdownTiming) {
  return s > 0 ? amplitude * Math.exp(-s / ring.decay) * Math.sin(2 * Math.PI * ring.frequency * s) : 0
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
  matterFront: number
  // Refraction at the matter front, 0..1
  waveStrength: number
  // Brightness of the dust where the matter front strikes it
  dustShock: number
  // Share of the field already revealed behind the matter front; 1 shows everything
  reveal: number
  backgroundStars: number
  remnantGlow: number
  // 0 = white-hot core, 1 = fully reddened as its light climbs out of the deepening well
  remnantRedshift: number
  // Black hole size before the ringdown wobble
  holeScale: number
  // Oval wobble of the new horizon, as a share of its radius: positive stretches it sideways
  ringdown: number
  // Seconds since the ringdown started; negative before. The gravitational wave left the hole then
  ringdownTime: number
  // Photon ring fade-in, before the ringdown flicker
  ringFade: number
  lensScale: number
  opacityScale: number
  speedBoost: number
  titleAlpha: number
  // 1 while the light front decides which letters are lit; 0 shows the whole title (reduced motion)
  titleReveal: number
  // 0..1 progress of the letters crumbling away
  titleDissolve: number
  // 0..1 over the title's life, from the explosion until it is gone
  titleAge: number
  // 0..1 how far the title has been drawn towards the hole, eased
  titleFall: number
  // 1 = the dissolving title breaks into specks, 0 = it moves as one image
  titleGrain: number
  // 0..1 progress of the title burning away
  titleBurn: number
  // Extra size of a title flying past the camera; 1 leaves it as it is
  titleFly: number
  // Zoom of the whole frame around the place of the explosion; 1 is none
  cameraZoom: number
  // How far the camera is jolted right now, CSS pixels
  shake: number
  // 1 while the film effects (fringe, vignette, grain, letterbox) are on; fades to 0 as the intro ends
  film: number
  // Where the particle field flies out of: 1 = the place of the explosion, 0 = the screen centre.
  // The field is born flying out of the explosion and turns to the screen centre once it fills the screen
  vanishAtOrigin: number
  // While true the black hole stays at the screen center
  holdAtCenter: boolean
  done: boolean
}

export const REDUCED_INTRO_END = 2.6

function progress (t: number, start: number, duration: number) {
  return Math.min(Math.max((t - start) / Math.max(duration, 0.0001), 0), 1)
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const smoothstep = (x: number) => x * x * (3 - 2 * x)

export function createIntroFrame (): IntroFrame {
  return {
    starGlow: 0,
    starRadius: 0,
    sourcePower: 0,
    exposure: 1,
    lightFront: 0,
    lightPower: 0,
    echoPower: 0,
    matterFront: 0,
    waveStrength: 0,
    dustShock: 0,
    reveal: 0,
    backgroundStars: 0,
    remnantGlow: 0,
    remnantRedshift: 0,
    holeScale: 0,
    ringdown: 0,
    ringdownTime: -1,
    ringFade: 0,
    lensScale: 0,
    opacityScale: 1,
    speedBoost: 1,
    titleAlpha: 0,
    titleReveal: 1,
    titleDissolve: 0,
    titleAge: 0,
    titleFall: 0,
    titleGrain: 1,
    titleBurn: 0,
    titleFly: 1,
    cameraZoom: 1,
    shake: 0,
    film: 0,
    vanishAtOrigin: 0,
    holdAtCenter: true,
    done: false
  }
}

// When the matter front, and with it the newborn particle field, reaches the farthest screen corner
export const matterOut = (p: IntroParams) => p.collapseAt + p.lightCrossTime / p.matterSpeed

// How much a title flying past the camera has grown when it is gone
const FLY_PAST_GROWTH = 9
// How much too large a fading title starts, and how much it grows as it fades away
const FADE_IN_OVERSIZE = 0.12
const FADE_OUT_OVERSIZE = 0.06
// Seconds for the blast's punch of zoom to drop to about a third
const CAMERA_KICK_DECAY = 0.16

const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)

function sampleFullIntro (t: number, p: IntroParams, ring: RingdownTiming, frame: IntroFrame) {
  const sinceCollapse = Math.max(t - p.collapseAt, 0)
  const exploded = t >= p.collapseAt

  // The progenitor brightens, then is gone the instant it explodes
  const charge = progress(t, p.starChargeStart, p.collapseAt - p.starChargeStart)
  frame.starGlow = exploded ? 0 : p.starPeakGlow * charge * charge
  frame.starRadius = p.starRadiusStart + p.starRadiusGrowth * charge

  // Light curve of the point source: a near-instant rise and a fast decline. It is gone before the
  // horizon forms; what keeps shining afterwards is the expanding matter, not the core
  frame.sourcePower = exploded
    ? progress(t, p.collapseAt, p.glareRise) * p.glarePeak * Math.exp(-sinceCollapse / p.glareDecay)
    : 0
  frame.exposure = 1 / (1 + p.exposureDip * frame.sourcePower)

  // Light and matter fronts: light at c, matter at a fraction of it
  frame.lightFront = sinceCollapse / p.lightCrossTime
  frame.lightPower = exploded ? p.lightPower * Math.exp(-sinceCollapse / p.lightPowerDecay) : 0
  frame.echoPower = exploded ? p.echoPower * Math.exp(-sinceCollapse / p.echoPowerDecay) : 0
  frame.matterFront = frame.lightFront * p.matterSpeed
  frame.waveStrength = exploded ? Math.max(1 - frame.matterFront, 0) : 0
  // The matter front lights the dust it strikes, less and less as it spreads
  frame.dustShock = p.dustShock * frame.waveStrength
  frame.reveal = exploded ? Math.min(frame.matterFront, 1) : 0
  frame.speedBoost = exploded ? 1 + p.burstPeak * Math.pow(Math.max(1 - frame.matterFront, 0), p.burstCurve) : 1
  frame.opacityScale = 1

  // Distant stars are there all along; the dark opening only lets the eye find them
  frame.backgroundStars = p.starsInitial + (1 - p.starsInitial) * smoothstep(progress(t, 0, p.starsFadeIn))

  // The core: white-hot after the blast, then its light reddens and fades as it collapses
  frame.remnantGlow = progress(t, p.collapseAt, p.remnantAt - p.collapseAt) * Math.exp(-Math.max(t - p.remnantAt, 0) / p.remnantDecay)
  frame.remnantRedshift = progress(t, p.remnantAt, p.redshiftDuration)

  // The horizon grows without overshoot, then rings down like a struck bell. A round collapse sends out
  // no gravitational wave; the oval wobble does
  const ringdownAt = p.horizonAt + p.horizonGrowth
  frame.holeScale = easeOutCubic(progress(t, p.horizonAt, p.horizonGrowth))
  frame.ringdownTime = t - ringdownAt
  frame.ringdown = ringdownWobble(frame.ringdownTime, p.ringdownAmplitude, ring)
  frame.ringFade = smoothstep(progress(t, p.horizonAt + p.ringDelay, p.ringFadeIn))
  frame.lensScale = smoothstep(progress(t, p.remnantAt, p.lensDuration))

  // The title. By default it exists from the start as dark dust that the light front lights; the
  // other entrances bring it in on their own clock. Gathering from dust and coming out of the hole
  // are the fall into the hole played backwards
  const entrance = Math.round(p.titleEntrance)
  const exit = Math.round(p.titleExit)
  const arrived = entrance === 0 ? 1 : progress(t, p.titleInAt, p.titleInDuration)
  const leaving = progress(t, p.dissolveAt, p.dissolveDuration)
  let alpha = 1
  frame.titleDissolve = 0
  frame.titleFall = 0
  frame.titleGrain = p.titleGrain
  frame.titleBurn = 0
  frame.titleFly = 1
  frame.titleReveal = entrance === 0 ? 1 : 0
  // Nothing here moves at a constant rate: arrivals rush in and settle, departures hang and then go
  if (entrance === 1) {
    // Fading in, the title also settles back from slightly too large
    const settled = easeOutQuart(arrived)
    alpha = settled
    frame.titleFly = 1 + FADE_IN_OVERSIZE * (1 - settled)
  } else if (entrance >= 2 && arrived < 1) {
    // The fall into the hole played backwards: fast out of it, slow into place
    frame.titleDissolve = 1 - arrived
    frame.titleFall = Math.pow(1 - arrived, 3)
    frame.titleGrain = entrance === 2 ? 1 : 0
    alpha = easeOutCubic(Math.min(arrived * 2.5, 1))
  }
  if (leaving > 0) {
    if (exit === 0) {
      // It hangs for a moment, then goes faster and faster
      frame.titleDissolve = leaving
      frame.titleFall = Math.pow(leaving, p.titleFallEase)
      frame.titleGrain = p.titleGrain
      alpha *= 1 - smoothstep(progress(leaving, 0.6, 0.4))
    } else if (exit === 1) {
      const rush = leaving * leaving * leaving * leaving
      frame.titleFly = 1 + FLY_PAST_GROWTH * rush
      alpha *= 1 - smoothstep(progress(leaving, 0.55, 0.45))
    } else if (exit === 2) {
      frame.titleBurn = leaving * leaving * (3 - 2 * leaving)
      if (leaving >= 1) alpha = 0
    } else {
      // Fading out, it drifts a little towards the camera
      const gone = leaving * leaving * leaving
      alpha *= 1 - gone
      frame.titleFly = 1 + FADE_OUT_OVERSIZE * gone
    }
  }
  frame.titleAlpha = alpha
  const titleStart = entrance === 0 ? p.collapseAt : p.titleInAt
  // The push-in is quickest when the title is lit and eases off
  const age = progress(t, titleStart, p.dissolveAt + p.dissolveDuration - titleStart)
  frame.titleAge = 1 - (1 - age) * (1 - age)

  // The camera creeps while it is dark, then the blast throws it: most of the zoom is gone at once
  // and the rest settles slowly. The blast also punches the zoom in for an instant and jolts the
  // camera; the film effects lift as the intro ends
  const zoomDone = 0.1 * progress(t, 0, p.collapseAt) + 0.9 * easeOutQuart(progress(t, p.collapseAt, p.cameraSettle))
  const kick = exploded ? p.cameraKick * Math.exp(-sinceCollapse / CAMERA_KICK_DECAY) : 0
  frame.cameraZoom = (1 + (p.cameraZoom - 1) * (1 - zoomDone)) * (1 + kick)
  frame.shake = exploded ? p.shakeAmount * Math.exp(-sinceCollapse / p.shakeDecay) : 0
  frame.film = 1 - smoothstep(progress(t, p.releaseAt, p.introEnd - p.releaseAt))

  // The field flies out of the explosion while it is born, then turns smoothly to the screen centre,
  // where it is once the intro ends
  const turnAt = Math.min(matterOut(p), p.introEnd)
  frame.vanishAtOrigin = 1 - smoothstep(progress(t, turnAt, p.introEnd - turnAt))

  frame.holdAtCenter = t < p.releaseAt
  frame.done = t >= p.introEnd
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
  frame.dustShock = 0
  frame.reveal = 1
  frame.backgroundStars = easeOutCubic(progress(t, 0, 1.2))
  frame.remnantGlow = 0
  frame.remnantRedshift = 0
  frame.holeScale = easeOutCubic(progress(t, 0.2, 1.2))
  frame.ringdown = 0
  frame.ringdownTime = -1
  frame.ringFade = frame.holeScale
  frame.lensScale = frame.holeScale
  frame.opacityScale = easeOutCubic(progress(t, 0, 1.2))
  frame.speedBoost = 1
  frame.titleAlpha = progress(t, 0.6, 0.4) * (1 - progress(t, 2, 0.5))
  frame.titleReveal = 0
  frame.titleDissolve = 0
  frame.titleAge = 0
  frame.titleFall = 0
  frame.titleGrain = 1
  frame.titleBurn = 0
  frame.titleFly = 1
  frame.cameraZoom = 1
  frame.shake = 0
  frame.film = 0
  // Nothing explodes, so the field flies out of the screen centre from the start
  frame.vanishAtOrigin = 0
  frame.holdAtCenter = t < REDUCED_INTRO_END
  frame.done = t >= REDUCED_INTRO_END
}

export function getIntroDuration (reducedMotion: boolean, p: IntroParams) {
  return reducedMotion ? REDUCED_INTRO_END : p.introEnd
}

export function sampleIntro (t: number, reducedMotion: boolean, p: IntroParams, ring: RingdownTiming, frame: IntroFrame) {
  if (reducedMotion) sampleReducedIntro(t, frame)
  else sampleFullIntro(t, p, ring, frame)
  return frame
}
