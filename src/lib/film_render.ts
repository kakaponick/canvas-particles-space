// Plays a film (film.ts) off the page: a scene of its own on a canvas of the film's size, advanced by a
// fixed step with no clock, so a slow machine draws the same frames as a fast one, only later. The frames
// go to an mp4 (WebCodecs through mediabunny, loaded only when a film is rendered) or onto one contact
// sheet an agent can look at before it renders.
import { useParticleStore } from '../store/particle_store'
import { REFERENCE_FPS } from './particle_simulation'
import { getRenderingContext } from './particle_renderer'
import { createScene, type SceneInput } from './scene'
import { getIntroDuration } from './intro_timeline'
import type { TitleStyle } from './title_sprite'
import { applyTracks, planFilm, type FilmPlan } from './film'
import { drawCaptions, loadCaptionFonts } from './film_captions'
import { clamp, fail } from './agent_values'

// A film waits for its faces: a title in a fallback face would be a different video
const FONT_WAIT_MS = 8000
// Frames drawn between two breaths of the page, so it stays responsive and a cancel is heard
const FRAMES_PER_BREATH = 24
// Bits per pixel per frame: the field is fine detail in motion, which costs more than ordinary video
const QUALITY_BITS = { medium: 0.12, high: 0.25, max: 0.45 } as const
export type FilmQuality = keyof typeof QUALITY_BITS
const KEY_FRAME_SECONDS = 2
const AUDIO_BITRATE = 160_000
// Longest side of a contact sheet, the most an agent's image reader keeps
const SHEET_SIDE = 1536
const DEFAULT_SHEET_FRAMES = 9
const MAX_SHEET_FRAMES = 24

export interface FilmProgress {
  phase: 'idle' | 'preparing' | 'rendering' | 'finishing' | 'done' | 'failed' | 'cancelled'
  frame: number
  frames: number
}

const progress: FilmProgress = { phase: 'idle', frame: 0, frames: 0 }
let busy = false
let cancelRequested = false

export const filmProgress = (): FilmProgress => ({ ...progress })

export function cancelFilm () {
  if (busy) cancelRequested = true
  return { cancelling: busy }
}

const breathe = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function titleStyle (plan: FilmPlan): TitleStyle {
  const { params } = plan
  return {
    ...plan.title,
    weight: params.titleWeight,
    tracking: params.titleTracking,
    size: params.titleSize,
    haloRadius: params.titleHalo > 0 ? params.titleHaloRadius : 0,
    haloStreak: params.titleStreak
  }
}

// The film's own scene and the canvas its finished frames land on, captions included
async function createFilmPlayer (plan: FilmPlan, pixel: number) {
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
  const scene = createScene(gl, plan.seed, input)
  if (!scene) fail('The scene could not start: its shaders did not build')
  scene.resize(plan.width, plan.height, pixel, input, true)

  const canvas = document.createElement('canvas')
  canvas.width = glCanvas.width
  canvas.height = glCanvas.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) fail('A 2D canvas is not available')

  await Promise.all([scene.setTitle(titleStyle(plan), FONT_WAIT_MS), loadCaptionFonts(plan)])

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
    scene.restart(input, -plan.introAt)
  }

  // Motion is stepped at about the page's 60 Hz whatever the film's frame rate, so gravity and trails
  // behave as they do live; only the last step of a frame is shown
  const steps = Math.max(1, Math.round(REFERENCE_FPS / plan.fps))
  const frameScale = REFERENCE_FPS / (plan.fps * steps)
  const dt = 1 / (plan.fps * steps)
  let drawn = -1

  // Draws frame `index`, the film at index / fps seconds. Frames come in order; `show` false only moves
  // the scene on, for a contact sheet that skips to its next frame
  const drawFrame = (index: number, show = true) => {
    if (index !== drawn + 1) fail(`Frames are drawn in order: ${drawn + 1} is next, not ${index}`)
    drawn = index
    const time = index / plan.fps
    applyTracks(plan, time)
    input.particleCount = plan.settings.numParticles
    if (index === 0) {
      // The first frame is the film at second 0: nothing has moved yet
      scene.advance(0, 0, input, show)
    } else {
      for (let step = 1; step <= steps; step++) scene.advance(frameScale, dt, input, show && step === steps)
    }
    if (!show) return
    ctx.drawImage(glCanvas, 0, 0)
    if (plan.captions.length > 0) drawCaptions(ctx, plan, time, scene.frame.composite, canvas.width / plan.width)
  }

  const dispose = () => {
    scene.dispose()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { canvas, drawFrame, dispose }
}

// One film at a time, with the page's own scene paused so the machine draws only the film
async function exclusively<T> (frames: number, work: () => Promise<T>): Promise<T> {
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

function checkCancelled () {
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
  // Where the finished file is sent with a POST; the film server gives its own address
  upload?: string
  // Saves the file through the browser's download, under this name
  download?: string
}

// Draws the whole film into an mp4. Returns what was made; the file itself goes to `upload` or
// `download`, and is kept as `blob` for a caller in the page
export async function renderFilm (source: unknown, options: RenderOptions = {}) {
  const plan = planFilm(source)
  const quality = options.quality ?? 'high'
  if (!(quality in QUALITY_BITS)) fail(`quality takes one of: ${Object.keys(QUALITY_BITS).join(', ')}`)

  return exclusively(plan.frames, async () => {
    const started = performance.now()
    const media = await import('mediabunny')
    const player = await createFilmPlayer(plan, plan.scale)
    const { canvas } = player
    const bitrate = Math.round(canvas.width * canvas.height * plan.fps * QUALITY_BITS[quality])

    try {
      const format = new media.Mp4OutputFormat({ fastStart: 'in-memory' })
      const codec = await media.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
        width: canvas.width, height: canvas.height, bitrate
      })
      if (!codec) fail(`This browser cannot encode ${canvas.width}x${canvas.height} video`)

      const output = new media.Output({ format, target: new media.BufferTarget() })
      const video = new media.CanvasSource(canvas, { codec, bitrate, keyFrameInterval: KEY_FRAME_SECONDS })
      output.addVideoTrack(video, { frameRate: plan.fps })

      let audio: { decoded: AudioBuffer, length: number } | null = null
      let audioSource: InstanceType<typeof media.AudioBufferSource> | null = null
      let audioCodec: string | null = null
      if (options.audio) {
        audio = await decodeAudio(options.audio, plan.duration)
        const found = await media.getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
          numberOfChannels: audio.decoded.numberOfChannels, sampleRate: audio.decoded.sampleRate, bitrate: AUDIO_BITRATE
        })
        if (!found) fail('This browser cannot encode the audio track')
        audioCodec = found
        audioSource = new media.AudioBufferSource({ codec: found, bitrate: AUDIO_BITRATE })
        output.addAudioTrack(audioSource)
      }

      await output.start()
      progress.phase = 'rendering'
      let audioSent = 0
      try {
        for (let index = 0; index < plan.frames; index++) {
          checkCancelled()
          player.drawFrame(index)
          await video.add(index / plan.fps, 1 / plan.fps)
          // Sound goes in beside the picture, a second at a time, so neither track runs far ahead
          if (audio && audioSource) {
            const until = Math.min(audio.length, Math.round((index + 1) / plan.fps * audio.decoded.sampleRate))
            if (until - audioSent >= audio.decoded.sampleRate || (index === plan.frames - 1 && until > audioSent)) {
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

      const buffer = output.target.buffer
      if (!buffer) fail('The encoder returned no file')
      const blob = new Blob([buffer], { type: 'video/mp4' })
      if (options.upload) {
        const sent = await fetch(options.upload, { method: 'POST', body: blob })
        if (!sent.ok) fail(`The file could not be sent: ${sent.status} ${sent.statusText}`)
      }
      if (options.download) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = options.download
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
      }
      return {
        blob,
        summary: {
          frames: plan.frames,
          duration: plan.frames / plan.fps,
          fps: plan.fps,
          width: canvas.width,
          height: canvas.height,
          codec,
          audio: audioCodec,
          megabytes: Number((blob.size / 1e6).toFixed(2)),
          megabitsPerSecond: Number((blob.size * 8 / 1e6 / (plan.frames / plan.fps)).toFixed(1)),
          renderSeconds: Number(((performance.now() - started) / 1000).toFixed(1)),
          seed: plan.seed,
          notes: plan.notes
        }
      }
    } finally {
      player.dispose()
    }
  })
}

export interface PreviewOptions {
  // Seconds of the film to show; evenly spread over it when left out
  at?: number[]
  // How many frames to spread over the film when `at` is left out
  frames?: number
}

// Draws frames of the film side by side on one picture, each with its second in the corner. Every frame
// is the one the render will make: the film is played from its start up to the last frame asked for
export async function previewFilm (source: unknown, options: PreviewOptions = {}) {
  const plan = planFilm(source)
  const count = clamp(Math.round(options.frames ?? DEFAULT_SHEET_FRAMES), 1, MAX_SHEET_FRAMES)
  const wanted = Array.isArray(options.at) && options.at.length > 0
    ? options.at.slice(0, MAX_SHEET_FRAMES).map(Number)
    : Array.from({ length: count }, (_, index) => (index + 0.5) / count * plan.duration)
  if (wanted.some(time => !Number.isFinite(time))) fail('at takes seconds of the film, e.g. [1, 4.5, 9]')
  const indices = [...new Set(wanted.map(time => clamp(Math.round(time * plan.fps), 0, plan.frames - 1)))].sort((a, b) => a - b)

  // The layout that shows the most of every frame within the sheet, preferring one with no empty places
  const aspect = plan.width / plan.height
  let columns = 1
  let fit = 0
  let best = -1
  for (let candidate = 1; candidate <= indices.length; candidate++) {
    const rowCount = Math.ceil(indices.length / candidate)
    const width = Math.min(SHEET_SIDE / candidate, SHEET_SIDE / rowCount * aspect)
    const score = width * (1 - 0.1 * (candidate * rowCount - indices.length))
    if (score > best) {
      best = score
      columns = candidate
      fit = width
    }
  }
  const rows = Math.ceil(indices.length / columns)
  const tileWidth = Math.floor(Math.min(plan.width * plan.scale, fit))
  const last = indices[indices.length - 1]

  return exclusively(last + 1, async () => {
    const player = await createFilmPlayer(plan, tileWidth / plan.width)
    try {
      const tile = player.canvas
      const sheet = document.createElement('canvas')
      sheet.width = tile.width * columns
      sheet.height = tile.height * rows
      const ctx = sheet.getContext('2d', { alpha: false })
      if (!ctx) fail('A 2D canvas is not available')
      const labelSize = Math.max(11, Math.round(tile.height * 0.055))
      ctx.font = `600 ${labelSize}px system-ui, sans-serif`
      ctx.textBaseline = 'top'

      progress.phase = 'rendering'
      let slot = 0
      for (let index = 0; index <= last; index++) {
        checkCancelled()
        const shown = index === indices[slot]
        player.drawFrame(index, shown)
        if (shown) {
          const x = (slot % columns) * tile.width
          const y = Math.floor(slot / columns) * tile.height
          ctx.drawImage(tile, x, y)
          const label = `${(index / plan.fps).toFixed(1)}s`
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.fillRect(x, y, ctx.measureText(label).width + labelSize * 0.8, labelSize * 1.5)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(label, x + labelSize * 0.4, y + labelSize * 0.3)
          slot++
        }
        progress.frame = index + 1
        if (index % FRAMES_PER_BREATH === 0) await breathe()
      }

      const jpeg = sheet.toDataURL('image/jpeg', 0.86)
      return {
        // Base64 without the data URL's head
        image: jpeg.slice(jpeg.indexOf(',') + 1),
        mimeType: 'image/jpeg',
        width: sheet.width,
        height: sheet.height,
        times: indices.map(index => Number((index / plan.fps).toFixed(2))),
        columns,
        film: { duration: plan.duration, fps: plan.fps, frames: plan.frames, width: plan.width * plan.scale, height: plan.height * plan.scale },
        notes: plan.notes
      }
    } finally {
      player.dispose()
    }
  })
}
