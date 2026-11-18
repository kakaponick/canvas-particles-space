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

  varying vec2 v_ends;        // distance along the segment from its start and from its end
  varying float v_across;     // signed distance from the segment axis
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;
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

    float along = mix(-extent, len + extent, a_position.x * 0.5 + 0.5);
    float across = a_position.y * extent;
    vec2 pixel = start + direction * along + normal * across;

    // Exact area of the requested round-capped line versus the area the anti-aliased capsule covers
    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    // Relativistic aberration, stylised: light ahead shifts blue, light at the edges shifts red
    float radial = length(a_segment.zw - u_center) / max(length(u_center), 1.0);
    float shift = u_doppler * (1.0 - 1.7 * radial);
    vec3 tint = shift > 0.0 ? BLUESHIFT : REDSHIFT;

    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(mix(a_color.rgb, tint, min(abs(shift), 0.8)), a_style.y * targetArea / drawnArea);

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
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float dist = length(vec2(beyondEnds, v_across));
    float coverage = clamp(v_halfWidth + 0.5 - dist, 0.0, 1.0);
    gl_FragColor = vec4(v_color.rgb, v_color.a * coverage);
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

  const float PI = 3.14159265359;
  // Closest a bent ray gets to the point behind the hole, in Einstein radii
  const float LENS_CORE = 0.3;
  const vec3 RING_COLOR = vec3(1.0, 0.86, 0.66);
  const vec3 RING_APPROACHING = vec3(0.8, 0.9, 1.0);
  const vec3 RING_RECEDING = vec3(1.0, 0.42, 0.16);
  const vec3 FLASH_COLOR = vec3(1.0, 0.97, 0.92);
  const vec3 TITLE_COLOR = vec3(1.0, 0.9, 0.78);
  const vec3 BLAST_COLOR = vec3(0.86, 0.92, 1.0);
  const vec3 DUST_COLOR = vec3(1.0, 0.84, 0.66);
  // Seconds a background star stays flared after the light front passes it
  const float STAR_FLARE_DECAY = 0.18;

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

  // Thin filaments: the ridge where rotated octaves of noise cross their midpoint
  float dust (vec2 cssPx) {
    vec2 p = cssPx / u_dustScale;
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float n = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      n += amplitude * valueNoise(p);
      p = turn * p * 2.1 + 11.7;
      amplitude *= 0.5;
    }
    float ridge = smoothstep(u_dustThreshold, 1.0, 1.0 - abs(2.0 * n - 0.94));
    return ridge * ridge;
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

  // Leaves everything below 0.8 untouched and rolls highlights off smoothly instead of clipping
  vec3 softKnee (vec3 x) {
    vec3 over = max(x - 0.8, 0.0);
    return min(x, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  }

  void main () {
    vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
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

    // Point-mass lens: a ray passing at distance r arrives from r * (1 - (E / r)^2), which maps the
    // background behind the hole into a ring of radius E. Falloff pivots around a distance of one
    // screen: inside it a higher power pulls harder, so the lens and its dark zone grow with falloff
    float bend = 0.0;
    if (u_einstein > 0.0) {
      float ratio = u_einstein / max(dist, 0.0001);
      bend = ratio * ratio;
      if (u_falloff != 2.0) bend *= pow(min(u_resolution.x, u_resolution.y) / max(dist, 0.0001), u_falloff - 2.0);
      bend = min(bend, 64.0);
      if (bend * dist * (1.0 + u_swirl) > 0.01) {
        // Outside the ring the point-mass law; inside it the image ripples into nested rings and stays
        // within reach of the screen. The two laws meet at the ring with the same value and slope
        float radial = bend <= 1.0 ? 1.0 - bend : 2.0 / PI * cos(0.5 * PI * bend);
        vec2 lensed = (samplePx - u_hole) * radial;
        // Every ray at the ring comes from the single point right behind the hole, which would smear a
        // few pixels into a flat milky band. Rays stop short of that point, so the ring shows real detail
        float sourceRadius = length(lensed);
        float lensCore = LENS_CORE * u_einstein;
        lensed *= sqrt(sourceRadius * sourceRadius + lensCore * lensCore) / max(sourceRadius, 0.0001);
        float twist = u_swirl * bend;
        float c = cos(twist);
        float s = sin(twist);
        samplePx = u_hole + vec2(c * lensed.x - s * lensed.y, s * lensed.x + c * lensed.y);
      }
    }

    // Where the bent ray comes from, measured from the explosion
    vec2 sourceOffset = samplePx - u_center;
    float sourceDist = length(sourceOffset);

    // The matter front refracts what lies under it
    if (u_waveStrength > 0.0) {
      float front = (sourceDist - u_waveRadius) / u_waveWidth;
      samplePx -= sourceOffset / max(sourceDist, 0.0001) * u_waveStrength * front * exp(-front * front);
    }

    // Rays that still leave the screen reflect off its edge instead of smearing the edge pixels
    vec3 color = texture2D(u_image, 1.0 - abs(1.0 - mod(samplePx / u_resolution, 2.0))).rgb;

    // Seconds since the light front passed this point; negative before it arrives
    float lit = u_lightSpeed > 0.0 ? (u_lightRadius - sourceDist) / u_lightSpeed : -1.0;
    float echo = lit >= 0.0 ? exp(-lit / u_echoDecay) : 0.0;

    vec2 cssPx = samplePx / u_pixelRatio;
    vec3 emitted = vec3(0.0);

    // The title is a cloud of dust shaped like the words, behind the black hole, so it is read through
    // the same bent rays as the stars. It stays dark until the light front reaches it, flashes as the
    // front passes, cools to a warm glow, then crumbles and drifts towards the hole
    if (u_titleAlpha > 0.0) {
      vec2 titlePx = samplePx;
      float keep = 1.0;
      // Each grain of dust is a cell of about two CSS pixels with its own random speed and lifetime
      vec2 grainCell = floor(cssPx / 2.0);
      if (u_titleDissolve > 0.0) {
        // A grain shows the letter from further back the faster it moves, so the words stream
        // towards the hole as separate specks, and each speck winks out at its own moment
        vec2 toHole = u_hole - samplePx;
        float speed = hash12(grainCell + 41.0);
        titlePx -= toHole / max(length(toHole), 1.0) * u_titleDrift * u_titleDissolve * u_titleDissolve * (0.2 + 1.6 * speed);
        float lifetime = hash12(grainCell + 73.0);
        keep = smoothstep(u_titleDissolve - 0.15, u_titleDissolve, lifetime * 0.85);
      }
      vec2 local = (titlePx - u_titleCenter) / u_titleHalfSize;
      if (abs(local.x) <= 1.0 && abs(local.y) <= 1.0) {
        float mask = texture2D(u_title, local * 0.5 + 0.5).a;
        float grain = 0.55 * valueNoise(cssPx / 2.4) + 0.45 * hash12(grainCell + 7.0);
        float density = mask * keep * mix(1.0, smoothstep(0.15, 0.8, grain), u_titleDust);
        // The front arrives over its own width rather than as a hard edge
        float arrived = smoothstep(-u_lightWidth, u_lightWidth, u_lightRadius - sourceDist);
        float shown = mix(1.0, arrived, u_titleReveal);
        float flash = lit >= 0.0 ? u_titleReveal * exp(-lit / u_titleCooling) : 0.0;
        emitted += density * u_titleAlpha * (TITLE_COLOR * u_titleGlow * shown + BLAST_COLOR * u_titleFlash * flash);
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
    float echoGlow = u_echoPower > 0.0 ? echo : 0.0;
    if (front > 0.001 || echoGlow > 0.001) {
      float density = dust(cssPx);
      emitted += BLAST_COLOR * u_lightPower * front * (1.0 - u_lightDustContrast + u_lightDustContrast * density);
      emitted += DUST_COLOR * u_echoPower * echoGlow * density / (1.0 + sourceDist / (0.5 * u_resolution.x));
    }
    if (u_remnantGlow > 0.0) {
      vec3 remnantColor = mix(mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.55, 0.2), smoothstep(0.0, 0.5, u_remnantRedshift)),
        vec3(0.6, 0.05, 0.02), smoothstep(0.5, 1.0, u_remnantRedshift));
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
      color += FLASH_COLOR * u_starGlow * exp(-(centerDist * centerDist) / (2.0 * u_starRadius * u_starRadius));
    }
    if (u_sourcePower > 0.0) {
      float glare = u_glareRadius * u_glareRadius / (u_glareRadius * u_glareRadius + centerDist * centerDist);
      color += FLASH_COLOR * u_sourcePower * u_exposure * glare;
    }

    gl_FragColor = vec4(softKnee(color), 1.0);
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
