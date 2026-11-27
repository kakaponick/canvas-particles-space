// A film written as a script: JavaScript that plays the film forward. A call puts something at the current
// second and the calls that take time move that second on, so no second is written by hand, a part of a
// film can be a function, and the film is as long as what was played. writeFilm runs a script and returns
// the film (film.ts) it wrote: the JSON stays the one thing the renderer plays, and everything a script can
// say is something that JSON can hold. The words of the language are SCRIPT_WORDS, told in SCRIPT_GUIDE.
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, type IntroParamKey } from './intro_params'
import { CUE_LAYERS, INTRO_LAYERS } from './intro_tracks'
import { COLORS, INTRO_KEYS, SETTING_KEYS, SLIDERS, clamp, fail, unknownKey, type Patch } from './agent_values'
import { EASES, MAX_DURATION, MAX_SPEED, MIN_DURATION, TRACK_SWITCHES, planFilm } from './film'
import { FRACTAL_HEAD_KEYS, FRACTAL_TRACKS, FRACTAL_TRACK_KEYS, fractalStart, type FractalTrackKey } from './fractal'
import { createRandom, nextRandom } from './random'

export const SCRIPT_WORDS = [
  'film', 'opening', 'shot', 'wait', 'now', 'mark', 'at', 'meanwhile', 'together', 'set', 'to', 'drive', 'slow',
  'hide', 'show', 'fire', 'title', 'caption', 'draw', 'random', 'pick', 'spring', 'input'
] as const
// The words that belong to the particle scene alone: a fractal film has no opening, events, layers, scene time or shapes
const SCENE_WORDS = ['opening', 'slow', 'hide', 'show', 'fire', 'title', 'draw'] as const
export const FRACTAL_SCRIPT_WORDS = SCRIPT_WORDS.filter(word => !(SCENE_WORDS as readonly string[]).includes(word))

// Keys a moving value gets for each second when its path is a function: the rate the scene is stepped at
const BAKE_RATE = 60
// Keys a caption's own number gets for each second when it follows a function: a written number changes
// no faster than it can be read
const VALUE_RATE = 30
// Calls a script may make before it is taken for one that never ends
const MAX_CALLS = 50000
const HEAD_KEYS = ['duration', 'fps', 'size', 'width', 'height', 'scale', 'seed', 'preset', 'settings', 'warmup']
const OPENING_KEYS = ['preset', 'params', 'title', 'font', 'uppercase', 'hide']
const TITLE_KEYS = ['font', 'uppercase', 'params']
const BACKGROUND = ['backgroundR', 'backgroundG', 'backgroundB']
const VALUE_KEYS = ['speed', 'fade', ...new Set([...Object.keys(SLIDERS), ...SETTING_KEYS.filter(key => key !== 'blackHoleFollowing'), ...INTRO_KEYS])]

type Shape = (share: number) => number
type Path = (seconds: number, share: number) => number
type Block = () => void

interface KeyKind {
  // A number moves any way; a colour moves with the film's own eases; a switch flips; the rest is set once
  kind: 'number' | 'color' | 'switch' | 'once'
  home: 'settings' | 'params' | 'speed' | 'fade' | 'fractal'
  min: number
  max: number
}

// What a script writes: a particle film or a fractal film. The language is one; the keys it moves, what
// film() takes and which words it knows are the kind's
interface ScriptKind {
  name: 'film' | 'fractal'
  headKeys: readonly string[]
  kindOf: (key: string) => KeyKind
  guide: string
}

// One thing a script did to a value, at a second of the film
interface Op {
  at: number
  line: number
  seconds: number
  value?: unknown
  ease?: string | Shape
  path?: Path
}

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)
const tidy = (value: number) => Math.round(value * 1e4) / 1e4
const fine = (value: number) => Math.round(value * 1e6) / 1e6

function filmKindOf (key: string): KeyKind {
  if (key === 'speed') return { kind: 'number', home: 'speed', min: 0, max: MAX_SPEED }
  if (key === 'fade') return { kind: 'number', home: 'fade', min: 0, max: 1 }
  const slider = SLIDERS[key]
  if (slider) return { kind: 'number', home: 'settings', min: slider.min, max: slider.max }
  if (TRACK_SWITCHES.includes(key)) return { kind: 'switch', home: 'settings', min: 0, max: 1 }
  if (BACKGROUND.includes(key)) return { kind: 'number', home: 'settings', min: 0, max: 255 }
  if (key in COLORS) return { kind: 'color', home: 'settings', min: 0, max: 0xffffff }
  if (key === 'blackHoleFollowing') fail('blackHoleFollowing: a film has no cursor to follow; move the black hole with blackHoleX and blackHoleY')
  if (SETTING_KEYS.includes(key)) return { kind: 'once', home: 'settings', min: 0, max: 0 }
  if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, VALUE_KEYS)
  const spec = INTRO_PARAM_SPECS[key as IntroParamKey]
  if (spec.options) return { kind: 'once', home: 'params', min: 0, max: spec.options.length - 1 }
  if (spec.color) return { kind: 'color', home: 'params', min: 0, max: 0xffffff }
  return { kind: 'number', home: 'params', min: spec.min, max: spec.max }
}

const FILM_KIND: ScriptKind = { name: 'film', headKeys: HEAD_KEYS, kindOf: filmKindOf, guide: 'film.guide()' }

const FRACTAL_VALUE_KEYS = ['fade', ...FRACTAL_TRACK_KEYS]

function fractalKindOf (key: string): KeyKind {
  if (key === 'fade') return { kind: 'number', home: 'fade', min: 0, max: 1 }
  if (key in FRACTAL_TRACKS) {
    const { min, max } = FRACTAL_TRACKS[key as FractalTrackKey]
    return { kind: 'number', home: 'fractal', min, max }
  }
  if (FRACTAL_HEAD_KEYS.includes(key)) fail(`${key} is set once, in film(): it cannot change along a fractal film`)
  if (key === 'depth') fail('depth follows from the pace: move rate, and the camera falls by its sum')
  return unknownKey(key, FRACTAL_VALUE_KEYS)
}

const FRACTAL_KIND: ScriptKind = { name: 'fractal', headKeys: FRACTAL_HEAD_KEYS, kindOf: fractalKindOf, guide: 'fractal.guide()' }

/**
 * A spring's way from 0 to 1 over a share of time: it runs past 1 and settles. `damping` is 0.1 (rings for
 * long) to 1 (no overshoot).
 */
export function spring (share: number, damping = 0.55) {
  const zeta = clamp(damping, 0.1, 1)
  const u = clamp(share, 0, 1)
  if (u >= 1) return 1
  // Within a hundredth of the end when the share reaches 1
  const omega = 4.6 / zeta
  const decay = Math.exp(-zeta * omega * u)
  if (zeta >= 1) return 1 - decay * (1 + omega * u)
  const ring = omega * Math.sqrt(1 - zeta * zeta)
  return 1 - decay * (Math.cos(ring * u) + zeta * omega / ring * Math.sin(ring * u))
}

// The name a script's lines are reported under, and the line its first line is reported as
const SCRIPT_NAME = 'space-film-script.js'
const SCRIPT_FRAME = /space-film-script\.js:(\d+)/
let firstLine = 0

function rawLine (stack: string | undefined) {
  const found = SCRIPT_FRAME.exec(stack ?? '')
  return found ? Number(found[1]) : 0
}

// The script's line that led to this stack; 0 when the stack does not pass through the script
const lineOf = (stack: string | undefined) => {
  const raw = rawLine(stack)
  return raw > 0 ? raw - firstLine + 1 : 0
}

// How a function made from text numbers its lines differs between engines, so it is asked once
function findFirstLine () {
  if (firstLine > 0) return
  // new Function: a script is text by nature; this one is the engine's own line count
  const probe = new Function('seen', `seen(new Error().stack)\n//# sourceURL=${SCRIPT_NAME}`) as (seen: (stack?: string) => void) => void
  probe(stack => { firstLine = rawLine(stack) })
  if (firstLine === 0) firstLine = 1
}

// The keys a value's operations come to, in the order of the film. `start` is the value before the first;
// `first` comes back as the value at second 0, which the script may have set
function writeKeys (key: string, kind: KeyKind, ops: Op[], start: unknown, notes: string[]) {
  const keys: unknown[][] = []
  let value = start
  let first = start
  let changed = false
  let last = -1
  let busyUntil = 0
  let busyLine = 0
  // A key holding the present value at this second, so what follows starts from here and not from the last key
  const anchor = (time: number) => {
    if (keys.length > 0 && last >= time) return
    keys.push([time, value])
    last = time
  }
  const push = (time: number, next: unknown, ease: string) => {
    keys.push(ease === 'ease' ? [time, next] : [time, next, ease])
    last = time
    value = next
  }
  const held = (next: number, op: Op, state: { told: boolean }) => {
    if (!Number.isFinite(next)) fail(`line ${op.line}: ${key} came out as ${String(next)}, which is not a number`)
    const kept = clamp(next, kind.min, kind.max)
    if (kept !== next && !state.told) {
      state.told = true
      notes.push(`line ${op.line}: ${key} runs outside ${kind.min}..${kind.max} on its way and is held at the edge`)
    }
    return fine(kept)
  }

  for (const op of [...ops].sort((a, b) => a.at - b.at)) {
    if (op.at < busyUntil - 1e-6) {
      fail(`line ${op.line}: ${key} is still moving until ${busyUntil} s (line ${busyLine}); two moves of one value cannot overlap, start this one at that second or later`)
    }
    const state = { told: false }
    if (op.path) {
      const begins = held(op.path(0, 0), op, state)
      if (keys.length === 0 && op.at === 0) {
        changed = true
        value = first = begins
        anchor(0)
      } else {
        anchor(op.at)
        if (begins !== value) push(op.at, begins, 'hold')
      }
      const count = Math.max(1, Math.ceil(op.seconds * BAKE_RATE - 1e-9))
      for (let step = 1; step <= count; step++) {
        const share = step / count
        push(tidy(op.at + op.seconds * share), held(op.path(op.seconds * share, share), op, state), 'linear')
      }
    } else if (op.seconds === 0) {
      if (keys.length === 0 && op.at === 0) {
        changed = true
        value = first = op.value
      } else {
        anchor(0)
        push(op.at, op.value, 'hold')
      }
    } else if (typeof op.ease === 'string' && op.ease !== 'spring') {
      anchor(op.at)
      push(tidy(op.at + op.seconds), op.value, op.ease)
    } else {
      anchor(op.at)
      const shape = typeof op.ease === 'function' ? op.ease : spring
      const from = value as number
      const target = op.value as number
      const count = Math.max(1, Math.ceil(op.seconds * BAKE_RATE - 1e-9))
      for (let step = 1; step < count; step++) {
        const share = step / count
        push(tidy(op.at + op.seconds * share), held(from + (target - from) * shape(share), op, state), 'linear')
      }
      push(tidy(op.at + op.seconds), target, 'linear')
    }
    busyUntil = tidy(op.at + op.seconds)
    busyLine = op.line
  }
  return { keys, changed, first }
}

// Runs a script and gathers what it played: the head, every value's moves, the layers, events, captions,
// shots and marks, and the film's length. What the gathered things come to is the kind's own film
function playScript (source: unknown, input: unknown, script: ScriptKind) {
  if (typeof source !== 'string' || source.trim() === '') fail(`A film script is JavaScript text. See ${script.guide}`)
  findFirstLine()

  let time = 0
  let end = 0
  let calls = 0
  let started = false
  let head: Patch = {}
  let opening: Patch | null = null
  let openingEnds = 0
  const ops = new Map<string, Op[]>()
  const layers = new Map<string, { at: number, shown: boolean }[]>()
  const cues: Patch[] = []
  const captions: Patch[] = []
  const graphics: Patch[] = []
  const shots: Patch[] = []
  const marks: Record<string, number> = {}
  const notes: string[] = []
  // Captions waiting for the shot they are in to end; the first list waits for the film's end
  const open: Patch[][] = [[]]
  let random: ReturnType<typeof createRandom> | null = null

  const here = () => lineOf(new Error().stack)
  const begin = () => {
    started = true
    if (++calls > MAX_CALLS) fail(`The script made more than ${MAX_CALLS} calls and was stopped; a loop in it does not end`)
  }
  const span = (what: string, value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(`${what} takes seconds, 0 or more`)
    return value
  }
  const move = (seconds: number) => {
    time = tidy(time + seconds)
    if (time > MAX_DURATION) fail(`The film runs past ${MAX_DURATION} s, the longest a film can be`)
    end = Math.max(end, time)
  }
  const block = (what: string, value: unknown): Block => {
    if (typeof value !== 'function') fail(`${what} takes a function with what is played: () => { ... }`)
    return value as Block
  }
  const branch = (second: number, play: Block) => {
    const kept = time
    time = tidy(second)
    play()
    const reached = time
    time = kept
    return reached
  }
  const record = (key: string, op: Op) => {
    const list = ops.get(key)
    if (list) list.push(op)
    else ops.set(key, [op])
  }
  const values = (what: string, source: unknown) => {
    if (!isObject(source) || Object.keys(source).length === 0) fail(`${what} takes an object of values: { cameraZoom: 3 }`)
    return Object.entries(source)
  }
  const known = (what: string, source: Patch, keys: readonly string[]) => {
    for (const key of Object.keys(source)) {
      if (!keys.includes(key)) unknownKey(`${what}: ${key}`, keys)
    }
  }
  // The opening plays its events itself; they are fired again only once it is over
  const afterOpening = (what: string) => {
    const intro = opening as Patch | null
    if (intro && time >= (intro.at as number) && time < openingEnds) {
      fail(`${what} at ${time} s falls inside the opening, which plays until ${openingEnds} s; its events and its title are played again only after it`)
    }
  }
  const generator = () => {
    random ??= createRandom(head.seed === undefined ? 1 : Math.round(Number(head.seed)))
    return random
  }
  // A word of the particle scene in a fractal script is told so, with the words a fractal script has
  const sceneOnly = (word: string) => {
    if (script.name !== 'film') fail(`${word}() belongs to the particle scene's films; a fractal script's words are ${FRACTAL_SCRIPT_WORDS.join(', ')}`)
  }

  const words = {
    film (options: unknown) {
      if (started) fail('film() comes first, before anything is played, and once')
      if (!isObject(options)) fail(script.name === 'film' ? 'film() takes an object: { size, fps, seed, preset, settings }' : 'film() takes an object: { size, fps, target, palette, from }')
      known('film()', options, script.headKeys)
      head = { ...options }
      started = true
    },

    opening (options: unknown = {}) {
      begin()
      sceneOnly('opening')
      if (opening) fail('opening() is called once: the opening plays once, and fire() plays its events again')
      if (!isObject(options)) fail('opening() takes an object: { preset, params, title, font, uppercase, hide }')
      known('opening()', options, OPENING_KEYS)
      // The second the plan counts the opening over at is a frame's own second, a little after the opening's
      // length: time moves there, so an event fired right after opening() does not land a hair inside it
      const ends = planFilm({ ...head, duration: MAX_DURATION, intro: { ...options, at: time } }).introEnds ?? Infinity
      if (!Number.isFinite(ends)) fail(`opening() at ${time} s: the opening does not end within ${MAX_DURATION} s, the longest a film can be`)
      const start = time
      opening = { ...options, at: start }
      openingEnds = Math.ceil(ends * 1e4) / 1e4
      move(openingEnds - time)
      return { start, end: time }
    },

    shot (name: unknown, play: unknown) {
      begin()
      if (typeof name !== 'string' || name.trim() === '') fail('shot() takes a name and a function: shot("approach", () => { ... })')
      const run = block(`shot("${name}")`, play)
      const from = time
      open.push([])
      run()
      const waiting = open.pop() ?? []
      if (time <= from) fail(`shot("${name}") has no length: play or wait inside it`)
      for (const caption of waiting) caption.to = time
      shots.push({ name: name.trim(), from, to: time })
      marks[name.trim()] = from
    },

    wait (seconds: unknown) {
      begin()
      move(span('wait()', seconds))
    },

    now: () => time,

    mark (name: unknown) {
      begin()
      if (typeof name !== 'string' || name.trim() === '') fail('mark() takes a name for this second')
      marks[name.trim()] = time
      return time
    },

    at (when: unknown, play: unknown) {
      begin()
      const run = block('at()', play)
      if (typeof when === 'string') {
        if (!(when in marks)) fail(`at(): no second is marked "${when}" yet. Marked: ${Object.keys(marks).join(', ') || 'none'}`)
        return branch(marks[when], run)
      }
      return branch(span('at()', when), run)
    },

    meanwhile (play: unknown) {
      begin()
      return branch(time, block('meanwhile()', play))
    },

    together (...plays: unknown[]) {
      begin()
      if (plays.length === 0) fail('together() takes functions that start at the same second')
      const start = time
      let latest = start
      plays.forEach(play => { latest = Math.max(latest, branch(start, block('together()', play))) })
      time = latest
    },

    set (source: unknown) {
      begin()
      const line = here()
      for (const [key, value] of values('set()', source)) {
        const kind = script.kindOf(key)
        if (kind.kind === 'once' && time > 0) {
          fail(`${key} is set once, at second 0: it cannot change along a film` + (kind.home === 'params' ? '; fire() and title() take it in their params' : ''))
        }
        if (kind.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) fail(`${key} takes a number`)
        if (kind.kind === 'switch' && typeof value !== 'boolean') fail(`${key} takes true or false`)
        record(key, { at: time, line, seconds: 0, value })
      }
    },

    to (source: unknown, seconds: unknown, ease: unknown = 'ease') {
      begin()
      const line = here()
      const length = span('to()', seconds)
      const named = typeof ease === 'string'
      if (named ? ease !== 'spring' && !(EASES as readonly string[]).includes(ease) : typeof ease !== 'function') {
        fail(`to(): the third word is how the value arrives: ${EASES.join(', ')}, spring, or a function of the share of the way (0 to 1)`)
      }
      for (const [key, value] of values('to()', source)) {
        const kind = script.kindOf(key)
        if (kind.kind === 'switch') fail(`${key} is a switch: it flips at once, with set()`)
        if (kind.kind === 'once') fail(`${key} cannot move along a film: it is set once, with set() at second 0`)
        if (kind.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) fail(`${key} takes a number`)
        if (kind.kind === 'color' && !(named && ease !== 'spring')) fail(`${key} is a colour: it moves with ${EASES.join(', ')}`)
        record(key, { at: time, line, seconds: length, value, ease: ease as string | Shape })
      }
      move(length)
    },

    drive (source: unknown, seconds: unknown) {
      begin()
      const line = here()
      const length = span('drive()', seconds)
      if (length === 0) fail('drive() takes the seconds its functions are followed for')
      for (const [key, path] of values('drive()', source)) {
        const kind = script.kindOf(key)
        if (kind.kind !== 'number') fail(`${key} cannot follow a function: only a number can`)
        if (typeof path !== 'function') fail(`drive(): ${key} takes a function of the seconds since it began: s => 0.5 + 0.2 * Math.sin(s)`)
        record(key, { at: time, line, seconds: length, path: path as Path })
      }
      move(length)
    },

    slow (rate: unknown, play: unknown, ramp: unknown = 0.5) {
      begin()
      sceneOnly('slow')
      const line = here()
      if (typeof rate !== 'number' || !(rate >= 0 && rate <= MAX_SPEED)) fail(`slow() takes the pace of the scene's time, 0 (a still frame) to ${MAX_SPEED}; 1 is real time`)
      const run = block('slow()', play)
      const from = time
      run()
      if (time <= from) fail('slow() takes a function that plays or waits: the pace is changed for as long as it lasts')
      const edge = Math.min(span('slow()', ramp), (time - from) / 2)
      record('speed', { at: from, line, seconds: edge, value: rate, ease: 'ease' })
      record('speed', { at: tidy(time - edge), line, seconds: edge, value: 1, ease: 'ease' })
    },

    hide: (...names: unknown[]) => { begin(); sceneOnly('hide'); switchLayers('hide()', names, false) },
    show: (...names: unknown[]) => { begin(); sceneOnly('show'); switchLayers('show()', names, true) },

    fire (...named: unknown[]) {
      begin()
      sceneOnly('fire')
      const params = isObject(named[named.length - 1]) ? named.pop() as Patch : undefined
      if (named.length === 0) fail(`fire() takes the events to play: ${CUE_LAYERS.join(', ')}`)
      for (const name of named) {
        if ((CUE_LAYERS as readonly string[]).includes(String(name))) continue
        if ((INTRO_LAYERS as readonly string[]).includes(String(name))) fail(`fire(): ${String(name)} is a state, not an event; hide() and show() switch it. Events: ${CUE_LAYERS.join(', ')}`)
        unknownKey(String(name), CUE_LAYERS)
      }
      afterOpening('fire()')
      cues.push(params ? { at: time, play: named, params } : { at: time, play: named })
      end = Math.max(end, time)
    },

    title (text: unknown, second?: unknown, third?: unknown) {
      begin()
      sceneOnly('title')
      if (typeof text !== 'string' || text.trim() === '') fail('title() takes the words: title("ACT TWO", 3)')
      const options = isObject(second) ? second : third ?? {}
      if (!isObject(options)) fail('title() takes its options as an object: { font, uppercase, params }')
      known('title()', options, TITLE_KEYS)
      if (options.params !== undefined && !isObject(options.params)) fail('title(): params takes an object of intro parameters')
      afterOpening('title()')
      let params = (options.params ?? {}) as Patch
      if (typeof second === 'number') {
        // A card: it fades in where it stands, stays and fades out, all within its seconds
        const length = span('title()', second)
        const edge = Math.min(1, length / 3)
        params = { titleEntrance: 'Fades in', titleExit: 'Fades out', titleInAt: 0, titleInDuration: fine(edge), dissolveAt: fine(length - edge), dissolveDuration: fine(edge), ...params }
        end = Math.max(end, tidy(time + length))
      }
      const cue: Patch = { at: time, title: text }
      if (options.font !== undefined) cue.font = options.font
      if (options.uppercase !== undefined) cue.uppercase = options.uppercase
      if (Object.keys(params).length > 0) cue.params = params
      cues.push(cue)
    },

    caption (text: unknown, second?: unknown, third?: unknown) {
      begin()
      if (typeof text !== 'string' || text.trim() === '') fail('caption() takes the words to show')
      const options = isObject(second) ? second : third ?? {}
      if (!isObject(options)) fail('caption() takes its options as an object: { at, angle, size, color, font, fade }')
      const caption: Patch = { ...options, text, from: time }
      captions.push(caption)
      if (typeof second === 'number') {
        caption.to = tidy(time + span('caption()', second))
        end = Math.max(end, caption.to as number)
      } else if (typeof second === 'function') {
        (second as Block)()
        caption.to = time
      } else {
        open[open.length - 1].push(caption)
      }
    },

    draw (shape: unknown, second?: unknown) {
      sceneOnly('draw')
      begin()
      if (!isObject(shape) || typeof shape.kind !== 'string') {
        fail('draw() takes a shape as "graphics" takes it: draw({ kind: "circle", center: { hole: [0, 0] }, radius: 3 }, 4)')
      }
      const graphic: Patch = { ...shape, from: time }
      graphics.push(graphic)
      if (typeof second === 'number') {
        graphic.to = tidy(time + span('draw()', second))
        end = Math.max(end, graphic.to as number)
      } else if (typeof second === 'function') {
        (second as Block)()
        graphic.to = time
      } else if (second !== undefined) {
        fail('draw() takes the shape and then its seconds, or a function it lasts as long as')
      } else {
        // As a caption: for as long as the shot it is in
        open[open.length - 1].push(graphic)
      }
    },

    random (first?: unknown, second?: unknown) {
      begin()
      const share = nextRandom(generator())
      if (first === undefined) return share
      const low = second === undefined ? 0 : Number(first)
      const high = Number(second === undefined ? first : second)
      return low + (high - low) * share
    },

    pick (list: unknown) {
      begin()
      if (!Array.isArray(list) || list.length === 0) fail('pick() takes a list to choose from')
      return list[Math.floor(nextRandom(generator()) * list.length)] as unknown
    },

    spring,
    input: input ?? {}
  }

  function switchLayers (what: string, names: unknown[], shown: boolean) {
    if (names.length === 0) fail(`${what} takes layers: ${INTRO_LAYERS.join(', ')}`)
    for (const name of names) {
      const layer = String(name)
      if (!(INTRO_LAYERS as readonly string[]).includes(layer)) unknownKey(layer, INTRO_LAYERS)
      const list = layers.get(layer)
      if (list) list.push({ at: time, shown })
      else layers.set(layer, [{ at: time, shown }])
    }
    end = Math.max(end, time)
  }

  // The same script is the same film: its chance comes from the film's seed, Math.random included
  const math = Object.create(Math) as Math
  math.random = () => nextRandom(generator())

  try {
    // new Function: a film script is text an agent wrote, and running it is the point
    const run = new Function(...SCRIPT_WORDS, 'Math', `"use strict";${source}\n//# sourceURL=${SCRIPT_NAME}`) as (...given: unknown[]) => void
    run(...SCRIPT_WORDS.map(word => words[word]), math)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof SyntaxError) fail(`The script cannot be read as JavaScript: ${message}`)
    const line = lineOf(error instanceof Error ? error.stack : undefined)
    const unknown = error instanceof ReferenceError ? `. The words of a script: ${(script.name === 'film' ? SCRIPT_WORDS : FRACTAL_SCRIPT_WORDS).join(', ')}` : ''
    fail(`${line > 0 ? `line ${line}: ` : ''}${message}${unknown}`)
  }

  const named = head.duration
  const played = Math.max(end, time)
  if (typeof named === 'number' && played > named) {
    fail(`The script plays ${played} s, more than the duration of ${named} s it names; leave duration out of film() and the film is as long as what is played`)
  }
  const duration = typeof named === 'number' ? named : played
  if (duration < MIN_DURATION) fail(script.name === 'film' ? 'The script plays nothing: wait(), to(), drive() and opening() are what give a film its length' : 'The script plays nothing: wait(), to() and drive() are what give a film its length')
  for (const caption of open[0]) caption.to = duration
  // A caption's own numbers, given the short way: two ends to run between over its life, or a function of
  // the seconds since it appeared
  for (const caption of [...captions, ...graphics]) {
    if (!isObject(caption.values)) continue
    const from = caption.from as number
    const life = (caption.to as number) - from
    // A shape moves as smoothly as the scene does; a written number changes no faster than it is read
    const rate = 'kind' in caption ? BAKE_RATE : VALUE_RATE
    caption.values = Object.fromEntries(Object.entries(caption.values).map(([key, value]) => {
      if (typeof value === 'function') {
        const path = value as Path
        const count = Math.max(1, Math.ceil(life * rate))
        const keys: unknown[][] = [[from, fine(path(0, 0))]]
        for (let step = 1; step <= count; step++) keys.push([tidy(from + life * step / count), fine(path(life * step / count, step / count)), 'linear'])
        return [key, keys]
      }
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        return [key, [[from, value[0]], [from + life, value[1], 'linear']]]
      }
      return [key, value]
    }))
  }

  return { head, duration, opening: opening as Patch | null, ops, layers, cues, captions, graphics, shots, marks, notes }
}

/**
 * Runs a film script and returns the film it wrote, the seconds it marked and what it had to adjust.
 * `input` is what the script reads as `input`: one script, several films.
 */
export function writeFilm (source: unknown, input: unknown = {}): { film: Patch, marks: Record<string, number>, notes: string[] } {
  const { head, duration, opening: intro, ops, layers, cues, captions, graphics, shots, marks, notes } = playScript(source, input, FILM_KIND)
  // What every value is before the script touches it: the film's head and the opening, as the plan reads them
  const start = planFilm({ ...head, duration, intro: intro ? { ...intro, at: 0 } : false })
  const film: Patch = { ...head, duration }
  const settings: Patch = isObject(head.settings) ? { ...head.settings } : {}
  const params: Patch = intro && isObject(intro.params) ? { ...intro.params } : {}
  const tracks: Patch = {}

  for (const [key, list] of ops) {
    const kind = filmKindOf(key)
    const before = kind.home === 'speed' ? 1 : kind.home === 'fade' ? 0
      : (kind.home === 'settings' ? start.settings : start.params)[key as never] as unknown
    const written = writeKeys(key, kind, list, before, notes)
    if (kind.home === 'speed' || kind.home === 'fade') {
      if (written.keys.length > 0) film[kind.home] = written.keys
      else if (written.changed) film[kind.home] = written.first
      continue
    }
    if (written.keys.length > 0) tracks[key] = written.keys
    if (!written.changed) continue
    // What was set at second 0 is the film's own start, said where a film says it
    if (kind.home === 'settings') settings[key] = written.first
    else if (intro) params[key] = written.first
    else if (kind.kind === 'once') fail(`line ${list[0].line}: ${key} is a choice of the opening; without opening() it goes into the params of fire() or title()`)
    // A film without the opening has no place for its parameters but a track
    else if (written.keys.length === 0) tracks[key] = [[0, written.first]]
  }

  const switches: Patch = {}
  for (const [layer, list] of layers) {
    const keys: unknown[][] = []
    for (const entry of [...list].sort((a, b) => a.at - b.at)) {
      if (keys.length === 0 && entry.at > 0) keys.push([0, !start.hidden[layer as keyof typeof start.hidden]])
      keys.push([entry.at, entry.shown])
    }
    switches[layer] = keys
  }

  if (Object.keys(settings).length > 0) film.settings = settings
  film.intro = intro ? (Object.keys(params).length > 0 ? { ...intro, params } : intro) : false
  if (Object.keys(tracks).length > 0) film.tracks = tracks
  if (Object.keys(switches).length > 0) film.layers = switches
  if (cues.length > 0) film.cues = cues
  if (captions.length > 0) film.captions = captions
  if (graphics.length > 0) film.graphics = graphics
  if (shots.length > 0) film.shots = shots
  return { film, marks, notes }
}

/**
 * Runs a fractal film's script (fractal.ts) and returns the film it wrote, the seconds it marked and what it
 * had to adjust. The same language: its words but those of the particle scene, and the values it moves are
 * the fractal film's tracks and its fade.
 */
export function writeFractal (source: unknown, input: unknown = {}): { film: Patch, marks: Record<string, number>, notes: string[] } {
  const { head, duration, ops, captions, shots, marks, notes } = playScript(source, input, FRACTAL_KIND)
  const start = fractalStart(head)
  const film: Patch = { ...head, duration }
  const tracks: Patch = {}
  for (const [key, list] of ops) {
    const kind = fractalKindOf(key)
    const written = writeKeys(key, kind, list, start[key as keyof typeof start], notes)
    // A value with keys moves along the film from the value it holds; one only set at second 0 is the film's own
    if (kind.home === 'fade') {
      if (written.keys.length > 0) film.fade = written.keys
      else if (written.changed) film.fade = written.first
    } else if (written.keys.length > 0) {
      tracks[key] = written.keys
    } else if (written.changed) {
      film[key] = written.first
    }
  }
  if (Object.keys(tracks).length > 0) film.tracks = tracks
  if (captions.length > 0) film.captions = captions
  if (shots.length > 0) film.shots = shots
  return { film, marks, notes }
}

export const SCRIPT_GUIDE = `A film as a script
A film can be written as JavaScript instead of JSON: a script plays the film forward. A call puts something
at the current second, and the calls that take time move that second on. So no second is written by hand,
a part of a film is a function that can be called again, and the film is as long as what was played. Give
the script as a string wherever a film is taken; film.script(source, input) returns the JSON it writes, which
is the film above. It is plain JavaScript: functions, loops, Math. The same script is the same film.

  film({ size: 'vertical', fps: 60, seed: 8, preset: 'Schwarzschild', settings: { gridSheet: 0.5 } })
                             first and once, all optional: size, width, height, scale, fps, seed, preset,
                             settings, warmup as in the JSON (warmup only in a script that never calls
                             opening). No duration: the film ends where the script does
  opening({ title: 'ACT ONE', preset: 'Nebula', params: { ... }, hide: ['camera'] })
                             the opening, as "intro" takes it; time moves to its end. A script that never
                             calls it has no opening and starts on the running scene
  shot('approach', () => {   a named stretch of the film. A preview shows a frame of each shot: a storyboard
    caption('The camera moves in')         a caption with no seconds lasts as long as the shot it is in
    to({ cameraZoom: 3 }, 5)               values move from where they are over 5 s, and time moves on 5 s
  })
  wait(2)                    the scene runs for 2 s
  set({ gridSky: 0.5, ringEnabled: false })   values change at once; at second 0 they are the film's settings
  to({ cameraZoom: 1, blackHoleX: 0.3 }, 2, 'spring')
                             the third word is how the value arrives: ${EASES.join(' | ')} | spring, or
                             a function of the share of the way, 0 to 1: u => u * u * u
  drive({ blackHoleX: s => 0.5 + 0.2 * Math.cos(s), blackHoleY: s => 0.5 + 0.2 * Math.sin(s) }, 8)
                             a value follows a function of the seconds since the call (and the share, 0 to 1,
                             as the second argument): circles, pulses, a list of numbers from input
  caption('Event horizon', 4, { at: 'hole', angle: 35 })   for 4 s from now; options as in "captions"
  caption('Slow motion', () => { ... })                    for as long as what the function plays
  caption('*{#{years:1}} billion years', 8, { at: 'top', values: { years: [0, 13.8] } })
                             a number of the caption's own, the short way: two ends to run between over its
                             life, or a function of its seconds, s => 13.8 * (1 - Math.exp(-s))
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 'lensingRadius', dash: true }, 6)
                             a shape over the picture, as "graphics" takes it, for 6 s from now; with no
                             seconds it lasts as long as the shot it is in, with a function as long as that plays
  draw({ kind: 'line', arrow: 'end', points: [{ hole: ['r', 0] }, { hole: [1, 0] }], values: { r: [9, 4] } }, 5)
                             its own numbers the short way a caption's are: two ends, or a function of its
                             seconds, s => 4 + 2 * Math.cos(s). A plot's points are a list the script works out
  title('ACT TWO', 3)        a title card for 3 s, the title cue of the JSON; without seconds it lives by
                             the intro's own title parameters. Options: { font, uppercase, params }
  fire('ringdown', 'gravityWave', { gravityWaveGain: 2 })   events of the opening again, with their params
  hide('gravity'); show('gravity')         layers switched at this second
  slow(0.1, () => { wait(3) })             the scene's time at 0.1 for 3 film seconds, eased in and out over
                             0.5 s (a third argument); 0 is a still frame. The seconds stay film seconds
  set({ fade: 1 }); to({ fade: 0 }, 1.5)   "fade" and "speed" are values like any other

Captions, shapes, titles, events and switches take no time: they are laid at the current second. What takes time
is wait, to, drive, opening and what is played inside shot and slow. Inside at, shot and slow a to moves that
function's own second on too, so what is written after it starts when the move ends: put a move that should run
beside the rest in meanwhile. The seconds of a caption's or a shape's own numbers (values, a function of its
seconds) count from its own start, not from the film's.

  meanwhile(() => { to({ gridTilt: 70 }, 30) })   starts now and does not hold what follows: a slow move
                             under the whole film
  together(() => { to({ cameraZoom: 4 }, 6) }, () => { wait(2); to({ lensingRadius: 6 }, 3) })
                             several lines of play from the same second; time moves to the end of the longest
  mark('merger'); at('merger', () => { ... }); at(12.5, () => { ... })
                             a second remembered by name, and a function played from a second already past
                             or still to come. now() is the current second; a shot's name marks its start
  random() | random(max) | random(min, max) | pick(list)   chance from the film's seed
  input                      what the caller gave beside the script: one script, several films
  spring(u, damping)         the spring's curve itself, for a function of your own

One value cannot be moved by two calls at once; the error names both lines. Every error names its line.

Example
  film({ seed: 4, settings: { gridSheet: 0.5 } })
  set({ fade: 1 })
  meanwhile(() => { to({ gridTilt: 68 }, 20) })
  shot('arrival', () => {
    to({ fade: 0 }, 2)
    caption('A black hole, seen from a distance')
    wait(3)
  })
  shot('approach', () => {
    caption('The shadow', { at: 'hole' })
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 'lensingRadius', dash: true, draw: 1.5 })
    to({ cameraZoom: 3 }, 5, 'spring')
    slow(0.15, () => { wait(3) })
  })
  shot('wave', () => {
    title('RINGDOWN', 3)
    fire('ringdown', 'gravityWave', { gravityWaveGain: 2 })
    to({ cameraZoom: 1 }, 4)
  })
  to({ fade: 1 }, 1.5)`

export const FRACTAL_SCRIPT_GUIDE = `A fractal film as a script
The same language as a film's script, playing a fractal film forward: give the script as a string wherever a fractal
film is taken; fractal.script(source, input) returns the JSON it writes. Its words are the film's but those of the
particle scene (opening, slow, hide, show, fire, title, draw): ${FRACTAL_SCRIPT_WORDS.join(', ')}.

  film({ target: 'triple', palette: 'ice', fps: 30 })   first and once, all optional: what the JSON sets once
                             (${FRACTAL_HEAD_KEYS.join(', ')}). No duration: the film ends where the script does
  to({ rate: 2 }, 5, 'in')   values move from where they are: ${FRACTAL_TRACK_KEYS.join(', ')} and fade
  set({ rate: 0 })           the camera hovers at the depth it reached; to({ rate: -1 }, 2) pulls it back
  drive({ glow: s => 0.3 + 0.3 * Math.sin(s) }, 10)
  shot('dive', () => { ... }), wait, meanwhile, together, mark, at, caption, random, pick, spring, input
                             as in a film's script; a caption's #{depth:0} shows the powers of ten reached

Example
  film({ target: 'spiral', palette: 'classic' })
  set({ fade: 1, rate: 0 })
  shot('arrival', () => {
    to({ fade: 0 }, 2)
    caption('The Mandelbrot set', 3, { at: 'top' })
    wait(1)
  })
  shot('the fall', () => {
    to({ rate: 1.5 }, 6, 'in')
    caption('×10^{#{depth:0}}', { at: 'bottom', font: 'noto' })
    meanwhile(() => { to({ spin: 6 }, 10) })
    wait(14)
    to({ rate: 0 }, 4, 'out')
  })
  to({ fade: 1 }, 1.5)`
