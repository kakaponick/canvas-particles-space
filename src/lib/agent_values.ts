// How the agent API reads the values it is given: one place that checks a setting, an intro parameter or a
// preset name against the registries the panels are built from, shared by window.space (scene_api.ts) and
// by films (film.ts). Every check fails with a reason an agent can act on.
import type { ParticleColor, ParticleState } from '../store/particle_store'
import { SIMULATION_SETTING_KEYS, isHexColor } from './simulation_presets'
import { SIMULATION_COLOR_SPECS, SIMULATION_SETTING_SPECS, type SimulationColorSpec, type SimulationSettingSpec } from './simulation_specs'
import { DEFAULT_INTRO_PARAMS, INTRO_PARAM_SPECS, cssToColor, type IntroParamKey } from './intro_params'
import { FRAME_RATE_CAP_MAX, FRAME_RATE_CAP_MIN } from './particle_simulation'

export type Patch = Record<string, unknown>

export const SLIDERS = SIMULATION_SETTING_SPECS as Record<string, SimulationSettingSpec>
// The full name: the panel's short label ("Size", "Brightness") leans on its section, which this API does not show
export const sliderName = (spec: SimulationSettingSpec | SimulationColorSpec) => spec.spokenName ?? spec.label
// The colour settings: each takes '#rrggbb' and moves channel by channel along a film's track
export const COLORS = SIMULATION_COLOR_SPECS as Record<string, SimulationColorSpec>
export const TOGGLES: Record<string, string> = {
  fieldEnabled: 'The particle field: the flight through space and everything gravity does with it. false steps and draws no particle of it, so the flows, the grids and the lens are the whole scene and a step costs almost nothing; turned on again the field is made anew at every depth.',
  blackHoleFollowing: 'The black hole follows the cursor; false anchors it at blackHoleX, blackHoleY.',
  ringEnabled: 'Photon ring around the shadow.',
  ringFeedEnabled: 'Matter falling in or skimming past brightens the photon ring.',
  lensingEnabled: 'Gravitational lensing around the black hole.',
  lensingTraced: 'Ray Traced lens, the default: every pixel follows the exact path of light past the black hole (a Kerr hole when blackHoleSpin is above 0, which drags the light round and leans the rings), so the Einstein ring, the mirrored image inside it and the thin rings of light that circled the hole come from the physics. lensingRadius then sets how far the camera stands (1.32 at 2 Schwarzschild radii, the nearest; 2.13 at 10; 2.86 at 21; 8 at about 200; 30, the top, at about 3 000), lensingAbsorption still darkens, and lensingReach, lensingFalloff, lensingPivot, lensingRotation, lensingTwistLimit, lensingMaxBend and lensingCore do nothing. false = the stylized lens, which those shape.',
  threeD: 'The field as a volume in space, stepped with gravity along the true distance, seen by a camera that circles the black hole (cameraYaw, cameraPitch, cameraSpin; dragging the scene turns it). Straight on it looks like the flat mode; false is the flat mode, where gravity pulls where particles land on the screen. The camera eases between the two in about a second.',
  fpsCounter: 'Shows the measured frame rate in the scene toolbar at the top right (per device, not in presets).'
}
export const SETTING_KEYS: readonly string[] = SIMULATION_SETTING_KEYS
// Kept per device, so they are in no preset and no film
export const DEVICE_KEYS = ['frameRateCap', 'fpsCounter']
export const ALL_SETTING_KEYS = [...SETTING_KEYS, ...DEVICE_KEYS]
export const INTRO_KEYS = Object.keys(DEFAULT_INTRO_PARAMS) as IntroParamKey[]

export function fail (message: string): never {
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
export function unknownKey (key: string, known: readonly string[]): never {
  const lower = key.toLowerCase()
  const close = known
    .map(name => ({ name, score: name.toLowerCase().includes(lower) ? 0 : editDistance(lower, name.toLowerCase()) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map(entry => entry.name)
  fail(`Unknown key "${key}". Closest: ${close.join(', ')}`)
}

export function asNumber (key: string, value: unknown) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) fail(`${key} takes a number, got ${JSON.stringify(value)}`)
  return number
}

export function asBoolean (key: string, value: unknown) {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fail(`${key} takes true or false, got ${JSON.stringify(value)}`)
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// The nearest value a slider can show: inside its range and on its step, without float noise
export function onSliderGrid (value: number, min: number, max: number, step: number) {
  const snapped = min + Math.round((clamp(value, min, max) - min) / step) * step
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return clamp(Number(snapped.toFixed(decimals)), min, max)
}

// A colour as the store keeps it, '#rrggbb' in lower case; 0xRRGGBB as a number is taken too
export function asColor (key: string, value: unknown) {
  if (isHexColor(value)) return value.toLowerCase()
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return '#' + value.toString(16).padStart(6, '0')
  return fail(`${key} takes a colour as '#rrggbb', got ${JSON.stringify(value)}`)
}

export function asChannel (key: string, value: unknown) {
  return Math.round(clamp(asNumber(key, value), 0, 255))
}

export function asPalette (value: unknown): ParticleColor[] {
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

export function pickKeys (keys: string | string[] | undefined, known: readonly string[]) {
  if (keys === undefined) return known
  const list = Array.isArray(keys) ? keys : [keys]
  for (const key of list) if (!known.includes(key)) unknownKey(key, known)
  return list
}

// Checks a patch of simulation settings: sliders land on their step within range, switches become
// booleans, an unknown key fails. `known` is what the caller accepts besides the sliders
export function parseSettings (patch: unknown, known: readonly string[]) {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) fail('settings take an object, e.g. { blackHoleSize: 12 }')
  const next: Partial<ParticleState> & Patch = {}
  const clamped: Patch = {}
  for (const [key, value] of Object.entries(patch)) {
    const slider = SLIDERS[key]
    if (!known.includes(key)) {
      unknownKey(key, known)
    } else if (slider) {
      const number = asNumber(key, value)
      next[key] = onSliderGrid(number, slider.min, slider.max, slider.step)
      if (next[key] !== number) clamped[key] = next[key]
    } else if (key in TOGGLES) {
      next[key] = asBoolean(key, value)
    } else if (key in COLORS) {
      next[key] = asColor(key, value)
    } else if (key === 'colorPalette') {
      next.colorPalette = asPalette(value)
    } else if (key === 'backgroundR' || key === 'backgroundG' || key === 'backgroundB') {
      next[key] = asChannel(key, value)
    } else if (key === 'frameRateCap') {
      const fps = Math.round(asNumber(key, value))
      next.frameRateCap = fps <= 0 ? 0 : clamp(fps, FRAME_RATE_CAP_MIN, FRAME_RATE_CAP_MAX)
    } else {
      unknownKey(key, known)
    }
  }
  // Placing the black hole anchors it, as the Position sliders do
  if (('blackHoleX' in next || 'blackHoleY' in next) && !('blackHoleFollowing' in next)) next.blackHoleFollowing = false
  return { next, clamped }
}

export function findPreset<T extends { id: string, name: string }> (list: readonly T[], name: string): T {
  const wanted = String(name).trim().toLowerCase()
  return list.find(preset => preset.id === name || preset.name.toLowerCase() === wanted) ??
    fail(`No preset "${name}". Presets: ${list.map(preset => preset.name).join(', ')}`)
}

export function parseIntroValue (key: IntroParamKey, value: unknown) {
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
