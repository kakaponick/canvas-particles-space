// The Ray Traced lens of a black hole that spins, for the composite shader: kerrRay of kerr_trace.ts in
// GLSL ES 1.00, the same steps under the same names, so one is debugged against the other. What each step is
// and why it is written the way it is, is told there; the comments here say only what the GPU adds.
//
// It is pasted into the composite fragment shader, which already has PI and carlsonRF. Every loop has a
// fixed count: seven duplications for each pair of Carlson integrals, four means for Jacobi's functions,
// 24 Runge-Kutta steps for a ray with no turning point.
//
// Float32 and the GPU's own asin, acos and atan (short polynomials, four digits) are what this guards against:
// - no inverse trigonometric function of the GPU is used: kerrAtan halves its argument twice and sums a
//   series, and the sines and cosines the roots and the final turn are built on are series as well;
// - the cubic's discriminant is a polynomial in which the leading terms have been cancelled on paper;
// - the smallest root of the cubic is taken from the product of the three, and every difference of two
//   roots of R from a product of sines (r43, r32, r42), never by subtraction;
// - the camera's distance from the turning point (d4) is R at the camera over the other three distances;
// - 1 - x^2, 1 - k x^2 and 1 - n x^2 of Legendre's forms are each written as a product;
// - sin^2 of the polar angle at the ends of its swing (low) is the small root of its own quadratic, and
//   the phase at the camera takes its sine or its cosine, whichever is the smaller, from an identity;
// - a whole number of half turns comes off the final angle with pi in two parts.
// What is left is the discriminant itself, which is zero on the shadow's edge and so loses its digits
// within about a thousandth of it.
export const KERR_GLSL = `
  float kerrAtan (float x) {
    bool flip = x > 1.0;
    float t = flip ? 1.0 / x : x;
    t = t / (1.0 + sqrt(1.0 + t * t));
    t = t / (1.0 + sqrt(1.0 + t * t));
    float t2 = t * t;
    float angle = 4.0 * t * (1.0 + t2 * (-1.0 / 3.0 + t2 * (0.2 + t2 * (-1.0 / 7.0 + t2 * (1.0 / 9.0 + t2 * (-1.0 / 11.0 + t2 / 13.0))))));
    return flip ? 0.5 * PI - angle : angle;
  }

  float kerrSin (float x) {
    float x2 = x * x;
    return x * (1.0 - x2 / 6.0 * (1.0 - x2 / 20.0 * (1.0 - x2 / 42.0 * (1.0 - x2 / 72.0 * (1.0 - x2 / 110.0 * (1.0 - x2 / 156.0 * (1.0 - x2 / 210.0)))))));
  }

  float kerrCos (float x) {
    float x2 = x * x;
    return 1.0 - x2 / 2.0 * (1.0 - x2 / 12.0 * (1.0 - x2 / 30.0 * (1.0 - x2 / 56.0 * (1.0 - x2 / 90.0 * (1.0 - x2 / 132.0 * (1.0 - x2 / 182.0 * (1.0 - x2 / 240.0)))))));
  }

  // Carlson's R_C(1, 1 + e)
  float kerrArc (float e) {
    if (abs(e) < 0.06) return 1.0 + e * (-1.0 / 3.0 + e * (0.2 + e * (-1.0 / 7.0 + e * (1.0 / 9.0 + e * (-1.0 / 11.0 + e / 13.0)))));
    if (e > 0.0) {
      float s = sqrt(e);
      return kerrAtan(s) / s;
    }
    float s = sqrt(-e);
    return 0.5 * log((1.0 + s) / max(1.0 - s, 1e-30)) / s;
  }

  float kerrTail (vec3 v, float p, float scale) {
    float mean = (v.x + v.y + v.z + 2.0 * p) / 5.0;
    vec3 d = 1.0 - v / mean;
    float dp = -0.5 * (d.x + d.y + d.z);
    float e2 = d.x * d.y + d.x * d.z + d.y * d.z - 3.0 * dp * dp;
    float xyz = d.x * d.y * d.z;
    float e3 = xyz + 2.0 * e2 * dp + 4.0 * dp * dp * dp;
    float e4 = (2.0 * xyz + e2 * dp + 3.0 * dp * dp * dp) * dp;
    float e5 = xyz * dp * dp;
    return scale * (1.0 - 3.0 * e2 / 14.0 + e3 / 6.0 + 9.0 * e2 * e2 / 88.0 - 3.0 * e4 / 22.0 - 9.0 * e2 * e3 / 52.0 + 3.0 * e5 / 26.0) / (mean * sqrt(mean));
  }

  // R_F(v), R_J(v, p) and R_J(v, q) from one run of the duplication
  vec3 kerrCarlson (vec3 v, float p, float q) {
    float deltaP = (p - v.x) * (p - v.y) * (p - v.z);
    float deltaQ = (q - v.x) * (q - v.y) * (q - v.z);
    float scale = 1.0;
    float sumP = 0.0;
    float sumQ = 0.0;
    for (int i = 0; i < 7; i++) {
      vec3 root = sqrt(v);
      float sp = sqrt(p);
      float sq = sqrt(q);
      float l = root.x * (root.y + root.z) + root.y * root.z;
      float dP = (sp + root.x) * (sp + root.y) * (sp + root.z);
      float dQ = (sq + root.x) * (sq + root.y) * (sq + root.z);
      float cube = scale * scale * scale;
      sumP += scale * kerrArc(cube * deltaP / (dP * dP)) / dP;
      sumQ += scale * kerrArc(cube * deltaQ / (dQ * dQ)) / dQ;
      v = 0.25 * (v + l);
      p = 0.25 * (p + l);
      q = 0.25 * (q + l);
      scale *= 0.25;
    }
    float a = (v.x + v.y + v.z) / 3.0;
    vec3 d = 1.0 - v / a;
    float e2 = d.x * d.y - d.z * d.z;
    float e3 = d.x * d.y * d.z;
    return vec3(
      (1.0 + (e2 / 24.0 - 0.1 - 3.0 * e3 / 44.0) * e2 + e3 / 14.0) / sqrt(a),
      kerrTail(v, p, scale) + 6.0 * sumP,
      kerrTail(v, q, scale) + 6.0 * sumQ
    );
  }

  // The chain of means for Jacobi's functions; returns the last, PI / 2 over the quarter period
  float kerrMeans (float complement, out vec4 meanA, out vec4 meanB) {
    float a = 1.0;
    float c = 1.0;
    for (int i = 0; i < 4; i++) {
      meanA[i] = a;
      complement = sqrt(complement);
      meanB[i] = complement;
      c = 0.5 * (a + complement);
      complement *= a;
      a = c;
    }
    return c;
  }

  // (sn, cn) for an argument within a quarter period of 0
  vec2 kerrJacobi (float t, vec4 meanA, vec4 meanB, float meanEnd) {
    float angle = meanEnd * t;
    float sine = kerrSin(angle);
    float side = sine < 0.0 ? -1.0 : 1.0;
    float a = kerrCos(angle) / (side * max(abs(sine), 1e-15));
    float c = meanEnd * a;
    float dn = 1.0;
    for (int i = 3; i >= 0; i--) {
      float b = meanA[i];
      a *= c;
      c *= dn;
      dn = (meanB[i] + a) / (b + a);
      a = c / b;
    }
    float sn = side / sqrt(c * c + 1.0);
    return vec2(sn, c * sn);
  }

  // The rates of a ray that only climbs out: path = (reach, square, cube, fourth), ray = (total, spin, lambda)
  void kerrClimb (float s, vec3 n, vec3 w, vec4 path, vec3 ray, out vec3 dn, out vec3 dw, out float dturn) {
    float v = path.x * (1.0 - s * s);
    float pace = 2.0 * s * path.x / sqrt(max(1.0 + v * v * (path.y + v * (path.z + v * path.w)), 1e-9));
    float a2 = ray.y * ray.y;
    float speed2 = ray.x + a2 * n.z * n.z;
    float pull = a2 * n.z;
    dn = pace * w;
    dw = pace * (-(speed2 + pull * n.z) * n + vec3(0.0, 0.0, pull));
    dturn = -pace * ray.y * v * (2.0 - ray.y * ray.z * v) / (1.0 - 2.0 * v + a2 * v * v);
  }

  // kerrRayFrom of kerr_trace.ts: psi and chi as (sine, cosine), hole = (spin, cos(incl), sin(incl), u)
  bool kerrRayFrom (vec2 psi, vec2 chi, vec4 hole, out vec3 dir) {
    dir = vec3(0.0, 0.0, 1.0);
    float sinPsi = psi.x;
    float cosPsi = psi.y;
    float sinChi = chi.x;
    float cosChi = chi.y;
    float a = hole.x;
    float a2 = a * a;
    float ci = hole.y;
    float si = max(hole.z, 1e-5);
    float rr = 2.0 / hole.w;
    float sigma = rr * rr + a2 * ci * ci;
    float delta = rr * rr - 2.0 * rr + a2;
    float big = (rr * rr + a2) * (rr * rr + a2) - a2 * delta * si * si;
    float omega = 2.0 * a * rr / big;
    float side = -sinPsi * cosChi * big / (sigma * sqrt(delta));
    float ell = side / (1.0 + omega * si * side);
    if (abs(ell) < 1e-6) ell = ell < 0.0 ? -1e-6 : 1e-6;
    float lambda = si * ell;
    float boost = 1.0 - omega * lambda;
    float polar = boost * sqrt(big / delta) * sinPsi * sinChi;
    float radial = boost * boost * big * cosPsi * cosPsi;
    float eta = polar * polar + ci * ci * (ell * ell - a2);

    float square = a2 - lambda * lambda - eta;
    float cube = 2.0 * (eta + (lambda - a) * (lambda - a));
    float fourth = -a2 * eta;
    float size2 = abs(eta) + lambda * lambda + a2 + 1e-12;
    float size = sqrt(size2);
    float sq = square / size2;
    float cu = cube / (size2 * size);
    float fo = fourth / (size2 * size2);
    float rho2 = sq * sq / 9.0 + 4.0 * fo / 3.0;
    float inner = sq * sq - 4.0 * fo;
    float discriminant = (4.0 * fo * inner * inner - sq * sq * sq * cu * cu + 36.0 * sq * fo * cu * cu) / 27.0 - 0.25 * cu * cu * cu * cu;
    float along = sq * sq * sq / 27.0 - 4.0 * sq * fo / 3.0 + 0.5 * cu * cu;
    float horizon = 1.0 + sqrt(1.0 - a2);
    bool turns = rho2 > 0.0 && discriminant >= 0.0;
    float z1 = 0.0;
    float z2 = 0.0;
    float third = 0.0;
    float rest = 0.0;
    float rho = 0.0;
    if (turns) {
      float angle = kerrAtan(sqrt(discriminant) / max(abs(along), 1e-30));
      float open = (along > 0.0 ? angle : PI - angle) / 3.0;
      third = max(open, 1e-5);
      rest = (along > 0.0 ? PI - angle : angle) / 3.0;
      rho = sqrt(rho2);
      z1 = -2.0 * sq / 3.0 + 2.0 * rho * kerrCos(third);
      z2 = -2.0 * sq / 3.0 + 2.0 * rho * kerrSin(PI / 6.0 - rest);
      turns = z1 > 0.0 && z2 > 0.0 && (cosPsi > 0.0 || open > 1e-5);
    }
    float r4 = 0.0;
    float r43 = 0.0;
    float q1 = 0.0;
    float q2 = 0.0;
    float q3 = 0.0;
    if (turns) {
      float z3 = cu * cu / (z1 * z2);
      q1 = sqrt(z1);
      q2 = sqrt(z2);
      q3 = sqrt(z3);
      r43 = size * 3.4641016 * rho * kerrSin(third) / (q2 + q3);
      r4 = 0.5 * (size * q1 + r43);
      turns = r4 > horizon;
    }

    vec3 n = vec3(0.0);
    float turn = 0.0;
    if (turns) {
      float r32 = size * 3.4641016 * rho * kerrSin(rest) / (q1 + q2);
      float r42 = size * 3.4641016 * rho * kerrCos(PI / 6.0 - third) / (q1 + q3);
      q1 *= size;
      q2 *= size;
      q3 *= size;
      float r41 = q1 + q2;
      float r31 = q1 + q3;
      float d1 = rr + 0.5 * (q1 + q2 + q3);
      float d2 = rr + 0.5 * (r32 - q3);
      float d3 = rr - 0.5 * (r32 + q3);
      float d4 = radial / (d1 * d2 * d3);
      float inner4 = r4 - a2 / horizon;
      float outer4 = r4 - horizon;
      float xFar = sqrt(r31 / r41);
      vec3 carl = kerrCarlson(vec3(r43 / r41, r43 / r42, 1.0), r43 / outer4, r43 / inner4);
      float first = xFar * carl.x;
      float thirdOuter = xFar * xFar * xFar * carl.y / 3.0;
      float thirdInner = xFar * xFar * xFar * carl.z / 3.0;
      float xNear = sqrt(d4 * r31 / (d3 * r41));
      carl = kerrCarlson(vec3(r43 * d1 / (d3 * r41), r43 * d2 / (d3 * r42), 1.0), r43 * (rr - horizon) / (outer4 * d3), r43 * (rr - a2 / horizon) / (inner4 * d3));
      float inward = cosPsi > 0.0 ? 1.0 : -1.0;
      first += inward * xNear * carl.x;
      thirdOuter += inward * xNear * xNear * xNear * carl.y / 3.0;
      thirdInner += inward * xNear * xNear * xNear * carl.z / 3.0;
      float front = 2.0 / sqrt(r31 * r42);
      float mino = front * first;
      float outerSweep = (mino - r41 * r43 / (r31 * outer4) * front * thirdOuter) / outer4;
      float innerSweep = (mino - r41 * r43 / (r31 * inner4) * front * thirdInner) / inner4;
      float drag = a * ((2.0 * horizon - a * lambda) * outerSweep - (2.0 * a2 / horizon - a * lambda) * innerSweep) / (2.0 * sqrt(1.0 - a2));

      float etaUp = max(eta, 1e-14);
      float total = etaUp + a2 + lambda * lambda;
      float root = sqrt((etaUp + a2 - lambda * lambda) * (etaUp + a2 - lambda * lambda) + 4.0 * etaUp * lambda * lambda);
      float rate2 = 0.5 * (total - 2.0 * a2 + root);
      float top = etaUp / rate2;
      float low = 2.0 * lambda * lambda / (total + root);
      float parameter = a2 * top / (a2 * top + rate2);
      float squeeze = a2 * top / rate2;
      float sin2 = min(polar * polar * si * si * rate2 / ((a2 * ci * ci + rate2) * etaUp), 1.0);
      float sinStart = sqrt(sin2);
      float cosStart = (ci < 0.0 ? -1.0 : 1.0) * sqrt(1.0 - sin2);
      if (sin2 > 0.5) {
        cosStart = clamp(ci / sqrt(top), -1.0, 1.0);
        sinStart = sqrt(1.0 - cosStart * cosStart);
      }
      vec4 meanA;
      vec4 meanB;
      float meanEnd = kerrMeans(1.0 - parameter, meanA, meanB);
      float quarter = 0.5 * PI / meanEnd;
      carl = kerrCarlson(vec3(sinStart * sinStart, 1.0 + squeeze * cosStart * cosStart, 1.0), low + top * sinStart * sinStart, 1.0);
      float firstStart = sinStart * carlsonRF(vec3(cosStart * cosStart, 1.0 - parameter * sinStart * sinStart, 1.0));
      float sweepStart = -cosStart * (carl.x + top * cosStart * cosStart * carl.y / 3.0);
      float way = sinChi > 0.0 ? -1.0 : 1.0;
      float ending = (cosStart >= 0.0 ? firstStart : 2.0 * quarter - firstStart) + way * sqrt(a2 * top + rate2) * mino;
      float halves = floor(0.5 * ending / quarter + 0.5);
      vec2 phase = kerrJacobi(ending - 2.0 * quarter * halves, meanA, meanB, meanEnd);
      float odd = mod(halves, 2.0) > 0.5 ? -1.0 : 1.0;
      float sn = phase.x;
      float cn = phase.y;
      carl = kerrCarlson(vec3(sn * sn, 1.0 + squeeze * cn * cn, 1.0), low + top * sn * sn, 1.0);
      float sweepEnd = -(sn < 0.0 ? -1.0 : 1.0) * cn * (carl.x + top * cn * cn * carl.y / 3.0);
      float swings = sn < 0.0 ? halves - 1.0 : halves;
      if (swings != 0.0) {
        carl = kerrCarlson(vec3(0.0, 1.0 + squeeze, 1.0), low, 1.0);
        sweepEnd += 2.0 * swings * (carl.x + top * carl.y / 3.0);
      }
      turn = -(drag + lambda * way * (sweepEnd - sweepStart) / sqrt(rate2));
      n = vec3(sqrt(low + top * sn * sn), 0.0, sqrt(top) * odd * cn);
    } else {
      if (cosPsi > 0.0) return false;
      vec4 path = vec4(0.5 * hole.w, square, cube, fourth);
      vec3 ray = vec3(eta + lambda * lambda, a, lambda);
      n = vec3(si, 0.0, ci);
      vec3 w = vec3(-polar * ci, -ell, polar * si);
      float h = 1.0 / 24.0;
      for (int i = 0; i < 24; i++) {
        float s = float(i) * h;
        vec3 dn;
        vec3 dw;
        float dturn;
        kerrClimb(s, n, w, path, ray, dn, dw, dturn);
        vec3 sumN = dn;
        vec3 sumW = dw;
        float sumTurn = dturn;
        kerrClimb(s + 0.5 * h, n + 0.5 * h * dn, w + 0.5 * h * dw, path, ray, dn, dw, dturn);
        sumN += 2.0 * dn;
        sumW += 2.0 * dw;
        sumTurn += 2.0 * dturn;
        kerrClimb(s + 0.5 * h, n + 0.5 * h * dn, w + 0.5 * h * dw, path, ray, dn, dw, dturn);
        sumN += 2.0 * dn;
        sumW += 2.0 * dw;
        sumTurn += 2.0 * dturn;
        kerrClimb(s + h, n + h * dn, w + h * dw, path, ray, dn, dw, dturn);
        n += h / 6.0 * (sumN + dn);
        w += h / 6.0 * (sumW + dw);
        turn += h / 6.0 * (sumTurn + dturn);
      }
      n = normalize(n);
    }

    float halfTurns = floor(turn / PI + 0.5);
    float within = turn - halfTurns * 3.140625 - halfTurns * 9.67653589793e-4;
    float flip = mod(halfTurns, 2.0) > 0.5 ? -1.0 : 1.0;
    float sinTurn = flip * kerrSin(within);
    float cosTurn = flip * kerrCos(within);
    float dx = n.x * cosTurn - n.y * sinTurn;
    float dy = n.x * sinTurn + n.y * cosTurn;
    dir = vec3(dy, si * n.z - ci * dx, -(si * dx + ci * n.z));
    return true;
  }

  // The direction a ray came from, in the camera's (right, up, forward), for the pixel psi from forward and
  // chi round it from right toward up; hole = (spin, cos(incl), sin(incl), 1 / the camera's distance in
  // Schwarzschild radii). False for a ray that came out of the hole. A caller that has the sines and
  // cosines at hand should give them to kerrRayFrom instead and spare the GPU's own sin and cos
  bool kerrRay (float psi, float chi, vec4 hole, out vec3 dir) {
    return kerrRayFrom(vec2(sin(psi), cos(psi)), vec2(sin(chi), cos(chi)), hole, dir);
  }
`
