// The photon program: draws the photons of the space sheet's flash (photons.ts) as strokes on the sheet, over
// the finished frame after the sheet's lines, riding its surface as the lit lines do. Each photon is
// PHOTON_PIECES pieces of its own path, from where it is at the run's time back along its trail, read from
// the table `tracePhotons` filled, which stands on the graphics card as a texture. The main thread traces the
// table again when the place the scene traces from (followFlash in photons.ts) or the count changes, and
// draws it moved to where the flash stands; a frame hands over a few uniforms and one instanced draw. Off (Photons 0), nothing of it is traced, bound or drawn

import { ATTRIBUTE_LOCATIONS, MODERN_VERTEX, QUAD_VERTEX_COUNT, SHEET_GLSL, createProgram } from './webgl_shaders'
import { SHEET_UNIFORMS, sendSheet, type GridSettings } from './space_grid'
import { MAX_PHOTONS, PHOTON_COLUMNS, PHOTON_SAMPLES, PHOTON_TICK, tracePhotons } from './photons'
import { createSceneColor, type SceneColor } from './scene_color'

// The pieces a photon's trail is drawn in: what the vertex work holds it to. 16 follow a trail bent round the
// photon sphere closely enough that no corner shows at a trail of a few radii
const PHOTON_PIECES = 16
// The texture unit the table stands on, beside the renderer's fixed ones (0 to 11)
export const PHOTON_TEXTURE_UNIT = 12

const photonVertexShaderSource = MODERN_VERTEX + `
  attribute vec2 a_position;  // quad corner: x picks the end of the piece, y the side

  uniform highp sampler2D u_table; // each photon's places every tick (x, y on the plane, throat radii), its velocity past the table, the time it was taken (-1 = never)
  uniform vec4 u_frame;       // drawing buffer size in device pixels, device pixels per CSS pixel; unused
  uniform vec4 u_lens;        // the scene camera's zoom: the point it leaves in place, the zoom; unused
  uniform vec4 u_jolt;        // the scene camera's shake; unused
  uniform vec4 u_run;         // how far the light has run, the trail's length, both in throat radii of coordinate time, the run a taken photon fades out over, the stroke's width in CSS pixels
  uniform vec4 u_hole;        // the nearer black hole's distance from the camera as a share of the main one's (0 = nothing is in front), as the sheet takes it
  uniform vec4 u_place;       // the throat's radius in the plane's units, how far the flash stands from where it was traced, in throat radii; unused
${SHEET_GLSL}
  out vec2 v_ends;            // distance along the piece from its start and from its end
  out float v_across;         // signed distance from its axis
  out float v_halfWidth;
  out float v_light;          // how bright, 0 to 1: the trail fades toward its tail, a taken photon as it fades out
  out float v_front;          // 1 for a piece nearer the camera than the holes, which passes in front of the shadow

  const int PIECES = ${PHOTON_PIECES};
  const float PIECES_F = ${PHOTON_PIECES}.0;
  const int SAMPLES = ${PHOTON_SAMPLES};
  const float TICK = ${PHOTON_TICK};

  // Where photon "row" is at coordinate time t, on the plane in throat radii: between the table's two samples
  // round it, or past the table flying on straight at its last velocity
  vec2 photonAt (int row, float t) {
    float tick = t / TICK;
    if (tick >= float(SAMPLES - 1)) {
      vec2 last = texelFetch(u_table, ivec2(SAMPLES - 1, row), 0).xy;
      return last + texelFetch(u_table, ivec2(SAMPLES, row), 0).xy * (t - float(SAMPLES - 1) * TICK);
    }
    int i = int(floor(tick));
    vec2 a = texelFetch(u_table, ivec2(i, row), 0).xy;
    vec2 b = texelFetch(u_table, ivec2(i + 1, row), 0).xy;
    return mix(a, b, tick - float(i));
  }

  // A place of the plane, given in throat radii from the hole, in the sheet camera's space
  vec3 onSheet (vec2 traced) {
    vec2 at = (traced + u_place.yz) * u_place.x;
    return sheetSeen(at, sheetDepth(at) + sheetWave(at));
  }

  void main () {
    int row = gl_InstanceID / PIECES;
    int piece = gl_InstanceID - row * PIECES;
    v_ends = vec2(0.0);
    v_across = 0.0;
    v_halfWidth = 0.0;
    v_light = 0.0;
    v_front = 0.0;
    float run = u_run.x;
    float head = run - u_run.y * float(piece) / PIECES_F;
    float tail = max(run - u_run.y * float(piece + 1) / PIECES_F, 0.0);
    // A taken photon stays where it was taken and fades out over the fade's run from then
    float taken = texelFetch(u_table, ivec2(SAMPLES + 1, row), 0).x;
    float left = taken < 0.0 ? 1.0 : 1.0 - clamp((run - taken) / max(u_run.z, 0.0001), 0.0, 1.0);
    vec3 first = onSheet(photonAt(row, max(head, 0.0)));
    vec3 last = onSheet(photonAt(row, tail));
    float near = u_sheetV.w;
    if (head <= 0.0 || left <= 0.0 || (first.z < near && last.z < near)) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // A piece nearer the camera than the holes passes in front of their shadow; one behind it is hidden by it
    if (u_hole.x > 0.0 && first.z + last.z < 2.0 * u_hole.x * (u_sheetO.z + u_sheetN.z * u_sheetWell.z)) v_front = 1.0;
    // What lies nearer than the camera's near plane is cut off where the piece crosses it
    if (first.z < near || last.z < near) {
      vec3 cut = mix(first, last, (near - first.z) / (last.z - first.z));
      if (first.z < near) first = cut;
      else last = cut;
    }
    vec2 from = (u_lens.xy + (sheetScreen(first) - u_jolt.xy - u_lens.xy) * u_lens.z) * u_frame.z;
    vec2 to = (u_lens.xy + (sheetScreen(last) - u_jolt.xy - u_lens.xy) * u_lens.z) * u_frame.z;
    vec2 delta = to - from;
    float len = length(delta);
    vec2 direction = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // A stroke thinner than a pixel is drawn one pixel wide and dimmed by the area it would cover
    float end = a_position.x * 0.5 + 0.5;
    float width = u_run.w * u_frame.z;
    float drawWidth = max(width, 1.0);
    float halfWidth = drawWidth * 0.5;
    float extent = halfWidth + 1.0;
    float alongPiece = mix(-extent, len + extent, end);
    float acrossPiece = a_position.y * extent;
    vec2 pixel = from + direction * alongPiece + normal * acrossPiece;

    v_ends = vec2(alongPiece, len - alongPiece);
    v_across = acrossPiece;
    v_halfWidth = halfWidth;
    // The trail fades from the photon toward its tail as the square of what is left of it
    float along = (float(piece) + end) / PIECES_F;
    v_light = (1.0 - along) * (1.0 - along) * left * width / drawWidth;

    // The screen has its first row at the top
    gl_Position = vec4(pixel.x / u_frame.x * 2.0 - 1.0, 1.0 - pixel.y / u_frame.y * 2.0, 0.0, 1.0);
  }
`

const photonFragmentShaderSource = `#version 300 es
  precision highp float;

  uniform vec4 u_color;  // the photons' colour at their brightness; unused
  uniform vec4 u_frame;  // drawing buffer size in device pixels; the rest unused here
  uniform vec4 u_shadow; // where the composite pass put the main hole's shadow, in device pixels from the top left, and the radii inside which a trail is gone and beyond which it is whole (Hole Clearing)

  in vec2 v_ends;
  in float v_across;
  in float v_halfWidth;
  in float v_light;
  in float v_front;
  out vec4 color;

  void main () {
    // Round caps, so the pieces of a trail join without a notch
    float beyondEnds = max(0.0, -min(v_ends.x, v_ends.y));
    float alpha = v_light * clamp(v_halfWidth + 0.5 - length(vec2(beyondEnds, v_across)), 0.0, 1.0);
    // A photon behind the hole does not cross its shadow or its ring, as the sheet's lines do not
    if (v_front < 0.5 && u_shadow.z > 0.0) alpha *= smoothstep(u_shadow.z + 1.0, u_shadow.w + 2.0, length(vec2(gl_FragCoord.x, u_frame.y - gl_FragCoord.y) - u_shadow.xy));
    color = vec4(u_color.rgb * alpha, 1.0);
  }
`

// The settings the photon program draws from, filled by the scene once a frame
export interface PhotonSettings {
  // The photons' brightness, a multiple of their colour (0: none, nothing of them is traced or drawn)
  brightness: number
  // How many photons the flash sends
  count: number
  // Where the flash went off, in throat radii from the main hole (x along the plane's first direction, y
  // along its second, as sheetPoint takes them; the scene holds it on the sheet), where the photons are traced
  // from (photons.ts, followFlash; NaN: nowhere yet), and how far its light has run, in throat radii of
  // coordinate time
  x: number
  y: number
  traceX: number
  traceY: number
  run: number
  // How far back along its path a photon's trail reaches, in radii of run; the width of a stroke in CSS pixels;
  // the run over which a photon taken by the hole fades out
  trail: number
  width: number
  fade: number
  // Their colour
  color: SceneColor
  // Bumped by whoever fills the settings when what the table is filled from changes in a way x, y and the count
  // do not say (Sheet Beams' lanes and well); 0 for the flash's photons
  version: number
}

export function createPhotonSettings (): PhotonSettings {
  return { brightness: 0, count: 0, x: 0, y: 0, traceX: NaN, traceY: NaN, run: 0, trail: 0, width: 1, fade: 1, color: createSceneColor(), version: 0 }
}

interface Uniform {
  location: WebGLUniformLocation | null
  x: number
  y: number
  z: number
  w: number
}

export interface PhotonDrawer<S extends PhotonSettings = PhotonSettings> {
  // Draws the photons over what is bound, through the sheet as `grid` lays it, at the scene camera's zoom
  // (centre zoomX, zoomY, in CSS pixels) and shake, hidden behind the main hole's shadow (where the frame has it
  // and the radii the clearing takes, in device pixels; a radius of 0: no shadow) unless nearer the camera than
  // the holes (front, as the sheet takes it). Traces them first when the flash's place or the count changed
  draw: (photons: S, grid: GridSettings, zoomX: number, zoomY: number, zoom: number, shakeX: number, shakeY: number,
    width: number, height: number, pixelRatio: number, shadow: readonly [number, number, number, number], front: number) => void
  dispose: () => void
}

// The flash's photons fill the table by tracing them from the flash's place
function traceFlash (table: Float32Array, count: number, photons: PhotonSettings) {
  tracePhotons(table, count, photons.traceX, photons.traceY)
}

/**
 * The photon program and its table; null when it does not build. Made inside createParticleRenderer. `fill`
 * fills the table for the settings it is drawn with: the flash's photons by default, Sheet Beams' walk along the
 * surface for the beams
 */
export function createPhotonDrawer<S extends PhotonSettings = PhotonSettings> (gl: WebGL2RenderingContext,
  fill: (table: Float32Array, count: number, settings: S) => void = traceFlash): PhotonDrawer<S> | null {
  const program = createProgram(gl, photonVertexShaderSource, photonFragmentShaderSource, { a_position: ATTRIBUTE_LOCATIONS.position })
  if (!program) return null
  const names = ['table', 'frame', 'lens', 'jolt', 'run', 'place', 'color', 'hole', 'shadow', ...SHEET_UNIFORMS] as const
  const u = {} as Record<(typeof names)[number], Uniform>
  for (const name of names) u[name] = { location: gl.getUniformLocation(program, `u_${name}`), x: NaN, y: NaN, z: NaN, w: NaN }
  // A uniform, every one a vec4, is sent only when its value changed
  const set = (uniform: Uniform, x: number, y: number, z: number, w: number) => {
    if (uniform.x === x && uniform.y === y && uniform.z === z && uniform.w === w) return
    uniform.x = x
    uniform.y = y
    uniform.z = z
    uniform.w = w
    gl.uniform4f(uniform.location, x, y, z, w)
  }

  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + PHOTON_TEXTURE_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.activeTexture(gl.TEXTURE0)
  gl.useProgram(program)
  gl.uniform1i(u.table.location, PHOTON_TEXTURE_UNIT)

  // The table on the main thread, grown to the most photons asked for so far; the rows the texture holds; what
  // it was traced for (NaN: nothing yet)
  let table = new Float32Array(0)
  let rows = 0
  let tracedX = NaN
  let tracedY = NaN
  let tracedCount = 0
  let tracedVersion = NaN

  function draw (photons: S, grid: GridSettings, zoomX: number, zoomY: number, zoom: number, shakeX: number, shakeY: number,
    width: number, height: number, pixelRatio: number, shadow: readonly [number, number, number, number], front: number) {
    const count = Math.min(Math.max(Math.round(photons.count), 1), MAX_PHOTONS)
    // The scene says where to trace from (followFlash); the table here only follows it
    if (photons.run <= 0 || Number.isNaN(photons.traceX)) return
    const x = photons.traceX
    const y = photons.traceY
    if (x !== tracedX || y !== tracedY || count !== tracedCount || photons.version !== tracedVersion) {
      if (table.length < count * PHOTON_COLUMNS * 2) table = new Float32Array(count * PHOTON_COLUMNS * 2)
      fill(table, count, photons)
      gl.activeTexture(gl.TEXTURE0 + PHOTON_TEXTURE_UNIT)
      if (count !== rows) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, PHOTON_COLUMNS, count, 0, gl.RG, gl.FLOAT, table, 0)
        rows = count
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PHOTON_COLUMNS, count, gl.RG, gl.FLOAT, table, 0)
      }
      gl.activeTexture(gl.TEXTURE0)
      tracedX = x
      tracedY = y
      tracedCount = count
      tracedVersion = photons.version
    }

    gl.useProgram(program)
    sendSheet(set, u, grid)
    set(u.frame, width, height, pixelRatio, 0)
    set(u.lens, zoomX, zoomY, zoom, 0)
    set(u.jolt, shakeX, shakeY, 0, 0)
    set(u.shadow, shadow[0], shadow[1], shadow[2], shadow[3])
    set(u.hole, front, 0, 0, 0)
    set(u.run, photons.run, Math.max(photons.trail, 0), photons.fade, Math.max(photons.width, 0))
    set(u.place, grid.throat, photons.x - x, photons.y - y, 0)
    const light = photons.brightness
    set(u.color, photons.color.r * light, photons.color.g * light, photons.color.b * light, 0)
    // Brighter of the stroke and the frame, so the pieces of a trail and crossing trails do not add up
    gl.blendEquation(gl.MAX)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_VERTEX_COUNT, count * PHOTON_PIECES)
    gl.blendEquation(gl.FUNC_ADD)
  }

  function dispose () {
    gl.deleteTexture(texture)
    gl.deleteProgram(program)
  }

  return { draw, dispose }
}
