// WebGL shaders for the particle renderer: trail fade, particle segments and the black hole
// composite, which also lays the intro title behind the lens. Written in GLSL ES 1.00 so the same sources run on WebGL2 and on
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
  uniform vec2 u_hole;
  uniform float u_horizon;       // shadow radius; 0 before the black hole forms
  uniform float u_einstein;      // Einstein ring radius; 0 turns the lens off
  uniform float u_falloff;       // 2 is a point mass
  uniform float u_swirl;         // frame-dragging twist near the ring
  uniform float u_absorption;    // darkening halo around the shadow
  uniform float u_ring;          // photon ring brightness
  uniform float u_time;
  uniform float u_starGlow;      // the star that collapses in the intro
  uniform float u_starRadius;
  uniform float u_waveRadius;    // intro shockwave front
  uniform float u_waveStrength;  // refraction at the front, pixels
  uniform float u_waveWidth;
  uniform float u_flash;         // white-out, 0..1
  uniform vec2 u_titleCenter;
  uniform vec2 u_titleHalfSize;
  uniform vec2 u_titleRotation;  // cos, sin
  uniform float u_titleAlpha;

  const vec3 RING_COLOR = vec3(1.0, 0.86, 0.66);
  const vec3 FLASH_COLOR = vec3(1.0, 0.97, 0.92);
  const vec3 TITLE_COLOR = vec3(1.0, 0.95, 0.9);

  void main () {
    vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 offset = frag - u_hole;
    float dist = length(offset);
    vec2 direction = offset / max(dist, 0.0001);
    vec2 samplePx = frag;

    // Point-mass lens: a ray passing at distance r arrives from r * (1 - (E / r)^falloff),
    // which maps the background behind the hole into a ring of radius E
    if (u_einstein > 0.0) {
      float ratio = u_einstein / max(dist, 0.0001);
      float bend = min(u_falloff == 2.0 ? ratio * ratio : pow(ratio, u_falloff), 64.0);
      if (bend * dist * (1.0 + u_swirl) > 0.01) {
        vec2 lensed = offset * (1.0 - bend);
        float angle = u_swirl * bend;
        float c = cos(angle);
        float s = sin(angle);
        samplePx = u_hole + vec2(c * lensed.x - s * lensed.y, s * lensed.x + c * lensed.y);
      }
    }

    // The shockwave refracts what lies under its front
    float front = 0.0;
    if (u_waveStrength > 0.0) {
      front = (dist - u_waveRadius) / u_waveWidth;
      samplePx -= direction * u_waveStrength * front * exp(-front * front);
    }

    vec3 color = texture2D(u_image, samplePx / u_resolution).rgb;

    // The title sits behind the black hole, so it is read through the same bent rays as the stars
    if (u_titleAlpha > 0.0) {
      vec2 rel = samplePx - u_titleCenter;
      vec2 local = vec2(
        u_titleRotation.x * rel.x + u_titleRotation.y * rel.y,
        u_titleRotation.x * rel.y - u_titleRotation.y * rel.x
      ) / u_titleHalfSize;
      if (abs(local.x) <= 1.0 && abs(local.y) <= 1.0) {
        float mask = texture2D(u_title, local * 0.5 + 0.5).a;
        color = mix(color, TITLE_COLOR, mask * u_titleAlpha);
      }
    }

    if (u_horizon > 0.0) {
      float shadow = smoothstep(u_horizon - 1.0, u_horizon + 1.0, dist);
      float halo = clamp(1.0 - (dist - u_horizon) / (1.5 * u_horizon), 0.0, 1.0);
      color *= shadow * (1.0 - u_absorption * halo * halo);

      // Photon ring, brighter on the side whose light orbits toward the viewer
      float ringWidth = max(1.2, u_horizon * 0.035);
      float ringOffset = (dist - u_horizon * 1.03) / ringWidth;
      float beaming = 0.6 + 0.4 * cos(atan(offset.y, offset.x) - u_time * 0.5);
      color += RING_COLOR * u_ring * beaming * exp(-ringOffset * ringOffset);
    }

    if (u_starGlow > 0.0) {
      color += FLASH_COLOR * u_starGlow * exp(-(dist * dist) / (2.0 * u_starRadius * u_starRadius));
    }

    if (u_waveStrength > 0.0) {
      color += RING_COLOR * 0.012 * u_waveStrength * exp(-front * front);
    }

    gl_FragColor = vec4(mix(color, FLASH_COLOR, u_flash), 1.0);
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
