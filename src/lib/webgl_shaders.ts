// WebGL shaders for the particle renderer: trail fade, particle segments and the lensing composite.
// Written in GLSL ES 1.00 so the same sources run on WebGL2 and on WebGL1 with ANGLE_instanced_arrays.

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
  attribute vec4 a_segment;   // x0, y0, x1, y1 in canvas pixels, top-left origin
  attribute vec2 a_style;     // line width in pixels, opacity
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;

  varying vec2 v_ends;        // distance along the segment from its start and from its end
  varying float v_across;     // signed distance from the segment axis
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;

  void main () {
    vec2 start = a_segment.xy;
    vec2 delta = a_segment.zw - start;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float width = a_style.x;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;

    float along = mix(-extent, len + extent, a_position.x * 0.5 + 0.5);
    float across = a_position.y * extent;
    vec2 pixel = start + direction * along + normal * across;

    // Exact area of the requested round-capped line versus the area the anti-aliased capsule covers
    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(a_color.rgb, a_style.y * targetArea / drawnArea);

    // Rows stay top-down in the scene texture, which is the layout the composite pass samples
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

export const particleFragmentShaderSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

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

  varying vec2 v_texCoord;

  void main () {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  }
`

export const compositeFragmentShaderSource = `
  precision mediump float;

  #define PI 3.14159265359

  uniform sampler2D u_image;
  varying vec2 v_texCoord;

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_mass;
  uniform float u_eventHorizon;
  uniform float u_active;
  uniform float u_rotationMultiplier;
  uniform float u_falloffPower;
  uniform float u_absorptionIntensity;

  vec2 rotate (vec2 mt, vec2 st, float angle, float rotationMult) {
    float cos_a = cos(angle * PI);
    float sin_a = sin(angle * PI * rotationMult);

    float nx = (cos_a * (st.x - mt.x)) + (sin_a * (st.y - mt.y)) + mt.x;
    float ny = (cos_a * (st.y - mt.y)) - (sin_a * (st.x - mt.x)) + mt.y;
    return vec2(nx, ny);
  }

  void main () {
    if (u_active < 0.5) {
      gl_FragColor = vec4(texture2D(u_image, v_texCoord).rgb, 1.0);
      return;
    }

    // Both coordinates in browser space (top-left origin)
    vec2 st = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution;
    vec2 mt = u_mouse / u_resolution;
    vec2 offset = st - mt;

    // Correct for aspect ratio so the effect stays circular
    float aspectRatio = u_resolution.x / u_resolution.y;
    float dist = sqrt(offset.x * offset.x + (offset.y * offset.y) / (aspectRatio * aspectRatio));

    float falloff = u_falloffPower == 2.0 ? dist * dist : pow(dist, u_falloffPower);
    float pull = u_mass / max(falloff, 0.0001);

    // Skip the rotation where it would move the sample by less than a hundredth of a pixel
    float angle = pull * PI;
    float reachPx = length(offset) * max(u_resolution.x, u_resolution.y);
    float maxShiftPx = reachPx * angle * (0.5 * angle + u_rotationMultiplier);
    vec2 sampleCoord = maxShiftPx > 0.01 ? rotate(mt, st, pull, u_rotationMultiplier) : st;

    vec3 imgcolor = texture2D(u_image, sampleCoord).rgb;

    // Event horizon: darken near the center
    float horizonDist = dist * u_resolution.x;
    float horizonFactor = smoothstep(u_eventHorizon * 0.5, u_eventHorizon * 2.0, horizonDist);

    gl_FragColor = vec4((imgcolor - pull * u_absorptionIntensity) * horizonFactor, 1.0);
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
