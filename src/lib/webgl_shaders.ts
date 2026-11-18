// WebGL shaders for the particle renderer: trail fade, particle segments and the composite pass,
// which draws the black hole, the explosion's light and the intro title over the scene. Written in GLSL ES 1.00 so the same sources run on WebGL2 and on
// WebGL1 with ANGLE_instanced_arrays.

// Attribute locations shared by every program; location 0 is always the full-screen quad
export const ATTRIBUTE_LOCATIONS = {
  position: 0,
  segment: 1,
  style: 2,
  color: 3
} as const

// Two triangles covering clip space; the particle program reuses them as segment corners
export const QUAD_VERTICES = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1
])

export const QUAD_VERTEX_COUNT = 6

const HIGH_PRECISION = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
`

export const fadeVertexShaderSource = `
  attribute vec2 a_position;

  void main () {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export const fadeFragmentShaderSource = `
  precision mediump float;

  uniform vec4 u_color;

  void main () {
    gl_FragColor = u_color;
  }
`

export const particleVertexShaderSource = `
  attribute vec2 a_position;  // quad corner: x picks the segment end, y the side
  attribute vec4 a_segment;   // x0, y0, x1, y1 in CSS pixels, top-left origin
  attribute vec2 a_style;     // line width in CSS pixels, opacity
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform float u_pixelRatio;
  uniform vec2 u_center;      // vanishing point in CSS pixels
  uniform float u_doppler;    // 0 at rest, 1 near the speed of light
  uniform float u_speedGlow;  // how strongly brightness follows speed; 0 lights every moving particle in full
  uniform float u_frameScale; // length of this frame in 60 Hz reference frames

  varying vec2 v_ends;        // distance along the segment from its start and from its end
  varying float v_across;     // signed distance from the segment axis
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;
  // Speed, in CSS pixels per 60 Hz frame, at which a particle reaches half of its brightness
  const float SPEED_KNEE = 0.15;
  const vec3 BLUESHIFT = vec3(0.6, 0.76, 1.0);
  const vec3 REDSHIFT = vec3(1.0, 0.58, 0.42);

  void main () {
    vec2 start = a_segment.xy * u_pixelRatio;
    vec2 delta = a_segment.zw * u_pixelRatio - start;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float width = a_style.x * u_pixelRatio;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;

    // The particle is a filled disc; over a frame it sweeps a capsule, a stroke with round caps
    float along = mix(-extent, len + extent, a_position.x * 0.5 + 0.5);
    float across = a_position.y * extent;
    vec2 pixel = start + direction * along + normal * across;

    // Exact area of the requested round-capped line versus the area the anti-aliased capsule covers
    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    // Brightness is set by speed directly: the capsule is stamped with the brighter-of-two blend, so
    // overlapping stamps of a slow particle do not add up and its edge stays sharp. The speed is taken
    // per 60 Hz frame, so the result is the same at any refresh rate, and u_speedGlow bends the link
    float referenceSpeed = len / max(u_frameScale * u_pixelRatio, 0.0001);
    float glow = pow(max(referenceSpeed / (referenceSpeed + SPEED_KNEE), 0.000001), u_speedGlow);

    // Relativistic aberration, stylised: light ahead shifts blue, light at the edges shifts red
    float radial = length(a_segment.zw - u_center) / max(length(u_center), 1.0);
    float shift = u_doppler * (1.0 - 1.7 * radial);
    vec3 tint = shift > 0.0 ? BLUESHIFT : REDSHIFT;

    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(mix(a_color.rgb, tint, min(abs(shift), 0.8)), min(a_style.y * glow * targetArea / drawnArea, 1.0));

    // Rows stay top-down in the scene texture, which is the layout the composite pass samples
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

export const particleFragmentShaderSource = `
  ${HIGH_PRECISION}

  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying vec4 v_color;

  void main () {
    // Distance to the segment: past either end it is measured from the end point, which rounds the cap
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float coverage = clamp(v_halfWidth + 0.5 - length(vec2(beyondEnds, v_across)), 0.0, 1.0);
    // Premultiplied, the form the brighter-of-two blend compares
    float alpha = v_color.a * coverage;
    gl_FragColor = vec4(v_color.rgb * alpha, alpha);
  }
`

export const compositeVertexShaderSource = `
  attribute vec2 a_position;

  void main () {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

// Every length uniform is in device pixels with a top-left origin
export const compositeFragmentShaderSource = `
  ${HIGH_PRECISION}

  uniform sampler2D u_image;
  uniform sampler2D u_title;     // white alpha mask of the intro title
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_time;

  // Black hole
  uniform vec2 u_hole;
  uniform float u_horizon;       // shadow radius; 0 before the black hole forms
  uniform float u_einstein;      // Einstein ring radius; 0 turns the lens off
  uniform float u_falloff;       // 2 is a point mass; higher widens the lens, lower shrinks it
  uniform float u_swirl;         // frame-dragging twist near the ring
  uniform float u_falloffPivot;  // distance at which falloff leaves the pull unchanged
  uniform float u_lensCore;      // closest a bent ray gets to the point behind the hole, in Einstein radii
  uniform float u_maxBend;       // cap on the pull; 1 leaves no nested rings inside the Einstein ring
  uniform float u_lensReach;     // 0: the compact bubble of the original canvas; 1: a point mass, felt across the screen
  uniform float u_twistLimit;    // cap on the pull the twist follows, so a wide lens does not wind up the scene
  uniform float u_absorption;    // light the lens's pull removes around the shadow
  uniform float u_ring;          // photon ring brightness
  uniform float u_ringWidth;     // thickness of the line, in black hole radii
  uniform float u_ringDoppler;   // contrast between the approaching and the receding side
  uniform float u_ringSide;      // direction of the approaching side, radians
  uniform sampler2D u_ringEnergy; // light left around the ring by infalling matter
  uniform float u_ringPhase;     // radians the energy pattern has turned
  uniform float u_ringBase;      // share of the ring's light that shines with nothing falling in
  uniform float u_ringFeed;      // share of the ring's light that infalling matter adds

  // Explosion, all centred on u_center
  uniform vec2 u_center;
  uniform float u_starGlow;      // the progenitor before it explodes
  uniform float u_starRadius;
  uniform float u_sourcePower;   // the explosion's glare in the camera
  uniform float u_glareRadius;
  uniform float u_exposure;
  uniform float u_lightRadius;   // light front
  uniform float u_lightWidth;
  uniform float u_lightPower;
  uniform float u_lightSpeed;    // pixels per second
  uniform float u_echoPower;     // dust lit up behind the light front
  uniform float u_echoDecay;     // seconds
  uniform float u_waveRadius;    // matter front
  uniform float u_waveStrength;  // refraction at the matter front, pixels
  uniform float u_waveWidth;
  uniform float u_remnantGlow;   // the collapsing core
  uniform float u_remnantRedshift;
  uniform float u_remnantRadius;
  uniform float u_gravityWaveRadius;
  uniform float u_gravityWaveAmplitude; // pixels
  uniform float u_gravityWaveWidth;
  uniform float u_gravityWaveCycles;
  uniform float u_backgroundStars;
  uniform float u_starCell;        // CSS pixels per background-star cell
  uniform float u_starDensity;     // share of cells holding a star
  uniform float u_starFlare;
  uniform float u_dustScale;       // CSS pixels
  uniform float u_dustThreshold;
  uniform float u_lightDustContrast;
  uniform float u_dustSweep;       // how completely the matter front clears the dust it passes
  uniform float u_dustBlow;        // CSS pixels the blast pushes the dust outward
  uniform float u_dustDrift;       // CSS pixels per second the dust drifts on its own

  uniform vec2 u_titleCenter;
  uniform vec2 u_titleHalfSize;
  uniform float u_titleAlpha;
  uniform float u_titleReveal;   // 1: lit by the light front; 0: shown whole
  uniform float u_titleDissolve; // 0..1 crumbling progress
  uniform float u_titleDrift;    // pixels the crumbling dust moves towards the hole
  uniform float u_titleGlow;
  uniform float u_titleFlash;
  uniform float u_titleCooling;  // seconds
  uniform float u_titleDust;     // 0 solid letters, 1 grains only
  uniform float u_titlePull;     // the black hole's gravity relative to its default; negative pushes the dust away
  uniform float u_titleSwirl;    // radians the falling dust turns around the hole, from the orbital force
  uniform float u_titleReach;    // reach of gravity; dust beyond it falls late and slowly
  uniform float u_titleCapture;  // radius of no return; dust inside it is gone
  uniform float u_titleScale;    // slow push-in of the camera over the title's life
  uniform float u_titleFringe;   // colour fringing at the title's edges, pixels
  uniform float u_titleHalo;     // strength of the glow around the letters
  uniform float u_titleRedshift; // how far falling dust reddens
  uniform float u_titleGrain;    // 1 = every speck falls on its own, 0 = the letters fall as one image
  uniform float u_titleBurn;     // 0..1 progress of the title burning away from its ends

  // Colours of the intro
  uniform vec3 u_colorFlash;     // the star, the glare and the white-hot core
  uniform vec3 u_colorLight;     // the light front and the flash it leaves on the title
  uniform vec3 u_colorDust;      // dust glowing after the front has passed
  uniform vec3 u_colorTitle;     // the lit letters
  uniform vec3 u_colorEmber;     // the cooling core, falling and burning title dust

  // Camera and film
  uniform float u_cameraZoom;    // zoom of the whole frame around u_center; 1 is none
  uniform vec2 u_shake;          // jolt of the camera, pixels
  uniform float u_lensFringe;    // colour fringing of the scene at the frame's corners, pixels
  uniform float u_vignette;      // darkening of the corners
  uniform float u_filmGrain;
  uniform float u_letterbox;     // height of each black bar, pixels

  const float PI = 3.14159265359;
  const vec3 RING_COLOR = vec3(1.0, 0.86, 0.66);
  const vec3 RING_APPROACHING = vec3(0.8, 0.9, 1.0);
  const vec3 RING_RECEDING = vec3(1.0, 0.42, 0.16);
  // A blur spreads the letters' light thin; this brings the glow back to a visible level
  const float TITLE_HALO_GAIN = 1.5;
  // Seconds a background star stays flared after the light front passes it
  const float STAR_FLARE_DECAY = 0.18;
  // How long dust holds its light, in multiples of the afterglow: thin haze and the thickest cloud
  const float DUST_HOLD_MIN = 0.4;
  const float DUST_HOLD_MAX = 1.8;
  // Seconds for the blast to push the dust most of its way
  const float DUST_BLOW_SECONDS = 1.2;

  // Hash without sine (Dave Hoskins), stable across GPUs
  float hash12 (vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise (vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Soft clouds with curled edges. The noise is read through a second, slower noise that bends its
  // coordinates, which hides the grid it is built on and pulls the clouds into wisps; a fine layer
  // on top gives them grain
  float dust (vec2 cssPx) {
    vec2 p = cssPx / u_dustScale;
    p += 0.9 * (vec2(valueNoise(p * 0.8 + 3.1), valueNoise(p * 0.8 + 17.4)) - 0.5);
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float n = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      n += amplitude * valueNoise(p);
      p = turn * p * 2.1 + 11.7;
      amplitude *= 0.5;
    }
    // n spans 0..0.875 around 0.44. The threshold slides the level the clouds start at, from haze
    // everywhere to a few thin wisps
    float edge = mix(0.2, 0.62, u_dustThreshold);
    float cloud = smoothstep(edge, edge + 0.22, n);
    return cloud * (0.45 + 0.55 * cloud) * (0.7 + 0.3 * valueNoise(p * 1.7));
  }

  // Static distant stars, one at most per cell; they flare as the light front passes
  vec3 backgroundStar (vec2 cssPx, float flare) {
    vec2 cell = floor(cssPx / u_starCell);
    float presence = hash12(cell);
    if (presence > u_starDensity) return vec3(0.0);
    vec2 position = (cell + 0.2 + 0.6 * vec2(hash12(cell + 7.3), hash12(cell + 13.1))) * u_starCell;
    float d = length(cssPx - position);
    float brightness = hash12(cell + 3.7);
    float twinkle = 0.85 + 0.15 * sin(u_time * (2.0 + 3.0 * brightness) + presence * 400.0);
    vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.75, 0.85, 1.0), hash12(cell + 29.0));
    return tint * exp(-d * d / 0.6) * (0.25 + 0.75 * brightness * brightness) * twinkle * (1.0 + flare);
  }

  // The title mask at a point of the title's own box, -1..1 on both axes; empty outside it
  float titleMask (vec2 local) {
    if (abs(local.x) > 1.0 || abs(local.y) > 1.0) return 0.0;
    return texture2D(u_title, local * 0.5 + 0.5).r;
  }

  // The glow around the letters, blurred into the sprite when it was drawn; fades out at the box's
  // edge so a wide glow is never cut off
  float titleGlow (vec2 local) {
    vec2 edge = smoothstep(vec2(1.0), vec2(0.85), abs(local));
    return texture2D(u_title, clamp(local, -1.0, 1.0) * 0.5 + 0.5).g * edge.x * edge.y;
  }

  // Leaves everything below 0.8 untouched and rolls highlights off smoothly instead of clipping
  vec3 softKnee (vec3 x) {
    vec3 over = max(x - 0.8, 0.0);
    return min(x, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  }

  // The particle scene; rays that leave the screen reflect off its edge instead of smearing the edge pixels
  vec3 scene (vec2 px) {
    return texture2D(u_image, 1.0 - abs(1.0 - mod(px / u_resolution, 2.0))).rgb;
  }

  void main () {
    // Where this pixel is on the screen, and where the zoomed and jolted camera looks through it
    vec2 screen = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 frag = u_center + (screen - u_center) / u_cameraZoom + u_shake;
    vec2 offset = frag - u_hole;
    float dist = length(offset);
    vec2 samplePx = frag;

    // Gravitational wave from the ringdown: a quadrupole ripple that stretches space as it passes
    vec2 fromCenter = frag - u_center;
    float centerDist = length(fromCenter);
    if (u_gravityWaveAmplitude > 0.0) {
      float x = (centerDist - u_gravityWaveRadius) / u_gravityWaveWidth;
      float angle = atan(fromCenter.y, fromCenter.x);
      samplePx += fromCenter / max(centerDist, 0.0001) * u_gravityWaveAmplitude * exp(-x * x) * sin(x * u_gravityWaveCycles) * cos(2.0 * angle);
    }

    // The lens maps the background behind the hole into a ring of radius E, where the pull (E / r)^2
    // is 1. Falloff pivots around
    // u_falloffPivot: closer than that a higher power pulls harder. With the pivot a screen away the
    // lens and its dark zone grow with falloff; with the pivot at the ring only their shape changes
    float bend = 0.0;
    if (u_einstein > 0.0) {
      float ratio = u_einstein / max(dist, 0.0001);
      bend = ratio * ratio;
      if (u_falloff != 2.0) bend *= pow(u_falloffPivot / max(dist, 0.0001), u_falloff - 2.0);
      bend = min(bend, u_maxBend);
      if (bend * dist * (1.0 + abs(u_swirl)) > 0.01) {
        // The original canvas scaled the picture around the hole by the cosine of the pull: a bubble whose
        // distortion dies off with the cube of the distance, rippling into nested rings inside the ring.
        // A point mass, r * (1 - pull), bends rays far across the screen instead. u_lensReach blends the
        // two; both are zero at the ring, so the ring stays where it is
        float wave = cos(0.5 * PI * bend);
        float radial = bend <= 1.0 ? mix(wave, 1.0 - bend, u_lensReach) : wave * mix(1.0, 2.0 / PI, u_lensReach);
        vec2 lensed = (samplePx - u_hole) * radial;
        // Every ray at the ring comes from the single point right behind the hole, which would smear a
        // few pixels into a flat milky band. Rays stop short of that point, so the ring shows real detail
        float sourceRadius = length(lensed);
        float lensCore = u_lensCore * u_einstein;
        lensed *= sqrt(sourceRadius * sourceRadius + lensCore * lensCore) / max(sourceRadius, 0.0001);
        // The pull at the shadow's edge grows with the square of the lens radius. The twist follows it
        // only up to a limit, so a wider lens is a bigger bubble, not a tighter spiral
        float twist = u_swirl * min(bend, u_twistLimit);
        float c = cos(twist);
        float s = sin(twist);
        samplePx = u_hole + vec2(c * lensed.x - s * lensed.y, s * lensed.x + c * lensed.y);
      }
    }

    // Where the bent ray comes from, measured from the explosion
    vec2 sourceOffset = samplePx - u_center;
    float sourceDist = length(sourceOffset);

    // The dust is read before the matter front bends the view, so the front does not smear it
    vec2 dustPx = samplePx / u_pixelRatio;

    // The matter front refracts what lies under it
    if (u_waveStrength > 0.0) {
      float front = (sourceDist - u_waveRadius) / u_waveWidth;
      samplePx -= sourceOffset / max(sourceDist, 0.0001) * u_waveStrength * front * exp(-front * front);
    }

    vec3 color = scene(samplePx);
    if (u_lensFringe > 0.0) {
      // A simple lens bends red less and blue more, and more so away from the middle of the frame
      vec2 split = (screen - 0.5 * u_resolution) / (0.5 * length(u_resolution)) * u_lensFringe;
      color.r = scene(samplePx - split).r;
      color.b = scene(samplePx + split).b;
    }

    // Seconds since the light front passed this point; negative before it arrives
    float lit = u_lightSpeed > 0.0 ? (u_lightRadius - sourceDist) / u_lightSpeed : -1.0;

    vec2 cssPx = samplePx / u_pixelRatio;
    vec3 emitted = vec3(0.0);

    // The title is a cloud of dust shaped like the words, behind the black hole, so it is read through
    // the same bent rays as the stars. It stays dark until the light front reaches it, flashes as the
    // front passes, cools to a warm glow, then crumbles and drifts towards the hole
    if (u_titleAlpha > 0.0) {
      vec2 titlePx = samplePx;
      float keep = 1.0;
      // How far into its fall this grain is; reddens it
      float infall = 0.0;
      // Each grain of dust is a cell of about two CSS pixels with its own random speed and lifetime
      vec2 grainCell = floor(cssPx / 2.0);
      if (u_titleDissolve > 0.0) {
        // The dust obeys the black hole it falls into. Its gravity sets how far a grain travels (and
        // pushes it away when negative), the orbital force turns it around the hole, dust beyond the
        // reach of gravity crumbles last and barely moves, and what crosses the radius of no return
        // is gone. A grain shows the letter from further back the faster it moves, so the words
        // stream towards the hole as separate specks
        vec2 fromHole = samplePx - u_hole;
        float holeDist = max(length(fromHole), 1.0);
        float beyondReach = u_titleReach > 0.0 ? smoothstep(u_titleReach, 2.0 * u_titleReach, holeDist) : 1.0;
        float speed = mix(0.5, hash12(grainCell + 41.0), u_titleGrain);
        float fall = u_titleDissolve * u_titleDissolve * (0.2 + 1.6 * speed) * mix(1.0, 0.15, beyondReach);
        float turn = u_titleSwirl * fall;
        float c = cos(turn);
        float s = sin(turn);
        float stretch = max(1.0 + u_titleDrift * u_titlePull * fall / holeDist, 0.0);
        titlePx = u_hole + vec2(c * fromHole.x - s * fromHole.y, s * fromHole.x + c * fromHole.y) * stretch;
        // Each speck winks out at its own moment, the ones nearest the hole first
        // Without grain the letters stay whole until the hole has them
        float lifetime = mix(1.0, mix(hash12(grainCell + 73.0), 0.35 + 0.65 * beyondReach, 0.3), u_titleGrain);
        keep = smoothstep(u_titleDissolve - 0.15, u_titleDissolve, lifetime * 0.85);
        if (u_titleCapture > 0.0) keep *= smoothstep(u_titleCapture, u_titleCapture * 1.25 + 1.0, holeDist);
        infall = min(fall, 1.0);
      }
      vec2 local = (titlePx - u_titleCenter) / (u_titleHalfSize * u_titleScale);
      if (abs(local.x) <= 1.0 && abs(local.y) <= 1.0) {
        // A lens splits colours towards the edge of the frame: red is read a little closer to the
        // title's centre and blue a little further out
        float fringe = u_titleFringe / max(u_titleHalfSize.x, 1.0);
        vec3 mask = vec3(titleMask(local * (1.0 - fringe)), titleMask(local), titleMask(local * (1.0 + fringe)));
        float grain = 0.55 * valueNoise(cssPx / 2.4) + 0.45 * hash12(grainCell + 7.0);
        // Fire eats the letters from the ends of the title inwards along a ragged edge, which glows
        float burnRim = 0.0;
        if (u_titleBurn > 0.0) {
          float fuel = mix(0.6 * valueNoise(cssPx / 18.0) + 0.4 * valueNoise(cssPx / 5.0), 1.0 - abs(local.x), 0.45);
          float burnt = u_titleBurn * 1.15;
          keep *= smoothstep(burnt - 0.06, burnt, fuel);
          burnRim = 1.0 - smoothstep(burnt, burnt + 0.1, fuel);
        }
        vec3 density = mask * keep * mix(1.0, smoothstep(0.15, 0.8, grain), u_titleDust);
        // Glow around the letters, drawn out sideways like the flare of an anamorphic lens
        float halo = u_titleHalo > 0.0 ? TITLE_HALO_GAIN * titleGlow(local) * u_titleHalo * (1.0 - u_titleDissolve) : 0.0;
        // The front arrives over its own width rather than as a hard edge
        float arrived = smoothstep(-u_lightWidth, u_lightWidth, u_lightRadius - sourceDist);
        float shown = mix(1.0, arrived, u_titleReveal);
        float flash = lit >= 0.0 ? u_titleReveal * exp(-lit / u_titleCooling) : 0.0;
        // Dust falling into the hole reddens and dims, as the collapsing core did
        vec3 warm = mix(u_colorTitle, u_colorEmber, u_titleRedshift * infall) * (1.0 - 0.5 * u_titleRedshift * infall);
        vec3 light = warm * u_titleGlow * shown + u_colorLight * u_titleFlash * flash;
        light = mix(light, u_colorEmber * 2.5, burnRim);
        emitted += u_titleAlpha * (density + halo * (1.0 - u_titleBurn)) * light;
      }
    }
    if (u_backgroundStars > 0.0) {
      // The flare belongs to the light front, not to the dust echo, so hiding the echo keeps it
      float flare = u_lightPower > 0.0 && lit >= 0.0 ? u_starFlare * exp(-lit / STAR_FLARE_DECAY) : 0.0;
      emitted += backgroundStar(cssPx, flare) * u_backgroundStars;
    }
    // Light is invisible in empty space: the front shows where it strikes dust, and the dust
    // keeps glowing for a moment after it passes (the light echo)
    float shell = (sourceDist - u_lightRadius) / u_lightWidth;
    float front = u_lightPower > 0.0 ? exp(-shell * shell) : 0.0;
    // The thickest cloud holds its light this many times longer than the afterglow setting
    float longestHold = u_echoPower > 0.0 && lit >= 0.0 ? exp(-lit / (DUST_HOLD_MAX * u_echoDecay)) : 0.0;
    if (front > 0.001 || longestHold > 0.001) {
      // The dust is never still: it drifts slowly all the time, and the blast pushes it outward once
      // the front has passed, quickly at first and then easing off
      vec2 dustAt = dustPx + u_dustDrift * u_time * vec2(0.8, -0.6);
      if (lit > 0.0) dustAt -= sourceOffset / max(sourceDist, 0.0001) * u_dustBlow * (1.0 - exp(-lit / DUST_BLOW_SECONDS));
      // Light lights the dust and the ejected matter, which follows more slowly, sweeps it away
      float swept = mix(1.0, smoothstep(u_waveRadius - u_waveWidth, u_waveRadius + u_waveWidth, sourceDist), u_dustSweep);
      float density = dust(dustAt) * swept;
      emitted += u_colorLight * u_lightPower * front * (1.0 - u_lightDustContrast + u_lightDustContrast * density);
      // The glow swells over a moment instead of switching on, and it does not go out all at once:
      // thin haze lets its light go quickly while thick cloud holds it, so the dust goes dark patch
      // by patch
      float glow = 0.0;
      if (u_echoPower > 0.0 && lit >= 0.0) {
        float hold = u_echoDecay * mix(DUST_HOLD_MIN, DUST_HOLD_MAX, density);
        glow = (1.0 - exp(-lit / (0.15 * u_echoDecay + 0.02))) * exp(-lit / hold);
      }
      // Dust the front has just struck still shines with the front's colour and cools to its own
      vec3 echoColor = mix(u_colorDust, u_colorLight, glow * glow);
      emitted += echoColor * u_echoPower * glow * density / (1.0 + sourceDist / (0.5 * u_resolution.x));
    }
    if (u_remnantGlow > 0.0) {
      // White-hot, then the ember colour, then the same colour deep and dark
      vec3 remnantColor = mix(mix(u_colorFlash, mix(u_colorEmber, u_colorFlash, 0.25), smoothstep(0.0, 0.5, u_remnantRedshift)),
        0.6 * u_colorEmber * u_colorEmber, smoothstep(0.5, 1.0, u_remnantRedshift));
      emitted += remnantColor * u_remnantGlow * (1.0 - 0.7 * u_remnantRedshift) * exp(-(centerDist * centerDist) / (2.0 * u_remnantRadius * u_remnantRadius));
    }
    color = (color + emitted) * u_exposure;

    // Light is lost in proportion to the lens's pull. Subtracting takes faint light first, so a dark
    // zone opens around the shadow and grows with absorption, lens radius and falloff
    if (bend > 0.0 && u_absorption > 0.0) color = max(color - 0.5 * bend * u_absorption, 0.0);

    if (u_horizon > 0.0) {
      color *= smoothstep(u_horizon - 1.0, u_horizon + 1.0, dist);

      // Photon ring: light that circled the hole before escaping, a hair-thin line hugging the shadow
      if (u_ring > 0.0 && dist < u_horizon * 1.6) {
        float ringLine = max(u_ringWidth * u_horizon, 1.5);
        float edge = dist - u_horizon;
        float inner = (edge - 0.7 * ringLine) / (0.45 * ringLine);
        float line = exp(-inner * inner);

        // The ring burns brighter where the simulation drops matter into the hole
        float ringAngle = atan(offset.y, offset.x);
        float infall = texture2D(u_ringEnergy, vec2((ringAngle - u_ringPhase) / (2.0 * PI), 0.5)).r;
        line *= u_ringBase + u_ringFeed * infall;

        // Doppler beaming: light moving towards the viewer is brighter and bluer, the far side dimmer and redder
        float side = cos(ringAngle - u_ringSide);
        // Scaled so the bright side peaks at the ring's brightness: clipping to white would thicken the line
        float boost = (1.0 + 0.5 * u_ringDoppler * side) / (1.0 + 0.5 * u_ringDoppler);
        vec3 tint = mix(RING_COLOR, side > 0.0 ? RING_APPROACHING : RING_RECEDING, abs(side) * u_ringDoppler);
        color += tint * u_ring * boost * boost * boost * line;
      }
    }

    // Light from the source itself reaches the camera directly: the progenitor and the blast glare
    if (u_starGlow > 0.0) {
      color += u_colorFlash * u_starGlow * exp(-(centerDist * centerDist) / (2.0 * u_starRadius * u_starRadius));
    }
    if (u_sourcePower > 0.0) {
      float glare = u_glareRadius * u_glareRadius / (u_glareRadius * u_glareRadius + centerDist * centerDist);
      color += u_colorFlash * u_sourcePower * u_exposure * glare;
    }

    // The film: dark corners, grain that changes every frame, and bars at the top and the bottom
    if (u_vignette > 0.0) {
      color *= 1.0 - u_vignette * smoothstep(0.45, 1.45, length(screen / u_resolution * 2.0 - 1.0));
    }
    if (u_filmGrain > 0.0) {
      color = max(color + (hash12(screen + fract(u_time) * vec2(917.0, 613.0)) - 0.5) * u_filmGrain, 0.0);
    }
    color = softKnee(color);
    if (u_letterbox > 0.0) {
      color *= smoothstep(u_letterbox - 1.0, u_letterbox + 1.0, min(screen.y, u_resolution.y - screen.y));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

function createShader (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader
  }

  console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

// Compiles and links a program with fixed attribute locations; shader objects are released after linking
export function createProgram (
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributes: Record<string, number>
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = vertexShader && fragmentShader ? gl.createProgram() : null

  if (program && vertexShader && fragmentShader) {
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    for (const [name, location] of Object.entries(attributes)) {
      gl.bindAttribLocation(program, location, name)
    }
    gl.linkProgram(program)
    gl.detachShader(program, vertexShader)
    gl.detachShader(program, fragmentShader)
  }

  if (vertexShader) gl.deleteShader(vertexShader)
  if (fragmentShader) gl.deleteShader(fragmentShader)
  if (!program) return null

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program
  }

  console.error('Program linking error:', gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
  return null
}
