#!/usr/bin/env node
// Proves that an agent can reach every knob of the scene, and that the map in references/knobs.md names
// each of them. Run it from anywhere inside the repository after a setting, an intro parameter, a layer
// or a preset is added, renamed or removed:
//
//   node .claude/skills/space-scene/scripts/audit.mjs          the checks, a line per failure
//   node .claude/skills/space-scene/scripts/audit.mjs --keys   also prints every key by kind
//
// It bundles the registries the panels are built from (esbuild ships with vite) and checks them in Node,
// so it needs no browser and no build: a few seconds.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

function findRoot () {
  for (const start of [process.cwd(), here]) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'src', 'lib', 'agent_values.ts'))) return dir
      if (dir === path.dirname(dir)) break
    }
  }
  throw new Error('Run this inside the canvas-particles-space repository')
}

const root = findRoot()
const source = file => JSON.stringify(path.join(root, 'src', file).replaceAll(path.sep, '/'))

// What the page itself is built from, gathered into one module
const ENTRY = `
export { SLIDERS, TOGGLES, SETTING_KEYS, DEVICE_KEYS, ALL_SETTING_KEYS, INTRO_KEYS, parseSettings, parseIntroValue } from ${source('lib/agent_values.ts')}
export { INTRO_PARAM_SPECS, DEFAULT_INTRO_PARAMS } from ${source('lib/intro_params.ts')}
export { INTRO_LAYERS, INTRO_TRACKS } from ${source('lib/intro_tracks.ts')}
export { TITLE_FONTS } from ${source('lib/title_sprite.ts')}
export { planFilm, FILM_SIZES, CAPTION_PLACES } from ${source('lib/film.ts')}
export { useParticleStore } from ${source('store/particle_store.ts')}
export { BUILT_IN_PRESETS, DEFAULT_PRESET } from ${source('store/preset_store.ts')}
export { BUILT_IN_INTRO_PRESETS } from ${source('store/intro_preset_store.ts')}
`

async function loadRegistries () {
  const fromRoot = createRequire(path.join(root, 'package.json'))
  const esbuild = createRequire(fromRoot.resolve('vite'))('esbuild')
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'space-audit-')), 'registries.mjs')
  try {
    await esbuild.build({
      stdin: { contents: ENTRY, resolveDir: root, loader: 'ts' },
      bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent'
    })
    return await import(pathToFileURL(out).href)
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true })
  }
}

const problems = []
const problem = text => problems.push(text)
const attempt = (what, work) => {
  try {
    return work()
  } catch (error) {
    problem(`${what}: ${error.message}`)
    return undefined
  }
}

const registries = await loadRegistries()
const {
  SLIDERS, TOGGLES, SETTING_KEYS, DEVICE_KEYS, ALL_SETTING_KEYS, INTRO_KEYS, parseSettings, INTRO_PARAM_SPECS,
  DEFAULT_INTRO_PARAMS, INTRO_LAYERS, INTRO_TRACKS, TITLE_FONTS, planFilm, FILM_SIZES, CAPTION_PLACES,
  useParticleStore, BUILT_IN_PRESETS, DEFAULT_PRESET, BUILT_IN_INTRO_PRESETS
} = registries

const state = useParticleStore.getState()
const defaults = DEFAULT_PRESET.settings
const sliderKeys = Object.keys(SLIDERS)
const switchKeys = Object.keys(TOGGLES)
const otherKeys = ALL_SETTING_KEYS.filter(key => !(key in SLIDERS) && !(key in TOGGLES))
// What the page keeps about itself rather than about the scene; window.space reaches it by pause(),
// play() and readout()
const RUNTIME = ['isPaused', 'measuredFps', 'activeParticles', 'introComplete']

// 1. Nothing in the store is out of reach: every value it holds is a setting the API takes or runtime state
for (const [key, value] of Object.entries(state)) {
  if (typeof value === 'function' || RUNTIME.includes(key)) continue
  if (!ALL_SETTING_KEYS.includes(key)) problem(`store value "${key}" is in no list the agent API takes (SIMULATION_SETTING_KEYS or DEVICE_KEYS)`)
}
for (const key of sliderKeys) {
  if (!ALL_SETTING_KEYS.includes(key)) problem(`slider "${key}" has a spec but is not in SIMULATION_SETTING_KEYS, so set() refuses it`)
}

// 2. window.space.set takes every key, and every slider's default sits on its own range
for (const key of ALL_SETTING_KEYS) {
  const value = key in defaults ? defaults[key] : state[key]
  const parsed = attempt(`set({ ${key} })`, () => parseSettings({ [key]: value }, ALL_SETTING_KEYS))
  if (parsed && key in SLIDERS && key in parsed.clamped) {
    problem(`slider "${key}": its default ${value} is not a value the slider can show (${SLIDERS[key].min}..${SLIDERS[key].max}, step ${SLIDERS[key].step})`)
  }
}
for (const key of sliderKeys) {
  const { min, max } = SLIDERS[key]
  for (const value of [min, max]) {
    const parsed = attempt(`set({ ${key}: ${value} })`, () => parseSettings({ [key]: value }, ALL_SETTING_KEYS))
    if (parsed && parsed.next[key] !== value) problem(`slider "${key}": its own end ${value} is moved to ${parsed.next[key]}`)
  }
}

// 3. The scene reads no setting an agent cannot write
const sceneSource = fs.readFileSync(path.join(root, 'src', 'lib', 'scene.ts'), 'utf8')
const sceneReads = [...new Set([...sceneSource.matchAll(/\bstate\.([A-Za-z0-9]+)/g)].map(match => match[1]))]
if (sceneReads.length < 20) problem('scene.ts no longer reads its settings as state.<key>; update this check')
for (const key of sceneReads) {
  if (!SETTING_KEYS.includes(key)) problem(`scene.ts reads state.${key}, which is not in SIMULATION_SETTING_KEYS: no preset, film or agent can set it`)
}

// 4. A film takes every setting at its start, and moves every number and switch along its tracks
const filmSettingKeys = SETTING_KEYS.filter(key => key !== 'blackHoleFollowing')
attempt('film.settings with every setting', () => planFilm({
  duration: 1,
  intro: false,
  settings: Object.fromEntries(filmSettingKeys.map(key => [key, defaults[key]]))
}))
const trackSwitches = switchKeys.filter(key => SETTING_KEYS.includes(key) && key !== 'blackHoleFollowing')
const settingTracks = {
  ...Object.fromEntries(sliderKeys.filter(key => SETTING_KEYS.includes(key)).map(key => [key, [[0, SLIDERS[key].min], [1, SLIDERS[key].max]]])),
  ...Object.fromEntries(trackSwitches.map(key => [key, [[0, true], [0.5, false]]])),
  backgroundR: [[0, 0], [1, 255]],
  backgroundG: [[0, 0], [1, 255]],
  backgroundB: [[0, 0], [1, 255]]
}
for (const [key, keyframes] of Object.entries(settingTracks)) {
  const plan = attempt(`film.tracks.${key}`, () => planFilm({ duration: 1, intro: false, tracks: { [key]: keyframes } }))
  if (plan && plan.notes.length > 0) problem(`film.tracks.${key}: ${plan.notes.join('; ')}`)
}

// 5. The opening: every parameter is set in intro.params, every number and colour moves along a track.
// A parameter that shares its name with a setting is shadowed in tracks, which is worth knowing about
const choiceKeys = INTRO_KEYS.filter(key => INTRO_PARAM_SPECS[key].options)
const shadowed = INTRO_KEYS.filter(key => key in SLIDERS)
for (const key of INTRO_KEYS) {
  if (!INTRO_PARAM_SPECS[key]) problem(`intro parameter "${key}" has a default but no spec in INTRO_PARAM_SPECS`)
}
for (const key of Object.keys(INTRO_PARAM_SPECS)) {
  if (!(key in DEFAULT_INTRO_PARAMS)) problem(`intro spec "${key}" has no default in DEFAULT_INTRO_PARAMS`)
}
attempt('film.intro.params with every parameter', () => planFilm({ duration: 1, intro: { params: { ...DEFAULT_INTRO_PARAMS } } }))
for (const key of INTRO_KEYS) {
  if (choiceKeys.includes(key) || shadowed.includes(key)) continue
  const spec = INTRO_PARAM_SPECS[key]
  attempt(`film.tracks.${key}`, () => planFilm({ duration: 1, tracks: { [key]: [[0, spec.min], [1, spec.max]] } }))
}
const inTracks = new Set(INTRO_TRACKS.flatMap(track => track.params ?? []))
for (const key of INTRO_KEYS) {
  if (!inTracks.has(key)) problem(`intro parameter "${key}" is on no track of the intro debugger (INTRO_TRACKS)`)
}
attempt('film.intro.hide with every layer', () => planFilm({ duration: 1, intro: { hide: [...INTRO_LAYERS] } }))

// 6. Presets, sizes and fonts all load
const presetNames = BUILT_IN_PRESETS.map(preset => preset.name)
const introPresetNames = BUILT_IN_INTRO_PRESETS.map(preset => preset.name)
for (const name of presetNames) attempt(`film.preset "${name}"`, () => planFilm({ duration: 1, preset: name }))
for (const name of introPresetNames) attempt(`film.intro.preset "${name}"`, () => planFilm({ duration: 1, intro: { preset: name } }))
for (const size of Object.keys(FILM_SIZES)) attempt(`film.size "${size}"`, () => planFilm({ duration: 1, size }))

// 7. The map names every knob, and names nothing that is gone. In references/knobs.md a name in
// backticks is a key, a layer, a preset, a font, a size or a caption place, and nothing else
const mapPath = path.join(here, '..', 'references', 'knobs.md')
const known = {
  setting: ALL_SETTING_KEYS,
  'intro parameter': INTRO_KEYS,
  'intro layer': [...INTRO_LAYERS],
  preset: presetNames,
  'intro preset': introPresetNames,
  'title font': Object.keys(TITLE_FONTS),
  'film size': Object.keys(FILM_SIZES),
  'caption place': [...CAPTION_PLACES]
}
if (!fs.existsSync(mapPath)) {
  problem(`the map is missing: ${mapPath}`)
} else {
  // A fenced example is not prose: only names in the running text count
  const prose = fs.readFileSync(mapPath, 'utf8').replace(/```[\s\S]*?```/g, '')
  const named = new Set([...prose.matchAll(/`([^`\n]+)`/g)].map(match => match[1]))
  for (const [kind, names] of Object.entries(known)) {
    for (const name of names) {
      if (!named.has(name)) problem(`knobs.md does not name the ${kind} \`${name}\``)
    }
  }
  const everyName = new Set(Object.values(known).flat())
  for (const name of named) {
    if (!everyName.has(name)) problem(`knobs.md names \`${name}\`, which is no key, layer, preset, font, size or caption place of the scene`)
  }
}

if (process.argv.includes('--keys')) {
  const list = (title, names) => console.log(`${title} (${names.length}): ${names.join(' ')}\n`)
  list('Sliders', sliderKeys)
  list('Switches', switchKeys)
  list('Other settings', otherKeys)
  list('Kept per device, not in presets or films', DEVICE_KEYS)
  list('Intro parameters', INTRO_KEYS)
  list('Intro choices (set, not keyframed)', choiceKeys)
  list('Intro parameters shadowed in film tracks by a setting of the same name', shadowed)
  list('Intro layers', [...INTRO_LAYERS])
  list('Presets', presetNames)
  list('Intro presets', introPresetNames)
}

if (problems.length > 0) {
  console.log(`${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
  for (const text of problems) console.log(`  - ${text}`)
  process.exit(1)
}
console.log(`Every knob is within reach: ${sliderKeys.length} sliders, ${switchKeys.length} switches, ${otherKeys.length} other settings, ` +
  `${INTRO_KEYS.length} intro parameters, ${INTRO_LAYERS.length} intro layers, ${presetNames.length} presets, ${introPresetNames.length} intro presets. ` +
  `The scene reads ${sceneReads.length} settings, all of them settable; knobs.md names every one.`)
