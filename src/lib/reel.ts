// A reel: several films played one after another into one video. A description with "clips" is one; each
// clip is a film of a kind that is there already (the particle scene's, the fractal's), planned by that
// kind's own planner on the reel's frame, so a clip in a reel draws the frames it draws alone. This file
// reads a reel and plans it: which frame of which clip stands at each frame of the reel, and how one clip
// gives way to the next. reel_render.ts plays the plan.
import { asBoolean, asNumber, clamp, fail, unknownKey, type Patch } from './agent_values'
import { MAX_FPS, MIN_FPS, inRange, planFilm, readFrame, type FilmPlan } from './film'
import { writeFilm, writeFractal } from './film_script'
import { planFractal, type FractalPlan } from './fractal'

export const MAX_REEL_SECONDS = 900
export const MAX_REEL_CLIPS = 24
// How one clip arrives from the one before: at once, out of black, or rising over it
export const REEL_TRANSITIONS = ['cut', 'black', 'dissolve'] as const
export type ReelTransition = typeof REEL_TRANSITIONS[number]
const MIN_TRANSITION = 0.1
const MAX_TRANSITION = 3
// Two scenes drawn at once above this many pixels a frame, or this many frames a second, are told as heavy
const HEAVY_PIXELS = 1920 * 1080
const HEAVY_FPS = 60

export const REEL_KEYS = ['size', 'width', 'height', 'scale', 'fps', 'oneScene', 'clips']
// The keys of a frame: they belong to the reel, and a clip's own give way to them
const FRAME_KEYS = ['size', 'width', 'height', 'scale', 'fps']
export const TRANSITION_KEYS = ['kind', 'seconds']

// What a kind of clip is to a reel that reads it: how its film is read when it comes as a script, and how
// it is planned. What plays it is the other half of the entry, in reel_render.ts. A new kind of clip is a
// new entry in both and nothing else
interface ClipReader<Plan extends ClipFrame> {
  // What the kind is called in a timeline
  label: string
  write: (script: string, input: unknown) => { film: Patch, notes: string[] }
  plan: (film: Patch) => Plan
}
// What every kind's plan says of its film
interface ClipFrame {
  duration: number
  fps: number
  frames: number
  width: number
  height: number
  scale: number
  timeline: string[]
  notes: string[]
}
export const CLIP_READERS = {
  film: { label: 'film', write: writeFilm, plan: planFilm } satisfies ClipReader<FilmPlan>,
  fractal: { label: 'fractal film', write: writeFractal, plan: planFractal } satisfies ClipReader<FractalPlan>
}
export type ClipKind = keyof typeof CLIP_READERS
export const CLIP_KINDS = Object.keys(CLIP_READERS) as ClipKind[]
export const CLIP_KEYS = [...CLIP_KINDS, 'input', 'name', 'from', 'to', 'transition']

interface ClipBase {
  // What a storyboard writes under its frame
  name: string
  // The first frame of the clip's own film that is shown, and how many are
  fromFrame: number
  count: number
  // The frame of the reel its first shown frame stands at
  start: number
  transition: ReelTransition
  // Frames the arrival takes: of this clip alone for a cut (0), shared with the one before for a dissolve,
  // split between the two for black
  arrival: number
}
export type ReelClip = ClipBase & ({ kind: 'film', plan: FilmPlan } | { kind: 'fractal', plan: FractalPlan })

export interface ReelPlan {
  width: number
  height: number
  scale: number
  fps: number
  frames: number
  duration: number
  clips: ReelClip[]
  // Never two scenes at once: every dissolve is played through black
  oneScene: boolean
  // Seconds of the reel drawn from two clips at once
  overlap: number
  timeline: string[]
  notes: string[]
}

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)
// A description is a reel when it has clips, whatever else is wrong with it
export const isReel = (source: unknown): source is Patch => isObject(source) && 'clips' in source
const seconds = (value: number) => String(+value.toFixed(2))
// A string that names a file, which only the film server can read
const FILE_NAME = /^[\w ./\\:~-]+\.(json|js)$/i

// What a clip's own planner refused, one problem a line, as a film with several mistakes is told
function problemsOf (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lines = message.split('\n')
  if (lines.length > 1 && /:$/.test(lines[0]) && lines.slice(1).every(line => /^\d+\. /.test(line) || line.startsWith(' '))) {
    const problems: string[] = []
    for (const line of lines.slice(1)) {
      if (/^\d+\. /.test(line)) problems.push(line.replace(/^\d+\. /, ''))
      else problems[problems.length - 1] += '\n' + line
    }
    return problems
  }
  return [message]
}

// A clip's own timeline on the reel's seconds: what of it falls in the stretch that plays, moved to where it plays
function movedTimeline (lines: string[], from: number, to: number, start: number) {
  const moved: string[] = []
  for (const line of lines) {
    const match = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))? s {2}/.exec(line)
    if (!match) {
      moved.push('    ' + line)
      continue
    }
    const begins = Number(match[1])
    const ends = match[2] === undefined ? begins : Number(match[2])
    if (ends < from || begins > to) continue
    const a = Math.max(begins, from) - from + start
    const b = Math.min(ends, to) - from + start
    moved.push(`    ${a === b ? seconds(a) : `${seconds(a)}-${seconds(b)}`} s  ${line.slice(match[0].length)}`)
  }
  return moved
}

/**
 * Reads a reel and plans it. Everything wrong with it is told at once, a clip's own mistakes with the
 * clip's place before them.
 */
export function planReel (source: unknown): ReelPlan {
  if (!isObject(source)) fail('A reel is an object: { size, fps, clips: [{ film }, { fractal, transition }] }. See film.guide()')
  const problems: string[] = []
  const notes: string[] = []
  const attempt = <T>(work: () => T, fallback: T): T => {
    try {
      return work()
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
      return fallback
    }
  }
  for (const key of Object.keys(source)) attempt(() => { if (!REEL_KEYS.includes(key)) unknownKey(key, REEL_KEYS) }, undefined)

  const fps = attempt(() => Math.round(inRange('fps', source.fps ?? 30, MIN_FPS, MAX_FPS, notes)), 30)
  const { width, height, scale } = attempt(() => readFrame(source, notes), { width: 1920, height: 1080, scale: 1 })
  const frame = { width, height, scale, fps }
  const oneScene = attempt(() => source.oneScene === undefined ? false : asBoolean('oneScene', source.oneScene), false)

  const list = attempt(() => {
    if (!Array.isArray(source.clips) || source.clips.length === 0) fail('clips takes an array of clips: [{ film: { ... } }, { fractal: { ... }, transition: { kind: "dissolve", seconds: 1 } }]')
    if (source.clips.length > MAX_REEL_CLIPS) fail(`a reel takes ${MAX_REEL_CLIPS} clips at most; this one has ${source.clips.length}`)
    return source.clips as unknown[]
  }, [])

  const clips: ReelClip[] = []
  list.forEach((entry, index) => {
    const where = `clips[${index}]`
    const before = problems.length
    const clip = attempt<ReelClip | null>(() => {
      if (!isObject(entry)) fail(`${where} is not an object: { film } or { fractal }, with from, to, transition, name`)
      for (const key of Object.keys(entry)) attempt(() => { if (!CLIP_KEYS.includes(key)) unknownKey(`${where}.${key}`, CLIP_KEYS) }, undefined)
      // How it arrives is read first, so a clip whose film cannot be read is still told what is wrong here
      const arriving = attempt<{ transition: ReelTransition, arrival: number } | null>(() => {
        if (entry.transition === undefined) return { transition: 'cut', arrival: 0 }
        const asked = typeof entry.transition === 'string' ? { kind: entry.transition } : entry.transition
        if (!isObject(asked)) fail(`${where}.transition takes { kind: ${REEL_TRANSITIONS.map(name => `"${name}"`).join(' | ')}, seconds }`)
        for (const key of Object.keys(asked)) attempt(() => { if (!TRANSITION_KEYS.includes(key)) unknownKey(`${where}.transition.${key}`, TRANSITION_KEYS) }, undefined)
        if (!(REEL_TRANSITIONS as readonly string[]).includes(String(asked.kind))) fail(`${where}.transition.kind takes one of: ${REEL_TRANSITIONS.join(', ')}`)
        const transition = asked.kind as ReelTransition
        if (transition === 'dissolve' && index === 0) fail(`${where}.transition: the first clip has nothing to dissolve from; "black" fades it in`)
        if (transition === 'cut') {
          if (asked.seconds !== undefined) notes.push(`${where}.transition: a cut takes no time, so its seconds are left out`)
          return { transition, arrival: 0 }
        }
        const length = inRange(`${where}.transition.seconds`, asked.seconds ?? 1, MIN_TRANSITION, MAX_TRANSITION, notes)
        return { transition, arrival: Math.max(1, Math.round(length * fps)) }
      }, null)
      const given = CLIP_KINDS.filter(kind => entry[kind] !== undefined)
      if (given.length !== 1) fail(`${where} takes one film: ${CLIP_KINDS.map(kind => `"${kind}"`).join(' or ')}${given.length > 1 ? `, not ${given.join(' and ')} together` : ''}`)
      const kind = given[0]
      const reader = CLIP_READERS[kind]

      // The clip's film: the object, or what its script writes
      let film: Patch
      const written = entry[kind]
      if (typeof written === 'string') {
        if (FILE_NAME.test(written.trim())) {
          fail(`${where}.${kind}: it names a file (${written.trim()}), which only the film server reads: through space_check, space_preview and space_render it is read from the folder the server runs in; in the page give the film itself, as its JSON or its script`)
        }
        try {
          const read = reader.write(written, entry.input)
          film = read.film
          notes.push(...read.notes.map(note => `${where}: ${note}`))
        } catch (error) {
          for (const problem of problemsOf(error)) problems.push(`${where}.${kind}: ${problem}`)
          return null
        }
      } else if (isObject(written)) {
        film = written
      } else {
        fail(`${where}.${kind} takes the film: its JSON object, or its script as text`)
      }

      // The frame is the reel's. A clip that names another is told, and the reel's is used
      if (FRAME_KEYS.some(key => film[key] !== undefined)) {
        const own = attempt(() => {
          const silent: string[] = []
          return { ...readFrame(film, silent), fps: film.fps === undefined ? fps : Math.round(inRange('fps', film.fps, MIN_FPS, MAX_FPS, silent)) }
        }, frame)
        if (own.width !== width || own.height !== height || own.scale !== scale || own.fps !== fps) {
          notes.push(`${where}: its own frame (${own.width * own.scale}x${own.height * own.scale} at ${own.fps} fps) gives way to the reel's (${width * scale}x${height * scale} at ${fps} fps)`)
        }
      }
      const framed: Patch = { ...film, width, height, scale, fps }
      delete framed.size

      let plan: FilmPlan | FractalPlan
      try {
        plan = reader.plan(framed)
      } catch (error) {
        for (const problem of problemsOf(error)) problems.push(`${where}.${kind}: ${problem}`)
        return null
      }
      notes.push(...plan.notes.map(note => `${where}: ${note}`))
      if (plan.fps !== fps || plan.width !== width || plan.height !== height || plan.scale !== scale) {
        fail(`${where}: a ${reader.label} cannot play on the reel's frame (${width * scale}x${height * scale} at ${fps} fps); it would play at ${plan.width * plan.scale}x${plan.height * plan.scale}, ${plan.fps} fps`)
      }

      // The stretch of the clip that plays, in its own seconds
      const from = entry.from === undefined ? 0 : asNumber(`${where}.from`, entry.from)
      const to = entry.to === undefined ? plan.duration : asNumber(`${where}.to`, entry.to)
      if (from < 0 || to > plan.duration + 1e-9) fail(`${where}: from ${seconds(from)} and to ${seconds(to)} must lie within the clip's own 0..${seconds(plan.duration)} s`)
      const fromFrame = clamp(Math.round(from * fps), 0, plan.frames - 1)
      const count = clamp(Math.round(to * fps), 0, plan.frames) - fromFrame
      if (to <= from || count < 1) fail(`${where}: to (${seconds(to)}) must be later than from (${seconds(from)})`)

      const name = entry.name === undefined ? `${kind} ${index + 1}` : String(entry.name)
      if (!arriving) return null
      return { kind, plan, name, fromFrame, count, start: 0, ...arriving } as ReelClip
    }, null)
    // A clip that could not be read leaves its place empty, so the ones after it keep their numbers in what is told
    if (clip) clips.push(clip)
    else if (problems.length === before) problems.push(`${where} could not be read`)
  })

  // Where each clip stands on the reel. A dissolve lays the start of a clip over the end of the one before;
  // nothing else shares a frame. A transition may take half of each clip it joins at most, so two never meet.
  // It is worked out once every clip was read, whatever else is wrong
  if (clips.length === list.length) {
    clips.forEach((clip, index) => {
      const where = `clips[${index}]`
      const previous = clips[index - 1]
      const reach = (side: ReelClip, frames: number, which: string) => {
        if (frames * 2 > side.count) {
          problems.push(`${where}.transition: ${seconds(clip.arrival / fps)} s of ${clip.transition} does not fit; it may take half of ${which} at most, ${seconds(side.count / 2 / fps)} s`)
        }
      }
      if (clip.transition === 'dissolve') {
        reach(previous, clip.arrival, 'the clip before it')
        reach(clip, clip.arrival, 'this clip')
      } else if (clip.transition === 'black') {
        // Half of it darkens the clip before, the rest lifts off this one; on the first clip all of it is its own
        if (previous) reach(previous, Math.floor(clip.arrival / 2), 'the clip before it')
        reach(clip, previous ? clip.arrival - Math.floor(clip.arrival / 2) : clip.arrival, 'this clip')
      }
      clip.start = previous ? previous.start + previous.count - (clip.transition === 'dissolve' ? clip.arrival : 0) : 0
    })
  }

  const last = clips[clips.length - 1]
  const frames = last ? last.start + last.count : 0
  const duration = frames / fps
  if (problems.length === 0 && duration > MAX_REEL_SECONDS) {
    problems.push(`the reel is ${seconds(duration)} s long; ${MAX_REEL_SECONDS} s is the most`)
  }
  if (problems.length === 1) fail(problems[0])
  if (problems.length > 1) fail(`${problems.length} things in this reel cannot be read:\n${problems.map((problem, index) => `${index + 1}. ${problem}`).join('\n')}`)

  const dissolved = clips.reduce((sum, clip) => sum + (clip.transition === 'dissolve' ? clip.arrival : 0), 0) / fps
  const overlap = oneScene ? 0 : dissolved
  const timeline: string[] = [
    `the reel: ${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}, ${seconds(duration)} s` +
      (overlap > 0
        ? `; two scenes are drawn at once for ${seconds(overlap)} s (the dissolves)`
        : dissolved > 0 ? '; its dissolves are played through black (oneScene), so one scene is drawn at a time' : '; one scene is drawn at a time')
  ]
  clips.forEach((clip, index) => {
    const from = clip.fromFrame / fps
    const to = (clip.fromFrame + clip.count) / fps
    const start = clip.start / fps
    const arrives = clip.transition === 'cut'
      ? (index === 0 ? 'starts the reel' : 'arrives by a cut')
      : clip.transition === 'black'
        ? (index === 0 ? `fades in from black over ${seconds(clip.arrival / fps)} s` : `arrives through black over ${seconds(clip.arrival / fps)} s`)
        : `dissolves in over ${seconds(clip.arrival / fps)} s`
    const whole = clip.fromFrame === 0 && clip.count === clip.plan.frames
    timeline.push(`${seconds(start)}-${seconds(start + clip.count / fps)} s  clip ${index + 1} "${clip.name}": a ${CLIP_READERS[clip.kind].label}, ${whole ? 'all of it' : `its ${seconds(from)}-${seconds(to)} s`}, ${arrives}`)
    timeline.push(...movedTimeline(clip.plan.timeline, from, to, start))
  })
  if (overlap > 0 && (width * scale * height * scale > HEAVY_PIXELS || fps > HEAVY_FPS)) {
    notes.push(`two scenes are drawn at once for ${seconds(overlap)} s at ${width * scale}x${height * scale}, ${fps} fps, which is heavy; ` +
      'if the machine cannot hold both, those dissolves are played through black, and "oneScene": true in the reel asks for that outright')
  }

  return { width, height, scale, fps, frames, duration, clips, oneScene, overlap, timeline, notes }
}

export const REEL_GUIDE = `A reel is several films in one video: a JSON object with "clips", taken wherever a film is (check, preview,
render). Each clip is a whole film of its own, with its own seed, settings, captions and shapes, so a cut to
another setup of the scene, or to another kind of picture, is a new clip.

{
  "size": "1080p", "fps": 30,
  "clips": [
    { "film": { "duration": 12, "preset": "Schwarzschild", "intro": false } },
    { "fractal": { "duration": 10, "target": "spiral", "depth": 20 },
      "transition": { "kind": "dissolve", "seconds": 1 } },
    { "film": "films/graphics.js", "from": 22, "to": 29, "name": "the pair",
      "transition": { "kind": "black", "seconds": 0.6 } }
  ]
}

size | width, height | scale | fps
                             the frame belongs to the reel, with a film's own limits. A clip that names another
                             frame or rate is told, and the reel's is used.
oneScene                     true plays every dissolve through black, so two scenes are never drawn at once.
clips                        ${MAX_REEL_CLIPS} at most, ${MAX_REEL_SECONDS} s together. Each takes:
  ${CLIP_KINDS.map(kind => `"${kind}"`).join(' | ')}        the clip's film, one of the two: "film" is a film of the particle scene, "fractal"
                             a fractal film. Its JSON object, or its script as text; through the film server
                             (space_check, space_preview, space_render) also the path of a .json or .js file,
                             from the folder the server runs in.
  "input"                    what the clip's script reads as input.
  "from", "to"               the stretch of the clip that plays, in the clip's own seconds; all of it when left
                             out. The clip is played from its start either way, so its picture at "from" is the
                             one it has there alone.
  "name"                     what a storyboard writes under its frame.
  "transition"               how the clip arrives from the one before: { "kind", "seconds" }.
                             ${REEL_TRANSITIONS.join(' | ')}; seconds ${MIN_TRANSITION} to ${MAX_TRANSITION}, and half of either clip it joins at most.
                             cut: at once (the default). black: the clip before goes to black over half of the
                             seconds and this one comes out of it over the rest; on the first clip it fades in.
                             dissolve: this clip rises over the end of the one before, so the two play at once
                             for those seconds and the reel is that much shorter than its clips together.

A clip in a reel draws the frames it draws alone, so a clip is made and checked by itself first. A preview
with no seconds is a storyboard: a frame from the middle of each clip, with its name. The sound, when a render
is given one, lies under the whole reel.

A dissolve holds two scenes at once, which costs twice the work for its seconds; a check says for how long.
"oneScene": true in the reel (or among the options of a preview or a render) plays every dissolve through black
instead, and a machine that cannot hold the second scene does so by itself and says so.

Recipes
  Two setups of the scene:   "clips": [{ "film": { "duration": 8, "intro": false } },
                                        { "film": { "duration": 8, "intro": false, "preset": "Schwarzschild",
                                                    "settings": { "gridSky": 0.5 } } }]
  From the scene into the fractal:
                             "clips": [{ "film": { "duration": 10, "intro": false,
                                                   "tracks": { "cameraZoom": [[4, 1], [10, 6, "in"]] } } },
                                       { "fractal": { "duration": 12, "target": "spiral", "depth": 12 },
                                         "transition": { "kind": "dissolve", "seconds": 1.5 } }]
  A part of a film that is there (through the film server):
                             { "film": "films/horizon.js", "from": 18, "to": 27 }

Not in a reel: captions or shapes over the whole of it (each clip has its own), and a script for the reel
itself (a reel is JSON; its clips may be scripts).`
