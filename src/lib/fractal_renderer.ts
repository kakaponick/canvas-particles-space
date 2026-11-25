// Draws one frame of a Mandelbrot zoom with the graphics card: a full-screen pass of fractal_shaders.ts over
// the target's orbit, held in a float texture. A film's frame can take long enough for the system to reset a
// graphics card that seems stuck, so `draw` sends it in bands of rows, each waited for before the next, with
// the band sized to stay near BAND_MS whatever the frame costs. The page's live view (fractal_live.ts) keeps
// its frames short by their size instead and sends each in one pass with `drawNow`.
import { fail } from './agent_values'
import { FRACTAL_FRAGMENT, FRACTAL_MAX_STOPS, FRACTAL_VERTEX, ORBIT_ROW_BITS } from './fractal_shaders'
import type { ReferenceOrbit } from './fractal_orbit'

const BAND_MS = 60
const FIRST_BAND_ROWS = 32

export interface FractalView {
  // Plane units a pixel spans, as mantissa · 2^exponent
  pixelMant: number
  pixelExp: number
  // Radians the view is turned by
  angle: number
  maxIter: number
  // Samples a pixel along each side
  samples: number
  center: [number, number]
  // Colours as 0..1 RGB triples, the palette's loop in steps, its place in that loop, inside, edge, glow
  stops: number[]
  cycle: number
  phase: number
  inside: [number, number, number]
  edge: number
  glow: number
}

function compile (gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) fail('A shader could not be made')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) fail(`The fractal shader did not build: ${gl.getShaderInfoLog(shader)}`)
  return shader
}

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export interface RendererOptions {
  // Draw into this canvas instead of a new one: the live view's, whose context comes back after a loss
  canvas?: HTMLCanvasElement
}

export function createFractalRenderer (width: number, height: number, options: RendererOptions = {}) {
  const canvas = options.canvas ?? document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'
  })
  if (!gl) fail('WebGL 2 is not available, so a fractal cannot be drawn')

  const program = gl.createProgram()
  if (!program) fail('A shader program could not be made')
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, FRACTAL_VERTEX))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRACTAL_FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) fail(`The fractal shader did not link: ${gl.getProgramInfoLog(program)}`)
  gl.useProgram(program)
  const at = (name: string) => gl.getUniformLocation(program, name)
  const uniforms = {
    orbit: at('u_orbit'), orbitLength: at('u_orbitLength'), loopFrom: at('u_loopFrom'), maxIter: at('u_maxIter'),
    size: at('u_size'), turn: at('u_turn'), pixelMant: at('u_pixelMant'), pixelExp: at('u_pixelExp'), center: at('u_center'),
    samples: at('u_samples'), stops: at('u_stops'), stopCount: at('u_stopCount'), cycle: at('u_cycle'), phase: at('u_phase'),
    inside: at('u_inside'), edge: at('u_edge'), glow: at('u_glow')
  }

  // One triangle that covers the frame
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.uniform1i(uniforms.orbit, 0)

  let frameWidth = width
  let frameHeight = height
  const fit = () => {
    gl.viewport(0, 0, frameWidth, frameHeight)
    gl.uniform2f(uniforms.size, frameWidth, frameHeight)
  }
  fit()

  let bandRows = FIRST_BAND_ROWS
  // Made once: a live view sets them every frame
  const stops = new Float32Array(FRACTAL_MAX_STOPS * 3)

  const apply = (view: FractalView) => {
    if (gl.isContextLost()) fail('The graphics card was lost while drawing the fractal')
    gl.uniform1i(uniforms.maxIter, view.maxIter)
    gl.uniform2f(uniforms.turn, Math.cos(view.angle), Math.sin(view.angle))
    gl.uniform1f(uniforms.pixelMant, view.pixelMant)
    gl.uniform1f(uniforms.pixelExp, view.pixelExp)
    gl.uniform2f(uniforms.center, view.center[0], view.center[1])
    gl.uniform1i(uniforms.samples, view.samples)
    const count = Math.min(FRACTAL_MAX_STOPS, view.stops.length / 3)
    for (let index = 0; index < count * 3; index++) stops[index] = view.stops[index]
    gl.uniform3fv(uniforms.stops, stops)
    gl.uniform1i(uniforms.stopCount, count)
    gl.uniform1f(uniforms.cycle, view.cycle)
    gl.uniform1f(uniforms.phase, view.phase)
    gl.uniform3f(uniforms.inside, view.inside[0], view.inside[1], view.inside[2])
    gl.uniform1f(uniforms.edge, view.edge)
    gl.uniform1f(uniforms.glow, view.glow)
  }

  return {
    canvas,

    // The orbit every pixel is measured against; set once for a film, since its target does not move
    setOrbit (orbit: ReferenceOrbit) {
      const row = 1 << ORBIT_ROW_BITS
      const rows = Math.ceil(orbit.length / row)
      if (rows > gl.getParameter(gl.MAX_TEXTURE_SIZE)) fail(`The orbit has ${orbit.length} steps, more than this graphics card holds`)
      const texels = new Float32Array(row * rows * 4)
      texels.set(orbit.values)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, row, rows, 0, gl.RGBA, gl.FLOAT, texels)
      gl.uniform1i(uniforms.orbitLength, orbit.length)
      gl.uniform1i(uniforms.loopFrom, orbit.loopFrom)
    },

    // A new size for the frame: the live view follows the window and its own frame time
    resize (nextWidth: number, nextHeight: number) {
      if (nextWidth === frameWidth && nextHeight === frameHeight) return
      frameWidth = nextWidth
      frameHeight = nextHeight
      canvas.width = nextWidth
      canvas.height = nextHeight
      fit()
    },

    // Draws the view into the canvas, a band of rows at a time; resolves once the last band is done, or
    // once `cancelled` says so between two bands
    async draw (view: FractalView, cancelled?: () => boolean) {
      apply(view)
      gl.enable(gl.SCISSOR_TEST)
      for (let y = 0; y < frameHeight && !cancelled?.();) {
        const rows = Math.min(bandRows, frameHeight - y)
        const started = performance.now()
        gl.scissor(0, y, frameWidth, rows)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        if (!fence) fail('The graphics card could not be waited for')
        gl.flush()
        while (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) await pause()
        gl.deleteSync(fence)
        if (gl.isContextLost()) fail('The graphics card was lost while drawing the fractal')
        const took = Math.max(1, performance.now() - started)
        y += rows
        // The next band as tall as fits in the time, never more than twice this one
        bandRows = Math.max(1, Math.min(frameHeight, Math.round(rows * Math.min(2, BAND_MS / took))))
      }
      gl.disable(gl.SCISSOR_TEST)
    },

    // Draws the view in one pass and returns at once: the browser shows it with the next frame
    drawNow (view: FractalView) {
      if (gl.isContextLost()) return
      apply(view)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },

    dispose () {
      if (!gl.isContextLost()) {
        gl.deleteTexture(texture)
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
      }
      if (!options.canvas) gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}

export type FractalRenderer = ReturnType<typeof createFractalRenderer>
