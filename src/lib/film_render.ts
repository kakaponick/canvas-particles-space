// Plays a film (film.ts) off the page: a scene of its own on a canvas of the film's size, advanced by a
// fixed step with no clock, so a slow machine draws the same frames as a fast one, only later. The frames
// go to an mp4 (WebCodecs through mediabunny, loaded only when a film is rendered) or onto one contact
// sheet an agent can look at before it renders.
import { useParticleStore } from '../store/particle_store'
import { REFERENCE_FPS } from './particle_simulation'
import { getRenderingContext } from './particle_renderer'
import { createScene, type SceneInput } from './scene'
import { createParticleCrew } from './particle_crew'
import { SIMULATION_SETTING_SPECS } from './simulation_specs'
import { getIntroDuration } from './intro_timeline'
import type { TitleSprite, TitleStyle } from './title_sprite'
import type { StreamTargetChunk } from 'mediabunny'
import { applyTracks, filmFade, filmSpeed, planFilm, type FilmPlan } from './film'
import { drawCaptions, loadCaptionFonts } from './film_captions'
import { drawGraphics, loadGraphicImages, type FilmImages } from './film_graphics'
import { clamp, fail } from './agent_values'

// A film waits for its faces: a title in a fallback face would be a different video
const FONT_WAIT_MS = 8000
// Frames drawn between two breaths of the page, so it stays responsive and a cancel is heard
const FRAMES_PER_BREATH = 24
// Bits per pixel per frame: the field is fine detail in motion, which costs more than ordinary video
const QUALITY_BITS = { medium: 0.12, high: 0.25, max: 0.45 } as const
export type FilmQuality = keyof typeof QUALITY_BITS
// The fastest film the bits are counted for; see where the bitrate is set
const BITRATE_FPS = 60
const KEY_FRAME_SECONDS = 2
const AUDIO_BITRATE = 160_000
// The shortest packet an audio encoder makes, in samples; the file's index is given room for that many
const SHORTEST_AUDIO_PACKET = 960
// H.264 levels from 4.2 up: the level, the most macroblocks a frame may hold, the most a second, and the
// most bits a second in the High profile
const AVC_LEVELS = [
  [42, 8704, 522_240, 62_500_000], [50, 22_080, 589_824, 168_750_000], [51, 36_864, 983_040, 300_000_000],
  [52, 36_864, 2_073_600, 300_000_000], [60, 139_264, 4_177_920, 300_000_000], [61, 139_264, 8_355_840, 600_000_000],
  [62, 139_264, 16_711_680, 1_000_000_000]
] as const
// Longest side of a contact sheet, the most an agent's image reader keeps
const SHEET_SIDE = 1536
export const DEFAULT_SHEET_FRAMES = 9
export const MAX_SHEET_FRAMES = 24

export interface FilmProgress {
  phase: 'idle' | 'preparing' | 'rendering' | 'finishing' | 'done' | 'failed' | 'cancelled'
  frame: number
  frames: number
}

export const progress: FilmProgress = { phase: 'idle', frame: 0, frames: 0 }
let busy = false
let cancelRequested = false

export const filmProgress = (): FilmProgress => ({ ...progress })

export function cancelFilm () {
  if (busy) cancelRequested = true
  return { cancelling: busy }
}

export const breathe = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function titleStyle (plan: FilmPlan, words = plan.title, set: Partial<FilmPlan['params']> = {}): TitleStyle {
  const params = { ...plan.params, ...set }
  return {
    ...words,
    weight: params.titleWeight,
    tracking: params.titleTracking,
    size: params.titleSize,
    maxWidth: params.titleMaxWidth,
    lineHeight: params.titleLineHeight,
    haloRadius: params.titleHalo > 0 ? params.titleHaloRadius : 0,
    haloStreak: params.titleStreak
  }
}

// The film's own scene and the canvas its finished frames land on, captions included
export async function createFilmPlayer (plan: FilmPlan, pixel: number, imageUrls?: Record<string, string>) {
  const glCanvas = document.createElement('canvas')
  const gl = getRenderingContext(glCanvas)
  if (!gl) fail('WebGL 2 is not available, so a film cannot be drawn')

  applyTracks(plan, 0)
  const input: SceneInput = {
    settings: plan.settings,
    params: plan.params,
    hidden: plan.hidden,
    reducedMotion: false,
    particleCount: plan.settings.numParticles
  }
  // The field is stepped on several cores where the page may share memory between threads; a track may
  // raise the particle count, so the crew has room for the most a film can ask for
  const crew = await createParticleCrew(SIMULATION_SETTING_SPECS.numParticles.max)
  const scene = createScene(gl, plan.seed, input, crew)
  if (!scene) {
    crew?.dispose()
    fail('The scene could not start: its shaders did not build')
  }
  const dispose = () => {
    scene.dispose()
    crew?.dispose()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  scene.resize(plan.width, plan.height, pixel, input, true)

  const canvas = document.createElement('canvas')
  canvas.width = glCanvas.width
  canvas.height = glCanvas.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    dispose()
    fail('A 2D canvas is not available')
  }

  // A cue that brings words of its own has them drawn now: at its second there is no waiting for a face
  let cueTitles: (TitleSprite | null)[] = []
  // A film's pictures are read now too, so no frame waits for one
  let images: FilmImages | null = null
  try {
    await Promise.all([scene.setTitle(titleStyle(plan), FONT_WAIT_MS), loadCaptionFonts(plan)])
    if (plan.graphics.length > 0) images = await loadGraphicImages(plan, imageUrls)
    cueTitles = await Promise.all(plan.cues.map(cue => cue.title ? scene.makeTitle(titleStyle(plan, cue.title, cue.params), FONT_WAIT_MS) : null))
  } catch (error) {
    dispose()
    throw error
  }

  // The same start for the same seed, whatever was drawn while the scene was made
  scene.reseed(plan.seed)
  scene.time = 0
  if (plan.introAt === null) {
    scene.restart(input, getIntroDuration(false, plan.params))
    scene.placeHole(input, true)
    for (let step = 0; step < Math.round(plan.warmup * REFERENCE_FPS); step++) {
      scene.advance(1, 1 / REFERENCE_FPS, input, false)
    }
  } else {
    scene.restart(input, plan.introTime)
  }

  // Motion is stepped at about the page's 60 Hz whatever the film's frame rate, so gravity and trails
  // behave as they do live; only the last step of a frame is shown, and the tracks move at every step
  const steps = Math.max(1, Math.round(REFERENCE_FPS / plan.fps))
  const frameScale = REFERENCE_FPS / (plan.fps * steps)
  const dt = 1 / (plan.fps * steps)
  let drawn = -1
  let nextCue = 0

  // Draws frame `index`, the film at index / fps seconds. Frames come in order; `show` false only moves
  // the scene on, for a contact sheet that skips to its next frame
  const drawFrame = (index: number, show = true) => {
    if (index !== drawn + 1) fail(`Frames are drawn in order: ${drawn + 1} is next, not ${index}`)
    drawn = index
    const time = index / plan.fps
    applyTracks(plan, time)
    input.particleCount = plan.settings.numParticles
    while (nextCue < plan.cues.length && plan.cues[nextCue].at <= time) {
      // A cue's parameters stay as it set them, unless a track moves the same one
      const words = cueTitles[nextCue]
      const cue = plan.cues[nextCue++]
      if (words) scene.useTitle(words)
      Object.assign(plan.params, cue.params)
      scene.fire(cue.layers, input)
    }
    // Scene seconds this frame holds: the film's speed bends the scene's time, never the film's own
    const pace = plan.speed ? filmSpeed(plan, time) / plan.fps : 0
    if (index === 0 || (plan.speed && pace === 0)) {
      // The first frame is the film at second 0: nothing has moved yet. A still frame moves nothing either
      scene.advance(0, 0, input, show)
    } else {
      // With a speed, still stepped at about 60 Hz of the scene's time: slow motion takes finer steps,
      // time-lapse more of them. The tracks move at every step, each at its own second of the film: moved
      // once a frame, a fast one (a turning camera) jumps at the frame's first step and stands still for the
      // rest, and the strokes zigzag
      const count = plan.speed ? Math.max(1, Math.round(pace * REFERENCE_FPS)) : steps
      const scale = plan.speed ? pace * REFERENCE_FPS / count : frameScale
      const seconds = plan.speed ? pace / count : dt
      for (let step = 1; step <= count; step++) {
        if (count > 1) {
          applyTracks(plan, (index - 1 + step / count) / plan.fps)
          input.particleCount = plan.settings.numParticles
        }
        scene.advance(scale, seconds, input, show && step === count)
      }
    }
    if (!show) return
    ctx.drawImage(glCanvas, 0, 0)
    // The fade darkens the picture and leaves the captions, so words can stand on black
    const dark = plan.fade ? filmFade(plan, time) : 0
    if (dark > 0) {
      ctx.globalAlpha = dark
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
    }
    if (images) drawGraphics(ctx, plan, time, scene.frame.composite, canvas.width / plan.width, images)
    if (plan.captions.length > 0) drawCaptions(ctx, plan, time, scene.frame.composite, canvas.width / plan.width)
  }

  return { canvas, drawFrame, dispose }
}

// One film at a time, with the page's own scene paused so the machine draws only the film. A fractal film
// (fractal_render.ts) takes the same turn and reports through the same progress
export async function exclusively<T> (frames: number, work: () => Promise<T>): Promise<T> {
  if (busy) fail('A film is already being drawn; wait for it or call film.cancel()')
  busy = true
  cancelRequested = false
  progress.phase = 'preparing'
  progress.frame = 0
  progress.frames = frames
  const wasPaused = useParticleStore.getState().isPaused
  useParticleStore.setState({ isPaused: true })
  try {
    const result = await work()
    progress.phase = 'done'
    return result
  } catch (error) {
    progress.phase = cancelRequested ? 'cancelled' : 'failed'
    throw error
  } finally {
    busy = false
    useParticleStore.setState({ isPaused: wasPaused })
  }
}

export function checkCancelled () {
  if (cancelRequested) fail('The film was cancelled')
}

async function decodeAudio (url: string, duration: number) {
  const response = await fetch(url)
  if (!response.ok) fail(`The audio could not be read: ${response.status} ${response.statusText}`)
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await response.arrayBuffer())
    // No longer than the film
    const length = Math.min(decoded.length, Math.round(duration * decoded.sampleRate))
    return { decoded, length }
  } catch {
    return fail('The audio could not be decoded; give an mp3, wav, m4a or ogg file')
  } finally {
    void context.close()
  }
}

// A piece of an audio buffer as a buffer of its own
function sliceAudio (source: AudioBuffer, from: number, to: number) {
  const slice = new AudioBuffer({ length: to - from, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate })
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    slice.copyToChannel(source.getChannelData(channel).subarray(from, to), channel)
  }
  return slice
}

export interface RenderOptions {
  quality?: FilmQuality
  // Address of an audio file laid under the picture from its first second
  audio?: string
  // Where the file is sent as it is written: a POST for each piece, with the place it belongs at in
  // `at`. The film server gives its own address
  upload?: string
  // Saves the file through the browser's download, under this name; the film is then held in the page
  download?: string
  // Where each picture of the film's graphics is read from, by the "src" it was written with; a "src" not
  // named here is its own address. The film server gives the addresses of files on its machine
  images?: Record<string, string>
}

// The lowest H.264 level a stream of this frame, rate and bitrate fits in
function avcLevel (width: number, height: number, fps: number, bitrate: number) {
  const blocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const fits = AVC_LEVELS.find(([, frame, second, bits]) => blocks <= frame && blocks * fps <= second && bitrate <= bits)
  return (fits ?? AVC_LEVELS[AVC_LEVELS.length - 1])[0]
}

// The browser's software encoder names level 5.2 at most, whatever the frame rate. A stream above its
// named level gets the true one written into the decoder's description, so a player is told what it is
// given: in avcC and in the parameter set inside it the level is one whole byte. A level is only raised
function raiseAvcLevel (config: VideoDecoderConfig, level: number): VideoDecoderConfig {
  const source = config.description
  if (!source) return config
  const bytes = ArrayBuffer.isView(source) ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength) : new Uint8Array(source)
  // avcC: version, profile, compatibility, level, size of a NAL length, count of parameter sets, the
  // first one's length (two bytes), then the set: NAL header, profile, constraints, level
  const known = bytes.length > 11 && bytes[0] === 1 && (bytes[5] & 31) >= 1 && (bytes[8] & 31) === 7 && bytes[11] === bytes[3]
  if (!known || bytes[3] >= level) return config
  const raised = bytes.slice()
  raised[3] = level
  raised[11] = level
  const named = level.toString(16).padStart(2, '0')
  return { ...config, codec: config.codec.replace(/^(avc[13]\.[0-9a-f]{4})[0-9a-f]{2}$/i, (_, start: string) => start + named), description: raised }
}

// Sends the file to the film server as it is written, a piece at a time with the place the piece belongs
// at, so a film of any size passes through the page without being held in it
function createUploadSink (url: string) {
  let size = 0
  const writable = new WritableStream<StreamTargetChunk>({
    async write (piece) {
      const sent = await fetch(`${url}?at=${piece.position}`, { method: 'POST', body: piece.data })
      if (!sent.ok) throw new Error(`The file could not be sent: ${sent.status} ${sent.statusText}`)
      size = Math.max(size, piece.position + piece.data.byteLength)
    }
  })
  return { writable, size: () => size }
}

// What a renderer hands the encoder: the canvas its frames land on and a way to draw each of them
export interface EncodeJob {
  canvas: HTMLCanvasElement
  fps: number
  frames: number
  duration: number
  // Draws frame `index` onto the canvas. Frames come in order
  draw: (index: number) => unknown
}

// The quality asked for, refused before anything is drawn
export function readQuality (options: RenderOptions): FilmQuality {
  const quality = options.quality ?? 'high'
  if (!(quality in QUALITY_BITS)) fail(`quality takes one of: ${Object.keys(QUALITY_BITS).join(', ')}`)
  return quality
}

// Encodes the frames a renderer draws into an mp4. The file goes to `upload` piece by piece, or is put
// together in the page for `download` and kept as `blob` for a caller there. Called inside `exclusively`.
// A render is held by the video encoder, which Chrome already runs on the graphics card (about 200 frames
// a second at 1080p on an RTX 3070, the main thread busy a third of that time). Measured and of no use:
// encoding from the WebGL canvas without the 2D copy, `prefer-hardware`, `realtime`, reading the pixels
// back by hand, other H.264 profiles. Two hardware encoders side by side reach about 300 frames a second
// at the price of a second of frames held in video memory; that is not built
export async function encodeVideo (job: EncodeJob, options: RenderOptions, started: number) {
  const quality = readQuality(options)
  const media = await import('mediabunny')
  const { canvas } = job
  // The bits are counted for 60 frames a second at most. The browser's software H.264 encoder, the one
  // that takes 4K and anything above 120 fps, gives every frame what a 60 fps frame gets whatever the
  // rate, so the file grows with the rate by itself, and it refuses a budget above about 300 Mbit/s;
  // a hardware encoder spreads the same budget over the faster frames
  const bitrate = Math.round(canvas.width * canvas.height * Math.min(job.fps, BITRATE_FPS) * QUALITY_BITS[quality])

  // Either way the index of the file is at its start, so it plays before it is all there. A file
  // sent in pieces keeps room for the index and fills it in at the end; one held in the page is
  // laid out once everything is known
  const sink = options.upload && !options.download ? createUploadSink(options.upload) : null
  const format = new media.Mp4OutputFormat({ fastStart: sink ? 'reserve' : 'in-memory' })
  const codec = await media.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width: canvas.width, height: canvas.height, bitrate
  })
  if (!codec) fail(`This browser cannot encode ${canvas.width}x${canvas.height} video`)

  const target = sink ? new media.StreamTarget(sink.writable, { chunked: true }) : new media.BufferTarget()
  const output = new media.Output({ format, target })
  // What the software encoder makes of the budget above 60 fps is what the level has to hold
  const level = codec === 'avc'
    ? avcLevel(canvas.width, canvas.height, job.fps, bitrate * Math.max(job.fps, BITRATE_FPS) / BITRATE_FPS)
    : 0
  const video = new media.CanvasSource(canvas, {
    codec,
    bitrate,
    keyFrameInterval: KEY_FRAME_SECONDS,
    onEncodedPacket: (_packet, meta) => {
      if (level > 0 && meta?.decoderConfig) meta.decoderConfig = raiseAvcLevel(meta.decoderConfig, level)
    }
  })
  output.addVideoTrack(video, { frameRate: job.fps, maximumPacketCount: job.frames })

  let audio: { decoded: AudioBuffer, length: number } | null = null
  let audioSource: InstanceType<typeof media.AudioBufferSource> | null = null
  let audioCodec: string | null = null
  if (options.audio) {
    audio = await decodeAudio(options.audio, job.duration)
    const found = await media.getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
      numberOfChannels: audio.decoded.numberOfChannels, sampleRate: audio.decoded.sampleRate, bitrate: AUDIO_BITRATE
    })
    if (!found) fail('This browser cannot encode the audio track')
    audioCodec = found
    audioSource = new media.AudioBufferSource({ codec: found, bitrate: AUDIO_BITRATE })
    output.addAudioTrack(audioSource, { maximumPacketCount: Math.ceil(audio.length / SHORTEST_AUDIO_PACKET * 1.4) + 64 })
  }

  await output.start()
  progress.phase = 'rendering'
  let audioSent = 0
  try {
    for (let index = 0; index < job.frames; index++) {
      checkCancelled()
      await job.draw(index)
      await video.add(index / job.fps, 1 / job.fps)
      // Sound goes in beside the picture, a second at a time, so neither track runs far ahead
      if (audio && audioSource) {
        const until = Math.min(audio.length, Math.round((index + 1) / job.fps * audio.decoded.sampleRate))
        if (until - audioSent >= audio.decoded.sampleRate || (index === job.frames - 1 && until > audioSent)) {
          await audioSource.add(sliceAudio(audio.decoded, audioSent, until))
          audioSent = until
        }
      }
      progress.frame = index + 1
      if (index % FRAMES_PER_BREATH === 0) await breathe()
    }
    progress.phase = 'finishing'
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => undefined)
    throw error
  }

  let blob: Blob | null = null
  if (target instanceof media.BufferTarget) {
    if (!target.buffer) fail('The encoder returned no file')
    const held = new Blob([target.buffer], { type: 'video/mp4' })
    blob = held
    if (options.upload) {
      const sent = await fetch(options.upload, { method: 'POST', body: held })
      if (!sent.ok) fail(`The file could not be sent: ${sent.status} ${sent.statusText}`)
    }
    if (options.download) {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(held)
      link.download = options.download
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
    }
  }
  const bytes = blob ? blob.size : sink ? sink.size() : 0
  return {
    blob,
    facts: {
      frames: job.frames,
      duration: job.frames / job.fps,
      fps: job.fps,
      width: canvas.width,
      height: canvas.height,
      codec,
      audio: audioCodec,
      megabytes: Number((bytes / 1e6).toFixed(2)),
      megabitsPerSecond: Number((bytes * 8 / 1e6 / (job.frames / job.fps)).toFixed(1)),
      renderSeconds: Number(((performance.now() - started) / 1000).toFixed(1))
    }
  }
}

// Draws the whole film into an mp4. Returns what was made: the file as `blob` when it was held in the page
export async function renderFilm (source: unknown, options: RenderOptions = {}) {
  const plan = planFilm(source)
  readQuality(options)

  return exclusively(plan.frames, async () => {
    const started = performance.now()
    const player = await createFilmPlayer(plan, plan.scale, options.images)
    try {
      const job = { canvas: player.canvas, fps: plan.fps, frames: plan.frames, duration: plan.duration, draw: player.drawFrame }
      const { blob, facts } = await encodeVideo(job, options, started)
      return { blob, summary: { ...facts, seed: plan.seed, notes: plan.notes } }
    } finally {
      player.dispose()
    }
  })
}

// The frames of a film nearest the seconds asked for, each once, in order
export function framesAt (seconds: number[], fps: number, frames: number) {
  if (seconds.some(time => !Number.isFinite(time))) fail('at takes seconds of the film, e.g. [1, 4.5, 9]')
  return [...new Set(seconds.map(time => clamp(Math.round(time * fps), 0, frames - 1)))].sort((a, b) => a - b)
}

// The layout that shows the most of every frame within the sheet, preferring one with no empty places.
// `fullWidth` is the width of the film's own frame, which a tile never exceeds
export function sheetLayout (count: number, aspect: number, fullWidth: number) {
  let columns = 1
  let fit = 0
  let best = -1
  for (let candidate = 1; candidate <= count; candidate++) {
    const rowCount = Math.ceil(count / candidate)
    const width = Math.min(SHEET_SIDE / candidate, SHEET_SIDE / rowCount * aspect)
    const score = width * (1 - 0.1 * (candidate * rowCount - count))
    if (score > best) {
      best = score
      columns = candidate
      fit = width
    }
  }
  return { columns, rows: Math.ceil(count / columns), tileWidth: Math.floor(Math.min(fullWidth, fit)) }
}

// A still is one frame as the render makes it, at the film's own size and with no label: a picture to use
// (a poster, a thumbnail), where a sheet is a picture to look at. It draws the first second of `at`
export function stillSecond (options: PreviewOptions) {
  if (!options.still) return null
  const second = Array.isArray(options.at) ? Number(options.at[0]) : NaN
  if (!Number.isFinite(second)) fail('A still takes the second it draws, as "at": [second]')
  return [second]
}

// The size a still is written at: the film's own frame, or that frame shrunk to `stillWidth`, which is how a
// poster is judged at the size a feed shows it (168 px wide on a phone)
export function stillSize (options: PreviewOptions, width: number, height: number) {
  if (options.stillWidth === undefined) return { width, height }
  const shrunk = clamp(Math.round(Number(options.stillWidth)), 16, width)
  if (!Number.isFinite(shrunk)) fail('stillWidth takes a width in pixels')
  return { width: shrunk, height: Math.max(1, Math.round(height * shrunk / width)) }
}

// One picture of frames side by side, each with its label in the corner unless it is a still, read back as
// a JPEG. A tile is drawn at the sheet's tile size, so a still can be shrunk on the way
export function createSheet (tileWidth: number, tileHeight: number, columns: number, rows: number, still = false) {
  const sheet = document.createElement('canvas')
  sheet.width = tileWidth * columns
  sheet.height = tileHeight * rows
  const ctx = sheet.getContext('2d', { alpha: false })
  if (!ctx) fail('A 2D canvas is not available')
  ctx.imageSmoothingQuality = 'high'
  const labelSize = Math.max(11, Math.round(tileHeight * 0.055))
  ctx.font = `600 ${labelSize}px system-ui, sans-serif`
  ctx.textBaseline = 'top'
  return {
    place (slot: number, tile: CanvasImageSource, label: string) {
      const x = (slot % columns) * tileWidth
      const y = Math.floor(slot / columns) * tileHeight
      ctx.drawImage(tile, x, y, tileWidth, tileHeight)
      if (still) return
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(x, y, ctx.measureText(label).width + labelSize * 0.8, labelSize * 1.5)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + labelSize * 0.4, y + labelSize * 0.3)
    },
    finish () {
      // A still is shown to people: 0.9, the top of the 85-90 % YouTube's guides give for a photograph
      const jpeg = sheet.toDataURL('image/jpeg', still ? 0.9 : 0.86)
      // Base64 without the data URL's head
      return { image: jpeg.slice(jpeg.indexOf(',') + 1), mimeType: 'image/jpeg', width: sheet.width, height: sheet.height }
    }
  }
}

export interface PreviewOptions {
  // Seconds of the film to show; evenly spread over it when left out
  at?: number[]
  // How many frames to spread over the film when `at` is left out
  frames?: number
  // One frame, the first second of `at`, at the film's own size and with no label (`stillSecond`)
  still?: boolean
  // A still shrunk to this many pixels wide (`stillSize`)
  stillWidth?: number
  // Where each picture of the film's graphics is read from, as in a render
  images?: Record<string, string>
}

// Draws frames of the film side by side on one picture, each with its second in the corner. Every frame
// is the one the render will make: the film is played from its start up to the last frame asked for.
// A film cut into shots is shown as its storyboard, a frame from the middle of each with the shot's name.
// A still is one frame with nothing on it (`stillSecond`)
export async function previewFilm (source: unknown, options: PreviewOptions = {}) {
  const plan = planFilm(source)
  const count = clamp(Math.round(options.frames ?? DEFAULT_SHEET_FRAMES), 1, MAX_SHEET_FRAMES)
  const still = stillSecond(options)
  const at = still ?? (Array.isArray(options.at) && options.at.length > 0 ? options.at : null)
  const board = at === null && options.frames === undefined && plan.shots.length > 1
  const wanted = at
    ? at.slice(0, MAX_SHEET_FRAMES).map(Number)
    : board
      ? plan.shots.slice(0, MAX_SHEET_FRAMES).map(shot => (shot.from + shot.to) / 2)
      : Array.from({ length: count }, (_, index) => (index + 0.5) / count * plan.duration)
  const indices = framesAt(wanted, plan.fps, plan.frames)
  const { columns, rows, tileWidth } = still
    ? { columns: 1, rows: 1, tileWidth: plan.width * plan.scale }
    : sheetLayout(indices.length, plan.width / plan.height, plan.width * plan.scale)
  const last = indices[indices.length - 1]

  return exclusively(last + 1, async () => {
    const player = await createFilmPlayer(plan, tileWidth / plan.width, options.images)
    try {
      const tile = player.canvas
      const size = still ? stillSize(options, tile.width, tile.height) : tile
      const sheet = createSheet(size.width, size.height, columns, rows, still !== null)

      progress.phase = 'rendering'
      let slot = 0
      for (let index = 0; index <= last; index++) {
        checkCancelled()
        const shown = index === indices[slot]
        player.drawFrame(index, shown)
        if (shown) {
          const second = index / plan.fps
          const shot = board ? plan.shots.find(entry => second >= entry.from && second <= entry.to) : undefined
          sheet.place(slot++, tile, `${second.toFixed(1)}s${shot ? '  ' + shot.name : ''}`)
        }
        progress.frame = index + 1
        if (index % FRAMES_PER_BREATH === 0) await breathe()
      }

      return {
        ...sheet.finish(),
        times: indices.map(index => Number((index / plan.fps).toFixed(2))),
        columns,
        film: { duration: plan.duration, fps: plan.fps, frames: plan.frames, width: plan.width * plan.scale, height: plan.height * plan.scale },
        timeline: plan.timeline,
        notes: plan.notes
      }
    } finally {
      player.dispose()
    }
  })
}
