// A film: the scene as a short video, described by one JSON object. It names its length, frame, seed and
// starting settings, places the intro as a clip, moves any setting or intro parameter along keyframes and
// lays captions over the picture. planFilm checks it against the registries the panels are built from and
// turns it into a plan the renderer (film_render.ts) plays frame by frame. A film starts from the page's
// defaults, never from what this browser happens to have set, so the same film is the same video anywhere.
import { DEFAULT_PRESET, BUILT_IN_PRESETS, usePresetStore } from '../store/preset_store'
import { DEFAULT_TITLE_TEXT, type TitleText } from '../store/intro_debug_store'
import { BUILT_IN_INTRO_PRESETS, useIntroPresetStore } from '../store/intro_preset_store'
import { pickSimulationSettings, type SimulationSettings } from './simulation_presets'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, type IntroParamKey, type IntroParams } from './intro_params'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { TITLE_FONTS, type TitleFontKey } from './title_sprite'
import {
  INTRO_KEYS, SETTING_KEYS, SLIDERS, TOGGLES, asBoolean, asNumber, clamp, fail, findPreset, parseIntroValue, parseSettings,
  unknownKey, type Patch
} from './agent_values'

export const FILM_SIZES: Record<string, readonly [number, number]> = {
  '1080p': [1920, 1080],
  '720p': [1280, 720],
  '4k': [3840, 2160],
  vertical: [1080, 1920],
  square: [1080, 1080]
}
const FILM_SCALES = [0.5, 1, 1.5, 2]
const MIN_DURATION = 0.5
const MAX_DURATION = 180
const MIN_FPS = 12
const MAX_FPS = 60
const MIN_SIDE = 240
const MAX_SIDE = 3840
// Device pixels of one frame: 4K
const MAX_PIXELS = 3840 * 2160
// Seconds a film without the intro runs before its first frame, so the trails are already drawn
const DEFAULT_WARMUP = 2
const MAX_WARMUP = 10
const CAPTION_FADE = 0.35

const EASES = ['ease', 'linear', 'in', 'out', 'hold'] as const
type Ease = typeof EASES[number]

export const CAPTION_PLACES = ['bottom', 'top', 'center', 'hole', 'einstein', 'companion'] as const
export type CaptionPlace = typeof CAPTION_PLACES[number]
export type CaptionFont = TitleFontKey | 'system'

export interface FilmCaption {
  text: string
  from: number
  to: number
  // A place on the frame, something in the scene the caption points at, or shares of the frame's
  // width and height
  at: CaptionPlace | readonly [number, number]
  // Direction of a pointing caption from the black hole, degrees: 0 is right, 90 is up
  angle: number
  // Height of the letters as a share of the frame's short side
  size: number
  color: string
  font: CaptionFont
  // Seconds it takes to appear and to leave
  fade: number
}

export interface FilmTrack {
  key: string
  // Which half of the scene's input the key belongs to
  target: 'settings' | 'params'
  // A colour moves channel by channel
  color: boolean
  // A switch: its values are 0 and 1, and it flips at a key's second instead of moving towards it
  toggle: boolean
  times: number[]
  values: number[]
  // How the value arrives at each key from the one before
  eases: Ease[]
}

export interface FilmPlan {
  duration: number
  fps: number
  frames: number
  // Size of the frame in the scene's own pixels, and video pixels per scene pixel
  width: number
  height: number
  scale: number
  seed: number
  // Second of the film the intro starts at; null leaves the intro out
  introAt: number | null
  warmup: number
  // The scene's input; tracks write into both as the film plays
  settings: SimulationSettings
  params: IntroParams
  hidden: Record<IntroLayer, boolean>
  title: TitleText
  tracks: FilmTrack[]
  captions: FilmCaption[]
  // What the plan changed in the film it was given: values moved into range and the like
  notes: string[]
}

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)

function takeKnown (source: Patch, known: readonly string[], where: string) {
  for (const key of Object.keys(source)) {
    if (!known.includes(key)) unknownKey(`${where}${key}`, known)
  }
}

const FILM_KEYS = ['duration', 'fps', 'size', 'width', 'height', 'scale', 'seed', 'preset', 'settings', 'intro', 'warmup', 'tracks', 'captions']
const INTRO_FILM_KEYS = ['at', 'preset', 'params', 'title', 'font', 'uppercase', 'hide']
const CAPTION_KEYS = ['text', 'from', 'to', 'at', 'angle', 'size', 'color', 'font', 'fade']
// The switches a film can flip along its tracks; it has no cursor for the black hole to follow
const TRACK_SWITCHES = SETTING_KEYS.filter(key => key in TOGGLES && key !== 'blackHoleFollowing')

function inRange (key: string, value: unknown, min: number, max: number, notes: string[]) {
  const number = asNumber(key, value)
  const kept = clamp(number, min, max)
  if (kept !== number) notes.push(`${key} ${number} is outside ${min}..${max}, used ${kept}`)
  return kept
}

function readFrame (film: Patch, notes: string[]) {
  let width = 1920
  let height = 1080
  if (film.size !== undefined) {
    const size = FILM_SIZES[String(film.size).toLowerCase()]
    if (!size) fail(`size takes one of: ${Object.keys(FILM_SIZES).join(', ')}; or give width and height`)
    width = size[0]
    height = size[1]
  }
  if (film.width !== undefined) width = asNumber('width', film.width)
  if (film.height !== undefined) height = asNumber('height', film.height)
  // A video encoder takes even sides; multiples of 4 stay even at every scale
  const side = (key: string, value: number) => {
    const kept = clamp(Math.round(value / 4) * 4, MIN_SIDE, MAX_SIDE)
    if (kept !== value) notes.push(`${key} ${value} is not a multiple of 4 within ${MIN_SIDE}..${MAX_SIDE}, used ${kept}`)
    return kept
  }
  width = side('width', width)
  height = side('height', height)

  let scale = film.scale === undefined ? 1 : asNumber('scale', film.scale)
  const nearest = FILM_SCALES.reduce((best, option) => Math.abs(option - scale) < Math.abs(best - scale) ? option : best)
  if (nearest !== scale) notes.push(`scale ${scale} is not one of ${FILM_SCALES.join(', ')}, used ${nearest}`)
  scale = nearest
  while (scale > FILM_SCALES[0] && width * height * scale * scale > MAX_PIXELS) {
    scale = FILM_SCALES[FILM_SCALES.indexOf(scale) - 1]
    notes.push(`the frame is larger than 4K, scale lowered to ${scale}`)
  }
  return { width, height, scale }
}

function readTitle (intro: Patch, title: TitleText): TitleText {
  const next = { ...title }
  if (intro.title !== undefined && intro.title !== false) {
    if (typeof intro.title !== 'string') fail('intro.title takes a string (\\n starts a new line) or false for no title')
    next.text = intro.title
  }
  if (intro.font !== undefined) {
    if (!(String(intro.font) in TITLE_FONTS)) fail(`intro.font takes one of: ${Object.keys(TITLE_FONTS).join(', ')}`)
    next.font = intro.font as TitleFontKey
  }
  if (intro.uppercase !== undefined) next.uppercase = asBoolean('intro.uppercase', intro.uppercase)
  return next
}

function readKeyframes (key: string, source: unknown, duration: number, read: (value: unknown) => number) {
  if (!Array.isArray(source) || source.length === 0) fail(`tracks.${key} takes keyframes: [[seconds, value], [seconds, value, "ease"], ...]`)
  const keys = source.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) fail(`tracks.${key}[${index}] takes [seconds, value] or [seconds, value, ease]`)
    const ease = entry[2] === undefined ? 'ease' : String(entry[2])
    if (!(EASES as readonly string[]).includes(ease)) fail(`tracks.${key}[${index}]: ease takes one of ${EASES.join(', ')}`)
    return { time: clamp(asNumber(`tracks.${key}[${index}] time`, entry[0]), 0, duration), value: read(entry[1]), ease: ease as Ease }
  }).sort((a, b) => a.time - b.time)
  return { times: keys.map(entry => entry.time), values: keys.map(entry => entry.value), eases: keys.map(entry => entry.ease) }
}

function readTracks (source: unknown, duration: number, notes: string[]): FilmTrack[] {
  if (source === undefined) return []
  if (!isObject(source)) fail('tracks take an object: { settingKey: [[seconds, value], ...] }')
  const known = [...Object.keys(SLIDERS), ...TRACK_SWITCHES, 'backgroundR', 'backgroundG', 'backgroundB', ...INTRO_KEYS]
  return Object.entries(source).map(([key, keyframes]) => {
    const slider = SLIDERS[key]
    if (slider) {
      const read = (value: unknown) => inRange(`tracks.${key}`, value, slider.min, slider.max, notes)
      return { key, target: 'settings' as const, color: false, toggle: false, ...readKeyframes(key, keyframes, duration, read) }
    }
    if (TRACK_SWITCHES.includes(key)) {
      return { key, target: 'settings' as const, color: false, toggle: true, ...readKeyframes(key, keyframes, duration, value => asBoolean(`tracks.${key}`, value) ? 1 : 0) }
    }
    if (key === 'backgroundR' || key === 'backgroundG' || key === 'backgroundB') {
      return { key, target: 'settings' as const, color: false, toggle: false, ...readKeyframes(key, keyframes, duration, value => inRange(`tracks.${key}`, value, 0, 255, notes)) }
    }
    if (key === 'colorPalette') fail('tracks.colorPalette: the palette cannot move along keyframes; set it in settings')
    if (key === 'blackHoleFollowing') fail('tracks.blackHoleFollowing: a film has no cursor to follow; move the black hole with blackHoleX and blackHoleY')
    if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, known)
    const spec = INTRO_PARAM_SPECS[key as IntroParamKey]
    if (spec.options) fail(`tracks.${key}: a choice cannot move along keyframes; set it in intro.params`)
    return {
      key,
      target: 'params' as const,
      color: spec.color === true,
      toggle: false,
      ...readKeyframes(key, keyframes, duration, value => parseIntroValue(key as IntroParamKey, value))
    }
  })
}

function readCaptions (source: unknown, duration: number): FilmCaption[] {
  if (source === undefined) return []
  if (!Array.isArray(source)) fail('captions take an array: [{ text, from, to, at }]')
  return source.map((entry, index) => {
    const where = `captions[${index}]`
    if (!isObject(entry)) fail(`${where} is not an object`)
    takeKnown(entry, CAPTION_KEYS, `${where}.`)
    if (typeof entry.text !== 'string' || entry.text.trim() === '') fail(`${where}.text takes the words to show`)
    const from = clamp(asNumber(`${where}.from`, entry.from ?? 0), 0, duration)
    const to = clamp(asNumber(`${where}.to`, entry.to ?? duration), 0, duration)
    if (to <= from) fail(`${where}: to (${to}) must be later than from (${from})`)

    let at: FilmCaption['at'] = 'bottom'
    if (Array.isArray(entry.at)) {
      if (entry.at.length !== 2) fail(`${where}.at takes [x, y] as shares of the frame, e.g. [0.5, 0.8]`)
      at = [clamp(asNumber(`${where}.at[0]`, entry.at[0]), 0, 1), clamp(asNumber(`${where}.at[1]`, entry.at[1]), 0, 1)]
    } else if (entry.at !== undefined) {
      if (!(CAPTION_PLACES as readonly string[]).includes(String(entry.at))) fail(`${where}.at takes one of ${CAPTION_PLACES.join(', ')} or [x, y]`)
      at = entry.at as CaptionPlace
    }
    const pointing = at === 'hole' || at === 'einstein' || at === 'companion'
    const font = entry.font === undefined ? 'unbounded' : String(entry.font)
    if (font !== 'system' && !(font in TITLE_FONTS)) fail(`${where}.font takes one of: ${Object.keys(TITLE_FONTS).join(', ')}, system`)
    const color = entry.color === undefined ? '#ffffff' : String(entry.color)
    if (!/^#[0-9a-f]{6}$/i.test(color)) fail(`${where}.color takes '#rrggbb'`)
    return {
      text: entry.text,
      from,
      to,
      at,
      angle: entry.angle === undefined ? 35 : asNumber(`${where}.angle`, entry.angle),
      size: clamp(entry.size === undefined ? (pointing ? 0.03 : 0.04) : asNumber(`${where}.size`, entry.size), 0.01, 0.2),
      color,
      font: font as CaptionFont,
      fade: clamp(entry.fade === undefined ? CAPTION_FADE : asNumber(`${where}.fade`, entry.fade), 0, (to - from) / 2)
    }
  })
}

// Checks a film and turns it into the plan the renderer plays. Throws with the reason on the first thing
// it cannot read
export function planFilm (source: unknown): FilmPlan {
  if (!isObject(source)) fail('A film is an object: { duration, fps, size, settings, intro, tracks, captions }. See film.guide()')
  takeKnown(source, FILM_KEYS, '')
  const notes: string[] = []

  const duration = inRange('duration', source.duration ?? 10, MIN_DURATION, MAX_DURATION, notes)
  const fps = Math.round(inRange('fps', source.fps ?? 30, MIN_FPS, MAX_FPS, notes))
  const { width, height, scale } = readFrame(source, notes)
  const seed = source.seed === undefined ? 1 : Math.round(asNumber('seed', source.seed))

  // The scene's settings: the defaults, then what an intro preset carries, a preset, and the film's own
  let settings = pickSimulationSettings(DEFAULT_PRESET.settings)
  let params: IntroParams = { ...DEFAULT_INTRO_PARAMS }
  let title: TitleText = { ...DEFAULT_TITLE_TEXT }
  const hidden = Object.fromEntries(INTRO_LAYERS.map(layer => [layer, false])) as Record<IntroLayer, boolean>
  let introAt: number | null = 0

  if (source.intro === false) {
    introAt = null
  } else if (source.intro !== undefined && source.intro !== true) {
    const intro = source.intro
    if (!isObject(intro)) fail('intro takes false (leave it out) or an object: { at, preset, params, title, hide }')
    takeKnown(intro, INTRO_FILM_KEYS, 'intro.')
    if (intro.preset !== undefined) {
      const preset = findPreset([...BUILT_IN_INTRO_PRESETS, ...useIntroPresetStore.getState().presets], String(intro.preset))
      params = { ...preset.params }
      // A look that sets only the face keeps the words
      title = preset.keepsText ? { ...preset.title, text: title.text } : { ...preset.title }
      for (const layer of preset.hidden) hidden[layer] = true
      if (preset.scene) settings = pickSimulationSettings(preset.scene)
    }
    if (intro.params !== undefined) {
      if (!isObject(intro.params)) fail('intro.params takes an object of intro parameters')
      for (const [key, value] of Object.entries(intro.params)) {
        if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, INTRO_KEYS)
        params[key as IntroParamKey] = parseIntroValue(key as IntroParamKey, value)
      }
    }
    title = readTitle(intro, title)
    if (intro.title === false) hidden.title = true
    if (intro.hide !== undefined) {
      if (!Array.isArray(intro.hide)) fail(`intro.hide takes an array of layers: ${INTRO_LAYERS.join(', ')}`)
      for (const layer of intro.hide) {
        if (!(INTRO_LAYERS as readonly string[]).includes(String(layer))) unknownKey(String(layer), INTRO_LAYERS)
        hidden[layer as IntroLayer] = true
      }
    }
    if (intro.at !== undefined) introAt = inRange('intro.at', intro.at, -params.introEnd, duration, notes)
  }

  if (source.preset !== undefined) {
    const preset = findPreset([...BUILT_IN_PRESETS, ...usePresetStore.getState().presets], String(source.preset))
    settings = pickSimulationSettings(preset.settings)
  }
  if (source.settings !== undefined) {
    const { next, clamped } = parseSettings(source.settings, SETTING_KEYS)
    Object.assign(settings, next)
    for (const [key, value] of Object.entries(clamped)) notes.push(`settings.${key} was moved onto its slider: ${String(value)}`)
  }
  // A film has no cursor to follow: the black hole rests at blackHoleX, blackHoleY, which tracks can move
  settings.blackHoleFollowing = false

  const warmup = introAt === null
    ? inRange('warmup', source.warmup ?? DEFAULT_WARMUP, 0, MAX_WARMUP, notes)
    : 0

  return {
    duration,
    fps,
    frames: Math.max(1, Math.round(duration * fps)),
    width,
    height,
    scale,
    seed,
    introAt,
    warmup,
    settings,
    params,
    hidden,
    title,
    tracks: readTracks(source.tracks, duration, notes),
    captions: readCaptions(source.captions, duration),
    notes
  }
}

function easeShare (share: number, ease: Ease) {
  if (ease === 'linear') return share
  if (ease === 'in') return share * share
  if (ease === 'out') return 1 - (1 - share) * (1 - share)
  if (ease === 'hold') return share < 1 ? 0 : 1
  return share * share * (3 - 2 * share)
}

function mixColor (from: number, to: number, share: number) {
  const channel = (shift: number) => Math.round((from >> shift & 255) + ((to >> shift & 255) - (from >> shift & 255)) * share)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function trackValue (track: FilmTrack, time: number) {
  const { times, values, eases } = track
  const last = times.length - 1
  if (time <= times[0]) return values[0]
  if (time >= times[last]) return values[last]
  let next = 1
  while (times[next] < time) next++
  if (track.toggle) return time < times[next] ? values[next - 1] : values[next]
  const span = times[next] - times[next - 1]
  const share = easeShare(span > 0 ? (time - times[next - 1]) / span : 1, eases[next])
  return track.color
    ? mixColor(values[next - 1], values[next], share)
    : values[next - 1] + (values[next] - values[next - 1]) * share
}

// Writes every track's value at this second of the film into the plan's settings and intro parameters
export function applyTracks (plan: FilmPlan, time: number) {
  const settings = plan.settings as unknown as Record<string, number | boolean>
  const params = plan.params as unknown as Record<string, number>
  for (const track of plan.tracks) {
    const value = trackValue(track, time)
    if (track.toggle) settings[track.key] = value === 1
    else if (track.target === 'settings') settings[track.key] = value
    else params[track.key] = value
  }
}

// How visible a caption is at this second: 0 before and after it, 1 between its fades
export function captionAlpha (caption: FilmCaption, time: number) {
  if (time < caption.from || time > caption.to) return 0
  if (caption.fade <= 0) return 1
  return clamp(Math.min(time - caption.from, caption.to - time) / caption.fade, 0, 1)
}

export const FILM_GUIDE = `A film is one JSON object; the scene renders it to an mp4, the same video for the same film.

{
  "duration": 12,            seconds, ${MIN_DURATION}-${MAX_DURATION}
  "fps": 30,                 ${MIN_FPS}-${MAX_FPS}
  "size": "1080p",           ${Object.keys(FILM_SIZES).join(' | ')}; or "width" and "height"
  "scale": 1,                video pixels per scene pixel: ${FILM_SCALES.join(' | ')} (2 on 1080p gives 4K)
  "seed": 1,                 another seed, another field of stars
  "preset": "Schwarzschild", a simulation preset to start from (omit for the default look)
  "settings": { ... },       simulation settings on top of it, as in describe
  "intro": { "at": 0, "preset": "Nebula", "params": { ... }, "title": "TWO\\nLINES", "hide": ["camera"] },
                             the opening (star, explosion, black hole forming) as a clip: "at" is the second it
                             starts (negative starts the film inside it). "intro": false leaves it out and the
                             film opens on the running scene; "title": false drops the words
  "tracks": { "blackHoleSize": [[0, 6], [4, 14], [9, 14, "linear"]] },
                             keyframes [seconds, value, ease?] for any numeric setting or intro parameter;
                             ease is how the value arrives: ease (default) | linear | in | out | hold.
                             A switch takes true or false and flips at its second. "cameraZoom" here is the
                             Zoom setting; the opening's own camera of that name is set in intro.params
  "captions": [{ "text": "Event horizon", "from": 2, "to": 6, "at": "hole" }]
                             at: bottom (default) | top | center | [x, y] shares of the frame | hole | einstein |
                             companion; the last three point a line at the shadow's edge, the Einstein ring
                             or the second black hole, from "angle" degrees (0 right, 90 up).
                             Optional: size, color '#rrggbb', font, fade
}

Everything but duration is optional. Start from describe to find setting keys; lengths around the black hole
are in black hole radii, so blackHoleSize alone scales it.

Recipes
  Zoom into the hole:      "tracks": { "cameraZoom": [[0, 1], [8, 2.5]] }
  Move the hole:           "tracks": { "blackHoleX": [[0, 0.3], [10, 0.7]], "blackHoleY": [[0, 0.5]] }
  Real black hole:         "preset": "Schwarzschild", "intro": false
  Curved space sheet:      "settings": { "gridSheet": 0.6, "gridTilt": 65, "gridDepth": 3 }
  Lens made visible:       "settings": { "gridSky": 0.5 }
  Orbiting stars (S2):     "settings": { "orbitCount": 12, "orbitEccentricity": 0.7, "orbitTrail": 10 }
  Two black holes merging: "settings": { "companionSize": 0.7, "gridSheet": 0.5 },
                           "tracks": { "companionDistance": [[0, 9], [10, 0, "in"]] }
  Slow motion at a moment: "tracks": { "baseSpeed": [[0, 6], [4, 6], [5, 0.5], [8, 0.5], [9, 6]] }
  Vertical short:          "size": "vertical", "settings": { "blackHoleY": 0.42 }

Check with preview (a contact sheet of frames) before render; both take the same film.`
