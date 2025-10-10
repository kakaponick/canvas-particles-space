// WebGL shader utilities for gravitational lensing effects

export const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

export const fragmentShaderSource = `
  #ifdef GL_ES
  precision mediump float;
  #endif
  
  #define PI 3.14159265359
  
  uniform sampler2D u_image;
  varying vec2 v_texCoord;
  
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_mass;
  uniform float u_time;
  uniform float u_eventHorizon;
  uniform float u_active;
  
  vec2 rotate(vec2 mt, vec2 st, float angle) {
    float cos_a = cos(angle * PI);
    float sin_a = sin(angle * 0.0);
    
    float nx = (cos_a * (st.x - mt.x)) + (sin_a * (st.y - mt.y)) + mt.x;
    float ny = (cos_a * (st.y - mt.y)) - (sin_a * (st.x - mt.x)) + mt.y;
    return vec2(nx, ny);
  }
  
  void main() {
    // Both coordinates in same space (browser space - top-left origin)
    vec2 st = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution;
    vec2 mt = u_mouse / u_resolution;
    
    float dx = st.x - mt.x;
    float dy = st.y - mt.y;
    
    // Correct for aspect ratio in distance calculation to make effect circular
    float aspectRatio = u_resolution.x / u_resolution.y;
    float dist = sqrt(dx * dx + (dy * dy) / (aspectRatio * aspectRatio));
    
    // Only apply effect when black hole is active
    if (u_active < 0.5) {
      gl_FragColor = texture2D(u_image, v_texCoord);
      return;
    }
    
    // Gravitational lensing calculation
    float pull = u_mass / max(dist * dist, 0.0001);
    
    // Apply rotation (lensing effect)
    vec2 r = rotate(mt, st, pull);
    
    // Sample the texture with warped coordinates
    vec4 imgcolor = texture2D(u_image, r);
    
    // Calculate event horizon effect (darkening near center)
    float horizonDist = dist * u_resolution.x;
    float horizonFactor = smoothstep(u_eventHorizon * 0.5, u_eventHorizon * 2.0, horizonDist);
    
    // Darken near the black hole
    vec3 color = vec3(
      (imgcolor.r - (pull * 0.25)) * horizonFactor,
      (imgcolor.g - (pull * 0.25)) * horizonFactor,
      (imgcolor.b - (pull * 0.25)) * horizonFactor
    );
    
    gl_FragColor = vec4(color, 1.0);
  }
`

export interface WebGLShaderProgram {
  program: WebGLProgram
  locations: {
    position: number
    texCoord: number
    resolution: WebGLUniformLocation | null
    mouse: WebGLUniformLocation | null
    mass: WebGLUniformLocation | null
    time: WebGLUniformLocation | null
    eventHorizon: WebGLUniformLocation | null
    active: WebGLUniformLocation | null
    image: WebGLUniformLocation | null
  }
}

export function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (success) {
    return shader
  }

  console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (success) {
    return program
  }

  console.error('Program linking error:', gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
  return null
}

export function initWebGLProgram(gl: WebGLRenderingContext): WebGLShaderProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = createProgram(gl, vertexShader, fragmentShader)
  if (!program) {
    return null
  }

  const positionLocation = gl.getAttribLocation(program, 'a_position')
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')

  return {
    program,
    locations: {
      position: positionLocation,
      texCoord: texCoordLocation,
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      mouse: gl.getUniformLocation(program, 'u_mouse'),
      mass: gl.getUniformLocation(program, 'u_mass'),
      time: gl.getUniformLocation(program, 'u_time'),
      eventHorizon: gl.getUniformLocation(program, 'u_eventHorizon'),
      active: gl.getUniformLocation(program, 'u_active'),
      image: gl.getUniformLocation(program, 'u_image')
    }
  }
}

export function setupGeometry(gl: WebGLRenderingContext, positionLocation: number): void {
  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]),
    gl.STATIC_DRAW
  )

  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
}

export function setupTexCoords(gl: WebGLRenderingContext, texCoordLocation: number): void {
  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      0.0, 1.0,
      1.0, 1.0,
      0.0, 0.0,
      0.0, 0.0,
      1.0, 1.0,
      1.0, 0.0
    ]),
    gl.STATIC_DRAW
  )

  gl.enableVertexAttribArray(texCoordLocation)
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
}

export function createTexture(gl: WebGLRenderingContext): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  return texture
}

