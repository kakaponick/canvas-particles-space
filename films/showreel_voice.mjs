// The narration of films/showreel.json: each line is spoken by VoiceStudio on this machine and laid over the
// soundtrack at its second, with the soundtrack turned down while the voice speaks.
//   node films/showreel_sound.mjs && node films/showreel_voice.mjs     writes films/showreel_voiced.wav
// Give that file to space_render as "audio". Takes are kept in films/voice/, so only a changed line is
// spoken again. VOICESTUDIO_URL=http://host:port names another VoiceStudio.
//   SHOWREEL_VOICE=sample.wav     speaks in the voice of that recording: up to 18 s of clean speech, with the
//                                 words said in it in sample.txt beside it
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const STUDIO = process.env.VOICESTUDIO_URL ?? 'http://127.0.0.1:3900'
const ENGINE = 'omnivoice'
const LANGUAGE = 'Russian'
// OmniVoice's refinement steps: more is cleaner and slower
const STEPS = 48
const SEED = 7
// Without SHOWREEL_VOICE the narrator is a designed voice, nobody's clone: one take made from these tags, which
// every line then takes as its reference, so the whole film is spoken by the same voice
const DESIGNED = {
  instruct: 'male, middle-aged, low pitch',
  text: 'Чёрная дыра гнёт свет, время и само пространство. Посмотрим, как это выглядит вблизи, шаг за шагом.'
}
// [second of the film the line starts at, what is said]. Words are spelled the way they are spoken
const LINES = [
  [3.4, 'Этот ролик сняла сама сцена, по сценарию из одного джейсон-файла.'],
  [8.4, 'Камера приближается к чёрной дыре. Подписи держатся за объекты сцены: вот её тень, а вот фотонное кольцо.'],
  [16.2, 'Любая настройка меняется по ключевым кадрам. Теперь линза гнёт свет от всего неба, и это видно по сетке.'],
  [23.4, 'Звёзды летят по настоящим орбитам, как звезда Эс-два у Стрельца А.'],
  [29.6, 'Лист показывает, как масса прогибает пространство.'],
  [34.2, 'Вторая чёрная дыра. Пара кружит вокруг общего центра.'],
  [38.6, 'Чем ближе, тем быстрее оборот и сильнее гравитационные волны.'],
  [43.2, 'Слияние. Новая чёрная дыра звенит и затихает.'],
  [47, 'Один сценарий — один ролик.']
]

const RATE = 48000
// Quiet between two lines, seconds
const GAP = 0.25
// The soundtrack's level under the voice, and the seconds it takes to go down and to come back
const UNDER_VOICE = 0.4
const DUCK = 0.35
const VOICE_PEAK = 0.8

const here = path.dirname(fileURLToPath(import.meta.url))
const takes = path.join(here, 'voice')

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
      const samples = Array.from({ length: channels }, () => new Float32Array(frames))
      for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels; channel++) {
          samples[channel][frame] = bytes.readInt16LE(at + 8 + (frame * channels + channel) * 2) / 32768
        }
      }
      return { rate, samples }
    }
    at += 8 + size + size % 2
  }
  throw new Error(`${file}: no sound in it`)
}

function writeWav (file, left, right) {
  const data = Buffer.alloc(left.length * 4)
  for (let frame = 0; frame < left.length; frame++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[frame])) * 32767), frame * 4)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[frame])) * 32767), frame * 4 + 2)
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

// A take as the film's rate, without the silence the engine leaves at its ends
function voiceOf (file) {
  const { rate, samples } = readWav(file)
  const mono = samples[0]
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
  for (let frame = 0; frame < length; frame++) {
    const position = from + frame * rate / RATE
    const index = Math.floor(position)
    const next = Math.min(index + 1, mono.length - 1)
    const value = mono[index] + (mono[next] - mono[index]) * (position - index)
    voice[frame] = value * Math.min(1, frame / fade, (length - 1 - frame) / fade)
  }
  return voice
}

// ---- VoiceStudio ----

// One take: the same request is spoken once and read from films/voice/ after that
async function take (fields, reference) {
  const voiceKey = reference ? crypto.createHash('sha1').update(fs.readFileSync(reference)).digest('hex') : ''
  const key = crypto.createHash('sha1').update(JSON.stringify([ENGINE, LANGUAGE, STEPS, SEED, voiceKey, fields])).digest('hex').slice(0, 12)
  const file = path.join(takes, `${key}.wav`)
  if (fs.existsSync(file)) return file

  const form = new FormData()
  form.set('engine', ENGINE)
  form.set('language', LANGUAGE)
  form.set('seed', String(SEED))
  form.set('num_step', String(STEPS))
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  if (reference) form.set('ref_audio', new Blob([fs.readFileSync(reference)], { type: 'audio/wav' }), 'voice.wav')

  let response
  try {
    response = await fetch(`${STUDIO}/generate`, { method: 'POST', body: form })
  } catch {
    throw new Error(`No VoiceStudio at ${STUDIO}. Start it, or set VOICESTUDIO_URL.`)
  }
  if (!response.ok) throw new Error(`VoiceStudio refused "${fields.text}": ${response.status} ${(await response.text()).slice(0, 300)}`)
  // VoiceStudio reports these two inside a successful answer
  const dropped = response.headers.get('x-omnivoice-dropped-text')
  if (dropped) throw new Error(`VoiceStudio left out part of "${fields.text}": ${dropped}`)
  if (response.headers.get('x-omnivoice-routing') === 'cpu_fallback') console.warn('  spoken on the processor, not the graphics card')
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  return file
}

// ---- the mix ----

const soundtrack = path.join(here, 'showreel.wav')
if (!fs.existsSync(soundtrack)) throw new Error('No films/showreel.wav. Run node films/showreel_sound.mjs first.')
const music = readWav(soundtrack)
if (music.rate !== RATE || music.samples.length !== 2) throw new Error('films/showreel.wav is not 48 kHz stereo')
const [left, right] = music.samples
const frames = left.length

fs.mkdirSync(takes, { recursive: true })
let reference = process.env.SHOWREEL_VOICE
let referenceText = DESIGNED.text
if (reference) {
  const words = reference.slice(0, reference.length - path.extname(reference).length) + '.txt'
  if (!fs.existsSync(reference)) throw new Error(`No recording at ${reference}`)
  if (!fs.existsSync(words)) throw new Error(`The words said in the recording are expected in ${words}`)
  referenceText = fs.readFileSync(words, 'utf8').trim()
} else {
  reference = await take(DESIGNED)
}
const voice = new Float32Array(frames)
const speaking = new Float32Array(frames)
let late = 0
for (let index = 0; index < LINES.length; index++) {
  const [at, text] = LINES[index]
  const spoken = voiceOf(await take({ text, ref_text: referenceText }, reference))
  const start = Math.round(at * RATE)
  const end = start + spoken.length
  const limit = index + 1 < LINES.length ? LINES[index + 1][0] - GAP : frames / RATE
  const spare = limit - end / RATE
  console.log(`${at.toFixed(1).padStart(5)} s  ${(spoken.length / RATE).toFixed(2)} s long, ${spare.toFixed(2)} s to spare  ${text}`)
  if (spare < 0) late++
  for (let frame = 0; frame < spoken.length && start + frame < frames; frame++) {
    voice[start + frame] += spoken[frame]
    speaking[start + frame] = 1
  }
}
if (late > 0) throw new Error(`${late} line(s) run into the next one: shorten them or move their seconds in LINES.`)

let peak = 0
for (const sample of voice) peak = Math.max(peak, Math.abs(sample))
const voiceGain = peak > 0 ? VOICE_PEAK / peak : 0

// The soundtrack goes down a moment before a line and comes back after it
const lead = Math.round(DUCK * RATE)
const step = 1 / lead
let under = 0
let loudest = 0
for (let frame = 0; frame < frames; frame++) {
  const ahead = speaking[Math.min(frame + lead, frames - 1)] > 0 || speaking[frame] > 0
  under = ahead ? Math.min(1, under + step) : Math.max(0, under - step)
  const level = 1 - (1 - UNDER_VOICE) * under * under * (3 - 2 * under)
  const said = voice[frame] * voiceGain
  left[frame] = left[frame] * level + said
  right[frame] = right[frame] * level + said
  loudest = Math.max(loudest, Math.abs(left[frame]), Math.abs(right[frame]))
}
if (loudest > 0.97) {
  const gain = 0.97 / loudest
  for (let frame = 0; frame < frames; frame++) {
    left[frame] *= gain
    right[frame] *= gain
  }
}

const out = path.join(here, 'showreel_voiced.wav')
writeWav(out, left, right)
console.log(`Wrote ${out}: ${LINES.length} lines, peak ${Math.min(loudest, 0.97).toFixed(2)}`)
