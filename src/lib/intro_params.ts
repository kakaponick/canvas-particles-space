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
  echoPowerDecay: 3.5,
  echoDecay: 0.3,
  echoFloor: 0.35,
  dustShock: 1.2,
  dustScale: 220,
  dustThreshold: 0.55,
  dustSweep: 1,
  dustBlow: 90,
  dustDrift: 10,
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
  starFlare: 3,
  // Collapsing core
  remnantAt: 1,
  remnantDecay: 0.35,
  redshiftDuration: 0.7,
  remnantRadius: 0.012,
  // Shadow of the newborn black hole
  horizonAt: 1.3,
  horizonGrowth: 0.45,
  lensDuration: 0.95,
  ringDelay: 0.1,
  ringFadeIn: 0.5,
  // Ringdown: the new shadow wobbles as an oval; pitch and length are multiples of what a real black
  // hole of the same size rings at, so a bigger hole rings lower and longer
  ringdownAmplitude: 0.035,
  ringdownPitch: 0.28,
  ringdownLength: 5.1,
  ringFlicker: 2,
  // Gravitational wave: the ringdown's wobble carried outward at the speed of light
  gravityWaveGain: 5.5,
  // Title, written in dust that the light front lights up
  titleOffset: -0.3,
  titleSize: 0.6,
  titleWeight: 500,
  titleTracking: 0.08,
  titleGlow: 0.9,
  titleFlash: 1.2,
  titleCooling: 0.45,
  titleDust: 0.45,
  titlePush: 0.05,
  titleHalo: 0.5,
  titleHaloRadius: 10,
  titleStreak: 3,
  titleFringe: 1.5,
  dissolveAt: 2.9,
  dissolveDuration: 2.4,
  titleFallEase: 2,
  titleDrift: 160,
  titleSwirl: 1,
  titleRedshift: 0.7,
  titleGrain: 1,
  // How the black hole takes the title
  titleTidal: 2,
  titleSpiral: 1,
  titleSpread: 0.75,
  titleStream: 0.5,
  titleOrder: 0.3,
  titleTrail: 0.8,
  titleHeat: 1.6,
  // How the title arrives and leaves; each is the index of an option in its spec
  titleEntrance: 0,
  titleInAt: 0.6,
  titleInDuration: 1,
  titleExit: 0,
  // Black hole motion and the end of the intro
  releaseAt: 5.4,
  introEnd: 5.8,
  centerHoldFrequency: 12,
  originAtHole: 1,
  // Colours, as 0xRRGGBB
  colorFlash: 0xfff7eb,
  colorLight: 0xdbebff,
  colorDust: 0xffd6a8,
  colorTitle: 0xffe6c7,
  colorEmber: 0xff5c1f,
  // Camera and film; all of it is gone by the end of the intro
  cameraZoom: 1,
  cameraSettle: 3,
  cameraKick: 0,
  shakeAmount: 0,
  shakeDecay: 0.5,
  lensFringe: 0,
  vignette: 0,
  filmGrain: 0,
  letterbox: 0
}

export const TITLE_ENTRANCES = ['Lit by the light front', 'Fades in', 'Gathers from dust', 'Comes out of the black hole'] as const
export const TITLE_EXITS = ['Falls into the black hole', 'Flies past the camera', 'Burns away', 'Fades out'] as const

export type IntroParams = typeof DEFAULT_INTRO_PARAMS
export type IntroParamKey = keyof IntroParams

// 'share' is shown as a percentage; 'em' is a multiple of the title's font size
export type ParamUnit = 's' | 'Hz' | 'rad/s' | 'px' | 'px/s' | 'em' | '×' | 'share' | 'rad' | 'c' | ''

export interface IntroParamSpec {
  key: IntroParamKey
  label: string
  min: number
  max: number
  step: number
  unit: ParamUnit
  // One line under the control in the debugger, at most 42 characters
  hint: string
  description: string
  // The full name where the short visible label leans on its track ("Brightness" under Light Front): the
  // slider's name for screen readers and the label the agent API shows. It contains the visible label
  spokenName?: string
  // A colour is stored as 0xRRGGBB and edited with a colour picker
  color?: boolean
  // A choice is stored as the index of one of these and edited with a list
  options?: readonly string[]
}

const p = (key: IntroParamKey, label: string, min: number, max: number, step: number, unit: ParamUnit, hint: string, description: string): IntroParamSpec =>
  ({ key, label, min, max, step, unit, hint, description })

const color = (key: IntroParamKey, label: string, hint: string, description: string): IntroParamSpec =>
  ({ key, label, min: 0, max: 0xffffff, step: 1, unit: '', hint, description, color: true })

const choice = (key: IntroParamKey, label: string, options: readonly string[], hint: string, description: string): IntroParamSpec =>
  ({ key, label, min: 0, max: options.length - 1, step: 1, unit: '', hint, description, options })

const spoken = (spec: IntroParamSpec, spokenName: string): IntroParamSpec => ({ ...spec, spokenName })

// The name of a parameter out of its track's context
export const introParamName = (spec: IntroParamSpec) => spec.spokenName ?? spec.label

export const colorToCss = (value: number) => `#${Math.round(value).toString(16).padStart(6, '0')}`
export const cssToColor = (css: string) => Number.parseInt(css.slice(1), 16) || 0

// Range, unit and meaning of every tunable number, keyed by parameter
export const INTRO_PARAM_SPECS = Object.fromEntries([
  spoken(p('starChargeStart', 'Appears', 0, 3, 0.05, 's', 'When the star starts to brighten', 'When the star starts to brighten.'), 'Star Appears'),
  p('collapseAt', 'Explosion', 0.1, 4, 0.05, 's', 'When the star explodes', 'When the star explodes. Every later event of the explosion counts from here.'),
  spoken(p('starPeakGlow', 'Peak Glow', 0, 5, 0.05, '×', 'Star brightness just before it explodes', 'Brightness of the star just before it explodes.'), 'Star Peak Glow'),
  spoken(p('starRadiusStart', 'Size at Start', 0, 0.05, 0.001, 'share', 'Glow radius at start, % of short side', 'Glow radius when the star appears.'), 'Star Size at Start'),
  spoken(p('starRadiusGrowth', 'Size Growth', 0, 0.05, 0.001, 'share', 'Glow growth to the blast, % of short side', 'How much the glow grows until the explosion.'), 'Star Size Growth'),
  spoken(p('glareRise', 'Rise', 0.005, 0.5, 0.005, 's', 'Time from the explosion to peak glare', 'Time from the explosion to peak brightness.'), 'Glare Rise'),
  spoken(p('glarePeak', 'Peak', 0, 20, 0.1, '×', 'Peak brightness of the explosion', 'Peak brightness of the explosion as the camera sees it.'), 'Glare Peak'),
  spoken(p('glareDecay', 'Decay', 0.02, 2, 0.01, 's', 'Higher: the glare lingers longer', 'Time for the glare to drop to about a third. Short values clear the view before the shadow forms.'), 'Glare Decay'),
  spoken(p('glareRadius', 'Radius', 0.002, 0.2, 0.001, 'share', 'Halo radius, % of short side', 'Size of the halo around the source.'), 'Glare Radius'),
  p('exposureDip', 'Exposure Dip', 0, 2, 0.01, '×', 'How much the scene darkens under the glare', 'How much the camera darkens the rest of the scene while the glare is bright, instead of whiting out.'),
  spoken(p('lightCrossTime', 'Crossing', 0.2, 4, 0.05, 's', 'Seconds for light to cross the screen', 'The on-screen speed of light: seconds for the light front to cross to the farthest corner. The gravitational wave travels at the same speed.'), 'Light Crossing'),
  spoken(p('lightPower', 'Brightness', 0, 8, 0.1, '×', 'Light front brightness on dust', 'Brightness of the light front where it strikes dust.'), 'Front Brightness'),
  spoken(p('lightPowerDecay', 'Fade', 0.1, 5, 0.05, 's', 'Higher: the light front fades slower', 'Time for the front to fade to about a third as it spreads.'), 'Front Fade'),
  spoken(p('lightWidth', 'Width', 0.001, 0.05, 0.001, 'share', 'Front thickness, % of short side', 'Thickness of the light front.'), 'Front Width'),
  spoken(p('lightDustContrast', 'Needs Dust', 0, 1, 0.01, '', '0 = even ring · 1 = only where dust is', '1 shows the front only where it hits dust; 0 draws an even ring.'), 'Front Needs Dust'),
  spoken(p('echoPower', 'Brightness', 0, 4, 0.05, '×', 'Dust glow after the light front passes', 'How bright the dust glows once the light front has passed it.'), 'Echo Brightness'),
  spoken(p('echoPowerDecay', 'Fade', 0.1, 6, 0.05, 's', 'Higher: the whole echo fades slower', 'Time for the echo as a whole to fade to about a third.'), 'Echo Fade'),
  spoken(p('echoDecay', 'Afterglow', 0.02, 2, 0.01, 's', 'Higher: dust glows longer, in a wider band', 'How long a patch of dust keeps glowing after the front passes it; sets the width of the glowing band. Thin haze goes dark sooner than this and thick cloud holds its light longer, so the dust goes out patch by patch.'), 'Echo Afterglow'),
  spoken(p('dustScale', 'Scale', 40, 800, 5, 'px', 'Size of the dust structures', 'Size of the dust structures.'), 'Dust Scale'),
  spoken(p('dustThreshold', 'Sparseness', 0, 0.95, 0.01, '', 'Higher: fewer, thinner wisps', 'Higher values leave only a few thin wisps; lower values fill space with haze.'), 'Dust Sparseness'),
  spoken(p('echoFloor', 'Stays Lit', 0, 1, 0.01, '', 'Glow the dust keeps after the flash', 'Share of the glow the dust keeps after the flash has settled, until the matter front clears it. 0: the dust fades out where it stands; higher values keep it lit so it leaves by being swept away, not by fading.'), 'Echo Stays Lit'),
  p('dustShock', 'Matter Lights Dust', 0, 5, 0.05, '×', 'Dust flare where the matter front hits', 'How brightly the dust flares where the matter front strikes it, the same front the particles are born behind. It weakens as the front spreads. 0 removes it.'),
  p('dustBlow', 'Blast Pushes Dust', 0, 600, 5, 'px', 'How far the blast pushes the dust', 'How far the explosion pushes the dust outward once the light front has passed it, fast at first and then easing off. 0 leaves it in place.'),
  spoken(p('dustDrift', 'Drift Speed', 0, 80, 1, 'px/s', 'How fast the dust drifts on its own', 'How fast the dust drifts on its own, in pixels per second, so it is never a still picture. 0 stops it.'), 'Dust Drift Speed'),
  p('dustSweep', 'Matter Clears Dust', 0, 1, 0.01, '', 'How fully the matter wipes out the dust', 'How completely the ejected matter sweeps away the dust it passes. 1: light lights the dust and the matter front wipes it out. 0: the dust stays where it is.'),
  spoken(p('matterSpeed', 'Speed', 0.05, 0.95, 0.01, 'c', 'Matter speed; 1 c = speed of light', 'Speed of the ejected matter, which births the particle field, as a share of the speed of light.'), 'Matter Speed'),
  spoken(p('waveRefraction', 'Refraction', 0, 80, 1, 'px', 'How much the matter front bends the view', 'How strongly the matter front bends what lies behind it.'), 'Matter Refraction'),
  spoken(p('waveWidth', 'Front Width', 0.01, 0.3, 0.005, 'share', 'Band width, % of short side', 'Width of the refracting band at the matter front.'), 'Matter Front Width'),
  spoken(p('burstPeak', 'Speed', 0, 15, 0.1, '×', 'Extra particle speed after the explosion', 'Extra flight speed right after the explosion, fading as the matter spreads.'), 'Burst Speed'),
  spoken(p('burstCurve', 'Falloff', 0.5, 6, 0.1, '', 'Higher: the burst slows down sooner', 'How quickly the burst speed falls off; higher values fall off sooner.'), 'Burst Falloff'),
  spoken(p('revealFeather', 'Softness', 1, 400, 1, 'px', 'Soft edge where new particles appear', 'Width of the fade where new particles appear behind the matter front.'), 'Birth Softness'),
  spoken(p('starsInitial', 'At Start', 0, 1, 0.01, '', 'Background star brightness at page load', 'Brightness of the background stars when the page opens.'), 'Stars at Start'),
  spoken(p('starsFadeIn', 'Fade In', 0, 5, 0.05, 's', 'Time for stars to reach full brightness', 'Time for the background stars to reach full brightness.'), 'Stars Fade In'),
  spoken(p('starFlare', 'Flare', 0, 10, 0.1, '×', 'Star flash as the light front passes', 'How much a star brightens as the light front passes.'), 'Stars Flare'),
  spoken(p('remnantAt', 'Starts Fading', 0.1, 5, 0.05, 's', 'When the hot core starts to dim', 'When the hot core starts to dim; it is fully lit from the explosion until then.'), 'Core Starts Fading'),
  spoken(p('remnantDecay', 'Fade', 0.05, 3, 0.01, 's', 'Higher: the core dims slower', 'Time for the core to dim to about a third.'), 'Core Fade'),
  p('redshiftDuration', 'Redshift Duration', 0.05, 3, 0.05, 's', 'Time for the core to go from white to red', 'Time for the core light to go from white through orange to deep red.'),
  spoken(p('remnantRadius', 'Size', 0.002, 0.08, 0.001, 'share', 'Core glow radius, % of short side', 'Glow radius of the core.'), 'Core Size'),
  spoken(p('horizonAt', 'Forms', 0.1, 6, 0.05, 's', 'When the shadow starts to grow', 'When the shadow starts to grow.'), 'Shadow Forms'),
  spoken(p('horizonGrowth', 'Growth', 0.02, 3, 0.01, 's', 'Time for the shadow to reach full size', 'Time for the shadow to reach full size. The ringdown starts when it does.'), 'Shadow Growth'),
  spoken(p('lensDuration', 'Build-Up', 0.05, 4, 0.05, 's', 'Time for the lens to reach full strength', 'Time for the lens to reach full strength, starting when the core starts fading.'), 'Lens Build-Up'),
  spoken(p('ringDelay', 'Delay', 0, 2, 0.05, 's', 'Wait before the photon ring appears', 'Delay after the shadow forms before the photon ring appears.'), 'Ring Delay'),
  spoken(p('ringFadeIn', 'Fade In', 0.02, 3, 0.02, 's', 'Time for the photon ring to fully brighten', 'Time for the photon ring to reach full brightness.'), 'Ring Fade In'),
  p('ringdownAmplitude', 'Wobble Size', 0, 0.3, 0.005, 'share', 'Oval squash, % of shadow radius', 'How far the new shadow squashes into an oval, one way and then the other, as a share of its radius. The gravitational wave carries this wobble outward, so it also sets how strong the wave is.'),
  p('ringdownPitch', 'Wobble Pitch', 0.05, 2, 0.01, '×', 'Higher: faster wobble, closer ripples', 'How fast the shadow wobbles, as a multiple of what a real black hole of its size does. A bigger black hole wobbles slower. Sets the spacing of the ripples in the gravitational wave too: one ripple per wobble.'),
  p('ringdownLength', 'Wobble Length', 0.5, 30, 0.1, '×', 'Higher: the wobble rings longer', 'How long the wobble rings, as a multiple of what a real black hole of its size does (under one wobble). A bigger black hole rings longer. Sets how long the train of ripples in the gravitational wave is too.'),
  p('ringFlicker', 'Ring Flicker', 0, 10, 0.1, '×', 'How much the ring flickers with the wobble', 'How much the photon ring brightness follows the wobble.'),
  spoken(p('gravityWaveGain', 'Strength', 0, 30, 0.1, '×', 'Warp of the sky by the gravitational wave', 'How far the gravitational wave stretches the sky, as a multiple of the wobble of the shadow itself. The wave leaves when the ringdown starts, moves at the speed of light, stretches one way and squeezes the other in the same pattern as the oval shadow, and weakens with distance.'), 'Wave Strength'),
  p('titleOffset', 'Position', -0.5, 0.5, 0.01, 'share', 'Title height; negative = above center', 'Height of the title above (negative) or below the center of the screen. The words are always kept clear of the screen edges and of the letterbox bars, so near an edge the title stops short of this.'),
  p('titleSize', 'Size', 0.2, 0.95, 0.01, 'share', 'Longest line, as % of screen width', 'Width of the longest line as a share of the screen width.'),
  p('titleWeight', 'Weight', 100, 900, 10, '', 'Stroke weight of the letters', 'Stroke weight. Unbounded and Geist Mono follow it; Orbitron has one weight.'),
  p('titleTracking', 'Letter Spacing', 0, 0.6, 0.01, 'em', 'Space between letters', 'Space between letters, in multiples of the font size.'),
  p('titleGlow', 'Glow', 0, 3, 0.05, '×', 'Letter brightness after the flash cools', 'Brightness of the lit letters once the flash has cooled.'),
  p('titleFlash', 'Flash', 0, 8, 0.1, '×', 'Flash where the light hits the letters', 'Blue-white flash where the light front strikes the letters.'),
  p('titleCooling', 'Cooling', 0.05, 3, 0.05, 's', 'Higher: the flash cools slower', 'Time for the flash to cool to about a third, leaving the warm glow.'),
  p('titleDust', 'Dust Texture', 0, 1, 0.01, '', '0 = solid letters · 1 = grains of dust', '0 draws solid letters; 1 leaves only grains of dust inside them.'),
  p('titlePush', 'Camera Push-In', 0, 0.4, 0.01, '', 'Slow growth of the title; 0 = still', 'How much the title slowly grows from the moment it is lit until it is gone, like a camera moving in. 0 holds it still.'),
  p('titleHalo', 'Halo', 0, 3, 0.05, '×', 'Brightness of the glow around the letters', 'Brightness of the soft glow around the letters. It flares with the flash and fades as the letters crumble.'),
  p('titleHaloRadius', 'Halo Size', 1, 60, 1, 'px', 'How far the glow reaches', 'How far the glow reaches from the letters.'),
  p('titleStreak', 'Halo Streak', 1, 8, 0.1, '×', 'Higher: the glow stretches out sideways', 'How much wider than tall the glow is; higher values draw it out sideways like the flare of an anamorphic lens.'),
  p('titleFringe', 'Color Fringe', 0, 12, 0.1, 'px', 'Red and blue edges on the letters', 'Red and blue edges on the letters, growing towards the ends of the title, as a lens would give. 0 removes them.'),
  p('dissolveAt', 'Leaves At', 0, 10, 0.05, 's', 'When the title starts to leave', 'When the title starts to leave, in the way Leaves sets.'),
  p('dissolveDuration', 'Leaving Duration', 0.1, 5, 0.05, 's', 'Time for the title to leave completely', 'Time for the title to leave completely.'),
  p('titleGrain', 'Dissolve Grain', 0, 1, 0.01, '', '0 = whole · 1 = specks; Falls in only', '1 breaks the letters into specks that each fall at their own speed and wink out at their own moment. 0 keeps the letters whole: they are drawn into the black hole as one smooth image. Used only when the title falls into the black hole.'),
  p('titleFallEase', 'Fall Acceleration', 1, 5, 0.05, '', 'Higher: hangs, then rushes; Falls in only', 'How the fall into the black hole gathers speed over Leaving Duration, when the title falls into the black hole. 1: an even pace; higher values hang longer at first and rush more at the end.'),
  p('titleTidal', 'Near End First', 1, 5, 0.05, '', 'Higher: the near end is taken first', 'How much sooner the black hole takes the part of the title nearest to it. 1 slides the whole title the same distance; higher values draw the near end out into the hole while the far end still stands.'),
  p('titleSpiral', 'Spiral Tightness', 0, 1, 0.01, '', 'Higher: tighter spiral; needs Dust Swirl', 'With Dust Swirl on: 0 turns the title around the hole as one piece, 1 winds the part near the hole further round than the rest, into a spiral.'),
  p('titleSpread', 'Speck Speed Spread', 0, 1, 0.01, '', 'Specks\' speed spread; needs Dissolve Grain', 'How much the specks differ in speed. 0: they all fall together and the letters keep their shape; 1: the fastest race ahead and the slowest barely move. Needs Dissolve Grain above 0.'),
  p('titleStream', 'Speck Streams', 0, 1, 0.01, '', 'Patchy speck motion; needs Dissolve Grain', 'How much a speck moves with its neighbors. 0: every speck on its own, a fine spray; 1: whole patches move together, like currents. Needs Dissolve Grain above 0.'),
  p('titleOrder', 'Vanish Order', 0, 1, 0.01, '', '0 = random · 1 = outward from the hole', 'In what order the specks wink out. 0: at random all over the title; 1: in a wave that starts at the black hole and spreads outward. Needs Dissolve Grain above 0.'),
  p('titleTrail', 'Trail', 0, 1.2, 0.01, '×', 'Brightness of the letters\' streak', 'Brightness of the streak the moving letters leave behind them. 0 removes it.'),
  p('titleHeat', 'Infall Heat', 0, 5, 0.05, '×', 'How much the title brightens as it falls', 'How much the title brightens halfway through its fall, before it reddens. 0 keeps it even.'),
  p('titleDrift', 'Dust Pull', 0, 3000, 5, 'px', 'How far the hole pulls the falling dust', 'How far the crumbling dust is pulled towards the black hole at the default Gravity. The Gravity setting scales it and pushes the dust away when negative; dust beyond Gravity Reach crumbles last and barely moves; dust that crosses the Event Horizon is gone.'),
  p('titleSwirl', 'Dust Swirl', 0, 4, 0.05, '×', 'How much the dust swirls around the hole', 'How strongly the Orbital Force setting turns the falling dust around the black hole. 0 lets it fall straight.'),
  p('titleRedshift', 'Dust Redshift', 0, 1, 0.01, '', 'How much the dust reddens as it falls', 'How far the dust reddens and dims as it falls, as the collapsing core did. 0 keeps its color.'),
  p('releaseAt', 'Release to Cursor', 0, 12, 0.05, 's', 'When the hole starts following the cursor', 'When the black hole leaves the center and starts following the cursor.'),
  p('introEnd', 'Intro Ends', 0.5, 12, 0.05, 's', 'When the intro ends and hints appear', 'When the hints appear; the loop restarts a second later.'),
  p('centerHoldFrequency', 'Hold Stiffness', 1, 40, 0.5, 'rad/s', 'How firmly the hole is held in place', 'How firmly the black hole is held where the intro happens until it is released.'),
  p('originAtHole', 'Start at Hole', 0, 1, 0.05, '', '0 = screen center · 1 = at the black hole', 'Where the intro happens. 1 = at the black hole position saved in Settings (Position X and Y): the star, the explosion, its light and matter fronts, the waves and the newborn hole are all centered there. 0 = at the center of the screen. Values between place it part of the way.'),
  choice('titleEntrance', 'Arrives', TITLE_ENTRANCES, 'How the title appears', 'How the title appears. Lit by the light front: it is there in the dark and the explosion lights it. The other three start at Arrives At and take Arrival Duration: a plain fade, dust gathering into letters, or the letters coming out of the black hole whole (set Arrives At after the shadow forms).'),
  p('titleInAt', 'Arrives At', 0, 10, 0.05, 's', 'Arrival start; ignored if lit by the front', 'When the title starts to appear. Not used when the light front lights it.'),
  p('titleInDuration', 'Arrival Duration', 0.05, 5, 0.05, 's', 'Arrival time; ignored if lit by the front', 'Time for the title to appear completely. Not used when the light front lights it.'),
  choice('titleExit', 'Leaves', TITLE_EXITS, 'How the title leaves', 'How the title goes, from Leaves At over Leaving Duration. Falls into the black hole: the dust settings below shape it. Flies past the camera: it grows until it is gone. Burns away: fire eats it from its ends inwards. Fades out: it dims where it stands.'),
  color('colorFlash', 'Flash Color', 'Color of the star and the explosion', 'Color of the star and of the explosion as the camera sees it; the core starts at this color too.'),
  spoken(color('colorLight', 'Color', 'Color of the light front', 'Color of the light front and of the flash it leaves on the title.'), 'Light Color'),
  spoken(color('colorDust', 'Color', 'Color of the glowing dust', 'Color of the dust that keeps glowing after the light front has passed.'), 'Dust Color'),
  spoken(color('colorTitle', 'Color', 'Color of the lit letters', 'Color of the lit letters once the flash has cooled.'), 'Title Color'),
  color('colorEmber', 'Ember Color', 'Color of the cooling core and falling dust', 'Color the core cools to as it collapses, and the color of title dust falling into the hole or burning.'),
  p('cameraZoom', 'Zoom at Start', 0.5, 2.5, 0.01, '×', 'Above 1 = starts close · below 1 = wide', 'How far the camera is zoomed in on the place of the explosion when the page opens. Above 1 it starts close and pulls back; below 1 it starts wide and pushes in. It always ends at 1.'),
  p('cameraSettle', 'Zoom Settles', 0.1, 12, 0.05, 's', 'Time for the zoom to settle back to 1', 'Time after the explosion for the zoom to reach 1. The camera only creeps until the explosion, which throws it: most of the way at once, the rest slowly.'),
  p('cameraKick', 'Zoom Punch', 0, 0.5, 0.01, '×', 'Instant zoom-in at the blast; 0 = none', 'How far the explosion punches the zoom in for an instant, like the camera recoiling. 0 is none.'),
  p('shakeAmount', 'Shake', 0, 60, 0.5, 'px', 'Camera jolt from the blast; 0 = none', 'How far the explosion jolts the camera.'),
  p('shakeDecay', 'Shake Decay', 0.05, 3, 0.05, 's', 'Higher: the shake lasts longer', 'Time for the shake to die down to about a third.'),
  p('lensFringe', 'Lens Fringe', 0, 20, 0.1, 'px', 'Red and blue edges toward the corners', 'Red and blue edges on the particles towards the corners of the frame, as a cheap lens gives. 0 removes them.'),
  p('vignette', 'Vignette', 0, 1, 0.01, '', 'How much the frame corners darken', 'How much the corners of the frame darken.'),
  spoken(p('filmGrain', 'Grain', 0, 0.5, 0.005, '', 'Flickering grain over the frame; 0 = none', 'Strength of the flickering grain over the whole frame.'), 'Film Grain'),
  p('letterbox', 'Letterbox', 0, 0.3, 0.005, 'share', 'Bar height top and bottom, % of screen', 'Height of the black bar at the top and at the bottom, as a share of the screen height. The bars open when the intro ends.')
].map(spec => [spec.key, spec])) as Record<IntroParamKey, IntroParamSpec>

// A real black hole's strongest ringdown tone (the l = 2 mode of a non-spinning hole): with its shadow
// radius R and the speed of light c, it wobbles at 0.309 c / R and its wobble fades by e in 2.163 R / c
export const RINGDOWN_PHYSICAL_FREQUENCY = 0.30902
export const RINGDOWN_PHYSICAL_DECAY = 2.1634

// The screen the old absolute ringdown values were tuned on: 1920 × 1080, the explosion in the middle,
// the default black hole size of 8% of the short side
const REFERENCE_REACH = Math.hypot(960, 540) * 1.15
const REFERENCE_SHADOW = 86.4
// Distance from the hole at which the old Wave Strength in pixels is matched
const REFERENCE_WAVE_DISTANCE = 300

// Saves from before the ringdown followed the black hole's size held it in Hz and seconds, and the wave in
// pixels; they become the multiples that look the same on the reference screen
export function migrateIntroParams (stored: Record<string, unknown>): Record<string, unknown> {
  const number = (key: string, fallback: number) => {
    const value = stored[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }
  const migrated = { ...stored }
  const lightSpeed = REFERENCE_REACH / Math.max(number('lightCrossTime', DEFAULT_INTRO_PARAMS.lightCrossTime), 0.01)
  if (typeof stored.ringdownFrequency === 'number' && migrated.ringdownPitch === undefined) {
    migrated.ringdownPitch = stored.ringdownFrequency / (RINGDOWN_PHYSICAL_FREQUENCY * lightSpeed / REFERENCE_SHADOW)
  }
  if (typeof stored.ringdownDecay === 'number' && migrated.ringdownLength === undefined) {
    migrated.ringdownLength = stored.ringdownDecay * lightSpeed / (RINGDOWN_PHYSICAL_DECAY * REFERENCE_SHADOW)
  }
  if (typeof stored.gravityWaveAmplitude === 'number' && migrated.gravityWaveGain === undefined) {
    const wobble = Math.max(number('ringdownAmplitude', DEFAULT_INTRO_PARAMS.ringdownAmplitude), 0.001)
    migrated.gravityWaveGain = stored.gravityWaveAmplitude /
      (wobble * REFERENCE_SHADOW * Math.sqrt(REFERENCE_SHADOW / REFERENCE_WAVE_DISTANCE))
  }
  // A converted value lands inside the new range, as a slider would hold it
  for (const key of ['ringdownPitch', 'ringdownLength', 'gravityWaveGain'] as const) {
    const value = migrated[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      migrated[key] = Math.min(Math.max(value, INTRO_PARAM_SPECS[key].min), INTRO_PARAM_SPECS[key].max)
    }
  }
  return migrated
}

export function formatParam (value: number, spec: IntroParamSpec) {
  if (spec.color) return colorToCss(value)
  if (spec.options) return spec.options[Math.round(value)] ?? spec.options[0]
  const decimals = Math.max(0, Math.min(3, Math.ceil(-Math.log10(spec.step))))
  const number = value.toFixed(decimals)
  switch (spec.unit) {
  case '': return number
  case 'share': return `${(value * 100).toFixed(Math.max(decimals - 2, 1))}%`
  case '×': return `${number}×`
  // A no-break space, so a wrapped description never leaves the unit alone on a line
  default: return `${number}\u00a0${spec.unit}`
  }
}
