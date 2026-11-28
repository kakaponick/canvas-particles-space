// The narration of a film that is a reel: each line is spoken by VoiceStudio on this machine in the voice of
// a profile, and the film waits for it, since every clip reads the length of its lines as input and marks
// the second each one starts at (say() in the clips). A film's own script in its folder names what is said
// and by whom and calls voiceFilm, which reads the job from the command line:
//   node films/<film>/voice.mjs          speaks the lines not yet spoken and writes their lengths into the
//                                        reel, as each clip's input
//   node films/<film>/voice.mjs verify   has VoiceStudio write down every take and shows where the words
//                                        differ from the line
//   node films/<film>/voice.mjs mix      lays the takes at the seconds the clips marked and writes
//                                        films/<film>/out/<film>.wav: give it to space_render as "audio"
// A second word names another of the film's voices: "speak omnivoice" writes a copy of the reel paced by that
// voice's takes, films/<film>/voices/omnivoice.json, and "mix omnivoice" its sound; the film stays as it is.
// Takes are kept in films/voice/, so only a changed line is spoken again.
// A film that is one script (films/<film>/<film>.js, no reel) is voiced as a reel of that one clip: its LINES
// and its say() marks are read from the script, its lengths go only to films/voice/, and its sound is laid
// at the seconds it marks, so a line must end before the next one starts.
// VOICESTUDIO_URL=http://host:port names another VoiceStudio.
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { attachAudio } from './films.mjs'

const STUDIO = process.env.VOICESTUDIO_URL ?? 'http://127.0.0.1:3900'
const RATE = 48000
// The level every take is brought to, and the most the mix may reach
const VOICE_LEVEL = 0.11
const PEAK = 0.95

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const films = path.join(root, 'films')
const takes = path.join(films, 'voice')
// A film's own reel in its folder (films/README.md)
const reelOf = film => path.join(films, film, `${film}.json`)
// A reel, or a film that is one script read as a reel of that one clip
function readReel (film, file = reelOf(film)) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  if (fs.existsSync(path.join(films, film, `${film}.js`))) return { clips: [{ film: `films/${film}/${film}.js` }] }
  throw new Error(`No reel at ${file}`)
}

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

// A line's words as a recognizer writes them, in any alphabet; ё is written е as often as not
const words = text => text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)

// ---- what a reel's clips say ----

// The lines a reel's clips hold (each clip's own LINES) and the words its picture answers to (every
// cues[line][word] a clip asks for), read by playing each script with words that do nothing but keep the
// time. So a line is written once, in the clip that says it, and a cue is a word the clip itself names.
// A word is kept as the clip writes it, which is the name it will look it up by
export function linesOfReel (film) {
  const reel = readReel(film)
  const lines = {}
  const asked = {}
  for (const clip of reel.clips) {
    if (typeof clip.film !== 'string' || !clip.film.endsWith('.js')) continue
    const source = fs.readFileSync(path.join(root, clip.film), 'utf8')
    let clock = 0
    const play = work => { if (typeof work === 'function') work() }
    const pass = seconds => { clock += Math.max(0, Number(seconds) || 0) }
    const aside = work => { const kept = clock; play(work); clock = kept }
    const cues = new Proxy({}, {
      get: (_, line) => typeof line !== 'string'
        ? undefined
        : new Proxy({}, { get: (_, word) => { if (typeof word === 'string') (asked[line] ??= new Set()).add(word); return undefined } })
    })
    const nothing = () => {}
    const stage = {
      input: { lines: {}, cues },
      film: nothing, set: nothing, fire: nothing, title: nothing, hide: nothing, show: nothing, mark: nothing,
      opening: () => pass(6),
      wait: pass,
      to: (values, seconds) => pass(seconds),
      drive: (values, seconds) => pass(seconds),
      shot: (name, work) => play(work),
      slow: (speed, work) => play(work),
      caption: (text, last) => aside(last),
      draw: (shape, last) => aside(last),
      meanwhile: aside,
      at: (second, work) => { const kept = clock; if (typeof second === 'number') clock = second; play(work); clock = kept },
      together: (...parts) => {
        const from = clock
        let end = from
        for (const part of parts) { clock = from; play(part); end = Math.max(end, clock) }
        clock = end
      },
      now: () => clock,
      random: () => 0.5,
      pick: list => list[0],
      spring: share => share
    }
    try {
      // A clip with no LINES says nothing (credits): the name is then not there to return
      const own = new vm.Script(`(function () { ${source}\n; return typeof LINES === 'object' ? LINES : {} })()`, { filename: clip.film })
        .runInNewContext(stage, { timeout: 5000 })
      for (const [name, text] of Object.entries(own)) {
        if (name in lines && lines[name] !== text) throw new Error(`the line "${name}" is said two ways`)
        lines[name] = text
      }
    } catch (error) {
      throw new Error(`${clip.film} could not be read for its lines: ${error.message}`)
    }
  }
  // A cue is heard after the one before it, so the words go in the order the line says them
  const cues = {}
  for (const [name, set] of Object.entries(asked)) {
    if (!(name in lines)) continue
    const said = words(lines[name])
    const placed = [...set].map(word => [word, said.indexOf(words(word).join(''))])
    for (const [word, at] of placed) if (at < 0) console.warn(`  "${word}" is not a word of the line ${name}: its clip falls back on its guess`)
    cues[name] = placed.filter(([, at]) => at >= 0).sort((a, b) => a[1] - b[1]).map(([word]) => word)
  }
  return { lines, cues }
}

// ---- the three jobs ----

// film: the name of the reel's folder in films/. lines: what is said, by the name the clips call it by,
// spelled the way it is spoken. cues: the words the picture answers to, { line: ['word', ...] }: the second
// each is said at goes to the clips as input.cues[line][word]; a word the recognizer tends to mishear names
// what it hears instead after a bar ('w|double'), or in `heardAs` ({ w: ['double'] }).
// profile, language, seed, delivery: the VoiceStudio profile that speaks, and how.
// voices: the engines the film is spoken by: the one VoiceStudio is asked for, what it is told beside the
// line, and what tells its takes and files from the film's own (`own`). The film's voice is the first. A voice
// with `servers` is spoken by audio.cpp servers instead (a rented machine: scripts/drama3_server.sh), its `engine`
// the model's id there, cloning the profile's own recording; they speak at once, a line each.
// A voice may name its own VoiceStudio `profile`. A voice in another language names its `language` and its own
// `lines`, by the same names, and its `cues`, each
// 'word|the same word in its language' (as written in its line): the clips look the second up by the first.
// takes: what the names of the film's takes in films/voice/ begin with
export async function voiceFilm ({ film, lines: FILM_LINES, cues: FILM_CUES, heardAs = {}, profile: FILM_PROFILE, language: FILM_LANGUAGE, seed: SEED, delivery: DELIVERY, voices: VOICES, takes: TAKES = 'fd_' }) {
  const VOICE_NAME = process.argv[3] ?? Object.keys(VOICES)[0]
  const VOICE = VOICES[VOICE_NAME]
  if (!VOICE) throw new Error(`No voice "${VOICE_NAME}": ${Object.keys(VOICES).join(', ')}`)
  const LINES = VOICE.lines ?? FILM_LINES
  const CUES = VOICE.cues ?? FILM_CUES
  const LANGUAGE = VOICE.language ?? FILM_LANGUAGE
  // A voice may be another VoiceStudio profile's: its name
  const PROFILE = VOICE.profile ?? FILM_PROFILE
  // What this voice's files end in: nothing for the film's own
  const OF_VOICE = VOICE.own ? '' : '_' + VOICE_NAME
  // The film, whose clips every voice plays, and the reel this voice paces: the film itself for its own
  // voice, a copy in the film's voices/ for another
  const filmFile = reelOf(film)
  const reelFile = VOICE.own ? filmFile : path.join(films, film, 'voices', `${VOICE_NAME}.json`)
  const lengthsFile = path.join(takes, `${film}${OF_VOICE}_lines.json`)

  async function studio (route, options) {
    try {
      return await fetch(STUDIO + route, options)
    } catch {
      throw new Error(`No VoiceStudio at ${STUDIO}. Start it, or set VOICESTUDIO_URL.`)
    }
  }

  // A take is named by what made it, never by where: a server's address changes with every machine. The
  // VoiceStudio voice a film was first spoken by keeps the names its takes had before there were voices
  const NAMED = new Map(Object.entries(LINES).map(([name, text]) => [text, name]))
  const seedOf = text => VOICE.seeds?.[NAMED.get(text)] ?? SEED
  // What a server's model is given for a line: the line itself, or what the voice's say(name, text) makes of it
  // (Drama 3's bracketed delivery tags around and inside it). The words heard are checked against the line
  const inputOf = text => VOICE.say?.(NAMED.get(text), text) ?? text
  // The film's own VoiceStudio voice names a take by its delivery; a line given a seed of its own in `seeds` adds
  // it, so it is spoken again while every other take keeps its name
  const madeBy = (profile, text) => VOICE.own && !VOICE.servers
    ? [profile, LANGUAGE, SEED, DELIVERY, text, ...(seedOf(text) !== SEED ? [seedOf(text)] : [])]
    : [profile, LANGUAGE, seedOf(text), VOICE.engine, VOICE.fields, inputOf(text)]
  const takeFile = (profile, text) => path.join(takes, TAKES + crypto.createHash('sha1').update(JSON.stringify(madeBy(profile, text))).digest('hex').slice(0, 12) + '.wav')

  // The profile's own recording and its words, which a voice of an audio.cpp server is given with every line;
  // a voice with a `sample` ({ audio: a WAV path from the repository's root, text: its words, word for word })
  // takes that recording instead, and no VoiceStudio profile
  let sample = null
  async function sampleOf (profile) {
    if (sample) return sample
    if (VOICE.sample) {
      sample = { data: fs.readFileSync(path.join(root, VOICE.sample.audio)).toString('base64'), text: VOICE.sample.text }
      return sample
    }
    const profiles = await (await studio('/profiles')).json()
    const found = profiles.find(each => each.id === profile)
    const audio = await studio(`/profiles/${profile}/audio`)
    if (!audio.ok || !found?.ref_text) throw new Error(`VoiceStudio gave no recording with its words for the profile ${PROFILE}`)
    sample = { data: Buffer.from(await audio.arrayBuffer()).toString('base64'), text: found.ref_text }
    return sample
  }

  // One take from an audio.cpp server (VOICE.servers, the addresses of its /v1/audio/speech): the line, the
  // seed, and the profile's recording to clone
  async function serverTake (profile, name, text, server) {
    const file = takeFile(profile, text)
    const { data, text: said } = await sampleOf(profile)
    const started = Date.now()
    const response = await fetch(server.replace(/\/$/, '') + '/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: VOICE.engine, input: inputOf(text), voice_ref: { type: 'base64', data }, reference_text: said, seed: seedOf(text), ...VOICE.fields })
    }).catch(() => { throw new Error(`No audio.cpp server at ${server}`) })
    if (!response.ok) throw new Error(`${server} refused "${name}": ${response.status} ${(await response.text()).slice(0, 300)}`)
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    console.log(`  spoke ${name} in ${((Date.now() - started) / 1000).toFixed(1)} s on ${new URL(server).host}`)
    return file
  }

  // One take: a line is spoken once and read from films/voice/ after that. The engine is named in the request,
  // which leaves the one chosen in VoiceStudio as it is
  async function take (profile, name, text) {
    const file = takeFile(profile, text)
    if (fs.existsSync(file)) return file
    if (VOICE.servers) {
      if (!VOICE.servers.length) throw new Error(`"${name}" is not spoken yet, and no server is named to speak it`)
      return serverTake(profile, name, text, VOICE.servers[0])
    }
    const form = new FormData()
    form.set('text', text)
    form.set('language', LANGUAGE)
    form.set('profile_id', profile)
    form.set('seed', String(seedOf(text)))
    form.set('engine', VOICE.engine)
    for (const [field, value] of Object.entries(VOICE.fields)) form.set(field, value)
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

  // What names the voice in its takes: the VoiceStudio profile's id, or what a sample holds
  async function profileId () {
    if (VOICE.sample) return 'sample:' + crypto.createHash('sha1').update(fs.readFileSync(path.join(root, VOICE.sample.audio))).update(VOICE.sample.text).digest('hex').slice(0, 12)
    const profiles = await (await studio('/profiles')).json()
    const found = profiles.find(profile => profile.name.toLowerCase() === PROFILE.toLowerCase())
    if (!found) throw new Error(`VoiceStudio has no profile named ${PROFILE}: ${profiles.map(profile => profile.name).join(', ')}`)
    return found.id
  }

  // What VoiceStudio hears in a take, with the second of each word; kept beside the take
  async function heardIn (file) {
    const kept = file.replace(/\.wav$/, '.words.json')
    if (fs.existsSync(kept)) return JSON.parse(fs.readFileSync(kept, 'utf8'))
    const form = new FormData()
    form.set('file', new Blob([fs.readFileSync(file)], { type: 'audio/wav' }), 'take.wav')
    form.set('model', 'whisper-1')
    form.set('language', { English: 'en', Russian: 'ru' }[LANGUAGE] ?? 'en')
    form.set('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')
    const response = await studio('/v1/audio/transcriptions', { method: 'POST', body: form })
    if (!response.ok) throw new Error(`VoiceStudio refused to write down ${path.basename(file)}: ${response.status} ${(await response.text()).slice(0, 300)}`)
    const told = await response.json()
    const heard = { text: told.text.trim(), words: (told.words ?? []).map(each => [words(each.word).join(''), each.start]) }
    fs.writeFileSync(kept, JSON.stringify(heard) + '\n')
    return heard
  }

  async function speak () {
    fs.mkdirSync(takes, { recursive: true })
    const profile = await profileId()
    // Several servers speak at once, each taking the next line not yet spoken
    if (VOICE.servers) {
      const left = Object.entries(LINES).filter(([, text]) => !fs.existsSync(takeFile(profile, text)))
      await Promise.all(VOICE.servers.map(async server => {
        for (let next = left.shift(); next; next = left.shift()) await serverTake(profile, ...next, server)
      }))
    }
    const lengths = {}
    let total = 0
    for (const [name, text] of Object.entries(LINES)) {
      const voice = voiceOf(await take(profile, name, text))
      lengths[name] = +(voice.length / RATE).toFixed(2)
      total += lengths[name]
      // A take far slower than speech has silence in it the voice never left (Drama 3 can stall at a
      // sentence's end): verify shows its words, and a seed of its own in `seeds` speaks it again
      const pace = words(text).length / lengths[name] * 60
      if (pace < 100) console.warn(`  ${name} goes at ${pace.toFixed(0)} words a minute: listen for a long silence in it`)
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
        // The word as the recognizer writes it, and what it is known to hear in its place
        const spoken = words(key).join('')
        const takenFor = [spoken, ...others.map(other => words(other).join('')), ...(heardAs[spoken] ?? [])]
        const found = said.findIndex(([each], index) => index > after && takenFor.includes(each))
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
    if (fs.existsSync(filmFile)) {
      // Another voice's reel is the film's clips over again with that voice's lengths, so a change to the
      // film's clips reaches the copy the next time it is spoken
      const reel = JSON.parse(fs.readFileSync(filmFile, 'utf8'))
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
      fs.mkdirSync(path.dirname(reelFile), { recursive: true })
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
    const reel = readReel(film, reelFile)
    const space = path.join(root, '.claude', 'skills', 'space-scene', 'scripts', 'space.mjs')
    const marks = {}
    let at = 0
    let length = 0
    for (const clip of reel.clips) {
      const of = clip.film ?? clip.fractal
      // A clip written into the reel itself says nothing: its length is in it
      const file = typeof of === 'string' ? of : `the ${clip.name} written in the reel`
      const told = typeof of === 'string'
        ? execFileSync(process.execPath, [space, clip.film ? 'check' : 'fractal-check', path.join(root, of), '--input', lengthsFile], { cwd: root, encoding: 'utf8' })
        : `The film: ${of.duration} s`
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
    const out = path.join(films, film, 'out', `${film}${OF_VOICE}.wav`)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    writeWav(out, sound)
    console.log(`Wrote ${out}: ${order.length} lines over ${duration.toFixed(1)} s`)
    // The same sound for the page, which plays it under the film (films/README.md, "audio"): one channel, since
    // the wav repeats the voice in both
    try {
      const paced = fs.existsSync(reelFile) ? path.relative(path.join(films, film), reelFile).replaceAll(path.sep, '/') : `${film}.js`
      const page = attachAudio({ film, file: paced, sound: out, mono: true })
      console.log(`Wrote ${page}: the sound the page plays under ${paced}; commit it with the film`)
    } catch (error) {
      console.warn(`The page's copy of the sound was not made: ${error.message}`)
    }
  }

  // The lines this voice has not spoken yet and their words, asking no server: what a rented machine would be
  // given, to count before it is rented
  async function plan () {
    const profile = await profileId()
    const left = Object.entries(LINES).filter(([, text]) => !fs.existsSync(takeFile(profile, text)))
    const count = text => text.split(/\s+/).filter(Boolean).length
    const total = left.reduce((sum, [, text]) => sum + count(text), 0)
    console.log(`${VOICE_NAME}: ${left.length} of ${Object.keys(LINES).length} lines to speak, ${total} words`)
    for (const [name, text] of left) console.log(`  ${name} (${count(text)}): ${text}`)
  }

  const job = process.argv[2] ?? 'speak'
  if (job === 'speak') await speak()
  else if (job === 'verify') await verify()
  else if (job === 'mix') await mix()
  else if (job === 'plan') await plan()
  else throw new Error('speak (the default), verify, mix or plan')
}
