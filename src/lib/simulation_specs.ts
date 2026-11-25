// Name, range, step, display format and meaning of every numeric simulation setting, and name and meaning
// of every colour setting. The Settings panel builds its sliders and colour rows from here, and the agent
// API (scene_api.ts) describes and validates settings with it, so a setting is described in exactly one place.
import { BASE_SPEED_MAX, BASE_SPEED_MIN, BASE_SPEED_STEP } from './base_speed'
import { HORIZON_SCALE_MAX } from './simulation_presets'

export interface SimulationSettingSpec {
  label: string
  min: number
  max: number
  step: number
  // The value as the panel shows it and a screen reader says it, with its unit
  format: (value: number) => string
  // One line under the slider in the panel (at most 42 characters): what it changes
  hint: string
  // The full explanation, for the agent API
  description: string
  // The name screen readers use where the short visible label leans on its section ("Brightness")
  spokenName?: string
}

const spec = (label: string, min: number, max: number, step: number, format: (value: number) => string, hint: string, description: string): SimulationSettingSpec =>
  ({ label, min, max, step, format, hint, description })

// Gives a spec the name screen readers use; it contains the visible label, so voice control finds it too
const spoken = (setting: SimulationSettingSpec, spokenName: string): SimulationSettingSpec => ({ ...setting, spokenName })

const fixed = (digits: number, unit = '') => (value: number) => `${value.toFixed(digits)}${unit}`
const count = (value: number) => Math.round(value).toLocaleString('en-US')
const percentOfOne = (value: number) => `${Math.round(value * 100)}%`
const percentOfOneFine = (value: number) => `${(value * 100).toFixed(1)}%`
const degrees = (value: number) => `${Math.round(value * 180 / Math.PI)}°`

export const SIMULATION_SETTING_SPECS = {
  numParticles: spoken(spec('Count', 500, 200000, 500, count, 'How many particles fly at once',
    'Total number of particles rendered in the scene. Higher values create denser visuals but may impact performance; with Particle Budget ON the count is trimmed to what your processor keeps up with.'), 'Particle Count'),
  farZ: spec('Field Depth', 500, 50000, 500, count, 'How deep the field reaches, in scene units',
    'How deep the particle field reaches, in scene units: how far particles fly before they are recycled. Larger values feel deeper.'),
  baseSpeed: spec('Base Speed', BASE_SPEED_MIN, BASE_SPEED_MAX, BASE_SPEED_STEP, fixed(1), 'How fast the field flies',
    'Speed of the flight through space. Scrolling over the scene changes it too: down is faster, up is slower.'),
  scrollSpeedStep: spec('Scroll Speed Step', 0, 10, 0.1, fixed(1), 'Speed change per wheel notch; 0 = off',
    'How much one notch of the mouse wheel over the scene changes Base Speed; a swipe on a touch screen follows it too. 0 turns scrolling the speed off.'),
  speedVariance: spec('Speed Variance', 0, 3, 0.05, fixed(2), 'Spread of speeds between particles',
    'Randomizes individual particle speeds. 0 = uniform speed, higher values create more speed variation for organic, natural movement. Above 1 a few particles turn into very fast streaks.'),
  trailIntensity: spec('Trail Fade', 0, 1, 0.01, fixed(2), 'Higher: shorter trails',
    'How fast trails fade behind the particles. Lower values leave longer trails, higher values shorter, crisper ones.'),
  particleSize: spoken(spec('Size', 0.3, 20, 0.1, fixed(1, ' px'), 'Width of the nearest particles',
    'Stroke width of the nearest particles. Particles get thinner with distance, down to Min Size at the far end of the field.'), 'Particle Size'),
  particleSizeMin: spoken(spec('Min Size', 0, 20, 0.05, fixed(2, ' px'), 'Width of the farthest particles',
    'Stroke width of the particles at the far end of the field: Size thins with distance and stops here. Raised to Size and above, every particle is drawn this wide whatever its distance; 0 lets the far ones thin away to nothing.'), 'Particle Min Size'),
  spawnRadius: spec('Spawn Radius', 50, 5000, 50, count, 'Birth disc radius, in scene units',
    'Radius of the disc particles are born in, in scene units. Smaller keeps more particles on screen and close; larger spreads them past the edges.'),
  baseBrightness: spec('Base Brightness', 0, 10, 0.1, fixed(1, '×'), 'Multiplies every particle\'s brightness',
    'Global brightness multiplier for all particles. Values above 1.0 increase luminosity, below 1.0 create dimmer effects.'),
  speedGlow: spec('Speed Glow', 0, 5, 0.05, fixed(2), 'Higher: only fast particles glow',
    'How strongly brightness follows a particle\'s speed. 0 = every moving particle is fully lit, 1 = slow particles are dimmer and fast ones brighter, higher values leave only the fast ones glowing. A particle that stands still is always dark.'),
  speedGlowKnee: spoken(spec('Glow Knee', 0.01, 5, 0.01, fixed(2, ' px'), 'Speed that lights a particle half way',
    'The speed at which a particle reaches half its brightness, in screen pixels per 60th of a second. Speed Glow bends the curve round this point: lower lights slow particles sooner, so the far field and a slow flight show; higher leaves only the fast streaks near the camera lit.'), 'Speed Glow Knee'),
  depthFade: spec('Depth Fade', -1, 3, 0.05, fixed(2), 'Higher: far particles fade more',
    'Controls how much particle opacity decreases with distance. 0 = uniform brightness, 1 = far particles fade out, above 1 they vanish sooner, below 0 far particles are the brighter ones.'),
  minOpacity: spec('Min Opacity', 0, 1, 0.01, percentOfOne, 'Floor for far, faint particles',
    'Minimum allowed opacity for particles. Prevents particles from becoming completely invisible at maximum depth.'),
  maxOpacity: spec('Max Opacity', 0, 1, 0.01, percentOfOne, 'Ceiling for near, bright particles',
    'Maximum allowed opacity for particles. Useful for creating subtle, semi-transparent effects at close range.'),
  pulseIntensity: spec('Pulse Intensity', 0, 3, 0.05, fixed(2), 'Strength of the brightness pulse',
    'Amplitude of the pulsating brightness effect. Higher values create more dramatic oscillations in particle luminosity.'),
  pulseSpeedMultiplier: spec('Pulse Speed', 0, 20, 0.1, fixed(1, '×'), 'Pulse rate; 0 = no pulse',
    'Speed multiplier for the pulsating effect. Higher values create faster breathing animations. Set to 0 to disable pulsation.'),
  flightTintGradient: spec('Flight Tint Gradient', 0, 10, 0.05, fixed(2), 'Higher: red begins nearer the centre',
    'How fast the tint of a fast flight (the Doppler shift of the particles) turns from its color ahead to its color at the edges, going outward from the point the field flies out of. The turn lies 1 / this of the way to the corner of the frame: 1.7 puts it at 0.59, 4 at a quarter, and 1 and below leave the whole frame in the color ahead.'),
  flightTintLimit: spec('Flight Tint Limit', 0, 1, 0.01, percentOfOne, 'Most of a color the tint replaces',
    'The most of a particle\'s own color the tint of a fast flight replaces. 1 lets the fastest flight turn the particles fully into the tint\'s two colors; 0 removes the tint.'),
  flightTintFrom: spec('Flight Tint From', 0, 200, 0.1, fixed(1), 'Flight speed where the tint begins',
    'The flight speed (Base Speed, times the burst of the opening) at which the tint of a fast flight begins. 0 tints even a slow flight.'),
  flightTintFull: spec('Flight Tint Full', 0, 200, 0.1, fixed(1), 'Flight speed where the tint is whole',
    'The flight speed at which the tint of a fast flight is at its strongest; between Flight Tint From and this it grows evenly. At or below Flight Tint From the tint switches on at once.'),
  starsBrightness: spoken(spec('Brightness', 0, 10, 0.05, fixed(2, '×'), 'Brightness of the background stars',
    'Overall brightness of the distant background stars.'), 'Star Brightness'),
  starDensity: spoken(spec('Density', 0, 1, 0.01, percentOfOne, 'Share of grid cells that hold a star',
    'Share of the star grid cells that hold a star.'), 'Star Density'),
  starCell: spoken(spec('Spacing', 4, 200, 1, fixed(0, ' px'), 'Grid cell size; smaller packs stars closer',
    'Size of one star grid cell; smaller cells mean more, closer stars.'), 'Star Spacing'),
  nebula: spoken(spec('Brightness', 0, 3, 0.01, fixed(2, '×'), 'Glowing dust behind the stars; 0 = off',
    'Brightness of a nebula: the dust cloud the opening\'s flash lights, glowing steadily behind the stars in Nebula Color, with patches of Nebula Second Color, and bent by the lens and rippled by the waves like the stars. Its shape is the dust\'s, set by parameters of the opening: Dust Scale sizes its clouds, Dust Sparseness sets how much of the sky they fill (low values fill it with haze, high ones leave a few thin wisps), Dust Drift Speed moves them. It shows as the opening lets the background stars show, and hiding the stars layer hides it too. 0 turns it off.'), 'Nebula Brightness'),
  blackHoleSize: spoken(spec('Size', 0, 60, 0.5, fixed(1, '%'), 'Shadow radius, % of short side; 0 = none',
    'Radius of the black hole\'s shadow as a share of the screen\'s short side. Everything else is measured from it: the photon ring, the event horizon, the lens, the strength and reach of gravity, the orbits of the stars. The radius of a real black hole\'s shadow is 2.6 Schwarzschild radii. 0 removes the black hole.'), 'Black Hole Size'),
  horizonScale: spec('Event Horizon', 0, HORIZON_SCALE_MAX, 0.05, fixed(2, '×'), 'Capture radius, in hole radii; 0 = none',
    'Radius of no return, in black hole radii, so it follows the black hole\'s size. Particles and orbiting stars that cross it are destroyed and recycled. 1 is the edge of the shadow, where a real black hole captures light; below 1 they vanish inside the shadow, above 1 before reaching it; 0 lets them fly through.'),
  blackHoleSpin: spoken(spec('Spin', 0, 0.998, 0.002, fixed(3), 'How fast the hole turns; 0 = not at all',
    'How fast the black hole turns, as a share of the most a black hole can (a/M; 0.998 is as far as infalling matter can spin one up). Spin flattens the side of the shadow that turns toward the camera and pushes the shadow the other way, with the photon ring along it; under Ray Traced it also drags the light round the hole, so the lensed sky winds and the rings inside lean to one side; the orbiting stars feel its pull round (Lense-Thirring), and the particles Gravity pulls are carried round with the space near the hole: at one black hole radius half as fast as they fall, times the spin, and fading one power of the distance faster than the pull. The share of spin toward the camera swirls them on screen, anticlockwise to the eye; the share that lies in the screen sweeps those nearer than the hole one way across the axis and those beyond it the other. Black Hole Size stays the mass: the shadow of a spinning hole is a little smaller than that of a still one. Two black holes that merge leave a spinning one, whatever this says. 0 = a hole that does not spin.'), 'Black Hole Spin'),
  spinTilt: spec('Spin Tilt', 0, 180, 1, fixed(0, '°'), '0° = axis at you · 90° = seen side-on',
    'Angle between the spin axis and the line to the camera. 0° looks down the axis: the shadow stays round and the sky winds round it; 90° sees the hole side-on, where the shadow is flattest on the side that turns toward the camera. Above 90° the hole turns the other way, and so do the particles and orbiting stars it drags round.'),
  spinAxis: spec('Spin Axis', -180, 180, 1, fixed(0, '°'), 'Axis direction on screen; 0° = up',
    'Which way the spin axis points on the screen, turned from straight up toward the left. It turns the shadow\'s flat side and the lens\'s lean with it.'),
  frameDrag: spec('Frame Drag', 0, 20, 0.1, fixed(1, '×'), 'How hard spin swirls particles; 1 = real',
    'How hard a spinning black hole carries the particles round with the space near it, as a multiple of what the spin itself gives: at 1 a particle one black hole radius out is carried round half as fast as it falls, times Spin, and the drag fades one power of the distance faster than the pull. Higher values make the spiral show without zooming in and reach further out; 0 leaves the particles falling as into a hole that does not spin, while the shadow, the lens and the orbiting stars still follow Spin. It does nothing at Spin 0 or Gravity 0.'),
  frameDragSweep: spec('Drag Sweep', 0, 20, 0.1, fixed(1, '×'), 'Sweep of side-on spin; 1 = as the swirl',
    'How hard the share of spin that lies in the screen (Spin Tilt near 90°) sweeps the particles nearer than the hole one way across the axis and those beyond it the other, as a multiple of how hard spin toward the camera swirls them. It multiplies Frame Drag for that share alone; 0 leaves a side-on hole dragging nothing. The flat mode only: in 3D the axis stands in space and the drag turns round it as it is.'),
  gravityReach: spec('Gravity Reach', 0, 40, 0.5, fixed(1, '×'), 'How far gravity reaches, in hole radii',
    'How far the black hole\'s gravity reaches, in multiples of its size. Particles within this distance are affected by gravity and orbital forces.'),
  blackHoleDepth: spoken(spec('Depth', 0, 100, 1, fixed(0, '%'), 'Where the hole sits, % of Field Depth',
    'How deep in the field the black hole sits, as a share of Field Depth. Its gravity is strongest for particles at this depth.'), 'Black Hole Depth'),
  gravityDepth: spec('Gravity Layer', 1, 100, 1, fixed(0, '%'), 'Pulled layer thickness, % of Field Depth',
    'Thickness of the layer gravity acts on, as a share of Field Depth. Gravity fades away from the black hole\'s depth and ends at twice this; 50% and above reaches the whole field. In 3D gravity follows the true distance and ends at Gravity Reach, so this does nothing there.'),
  gravityStrength: spec('Gravity', -20, 50, 0.5, fixed(1), 'Pull toward the hole; negative pushes',
    'Strength of gravitational attraction toward the black hole center. Higher values create stronger inward pull on particles. Negative values push them away.'),
  orbitalStrength: spec('Orbital Force', -500, 500, 5, fixed(0), 'Swirl around the hole; sign sets direction',
    'Tangential force that causes particles to orbit around the black hole. Creates swirling, accretion disk-like motion patterns. Negative values swirl the other way.'),
  gravityInertia: spec('Inertia', 0, 1, 0.01, fixed(2), 'Speed kept from gravity; 0 = none',
    'How much of the speed the black holes give a particle it keeps from one frame to the next. 0 = the pull moves particles only while it acts, the scene\'s classic motion. 1 = they keep all of it, as bodies in free fall do: they fall faster as they near the hole, swing round it and fly on along bent paths. Between, what they gained dies away by that share every 60th of a second. Gravity, Orbital Force, the spin\'s drag and the second black hole all add to that speed.'),
  followFrequency: spec('Follow Stiffness', 0.1, 60, 0.1, fixed(1, ' rad/s'), 'Lower: the hole trails the cursor more',
    'How quickly the black hole catches up with the cursor; lower values feel heavier.'),
  blackHoleX: spec('Position X', 0, 1, 0.01, percentOfOne, 'Anchor, left to right; turns Follow off',
    'Where the black hole rests, from the left edge to the right. Moving it anchors the black hole there. Saved in presets. Double-click: back to the middle.'),
  blackHoleY: spec('Position Y', 0, 1, 0.01, percentOfOne, 'Anchor, top to bottom; turns Follow off',
    'Where the black hole rests, from the top edge to the bottom. Moving it anchors the black hole there. Double-click: back to the middle.'),
  ringBrightness: spoken(spec('Brightness', 0, 10, 0.05, fixed(2, '×'), 'Brightness of the photon ring',
    'Brightness of the photon ring at the edge of the shadow.'), 'Ring Brightness'),
  ringGlow: spoken(spec('Glow', 0, 3, 0.05, fixed(2, '×'), 'Soft light around the ring; 0 = none',
    'Strength of the soft light around the photon ring\'s line, the glow a camera spreads around something that bright: tight around the line with a faint wide skirt. It follows Brightness, the Doppler sides and the light of infalling matter. 0 leaves the bare line.'), 'Ring Glow'),
  ringWidth: spoken(spec('Thickness', 0, 0.25, 0.001, percentOfOneFine, 'Added width, % of hole radius; 0 = finest',
    'Thickness of the photon ring in black hole radii, added to Finest Line (a pixel and a half, the finest the screen draws cleanly), so every step thickens it and 0 is the thinnest ring.'), 'Ring Thickness'),
  ringDoppler: spec('Doppler Contrast', 0, 1, 0.01, fixed(2), 'Contrast of the bright and dim sides',
    'How much brighter the approaching side of the ring is than the receding side. A mild contrast leaves the ring white; towards 1 the bright side also turns blue and the dim side red.'),
  ringSide: spec('Bright Side', 0, 6.28, 0.05, degrees, 'Bright side\'s direction; 0° = right',
    'Direction of the bright, approaching side around the ring.'),
  ringBase: spec('Base Light', 0, 3, 0.01, fixed(2), 'Ring glow with nothing falling in',
    'How brightly the photon ring shines when nothing is falling into the black hole.'),
  ringFeed: spec('Infall Strength', 0, 10, 0.01, fixed(2), 'How brightly infall lights the ring',
    'How much the ring lights up where particles fall into or skim past the black hole.'),
  ringAfterglow: spec('Afterglow', 0.05, 30, 0.05, fixed(2, ' s'), 'How long infall light lingers',
    'How long the light left by infalling particles lingers on the ring.'),
  ringFlowSpeed: spec('Flow Speed', -30, 30, 0.1, fixed(2, ' rad/s'), 'Bright patches\' speed; sign sets direction',
    'How fast the bright patches travel around the ring. Negative values turn them the other way.'),
  ringWidthMin: spoken(spec('Finest Line', 0.5, 20, 0.1, fixed(1, ' px'), 'Width of the line at Thickness 0',
    'Width of the photon ring\'s line at Thickness 0, in screen pixels at any zoom; Thickness is added to it. 1.5 is the finest line the screen draws cleanly.'), 'Ring Finest Line'),
  ringOffset: spoken(spec('Line Offset', -3, 10, 0.05, fixed(2, '×'), 'Line\'s place off the shadow, in widths',
    'How far outside the edge of the shadow the middle of the ring\'s line stands, in widths of the line. 0 centres it on the edge, where the shadow covers its inner half; negative values draw it inside the shadow.'), 'Ring Line Offset'),
  ringSoftness: spoken(spec('Line Softness', 0.1, 3, 0.05, fixed(2, '×'), 'Bell of the line, as a share of its width',
    'How wide the bell of light that draws the ring\'s line is, as a share of the line\'s width (Finest Line plus Thickness). Low draws a hard hairline in the middle of that width; high spreads the line into a soft band wider than it.'), 'Ring Line Softness'),
  ringGlowCore: spoken(spec('Glow Core', 0.005, 1, 0.005, fixed(3, '×'), 'Reach of the tight glow, in hole radii',
    'How far the tight core of the ring\'s glow reaches from the line, in black hole radii. Glow scales its strength.'), 'Ring Glow Core Reach'),
  ringGlowCoreShare: spoken(spec('Core Strength', 0, 3, 0.01, fixed(2), 'Share of Glow in the tight core',
    'The strength of the tight core of the glow at the line, as a share of Glow.'), 'Ring Glow Core Strength'),
  ringGlowSkirt: spoken(spec('Glow Skirt', 0.005, 1, 0.005, fixed(3, '×'), 'Reach of the wide glow, in hole radii',
    'How far the faint wide skirt of the ring\'s glow reaches from the line, in black hole radii. Wide and strong, it fills the shadow and hazes the sky round the hole.'), 'Ring Glow Skirt Reach'),
  ringGlowSkirtShare: spoken(spec('Skirt Strength', 0, 3, 0.01, fixed(2), 'Share of Glow in the wide skirt',
    'The strength of the wide skirt of the glow at the line, as a share of Glow.'), 'Ring Glow Skirt Strength'),
  ringFeedCapture: spoken(spec('Capture Light', 0, 10, 0.05, fixed(2), 'Light a captured particle leaves',
    'The light a particle leaves on the ring where it crosses the Event Horizon. Infall Strength scales all the light fed to the ring; this sets the share of the captured against the passing.'), 'Ring Capture Light'),
  ringFeedSkim: spoken(spec('Skim Light', 0, 0.05, 0.0001, fixed(4), 'Light a passing particle adds a frame',
    'The light a particle adds to the ring in every 60th of a second it spends within Skim Reach of the hole without being captured. Raised, the ring glows where the stream passes it; 0 leaves only the captured to light it.'), 'Ring Skim Light'),
  ringFeedReach: spoken(spec('Skim Reach', 1, 10, 0.05, fixed(2, '×'), 'How near a passer lights it, in radii',
    'How near the hole a passing particle must come to light the ring, in black hole radii. It reaches no further than Gravity Reach, and in the flat mode only through the Gravity Layer.'), 'Ring Skim Reach'),
  ringStarFlare: spoken(spec('Star Flare', 0, 100, 0.5, fixed(1), 'Light a captured star leaves',
    'The light an orbiting star leaves on the ring where it crosses the Event Horizon, on the scale of Capture Light: at 6 one star flares like several particles at once.'), 'Ring Star Flare'),
  ringStarSpread: spoken(spec('Flare Spread', 0, 1.5, 0.01, fixed(2, ' rad'), 'How far round a star\'s flare spreads',
    'How far to each side of the place a star went in its flare spreads round the ring, in radians (the tangent of the angle, so 1 is 45°). Flare Sides sets the light in each side.'), 'Ring Star Flare Spread'),
  ringStarSides: spoken(spec('Flare Sides', 0, 2, 0.05, fixed(2, '×'), 'Light in each side of a flare, × middle',
    'The light in each of the two sides of a star\'s flare, as a multiple of the light at its middle (Star Flare). 0 leaves a single point of light where the star went in; 1 makes a flat bar of three.'), 'Ring Star Flare Sides'),
  lensingRadius: spec('Einstein Radius', 0, 8, 0.05, fixed(2, '×'), 'Lens ring size, in hole radii; 0 = no lens',
    'Radius of the Einstein ring, in black hole radii: light from behind the hole is bent into a ring this size. For a real black hole it tells how far the camera is: about the square root of twice that distance in Schwarzschild radii, divided by 2.6, so 1.7 at 10 and 3 at 30. With Ray Traced on it places the camera exactly, the ring a little wider in the stereographic view: 1.32 at 2 Schwarzschild radii (the nearest, and the smallest ring), 2.13 at 10, 2.86 at 21. 0 turns the lens off.'),
  lensingReach: spoken(spec('Reach', 0, 1, 0.05, fixed(2), '0 = compact bubble · 1 = whole sky bends',
    'How far the lens is felt outside its ring, and what it shows inside. 0 = a compact bubble: the rest of the sky stays put, and inside the ring the sky folds into nested rings. 1 = a point mass (realistic): the whole sky is pulled, weaker with distance, and inside the ring there is one mirrored image of the sky from the other side.'), 'Lens Reach'),
  lensingRotation: spec('Twist', -10, 10, 0.05, fixed(2), 'Swirl of the sky; sign sets direction',
    'Swirl of the sky around the black hole, like light orbiting it. 0 = none; negative values twist the other way.'),
  lensingTwistLimit: spec('Twist Limit', 0, 64, 0.5, fixed(1, '×'), 'How tightly the swirl winds inward',
    'How far Twist winds up toward the black hole: it equals Twist at the Einstein ring and grows inward up to this many times. Low keeps a gentle twist, high a tight spiral. 0 removes it.'),
  lensingFalloff: spec('Falloff', 0.5, 4, 0.1, fixed(1), '2 = realistic · higher widens the lens',
    'How the pull of the lens changes with distance. Below 1 the lens almost disappears, 2 is a point mass (realistic), 3 and above widen the lens and its dark zone.'),
  lensingPivot: spec('Falloff Pivot', 1, 300, 1, fixed(0, '%'), 'No-effect distance, % of short side',
    'Distance from the black hole, as a share of the screen\'s short side, where Falloff changes nothing: nearer, a higher falloff pulls harder; farther, it pulls less.'),
  lensingMaxBend: spec('Fold Limit', 1, 256, 1, fixed(0), 'Higher: more nested rings in the lens',
    'Cap on how hard the lens can pull. Inside the Einstein ring a stronger pull folds the sky into more nested, mirrored rings (with Reach at 1, reaches further across the sky for its one mirrored image); 1 leaves none.'),
  lensingCore: spec('Core', 0, 2, 0.05, fixed(2, '×'), 'Higher: more detail inside the ring',
    'How far from the point right behind the black hole the bent rays stay, in Einstein ring radii. 0 smears that single point into a flat band along the ring; higher values fill the ring with detail from farther around it.'),
  lensingAbsorption: spec('Light Absorption', 0, 5, 0.05, fixed(2), 'Dark zone around the shadow; 0 = none',
    'How much light the pull of the lens removes around the black hole. 0 = none; higher values open a wider dark zone, which also grows with Einstein Radius and Falloff.'),
  companionSize: spoken(spec('Size', 0, 1, 0.01, fixed(2, '×'), 'Second hole, in main hole radii; 0 = none',
    'Radius of a second black hole as a share of the main one; its mass is its size. The two circle their common centre, which stands where the black hole alone would, and the companion has its own shadow, lens, ring, gravity and well in the sheet. Orbiting stars keep circling the main one. 0 = none.'), 'Second Black Hole Size'),
  companionDistance: spoken(spec('Distance', 0, 30, 0.1, fixed(1, '×'), 'Gap between the two, in hole radii',
    'Distance between the centres of the two black holes, in main hole radii. The closer they are the faster they turn, as Kepler\'s law has it. Below 1 + Size their shadows overlap and the main one grows by the companion\'s mass; at 0 they are one black hole, an oval that keeps turning the way the pair did while it rings down and sends out a last gravitational wave. Moving it from far to 0 over a film is a merger.'), 'Second Black Hole Distance'),
  companionSpeed: spoken(spec('Orbit Speed', -5, 5, 0.05, fixed(2, '×'), 'Rate of the pair\'s time; sign: direction',
    'Rate at which time passes for the pair. At 1 two equal black holes of the default size 8 radii apart take about 15 s for a turn, and under 3 s as they touch. Negative values turn them the other way; 0 stops them.'), 'Pair Orbit Speed'),
  companionWaves: spoken(spec('Waves', 0, 3, 0.05, fixed(2, '×'), 'Strength of the gravitational waves',
    'Strength of the gravitational waves of the pair: a two-armed spiral that turns with it, stretches the sky and the sheet, grows as the two close in, and ends in the ringdown wave of the merged black hole, which follows it at the same strength. The waves stretch the picture across their path and weaken as 1 over the distance. 0 = none.'), 'Gravitational Wave Strength'),
  companionClosest: spoken(spec('Orbit Floor', 0.1, 2, 0.05, fixed(2, '×'), 'Pair turns no faster inside, × touching',
    'The distance inside which the pair turns no faster as it closes in, as a share of the distance at which the two shadows touch (1 + Size). Kepler\'s law would spin the last moments of a merger without bound; lower lets the final turns whip round faster, 1 and above hold the pair to its speed at touching or before.'), 'Pair Orbit Floor'),
  companionSpin: spoken(spec('Merger Spin', 0, 3, 0.05, fixed(2, '×'), 'Spin a merger leaves; 1 = real',
    'The spin of the black hole two leave when they merge, as a multiple of what two holes without spin leave (0.69 of the most for equal masses, less the more they differ), never above 0.95. It flattens the merged shadow, and raises and lengthens the tone the merged hole rings with. 0 leaves a hole that does not spin.'), 'Merger Spin'),
  companionOval: spoken(spec('Merger Oval', 0, 20, 0.1, fixed(1, '×'), 'Oval a merger leaves, × the opening\'s',
    'How far the merged hole is drawn out, in multiples of the oval of a hole forming in the opening (the intro\'s Ringdown Amplitude), for two equal masses; unequal ones leave less. 0 leaves the merged hole round.'), 'Merger Oval'),
  companionHandover: spoken(spec('Wave Handover', 0.01, 4, 0.01, fixed(2), 'Wobbles the ringing takes to take over',
    'How many wobbles of the merged hole pass while its ringing takes over from the spiral wave of the pair, at the front that leaves the hole at the merger. Low is a sharp seam between the two waves, high a long blend.'), 'Merger Wave Handover'),
  cameraZoom: spoken(spec('Zoom', 0.5, 8, 0.05, fixed(2, '×'), 'Above 1 = closer · below 1 = wider',
    'How much the camera magnifies the scene. The black hole stays where it is on the screen and everything else moves away from it, so a film can push in on the shadow and its ring. The scene is drawn anew at the zoom, so it stays sharp; while the zoom changes, the particles\' trails streak. 1 is no zoom. Below 1 the camera pulls back: the picture is shown smaller and repeats, mirrored, beyond its own edges.'), 'Camera Zoom'),
  cameraX: spoken(spec('Pan X', -30, 30, 0.1, fixed(1, '×'), 'Camera right of the hole, in radii',
    'How far to the right of the black hole the camera looks, in black hole radii; negative is to the left. The point it looks at stands where the black hole would (with a second black hole, where the centre of the pair would). It works while the camera is zoomed in: the camera moves inside the picture the scene draws and stops at its edge, so the higher the Zoom the farther it can look, and at a Zoom of 1, where the whole picture is in the frame, there is nowhere to look. A camera that moves streaks the particles\' trails, and one that jumps starts them afresh.'), 'Camera Pan X'),
  cameraY: spoken(spec('Pan Y', -30, 30, 0.1, fixed(1, '×'), 'Camera above the hole, in radii',
    'How far above the black hole the camera looks, in black hole radii; negative is below. It works as Pan X does and with it: the two are added.'), 'Camera Pan Y'),
  cameraPair: spoken(spec('Pan in Pair', -1, 1, 0.01, percentOfOne, '-100% main · 0 centre · 100% second',
    'Which part of a pair of black holes the camera looks at while it is zoomed in. At 0 the common centre the two circle stays in its place, as it does without a pan; 1 puts the second black hole there and follows it around its orbit, -1 does the same with the main one, and values between look at that share of the way from the centre, so moving it from -1 to 1 pans from one black hole to the other. Pan X and Pan Y are added to it. Without a second black hole it does nothing.'), 'Camera Pan in a Pair'),
  cameraYaw: spoken(spec('Orbit Angle', -180, 180, 1, fixed(0, '°'), 'Around the hole; drag or arrows turn it',
    'In 3D, how far the camera has gone around the black hole, in degrees: 0 looks along the flight, as the flat mode does; 90 or -90 sees the column of particles flow past the hole from the side; 180 looks back at the way they came. Dragging the scene turns it, and so do the left and right arrow keys while the scene has the focus. Does nothing while 3D is off.'), 'Camera Orbit Angle'),
  cameraPitch: spoken(spec('Elevation', -89, 89, 1, fixed(0, '°'), 'Higher: seen more from above',
    'In 3D, how high the camera stands above the black hole, in degrees: positive looks down on it, negative up at it, 0 level. Dragging the scene up and down changes it, and so do the up and down arrow keys while the scene has the focus. Does nothing while 3D is off.'), 'Camera Elevation'),
  cameraSpin: spoken(spec('Auto Orbit', -60, 60, 1, fixed(0, ' °/s'), 'Camera circles the hole; 0 = still',
    'In 3D, degrees a second the camera circles the black hole on its own, added to Orbit Angle; the sign sets the direction. 0 holds it still. Does nothing while 3D is off.'), 'Camera Auto Orbit'),
  threeDEndFade: spoken(spec('Column Ends', 0, 0.5, 0.01, percentOfOne, 'Fade at the column\'s ends, % of depth',
    'In 3D, the share of Field Depth over which the column of particles fades at both its ends, where they are born and where they leave, as the camera sees it from the side. 0 leaves both ends cut hard; 50% fades the whole column toward its middle. Straight on, and while 3D is off, it does nothing.'), '3D Column End Fade'),
  gridCell: spoken(spec('Spacing', 3, 25, 0.5, fixed(1, '%'), 'Cell size, % of short side',
    'Size of one cell of the space grid as a share of the screen\'s short side. Both grids, the sheet and the lensed grid, use it.'), 'Grid Spacing'),
  gridSheet: spoken(spec('Sheet', 0, 1, 0.01, percentOfOne, 'Curved sheet under the hole; 0 = off',
    'Brightness of the space sheet: a square grid drawn as a surface seen at an angle, dented where the black hole sits, the classic picture of curved space. The dent is a diagram of gravitational time dilation: a place is lowered by how much time is slowed where the light seen at that distance passed closest to the black hole. It is flat far away and steepest at the shadow\'s edge, where that light skims the photon sphere and the sheet ends. The sheet stays put while the black hole moves across it, and gravitational waves ripple through it. 0 turns it off.'), 'Sheet Brightness'),
  gridTilt: spec('Sheet Tilt', 0, 75, 1, fixed(0, '°'), '0° = from above · higher: from the side',
    'Angle the sheet is seen at. 0° looks straight down the well, where the dent only pulls the lines slightly together; 60° and above look along the sheet and show the well\'s depth. In 3D the camera\'s Elevation is taken from it and its Orbit Angle spins the lines; past 75° the sheet fades and is gone once the camera is level with it.'),
  gridDepth: spec('Well Depth', 0, 12, 0.1, fixed(1, '×'), 'Depth of the dent, in hole radii; 0 = flat',
    'Depth of the sheet\'s well at the edge of the shadow, in black hole radii. 0 leaves the sheet flat.'),
  gridLattice: spoken(spec('Lattice', 0, 1, 0.01, percentOfOne, 'Lattice of space around the hole; 0 = off',
    'Brightness of the space lattice: lines along all three axes of the scene around the black hole, drawn in towards it, the picture of curved space in three dimensions. Like the sheet it is a diagram: each node is pulled in by as much as time is slowed where it stands, so the lattice is straight far away and tightest at the shadow\'s edge. It stands still while the black hole moves through it, a second black hole pulls it too, and it is seen through the lens, which bends the lines behind the hole. It reaches 6 cells from the hole and fades out over the outer half. Turn on 3D to see it from any side; in the flat mode it is seen straight on, down the line of flight. 0 turns it off.'), 'Lattice Brightness'),
  gridLatticeCell: spec('Lattice Spacing', 0.5, 5, 0.1, fixed(1, '×'), 'Lattice cell, in hole radii',
    'Size of one cell of the space lattice, in black hole radii, so it follows Black Hole Size. The lattice reaches 6 cells from the hole, so a larger cell also makes it reach farther.'),
  gridLatticeWarp: spec('Lattice Pull', 0, 10, 0.1, fixed(1), 'How far nodes are drawn in; 0 = straight',
    'How strongly the lattice is drawn in towards the black hole. A node wishes to move in by the slowing of time where it stands, in shadow radii, times this: Pull 1 wishes a node at the shadow\'s edge in by one radius, and the wish falls as 1 over the distance far away. The wish is taken so that no node ever reaches the centre, so a strong pull draws the lines in tight around the hole and none of them folds over. 0 leaves the lines straight.'),
  gridSky: spoken(spec('Lensed Grid', 0, 1, 0.01, percentOfOne, 'Flat grid seen through the lens; 0 = off',
    'Brightness of a flat square grid on the sky behind the black hole. It is read through the same bent rays as the stars, so it shows exactly what the lens does: the Einstein ring, the mirrored images inside it, the twist, the gravitational wave. 0 turns it off.'), 'Lensed Grid Brightness'),
  orbitCount: spoken(spec('Count', 0, 64, 1, count, 'Stars in orbit around the hole; 0 = none',
    'Number of stars in orbit around the black hole. Unlike the particles they have velocity and keep real orbits in the plane of the screen: ellipses whose long axis turns a little on every pass (relativistic precession), faster the closer they come. A star that crosses the Event Horizon radius lights the photon ring and is replaced by a new one. 0 = none.'), 'Orbiting Star Count'),
  orbitSize: spec('Orbit Size', 1.5, 20, 0.1, fixed(1, '×'), 'Mean orbit radius, in hole radii',
    'Mean size (semi-major axis) of the orbits, in black hole radii; each star gets a share of it that Size Spread sets, 60-140% by default. The shadow is 2.6 Schwarzschild radii and no orbit is stable inside 3 of them, so below about 2.5 most stars fall in. Changing it makes every orbit anew.'),
  orbitEccentricity: spec('Eccentricity', 0, 0.95, 0.01, fixed(2), '0 = circles · higher: longer ellipses',
    'How stretched the orbits are: 0 = circles, 0.9 = long ellipses that dive close to the black hole, where they swing round fastest and precess most. Changing it makes every orbit anew.'),
  orbitSpeed: spec('Orbit Speed', -5, 5, 0.05, fixed(2, '×'), 'Rate of the orbits\' time; sign: direction',
    'Rate at which time passes for the orbiting stars. At 1 light crosses 1.2 short screen sides a second, and a star 8 Schwarzschild radii out takes about 4.5 s for a turn at the default black hole size. Negative values run the orbits backwards; 0 stops them.'),
  orbitTrail: spoken(spec('Trail', 0, 60, 0.5, fixed(1, ' s'), 'Seconds an orbit\'s trace stays lit',
    'How long the trace a star leaves stays lit. Long traces draw the whole orbit and, over several turns, the rosette of its precession. 0 leaves only the star.'), 'Orbit Trail'),
  orbitStarSize: spoken(spec('Star Size', 1, 20, 0.5, fixed(1, ' px'), 'Width of a star and its trace',
    'Width of an orbiting star and of the trace it leaves.'), 'Orbiting Star Size'),
  orbitDrag: spoken(spec('Spin Drag', 0, 30, 0.1, fixed(1, '×'), 'How hard spin swings orbits; 1 = real',
    'How hard a spinning black hole swings the orbits round (Lense-Thirring), as a multiple of what the share of its spin toward the camera gives. It is apart from Frame Drag, which carries the particles. Higher turns the rosettes faster and throws the closest stars in or out; 0 leaves the stars to the hole\'s pull alone. It does nothing at Spin 0.'), 'Orbit Spin Drag'),
  orbitSizeSpread: spoken(spec('Size Spread', 0, 1.9, 0.05, fixed(2), 'How much the orbits differ in size',
    'How much the orbits differ in size: each star gets Orbit Size times a number within half of this either side of 1, so 0.8 gives 60-140%. 0 puts every star on an orbit of the same size. Changing it makes every orbit anew.'), 'Orbit Size Spread'),
  orbitEccentricitySpread: spoken(spec('Shape Spread', 0, 1, 0.05, fixed(2), 'How much the orbits differ in stretch',
    'How much the orbits differ in stretch: each star gets Eccentricity times a number between 1 less this and 1, so 0.4 gives 60-100%. 0 gives every orbit the Eccentricity set; 1 mixes circles with the longest ellipses. Changing it makes every orbit anew.'), 'Orbit Shape Spread'),
  orbitClosest: spoken(spec('Closest Pass', 1.2, 10, 0.05, fixed(2, ' rs'), 'Nearest a new orbit dips; shadow 2.6 rs',
    'The closest to the black hole a new orbit is allowed to come, in Schwarzschild radii (the shadow\'s radius is 2.6 of them, so it follows Black Hole Size). An orbit that would dip closer is made rounder. Below 3 no orbit is stable, so low values let stars spiral in and feed the ring; high values keep them all clear of the hole. Changing it makes every orbit anew.'), 'Orbit Closest Pass'),
  orbitEscape: spoken(spec('Escape Radius', 5, 2000, 5, fixed(0, ' rs'), 'A star this far out is replaced',
    'The distance from the black hole, in Schwarzschild radii, at which a star flung out counts as gone and a new one takes its place. 400 is far outside the frame; low values replace a star while it is still in sight.'), 'Orbit Escape Radius'),
  orbitFadeIn: spoken(spec('Fade In', 0, 10, 0.05, fixed(2, ' s'), 'Seconds a new star takes to light up',
    'Seconds a new star and the start of its trace take to reach full brightness. 0 makes a star appear at once.'), 'Orbit Fade In')
} satisfies Record<string, SimulationSettingSpec>

export type SimulationSliderKey = keyof typeof SIMULATION_SETTING_SPECS

// A colour setting. It is kept in the store as '#rrggbb' (its default is the store's own), edited with a
// colour picker (SettingColor), set through the agent API as that string and moved channel by channel
// along a film's track. A new one is a string field in the store, its key in SIMULATION_SETTING_KEYS, a
// spec here and a SettingColor row in the panel; the scene reads it with readSceneColor (scene_color.ts)
export interface SimulationColorSpec {
  label: string
  // In the row's context menu (at most 42 characters)
  hint: string
  // The full explanation, for the agent API
  description: string
  spokenName?: string
  // The colour the scene drew while it was still a constant in the code, where a hex can only round it
  // (a channel of 0.76 is no byte): while the setting stands at `hex`, its default, the scene draws `rgb`,
  // so the films made before it was a setting keep their bytes
  exact?: { hex: string, rgb: readonly [number, number, number] }
}

const color = (label: string, hint: string, description: string, spokenName?: string, exact?: SimulationColorSpec['exact']): SimulationColorSpec =>
  ({ label, hint, description, spokenName, exact })

export const SIMULATION_COLOR_SPECS = {
  flightTintAhead: color('Flight Tint Ahead', 'Color a fast flight turns the middle',
    'The color a fast flight tints the particles ahead, round the point the field flies out of: the blue of light met head-on (the Doppler shift of the particles). It shows from Flight Tint From upward, and Flight Tint Limit caps how much of a particle\'s own color it replaces.',
    undefined, { hex: '#99c2ff', rgb: [0.6, 0.76, 1.0] }),
  flightTintEdge: color('Flight Tint Edges', 'Color a fast flight turns the edges',
    'The color a fast flight tints the particles toward the edges of the frame: the red of light seen from the side. Flight Tint Gradient sets where it takes over from Flight Tint Ahead.',
    'Flight Tint at the Edges', { hex: '#ff946b', rgb: [1.0, 0.58, 0.42] }),
  ringColor: color('Color', 'Color of the photon ring',
    'The color of the photon ring and of its glow, of the second black hole\'s ring too. Doppler Contrast turns its two sides toward Approaching Side and Receding Side.', 'Ring Color'),
  ringColorApproaching: color('Approaching Side', 'Tint of the side coming toward you',
    'The color the bright, approaching side of the ring turns toward as Doppler Contrast rises: fully at a contrast of 1, a twenty-fifth of the way at 0.2.',
    'Ring Approaching Side Color', { hex: '#cce6ff', rgb: [0.8, 0.9, 1.0] }),
  ringColorReceding: color('Receding Side', 'Tint of the side moving away',
    'The color the dim, receding side of the ring turns toward as Doppler Contrast rises.',
    'Ring Receding Side Color', { hex: '#ff6b29', rgb: [1.0, 0.42, 0.16] }),
  nebulaColor: color('Color', 'Main color of the nebula',
    'The color most of the nebula glows in. Nebula Brightness scales it, and its patches turn toward Nebula Second Color.', 'Nebula Color'),
  nebulaColorDeep: color('Second Color', 'Color of the nebula\'s other patches',
    'The color the nebula turns toward in broad patches, several of its clouds across, so the sky is not one tint.', 'Nebula Second Color')
} satisfies Record<string, SimulationColorSpec>

export type SimulationColorKey = keyof typeof SIMULATION_COLOR_SPECS

// The settings only the stylized lens reads; the ray traced lens, the default, leaves them alone
export const STYLIZED_LENS_KEYS = [
  'lensingReach', 'lensingFalloff', 'lensingPivot', 'lensingRotation', 'lensingTwistLimit', 'lensingMaxBend', 'lensingCore'
] as const satisfies readonly SimulationSliderKey[]
