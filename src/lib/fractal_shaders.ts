// The Mandelbrot zoom's one shader. A pixel is never computed from its own coordinate, which at depth needs
// hundreds of digits: it is the target's orbit Z, read from a texture, plus the pixel's offset from it δ,
// which follows δ' = 2Zδ + δ² + δc in single floats (perturbation). At depth δ is far below what a float
// can hold, so it is kept as a mantissa and an exponent of its own (δ = m · 2^e), and so is dz/dc for the
// distance estimate. When the pixel's orbit comes nearer to 0 than to the reference, or the reference ends,
// the pixel starts over on the reference's first step with its whole value as δ (rebasing, after Zhuoran),
// which keeps a single reference free of glitches. A Misiurewicz target's orbit loops on its cycle.
// GLSL ES 3.00: the loop runs as many steps as the frame needs, and the orbit is fetched by index.

export const FRACTAL_MAX_STOPS = 12
// Entries of the orbit texture in one row; the index is split into a row and a column by bits
export const ORBIT_ROW_BITS = 12

export const FRACTAL_VERTEX = `#version 300 es
in vec2 a_position;
void main () {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const FRACTAL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_orbit;
uniform int u_orbitLength;
uniform int u_loopFrom;
uniform int u_maxIter;
uniform vec2 u_size;
// The view's angle as cos, sin
uniform vec2 u_turn;
// Plane units a pixel spans: u_pixelMant · 2^u_pixelExp
uniform float u_pixelMant;
uniform float u_pixelExp;
// The target in plain floats, for the cardioid and bulb test of the shallow frames
uniform vec2 u_center;
uniform int u_samples;
uniform vec3 u_stops[${FRACTAL_MAX_STOPS}];
uniform int u_stopCount;
uniform float u_cycle;
uniform float u_phase;
uniform vec3 u_inside;
uniform float u_edge;
uniform float u_glow;

out vec4 outColor;

const int ROW_BITS = ${ORBIT_ROW_BITS};
const int ROW_MASK = ${(1 << ORBIT_ROW_BITS) - 1};
// |z| past 2^8: far enough out for a smooth count and a steady distance estimate
const float BAILOUT2 = 65536.0;

vec2 cmul (vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec4 orbitAt (int index) {
  return texelFetch(u_orbit, ivec2(index & ROW_MASK, index >> ROW_BITS), 0);
}

// The smooth escape count and the distance to the set in pixels; a count below 0 is inside
vec2 trace (vec2 pixel) {
  vec2 dc = vec2(u_turn.x * pixel.x - u_turn.y * pixel.y, u_turn.y * pixel.x + u_turn.x * pixel.y) * u_pixelMant;
  float ec = u_pixelExp;
  float size = max(abs(dc.x), abs(dc.y));
  if (size == 0.0) return vec2(-1.0, 0.0);
  float shift = floor(log2(size));
  dc *= exp2(-shift);
  ec += shift;

  // A shallow frame skips the main cardioid and the period-2 bulb, where every step would be spent
  if (ec > -20.0) {
    vec2 c = u_center + dc * exp2(ec);
    float x = c.x - 0.25;
    float q = x * x + c.y * c.y;
    if (q * (q + x) < 0.25 * c.y * c.y) return vec2(-1.0, 0.0);
    if ((c.x + 1.0) * (c.x + 1.0) + c.y * c.y < 0.0625) return vec2(-1.0, 0.0);
  }

  // δ = m · 2^e, with 2^e and 2^(ec - e) kept while e stays
  vec2 m = vec2(0.0);
  float e = ec;
  float s1 = exp2(e);
  float s2 = 1.0;
  // dz/dc = dm · 2^de, with 2^-de kept
  vec2 dm = vec2(0.0);
  float de = 0.0;
  float ds = 1.0;
  vec4 Z = vec4(0.0);
  int ref = 0;

  for (int n = 0; n < u_maxIter; n++) {
    vec2 z = (Z.xy + m * s1) + Z.zw;
    dm = 2.0 * cmul(z, dm) + vec2(ds, 0.0);
    float dsize = max(abs(dm.x), abs(dm.y));
    if (dsize > 65536.0) {
      float k = floor(log2(dsize));
      dm *= exp2(-k);
      de += k;
      ds = exp2(-de);
    }

    if (ref == 0) {
      // Z is 0 here, so δ' = δ² + δc, and either may be the larger: each gets its own exponent
      float e2 = 2.0 * e;
      float top = max(e2, ec);
      m = cmul(m, m) * exp2(e2 - top) + dc * exp2(ec - top);
      e = top;
    } else {
      m = 2.0 * cmul(Z.xy + Z.zw, m) + cmul(m, m) * s1 + dc * s2;
    }
    float msize = max(abs(m.x), abs(m.y));
    if (msize > 16.0 || msize < 0.0625 || ref == 0) {
      if (msize > 0.0) {
        float k = floor(log2(msize));
        m *= exp2(-k);
        e += k;
      }
      s1 = exp2(e);
      s2 = exp2(ec - e);
    }

    ref++;
    if (ref == u_orbitLength) ref = max(u_loopFrom, 0);
    Z = orbitAt(ref);
    vec2 d = m * s1;
    z = (Z.xy + d) + Z.zw;
    float zz = dot(z, z);
    if (zz > BAILOUT2) {
      float r = sqrt(zz);
      float nu = float(n) + 2.0 - log2(log2(r));
      // |z| ln|z| / |dz/dc|, in pixels
      float distance = r * log(r) / (length(dm) * u_pixelMant) * exp2(-de - u_pixelExp);
      return vec2(nu, distance);
    }
    if (zz < dot(d, d) || (u_loopFrom < 0 && ref == u_orbitLength - 1)) {
      m = z;
      e = 0.0;
      float k = floor(log2(max(max(abs(m.x), abs(m.y)), 1e-37)));
      m *= exp2(-k);
      e = k;
      s1 = exp2(e);
      s2 = exp2(ec - e);
      ref = 0;
      Z = vec4(0.0);
    }
  }
  return vec2(-1.0, 0.0);
}

vec3 palette (float t) {
  float place = fract(t) * float(u_stopCount);
  int index = int(place);
  float blend = smoothstep(0.0, 1.0, place - float(index));
  int next = index + 1 == u_stopCount ? 0 : index + 1;
  return mix(u_stops[index], u_stops[next], blend);
}

vec3 shade (vec2 traced) {
  if (traced.x < 0.0) return u_inside;
  vec3 color = palette(traced.x / u_cycle + u_phase);
  // Within a pixel or two of the set the colour goes dark, so its filaments are drawn as lines
  float near = exp(-2.0 * traced.y);
  color *= 1.0 - u_edge * near;
  // and a glow lifts what lies close to it
  color += u_glow * (1.0 - near) * exp(-0.15 * traced.y);
  return color;
}

void main () {
  vec2 pixel = gl_FragCoord.xy - 0.5 * u_size;
  vec3 color = vec3(0.0);
  float step = 1.0 / float(u_samples);
  for (int sy = 0; sy < u_samples; sy++) {
    for (int sx = 0; sx < u_samples; sx++) {
      vec2 offset = (vec2(float(sx), float(sy)) + 0.5) * step - 0.5;
      color += shade(trace(pixel + offset));
    }
  }
  outColor = vec4(color * step * step, 1.0);
}
`
