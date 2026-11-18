// Every tunable number of the opening, with its range, for the intro debugger.
// Times are seconds from page load unless a label says otherwise; sizes marked "share" are
// fractions of the viewport's short side.

export const DEFAULT_INTRO_PARAMS = {
  // Progenitor star
  starChargeStart: 0.1,
  collapseAt: 0.6,
  starPeakGlow: 1.4,
  starRadiusStart: 0.004,
  starRadiusGrowth: 0.01,
  // Glare of the explosion in the camera
  glareRise: 0.04,
  glarePeak: 6,
  glareDecay: 0.2,
  glareRadius: 0.025,
  exposureDip: 0.35,
  // Light front
  lightCrossTime: 0.8,
  lightPower: 3,
  lightPowerDecay: 1.2,
  lightWidth: 0.008,
  lightDustContrast: 0.94,
  // Dust lit by the light front
  echoPower: 0.9,
  echoPowerDecay: 1.5,
  echoDecay: 0.18,
  dustScale: 220,
  dustThreshold: 0.55,
  // Ejected matter, which births the particle field
  matterSpeed: 0.4,
  waveRefraction: 24,
  waveWidth: 0.06,
  burstPeak: 5,
  burstCurve: 2,
  revealFeather: 80,
  // Static background stars
  starsInitial: 0.35,
  starsFadeIn: 1.5,
  starsBrightness: 1,
  starDensity: 0.12,
  starCell: 26,
  starFlare: 3,
  // Collapsing core
  remnantAt: 1,
  remnantDecay: 0.35,
  redshiftDuration: 0.7,
  remnantRadius: 0.012,
  // Horizon
  horizonAt: 1.3,
  horizonGrowth: 0.45,
  lensDuration: 0.95,
  ringDelay: 0.1,
  ringFadeIn: 0.5,
  ringBrightness: 0.9,
  // Ringdown
  ringdownAmplitude: 0.035,
  ringdownFrequency: 1.6,
  ringdownDecay: 0.6,
  ringFlicker: 2,
  // Gravitational wave
  gravityWaveDelay: 0,
  gravityWaveAmplitude: 9,
  gravityWaveWidth: 0.05,
  gravityWaveDecay: 1.5,
  gravityWaveCycles: 5,
  // Title, written in dust that the light front lights up
  titleOffset: -0.3,
  titleSize: 0.6,
  titleWeight: 500,
  titleTracking: 0.08,
  titleGlow: 0.9,
  titleFlash: 1.2,
  titleCooling: 0.3,
  titleDust: 0.45,
  dissolveAt: 3.2,
  dissolveDuration: 1.3,
  titleDrift: 160,
  // Black hole motion and the end of the intro
  releaseAt: 4.6,
  introEnd: 5,
  centerHoldFrequency: 12,
  followFrequency: 6,
  // Flight
  scrollSpeedGain: 10
}

export type IntroParams = typeof DEFAULT_INTRO_PARAMS
export type IntroParamKey = keyof IntroParams

export type ParamUnit = 's' | 'Hz' | 'rad/s' | 'px' | '×' | 'share' | 'rad' | 'c' | ''

export interface IntroParamSpec {
  key: IntroParamKey
  label: string
  min: number
  max: number
  step: number
  unit: ParamUnit
  description: string
}

const p = (key: IntroParamKey, label: string, min: number, max: number, step: number, unit: ParamUnit, description: string): IntroParamSpec =>
  ({ key, label, min, max, step, unit, description })

// Range, unit and meaning of every tunable number, keyed by parameter
export const INTRO_PARAM_SPECS = Object.fromEntries([
  p('starChargeStart', 'Star Appears', 0, 3, 0.05, 's', 'When the star starts to brighten.'),
  p('collapseAt', 'Explosion', 0.1, 4, 0.05, 's', 'When the star explodes. Every later event of the explosion counts from here.'),
  p('starPeakGlow', 'Star Peak Glow', 0, 5, 0.05, '×', 'Brightness of the star just before it explodes.'),
  p('starRadiusStart', 'Star Size Start', 0, 0.05, 0.001, 'share', 'Glow radius when the star appears.'),
  p('starRadiusGrowth', 'Star Size Growth', 0, 0.05, 0.001, 'share', 'How much the glow grows until the explosion.'),
  p('glareRise', 'Glare Rise', 0.005, 0.5, 0.005, 's', 'Time from the explosion to peak brightness.'),
  p('glarePeak', 'Glare Peak', 0, 20, 0.1, '×', 'Peak brightness of the explosion as the camera sees it.'),
  p('glareDecay', 'Glare Decay', 0.02, 2, 0.01, 's', 'Time for the glare to drop to about a third. Short values clear the view before the horizon forms.'),
  p('glareRadius', 'Glare Radius', 0.002, 0.2, 0.001, 'share', 'Size of the halo around the source.'),
  p('exposureDip', 'Exposure Dip', 0, 2, 0.01, '×', 'How much the camera darkens the rest of the scene while the glare is bright, instead of whiting out.'),
  p('lightCrossTime', 'Light Reaches Corner', 0.2, 4, 0.05, 's', 'The on-screen speed of light: seconds for the light front to reach the farthest corner. The gravitational wave travels at the same speed.'),
  p('lightPower', 'Front Brightness', 0, 8, 0.1, '×', 'Brightness of the light front where it strikes dust.'),
  p('lightPowerDecay', 'Front Fade', 0.1, 5, 0.05, 's', 'Time for the front to fade to about a third as it spreads.'),
  p('lightWidth', 'Front Width', 0.001, 0.05, 0.001, 'share', 'Thickness of the light front.'),
  p('lightDustContrast', 'Front Needs Dust', 0, 1, 0.01, '', '1 shows the front only where it hits dust; 0 draws an even ring.'),
  p('echoPower', 'Echo Brightness', 0, 4, 0.05, '×', 'How bright the dust glows once the light front has passed it.'),
  p('echoPowerDecay', 'Echo Fade Over Time', 0.1, 6, 0.05, 's', 'Time for the echo as a whole to fade to about a third.'),
  p('echoDecay', 'Echo Afterglow', 0.02, 2, 0.01, 's', 'How long a patch of dust keeps glowing after the front passes it; sets the width of the glowing band.'),
  p('dustScale', 'Dust Scale', 40, 800, 5, 'px', 'Size of the dust structures.'),
  p('dustThreshold', 'Dust Sparseness', 0, 0.95, 0.01, '', 'Higher values leave only thin filaments; lower values fill space with haze.'),
  p('matterSpeed', 'Matter Speed', 0.05, 0.95, 0.01, 'c', 'Speed of the ejected matter, which births the particle field, as a share of the speed of light.'),
  p('waveRefraction', 'Matter Refraction', 0, 80, 1, 'px', 'How strongly the matter front bends what lies behind it.'),
  p('waveWidth', 'Matter Front Width', 0.01, 0.3, 0.005, 'share', 'Width of the refracting band at the matter front.'),
  p('burstPeak', 'Burst Speed', 0, 15, 0.1, '×', 'Extra flight speed right after the explosion, fading as the matter spreads.'),
  p('burstCurve', 'Burst Falloff', 0.5, 6, 0.1, '', 'How quickly the burst speed falls off; higher values fall off sooner.'),
  p('revealFeather', 'Birth Edge Softness', 1, 400, 1, 'px', 'Width of the fade where new particles appear behind the matter front.'),
  p('starsInitial', 'Stars At Start', 0, 1, 0.01, '', 'Brightness of the background stars when the page opens.'),
  p('starsFadeIn', 'Stars Fade In', 0, 5, 0.05, 's', 'Time for the background stars to reach full brightness.'),
  p('starsBrightness', 'Stars Brightness', 0, 3, 0.05, '×', 'Overall brightness of the background stars.'),
  p('starDensity', 'Stars Density', 0, 0.6, 0.01, '', 'Share of the star grid cells that hold a star.'),
  p('starCell', 'Stars Spacing', 8, 80, 1, 'px', 'Size of one star grid cell; smaller cells mean more, closer stars.'),
  p('starFlare', 'Stars Flare', 0, 10, 0.1, '×', 'How much a star brightens as the light front passes.'),
  p('remnantAt', 'Core Starts Fading', 0.1, 5, 0.05, 's', 'When the hot core starts to dim; it is fully lit from the explosion until then.'),
  p('remnantDecay', 'Core Fade', 0.05, 3, 0.01, 's', 'Time for the core to dim to about a third.'),
  p('redshiftDuration', 'Redshift Duration', 0.05, 3, 0.05, 's', 'Time for the core light to go from white through orange to deep red.'),
  p('remnantRadius', 'Core Size', 0.002, 0.08, 0.001, 'share', 'Glow radius of the core.'),
  p('horizonAt', 'Horizon Forms', 0.1, 6, 0.05, 's', 'When the shadow starts to grow.'),
  p('horizonGrowth', 'Horizon Growth', 0.02, 3, 0.01, 's', 'Time for the shadow to reach full size. The ringdown starts when it does.'),
  p('lensDuration', 'Lens Build-up', 0.05, 4, 0.05, 's', 'Time for the lens to reach full strength, starting when the core starts fading.'),
  p('ringDelay', 'Ring Delay', 0, 2, 0.05, 's', 'Delay after the horizon forms before the photon ring appears.'),
  p('ringFadeIn', 'Ring Fade In', 0.02, 3, 0.02, 's', 'Time for the photon ring to reach full brightness.'),
  p('ringBrightness', 'Ring Brightness', 0, 3, 0.05, '×', 'Brightness of the photon ring.'),
  p('ringdownAmplitude', 'Wobble Size', 0, 0.3, 0.005, '×', 'How much the horizon swells and shrinks, as a share of its radius.'),
  p('ringdownFrequency', 'Wobble Frequency', 0.1, 10, 0.1, 'Hz', 'Oscillations per second.'),
  p('ringdownDecay', 'Wobble Decay', 0.05, 4, 0.05, 's', 'Time for the wobble to die down to about a third.'),
  p('ringFlicker', 'Ring Flicker', 0, 10, 0.1, '×', 'How much the photon ring brightness follows the wobble.'),
  p('gravityWaveDelay', 'Wave Delay', 0, 3, 0.05, 's', 'Delay after the ringdown starts before the wave leaves.'),
  p('gravityWaveAmplitude', 'Wave Strength', 0, 60, 0.5, 'px', 'How far the wave displaces the background.'),
  p('gravityWaveWidth', 'Wave Width', 0.005, 0.3, 0.005, 'share', 'Width of the wave packet.'),
  p('gravityWaveDecay', 'Wave Fade', 0.1, 6, 0.05, 's', 'Time for the wave to fade to about a third.'),
  p('gravityWaveCycles', 'Wave Ripples', 1, 20, 0.5, '', 'Number of ripples inside the packet.'),
  p('titleOffset', 'Position', -0.5, 0.5, 0.01, 'share', 'Height of the title above (negative) or below the centre of the screen.'),
  p('titleSize', 'Size', 0.2, 0.95, 0.01, '', 'Width of the longest line as a share of the screen width.'),
  p('titleWeight', 'Weight', 100, 900, 10, '', 'Stroke weight. Unbounded and Geist Mono follow it; Orbitron has one weight.'),
  p('titleTracking', 'Letter Spacing', 0, 0.6, 0.01, '', 'Space between letters, in multiples of the font size.'),
  p('titleGlow', 'Glow', 0, 3, 0.05, '×', 'Brightness of the lit letters once the flash has cooled.'),
  p('titleFlash', 'Flash', 0, 8, 0.1, '×', 'Blue-white flash where the light front strikes the letters.'),
  p('titleCooling', 'Cooling', 0.05, 3, 0.05, 's', 'Time for the flash to cool to about a third, leaving the warm glow.'),
  p('titleDust', 'Dust Texture', 0, 1, 0.01, '', '0 draws solid letters; 1 leaves only grains of dust inside them.'),
  p('dissolveAt', 'Dissolve Starts', 0, 10, 0.05, 's', 'When the letters start to crumble into dust.'),
  p('dissolveDuration', 'Dissolve Duration', 0.1, 5, 0.05, 's', 'Time for the letters to crumble away completely.'),
  p('titleDrift', 'Dust Drift', 0, 600, 5, 'px', 'How far the crumbling dust is pulled towards the black hole.'),
  p('releaseAt', 'Release To Cursor', 0, 12, 0.05, 's', 'When the black hole leaves the center and starts following the cursor.'),
  p('introEnd', 'Intro Ends', 0.5, 12, 0.05, 's', 'When the hints appear; the loop restarts a second later.'),
  p('centerHoldFrequency', 'Center Stiffness', 1, 40, 0.5, 'rad/s', 'How firmly the black hole is held at the center during the intro.'),
  p('followFrequency', 'Follow Stiffness', 0.5, 30, 0.5, 'rad/s', 'How quickly the black hole catches up with the cursor; lower feels heavier.'),
  p('scrollSpeedGain', 'Scroll Speed Gain', 0, 40, 0.5, '×', 'Flight speed added at full scroll.')
].map(spec => [spec.key, spec])) as Record<IntroParamKey, IntroParamSpec>

export function formatParam (value: number, spec: IntroParamSpec) {
  const decimals = Math.max(0, Math.min(3, Math.ceil(-Math.log10(spec.step))))
  const number = value.toFixed(decimals)
  switch (spec.unit) {
  case '': return number
  case 'share': return `${(value * 100).toFixed(Math.max(decimals - 2, 1))}%`
  case '×': return `${number}×`
  default: return `${number} ${spec.unit}`
  }
}
