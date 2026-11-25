// The sound of the five films beside it. Each is played from the film's own keyframes, so a film that is
// retimed keeps its sound in step: the pitch of exposure.json is the height of the black hole on the screen,
// the chirp of waltz.json is the distance between the two. Sines only, no dependencies.
//   node films/sound.mjs             writes a wav beside every film it knows
//   node films/sound.mjs waltz       writes films/waltz.wav
// Give the file to space_render as "audio".
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const RATE = 48000
const TAU = Math.PI * 2
const here = path.dirname(fileURLToPath(import.meta.url))

const smooth = (from, to, t) => {
  const share = Math.min(Math.max((t - from) / (to - from), 0), 1)
  return share * share * (3 - 2 * share)
}
// 1 between `from` and `to`, with `edge` seconds to rise and to fall
const span = (from, to, edge, t) => smooth(from, from + edge, t) * (1 - smooth(to - edge, to, t))

const EASES = {
  ease: share => share * share * (3 - 2 * share),
  linear: share => share,
  in: share => share * share,
  out: share => 1 - (1 - share) * (1 - share),
  hold: () => 0
}

// A film's track as a function of its seconds, read the way the film reads it
function follow (film, key, fallback) {
  const frames = film.tracks?.[key]
  if (!frames) return () => film.settings?.[key] ?? fallback
  let at = 0
  return t => {
    if (t <= frames[0][0]) return frames[0][1]
    while (at > 0 && frames[at][0] > t) at--
    while (at + 1 < frames.length && frames[at + 1][0] <= t) at++
    if (at + 1 >= frames.length) return frames[at][1]
    const [from, value] = frames[at]
    const [to, next, ease = 'ease'] = frames[at + 1]
    return value + (next - value) * EASES[ease]((t - from) / (to - from))
  }
}

// A sine whose pitch may change from sample to sample
function voice () {
  let phase = 0
  return frequency => {
    phase += TAU * frequency / RATE
    return Math.sin(phase)
  }
}

// A low thump that drops in pitch as it dies
const thump = since => since < 0 ? 0 : Math.sin(TAU * (38 * since + 30 * (1 - Math.exp(-since * 3)))) * Math.exp(-since * 1.6) * smooth(0, 0.02, since)

// Each film: a function of its seconds that gives the left and the right ear
const FILMS = {
  // The hole draws a knot: its height on the screen is the pitch, its place from left to right the ear
  exposure (film) {
    const x = follow(film, 'blackHoleX', 0.5)
    const y = follow(film, 'blackHoleY', 0.5)
    const fade = follow(film, 'trailIntensity', 0)
    const pen = voice()
    const fifth = voice()
    const floor = voice()
    return t => {
      const pitch = 110 * 2 ** ((1 - y(t)) * 2)
      const level = 1 - Math.min(1, fade(t) * 4)
      const tone = (pen(pitch) * 0.22 + fifth(pitch * 1.5) * 0.06) * level
      const right = x(t)
      const drone = floor(55) * 0.12
      return [tone * (1 - right) * 1.4 + drone, tone * right * 1.4 + drone]
    }
  },

  // Every group of stars that joins is a note of the chord; the horizon that grows at the end pulls it down
  rosette (film) {
    const count = follow(film, 'orbitCount', 1)
    const horizon = follow(film, 'horizonScale', 1)
    const notes = [[1, 220, 1.3], [3, 329.63, 1.7], [3, 277.18, 2.1], [8, 440, 0.9], [8, 246.94, 2.6], [20, 659.26, 0.7], [20, 554.37, 1.1]]
      .map(([stars, frequency, turn]) => ({ stars, frequency, turn, tone: voice(), level: 0 }))
    const ring = voice()
    return t => {
      const pull = (horizon(t) - 1) / 4
      let left = 0
      let right = 0
      for (const note of notes) {
        note.level += ((count(t) >= note.stars ? 1 : 0) - note.level) / (RATE * 0.8)
        const tone = note.tone(note.frequency * (1 - 0.45 * pull)) * note.level * 0.11 * (1 - 0.7 * pull)
        left += tone * (0.6 + 0.4 * Math.sin(TAU * t / note.turn))
        right += tone * (0.6 + 0.4 * Math.sin(TAU * (t / note.turn + 0.25)))
      }
      const fed = ring(82.41) * 0.22 * pull
      return [left + fed, right + fed]
    }
  },

  // The lens over the grid: the twist of the sky is the beating of two close tones, the second hole a pulse
  graph_paper (film) {
    const x = follow(film, 'blackHoleX', 0.5)
    const twist = follow(film, 'lensingRotation', 0)
    const zoom = follow(film, 'cameraZoom', 1)
    const size = follow(film, 'companionSize', 0)
    const distance = follow(film, 'companionDistance', 7)
    const floor = voice()
    const lens = voice()
    const twin = voice()
    const second = voice()
    const pulse = voice()
    return t => {
      const drone = floor(98) * 0.1
      const near = 0.6 + 0.4 * Math.min(1, (zoom(t) - 1) / 1.6)
      const tone = (lens(196) + twin(196 + Math.abs(twist(t)) * 0.9)) * 0.09 * near
      const beat = 0.5 + 0.5 * pulse(1.2 * (7 / Math.max(distance(t), 1)) ** 1.5)
      const pair = second(146.83) * 0.16 * size(t) * beat
      const right = x(t)
      return [tone * (1 - right) * 1.4 + drone + pair, tone * right * 1.4 + drone + pair]
    }
  },

  // The star swells, bursts, its light crosses the frame, its matter follows and the new hole rings
  rapid (film) {
    const params = film.intro.params
    const blast = params.collapseAt
    const crossing = params.lightCrossTime
    const charge = voice()
    const light = voice()
    const matter = voice()
    const hole = voice()
    const last = voice()
    return t => {
      const rising = smooth(params.starChargeStart, blast, t)
      const star = t < blast ? charge(55 + 40 * rising) * 0.2 * rising * rising : 0
      const since = t - blast
      const front = since > 0 ? light(880 - 120 * since / crossing) * 0.12 * Math.exp(-since / (crossing * 0.5)) * smooth(0, 0.05, since) : 0
      const rumble = matter(49) * 0.16 * span(blast + 1, blast + 14, 4, t)
      const born = t - params.horizonAt
      const ringing = born > 0 ? hole(138.59) * 0.18 * Math.exp(-born / 6) * (0.6 + 0.4 * Math.sin(TAU * born * 0.7)) * smooth(0, 1.5, born) : 0
      const close = last(220) * 0.12 * smooth(16, 24, t)
      const sum = star + thump(since) * 0.5 + front + rumble + ringing + close
      return [sum, sum]
    }
  },

  // Two holes: the nearer they are, the higher and louder the chirp; where they become one, it rings out
  waltz (film) {
    const distance = follow(film, 'companionDistance', 8)
    const frames = film.tracks.companionDistance
    const merger = frames[frames.length - 1][0]
    const chirp = voice()
    const floor = voice()
    const fifth = voice()
    return t => {
      const drone = floor(55) * 0.12 + fifth(82.41) * 0.07
      const gap = Math.max(distance(t), 1.1)
      const frequency = Math.min(320, 40 * 9 / gap)
      const sung = t < merger
        ? chirp(frequency) * (0.05 + 0.2 * Math.min(1, 3 / gap))
        : chirp(320) * 0.26 * Math.exp(-(t - merger) / 0.5)
      return [drone + sung, drone + sung]
    }
  }
}

function write (name) {
  const film = JSON.parse(fs.readFileSync(path.join(here, `${name}.json`), 'utf8'))
  const play = FILMS[name](film)
  const frames = Math.round(film.duration * RATE)
  const samples = new Float32Array(frames * 2)
  let peak = 0
  for (let frame = 0; frame < frames; frame++) {
    const t = frame / RATE
    const [left, right] = play(t)
    const fade = smooth(0, 0.4, t) * (1 - smooth(film.duration - 2, film.duration, t))
    samples[frame * 2] = left * fade
    samples[frame * 2 + 1] = right * fade
    peak = Math.max(peak, Math.abs(samples[frame * 2]), Math.abs(samples[frame * 2 + 1]))
  }
  // Never louder than this, and never raised: the sound is meant to stay under the picture
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
  const out = path.join(here, `${name}.wav`)
  fs.writeFileSync(out, Buffer.concat([header, data]))
  console.log(`Wrote ${out}: ${film.duration} s, peak ${(peak * gain).toFixed(2)}`)
}

const asked = process.argv.slice(2)
for (const name of asked.length > 0 ? asked : Object.keys(FILMS)) {
  if (!FILMS[name]) throw new Error(`No sound for "${name}". Films with sound: ${Object.keys(FILMS).join(', ')}`)
  write(name)
}
