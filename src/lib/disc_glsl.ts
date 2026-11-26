// The traced disc, for the composite shader: discRay and discRadius of disc_trace.ts in GLSL ES 1.00, the
// same steps under the same names, so one is checked against the other. What each step is and why it is
// written the way it is, is told there; the comments here say only what the GPU adds.
//
// It is pasted into the composite fragment shader after KERR_GLSL, whose kerrSin and kerrCos (series, good
// to float precision within a quarter turn) it takes in place of the GPU's own sin and cos, and which already
// has PI, CRITICAL_IMPACT and carlsonRF. Every loop has a fixed count: DISC_MEANS steps of the chain of means,
// DISC_CROSSINGS crossings.
import { DISC_CLOSEST_ORBIT, DISC_CROSSINGS, DISC_MEANS } from './disc_trace'

export const DISC_GLSL = `
  const int DISC_MEANS = ${DISC_MEANS};
  const int DISC_CROSSINGS = ${DISC_CROSSINGS};
  const float DISC_CLOSEST_ORBIT = ${DISC_CLOSEST_ORBIT};

  // sn and cn of any argument, from the chain of means: whole half periods come off it first
  vec2 discJacobi (float t, float meanA[DISC_MEANS], float meanB[DISC_MEANS], float meanEnd) {
    float halfPeriod = PI / meanEnd;
    float halves = floor(t / halfPeriod + 0.5);
    float angle = meanEnd * (t - halfPeriod * halves);
    float sine = kerrSin(angle);
    float side = sine < 0.0 ? -1.0 : 1.0;
    float a = kerrCos(angle) / (side * max(abs(sine), 1e-20));
    float c = meanEnd * a;
    float dn = 1.0;
    for (int i = DISC_MEANS - 1; i >= 0; i--) {
      float b = meanA[i];
      a *= c;
      c *= dn;
      dn = (meanB[i] + a) / (b + a);
      a = c / b;
    }
    float sn = side / sqrt(c * c + 1.0);
    return vec2(sn, c * sn) * (mod(halves, 2.0) < 0.5 ? 1.0 : -1.0);
  }

  // The radii, in Schwarzschild radii, at which the ray that leaves the camera at "slope" (tan(theta / 2)
  // from the direction of the hole) crosses the equator, at phi0 and each half turn after it, and in "there"
  // 1 where it still is there (discRadius's 0 is 0 there). "u" is 1 / the camera's distance; "b" comes back
  // as the ray's impact parameter
  vec3 discRadii (float slope, float u, float phi0, out float b, out vec3 there) {
    float sine = 2.0 * slope / (1.0 + slope * slope);
    bool inward = slope < 1.0;
    b = max(sine / (u * sqrt(1.0 - u)), 0.0001);
    bool turns = b > CRITICAL_IMPACT;
    float u1;
    float scale;
    float complement;
    // A ray that turns: gamma, the angle it comes nearest at and the angle it is gone at
    float rate = 0.0;
    float start = 0.0;
    float end = 0.0;
    float lift = 0.0;
    if (turns) {
      float angle = 2.0 * asin(CRITICAL_IMPACT / b);
      float sixth = sin(angle / 6.0);
      u1 = -4.0 / 3.0 * sin(PI / 3.0 - angle / 6.0) * sixth;
      float u2 = 4.0 / 3.0 * sin(PI / 3.0 + angle / 6.0) * sixth;
      float gap = 1.1547005 * sin(PI / 3.0 - angle / 3.0);
      scale = u2 - u1;
      float away = 2.0 * sqrt(u2) * carlsonRF(vec3(-u1 * gap, scale * gap, (gap + u2) * scale));
      float cotangent = (1.0 - slope * slope) / (2.0 * slope);
      float left = u * u * (1.0 - u) * cotangent * cotangent / ((u - u1) * (u2 + gap - u));
      float near = 2.0 * sqrt(left) * carlsonRF(vec3((u - u1) * gap, scale * gap, (gap + left) * scale));
      start = inward ? near : -near;
      end = start + away;
      rate = 0.5 * sqrt(gap + scale);
      complement = gap / (gap + scale);
    } else {
      float x = 13.5 / (b * b) - 1.0;
      float grown = pow(x + sqrt((13.5 / (b * b) - 2.0) * (x + 1.0)), 1.0 / 3.0);
      u1 = (1.0 - grown - 1.0 / grown) / 3.0;
      scale = sqrt(u1 * (3.0 * u1 - 2.0));
      lift = 0.5 * (1.0 - 3.0 * u1);
      complement = 0.25 * (1.0 - u1) * (-3.0 * u1 - 1.0) / (2.0 * scale * (scale + lift));
    }
    float meanA[DISC_MEANS];
    float meanB[DISC_MEANS];
    float a = 1.0;
    float c = 1.0;
    float k = complement;
    for (int i = 0; i < DISC_MEANS; i++) {
      meanA[i] = a;
      k = sqrt(k);
      meanB[i] = k;
      c = 0.5 * (a + k);
      k *= a;
      a = c;
    }
    float meanEnd = c;
    float quarter = 0.5 * PI / meanEnd;
    if (!turns) {
      // w at the camera, and the rate w runs at: sqrt(A), against phi as the ray goes in or climbs out
      float d = u - u1;
      float cosAm = (scale - d) / (scale + d);
      float sinAm = 2.0 * sqrt(scale * d) / (scale + d);
      float part = sinAm * carlsonRF(vec3(cosAm * cosAm, complement + (1.0 - complement) * cosAm * cosAm, 1.0));
      start = cosAm >= 0.0 ? part : 2.0 * quarter - part;
      end = 2.0 * quarter;
      rate = sqrt(scale) * (inward ? 1.0 : -1.0);
    }
    // The radius is worked out whether or not the ray is still there, and "there" says which it is: the map
    // is then read the same way by every pixel, so the GPU can tell how far apart its neighbours read it and
    // take the level of detail that fits
    vec3 radii = vec3(0.0);
    there = vec3(0.0);
    for (int i = 0; i < DISC_CROSSINGS; i++) {
      float phi = phi0 + float(i) * PI;
      float inverse;
      bool still;
      if (turns) {
        float sn = discJacobi(quarter - rate * (phi - start), meanA, meanB, meanEnd).x;
        inverse = u1 + scale * sn * sn;
        still = phi < end && inverse > 0.0;
      } else {
        float w = start + rate * phi;
        float cn = discJacobi(w, meanA, meanB, meanEnd).y;
        inverse = u1 + scale * (1.0 - cn) / max(1.0 + cn, 1e-20);
        still = w < end && w > 0.0 && (inward ? inverse <= 1.0 : inverse > 0.0);
      }
      radii[i] = 1.0 / max(inverse, 1e-6);
      there[i] = still ? 1.0 : 0.0;
    }
    return radii;
  }

  // The shift of light from matter on a circular orbit "r" Schwarzschild radii from the hole, for a photon of
  // angular momentum "l" about the orbit's axis (discShift)
  float discShift (float r, float l) {
    float radius = max(r, DISC_CLOSEST_ORBIT);
    return sqrt(1.0 - 1.5 / radius) / (1.0 - sqrt(0.5 / (radius * radius * radius)) * l);
  }
`
