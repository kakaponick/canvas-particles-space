// The fourth dimension as popular science, clip 1 of films/fourth_dimension_pop.json: a ball falls, and down turns out to mean toward the middle.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_01_down.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  drop: 'Drop a ball, and it falls. Every time. Nobody is surprised.',
  which: 'But here is a strange question. Which way is it falling?',
  opposite: 'Down, sure. But down in Tokyo and down in Buenos Aires point almost opposite ways. Down is not a direction in space at all. It just means: toward the middle.',
  serious: 'One hypothesis takes that seriously. It says the middle is a real direction. A fourth one. And gravity is what it feels like.',
  need: 'To see if that makes any sense, we need three things. A cube, a black hole, and a very long wire.'
}

// ---- the film's kit: the same text in every clip of films/fourth_dimension_pop.json ----
const lines = input.lines ?? {}
const cues = input.cues ?? {}
// The colours: the three directions of space, the fourth (W, and every word about it), the ink, a quieter
// ink for what stands beside it, and gold for what was measured
const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#aab6d8'
const GOLD = '#ffd27a'
// Until a voice has spoken a line it takes what its words would at 155 a minute
const long = name => lines[name] ?? +(LINES[name].split(/\s+/).length * 60 / 155).toFixed(1)
// Marks where a line starts, which is where the voice is laid, and tells its length
const say = name => { mark('say:' + name); return long(name) }
// The second of a line a word falls at: heard in the voice, or this share of the line until it is spoken
const heard = (name, word, share) => cues[name]?.[word] ?? +(long(name) * share).toFixed(2)
const until = second => wait(Math.max(0, second - now()))
// The chapter's card on black; the picture comes up under the last of it
const chapter = (number, name) => {
  set({ fade: 1 })
  caption(`*{${number}}`, 2.4, { at: [0.5, 0.43], size: 0.03, font: 'unbounded', accent: W, fade: 0.4 })
  caption(name, 2.4, { at: [0.5, 0.52], size: 0.052, font: 'unbounded', color: INK, fade: 0.4 })
  wait(1.6)
  to({ fade: 0 }, 1.2)
}
// What kind of claim is on the screen: measured physics, plain geometry, the hypothesis, or a question
// nobody has answered. A line that claims nothing about nature (a question, a thought experiment) has none
const STATUS = { known: ['KNOWN PHYSICS', GOLD], math: ['GEOMETRY', SOFT], idea: ['HYPOTHESIS', W], open: ['OPEN QUESTION', INK] }
const status = (kind, seconds) => caption(STATUS[kind][0], seconds, { at: [0.11, 0.94], size: 0.022, font: 'unbounded', color: STATUS[kind][1], fade: 0.4 })
// The one sentence of a shot a viewer should keep, at the foot of the frame
const keep = (text, seconds, more = {}) => caption(text, seconds, { at: [0.5, 0.86], size: 0.038, font: 'noto', accent: W, plate: 0.35, fade: 0.4, ...more })
// The clip leaves through black
const leave = () => { to({ fade: 1 }, 0.8) }
// ---- end of the kit ----

// The Earth is NASA's photograph from Apollo 17 (films/fourth_dimension_earth.png), centred on the hole and
// 2.62 radii wide; its disc is 0.78 of the picture's half side, so the limb stands 1.02 radii out (the ball
// rests on it, the falls and the downs end at it). The hole's lens and ring stay off beneath it
const EDGE = 1.03
const hole = (x, y) => ({ hole: [x, y] })
// A point at this distance from the middle along a direction given in degrees (0 right, 90 up)
const out = (degrees, r) => hole(+(Math.cos(degrees * Math.PI / 180) * r).toFixed(3), +(Math.sin(degrees * Math.PI / 180) * r).toFixed(3))
const TOKYO = 40
const BUENOS = 220

film({
  fps: 60,
  seed: 1,
  warmup: 8,
  settings: {
    blackHoleSize: 10,
    blackHoleX: 0.5,
    blackHoleY: 0.5,
    numParticles: 12000,
    lensingEnabled: false,
    ringEnabled: false,
    // Matter falling in toward the planet from every side, gently: the field is the pull itself
    colorPalette: [{ r: 120, g: 222, b: 255, enabled: true, percent: 70 }, { r: 235, g: 246, b: 255, enabled: true, percent: 30 }],
    orbitalStrength: 0,
    gravityInertia: 0.5,
    gravityStrength: 15,
    gravityReach: 14,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.02,
    trailIntensity: 0.15,
    depthFade: 0,
    minOpacity: 0.25,
    baseBrightness: 1.2,
    nebula: 0.6,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.4,
    starDensity: 0.22
  }
})
// The chapter's card takes 2.8 s; the clip's shots follow it
const END = 2.8 + ['drop', 'which', 'opposite', 'serious', 'need'].reduce((sum, name) => sum + long(name) + 0.6, 0) + 0.8
// The Earth for the whole clip: it comes up with the picture as the card leaves, so the hole beneath it is
// never seen bare
at(1.6, () => draw({ kind: 'image', src: 'films/fourth_dimension_earth.png', center: hole(0, 0), width: 2.62, fade: 1.2 }, END - now()))
chapter('01', 'WHICH WAY IS DOWN?')

shot('drop', () => {
  const start = now()
  const spoken = say('drop')
  status('known', spoken)
  // The ball falls straight down the frame's vertical onto the top of the Earth, as a stone does: slow, then fast
  const fall = seconds => draw({ kind: 'circle', center: hole(0, 'y'), radius: 0.12, fill: INK, color: INK, width: 0.001, fade: 0.2, values: { y: s => +(4.2 - (4.2 - EDGE - 0.12) * Math.min(1, (s * 1.25) ** 2)).toFixed(3) } }, seconds)
  // The first fall lands and rests a moment; the second, on "every time", starts once it has gone and rests on
  // the Earth into the next shot, where the resting ball takes over
  const falls = start + heard('drop', 'falls', 0.15)
  const again = Math.max(start + heard('drop', 'every', 0.55), falls + 0.8) + 0.5
  at(falls, () => {
    fall(again - now())
    caption('a ball', 1.1, { at: hole(0.75, 3.9), size: 0.026, font: 'unbounded', color: INK, fade: 0.3 })
  })
  at(again, () => {
    fall(start + spoken + 0.6 + 0.3 - now())
    caption('every time', start + spoken + 0.6 - now(), { at: [0.72, 0.3], size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('which', () => {
  const start = now()
  const spoken = say('which')
  // The ball rests on the Earth's top; its path becomes an arrow that asks
  draw({ kind: 'circle', center: hole(0, EDGE + 0.12), radius: 0.12, fill: INK, color: INK, width: 0.001, fade: 0.3 }, spoken + 0.6 + long('opposite') + 0.6 + long('serious') + 0.6)
  at(start + heard('which', 'which', 0.65), () => {
    const left = start + spoken + 0.6 - now()
    draw({ kind: 'line', points: [hole(0, 4.2), hole(0, EDGE + 0.35)], arrow: 'end', color: INK, width: 0.004, dash: true, draw: 0.6, fade: 0.3 }, left)
    caption('which way?', left, { at: hole(2.2, 3.2), size: 0.04, font: 'unbounded', color: INK, fade: 0.3 })
  })
  wait(spoken + 0.6)
})

shot('opposite', () => {
  const start = now()
  const spoken = say('opposite')
  status('known', spoken)
  const rest = spoken + 0.6 + long('serious') + 0.6
  // Two downs on opposite sides of the Earth, each an arrow at the centre
  const down = (degrees, name, labelAt, word, share) => at(start + heard('opposite', word, share), () => {
    const left = start + rest - now()
    draw({ kind: 'line', points: [out(degrees, 4.2), out(degrees, EDGE + 0.15)], arrow: 'end', color: INK, width: 0.005, draw: 0.6, fade: 0.4 }, left)
    caption(name, left, { at: labelAt, size: 0.026, font: 'unbounded', color: INK, fade: 0.4 })
  })
  down(TOKYO, 'down in Tokyo', [0.77, 0.2], 'Tokyo', 0.18)
  down(BUENOS, 'down in Buenos Aires', [0.2, 0.74], 'Buenos', 0.27)
  at(start + heard('opposite', 'opposite', 0.36), () => caption('opposite ways', 2.4, { at: [0.2, 0.2], size: 0.03, font: 'noto', color: SOFT, fade: 0.4 }))
  // Toward the middle: the centre is marked, and named
  at(start + heard('opposite', 'middle', 0.93), () => {
    const left = start + spoken + 0.6 - now()
    draw({ kind: 'circle', center: hole(0, 0), radius: 0.13, fill: INK, color: INK, width: 0.002, fade: 0.3 }, left)
    draw({ kind: 'circle', center: hole(0, 0), radius: 0.32, color: INK, width: 0.002, draw: 0.5, fade: 0.3 }, left)
    caption('the middle', left, { at: [0.5, 0.69], size: 0.024, font: 'unbounded', color: INK, plate: 0.4, fade: 0.3 })
  })
  wait(spoken + 0.6)
})

shot('serious', () => {
  const start = now()
  const spoken = say('serious')
  status('idea', spoken)
  // The middle becomes a direction: the two downs turn red, and the field falls in harder
  at(start + heard('serious', 'direction', 0.42), () => {
    const left = start + spoken + 0.6 - now()
    for (const degrees of [TOKYO, BUENOS]) {
      draw({ kind: 'line', points: [out(degrees, 4.2), out(degrees, EDGE + 0.15)], arrow: 'end', color: W, width: 0.006, draw: 0.7, fade: 0.4 }, left)
    }
    draw({ kind: 'circle', center: hole(0, 0), radius: 0.16, fill: W, color: W, width: 0.002, fade: 0.3 }, left)
    caption('*{the middle} is a direction', left, { at: [0.5, 0.69], size: 0.024, font: 'unbounded', color: INK, accent: W, plate: 0.4, fade: 0.3 })
    to({ gravityStrength: 30 }, 1.5)
  })
  at(start + heard('serious', 'fourth', 0.58), () => caption('*{a fourth one: W}', start + spoken + 0.6 - now(), { at: [0.5, 0.17], size: 0.04, font: 'unbounded', color: INK, accent: W, plate: 0.4, fade: 0.3 }))
  at(start + heard('serious', 'gravity', 0.78), () => keep('Gravity is how a fourth direction *{feels}.', start + spoken + 0.6 - now()))
  wait(spoken + 0.6)
})

shot('need', () => {
  const start = now()
  const spoken = say('need')
  at(now(), () => to({ gravityStrength: 15 }, 1.5))
  const life = spoken + 0.6
  const ROW = 0.76
  // Three signs in a row below the Earth, each arriving at its word
  const sign = (word, share, x, name, drawn) => at(start + heard('need', word, share), () => {
    const left = start + life + 0.8 - now()
    drawn(x, left)
    caption(name, left, { at: [x, ROW + 0.08], size: 0.022, font: 'unbounded', color: INK, fade: 0.3 })
  })
  const line = (points, left, color = INK) => draw({ kind: 'line', points, color, width: 0.003, draw: 0.5, fade: 0.3 }, left)
  sign('cube', 0.62, 0.3, 'a cube', (x, left) => {
    const a = 0.026
    const b = 0.016
    // The frame is 16 wide and 9 high: a share of its width is 9/16 of the same share of its height
    const wide = 9 / 16
    const front = [[x - a * wide, ROW - a + b], [x + (a - b) * wide, ROW - a + b], [x + (a - b) * wide, ROW + a], [x - a * wide, ROW + a], [x - a * wide, ROW - a + b]]
      .map(([px, py]) => [+px.toFixed(4), +py.toFixed(4)])
    const back = front.map(([px, py]) => [+(px + b * wide).toFixed(4), +(py - b).toFixed(4)])
    line(front, left)
    line(back, left, SOFT)
    for (let i = 0; i < 4; i++) line([front[i], back[i]], left, SOFT)
  })
  sign('hole', 0.78, 0.5, 'a black hole', (x, left) => {
    draw({ kind: 'circle', center: [x, ROW], radius: 0.042, color: GOLD, width: 0.004, draw: 0.5, fade: 0.3 }, left)
    draw({ kind: 'circle', center: [x, ROW], radius: 0.034, fill: '#000000', color: '#000000', width: 0.001, fade: 0.3 }, left)
  })
  // A long wire hung between two ends, sagging gently in the middle
  sign('wire', 0.95, 0.7, 'a long wire', (x, left) => {
    const points = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      points.push([+(x - 0.09 + 0.18 * t).toFixed(4), +(ROW - 0.02 + 0.04 * (1 - (2 * t - 1) ** 2)).toFixed(4)])
    }
    draw({ kind: 'line', points, smooth: true, color: '#aeeeff', width: 0.003, draw: 0.6, fade: 0.3 }, left)
    for (const end of [points[0], points[40]]) draw({ kind: 'circle', center: end, radius: 0.004, fill: '#aeeeff', color: '#aeeeff', width: 0.001, fade: 0.3 }, left)
  })
  wait(life)
})

leave()
