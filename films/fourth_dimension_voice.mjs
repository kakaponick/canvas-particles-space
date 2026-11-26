// The narration of films/fourth_dimension.json, a reel: each line is spoken by VoiceStudio on this machine in
// the voice of the profile named below, and the film waits for it, since every clip reads the length of its
// lines as input and marks the second each one starts at (say() in the clips).
//   node films/fourth_dimension_voice.mjs          speaks the lines not yet spoken and writes their lengths
//                                                  into the reel, as each clip's input
//   node films/fourth_dimension_voice.mjs verify   has VoiceStudio write down every take and shows where the
//                                                  words differ from the line
//   node films/fourth_dimension_voice.mjs mix      lays the takes at the seconds the clips marked and writes
//                                                  films/fourth_dimension.wav: give it to space_render as "audio"
// Takes are kept in films/voice/, so only a changed line is spoken again. VOICESTUDIO_URL=http://host:port
// names another VoiceStudio.
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const STUDIO = process.env.VOICESTUDIO_URL ?? 'http://127.0.0.1:3900'
const PROFILE = 'Theo'
const LANGUAGE = 'English'
const SEED = 7
// The delivery: without it the profile speaks at 220 words a minute, with it at about 155
const DELIVERY = 'Speak slowly and calmly, in a low voice full of wonder, like the narrator of a space documentary. Pause between sentences.'

// What is said, by the name the clips call it by. Words are spelled the way they are spoken
const LINES = {
  // the ladder
  taught: 'You were taught that space has three dimensions. Length. Width. And height.',
  fourth: 'But one hypothesis says there is a fourth. And that you have felt it every second of your life.',
  point: 'Start with a point. Zero dimensions.',
  line: 'Pull that point in one direction, and it becomes a line.',
  square: 'Pull the line in a new direction. A square.',
  cube: 'Once more. A cube.',
  rule: 'The rule is simple. Each new dimension is one more direction.',
  taken: 'So where does the fourth one point? Up, sideways, forward. Every direction we know is already taken.',
  inward: 'Only one way is left. Inward. Place a copy of the cube inside the cube, and join their corners.',
  hypercube: 'This is a hypercube. And the red lines are the fourth dimension.',
  ends: 'In the fourth dimension, inside and outside are two ends of one direction.',
  // the well
  limit: 'To find that direction in the real world, we need a place where gravity is pushed to its limit.',
  hole: 'A black hole. This is how we picture one today. A shadow, a ring of light, and a sky bent around it.',
  textbook: 'And this is how every textbook draws its gravity. A sheet of space, with a well in it.',
  axes: 'Two of the axes, X and Y, are space. The third, call it W, is gravity.',
  literally: 'Physicists call the well just a picture. This hypothesis takes it literally.',
  down: 'But then the well goes down. Down into what?',
  rise: "Let's change the angle. Rise above the sheet, and look straight down.",
  vanished: 'The well is gone. But its depth is not. Each ring is one step down the well. And from above, the steps crowd toward the centre.',
  circle: 'The depth is still here. It simply points inward. A circle inside a circle, and W is the line between them. Just like the cube inside the cube.',
  creature: 'Now imagine a creature living inside this sheet. Completely flat. It cannot look down into the well. It has no word for down. It only knows that everything slides toward the centre.',
  we: 'We are that creature. Our sheet just has three dimensions.',
  falls: 'And the well we cannot see, falls into a fourth dimension.',
  everywhere: 'The fourth dimension is not somewhere far away. It points inward. Toward every star. Toward every planet. Toward the ground beneath your feet.',
  weight: 'You cannot see it. But you can feel it. You call it weight.',
  // what follows
  stretch: 'If the hypothesis is right, gravity does not curve space, as Einstein proposed. It stretches it, along W.',
  ripple: 'And space that can stretch can also ripple. In twenty fifteen, we caught such a ripple, from two black holes merging more than a billion light years away.',
  proton: 'It stretched the space around us by a thousandth of the width of a proton.',
  star: 'And at the bottom of the well? Take a neutron star. A heavy object, resting at the bottom of a deep well.',
  object: 'Add more mass, and the well grows deeper. Until even light cannot climb out. That is a black hole. Not a hole in space. An object, as simple as a neutron star.',
  nothing: 'So nothing has to break. The singularity. The wormhole. The white hole. In our nature, most likely, none of them is possible. There is only a well, and a simple object resting at the bottom of it.',
  // the experiment
  test: 'Is there a way to test this? In twenty twenty-one, an atomic clock caught time running at different speeds across a single millimetre of height.',
  ruler: 'If we can build an atomic clock, we can build an atomic ruler. Picture a coil of superconductor, almost three hundred thousand kilometres long. Exactly the distance light travels in one second.',
  photon: 'Send a photon through it on Earth, deep in the well. Then far out in space, where the well is almost flat. And time it.',
  answers: 'Relativity says: one second, both times. The hypothesis says: out there, where matter is no longer squeezed along W, the photon needs more than one second.',
  question: 'Would matter really shrink? Even the author of the hypothesis calls that an open question. One coil. One photon. One second, or a little more.',
  // the fall
  hypothesis: 'For now, this is only a hypothesis. It still has to face the equations, and the experiments.',
  falling: 'But the next time you feel your own weight, remember. There may be a direction you cannot point to. And you are already falling into it.'
}

// The words the picture answers to: the second each is said at goes to the clips as input.cues[line][word].
// A word the recognizer tends to mishear names what it hears instead after a bar
const CUES = {
  taught: ['length', 'width|with', 'height'],
  taken: ['up', 'sideways', 'forward', 'every'],
  inward: ['inward', 'place'],
  hypercube: ['red'],
  hole: ['shadow', 'ring', 'sky'],
  textbook: ['sheet', 'well'],
  axes: ['x', 'y', 'w|double'],
  down: ['down'],
  rise: ['rise'],
  vanished: ['depth', 'ring', 'above'],
  circle: ['inward', 'circle', 'w|double', 'cube'],
  creature: ['flat', 'look', 'slides'],
  we: ['three'],
  falls: ['falls'],
  everywhere: ['inward', 'star', 'planet', 'ground'],
  weight: ['feel', 'weight|wait'],
  stretch: ['stretches'],
  ripple: ['ripple', 'two'],
  proton: ['proton'],
  star: ['neutron|new'],
  object: ['deeper', 'light', 'black', 'object'],
  nothing: ['singularity', 'wormhole', 'white', 'likely', 'well', 'simple'],
  test: ['clock', 'millimetre|millimeter'],
  ruler: ['ruler', 'coil', 'second'],
  photon: ['earth', 'space', 'time'],
  answers: ['relativity', 'hypothesis', 'more'],
  question: ['question', 'coil', 'photon', 'second'],
  falling: ['remember', 'falling']
}

const RATE = 48000
// The level every take is brought to, and the most the mix may reach
const VOICE_LEVEL = 0.11
const PEAK = 0.95

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const takes = path.join(here, 'voice')
const reelFile = path.join(here, 'fourth_dimension.json')
const lengthsFile = path.join(takes, 'fourth_dimension_lines.json')

// ---- wav ----

function readWav (file) {
  const bytes = fs.readFileSync(file)
  let rate = 0
  let channels = 0
  let bits = 0
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = bytes.toString('latin1', at, at + 4)
    const size = bytes.readUInt32LE(at + 4)
    if (id === 'fmt ') {
      channels = bytes.readUInt16LE(at + 10)
      rate = bytes.readUInt32LE(at + 12)
      bits = bytes.readUInt16LE(at + 22)
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`${file}: ${bits}-bit sound, 16-bit expected`)
      const frames = Math.floor(Math.min(size, bytes.length - at - 8) / (2 * channels))
      const mono = new Float32Array(frames)
      for (let frame = 0; frame < frames; frame++) mono[frame] = bytes.readInt16LE(at + 8 + frame * channels * 2) / 32768
      return { rate, mono }
    }
    at += 8 + size + size % 2
  }
  throw new Error(`${file}: no sound in it`)
}

function writeWav (file, mono) {
  const data = Buffer.alloc(mono.length * 4)
  for (let frame = 0; frame < mono.length; frame++) {
    const sample = Math.round(Math.max(-1, Math.min(1, mono[frame])) * 32767)
    data.writeInt16LE(sample, frame * 4)
    data.writeInt16LE(sample, frame * 4 + 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(2, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([header, data]))
}

// A take at the film's rate, without the silence the engine leaves at its ends, at the level of the others;
// `lead` is the seconds cut from its start
function voiceOf (file) {
  const { rate, mono } = readWav(file)
  let from = 0
  let to = mono.length
  while (from < to && Math.abs(mono[from]) < 0.01) from++
  while (to > from && Math.abs(mono[to - 1]) < 0.01) to--
  const edge = Math.round(rate * 0.03)
  from = Math.max(0, from - edge)
  to = Math.min(mono.length, to + edge)
  const length = Math.floor((to - from) * RATE / rate)
  const voice = new Float32Array(length)
  const fade = Math.round(RATE * 0.01)
  let power = 0
  for (let frame = 0; frame < length; frame++) {
    const position = from + frame * rate / RATE
    const index = Math.floor(position)
    const next = Math.min(index + 1, mono.length - 1)
    const value = mono[index] + (mono[next] - mono[index]) * (position - index)
    voice[frame] = value * Math.min(1, frame / fade, (length - 1 - frame) / fade)
    power += voice[frame] * voice[frame]
  }
  const level = Math.sqrt(power / Math.max(1, length))
  const gain = level > 0 ? VOICE_LEVEL / level : 0
  for (let frame = 0; frame < length; frame++) voice[frame] *= gain
  voice.lead = from / rate
  return voice
}

// ---- VoiceStudio ----

async function studio (route, options) {
  try {
    return await fetch(STUDIO + route, options)
  } catch {
    throw new Error(`No VoiceStudio at ${STUDIO}. Start it, or set VOICESTUDIO_URL.`)
  }
}

const takeFile = (profile, text) => path.join(takes, 'fd_' + crypto.createHash('sha1').update(JSON.stringify([profile, LANGUAGE, SEED, DELIVERY, text])).digest('hex').slice(0, 12) + '.wav')

// One take: a line is spoken once and read from films/voice/ after that
async function take (profile, name, text) {
  const file = takeFile(profile, text)
  if (fs.existsSync(file)) return file
  const form = new FormData()
  form.set('text', text)
  form.set('language', LANGUAGE)
  form.set('profile_id', profile)
  form.set('seed', String(SEED))
  form.set('instruct', DELIVERY)
  const started = Date.now()
  const response = await studio('/generate', { method: 'POST', body: form })
  if (!response.ok) throw new Error(`VoiceStudio refused "${name}": ${response.status} ${(await response.text()).slice(0, 300)}`)
  // VoiceStudio reports these two inside a successful answer
  const dropped = response.headers.get('x-omnivoice-dropped-text')
  if (dropped) throw new Error(`VoiceStudio left out part of "${name}": ${dropped}`)
  if (response.headers.get('x-omnivoice-routing') === 'cpu_fallback') console.warn('  spoken on the processor, not the graphics card')
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  console.log(`  spoke ${name} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  return file
}

async function profileId () {
  const profiles = await (await studio('/profiles')).json()
  const found = profiles.find(profile => profile.name.toLowerCase() === PROFILE.toLowerCase())
  if (!found) throw new Error(`VoiceStudio has no profile named ${PROFILE}: ${profiles.map(profile => profile.name).join(', ')}`)
  return found.id
}

const words = text => text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)

// What VoiceStudio hears in a take, with the second of each word; kept beside the take
async function heardIn (file) {
  const kept = file.replace(/\.wav$/, '.words.json')
  if (fs.existsSync(kept)) return JSON.parse(fs.readFileSync(kept, 'utf8'))
  const form = new FormData()
  form.set('file', new Blob([fs.readFileSync(file)], { type: 'audio/wav' }), 'take.wav')
  form.set('model', 'whisper-1')
  form.set('language', 'en')
  form.set('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  const response = await studio('/v1/audio/transcriptions', { method: 'POST', body: form })
  if (!response.ok) throw new Error(`VoiceStudio refused to write down ${path.basename(file)}: ${response.status} ${(await response.text()).slice(0, 300)}`)
  const told = await response.json()
  const heard = { text: told.text.trim(), words: (told.words ?? []).map(each => [words(each.word).join(''), each.start]) }
  fs.writeFileSync(kept, JSON.stringify(heard) + '\n')
  return heard
}

// ---- the three jobs ----

async function speak () {
  fs.mkdirSync(takes, { recursive: true })
  const profile = await profileId()
  const lengths = {}
  let total = 0
  for (const [name, text] of Object.entries(LINES)) {
    const voice = voiceOf(await take(profile, name, text))
    lengths[name] = +(voice.length / RATE).toFixed(2)
    total += lengths[name]
  }
  // The cues are asked for after every line is spoken: the recognizer and the voice push each other off the card
  const cues = {}
  for (const [name, wanted] of Object.entries(CUES)) {
    const file = takeFile(profile, LINES[name])
    const { words: said } = await heardIn(file)
    const lead = voiceOf(file).lead
    cues[name] = {}
    let after = -1
    for (const word of wanted) {
      const [key, ...others] = word.split('|')
      const found = said.findIndex(([each], index) => index > after && [key, ...others].includes(each))
      if (found < 0) {
        console.warn(`  "${key}" was not heard in ${name}: the clip falls back on its guess`)
        continue
      }
      after = found
      cues[name][key] = +Math.max(0, said[found][1] - lead).toFixed(2)
    }
  }
  fs.writeFileSync(lengthsFile, JSON.stringify({ lines: lengths, cues }, null, 1) + '\n')
  console.log(`${Object.keys(LINES).length} lines, ${total.toFixed(1)} s of speech. Wrote ${lengthsFile}`)
  if (fs.existsSync(reelFile)) {
    const reel = JSON.parse(fs.readFileSync(reelFile, 'utf8'))
    // Each clip is given the lines its own script names, written on one line of the reel
    const given = []
    for (const clip of reel.clips) {
      if (typeof clip.film !== 'string') continue
      const script = fs.readFileSync(path.join(root, clip.film), 'utf8')
      const said = name => script.includes(`'${name}'`) || script.includes(`lines.${name} `)
      const own = list => Object.fromEntries(Object.entries(list).filter(([name]) => said(name)))
      clip.input = `input ${given.length}`
      given.push(JSON.stringify({ lines: own(lengths), cues: own(cues) }))
    }
    const text = JSON.stringify(reel, null, 2).replace(/"input (\d+)"/g, (whole, index) => given[index])
    fs.writeFileSync(reelFile, text + '\n')
    console.log(`Wrote the lengths into ${reelFile}`)
  }
}

async function verify () {
  const profile = await profileId()
  let off = 0
  for (const [name, text] of Object.entries(LINES)) {
    const file = takeFile(profile, text)
    if (!fs.existsSync(file)) throw new Error(`"${name}" is not spoken yet`)
    const heard = (await heardIn(file)).text
    const said = words(text)
    const got = words(heard)
    const missing = said.filter(word => !got.includes(word))
    const extra = got.filter(word => !said.includes(word))
    const seconds = (voiceOf(file).length / RATE).toFixed(1)
    if (missing.length + extra.length > 0) off++
    console.log(`${missing.length + extra.length > 0 ? '≠' : '='} ${name} (${seconds} s, ${(said.length / seconds * 60).toFixed(0)} wpm)${missing.length ? `  not heard: ${missing.join(' ')}` : ''}${extra.length ? `  heard instead: ${extra.join(' ')}` : ''}`)
    if (missing.length + extra.length > 0) console.log(`    ${heard}`)
  }
  console.log(`${off} of ${Object.keys(LINES).length} lines were heard differently from how they are written`)
}

// The second each clip of the reel starts at, and the seconds its script marked
function reelMarks () {
  const reel = JSON.parse(fs.readFileSync(reelFile, 'utf8'))
  const space = path.join(root, '.claude', 'skills', 'space-scene', 'scripts', 'space.mjs')
  const marks = {}
  let at = 0
  let length = 0
  for (const clip of reel.clips) {
    const film = clip.film ?? clip.fractal
    // A clip written into the reel itself says nothing: its length is in it
    const file = typeof film === 'string' ? film : `the ${clip.name} written in the reel`
    const told = typeof film === 'string'
      ? execFileSync(process.execPath, [space, clip.film ? 'check' : 'fractal-check', path.join(root, film), '--input', lengthsFile], { cwd: root, encoding: 'utf8' })
      : `The film: ${film.duration} s`
    const duration = +(/The film: ([\d.]+) s/.exec(told)?.[1] ?? NaN)
    if (!(duration > 0)) throw new Error(`${file}: the check told no length:\n${told}`)
    const from = clip.from ?? 0
    const to = clip.to ?? duration
    // A dissolve plays over the end of the clip before it; a cut and a fade through black follow it
    at += length - (clip.transition?.kind === 'dissolve' ? clip.transition.seconds : 0)
    length = to - from
    for (const [, mark, second] of (/Marks: (.*)/.exec(told)?.[1] ?? '').matchAll(/([^,]+?) ([\d.]+) s(?:, |$)/g)) {
      if (mark.startsWith('say:')) marks[mark.slice(4)] = at + +second - from
    }
    console.log(`${at.toFixed(2).padStart(7)} s  ${file}, ${length.toFixed(2)} s`)
  }
  return { marks, duration: at + length }
}

async function mix () {
  const profile = await profileId()
  const { marks, duration } = reelMarks()
  const sound = new Float32Array(Math.ceil(duration * RATE))
  const order = Object.keys(LINES).filter(name => name in marks).sort((a, b) => marks[a] - marks[b])
  const unsaid = Object.keys(LINES).filter(name => !(name in marks))
  if (unsaid.length > 0) console.warn(`No clip says: ${unsaid.join(', ')}`)
  let late = 0
  order.forEach((name, index) => {
    const file = takeFile(profile, LINES[name])
    if (!fs.existsSync(file)) throw new Error(`"${name}" is not spoken yet: run this without "mix" first`)
    const voice = voiceOf(file)
    const start = Math.round(marks[name] * RATE)
    const next = index + 1 < order.length ? marks[order[index + 1]] : duration
    const spare = next - (start + voice.length) / RATE
    if (spare < 0) late++
    console.log(`${marks[name].toFixed(2).padStart(7)} s  ${(voice.length / RATE).toFixed(2)} s long, ${spare.toFixed(2)} s to spare  ${name}`)
    for (let frame = 0; frame < voice.length && start + frame < sound.length; frame++) sound[start + frame] += voice[frame]
  })
  if (late > 0) throw new Error(`${late} line(s) run into the next one: the clips must wait for each line they say.`)
  let peak = 0
  for (const sample of sound) peak = Math.max(peak, Math.abs(sample))
  const gain = peak > 0 ? PEAK / peak : 0
  for (let frame = 0; frame < sound.length; frame++) sound[frame] *= gain
  const out = path.join(here, 'fourth_dimension.wav')
  writeWav(out, sound)
  console.log(`Wrote ${out}: ${order.length} lines over ${duration.toFixed(1)} s`)
}

const job = process.argv[2] ?? 'speak'
if (job === 'speak') await speak()
else if (job === 'verify') await verify()
else if (job === 'mix') await mix()
else throw new Error('speak (the default), verify or mix')
