// The fourth dimension, clip 4 of films/fourth_dimension.json: how the hypothesis could be tested. Two clocks
// a millimetre apart run at different rates (measured in 2021). From an atomic clock to an atomic ruler: a
// superconducting coil one light-second long, and a photon timed through it deep in the well and far out
// of it. Relativity says one second both times; the hypothesis says more than one second far out, where
// matter is no longer squeezed along W. Its author's own later note leaves that an open question, and the
// clip says so.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_experiment.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#c9d4f0'
const GOLD = '#ffd27a'
const ASPECT = 9 / 16

film({
  fps: 60,
  seed: 23,
  warmup: 10,
  settings: {
    blackHoleSize: 8,
    blackHoleY: 0.72,
    numParticles: 40000,
    // The well full of the matter that drains down it, lying on the sheet, as in clips 2 and 3
    lensingEnabled: false,
    gravityInertia: 0.75,
    orbitalStrength: 80,
    gravityStrength: 4,
    gravityReach: 16,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.03,
    trailIntensity: 0.5,
    depthFade: 0,
    minOpacity: 0.1,
    particleSize: 2,
    particleSizeMin: 2,
    baseBrightness: 0.6,
    nebula: 0.8,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.6,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: '#4de3ff',
    gridCell: 4,
    gridSheet: 0.85,
    gridTilt: 66,
    gridDepth: 5.5,
    gridRings: 40,
    // The field is born round the hole, which stands low in the frame over a tilted sheet: fed from the
    // frame's centre, the well would fill on one side only
    fieldAtHole: 1,
    gridSpokes: 24,
    gridRide: 1,
    gridSpan: 0.6,
    gridFade: 0.3
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

// A coil as a flat spiral of five turns, and the place a share of the way along it
const along = (centre, size) => share => {
  const angle = 2 * Math.PI * 5 * share
  const radius = size * (0.22 + 0.78 * share)
  return [+(centre[0] + radius * Math.cos(angle) * ASPECT).toFixed(5), +(centre[1] - radius * Math.sin(angle)).toFixed(5)]
}
const coil = (centre, size, more = {}) => {
  const place = along(centre, size)
  const points = []
  for (let step = 0; step <= 200; step++) points.push(place(step / 200))
  return { kind: 'line', points, color: INK, width: 0.0032, fade: 0.4, ...more }
}
// A photon sent through a coil over `seconds`
const photon = (centre, size, seconds) => {
  const place = along(centre, size)
  const share = s => Math.min(1, s / seconds)
  draw({ kind: 'circle', center: ['x', 'y'], radius: 0.009, fill: GOLD, color: GOLD, fade: 0.2, values: { x: s => place(share(s))[0], y: s => place(share(s))[1] } }, seconds + 0.6)
}
const EARTH = [0.2, 0.52]
const SPACE = [0.8, 0.33]
const SIZE = 0.125
const RUN = 2.4
// The clip's length, laid out first: what stays to its end (the coils, the two readings) is drawn that long
const long = (name, guess) => lines[name] ?? guess
const END = 0.8 + long('test', 9) + 0.8 + long('ruler', 13) + 0.8 +
  Math.max(long('photon', 9) + 0.8, heard('photon', 'time', 8.4) - 0.3 + RUN + 0.4) +
  long('answers', 11.5) + 0.9 + long('question', 10.5) + 0.4 + 3.6

// ---- two clocks, a millimetre apart ----

shot('a millimetre', () => {
  wait(0.8)
  const start = now()
  const spoken = say('test', 9)
  const end = start + spoken + 0.8
  // The lower clock, deeper in the well, turns slower; drawn far apart and far too different, and said so
  at(start + heard('test', 'clock', 3.6) - 0.3, () => {
    const life = end - now()
    const clock = (centre, turn) => {
      draw({ kind: 'circle', center: centre, radius: 0.05, color: INK, width: 0.0035, fade: 0.4 }, life)
      draw({ kind: 'line', points: [centre, ['x', 'y']], color: GOLD, width: 0.004, fade: 0.4,
        values: { x: s => centre[0] + 0.042 * Math.sin(2 * Math.PI * s / turn) * ASPECT, y: s => centre[1] - 0.042 * Math.cos(2 * Math.PI * s / turn) } }, life)
    }
    clock([0.76, 0.36], 1.6)
    clock([0.76, 0.62], 2.6)
    draw({ kind: 'line', points: [[0.805, 0.38], [0.805, 0.6]], arrow: 'both', color: SOFT, width: 0.0028, fade: 0.4 }, life)
    caption('1 mm', life, { at: [0.845, 0.49], size: 0.03, font: 'unbounded', color: INK })
  })
  at(start + heard('test', 'millimetre', 7.6), () => {
    caption('JILA, 2021: one millimetre higher, time runs faster by *{10^{−19}}', end - now(), { at: [0.5, 0.2], size: 0.036, font: 'noto', accent: GOLD, plate: 0.6 })
    caption('(drawn far too different)', end - now(), { at: [0.78, 0.74], size: 0.022, font: 'noto', color: SOFT })
  })
  wait(end - now())
})

// ---- from a clock to a ruler ----

shot('the atomic ruler', () => {
  const start = now()
  const spoken = say('ruler', 13)
  const end = start + spoken + 0.8
  at(start + heard('ruler', 'coil', 5.2) - 0.3, () => {
    // The coil stays for the rest of the clip
    draw(coil(EARTH, SIZE, { draw: 2.6 }), END - now())
    caption('a superconducting coil\n*{299 792.458 km}', end - now(), { at: [EARTH[0], 0.725], size: 0.028, font: 'noto', accent: GOLD, plate: 0.6 })
  })
  at(start + heard('ruler', 'second', 11.5) - 0.5, () => {
    caption('= the distance light travels in *{1 second}', end - now(), { at: [0.5, 0.2], size: 0.036, font: 'noto', accent: GOLD, plate: 0.6 })
  })
  wait(end - now())
})

// ---- the photon, here and far away ----

let far = 0
shot('on Earth and far out', () => {
  const start = now()
  const spoken = say('photon', 9)
  const end = start + spoken + 0.8
  const here = start + heard('photon', 'earth', 2.2) - 0.2
  const there = start + heard('photon', 'space', 5.4) - 0.9
  far = start + heard('photon', 'time', 8.4) - 0.3
  // Deep in the well the scene's own time runs slow while the photon is timed there, and at its pace far out
  at(here - 0.6, () => { to({ speed: 0.45 }, 0.6); wait(RUN); to({ speed: 1 }, 0.6) })
  at(here, () => {
    photon(EARTH, SIZE, RUN)
    caption('on Earth, deep in the well\n*{#{t:3} s}', END - now(), { at: [EARTH[0], 0.725], size: 0.028, font: 'noto', accent: GOLD, plate: 0.6, values: { t: [[now(), 0], [now() + RUN, 1, 'linear']] } })
  })
  at(there, () => {
    draw(coil(SPACE, SIZE, { draw: 1.1 }), END - now())
    caption('far out, where the well is almost flat', far - now() - 0.1, { at: [SPACE[0], 0.53], size: 0.028, font: 'noto', color: INK, plate: 0.6 })
  })
  at(far, () => {
    photon(SPACE, SIZE, RUN)
    caption('far out, where the well is almost flat\n*{#{t:3} s} …', end + 0.2 - now(), { at: [SPACE[0], 0.545], size: 0.028, font: 'noto', accent: GOLD, plate: 0.6, values: { t: [[now(), 0], [now() + RUN, 1, 'linear']] } })
  })
  wait(Math.max(end, far + RUN + 0.4) - now())
})

// ---- one coil, two answers ----

shot('two answers', () => {
  const start = now()
  const spoken = say('answers', 11.5)
  const end = start + spoken + 0.9
  at(start + heard('answers', 'relativity', 0.1) + 0.2, () => {
    caption('relativity: *{1.000 s}, here and there', start + heard('answers', 'hypothesis', 3.6) - 0.3 - now(), { at: [SPACE[0], 0.545], size: 0.028, font: 'noto', accent: GOLD, plate: 0.6 })
  })
  at(start + heard('answers', 'hypothesis', 3.6), () => {
    // What the hypothesis draws: out of the well the coil is no longer squeezed, so it is the longer one, and
    // the coil as it was on Earth fits inside it
    draw(coil(SPACE, SIZE * 1.16, { color: W, width: 0.0036, draw: 1.4 }), END - now())
    caption('the hypothesis: matter is squeezed along *{W} in the well,\nso out here the same coil is longer', end - now(), { at: [0.5, 0.2], size: 0.034, font: 'noto', accent: W, plate: 0.6 })
  })
  at(start + heard('answers', 'more', 9.6) - 0.4, () => {
    caption('the hypothesis: *{more than 1 s}', END - now(), { at: [SPACE[0], 0.56], size: 0.03, font: 'noto', accent: W, plate: 0.6 })
  })
  wait(end - now())
})

shot('an open question', () => {
  const start = now()
  const spoken = say('question', 10.5)
  at(start + heard('question', 'question', 4.6) - 1.6, () => {
    caption('“Baryonic matter may not shrink. That is a question.”\nthe author’s own note, 2023', spoken - heard('question', 'question', 4.6) + 1.2, { at: [0.5, 0.2], size: 0.034, font: 'noto', color: INK, plate: 0.6 })
  })
  wait(spoken + 0.4)
  // The author's line on time, to leave on
  caption('“Light is a time.”', 3.2, { at: [0.5, 0.2], size: 0.046, font: 'unbounded', color: GOLD })
  wait(3.6)
})
