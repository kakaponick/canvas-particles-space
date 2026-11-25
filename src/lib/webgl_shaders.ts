// WebGL shaders for the particle renderer: trail fade, particle segments and the composite pass,
// which draws the black hole, the explosion's light and the intro title over the scene. They run on WebGL2
// and are still written in GLSL ES 1.00, which WebGL2 compiles as it is.

import { SHADOW_SAMPLES } from './kerr_shadow'
import { KERR_GLSL } from './kerr_glsl'
import { LATTICE_SEGMENTS } from './space_lattice'

// Attribute locations shared by every program; location 0 is always the full-screen quad
export const ATTRIBUTE_LOCATIONS = {
  position: 0,
  segment: 1,
  style: 2,
  color: 3,
  gridLine: 4,
  latticeLine: 5
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
  // b = sqrt(27) / 2 rs, which leaves rs / nearest = x / (3 cos(acos(-x) / 3)) with x = edge / b
  float dent (float away, float edge) {
    float x = edge / max(away, edge);
    float slowed = 1.0 - sqrt(max(1.0 - x / (3.0 * cos(acos(-x) / 3.0)), 0.0));
    return slowed * 2.3660254;
  }
`

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
  attribute vec4 a_segment;   // x0, y0, x1, y1 in CSS pixels, top-left origin
  attribute vec2 a_style;     // line width in CSS pixels, opacity
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform float u_pixelRatio;
  uniform vec2 u_center;      // vanishing point in CSS pixels
  uniform float u_doppler;    // 0 at rest, 1 near the speed of light
  uniform float u_speedGlow;  // how strongly brightness follows speed; 0 lights every moving particle in full
  uniform float u_speedKnee;  // speed, in CSS pixels per 60 Hz frame, at which a particle reaches half its brightness
  uniform vec3 u_tintAhead;   // the tint of a fast flight: its colour round the vanishing point,
  uniform vec3 u_tintEdge;    // its colour toward the edges,
  uniform vec2 u_tint;        // how fast it turns from one to the other per half screen diagonal, the most of a colour it replaces
  uniform float u_frameScale; // length of this frame in 60 Hz reference frames
  uniform vec4 u_zoom;        // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_zoomFrom;    // the camera of the frame before, the same way

  varying vec2 v_ends;        // distance along the segment from its start and from its end
  varying float v_across;     // signed distance from the segment axis
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;

  void main () {
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

    // Brightness is set by speed directly: the capsule is stamped with the brighter-of-two blend, so
    // overlapping stamps of a slow particle do not add up and its edge stays sharp. The speed is taken
    // per 60 Hz frame, so the result is the same at any refresh rate, and u_speedGlow bends the link
    // The speed is the particle's own, whatever the camera does
    float referenceSpeed = length(a_segment.zw - a_segment.xy) / max(u_frameScale, 0.0001);
    float glow = pow(max(referenceSpeed / (referenceSpeed + u_speedKnee), 0.000001), u_speedGlow);

    // Relativistic aberration, stylised: light ahead shifts blue, light at the edges shifts red
    // Measured from the vanishing point, in half screen diagonals
    float radial = length(a_segment.zw - u_center) * 2.0 * u_pixelRatio / max(length(u_resolution), 1.0);
    float shift = u_doppler * (1.0 - u_tint.x * radial);
    vec3 tint = shift > 0.0 ? u_tintAhead : u_tintEdge;

    v_ends = vec2(along, len - along);
    v_across = across;
    v_halfWidth = halfWidth;
    v_color = vec4(mix(a_color.rgb, tint, min(abs(shift), u_tint.y)), min(a_style.y * glow * targetArea / drawnArea, 1.0));

    // Rows stay top-down in the scene texture, which is the layout the composite pass samples
    gl_Position = vec4(pixel / u_resolution * 2.0 - 1.0, 0.0, 1.0);
  }
`

// The traces of the orbiting stars (orbiters.ts): every stretch a star has flown is kept as a line and
// all of them are drawn anew each frame, at the camera's zoom and around the black hole as it is now
export const orbitVertexShaderSource = `
  attribute vec2 a_position;  // quad corner: x picks the end of the stretch, y the side
  attribute vec4 a_segment;   // its start and end, in Schwarzschild radii from the black hole
  attribute vec2 a_style;     // how far the traces had dimmed when it was last flown, its brightness then
  attribute vec4 a_color;     // rgb as normalized bytes

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform vec4 u_zoom;        // the camera: the point its zoom leaves in place (device pixels), the zoom
  uniform vec4 u_orbit;       // the black hole (device pixels), device pixels in a Schwarzschild radius, line width in device pixels
  uniform float u_dimmed;     // brightness every trace has lost since the traces began
  uniform vec4 u_turnX;       // 3D: where the camera turns the orbits' x axis, and its focal length in device pixels (0 = flat)
  uniform vec4 u_turnY;       // where it turns their y axis, and the black hole's distance in device pixels (below 0: behind the camera, not drawn)

  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying vec4 v_color;

  const float PI = 3.14159265359;

  // A point of an orbit, in device pixels from the black hole, as the 3D camera sees it
  vec2 seenOrbit (vec2 point) {
    vec3 turned = u_turnX.xyz * point.x + u_turnY.xyz * point.y;
    return turned.xy * u_turnX.w / max(u_turnY.w + turned.z, 1.0);
  }

  void main () {
    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_color = vec4(0.0);
    // A trace loses brightness evenly, so every one of them reaches black
    float brightness = a_style.y - (u_dimmed - a_style.x);
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
    if (u_turnX.w > 0.0) {
      vec2 first = seenOrbit(a_segment.xy * u_orbit.z);
      start = u_zoom.xy + (u_orbit.xy + first - u_zoom.xy) * u_zoom.z;
      delta = (seenOrbit(a_segment.zw * u_orbit.z) - first) * u_zoom.z;
    } else {
      start = u_zoom.xy + (u_orbit.xy + a_segment.xy * u_orbit.z - u_zoom.xy) * u_zoom.z;
      delta = (a_segment.zw - a_segment.xy) * u_orbit.z * u_zoom.z;
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

export const particleFragmentShaderSource = `
  precision highp float;

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
  uniform float u_twistLimit;    // cap on the pull the twist follows, so a wide lens does not wind up the scene
  uniform float u_absorption;    // light the lens's pull removes around the shadow
  uniform vec4 u_trace;          // Ray Traced lens: 1 / the camera's distance in Schwarzschild radii (0 = the stylized lens), pixels of 2 tan(angle / 2) from the hole, share of the bend shown, unused
  uniform vec4 u_spin;           // the hole's spin a/M (0 = none), cosine and sine of its axis's angle to the line to the camera, turn of the axis on screen from up toward the left
  uniform sampler2D u_shadowShape; // a spinning hole's shadow: its radius all the way round, in round-shadow radii, from the axis's right toward its up
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
  uniform vec2 u_pair;           // the centre the two black holes turn around
  uniform vec4 u_pairWave;       // their spiral gravitational wave: pixels of stretch (0 = off), the pair's angle, turn of its arms per pixel, radius beyond which it weakens
  uniform vec4 u_pairFront;      // once the two are one: seconds since then (negative = not yet), pixels the wave travels a second, seconds the old wave takes to give way to the new
  uniform float u_backgroundStars;
  uniform float u_starCell;        // CSS pixels per background-star cell
  uniform float u_starDensity;     // share of cells holding a star
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
  uniform vec3 u_dustFlare;        // the flare at the matter front: widths of the front outside its middle, its thinness (a rate for exp2), the share of the light's colour in it
  uniform sampler2D u_orbitTrails; // the orbiting stars and the traces they leave
  uniform float u_orbits;          // 1 while there are orbiting stars; 0 leaves their layer unread
  uniform float u_skyGrid;        // brightness of the flat grid on the sky behind the hole; 0 turns it off
  uniform float u_gridCell;        // CSS pixels per cell of that grid
  uniform float u_skyGridLine;     // half the width of a line of that grid, CSS pixels
  uniform vec4 u_skyShift;         // CSS pixels the 3D camera's turn slides the stars (xy) and that grid (zw) by; zeros when flat
  uniform vec3 u_skyRoll;          // the 3D camera's roll: its cosine and sine, 1 while it rolls
  uniform vec4 u_nebula;           // the nebula's brightness (0 turns it off), CSS pixels the 3D camera's turn slides it by (yz), CSS pixels of a full turn (0 when flat)
  uniform vec3 u_nebulaColor;
  uniform vec3 u_nebulaColorDeep;
  uniform vec3 u_nebulaColorCore;
  uniform vec4 u_nebulaShape;      // its clouds: CSS pixels across, the level they start at and the width of their edge, how hard the slower noise bends them
  uniform vec4 u_nebulaLook;       // how much denser the middle of a cloud is, its grain, how far the thickest cloud turns to the core colour, and the thickness that starts at
  uniform vec3 u_nebulaPatch;      // patches of the second colour: CSS pixels across, the two levels of a noise they turn over between
  uniform vec2 u_nebulaDrift;      // CSS pixels a second the clouds are read further along, so they drift the other way
  uniform float u_gridPull;        // how far the Lensed Grid is drawn in towards the hole, the Pull; 0 leaves it flat
  uniform vec2 u_gridHaze;         // device pixels a cell of it pulled in shrinks to before its lines start to merge into a haze, and those at which the haze is whole
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

${DENT_GLSL}
  // Where the Lensed Grid's pull draws a node this many pixels from the black hole: the lattice's law, the
  // slowing of time in shadow radii times the Pull, taken as R -> R^2 / (R + wish), so no line folds over
  float pulledIn (float away) {
    float wish = u_gridPull * (away >= u_horizon ? u_horizon * dent(away, u_horizon) : away);
    return away * away / (away + wish);
  }

  // The nebula: clouds made as the opening's dust is, with every number its own. The noise is read
  // through a slower one that bends it into wisps (u_nebulaShape.w), sharpened into clouds from a level
  // (yz), made denser in the middle (u_nebulaLook.x) and grained (y). Its colour turns to the second one in
  // patches (u_nebulaPatch) and to the core colour where the cloud is thickest (u_nebulaLook.zw)
  vec3 nebulaLight (vec2 cssPx) {
    vec2 p = cssPx / u_nebulaShape.x;
    p += u_nebulaShape.w * (vec2(valueNoise(p * 0.8 + 3.1), valueNoise(p * 0.8 + 17.4)) - 0.5);
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float n = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      n += amplitude * valueNoise(p);
      p = turn * p * 2.1 + 11.7;
      amplitude *= 0.5;
    }
    float cloud = smoothstep(u_nebulaShape.y, u_nebulaShape.y + u_nebulaShape.z, n);
    float density = cloud * (1.0 - u_nebulaLook.x + u_nebulaLook.x * cloud) * (1.0 - u_nebulaLook.y + u_nebulaLook.y * valueNoise(p * 1.7));
    float other = smoothstep(u_nebulaPatch.y, u_nebulaPatch.z, valueNoise(cssPx / u_nebulaPatch.x + 23.0));
    vec3 tint = mix(u_nebulaColor, u_nebulaColorDeep, other);
    if (u_nebulaLook.z > 0.0) tint = mix(tint, u_nebulaColorCore, u_nebulaLook.z * smoothstep(u_nebulaLook.w, 1.0, cloud));
    return tint * density;
  }

  // Static distant stars, one at most per cell; they flare as the light front passes
  // Where a point of the screen was before a rolling 3D camera turned the sky about the middle of the
  // screen, in CSS pixels
  vec2 unrolled (vec2 cssPx) {
    if (u_skyRoll.z == 0.0) return cssPx;
    vec2 fromMiddle = cssPx - 0.5 * u_resolution / u_pixelRatio;
    return 0.5 * u_resolution / u_pixelRatio + vec2(u_skyRoll.x * fromMiddle.x - u_skyRoll.y * fromMiddle.y, u_skyRoll.y * fromMiddle.x + u_skyRoll.x * fromMiddle.y);
  }

  vec3 backgroundStar (vec2 cssPx, float flare) {
    vec2 cell = floor(cssPx / u_starCell);
    float presence = hash12(cell);
    if (presence > u_starDensity) return vec3(0.0);
    vec2 position = (cell + 0.2 + 0.6 * vec2(hash12(cell + 7.3), hash12(cell + 13.1))) * u_starCell;
    // A star is a point of light: the zoom moves the stars apart and leaves each the size it was
    float d = length(cssPx - position) * u_cameraZoom;
    float brightness = hash12(cell + 3.7);
    float twinkle = u_starLook.y + u_starLook.z * sin(u_time * (u_starLook.w * (2.0 + 3.0 * brightness)) + presence * 400.0);
    vec3 tint = mix(u_starWarm.rgb, u_starCool.rgb, hash12(cell + 29.0));
    return tint * exp(-d * d / u_starLook.x) * (u_starWarm.a + u_starCool.a * brightness * brightness) * twinkle * (1.0 + flare);
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

  // How strong a gravitational wave is at a distance from where it left: its strain falls as 1 / r, since
  // the same energy crosses an ever larger sphere. Closer than the edge there is no wave yet, only the
  // field of the source itself, which fades to nothing at the centre
  float waveReach (float dist, float edge) {
    float share = dist / edge;
    return share < 1.0 ? share * share : 1.0 / share;
  }

  void main () {
    // Where this pixel is on the screen, and where the zoomed and jolted camera looks through it
    vec2 screen = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 frag = u_zoomCenter + (screen - u_zoomCenter) / u_cameraZoom + u_shake;
    // Pixels of the scene under one pixel of the screen: edges and hairlines are measured in it, so the
    // zoom leaves them as sharp and as thin as they were
    float px = 1.0 / u_cameraZoom;
    vec2 offset = frag - u_hole;
    float dist = length(offset);
    // A ringing horizon is an oval: longer along one axis by the share it is shorter along the other, so
    // it keeps its area, as a quadrupole does. The shadow, the lens and the photon ring all measure their
    // distance in that oval, so they wobble together. (x*x - y*y) / (r*r) and 2*x*y / (r*r) are the cosine
    // and the sine of twice the angle, which u_holeOval turns to the oval's long axis
    if (u_holeOval != vec2(0.0)) {
      dist /= 1.0 + (u_holeOval.x * (offset.x * offset.x - offset.y * offset.y) + u_holeOval.y * 2.0 * offset.x * offset.y) / max(dist * dist, 0.0001);
    }
    // A spinning hole's shadow is not round: its edge in this direction, from the outline the main thread
    // worked out (kerr_shadow.ts), turned with the axis. The shadow, the photon ring and the traced lens's
    // capture all follow it
    float shadowEdge = u_horizon;
    if (u_spin.x > 0.0) {
      float around = (atan(-offset.y, offset.x) - u_spin.w) / (2.0 * PI);
      shadowEdge *= texture2D(u_shadowShape, vec2(around + 0.5 / SHADOW_SAMPLES, 0.5)).r;
    }
    // 1 where a traced ray fell into a spinning hole outside the outline drawn, which is only ever a hair
    float fallen = 0.0;
    vec2 samplePx = frag;

    // Gravitational wave: the horizon's wobble carried outward at the speed of light. Each point shows the
    // wobble the horizon had when the wave left it, u_gravityWaveTime - r / c ago. A gravitational wave
    // moves nothing along its way: what it stretches and squeezes lies across it. So the sky is not pushed
    // out and in, as sound would push it, but slid sideways, most where the oval's long axis stood at 45
    // degrees to the direction, and it weakens as 1 / r
    vec2 fromCenter = frag - u_center;
    float centerDist = length(fromCenter);
    if (u_gravityWaveAmplitude > 0.0) {
      vec2 fromWave = frag - u_gravityWaveCenter;
      float waveDist = length(fromWave);
      float emitted = u_gravityWaveTime - waveDist / u_gravityWaveTurn.w;
      // A quarter of a wobble, over which the wave of a merger takes over from the pair's
      float quarter = 1.5707963 / u_gravityWaveOmega;
      if (emitted > (u_gravityWaveTurn.z == 0.0 ? 0.0 : -quarter)) {
        float invDist = 1.0 / max(waveDist, 0.0001);
        float cos2 = (fromWave.x * fromWave.x - fromWave.y * fromWave.y) * invDist * invDist;
        float sin2 = 2.0 * fromWave.x * fromWave.y * invDist * invDist;
        float phase = u_gravityWaveOmega * emitted;
        // The sine of twice the angle between this direction and the oval's long axis as the wave left
        float across;
        if (u_gravityWaveTurn.z == 0.0) {
          // A hole that formed alone wobbles in place: long sideways, then long upright
          across = sin(phase) * sin2;
        } else {
          // Two that became one leave an oval that turns the way they circled, half a turn a wobble
          across = (sin2 * u_gravityWaveTurn.x - cos2 * u_gravityWaveTurn.y) * cos(phase)
            - u_gravityWaveTurn.z * (cos2 * u_gravityWaveTurn.x + sin2 * u_gravityWaveTurn.y) * sin(phase);
          across *= smoothstep(-quarter, quarter, emitted);
        }
        float strength = u_gravityWaveAmplitude * exp(-max(emitted, 0.0) * u_gravityWaveInvDecay) * waveReach(waveDist, u_gravityWaveRadius);
        // Reading the scene from further round shows it slid back along the circle
        samplePx += vec2(-fromWave.y, fromWave.x) * invDist * strength * across;
      }
    }

    // Two black holes circling each other send out a wave of the same kind without end. Each point shows
    // the line between them as it stood when the wave left, so the pattern winds into a two-armed spiral
    // that turns with the pair. Once they are one, the last of it keeps flying off ahead of the new hole's
    // own ringing, which follows it out from the middle
    if (u_pairWave.x > 0.0) {
      vec2 fromPair = frag - u_pair;
      float pairDist = length(fromPair);
      float invDist = 1.0 / max(pairDist, 0.0001);
      float turn = 2.0 * (u_pairWave.z * pairDist - u_pairWave.y);
      float across = (2.0 * fromPair.x * fromPair.y * cos(turn) + (fromPair.x * fromPair.x - fromPair.y * fromPair.y) * sin(turn)) * invDist * invDist;
      float strength = u_pairWave.x * waveReach(pairDist, u_pairWave.w);
      if (u_pairFront.x >= 0.0) strength *= smoothstep(-u_pairFront.z, u_pairFront.z, pairDist / u_pairFront.y - u_pairFront.x);
      samplePx += vec2(-fromPair.y, fromPair.x) * invDist * strength * across;
    }

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
      float ratio = u_einstein / max(dist, 0.0001);
      bend = ratio * ratio;
      if (u_falloff != 2.0) bend *= pow(u_falloffPivot / max(dist, 0.0001), u_falloff - 2.0);
      bend = min(bend, u_maxBend);
      if (bend * dist * (1.0 + abs(u_swirl)) > 0.01) {
        // The original canvas scaled the picture around the hole by the cosine of the pull: a bubble whose
        // distortion dies off with the cube of the distance, rippling into nested rings inside the ring.
        // A point mass, r * (1 - pull), bends rays far across the screen instead, and inside the ring it
        // turns negative: the ray comes from the other side of the hole, which is the mirrored second
        // image a real lens shows there. u_lensReach blends the two; both are zero at the ring, so the
        // ring stays where it is
        float wave = cos(0.5 * PI * bend);
        float radial = mix(wave, 1.0 - bend, u_lensReach);
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

    // The second black hole bends the ray as a point mass does, on top of the first
    float companionDist = 0.0;
    if (u_companion.z > 0.0) {
      vec2 fromCompanion = frag - u_companion.xy;
      companionDist = length(fromCompanion);
      if (u_companion.w > 0.0) {
        float closest = 0.5 * u_companion.z;
        samplePx -= fromCompanion * (u_companion.w * u_companion.w / max(companionDist * companionDist, closest * closest));
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

    vec2 layerPx = layerPoint(samplePx);
    // The orbiting stars are read through the same bent ray as the particles
    vec3 color = drawn(layerPx);
    if (u_lensFringe > 0.0) {
      // A simple lens bends red less and blue more, and more so away from the middle of the frame. Both
      // layers go through it: red and blue taken from the particles alone would leave the orbits green
      vec2 split = (screen - 0.5 * u_resolution) / (0.5 * length(u_resolution)) * u_lensFringe;
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
        for (int i = 1; i <= 3; i++) {
          float lag = 1.0 - 0.13 * float(i);
          trail += (0.6 - 0.15 * float(i)) * titleMask((titleSource(fromHole, holeDist, fall * lag) - u_titleCenter) / titleSpan);
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
      emitted += backgroundStar(unrolled(cssPx) + u_skyShift.xy, flare) * u_backgroundStars;
    }
    if (u_nebula.x > 0.0) {
      // Behind the stars and read where the bent ray comes from, like them, and drifting on its own
      vec2 nebulaAt = unrolled(cssPx) + u_nebula.yz + u_nebulaDrift * u_time;
      vec3 nebula = nebulaLight(nebulaAt);
      // In 3D the turn slides it by up to a full turn's width, and the nebula a full turn on takes over as
      // the turn comes round, so it never jumps
      if (u_nebula.w > 0.0) nebula = mix(nebula, nebulaLight(nebulaAt - vec2(u_nebula.w, 0.0)), smoothstep(0.0, 1.0, u_nebula.y / u_nebula.w));
      emitted += nebula * u_nebula.x;
    }
    if (u_skyGrid > 0.0) {
      // A square grid on the sky, with a line through the middle of the screen. It is read where the
      // bent ray comes from, so the lens, the gravitational wave and the matter front bend it like the
      // stars, and it widens where the lens magnifies
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
      vec2 fromLine = abs(fract((unrolled(gridAt) + u_skyShift.zw - 0.5 * u_resolution / u_pixelRatio) / u_gridCell - 0.5) - 0.5) * u_gridCell;
      float line = clamp((u_skyGridLine - min(fromLine.x, fromLine.y) * u_cameraZoom / squeeze) * u_pixelRatio + 0.5, 0.0, 1.0);
      if (squeeze > 1.0) {
        // Where the cells shrink to a few pixels their lines merge into a haze of the light they share
        float cellPx = u_gridCell * u_cameraZoom * u_pixelRatio / squeeze;
        line = mix(line, min(4.0 * u_skyGridLine * u_pixelRatio / cellPx, 1.0), smoothstep(u_gridHaze.x, u_gridHaze.y, cellPx));
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
      vec3 echoColor = mix(u_colorDust, u_colorLight, fresh * fresh);
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

    // Each black hole's shadow also hides the part of the other's ring that lies behind it
    float besideCompanion = 1.0;
    if (u_companion.z > 0.0) {
      besideCompanion = smoothstep(u_companion.z - px, u_companion.z + px, companionDist);
      color *= besideCompanion;
    }

    if (u_horizon > 0.0) {
      float besideHole = smoothstep(shadowEdge - px, shadowEdge + px, dist);
      if (u_spin.x > 0.0) besideHole *= 1.0 - fallen * u_trace.z;
      color *= besideHole;

      // The second black hole's ring is a plain line: no matter is tracked falling into it
      if (u_companion.z > 0.0 && u_ring > 0.0 && companionDist < u_companion.z * u_ringLine.z) {
        float ringLine = u_ringLine.x * px + u_ringWidth * u_companion.z;
        float fromLine = companionDist - u_companion.z - u_ringLine.y * ringLine;
        float inner = fromLine / (u_ringLine.w * ringLine);
        float line = exp(-inner * inner);
        if (u_ringGlow > 0.0) {
          vec2 spread = fromLine / (u_companion.z * u_ringGlowShape.xy);
          line += u_ringGlow * dot(u_ringGlowShape.zw, exp(-spread * spread));
        }
        color += u_ringColor * u_ring * u_ringBase * line * besideHole;
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
        float infall = texture2D(u_ringEnergy, vec2((ringAngle - u_ringPhase) / (2.0 * PI), 0.5)).r;
        line *= u_ringBase + u_ringFeed * infall;

        // Doppler beaming: light moving towards the viewer is brighter and bluer, the far side dimmer and redder
        float side = cos(ringAngle - u_ringSide);
        // Scaled so the bright side peaks at the ring's brightness: clipping to white would thicken the line
        float boost = (1.0 + 0.5 * u_ringDoppler * side) / (1.0 + 0.5 * u_ringDoppler);
        // The colour follows the square of the contrast: a mild one only brightens and dims the sides of
        // a white ring, a strong one also turns them blue and red
        vec3 tint = mix(u_ringColor, side > 0.0 ? u_ringApproaching : u_ringReceding, abs(side) * u_ringDoppler * u_ringDoppler);
        color += tint * u_ring * boost * boost * boost * line * besideCompanion;
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

// The space sheet (space_grid.ts), drawn over the finished frame. Every length uniform here is in CSS
// pixels

export const gridVertexShaderSource = `
  attribute vec2 a_position;  // quad corner: x picks the end of the piece, y the side
  attribute vec4 a_gridLine;  // line number counted from the black hole, start and end along the line (-1..1), 1 = runs across the screen

  uniform vec2 u_resolution;  // drawing buffer size in device pixels
  uniform float u_pixelRatio;
  uniform vec2 u_view;        // the point the camera looks at
  uniform vec4 u_camera;      // its distance from the camera, sine and cosine of the tilt, line width
  uniform vec4 u_well;        // the black hole on the sheet relative to that point, the radius its well ends at, the well's depth
  uniform vec4 u_well2;       // a second black hole's well, placed from the first: across, away, radius, depth; depth 0 = none
  uniform vec4 u_pairWave;    // the pair's spiral wave: height (0 = off), the pair's angle on the sheet, turn of its arms per unit of distance, radius beyond which it weakens
  uniform vec2 u_pairAt;      // the centre the two turn around, from the first well
  uniform vec2 u_lines;       // cell size, how far from the black hole the lines reach
  uniform vec4 u_sheet;       // the share of the camera's distance nearer than which the sheet is cut off, the most a line widens near the camera, the distance from the black hole the lines begin to fade out at, unused
  uniform vec4 u_wave;        // gravitational wave: height, seconds since it left the hole, angular frequency, 1 / decay time
  uniform vec2 u_waveSpread;  // radius beyond which the wave weakens, how far it travels a second
  uniform vec4 u_waveTurn;    // cosine and sine of twice the angle on the sheet the oval's long axis had as the ringing began, the way it turns there (1, -1; 0 = it wobbles in place), unused
  uniform vec4 u_pairFront;   // once the two are one: seconds since then (negative = not yet), how far the wave travels a second, seconds the old wave takes to give way to the new
  uniform vec4 u_lens;        // the scene camera: centre of its zoom, the zoom, unused
  uniform vec2 u_jolt;        // the scene camera's shake
  uniform vec4 u_spin;        // 3D: cosine and sine of the turn that spins the lines in the sheet's plane, 1 while it is on
  uniform vec3 u_roll;        // 3D: cosine and sine of the camera's roll, which turns the drawn sheet about u_view, 1 while it is on

  varying vec2 v_ends;        // distance along the piece from its start and from its end
  varying float v_across;     // signed distance from its axis
  varying float v_halfWidth;
  varying float v_alpha;

${DENT_GLSL}
  // How strong a gravitational wave is at a distance from where it left: it falls as 1 / r. Closer than
  // the edge there is no wave yet, only the field of the source itself, which fades to nothing at the centre
  float waveReach (float dist, float edge) {
    float share = dist / edge;
    return share < 1.0 ? share * share : 1.0 / share;
  }

  // A point of the sheet, given from the black hole: its place on screen, its size there relative to
  // the point the camera looks at (negative behind the cut), and how lit it is
  vec4 onScreen (vec2 fromHole) {
    float r = length(fromHole);
    float depth = 0.0;
    if (u_well.w > 0.0) depth = u_well.w * dent(r, u_well.z);
    // A second black hole dents the sheet the same way, and the dents add up
    if (u_well2.w > 0.0) depth += u_well2.w * dent(length(fromHole - u_well2.xy), u_well2.z);
    // The pair's spiral wave is drawn as height: the sheet rises where the wave stretches space along the
    // line the two stood on as it left, and sinks where it squeezes. The composite pass slides the sky by
    // the same wave
    if (u_pairWave.x > 0.0) {
      vec2 fromPair = fromHole - u_pairAt;
      float pairDist = length(fromPair);
      float turn = 2.0 * (u_pairWave.z * pairDist - u_pairWave.y);
      float height = u_pairWave.x * waveReach(pairDist, u_pairWave.w);
      if (u_pairFront.x >= 0.0) height *= smoothstep(-u_pairFront.z, u_pairFront.z, pairDist / u_pairFront.y - u_pairFront.x);
      depth += height *
        ((fromPair.x * fromPair.x - fromPair.y * fromPair.y) * cos(turn) - 2.0 * fromPair.x * fromPair.y * sin(turn)) / max(pairDist * pairDist, 0.0001);
    }
    // The wave of a ringing hole, the same way: a hole that formed alone wobbles in place, two that
    // became one leave an oval that turns
    if (u_wave.x > 0.0) {
      float emitted = u_wave.y - r / u_waveSpread.y;
      float quarter = 1.5707963 / u_wave.z;
      if (emitted > (u_waveTurn.z == 0.0 ? 0.0 : -quarter)) {
        float cos2 = (fromHole.x * fromHole.x - fromHole.y * fromHole.y) / max(r * r, 0.0001);
        float sin2 = 2.0 * fromHole.x * fromHole.y / max(r * r, 0.0001);
        float phase = u_wave.z * emitted;
        float along;
        if (u_waveTurn.z == 0.0) {
          along = sin(phase) * cos2;
        } else {
          along = (cos2 * u_waveTurn.x + sin2 * u_waveTurn.y) * cos(phase) + u_waveTurn.z * (sin2 * u_waveTurn.x - cos2 * u_waveTurn.y) * sin(phase);
          along *= smoothstep(-quarter, quarter, emitted);
        }
        depth += u_wave.x * exp(-max(emitted, 0.0) * u_wave.w) * waveReach(r, u_waveSpread.x) * along;
      }
    }
    vec2 place = fromHole + u_well.xy;
    float behind = u_camera.x + depth * u_camera.z - place.y * u_camera.y;
    float scale = u_camera.x / max(behind, 1.0);
    vec2 point = u_view + vec2(place.x, place.y * u_camera.z + depth * u_camera.y) * scale;
    if (u_roll.z > 0.0) {
      vec2 fromView = point - u_view;
      point = u_view + vec2(u_roll.x * fromView.x + u_roll.y * fromView.y, u_roll.x * fromView.y - u_roll.y * fromView.x);
    }
    // The scene camera of the intro zooms and jolts the sheet with the rest of the frame
    point = u_lens.xy + (point - u_jolt - u_lens.xy) * u_lens.z;
    float lit = 1.0 - smoothstep(u_sheet.z, u_lines.y, r);
    return vec4(point, behind > u_sheet.x * u_camera.x ? scale * u_lens.z : -1.0, lit);
  }

  void main () {
    bool crosswise = a_gridLine.w > 0.5;
    // Pieces are short near the black hole, where the sheet curves, and long far from it
    vec2 along = sign(a_gridLine.yz) * a_gridLine.yz * a_gridLine.yz * u_lines.y;
    float across;
    vec4 first;
    vec4 last;
    if (u_spin.z > 0.0) {
      // In 3D the lines are laid on the sheet turned by the camera's turn, around the point the camera
      // looks at, and seen from where the camera stands; the wells are where the black holes are seen
      vec2 wellOnSheet = vec2(u_spin.x * u_well.x + u_spin.y * u_well.y, u_spin.x * u_well.y - u_spin.y * u_well.x);
      across = (a_gridLine.x - fract((crosswise ? wellOnSheet.y : wellOnSheet.x) / u_lines.x)) * u_lines.x;
      vec2 pieceStart = crosswise ? vec2(along.x, across) : vec2(across, along.x);
      vec2 pieceEnd = crosswise ? vec2(along.y, across) : vec2(across, along.y);
      first = onScreen(vec2(u_spin.x * pieceStart.x - u_spin.y * pieceStart.y, u_spin.y * pieceStart.x + u_spin.x * pieceStart.y));
      last = onScreen(vec2(u_spin.x * pieceEnd.x - u_spin.y * pieceEnd.y, u_spin.y * pieceEnd.x + u_spin.x * pieceEnd.y));
    } else {
      // The lines stay where they are on the sheet while the black hole moves across it
      across = (a_gridLine.x - fract((crosswise ? u_well.y : u_well.x) / u_lines.x)) * u_lines.x;
      first = onScreen(crosswise ? vec2(along.x, across) : vec2(across, along.x));
      last = onScreen(crosswise ? vec2(along.y, across) : vec2(across, along.y));
    }

    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_alpha = 0.0;
    if (abs(across) > u_lines.y || first.z < 0.0 || last.z < 0.0 || first.w + last.w <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec2 start = first.xy * u_pixelRatio;
    vec2 delta = last.xy * u_pixelRatio - start;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // Lines thinner than a pixel are drawn one pixel wide and dimmed by the area they would cover
    float end = a_position.x * 0.5 + 0.5;
    float width = u_camera.w * u_pixelRatio * min(mix(first.z, last.z, end), u_sheet.y);
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

  varying vec2 v_ends;
  varying float v_across;
  varying float v_halfWidth;
  varying float v_alpha;

  void main () {
    // Round caps, so the pieces of a line join without a notch
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float alpha = v_alpha * clamp(v_halfWidth + 0.5 - length(vec2(beyondEnds, v_across)), 0.0, 1.0);
    vec2 screen = vec2(gl_FragCoord.x, u_frame.x - gl_FragCoord.y);
    // The black hole stands in front of the sheet: no line crosses its shadow or its ring
    if (u_shadow.z > 0.0) alpha *= smoothstep(u_shadow.z * u_clearing.x + 1.0, u_shadow.z * u_clearing.y + 2.0, length(screen - u_shadow.xy));
    if (u_shadow2.z > 0.0) alpha *= smoothstep(u_shadow2.z * u_clearing.x + 1.0, u_shadow2.z * u_clearing.y + 2.0, length(screen - u_shadow2.xy));
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

// The lines of the space lattice (space_lattice.ts): each piece is bent towards the black holes and set in
// front of the camera, at the camera's zoom, into the layer the orbits' traces are drawn in
export const latticeVertexShaderSource = `
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

    vec2 startPx = onLayer(first);
    vec2 delta = onLayer(last) - startPx;
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
