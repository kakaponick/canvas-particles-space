#!/usr/bin/env node
// Proves that an agent can reach every knob of the scene, and that the map in references/knobs.md names
// each of them, and that a fractal film reaches every target, palette and value it has. Run it from
// anywhere inside the repository after a setting, an intro parameter, a layer, a preset, or anything of a
// fractal film is added, renamed or removed:
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
export { SLIDERS, TOGGLES, COLORS, SETTING_KEYS, DEVICE_KEYS, ALL_SETTING_KEYS, INTRO_KEYS, parseSettings, parseIntroValue } from ${source('lib/agent_values.ts')}
export { STYLIZED_LENS_KEYS } from ${source('lib/simulation_specs.ts')}
export { INTRO_PARAM_SPECS, DEFAULT_INTRO_PARAMS } from ${source('lib/intro_params.ts')}
export { INTRO_LAYERS, CUE_LAYERS, INTRO_LAYER_NOTES, INTRO_TRACKS } from ${source('lib/intro_tracks.ts')}
export { TITLE_FONTS } from ${source('lib/title_sprite.ts')}
export { planFilm, applyTracks, FILM_SIZES, CAPTION_PLACES, CAPTION_FONTS, CAPTION_REVEALS, CAPTION_ALIGNS, FILM_GUIDE, GRAPHIC_KINDS, GRAPHIC_KEYS, GRAPHIC_COMMON } from ${source('lib/film.ts')}
export { writeFilm, SCRIPT_WORDS, SCRIPT_GUIDE, writeFractal, FRACTAL_SCRIPT_WORDS, FRACTAL_SCRIPT_GUIDE } from ${source('lib/film_script.ts')}
export { planFractal, fractalView, FRACTAL_GUIDE, FRACTAL_KEYS, FRACTAL_TRACK_KEYS, FRACTAL_NUMBERS, FRACTAL_CAPTION_PLACES, FRACTAL_HEAD_KEYS } from ${source('lib/fractal.ts')}
export { FRACTAL_TARGETS, FRACTAL_PALETTES } from ${source('lib/fractal_catalog.ts')}
export { planReel, isReel, REEL_GUIDE, REEL_KEYS, CLIP_KEYS, CLIP_KINDS, TRANSITION_KEYS, REEL_TRANSITIONS, MAX_REEL_CLIPS } from ${source('lib/reel.ts')}
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
  SLIDERS, TOGGLES, COLORS, SETTING_KEYS, DEVICE_KEYS, ALL_SETTING_KEYS, INTRO_KEYS, parseSettings, INTRO_PARAM_SPECS,
  DEFAULT_INTRO_PARAMS, INTRO_LAYERS, CUE_LAYERS, INTRO_LAYER_NOTES, INTRO_TRACKS, TITLE_FONTS, planFilm, FILM_SIZES, CAPTION_PLACES,
  CAPTION_FONTS, CAPTION_REVEALS, CAPTION_ALIGNS, FILM_GUIDE, GRAPHIC_KINDS, GRAPHIC_KEYS, GRAPHIC_COMMON,
  useParticleStore, BUILT_IN_PRESETS, DEFAULT_PRESET, BUILT_IN_INTRO_PRESETS, writeFilm, SCRIPT_WORDS, SCRIPT_GUIDE,
  writeFractal, FRACTAL_SCRIPT_WORDS, FRACTAL_SCRIPT_GUIDE, planFractal, fractalView, FRACTAL_GUIDE, FRACTAL_KEYS, FRACTAL_TRACK_KEYS,
  FRACTAL_NUMBERS, FRACTAL_CAPTION_PLACES, FRACTAL_HEAD_KEYS, FRACTAL_TARGETS, FRACTAL_PALETTES,
  planReel, isReel, REEL_GUIDE, REEL_KEYS, CLIP_KEYS, CLIP_KINDS, TRANSITION_KEYS, REEL_TRANSITIONS, MAX_REEL_CLIPS,
  STYLIZED_LENS_KEYS
} = registries

const state = useParticleStore.getState()
const defaults = DEFAULT_PRESET.settings
const sliderKeys = Object.keys(SLIDERS)
const switchKeys = Object.keys(TOGGLES)
const settingColorKeys = Object.keys(COLORS)
const otherKeys = ALL_SETTING_KEYS.filter(key => !(key in SLIDERS) && !(key in TOGGLES) && !(key in COLORS))
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
// A colour setting is a '#rrggbb' in the store with a spec; one that stands for a colour the code once
// held as a constant has its default at the hex that constant rounds to, so the scene still draws the constant
const HEX = /^#[0-9a-f]{6}$/
for (const key of settingColorKeys) {
  if (!SETTING_KEYS.includes(key)) problem(`colour "${key}" has a spec but is not in SIMULATION_SETTING_KEYS, so set() refuses it`)
  if (!HEX.test(String(state[key]))) problem(`colour "${key}": its default ${JSON.stringify(state[key])} is not '#rrggbb' in lower case`)
  const { exact } = COLORS[key]
  if (!exact) continue
  const rounded = '#' + exact.rgb.map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')
  if (exact.hex !== rounded) problem(`colour "${key}": the channels it stands for round to ${rounded}, not to its ${exact.hex}`)
  if (state[key] !== exact.hex) problem(`colour "${key}": its default ${state[key]} is not the ${exact.hex} its exact channels stand for, so films from before it was a setting change`)
}
for (const [key, value] of Object.entries(state)) {
  if (typeof value === 'string' && !(key in COLORS)) problem(`store value "${key}" is a string with no spec in SIMULATION_COLOR_SPECS`)
}
// A hint is one line of the panel's context menu
for (const [key, { hint }] of [...Object.entries(SLIDERS), ...Object.entries(COLORS)]) {
  if (hint.length > 42) problem(`"${key}": its hint is ${hint.length} characters, more than the 42 a line holds: ${hint}`)
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

// 4. A film takes every setting at its start, and moves every number, switch and colour along its tracks
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
  ...Object.fromEntries(settingColorKeys.map(key => [key, [[0, '#000000'], [1, '#ffffff', 'linear']]])),
  backgroundR: [[0, 0], [1, 255]],
  backgroundG: [[0, 0], [1, 255]],
  backgroundB: [[0, 0], [1, 255]]
}
// The stylized lens's keys are moved on the stylized lens, since under the traced one they do nothing
for (const [key, keyframes] of Object.entries(settingTracks)) {
  const settings = STYLIZED_LENS_KEYS.includes(key) ? { cameraZoom: 2, lensingTraced: false } : { cameraZoom: 2 }
  const plan = attempt(`film.tracks.${key}`, () => planFilm({ duration: 1, intro: false, settings, tracks: { [key]: keyframes } }))
  if (plan && plan.notes.length > 0) problem(`film.tracks.${key}: ${plan.notes.join('; ')}`)
}
// A colour moves channel by channel and is written back as the text the store keeps
const tinted = attempt('a colour setting along a track', () => planFilm({ duration: 2, intro: false, tracks: Object.fromEntries(settingColorKeys.map(key => [key, [[0, '#000000'], [2, '#ff8000', 'linear']]])) }))
if (tinted) {
  registries.applyTracks(tinted, 1)
  for (const key of settingColorKeys) {
    if (tinted.settings[key] !== '#804000') problem(`film.tracks.${key}: half way from #000000 to #ff8000 the setting is ${JSON.stringify(tinted.settings[key])}, not "#804000"`)
  }
}
for (const key of settingColorKeys) {
  for (const value of ['red', '#12345', 0x1000000, null]) {
    try {
      parseSettings({ [key]: value }, ALL_SETTING_KEYS)
      problem(`set({ ${key}: ${JSON.stringify(value)} }) is taken, and is no colour`)
    } catch {
      // Refused, as it should be
    }
  }
}
if (!defaults.lensingTraced) problem('the default lens is not ray traced, which the films and the docs say it is')
for (const key of STYLIZED_LENS_KEYS) {
  if (!(key in SLIDERS)) problem(`STYLIZED_LENS_KEYS names "${key}", which is no slider`)
}
const twisted = attempt('a twist under the traced lens', () => planFilm({ duration: 2, intro: false, tracks: { lensingRotation: [[0, 0], [2, 4]] } }))
if (twisted && !twisted.notes.some(note => note.includes('lensingRotation'))) problem('a film that twists the sky under the traced lens is not told that the twist changes nothing')
const turnedOff = attempt('a twist after the lens turns stylized', () => planFilm({
  duration: 2, intro: false, tracks: { lensingTraced: [[0, true], [1, false]], lensingRotation: [[1, 0], [2, 4]] }
}))
if (turnedOff && turnedOff.notes.length > 0) problem(`a film that turns to the stylized lens and twists it is told: ${turnedOff.notes.join('; ')}`)

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
const colorKeys = [...settingColorKeys, ...INTRO_KEYS.filter(key => INTRO_PARAM_SPECS[key].color)]
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

// 8. A caption's text: every face, way of arriving and way of standing is taken; the marks are read and a
// broken one is refused; a number in the text is the caption's own, the film's second or any number of the
// scene; the letters of science are held by the bundled faces, so no film is told its face is the machine's
const captionOf = (what, caption) => attempt(what, () => planFilm({ duration: 4, intro: false, captions: [{ text: 'x', from: 0, to: 4, ...caption }] }))
for (const font of CAPTION_FONTS) captionOf(`a caption in the face ${font}`, { font })
for (const reveal of CAPTION_REVEALS) captionOf(`a caption arriving by ${reveal}`, { reveal, revealOver: 1 })
for (const align of CAPTION_ALIGNS) captionOf(`a caption standing ${align}`, { align })
const marked = captionOf('a caption with every mark', {
  text: 'r_{s} = 2GM / c^{2}, *{a term with c^{2} and #{own:2,}}, #{seconds:1}, #{cameraZoom:1}, #{gravityWaveGain}',
  values: { own: [[0, 0], [4, 1, 'linear']] },
  accent: '#88ccff',
  plate: 0.5,
  width: 0.5,
  radius: 1.5,
  at: 'hole'
})
if (marked && marked.notes.length > 0) problem(`a caption with every mark: ${marked.notes.join('; ')}`)
const science = captionOf('a caption in the letters of science', { text: 'αβγδλμπστφψωΓΔΘΛΣΦΨΩ ∞≈≠≤≥±×÷·√∫∂∇∑∝→←↔⇒ ℏ ☉⊕☿♀♁♂♃♄♅♆ ★ °′″ Å Привет' })
if (science && science.notes.length > 0) problem(`the letters of science are not all in the bundled faces: ${science.notes.join('; ')}`)
const strange = captionOf('a caption in letters no face holds', { text: '事件' })
if (strange && strange.notes.length === 0) problem('a caption in letters no bundled face holds is not told so')
for (const text of ['r_{s', '#{nope:1}', '#{titleEntrance}', '#{cameraZoom:12}', 'a^{b_{c}}']) {
  refused(`a caption with the broken mark ${text}`, { duration: 4, intro: false, captions: [{ text, from: 0, to: 4 }] })
}
for (const text of ['space_guide', 'Sagittarius A*', 'a ^ b', '{x}']) {
  const plain = captionOf(`a caption with the plain text ${text}`, { text })
  if (plain && (plain.captions[0].lines[0].length !== 1 || plain.captions[0].lines[0][0].text !== text)) problem(`plain text "${text}" was read as a mark`)
}
samePlan('a script with a caption\'s own numbers', `
  caption('#{a:1} and #{b}', 2, { values: { a: [0, 5], b: [[0, 1], [2, 3]] } })
  wait(2)
`, { duration: 2, intro: false, captions: [{ text: '#{a:1} and #{b}', from: 0, to: 2, values: { a: [[0, 0], [2, 5, 'linear']], b: [[0, 1], [2, 3]] } }] })
for (const name of [...CAPTION_REVEALS, ...CAPTION_ALIGNS, 'radius', 'plate', 'accent', 'values', 'revealOver', 'width']) {
  if (!FILM_GUIDE.includes(name)) problem(`the film guide does not tell the caption option "${name}"`)
}

// 8b. A fractal film: every target, palette and size plans, the guide tells every key, value, number and
// place, a loop's last frame is its first, a pace is summed into the depth, a script says what its JSON
// says and refuses the words of the particle scene, and every mistake is told at once
const fractalPlan = (what, film) => attempt(what, () => planFractal(film))
for (const [name, target] of Object.entries(FRACTAL_TARGETS)) {
  const plan = fractalPlan(`fractal target "${name}"`, { duration: 2, target: name, depth: 30 })
  if (plan && !plan.target.multiplier) problem(`fractal target "${name}" is not a Misiurewicz point: it would not fall forever`)
  if (plan && plan.target.preperiod !== target.preperiod) problem(`fractal target "${name}" was found with another preperiod`)
  const loop = fractalPlan(`a loop at "${name}"`, { duration: 6, target: name, loop: true })
  if (loop) {
    const first = fractalView(loop, 0)
    const last = fractalView(loop, loop.duration)
    const copies = loop.loopCopies
    const { size, turn } = loop.target.multiplier
    if (Math.abs(last.zoom - first.zoom - copies * Math.log2(size)) > 1e-9 ||
      Math.abs(last.angle - first.angle + copies * turn) > 1e-9 ||
      Math.abs(last.phase - first.phase + copies * loop.target.period / loop.cycle) > 1e-9 ||
      last.maxIter !== first.maxIter) {
      problem(`a loop at "${name}" does not end where it began, one picture deeper`)
    }
  }
}
for (const name of Object.keys(FRACTAL_PALETTES)) fractalPlan(`fractal palette "${name}"`, { duration: 1, palette: name })
for (const size of Object.keys(FILM_SIZES)) fractalPlan(`fractal size "${size}"`, { duration: 1, size })
for (const name of [...FRACTAL_KEYS, ...FRACTAL_TRACK_KEYS, ...FRACTAL_NUMBERS, ...FRACTAL_CAPTION_PLACES, ...Object.keys(FRACTAL_TARGETS), ...Object.keys(FRACTAL_PALETTES)]) {
  if (!FRACTAL_GUIDE.includes(name)) problem(`the fractal guide does not tell "${name}"`)
}
for (const key of FRACTAL_TRACK_KEYS) fractalPlan(`a fractal track of ${key}`, { duration: 4, tracks: { [key]: [[0, 1], [4, 2]] } })
const paced = fractalPlan('a fractal film paced by a track', { duration: 10, tracks: { rate: [[0, 2], [10, 2]] } })
if (paced && Math.abs(paced.depth - 20) > 0.01) problem(`a rate of 2 for 10 s falls to 10^${paced.depth}, not 10^20`)
const plain = fractalPlan('a fractal film with a pace of its own', { duration: 10, rate: 1, easeIn: 0, from: 5 })
if (plain && Math.abs(fractalView(plain, 4).depth - 9) > 1e-9) problem('a fall from 10^5 at 1 power of ten a second is not at 10^9 after 4 s')
for (const number of FRACTAL_NUMBERS) fractalPlan(`a fractal caption showing #{${number}}`, { duration: 2, captions: [{ text: `#{${number}:1}`, at: 'hole' }] })
const fractalRefused = (what, film, expected) => {
  try {
    planFractal(film)
    problem(`${what} is taken, and should not be`)
  } catch (error) {
    if (expected && !expected.test(error.message)) problem(`${what} is refused without saying why: ${error.message}`)
  }
}
fractalRefused('a loop with a rate track', { duration: 4, loop: true, tracks: { rate: [[0, 1], [4, 2]] } }, /loop/)
fractalRefused('a rate track beside a depth', { duration: 4, depth: 10, tracks: { rate: [[0, 1]] } }, /tracks\.rate/)
fractalRefused('a fractal caption at the einstein ring', { duration: 2, captions: [{ text: 'x', at: 'einstein' }] }, /hole/)
fractalRefused('a fractal caption showing a number of the scene', { duration: 2, captions: [{ text: '#{cameraZoom}' }] }, /Unknown key/)
fractalRefused('a fractal film with three mistakes', { duration: 2, target: 'nowhere', palete: 'fire', samples: 'x' }, /3 problems/)
for (const word of FRACTAL_SCRIPT_WORDS) {
  if (!new RegExp(`\\b${word}\\b`).test(FRACTAL_SCRIPT_GUIDE)) problem(`the fractal script guide does not tell the word "${word}"`)
}
const fractalExample = FRACTAL_SCRIPT_GUIDE.slice(FRACTAL_SCRIPT_GUIDE.lastIndexOf('\nExample\n') + 9)
if (!FRACTAL_SCRIPT_GUIDE.includes('\nExample\n')) problem('the fractal script guide has no example to run')
else attempt('the fractal script guide\'s example', () => planFractal(writeFractal(fractalExample).film))
for (const key of FRACTAL_HEAD_KEYS) {
  if (!FRACTAL_SCRIPT_GUIDE.includes(key)) problem(`the fractal script guide does not tell what film() takes: ${key}`)
}
const writtenFractal = attempt('a fractal script', () => planFractal(writeFractal(`
  film({ target: 'triple', palette: 'ice' })
  set({ rate: 0, fade: 1 })
  shot('in', () => { to({ fade: 0 }, 1, 'linear'); caption('x', 2, { at: 'top' }) })
  to({ rate: 2 }, 2, 'linear')
  drive({ glow: s => s / 4 }, 2)
`).film))
const readFractal = fractalPlan('the JSON a fractal script stands for', {
  duration: 5,
  target: 'triple',
  palette: 'ice',
  tracks: { rate: [[1, 0], [3, 2, 'linear']], glow: [[3, 0], ...Array.from({ length: 120 }, (_, index) => [Math.round((3 + (index + 1) / 60) * 1e4) / 1e4, Math.round((index + 1) / 60 / 4 * 1e6) / 1e6, 'linear'])] },
  fade: [[0, 1], [1, 0, 'linear']],
  captions: [{ text: 'x', from: 1, to: 3, at: 'top' }],
  shots: [{ name: 'in', from: 0, to: 1 }]
})
if (writtenFractal && readFractal && JSON.stringify(writtenFractal.timeline) !== JSON.stringify(readFractal.timeline)) {
  problem('a fractal script and the JSON it stands for give different plans')
}
for (const word of ['opening', 'slow', 'hide', 'show', 'fire', 'title']) {
  try {
    writeFractal(`${word}('x'); wait(1)`)
    problem(`a fractal script takes ${word}(), a word of the particle scene`)
  } catch (error) {
    if (!/particle scene/.test(error.message)) problem(`a fractal script refuses ${word}() without saying why: ${error.message}`)
  }
}

// 8c. What a film draws over its picture: every kind of shape plans with every key it takes, and the guide
// tells each; a place in each of its forms is read in a shape and in a caption; a number is read by name
// from where a caption's is; a script's draw comes to the JSON it stands for; what will not show is told.
// A new kind or key fails here until it has a value below, which is what keeps this list whole
const SHAPE_VALUES = {
  from: 0, to: 4, fade: 0.2, color: '#ffffff', opacity: 0.5, width: 0.004, dash: [0.01, 0.01], fill: '#000000', fillOpacity: 0.5,
  values: { own: [[0, 0], [4, 1]] }, draw: 1,
  points: [[0.1, 0.1], { hole: [1, 0] }, { companion: [0, 1] }], smooth: true, close: true, arrow: 'both',
  center: { hole: ['own', 0] }, radius: 'own', radiusY: 2, arc: [0, 'own'], size: [0.2, 0.1], round: 0.01,
  box: [0.1, 0.1, 0.3, 0.3], x: [0, 1], y: [0, 1], series: [{ points: [[0, 0], [1, 1]], color: '#ff0000' }], xLabel: 'r / r_{s}', yLabel: 'y',
  labelSize: 0.02, plate: 0.5, upTo: 'seconds', marker: 'own', src: 'data:image/png;base64,AAAA'
}
const shapeFilm = (graphic, more = {}) => ({ duration: 4, intro: false, settings: { companionSize: 0.5 }, graphics: [graphic], ...more })
for (const kind of GRAPHIC_KINDS) {
  const keys = [...GRAPHIC_COMMON.filter(key => key !== 'kind'), ...(GRAPHIC_KEYS[kind] ?? [])]
  const missing = keys.filter(key => !(key in SHAPE_VALUES))
  if (missing.length > 0) {
    problem(`the audit has no value for the shape key ${missing.join(', ')} of "${kind}": add one to SHAPE_VALUES`)
    continue
  }
  const whole = attempt(`a ${kind} with every key it takes`, () => planFilm(shapeFilm({ kind, ...Object.fromEntries(keys.map(key => [key, SHAPE_VALUES[key]])), ...(kind === 'plot' ? { points: [[0, 0], [1, 1]] } : {}) })))
  if (whole && whole.graphics.length !== 1) problem(`a ${kind} with every key it takes plans ${whole.graphics.length} shapes`)
  if (whole && whole.notes.length > 0) problem(`a ${kind} with every key it takes: ${whole.notes.join('; ')}`)
  if (!FILM_GUIDE.includes(`${kind}:`)) problem(`the film guide does not tell the shape "${kind}"`)
  for (const key of keys) if (!FILM_GUIDE.includes(key)) problem(`the film guide does not tell the shape key "${key}"`)
}
for (const place of [[0.5, 0.5], { hole: [1, 0] }, { companion: [0, 1] }]) {
  attempt(`a shape at ${JSON.stringify(place)}`, () => planFilm(shapeFilm({ kind: 'circle', center: place, radius: 1 })))
  attempt(`a caption at ${JSON.stringify(place)}`, () => planFilm({ duration: 4, intro: false, settings: { companionSize: 0.5 }, captions: [{ text: 'x', at: place }] }))
}
for (const name of ['own', 'seconds', 'lensingRadius', 'gravityWaveGain']) {
  attempt(`a shape whose radius reads "${name}"`, () => planFilm(shapeFilm({ kind: 'circle', center: [0.5, 0.5], radius: name, values: { own: [[0, 0.1], [4, 0.2]] } })))
}
refused('a shape whose radius reads a name nothing has', shapeFilm({ kind: 'circle', center: [0.5, 0.5], radius: 'nope' }))
refused('a shape of an unknown kind', shapeFilm({ kind: 'blob' }))
refused('a shape at a place that is neither form', shapeFilm({ kind: 'circle', center: { star: [0, 0] }, radius: 1 }))
samePlan('a script that draws a shape', `
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 'r', values: { r: [1, 3] } }, 2)
  wait(2)
`, { duration: 2, intro: false, graphics: [{ kind: 'circle', center: { hole: [0, 0] }, radius: 'r', from: 0, to: 2, values: { r: [[0, 1], [2, 3, 'linear']] } }] })
const told = (what, film, word) => {
  const plan = attempt(what, () => planFilm(film))
  if (plan && !plan.notes.some(note => note.includes(word))) problem(`${what} is not told so`)
}
told('a shape riding with a second black hole the film does not have', { duration: 4, intro: false, graphics: [{ kind: 'circle', center: { companion: [0, 0] }, radius: 1 }] }, 'second black hole')
told('a plot whose points are all outside its ranges', shapeFilm({ kind: 'plot', box: [0.1, 0.1, 0.3, 0.3], x: [0, 1], y: [0, 1], points: [[5, 5], [6, 6]] }), 'plot')
told('a plot whose marker reads a number that stands still', shapeFilm({ kind: 'plot', box: [0.1, 0.1, 0.3, 0.3], x: [0, 1], y: [0, 1], points: [[0, 0], [1, 1]], marker: 'lensingRadius' }), 'never changes')
const bare = attempt('a film that draws nothing', () => planFilm({ duration: 4, intro: false }))
if (bare && bare.graphics.length !== 0) problem('a film that draws nothing has shapes in its plan')

// 8d. The camera's pan: it works only while the camera is zoomed in, so a film that pans and never zooms in
// is told, and one that does both is not
told('a film that pans the camera and never zooms in', { duration: 4, intro: false, tracks: { cameraX: [[0, 0], [4, 3]] } }, 'zoomed in')
const panned = attempt('a film that zooms in and pans', () => planFilm({ duration: 4, intro: false, settings: { cameraZoom: 3, companionSize: 0.5 }, tracks: { cameraX: [[0, 0], [4, 3]], cameraY: [[0, 0], [4, -2]], cameraPair: [[0, -1], [4, 1]] } }))
if (panned && panned.notes.length > 0) problem(`a film that zooms in and pans: ${panned.notes.join('; ')}`)
for (const key of ['cameraX', 'cameraPair']) if (!FILM_GUIDE.includes(key)) problem(`the film guide has no recipe with "${key}"`)

// 8e. A reel: every kind of clip plans in one, the guide tells every key, kind and transition, a reel of one
// clip is as long as the clip, a dissolve shortens the reel by its seconds and never two scenes play when that
// is asked, a clip keeps what it was cut to, and everything wrong is told at once with the clip it is in.
// A new kind of clip fails here until it has a film below
const CLIP_FILMS = { film: { duration: 4, intro: false }, fractal: { duration: 4, target: 'spiral', depth: 6 } }
const reelOf = (what, reel) => attempt(what, () => planReel(reel))
for (const kind of CLIP_KINDS) {
  if (!CLIP_FILMS[kind]) {
    problem(`the audit has no film for a clip of the kind "${kind}": add one to CLIP_FILMS`)
    continue
  }
  const alone = reelOf(`a reel of one ${kind} clip`, { fps: 30, clips: [{ [kind]: CLIP_FILMS[kind] }] })
  if (alone && alone.frames !== 120) problem(`a reel of one ${kind} clip of 4 s at 30 fps is ${alone.frames} frames, not 120`)
}
for (const name of [...REEL_KEYS, ...CLIP_KEYS, ...TRANSITION_KEYS, ...REEL_TRANSITIONS]) {
  if (!REEL_GUIDE.includes(name)) problem(`the reel guide does not tell "${name}"`)
}
const joined = kind => ({ fps: 30, clips: [{ film: CLIP_FILMS.film }, { fractal: CLIP_FILMS.fractal, transition: { kind, seconds: 1 } }] })
for (const kind of REEL_TRANSITIONS) {
  const plan = reelOf(`a reel joined by ${kind}`, joined(kind))
  const frames = kind === 'dissolve' ? 210 : 240
  if (plan && plan.frames !== frames) problem(`two clips of 4 s joined by ${kind} are ${plan.frames} frames, not ${frames}`)
  if (plan && (plan.overlap > 0) !== (kind === 'dissolve')) problem(`a reel joined by ${kind} plays two scenes at once for ${plan.overlap} s`)
}
const single = reelOf('a reel that never plays two scenes', { ...joined('dissolve'), oneScene: true })
if (single && single.overlap !== 0) problem('a reel asked for one scene at a time still plays two')
const cutOut = reelOf('a clip cut out of its film', { fps: 30, clips: [{ film: CLIP_FILMS.film, from: 1, to: 3 }] })
if (cutOut && (cutOut.clips[0].fromFrame !== 30 || cutOut.clips[0].count !== 60)) problem(`a clip cut from 1 s to 3 s starts at frame ${cutOut.clips[0].fromFrame} and is ${cutOut.clips[0].count} frames`)
const ownFrame = reelOf('a clip that names a frame of its own', { fps: 30, clips: [{ film: { ...CLIP_FILMS.film, fps: 60, size: 'vertical' } }] })
if (ownFrame && ownFrame.notes.length === 0) problem('a clip that names a frame of its own is not told that the reel\'s is used')
const notReel = (what, reel) => {
  try {
    planReel(reel)
    problem(`${what} is taken as a reel`)
  } catch (error) {
    return String(error.message)
  }
  return ''
}
notReel('a reel with no clips', { clips: [] })
notReel('a clip that is both a film and a fractal', { clips: [{ film: CLIP_FILMS.film, fractal: CLIP_FILMS.fractal }] })
notReel('a first clip that dissolves', { clips: [{ film: CLIP_FILMS.film, transition: 'dissolve' }] })
notReel('a transition longer than half a clip', { clips: [{ film: CLIP_FILMS.film }, { film: CLIP_FILMS.film, transition: { kind: 'dissolve', seconds: 3 } }] })
notReel('a clip whose from is after its to', { clips: [{ film: CLIP_FILMS.film, from: 3, to: 1 }] })
notReel('a reel with an unknown key', { clips: [{ film: CLIP_FILMS.film }], clipz: 1 })
notReel('a clip with an unknown key', { clips: [{ film: CLIP_FILMS.film, form: 1 }] })
notReel('a transition with an unknown key', { clips: [{ film: CLIP_FILMS.film, transition: { kind: 'black', second: 1 } }] })
notReel('a reel of too many clips', { clips: Array.from({ length: MAX_REEL_CLIPS + 1 }, () => ({ film: CLIP_FILMS.film })) })
const several = notReel('a reel with mistakes in two clips', { clips: [{ film: { duration: 4, intro: false, nope: 1 } }, { fractal: { duration: 4, target: 'nowhere' } }] })
if (several && !(several.includes('clips[0].') && several.includes('clips[1].'))) problem(`a reel with mistakes in two clips does not tell both with their clip: ${several}`)
if (!isReel({ clips: [] }) || isReel({ duration: 4 })) problem('a description is not told from a reel by its clips')

// 9. The map names every knob, and names nothing that is gone. In references/knobs.md a name in
// backticks is a key, a layer, a preset, a font, a size or a caption place, and nothing else
const mapPath = path.join(here, '..', 'references', 'knobs.md')
const known = {
  setting: ALL_SETTING_KEYS,
  'intro parameter': INTRO_KEYS,
  'intro layer': [...INTRO_LAYERS],
  preset: presetNames,
  'intro preset': introPresetNames,
  'title font': Object.keys(TITLE_FONTS),
  'caption font': [...CAPTION_FONTS],
  'way a caption arrives': [...CAPTION_REVEALS],
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
  // A file the map points at (a film, a script) is held to being there, from the repository or the skill
  const isFile = name => /[\\/]/.test(name) || /\.(js|mjs|ts|tsx|json|md|mp4)$/.test(name)
  const skillDir = path.dirname(path.dirname(mapPath))
  for (const name of named) {
    if (isFile(name)) {
      if (![root, skillDir].some(dir => fs.existsSync(path.join(dir, name)))) problem(`knobs.md names the file \`${name}\`, which is not there`)
    } else if (!everyName.has(name)) problem(`knobs.md names \`${name}\`, which is no key, layer, preset, font, size or caption place of the scene`)
  }
}

if (process.argv.includes('--keys')) {
  const list = (title, names) => console.log(`${title} (${names.length}): ${names.join(' ')}\n`)
  list('Sliders', sliderKeys)
  list('Switches', switchKeys)
  list('Colours', settingColorKeys)
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
console.log(`Every knob is within reach: ${sliderKeys.length} sliders, ${switchKeys.length} switches, ${settingColorKeys.length} colours, ${otherKeys.length} other settings, ` +
  `${INTRO_KEYS.length} intro parameters, ${INTRO_LAYERS.length} layers a film switches (${CUE_LAYERS.length} of them events it fires again), ` +
  `${presetNames.length} presets, ${introPresetNames.length} intro presets. ` +
  `The scene reads ${sceneReads.length} settings, all of them settable; knobs.md names every one. ` +
  `A script says all of it in ${SCRIPT_WORDS.length} words. ` +
  `A fractal film falls into ${Object.keys(FRACTAL_TARGETS).length} targets in ${Object.keys(FRACTAL_PALETTES).length} palettes, ` +
  `moves ${FRACTAL_TRACK_KEYS.length} values along keyframes, and its script has ${FRACTAL_SCRIPT_WORDS.length} words.`)
