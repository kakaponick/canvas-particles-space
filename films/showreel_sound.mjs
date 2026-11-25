// The sound under films/showreel.json: a quiet drone, the blast of the opening and the chirp of the two
// black holes, which rises as they close in and rings out when they are one. Sines only, no dependencies.
//   node films/showreel_sound.mjs          writes films/showreel.wav
// Give that file to space_render as "audio".
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RATE = 48000
const LENGTH = 50
// Moments of the showreel, in its seconds
const BLAST = 0.6
const PAIR_FROM = 35
const MERGER = 43

const TAU = Math.PI * 2
const smooth = (from, to, t) => {
  const share = Math.min(Math.max((t - from) / (to - from), 0), 1)
  return share * share * (3 - 2 * share)
}
// 1 between `from` and `to`, with `edge` seconds to rise and to fall
const span = (from, to, edge, t) => smooth(from, from + edge, t) * (1 - smooth(to - edge, to, t))

// The drone: [frequency, level, seconds per swell, where in the swell it starts, from, to]
const VOICES = [
  [55, 0.16, 11, 0, 0.4, LENGTH],
  [82.41, 0.1, 7, 0.3, 0.4, LENGTH],
  [110, 0.09, 13, 0.6, 2, LENGTH],
  // The zoom
  [164.81, 0.05, 5, 0.1, 8, 17],
  // The lens and the grid of the sky
  [220, 0.045, 4, 0.5, 16, 24],
  [277.18, 0.03, 6, 0.2, 16, 24],
  // The orbiting stars
  [329.63, 0.03, 3, 0.4, 23, 30],
  [246.94, 0.035, 5, 0.7, 23, 30],
  // The sheet and the pair
  [146.83, 0.05, 9, 0.2, 29, 46]
]

const frames = RATE * LENGTH
const samples = new Float32Array(frames * 2)
let chirpPhase = 0
for (let frame = 0; frame < frames; frame++) {
  const t = frame / RATE
  let left = 0
  let right = 0

  for (const [frequency, level, swell, start, from, to] of VOICES) {
    const gain = level * span(from, to, 2, t)
    if (gain === 0) continue
    const tone = Math.sin(TAU * frequency * t)
    // The two ears swell a quarter of a turn apart, which is what gives the drone its width
    left += tone * gain * (0.65 + 0.35 * Math.sin(TAU * (t / swell + start)))
    right += tone * gain * (0.65 + 0.35 * Math.sin(TAU * (t / swell + start + 0.25)))
  }

  // The blast: a low thump that drops in pitch as it dies
  if (t >= BLAST) {
    const since = t - BLAST
    const thump = Math.sin(TAU * (38 * since + 30 * (1 - Math.exp(-since * 3)))) * 0.45 * Math.exp(-since * 1.6) * smooth(0, 0.02, since)
    left += thump
    right += thump
  }

  // The chirp: pitch and loudness rise as the pair closes in, then the merged hole rings out
  let chirp = 0
  if (t >= PAIR_FROM && t < MERGER) {
    const closing = (t - PAIR_FROM) / (MERGER - PAIR_FROM)
    chirpPhase += TAU * (42 + 240 * closing * closing * closing) / RATE
    chirp = Math.sin(chirpPhase) * (0.03 + 0.25 * closing * closing) * smooth(0, 0.06, closing)
  } else if (t >= MERGER) {
    chirpPhase += TAU * 282 / RATE
    chirp = Math.sin(chirpPhase) * 0.28 * Math.exp(-(t - MERGER) / 0.45)
  }
  left += chirp
  right += chirp

  const fade = smooth(0, 0.3, t) * (1 - smooth(LENGTH - 3, LENGTH, t))
  samples[frame * 2] = left * fade
  samples[frame * 2 + 1] = right * fade
}

let peak = 0
for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
// Never louder than -3 dB, and never raised: the drone is meant to stay under the picture
const gain = Math.min(1, 0.7 / peak)

const data = Buffer.alloc(samples.length * 2)
for (let index = 0; index < samples.length; index++) data.writeInt16LE(Math.round(samples[index] * gain * 32767), index * 2)
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

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'showreel.wav')
fs.writeFileSync(out, Buffer.concat([header, data]))
console.log(`Wrote ${out}: ${LENGTH} s, peak ${(peak * gain).toFixed(2)}`)
