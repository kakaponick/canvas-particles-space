// Named snapshots of the simulation settings. A preset holds what shapes the scene; runtime state and
// per-device choices (pause, frame rate cap, adaptive budget, cursor following) stay out of it.
import type { ParticleColor, ParticleState } from '../store/particle_store'

export const SIMULATION_SETTING_KEYS = [
  'numParticles', 'baseSpeed', 'speedVariance', 'farZ', 'trailIntensity', 'speedGlow',
  'baseBrightness', 'depthFade', 'minOpacity', 'maxOpacity', 'pulseIntensity', 'pulseSpeedMultiplier',
  'starsBrightness', 'starDensity', 'starCell',
  'blackHoleSize', 'eventHorizon', 'gravityReach', 'gravityStrength', 'orbitalStrength', 'followFrequency',
  'ringEnabled', 'ringFeedEnabled', 'ringBrightness', 'ringWidth', 'ringDoppler', 'ringSide', 'ringBase', 'ringFeed', 'ringAfterglow', 'ringFlowSpeed',
  'lensingEnabled', 'lensingRadius', 'lensingRotation', 'lensingFalloff', 'lensingAbsorption',
  'colorPalette', 'backgroundR', 'backgroundG', 'backgroundB'
] as const satisfies readonly (keyof ParticleState)[]

type SimulationSettingKey = typeof SIMULATION_SETTING_KEYS[number]

export type SimulationSettings = Pick<ParticleState, SimulationSettingKey>

export interface SimulationPreset {
  id: string
  name: string
  settings: SimulationSettings
}

export const PRESET_NAME_MAX_LENGTH = 32

// The settings as they are, sharing the palette, so a subscriber sees a change only when one happened
export function selectSimulationSettings (source: SimulationSettings): SimulationSettings {
  const settings = {} as Record<SimulationSettingKey, unknown>
  for (const key of SIMULATION_SETTING_KEYS) settings[key] = source[key]
  return settings as unknown as SimulationSettings
}

// An independent copy, safe to keep in a preset
export function pickSimulationSettings (source: SimulationSettings): SimulationSettings {
  return { ...selectSimulationSettings(source), colorPalette: source.colorPalette.map(color => ({ ...color })) }
}

function samePalette (a: ParticleColor[], b: ParticleColor[]) {
  return a.length === b.length && a.every((color, index) => {
    const other = b[index]
    return color.r === other.r && color.g === other.g && color.b === other.b &&
      color.enabled === other.enabled && color.percent === other.percent
  })
}

function sameSetting (key: SimulationSettingKey, a: SimulationSettings, b: SimulationSettings) {
  return key === 'colorPalette' ? samePalette(a.colorPalette, b.colorPalette) : a[key] === b[key]
}

export function sameSimulationSettings (a: SimulationSettings, b: SimulationSettings) {
  return SIMULATION_SETTING_KEYS.every(key => sameSetting(key, a, b))
}

// Only the settings that differ from the defaults
export function changedSimulationSettings (current: SimulationSettings, defaults: SimulationSettings) {
  const changed: Record<string, unknown> = {}
  for (const key of SIMULATION_SETTING_KEYS) {
    if (!sameSetting(key, current, defaults)) changed[key] = current[key]
  }
  return changed
}

export function normalizePresetName (name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, PRESET_NAME_MAX_LENGTH)
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function readPalette (value: unknown): ParticleColor[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const palette: ParticleColor[] = []
  for (const entry of value as Partial<ParticleColor>[]) {
    if (!entry || !isNumber(entry.r) || !isNumber(entry.g) || !isNumber(entry.b) || !isNumber(entry.percent) || typeof entry.enabled !== 'boolean') return null
    palette.push({ r: entry.r, g: entry.g, b: entry.b, enabled: entry.enabled, percent: entry.percent })
  }
  return palette
}

// A stored value is used only if it has the right type; anything missing or broken falls back to the
// default, so a preset saved by an older version still opens
export function readSimulationSettings (stored: Record<string, unknown>, defaults: SimulationSettings): SimulationSettings {
  const settings = pickSimulationSettings(defaults) as unknown as Record<string, unknown>
  for (const key of SIMULATION_SETTING_KEYS) {
    const value = stored[key]
    if (key === 'colorPalette') settings[key] = readPalette(value) ?? settings[key]
    else if (typeof value === typeof defaults[key] && (typeof value !== 'number' || Number.isFinite(value))) settings[key] = value
  }
  return settings as unknown as SimulationSettings
}

// Reads the saved presets; a corrupt entry is skipped and the rest survive
export function parseSimulationPresets (json: string | null, defaults: SimulationSettings): SimulationPreset[] {
  if (!json) return []
  let stored: unknown
  try {
    stored = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(stored)) return []

  const presets: SimulationPreset[] = []
  const seen = new Set<string>()
  for (const entry of stored as Partial<SimulationPreset>[]) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.settings !== 'object' || entry.settings === null) continue
    const name = normalizePresetName(entry.name)
    const nameKey = name.toLowerCase()
    if (!name || seen.has(nameKey) || seen.has(entry.id)) continue
    seen.add(nameKey)
    seen.add(entry.id)
    presets.push({ id: entry.id, name, settings: readSimulationSettings(entry.settings as unknown as Record<string, unknown>, defaults) })
  }
  return presets
}
