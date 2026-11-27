// The fourth dimension as popular science, clip 10 of films/fourth_dimension_pop.json: the test: a wire one light second long, timed on Earth and far from any planet.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_10_test.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  fail: 'A nice story is not science until it can fail. So how could this one fail?',
  clock: 'Gravity slows time. In twenty twenty-two, physicists measured that with atomic clocks, across a single millimetre of height.',
  ruler: 'The hypothesis adds something. If matter deep in a well is squeezed along W, our rulers are squeezed too. So we need a ruler we can trust.',
  wire: 'Take a superconducting wire, almost three hundred thousand kilometres long. Exactly as far as light travels in one second. And wind it into a coil.',
  twice: 'Send a pulse of light through it, here on Earth. Then carry the coil far away from any planet, and do it again.',
  verdict: 'Einstein says: one second, both times. The hypothesis says: out there, a little more than one second. One number. Two ideas. Only one survives.'
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

// ---- this chapter's own drawing ----

const COLD = '#aeeeff'
const GRID = '#4de3ff'
const part = value => +value.toFixed(4)
const sketch = (shape, seconds) => { if (seconds > 0.15) draw(shape, seconds) }
const cap = (text, seconds, options) => { if (seconds > 0.15) caption(text, seconds, options) }

// A coil: a helix seen a little from its end, in the frame's own coordinates. `along(share)` is the place a
// share of the way along its wire
function coil ({ from, y, length, radius, turns, lean = 0.36 }) {
  const point = angle => [part(from + length * (angle + Math.PI / 2) / (2 * Math.PI * turns) + lean * radius * Math.cos(angle)), part(y - radius * Math.sin(angle))]
  const arcs = []
  for (let half = 0; half < turns * 2; half++) {
    const start = -Math.PI / 2 + Math.PI * half
    const points = []
    for (let step = 0; step <= 8; step++) points.push(point(start + Math.PI * step / 8))
    arcs.push({ near: half % 2 === 0, points })
  }
  const along = share => point(-Math.PI / 2 + 2 * Math.PI * turns * Math.min(Math.max(share, 0), 1))
  return { arcs, along }
}
// Draws a coil, winding over `wind` seconds, for `seconds`
function wound (made, seconds, wind = 0, color = COLD) {
  const born = now()
  made.arcs.forEach((arc, index) => {
    const late = wind * index / made.arcs.length
    at(born + late, () => {
      sketch({ kind: 'line', points: arc.points, smooth: true, color, width: arc.near ? 0.0036 : 0.0027, opacity: arc.near ? 1 : 0.55, draw: wind > 0 ? Math.max(wind / made.arcs.length * 1.6, 0.12) : 0, fade: 0.35 }, seconds - late)
    })
  })
}
// A pulse of light through a coil over `run` seconds, with its stopwatch beside the coil
function pulse (made, run, seconds, watchAt) {
  const born = now()
  const share = s => Math.min(Math.max(s / run, 0), 1)
  const values = { x: s => made.along(share(s))[0], y: s => made.along(share(s))[1] }
  sketch({ kind: 'circle', center: ['x', 'y'], radius: 0.022, fill: GOLD, color: GOLD, width: 0.0005, opacity: 0.25, fade: 0.2, values }, seconds)
  sketch({ kind: 'circle', center: ['x', 'y'], radius: 0.009, fill: '#fffbe8', color: GOLD, width: 0.002, fade: 0.2, values }, seconds)
  cap('*{#{t:3} s}', seconds, { at: watchAt, size: 0.036, font: 'geistMono', accent: GOLD, fade: 0.3, values: { t: [[born, 0], [born + run, 1, 'linear']] } })
}

// The clip's whole length, for what stays on through all of it
const SHOTS = ['fail', 'clock', 'ruler', 'wire', 'twice', 'verdict']
const END = 2.8 + SHOTS.reduce((sum, name) => sum + long(name) + 0.6, 0) + 0.8

film({
  fps: 60,
  seed: 10,
  warmup: 10,
  settings: {
    // The Earth at the left with its well, and room on the flat of the sheet at the right
    blackHoleSize: 4,
    blackHoleX: 0.22,
    blackHoleY: 0.64,
    gridDepth: 3,
    gridSpan: 2,
    gridRings: 72,
    particleSize: 1.8,
    particleSizeMin: 1.8,
    numParticles: 10000,
    lensingEnabled: false,
    ringEnabled: false,
    // Space falling gently into the Earth's well along every spoke
    colorPalette: [{ r: 120, g: 222, b: 255, enabled: true, percent: 70 }, { r: 235, g: 246, b: 255, enabled: true, percent: 30 }],
    orbitalStrength: 0,
    gravityInertia: 0.3,
    gravityStrength: 3,
    gravityReach: 14,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.02,
    trailIntensity: 0.2,
    depthFade: 0,
    minOpacity: 0.2,
    baseBrightness: 0.5,
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
    gridColor: GRID,
    gridSheet: 0.8,
    gridTilt: 62,
    gridSpokes: 24,
    gridRide: 1,
    // The whole column lies on the sheet: at the default Ride Edge the matter the well gathers from every
    // depth hung part of the way between where it flies and the surface, a cloud under the Earth
    gridRideSoft: 0.01,
    // and the slab reaches the whole column: Ride Depth is in hole radii, and this hole is half the default
    // size, so at the default slab half the column flew free round the Earth, a cloud in front of the well
    gridRideDepth: 400,
    // The Earth's well is a billionth of a black hole's: no redshift to see near it
    gravityRedshift: 0,
    fieldAtHole: 1,
    gridFade: 0.3
  }
})
set({ letterbox: 0, filmGrain: 0 })
chapter('10', 'HOW TO PROVE IT WRONG')

// The Earth, NASA's Apollo 17 photograph, stands over the hole for the whole clip. The hole is the scene's
// way of giving the Earth a well and a pull, and is never to be seen as one: the photograph comes up with
// the picture as the chapter's card leaves, covering the shadow from the card's last second on
at(1.6, () => {
  draw({ kind: 'image', src: 'films/fourth_dimension_earth.png', center: { hole: [0, 0] }, width: 2.62, fade: 1.2 }, END - now())
})

shot('fail', () => {
  const start = now()
  const spoken = say('fail')
  // The space falls into the well: what a claim says moves
  at(start + heard('fail', 'fail', 0.55) - 0.3, () => {
    caption('a claim that can *{fail}', spoken + 0.6 - (now() - start), { at: [0.6, 0.3], size: 0.05, font: 'unbounded', color: INK, accent: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('clock', () => {
  const start = now()
  const spoken = say('clock')
  const life = spoken + 0.6
  status('known', spoken)
  // The space falls faster for a moment: gravity, the thing that slows time
  at(start, () => { to({ gravityStrength: 5 }, 1.5) })
  // Two clocks, one a millimetre above the other: the upper counts a little faster
  at(start + heard('clock', 'clocks', 0.35) - 0.4, () => {
    const rest = life - (now() - start)
    const born = now()
    for (const [y, rate, name] of [[0.34, 1, 'higher'], [0.48, 0.96, 'lower']]) {
      sketch({ kind: 'circle', center: [0.62, y], radius: 0.05, color: INK, width: 0.003, fill: '#101a33', opacity: 0.9, fade: 0.3 }, rest)
      cap('#{n:0}', rest, { at: [0.62, y], size: 0.03, font: 'geistMono', color: INK, fade: 0.3, values: { n: [[born, 0], [born + rest, 1000 * rate * rest, 'linear']] } })
      cap(name, rest, { at: [0.73, y], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.3 })
    }
    sketch({ kind: 'line', points: [[0.55, 0.34], [0.55, 0.48]], arrow: 'both', color: SOFT, width: 0.002, fade: 0.3, draw: 0.5 }, rest)
  })
  at(start + heard('clock', 'millimetre', 0.85) - 0.4, () => {
    cap('*{2022 · 1 mm}', life - (now() - start), { at: [0.62, 0.62], size: 0.05, font: 'unbounded', accent: GOLD, fade: 0.3 })
  })
  wait(life)
})

shot('ruler', () => {
  const start = now()
  const spoken = say('ruler')
  const life = spoken + 0.6
  status('idea', spoken)
  at(start, () => { to({ gravityStrength: 3 }, 1.5) })
  // A ruler down the wall of the well, to the Earth: its marks crowd together as it goes down
  at(start + heard('ruler', 'rulers', 0.4) - 0.5, () => {
    const rest = life - (now() - start)
    const top = [0.7, 0.3]
    const foot = [0.33, 0.6]
    sketch({ kind: 'line', points: [top, foot], color: INK, width: 0.003, fade: 0.3, draw: 0.8 }, rest)
    let share = 0
    let step = 0.13
    for (let index = 0; index < 12 && share <= 1; index++) {
      const x = top[0] + (foot[0] - top[0]) * share
      const y = top[1] + (foot[1] - top[1]) * share
      sketch({ kind: 'line', points: [[part(x - 0.012), part(y - 0.016)], [part(x + 0.012), part(y + 0.016)]], color: INK, width: 0.0025, fade: 0.3 }, rest)
      share += step
      step *= 0.8
    }
    // The squeeze along W, beside it
    sketch({ kind: 'line', points: [[0.78, 0.36], [0.5, 0.6]], arrow: 'end', color: W, width: 0.0045, fade: 0.3, draw: 0.8 }, rest)
    cap('W', rest, { at: [0.69, 0.52], size: 0.04, font: 'unbounded', color: W, fade: 0.3 })
    cap('squeezed along *{W}', rest, { at: [0.79, 0.27], size: 0.026, font: 'unbounded', color: SOFT, accent: W, fade: 0.3 })
  })
  at(start + heard('ruler', 'trust', 0.92) - 0.5, () => {
    keep('a ruler we can *{trust}?', life - (now() - start))
  })
  wait(life)
})

// The coil of the experiment, the same coil in two places: beside the Earth, and far out at the right
const COIL = { length: 0.22, radius: 0.05, turns: 9 }
const NEAR = coil({ ...COIL, from: 0.33, y: 0.6 })
const FAR = coil({ ...COIL, from: 0.66, y: 0.36 })

shot('wire', () => {
  const start = now()
  const spoken = say('wire')
  const life = spoken + 0.6
  status('idea', spoken)
  // The space eases: the wire is drawn on a quiet sheet
  at(start, () => { to({ gravityStrength: 1.5 }, 2) })
  // The length counted up, to the distance light goes in a second
  const COUNT = 3.2
  at(start + heard('wire', 'kilometres', 0.35) - 1.6, () => {
    const born = now()
    sketch({ kind: 'line', points: [[0.3, 0.42], [0.9, 0.42]], color: COLD, width: 0.0036, draw: COUNT, fade: 0.3 }, heard('wire', 'coil', 0.95) - (born - start))
    cap('*{#{k:0} km}', life - (born - start), { at: [0.6, 0.3], size: 0.05, font: 'unbounded', accent: COLD, fade: 0.3, values: { k: [[born, 0], [born + COUNT, 299792]] } })
  })
  at(start + heard('wire', 'second', 0.72) - 0.3, () => {
    cap('= 1 light second', life - (now() - start), { at: [0.6, 0.36], size: 0.032, font: 'unbounded', color: GOLD, fade: 0.3 })
  })
  // And wound into a coil, beside the Earth
  at(start + heard('wire', 'coil', 0.95) - 0.4, () => {
    wound(NEAR, life - (now() - start), 1.2)
  })
  wait(life)
})

shot('twice', () => {
  const start = now()
  const spoken = say('twice')
  const life = spoken + 0.6
  const end = start + life
  status('idea', spoken)
  wound(NEAR, life, 0)
  // Here on Earth: the pulse, timed
  at(start + heard('twice', 'Earth', 0.38) - 0.5, () => {
    pulse(NEAR, 2.2, end - now(), [0.44, 0.7])
    cap('on Earth', end - now(), { at: [0.44, 0.76], size: 0.024, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  // Then far from any planet: the same coil, the same pulse
  at(start + heard('twice', 'planet', 0.78) - 0.6, () => {
    wound(FAR, end - now(), 0.8)
    cap('far from any planet', end - now(), { at: [0.77, 0.25], size: 0.024, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  at(start + heard('twice', 'again', 0.95) - 0.6, () => {
    pulse(FAR, 2.2, end - now() + 0.3, [0.77, 0.46])
  })
  wait(life)
})

shot('verdict', () => {
  const start = now()
  const spoken = say('verdict')
  const life = spoken + 0.6
  status('idea', spoken)
  // The scene steps back behind the two answers
  at(start, () => { to({ fade: 0.6 }, 0.8) })
  at(start + heard('verdict', 'Einstein', 0.03), () => {
    cap('Einstein\n*{1 s = 1 s}', life - (now() - start), { at: [0.3, 0.42], size: 0.042, font: 'unbounded', color: SOFT, accent: GRID, plate: 0.55, fade: 0.4 })
  })
  at(start + heard('verdict', 'hypothesis', 0.3) - 0.2, () => {
    cap('the hypothesis\n1 s < *{a little more}', life - (now() - start), { at: [0.7, 0.42], size: 0.042, font: 'unbounded', color: SOFT, accent: W, plate: 0.55, fade: 0.4 })
  })
  at(start + heard('verdict', 'number', 0.7) - 0.3, () => {
    keep('one number, two *{ideas}', life - (now() - start))
  })
  wait(life)
})

leave()
