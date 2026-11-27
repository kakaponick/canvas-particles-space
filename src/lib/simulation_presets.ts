// Named snapshots of the simulation settings. A preset holds what shapes the scene, the black hole's
// resting place and whether it follows the cursor included; runtime state and per-device choices
// (pause, frame rate cap) stay out of it.
import type { ParticleColor, ParticleState } from '../store/particle_store'
import { FLOW_SETTING_KEYS } from './flows'

export const SIMULATION_SETTING_KEYS = [
  'numParticles', 'fieldEnabled', 'baseSpeed', 'speedVariance', 'farZ', 'trailIntensity', 'speedGlow', 'speedGlowKnee',
  'particleSize', 'particleSizeMin', 'particleSizeSpread', 'particleLightSpread', 'gravityRedshift', 'spawnRadius', 'fieldAtHole', 'blackHoleDepth', 'gravityDepth', 'scrollSpeedStep',
  'baseBrightness', 'depthFade', 'minOpacity', 'maxOpacity', 'pulseIntensity', 'pulseSpeedMultiplier',
  'flightTintAhead', 'flightTintEdge', 'flightTintBehind', 'flightTintGradient', 'flightTintLimit', 'flightTintFrom', 'flightTintFull',
  'starsBrightness', 'starDensity', 'starCell', 'nebula', 'nebulaColor', 'nebulaColorDeep', 'nebulaColorCore',
  'nebulaScale', 'nebulaSparseness', 'nebulaEdge', 'nebulaWarp', 'nebulaContrast', 'nebulaGrain', 'nebulaDrift', 'nebulaDriftAngle', 'nebulaPatch', 'nebulaPatchShare', 'nebulaPatchSoftness', 'nebulaCore', 'nebulaCoreFrom',
  'nebulaDriftFollow', 'nebulaDetail', 'nebulaLacunarity', 'nebulaRoughness', 'nebulaCurlSize', 'nebulaGrainSize',
  'starsSize', 'starsColorWarm', 'starsColorCool', 'starsTwinkle', 'starsTwinkleSpeed', 'starsFaintest',
  'starsPlacement', 'starsPerCell', 'starsNeighbors', 'starsCellWarp', 'starsSkyEven', 'skyCenter', 'skySize', 'skyEaseBend',
  'blackHoleSize', 'horizonScale', 'blackHoleSpin', 'spinTilt', 'spinAxis', 'frameDrag', 'frameDragSweep', 'frameDragFalloff', 'frameDragSight', 'gravityReach', 'gravityStrength', 'gravityFalloff', 'gravityDepthBell', 'orbitalStrength', 'orbitalSpinFollow', 'orbitalSpinFollowCurve', 'gravityInertia', 'followFrequency',
  'blackHoleFollowing', 'blackHoleX', 'blackHoleY', 'cameraZoom', 'cameraX', 'cameraY', 'cameraPair', 'cameraCutZoom', 'cameraCutShift',
  'threeD', 'cameraYaw', 'cameraPitch', 'cameraSpin', 'cameraFloat', 'cameraBank', 'cameraRoll', 'cameraLookYaw', 'cameraLookPitch',
  'cameraMoveRight', 'cameraMoveUp', 'cameraMoveIn', 'threeDEndFade', 'threeDFrontDepth', 'threeDFrontCurve', 'threeDFrontBend',
  'threeDFrontBetween', 'threeDFrontReach', 'threeDFrontReachBare', 'threeDFrontLetGo', 'threeDFrontAdd', 'threeDFrontWaves', 'threeDEase', 'threeDNearest', 'cameraCutTurn',
  'companionSize', 'companionDistance', 'companionSpeed', 'companionWaves', 'companionTilt', 'companionNode', 'companionClosest', 'companionSpin', 'companionOval', 'companionHandover',
  'companionOwnSpin', 'companionSpinTilt', 'companionSpinAxis', 'companionPrecession', 'companionRingFeed', 'companionRingSides', 'companionLensCore', 'companionLensStyle',
  'companionLensDepth', 'companionHideDepth', 'companionWaveLens', 'companionFlatDepth', 'loneTilt', 'loneNode',
  'ringEnabled', 'ringFeedEnabled', 'ringBrightness', 'ringGlow', 'ringWidth', 'ringDoppler', 'ringSide', 'ringSpinFollow', 'ringBase', 'ringFeed', 'ringAfterglow', 'ringFlowSpeed',
  'ringColor', 'ringColorApproaching', 'ringColorReceding', 'ringWidthMin', 'ringOffset', 'ringSoftness', 'ringGlowCore', 'ringGlowCoreShare', 'ringGlowSkirt', 'ringGlowSkirtShare',
  'ringFeedCapture', 'ringFeedSkim', 'ringFeedReach', 'ringStarFlare', 'ringStarSpread', 'ringStarSides',
  'lensingEnabled', 'lensingTraced', 'lensingRadius', 'lensingFromCamera', 'lensingRotation', 'lensingFalloff', 'lensingPivot', 'lensingCore', 'lensingMaxBend', 'lensingReach', 'lensingBubble', 'lensingTwistLimit', 'lensingAbsorption',
  'gridCell', 'gridSheet', 'gridTilt', 'gridDepth', 'gridRings', 'gridSpokes', 'gridRide', 'gridRideDepth', 'gridSky', 'gridSkyPull', 'gridColor', 'gridLattice', 'gridLatticeCell', 'gridLatticeWarp',
  'gridDistance', 'gridSpan', 'gridFade', 'gridWaveLift', 'gridWaveOrbit', 'gridLine', 'gridLineNear', 'gridNear', 'gridClearing', 'gridClearingEdge', 'gridSkyLine', 'gridSkyHaze', 'gridSkyHazeSpan', 'gridSkySphere', 'gridSkySlant',
  'gridRingSpacing', 'gridRideWave', 'gridLensed', 'gridRideSoft', 'gridRideStretch', 'gridRideFar', 'gridRideCut', 'gridWell2Bottom', 'gridLift', 'gridWellWidth', 'neutronSurface', 'neutronStar', 'neutronGlow', 'neutronTurn', 'neutronVeins', 'neutronVeinSharp',
  'neutronVeinLight', 'neutronLimb', 'neutronShade', 'neutronGlowLight', 'neutronWarp', 'neutronColor', 'neutronVeinColor', 'gridEaseTurn',
  'gridThroatGlow', 'gridThroatCurve', 'gridLight', 'gridLightReach', 'gridLightColor',
  'gridFront', 'gridFrontX', 'gridFrontY', 'gridFrontRun', 'gridFrontWidth', 'gridFrontLead', 'gridFrontGhost', 'gridFrontColor',
  'gridFrontPhotons', 'gridPhotonCount', 'gridPhotonTrail', 'gridPhotonWidth', 'gridPhotonFade', 'gridPhotonColor',
  'bloom', 'bloomThreshold', 'bloomKnee', 'bloomReach', 'bloomTail', 'bloomColor',
  'gridHorizon', 'gridHorizonCells', 'gridHorizonPace', 'gridHorizonLine', 'gridHorizonHaze',
  'gridHorizonHazeFrom', 'gridHorizonHazeTo', 'gridHorizonCellsAround', 'gridHorizonShift', 'gridHorizonCompanion',
  'gridLatticeLine', 'gridLatticeGain', 'gridLatticeReach', 'gridLatticeFade', 'gridLatticeNear', 'gridLatticeFar', 'gridLatticeNearEdge', 'gridLatticeUnit',
  'orbitCount', 'orbitSize', 'orbitEccentricity', 'orbitSpeed', 'orbitTrail', 'orbitStarSize',
  'orbitDrag', 'orbitSizeSpread', 'orbitEccentricitySpread', 'orbitInclination', 'orbitTiltSky', 'orbitNodeSpread', 'orbitRetrograde', 'orbitClosest', 'orbitEscape', 'orbitFadeIn',
  ...FLOW_SETTING_KEYS, 'flowTrace', 'flowTraceHide', 'flowTraceDoppler', 'flowTraceBeam', 'flowTraceTint',
  'colorPalette', 'backgroundR', 'backgroundG', 'backgroundB'
] as const satisfies readonly (keyof ParticleState)[]

type SimulationSettingKey = typeof SIMULATION_SETTING_KEYS[number]

export type SimulationSettings = Pick<ParticleState, SimulationSettingKey>

export interface SimulationPreset {
  id: string
  name: string
  // What a built-in preset is, shown on the pointer over its name
  description?: string
  settings: SimulationSettings
}

export const PRESET_NAME_MAX_LENGTH = 32
// The top of the Event Horizon slider (simulation_specs.ts)
export const HORIZON_SCALE_MAX = 40

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

// A colour setting is kept as '#rrggbb'
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

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
    // The only strings among the settings are colours
    else if (typeof value === 'string') {
      if (typeof defaults[key] === 'string' && isHexColor(value)) settings[key] = value.toLowerCase()
    } else if (typeof value === typeof defaults[key] && (typeof value !== 'number' || Number.isFinite(value))) {
      // An old or hand-edited save may hold a fractional count
      settings[key] = key === 'numParticles' ? Math.round(value as number) : value
    }
  }
  // Event Horizon used to be a share of the screen (eventHorizon, in %); it is now a multiple of the black
  // hole's size, on the slider's step and within its range
  if (stored.horizonScale === undefined && isNumber(stored.eventHorizon)) {
    const size = isNumber(stored.blackHoleSize) ? stored.blackHoleSize : defaults.blackHoleSize
    if (size > 0) settings.horizonScale = Math.min(Math.round(stored.eventHorizon / size * 20) / 20, HORIZON_SCALE_MAX)
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
