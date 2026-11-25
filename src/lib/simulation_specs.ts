// Name, range, step, display format and meaning of every numeric simulation setting. The Settings panel
// builds its sliders from here, and the agent API (scene_api.ts) describes and validates settings with it,
// so a setting is described in exactly one place.
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
    'Stroke width of the nearest particles. Particles get thinner with distance, down to 0.3 px at the far end of the field.'), 'Particle Size'),
  spawnRadius: spec('Spawn Radius', 50, 5000, 50, count, 'Birth disc radius, in scene units',
    'Radius of the disc particles are born in, in scene units. Smaller keeps more particles on screen and close; larger spreads them past the edges.'),
  baseBrightness: spec('Base Brightness', 0, 10, 0.1, fixed(1, '×'), 'Multiplies every particle\'s brightness',
    'Global brightness multiplier for all particles. Values above 1.0 increase luminosity, below 1.0 create dimmer effects.'),
  speedGlow: spec('Speed Glow', 0, 5, 0.05, fixed(2), 'Higher: only fast particles glow',
    'How strongly brightness follows a particle\'s speed. 0 = every moving particle is fully lit, 1 = slow particles are dimmer and fast ones brighter, higher values leave only the fast ones glowing. A particle that stands still is always dark.'),
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
  starsBrightness: spoken(spec('Brightness', 0, 10, 0.05, fixed(2, '×'), 'Brightness of the background stars',
    'Overall brightness of the distant background stars.'), 'Star Brightness'),
  starDensity: spoken(spec('Density', 0, 1, 0.01, percentOfOne, 'Share of grid cells that hold a star',
    'Share of the star grid cells that hold a star.'), 'Star Density'),
  starCell: spoken(spec('Spacing', 4, 200, 1, fixed(0, ' px'), 'Grid cell size; smaller packs stars closer',
    'Size of one star grid cell; smaller cells mean more, closer stars.'), 'Star Spacing'),
  blackHoleSize: spoken(spec('Size', 0, 60, 0.5, fixed(1, '%'), 'Shadow radius, % of short side; 0 = none',
    'Radius of the black hole\'s shadow as a share of the screen\'s short side. Everything else is measured from it: the photon ring, the event horizon, the lens, the strength and reach of gravity, the orbits of the stars. The radius of a real black hole\'s shadow is 2.6 Schwarzschild radii. 0 removes the black hole.'), 'Black Hole Size'),
  horizonScale: spec('Event Horizon', 0, HORIZON_SCALE_MAX, 0.05, fixed(2, '×'), 'Capture radius, in hole radii; 0 = none',
    'Radius of no return, in black hole radii, so it follows the black hole\'s size. Particles and orbiting stars that cross it are destroyed and recycled. 1 is the edge of the shadow, where a real black hole captures light; below 1 they vanish inside the shadow, above 1 before reaching it; 0 lets them fly through.'),
  gravityReach: spec('Gravity Reach', 0, 40, 0.5, fixed(1, '×'), 'How far gravity reaches, in hole radii',
    'How far the black hole\'s gravity reaches, in multiples of its size. Particles within this distance are affected by gravity and orbital forces.'),
  blackHoleDepth: spoken(spec('Depth', 0, 100, 1, fixed(0, '%'), 'Where the hole sits, % of Field Depth',
    'How deep in the field the black hole sits, as a share of Field Depth. Its gravity is strongest for particles at this depth.'), 'Black Hole Depth'),
  gravityDepth: spec('Gravity Layer', 1, 100, 1, fixed(0, '%'), 'Pulled layer thickness, % of Field Depth',
    'Thickness of the layer gravity acts on, as a share of Field Depth. Gravity fades away from the black hole\'s depth and ends at twice this; 50% and above reaches the whole field.'),
  gravityStrength: spec('Gravity', -20, 50, 0.5, fixed(1), 'Pull toward the hole; negative pushes',
    'Strength of gravitational attraction toward the black hole center. Higher values create stronger inward pull on particles. Negative values push them away.'),
  orbitalStrength: spec('Orbital Force', -500, 500, 5, fixed(0), 'Swirl around the hole; sign sets direction',
    'Tangential force that causes particles to orbit around the black hole. Creates swirling, accretion disk-like motion patterns. Negative values swirl the other way.'),
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
  ringWidth: spoken(spec('Thickness', 0.001, 0.25, 0.001, percentOfOneFine, 'Ring thickness, % of hole radius',
    'Thickness of the photon ring in black hole radii. It never gets thinner than about a pixel and a half.'), 'Ring Thickness'),
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
  lensingRadius: spec('Einstein Radius', 0, 8, 0.05, fixed(2, '×'), 'Lens ring size, in hole radii; 0 = no lens',
    'Radius of the Einstein ring, in black hole radii: light from behind the hole is bent into a ring this size. For a real black hole it tells how far the camera is: about the square root of twice that distance in Schwarzschild radii, divided by 2.6, so 1.7 at 10 and 3 at 30. 0 turns the lens off.'),
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
  cameraZoom: spoken(spec('Zoom', 1, 8, 0.05, fixed(2, '×'), 'Magnifies the view around the black hole',
    'How much the camera magnifies the scene. The black hole stays where it is on the screen and everything else moves away from it, so a film can push in on the shadow and its ring. 1 is no zoom.'), 'Camera Zoom'),
  gridCell: spoken(spec('Spacing', 3, 25, 0.5, fixed(1, '%'), 'Cell size, % of short side',
    'Size of one cell of the space grid as a share of the screen\'s short side. Both grids, the sheet and the lensed grid, use it.'), 'Grid Spacing'),
  gridSheet: spoken(spec('Sheet', 0, 1, 0.01, percentOfOne, 'Curved sheet under the hole; 0 = off',
    'Brightness of the space sheet: a square grid drawn as a surface seen at an angle, dented where the black hole sits, the classic picture of curved space. The dent is a diagram: its depth follows gravitational time dilation, flat far away and steepest at the shadow\'s edge, where it ends. The sheet stays put while the black hole moves across it, and the gravitational wave of the intro ripples through it. 0 turns it off.'), 'Sheet Brightness'),
  gridTilt: spec('Sheet Tilt', 0, 75, 1, fixed(0, '°'), '0° = from above · higher: from the side',
    'Angle the sheet is seen at. 0° looks straight down the well, where the dent only pulls the lines slightly together; 60° and above look along the sheet and show the well\'s depth.'),
  gridDepth: spec('Well Depth', 0, 12, 0.1, fixed(1, '×'), 'Depth of the dent, in hole radii; 0 = flat',
    'Depth of the sheet\'s well at the edge of the shadow, in black hole radii. 0 leaves the sheet flat.'),
  gridSky: spoken(spec('Lensed Grid', 0, 1, 0.01, percentOfOne, 'Flat grid seen through the lens; 0 = off',
    'Brightness of a flat square grid on the sky behind the black hole. It is read through the same bent rays as the stars, so it shows exactly what the lens does: the Einstein ring, the mirrored images inside it, the twist, the gravitational wave. 0 turns it off.'), 'Lensed Grid Brightness'),
  orbitCount: spoken(spec('Count', 0, 64, 1, count, 'Stars in orbit around the hole; 0 = none',
    'Number of stars in orbit around the black hole. Unlike the particles they have velocity and keep real orbits in the plane of the screen: ellipses whose long axis turns a little on every pass (relativistic precession), faster the closer they come. A star that crosses the Event Horizon radius lights the photon ring and is replaced by a new one. 0 = none.'), 'Orbiting Star Count'),
  orbitSize: spec('Orbit Size', 1.5, 20, 0.1, fixed(1, '×'), 'Mean orbit radius, in hole radii',
    'Mean size (semi-major axis) of the orbits, in black hole radii; each star gets 60-140% of it. The shadow is 2.6 Schwarzschild radii and no orbit is stable inside 3 of them, so below about 2.5 most stars fall in. Changing it makes every orbit anew.'),
  orbitEccentricity: spec('Eccentricity', 0, 0.95, 0.01, fixed(2), '0 = circles · higher: longer ellipses',
    'How stretched the orbits are: 0 = circles, 0.9 = long ellipses that dive close to the black hole, where they swing round fastest and precess most. Changing it makes every orbit anew.'),
  orbitSpeed: spec('Orbit Speed', -5, 5, 0.05, fixed(2, '×'), 'Rate of the orbits\' time; sign: direction',
    'Rate at which time passes for the orbiting stars. At 1 light crosses 1.2 short screen sides a second, and a star 8 Schwarzschild radii out takes about 4.5 s for a turn at the default black hole size. Negative values run the orbits backwards; 0 stops them.'),
  orbitTrail: spoken(spec('Trail', 0, 60, 0.5, fixed(1, ' s'), 'Seconds an orbit\'s trace stays lit',
    'How long the trace a star leaves stays lit. Long traces draw the whole orbit and, over several turns, the rosette of its precession. 0 leaves only the star.'), 'Orbit Trail'),
  orbitStarSize: spoken(spec('Star Size', 1, 20, 0.5, fixed(1, ' px'), 'Width of a star and its trace',
    'Width of an orbiting star and of the trace it leaves.'), 'Orbiting Star Size')
} satisfies Record<string, SimulationSettingSpec>

export type SimulationSliderKey = keyof typeof SIMULATION_SETTING_SPECS
