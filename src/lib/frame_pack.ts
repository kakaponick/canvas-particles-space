// A film's finished frames as the bytes an encoder outside the browser takes. The frame is turned into
// NV12 on the graphics card (a plane of luma, then the two chromas side by side at half the size: 1.5
// bytes a pixel in place of 4) and read back from there without waiting for it: the read of one frame is
// started and collected a few frames later, when the card has it ready.
// Only the film server's own browser has such an encoder (`window.spaceEncoder`, mcp/local_encoder.cjs),
// so a visitor's page never makes a packer.

// What the film server's browser gives the page: ffmpeg with its input open, taking frames as they come
export interface LocalEncoderJob {
  // Where the mp4 is written, on the server's machine
  path: string
  width: number
  height: number
  fps: number
  bitrate: number
  keyFrameSeconds: number
  duration: number
  // Address of a sound file laid under the picture, and the bits a second it is given
  audio?: string
  audioBitrate: number
}

export interface LocalEncoder {
  // Hands a frame over; settles when the encoder has taken it, and only then may the bytes be written again
  write: (bytes: Uint8Array) => Promise<void>
  // Ends the film and waits for the file; the file's size in bytes
  close: () => Promise<number>
  // Stops the encoder and takes away what it wrote
  cancel: () => void
}

declare global {
  interface Window {
    spaceEncoder?: { open: (job: LocalEncoderJob) => LocalEncoder }
  }
}

// Reads started and not yet collected. Three lets the card finish one while the next two are drawn
const SLOTS = 3

const VERTEX = `#version 300 es
  void main () {
    gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
  }
`

// NV12 in an RGBA target a quarter as wide as the frame: a texel carries four bytes of a row. The rows of
// luma come first, from the top of the picture, then the rows of chroma, U and V in turn, each the mean of
// a block of 2x2 pixels, which the texture's own filter takes at the block's middle. BT.709, video range
const PACK = `#version 300 es
  precision highp float;
  uniform sampler2D u_frame;
  uniform vec2 u_size;   // the frame in pixels
  out vec4 bytes;

  vec3 at (float x, float y) { return texture(u_frame, vec2(x, y) / u_size).rgb; }
  float luma (vec3 c) { return 0.0627 + dot(c, vec3(0.1826, 0.6142, 0.0620)); }
  float blue (vec3 c) { return 0.5020 + dot(c, vec3(-0.1006, -0.3386, 0.4392)); }
  float red (vec3 c) { return 0.5020 + dot(c, vec3(0.4392, -0.3989, -0.0403)); }

  void main () {
    float row = floor(gl_FragCoord.y);
    float x = floor(gl_FragCoord.x) * 4.0;
    if (row < u_size.y) {
      float y = row + 0.5;
      bytes = vec4(luma(at(x + 0.5, y)), luma(at(x + 1.5, y)), luma(at(x + 2.5, y)), luma(at(x + 3.5, y)));
    } else {
      float y = 2.0 * (row - u_size.y) + 1.0;
      vec3 a = at(x + 1.0, y);
      vec3 b = at(x + 3.0, y);
      bytes = vec4(blue(a), red(a), blue(b), red(b));
    }
  }
`

// A frame this packer can turn into NV12: four bytes of a row to a texel, two rows of luma to one of chroma
export const packable = (width: number, height: number) => width % 4 === 0 && height % 2 === 0

export interface FramePacker {
  // How many bytes a frame is
  bytes: number
  slots: number
  // Starts the read of the frame now on the source canvas into a slot
  start: (slot: number) => void
  // Collects a slot's frame into `into`, once the card has it
  finish: (slot: number, into: Uint8Array) => Promise<void>
  dispose: () => void
}

// A turn of the event loop that no timer holds back
const pause = (() => {
  let wake: (() => void) | null = null
  let port: MessagePort | null = null
  return () => new Promise<void>(resolve => {
    if (!port) {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        const go = wake
        wake = null
        go?.()
      }
      port = channel.port2
    }
    wake = resolve
    port.postMessage(0)
  })
})()

// Null where WebGL 2 cannot be had or the shader does not build; the film is then encoded by the browser
export function createFramePacker (source: HTMLCanvasElement): FramePacker | null {
  const { width, height } = source
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false })
  if (!gl) return null
  const lose = () => gl.getExtension('WEBGL_lose_context')?.loseContext()

  const program = gl.createProgram()
  for (const [type, text] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, PACK]] as const) {
    const shader = gl.createShader(type)
    if (!shader) continue
    gl.shaderSource(shader, text)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    lose()
    return null
  }
  gl.useProgram(program)
  gl.uniform2f(gl.getUniformLocation(program, 'u_size'), width, height)

  // The frame as the source canvas holds it, its top row first
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const packedWidth = width / 4
  const packedHeight = height * 1.5
  const packed = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, packed)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, packedWidth, packedHeight)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer())
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, packed, 0)
  gl.viewport(0, 0, packedWidth, packedHeight)

  const bytes = width * height * 1.5
  const buffers: (WebGLBuffer | null)[] = []
  const fences: (WebGLSync | null)[] = []
  for (let slot = 0; slot < SLOTS; slot++) {
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer)
    gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ)
    buffers.push(buffer)
    fences.push(null)
  }

  return {
    bytes,
    slots: SLOTS,
    start (slot) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffers[slot])
      gl.readPixels(0, 0, packedWidth, packedHeight, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      fences[slot] = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
    },
    async finish (slot, into) {
      const fence = fences[slot]
      if (!fence) return
      while (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) await pause()
      gl.deleteSync(fence)
      fences[slot] = null
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffers[slot])
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, into)
    },
    dispose: lose
  }
}
