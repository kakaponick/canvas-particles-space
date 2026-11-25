// A film: the scene as a short video, described by one JSON object. It names its length, frame, seed and
// starting settings, and is a timeline of five kinds of things: values that move along keyframes (tracks),
// layers that switch on and off (layers), the intro as a clip (intro), its events fired again (cues) and
// the pace of the scene's own time (speed), with a fade to black and captions laid over the picture and names
// for its stretches (shots). A script (film_script.ts) is a shorter way to write this same object.
// planFilm checks it against the registries the panels are built from and
// turns it into a plan the renderer (film_render.ts) plays frame by frame. A film starts from the page's
// defaults, never from what this browser happens to have set, so the same film is the same video anywhere.
import { DEFAULT_PRESET, BUILT_IN_PRESETS, usePresetStore } from '../store/preset_store'
import { DEFAULT_TITLE_TEXT, type TitleText } from '../store/intro_debug_store'
import { BUILT_IN_INTRO_PRESETS, useIntroPresetStore } from '../store/intro_preset_store'
import { pickSimulationSettings, type SimulationSettings } from './simulation_presets'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, type IntroParamKey, type IntroParams } from './intro_params'
import { CUE_LAYERS, INTRO_LAYERS, type CueLayer, type IntroLayer } from './intro_tracks'
import { TITLE_FONTS, type TitleFontKey } from './title_sprite'
import { captionKeys, captionLetters, parseCaption, strangeLetters, type CaptionRun } from './caption_text'
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
export const MIN_DURATION = 0.5
export const MAX_DURATION = 180
const MIN_FPS = 12
// Up to 60 for the web; above it for a fast display, or to slow the film down afterwards
const MAX_FPS = 240
const MIN_SIDE = 240
const MAX_SIDE = 3840
// Device pixels of one frame: 4K
const MAX_PIXELS = 3840 * 2160
// Seconds a film without the intro runs before its first frame, so the trails are already drawn
const DEFAULT_WARMUP = 2
const MAX_WARMUP = 10
const CAPTION_FADE = 0.35
// The colour a stressed term is drawn in unless the caption names its own
const CAPTION_ACCENT = '#ffd27a'
const BACKGROUND_KEYS = ['backgroundR', 'backgroundG', 'backgroundB']
// The most scene seconds one film second may hold: time-lapse; 0 is a still frame
export const MAX_SPEED = 4

export const EASES = ['ease', 'linear', 'in', 'out', 'hold'] as const
type Ease = typeof EASES[number]

export const CAPTION_PLACES = ['bottom', 'top', 'center', 'hole', 'einstein', 'companion'] as const
export type CaptionPlace = typeof CAPTION_PLACES[number]
// A caption takes the title's display faces, a plain text face with Greek and mathematics, or the machine's own
export type CaptionFont = TitleFontKey | 'noto' | 'system'
export const CAPTION_FONTS: readonly CaptionFont[] = [...(Object.keys(TITLE_FONTS) as TitleFontKey[]), 'noto', 'system']
export const CAPTION_REVEALS = ['letters', 'words', 'lines'] as const
export const CAPTION_ALIGNS = ['left', 'center', 'right'] as const

export interface FilmCaption {
  text: string
  // The text as it is drawn: its lines, each cut into runs at its marks (caption_text.ts)
  lines: CaptionRun[][]
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
  // Colour of the stressed terms, *{...}
  accent: string
  // How the lines stand in their block; null leaves it to the place (centred, or beside a pointer)
  align: typeof CAPTION_ALIGNS[number] | null
  // The widest a line may be, as a share of the frame's width
  width: number
  // A dark plate behind the words, 0 (none) to 1 (solid), for words over a bright picture
  plate: number
  // The words arrive a letter, a word or a line at a time over revealOver seconds; null shows them at once
  reveal: typeof CAPTION_REVEALS[number] | null
  revealOver: number
  // Numbers of its own that #{name} reads, each along keyframes
  values: Record<string, FilmTrack>
  // Where a pointing caption's line starts, in radii of what it points at (black hole radii, as orbitSize
  // is); null is its edge
  radius: number | null
}

export interface FilmTrack {
  key: string
  // What the key belongs to: a half of the scene's input, the layer switches, the film's own pace, or the
  // dark laid over its picture
  target: 'settings' | 'params' | 'layers' | 'speed' | 'fade' | 'caption'
  // A colour moves channel by channel
  color: boolean
  // A switch: its values are 0 and 1, and it flips at a key's second instead of moving towards it
  toggle: boolean
  times: number[]
  values: number[]
  // How the value arrives at each key from the one before
  eases: Ease[]
}

// Events of the opening played again at this second of the film
export interface FilmCue {
  at: number
  layers: CueLayer[]
  // Intro parameters set at that second, which shape what is fired
  params: Partial<IntroParams>
  // Words of its own for a fired title; null keeps the words that are there
  title: TitleText | null
}

// A stretch of the film with a name: it changes no frame, and is what a preview shows one frame of
export interface FilmShot {
  name: string
  from: number
  to: number
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
  // The intro's own clock at the film's first frame, and the second of the film the intro is over at
  // (Infinity while it outlasts the film, null when it is left out)
  introTime: number
  introEnds: number | null
  // Scene seconds that pass in one film second, along keyframes; null is 1 throughout
  speed: FilmTrack | null
  // Share of black laid over the picture and under the captions, along keyframes; null is none
  fade: FilmTrack | null
  shots: FilmShot[]
  cues: FilmCue[]
  warmup: number
  // The scene's input; tracks write into both as the film plays
  settings: SimulationSettings
  params: IntroParams
  hidden: Record<IntroLayer, boolean>
  title: TitleText
  tracks: FilmTrack[]
  captions: FilmCaption[]
  // What happens when, in the order it happens: the film as the plan understood it
  timeline: string[]
  // What the plan changed in the film it was given: values moved into range and the like
  notes: string[]
}

const isObject = (value: unknown): value is Patch => typeof value === 'object' && value !== null && !Array.isArray(value)

// A part of a film that cannot be read is written down and the reading goes on with `fallback`, so
// everything wrong with a film is told at once instead of one thing a try
type Attempt = <T>(work: () => T, fallback: T) => T

function takeKnown (source: Patch, known: readonly string[], where: string, attempt: Attempt) {
  for (const key of Object.keys(source)) {
    if (!known.includes(key)) attempt(() => unknownKey(`${where}${key}`, known), undefined)
  }
}

// What the bundled faces can draw: the Latin file all three have, and the Cyrillic one only Unbounded has
const LATIN_LETTERS = /^[\u0304\u0308\u0329\n\u0020-\u00ff\u0131\u0152\u0153\u02bb\u02bc\u02c6\u02da\u02dc\u2000-\u206f\u20ac\u2122\u2191\u2193\u2212\u2215]*$/
const CYRILLIC_LETTERS = /[\u0301\u0400-\u045f\u0490\u0491\u04b0\u04b1\u2116]/g

// The face these words are drawn in. A face that lacks their letters would hand them to whatever the
// machine has, and the same film would no longer be the same video: Cyrillic goes to the one face that
// holds it, and letters no bundled face holds are named
function faceFor<Face extends string> (text: string, face: Face, where: string, notes: string[], caption = false): Face | 'unbounded' {
  if (face === 'system') return face
  const withoutCyrillic = text.replace(CYRILLIC_LETTERS, '')
  // A caption falls back on the text and mathematics faces for what its own face lacks; a title has its face alone
  const strange = caption ? strangeLetters(text) : LATIN_LETTERS.test(withoutCyrillic) ? [] : ['']
  if (strange.length > 0) {
    notes.push(`${where} has letters that none of the bundled faces hold${strange[0] === '' ? '' : ` (${strange.slice(0, 8).join(' ')})`}; they are drawn in the machine's own face, which differs between machines`)
  }
  if (withoutCyrillic.length === text.length || face === 'unbounded' || face === 'noto') return face
  notes.push(`${where}: ${face} has no Cyrillic letters, so it is drawn in unbounded, the face that has them`)
  return 'unbounded'
}

const FILM_KEYS = ['duration', 'fps', 'size', 'width', 'height', 'scale', 'seed', 'preset', 'settings', 'intro', 'warmup', 'speed', 'fade', 'tracks', 'layers', 'cues', 'captions', 'shots']
const CUE_KEYS = ['at', 'play', 'params', 'title', 'font', 'uppercase']
const INTRO_FILM_KEYS = ['at', 'preset', 'params', 'title', 'font', 'uppercase', 'hide']
const CAPTION_KEYS = ['text', 'from', 'to', 'at', 'angle', 'size', 'color', 'font', 'fade', 'accent', 'align', 'width', 'plate', 'reveal', 'revealOver', 'values', 'radius']
// The switches a film can flip along its tracks; it has no cursor for the black hole to follow
export const TRACK_SWITCHES = SETTING_KEYS.filter(key => key in TOGGLES && key !== 'blackHoleFollowing')

export function inRange (key: string, value: unknown, min: number, max: number, notes: string[]) {
  const number = asNumber(key, value)
  const kept = clamp(number, min, max)
  if (kept !== number) notes.push(`${key} ${number} is outside ${min}..${max}, used ${kept}`)
  return kept
}

export function readFrame (film: Patch, notes: string[]) {
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

function readTitle (intro: Patch, title: TitleText, where = 'intro.'): TitleText {
  const next = { ...title }
  if (intro.title !== undefined && intro.title !== false) {
    if (typeof intro.title !== 'string') fail(`${where}title takes a string (\\n starts a new line)${where === 'intro.' ? ' or false for no title' : ''}`)
    next.text = intro.title
  }
  if (intro.font !== undefined) {
    if (!(String(intro.font) in TITLE_FONTS)) fail(`${where}font takes one of: ${Object.keys(TITLE_FONTS).join(', ')}`)
    next.font = intro.font as TitleFontKey
  }
  if (intro.uppercase !== undefined) next.uppercase = asBoolean(`${where}uppercase`, intro.uppercase)
  return next
}

function readKeyframes (where: string, source: unknown, duration: number, read: (value: unknown) => number) {
  if (!Array.isArray(source) || source.length === 0) fail(`${where} takes keyframes: [[seconds, value], [seconds, value, "ease"], ...]`)
  const keys = source.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3) fail(`${where}[${index}] takes [seconds, value] or [seconds, value, ease]`)
    const ease = entry[2] === undefined ? 'ease' : String(entry[2])
    if (!(EASES as readonly string[]).includes(ease)) fail(`${where}[${index}]: ease takes one of ${EASES.join(', ')}`)
    return { time: clamp(asNumber(`${where}[${index}] time`, entry[0]), 0, duration), value: read(entry[1]), ease: ease as Ease }
  }).sort((a, b) => a.time - b.time)
  return { times: keys.map(entry => entry.time), values: keys.map(entry => entry.value), eases: keys.map(entry => entry.ease) }
}

function readTracks (source: unknown, duration: number, notes: string[], attempt: Attempt): FilmTrack[] {
  if (source === undefined) return []
  if (!isObject(source)) fail('tracks take an object: { settingKey: [[seconds, value], ...] }')
  const known = [...Object.keys(SLIDERS), ...TRACK_SWITCHES, 'backgroundR', 'backgroundG', 'backgroundB', ...INTRO_KEYS]
  const readTrack = (key: string, keyframes: unknown): FilmTrack => {
    const slider = SLIDERS[key]
    if (slider) {
      const read = (value: unknown) => inRange(`tracks.${key}`, value, slider.min, slider.max, notes)
      return { key, target: 'settings' as const, color: false, toggle: false, ...readKeyframes(`tracks.${key}`, keyframes, duration, read) }
    }
    if (TRACK_SWITCHES.includes(key)) {
      return { key, target: 'settings' as const, color: false, toggle: true, ...readKeyframes(`tracks.${key}`, keyframes, duration, value => asBoolean(`tracks.${key}`, value) ? 1 : 0) }
    }
    if (key === 'backgroundR' || key === 'backgroundG' || key === 'backgroundB') {
      return { key, target: 'settings' as const, color: false, toggle: false, ...readKeyframes(`tracks.${key}`, keyframes, duration, value => inRange(`tracks.${key}`, value, 0, 255, notes)) }
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
      ...readKeyframes(`tracks.${key}`, keyframes, duration, value => parseIntroValue(key as IntroParamKey, value))
    }
  }
  return Object.entries(source).flatMap(([key, keyframes]) => attempt<FilmTrack[]>(() => [readTrack(key, keyframes)], []))
}

// The scene's layers switched along the film: true shows the layer from that second on
function readLayers (source: unknown, duration: number, attempt: Attempt): FilmTrack[] {
  if (source === undefined) return []
  if (!isObject(source)) fail('layers take an object: { layer: [[seconds, true or false], ...] }')
  return Object.entries(source).flatMap(([key, keyframes]) => attempt<FilmTrack[]>(() => {
    if (!(INTRO_LAYERS as readonly string[]).includes(key)) unknownKey(key, INTRO_LAYERS)
    return [{ key, target: 'layers' as const, color: false, toggle: true, ...readKeyframes(`layers.${key}`, keyframes, duration, value => asBoolean(`layers.${key}`, value) ? 1 : 0) }]
  }, []))
}

// A value of the film itself: one number for the whole film, or keyframes. A film that keeps it at `rest`
// throughout has no track. Speed is how fast the scene's time runs, fade the dark over the picture
function readPace (key: 'speed' | 'fade', source: unknown, duration: number, max: number, rest: number, notes: string[]): FilmTrack | null {
  if (source === undefined) return null
  const read = (value: unknown) => inRange(key, value, 0, max, notes)
  const keys = typeof source === 'number' ? { times: [0], values: [read(source)], eases: ['ease' as Ease] } : readKeyframes(key, source, duration, read)
  if (keys.values.every(value => value === rest)) return null
  return { key, target: key, color: false, toggle: false, ...keys }
}

function readShots (source: unknown, duration: number, attempt: Attempt): FilmShot[] {
  if (source === undefined) return []
  if (!Array.isArray(source)) fail('shots take an array: [{ name, from, to }]')
  return source.flatMap((entry, index) => attempt<FilmShot[]>(() => {
    const where = `shots[${index}]`
    if (!isObject(entry)) fail(`${where} is not an object`)
    takeKnown(entry, ['name', 'from', 'to'], `${where}.`, attempt)
    if (typeof entry.name !== 'string' || entry.name.trim() === '') fail(`${where}.name takes what the shot is called`)
    const from = clamp(asNumber(`${where}.from`, entry.from ?? 0), 0, duration)
    const to = clamp(asNumber(`${where}.to`, entry.to ?? duration), 0, duration)
    if (to <= from) fail(`${where}: to (${to}) must be later than from (${from})`)
    return [{ name: entry.name.trim(), from, to }]
  }, [])).sort((a, b) => a.from - b.from)
}

function readCues (source: unknown, duration: number, title: TitleText, notes: string[], attempt: Attempt): FilmCue[] {
  if (source === undefined) return []
  if (!Array.isArray(source)) fail('cues take an array: [{ at: seconds, play: [layers] }]')
  return source.flatMap((entry, index) => attempt<FilmCue[]>(() => {
    const where = `cues[${index}]`
    if (!isObject(entry)) fail(`${where} is not an object`)
    takeKnown(entry, CUE_KEYS, `${where}.`, attempt)
    // Words of its own make a cue a title, whether it says so or not
    const worded = entry.title !== undefined || entry.font !== undefined || entry.uppercase !== undefined
    const named = Array.isArray(entry.play) ? [...entry.play] : entry.play === undefined ? [] : [entry.play]
    if (worded && !named.includes('title')) named.push('title')
    if (named.length === 0) fail(`${where}.play takes the events to fire: ${CUE_LAYERS.join(', ')}`)
    const layers = named.map(name => {
      const layer = String(name)
      if ((CUE_LAYERS as readonly string[]).includes(layer)) return layer as CueLayer
      if ((INTRO_LAYERS as readonly string[]).includes(layer)) fail(`${where}.play: ${layer} is a state, not an event; switch it in layers. Events: ${CUE_LAYERS.join(', ')}`)
      return unknownKey(layer, CUE_LAYERS)
    })
    const params: Record<string, number> = {}
    if (entry.params !== undefined) {
      if (!isObject(entry.params)) fail(`${where}.params takes an object of intro parameters`)
      for (const [key, value] of Object.entries(entry.params)) {
        attempt(() => {
          if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, INTRO_KEYS)
          params[key] = parseIntroValue(key as IntroParamKey, value)
        }, undefined)
      }
    }
    let words: TitleText | null = null
    if (worded) {
      if (entry.title === false) fail(`${where}.title takes the words of the title`)
      words = readTitle(entry, title, `${where}.`)
      words.font = faceFor(words.text, words.font, `${where}.title`, notes)
    }
    return [{ at: clamp(asNumber(`${where}.at`, entry.at ?? 0), 0, duration), layers, params: params as Partial<IntroParams>, title: words }]
  }, [])).sort((a, b) => a.at - b.at)
}

function readCaptions (source: unknown, duration: number, notes: string[], attempt: Attempt): FilmCaption[] {
  if (source === undefined) return []
  if (!Array.isArray(source)) fail('captions take an array: [{ text, from, to, at }]')
  return source.flatMap((entry, index) => attempt<FilmCaption[]>(() => {
    const where = `captions[${index}]`
    if (!isObject(entry)) fail(`${where} is not an object`)
    takeKnown(entry, CAPTION_KEYS, `${where}.`, attempt)
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
    if (!(CAPTION_FONTS as readonly string[]).includes(font)) fail(`${where}.font takes one of: ${CAPTION_FONTS.join(', ')}`)
    const colorOf = (key: string, value: unknown, fallback: string) => {
      const color = value === undefined ? fallback : String(value)
      if (!/^#[0-9a-f]{6}$/i.test(color)) fail(`${where}.${key} takes '#rrggbb'`)
      return color
    }
    const oneOf = <Choice extends string>(key: string, value: unknown, choices: readonly Choice[]): Choice | null => {
      if (value === undefined) return null
      if (!(choices as readonly string[]).includes(String(value))) fail(`${where}.${key} takes one of: ${choices.join(', ')}`)
      return value as Choice
    }

    const lines = parseCaption(entry.text, `${where}.text`)
    const values: Record<string, FilmTrack> = {}
    if (entry.values !== undefined) {
      if (!isObject(entry.values)) fail(`${where}.values takes an object of keyframes: { years: [[2, 0], [8, 13.8]] }`)
      for (const [key, keyframes] of Object.entries(entry.values)) {
        values[key] = { key, target: 'caption', color: false, toggle: false, ...readKeyframes(`${where}.values.${key}`, keyframes, duration, value => asNumber(`${where}.values.${key}`, value)) }
      }
    }
    // A number in the text is one of the caption's own, the film's second, or a number of the scene
    for (const key of captionKeys(lines)) {
      const known = key in values || key === 'seconds' || key in SLIDERS || BACKGROUND_KEYS.includes(key) ||
        (key in DEFAULT_INTRO_PARAMS && !INTRO_PARAM_SPECS[key as IntroParamKey].options && !INTRO_PARAM_SPECS[key as IntroParamKey].color)
      if (!known) unknownKey(`${where}.text #{${key}}`, [...Object.keys(values), 'seconds', ...Object.keys(SLIDERS), ...INTRO_KEYS])
    }
    const reveal = oneOf('reveal', entry.reveal, CAPTION_REVEALS)
    return [{
      text: entry.text,
      lines,
      from,
      to,
      at,
      angle: entry.angle === undefined ? 35 : asNumber(`${where}.angle`, entry.angle),
      size: clamp(entry.size === undefined ? (pointing ? 0.03 : 0.04) : asNumber(`${where}.size`, entry.size), 0.01, 0.2),
      color: colorOf('color', entry.color, '#ffffff'),
      font: faceFor(captionLetters(lines), font as CaptionFont, where, notes, true),
      fade: clamp(entry.fade === undefined ? CAPTION_FADE : asNumber(`${where}.fade`, entry.fade), 0, (to - from) / 2),
      accent: colorOf('accent', entry.accent, CAPTION_ACCENT),
      align: oneOf('align', entry.align, CAPTION_ALIGNS),
      width: clamp(entry.width === undefined ? 1 : asNumber(`${where}.width`, entry.width), 0.1, 1),
      plate: clamp(entry.plate === undefined ? 0 : asNumber(`${where}.plate`, entry.plate), 0, 1),
      reveal,
      // Left out, the words take the first half of the caption's life to arrive, two seconds at most
      revealOver: clamp(entry.revealOver === undefined ? Math.min(2, (to - from) / 2) : asNumber(`${where}.revealOver`, entry.revealOver), 0.05, to - from),
      values,
      radius: entry.radius === undefined ? null : clamp(asNumber(`${where}.radius`, entry.radius), 0, 40)
    }]
  }, []))
}

// The parameters of the film look, which lifts as the intro ends unless filmHold keeps it
const FILM_LOOK = ['lensFringe', 'vignette', 'filmGrain', 'letterbox'] as const

// Checks a film and turns it into the plan the renderer plays. Everything it cannot read is told in one
// error, each thing with its reason, so a film is put right in one go
export function planFilm (source: unknown): FilmPlan {
  if (!isObject(source)) fail('A film is an object: { duration, fps, size, settings, intro, tracks, captions }. See film.guide()')
  const problems: string[] = []
  const attempt: Attempt = (work, fallback) => {
    try {
      return work()
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
      return fallback
    }
  }
  takeKnown(source, FILM_KEYS, '', attempt)
  const notes: string[] = []

  const duration = attempt(() => inRange('duration', source.duration ?? 10, MIN_DURATION, MAX_DURATION, notes), 10)
  const fps = attempt(() => Math.round(inRange('fps', source.fps ?? 30, MIN_FPS, MAX_FPS, notes)), 30)
  const { width, height, scale } = attempt(() => readFrame(source, notes), { width: 1920, height: 1080, scale: 1 })
  const seed = attempt(() => source.seed === undefined ? 1 : Math.round(asNumber('seed', source.seed)), 1)

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
    if (!isObject(intro)) {
      attempt(() => fail('intro takes false (leave it out) or an object: { at, preset, params, title, hide }'), undefined)
    } else {
      takeKnown(intro, INTRO_FILM_KEYS, 'intro.', attempt)
      attempt(() => {
        if (intro.preset === undefined) return
        const preset = findPreset([...BUILT_IN_INTRO_PRESETS, ...useIntroPresetStore.getState().presets], String(intro.preset))
        params = { ...preset.params }
        // A look that sets only the face keeps the words
        title = preset.keepsText ? { ...preset.title, text: title.text } : { ...preset.title }
        for (const layer of preset.hidden) hidden[layer] = true
        if (preset.scene) settings = pickSimulationSettings(preset.scene)
      }, undefined)
      if (intro.params !== undefined) {
        if (!isObject(intro.params)) {
          attempt(() => fail('intro.params takes an object of intro parameters'), undefined)
        } else {
          for (const [key, value] of Object.entries(intro.params)) {
            attempt(() => {
              if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, INTRO_KEYS)
              params[key as IntroParamKey] = parseIntroValue(key as IntroParamKey, value)
            }, undefined)
          }
        }
      }
      title = attempt(() => readTitle(intro, title), title)
      if (intro.title === false) hidden.title = true
      if (intro.hide !== undefined) {
        const hide = intro.hide
        if (!Array.isArray(hide)) {
          attempt(() => fail(`intro.hide takes an array of layers: ${INTRO_LAYERS.join(', ')}`), undefined)
        } else {
          for (const layer of hide) {
            attempt(() => {
              if (!(INTRO_LAYERS as readonly string[]).includes(String(layer))) unknownKey(String(layer), INTRO_LAYERS)
              hidden[layer as IntroLayer] = true
            }, undefined)
          }
        }
      }
      if (intro.at !== undefined) introAt = attempt(() => inRange('intro.at', intro.at, -params.introEnd, duration, notes), 0)
    }
  }
  title.font = faceFor(title.text, title.font, 'intro.title', notes)

  attempt(() => {
    if (source.preset === undefined) return
    const preset = findPreset([...BUILT_IN_PRESETS, ...usePresetStore.getState().presets], String(source.preset))
    settings = pickSimulationSettings(preset.settings)
  }, undefined)
  attempt(() => {
    if (source.settings === undefined) return
    const { next, clamped } = parseSettings(source.settings, SETTING_KEYS)
    Object.assign(settings, next)
    for (const [key, value] of Object.entries(clamped)) notes.push(`settings.${key} was moved onto its slider: ${String(value)}`)
  }, undefined)
  // A film has no cursor to follow: the black hole rests at blackHoleX, blackHoleY, which tracks can move
  settings.blackHoleFollowing = false

  const warmup = introAt === null
    ? attempt(() => inRange('warmup', source.warmup ?? DEFAULT_WARMUP, 0, MAX_WARMUP, notes), DEFAULT_WARMUP)
    : 0

  const frames = Math.max(1, Math.round(duration * fps))
  const speed = attempt(() => readPace('speed', source.speed, duration, MAX_SPEED, 1, notes), null)
  const fade = attempt(() => readPace('fade', source.fade, duration, 1, 0, notes), null)
  const shots = attempt(() => readShots(source.shots, duration, attempt), [])
  // The intro runs on the scene's clock, which a speed track bends: "at" stays a second of the film
  let introTime = 0
  let introEnds: number | null = null
  if (introAt !== null) {
    introTime = speed && introAt > 0 ? -sceneSeconds(speed, fps, Math.round(introAt * fps)) : -introAt
    introEnds = Infinity
    let clock = introTime
    for (let frame = 0; frame <= frames; frame++) {
      if (frame > 0) clock += (speed ? trackValue(speed, frame / fps) : 1) / fps
      if (clock >= params.introEnd) {
        introEnds = frame / fps
        break
      }
    }
  }

  const cues = attempt(() => readCues(source.cues, duration, title, notes, attempt), [])
  for (const cue of cues) {
    if (introEnds !== null && cue.at < introEnds) {
      const ends = introEnds
      attempt(() => fail(`cues: ${cue.layers.join(', ')} at ${seconds(cue.at)} s falls inside the opening, which ${ends === Infinity ? 'outlasts the film' : `is over at ${seconds(ends)} s`}; ` +
        'an event is fired again only after it, or in a film with "intro": false'), undefined)
    }
  }
  const tracks = [
    ...attempt(() => readTracks(source.tracks, duration, notes, attempt), []),
    ...attempt(() => readLayers(source.layers, duration, attempt), [])
  ]
  const captions = attempt(() => readCaptions(source.captions, duration, notes, attempt), [])

  if (problems.length === 1) fail(problems[0])
  if (problems.length > 1) fail(`${problems.length} things in this film cannot be read:\n${problems.map((problem, index) => `${index + 1}. ${problem}`).join('\n')}`)

  // The film look shows only while the intro runs unless filmHold keeps it; a film that sets it and never
  // holds it is told, since nothing else would show that the frame stayed as it was
  const raised = (key: string) => (params as unknown as Record<string, number>)[key] > 0 ||
    tracks.some(track => track.key === key && track.values.some(value => value > 0)) ||
    cues.some(cue => ((cue.params as Record<string, number>)[key] ?? 0) > 0)
  const look = FILM_LOOK.filter(raised)
  if (look.length > 0 && !raised('filmHold') && (introEnds === null || introEnds < duration)) {
    notes.push(`${look.join(', ')}: the film look lifts as the opening ends, so ${introEnds === null ? 'this film without the opening never shows it' : `it is gone after ${seconds(introEnds)} s`}; ` +
      'raise filmHold (0 to 1, in intro.params or on a track) to keep it')
  }

  const plan: FilmPlan = {
    duration,
    fps,
    frames,
    width,
    height,
    scale,
    seed,
    introAt,
    introTime,
    introEnds,
    warmup,
    speed,
    fade,
    shots,
    settings,
    params,
    hidden,
    title,
    tracks,
    cues,
    captions,
    timeline: [],
    notes
  }
  plan.timeline = describeTimeline(plan)
  return plan
}

const seconds = (value: number) => String(+value.toFixed(2))

// Scene seconds that have passed once this many frames are drawn, as the renderer counts them
function sceneSeconds (speed: FilmTrack | null, fps: number, frames: number) {
  if (!speed) return frames / fps
  let passed = 0
  for (let frame = 1; frame <= frames; frame++) passed += trackValue(speed, frame / fps) / fps
  return passed
}

// How fast the scene's time runs at this second of the film, and how dark the picture is
export const filmSpeed = (plan: FilmPlan, time: number) => plan.speed ? trackValue(plan.speed, time) : 1
export const filmFade = (plan: FilmPlan, time: number) => plan.fade ? trackValue(plan.fade, time) : 0

// Keys above which a track is taken for a path drawn by a function, not written by hand
const LONG_TRACK = 24

function trackWords (track: FilmTrack) {
  const word = (value: number) => track.toggle
    ? (track.target === 'layers' ? (value === 1 ? 'on' : 'off') : String(value === 1))
    : track.color ? '#' + value.toString(16).padStart(6, '0') : seconds(value)
  // A path drawn by a function is hundreds of keys: its ends and how far it goes say more than its first six
  const drawn = track.values.length > LONG_TRACK && !track.toggle && !track.color
  const shown = drawn
    ? `${word(track.values[0])} > ... > ${word(track.values[track.values.length - 1])} (${track.values.length} keys between ${word(Math.min(...track.values))} and ${word(Math.max(...track.values))})`
    : track.values.slice(0, 6).map(word).join(' > ') + (track.values.length > 6 ? ' > ...' : '')
  return `${track.target === 'layers' ? 'layer ' : ''}${track.key}: ${shown}`
}

// The film in the order things happen, one line each, for whoever wrote it to check against what was meant
function describeTimeline (plan: FilmPlan) {
  const entries: { at: number, text: string }[] = []
  const span = (from: number, to: number) => from === to ? `${seconds(from)} s` : `${seconds(from)}-${seconds(to)} s`
  if (plan.introAt === null) {
    entries.push({ at: 0, text: `${span(0, 0)}  the scene is already running: no opening, ${seconds(plan.warmup)} s of warm-up before the first frame` })
  } else {
    const start = Math.max(plan.introAt, 0)
    const inside = plan.introAt < 0 ? `, ${seconds(-plan.introAt)} s into it` : ''
    entries.push({ at: start, text: `${span(start, start)}  the opening starts${inside}` })
    if (plan.introEnds === Infinity) entries.push({ at: plan.duration, text: `${span(plan.duration, plan.duration)}  the opening is still running when the film ends` })
    else if (plan.introEnds !== null) entries.push({ at: plan.introEnds, text: `${span(plan.introEnds, plan.introEnds)}  the opening is over` })
  }
  for (const shot of plan.shots) entries.push({ at: shot.from, text: `${span(shot.from, shot.to)}  shot "${shot.name}"` })
  const few = (values: number[], unit: string) => values.length > LONG_TRACK
    ? `${seconds(values[0])}${unit} > ... > ${seconds(values[values.length - 1])}${unit} (${values.length} keys between ${seconds(Math.min(...values))}${unit} and ${seconds(Math.max(...values))}${unit})`
    : values.slice(0, 6).map(value => seconds(value) + unit).join(' > ') + (values.length > 6 ? ' > ...' : '')
  if (plan.speed) {
    const { times, values } = plan.speed
    entries.push({ at: times[0], text: `${span(times[0], times[times.length - 1])}  time runs at ${few(values, 'x')}` })
  }
  if (plan.fade) {
    const { times, values } = plan.fade
    entries.push({ at: times[0], text: `${span(times[0], times[times.length - 1])}  the picture is dark by ${few(values, '')}` })
  }
  for (const track of plan.tracks) {
    const { times } = track
    entries.push({ at: times[0], text: `${span(times[0], times[times.length - 1])}  ${trackWords(track)}` })
  }
  for (const cue of plan.cues) {
    const set = Object.keys(cue.params)
    const words = cue.title ? ` "${cue.title.text.replace(/\s+/g, ' ')}"` : ''
    entries.push({ at: cue.at, text: `${span(cue.at, cue.at)}  fires ${cue.layers.join(', ')}${words}${set.length > 0 ? ` with ${set.join(', ')}` : ''}` })
  }
  for (const caption of plan.captions) {
    const words = caption.text.replace(/\s+/g, ' ')
    entries.push({ at: caption.from, text: `${span(caption.from, caption.to)}  caption "${words.length > 40 ? words.slice(0, 40) + '...' : words}"` })
  }
  return entries.sort((a, b) => a.at - b.at).map(entry => entry.text)
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

export function trackValue (track: FilmTrack, time: number) {
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

// Writes every track's value at this second of the film into the plan's settings, intro parameters and layers
export function applyTracks (plan: FilmPlan, time: number) {
  const settings = plan.settings as unknown as Record<string, number | boolean>
  const params = plan.params as unknown as Record<string, number>
  const hidden = plan.hidden as Record<string, boolean>
  for (const track of plan.tracks) {
    const value = trackValue(track, time)
    if (track.target === 'layers') hidden[track.key] = value !== 1
    else if (track.toggle) settings[track.key] = value === 1
    else if (track.target === 'settings') settings[track.key] = value
    else params[track.key] = value
  }
}

// The number a caption's #{key} shows at this second: its own, the film's second, or the scene's as the tracks left it
export function captionValue (plan: FilmPlan, caption: FilmCaption, key: string, time: number): number {
  const own = caption.values[key]
  if (own) return trackValue(own, time)
  if (key === 'seconds') return time
  const setting = (plan.settings as unknown as Record<string, unknown>)[key]
  return typeof setting === 'number' ? setting : (plan.params as unknown as Record<string, number>)[key]
}

// How visible a caption is at this second: 0 before and after it, 1 between its fades
export function captionAlpha (caption: FilmCaption, time: number) {
  if (time < caption.from || time > caption.to) return 0
  if (caption.fade <= 0) return 1
  return clamp(Math.min(time - caption.from, caption.to - time) / caption.fade, 0, 1)
}

export const FILM_GUIDE = `A film is one JSON object; the scene renders it to an mp4, the same video for the same film.
It is a timeline. Values move along keyframes (tracks), layers of the scene switch on and off (layers), the
opening is a clip (intro), its events can be fired again (cues), and the scene's own time can slow or stop
(speed). check and preview answer with the timeline they understood, one line for each thing that happens.
A film with more than a few things on its timeline is easier written as a script that plays it forward and
comes to this same object: see "A film as a script" below. Names and ranges are the same in both.

{
  "duration": 12,            seconds, ${MIN_DURATION}-${MAX_DURATION}
  "fps": 30,                 ${MIN_FPS}-${MAX_FPS}; above 60 for a fast display or slow motion, and the file grows with it
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
  "speed": [[0, 1], [9, 1], [10, 0.1], [14, 0.1], [15, 1]],
                             how fast the scene's time runs, as keyframes or one number: 1 is real time, 0.1
                             slow motion, 0 a still frame, up to ${MAX_SPEED}. Every second written in a film
                             stays a second of the film; a still frame is one picture, which a zoom magnifies
  "fade": [[0, 1], [1.5, 0], [10.5, 0], [12, 1]],
                             how dark the picture is, 0 to 1, as keyframes or one number: a fade in from
                             black and out to it. Captions stay above it, so words can stand on black
  "shots": [{ "name": "approach", "from": 0, "to": 6 }],
                             names for stretches of the film. They change no frame; a preview with no
                             seconds asked for shows one frame from the middle of each: a storyboard
  "layers": { "gravity": [[0, true], [5, false], [9, true]] },
                             a layer of the scene switched at its seconds, true shows it: ${INTRO_LAYERS.join(' | ')}.
                             "hide" in intro hides one for the whole film
  "cues": [{ "at": 18, "play": ["ringdown", "gravityWave"], "params": { "gravityWaveGain": 2 } }],
                             events of the opening fired again at the black hole, once the opening is over:
                             ${CUE_LAYERS.join(' | ')}.
                             Several in one cue keep the opening's own order (the star brightens, then the
                             blast, then the ringing); one blast and one ringing at a time, a new one takes
                             over. Their look is the intro parameters: "params" sets some at that second,
                             and tracks can move them. A title is an event too, with words of its own:
                             { "at": 20, "title": "ACT TWO", "params": { "titleEntrance": "Fades in" } };
                             it lives from titleInAt (the default entrance: from collapseAt, lit by the light
                             front, so fire "light" with it) to dissolveAt + dissolveDuration
  "captions": [{ "text": "Event horizon", "from": 2, "to": 6, "at": "hole" }]
                             at: bottom (default) | top | center | [x, y] shares of the frame | hole | einstein |
                             companion; the last three point a line at the shadow's edge, the Einstein ring
                             or the second black hole, from "angle" degrees (0 right, 90 up); "radius" starts
                             the line that many black hole radii out instead, the unit of orbitSize and
                             lensingRadius (the shadow's edge is 1, which is 2.6 Schwarzschild radii).
                             Marks in the text: r_{s} is lowered, c^{2} raised, *{a term} drawn in the
                             "accent" colour, and #{cameraZoom:1} is the scene's own number as it stands at
                             that second, with one digit after the point (#{key:1,} writes a comma,
                             #{seconds:0} is the film's second) or a number of the caption's own from
                             "values": { "years": [[2, 0], [8, 13.8, "linear"]] }. Greek, mathematics and
                             the signs of the sky (λ Δ ∞ ≈ √ → ☉ ⊕ ♃) are the same on every machine.
                             "reveal": ${CAPTION_REVEALS.join(' | ')} brings the words in one at a time over
                             "revealOver" seconds. "align": ${CAPTION_ALIGNS.join(' | ')}; "width", the share of
                             the frame a line may take; "plate", 0-1, a dark plate behind the words; size,
                             color and accent '#rrggbb', fade; font: ${CAPTION_FONTS.join(' | ')}
                             (noto is a plain text face, for sentences and formulas). A line too long is
                             broken at its spaces; Cyrillic in a display face without it goes to unbounded
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
  Slow motion at a moment: "speed": [[0, 1], [4, 1], [5, 0.15], [8, 0.15], [9, 1]]
  The flight alone slowed: "tracks": { "baseSpeed": [[0, 6], [4, 6], [5, 0.5], [8, 0.5], [9, 6]] }
  A wave from the hole:    "intro": false, "settings": { "gridSheet": 0.5 },
                           "cues": [{ "at": 4, "play": ["ringdown", "gravityWave"] }]
  A second explosion:      "cues": [{ "at": 14, "play": ["star", "glare", "light", "echo", "shockwave", "camera"] }]
  Gravity cut off and back: "layers": { "gravity": [[0, true], [5, false], [9, true]] }
  Letterbox for a whole film: "tracks": { "letterbox": [[0, 0.12]], "filmHold": [[0, 1]] }
  The camera pulls back:   "tracks": { "cameraZoom": [[0, 1], [6, 0.5]] }
  A chapter title:         "cues": [{ "at": 12, "title": "ACT TWO",
                             "params": { "titleEntrance": "Fades in", "titleExit": "Fades out", "titleInAt": 0, "dissolveAt": 3 } }]
  In from black and out:   "fade": [[0, 1], [1.5, 0], [10.5, 0], [12, 1]]
  Words on black:          "fade": [[0, 1], [3, 1], [4.5, 0]], "captions": [{ "text": "Sagittarius A*", "from": 0.5, "to": 3.5, "at": "center" }]
  A formula beside the hole: "captions": [{ "text": "Schwarzschild radius\\nr_{s} = 2GM / c^{2}", "from": 2, "to": 8,
                             "at": [0.75, 0.3], "font": "noto", "size": 0.05, "align": "left" }]
  A counter:               "captions": [{ "text": "*{#{years:1}} billion years", "from": 2, "to": 10, "at": "top",
                             "values": { "years": [[2, 0], [10, 13.8, "linear"]] } }]
  A readout of the scene:  "captions": [{ "text": "Zoom #{cameraZoom:1}×", "from": 0, "to": 8, "at": "top" }]
  A list that builds:      "captions": [{ "text": "1. Shadow\\n2. Photon ring\\n3. Einstein ring", "from": 1, "to": 9,
                             "at": [0.2, 0.3], "align": "left", "reveal": "lines", "revealOver": 4 }]
  A label on an orbit:     "settings": { "orbitCount": 8, "orbitSize": 4 },
                           "captions": [{ "text": "Orbits at 4 radii of the shadow", "from": 2, "to": 8, "at": "hole", "radius": 4 }]
  Vertical short:          "size": "vertical", "settings": { "blackHoleY": 0.42 }

Check with preview (a contact sheet of frames) before render; both take the same film.`
