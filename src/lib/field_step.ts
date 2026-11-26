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

// A particle's record in the buffer, in floats: its state (place and speed multiplier; kept speed and
// alpha; pulse phase, pulse speed and colour), then what it draws this frame (the stroke's ends, its width
// and opacity, whose sign is the side of the black holes it is on: below 0 in front of them) and the light
// it leaves in the ring (where round the hole, how much)
export const FIELD_FLOATS = 20
export const FIELD_STRIDE = FIELD_FLOATS * 4

// Where in the record the colour's four bytes, the stroke, its style and the ring's light lie, in bytes
export const FIELD_COLOR_OFFSET = 40
export const FIELD_SEGMENT_OFFSET = 44
export const FIELD_STYLE_OFFSET = 60
export const FIELD_DEPOSIT_OFFSET = 68
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
  'companionCapture', 'ringCaptureEnergy', 'ringSkimReach', 'ringSkimEnergy', 'gravityReach', 'holeDepth',
  'gravityDepth', 'lineWidth', 'minLineWidth', 'gravityStrength', 'orbitalStrength', 'swirlX', 'swirlY', 'swirlZ', 'farZ', 'depthFade',
  'pulseSpeedMultiplier', 'pulseIntensity', 'baseBrightness', 'minOpacity', 'maxOpacity', 'speedGlow', 'speedKnee', 'revealRadius', 'revealX',
  'revealY', 'revealFeather', 'opacityScale', 'threeD', 'holeWorldX', 'holeWorldY', 'holeWorldZ', 'companionWorldX',
  'companionWorldY', 'companionWorldZ', 'endFade', 'frontAway', 'frontDepth', 'frontReach', 'holeSeen', 'companionSeen', 'holeFront', 'companionFront'
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
  out vec2 v_style;     // its width in CSS pixels, its opacity; 0 draws nothing, below 0 it is in front of the holes
  out vec3 v_deposit;   // light for the photon ring: where round the hole it lands, how much

${STEP_DEFINES}

  const float TWO_PI = 6.2831853;
  // A stroke is cut to the picture and at least this margin round it, in CSS pixels, wide enough to hide
  // its ends
  const float MIN_CLIP_MARGIN = 4.0;
  // Strokes are cut where they pass this close in front of the 3D camera, in scene units
  const float NEAR = 1.0;
  // Random spawns tried for a captured particle before it is placed right outside the horizon, and how
  // far outside, as a share of the capture radius
  const int RESPAWN_TRIES = 4;
  const float RESPAWN_RIM_SPREAD = 0.5;
  // How fast the space round a spinning hole carries a particle, against how fast the hole pulls it in
  const float DRAG_SHARE = 0.5;
  // A kept speed below a hundredth of a scene unit a second (squared, per 60 Hz frame) is let go
  const float SPEED_FLOOR_SQ = ${((0.01 / 60) ** 2).toExponential(6)};

  vec4 place;
  vec4 drift;
  vec3 look;
  vec4 segment;
  vec2 style;
  vec3 deposit;
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

  // A number in [0, 1) of this particle alone, the same in every step: the share seen through the lens
  // past which it goes behind the holes, so in the band behind them the field thins from one layer into
  // the other and no particle flickers between the two
  float ownShare () {
    return drawn(uint(gl_VertexID) * 747796405u + 2891336453u);
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
    if (!placed) {
      float angle = chance() * TWO_PI;
      float radius = horizonRadius * (1.0 + chance() * RESPAWN_RIM_SPREAD);
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
    place = vec4(at, s_farZ, 1.0 + s_speedVariance * (2.0 + r * r * r * r * r * 98.0));
    drift = vec4(0.0, 0.0, 0.0, alpha);
    look = vec3(phase, rate, uintBitsToFloat(${COLOR_KEPT}u | uint(rgb.r) | (uint(rgb.g) << 8u) | (uint(rgb.b) << 16u)));
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
  // did, and "fromBlast" its distance from the opening's blast, both in CSS pixels. A stroke whose middle is
  // nearer the camera than the nearer black hole (s_frontAway, 0 in the flat mode) is in front of the holes:
  // its opacity is written below 0, and the renderer draws it into the layer the lens does not bend. Within
  // Front Depth behind that a stroke stays in front while the share seen through the lens there is below
  // the particle's own (ownShare)
  void stroke (vec2 start, vec2 end, vec2 away, float distanceFactor, vec3 inFrom, vec3 inTo, float shown, float own, float fromBlast) {
    float middleAway = 0.5 * (away.x + away.y);
    float depthFactor = 1.0 - distanceFactor * s_depthFade;
    float lineWidth = max((1.0 - distanceFactor) * s_lineWidth, s_minLineWidth);
    float pulse = s_pulseIntensity != 0.0
      ? 1.0 + sin(s_time * look.y * s_pulseSpeedMultiplier + look.x) * s_pulseIntensity * distanceFactor
      : 1.0;
    float opacity = max(min(depthFactor * drift.w * pulse * s_baseBrightness, s_maxOpacity), s_minOpacity) * s_opacityScale * shown;

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
        if (min(laidFrom.z, laidTo.z) < u_sheetV.w) return;
        start = laidOn(start, away.x, laidFrom, shareFrom);
        end = laidOn(end, away.y, laidTo, shareTo);
        // A ridden stroke stands as far away as laidOn sets it
        middleAway = 0.5 * (mix(away.x, mix(away.x, laidFrom.z, u_ride.w), shareFrom) + mix(away.y, mix(away.y, laidTo.z, u_ride.w), shareTo));
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
    }
    segment = vec4(start, end);
    bool front = false;
    if (s_frontAway > 0.0) {
      float behind = seenBehind(middleAway, s_frontDepth, s_frontReach, 0.5 * (start + end), vec4(s_holeX, s_holeY, s_holeSeen, s_holeFront),
        vec4(s_companionX, s_companionY, s_companionSeen, s_companionFront));
      front = behind <= 0.0 || (behind < 1.0 && behind < ownShare());
    }
    style = vec2(lineWidth, front ? -opacity : opacity);
  }

  // The flat loop: the holes pull a particle where it lands on the screen, inside a layer of depth round
  // the black hole, and the event horizon takes whatever covers the hole at any depth
  void stepFlat () {
    vec2 vanish = vec2(s_vanishX, s_vanishY);
    vec2 at = place.xy;
    float startZ = place.z;
    vec2 start = at * (s_focal / startZ) + vanish;

    float pz = startZ - s_speed * s_frameScale * place.w;
    if (pz <= 0.0) {
      reborn = 1;
      return;
    }

    // A particle the holes set moving drifts on with what it kept of that speed
    bool inertial = s_inertial > 0.5;
    vec2 kept = vec2(0.0);
    if (inertial) {
      kept = drift.xy * s_keep;
      at += kept * s_frameScale;
    }

    float endScale = s_focal / pz;
    vec2 end = at * endScale + vanish;
    bool hasHole = s_hasHole > 0.5;
    vec2 hole = vec2(s_holeX, s_holeY);
    // Gravity acts within a depth band round the hole's plane, a compact bell, (1 - u^2 / 4)^3, that is
    // zero beyond two scales; the horizon takes a particle at any depth
    float depthBand = max(s_gravityDepth, 0.000001);
    bool banded = pz > s_holeDepth - depthBand * 2.0 && pz < s_holeDepth + depthBand * 2.0;
    float depthOffset = (pz - s_holeDepth) / depthBand;
    float bell = 1.0 - depthOffset * depthOffset * 0.25;
    float depthWeight = bell * bell * bell;
    // Gravity does not depend on the flight speed
    float pullScale = s_gravityStrength * 0.6 * s_frameScale * s_holeRadius * s_holeRadius;
    float orbitScale = s_orbitalStrength * 0.02;
    float reachSq = s_gravityReach * s_gravityReach;

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
          // dragging turns space about the spin's axis one power of the distance more steeply than the pull
          // falls: the share toward the camera turns the particles in the screen, the share that lies in
          // the screen sweeps those nearer than the hole's plane one way and those beyond it the other
          float clampedSq = max(distSq, 1.0);
          float invDistance = inversesqrt(clampedSq);
          float pull = pullScale / clampedSq * depthWeight;
          float dragScale = DRAG_SHARE * s_holeRadius;
          float orbit = pull * (orbitScale + s_spinToward * dragScale * invDistance);
          float across = pull * depthOffset * dragScale;
          vec2 push = vec2(toHole.x * pull - toHole.y * orbit - across * s_spinUp, toHole.y * pull + toHole.x * orbit - across * s_spinRight) *
            (pz / s_focal * invDistance);
          if (inertial) {
            kept += push * s_velocityGain;
            push *= s_gain;
          }
          at += push;
          end = at * endScale + vanish;
        }
      }
    }

    // The second black hole takes and pulls particles the same way; the light they leave is not tracked
    if (hasHole && s_companionRadius > 0.0) {
      vec2 companion = vec2(s_companionX, s_companionY);
      vec2 toHole = companion - end;
      float distSq = dot(toHole, toHole);
      float share = s_companionRadius / s_holeRadius;
      if (distSq < reachSq * share * share) {
        if (distSq < s_companionCapture * s_companionCapture) {
          reborn = 2;
          horizonAt = vec3(companion - vanish, 0.0);
          horizonRadius = s_companionCapture;
          return;
        }
        if (banded) {
          float clampedSq = max(distSq, 1.0);
          float pull = pullScale * share * share / clampedSq * depthWeight;
          float orbit = pull * orbitScale;
          vec2 push = vec2(toHole.x * pull - toHole.y * orbit, toHole.y * pull + toHole.x * orbit) * (pz / s_focal * inversesqrt(clampedSq));
          if (inertial) {
            kept += push * s_velocityGain;
            push *= s_gain;
          }
          at += push;
          end = at * endScale + vanish;
        }
      }
    }

    place.xyz = vec3(at, pz);
    if (inertial) drift.xy = dot(kept, kept) > SPEED_FLOOR_SQ ? kept : vec2(0.0);

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
    strokeLook = vec2(pz / s_farZ, 1.0);
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

    at.z -= s_speed * s_frameScale * place.w;
    if (at.z <= 0.0) {
      reborn = 1;
      return;
    }

    bool inertial = s_inertial > 0.5;
    vec3 kept = vec3(0.0);
    if (inertial) {
      kept = drift.xyz * s_keep;
      at += kept * s_frameScale;
    }

    bool hasHole = s_hasHole > 0.5;
    vec3 hole = vec3(s_holeWorldX, s_holeWorldY, s_holeWorldZ);
    // Lengths round the black hole arrive in CSS pixels at its depth; there they are this many scene units
    float radius = s_holeRadius * worldPerPixel;
    float reach = s_gravityReach * worldPerPixel;
    float pullScale = s_gravityStrength * 0.6 * s_frameScale * radius * radius * worldPerPixel;
    float orbitScale = s_orbitalStrength * 0.02;
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
        float pull = pullScale / (clampedSq * away);
        float orbit = pull * orbitScale;
        vec3 push = toHole * pull + cross(toHole, swirl) * orbit;
        vec3 drag = vec3(s_spinRight, -s_spinUp, -s_spinToward) * (DRAG_SHARE * radius);
        push -= cross(drag, toHole) * (pull / away);
        if (inertial) {
          kept += push * s_velocityGain;
          push *= s_gain;
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
        float capture = s_companionCapture * worldPerPixel;
        if (distSq < capture * capture) {
          reborn = 2;
          horizonAt = companion;
          horizonRadius = capture;
          return;
        }
        float clampedSq = max(distSq, 1.0);
        float pull = pullScale * share * share / (clampedSq * sqrt(clampedSq));
        float orbit = pull * orbitScale;
        vec3 push = toHole * pull + cross(toHole, swirl) * orbit;
        if (inertial) {
          kept += push * s_velocityGain;
          push *= s_gain;
        }
        at += push;
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
    style = vec2(0.0);
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

    if (s_threeD > 0.5) stepSpace();
    else stepFlat();
    // Each of the two is called in this one place: a card's compiler writes a function out again wherever
    // it is called, and the page waits for it
    if (reborn > 0) rebirth();
    else if (moved) stroke(strokeEnds.xy, strokeEnds.zw, strokeAway, strokeLook.x, rideFrom, rideTo, strokeLook.y, strokeMeasure.x, strokeMeasure.y);

    v_place = place;
    v_drift = drift;
    v_look = look;
    v_segment = segment;
    v_style = style;
    v_deposit = deposit;
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  }
`

// The light the step's captures leave in the photon ring: each lands in the bin of its direction round the
// hole. The composite pass spreads a bin over its neighbours when it reads the ring
export const ringDepositVertexShaderSource = `#version 300 es
  precision highp float;

  in vec3 a_deposit;      // where round the hole the light lands, how much (0 = none)
  uniform float u_phase;  // radians the ring's pattern has turned
  out float v_amount;

  void main () {
    v_amount = a_deposit.z;
    gl_PointSize = 1.0;
    if (a_deposit.z <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    float turns = (atan(a_deposit.y, a_deposit.x) - u_phase) / 6.2831853;
    float bin = min(floor(fract(turns) * ${RING_BINS}.0), ${RING_BINS - 1}.0);
    gl_Position = vec4((bin + 0.5) / ${RING_BINS}.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
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
