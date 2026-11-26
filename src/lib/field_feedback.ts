// The particle field on the graphics card: the two buffers its particles live in, the pass that steps them
// from one into the other (field_step.ts) and the pass that adds what they leave to the photon ring's light.
// Its GL objects are made by createFieldFeedback, which the renderer calls, so a restored context builds
// them again with the rest.
// The scene still makes a particle when the field grows, with its own random generator (spawnParticle);
// those newborns go up once (`fieldBorn`). After that a particle is the card's: nothing of it is read back.
import { ATTRIBUTE_LOCATIONS, BEHIND_GLSL, RIDE_GLSL, createProgram } from './webgl_shaders'
import { RING_BINS } from './ring_energy'
import { POSE_SLOTS, cameraPose } from './camera_pose'
import { sendSheet } from './space_grid'
import type { PaletteSampler, ParticleField, StepSettings } from './particle_simulation'
import {
  COLOR_KEPT, FIELD_COLOR_OFFSET, FIELD_DEPOSIT_OFFSET, FIELD_FLOATS, FIELD_PALETTE, FIELD_SEGMENT_OFFSET, FIELD_STRIDE,
  FIELD_STYLE_OFFSET, FIELD_VARYINGS, STEP_NUMBER_COUNT, fieldStepFragmentShaderSource, fieldStepVertexShaderSource,
  fillPalette, fillStepNumbers, ringDepositFragmentShaderSource, ringDepositVertexShaderSource
} from './field_step'

// The texture unit the ring's light from the field keeps
export const RING_LIGHT_TEXTURE_UNIT = 5

// What a frame says about the field
export interface FieldInput {
  // The particles as they are born, and how many the field holds now. Those from `fieldBorn` on are newborn
  // and not yet on the card; the renderer sends them up and moves `fieldBorn` past them
  field: ParticleField
  fieldCount: number
  fieldBorn: number
  // The scene's seed and how many steps the field has made since it was last made anew: together they are
  // where this step's random numbers come from
  fieldSeed: number
  fieldTick: number
  // What a particle born on the card is made from
  palette: PaletteSampler
  spawnRadius: number
  speedVariance: number
  // The step's numbers, the sheet Particles on Sheet lays them on among them
  step: StepSettings
  // The photon ring's light from the field: radians its pattern has turned, the share of it a step keeps,
  // and whether it is to be put out first
  ringTurned: number
  ringKeep: number
  ringClear: boolean
}

export interface FieldFeedback {
  // Sends the newborn up and steps every particle once
  step: (input: FieldInput) => void
  // Adds what the step's particles left to the ring's light and lets the rest fade. Leaves the frame buffer
  // and the viewport for the caller to set
  lightRing: (input: FieldInput) => void
  // Whether the ring's light from the field can be kept on this card at all
  ringKept: boolean
  // How many strokes the last step wrote, and the instanced attributes pointed at them
  count: () => number
  bindStrokes: () => void
  dispose: () => void
}

// One triangle over the whole target, for the pass that fades the ring's light
const COVER_VERTEX = `#version 300 es
  void main () {
    gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
  }
`

export function createFieldFeedback (gl: WebGL2RenderingContext): FieldFeedback | null {
  const stepProgram = createProgram(gl, fieldStepVertexShaderSource(RIDE_GLSL, BEHIND_GLSL), fieldStepFragmentShaderSource, {
    a_place: ATTRIBUTE_LOCATIONS.fieldPlace,
    a_drift: ATTRIBUTE_LOCATIONS.fieldDrift,
    a_look: ATTRIBUTE_LOCATIONS.fieldLook
  }, FIELD_VARYINGS)
  const depositProgram = createProgram(gl, ringDepositVertexShaderSource, ringDepositFragmentShaderSource, {
    a_deposit: ATTRIBUTE_LOCATIONS.fieldDeposit
  })
  const coverProgram = createProgram(gl, COVER_VERTEX, fieldStepFragmentShaderSource, {})
  if (!stepProgram || !depositProgram || !coverProgram) {
    for (const program of [stepProgram, depositProgram, coverProgram]) if (program) gl.deleteProgram(program)
    return null
  }

  const uniform = (name: string) => gl.getUniformLocation(stepProgram, name)
  const stepUniforms = {
    step: uniform('u_step'),
    pose: uniform('u_pose'),
    poseFrom: uniform('u_poseFrom'),
    palette: uniform('u_palette'),
    paletteSize: uniform('u_paletteSize'),
    tick: uniform('u_tick'),
    ride: uniform('u_ride'),
    equator: uniform('u_equator'),
    sheetU: uniform('u_sheetU'),
    sheetV: uniform('u_sheetV'),
    sheetN: uniform('u_sheetN'),
    sheetO: uniform('u_sheetO'),
    sheetWell: uniform('u_sheetWell'),
    sheetWell2: uniform('u_sheetWell2')
  }
  const setUniform4 = gl.uniform4f.bind(gl)
  const depositPhase = gl.getUniformLocation(depositProgram, 'u_phase')

  // The two buffers a step reads and writes in turn, and for each the arrays a step and the ring's pass read
  let buffers: [WebGLBuffer | null, WebGLBuffer | null] = [null, null]
  const stepArrays: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null] = [null, null]
  const depositArrays: [WebGLVertexArrayObject | null, WebGLVertexArrayObject | null] = [null, null]
  const coverArray = gl.createVertexArray()
  let current = 0
  let capacity = 0
  // Particles the last step moved, each with its stroke
  let held = 0

  const numbers = new Float32Array(STEP_NUMBER_COUNT)
  const pose = new Float64Array(POSE_SLOTS)
  const rows = new Float32Array(12)
  const paletteNumbers = new Float32Array(FIELD_PALETTE * 4)
  let paletteSent: PaletteSampler | null = null
  let staging = new Float32Array(0)
  let stagingBits = new Uint32Array(0)

  // The ring's light from the field: one row of half floats, which a card may blend into
  const ringTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + RING_LIGHT_TEXTURE_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, ringTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, RING_BINS, 1, 0, gl.RED, gl.HALF_FLOAT, null)
  gl.activeTexture(gl.TEXTURE0)
  const ringFramebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, ringFramebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ringTexture, 0)
  // A card draws into floats only with this extension
  const ringKept = gl.getExtension('EXT_color_buffer_float') !== null && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  if (ringKept) {
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  function readFrom (buffer: WebGLBuffer | null, location: number, size: number, offset: number) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, FIELD_STRIDE, offset)
  }

  // Room for `count` particles; what is already on the card is carried over whole
  function reserve (count: number) {
    if (count <= capacity) return
    const room = Math.ceil(Math.max(count, capacity * 1.5))
    const grown: [WebGLBuffer | null, WebGLBuffer | null] = [gl.createBuffer(), gl.createBuffer()]
    for (let side = 0; side < 2; side++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, grown[side])
      gl.bufferData(gl.ARRAY_BUFFER, room * FIELD_STRIDE, gl.DYNAMIC_COPY)
    }
    if (capacity > 0) {
      gl.bindBuffer(gl.COPY_READ_BUFFER, buffers[current])
      gl.bindBuffer(gl.COPY_WRITE_BUFFER, grown[current])
      gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, capacity * FIELD_STRIDE)
      gl.bindBuffer(gl.COPY_READ_BUFFER, null)
      gl.bindBuffer(gl.COPY_WRITE_BUFFER, null)
    }
    for (let side = 0; side < 2; side++) {
      gl.deleteBuffer(buffers[side])
      gl.deleteVertexArray(stepArrays[side])
      gl.deleteVertexArray(depositArrays[side])
      stepArrays[side] = gl.createVertexArray()
      gl.bindVertexArray(stepArrays[side])
      readFrom(grown[side], ATTRIBUTE_LOCATIONS.fieldPlace, 4, 0)
      readFrom(grown[side], ATTRIBUTE_LOCATIONS.fieldDrift, 4, 16)
      readFrom(grown[side], ATTRIBUTE_LOCATIONS.fieldLook, 3, 32)
      depositArrays[side] = gl.createVertexArray()
      gl.bindVertexArray(depositArrays[side])
      readFrom(grown[side], ATTRIBUTE_LOCATIONS.fieldDeposit, 3, FIELD_DEPOSIT_OFFSET)
    }
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    buffers = grown
    capacity = room
  }

  // Sends the particles `from`..`to` up as the scene made them
  function send (field: ParticleField, from: number, to: number) {
    const floats = (to - from) * FIELD_FLOATS
    if (staging.length < floats) {
      staging = new Float32Array(Math.ceil(floats * 1.5))
      stagingBits = new Uint32Array(staging.buffer)
    }
    for (let i = from, o = 0; i < to; i++, o += FIELD_FLOATS) {
      staging[o] = field.x[i]
      staging[o + 1] = field.y[i]
      staging[o + 2] = field.z[i]
      staging[o + 3] = field.speedMultiplier[i]
      staging[o + 4] = field.vx[i]
      staging[o + 5] = field.vy[i]
      staging[o + 6] = field.vz[i]
      staging[o + 7] = field.alpha[i]
      staging[o + 8] = field.pulsePhase[i]
      staging[o + 9] = field.pulseSpeed[i]
      stagingBits[o + 10] = (field.color[i] & 0xffffff) | COLOR_KEPT
      // A newborn has drawn nothing yet
      staging.fill(0, o + 11, o + FIELD_FLOATS)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[current])
    gl.bufferSubData(gl.ARRAY_BUFFER, from * FIELD_STRIDE, staging, 0, floats)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  // A pose as the shader takes it: a row of the turn and its share of the offset in each vec4
  function sendPose (location: WebGLUniformLocation | null) {
    for (let row = 0; row < 3; row++) {
      rows[row * 4] = pose[row * 3]
      rows[row * 4 + 1] = pose[row * 3 + 1]
      rows[row * 4 + 2] = pose[row * 3 + 2]
      rows[row * 4 + 3] = pose[9 + row]
    }
    gl.uniform4fv(location, rows)
  }

  function step (input: FieldInput) {
    const count = input.fieldCount
    reserve(count)
    if (input.fieldBorn < count) send(input.field, input.fieldBorn, count)
    input.fieldBorn = Number.MAX_SAFE_INTEGER
    held = count
    if (count === 0) return

    const settings = input.step
    gl.useProgram(stepProgram)
    fillStepNumbers(numbers, settings, input.spawnRadius, input.speedVariance)
    gl.uniform1fv(stepUniforms.step, numbers)
    if (settings.threeD > 0) {
      cameraPose(
        settings.cameraYaw, settings.cameraPitch, settings.cameraRoll, settings.cameraLookYaw, settings.cameraLookPitch,
        settings.cameraMoveRight, settings.cameraMoveUp, settings.cameraMoveIn, settings.holeDepth, pose
      )
      sendPose(stepUniforms.pose)
      cameraPose(
        settings.cameraYawFrom, settings.cameraPitchFrom, settings.cameraRollFrom, settings.cameraLookYawFrom, settings.cameraLookPitchFrom,
        settings.cameraMoveRightFrom, settings.cameraMoveUpFrom, settings.cameraMoveInFrom, settings.holeDepth, pose
      )
      sendPose(stepUniforms.poseFrom)
    }
    if (input.palette !== paletteSent) {
      paletteSent = input.palette
      const colors = fillPalette(paletteNumbers.fill(0), input.palette)
      gl.uniform4fv(stepUniforms.palette, paletteNumbers)
      gl.uniform2f(stepUniforms.paletteSize, colors, input.palette.totalWeight)
    }
    gl.uniform1ui(stepUniforms.tick, (Math.imul(input.fieldSeed | 0, 0x9e3779b1) + input.fieldTick) >>> 0)
    // Particles on Sheet: the surface, the pose it is seen through and the slab whose particles ride
    const sheet = settings.sheet
    if (settings.ride > 0) {
      gl.uniform4f(stepUniforms.ride, settings.ride, Math.max(settings.rideDepth, 0.001), sheet.unit, sheet.shared)
      gl.uniform3fv(stepUniforms.equator, sheet.equator)
      sendSheet(setUniform4, stepUniforms, sheet)
    } else {
      gl.uniform4f(stepUniforms.ride, 0, 1, 1, 0)
    }

    // The step reads one buffer and the feedback writes the other; nothing is drawn
    gl.bindVertexArray(stepArrays[current])
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffers[1 - current])
    gl.enable(gl.RASTERIZER_DISCARD)
    gl.beginTransformFeedback(gl.POINTS)
    gl.drawArrays(gl.POINTS, 0, count)
    gl.endTransformFeedback()
    gl.disable(gl.RASTERIZER_DISCARD)
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null)
    gl.bindVertexArray(null)
    current = 1 - current
  }

  function lightRing (input: FieldInput) {
    if (!ringKept) return
    const fed = input.step.ringEnergy !== null
    if (!fed && !input.ringClear) return
    gl.bindFramebuffer(gl.FRAMEBUFFER, ringFramebuffer)
    gl.viewport(0, 0, RING_BINS, 1)
    if (input.ringClear) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    if (fed) {
      // What the particles left this step is added, each in the bin of its direction, and then all of it
      // fades by the share a step keeps, with the field taken away too
      if (held > 0) {
        gl.blendFunc(gl.ONE, gl.ONE)
        gl.useProgram(depositProgram)
        gl.uniform1f(depositPhase, input.ringTurned)
        gl.bindVertexArray(depositArrays[current])
        gl.drawArrays(gl.POINTS, 0, held)
      }
      gl.blendFunc(gl.ZERO, gl.CONSTANT_ALPHA)
      gl.blendColor(0, 0, 0, input.ringKeep)
      gl.useProgram(coverProgram)
      gl.bindVertexArray(coverArray)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
    input.ringClear = false
  }

  function bindStrokes () {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[current])
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.segment, 4, gl.FLOAT, false, FIELD_STRIDE, FIELD_SEGMENT_OFFSET)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.style, 2, gl.FLOAT, false, FIELD_STRIDE, FIELD_STYLE_OFFSET)
    gl.vertexAttribPointer(ATTRIBUTE_LOCATIONS.color, 4, gl.UNSIGNED_BYTE, true, FIELD_STRIDE, FIELD_COLOR_OFFSET)
  }

  function dispose () {
    for (let side = 0; side < 2; side++) {
      gl.deleteBuffer(buffers[side])
      gl.deleteVertexArray(stepArrays[side])
      gl.deleteVertexArray(depositArrays[side])
    }
    gl.deleteVertexArray(coverArray)
    gl.deleteFramebuffer(ringFramebuffer)
    gl.deleteTexture(ringTexture)
    gl.deleteProgram(stepProgram)
    gl.deleteProgram(depositProgram)
    gl.deleteProgram(coverProgram)
  }

  return { step, lightRing, ringKept, count: () => held, bindStrokes, dispose }
}
