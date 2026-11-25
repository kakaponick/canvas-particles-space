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
export { INTRO_LAYERS, CUE_LAYERS, INTRO_LAYER_NOTES, INTRO_TRACKS } from ${source('lib/intro_tracks.ts')}
export { TITLE_FONTS } from ${source('lib/title_sprite.ts')}
export { planFilm, FILM_SIZES, CAPTION_PLACES } from ${source('lib/film.ts')}
export { writeFilm, SCRIPT_WORDS, SCRIPT_GUIDE } from ${source('lib/film_script.ts')}
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
  DEFAULT_INTRO_PARAMS, INTRO_LAYERS, CUE_LAYERS, INTRO_LAYER_NOTES, INTRO_TRACKS, TITLE_FONTS, planFilm, FILM_SIZES, CAPTION_PLACES,
  useParticleStore, BUILT_IN_PRESETS, DEFAULT_PRESET, BUILT_IN_INTRO_PRESETS, writeFilm, SCRIPT_WORDS, SCRIPT_GUIDE
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

// 5b. The timeline: what the intro debugger does with time and layers, a film does too. Every layer is
// switched along a film and read by the scene, every event of the opening is fired again by a cue and
// played by the scene, and the scene's time slows, stops and runs ahead
const stateLayers = INTRO_LAYERS.filter(layer => !CUE_LAYERS.includes(layer))
for (const layer of INTRO_LAYERS) {
  if (!INTRO_LAYER_NOTES[layer]) problem(`layer "${layer}" has no line in INTRO_LAYER_NOTES, so describe says nothing about it`)
  if (!sceneSource.includes(`hidden.${layer}`)) problem(`layer "${layer}" is never read by scene.ts (hidden.${layer}), so switching it does nothing`)
  const plan = attempt(`film.layers.${layer}`, () => planFilm({ duration: 2, intro: false, layers: { [layer]: [[0, true], [1, false]] } }))
  if (plan && !plan.timeline.some(line => line.includes(`layer ${layer}`))) problem(`film.layers.${layer} is missing from the film's timeline`)
}
for (const layer of CUE_LAYERS) {
  if (!INTRO_LAYERS.includes(layer)) problem(`event "${layer}" in CUE_LAYERS is not a layer`)
  if (!sceneSource.includes(`LAYER_BIT.${layer}`)) problem(`event "${layer}" is never played by scene.ts (LAYER_BIT.${layer}), so firing it does nothing`)
  const plan = attempt(`film.cues with ${layer}`, () => planFilm({ duration: 2, intro: false, cues: [{ at: 1, play: [layer] }] }))
  if (plan && !plan.timeline.some(line => line.includes(`fires ${layer}`))) problem(`a cue with ${layer} is missing from the film's timeline`)
}
const refused = (what, film) => {
  try {
    planFilm(film)
    problem(`${what} was taken, and should be refused with what to do instead`)
  } catch {
    // Refused, as it should be
  }
}
for (const layer of stateLayers) refused(`a cue that fires the state "${layer}"`, { duration: 2, intro: false, cues: [{ at: 1, play: [layer] }] })
refused('a cue inside the opening', { duration: 30, cues: [{ at: 1, play: [CUE_LAYERS[0]] }] })
attempt('film.cues after the opening', () => planFilm({ duration: 60, cues: [{ at: 50, play: [...CUE_LAYERS], params: { ...DEFAULT_INTRO_PARAMS } }] }))
for (const speed of [0, 0.1, 4, [[0, 1], [1, 0], [2, 4]]]) {
  const plan = attempt(`film.speed ${JSON.stringify(speed)}`, () => planFilm({ duration: 2, intro: false, speed }))
  if (plan && plan.notes.length > 0) problem(`film.speed ${JSON.stringify(speed)}: ${plan.notes.join('; ')}`)
}

// 6. Presets, sizes and fonts all load
const presetNames = BUILT_IN_PRESETS.map(preset => preset.name)
const introPresetNames = BUILT_IN_INTRO_PRESETS.map(preset => preset.name)
for (const name of presetNames) attempt(`film.preset "${name}"`, () => planFilm({ duration: 1, preset: name }))
for (const name of introPresetNames) attempt(`film.intro.preset "${name}"`, () => planFilm({ duration: 1, intro: { preset: name } }))
for (const size of Object.keys(FILM_SIZES)) attempt(`film.size "${size}"`, () => planFilm({ duration: 1, size }))

// 7. A film as a script: the guide tells every word and its own example runs, a script says what the JSON
// says and moves everything a film moves, the same script is the same film, and a mistake names its line
for (const word of SCRIPT_WORDS) {
  if (!new RegExp(`\\b${word}\\b`).test(SCRIPT_GUIDE)) problem(`the script guide does not tell the word "${word}"`)
}
const guideExample = SCRIPT_GUIDE.slice(SCRIPT_GUIDE.lastIndexOf('\nExample\n') + 9)
if (!SCRIPT_GUIDE.includes('\nExample\n')) problem('the script guide has no example to run')
else attempt('the script guide\'s example', () => planFilm(writeFilm(guideExample).film))

const scriptPlan = (what, script, input) => attempt(what, () => planFilm(writeFilm(script, input).film))
const samePlan = (what, script, film) => {
  const written = scriptPlan(what, script)
  const read = attempt(what, () => planFilm(film))
  if (written && read && JSON.stringify(written) !== JSON.stringify(read)) problem(`${what}: the script and the JSON it stands for give different plans`)
}
samePlan('a script of values, layers, events and captions', `
  film({ seed: 5, size: 'square' })
  set({ cameraZoom: 2 })
  shot('one', () => { wait(1); to({ cameraZoom: 4 }, 2, 'linear') })
  hide('gravity'); fire('ringdown', { gravityWaveGain: 2 }); caption('x', 1, { at: 'top' })
  slow(0.5, () => { wait(2) }, 0.5)
`, {
  duration: 5,
  seed: 5,
  size: 'square',
  intro: false,
  settings: { cameraZoom: 2 },
  speed: [[3, 1], [3.5, 0.5], [4.5, 0.5], [5, 1]],
  tracks: { cameraZoom: [[1, 2], [3, 4, 'linear']] },
  layers: { gravity: [[0, true], [3, false]] },
  cues: [{ at: 3, play: ['ringdown'], params: { gravityWaveGain: 2 } }],
  captions: [{ text: 'x', from: 3, to: 4, at: 'top' }],
  shots: [{ name: 'one', from: 0, to: 3 }]
})
samePlan('a script with the opening', `opening({ title: 'A', hide: ['camera'] }); wait(1)`,
  (() => {
    const ends = planFilm({ duration: 60, intro: {} }).introEnds
    return { duration: Math.ceil(ends * 1e4) / 1e4 + 1, intro: { at: 0, title: 'A', hide: ['camera'] } }
  })())

const numberKeys = [...sliderKeys.filter(key => SETTING_KEYS.includes(key)), 'backgroundR', 'backgroundG', 'backgroundB',
  ...INTRO_KEYS.filter(key => !(key in SLIDERS) && !INTRO_PARAM_SPECS[key].options && !INTRO_PARAM_SPECS[key].color)]
const colorKeys = INTRO_KEYS.filter(key => INTRO_PARAM_SPECS[key].color)
const edge = (key, end) => key.startsWith('background') ? (end === 'min' ? 0 : 255) : (SLIDERS[key] ?? INTRO_PARAM_SPECS[key])[end]
const everything = scriptPlan('a script that moves every value', `
  opening()
  set(input.switches)
  to(input.high, 1, 'spring')
  to(input.low, 1, u => u * u)
  drive(Object.fromEntries(Object.keys(input.high).map(key => [key, (s, u) => input.low[key] + (input.high[key] - input.low[key]) * u])), 1)
  to(input.colors, 1)
  to({ speed: 0.2, fade: 1 }, 1)
  for (const layer of input.layers) { hide(layer); wait(0.1); show(layer) }
  fire(...input.events)
`, {
  switches: Object.fromEntries(trackSwitches.map(key => [key, false])),
  high: Object.fromEntries(numberKeys.map(key => [key, edge(key, 'max')])),
  low: Object.fromEntries(numberKeys.map(key => [key, edge(key, 'min')])),
  colors: Object.fromEntries(colorKeys.map(key => [key, '#ffffff'])),
  layers: [...INTRO_LAYERS],
  events: [...CUE_LAYERS]
})
if (everything) {
  const moved = new Set(everything.tracks.map(track => track.key))
  for (const key of [...numberKeys, ...colorKeys, ...trackSwitches, ...INTRO_LAYERS]) {
    if (!moved.has(key)) problem(`a script cannot move "${key}", which a film moves`)
  }
  if (!everything.speed || !everything.fade) problem('a script cannot move speed or fade')
}
for (const key of choiceKeys) scriptPlan(`a script that sets the choice ${key}`, `set({ ${key}: 0 }); opening(); wait(1)`)

const chance = 'film({ seed: 9 }); for (let i = 0; i < 5; i++) { to({ cameraZoom: random(1, 4), gridTilt: Math.random() * 60 }, pick([1, 2])) }'
if (JSON.stringify(attempt('a script with chance', () => writeFilm(chance))) !== JSON.stringify(attempt('a script with chance', () => writeFilm(chance)))) {
  problem('the same script with random() wrote two different films')
}
const lineOf = (what, script, line) => {
  try {
    writeFilm(script)
    problem(`${what} was taken, and should be refused`)
  } catch (error) {
    if (!error.message.startsWith(`line ${line}:`)) problem(`${what} should name line ${line}: ${error.message}`)
  }
}
lineOf('a script with an unknown key', 'wait(1)\nto({ nope: 1 }, 1)', 2)
lineOf('a script with an unknown word', 'wait(1)\n\nzoomIn(2)', 3)
lineOf('a script that moves one value twice at once', 'meanwhile(() => {\n  to({ cameraZoom: 3 }, 5)\n})\nwait(1)\nto({ cameraZoom: 2 }, 1)', 5)
lineOf('a script that fires an event inside the opening', 'opening()\nat(1, () => {\n  fire("glare")\n})', 3)

// 8. The map names every knob, and names nothing that is gone. In references/knobs.md a name in
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
  list('Layers that are events a film fires again', [...CUE_LAYERS])
  list('Layers that are states a film only switches', stateLayers)
  list('Presets', presetNames)
  list('Intro presets', introPresetNames)
}

if (problems.length > 0) {
  console.log(`${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
  for (const text of problems) console.log(`  - ${text}`)
  process.exit(1)
}
console.log(`Every knob is within reach: ${sliderKeys.length} sliders, ${switchKeys.length} switches, ${otherKeys.length} other settings, ` +
  `${INTRO_KEYS.length} intro parameters, ${INTRO_LAYERS.length} layers a film switches (${CUE_LAYERS.length} of them events it fires again), ` +
  `${presetNames.length} presets, ${introPresetNames.length} intro presets. ` +
  `The scene reads ${sceneReads.length} settings, all of them settable; knobs.md names every one. ` +
  `A script says all of it in ${SCRIPT_WORDS.length} words.`)
