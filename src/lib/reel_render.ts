// Plays a reel (reel.ts): a third player beside the particle film's and the fractal film's, which draws
// nothing itself. For each frame of the reel it has the clip that stands there draw its own frame and
// copies it onto one canvas, mixing two clips through a dissolve and laying black over a fade. The encoder,
// the upload in pieces, the sound and the contact sheet are the film renderer's own (film_render.ts).
import { clamp, fail } from './agent_values'
import {
  DEFAULT_SHEET_FRAMES, MAX_SHEET_FRAMES, breathe, checkCancelled, createFilmPlayer, createSheet, encodeVideo, exclusively,
  framesAt, progress, readQuality, sheetLayout, stillSecond, stillSize, type PreviewOptions, type RenderOptions
} from './film_render'
import { createFractalPlayer, loadFonts } from './fractal_render'
import { planReel, type ReelClip, type ReelPlan } from './reel'

// Hidden frames a clip is stepped through between two breaths of the page, on its way to the first one shown
const STEPS_PER_BREATH = 120

export interface ReelOptions {
  // Never hold two scenes: every dissolve is played through black
  oneScene?: boolean
}

// What a reel needs of a clip's player: the canvas its frames land on, and a way to draw frame `index` of the
// clip's own film or, with `show` false, only to move on to it
interface ClipPlayer {
  canvas: HTMLCanvasElement
  draw: (index: number, show: boolean) => unknown
  dispose: () => void
  // A film clip's camera turned by the viewer, and whether it has a 3D camera to turn (film_render.ts)
  setLook?: (yaw: number, pitch: number) => void
  looks?: () => boolean
}

// The playing half of a kind of clip (its reading half is CLIP_READERS in reel.ts): how its player is made
const CLIP_PLAYERS: { [Kind in ReelClip['kind']]: (clip: Extract<ReelClip, { kind: Kind }>, pixel: number, images?: Record<string, string>) => Promise<ClipPlayer> } = {
  // A scene only goes forward, so every frame before the one shown is stepped
  film: async (clip, pixel, images) => {
    const player = await createFilmPlayer(clip.plan, pixel, images)
    return { canvas: player.canvas, draw: (index, show) => player.drawFrame(index, show), dispose: player.dispose, setLook: player.setLook, looks: player.looks }
  },
  // A fractal frame depends on its second alone, so a frame that is not shown is not drawn
  fractal: async (clip, pixel) => {
    await loadFonts(clip.plan)
    const player = createFractalPlayer(clip.plan, pixel)
    return { canvas: player.canvas, draw: (index, show) => show ? player.drawFrame(index) : undefined, dispose: player.dispose }
  }
}

const makePlayer = (clip: ReelClip, pixel: number, images?: Record<string, string>) =>
  (CLIP_PLAYERS[clip.kind] as (clip: ReelClip, pixel: number, images?: Record<string, string>) => Promise<ClipPlayer>)(clip, pixel, images)

// The reel's player at `pixel` video pixels a film pixel. `first` is the first frame of the reel that will
// be asked for: its clip's player is made now, and its canvas gives the reel's canvas its size
export async function createReelPlayer (plan: ReelPlan, pixel: number, options: ReelOptions & { images?: Record<string, string> }, first: number) {
  const { clips } = plan
  const notes: string[] = []
  const players: (ClipPlayer | null)[] = clips.map(() => null)
  // The next frame of its own film each clip's player draws
  const next = clips.map(() => 0)
  // The dissolves that are played through black: all of them when one scene at a time was asked for, and
  // any whose second scene could not be made
  const through = clips.map(clip => clip.transition === 'dissolve' && (options.oneScene ?? plan.oneScene))

  // The viewer's turn of the camera, given to every film clip, those opened later too
  const look = { yaw: 0, pitch: 0 }
  // The clip the last frame drawn was of
  let current = 0
  const open = async (index: number) => {
    const made = players[index] ?? (players[index] = await makePlayer(clips[index], pixel, options.images))
    made.setLook?.(look.yaw, look.pitch)
    return made
  }
  const close = (index: number) => {
    players[index]?.dispose()
    players[index] = null
  }
  const dispose = () => clips.forEach((_, index) => close(index))
  // The newest clip that has started by frame `frame` of the reel
  const clipAt = (frame: number) => {
    let index = 0
    while (index + 1 < clips.length && clips[index + 1].start <= frame) index++
    return index
  }

  const sized = await open(clipAt(first))
  const canvas = document.createElement('canvas')
  canvas.width = sized.canvas.width
  canvas.height = sized.canvas.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    dispose()
    fail('A 2D canvas is not available')
  }

  // Has clip `index` draw the frame `own` of the stretch it shows, and returns its canvas
  const frameOf = async (index: number, own: number) => {
    const clip = clips[index]
    const player = await open(index)
    const frame = clip.fromFrame + own
    if (frame < next[index]) fail(`Frames are drawn in order: clip ${index + 1} is past its frame ${frame}`)
    for (let hidden = next[index]; hidden < frame; hidden++) {
      player.draw(hidden, false)
      if (hidden % STEPS_PER_BREATH === 0) {
        checkCancelled()
        await breathe()
      }
    }
    await player.draw(frame, true)
    next[index] = frame + 1
    return player.canvas
  }
  const copy = (source: HTMLCanvasElement, share = 1) => {
    ctx.globalAlpha = share
    // A tile of a contact sheet may come a pixel apart between two kinds of clip; a render never does
    if (source.width === canvas.width && source.height === canvas.height) ctx.drawImage(source, 0, 0)
    else ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
  }
  const darken = (share: number) => {
    if (share <= 0) return
    ctx.globalAlpha = Math.min(share, 1)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
  }
  // The two halves of a way through black, `frames` long, between two clips: the frames that darken the
  // clip before, and the rest, which lift off the clip that arrives
  const split = (frames: number, shared: boolean) => shared ? Math.floor(frames / 2) : 0

  // Draws frame `frame` of the reel onto the canvas. Frames are asked for in rising order
  const drawFrame = async (frame: number) => {
    clips.forEach((clip, index) => { if (players[index] && clip.start + clip.count <= frame) close(index) })
    const index = clipAt(frame)
    current = index
    const clip = clips[index]
    const own = frame - clip.start
    const before = index > 0 ? clips[index - 1] : null

    if (before && clip.transition === 'dissolve' && own < clip.arrival) {
      const leaving = before.count - clip.arrival + own
      // The frame of the clip before, once it is drawn: a scene draws a frame once
      let old: HTMLCanvasElement | null = null
      if (!through[index]) {
        old = await frameOf(index - 1, leaving)
        try {
          await open(index)
        } catch (error) {
          // No room for a second scene beside the first: this dissolve goes through black instead
          through[index] = true
          notes.push(`clips[${index}]: the second scene of its dissolve could not be made (${error instanceof Error ? error.message : String(error)}), so it is played through black`)
        }
        if (!through[index]) {
          copy(old)
          copy(await frameOf(index, own), (own + 1) / (clip.arrival + 1))
          return
        }
      }
      const half = split(clip.arrival, true)
      if (own < half) {
        copy(old ?? await frameOf(index - 1, leaving))
        darken((own + 1) / half)
      } else {
        close(index - 1)
        copy(await frameOf(index, own))
        darken(1 - (own - half + 1) / (clip.arrival - half + 1))
      }
      return
    }

    copy(await frameOf(index, own))
    // Out of black as it arrives, and into black as the next one is about to
    if (clip.transition === 'black') {
      const half = split(clip.arrival, before !== null)
      if (own < clip.arrival - half) darken(1 - (own + 1) / (clip.arrival - half + 1))
    }
    const after = clips[index + 1]
    if (after && after.transition === 'black') {
      const half = split(after.arrival, true)
      const into = own - (clip.count - half)
      if (into >= 0) darken((into + 1) / half)
    }
  }

  const setLook = (yaw: number, pitch: number) => {
    look.yaw = yaw
    look.pitch = pitch
    for (const player of players) player?.setLook?.(yaw, pitch)
  }
  const looks = () => players[current]?.looks?.() ?? false

  return { canvas, drawFrame, dispose, notes, setLook, looks }
}

// What a reel will be, without drawing it
export function checkReel (source: unknown) {
  const plan = planReel(source)
  return {
    duration: plan.duration,
    fps: plan.fps,
    frames: plan.frames,
    width: plan.width * plan.scale,
    height: plan.height * plan.scale,
    clips: plan.clips.map(clip => clip.name),
    // Seconds of it drawn from two scenes at once
    twoScenes: plan.overlap,
    oneScene: plan.oneScene,
    timeline: plan.timeline,
    notes: plan.notes
  }
}

// Draws the whole reel into an mp4
export async function renderReel (source: unknown, options: RenderOptions & ReelOptions = {}) {
  const plan = planReel(source)
  readQuality(options)

  return exclusively(plan.frames, async () => {
    const started = performance.now()
    const player = await createReelPlayer(plan, plan.scale, options, 0)
    try {
      const job = { canvas: player.canvas, fps: plan.fps, frames: plan.frames, duration: plan.duration, draw: player.drawFrame }
      const { blob, facts } = await encodeVideo(job, options, started)
      return { blob, summary: { ...facts, clips: plan.clips.length, notes: [...plan.notes, ...player.notes] } }
    } finally {
      player.dispose()
    }
  })
}

// Draws frames of the reel side by side on one picture. With no seconds asked for it is the reel's
// storyboard, a frame from the middle of each clip with its name; every frame is the one the render makes.
// A still is one frame with nothing on it (`stillSecond`)
export async function previewReel (source: unknown, options: PreviewOptions & ReelOptions = {}) {
  const plan = planReel(source)
  const count = clamp(Math.round(options.frames ?? DEFAULT_SHEET_FRAMES), 1, MAX_SHEET_FRAMES)
  const still = stillSecond(options)
  const at = still ?? (Array.isArray(options.at) && options.at.length > 0 ? options.at : null)
  const board = at === null && options.frames === undefined && plan.clips.length > 1
  const wanted = at
    ? at.slice(0, MAX_SHEET_FRAMES).map(Number)
    : board
      ? plan.clips.slice(0, MAX_SHEET_FRAMES).map(clip => (clip.start + clip.count / 2) / plan.fps)
      : Array.from({ length: count }, (_, index) => (index + 0.5) / count * plan.duration)
  const indices = framesAt(wanted, plan.fps, plan.frames)
  const { columns, rows, tileWidth } = still
    ? { columns: 1, rows: 1, tileWidth: plan.width * plan.scale }
    : sheetLayout(indices.length, plan.width / plan.height, plan.width * plan.scale)
  const last = indices[indices.length - 1]

  return exclusively(last + 1, async () => {
    const player = await createReelPlayer(plan, tileWidth / plan.width, options, indices[0])
    try {
      const size = still ? stillSize(options, player.canvas.width, player.canvas.height) : player.canvas
      const sheet = createSheet(size.width, size.height, columns, rows, still !== null)
      progress.phase = 'rendering'
      for (let slot = 0; slot < indices.length; slot++) {
        checkCancelled()
        const frame = indices[slot]
        await player.drawFrame(frame)
        const second = frame / plan.fps
        // On a storyboard a frame is the middle of a clip, and carries that clip's name
        const owner = board ? plan.clips.find(clip => framesAt([(clip.start + clip.count / 2) / plan.fps], plan.fps, plan.frames)[0] === frame) : undefined
        sheet.place(slot, player.canvas, `${second.toFixed(1)}s${owner ? '  ' + owner.name : ''}`)
        progress.frame = frame + 1
        await breathe()
      }
      return {
        ...sheet.finish(),
        times: indices.map(index => Number((index / plan.fps).toFixed(2))),
        columns,
        film: { duration: plan.duration, fps: plan.fps, frames: plan.frames, width: plan.width * plan.scale, height: plan.height * plan.scale },
        timeline: plan.timeline,
        notes: [...plan.notes, ...player.notes]
      }
    } finally {
      player.dispose()
    }
  })
}
