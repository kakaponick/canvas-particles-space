// The step of the particle field, on the graphics card. A particle's state lives in a buffer there and a
// vertex shader with transform feedback writes the next state into a second one: where the particle now
// stands, the speed it keeps, and the stroke it draws this frame, which the particle program reads straight
// from that buffer. The main thread hands over the step's numbers and is done: no loop over the particles
// runs in JavaScript.
// The laws are the two loops this shader took over, the flat one and the one in space (3D): the flight
// towards the camera, the pull of the holes within Gravity Reach, the orbital force, the spin's drag, the
// speed Inertia keeps, capture at the horizon and rebirth beyond it, the light a capture leaves in the
// photon ring, the stroke's width and opacity, the reveal of the opening and Particles on Sheet. A new law
// of the particles is a few lines of stepFlat and of stepSpace.
// A random number is drawn from the particle's own number and the step's, so the same seed and the same
// steps give the same field on the same machine.
import { RING_BINS } from './ring_energy'
import { fillInertiaStep, type PaletteSampler, type StepSettings } from './particle_simulation'
import { SHADOW_RADII } from './orbiters'

// A particle's record in the buffer, in floats: its state (place and speed multiplier; kept speed and
// alpha; pulse phase, pulse speed and colour), then what it draws this frame (the stroke's ends, its width,
// its opacity, whose sign is the side of the black holes its start is on: below 0 in front of them, the
// share of the way along it crosses to the other side, 0 when it does not, and how far its light is shifted,
// the doublings of its frequency times Doppler Tint) and the light it leaves in the ring (where round the
// hole, how much). The speed share of a particle born in orbit is 0 (it does not fly), and of one torn from
// a star below 0
export const FIELD_FLOATS = 22
export const FIELD_STRIDE = FIELD_FLOATS * 4

// Where in the record the colour's four bytes, the stroke, its style and the ring's light lie, in bytes
export const FIELD_COLOR_OFFSET = 40
export const FIELD_SEGMENT_OFFSET = 44
export const FIELD_STYLE_OFFSET = 60
export const FIELD_DEPOSIT_OFFSET = 76
// What the feedback writes, in the record's order
export const FIELD_VARYINGS = ['v_place', 'v_drift', 'v_look', 'v_segment', 'v_style', 'v_deposit']
// The most colours of the palette the card samples from
export const FIELD_PALETTE = 16
// A colour's bytes are kept in a float; this byte on top keeps that float an ordinary number, which a card
// passes on bit for bit
export const COLOR_KEPT = 0x40000000

// The step's numbers the shader reads, in the order they are handed over: the settings of the step by
// their own names, then what is worked out from them once a step
const STEP_KEYS = [
  'frameScale', 'time', 'speed', 'width', 'height', 'focal', 'vanishX', 'vanishY', 'holeX', 'holeY', 'holeRadius', 'captureRadius',
  'captureX', 'captureY', 'spinRight', 'spinUp', 'spinToward', 'companionX', 'companionY', 'companionRadius',
  'companionCapture', 'companionSpinRight', 'companionSpinUp', 'companionSpinToward', 'companionFed', 'ringCaptureEnergy', 'ringSkimReach', 'ringSkimEnergy', 'gravityReach', 'holeDepth',
  'gravityDepth', 'lineWidth', 'minLineWidth', 'gravityStrength', 'orbitalStrength', 'gravityFalloff', 'gravityBell', 'dragFalloff', 'dragSight', 'swirlX', 'swirlY', 'swirlZ', 'farZ', 'depthFade',
  'pulseSpeedMultiplier', 'pulseIntensity', 'baseBrightness', 'minOpacity', 'maxOpacity', 'speedGlow', 'speedKnee', 'revealRadius', 'revealX',
  'revealY', 'revealFeather', 'opacityScale', 'threeD', 'holeWorldX', 'holeWorldY', 'holeWorldZ', 'companionWorldX',
  'companionWorldY', 'companionWorldZ', 'endFade', 'frontAway', 'frontDepth', 'frontReach', 'holeSeen', 'companionSeen', 'holeFront', 'companionFront',
  'frontLetGo', 'frontPower', 'frontBend', 'frontBetween', 'holeEinstein', 'companionEinstein', 'spinShape', 'spinTurn', 'redshift', 'lightSpread', 'sizeSpread', 'rideStretch',
  'relativity', 'orbitShare', 'orbitRadius', 'orbitSpread', 'orbitThick', 'orbitScatter', 'orbitSecond', 'orbitEscape', 'orbitSense', 'viscosity',
  'holeVelX', 'holeVelY', 'holeVelZ', 'companionVelX', 'companionVelY', 'companionVelZ', 'doppler', 'beam', 'shiftTint',
  'burst', 'burstX', 'burstY', 'burstZ', 'burstVX', 'burstVY', 'burstVZ', 'burstSpread', 'burstSeed'
] as const satisfies readonly (keyof StepSettings)[]
const DERIVED_KEYS = ['hasHole', 'ringFed', 'revealing', 'inertial', 'keep', 'gain', 'velocityGain', 'spawnRadius', 'speedVariance'] as const
const STEP_NAMES: readonly string[] = [...STEP_KEYS, ...DERIVED_KEYS]
export const STEP_NUMBER_COUNT = STEP_NAMES.length

const finite = (value: number) => (Number.isFinite(value) ? value : 0)

/**
 * Writes a step's numbers into `out` for the shader. A black hole that is not there arrives as NaN
 * coordinates, and an opening that reveals nothing as an infinite radius: both are said as flags.
 */
export function fillStepNumbers (out: Float32Array, settings: StepSettings, spawnRadius: number, speedVariance: number) {
  for (let i = 0; i < STEP_KEYS.length; i++) out[i] = finite(settings[STEP_KEYS[i]])
  const flat = settings.holeX === settings.holeX && settings.holeY === settings.holeY
  const inSpace = settings.holeWorldX === settings.holeWorldX && settings.holeWorldY === settings.holeWorldY && settings.holeWorldZ === settings.holeWorldZ
  const inertia = fillInertiaStep(settings.inertia, settings.frameScale)
  let slot = STEP_KEYS.length
  out[slot++] = settings.holeRadius > 0 && (settings.threeD > 0 ? inSpace : flat) ? 1 : 0
  out[slot++] = settings.ringEnergy ? 1 : 0
  out[slot++] = settings.revealRadius < Infinity ? 1 : 0
  out[slot++] = inertia.inertial ? 1 : 0
  out[slot++] = inertia.keep
  out[slot++] = inertia.gain
  out[slot++] = inertia.velocityGain
  out[slot++] = spawnRadius
  out[slot++] = speedVariance
}

/**
 * Writes the palette for the shader: for each colour its three bytes and the weight summed up to it.
 * Returns how many colours were written.
 */
export function fillPalette (out: Float32Array, palette: PaletteSampler) {
  const count = Math.min(palette.colors.length, FIELD_PALETTE)
  for (let i = 0; i < count; i++) {
    const packed = palette.colors[i]
    out[i * 4] = packed & 255
    out[i * 4 + 1] = packed >>> 8 & 255
    out[i * 4 + 2] = packed >>> 16 & 255
    out[i * 4 + 3] = palette.cumulativeWeights[i]
  }
  return count
}

// Each number by its name in the shader
const STEP_DEFINES = STEP_NAMES.map((name, slot) => `#define s_${name} u_step[${slot}]`).join('\n')

export const fieldStepFragmentShaderSource = `#version 300 es
  precision lowp float;
  out vec4 color;
  void main () {
    color = vec4(0.0);
  }
`

// "ride" is RIDE_GLSL of webgl_shaders.ts, the sheet for what the card places, and "behind" BEHIND_GLSL,
// the share of a stroke behind the holes that is seen through the lens
export const fieldStepVertexShaderSource = (ride: string, behind: string) => `#version 300 es
  precision highp float;
  precision highp int;

  in vec4 a_place;   // x, y, z in scene units, the particle's own share of the flight speed
  in vec4 a_drift;   // the sideways speed the holes gave it (x, y, z per 60 Hz frame), its alpha
  in vec3 a_look;    // pulse phase, pulse speed, its colour's bytes

  uniform float u_step[${STEP_NUMBER_COUNT}];
  uniform vec4 u_pose[3];       // 3D: the camera's pose row by row, a turn and an offset
  uniform vec4 u_poseFrom[3];   // the pose of the frame before, where a stroke starts
  uniform vec4 u_palette[${FIELD_PALETTE}];  // a colour's bytes and the weight summed up to it
  uniform vec2 u_paletteSize;   // how many colours, their whole weight
  uniform uint u_tick;          // the step's own number, mixed with the scene's seed
  uniform vec3 u_equator[3];    // Particles on Sheet in space: the main hole's equator, its two directions and the way it faces
${ride}${behind}
  out vec4 v_place;
  out vec4 v_drift;
  out vec3 v_look;
  out vec4 v_segment;   // the stroke: where it starts and ends, CSS pixels
  out vec4 v_style;     // its width in CSS pixels, its opacity (0 draws nothing, below 0 its start is in front of the holes), the share of the way along it crosses to the other side (0: it does not), its light's shift (above 0 toward the approaching colour)
  out vec3 v_deposit;   // light for the photon ring: where round the hole it lands, how much

${STEP_DEFINES}

  const float TWO_PI = 6.2831853;
  // A stroke is cut to the picture and at least this margin round it, in CSS pixels, wide enough to hide
  // its ends
  const float MIN_CLIP_MARGIN = 4.0;
  // Strokes are cut where they pass this close in front of the 3D camera, in scene units
  const float NEAR = 1.0;
  // Random spawns at the far end tried for a captured particle before it comes back across what is seen
  // instead (a loop bound the shader's time holds)
  const int RESPAWN_TRIES = 4;
  // How fast the space round a spinning hole carries a particle, against how fast the hole pulls it in
  const float DRAG_SHARE = 0.5;
  // A kept speed below a hundredth of a scene unit a second (squared, per 60 Hz frame) is let go
  const float SPEED_FLOOR_SQ = ${((0.01 / 60) ** 2).toExponential(6)};
  // Schwarzschild radii in the radius of the shadow, sqrt(27) / 2, as the orbiting stars count them
  const float SHADOW_RADII = ${SHADOW_RADII};
  // The pull is held this many Schwarzschild radii clear of the Schwarzschild radius, where the
  // Paczynski-Wiita potential has no end (orbiters.ts holds the stars the same)
  const float MIN_CLEARANCE = 0.15;
  // The fastest a particle is taken to move for its light, as a share of the speed of light: past it the
  // Doppler factor has no end
  const float MOST_BETA = 0.98;

  vec4 place;
  vec4 drift;
  vec3 look;
  vec4 segment;
  vec4 style;
  vec3 deposit;
  // The doublings of the frequency the particle's light is seen shifted by this step, times Doppler Tint
  float strokeShift;
  uint seed;
  // What became of the particle this step: 0 it flies on, 1 it left the field and is made anew, 2 a horizon
  // took it and it is made anew outside that horizon. The horizon: in the flat step a circle on the screen,
  // its centre from the vanishing point and its radius in CSS pixels; in space a sphere, in scene units
  int reborn;
  vec3 horizonAt;
  float horizonRadius;
  // The stroke a particle that moved is to draw, which the step leaves for stroke(): its ends on the screen,
  // how far each is from the camera, its two places round the main hole in the hole's equator (along its two
  // directions and the height off it, CSS pixels seen straight on, for the sheet), how far to the far end of
  // the field it is and the share of its opacity it is shown at, then its own move on the screen and its
  // distance from the opening's blast, both in CSS pixels
  bool moved;
  vec4 strokeEnds;
  vec2 strokeAway;
  vec3 rideFrom;
  vec3 rideTo;
  vec2 strokeLook;
  vec2 strokeMeasure;

  // How the pull falls with distance, from the square of radius / distance: that square itself at Pull
  // Falloff 2, Newton's law, and the power the knob names otherwise
  float pullFall (float ratioSq) {
    return s_gravityFalloff == 2.0 ? ratioSq : pow(ratioSq, 0.5 * s_gravityFalloff);
  }

  // The spin's drag as a share of the pull, from radius / distance: DRAG_SHARE at one radius, falling Drag
  // Falloff powers of the distance faster than the pull
  float dragFall (float ratio) {
    return DRAG_SHARE * (s_dragFalloff == 1.0 ? ratio : pow(ratio, s_dragFalloff));
  }

  // What the pull at "dist" from a hole whose shadow is "shadow" across (the same unit) is multiplied by
  // for Relativity: the Paczynski-Wiita potential the orbiting stars move in, -GM / (r - r_s), whose pull is
  // Newton's times (r / (r - r_s))^2. It puts the last stable orbit at three Schwarzschild radii (1.15
  // shadow radii) and the plunge inside it where relativity puts them; Relativity takes that share of r_s
  float wellPull (float dist, float shadow) {
    if (s_relativity <= 0.0) return 1.0;
    float schwarzschild = shadow / SHADOW_RADII;
    float clear = max(dist - s_relativity * schwarzschild, MIN_CLEARANCE * schwarzschild);
    float ratio = dist / clear;
    return ratio * ratio;
  }

  // The pull a hole whose shadow is "shadow" gives at "dist" (the same unit) per 60 Hz frame, in that unit:
  // the law the step pushes by, which a particle born in orbit takes its speed from. "unitScale" turns CSS
  // pixels at the hole's distance into that unit (1 in the flat step)
  float pullAt (float dist, float shadow, float unitScale) {
    return s_gravityStrength * 0.6 * unitScale * pullFall(shadow * shadow / max(dist * dist, 0.000001)) * wellPull(dist, shadow);
  }

  // The speed of light in the unit of "shadow" per 60 Hz frame, from the field's own gravity: with the
  // shadow 2.6 Schwarzschild radii across, c^2 = 2 GM / r_s, and GM what Gravity gives, 0.6 Gravity times
  // the square of the shadow's radius (in CSS pixels; "unitScale" turns them into the unit). So a particle
  // on the last stable orbit moves at 0.6 of the speed of light, as the potential gives (relativity: 0.5)
  float lightSpeed (float shadow, float unitScale) {
    return sqrt(max(2.0 * 0.6 * SHADOW_RADII * s_gravityStrength * unitScale * shadow, 0.0));
  }

  // The doublings of its frequency the light of a particle moving at "velocity" is seen shifted by, toward
  // the eye along "toEye" (a unit direction), with the speed of light "light" in the same unit: the Doppler
  // factor g = sqrt(1 - beta^2) / (1 - beta . n), raised to Doppler. Light that comes in g times bluer
  // comes in g^Beaming times brighter, which the caller lights it by
  float dopplerShift (vec3 velocity, vec3 toEye, float light) {
    if (light <= 0.0) return 0.0;
    float betaSq = min(dot(velocity, velocity) / (light * light), MOST_BETA * MOST_BETA);
    float along = clamp(dot(velocity, toEye) / light, -MOST_BETA, MOST_BETA);
    return s_doppler * log2(sqrt(1.0 - betaSq) / (1.0 - along));
  }


  // A number in [0, 1) drawn from a word
  float drawn (uint word) {
    word = ((word >> ((word >> 28u) + 4u)) ^ word) * 277803737u;
    word = (word >> 22u) ^ word;
    return float(word >> 8u) / 16777216.0;
  }

  // The next number in [0, 1) of this particle in this step
  float chance () {
    seed = seed * 747796405u + 2891336453u;
    return drawn(seed);
  }

  // The share of its light a particle at "dist" from a hole whose shadow is "shadow" across (the same unit)
  // keeps on its way out of the hole's well: (1 - r_s / r)^2 for a body at rest there, to the power of
  // Redshift. The shadow's radius is 2.6 Schwarzschild radii, nature's
  float wellLight (float dist, float shadow) {
    return pow(max(1.0 - shadow / (2.6 * max(dist, 0.000001)), 0.0), 2.0 * s_redshift);
  }

  // Numbers in [0, 1) of this particle alone, the same in every step, each from a word of its own: its own
  // light (Light Spread) and its own width (Size Spread)
  float ownLight () {
    return drawn(uint(gl_VertexID) * 2654435761u + 2654435769u);
  }
  float ownWidth () {
    return drawn(uint(gl_VertexID) * 3266489917u + 668265263u);
  }

  // A number in [0, 1) of this particle alone, the same in every step: the share seen through the lens
  // past which it goes behind the holes, so in the band behind them the field thins from one layer into
  // the other and no particle flickers between the two
  float ownShare () {
    return drawn(uint(gl_VertexID) * 747796405u + 2891336453u);
  }
  // A number in [0, 1) of this particle alone, the same in every step: below Orbit Birth it is matter in
  // orbit, and among that below Around Second it orbits the second hole
  float ownOrbit () {
    return drawn(uint(gl_VertexID) * 2246822519u + 374761393u);
  }
  float ownSecond () {
    return drawn(uint(gl_VertexID) * 1597334677u + 2654435769u);
  }

  // A particle born in orbit (Orbit Birth): in the band Orbit Radius and Orbit Spread lay round the main
  // hole, or round the second by Around Second, evenly by area, in the main hole's equator (the plane
  // across the swirl's axis; the screen in the flat step) lifted off it by up to Orbit Thickness of its
  // radius, moving round the hole the way Orbital Force turns at the speed of a circular orbit in the pull
  // the step pushes by, sqrt(pull x distance), scattered by Orbit Scatter, plus the speed of the hole it
  // orbits. It does not fly (its speed share is 0), keeps all its speed whatever Inertia says and feels no
  // Orbital Force, so from then on gravity alone moves it: it precesses, plunges inside the last stable
  // orbit, and round a pair it is shared, torn and passed between the two. False without a pull to orbit in
  bool orbitBirth (float alpha) {
    if (s_gravityStrength <= 0.0) return false;
    bool inSpace = s_threeD > 0.5;
    bool second = s_companionRadius > 0.0 && ownSecond() < s_orbitSecond;
    float shadow = second ? s_companionRadius : s_holeRadius;
    float capture = second ? s_companionCapture : s_captureRadius;
    float inner = max(s_orbitRadius - 0.5 * s_orbitSpread, 0.0);
    float outer = max(s_orbitRadius + 0.5 * s_orbitSpread, inner);
    float radii = sqrt(mix(inner * inner, outer * outer, chance()));
    // CSS pixels at the hole's distance, held outside the capture
    float dist = max(radii * shadow, capture * 1.05 + 0.5);
    float angle = chance() * TWO_PI;
    float lift = s_orbitThick * dist * (chance() + chance() - 1.0);
    float scatter = 1.0 + s_orbitScatter * (2.0 * chance() - 1.0);
    if (inSpace) {
      float worldPerPixel = s_holeDepth / s_focal;
      vec3 centre = second ? vec3(s_companionWorldX, s_companionWorldY, s_companionWorldZ) : vec3(s_holeWorldX, s_holeWorldY, s_holeWorldZ);
      vec3 carried = second ? vec3(s_companionVelX, s_companionVelY, s_companionVelZ) : vec3(s_holeVelX, s_holeVelY, s_holeVelZ);
      vec3 swirl = vec3(s_swirlX, s_swirlY, s_swirlZ);
      vec3 first = normalize(cross(swirl, abs(swirl.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
      vec3 across = cross(swirl, first);
      vec3 offset = ((first * cos(angle) + across * sin(angle)) * dist - swirl * lift) * worldPerPixel;
      float away = dist * worldPerPixel;
      float speed = sqrt(pullAt(away, shadow * worldPerPixel, worldPerPixel) * away) * scatter;
      place = vec4(centre + offset, 0.0);
      drift = vec4(normalize(cross(-offset, swirl)) * (speed * s_orbitSense) + carried, alpha);
    } else {
      vec2 centre = second ? vec2(s_companionX, s_companionY) : vec2(s_holeX, s_holeY);
      vec2 carried = second ? vec2(s_companionVelX, s_companionVelY) : vec2(s_holeVelX, s_holeVelY);
      vec2 outward = vec2(cos(angle), sin(angle));
      float speed = sqrt(pullAt(dist, shadow, 1.0) * dist) * scatter;
      // The flat orbital force turns a particle toward (-toHole.y, toHole.x), and toHole is -outward
      vec2 along = vec2(outward.y, -outward.x) * s_orbitSense;
      float toScene = s_holeDepth / s_focal;
      place = vec4((centre + outward * dist - vec2(s_vanishX, s_vanishY)) * toScene, s_holeDepth, 0.0);
      drift = vec4((along * speed + carried) * toScene, 0.0, alpha);
    }
    return true;
  }

  // Matter torn from a star (Tidal Radius): a share of the field, chosen afresh for each star, is set where
  // the star came apart, each piece scattered round its place by a twentieth of its distance and round its
  // velocity by Debris Spread of it, plus the main hole's own speed. The star's place comes in
  // Schwarzschild radii from the hole and its velocity in the speed of light, and the field's own speed of
  // light carries them over, so the debris flies on the star's orbit in the field's gravity: what the spread
  // gives more energy leaves the hole, what it gives less comes back round and falls in. Like matter in
  // orbit it does not fly and keeps all its speed (its speed share below 0) until a horizon takes it
  void burstBirth () {
    bool inSpace = s_threeD > 0.5;
    float worldPerPixel = inSpace ? s_holeDepth / s_focal : 1.0;
    float shadow = s_holeRadius * worldPerPixel;
    float light = lightSpeed(shadow, worldPerPixel);
    vec3 star = vec3(s_burstX, s_burstY, s_burstZ) * (shadow / SHADOW_RADII);
    vec3 velocity = vec3(s_burstVX, s_burstVY, s_burstVZ) * light;
    vec3 shake = vec3(chance(), chance(), chance()) * 2.0 - 1.0;
    vec3 kick = vec3(chance() + chance(), chance() + chance(), chance() + chance()) - 1.0;
    vec3 offset = star + shake * (0.05 * length(star));
    vec3 speed = velocity + kick * (s_burstSpread * length(velocity));
    if (inSpace) {
      place = vec4(vec3(s_holeWorldX, s_holeWorldY, s_holeWorldZ) + offset, -1.0);
      drift = vec4(speed + vec3(s_holeVelX, s_holeVelY, s_holeVelZ), drift.w);
    } else {
      float toScene = s_holeDepth / s_focal;
      place = vec4((vec2(s_holeX, s_holeY) + offset.xy - vec2(s_vanishX, s_vanishY)) * toScene, s_holeDepth, -1.0);
      drift = vec4((speed.xy + vec2(s_holeVelX, s_holeVelY)) * toScene, 0.0, drift.w);
    }
  }

  // A new particle at the far end of the field: somewhere in the birth disc, with a colour of the palette
  // by its weight. One a horizon took comes back outside it, so a horizon wider than the birth disc cannot
  // swallow the whole field: a few places are tried, then it is put on the horizon's rim
  void rebirth () {
    bool inSpace = s_threeD > 0.5;
    // What a place at the far end is multiplied by to stand beside the horizon, and how far behind the
    // horizon's centre the far end lies
    float spawnScale = inSpace ? 1.0 : s_focal / s_farZ;
    float deep = inSpace ? s_farZ - horizonAt.z : 0.0;
    vec2 at = vec2(0.0);
    bool placed = false;
    for (int attempt = 0; attempt < RESPAWN_TRIES; attempt++) {
      float angle = chance() * TWO_PI;
      float radius = s_spawnRadius * sqrt(chance());
      at = vec2(cos(angle), sin(angle)) * radius;
      vec2 away = at * spawnScale - horizonAt.xy;
      if (reborn < 2 || dot(away, away) + deep * deep >= horizonRadius * horizonRadius) {
        placed = true;
        break;
      }
    }
    // Matter does not appear at a horizon: one the far end cannot hold outside it comes back anywhere out
    // to the edge of what is seen (the frame's corners flat, the birth disc in space), evenly by area, as
    // new matter arriving from afar, and falls in from there. Put on the rim, it heaped into a ring of even
    // brightness round the shadow with a hard outer edge
    if (!placed) {
      float angle = chance() * TWO_PI;
      float outer = max(inSpace ? s_spawnRadius : 0.5 * length(vec2(s_width, s_height)), horizonRadius * 2.0);
      float radius = sqrt(mix(horizonRadius * horizonRadius, outer * outer, chance()));
      at = (horizonAt.xy + vec2(cos(angle), sin(angle)) * radius) / spawnScale;
    }

    float target = chance() * u_paletteSize.y;
    vec3 rgb = vec3(255.0);
    int colors = int(u_paletteSize.x);
    for (int i = 0; i < ${FIELD_PALETTE}; i++) {
      if (i >= colors) break;
      rgb = u_palette[i].rgb;
      if (target <= u_palette[i].w) break;
    }
    float alpha = 0.3 + chance() * 0.7;
    float phase = chance() * TWO_PI;
    float rate = 0.5 + chance() * 1.5;
    // 99% of particles stay near the base speed, 1% reach up to 100x
    float r = chance();
    look = vec3(phase, rate, uintBitsToFloat(${COLOR_KEPT}u | uint(rgb.r) | (uint(rgb.g) << 8u) | (uint(rgb.b) << 16u)));
    if (s_hasHole > 0.5 && s_orbitShare > 0.0 && ownOrbit() < s_orbitShare && orbitBirth(alpha)) return;
    place = vec4(at, s_farZ, 1.0 + s_speedVariance * (2.0 + r * r * r * r * r * 98.0));
    drift = vec4(0.0, 0.0, 0.0, alpha);
  }

  // Liang-Barsky: narrows the share of a stroke that is kept ("span", from and to) by one edge of the
  // picture. False when nothing of the stroke is left
  bool clipAgainst (float p, float q, inout vec2 span) {
    if (p == 0.0) return q >= 0.0;
    float t = q / p;
    if (p < 0.0) {
      if (t > span.y) return false;
      span.x = max(span.x, t);
    } else {
      if (t < span.x) return false;
      span.y = min(span.y, t);
    }
    return true;
  }

  // The stroke of a particle that moved from "start" to "end" on the screen, "away" from the camera at its
  // two ends (CSS pixels seen straight on), "distanceFactor" of the way to the far end of the field. On the
  // sheet it lies where the surface does over its two places in the main hole's equator ("inFrom", "inTo"),
  // as far as it rides there. "own" is how far the particle itself moved on the screen, whatever the camera
  // did, and "fromBlast" its distance from the opening's blast, both in CSS pixels. An end of a stroke nearer
  // the camera than the nearer black hole (s_frontAway, 0 in the flat mode) is in front of the holes, and
  // within Front Depth behind that it stays in front while the share seen through the lens there is below
  // the particle's own (ownShare). The renderer draws what is in front into the layer the lens does not
  // bend: the opacity is written below 0 when the start is in front, and a stroke whose two ends are on two
  // sides crosses to the other layer where the boundary passes between them. An end in front that Front
  // Bend or Between Bend takes is drawn where the nearer lens shows it (behindShares in BEHIND_GLSL)
  void stroke (vec2 start, vec2 end, vec2 away, float distanceFactor, vec3 inFrom, vec3 inTo, float shown, float own, float fromBlast) {
    float depthFactor = 1.0 - distanceFactor * s_depthFade;
    float lineWidth = max((1.0 - distanceFactor) * s_lineWidth, s_minLineWidth);
    // Each particle is its own width, 2 to the power of Size Spread times its number between -1 and 1
    if (s_sizeSpread > 0.0) lineWidth *= exp2(s_sizeSpread * (2.0 * ownWidth() - 1.0));
    float pulse = s_pulseIntensity != 0.0
      ? 1.0 + sin(s_time * look.y * s_pulseSpeedMultiplier + look.x) * s_pulseIntensity * distanceFactor
      : 1.0;
    // and its own light, (s + 1) u^s with s three times Light Spread: the mean is kept, a few shine and most
    // are dim, so a crowd stamped brighter-of-two shows its grain instead of its brightest particle everywhere
    float spread = 3.0 * s_lightSpread;
    float lit = spread > 0.0 ? (spread + 1.0) * pow(ownLight(), spread) : 1.0;
    float opacity = max(min(depthFactor * drift.w * pulse * s_baseBrightness * lit, s_maxOpacity), s_minOpacity) * s_opacityScale * shown;

    // Only particles within reach of the explosion are drawn (the opening's shockwave)
    if (s_revealing > 0.5) {
      if (fromBlast > s_revealRadius) return;
      opacity *= min((s_revealRadius - fromBlast) / max(s_revealFeather, 1.0), 1.0);
    }
    if (opacity <= 0.0) return;

    // Particles on Sheet: only what flies in the slab round the equator rides, the more the nearer the plane
    if (u_ride.x > 0.0) {
      float shareFrom = rideShare(inFrom.z);
      float shareTo = rideShare(inTo.z);
      if (shareFrom + shareTo > 0.0) {
        vec3 laidFrom = underneath(inFrom.xy);
        vec3 laidTo = underneath(inTo.xy);
        // An end nearer than the sheet camera's near plane is cut back to it, the stroke with it
        float cut = rideCut(laidFrom, laidTo);
        if (cut < 0.0) return;
        if (cut > 0.0) {
          if (laidFrom.z < laidTo.z) {
            laidFrom = mix(laidFrom, laidTo, cut);
            start = mix(start, end, cut);
            away.x = mix(away.x, away.y, cut);
            shareFrom = mix(shareFrom, shareTo, cut);
          } else {
            laidTo = mix(laidFrom, laidTo, cut);
            end = mix(start, end, cut);
            away.y = mix(away.x, away.y, cut);
            shareTo = mix(shareFrom, shareTo, cut);
          }
        }
        float flown = length(end - start);
        start = laidOn(start, away.x, laidFrom, shareFrom);
        end = laidOn(end, away.y, laidTo, shareTo);
        // A stroke the sheet stretches spreads the light of its own move over its length, and one it squeezes
        // (a wall seen from above, foreshortened) crowds as many strokes into the place, so each keeps as
        // much less: the sheet's surface stays as bright as the matter on it (Ride Keeps Light)
        float laid = length(end - start);
        if (s_rideStretch > 0.0 && laid != flown) opacity *= pow(min(flown, laid) / max(max(flown, laid), 0.000001), s_rideStretch);
        // A ridden stroke stands as far away as laidOn sets it
        away = vec2(mix(away.x, mix(away.x, laidFrom.z, u_ride.w), shareFrom), mix(away.y, mix(away.y, laidTo.z, u_ride.w), shareTo));
        // Both ends of a ridden stroke are seen through the sheet as it lies now, so its length is the move
        own = mix(own, length(sheetScreen(laidTo) - sheetScreen(laidFrom)), 0.5 * (shareFrom + shareTo));
      }
    }

    // Brightness is set by the particle's own speed: the strokes are stamped with the brighter-of-two
    // blend, so overlapping stamps of a slow particle do not add up and its edge stays sharp. The speed is
    // taken per 60 Hz frame, so the result is the same at any refresh rate, and Speed Glow bends the link
    float reference = own / max(s_frameScale, 0.0001);
    opacity *= pow(max(reference / (reference + s_speedKnee), 0.000001), s_speedGlow);

    float margin = max(MIN_CLIP_MARGIN, s_lineWidth * 0.5 + 2.0);
    vec2 low = vec2(-margin);
    vec2 high = vec2(s_width, s_height) + margin;
    if (any(lessThan(start, low)) || any(greaterThan(start, high)) || any(lessThan(end, low)) || any(greaterThan(end, high))) {
      vec2 delta = end - start;
      vec2 span = vec2(0.0, 1.0);
      if (!clipAgainst(-delta.x, start.x - low.x, span) || !clipAgainst(delta.x, high.x - start.x, span) ||
        !clipAgainst(-delta.y, start.y - low.y, span) || !clipAgainst(delta.y, high.y - start.y, span)) return;
      end = start + delta * span.y;
      start += delta * span.x;
      away = mix(away.xx, away.yy, span);
    }
    bool front = false;
    float cut = 0.0;
    if (s_frontAway > 0.0) {
      vec4 mainHole = vec4(s_holeX, s_holeY, s_holeSeen, s_holeFront);
      vec4 secondHole = vec4(s_companionX, s_companionY, s_companionSeen, s_companionFront);
      vec4 band = vec4(s_frontDepth, s_frontReach, s_frontLetGo, s_frontPower);
      vec4 bend = vec4(s_frontBend, s_frontBetween, s_holeEinstein, s_companionEinstein);
      vec2 spin = vec2(s_spinShape, s_spinTurn);
      vec3 first = behindShares(away.x, start, mainHole, secondHole, band, bend, spin);
      vec3 last = behindShares(away.y, end, mainHole, secondHole, band, bend, spin);
      // Below 0 at an end in front; between two ends on two sides the boundary is where this passes 0
      float ownSide = max(ownShare(), 0.000001);
      float before = first.x - ownSide;
      float after = last.x - ownSide;
      front = before < 0.0;
      if (front != (after < 0.0)) cut = clamp(before / (before - after), 0.001, 0.999);
      // A stroke any of which is in front is drawn where the nearer lens shows it, an end behind bent as the
      // other end is, so a stroke that crosses does not reach from the one place to the other
      if (min(before, after) < 0.0) {
        start = bentBy(start, before < 0.0 ? first : last, mainHole, secondHole, bend);
        end = bentBy(end, after < 0.0 ? last : first, mainHole, secondHole, bend);
      }
    }
    segment = vec4(start, end);
    style = vec4(lineWidth, front ? -opacity : opacity, cut, strokeShift);
  }

  // The flat loop: the holes pull a particle where it lands on the screen, inside a layer of depth round
  // the black hole, and the event horizon takes whatever covers the hole at any depth
  void stepFlat () {
    vec2 vanish = vec2(s_vanishX, s_vanishY);
    vec2 at = place.xy;
    float startZ = place.z;
    vec2 start = at * (s_focal / startZ) + vanish;

    // Matter in orbit and from a torn star does not fly, keeps all its speed and feels no Orbital Force
    bool orbiting = place.w <= 0.0;
    float pz = startZ - s_speed * s_frameScale * max(place.w, 0.0);
    // A particle the holes set moving drifts on with what it kept of that speed; along the line of sight
    // only while spin lying in the screen pushes it there (Drag Along Sight)
    bool inertial = s_inertial > 0.5 || orbiting;
    float keep = orbiting ? 1.0 : s_keep;
    float gain = orbiting ? s_frameScale : s_gain;
    float velocityGain = orbiting ? 1.0 : s_velocityGain;
    bool sight = s_dragSight > 0.0;
    vec2 kept = vec2(0.0);
    float keptZ = 0.0;
    if (inertial) {
      kept = drift.xy * keep;
      at += kept * s_frameScale;
      if (sight) {
        keptZ = drift.z * keep;
        pz += keptZ * s_frameScale;
      }
    }
    if (pz <= 0.0) {
      reborn = 1;
      return;
    }

    float endScale = s_focal / pz;
    vec2 end = at * endScale + vanish;
    bool hasHole = s_hasHole > 0.5;
    vec2 hole = vec2(s_holeX, s_holeY);
    // Gravity acts within a depth band round the hole's plane, a compact bell, (1 - u^2 / 4)^p with p Layer
    // Softness (3), that is zero beyond two scales; the horizon takes a particle at any depth
    float depthBand = max(s_gravityDepth, 0.000001);
    bool banded = pz > s_holeDepth - depthBand * 2.0 && pz < s_holeDepth + depthBand * 2.0;
    float depthOffset = (pz - s_holeDepth) / depthBand;
    float bell = max(1.0 - depthOffset * depthOffset * 0.25, 0.000001);
    float depthWeight = s_gravityBell == 3.0 ? bell * bell * bell : pow(bell, s_gravityBell);
    // Gravity does not depend on the flight speed
    float pullScale = s_gravityStrength * 0.6 * s_frameScale;
    float radiusSq = s_holeRadius * s_holeRadius;
    float orbitScale = orbiting ? 0.0 : s_orbitalStrength * 0.02;
    // Matter in orbit feels the holes at any distance: the reach is the flight's cut
    float reachSq = orbiting ? 3.0e38 : s_gravityReach * s_gravityReach;

    if (hasHole) {
      vec2 toHole = hole - end;
      float distSq = dot(toHole, toHole);
      if (distSq < reachSq) {
        // The capture circle stands off the hole's centre only for a spinning hole
        vec2 toCapture = vec2(s_captureX, s_captureY) - end;
        if (dot(toCapture, toCapture) < s_captureRadius * s_captureRadius) {
          if (s_ringFed > 0.5) deposit = vec3(-toHole, s_ringCaptureEnergy);
          reborn = 2;
          horizonAt = vec3(vec2(s_captureX, s_captureY) - vanish, 0.0);
          horizonRadius = s_captureRadius;
          return;
        }
        if (banded) {
          float skim = s_holeRadius * s_ringSkimReach;
          if (s_ringFed > 0.5 && distSq < skim * skim) deposit = vec3(-toHole, s_ringSkimEnergy * s_frameScale * depthWeight);

          // Pull and orbit are screen pixels a frame, turned back into scene units at this depth. Frame
          // dragging turns space about the spin's axis Drag Falloff powers of the distance more steeply
          // than the pull falls: the share toward the camera turns the particles in the screen, the share
          // that lies in the screen sweeps those nearer than the hole's plane one way and those beyond it
          // the other, and carries those on one side of its axis toward the camera and those on the other
          // away, as far as Drag Along Sight lets it
          float clampedSq = max(distSq, 1.0);
          float invDistance = inversesqrt(clampedSq);
          float pull = pullScale * pullFall(radiusSq / clampedSq) * wellPull(sqrt(clampedSq), s_holeRadius) * depthWeight;
          float drag = dragFall(s_holeRadius * invDistance);
          float orbit = pull * (orbitScale + s_spinToward * drag);
          float across = pull * depthOffset * drag * clampedSq * invDistance;
          float toScene = pz / s_focal * invDistance;
          vec2 push = vec2(toHole.x * pull - toHole.y * orbit - across * s_spinUp, toHole.y * pull + toHole.x * orbit - across * s_spinRight) * toScene;
          if (inertial) {
            kept += push * velocityGain;
            push *= gain;
          }
          at += push;
          if (sight && (s_spinRight != 0.0 || s_spinUp != 0.0)) {
            float pushZ = -(s_spinRight * toHole.y + s_spinUp * toHole.x) * pull * drag * s_dragSight * toScene;
            if (inertial) {
              keptZ += pushZ * velocityGain;
              pushZ *= gain;
            }
            pz += pushZ;
            if (pz <= 0.0) {
              reborn = 1;
              return;
            }
            endScale = s_focal / pz;
          }
          end = at * endScale + vanish;
        }
      }
    }

    // The second black hole takes, pulls and drags particles the same way, and the light they leave lands in
    // its own ring: a deposit below 0 is the second hole's
    if (hasHole && s_companionRadius > 0.0) {
      vec2 companion = vec2(s_companionX, s_companionY);
      vec2 toHole = companion - end;
      float distSq = dot(toHole, toHole);
      float share = s_companionRadius / s_holeRadius;
      bool companionFed = s_ringFed > 0.5 && s_companionFed > 0.5;
      if (distSq < reachSq * share * share) {
        if (distSq < s_companionCapture * s_companionCapture) {
          if (companionFed) deposit = vec3(-toHole, -s_ringCaptureEnergy);
          reborn = 2;
          horizonAt = vec3(companion - vanish, 0.0);
          horizonRadius = s_companionCapture;
          return;
        }
        if (banded) {
          float skim = s_companionRadius * s_ringSkimReach;
          if (companionFed && distSq < skim * skim) deposit = vec3(-toHole, -s_ringSkimEnergy * s_frameScale * depthWeight);
          float clampedSq = max(distSq, 1.0);
          float invDistance = inversesqrt(clampedSq);
          float pull = pullScale * pullFall(s_companionRadius * s_companionRadius / clampedSq) * wellPull(sqrt(clampedSq), s_companionRadius) * depthWeight;
          // Its spin drags them as the main hole's does, in the screen and across its plane
          float drag = dragFall(s_companionRadius * invDistance);
          float orbit = pull * (orbitScale + s_companionSpinToward * drag);
          float across = pull * depthOffset * drag * clampedSq * invDistance;
          float toScene = pz / s_focal * invDistance;
          vec2 push = vec2(toHole.x * pull - toHole.y * orbit - across * s_companionSpinUp, toHole.y * pull + toHole.x * orbit - across * s_companionSpinRight) * toScene;
          if (inertial) {
            kept += push * velocityGain;
            push *= gain;
          }
          at += push;
          // and carries the two sides of its axis toward and away from the camera, as the main hole's does
          if (sight && (s_companionSpinRight != 0.0 || s_companionSpinUp != 0.0)) {
            float pushZ = -(s_companionSpinRight * toHole.y + s_companionSpinUp * toHole.x) * pull * drag * s_dragSight * toScene;
            if (inertial) {
              keptZ += pushZ * velocityGain;
              pushZ *= gain;
            }
            pz += pushZ;
            if (pz <= 0.0) {
              reborn = 1;
              return;
            }
            endScale = s_focal / pz;
          }
          end = at * endScale + vanish;
        }
      }
    }

    // Matter in orbit loses angular momentum to Viscosity, round the nearer hole: its speed round that hole
    // falls by Viscosity of itself for each radian it turns, so it spirals in over 1 / (2 pi Viscosity)
    // turns, as gas in a disc does. Matter that flies off past Orbit Escape is made anew
    if (orbiting && hasHole) {
      vec2 second = vec2(s_companionX, s_companionY);
      bool nearSecond = s_companionRadius > 0.0 && dot(end - second, end - second) < dot(end - hole, end - hole);
      vec2 centre = nearSecond ? second : hole;
      if (s_viscosity > 0.0) {
        vec2 outward = at - (centre - vanish) * (pz / s_focal);
        float away = length(outward);
        if (away > 0.000001) {
          outward /= away;
          float radial = dot(kept, outward);
          vec2 around = kept - outward * radial;
          float turned = length(around) / away * s_frameScale;
          kept = outward * radial + around * max(1.0 - s_viscosity * turned, 0.5);
        }
      }
      if (length(end - hole) > s_orbitEscape * s_holeRadius) {
        reborn = 1;
        return;
      }
    }

    place.xyz = vec3(at, pz);
    if (inertial) {
      bool keeps = dot(kept, kept) + keptZ * keptZ > SPEED_FLOOR_SQ;
      drift.xy = keeps ? kept : vec2(0.0);
      if (sight) drift.z = keeps ? keptZ : 0.0;
    }

    // A particle that did not move draws nothing
    moved = end != start;
    strokeEnds = vec4(start, end);
    // The flat mode sees the field straight on and its sheet through a camera of its own, so a stroke is
    // laid on the sheet as it is seen: its place on the screen round the hole, and its height off the
    // hole's depth in pixels there
    if (u_ride.x > 0.0) {
      float heightScale = s_focal / max(s_holeDepth, 1.0);
      rideFrom = vec3(start - hole, (startZ - s_holeDepth) * heightScale);
      rideTo = vec3(end - hole, (pz - s_holeDepth) * heightScale);
    }
    // Light from near a hole is seen dimmed by its climb out of the well, by the distance on the screen: the
    // flat mode sees the field as if in the hole's plane
    float light = 1.0;
    if (hasHole && s_redshift > 0.0) {
      light = wellLight(length(hole - end), s_holeRadius);
      if (s_companionRadius > 0.0) light *= wellLight(length(vec2(s_companionX, s_companionY) - end), s_companionRadius);
    }
    // Its light shifted by its own motion, seen from the camera, which the flat step puts at the origin of
    // the scene looking down its depth: a disc in the screen moves across the sight, so it is only dimmed
    // (the transverse shift), and what Drag Along Sight moves in depth turns bluer coming and redder going
    if (s_doppler > 0.0 && inertial && hasHole && s_gravityStrength > 0.0) {
      float shift = dopplerShift(vec3(kept, keptZ) * (s_focal / pz), -normalize(vec3(at, pz)), lightSpeed(s_holeRadius, 1.0));
      light *= exp2(s_beam * shift);
      strokeShift = shift * s_shiftTint;
    }
    strokeLook = vec2(pz / s_farZ, light);
    strokeMeasure = vec2(length(end - start), length(end - vec2(s_revealX, s_revealY)));
  }

  // The loop in space: the black holes are points, gravity pulls along the true distance and ends at the
  // sphere of Gravity Reach, the orbital force turns particles round the swirl's axis (the line of flight,
  // turned toward the spin's axis by Swirl Follows Spin), the horizon is a sphere, and the camera sees each
  // particle through its pose now and its pose in the frame before
  void stepSpace () {
    float pivot = s_holeDepth;
    float worldPerPixel = pivot / s_focal;
    vec2 vanish = vec2(s_vanishX, s_vanishY);
    vec3 at = place.xyz;
    vec3 was = at;
    // Where the particle stood, through the camera of the frame before
    vec3 fromPivot = vec3(at.xy, at.z - pivot);
    vec3 seenFrom = vec3(dot(u_poseFrom[0].xyz, fromPivot), dot(u_poseFrom[1].xyz, fromPivot), dot(u_poseFrom[2].xyz, fromPivot)) +
      vec3(u_poseFrom[0].w, u_poseFrom[1].w, u_poseFrom[2].w);

    // Matter in orbit and from a torn star does not fly, keeps all its speed and feels no Orbital Force
    bool orbiting = place.w <= 0.0;
    at.z -= s_speed * s_frameScale * max(place.w, 0.0);
    if (at.z <= 0.0) {
      reborn = 1;
      return;
    }

    bool inertial = s_inertial > 0.5 || orbiting;
    float gain = orbiting ? s_frameScale : s_gain;
    float velocityGain = orbiting ? 1.0 : s_velocityGain;
    vec3 kept = vec3(0.0);
    if (inertial) {
      kept = drift.xyz * (orbiting ? 1.0 : s_keep);
      at += kept * s_frameScale;
    }

    bool hasHole = s_hasHole > 0.5;
    vec3 hole = vec3(s_holeWorldX, s_holeWorldY, s_holeWorldZ);
    // Lengths round the black hole arrive in CSS pixels at its depth; there they are this many scene units
    float radius = s_holeRadius * worldPerPixel;
    // Matter in orbit feels the holes at any distance: the reach is the flight's cut
    float reach = orbiting ? 1.0e18 : s_gravityReach * worldPerPixel;
    float pullScale = s_gravityStrength * 0.6 * s_frameScale * worldPerPixel;
    float orbitScale = orbiting ? 0.0 : s_orbitalStrength * 0.02;
    vec3 swirl = vec3(s_swirlX, s_swirlY, s_swirlZ);

    if (hasHole) {
      vec3 toHole = hole - at;
      float distSq = dot(toHole, toHole);
      if (distSq < reach * reach) {
        // The light lands on the ring where the particle is seen round the hole
        vec3 ringAt = vec3(-dot(u_pose[0].xyz, toHole), -dot(u_pose[1].xyz, toHole), 0.0);
        float capture = s_captureRadius * worldPerPixel;
        if (distSq < capture * capture) {
          if (s_ringFed > 0.5) deposit = vec3(ringAt.xy, s_ringCaptureEnergy);
          reborn = 2;
          horizonAt = hole;
          horizonRadius = capture;
          return;
        }
        float skim = radius * s_ringSkimReach;
        if (s_ringFed > 0.5 && distSq < skim * skim) deposit = vec3(ringAt.xy, s_ringSkimEnergy * s_frameScale);

        // Pull along the distance, orbit round the swirl's axis through the hole, and space carried round
        // the spin's axis, which stands in the scene (its y runs down and its z away from the camera)
        float clampedSq = max(distSq, 1.0);
        float away = sqrt(clampedSq);
        float pull = pullScale * pullFall(radius * radius / clampedSq) * wellPull(away, radius) / away;
        float orbit = pull * orbitScale;
        vec3 push = toHole * pull + cross(toHole, swirl) * orbit;
        push -= cross(vec3(s_spinRight, -s_spinUp, -s_spinToward), toHole) * (pull * dragFall(radius / away));
        if (inertial) {
          kept += push * velocityGain;
          push *= gain;
        }
        at += push;
      }
    }

    if (hasHole && s_companionRadius > 0.0) {
      vec3 companion = vec3(s_companionWorldX, s_companionWorldY, s_companionWorldZ);
      vec3 toHole = companion - at;
      float distSq = dot(toHole, toHole);
      float share = s_companionRadius / s_holeRadius;
      if (distSq < reach * reach * share * share) {
        bool companionFed = s_ringFed > 0.5 && s_companionFed > 0.5;
        vec3 ringAt = vec3(-dot(u_pose[0].xyz, toHole), -dot(u_pose[1].xyz, toHole), 0.0);
        float capture = s_companionCapture * worldPerPixel;
        if (distSq < capture * capture) {
          if (companionFed) deposit = vec3(ringAt.xy, -s_ringCaptureEnergy);
          reborn = 2;
          horizonAt = companion;
          horizonRadius = capture;
          return;
        }
        float companionRadius = s_companionRadius * worldPerPixel;
        float skim = companionRadius * s_ringSkimReach;
        if (companionFed && distSq < skim * skim) deposit = vec3(ringAt.xy, -s_ringSkimEnergy * s_frameScale);
        float clampedSq = max(distSq, 1.0);
        float away = sqrt(clampedSq);
        float pull = pullScale * pullFall(companionRadius * companionRadius / clampedSq) * wellPull(away, companionRadius) / away;
        float orbit = pull * orbitScale;
        vec3 push = toHole * pull + cross(toHole, swirl) * orbit;
        push -= cross(vec3(s_companionSpinRight, -s_companionSpinUp, -s_companionSpinToward), toHole) * (pull * dragFall(companionRadius / away));
        if (inertial) {
          kept += push * velocityGain;
          push *= gain;
        }
        at += push;
      }
    }

    // Matter in orbit loses angular momentum to Viscosity round the nearer hole (the flat step says how),
    // and matter that flies off past Orbit Escape is made anew
    if (orbiting && hasHole) {
      vec3 second = vec3(s_companionWorldX, s_companionWorldY, s_companionWorldZ);
      bool nearSecond = s_companionRadius > 0.0 && dot(at - second, at - second) < dot(at - hole, at - hole);
      if (s_viscosity > 0.0) {
        vec3 outward = at - (nearSecond ? second : hole);
        float away = length(outward);
        if (away > 0.000001) {
          outward /= away;
          float radial = dot(kept, outward);
          vec3 around = kept - outward * radial;
          float turned = length(around) / away * s_frameScale;
          kept = outward * radial + around * max(1.0 - s_viscosity * turned, 0.5);
        }
      }
      if (length(at - hole) > s_orbitEscape * radius) {
        reborn = 1;
        return;
      }
    }

    place.xyz = at;
    if (inertial) drift.xyz = dot(kept, kept) > SPEED_FLOOR_SQ ? kept : vec3(0.0);

    // Where it stands now, through the camera of this frame
    fromPivot = vec3(at.xy, at.z - pivot);
    vec3 seenTo = vec3(dot(u_pose[0].xyz, fromPivot), dot(u_pose[1].xyz, fromPivot), dot(u_pose[2].xyz, fromPivot)) +
      vec3(u_pose[0].w, u_pose[1].w, u_pose[2].w);
    // Its own move on the screen: where it stood before this step and where it stands now, both through the
    // camera of this frame, so a camera that turns or moves lights nothing that stands still. Where either
    // is nearer than the near plane the stroke's own length stands in for it (below 0 until then)
    vec3 wasFromPivot = vec3(was.xy, was.z - pivot);
    vec3 seenWas = vec3(dot(u_pose[0].xyz, wasFromPivot), dot(u_pose[1].xyz, wasFromPivot), dot(u_pose[2].xyz, wasFromPivot)) +
      vec3(u_pose[0].w, u_pose[1].w, u_pose[2].w);
    float own = seenWas.z >= NEAR && seenTo.z >= NEAR ? length(seenTo.xy / seenTo.z - seenWas.xy / seenWas.z) * s_focal : -1.0;

    // A stroke that passes behind the camera is cut where it crosses the near plane
    if (seenFrom.z < NEAR || seenTo.z < NEAR) {
      if (seenFrom.z < NEAR && seenTo.z < NEAR) return;
      float cut = (NEAR - seenFrom.z) / (seenTo.z - seenFrom.z);
      if (seenFrom.z < NEAR) seenFrom = vec3(seenFrom.xy + (seenTo.xy - seenFrom.xy) * cut, NEAR);
      else seenTo = vec3(seenFrom.xy + (seenTo.xy - seenFrom.xy) * cut, NEAR);
    }
    vec2 start = seenFrom.xy * (s_focal / seenFrom.z) + vanish;
    vec2 end = seenTo.xy * (s_focal / seenTo.z) + vanish;
    if (end == start) return;

    // Straight on, the ends of the column are the far end and the camera itself, as in the flat loop; the
    // more the camera turns away from that, the more they fade, over a share of Field Depth
    float shown = 1.0;
    float endWeight = min(1.0 - u_pose[2].z, 1.0);
    if (endWeight > 0.000001 && s_endFade > 0.0) {
      float toEnd = min(s_farZ - at.z, at.z) / (s_farZ * s_endFade);
      if (toEnd < 1.0) shown = 1.0 - endWeight * (1.0 - max(toEnd, 0.0));
    }
    // Width and the fade with distance follow the distance from the camera. On the sheet the particle
    // stands where its place falls on the main hole's equator, in pixels at the hole's distance
    moved = true;
    strokeEnds = vec4(start, end);
    strokeAway = vec2(seenFrom.z, seenTo.z) / worldPerPixel;
    if (u_ride.x > 0.0) {
      vec3 fromHole = (was - hole) / worldPerPixel;
      vec3 toHole = (at - hole) / worldPerPixel;
      rideFrom = vec3(dot(u_equator[0], fromHole), dot(u_equator[1], fromHole), dot(u_equator[2], fromHole));
      rideTo = vec3(dot(u_equator[0], toHole), dot(u_equator[1], toHole), dot(u_equator[2], toHole));
    }
    // Light from near a hole is seen dimmed by its climb out of the well, by the true distance
    if (hasHole && s_redshift > 0.0) {
      shown *= wellLight(length(at - hole), radius);
      if (s_companionRadius > 0.0) shown *= wellLight(length(at - vec3(s_companionWorldX, s_companionWorldY, s_companionWorldZ)), s_companionRadius * worldPerPixel);
    }
    // and shifted by its own motion as the camera sees it: the side of an orbit coming toward the camera
    // bluer and brighter, the side going away redder and dimmer, and all of it dimmed by the transverse shift
    if (s_doppler > 0.0 && inertial && hasHole && s_gravityStrength > 0.0) {
      vec3 seenVelocity = vec3(dot(u_pose[0].xyz, kept), dot(u_pose[1].xyz, kept), dot(u_pose[2].xyz, kept));
      float shift = dopplerShift(seenVelocity, -normalize(seenTo), lightSpeed(radius, worldPerPixel));
      shown *= exp2(s_beam * shift);
      strokeShift = shift * s_shiftTint;
    }
    strokeLook = vec2(min(seenTo.z / s_farZ, 1.0), shown);
    // The opening reveals the field by the true distance from the blast, which happened at the hole's depth
    // where the flat view shows it, in CSS pixels at that depth
    vec3 blast = vec3((vec2(s_revealX, s_revealY) - vanish) * worldPerPixel, pivot);
    strokeMeasure = vec2(own < 0.0 ? length(end - start) : own, length(at - blast) / worldPerPixel);
  }

  void main () {
    place = a_place;
    drift = a_drift;
    look = a_look;
    segment = vec4(0.0);
    style = vec4(0.0);
    strokeShift = 0.0;
    deposit = vec3(0.0);
    reborn = 0;
    moved = false;
    strokeAway = vec2(1.0);
    rideFrom = vec3(0.0);
    rideTo = vec3(0.0);
    horizonAt = vec3(0.0);
    horizonRadius = 0.0;
    seed = (uint(gl_VertexID) * 2654435761u) ^ (u_tick * 2246822519u + 3266489917u);
    chance();

    bool held = s_hasHole > 0.5;
    if (s_burst > 0.0 && held && drawn((uint(gl_VertexID) * 2891336453u) ^ (uint(s_burstSeed) * 747796405u + 1013904223u)) < s_burst) {
      // A share of the field is torn from a star this step, and draws nothing until the next
      burstBirth();
    } else {
      // Matter passes between the flight and orbit as Orbit Birth changes, made anew where it now belongs (with
      // no pull to orbit in, all of it flies); what a star left stays until a horizon takes it
      bool inOrbit = held && s_orbitShare > 0.0 && s_gravityStrength > 0.0 && ownOrbit() < s_orbitShare;
      if (place.w > 0.0 ? inOrbit : (place.w == 0.0 && !inOrbit)) reborn = 1;
      else if (s_threeD > 0.5) stepSpace();
      else stepFlat();
      // Each of the two is called in this one place: a card's compiler writes a function out again wherever
      // it is called, and the page waits for it
      if (reborn > 0) rebirth();
      else if (moved) stroke(strokeEnds.xy, strokeEnds.zw, strokeAway, strokeLook.x, rideFrom, rideTo, strokeLook.y, strokeMeasure.x, strokeMeasure.y);
    }

    v_place = place;
    v_drift = drift;
    v_look = look;
    v_segment = segment;
    v_style = style;
    v_deposit = deposit;
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  }
`

// The light the step's captures leave in the photon rings: each lands in the bin of its direction round the
// hole, the main hole's in the first row and the second hole's (a deposit below 0) in the second. The
// composite pass spreads a bin over its neighbours when it reads a ring
export const ringDepositVertexShaderSource = `#version 300 es
  precision highp float;

  in vec3 a_deposit;      // where round the hole the light lands, how much (0 = none; below 0 round the second hole)
  uniform float u_phase;  // radians the ring's pattern has turned
  out float v_amount;

  void main () {
    v_amount = abs(a_deposit.z);
    gl_PointSize = 1.0;
    if (a_deposit.z == 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    float turns = (atan(a_deposit.y, a_deposit.x) - u_phase) / 6.2831853;
    float bin = min(floor(fract(turns) * ${RING_BINS}.0), ${RING_BINS - 1}.0);
    gl_Position = vec4((bin + 0.5) / ${RING_BINS}.0 * 2.0 - 1.0, a_deposit.z > 0.0 ? -0.5 : 0.5, 0.0, 1.0);
  }
`

export const ringDepositFragmentShaderSource = `#version 300 es
  precision highp float;

  in float v_amount;
  out vec4 light;

  void main () {
    light = vec4(v_amount);
  }
`
