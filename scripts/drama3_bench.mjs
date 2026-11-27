// A benchmark of Fish Audio Drama 3's settings on our film: twelve lines of films/fourth_dimension_pop (one per
// chapter), each voice saying them in its own language, under a baseline and, one axis at a time, its variants:
// the package (Q2_K, Q3_K_S against Q4_K_S), the perf mode (off against cuda_perf), temperature, top_p, the seed,
// the sample's length (its first 5 and 10 s, cut at a word, against the whole) and a delivery written as tags.
// Two pods on Runpod (scripts/drama3_server.sh): one holds two baseline servers for the request-level variants,
// the other a server per model-level variant. Each take is timed against the length of its speech, each pod is
// deleted whatever happened, and then VoiceStudio writes every take down to count the words heard otherwise.
// Everything goes to films/voice/bench/<date>/ (out of git): the takes, results.json.
//   RUNPOD_KEY_FILE=<file holding a Runpod API key> node scripts/drama3_bench.mjs [--dry]
// --dry cuts the samples and lists the jobs without renting anything.
// VoiceStudio (VOICESTUDIO_URL, default http://127.0.0.1:3900) gives the voices' recordings and writes the takes
// down: run it while no other client works it.
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { linesOfReel } from './voice.mjs'
import { GPUS, PORTS, api, deletePod, get, startDrama3Pod } from './drama3_pod.mjs'
import * as ru from '../films/fourth_dimension_pop_ru.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STUDIO = process.env.VOICESTUDIO_URL ?? 'http://127.0.0.1:3900'
const NAMES = ['opposite', 'pattern', 'copy', 'anatomy', 'textbook', 'rings', 'blind', 'source', 'bold', 'ruler', 'facts', 'edge']
// The kind of claim each line makes on the screen, for the delivery that follows it
const STATUS = { opposite: 'known', pattern: 'math', copy: 'math', anatomy: 'known', textbook: 'known', rings: 'math', blind: 'idea', source: 'known', bold: 'idea', ruler: 'idea', facts: 'known', edge: 'idea' }
const STATUS_TAG = { known: '[plain and matter-of-fact] ', math: '[clear and patient] ', idea: '[leaning in, a little excited] ' }
const VOICES = {
  theo: { profile: 'Theo', language: 'en' },
  ru: { profile: 'YouTube · QxkFrDTCKxg_3594f32f', language: 'ru' }
}
// The pods and their servers (DRAMA3_SET), and each variant: its pod and server, what the request adds, the
// sample it clones, the tag before each line
const PODS = { base: 'Q4_K_S:cuda_perf,Q4_K_S:cuda_perf', model: 'Q4_K_S:off,Q3_K_S:cuda_perf,Q2_K:cuda_perf' }
const VARIANTS = {
  base: { pod: 'base' },
  q3: { pod: 'model', server: 1 },
  q2: { pod: 'model', server: 2 },
  perf_off: { pod: 'model', server: 0 },
  temp_07: { pod: 'base', options: { temperature: 0.7 } },
  temp_13: { pod: 'base', options: { temperature: 1.3 } },
  top_p_08: { pod: 'base', options: { top_p: 0.8 } },
  top_p_097: { pod: 'base', options: { top_p: 0.97 } },
  seed_11: { pod: 'base', seed: 11 },
  seed_23: { pod: 'base', seed: 23 },
  sample_5: { pod: 'base', sample: 5 },
  sample_10: { pod: 'base', sample: 10 },
  tag_status: { pod: 'base', tag: line => STATUS_TAG[STATUS[line]] },
  tag_skeptic: { pod: 'base', tag: () => '[dry and amused, a little skeptical] ' }
}
const BOOT_LIMIT = 20 * 60e3
const LINE_LIMIT = 5 * 60e3

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const seconds = ms => +(ms / 1000).toFixed(1)
const words = text => text.toLowerCase().replace(/ё/g, 'е').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean)
// A 16-bit WAV's rate, its frames' size and where its sound lies
function wavOf (wav) {
  const rate = wav.readUInt32LE(24)
  const block = wav.readUInt16LE(32)
  for (let at = 12; at + 8 <= wav.length;) {
    const size = wav.readUInt32LE(at + 4)
    if (wav.toString('latin1', at, at + 4) === 'data') return { rate, block, start: at + 8, size: Math.min(size, wav.length - at - 8) }
    at += 8 + size + size % 2
  }
  throw new Error('no sound in the WAV')
}
const lengthOf = wav => { const { rate, block, size } = wavOf(wav); return size / block / rate }
function cutWav (wav, end) {
  const { rate, block, start, size } = wavOf(wav)
  const bytes = Math.min(size, Math.round(end * rate) * block)
  const head = Buffer.from(wav.subarray(0, start))
  head.writeUInt32LE(bytes, start - 4)
  head.writeUInt32LE(start - 8 + bytes, 4)
  return Buffer.concat([head, wav.subarray(start, start + bytes)])
}
async function transcribe (wav, language) {
  const form = new FormData()
  form.set('file', new Blob([wav], { type: 'audio/wav' }), 'take.wav')
  form.set('model', 'whisper-1')
  form.set('language', language)
  form.set('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  const response = await fetch(STUDIO + '/v1/audio/transcriptions', { method: 'POST', body: form })
  if (!response.ok) throw new Error(`VoiceStudio refused to write a take down: ${response.status}`)
  return response.json()
}

// The voices' recordings, whole and cut at the last word that ends by 5 and by 10 s, with their words
async function samplesOf (voice, out) {
  const profiles = await (await fetch(STUDIO + '/profiles')).json()
  const found = profiles.find(profile => profile.name === voice.profile)
  if (!found) throw new Error(`VoiceStudio has no profile ${voice.profile}`)
  const wav = Buffer.from(await (await fetch(`${STUDIO}/profiles/${found.id}/audio`)).arrayBuffer())
  const heard = await transcribe(wav, voice.language)
  const samples = { full: { wav, text: found.ref_text, seconds: +lengthOf(wav).toFixed(1) } }
  for (const limit of [5, 10]) {
    const kept = heard.words.filter(each => each.end <= limit)
    const end = kept.at(-1).end + 0.15
    samples[limit] = { wav: cutWav(wav, end), text: kept.map(each => each.word.trim()).join(' '), seconds: +end.toFixed(1) }
    fs.writeFileSync(path.join(out, `${voice.key}_sample_${limit}.wav`), samples[limit].wav)
  }
  return samples
}


// One pod's work: wait for its servers, load each with one line, then speak every job, each server taking the
// next job meant for it
async function work (name, jobs, info) {
  const created = Date.now()
  const pod = await startDrama3Pod(`drama3-bench-${name}`, PODS[name])
  Object.assign(info, { card: pod.card, pod: pod.id, dataCenter: pod.dataCenterId, pricePerHour: pod.cost, set: PODS[name] })
  console.log(`${name}: pod ${pod.id} on ${pod.card} in ${pod.dataCenterId}, $${pod.cost}/h`)
  const at = port => `https://${pod.id}-${port}.proxy.runpod.net`
  const servers = PODS[name].split(',').map((_, index) => at(PORTS[index]))
  let watching = true
  let peak = 0
  const watch = (async () => {
    while (watching) {
      const smi = await get(at(8082) + '/smi.txt')
      if (smi) { peak = Math.max(peak, Number(smi.split(',')[0]) || 0); info.memoryTotal = Number(smi.split(',')[1]) }
      await sleep(3000)
    }
  })()
  try {
    for (;;) {
      if (Date.now() - created > BOOT_LIMIT) throw new Error('the servers did not answer in 20 minutes')
      if ((await Promise.all(servers.map(server => get(server + '/health')))).every(Boolean)) break
      await sleep(5000)
    }
    info.bootSeconds = seconds(Date.now() - created)
    info.stages = ((await get(at(8082) + '/stages.txt')) ?? '').trim().split('\n')
    info.gpu = ((await get(at(8082) + '/gpu.txt')) ?? '').trim()
    console.log(`${name}: up in ${info.bootSeconds} s`)
    for (const group of jobs) await Promise.all(servers.map(async (server, index) => {
      for (const job of group.filter(each => each.server === index)) {
        const began = Date.now()
        try {
          const response = await fetch(server + '/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job.body),
            signal: AbortSignal.timeout(LINE_LIMIT)
          })
          const wav = Buffer.from(await response.arrayBuffer())
          if (!response.ok) throw new Error(`${response.status} ${wav.toString().slice(0, 200)}`)
          fs.mkdirSync(path.dirname(job.file), { recursive: true })
          fs.writeFileSync(job.file, wav)
          Object.assign(job.result, { work: seconds(Date.now() - began), speech: +lengthOf(wav).toFixed(2), server: index })
        } catch (error) {
          job.result.error = error.message
          console.log(`${name}: ${job.label}: ${error.message}`)
        }
      }
    }))
  } catch (error) {
    info.error = error.message
    console.log(`${name}: ${error.message}`)
  } finally {
    watching = false
    await watch
    info.memoryPeak = peak || null
    try { await deletePod(pod.id) } catch (error) { info.deleteError = error.message }
    info.lifeSeconds = seconds(Date.now() - created)
    info.costEstimate = +(pod.cost * info.lifeSeconds / 3600).toFixed(3)
    console.log(`${name}: deleted after ${info.lifeSeconds} s`)
  }
}

const out = path.join(root, 'films', 'voice', 'bench', new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace(/[:T]/g, '-'))
fs.mkdirSync(out, { recursive: true })
const { lines: english } = linesOfReel('fourth_dimension_pop')
const texts = { theo: english, ru: ru.LINES }
const samples = {}
for (const [key, voice] of Object.entries(VOICES)) samples[key] = await samplesOf({ ...voice, key }, out)
console.log('samples:', Object.entries(samples).map(([key, each]) => `${key} ${each.full.seconds}/${each[10].seconds}/${each[5].seconds} s`).join(', '))

// Every take: a job for its pod, the first take of each server loading the model
const takes = []
const jobs = { base: [], model: [] }
for (const [variant, plan] of Object.entries(VARIANTS)) {
  for (const voice of Object.keys(VOICES)) {
    const sample = samples[voice][plan.sample ?? 'full']
    for (const line of NAMES) {
      const result = { variant, voice, line }
      const options = plan.options ? { options: plan.options } : {}
      const body = { model: 'drama3', input: (plan.tag?.(line) ?? '') + texts[voice][line], voice_ref: { type: 'base64', data: sample.wav.toString('base64') }, reference_text: sample.text, seed: plan.seed ?? 7, ...options }
      const job = { body, result, file: path.join(out, voice, variant, `${line}.wav`), label: `${voice} ${variant} ${line}`, server: plan.server }
      takes.push(result)
      jobs[plan.pod].push(job)
    }
  }
}
// Each pod's jobs in groups, one after another, its servers working a group side by side. A warm-up line on every
// server goes first, untimed. A model-level variant is timed alone on the card, so its speed is its own: the
// baseline on the first base server, then each model server in turn; the request-level variants, which change
// what is said rather than how fast, share both base servers
const warm = (pod, count) => Array.from({ length: count }, (_, server) => ({ ...jobs[pod][0], result: {}, file: path.join(out, 'warm', `${pod}_${server}.wav`), label: 'warm-up', server }))
const baseline = jobs.base.filter(job => job.result.variant === 'base').map(job => ({ ...job, server: 0 }))
const rest = jobs.base.filter(job => job.result.variant !== 'base').map((job, index) => ({ ...job, server: index % 2 }))
jobs.base = [warm('base', 2), baseline, rest]
jobs.model = [warm('model', 3), ...[0, 1, 2].map(server => jobs.model.filter(job => job.server === server))]
if (process.argv.includes('--dry')) {
  for (const [name, groups] of Object.entries(jobs)) console.log(name, groups.map(group => group.length).join(' + '), 'takes;', [...new Set(groups.flat().map(job => job.body.input.slice(0, 60)))].slice(0, 3))
  process.exit(0)
}
const before = (await api('GET', '/v2/billing/balance')).balanceAmount
const pods = { base: {}, model: {} }
// Settled rather than all: a pod that failed to start must not end the script while the other one runs
for (const failed of (await Promise.allSettled(Object.keys(jobs).map(name => work(name, jobs[name], pods[name])))).filter(each => each.status === 'rejected')) console.log(failed.reason.message)
const left = (await api('GET', '/v2/pods')).pods.map(each => each.id)
console.log(`Pods left on the account: ${left.length}`)

// The longest pause inside a take, in seconds: 20 ms frames under -40 dBFS, its leading and trailing silence
// left out. A model stuck in silence shows here as a pause of seconds where a speaker breathes in half a second
function pauseOf (wav) {
  const { rate, block, start, size } = wavOf(wav)
  const frame = Math.round(rate * 0.02)
  const loud = []
  for (let at = start; at + frame * block <= start + size; at += frame * block) {
    let sum = 0
    for (let i = 0; i < frame; i++) sum += (wav.readInt16LE(at + i * block) / 32768) ** 2
    loud.push(Math.sqrt(sum / frame) > 0.01)
  }
  let longest = 0
  for (let at = loud.indexOf(true), quiet = 0; at >= 0 && at <= loud.lastIndexOf(true); at++) longest = Math.max(longest, quiet = loud[at] ? 0 : quiet + 1)
  return +(longest * 0.02).toFixed(2)
}
// VoiceStudio writes each take down. The recognizer writes number words as figures and «дубль-вэ» as W in
// every variant alike: realOff counts the words heard otherwise but those
for (const take of takes) {
  const file = path.join(out, take.voice, take.variant, `${take.line}.wav`)
  if (!fs.existsSync(file)) continue
  const wav = fs.readFileSync(file)
  const heard = await transcribe(wav, VOICES[take.voice].language)
  take.longestPause = pauseOf(wav)
  const said = words(texts[take.voice][take.line])
  const got = words(heard.text)
  take.heard = heard.text.trim()
  take.missing = said.filter(word => !got.includes(word))
  take.extra = got.filter(word => !said.includes(word))
  take.wordsPerMinute = +(said.length / take.speech * 60).toFixed(0)
}
// Each variant of each voice in a row
const summary = []
for (const variant of Object.keys(VARIANTS)) {
  for (const voice of Object.keys(VOICES)) {
    const mine = takes.filter(take => take.variant === variant && take.voice === voice && take.speech)
    const spent = mine.reduce((sum, take) => sum + take.work, 0)
    const speech = mine.reduce((sum, take) => sum + take.speech, 0)
    summary.push({
      variant, voice, takes: mine.length,
      workPerSecond: speech ? +(spent / speech).toFixed(3) : null,
      wordsPerMinute: mine.length ? Math.round(mine.reduce((sum, take) => sum + take.wordsPerMinute, 0) / mine.length) : null,
      wordsOff: mine.reduce((sum, take) => sum + take.missing.length + take.extra.length, 0),
      linesOff: mine.filter(take => take.missing.length + take.extra.length > 0).length,
      realOff: mine.reduce((sum, take) => sum + take.extra.filter(word => !/^\d+$|^w$/.test(word)).length, 0),
      longestPause: Math.max(...mine.map(take => take.longestPause)),
      pausesOver1s: mine.filter(take => take.longestPause > 1).length
    })
  }
}
const report = { at: new Date().toISOString(), gpus: GPUS, lines: NAMES, variants: VARIANTS, samples: Object.fromEntries(Object.entries(samples).map(([key, each]) => [key, Object.fromEntries(Object.entries(each).map(([k, v]) => [k, { seconds: v.seconds, text: v.text }]))])), balanceBefore: before, podsLeft: left, pods, summary, takes }
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, (key, value) => typeof value === 'function' ? String(value) : value, 1) + '\n')
console.table(summary)
console.log(`Wrote ${path.join(out, 'results.json')}`)
