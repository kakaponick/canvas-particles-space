// WebGL shaders for the particle renderer: trail fade, particle segments and the composite pass,
// which draws the black hole, the explosion's light and the intro title over the scene. They run on WebGL2:
// the composite pass and the sheet are still written in GLSL ES 1.00, which WebGL2 compiles as it is, and
// the programs that fade and stamp strokes are GLSL ES 3.00, which lets one draw write two targets.

import { SHADOW_SAMPLES } from './kerr_shadow'
import { RING_BINS } from './ring_energy'
import { KERR_GLSL } from './kerr_glsl'
import { LATTICE_SEGMENTS } from './space_lattice'
import { FLOW_SEGMENTS } from './flows'

// Attribute locations shared by every program; location 0 is always the full-screen quad
export const ATTRIBUTE_LOCATIONS = {
  position: 0,
  segment: 1,
  style: 2,
  color: 3,
  gridLine: 4,
  latticeLine: 5,
  flowCorner: 6,
  flowSeed: 7,
  fieldPlace: 8,
  fieldDrift: 9,
  fieldLook: 10,
  fieldDeposit: 11
} as const

// How deep the sheet lies, how far a node of the lattice is pulled in and how far the Lensed Grid is drawn in,
// at a distance from a black hole; one text, so the three follow the same law
const DENT_GLSL = `  // How deep the sheet lies at a distance from a black hole whose shadow has the radius "edge", as a
  // share of its depth at the shadow's edge. The sheet is drawn in the picture's own measure: a point of
  // it stands where light passing the hole at that distance is seen, and lies as deep as time is slowed at
  // the nearest that light comes to the hole, 1 - sqrt(1 - rs / nearest). Far away that is the Newtonian
  // well, rs / 2r. At the shadow's edge the light skims the photon sphere, 1.5 rs, where a clock runs at
  // 1 / sqrt(3) of its rate, and the sheet stands vertical: light any closer does not come back. The
  // nearest approach of light seen at b is the largest root of r^3 = b^2 (r - rs), and the edge is at
  // b = sqrt(27) / 2 rs, which leaves rs / nearest = x / (3 cos(acos(-x) / 3)) with x = edge / b.
  // Inside the shadow x is edge / edge, which a GPU may round a hair above 1: acos has no answer there, the
  // root is taken of nothing, and the bottom of the well is drawn 2.366 times too deep for that frame. So x
  // stops at 1
  float dent (float away, float edge) {
    float x = min(edge / max(away, edge), 1.0);
    float slowed = 1.0 - sqrt(max(1.0 - x / (3.0 * cos(acos(-x) / 3.0)), 0.0));
    return slowed * 2.3660254;
  }
`

// The space sheet (space_grid.ts) as a surface and its pose: one text for the grid program that draws it,
// the field's step and the flows that lay particles on it. A place of the plane is given from the main hole
// in the plane's units, along its two directions; the surface lies that deep in the wells along the way the
// plane faces; the pose takes it into the space of the camera that sees the sheet (right, down, ahead) and
// draws it there. Lengths are in the plane's units (space_grid.ts), screen places in CSS pixels
const SHEET_GLSL = `  uniform vec4 u_sheetU;      // the sheet's pose: where its camera sends the plane's first direction, its focal length
  uniform vec4 u_sheetV;      // where it sends the second, the nearest it draws
  uniform vec4 u_sheetN;      // where it sends the way the wells go down, the x of its picture's centre
  uniform vec4 u_sheetO;      // where the plane's place over the main hole stands, the y of its picture's centre; the hole is at its well's bottom
  uniform vec4 u_sheetWell;   // the main hole's well: the radius it ends at, its depth there, the depth the hole stands at; unused
  uniform vec4 u_sheetWell2;  // a second hole's well: where it falls on the plane from the main hole, its radius and depth (0 = none)
  uniform vec4 u_sheetWave;   // a ringing hole's wave on the sheet: height (0 = none), seconds since it left the hole, angular frequency, 1 / decay time
  uniform vec4 u_sheetWaveSpread; // radius beyond which it weakens, how far it travels a second; unused
  uniform vec4 u_sheetWaveTurn;   // cosine and sine of twice the angle on the sheet the oval's long axis had as the ringing began, the way it turns there (1, -1; 0 = it wobbles in place), unused
  uniform vec4 u_sheetPairWave;   // the pair's spiral wave: height (0 = none), the pair's angle on the sheet, turn of its arms per unit of distance, radius beyond which it weakens
  uniform vec4 u_sheetPairAt;     // the centre the two turn around, from the main hole; unused
  uniform vec4 u_sheetPairFront;  // once the two are one: seconds since then (negative = not yet), how far the wave travels a second, seconds the old wave takes to give way to the new; unused

${DENT_GLSL}
  // How deep the wells lie at a place of the plane
  float sheetDepth (vec2 at) {
    float depth = 0.0;
    if (u_sheetWell.y > 0.0) depth = u_sheetWell.y * dent(length(at), u_sheetWell.x);
    // A second black hole dents the sheet the same way, and the dents add up
    if (u_sheetWell2.w > 0.0) depth += u_sheetWell2.w * dent(length(at - u_sheetWell2.xy), u_sheetWell2.z);
    return depth;
  }

  // How strong a gravitational wave is at a distance from where it left: it falls as 1 / r. Closer than
  // the edge there is no wave yet, only the field of the source itself, which fades to nothing at the centre
  float sheetReach (float dist, float edge) {
    float share = dist / edge;
    return share < 1.0 ? share * share : 1.0 / share;
  }

  // How far the sheet's waves lift it at a place of the plane, given from the main hole, along the way
  // the wells go down. The pair's spiral wave is drawn as height: the sheet rises where the wave stretches
  // space along the line the two stood on as it left, and sinks where it squeezes; the wave of a ringing
  // hole the same way, a hole that formed alone wobbling in place, two that became one leaving an oval that
  // turns. The composite pass slides the sky by the same waves
  float sheetWave (vec2 fromHole) {
    float depth = 0.0;
    if (u_sheetPairWave.x > 0.0) {
      vec2 fromPair = fromHole - u_sheetPairAt.xy;
      float pairDist = length(fromPair);
      float turn = 2.0 * (u_sheetPairWave.z * pairDist - u_sheetPairWave.y);
      float height = u_sheetPairWave.x * sheetReach(pairDist, u_sheetPairWave.w);
      if (u_sheetPairFront.x >= 0.0) height *= smoothstep(-u_sheetPairFront.z, u_sheetPairFront.z, pairDist / u_sheetPairFront.y - u_sheetPairFront.x);
      depth += height *
        ((fromPair.x * fromPair.x - fromPair.y * fromPair.y) * cos(turn) - 2.0 * fromPair.x * fromPair.y * sin(turn)) / max(pairDist * pairDist, 0.0001);
    }
    if (u_sheetWave.x > 0.0) {
      float r = length(fromHole);
      float emitted = u_sheetWave.y - r / u_sheetWaveSpread.y;
      float quarter = 1.5707963 / u_sheetWave.z;
      if (emitted > (u_sheetWaveTurn.z == 0.0 ? 0.0 : -quarter)) {
        float cos2 = (fromHole.x * fromHole.x - fromHole.y * fromHole.y) / max(r * r, 0.0001);
        float sin2 = 2.0 * fromHole.x * fromHole.y / max(r * r, 0.0001);
        float phase = u_sheetWave.z * emitted;
        float along;
        if (u_sheetWaveTurn.z == 0.0) {
          along = sin(phase) * cos2;
        } else {
          along = (cos2 * u_sheetWaveTurn.x + sin2 * u_sheetWaveTurn.y) * cos(phase) + u_sheetWaveTurn.z * (sin2 * u_sheetWaveTurn.x - cos2 * u_sheetWaveTurn.y) * sin(phase);
          along *= smoothstep(-quarter, quarter, emitted);
        }
        depth += u_sheetWave.x * exp(-max(emitted, 0.0) * u_sheetWave.w) * sheetReach(r, u_sheetWaveSpread.x) * along;
      }
    }
    return depth;
  }

  // A point of the surface, at a place of the plane and a depth, in the space of the sheet's camera
  vec3 sheetSeen (vec2 at, float depth) {
    return u_sheetU.xyz * at.x + u_sheetV.xyz * at.y + u_sheetN.xyz * depth + u_sheetO.xyz;
  }

  // Where the sheet's camera draws a point of its space that lies beyond its near plane
  vec2 sheetScreen (vec3 seen) {
    return vec2(u_sheetN.w, u_sheetO.w) + seen.xy * (u_sheetU.w / seen.z);
  }
`

/// In 3D what lies nearer the camera than the nearer black hole is drawn where it is, over the holes, and
// what lies far behind it is seen through the lens. Between the two the share seen through the lens grows
// with the depth behind the hole as a thin lens's bend does, d / (D + d) of the sky's for light from d
// behind a lens D from the camera, scaled to be whole at Front Depth and raised to Front Curve: the share of
// a thing "away" from the camera, with the hole "plane" from it and that depth behind the plane, all in one
// measure. 0 depth is a hard plane. Whatever lies behind the hole and is seen within a shadow ("main" and
// "second": the centre on the screen, where "at" is measured, and the radius; 0 for no hole), a spinning
// hole's outline for the main one, is the lens's whole, which the shadow covers. Front Bend and Between Bend
// draw a share of that matter once instead, in front, where a point mass bent by its share of the lens shows
// it. The field's step and the line shaders read this one text
export const BEHIND_GLSL = `  uniform sampler2D u_behindShape;  // a spinning main hole's shadow (kerr_shadow.ts): its radius all the way round, in round-shadow radii

  // How far a shadow of "radius" reaches toward "from" on the picture: round, or while "spin.x" is 1 the
  // outline of a spinning hole whose axis is turned "spin.y" on the picture (the second hole does not spin)
  float shadowToward (vec2 from, float radius, vec2 spin) {
    if (spin.x <= 0.0) return radius;
    float around = (atan(-from.y, from.x) - spin.y) / 6.2831853;
    return radius * texture(u_behindShape, vec2(around + HALF_SAMPLE, 0.5)).r;
  }

  // The thin lens's share of a thing "behind" the plane of a hole "plane" from the camera, whole at "depth"
  // behind it, raised to "power"
  float lensShare (float behind, float plane, float depth, float power) {
    if (behind <= 0.0) return 0.0;
    if (behind >= depth) return 1.0;
    float share = behind * (plane + depth) / ((plane + behind) * depth);
    return power == 1.0 ? share : pow(share, power);
  }

  // Where a hole's lens shows a thing seen at "at" without it, bent by a share of the lens: a point mass's
  // outer image, beta (1 + sqrt(1 + 4 share E^2 / beta^2)) / 2, for "einstein" its Einstein radius
  vec2 imageOf (vec2 at, vec4 hole, float einstein, float share) {
    vec2 from = at - hole.xy;
    float b = max(dot(from, from), 0.00000001);
    return hole.xy + from * (0.5 + 0.5 * sqrt(1.0 + 4.0 * share * einstein * einstein / b));
  }

  // 1 when a hole's shadow covers a point of the picture
  float shadowed (vec2 at, vec4 hole, vec2 spin) {
    vec2 from = at - hole.xy;
    return length(from) < shadowToward(from, hole.z, spin) ? 1.0 : 0.0;
  }

  // The sides of a thing "away" from the camera seen at "at" (main, second: each hole's shadow there and its
  // distance from the camera): x the share of it seen through the layer behind the holes, y the share of
  // the lens the rest is bent by where it is drawn in front, z 1 when that lens is the second hole's.
  // band: Front Depth, how far the nearer hole's lens reaches on the picture in its shadow's radii, the
  // multiple of that by which it lets go, Front Curve. bend: Front Bend and Between Bend, the two holes'
  // Einstein radii. spin: 1 while the main hole spins, its axis's turn on the picture.
  // Behind both holes it is all the lens's. What stands behind the nearer hole and before the farther is the
  // nearer one's alone to bend, which the layer behind cannot draw (it is read through both lenses): it goes
  // there only where the nearer hole's lens reaches it on the picture, and is drawn where it is elsewhere,
  // so the matter round the farther hole is not bent by its own hole's lens. Front Bend draws a share of the
  // band behind the nearer hole, and Between Bend of what stands between the two, once and in front, where
  // the nearer hole's lens alone shows it, and hides what its shadow covers there
  vec3 behindShares (float away, vec2 at, vec4 main, vec4 second, vec4 band, vec4 bend, vec2 spin) {
    float rawOne = main.z > 0.0 ? lensShare(away - main.w, main.w, band.x, band.w) : 0.0;
    float one = rawOne > 0.0 && rawOne < 1.0 ? max(rawOne, shadowed(at, main, spin)) : rawOne;
    if (second.z <= 0.0) {
      if (bend.x <= 0.0 || rawOne <= 0.0 || rawOne >= 1.0) return vec3(one, 0.0, 0.0);
      float share = rawOne * bend.x;
      return vec3(mix(one, shadowed(imageOf(at, main, bend.z, share), main, spin), bend.x), share, 0.0);
    }
    float rawTwo = lensShare(away - second.w, second.w, band.x, band.w);
    float two = rawTwo > 0.0 && rawTwo < 1.0 ? max(rawTwo, shadowed(at, second, vec2(0.0))) : rawTwo;
    bool mainNearer = main.w <= second.w;
    vec4 nearer = mainNearer ? main : second;
    float reached = 1.0 - smoothstep(band.y, band.z * band.y, length(at - nearer.xy) / nearer.z);
    float split = max(min(one, two), max(one, two) * reached);
    float rawNear = mainNearer ? rawOne : rawTwo;
    float law = mix(bend.x, bend.y, rawNear);
    if ((mainNearer ? rawTwo : rawOne) > 0.0 || rawNear <= 0.0 || law <= 0.0) return vec3(split, 0.0, 0.0);
    float share = rawNear * law;
    vec2 nearSpin = mainNearer ? spin : vec2(0.0);
    float hidden = shadowed(imageOf(at, nearer, mainNearer ? bend.z : bend.w, share), nearer, nearSpin);
    return vec3(mix(split, hidden, law), share, mainNearer ? 0.0 : 1.0);
  }

  // Where a thing seen at "at", whose sides behindShares gave, is drawn in front of the holes
  vec2 bentBy (vec2 at, vec3 sides, vec4 main, vec4 second, vec4 bend) {
    if (sides.y <= 0.0) return at;
    return sides.z > 0.5 ? imageOf(at, second, bend.w, sides.y) : imageOf(at, main, bend.z, sides.y);
  }
`.replace('HALF_SAMPLE', (0.5 / SHADOW_SAMPLES).toFixed(8))

// The line shaders take the side of each end of a piece: the composite pass lays the front layer over the
// holes unbent and reads the other through the lens. One draw writes both (the stroke fragment shader),
// a piece in the band behind the hole into both at their shares, which run from the one end's to the
// other's along it, so a piece that crosses the boundary passes from one layer into the other where it does
const SIDE_GLSL = `  uniform vec4 u_side;        // x: 1 while something can stand in front of the black holes (0: all of it is behind them); y: Front Depth, in the shader's own measure of depth; z: how far the nearer hole's lens reaches on the picture, in its shadow's radii; w: the multiple of that by which it lets go
  uniform vec4 u_sideMain;    // the main hole's shadow in the layer: its centre and radius, device pixels at the camera's zoom; the hole's distance from the camera, in the shader's own measure
  uniform vec4 u_sideSecond;  // the second hole's (radius 0 without one)
  uniform vec4 u_sideBend;    // Front Bend, Between Bend, the main hole's and the second's Einstein radii in the layer
  uniform vec3 u_sideShape;   // Front Curve; 1 while the main hole spins, its axis's turn on the picture
  varying float v_front;      // the share of a piece drawn in front of the holes, the rest seen through the lens
  varying vec2 v_cut;         // where a particle's stroke crosses the boundary (the field's alone; none here)
${BEHIND_GLSL}
  // The sides of an end of a piece "away" from the camera that lands at "at" in the layer: x the share in
  // front, y and z the lens it is bent by there (behindShares)
  vec3 sideOf (float away, vec2 at) {
    if (u_side.x <= 0.0) return vec3(0.0);
    vec3 sides = behindShares(away, at, u_sideMain, u_sideSecond, vec4(u_side.yzw, u_sideShape.x), u_sideBend, u_sideShape.yz);
    return vec3(1.0 - sides.x, sides.yz);
  }

  // Where an end of a piece at "at" is drawn, as its sides say ("side", and "other" those of the other end):
  // bent by its share of the nearer lens while any of it is in front, or as the other end is while only
  // that is, so a piece that crosses does not reach from the one place to the other
  vec2 placedBy (vec2 at, vec3 side, vec3 other) {
    vec3 by = side.x > 0.0 ? side : other;
    return by.x > 0.0 ? bentBy(at, vec3(0.0, by.yz), u_sideMain, u_sideSecond, u_sideBend) : at;
  }
`

// The programs that fade and stamp strokes are GLSL ES 3.00, where a fragment can write two targets at
// once. Their vertex shaders are written as the others are and read as 3.00 through these two words
const MODERN_VERTEX = '#version 300 es\n#define attribute in\n#define varying out\n'

// Two triangles covering clip space; the particle program reuses them as segment corners
// The most layers of noise a nebula is made of (the top of Nebula Detail), the most stars a cell of the sky
// holds and the most rings of neighbouring cells a star is drawn from (the tops of Stars per Cell and Star
// Neighbours): the composite shader's loops stop there
export const NEBULA_LAYERS = 8
export const STARS_PER_CELL = 4
export const STAR_RINGS = 2

export const QUAD_VERTICES = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1
])

export const QUAD_VERTEX_COUNT = 6

export const fadeVertexShaderSource = MODERN_VERTEX + `
  attribute vec2 a_position;

  void main () {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export const fadeFragmentShaderSource = `#version 300 es
  precision mediump float;

  uniform vec4 u_color;
  // The scene texture fades toward the background; the layer in front of the black holes, where it is
  // bound beside it, toward black
  layout(location = 0) out vec4 behind;
  layout(location = 1) out vec4 before;

  void main () {
    behind = u_color;
    before = vec4(0.0, 0.0, 0.0, u_color.a);
  }
`

export const particleVertexShaderSource = MODERN_VERTEX + `
  attribute vec2 a_position;  // quad corner: x picks the segment end, y the side
  attribute vec4 a_segment;   // x0, y0, x1, y1 in CSS pixels, top-left origin
  attribute vec3 a_style;     // line width in CSS pixels, opacity, its speed's glow already in it (field_step.ts), below 0 when its start is in front of the holes; the share of the way along it crosses to the other side (0: it does not)
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform float u_pixelRatio;
  uniform vec2 u_center;      // vanishing point in CSS pixels
  uniform vec4 u_flight;      // where the field's far end lies for the camera (the scene's +z turned), its focal length in CSS pixels
  uniform float u_doppler;    // 0 at rest, 1 near the speed of light
  uniform vec3 u_tintAhead;   // the tint of a fast flight: its colour along the line of flight,
  uniform vec3 u_tintEdge;    // its colour away from it, up to a quarter turn,
  uniform vec3 u_tintBehind;  // its colour straight behind, which the edge colour turns to past a quarter turn,
  uniform vec2 u_tint;        // how fast it turns from one to the other per half screen diagonal, the most of a colour it replaces
  uniform vec4 u_zoom;       // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_zoomFrom;    // the camera of the frame before, the same way

  varying vec2 v_ends;        // distance along the segment from its start and from its end
  varying float v_across;     // signed distance from the segment axis
  varying float v_halfWidth;
  varying vec4 v_color;
  varying float v_front;      // the share of a stroke drawn in front of the black holes: a particle's is 0 or 1, at its start
  varying vec2 v_cut;         // how far past the point the stroke crosses to the other side, device pixels along it; 1 while it does

  const float PI = 3.14159265359;

  void main () {
    // A particle that draws nothing this frame has no opacity; one in front of the holes has it below 0
    float opacity = abs(a_style.y);
    v_front = a_style.y < 0.0 ? 1.0 : 0.0;
    v_cut = vec2(0.0);
    if (opacity <= 0.0) {
      v_ends = vec2(0.0);
      v_across = 0.0;
      v_halfWidth = 0.0;
      v_color = vec4(0.0);
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // The camera's zoom is applied to the segment itself, not to the finished picture, so a magnified
    // particle is drawn anew at its larger size and keeps a sharp edge. The stroke starts where the
    // particle stood in the last frame's picture, through that frame's camera, so its trail stays one
    // unbroken line while the camera zooms or follows the black hole
    vec2 start = u_zoomFrom.xy + (a_segment.xy * u_pixelRatio - u_zoomFrom.xy) * u_zoomFrom.z;
    vec2 delta = u_zoom.xy + (a_segment.zw * u_pixelRatio - u_zoom.xy) * u_zoom.z - start;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float width = a_style.x * u_pixelRatio * u_zoom.z;
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

    // Relativistic aberration, stylised: light ahead shifts blue, light off the line of flight shifts red.
    // Measured by the angle from the line of flight, as the tangent of it in half screen diagonals at the
    // focal length; straight on that is the distance from the vanishing point
    vec3 tinted = a_color.rgb;
    if (u_doppler > 0.0) {
      vec3 toward = vec3((a_segment.zw - u_center) / u_flight.w, 1.0);
      float ahead = dot(toward, u_flight.xyz);
      float aside = sqrt(max(dot(toward, toward) - ahead * ahead, 0.0));
      float radial = (ahead > 0.0001 ? aside / ahead : 1000.0) * u_flight.w * 2.0 * u_pixelRatio / max(length(u_resolution), 1.0);
      float shift = u_doppler * (1.0 - u_tint.x * radial);
      // Past a quarter turn off the line of flight (3D, a camera that looks back) the edge colour turns to
      // the colour behind, by the cosine of the angle beyond it
      vec3 edge = ahead < 0.0 ? mix(u_tintEdge, u_tintBehind, min(-ahead * inversesqrt(dot(toward, toward)), 1.0)) : u_tintEdge;
      tinted = mix(tinted, shift > 0.0 ? u_tintAhead : edge, min(abs(shift), u_tint.y));
    }

    // A stroke that crosses the boundary of the holes passes to the other layer where it does
    if (a_style.z > 0.0) v_cut = vec2(along - a_style.z * len, 1.0);
    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(tinted, min(opacity * targetArea / drawnArea, 1.0));

    // Rows stay top-down in the scene texture, which is the layout the composite pass samples
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

// The traces of the orbiting stars (orbiters.ts): every stretch a star has flown is kept as a line and
// all of them are drawn anew each frame, at the camera's zoom and around the black hole as it is now
export const orbitVertexShaderSource = MODERN_VERTEX + `
  attribute vec2 a_position;  // quad corner: x picks the end of the stretch, y the side
  attribute vec4 a_from;      // its start in the scene, in Schwarzschild radii from the black hole, and how far the traces had dimmed when it was last flown
  attribute vec4 a_to;        // its end, and its brightness then
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform vec4 u_zoom;        // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_orbit;       // the black hole (device pixels), device pixels in a Schwarzschild radius, line width in device pixels
  uniform float u_dimmed;     // brightness every trace has lost since the traces began
  uniform vec4 u_turnX;       // 3D: where the camera turns the scene's x axis, and its focal length in device pixels (0 = flat)
  uniform vec4 u_turnY;       // where it turns the scene's y axis, and the black hole's distance in device pixels (below 0: behind the camera, not drawn)
  uniform vec3 u_turnZ;       // where it turns the scene's z axis
  uniform vec2 u_orbitFrom;   // 3D: the black hole's place from the vanishing point, device pixels
${SIDE_GLSL}
  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;

  // A point of an orbit, in device pixels from the black hole, as the 3D camera sees it: each point in its
  // own perspective, the hole standing off the line of sight by its place from the vanishing point
  vec2 seenOrbit (vec3 point) {
    vec3 turned = u_turnX.xyz * point.x + u_turnY.xyz * point.y + u_turnZ * point.z;
    return (turned.xy * u_turnX.w - u_orbitFrom * turned.z) / max(u_turnY.w + turned.z, 1.0);
  }

  // How far a point of an orbit stands from the camera along its line of sight, device pixels
  float awayOf (vec3 point) {
    return u_turnY.w + u_turnX.z * point.x + u_turnY.z * point.y + u_turnZ.z * point.z;
  }

  void main () {
    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_color = vec4(0.0);
    // A trace loses brightness evenly, so every one of them reaches black
    float brightness = a_to.w - (u_dimmed - a_from.w);
    if (brightness <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec2 start;
    vec2 delta;
    if (u_turnY.w < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    v_front = 0.0;
    v_cut = vec2(0.0);
    if (u_turnX.w > 0.0) {
      // Each end takes its side of the holes, and the stretch runs from the one share to the other
      vec3 from = a_from.xyz * u_orbit.z;
      vec3 to = a_to.xyz * u_orbit.z;
      vec2 first = u_zoom.xy + (u_orbit.xy + seenOrbit(from) - u_zoom.xy) * u_zoom.z;
      vec2 last = u_zoom.xy + (u_orbit.xy + seenOrbit(to) - u_zoom.xy) * u_zoom.z;
      vec3 sideFirst = sideOf(awayOf(from), first);
      vec3 sideLast = sideOf(awayOf(to), last);
      start = placedBy(first, sideFirst, sideLast);
      delta = placedBy(last, sideLast, sideFirst) - start;
      v_front = a_position.x < 0.0 ? sideFirst.x : sideLast.x;
    } else {
      // Flat, the orbits are seen straight on, down the scene's z
      start = u_zoom.xy + (u_orbit.xy + a_from.xy * u_orbit.z - u_zoom.xy) * u_zoom.z;
      delta = (a_to.xy - a_from.xy) * u_orbit.z * u_zoom.z;
    }
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    float width = u_orbit.w * u_zoom.z;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;
    float along = mix(-extent, len + extent, a_position.x * 0.5 + 0.5);
    float across = a_position.y * extent;
    vec2 pixel = start + direction * along + normal * across;

    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(a_color.rgb, min(brightness * targetArea / drawnArea, 1.0));
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

export const particleFragmentShaderSource = `#version 300 es
  precision highp float;

  in vec2 v_ends;
  in float v_across;
  in float v_halfWidth;
  in vec4 v_color;
  in float v_front;
  in vec2 v_cut;
  // What lies behind the black holes, which the lens reads, and what stands in front of them (3D): one
  // draw writes each stroke into the two targets at its shares, a whole stroke into one and nothing into
  // the other, which the brighter-of-two blend leaves as it was
  layout(location = 0) out vec4 behind;
  layout(location = 1) out vec4 before;

  void main () {
    // Distance to the segment: past either end it is measured from the end point, which rounds the cap
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float coverage = clamp(v_halfWidth + 0.5 - length(vec2(beyondEnds, v_across)), 0.0, 1.0);
    // Premultiplied, the form the brighter-of-two blend compares
    float alpha = v_color.a * coverage;
    vec4 light = vec4(v_color.rgb * alpha, alpha);
    // A particle's stroke that crosses the boundary turns to the other side a pixel past the crossing
    float front = v_cut.y > 0.5 ? abs(v_front - clamp(v_cut.x + 0.5, 0.0, 1.0)) : v_front;
    behind = light * (1.0 - front);
    before = light * front;
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
  precision highp float;

  uniform sampler2D u_image;
  uniform sampler2D u_title;     // white alpha mask of the intro title
  uniform vec2 u_resolution;
  uniform float u_pixelRatio;
  uniform float u_time;

  // Black hole
  uniform vec2 u_hole;
  uniform float u_horizon;       // shadow radius; 0 before the black hole forms
  uniform vec2 u_holeOval;       // ringdown wobble: a share of the radius, times the cosine and the sine of twice the angle of its long axis; zero keeps it round
  uniform float u_einstein;      // Einstein ring radius; 0 turns the lens off
  uniform float u_falloff;       // 2 is a point mass; higher widens the lens, lower shrinks it
  uniform float u_swirl;         // frame-dragging twist near the ring
  uniform float u_falloffPivot;  // distance at which falloff leaves the pull unchanged
  uniform float u_lensCore;      // closest a bent ray gets to the point behind the hole, in Einstein radii
  uniform float u_maxBend;       // cap on the pull; 1 leaves no nested rings inside the Einstein ring
  uniform float u_lensReach;     // 0: the compact bubble of the original canvas; 1: a point mass, felt across the screen
  uniform float u_lensBubble;    // the power of the pull whose cosine shapes the bubble; 1 the original canvas's
  uniform float u_twistLimit;    // cap on the pull the twist follows, so a wide lens does not wind up the scene
  uniform float u_absorption;    // light the lens's pull removes around the shadow
  uniform vec4 u_trace;          // Ray Traced lens: 1 / the camera's distance in Schwarzschild radii (0 = the stylized lens), pixels of 2 tan(angle / 2) from the hole, share of the bend shown, unused
  uniform vec4 u_spin;           // the hole's spin a/M (0 = none), cosine and sine of its axis's angle to the line to the camera, turn of the axis on screen from up toward the left
  uniform sampler2D u_shadowShape; // a spinning hole's shadow: its radius all the way round, in round-shadow radii, from the axis's right toward its up; the main hole's in the first row, the second hole's in the second
  uniform vec4 u_horizonGrid;    // the grid on the horizon: its brightness (0 turns it off), 1 / the camera's distance in Schwarzschild radii, pixels of tan(angle / 2) from the hole, half the width of a line in pixels of the screen
  uniform vec4 u_horizonAxis;    // the axis it is drawn about: cosine and sine of its angle to the line to the camera, its turn on screen from up toward the left; and the most light lines too dense to draw give
  uniform vec4 u_horizonTurn;    // the longitude of the camera's meridian less the turn the horizon has made, the horizon's rate of turn per M, cells per radian of latitude, cells round the equator
  uniform vec4 u_horizonLook;    // the cell size in pixels of the screen below which its lines start to turn to haze and that at which the haze is whole, the share of the shift the horizon's turn gives its light, the share of its brightness the second hole's grid has
  uniform vec4 u_companionGrid;  // the second hole's grid, as horizonCells's look: pixels of tan(angle / 2) from it, its axis's turn on screen, the camera's meridian less its horizon's turn, its rate of turn per M
  uniform vec4 u_companionHole;  // and as its hole: its spin, the cosine and sine of its axis's angle to the line to the camera, 1 / the camera's distance in its Schwarzschild radii
  uniform float u_ring;          // photon ring brightness
  uniform float u_ringWidth;     // thickness of the line beyond its floor, in black hole radii
  uniform vec4 u_ringLine;       // the line: its floor in screen pixels, how far outside the shadow's edge it stands in its own widths, how far from the hole the ring is drawn in shadow radii, the width of its bell of light as a share of its own
  uniform vec4 u_ringGlowShape;  // the glow: how far its tight core and its wide skirt reach, in black hole radii, and the share of the glow each holds at the line
  uniform vec3 u_ringColor;      // the ring's colour, and what its approaching and receding sides turn toward
  uniform vec3 u_ringApproaching;
  uniform vec3 u_ringReceding;
  uniform float u_ringGlow;      // strength of the soft light around the line; 0 leaves the bare line
  uniform float u_ringDoppler;   // contrast between the approaching and the receding side
  uniform float u_ringSide;      // direction of the approaching side, radians
  uniform sampler2D u_ringEnergy; // light left around the ring by the orbiting stars and the flows
  uniform sampler2D u_ringLight;  // light the particle field left there, a bin a direction, neither spread nor saturated; round the main hole in the first row, round the second in the second
  uniform float u_ringField;      // 1 while the field's light is kept
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
  uniform vec4 u_echoShape;      // afterglows thin haze and the thickest cloud hold their light, the longer of the two, the share of the frame's width at which the glow is half as bright
  uniform vec2 u_echoSwell;      // the glow's swell: a share of the afterglow, and seconds added to it
  uniform float u_waveRadius;    // matter front
  uniform float u_waveStrength;  // refraction at the matter front, pixels
  uniform float u_waveWidth;
  uniform float u_remnantGlow;   // the collapsing core
  uniform float u_remnantRedshift;
  uniform float u_remnantRadius;
  uniform vec4 u_remnantShape;   // the share of the redshift at which the core is the ember, the flash colour left in the ember, the brightness of the deep colour it ends at, how much it has dimmed by then
  uniform float u_gravityWaveAmplitude; // pixels of stretch at the shadow's edge; 0 turns the wave off
  uniform float u_gravityWaveTime;      // seconds since the wave left the hole, with the ringdown
  uniform float u_gravityWaveOmega;     // the wobble's angular frequency
  uniform float u_gravityWaveInvDecay;  // 1 / the wobble's decay time
  uniform float u_gravityWaveRadius;    // shadow radius; the wave weakens with distance beyond it
  uniform vec2 u_gravityWaveCenter;     // where the wave left from
  uniform vec4 u_gravityWaveTurn;       // cosine and sine of twice the angle the oval's long axis had as the ringing began, the way it turns (1, -1; 0 = it wobbles in place), pixels the wave travels a second
  uniform vec4 u_companion;      // a second black hole: centre, shadow radius (0 = none), Einstein radius
  uniform vec2 u_companionLens;  // its lens: the radius it pulls no harder inside, in its shadow's radii; 0 a point mass .. 1 the stylized lens
  uniform vec2 u_companionSpin;  // its own spin a/M (0 = none) and the turn of its axis on screen from up toward the left
  uniform vec3 u_companionRing;  // its ring: Doppler contrast (0 = none), the angle of the bright side, the light of what falls in (0 = none)
  uniform vec2 u_waveLens;       // the share of the nearer hole's bend the waves are read through: the second hole's, then the main one's
  uniform vec2 u_pair;           // the centre the two black holes turn around
  uniform vec4 u_pairWave;       // their spiral gravitational wave: pixels of stretch (0 = off), the pair's angle, turn of its arms per pixel, radius beyond which it weakens
  uniform vec4 u_pairFront;      // once the two are one: seconds since then (negative = not yet), pixels the wave travels a second, seconds the old wave takes to give way to the new
  uniform vec3 u_pairDepth;      // two holes at different depths: the share of the second one's bend the first is seen through (the second the nearer), the share of the first one's bend the second is seen through (the second the farther), which stands in front (-1 the first .. 1 the second); zeros side by side
  uniform vec4 u_pairPlane;      // the plane the waves and the ringing oval lie in, its two directions as the camera sees them: the first's right and down on the picture, then the second's
  uniform vec3 u_turnRight;      // the 3D camera's turn, row by row: where its right,
  uniform vec3 u_turnDown;       // its down
  uniform vec3 u_turnAhead;      // and its line of sight point in the scene; the scene's own axes in the flat view
  uniform float u_skySphere;     // how far the sky has turned from the flat mode's backdrop (0) to the sphere round the 3D camera (1)
  uniform vec4 u_skyLens;        // the sky's centre on the picture and the focal length the camera sees it through, then the radius of its sphere, CSS pixels
  uniform float u_skyBend;       // while 3D eases in, the share by which the flat backdrop is read where the camera's ray meets the plane ahead rather than on the screen
  uniform float u_backgroundStars;
  uniform float u_starCell;        // CSS pixels per background-star cell
  uniform float u_starDensity;     // share of cells holding a star
  uniform vec3 u_starGrid;         // the share of its cell a star may stand in, the stars a cell may hold, the rings of neighbouring cells whose stars are drawn here
  uniform vec3 u_starSphere;       // the 3D sky's cells: half a face's angle times their warp (pi / 4 for equal angles), its tangent, and how far a cell's chance follows the share of sky it covers
  uniform float u_starFlare;
  uniform vec4 u_starWarm;         // a background star: the warmest tint, and the brightness of the faintest star
  uniform vec4 u_starCool;         // the coolest tint, and what the brightest star adds to the faintest
  uniform vec4 u_starLook;         // the square of the star's radius in CSS pixels, then its twinkle: the light it keeps, the light that swings, the rate as a multiple of its own
  uniform float u_starFlareRate;   // how fast a star's flare falls once the light front has passed it: a rate for exp2 (see softKnee)
  uniform float u_dustScale;       // CSS pixels
  uniform float u_dustThreshold;
  uniform float u_lightDustContrast;
  uniform float u_dustSweep;       // how completely the matter front clears the dust it passes
  uniform float u_echoFloor;       // share of the dust's glow that stays until the matter clears it
  uniform float u_dustShock;       // brightness of the dust where the matter front strikes it
  uniform float u_dustBlow;        // CSS pixels the blast pushes the dust outward
  uniform float u_dustDrift;       // CSS pixels per second the dust drifts on its own
  uniform vec3 u_dustMotion;       // the way the dust is read from as it drifts, how fast the blast's push eases off (a rate for exp2)
  uniform vec3 u_dustNoise;        // the clouds' layers of noise (a share brings the last in partly), how much finer and how much fainter each is than the last
  uniform vec2 u_dustWarp;         // how far the slower noise curls the clouds, and how fine it is as a multiple of their size
  uniform float u_echoTintEase;    // the light's share of struck dust's colour is the freshness of its glow to this power
  uniform vec3 u_dustFlare;        // the flare at the matter front: widths of the front outside its middle, its thinness (a rate for exp2), the share of the light's colour in it
  uniform sampler2D u_orbitTrails; // the orbiting stars and the traces they leave
  uniform float u_orbits;          // 1 while there are orbiting stars; 0 leaves their layer unread
  uniform sampler2D u_frontImage;  // 3D: the particles nearer the camera than the black holes, a scene texture of their own
  uniform sampler2D u_frontLines;  // and the traces, the lattice and the flows nearer than them
  uniform vec4 u_front;            // 1 while something can stand in front of the holes (0 leaves both layers unread), 1 while the second holds lines; Front Add, the share of the light in front added to what is there instead of the brighter of the two; Front Waves, the share of the waves' and the matter front's slide the light in front takes
  uniform float u_skyGrid;        // brightness of the flat grid on the sky behind the hole; 0 turns it off
  uniform float u_gridCell;        // CSS pixels per cell of that grid
  uniform float u_skyGridLine;     // half the width of a line of that grid, CSS pixels
  uniform float u_nebula;          // the nebula's brightness; 0 turns it off
  uniform vec3 u_nebulaColor;
  uniform vec3 u_nebulaColorDeep;
  uniform vec3 u_nebulaColorCore;
  uniform vec4 u_nebulaShape;      // its clouds: CSS pixels across, the level they start at and the width of their edge, how hard the slower noise bends them
  uniform vec4 u_nebulaLook;       // how much denser the middle of a cloud is, its grain, how far the thickest cloud turns to the core colour, and the thickness that starts at
  uniform vec3 u_nebulaPatch;      // patches of the second colour: CSS pixels across, the two levels of a noise they turn over between
  uniform vec2 u_nebulaDrift;      // CSS pixels a second the clouds are read further along, so they drift the other way
  uniform vec3 u_nebulaSpace;      // the 3D sky's clouds: CSS pixels of space they have been read further along so far
  uniform vec4 u_nebulaNoise;      // its layers of noise: how many (the last by its fraction), each this many times finer, with this share of the light of the one before, and the size of the curling noise as a share of the clouds'
  uniform vec2 u_nebulaNorm;       // the grain's size as a multiple of the finest layer's fineness, and what brings the layers' sum to the span three halving layers have
  uniform float u_gridPull;        // how far the Lensed Grid is drawn in towards the hole, the Pull; 0 leaves it flat
  uniform vec2 u_gridHaze;         // device pixels a cell of it pulled in shrinks to before its lines start to merge into a haze, and those at which the haze is whole
  uniform vec4 u_gridShape;        // its shape: the share by which it lies on the sky's sphere in latitudes and longitudes rather than on its box, the power of the slant its lines keep their width by, and on the sphere the radians between two latitudes and between two longitudes
  uniform vec3 u_gridColor;        // colour of its lines

  uniform vec2 u_titleCenter;
  uniform vec2 u_titleHalfSize;
  uniform float u_titleAlpha;
  uniform float u_titleReveal;   // 1: lit by the light front; 0: shown whole
  uniform float u_titleDissolve; // 0..1 crumbling progress
  uniform float u_titleFall;     // 0..1 how far the title has been drawn towards the hole, already eased
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
  uniform float u_titleTidal;    // how much sooner the end near the hole is drawn in; 1 moves it all alike
  uniform float u_titleSpiral;   // 0 turns the title as one piece, 1 winds its inner part further round
  uniform float u_titleSpread;   // how much the specks' speeds differ
  uniform float u_titleStream;   // share of its speed a speck takes from the current around it
  uniform float u_titleOrder;    // 0 specks wink out at random, 1 the ones nearest the hole first
  uniform float u_titleTrail;    // brightness of the streak behind the moving letters
  uniform vec3 u_titleTrailShape; // its copies, how far each lags the one before as a share of the fall, the first copy's share of the streak's brightness over the count's
  uniform float u_titleHeat;     // how much the falling title brightens midway
  uniform vec4 u_titleSpeck;     // specks and currents the specks share per CSS pixel, the speed of dust beyond gravity's reach, the share of the fall a speck takes to wink out
  uniform float u_titleWinkRest; // the rest of the fall, 1 - that share
  uniform vec3 u_titleWind;      // the winding at u_titleSpiral 1: the share of the frame's height at which the turn is as set, the least and the most any part winds
  uniform vec4 u_titleBurnShape; // CSS pixels across the two grains of the fire's ragged edge, how much it eats in from the ends, its rim in ember colours
  uniform float u_titleBurnRimWidth; // how far ahead of the fire the letters glow
  uniform vec4 u_titleFallShape; // the falling dust: how much its currents differ in speed, the share of the frame's height the order of vanishing spans, the horizon's outer edge and the end of gravity's fade as multiples of their radii
  uniform vec3 u_titleDustShape; // the letters' grain: CSS pixels across its clumps, the share of it that follows them, and the rest
  uniform vec2 u_titleDustCut;   // the grain below which a letter is empty and above which it is solid
  uniform vec3 u_titleBurnEdge;  // the fire's edge: the share of its large grain, the rest, and how soft it is

  // Colours of the intro
  uniform vec3 u_colorFlash;     // the star, the glare and the white-hot core
  uniform vec3 u_colorLight;     // the light front and the flash it leaves on the title
  uniform vec3 u_colorDust;      // dust glowing after the front has passed
  uniform vec3 u_colorTitle;     // the lit letters
  uniform vec3 u_colorEmber;     // the cooling core, falling and burning title dust

  // Camera and film
  uniform float u_cameraZoom;    // zoom of the whole frame around u_zoomCenter; 1 is none
  uniform vec2 u_zoomCenter;     // the point of the frame the zoom leaves where it is, pixels
  uniform vec4 u_layerZoom;      // the zoom the particles and the orbits were drawn at: its fixed point, pixels, and the zoom
  uniform vec2 u_shake;          // jolt of the camera, pixels
  uniform float u_lensFringe;    // colour fringing of the scene at the frame's corners, pixels
  uniform float u_lensFringeEase; // the power of the distance from the middle the fringe grows by, 1 evenly
  uniform float u_vignette;      // darkening of the corners
  uniform float u_filmGrain;
  uniform float u_letterbox;     // height of each black bar, pixels
  uniform vec2 u_vignetteSpan;   // where the corners start to darken and where they are darkest, in half sizes of the frame
  uniform vec3 u_knee;           // brightness above which highlights roll off, the room above it, how fast they fill it (a rate for exp2)

  const float PI = 3.14159265359;
  // A blur spreads the letters' light thin; this brings the glow back to a visible level
  const float TITLE_HALO_GAIN = 1.5;
  // Dust Pull is the distance a letter standing that far from the hole would be drawn; this turns
  // it into the pull that draws the whole title in
  const float TITLE_FALL_GAIN = 2.5;
  // Halvings that find the node the Lensed Grid's pull brings to a point; a straight line across the last
  // one leaves it well under a pixel off
  const int GRID_PULL_STEPS = 8;
  const int NEBULA_LAYERS = ${NEBULA_LAYERS};
  const int STARS_PER_CELL = ${STARS_PER_CELL};
  const int STAR_RINGS = ${STAR_RINGS};
  // Impact parameter of the photon sphere, Schwarzschild radii: a ray aimed closer falls in
  const float CRITICAL_IMPACT = 2.5980762;
  // Farthest a traced ray reads the scene, in units of the projection: near the direction straight behind
  // the camera the stereographic plane runs off to infinity
  const float TRACE_FAR = 64.0;
  const float SHADOW_SAMPLES = ${SHADOW_SAMPLES}.0;

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
  // on top gives them grain. Layers, fineness, roughness and the curl are u_dustNoise and u_dustWarp
  float dust (vec2 cssPx) {
    vec2 p = cssPx / u_dustScale;
    p += u_dustWarp.x * (vec2(valueNoise(p * u_dustWarp.y + 3.1), valueNoise(p * u_dustWarp.y + 17.4)) - 0.5);
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float n = 0.0;
    float amplitude = 0.5;
    float total = 0.0;
    for (int i = 0; i < 6; i++) {
      float share = clamp(u_dustNoise.x - float(i), 0.0, 1.0);
      if (share <= 0.0) break;
      n += share * amplitude * valueNoise(p);
      total += share * amplitude;
      p = turn * p * u_dustNoise.y + 11.7;
      amplitude *= u_dustNoise.z;
    }
    // Spread as three layers halving spread it, 0..0.875 around 0.44, whatever the layers. The threshold
    // slides the level the clouds start at, from haze everywhere to a few thin wisps
    n *= 0.875 / total;
    float edge = mix(0.2, 0.62, u_dustThreshold);
    float cloud = smoothstep(edge, edge + 0.22, n);
    return cloud * (0.45 + 0.55 * cloud) * (0.7 + 0.3 * valueNoise(p * 1.7));
  }

  // How far the camera's lens splits red from blue at a pixel: Lens Fringe at the corners, towards the
  // middle as the distance from it to the power u_lensFringeEase (1 grows evenly)
  vec2 fringeSplit (vec2 screen) {
    vec2 away = (screen - 0.5 * u_resolution) / (0.5 * length(u_resolution));
    return away * pow(max(length(away), 1e-4), u_lensFringeEase - 1.0) * u_lensFringe;
  }

${DENT_GLSL}
  // Where the Lensed Grid's pull draws a node this many pixels from the black hole: the lattice's law, the
  // slowing of time in shadow radii times the Pull, taken as R -> R^2 / (R + wish), so no line folds over
  float pulledIn (float away) {
    float wish = u_gridPull * (away >= u_horizon ? u_horizon * dent(away, u_horizon) : away);
    return away * away / (away + wish);
  }

  // How bright the Lensed Grid's line is at a point miss CSS pixels of the screen from it, in cells of
  // cellSeen CSS pixels, drawn squeeze times smaller by its pull: its lines keep their width, and where the
  // pulled cells shrink to a few pixels they merge into a haze of the light they share
  float gridLineLight (float miss, float cellSeen, float squeeze) {
    float line = clamp((u_skyGridLine - miss * u_cameraZoom / squeeze) * u_pixelRatio + 0.5, 0.0, 1.0);
    if (squeeze > 1.0) {
      float cellPx = cellSeen * u_cameraZoom * u_pixelRatio / squeeze;
      line = mix(line, min(4.0 * u_skyGridLine * u_pixelRatio / cellPx, 1.0), smoothstep(u_gridHaze.x, u_gridHaze.y, cellPx));
    }
    return line;
  }

  // The value noise of a place in space, for the sky round the 3D camera
  float hash13 (vec3 p) {
    vec3 p3 = fract(p * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Spread as widely about its middle as valueNoise is: each way the noise is blended across narrows it by
  // the root of 52 / 70, so the third is undone by its inverse, 1.1602, and a level cuts the clouds of both
  // at the same share of the sky
  float valueNoise3 (vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    vec2 e = vec2(1.0, 0.0);
    return 0.5 + 1.1602 * (mix(
      mix(mix(hash13(i), hash13(i + e.xyy), u.x), mix(hash13(i + e.yxy), hash13(i + e.xxy), u.x), u.y),
      mix(mix(hash13(i + e.yyx), hash13(i + e.xyx), u.x), mix(hash13(i + e.yxx), hash13(i + e.xxx), u.x), u.y),
      u.z
    ) - 0.5);
  }

  vec3 hash33 (vec3 p) {
    vec3 p3 = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }

  // Three value noises of a place in space at the cost of one: each corner of the cell draws three numbers.
  // Spread as valueNoise3 is
  vec3 valueNoise33 (vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    vec2 e = vec2(1.0, 0.0);
    return 0.5 + 1.1602 * (mix(
      mix(mix(hash33(i), hash33(i + e.xyy), u.x), mix(hash33(i + e.yxy), hash33(i + e.xxy), u.x), u.y),
      mix(mix(hash33(i + e.yyx), hash33(i + e.xyx), u.x), mix(hash33(i + e.yxx), hash33(i + e.xxx), u.x), u.y),
      u.z
    ) - 0.5);
  }

  // The nebula: clouds made as the opening's dust is, with every number its own. The noise is read
  // through a slower one that bends it into wisps (u_nebulaShape.w), sharpened into clouds from a level
  // (yz), made denser in the middle (u_nebulaLook.x) and grained (y). Its colour turns to the second one in
  // patches (u_nebulaPatch) and to the core colour where the cloud is thickest (u_nebulaLook.zw). This is
  // that light, from the noise of the clouds, of their grain and of the patches
  vec3 nebulaShade (float n, float grain, float tone) {
    float cloud = smoothstep(u_nebulaShape.y, u_nebulaShape.y + u_nebulaShape.z, n);
    float density = cloud * (1.0 - u_nebulaLook.x + u_nebulaLook.x * cloud) * (1.0 - u_nebulaLook.y + u_nebulaLook.y * grain);
    float other = smoothstep(u_nebulaPatch.y, u_nebulaPatch.z, tone);
    vec3 tint = mix(u_nebulaColor, u_nebulaColorDeep, other);
    if (u_nebulaLook.z > 0.0) tint = mix(tint, u_nebulaColorCore, u_nebulaLook.z * smoothstep(u_nebulaLook.w, 1.0, cloud));
    return tint * density;
  }

  // The layers of noise the nebula's clouds are made of (Detail, u_nebulaNoise.x), read at p, which they leave
  // at the finest layer's place: each u_nebulaNoise.y times finer and turned, each with u_nebulaNoise.z of the
  // light of the one before, the last by the fraction of Detail it stands for, so Detail moves smoothly along
  // a track. Three whole layers, the default, are read in a loop of a fixed length
  float nebulaLayers (inout vec2 p) {
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float n = 0.0;
    float amplitude = 0.5;
    if (u_nebulaNoise.x == 3.0) {
      for (int i = 0; i < 3; i++) {
        n += amplitude * valueNoise(p);
        p = turn * p * u_nebulaNoise.y + 11.7;
        amplitude *= u_nebulaNoise.z;
      }
      return n;
    }
    for (int i = 0; i < NEBULA_LAYERS; i++) {
      float share = clamp(u_nebulaNoise.x - float(i), 0.0, 1.0);
      if (share <= 0.0) break;
      n += amplitude * share * valueNoise(p);
      p = turn * p * u_nebulaNoise.y + 11.7;
      amplitude *= u_nebulaNoise.z;
    }
    return n;
  }

  // The same in space, each layer turned in space, so no axis of the noise's cells shows
  float nebulaLayers3 (inout vec3 p) {
    mat3 turn = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
    float n = 0.0;
    float amplitude = 0.5;
    if (u_nebulaNoise.x == 3.0) {
      for (int i = 0; i < 3; i++) {
        n += amplitude * valueNoise3(p);
        p = turn * p * u_nebulaNoise.y + 11.7;
        amplitude *= u_nebulaNoise.z;
      }
      return n;
    }
    for (int i = 0; i < NEBULA_LAYERS; i++) {
      float share = clamp(u_nebulaNoise.x - float(i), 0.0, 1.0);
      if (share <= 0.0) break;
      n += amplitude * share * valueNoise3(p);
      p = turn * p * u_nebulaNoise.y + 11.7;
      amplitude *= u_nebulaNoise.z;
    }
    return n;
  }

  // The flat mode's nebula, a backdrop: its noise is read at the CSS pixel. The layers' sum is brought to the
  // span three halving layers have (u_nebulaNorm.y), so Sparseness cuts the clouds at the same level
  vec3 nebulaFlat (vec2 cssPx) {
    vec2 p = cssPx / u_nebulaShape.x;
    p += u_nebulaShape.w * (vec2(valueNoise(p * u_nebulaNoise.w + 3.1), valueNoise(p * u_nebulaNoise.w + 17.4)) - 0.5);
    float n = nebulaLayers(p);
    return nebulaShade(n * u_nebulaNorm.y, valueNoise(p * u_nebulaNorm.x), valueNoise(cssPx / u_nebulaPatch.x + 23.0));
  }

  // The 3D camera's nebula, on the sphere of the sky: the same clouds made of a noise of space, read where a
  // direction meets the sky's sphere, as many CSS pixels round as the focal length unless Sky Size sets it,
  // so straight ahead they are as large as the flat mode's and they are the same size and grain in every
  // direction
  vec3 nebulaSphere (vec3 onSphere) {
    vec3 p = onSphere / u_nebulaShape.x;
    p += u_nebulaShape.w * (valueNoise33(p * u_nebulaNoise.w + 3.1) - 0.5);
    float n = nebulaLayers3(p);
    mat3 turn = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
    return nebulaShade(n * u_nebulaNorm.y, clamp(valueNoise3(p * u_nebulaNorm.x), 0.0, 1.0), valueNoise3(turn * onSphere / u_nebulaPatch.x + 23.0));
  }

  // The sky is infinitely far round the scene, and the 3D camera turns inside it: the stars and the nebula lie
  // on a sphere, the Lensed Grid on the faces of a box, where its lines are straight, or on the sphere in
  // latitudes and longitudes. Straight on the camera looks at the middle of the box's face 0, which is the flat
  // sky, CSS pixel for CSS pixel. The sky's centre and focal length come in u_skyLens.xyz: the middle of the
  // screen and half its long side, the centre moved toward the field's vanishing point by Sky Centre. The
  // sphere is u_skyLens.w CSS pixels round (the focal length unless Sky Size sets it).
  // The direction in the scene a point of the picture, CSS pixels, looks along
  vec3 skyRay (vec2 cssPx) {
    vec3 ray = vec3(cssPx - u_skyLens.xy, u_skyLens.z);
    return ray.x * u_turnRight + ray.y * u_turnDown + ray.z * u_turnAhead;
  }

  // The face of the box a direction meets and the place on it, CSS pixels from its middle: (x, y, face).
  // Faces 0 and 1 lie across z, 2 and 3 across x, 4 and 5 across y, the odd one on the negative side. Two
  // faces that meet share the coordinate along their edge, so a line of the grid runs on across it
  vec3 skyFace (vec3 ray, float focal) {
    vec3 size = abs(ray);
    if (size.z >= size.x && size.z >= size.y) return vec3(ray.xy * (focal / size.z), ray.z < 0.0 ? 1.0 : 0.0);
    if (size.x >= size.y) return vec3(ray.zy * (focal / size.x), ray.x < 0.0 ? 3.0 : 2.0);
    return vec3(ray.xz * (focal / size.y), ray.y < 0.0 ? 5.0 : 4.0);
  }

  // The direction in the scene of a place on a face, skyFace the other way
  vec3 faceRay (vec2 onFace, float face, float focal) {
    float side = mod(face, 2.0) > 0.5 ? -focal : focal;
    if (face < 1.5) return vec3(onFace, side);
    if (face < 3.5) return vec3(side, onFace.y, onFace.x);
    return vec3(onFace.x, side, onFace.y);
  }

  // Where the flat mode's backdrop is read at a point of the picture: on the screen, or while the camera eases
  // into 3D, by Ease Bend (u_skyBend), where the camera's ray meets the plane of the box's face ahead, so the
  // backdrop turns with the camera as the sphere comes in, as the Lensed Grid does. A point of that plane seen
  // at a slant is farther, and its light falls as a star's does with the square of its distance; nothing of
  // it is behind the plane. shown is the share of its light kept
  vec2 flatAt (vec2 cssPx, out float shown) {
    shown = 1.0;
    if (u_skyBend <= 0.0) return cssPx;
    vec3 ray = skyRay(cssPx);
    float ahead = ray.z / length(ray);
    shown = 1.0 - u_skyBend + u_skyBend * max(ahead, 0.0) * max(ahead, 0.0);
    if (ray.z <= 0.0) return cssPx;
    return mix(cssPx, u_skyLens.xy + ray.xy * (u_skyLens.z / ray.z), u_skyBend);
  }

  // The light of a star, by the key of its cell, the draw that put it there, and its distance from the
  // point, CSS pixels; it flares as the light front passes
  vec3 starShade (vec2 key, float presence, float d, float flare) {
    float brightness = hash12(key + 3.7);
    float twinkle = u_starLook.y + u_starLook.z * sin(u_time * (u_starLook.w * (2.0 + 3.0 * brightness)) + presence * 400.0);
    vec3 tint = mix(u_starWarm.rgb, u_starCool.rgb, hash12(key + 29.0));
    return tint * exp(-d * d / u_starLook.x) * (u_starWarm.a + u_starCool.a * brightness * brightness) * twinkle * (1.0 + flare);
  }

  // The flat mode's stars, a backdrop: up to Stars per Cell (u_starGrid.y) per square cell of the screen, each
  // somewhere in the middle Star Placement (x) of it, and drawn from its own cell and the rings of cells
  // round it Star Neighbours (z) gives, so a star larger than its cell is whole. One cell holding one star,
  // the default, is read straight; the loops stop at the counts the knobs give
  vec3 flatCellStar (vec2 cssPx, vec2 cell, float k, float flare) {
    vec2 key = cell + k * vec2(419.0, 631.0);
    float presence = hash12(key);
    if (presence > u_starDensity) return vec3(0.0);
    vec2 position = (cell + 0.5 + u_starGrid.x * (vec2(hash12(key + 7.3), hash12(key + 13.1)) - 0.5)) * u_starCell;
    // A star is a point of light: the zoom moves the stars apart and leaves each the size it was
    return starShade(key, presence, length(cssPx - position) * u_cameraZoom, flare);
  }

  vec3 flatStar (vec2 cssPx, float flare) {
    vec2 home = floor(cssPx / u_starCell);
    if (u_starGrid.y < 1.5 && u_starGrid.z < 0.5) return flatCellStar(cssPx, home, 0.0, flare);
    float rings = u_starGrid.z;
    vec3 light = vec3(0.0);
    for (int y = 0; y <= 2 * STAR_RINGS; y++) {
      if (float(y) > 2.0 * rings) break;
      for (int x = 0; x <= 2 * STAR_RINGS; x++) {
        if (float(x) > 2.0 * rings) break;
        vec2 cell = home + vec2(float(x), float(y)) - rings;
        for (int k = 0; k < STARS_PER_CELL; k++) {
          if (float(k) >= u_starGrid.y) break;
          light += flatCellStar(cssPx, cell, float(k), flare);
        }
      }
    }
    return light;
  }

  // The 3D camera's stars, on the sphere of the sky. Its directions are cut by the faces of a cube, and each
  // face into cells, a whole number of them across, so an edge of a face is an edge of cells on both sides.
  // A face's coordinate x, -1..1, lies at tan(w x pi / 4) / tan(w pi / 4) on it, w the Cell Warp
  // (u_starSphere.xy): at 1 the cells are of equal angles both ways and cover much the same patch of sky
  // everywhere, from 1 in the middle of a face to 1 / sqrt(2) in the middle of an edge; toward 0 they are of
  // equal lengths on the face and shrink toward its edges. A cell holds its star by the share of sky it covers
  // as far as Even Sky (z) says, so at 1 there are as many stars to a patch of sky in every direction, and as
  // many straight ahead as in the flat mode. Neighbouring cells are those of the same face: a star larger
  // than its cell is still cut where two faces meet. The star k of a cell of a face, of cells across it
  vec3 sphereCellStar (vec2 cssPx, vec2 cell, float face, float cells, float k, float flare) {
    float halfAngle = u_starSphere.x;
    float tangent = u_starSphere.y;
    vec2 key = cell + face * vec2(1543.0, 2741.0) + k * vec2(419.0, 631.0);
    float presence = hash12(key);
    if (presence > u_starDensity) return vec3(0.0);
    vec2 middle = tan(((cell + 0.5) / cells * 2.0 - 1.0) * halfAngle) / tangent;
    vec2 slope = 1.0 + middle * middle * tangent * tangent;
    float area = slope.x * slope.y / pow(1.0 + dot(middle, middle), 1.5);
    if (presence > u_starDensity * mix(1.0, area, u_starSphere.z)) return vec3(0.0);
    vec2 at = cell + 0.5 + u_starGrid.x * (vec2(hash12(key + 7.3), hash12(key + 13.1)) - 0.5);
    vec2 place = tan((at / cells * 2.0 - 1.0) * halfAngle) / tangent;
    // The star is set where the camera sees its direction, so it stays round wherever it is
    vec3 star = faceRay(place, face, 1.0);
    vec3 seen = vec3(dot(u_turnRight, star), dot(u_turnDown, star), dot(u_turnAhead, star));
    if (seen.z <= 0.0) return vec3(0.0);
    return starShade(key, presence, length(cssPx - u_skyLens.xy - seen.xy * (u_skyLens.z / seen.z)) * u_cameraZoom, flare);
  }

  vec3 sphereStar (vec2 cssPx, float flare) {
    vec3 onFace = skyFace(skyRay(cssPx), 1.0);
    float cells = max(floor(2.0 * u_starSphere.x * u_skyLens.w / (u_starSphere.y * u_starCell) + 0.5), 1.0);
    vec2 home = min(floor((atan(onFace.xy * u_starSphere.y) / u_starSphere.x * 0.5 + 0.5) * cells), cells - 1.0);
    if (u_starGrid.y < 1.5 && u_starGrid.z < 0.5) return sphereCellStar(cssPx, home, onFace.z, cells, 0.0, flare);
    float rings = u_starGrid.z;
    vec3 light = vec3(0.0);
    for (int y = 0; y <= 2 * STAR_RINGS; y++) {
      if (float(y) > 2.0 * rings) break;
      for (int x = 0; x <= 2 * STAR_RINGS; x++) {
        if (float(x) > 2.0 * rings) break;
        vec2 cell = home + vec2(float(x), float(y)) - rings;
        if (cell.x < 0.0 || cell.y < 0.0 || cell.x > cells - 1.0 || cell.y > cells - 1.0) continue;
        for (int k = 0; k < STARS_PER_CELL; k++) {
          if (float(k) >= u_starGrid.y) break;
          light += sphereCellStar(cssPx, cell, onFace.z, cells, float(k), flare);
        }
      }
    }
    return light;
  }

  // Static distant stars: the flat mode's backdrop, the 3D camera's sphere, and while the camera eases from
  // one to the other both, in its share
  vec3 backgroundStar (vec2 cssPx, float flare) {
    vec3 light = vec3(0.0);
    if (u_skySphere < 1.0) {
      float shown;
      vec2 at = flatAt(cssPx, shown);
      light = (1.0 - u_skySphere) * shown * flatStar(at, flare);
    }
    if (u_skySphere > 0.0) light += u_skySphere * sphereStar(cssPx, flare);
    return light;
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

  // Where on the title a point of the screen reads from while the title falls into the black hole.
  // The pull is strong close to the hole and weak far from it, so the near end of the words goes
  // first and is drawn out towards the hole while the far end still stands; the orbital force winds
  // the inner part further round than the outer
  vec2 titleSource (vec2 fromHole, float holeDist, float fall) {
    float reach = TITLE_FALL_GAIN * u_titleDrift * u_titlePull * fall;
    // u_titleTidal is how much sooner the near end goes: 1 slides the whole title the same distance,
    // higher values leave the far end standing while the near end is already drawn out
    float pulled = pow(holeDist, u_titleTidal) + sign(reach) * pow(abs(reach), u_titleTidal);
    float stretch = pow(max(pulled, 0.0), 1.0 / u_titleTidal) / holeDist;
    float turn = u_titleSwirl * fall * mix(1.0, clamp(u_titleWind.x * u_resolution.y / holeDist, u_titleWind.y, u_titleWind.z), u_titleSpiral);
    float c = cos(turn);
    float s = sin(turn);
    return u_hole + vec2(c * fromHole.x - s * fromHole.y, s * fromHole.x + c * fromHole.y) * stretch;
  }

  // Leaves everything below the knee untouched and rolls highlights off smoothly instead of clipping.
  // The fall-offs whose time or strength is a uniform are written as 2^(x * rate), with the rate worked
  // out by the renderer (expRate): exp(-x / 0.2) with the number written here compiles to that very form,
  // its constant folded in, and only the same form with the same constant draws the same bytes
  vec3 softKnee (vec3 x) {
    vec3 over = max(x - u_knee.x, 0.0);
    return min(x, u_knee.x) + u_knee.y * (1.0 - exp2(over * u_knee.z));
  }

  // Where a point of the scene lies in the layers the particles and the orbits are drawn into, which
  // hold the scene already magnified
  vec2 layerPoint (vec2 px) {
    return u_layerZoom.xy + (px - u_layerZoom.xy) * u_layerZoom.z;
  }

  // The particle scene at a point of its layer; rays that leave the screen reflect off its edge instead
  // of smearing the edge pixels
  vec3 scene (vec2 layerPx) {
    return texture2D(u_image, 1.0 - abs(1.0 - mod(layerPx / u_resolution, 2.0))).rgb;
  }

  // What is drawn at a point of the layers: the particles and, while there are any, the orbiting stars
  // and the lattice, the brighter of the two
  vec3 drawn (vec2 layerPx) {
    vec3 color = scene(layerPx);
    if (u_orbits > 0.0) color = max(color, texture2D(u_orbitTrails, 1.0 - abs(1.0 - mod(layerPx / u_resolution, 2.0))).rgb);
    return color;
  }

  // What is drawn at a point of the front layers, the same way: the particles in front of the holes and,
  // while there are any, the lines in front of them
  vec3 drawnInFront (vec2 layerPx) {
    vec2 at = 1.0 - abs(1.0 - mod(layerPx / u_resolution, 2.0));
    vec3 color = texture2D(u_frontImage, at).rgb;
    if (u_front.y > 0.0) color = max(color, texture2D(u_frontLines, at).rgb);
    return color;
  }

  // The stylized lens round a hole whose Einstein ring is einstein pixels: where it takes the ray seen at
  // rel from the hole, dist away as the lens measures it, and its pull there (bend)
  vec2 stylizedLens (vec2 rel, float dist, float einstein, out float bend) {
    float ratio = einstein / max(dist, 0.0001);
    bend = ratio * ratio;
    if (u_falloff != 2.0) bend *= pow(u_falloffPivot / max(dist, 0.0001), u_falloff - 2.0);
    bend = min(bend, u_maxBend);
    if (bend * dist * (1.0 + abs(u_swirl)) <= 0.01) return rel;
    // The original canvas scaled the picture around the hole by the cosine of the pull: a bubble whose
    // distortion dies off with the cube of the distance, rippling into nested rings inside the ring; a
    // power of the pull there (Bubble) keeps it nearer the ring and folds more rings, or spreads it.
    // A point mass, r * (1 - pull), bends rays far across the screen instead, and inside the ring it
    // turns negative: the ray comes from the other side of the hole, which is the mirrored second
    // image a real lens shows there. u_lensReach blends the two; both are zero at the ring, so the
    // ring stays where it is
    float wave = cos(0.5 * PI * (u_lensBubble == 1.0 ? bend : pow(bend, u_lensBubble)));
    vec2 lensed = rel * mix(wave, 1.0 - bend, u_lensReach);
    // Every ray at the ring comes from the single point right behind the hole, which would smear a
    // few pixels into a flat milky band. Rays stop short of that point, so the ring shows real detail
    float sourceRadius = length(lensed);
    float lensCore = u_lensCore * einstein;
    lensed *= sqrt(sourceRadius * sourceRadius + lensCore * lensCore) / max(sourceRadius, 0.0001);
    // The pull at the shadow's edge grows with the square of the lens radius. The twist follows it
    // only up to a limit, so a wider lens is a bigger bubble, not a tighter spiral
    float twist = u_swirl * min(bend, u_twistLimit);
    float c = cos(twist);
    float s = sin(twist);
    return vec2(c * lensed.x - s * lensed.y, s * lensed.x + c * lensed.y);
  }

  // Where the second black hole moves the ray seen at a point this far from it: in towards it by E^2 / r,
  // as a point mass does, held in at Lens Core of its shadow's radius; Lens Style blends in the stylized
  // lens's shape at its own Einstein ring
  vec2 companionBend (vec2 fromCompanion) {
    float closest = u_companionLens.x * u_companion.z;
    vec2 shift = -fromCompanion * (u_companion.w * u_companion.w / max(dot(fromCompanion, fromCompanion), closest * closest));
    if (u_companionLens.y > 0.0) {
      float pull;
      shift = mix(shift, stylizedLens(fromCompanion, length(fromCompanion), u_companion.w, pull) - fromCompanion, u_companionLens.y);
    }
    return shift;
  }

  // Carlson's symmetric elliptic integral R_F(x, y, z), by duplication: seven steps hold to float precision
  // even beside the photon sphere, where it runs off to infinity
  float carlsonRF (vec3 v) {
    for (int i = 0; i < 7; i++) {
      vec3 root = sqrt(v);
      v = 0.25 * (v + root.x * (root.y + root.z) + root.y * root.z);
    }
    float mean = (v.x + v.y + v.z) / 3.0;
    vec3 d = 1.0 - v / mean;
    float e2 = d.x * d.y - d.z * d.z;
    float e3 = d.x * d.y * d.z;
    return (1.0 + (e2 / 24.0 - 0.1 - 3.0 * e3 / 44.0) * e2 + e3 / 14.0) / sqrt(mean);
  }

  // dphi/du of a ray climbing out through 1 / v
  float traceClimb (float b, float v) {
    return b / sqrt(1.0 - b * b * v * v * (1.0 - v));
  }

  // Radians a ray travels round a black hole that does not spin, from the camera at 1 / u Schwarzschild radii
  // until it is off to infinity, for a ray that leaves the camera theta from the direction of the hole. Its
  // orbit obeys (du/dphi)^2 = 1/b^2 - u^2 + u^3; the roots u1 < 0 < u2 <= u3 are written so that none is the
  // small difference of two large numbers, and u2 is the closest the ray comes. The same sweep, explained, is
  // traceSweep in lens_trace.ts. A ray aimed inside the photon sphere is taken just outside it: the shadow
  // covers it
  float traceSweep (float theta, float u) {
    float b = sin(theta) / (u * sqrt(1.0 - u));
    bool inward = theta < 0.5 * PI;
    if (inward) b = max(b, CRITICAL_IMPACT * 1.00001);
    if (b > CRITICAL_IMPACT) {
      float angle = 2.0 * asin(CRITICAL_IMPACT / b);
      float sixth = sin(angle / 6.0);
      float u1 = -4.0 / 3.0 * sin(PI / 3.0 - angle / 6.0) * sixth;
      float u2 = 4.0 / 3.0 * sin(PI / 3.0 + angle / 6.0) * sixth;
      float gap = 1.1547005 * sin(PI / 3.0 - angle / 3.0);
      float spread = u2 - u1;
      float away = 2.0 * sqrt(u2) * carlsonRF(vec3(-u1 * gap, spread * gap, (gap + u2) * spread));
      // How far the ray still has to fall, u2 - u, from the orbit's equation at the camera rather than as a
      // difference: a ray leaving square to the hole is at its closest already, and the difference is lost
      // there in the error of asin and sin
      float cotangent = cos(theta) / sin(theta);
      float left = u * u * (1.0 - u) * cotangent * cotangent / ((u - u1) * (u2 + gap - u));
      float near = 2.0 * sqrt(left) * carlsonRF(vec3((u - u1) * gap, spread * gap, (gap + left) * spread));
      return away + (inward ? near : -near);
    }
    // Facing away from the hole below the photon sphere's b, the ray only climbs out: four Gauss-Legendre points
    return 0.5 * u * (0.3478548 * (traceClimb(b, u * 0.0694318) + traceClimb(b, u * 0.9305682)) +
      0.6521452 * (traceClimb(b, u * 0.3300095) + traceClimb(b, u * 0.6699905)));
  }

  // The ray past a spinning hole (kerr_glsl.ts): kerrRay(psi, chi, hole, out dir)
  ${KERR_GLSL}

  // The ray through a point of a shadow, offset from its hole and dist from it in the shadow's own measure,
  // seen at scale pixels of tan(angle / 2) from the hole about an axis turned axisTurn on the screen: psi
  // from the line to the hole and chi round it from the axis, each as (sine, cosine)
  void horizonAim (vec2 offset, float dist, float scale, float axisTurn, out vec2 psi, out vec2 chi) {
    float slope = dist / scale;
    psi = vec2(2.0 * slope, 1.0 - slope * slope) / (1.0 + slope * slope);
    vec2 across = vec2(offset.x, -offset.y) / max(length(offset), 0.0001);
    vec2 axis = vec2(cos(axisTurn), sin(axisTurn));
    chi = vec2(across.y * axis.x - across.x * axis.y, across.x * axis.x + across.y * axis.y);
  }

  // The grid on a horizon seen through a point of its shadow: the ray through it is followed back to where
  // it left the horizon (kerrHorizonFrom), and the latitude and longitude there are returned in cells, each
  // of its own size (u_horizonTurn.z a radian of latitude, u_horizonTurn.w round the equator). The longitude
  // is the horizon's own: the camera's meridian's, plus how far round the ray took it, less how far the
  // horizon has turned by the time the light left it, Omega_H times the camera's time less the light's
  // delay. hole = (spin, cosine and sine of the axis's angle to the line to the camera, 1 / the camera's
  // distance in Schwarzschild radii); look = (pixels of tan(angle / 2) from the hole, the axis's turn on
  // screen, the camera's meridian less the horizon's turn, Omega_H)
  vec2 horizonCells (vec2 offset, float dist, vec4 hole, vec4 look) {
    vec2 psi;
    vec2 chi;
    horizonAim(offset, dist, look.x, look.y, psi, chi);
    vec4 left = kerrHorizonFrom(psi, chi, hole);
    float latitude = atan(length(left.xy), left.z);
    float longitude = atan(left.y, left.x) + look.z + look.w * left.w;
    return vec2(latitude * u_horizonTurn.z, longitude * u_horizonTurn.w / (2.0 * PI));
  }

  // How much of the line light of a horizon's grid a point of its shadow shows. Its lines keep a width in
  // pixels of the screen: how many cells a pixel spans is read from two more rays a pixel to the right and a
  // pixel down, the derivative the width is measured by. Where the cells shrink to a few pixels, toward the
  // shadow's edge where the rays wind round the hole ever more times and toward the poles, the lines give
  // way to the light they would share, up to a ceiling, as a cell shrinks from u_horizonLook.x pixels of the
  // screen to u_horizonLook.y
  float horizonLines (vec2 offset, float dist, float oval, float px, vec4 hole, vec4 look) {
    vec2 toRight = offset + vec2(px, 0.0);
    vec2 toBelow = offset + vec2(0.0, px);
    vec2 here = horizonCells(offset, dist, hole, look);
    vec2 alongX = horizonCells(toRight, length(toRight) * oval, hole, look) - here;
    vec2 alongY = horizonCells(toBelow, length(toBelow) * oval, hole, look) - here;
    alongX.y -= u_horizonTurn.w * floor(alongX.y / u_horizonTurn.w + 0.5);
    alongY.y -= u_horizonTurn.w * floor(alongY.y / u_horizonTurn.w + 0.5);
    vec2 perPixel = max(vec2(length(vec2(alongX.x, alongY.x)), length(vec2(alongX.y, alongY.y))), 0.000001);
    vec2 fromLine = abs(fract(here + 0.5) - 0.5) / perPixel;
    vec2 line = clamp(u_horizonGrid.w - fromLine + 0.5, 0.0, 1.0);
    vec2 haze = min(2.0 * u_horizonGrid.w * perPixel, u_horizonAxis.w);
    line = mix(haze, line, smoothstep(u_horizonLook.y, u_horizonLook.x, 1.0 / perPixel));
    return max(line.x, line.y);
  }

  // The shift of the light leaving a turning horizon toward the camera, its frequency there over its own:
  // 1 / (1 - Omega_H lambda), lambda the ray's angular momentum about the axis over its energy. That is the
  // part the horizon's turn gives, the side turning toward the camera blue, the other red; the part its
  // depth gives would redden all of it without end, since no light leaves a real horizon, and is left out
  float horizonShift (vec2 offset, float dist) {
    vec2 psi;
    vec2 chi;
    horizonAim(offset, dist, u_horizonGrid.z, u_horizonAxis.z, psi, chi);
    float radial;
    vec4 aim = kerrAim(psi, chi, u_spin.x, u_horizonAxis.x, max(u_horizonAxis.y, 1e-5), u_horizonGrid.y, radial);
    return 1.0 / max(1.0 - u_horizonTurn.y * aim.x, 0.2);
  }

  // A colour as light shifted by g: its three channels taken as a spectrum of three bins and moved toward
  // blue for g above 1, toward red below, a bin an octave at most, and brightened as g^4, the light of every
  // frequency together; all of it by the share given, 0 leaving the colour as it is
  vec3 shiftedLight (vec3 c, float g, float share) {
    float t = clamp(log2(g), -1.0, 1.0) * share;
    vec3 moved = t > 0.0
      ? vec3(c.r * (1.0 - t), c.g * (1.0 - t) + c.r * t, c.b + c.g * t)
      : vec3(c.r - c.g * t, c.g * (1.0 + t) - c.b * t, c.b * (1.0 + t));
    return moved * pow(g, 4.0 * share);
  }

  // How strong a gravitational wave is at a distance from where it left: its strain falls as 1 / r, since
  // the same energy crosses an ever larger sphere. Closer than the edge there is no wave yet, only the
  // field of the source itself, which fades to nothing at the centre
  float waveReach (float dist, float edge) {
    float share = dist / edge;
    return share < 1.0 ? share * share : 1.0 / share;
  }

  // A quadrupole in the plane the pair circles in (u_pairPlane) read along a direction of the picture:
  // c.x times (x*x - y*y) plus c.y times 2*x*y, for x and y the parts of v along the plane's two directions
  // as the camera sees them. Facing the camera they are v itself; as the plane turns edge-on one of them
  // shrinks to nothing, so the pattern flattens with it
  float planeQuad (vec2 v, vec2 c) {
    float x = dot(v, u_pairPlane.xy);
    float y = dot(v, u_pairPlane.zw);
    return c.x * (x * x - y * y) + c.y * 2.0 * x * y;
  }

  void main () {
    // Where this pixel is on the screen, and where the zoomed and jolted camera looks through it
    vec2 screen = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 frag = u_zoomCenter + (screen - u_zoomCenter) / u_cameraZoom + u_shake;
    // Pixels of the scene under one pixel of the screen: edges and hairlines are measured in it, so the
    // zoom leaves them as sharp and as thin as they were
    float px = 1.0 / u_cameraZoom;
    // A second black hole nearer the camera bends the ray before it reaches the first: the first, its
    // shadow, its lens and its ring are seen where that share of the bend takes the ray
    vec2 companionShift = vec2(0.0);
    if (u_companion.z > 0.0 && u_companion.w > 0.0 && u_pairDepth.x > 0.0) companionShift = companionBend(frag - u_companion.xy);
    vec2 offset = frag + companionShift * u_pairDepth.x - u_hole;
    float dist = length(offset);
    // A ringing horizon is an oval: longer along one axis by the share it is shorter along the other, so
    // it keeps its area, as a quadrupole does. The shadow, the lens and the photon ring all measure their
    // distance in that oval, so they wobble together. The oval lies in the plane the pair circled in, and
    // its outline seen from any side is, to first order, 1 + e ((n.a)^2 - (n.a')^2) for n the direction on
    // the picture, a its long axis and a' the one across it: planeQuad, which flattens as the plane turns
    // edge-on
    if (u_holeOval != vec2(0.0)) {
      dist /= 1.0 + planeQuad(offset / max(dist, 0.0001), u_holeOval);
    }
    // A spinning hole's shadow is not round: its edge in this direction, from the outline the main thread
    // worked out (kerr_shadow.ts), turned with the axis. The shadow, the photon ring and the traced lens's
    // capture all follow it
    float shadowEdge = u_horizon;
    if (u_spin.x > 0.0) {
      float around = (atan(-offset.y, offset.x) - u_spin.w) / (2.0 * PI);
      shadowEdge *= texture2D(u_shadowShape, vec2(around + 0.5 / SHADOW_SAMPLES, 0.25)).r;
    }
    // 1 where a traced ray fell into a spinning hole outside the outline drawn, which is only ever a hair
    float fallen = 0.0;
    vec2 samplePx = frag;
    // How far the waves and the matter front slide the picture here, which Front Waves gives the light in front
    vec2 waveMoved = vec2(0.0);

    // Gravitational wave: the horizon's wobble carried outward at the speed of light. Each point shows the
    // wobble the horizon had when the wave left it, u_gravityWaveTime - r / c ago. A gravitational wave
    // moves nothing along its way: what it stretches and squeezes lies across it. So the sky is not pushed
    // out and in, as sound would push it, but slid sideways, most where the oval's long axis stood at 45
    // degrees to the direction, and it weakens as 1 / r.
    // The picture shows the slice of the wave through its source that faces the camera. The oval is a
    // quadrupole c in the plane the pair circled in; at a point in the direction n from the source, with t
    // across it on the picture, what the wave stretches along t is t.M.t + n.M.n / 2, so the slide is
    // -(2 planeQuad(t, c) + planeQuad(n, c)). Straight on that is planeQuad(n, c), the sine of twice the
    // angle between n and the oval's long axis; seen along the plane the wave is twice as strong along the
    // pair's axis as in its plane, as a binary's is
    vec2 fromCenter = frag - u_center;
    float centerDist = length(fromCenter);
    // A wave of a pair at depth is read where the nearer hole's lens takes the ray, by the share of its bend
    // the pair's centre lies behind it, so it is seen round the nearer hole as the farther hole is
    vec2 wavePx = frag;
    if (u_waveLens.x > 0.0) wavePx += companionBend(frag - u_companion.xy) * u_waveLens.x;
    if (u_waveLens.y > 0.0) {
      vec2 fromHole = frag - u_hole;
      float closest = 0.5 * u_horizon;
      wavePx -= fromHole * (u_einstein * u_einstein / max(dot(fromHole, fromHole), closest * closest)) * u_waveLens.y;
    }
    if (u_gravityWaveAmplitude > 0.0) {
      vec2 fromWave = wavePx - u_gravityWaveCenter;
      float waveDist = length(fromWave);
      float emitted = u_gravityWaveTime - waveDist / u_gravityWaveTurn.w;
      // A quarter of a wobble, over which the wave of a merger takes over from the pair's
      float quarter = 1.5707963 / u_gravityWaveOmega;
      if (emitted > (u_gravityWaveTurn.z == 0.0 ? 0.0 : -quarter)) {
        float invDist = 1.0 / max(waveDist, 0.0001);
        vec2 n = fromWave * invDist;
        vec2 t = vec2(-n.y, n.x);
        float phase = u_gravityWaveOmega * emitted;
        // The oval as the wave left
        vec2 c;
        if (u_gravityWaveTurn.z == 0.0) {
          // A hole that formed alone wobbles in place: long sideways, then long upright
          c = vec2(0.0, sin(phase));
        } else {
          // Two that became one leave an oval that turns the way they circled, half a turn a wobble
          c = vec2(-u_gravityWaveTurn.y * cos(phase) - u_gravityWaveTurn.z * u_gravityWaveTurn.x * sin(phase),
            u_gravityWaveTurn.x * cos(phase) - u_gravityWaveTurn.z * u_gravityWaveTurn.y * sin(phase));
          c *= smoothstep(-quarter, quarter, emitted);
        }
        float across = -(2.0 * planeQuad(t, c) + planeQuad(n, c));
        float strength = u_gravityWaveAmplitude * exp(-max(emitted, 0.0) * u_gravityWaveInvDecay) * waveReach(waveDist, u_gravityWaveRadius);
        // Reading the scene from further round shows it slid back along the circle
        waveMoved += t * strength * across;
        samplePx += t * strength * across;
      }
    }

    // Two black holes circling each other send out a wave of the same kind without end. Each point shows
    // the line between them as it stood when the wave left, so the pattern winds into a two-armed spiral
    // that turns with the pair. Once they are one, the last of it keeps flying off ahead of the new hole's
    // own ringing, which follows it out from the middle. Seen from any side it is the slice through the
    // pair that faces the camera, as above
    if (u_pairWave.x > 0.0) {
      vec2 fromPair = wavePx - u_pair;
      float pairDist = length(fromPair);
      vec2 n = fromPair / max(pairDist, 0.0001);
      vec2 t = vec2(-n.y, n.x);
      float turn = 2.0 * (u_pairWave.z * pairDist - u_pairWave.y);
      vec2 c = vec2(sin(turn), cos(turn));
      float across = -(2.0 * planeQuad(t, c) + planeQuad(n, c));
      float strength = u_pairWave.x * waveReach(pairDist, u_pairWave.w);
      if (u_pairFront.x >= 0.0) strength *= smoothstep(-u_pairFront.z, u_pairFront.z, pairDist / u_pairFront.y - u_pairFront.x);
      waveMoved += t * strength * across;
      samplePx += t * strength * across;
    }

    // The ray reaches the first black hole where the nearer second one has bent it to
    samplePx += companionShift * u_pairDepth.x;
    vec2 beforeLens = samplePx;

    // The lens maps the background behind the hole into a ring of radius E, where the pull (E / r)^2
    // is 1. Falloff pivots around
    // u_falloffPivot: closer than that a higher power pulls harder. With the pivot a screen away the
    // lens and its dark zone grow with falloff; with the pivot at the ring only their shape changes
    float bend = 0.0;
    if (u_einstein > 0.0 && u_trace.x > 0.0) {
      // Ray Traced: the ray through this pixel is followed round a black hole that does not spin, and the
      // scene is read from the direction it comes from, in the same stereographic projection. Inside the
      // shadow every ray falls in and the shadow covers it. The Einstein ring, the mirrored image inside it
      // and the thinner rings of light that went round the hole once or more all come out of the sweep
      float ratio = u_einstein / max(dist, 0.0001);
      bend = ratio * ratio;
      if (dist > shadowEdge) {
        float theta = 2.0 * atan(dist / u_trace.y);
        if (u_spin.x > 0.0) {
          // A spinning hole: the ray no longer keeps to one plane, so it is followed in both of the
          // camera's angles, chi measured from the axis's right toward its up, and the scene is read from
          // the direction it escapes to (kerrRayFrom). The angles go in and come out as sines and cosines
          // worked out from lengths, never through the GPU's own atan, sin and cos, which cost the ray a
          // hundred times its precision
          float slope = dist / u_trace.y;
          vec2 psi = vec2(2.0 * slope, 1.0 - slope * slope) / (1.0 + slope * slope);
          vec2 fromHole = samplePx - u_hole;
          vec2 across = vec2(fromHole.x, -fromHole.y) / max(length(fromHole), 0.0001);
          vec2 axis = vec2(cos(u_spin.w), sin(u_spin.w));
          vec2 chi = vec2(across.y * axis.x - across.x * axis.y, across.x * axis.x + across.y * axis.y);
          vec3 escape;
          vec2 source = vec2(0.0);
          if (kerrRayFrom(psi, chi, vec4(u_spin.xyz, u_trace.x), escape)) {
            // tan(angle / 2) = sideways / (1 + forward), and the sideways part's own direction, turned back
            // to the screen, whose y runs down
            float reach = u_trace.y * min(1.0 / max(1.0 + escape.z, 0.000001), TRACE_FAR / max(length(escape.xy), 0.000001));
            source = reach * vec2(escape.x * axis.x - escape.y * axis.y, -(escape.x * axis.y + escape.y * axis.x));
          } else {
            fallen = 1.0;
          }
          samplePx += (u_hole + source - samplePx) * u_trace.z;
        } else {
          float source = clamp(tan(0.5 * (PI - traceSweep(theta, u_trace.x))), -TRACE_FAR, TRACE_FAR);
          samplePx += (samplePx - u_hole) * (u_trace.y * source / dist - 1.0) * u_trace.z;
        }
      }
    } else if (u_einstein > 0.0) {
      samplePx = u_hole + stylizedLens(samplePx - u_hole, dist, u_einstein, bend);
    }

    // The second black hole bends the ray as a point mass does, on top of the first. Farther than the first,
    // it is seen where the first one's lens shows it, moved by the share of that lens's bend it lies behind;
    // nearer, its bend was worked out first and what the first was not seen through is added here
    float companionDist = 0.0;
    // Its shadow's edge in this direction: round, or the outline of its own spin, as the main hole's
    float companionEdge = u_companion.z;
    vec2 fromCompanion = vec2(0.0);
    if (u_companion.z > 0.0) {
      fromCompanion = frag + (samplePx - beforeLens) * u_pairDepth.y - u_companion.xy;
      companionDist = length(fromCompanion);
      if (u_companionSpin.x > 0.0) {
        float around = (atan(-fromCompanion.y, fromCompanion.x) - u_companionSpin.y) / (2.0 * PI);
        companionEdge *= texture2D(u_shadowShape, vec2(around + 0.5 / SHADOW_SAMPLES, 0.75)).r;
      }
      if (u_companion.w > 0.0) {
        if (u_pairDepth.x <= 0.0) companionShift = companionBend(fromCompanion);
        samplePx += companionShift * (1.0 - u_pairDepth.x);
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
      vec2 refracted = sourceOffset / max(sourceDist, 0.0001) * u_waveStrength * front * exp(-front * front);
      waveMoved -= refracted;
      samplePx -= refracted;
    }

    vec2 layerPx = layerPoint(samplePx);
    // The orbiting stars are read through the same bent ray as the particles
    vec3 color = drawn(layerPx);
    if (u_lensFringe > 0.0) {
      // A simple lens bends red less and blue more, and more so away from the middle of the frame. Both
      // layers go through it: red and blue taken from the particles alone would leave the orbits green
      vec2 split = fringeSplit(screen);
      color.r = drawn(layerPx - split).r;
      color.b = drawn(layerPx + split).b;
    }

    // Seconds since the light front passed this point; negative before it arrives
    float lit = u_lightSpeed > 0.0 ? (u_lightRadius - sourceDist) / u_lightSpeed : -1.0;

    vec2 cssPx = samplePx / u_pixelRatio;
    vec3 emitted = vec3(0.0);

    // The title is a cloud of dust shaped like the words, behind the black hole, so it is read through
    // the same bent rays as the stars. It stays dark until the light front reaches it, flashes as the
    // front passes, cools to a warm glow, then crumbles and drifts towards the hole
    if (u_titleAlpha > 0.0) {
      vec2 titleSpan = u_titleHalfSize * u_titleScale;
      vec2 local = (samplePx - u_titleCenter) / titleSpan;
      float keep = 1.0;
      // How far into its fall this part of the title is; heats and then reddens it
      float infall = 0.0;
      // The streak the moving letters leave behind them
      float trail = 0.0;
      // Each grain of dust is a cell of a few CSS pixels with its own speed and lifetime
      vec2 grainCell = floor(cssPx * u_titleSpeck.x);
      if (u_titleDissolve > 0.0) {
        // The title obeys the black hole it falls into. Its gravity sets how far the letters are
        // drawn (and pushes them away when negative), the orbital force winds them around the hole,
        // what lies beyond the reach of gravity goes last and barely moves, and what crosses the
        // radius of no return is gone
        vec2 fromHole = samplePx - u_hole;
        float holeDist = max(length(fromHole), 1.0);
        float beyondReach = u_titleReach > 0.0 ? smoothstep(u_titleReach, u_titleFallShape.w * u_titleReach, holeDist) : 1.0;
        // Every speck has its own speed, and neighbours share a current, so the specks travel in
        // streams rather than each on its own
        float current = clamp((valueNoise(cssPx * u_titleSpeck.y + 41.0) - 0.5) * u_titleFallShape.x + 0.5, 0.0, 1.0);
        float speed = mix(0.5, mix(hash12(grainCell + 41.0), current, u_titleStream), u_titleGrain);
        float fall = u_titleFall * max(1.0 + 2.0 * u_titleSpread * (speed - 0.5), 0.0) * mix(1.0, u_titleSpeck.z, beyondReach);
        local = (titleSource(fromHole, holeDist, fall) - u_titleCenter) / titleSpan;
        // Where the letters were a moment ago still shows, fainter, so their motion reads as a streak
        // Each copy lags the one before by a share of the fall and is fainter, down to none past the last
        for (int i = 1; i <= 8; i++) {
          if (float(i) > u_titleTrailShape.x) break;
          float lag = max(1.0 - u_titleTrailShape.y * float(i), 0.0);
          trail += u_titleTrailShape.z * (u_titleTrailShape.x + 1.0 - float(i)) * titleMask((titleSource(fromHole, holeDist, fall * lag) - u_titleCenter) / titleSpan);
        }
        trail *= u_titleTrail * min(4.0 * u_titleFall, 1.0);
        // Each speck winks out at its own moment, the ones nearest the hole first; without grain the
        // letters stay whole until the hole has them
        float nearness = clamp(holeDist / (u_titleFallShape.y * u_resolution.y), 0.0, 1.0);
        float lifetime = mix(1.0, mix(hash12(grainCell + 73.0), nearness, u_titleOrder), u_titleGrain);
        keep = smoothstep(u_titleDissolve - u_titleSpeck.w, u_titleDissolve, lifetime * u_titleWinkRest);
        if (u_titleCapture > 0.0) keep *= smoothstep(u_titleCapture, u_titleCapture * u_titleFallShape.z + 1.0, holeDist);
        infall = min(fall, 1.0);
      }
      if ((abs(local.x) <= 1.0 && abs(local.y) <= 1.0) || trail > 0.0) {
        // A lens splits colours towards the edge of the frame: red is read a little closer to the
        // title's centre and blue a little further out
        float fringe = u_titleFringe / max(u_titleHalfSize.x, 1.0);
        vec3 mask = max(vec3(titleMask(local * (1.0 - fringe)), titleMask(local), titleMask(local * (1.0 + fringe))), vec3(trail));
        float grain = u_titleDustShape.y * valueNoise(cssPx / u_titleDustShape.x) + u_titleDustShape.z * hash12(grainCell + 7.0);
        // Fire eats the letters from the ends of the title inwards along a ragged edge, which glows
        float burnRim = 0.0;
        if (u_titleBurn > 0.0) {
          float fuel = mix(u_titleBurnEdge.x * valueNoise(cssPx / u_titleBurnShape.x) + u_titleBurnEdge.y * valueNoise(cssPx / u_titleBurnShape.y), 1.0 - abs(local.x), u_titleBurnShape.z);
          float burnt = u_titleBurn * 1.15;
          keep *= smoothstep(burnt - u_titleBurnEdge.z, burnt, fuel);
          burnRim = 1.0 - smoothstep(burnt, burnt + u_titleBurnRimWidth, fuel);
        }
        vec3 density = mask * keep * mix(1.0, smoothstep(u_titleDustCut.x, u_titleDustCut.y, grain), u_titleDust);
        // Glow around the letters, drawn out sideways like the flare of an anamorphic lens
        float halo = u_titleHalo > 0.0 ? TITLE_HALO_GAIN * titleGlow(local) * u_titleHalo * (1.0 - u_titleDissolve) : 0.0;
        // The front arrives over its own width rather than as a hard edge
        float arrived = smoothstep(-u_lightWidth, u_lightWidth, u_lightRadius - sourceDist);
        float shown = mix(1.0, arrived, u_titleReveal);
        float flash = lit >= 0.0 ? u_titleReveal * exp(-lit / u_titleCooling) : 0.0;
        // Dust falling into the hole reddens and dims, as the collapsing core did
        // On the way it heats up first, brightest in the middle of its fall
        vec3 warm = mix(u_colorTitle, u_colorEmber, u_titleRedshift * infall) * (1.0 - 0.5 * u_titleRedshift * infall) *
          (1.0 + u_titleHeat * infall * (1.0 - infall));
        vec3 light = warm * u_titleGlow * shown + u_colorLight * u_titleFlash * flash;
        light = mix(light, u_colorEmber * u_titleBurnShape.w, burnRim);
        emitted += u_titleAlpha * (density + halo * (1.0 - u_titleBurn)) * light;
      }
    }
    if (u_backgroundStars > 0.0) {
      // The flare belongs to the light front, not to the dust echo, so hiding the echo keeps it
      float flare = u_lightPower > 0.0 && lit >= 0.0 ? u_starFlare * exp2(lit * u_starFlareRate) : 0.0;
      emitted += backgroundStar(cssPx, flare) * u_backgroundStars;
    }
    if (u_nebula > 0.0) {
      // Behind the stars and read where the bent ray comes from, like them, and drifting on its own: the flat
      // mode's backdrop, the 3D camera's sphere, both while it eases in. The sphere's clouds drift through
      // space (u_nebulaSpace, which the main thread moves along the scene's right and down, or the camera's
      // by Drift Follows Camera)
      vec3 nebula = vec3(0.0);
      if (u_skySphere < 1.0) {
        float shown;
        vec2 at = flatAt(cssPx, shown);
        nebula = (1.0 - u_skySphere) * shown * nebulaFlat(at + u_nebulaDrift * u_time);
      }
      if (u_skySphere > 0.0) {
        nebula += u_skySphere * nebulaSphere(normalize(skyRay(cssPx)) * u_skyLens.w + u_nebulaSpace);
      }
      emitted += nebula * u_nebula;
    }
    if (u_skyGrid > 0.0) {
      // A square grid on the sky, with a line through the sky's centre. It is read where the bent ray comes
      // from, so the lens, the gravitational wave and the matter front bend it like the stars, and it widens
      // where the lens magnifies
      vec2 gridAt = cssPx;
      // How many times smaller than on the flat sky the grid is drawn here
      float squeeze = 1.0;
      if (u_gridPull > 0.0 && u_horizon > 0.0) {
        // Drawn in towards the hole by the lattice's law: a node R from the hole is seen at
        // R^2 / (R + wish), so this point shows the node that law brings here. The law never folds, so the
        // node is found by halving the span it can lie in, then by the straight line across the last half
        vec2 fromHole = samplePx - u_hole;
        float seen = max(length(fromHole), 0.0001);
        float near = seen;
        float far = seen + u_gridPull * u_horizon;
        for (int i = 0; i < GRID_PULL_STEPS; i++) {
          float mid = 0.5 * (near + far);
          if (pulledIn(mid) < seen) near = mid; else far = mid;
        }
        float nearMiss = pulledIn(near) - seen;
        float farMiss = pulledIn(far) - seen;
        float slope = (far - near) / max(farMiss - nearMiss, 0.0001);
        float node = near - nearMiss * slope;
        gridAt = (u_hole + fromHole * (node / seen)) / u_pixelRatio;
        // Along the way to the hole and across it the grid shrinks by different shares; its lines keep
        // their width against the tighter one
        squeeze = max(slope, node / seen);
      }
      vec3 ray = skyRay(gridAt);
      // The screen's stretch at this point over the middle's (gnomonic): its radial way 1 + m^2, the way
      // across its root. Raised to Grid Slant, 0.75 the geometric mean of the two, it keeps the lines' width
      vec2 fromMiddle = (gridAt - u_skyLens.xy) / u_skyLens.z;
      float stretch = 1.0 + dot(fromMiddle, fromMiddle);
      float line = 0.0;
      if (u_gridShape.x < 1.0) {
        // On the faces of the sky's box, with a line through the middle of each: a face seen at a slant is
        // drawn smaller, by the screen's stretch over the face's
        vec3 onFace = skyFace(ray, u_skyLens.w);
        vec2 fromLine = abs(fract(onFace.xy / u_gridCell - 0.5) - 0.5) * u_gridCell;
        vec2 faceShare = onFace.xy / u_skyLens.w;
        float slant = pow(stretch / (1.0 + dot(faceShare, faceShare)), u_gridShape.y) * u_skyLens.z / u_skyLens.w;
        line = (1.0 - u_gridShape.x) * gridLineLight(min(fromLine.x, fromLine.y) * slant, u_gridCell * slant, squeeze);
      }
      if (u_gridShape.x > 0.0) {
        // On the sphere, in latitudes about the scene's up and longitudes from straight ahead, a cell's
        // angle apart; toward a pole every other longitude gives way each time the cells halve
        vec3 dir = normalize(ray);
        float latitude = asin(clamp(-dir.y, -1.0, 1.0));
        float longitude = atan(dir.x, dir.z);
        float across = cos(latitude);
        float apart = u_gridShape.w * exp2(floor(log2(1.0 / max(across, 0.001))));
        float latMiss = abs(fract(latitude / u_gridShape.z - 0.5) - 0.5) * u_gridShape.z;
        float lonMiss = abs(fract(longitude / apart - 0.5) - 0.5) * apart * across;
        float slant = pow(stretch, u_gridShape.y) * u_skyLens.z;
        line += u_gridShape.x * gridLineLight(min(latMiss, lonMiss) * slant, u_gridShape.z * slant, squeeze);
      }
      emitted += u_gridColor * u_skyGrid * line;
    }
    // Light is invisible in empty space: the front shows where it strikes dust, and the dust
    // keeps glowing for a moment after it passes (the light echo)
    float shell = (sourceDist - u_lightRadius) / u_lightWidth;
    float front = u_lightPower > 0.0 ? exp(-shell * shell) : 0.0;
    // Light lights the dust and the ejected matter, which follows more slowly, sweeps it away. The
    // dust does not fade out where it stands: part of its glow stays until the matter front reaches
    // it, and that front, the same one the particles are born behind, lights the dust it strikes
    float swept = mix(1.0, smoothstep(u_waveRadius - u_waveWidth, u_waveRadius + u_waveWidth, sourceDist), u_dustSweep);
    float rim = (sourceDist - u_waveRadius) / u_waveWidth - u_dustFlare.x;
    float shock = u_dustShock > 0.0 ? u_dustShock * exp2(u_dustFlare.y * rim * rim) : 0.0;
    // The echo is over once the dust that holds its light longest has let go of it
    bool echoing = u_echoPower > 0.0 && lit >= 0.0 && swept > 0.001 &&
      (u_echoFloor > 0.0 || exp(-lit / (u_echoShape.z * u_echoDecay)) > 0.001);
    if (front > 0.001 || echoing || shock > 0.001) {
      // The dust is never still: it drifts slowly all the time, and the blast pushes it outward once
      // the front has passed, quickly at first and then easing off
      vec2 dustAt = dustPx + u_dustDrift * u_time * u_dustMotion.xy;
      if (lit > 0.0) dustAt -= sourceOffset / max(sourceDist, 0.0001) * u_dustBlow * (1.0 - exp2(lit * u_dustMotion.z));
      float cloud = dust(dustAt);
      float density = cloud * swept;
      emitted += u_colorLight * u_lightPower * front * (1.0 - u_lightDustContrast + u_lightDustContrast * density);
      // The glow swells over a moment instead of switching on, then settles: thin haze lets go of
      // the flash quickly while thick cloud holds it, and what is left stays lit
      float fresh = 0.0;
      float glow = 0.0;
      if (u_echoPower > 0.0 && lit >= 0.0) {
        float swell = 1.0 - exp(-lit / (u_echoSwell.x * u_echoDecay + u_echoSwell.y));
        fresh = swell * exp(-lit / (u_echoDecay * mix(u_echoShape.x, u_echoShape.y, density)));
        glow = mix(fresh, swell, u_echoFloor);
      }
      // Dust the front has just struck still shines with the front's colour and cools to its own
      vec3 echoColor = mix(u_colorDust, u_colorLight, pow(fresh, u_echoTintEase));
      emitted += echoColor * u_echoPower * glow * density / (1.0 + sourceDist / (u_echoShape.w * u_resolution.x));
      emitted += mix(u_colorDust, u_colorLight, u_dustFlare.z) * shock * cloud;
    }
    if (u_remnantGlow > 0.0) {
      // White-hot, then the ember colour, then the same colour deep and dark
      vec3 remnantColor = mix(mix(u_colorFlash, mix(u_colorEmber, u_colorFlash, u_remnantShape.y), smoothstep(0.0, u_remnantShape.x, u_remnantRedshift)),
        u_remnantShape.z * u_colorEmber * u_colorEmber, smoothstep(u_remnantShape.x, 1.0, u_remnantRedshift));
      emitted += remnantColor * u_remnantGlow * (1.0 - u_remnantShape.w * u_remnantRedshift) * exp(-(centerDist * centerDist) / (2.0 * u_remnantRadius * u_remnantRadius));
    }
    color = (color + emitted) * u_exposure;

    // Light is lost in proportion to the lens's pull. Subtracting takes faint light first, so a dark
    // zone opens around the shadow and grows with absorption, lens radius and falloff
    if (bend > 0.0 && u_absorption > 0.0) color = max(color - 0.5 * bend * u_absorption, 0.0);

    // Each black hole's shadow also hides the part of the other's ring that lies behind it: the nearer one's
    // hides the farther one's ring, and side by side each hides the other's
    float besideCompanion = 1.0;
    if (u_companion.z > 0.0) {
      besideCompanion = smoothstep(companionEdge - px, companionEdge + px, companionDist);
      color *= besideCompanion;
    }

    if (u_horizon > 0.0) {
      float besideHole = smoothstep(shadowEdge - px, shadowEdge + px, dist);
      if (u_spin.x > 0.0) besideHole *= 1.0 - fallen * u_trace.z;
      color *= besideHole;

      // The grid on the horizon, in the shadow it fills (horizonLines), in Grid Color shifted as far as Horizon
      // Shift says by the horizon's turn (horizonShift)
      if (u_horizonGrid.x > 0.0 && (dist < shadowEdge + px || fallen > 0.0)) {
        float oval = dist / max(length(offset), 0.0001);
        float lines = horizonLines(offset, dist, oval, px, vec4(u_spin.x, u_horizonAxis.xy, u_horizonGrid.y),
          vec4(u_horizonGrid.z, u_horizonAxis.z, u_horizonTurn.x, u_horizonTurn.y));
        vec3 gridLight = u_gridColor;
        if (u_horizonLook.z > 0.0 && u_horizonTurn.y > 0.0) gridLight = shiftedLight(u_gridColor, horizonShift(offset, dist), u_horizonLook.z);
        color += gridLight * u_horizonGrid.x * lines * (1.0 - besideHole) * besideCompanion;
      }
      // The second hole's horizon carries the same grid, about its own spin's axis (the main grid's while it does
      // not spin), twisted and turning as its spin gives; the main hole's shadow covers it as its covers the
      // main one's
      if (u_horizonGrid.x > 0.0 && u_horizonLook.w > 0.0 && u_companion.z > 0.0 && companionDist < companionEdge + px) {
        float lines = horizonLines(fromCompanion, companionDist, 1.0, px, u_companionHole, u_companionGrid);
        color += u_gridColor * u_horizonGrid.x * u_horizonLook.w * lines * (1.0 - besideCompanion) * besideHole;
      }

      // The second black hole's ring: the main ring's line along its own outline, lit by what falls into it
      // (the second row of the field's light) and brighter on its Doppler side
      if (u_companion.z > 0.0 && u_ring > 0.0 && companionDist < companionEdge * u_ringLine.z) {
        float ringLine = u_ringLine.x * px + u_ringWidth * u_companion.z;
        float fromLine = companionDist - companionEdge - u_ringLine.y * ringLine;
        float inner = fromLine / (u_ringLine.w * ringLine);
        float line = exp(-inner * inner);
        if (u_ringGlow > 0.0) {
          vec2 spread = fromLine / (u_companion.z * u_ringGlowShape.xy);
          line += u_ringGlow * dot(u_ringGlowShape.zw, exp(-spread * spread));
        }
        float companionAngle = atan(fromCompanion.y, fromCompanion.x);
        float lit = u_ringBase;
        if (u_companionRing.z > 0.0) {
          float turn = (companionAngle - u_ringPhase) / (2.0 * PI);
          float bin = 1.0 / ${RING_BINS}.0;
          float left = 0.5 * texture2D(u_ringLight, vec2(turn, 0.75)).r +
            0.25 * (texture2D(u_ringLight, vec2(turn - bin, 0.75)).r + texture2D(u_ringLight, vec2(turn + bin, 0.75)).r);
          lit += u_companionRing.z * left / (1.0 + left);
        }
        vec3 tint = u_ringColor;
        float boost = 1.0;
        if (u_companionRing.x > 0.0) {
          float side = cos(companionAngle - u_companionRing.y);
          boost = (1.0 + 0.5 * u_companionRing.x * side) / (1.0 + 0.5 * u_companionRing.x);
          boost *= boost * boost;
          tint = mix(u_ringColor, side > 0.0 ? u_ringApproaching : u_ringReceding, abs(side) * u_companionRing.x * u_companionRing.x);
        }
        color += tint * u_ring * boost * lit * line * mix(besideHole, 1.0, clamp(u_pairDepth.z, 0.0, 1.0));
      }

      // Photon ring: light that circled the hole before escaping, a hair-thin line hugging the shadow, along
      // its outline when the hole spins
      if (u_ring > 0.0 && dist < shadowEdge * u_ringLine.z) {
        // Added to a floor rather than clamped to it, so every step of Thickness shows
        float ringLine = u_ringLine.x * px + u_ringWidth * u_horizon;
        float fromLine = dist - shadowEdge - u_ringLine.y * ringLine;
        float inner = fromLine / (u_ringLine.w * ringLine);
        float line = exp(-inner * inner);
        // The glow is the light a camera spreads around a line this bright: tight around the line with a
        // faint wide skirt, on both sides of it. It scales with the hole and is gone well inside the
        // reach of this branch (u_ringLine.z, which grows with the glow), so it never ends in an edge
        if (u_ringGlow > 0.0) {
          vec2 spread = fromLine / (u_horizon * u_ringGlowShape.xy);
          line += u_ringGlow * dot(u_ringGlowShape.zw, exp(-spread * spread));
        }

        // The ring burns brighter where the simulation drops matter into the hole
        float ringAngle = atan(offset.y, offset.x);
        float ringTurn = (ringAngle - u_ringPhase) / (2.0 * PI);
        float infall = texture2D(u_ringEnergy, vec2(ringTurn, 0.5)).r;
        if (u_ringField > 0.0) {
          // The field's light is spread over a bin's neighbours here and joins what the stars and the flows
          // left, before the whole saturates softly
          float bin = 1.0 / ${RING_BINS}.0;
          float left = infall / max(1.0 - infall, 0.004) + 0.5 * texture2D(u_ringLight, vec2(ringTurn, 0.25)).r +
            0.25 * (texture2D(u_ringLight, vec2(ringTurn - bin, 0.25)).r + texture2D(u_ringLight, vec2(ringTurn + bin, 0.25)).r);
          infall = left / (1.0 + left);
        }
        line *= u_ringBase + u_ringFeed * infall;

        // Doppler beaming: light moving towards the viewer is brighter and bluer, the far side dimmer and redder
        float side = cos(ringAngle - u_ringSide);
        // Scaled so the bright side peaks at the ring's brightness: clipping to white would thicken the line
        float boost = (1.0 + 0.5 * u_ringDoppler * side) / (1.0 + 0.5 * u_ringDoppler);
        // The colour follows the square of the contrast: a mild one only brightens and dims the sides of
        // a white ring, a strong one also turns them blue and red
        vec3 tint = mix(u_ringColor, side > 0.0 ? u_ringApproaching : u_ringReceding, abs(side) * u_ringDoppler * u_ringDoppler);
        color += tint * u_ring * boost * boost * boost * line * mix(besideCompanion, 1.0, clamp(-u_pairDepth.z, 0.0, 1.0));
      }
    }

    // What stands between the camera and the black holes (3D): its light comes straight to the camera, so
    // it is read where the pixel is, through the camera's zoom and jolt and not along the bent ray, and is
    // laid over the shadows, the lenses and the rings, the brighter of it and what is there, as the layers
    // keep the brighter of two, or added to it by Front Add. The absorption and the second hole's bend are
    // the holes' doing on the light that passes them, and leave it alone; the waves and the matter front,
    // which pass between the holes and the camera too, slide it by Front Waves of what they slide the rest.
    // The camera's own lens splits its colours and its exposure scales it as they do the rest, and the film
    // below acts on it
    if (u_front.x > 0.0) {
      vec2 frontPx = layerPoint(u_front.w > 0.0 ? frag + waveMoved * u_front.w : frag);
      vec3 front = drawnInFront(frontPx);
      if (u_lensFringe > 0.0) {
        vec2 split = fringeSplit(screen);
        front.r = drawnInFront(frontPx - split).r;
        front.b = drawnInFront(frontPx + split).b;
      }
      front *= u_exposure;
      color = u_front.z > 0.0 ? mix(max(color, front), color + front, u_front.z) : max(color, front);
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
      color *= 1.0 - u_vignette * smoothstep(u_vignetteSpan.x, u_vignetteSpan.y, length(screen / u_resolution * 2.0 - 1.0));
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

// The space sheet (space_grid.ts), drawn over the finished frame: the surface of SHEET_GLSL seen through its
// pose. Lengths on the sheet are in the plane's units, places on the screen in CSS pixels

export const gridVertexShaderSource = `
  attribute vec2 a_position;  // quad corner: x picks the end of the piece, y the side
  attribute vec4 a_gridLine;  // line number counted from the black hole, start and end along the line (-1..1), 1 = runs along the plane's first direction

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform float u_pixelRatio;
  uniform vec4 u_lines;       // cell size, how far from the black hole the lines reach, the place the lines are counted from
  uniform vec4 u_sheet;       // line width where the focal length is the distance, the most a line widens near the camera, the distance from the black hole the lines begin to fade out at, how far the scene's own camera sees the sheet (0 = the flat camera alone)
  uniform vec4 u_lens;        // the camera the sheet is drawn for: centre of its zoom, the zoom, unused (the scene camera's over the frame, the layer's into the layer the lens reads)
  uniform vec2 u_jolt;        // the scene camera's shake (0 into the layer the lens reads, which the composite pass shakes)
  uniform vec4 u_rings;       // rings drawn around the black hole in place of the square cells (0 = the cells), lines through the hole drawn across them, the share of the way the rings are moved from equal steps of depth to equal radii; unused
  uniform float u_front;      // 3D: the nearer black hole's distance from the camera as a share of the main one's (0 = nothing is in front)
${SHEET_GLSL}
  varying vec2 v_ends;        // distance along the piece from its start and from its end
  varying float v_across;     // signed distance from its axis
  varying float v_halfWidth;
  varying float v_alpha;
  varying float v_front;      // 1 for a piece nearer the camera than the holes, which passes in front of them

  // The radius of ring k of the n the sheet is drawn with, at k / (n + 1) of the way down the well, so the
  // rings are its contour lines. dent() turned inside out gives it: a share of the depth is a slowing of
  // time, 1 - sqrt(1 - rs / nearest), and light that comes that near is seen at
  // b = nearest / sqrt(1 - rs / nearest), with the shadow's edge at sqrt(27) / 2 rs
  float contour (float k) {
    float kept = 1.0 - k / (u_rings.x + 1.0) / 2.3660254;
    float sunk = 1.0 - kept * kept;
    return u_sheetWell.x * 0.3849002 / (sunk * kept);
  }

  // A point of the sheet, given from the black hole on the plane: where it lies in the space of the
  // sheet's camera, and how lit it is
  vec4 onSurface (vec2 fromHole) {
    float r = length(fromHole);
    float depth = sheetDepth(fromHole) + sheetWave(fromHole);
    // Inside a throat the sheet lies below the horizon. The flat mode's shadow covers it; seen by the scene's
    // own camera, from any side, it is not drawn
    float shown = u_sheet.w > 0.0 && (r < u_sheetWell.x || length(fromHole - u_sheetWell2.xy) < u_sheetWell2.z) ? 0.0 : 1.0;
    return vec4(sheetSeen(fromHole, depth), shown * (1.0 - smoothstep(u_sheet.z, u_lines.y, r)));
  }

  // Where a point of the camera's space is drawn on the frame, the scene camera's zoom and shake with the
  // rest of it, and how much wider than at the focal length's distance a line is drawn there
  vec3 onFrame (vec3 seen) {
    vec2 point = u_lens.xy + (sheetScreen(seen) - u_jolt - u_lens.xy) * u_lens.z;
    return vec3(point, u_sheetU.w / seen.z * u_lens.z);
  }

  void main () {
    bool crosswise = a_gridLine.w > 0.5;
    // Pieces are short near the black hole, where the sheet curves, and long far from it
    vec2 along = sign(a_gridLine.yz) * a_gridLine.yz * a_gridLine.yz * u_lines.y;
    float across;
    vec4 first;
    vec4 last;
    if (u_rings.x > 0.0 && u_sheetWell.x > 0.0) {
      // Rings and spokes around the black hole in place of the square cells. A line the count leaves out
      // is put past the sheet's reach, where it is dropped below
      if (crosswise) {
        // A ring lies at one depth, its contour; moved toward equal steps of radius it lies that share of
        // the way to its even place between the shadow's edge and the outermost contour, which stays
        across = a_gridLine.x < 1.0 || a_gridLine.x > u_rings.x ? 2.0 * u_lines.y : 0.0;
        float k = clamp(a_gridLine.x, 1.0, u_rings.x);
        float radius = contour(k);
        if (u_rings.z > 0.0) radius = mix(radius, u_sheetWell.x + (contour(1.0) - u_sheetWell.x) * (u_rings.x + 1.0 - k) / u_rings.x, u_rings.z);
        vec2 turn = 3.14159265 * a_gridLine.yz;
        first = onSurface(radius * vec2(cos(turn.x), sin(turn.x)));
        last = onSurface(radius * vec2(cos(turn.y), sin(turn.y)));
      } else {
        // A line through the hole is two spokes
        across = a_gridLine.x < 0.0 || a_gridLine.x >= u_rings.y ? 2.0 * u_lines.y : 0.0;
        float angle = 3.14159265 * a_gridLine.x / max(u_rings.y, 1.0);
        vec2 spoke = vec2(cos(angle), sin(angle));
        first = onSurface(spoke * along.x);
        last = onSurface(spoke * along.y);
      }
    } else {
      // The lines are counted from a place that stays put while the black hole moves across the sheet
      across = (a_gridLine.x - fract(-(crosswise ? u_lines.w : u_lines.z) / u_lines.x)) * u_lines.x;
      first = onSurface(crosswise ? vec2(along.x, across) : vec2(across, along.x));
      last = onSurface(crosswise ? vec2(along.y, across) : vec2(across, along.y));
    }

    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_alpha = 0.0;
    v_front = 0.0;
    // What lies nearer than the camera's near plane is cut off where the piece crosses it, as a stroke of
    // the field is
    float near = u_sheetV.w;
    if (abs(across) > u_lines.y || (first.z < near && last.z < near) || first.w + last.w <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    if (first.z < near || last.z < near) {
      vec4 cut = mix(first, last, (near - first.z) / (last.z - first.z));
      if (first.z < near) first = cut;
      else last = cut;
    }
    // A piece whose middle is nearer the camera than the nearer hole passes in front of the holes, and no
    // shadow clears it. The main hole stands in its well, at its depth there, in the sheet camera's space
    if (u_front > 0.0 && first.z + last.z < 2.0 * u_front * (u_sheetO.z + u_sheetN.z * u_sheetWell.z)) v_front = 1.0;
    vec3 from = onFrame(first.xyz);
    vec3 to = onFrame(last.xyz);

    vec2 start = from.xy * u_pixelRatio;
    vec2 delta = to.xy * u_pixelRatio - start;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float end = a_position.x * 0.5 + 0.5;
    float width = u_sheet.x * u_pixelRatio * min(mix(from.z, to.z, end), u_sheet.y);
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;
    float alongPiece = mix(-extent, len + extent, end);
    float acrossPiece = a_position.y * extent;
    vec2 pixel = start + direction * alongPiece + normal * acrossPiece;

    v_ends = vec2(alongPiece, len - alongPiece);
    v_across = acrossPiece;
    v_halfWidth = halfWidth;
    v_alpha = mix(first.w, last.w, end) * width / drawWidth;

    // The screen has its first row at the top
    gl_Position = vec4(pixel.x / u_resolution.x * 2.0 - 1.0, 1.0 - pixel.y / u_resolution.y * 2.0, 0.0, 1.0);
  }
`
// Every length uniform here is in device pixels with a top-left origin
export const gridFragmentShaderSource = `
  precision highp float;

  uniform vec4 u_color;   // rgb at the sheet's brightness
  uniform vec4 u_shadow;  // the black hole as the frame shows it: centre and shadow radius; radius 0 = none
  uniform vec4 u_shadow2; // a second black hole, the same way
  uniform vec2 u_frame;   // height of the drawing buffer, height of each letterbox bar
  uniform vec2 u_clearing; // the shadow radii inside which a line is gone and beyond which it is whole
  uniform vec2 u_kept;     // the share drawn of a piece behind the holes, and of one in front of them

  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying float v_alpha;
  varying float v_front;

  void main () {
    // Round caps, so the pieces of a line join without a notch
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float alpha = v_alpha * clamp(v_halfWidth + 0.5 - length(vec2(beyondEnds, v_across)), 0.0, 1.0);
    vec2 screen = vec2(gl_FragCoord.x, u_frame.x - gl_FragCoord.y);
    // Over the frame the sheet behind the holes is drawn less what is drawn through the lens, and into the
    // layer the lens reads, where the shadow covers it, nothing in front of them
    alpha *= v_front < 0.5 ? u_kept.x : u_kept.y;
    // A line behind the black hole does not cross its shadow or its ring; one in front of the holes does
    if (v_front < 0.5) {
      if (u_shadow.z > 0.0) alpha *= smoothstep(u_shadow.z * u_clearing.x + 1.0, u_shadow.z * u_clearing.y + 2.0, length(screen - u_shadow.xy));
      if (u_shadow2.z > 0.0) alpha *= smoothstep(u_shadow2.z * u_clearing.x + 1.0, u_shadow2.z * u_clearing.y + 2.0, length(screen - u_shadow2.xy));
    }
    if (u_frame.y > 0.0) alpha *= smoothstep(u_frame.y - 1.0, u_frame.y + 1.0, min(screen.y, u_frame.x - screen.y));
    gl_FragColor = vec4(u_color.rgb * alpha, 1.0);
  }
`

function createShader (
  gl: WebGL2RenderingContext,
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
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributes: Record<string, number>,
  // What a transform feedback keeps of the vertex shader's outputs, in the order they are written
  feedback?: readonly string[]
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
    if (feedback) gl.transformFeedbackVaryings(program, [...feedback], gl.INTERLEAVED_ATTRIBS)
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

// The lines of the space lattice (space_lattice.ts): each piece is bent towards the black holes and set in
// front of the camera, at the camera's zoom, into the layer the orbits' traces are drawn in
export const latticeVertexShaderSource = MODERN_VERTEX + `
  attribute vec2 a_position;     // quad corner: x picks the end of the piece, y the side
  attribute vec4 a_latticeLine;  // two line numbers across the line, counted from the black hole, the piece's number along it, the axis it runs along (0 x, 1 y, 2 z)

  uniform vec2 u_resolution;     // drawing buffer size in device pixels
  uniform vec4 u_zoom;           // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_row0;           // the camera's turn, row by row: the x row, and the focal length in device pixels
  uniform vec4 u_row1;           // the y row, and the depth of the point the camera circles
  uniform vec4 u_row2;           // the z row, and the distance under which lines fade out near the camera
  uniform vec3 u_shift;          // where the point the camera circles lands in the camera's space, after its move and its head
  uniform vec2 u_vanish;         // the vanishing point in device pixels
  uniform vec4 u_hole;           // the black hole in the scene, the radius of its shadow (0 = no pull)
  uniform vec4 u_companion;      // a second black hole, the same way
  uniform vec4 u_lattice;        // cell size, how far the lines reach, the pull, line width in device pixels
  uniform vec4 u_anchor;         // share of a cell the nearest lines lie past the black hole on each axis, unused
  uniform vec4 u_color;          // rgb at the lattice's brightness, unused
  uniform vec3 u_fade;           // the distance from the black hole the lines begin to fade out at, the share of their light lines far behind the point the camera circles keep, and the distance from the camera a line is gone at
${SIDE_GLSL}
  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;
  const float SEGMENTS = ${LATTICE_SEGMENTS}.0;

${DENT_GLSL}
  // The share of its distance a node at this distance from a black hole is pulled in by. The pull wished
  // for is the slowing of time, in shadow radii times the Pull, and in proportion inside the shadow; it is
  // taken as r -> r^2 / (r + pull), which is the pull itself while it is small and never brings a node to
  // the centre, so a strong pull draws the lines in tight and no line folds over
  float pull (float away, float edge) {
    float wish = u_lattice.z * (away >= edge ? edge * dent(away, edge) : away);
    return wish / (away + wish);
  }

  vec3 bent (vec3 node) {
    vec3 fromHole = node - u_hole.xyz;
    float away = length(fromHole);
    vec3 placed = node;
    if (u_hole.w > 0.0) placed -= fromHole * pull(away, u_hole.w);
    if (u_companion.w > 0.0) {
      vec3 fromCompanion = node - u_companion.xyz;
      float awayCompanion = length(fromCompanion);
      placed -= fromCompanion * pull(awayCompanion, u_companion.w);
    }
    return placed;
  }

  // A point of the scene in the camera's space: across, down, and its distance in front of the camera
  vec3 seen (vec3 point) {
    vec3 fromPivot = point - vec3(0.0, 0.0, u_row1.w);
    return vec3(dot(u_row0.xyz, fromPivot), dot(u_row1.xyz, fromPivot), dot(u_row2.xyz, fromPivot)) + u_shift;
  }

  // A node of the line, given by its place across and how far along the line it lies from the black hole
  vec3 lineNode (vec2 across, float along) {
    float axis = a_latticeLine.w;
    vec3 offset = axis < 0.5 ? vec3(along, across) : axis < 1.5 ? vec3(across.x, along, across.y) : vec3(across, along);
    return u_hole.xyz + offset;
  }

  // Where a point in the camera's space lands in the layer, at the camera's zoom
  vec2 onLayer (vec3 point) {
    vec2 screen = u_vanish + point.xy * u_row0.w / point.z;
    return u_zoom.xy + (screen - u_zoom.xy) * u_zoom.z;
  }

  void main () {
    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_color = vec4(0.0);

    // The lines stay where they are in the scene while the black hole moves through them
    float axis = a_latticeLine.w;
    vec2 anchor = axis < 0.5 ? u_anchor.yz : axis < 1.5 ? u_anchor.xz : u_anchor.xy;
    vec2 across = (a_latticeLine.xy - anchor) * u_lattice.x;
    // Pieces are short near the black hole, where the lines bend, and long far from it
    float start = a_latticeLine.z / SEGMENTS * 2.0 - 1.0;
    float stop = (a_latticeLine.z + 1.0) / SEGMENTS * 2.0 - 1.0;
    vec3 firstNode = lineNode(across, sign(start) * start * start * u_lattice.y);
    vec3 lastNode = lineNode(across, sign(stop) * stop * stop * u_lattice.y);
    // The lattice is a ball around the hole: it fades out toward the end of its reach
    float lit = 1.0 - smoothstep(u_fade.x, u_lattice.y, length(0.5 * (firstNode + lastNode) - u_hole.xyz));
    vec3 first = seen(bent(firstNode));
    vec3 last = seen(bent(lastNode));
    float nearest = min(first.z, last.z);
    if (lit <= 0.0 || nearest < u_fade.z) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // Each end takes its side of the holes, and the piece runs from the one share to the other
    vec2 firstPx = onLayer(first);
    vec2 lastPx = onLayer(last);
    vec3 sideFirst = sideOf(first.z, firstPx);
    vec3 sideLast = sideOf(last.z, lastPx);
    vec2 startPx = placedBy(firstPx, sideFirst, sideLast);
    vec2 delta = placedBy(lastPx, sideLast, sideFirst) - startPx;
    v_front = a_position.x < 0.0 ? sideFirst.x : sideLast.x;
    v_cut = vec2(0.0);
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float width = u_lattice.w;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;
    float along = mix(-extent, len + extent, a_position.x * 0.5 + 0.5);
    float acrossPiece = a_position.y * extent;
    vec2 pixel = startPx + direction * along + normal * acrossPiece;
    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    // Near the camera the lines fade out; far behind the point it circles they dim with distance
    float shown = lit * smoothstep(u_fade.z, u_row2.w, nearest) * clamp(u_row1.w / nearest, u_fade.y, 1.0);
    v_ends = vec2(along, len - along);
    v_across = acrossPiece;
    v_halfWidth = halfWidth;
    v_color = vec4(u_color.rgb, min(shown * targetArea / drawnArea, 1.0));
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

// Particles on Sheet: the sheet's surface and pose (SHEET_GLSL), and how what is laid on it, the particle
// field (field_step.ts) and the flows, stands there. A particle near the main hole's equator is dropped along
// the way the plane faces onto the plane; its two coordinates there give the point of the surface it is
// drawn at, seen through the sheet's pose. Only matter within a slab round the plane rides, the more the
// nearer the plane. Places are in CSS pixels seen straight on at the black hole's distance
export const RIDE_GLSL = `  uniform vec4 u_ride;        // the share of the way a particle is laid on the sheet (0 = none), the half thickness of the slab whose particles ride, the plane's units in a CSS pixel, how far the sheet is seen by the scene's own camera (0-1)
  uniform vec4 u_rideShape;   // the share of the slab the ride fades over, the slab's half thickness on the side the well goes down as a multiple of the other's, the share of the sheet's waves the riders go with, the most of a stroke nearer than the near plane that is cut there rather than dropped
${SHEET_GLSL}
  // The share of the way a particle this high off the equator, along the way the well goes down, is laid
  // on the sheet: all of it in the plane and within the share of the slab that does not fade, none at the
  // slab's edge
  float rideShare (float height) {
    float depth = max(height > 0.0 ? u_ride.y * u_rideShape.y : u_ride.y, 0.001);
    return u_ride.x * (1.0 - smoothstep(depth * (1.0 - u_rideShape.x), depth, abs(height)));
  }

  // The point of the surface over a place of the equator, given from the main hole, in the space of the
  // sheet's camera, risen and sunk with the sheet's waves as far as the riders go with them
  vec3 underneath (vec2 inPlane) {
    vec2 at = inPlane * u_ride.z;
    float depth = sheetDepth(at);
    if (u_rideShape.z > 0.0) depth += u_rideShape.z * sheetWave(at);
    return sheetSeen(at, depth);
  }

  // Where a ridden stroke from "a" to "b" (the sheet camera's space) crosses the near plane: 0 while both
  // ends lie beyond it, the share of the way from "a" otherwise, or -1 when the stroke is dropped, wholly
  // nearer or with more of it nearer than may be cut
  float rideCut (vec3 a, vec3 b) {
    float near = u_sheetV.w;
    if (min(a.z, b.z) >= near) return 0.0;
    if (max(a.z, b.z) < near) return -1.0;
    float t = (near - a.z) / (b.z - a.z);
    return (a.z < near ? t : 1.0 - t) > u_rideShape.w ? -1.0 : t;
  }

  // A particle drawn "share" of the way from where it is seen (on the screen, and "away" from the camera,
  // CSS pixels straight on) to the point of the surface "laid" (the sheet camera's space): the places are
  // blended in the scene before they are seen. As far as the sheet is seen by the scene's own camera, the
  // surface's point stands at its own distance; seen by a camera of its own, at the particle's, which blends
  // the two on the screen
  vec2 laidOn (vec2 screen, float away, vec3 laid, float share) {
    float laidAway = mix(away, laid.z, u_ride.w);
    float weight = laidAway * share;
    float kept = away * (1.0 - share);
    return (screen * kept + sheetScreen(laid) * weight) / (kept + weight);
  }
`
// A flow (flows.ts): every particle is placed from its own four numbers and the flow's clock, and its trail
// is the stretch of the same path it has just come along, in pieces. Nothing about a particle is kept from
// one frame to the next
export const flowVertexShaderSource = MODERN_VERTEX + `
  attribute vec3 a_flowCorner;  // x: 0 at the piece's newer end, 1 at its older; y: the side; z: the piece, from the particle back
  attribute vec4 a_flowSeed;    // the particle's own numbers, 0 to 1: when in a life, where round the hole, where across the band, how bright

  uniform vec2 u_resolution;    // drawing buffer size in device pixels
  uniform vec4 u_zoom;          // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_place;         // the black hole (device pixels), device pixels in a black hole radius, stroke width in device pixels
  uniform vec4 u_turnX;         // where the camera turns the flow's own x axis, and in 3D its focal length in device pixels (0 = flat, straight on)
  uniform vec4 u_turnY;         // where it turns the flow's y axis, and the black hole's distance in device pixels
  uniform vec4 u_turnZ;         // where it turns the way the flow's plane faces, device pixels in a CSS pixel
  uniform vec4 u_inPlaneU;      // Particles on Sheet: how far along the equator's first direction a step along each of the flow's own three goes, per device pixel; where its centre stands from the main hole that way, CSS pixels
  uniform vec4 u_inPlaneV;      // the same along the equator's second direction
  uniform vec4 u_inPlaneH;      // the same along the way the equator faces, its height off it
  uniform vec4 u_law;           // the path's law: one over the fall's power, the turn's falloff, one less their ratio, one over the first radius
  uniform vec4 u_shape;         // the disc: half height as a share of the radius at the first radius, the power it grows with past there, the share of a bell in the heights, the power the height draw is bent by
  uniform vec4 u_draw;          // the share of a full turn an orbit's phase is drawn over, 1 to draw anew each life (0 keeps the draws), the shares of a life to appear and to leave
  uniform vec4 u_style;         // the dimmest a particle is among its flow's, the power its trail dims by, the shares of the hole's distance a 3D stroke starts to fade at and is gone at
  uniform vec4 u_path;          // the radii matter appears and leaves at, each to the fall's power; the band's width as a share of the first; radians turned at the first radius in a life
  uniform vec3 u_age;           // the flow's clock in lives: the share of the life now running, the whole lives before; the share of a life one piece of trail spans
  uniform vec4 u_light;         // colour, brightness
  uniform vec2 u_flowFrom;      // 3D: the black hole's place from the vanishing point, device pixels
${RIDE_GLSL}${SIDE_GLSL}
  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;
  const float PIECES = ${FLOW_SEGMENTS}.0;

  // A point of the flow, in device pixels from the black hole along its own three directions, where the
  // camera draws it, and how far from the camera it lies as a share of the black hole's distance (1 in the
  // flat mode, which sees it straight on). Each point is seen in its own perspective, the hole standing off
  // the line of sight by its place from the vanishing point
  vec3 seen (vec3 point) {
    vec3 turned = u_turnX.xyz * point.x + u_turnY.xyz * point.y + u_turnZ.xyz * point.z;
    float away = 1.0;
    vec2 at = turned.xy;
    if (u_turnX.w > 0.0) {
      float depth = u_turnY.w + turned.z;
      away = depth / u_turnY.w;
      at = (turned.xy * u_turnX.w - u_flowFrom * turned.z) / max(depth, 1.0);
    }
    return vec3(u_place.xy + at, away);
  }

  // Where a particle stands at an age of 0 to 1 of its life, in device pixels from the black hole: in its
  // flow's plane, then above it. "band" is its place across the band, as a multiple of the band's middle,
  // "turn" the angle it appeared at, "lift" its own share of the disc's height and the phase of its orbit's tip.
  // Its radius to the fall's power p runs evenly from the first radius to the last (1.5 is a fall from rest),
  // and it turns at a rate of radius^-q (1.5 is Kepler's), whose sum along that fall is a power of the fall's
  // own steps, ((1 + x)^k - 1) / k with k = 1 - q / p, and a logarithm where k is 0. A thick disc is made of
  // orbits each tipped a little, so the height swings with the turn; it is the thickness's share of the radius
  // at the first radius and grows past there as the radius to the flare's power
  vec3 placeAt (float age, float band, float turn, vec2 lift) {
    float fallen = mix(u_path.x, u_path.y, age);
    float x = (u_path.y - u_path.x) * age / u_path.x;
    float k = u_law.z;
    float mean = abs(x) < 0.001 ? 1.0 + 0.5 * (k - 1.0) * x
      : abs(k) < 0.001 ? log(1.0 + x) / x
      : (pow(1.0 + x, k) - 1.0) / (k * x);
    float angle = turn + u_path.w * age * mean * pow(band, -u_law.y);
    float share = band * pow(fallen, u_law.x);
    float radius = share * u_place.z;
    float height = u_shape.x * lift.x * radius;
    if (u_shape.y != 1.0) height *= pow(share * u_law.w, u_shape.y - 1.0);
    // The screen's y runs down, so a positive swirl turns anticlockwise to the eye
    return vec3(radius * cos(angle), -radius * sin(angle), height * sin(angle + lift.y));
  }

  // A particle appears over the first share of its life and leaves over the last
  float present (float age) {
    return smoothstep(0.0, u_draw.z, age) * (1.0 - smoothstep(1.0 - u_draw.w, 1.0, age));
  }

  void main () {
    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_color = vec4(0.0);

    // Which life the particle is in and how far into it; every life starts at another place
    float turns = u_age.x + a_flowSeed.x;
    float life = floor(turns);
    float age = turns - life;
    float lives = u_age.y + life;
    float turn = 2.0 * PI * fract(a_flowSeed.y + lives * 0.6180340);
    float band = max(1.0 + (fract(a_flowSeed.z + lives * 0.7548777) - 0.5) * u_path.z, 0.05);
    // Its share of the disc's height and its orbit's phase, drawn from its own numbers anew every life, or
    // once for good: the share evenly from 0 to the whole, bent by the draw's power and blended toward a
    // bell (the heights of orbits whose tips follow a Rayleigh law fall as a Gaussian, about half the
    // thickness wide), the phase over the share of a turn Phase Spread gives
    float drawn = lives * u_draw.y;
    vec2 lift = vec2(
      fract(a_flowSeed.w * 13.0 + a_flowSeed.z * 7.0 + drawn * 0.4142136),
      2.0 * PI * u_draw.x * fract(a_flowSeed.y * 11.0 + a_flowSeed.w * 5.0 + drawn * 0.2360680));
    float even = pow(max(lift.x, 0.000001), u_shape.w);
    lift.x = u_shape.z > 0.0 ? mix(even, 0.5 * sqrt(-2.0 * log(max(1.0 - lift.x, 0.0001))), u_shape.z) : even;

    // The piece runs from where the particle was to where it was a little later; before its birth it was nowhere
    float newer = max(age - a_flowCorner.z * u_age.z, 0.0);
    float older = max(age - (a_flowCorner.z + 1.0) * u_age.z, 0.0);
    // The trail dims toward its tail as a power of what is left of it (the square by default), so the
    // particle itself stands out
    float leftNewer = 1.0 - a_flowCorner.z / PIECES;
    float leftOlder = 1.0 - (a_flowCorner.z + 1.0) / PIECES;
    float lightNewer = present(newer) * pow(max(leftNewer, 0.000001), u_style.y);
    float lightOlder = present(older) * pow(max(leftOlder, 0.000001), u_style.y);
    if (lightNewer <= 0.0 || u_turnY.w < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // A stroke that comes near the camera fades out and is gone before it would cross the whole frame
    vec3 placeOlder = placeAt(older, band, turn, lift);
    vec3 placeNewer = placeAt(newer, band, turn, lift);
    vec3 from = seen(placeOlder);
    vec3 to = seen(placeNewer);
    float nearest = min(from.z, to.z);
    // How far each end stands, as a share of the black hole's distance, which its side is told by
    float awayOlder = from.z;
    float awayNewer = to.z;
    if (u_ride.x > 0.0) {
      // Particles on Sheet: a particle of the flow is laid from its place in the scene, its tilt and its
      // height in the disc with it, as one of the field is: dropped onto the equator, ridden by its height
      vec3 olderIn = vec3(dot(u_inPlaneU.xyz, placeOlder), dot(u_inPlaneV.xyz, placeOlder), dot(u_inPlaneH.xyz, placeOlder)) +
        vec3(u_inPlaneU.w, u_inPlaneV.w, u_inPlaneH.w);
      vec3 newerIn = vec3(dot(u_inPlaneU.xyz, placeNewer), dot(u_inPlaneV.xyz, placeNewer), dot(u_inPlaneH.xyz, placeNewer)) +
        vec3(u_inPlaneU.w, u_inPlaneV.w, u_inPlaneH.w);
      float shareOlder = rideShare(olderIn.z);
      float shareNewer = rideShare(newerIn.z);
      if (shareOlder + shareNewer > 0.0) {
        vec3 laidFrom = underneath(olderIn.xy);
        vec3 laidTo = underneath(newerIn.xy);
        // An end nearer than the sheet camera's near plane is cut back to it, the stroke with it
        float cut = rideCut(laidFrom, laidTo);
        if (cut < 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        if (cut > 0.0) {
          if (laidFrom.z < laidTo.z) {
            laidFrom = mix(laidFrom, laidTo, cut);
            from = mix(from, to, cut);
            shareOlder = mix(shareOlder, shareNewer, cut);
          } else {
            laidTo = mix(laidFrom, laidTo, cut);
            to = mix(from, to, cut);
            shareNewer = mix(shareOlder, shareNewer, cut);
          }
        }
        // Distances from the camera in CSS pixels; the flat mode sees the flow straight on, at no depth
        float holeAway = u_turnX.w > 0.0 ? u_turnY.w / u_turnZ.w : 1.0;
        float fromAway = from.z * holeAway;
        float toAway = to.z * holeAway;
        from.xy = laidOn(from.xy / u_turnZ.w, fromAway, laidFrom, shareOlder) * u_turnZ.w;
        to.xy = laidOn(to.xy / u_turnZ.w, toAway, laidTo, shareNewer) * u_turnZ.w;
        float laidOlder = mix(fromAway, mix(fromAway, laidFrom.z, u_ride.w), shareOlder) / holeAway;
        float laidNewer = mix(toAway, mix(toAway, laidTo.z, u_ride.w), shareNewer) / holeAway;
        nearest = min(laidOlder, laidNewer);
        awayOlder = laidOlder;
        awayNewer = laidNewer;
      }
    }
    if (nearest <= u_style.w) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // The camera's zoom is applied to the stroke itself, so it is drawn anew at its larger size
    vec2 start = u_zoom.xy + (from.xy - u_zoom.xy) * u_zoom.z;
    vec2 finish = u_zoom.xy + (to.xy - u_zoom.xy) * u_zoom.z;
    // A particle goes wholly to one side, past a share of its own, as the field's do, each end of its stroke
    // by its own depth, and an end in front is drawn where its share of the nearer lens shows it
    float own = fract(a_flowSeed.w * 29.0 + a_flowSeed.x * 17.0);
    vec3 sideOlder = sideOf(awayOlder, start);
    vec3 sideNewer = sideOf(awayNewer, finish);
    float frontOlder = sideOlder.x > own ? 1.0 : 0.0;
    float frontNewer = sideNewer.x > own ? 1.0 : 0.0;
    start = placedBy(start, sideOlder * frontOlder, sideNewer * frontNewer);
    vec2 delta = placedBy(finish, sideNewer * frontNewer, sideOlder * frontOlder) - start;
    v_cut = vec2(0.0);
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float width = u_place.w * u_zoom.z;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;
    float toNewer = 1.0 - a_flowCorner.x;
    v_front = mix(frontOlder, frontNewer, toNewer);
    float along = mix(-extent, len + extent, toNewer);
    float across = a_flowCorner.y * extent;
    vec2 pixel = start + direction * along + normal * across;
    float targetArea = len * width + PI * width * width * 0.25;
    float drawnArea = len * drawWidth + PI * (halfWidth * halfWidth + 1.0 / 12.0);

    float light = u_light.a * mix(u_style.x, 1.0, a_flowSeed.w) * mix(lightOlder, lightNewer, toNewer) * smoothstep(u_style.w, u_style.z, nearest);
    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(u_light.rgb, min(light * targetArea / drawnArea, 1.0));
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`
