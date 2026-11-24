// The scene for AI agents (and the console): window.space describes, reads and changes every simulation
// setting and every intro parameter and drives the intro's timeline. It wraps the stores the animation loop
// already reads, so it adds nothing to the frame; the UI and saved settings follow every change by
// themselves. Values are checked against the same registries the panels are built from.
//
// Loaded in development, and on any build with ?agent in the address. An agent reaches it through a browser
// tool that evaluates scripts in the page (the chrome-devtools MCP server in .mcp.json), and takes
// screenshots with that tool.
import { useParticleStore, type ParticleColor, type ParticleState } from '../store/particle_store'
import { DEFAULT_PRESET, usePresetStore } from '../store/preset_store'
import { useIntroDebugStore, DEFAULT_TITLE_TEXT, type TitleText } from '../store/intro_debug_store'
import { BUILT_IN_INTRO_PRESETS, useIntroPresetStore } from '../store/intro_preset_store'
import { SIMULATION_SETTING_KEYS } from './simulation_presets'
import { SIMULATION_SETTING_SPECS } from './simulation_specs'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, colorToCss, cssToColor, type IntroParamKey } from './intro_params'
import { INTRO_LAYERS, type IntroLayer } from './intro_tracks'
import { TITLE_FONTS, type TitleFontKey } from './title_sprite'

type Patch = Record<string, unknown>

const SLIDERS = SIMULATION_SETTING_SPECS as Record<string, { label: string, min: number, max: number, step: number, description: string }>
const TOGGLES: Record<string, string> = {
  blackHoleFollowing: 'The black hole follows the cursor; false anchors it at blackHoleX, blackHoleY.',
  ringEnabled: 'Photon ring around the shadow.',
  ringFeedEnabled: 'Matter falling in or skimming past brightens the photon ring.',
  lensingEnabled: 'Gravitational lensing around the black hole.',
  adaptiveParticles: 'Particle budget: trims the particle count when the processor falls behind (per device, not in presets).'
}
const SETTING_KEYS: readonly string[] = SIMULATION_SETTING_KEYS
const EXTRA_KEYS = ['frameRateCap', 'adaptiveParticles']
const ALL_SETTING_KEYS = [...SETTING_KEYS, ...EXTRA_KEYS]
const INTRO_KEYS = Object.keys(DEFAULT_INTRO_PARAMS) as IntroParamKey[]

const HELP = `window.space: the scene for agents. Every call returns plain JSON-safe data; errors are thrown with a reason.
  describe(filter?)        simulation settings: key, label, value, default, range, description
  get(keys?) / set(patch) / reset(keys?)    read, change (one batch, values clamped to range), back to defaults
  pause() / play()         freeze or run the whole scene
  preset.list() / preset.apply(name)        saved simulation presets
  intro.describe(filter?) / intro.get(keys?) / intro.set(patch) / intro.reset(keys?)
  intro.seek(seconds) / intro.play() / intro.pause() / intro.step() / intro.restart() / intro.speed(x) / intro.loop(on)
                           a paused timeline freezes the particle field: after a seek it moves only the lens, flash
                           and title, so play (or step) before a screenshot of the particles at the new moment
  intro.layers({ hide?: [], show?: [], only?: layer }) / intro.title(patch?) / intro.preset.list() / intro.preset.apply(name)
  debug(open?)             open or close the intro debugger; the intro readout is live only while it is open
  readout()                fps, particles, pause state, intro time and phase
  frames(n)                wait for n drawn frames, e.g. after a change and before a screenshot
Colours take '#rrggbb'; choices take an option index or its name.`

function fail (message: string): never {
  throw new Error(message)
}

function editDistance (a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

// An unknown key names the closest known ones, so a typo is fixed in one round trip
function unknownKey (key: string, known: readonly string[]): never {
  const lower = key.toLowerCase()
  const close = known
    .map(name => ({ name, score: name.toLowerCase().includes(lower) ? 0 : editDistance(lower, name.toLowerCase()) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map(entry => entry.name)
  fail(`Unknown key "${key}". Closest: ${close.join(', ')}`)
}

function asNumber (key: string, value: unknown) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) fail(`${key} takes a number, got ${JSON.stringify(value)}`)
  return number
}

function asBoolean (key: string, value: unknown) {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fail(`${key} takes true or false, got ${JSON.stringify(value)}`)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// The nearest value a slider can show: inside its range and on its step, without float noise
function onSliderGrid (value: number, min: number, max: number, step: number) {
  const snapped = min + Math.round((clamp(value, min, max) - min) / step) * step
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return clamp(Number(snapped.toFixed(decimals)), min, max)
}

function asChannel (key: string, value: unknown) {
  return Math.round(clamp(asNumber(key, value), 0, 255))
}

function asPalette (value: unknown): ParticleColor[] {
  if (!Array.isArray(value) || value.length === 0) fail('colorPalette takes a non-empty array of { r, g, b, enabled, percent }')
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) fail(`colorPalette[${index}] is not an object`)
    const color = entry as Record<string, unknown>
    return {
      r: asChannel(`colorPalette[${index}].r`, color.r),
      g: asChannel(`colorPalette[${index}].g`, color.g),
      b: asChannel(`colorPalette[${index}].b`, color.b),
      enabled: color.enabled === undefined ? true : asBoolean(`colorPalette[${index}].enabled`, color.enabled),
      percent: clamp(asNumber(`colorPalette[${index}].percent`, color.percent ?? 20), 0, 100)
    }
  })
}

function pickKeys (keys: string | string[] | undefined, known: readonly string[]) {
  if (keys === undefined) return known
  const list = Array.isArray(keys) ? keys : [keys]
  for (const key of list) if (!known.includes(key)) unknownKey(key, known)
  return list
}

const matches = (filter: string | undefined, ...texts: string[]) =>
  filter === undefined || texts.some(text => text.toLowerCase().includes(filter.toLowerCase()))

// Simulation settings

function describeSettings (filter?: string) {
  const state = useParticleStore.getState() as unknown as Record<string, unknown>
  const defaults = DEFAULT_PRESET.settings as unknown as Record<string, unknown>
  const sliders = Object.entries(SLIDERS)
    .filter(([key, spec]) => matches(filter, key, spec.label, spec.description))
    .map(([key, spec]) => ({ key, label: spec.label, value: state[key], default: defaults[key], min: spec.min, max: spec.max, step: spec.step, description: spec.description }))
  const toggles = Object.entries(TOGGLES)
    .filter(([key, description]) => matches(filter, key, description))
    .map(([key, description]) => ({ key, value: state[key], default: defaults[key] ?? true, description }))
  const other = [
    { key: 'colorPalette', value: state.colorPalette, description: 'Star colours: array of { r, g, b (0-255), enabled, percent }.' },
    { key: 'backgroundR', value: state.backgroundR, description: 'Background red, 0-255 (also backgroundG, backgroundB).' },
    { key: 'frameRateCap', value: state.frameRateCap, description: 'Frame rate limit in FPS, 30-240; 0 is no limit (per device, not in presets).' }
  ].filter(entry => matches(filter, entry.key, entry.description))
  return { sliders, toggles, other }
}

function getSettings (keys?: string | string[]) {
  const state = useParticleStore.getState() as unknown as Record<string, unknown>
  return Object.fromEntries(pickKeys(keys, ALL_SETTING_KEYS).map(key => [key, state[key]]))
}

// Checks every value first and applies them all in one store update, so the scene and the panel see one change
function setSettings (patch: Patch) {
  if (typeof patch !== 'object' || patch === null) fail('set takes an object of settings')
  const next: Partial<ParticleState> & Patch = {}
  const clamped: Patch = {}
  for (const [key, value] of Object.entries(patch)) {
    const slider = SLIDERS[key]
    if (slider) {
      const number = asNumber(key, value)
      next[key] = onSliderGrid(number, slider.min, slider.max, slider.step)
      if (next[key] !== number) clamped[key] = next[key]
    } else if (key in TOGGLES) {
      next[key] = asBoolean(key, value)
    } else if (key === 'colorPalette') {
      next.colorPalette = asPalette(value)
    } else if (key === 'backgroundR' || key === 'backgroundG' || key === 'backgroundB') {
      next[key] = asChannel(key, value)
    } else if (key === 'frameRateCap') {
      const fps = Math.round(asNumber(key, value))
      next.frameRateCap = fps <= 0 ? 0 : clamp(fps, 30, 240)
    } else {
      unknownKey(key, ALL_SETTING_KEYS)
    }
  }
  // Placing the black hole anchors it, as the Position sliders do
  if (('blackHoleX' in next || 'blackHoleY' in next) && !('blackHoleFollowing' in next)) next.blackHoleFollowing = false
  useParticleStore.setState(next)
  return { applied: Object.keys(next), clamped }
}

function resetSettings (keys?: string | string[]) {
  const defaults = DEFAULT_PRESET.settings as unknown as Patch
  const list = pickKeys(keys, SETTING_KEYS)
  const patch = Object.fromEntries(list.map(key => [key, key === 'colorPalette'
    ? (defaults.colorPalette as ParticleColor[]).map(color => ({ ...color }))
    : defaults[key]]))
  useParticleStore.setState(patch as Partial<ParticleState>)
  return { reset: list }
}

function findPreset<T extends { id: string, name: string }> (list: readonly T[], name: string): T {
  const wanted = name.trim().toLowerCase()
  return list.find(preset => preset.id === name || preset.name.toLowerCase() === wanted) ??
    fail(`No preset "${name}". Presets: ${list.map(preset => preset.name).join(', ')}`)
}

// Intro parameters

function introValue (key: IntroParamKey, value: number) {
  const spec = INTRO_PARAM_SPECS[key]
  if (spec.color) return colorToCss(value)
  if (spec.options) return { index: Math.round(value), name: spec.options[Math.round(value)] }
  return value
}

function describeIntro (filter?: string) {
  const { params } = useIntroDebugStore.getState()
  return INTRO_KEYS
    .filter(key => matches(filter, key, INTRO_PARAM_SPECS[key].label, INTRO_PARAM_SPECS[key].description))
    .map(key => {
      const spec = INTRO_PARAM_SPECS[key]
      return {
        key,
        label: spec.label,
        value: introValue(key, params[key]),
        default: introValue(key, DEFAULT_INTRO_PARAMS[key]),
        ...(spec.color ? { type: 'colour' } : spec.options ? { options: spec.options } : { min: spec.min, max: spec.max, step: spec.step, unit: spec.unit }),
        description: spec.description
      }
    })
}

function parseIntroValue (key: IntroParamKey, value: unknown) {
  const spec = INTRO_PARAM_SPECS[key]
  if (spec.color) {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return cssToColor(value)
    return Math.round(clamp(asNumber(key, value), 0, 0xffffff))
  }
  if (spec.options) {
    const named = typeof value === 'string' ? spec.options.findIndex(option => option.toLowerCase() === value.toLowerCase()) : -1
    if (named >= 0) return named
    const index = Math.round(asNumber(key, value))
    if (index < 0 || index >= spec.options.length) fail(`${key} takes one of: ${spec.options.map((option, i) => `${i} "${option}"`).join(', ')}`)
    return index
  }
  return clamp(asNumber(key, value), spec.min, spec.max)
}

function setIntro (patch: Patch) {
  if (typeof patch !== 'object' || patch === null) fail('intro.set takes an object of parameters')
  const debug = useIntroDebugStore.getState()
  const params = { ...debug.params }
  const clamped: Patch = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_INTRO_PARAMS)) unknownKey(key, INTRO_KEYS)
    const paramKey = key as IntroParamKey
    params[paramKey] = parseIntroValue(paramKey, value)
    if (typeof value === 'number' && params[paramKey] !== value) clamped[key] = params[paramKey]
  }
  // One update for the whole patch, saved like a preset would be
  debug.applySetup(params, debug.title, INTRO_LAYERS.filter(layer => debug.hidden[layer]))
  return { applied: Object.keys(patch), clamped }
}

function setLayers (change?: { hide?: string[], show?: string[], only?: string }) {
  const debug = useIntroDebugStore.getState()
  if (change) {
    const known: readonly string[] = INTRO_LAYERS
    const check = (layer: string) => known.includes(layer) ? layer as IntroLayer : unknownKey(layer, known)
    const hidden = { ...debug.hidden }
    if (change.only !== undefined) {
      const only = check(change.only)
      for (const layer of INTRO_LAYERS) hidden[layer] = layer !== only
    }
    for (const layer of change.hide ?? []) hidden[check(layer)] = true
    for (const layer of change.show ?? []) hidden[check(layer)] = false
    debug.applySetup(debug.params, debug.title, INTRO_LAYERS.filter(layer => hidden[layer]))
  }
  const { hidden } = useIntroDebugStore.getState()
  return { layers: INTRO_LAYERS, hidden: INTRO_LAYERS.filter(layer => hidden[layer]) }
}

function setTitle (patch?: Partial<TitleText>) {
  const debug = useIntroDebugStore.getState()
  if (patch) {
    if (patch.font !== undefined && !(patch.font in TITLE_FONTS)) fail(`font takes one of: ${Object.keys(TITLE_FONTS).join(', ')}`)
    if (patch.text !== undefined && typeof patch.text !== 'string') fail('text takes a string; \\n starts a new line')
    const known: Partial<TitleText> = {}
    if (patch.text !== undefined) known.text = patch.text
    if (patch.font !== undefined) known.font = patch.font
    if (patch.uppercase !== undefined) known.uppercase = asBoolean('uppercase', patch.uppercase)
    const unknown = Object.keys(patch).filter(key => !(key in DEFAULT_TITLE_TEXT))
    if (unknown.length > 0) unknownKey(unknown[0], Object.keys(DEFAULT_TITLE_TEXT))
    debug.setTitle(known)
  }
  return { title: useIntroDebugStore.getState().title, default: DEFAULT_TITLE_TEXT, fonts: Object.keys(TITLE_FONTS) as TitleFontKey[] }
}

function waitFrames (count = 1, timeoutMs = 3000) {
  if (document.hidden) return Promise.reject(new Error('The tab is hidden, so no frames are drawn'))
  return new Promise<number>((resolve, reject) => {
    let left = Math.max(1, Math.round(count))
    const timer = setTimeout(() => reject(new Error('Frames stopped arriving: the tab was hidden')), timeoutMs + left * 100)
    const tick = () => {
      left -= 1
      if (left > 0) requestAnimationFrame(tick)
      else {
        clearTimeout(timer)
        resolve(count)
      }
    }
    requestAnimationFrame(tick)
  })
}

export const sceneApi = {
  version: 1,
  help: () => HELP,
  describe: describeSettings,
  get: getSettings,
  set: setSettings,
  reset: resetSettings,
  pause: () => {
    useParticleStore.setState({ isPaused: true })
    return { paused: true }
  },
  play: () => {
    useParticleStore.setState({ isPaused: false })
    return { paused: false }
  },
  preset: {
    list: () => {
      const { presets, activeId } = usePresetStore.getState()
      return { active: activeId, presets: [DEFAULT_PRESET, ...presets].map(({ id, name }) => ({ id, name })) }
    },
    apply: (name: string) => {
      const { presets, applyPreset } = usePresetStore.getState()
      const preset = findPreset([DEFAULT_PRESET, ...presets], name)
      applyPreset(preset.id)
      return { applied: preset.name }
    }
  },
  intro: {
    describe: describeIntro,
    get: (keys?: string | string[]) => {
      const { params } = useIntroDebugStore.getState()
      return Object.fromEntries(pickKeys(keys, INTRO_KEYS).map(key => [key, introValue(key as IntroParamKey, params[key as IntroParamKey])]))
    },
    set: setIntro,
    reset: (keys?: string | string[]) => {
      const list = pickKeys(keys, INTRO_KEYS) as IntroParamKey[]
      useIntroDebugStore.getState().resetParams(list)
      return { reset: list }
    },
    seek: (seconds: number) => {
      useIntroDebugStore.getState().seek(asNumber('seconds', seconds))
      return { time: useIntroDebugStore.getState().readout.time }
    },
    play: () => {
      useIntroDebugStore.getState().setPlaying(true)
      return { playing: true }
    },
    pause: () => {
      useIntroDebugStore.getState().setPlaying(false)
      return { playing: false }
    },
    step: () => {
      useIntroDebugStore.getState().step()
      return { playing: false }
    },
    restart: () => {
      useIntroDebugStore.getState().restart()
      return { restarted: true }
    },
    speed: (scale?: number) => {
      const debug = useIntroDebugStore.getState()
      if (scale !== undefined) debug.setTimeScale(clamp(asNumber('speed', scale), 0.05, 2))
      return { speed: useIntroDebugStore.getState().timeScale }
    },
    loop: (on?: boolean) => {
      const debug = useIntroDebugStore.getState()
      if (on !== undefined && asBoolean('loop', on) !== debug.loop) debug.toggleLoop()
      return { loop: useIntroDebugStore.getState().loop }
    },
    layers: setLayers,
    title: setTitle,
    preset: {
      list: () => {
        const { presets, activeId } = useIntroPresetStore.getState()
        return { active: activeId, presets: [...BUILT_IN_INTRO_PRESETS, ...presets].map(({ id, name }) => ({ id, name })) }
      },
      apply: (name: string) => {
        const { presets, applyPreset } = useIntroPresetStore.getState()
        const preset = findPreset([...BUILT_IN_INTRO_PRESETS, ...presets], name)
        applyPreset(preset.id)
        return { applied: preset.name }
      }
    }
  },
  debug: (open?: boolean) => {
    const debug = useIntroDebugStore.getState()
    if (open !== undefined) debug.setOpen(asBoolean('open', open))
    return { open: useIntroDebugStore.getState().open }
  },
  readout: () => {
    const state = useParticleStore.getState()
    const debug = useIntroDebugStore.getState()
    return {
      fps: state.measuredFps,
      particles: { active: state.activeParticles, target: state.numParticles, adaptive: state.adaptiveParticles },
      paused: state.isPaused,
      introComplete: state.introComplete,
      debugOpen: debug.open,
      // The loop publishes the intro readout only while the debugger is open
      intro: debug.open ? { ...debug.readout, playing: debug.playing, speed: debug.timeScale } : null,
      hidden: document.hidden
    }
  },
  frames: waitFrames
}

export type SceneApi = typeof sceneApi

declare global {
  interface Window {
    space?: SceneApi
  }
}

export function installSceneApi () {
  window.space = sceneApi
  return sceneApi
}
