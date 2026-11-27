// The fourth dimension, clip 4 of films/fourth_dimension/fourth_dimension.json: how the hypothesis could be tested, staged as
// the experiment itself. The Earth lies at the bottom of its own well, with space falling in along every
// spoke. On the wall of that well stands the clock that was built in 2021: a cloud of strontium atoms a
// millimetre tall, whose top ticks faster than its bottom. From that clock to a ruler: a wire of
// superconductor one light-second long, laid out to scale, three quarters of the way to the Moon, and
// crossed by a photon in one real second. Wound into a coil it is timed twice, by a camera that flies from
// the Earth out to where the well is almost flat, and the two answers are run as a race: relativity's, where
// both photons arrive together, and the hypothesis's, where the coil far out is the longer one. The author's
// own later notes leave that open, and the clip shows them.
// The Earth is NASA's photograph from Apollo 17 (AS17-148-22727, public domain), cut out onto a clear ground
// as films/fourth_dimension/earth.png.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension/clips/04_experiment.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess
const long = (name, guess) => lines[name] ?? guess

const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#c9d4f0'
const GOLD = '#ffd27a'
const GRID = '#4de3ff'
// Strontium glows blue in its trap; a superconductor is drawn as cold as it is
const ATOM = '#6fb2ff'
const COLD = '#aeeeff'
const LONG = 1920
const SHORT = 1080
const TILT = 62

// A caption and a shape that are left out when their time has shrunk to nothing
const cap = (text, seconds, options) => { if (seconds > 0.15) caption(text, seconds, options) }
const sketch = (shape, seconds) => { if (seconds > 0.15) draw(shape, seconds) }
const part = value => +value.toFixed(4)

// ---- the sheet's own sums, for what is drawn on it ----

const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
// Where a point of the sheet stands on the screen, in black hole radii from the hole: across and toward are
// its place on the sheet, in radii to the right of the hole and toward the camera
function laySheet (size, radii, holeY) {
  const shadow = size / 100 * SHORT
  const distance = 2.5 * LONG
  const sin = Math.sin(TILT * Math.PI / 180)
  const cos = Math.cos(TILT * Math.PI / 180)
  const down = (holeY - 0.5) * SHORT
  let throat = shadow
  let depth = 0
  let away = 0
  for (let round = 0; round < 3; round++) {
    depth = radii * throat
    away = (down * (distance + depth * cos) - distance * depth * sin) / Math.max(distance * cos + down * sin, distance * 0.05)
    if (round < 2) throat = shadow * Math.max(distance + depth * cos - away * sin, distance * 0.05) / distance
  }
  return (across, toward = 0) => {
    const x = across * throat
    const y = toward * throat + away
    const deep = depth * dent(Math.hypot(x, toward * throat), throat)
    const scale = distance / (distance + deep * cos - y * sin)
    return [part(x * scale / shadow), part((down - (y * cos + deep * sin) * scale) / shadow)]
  }
}

// ---- the three framings of the Earth ----

// Near: the Earth fills a tenth of the frame, and the camera can go up to its edge
const NEAR = { blackHoleSize: 8, blackHoleX: 0.5, blackHoleY: 0.6, gridDepth: 2, gridSpan: 0.6, gridRings: 40, particleSize: 1.2, particleSizeMin: 1.2 }
// To scale: a light-second is 47.06 radii of the Earth and the Moon stands 60.34 away, so the Earth is small,
// and the sheet has all the rings it can, to reach that far
const SCALE = { blackHoleSize: 2.2, blackHoleX: 0.12, blackHoleY: 0.6, gridDepth: 1.2, gridSpan: 2.4, gridRings: 112, particleSize: 1.8, particleSizeMin: 1.8 }
// Two places: the Earth at the left with a deeper well, and room far out on the flat of the sheet
const TWO = { blackHoleSize: 4, blackHoleX: 0.22, blackHoleY: 0.64, gridDepth: 3, gridSpan: 2, gridRings: 72, particleSize: 1.8, particleSizeMin: 1.8 }
const onNear = laySheet(NEAR.blackHoleSize, NEAR.gridDepth, NEAR.blackHoleY)
const onScale = laySheet(SCALE.blackHoleSize, SCALE.gridDepth, SCALE.blackHoleY)
const onTwo = laySheet(TWO.blackHoleSize, TWO.gridDepth, TWO.blackHoleY)

film({
  fps: 60,
  seed: 23,
  warmup: 10,
  settings: {
    ...NEAR,
    numParticles: 10000,
    lensingEnabled: false,
    ringEnabled: false,
    // Space falling inward along every spoke, as the hypothesis has it: strokes over the whole sheet, each into
    // the well, gently, for a planet. They are few, thin and of the sheet's own colour, so that the rings of
    // the well show through them: many wide white ones cover its far wall like a veil
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
    gridTilt: TILT,
    gridSpokes: 24,
    gridRide: 1,
    // The field is born round the Earth, which stands off the centre of the frame in most of the clip
    fieldAtHole: 1,
    gridFade: 0.3
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

// ---- the clip's seconds, laid out first ----

const tTest = 0.8
const tRuler = tTest + long('test', 11.3) + 0.9
const tPull = tRuler + heard('ruler', 'coil', 5.6) - 2.4
const tPhoton = tRuler + long('ruler', 19) + 1.3
const RUN = 2.6
const farAt = tPhoton + heard('photon', 'time', 8.4) - 0.2
const tAnswers = Math.max(tPhoton + long('photon', 9.1) + 0.8, farAt + RUN + 0.7)
const tQuestion = tAnswers + long('answers', 14.2) + 0.9
const tNotes = tQuestion + 1.4
// The author's two notes are read at the reader's pace, whatever the voice's: the second is written 2.6 s
// after the first, and both stay 3.2 s once written out. The last line waits for them
const NOTE_WRITTEN = [1.8, 2.2]
const NOTE_TWO = 1 + 2.6
const tOne = Math.max(tQuestion + long('question', 8.6) + 0.6, tNotes + NOTE_TWO + NOTE_WRITTEN[1] + 3.2 + 0.5)
const tLast = tOne + long('one', 5.4) + 0.5
const END = tLast + 3.8

// The Earth, for the whole clip: a little wider than the shadow it covers. It steps back while the author's
// notes are read
draw({
  kind: 'image', src: 'films/fourth_dimension/earth.png', center: { hole: [0, 0] }, width: 2.62, opacity: 'lit',
  values: { lit: [[0, 1], [tNotes, 1], [tNotes + 1, 0.1], [tOne - 0.8, 0.1], [tOne + 0.4, 1]] }
}, END)

// ---- a coil: a helix seen a little from its end ----

// The places of a coil: `at(along, up)` puts a point given along its axis and up from it
function coil ({ length, radius, lean, turns, at: place }) {
  const point = angle => place(length * (angle + Math.PI / 2) / (2 * Math.PI * turns) + lean * radius * Math.cos(angle), radius * Math.sin(angle))
  const arcs = []
  for (let half = 0; half < turns * 2; half++) {
    const from = -Math.PI / 2 + Math.PI * half
    const points = []
    for (let step = 0; step <= 8; step++) points.push(point(from + Math.PI * step / 8))
    // The half of a turn that leans toward its end is the near one
    arcs.push({ near: half % 2 === 0, points })
  }
  // The place a share of the way along the wire
  const along = share => point(-Math.PI / 2 + 2 * Math.PI * turns * Math.min(Math.max(share, 0), 1))
  return { arcs, along }
}
// Draws it, winding over `wind` seconds, for `seconds`
function wound (made, seconds, { wind = 0, color = COLD, width = 0.0034 } = {}) {
  const born = now()
  made.arcs.forEach((arc, index) => {
    const late = wind * index / made.arcs.length
    at(born + late, () => {
      sketch({
        kind: 'line', points: arc.points, smooth: true, color, width: arc.near ? width : width * 0.75, opacity: arc.near ? 1 : 0.55,
        draw: wind > 0 ? Math.max(wind / made.arcs.length * 1.6, 0.12) : 0, fade: 0.35
      }, seconds - late)
    })
  })
}
// A photon through a coil: `share` is how far along it is at a second of its own
function photon (made, share, seconds, hole) {
  const spot = (x, y) => hole ? { hole: [x, y] } : [x, y]
  const size = hole ? [0.16, 0.42] : [0.0085, 0.022]
  const values = { x: s => made.along(share(s))[0], y: s => made.along(share(s))[1] }
  sketch({ kind: 'circle', center: spot('x', 'y'), radius: size[1], fill: GOLD, color: GOLD, width: 0.0005, opacity: 0.2, fade: 0.2, values }, seconds)
  sketch({ kind: 'circle', center: spot('x', 'y'), radius: size[0], fill: '#fffbe8', color: GOLD, width: 0.002, fade: 0.2, values }, seconds)
}
const upTo = seconds => s => Math.min(Math.max(s / seconds, 0), 1)

// ---- a millimetre ----

shot('a millimetre', () => {
  set({ fade: 1 })
  to({ fade: 0 }, 0.8)
  const start = now()
  say('test', 11.3)
  const end = tRuler
  const clock = start + heard('test', 'clock', 5.7)
  const millimetre = start + heard('test', 'millimetre', 10)
  // The camera goes up to the edge of the Earth, where the wall of its well rises
  at(clock - 2.6, () => { to({ cameraZoom: 3, cameraX: 1.5, cameraY: -0.3, gridSheet: 0.7 }, 3.4) })
  // The clock of 2021: a cloud of atoms held by a beam of light in a stack of sheets, a millimetre from its
  // foot to its head. It stands in the well, its foot the deeper; each sheet blinks, the higher the faster.
  // It stays while the next line names it, until the camera leaves
  at(clock + 0.5, () => {
    const life = tPull + 0.4 - now()
    const SHEETS = 13
    const X = 1.7
    const FOOT = 0.4
    const HEAD = 1.45
    const MIDDLE = (FOOT + HEAD) / 2
    sketch({ kind: 'circle', center: { hole: [X, MIDDLE] }, radius: 0.6, radiusY: 0.82, fill: ATOM, color: ATOM, width: 0.0005, opacity: 0.12, fade: 0.8 }, life)
    sketch({ kind: 'line', points: [{ hole: [X, FOOT - 0.16] }, { hole: [X, HEAD + 0.16] }], color: SOFT, width: 0.0016, opacity: 0.4, fade: 0.8 }, life)
    for (let index = 0; index < SHEETS; index++) {
      const rate = 0.8 + 0.9 * index / (SHEETS - 1)
      sketch({
        kind: 'circle', center: { hole: [X, part(FOOT + (HEAD - FOOT) * index / (SHEETS - 1))] }, radius: 0.3, radiusY: 0.036, fill: ATOM, color: '#e3f0ff', width: 0.0014,
        opacity: 'lit', fade: 0.6, values: { lit: s => part(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * s))) }
      }, life)
    }
    cap('the clock of JILA, Boulder, 2021\n*{100 000} strontium atoms', life, { at: { hole: [X + 2.75, HEAD - 0.08] }, size: 0.028, font: 'noto', accent: ATOM, color: INK, plate: 0.55, fade: 0.5 })
    at(millimetre - 0.7, () => {
      const rest = tPull + 0.4 - now()
      sketch({ kind: 'line', points: [{ hole: [X + 0.52, FOOT] }, { hole: [X + 0.52, HEAD] }], arrow: 'both', color: INK, width: 0.0024, fade: 0.4, draw: 0.5 }, rest)
      cap('1 mm', rest, { at: { hole: [X + 0.95, MIDDLE - 0.12] }, size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
    })
  })
  at(clock + 2.2, () => {
    cap('at its top, time runs faster than at its bottom: by *{0.000 000 000 000 000 000 1}', end + 1.6 - now(), { at: [0.5, 0.845], size: 0.032, font: 'noto', accent: GOLD, plate: 0.65 })
  })
  wait(end - now())
})

// ---- from a clock to a ruler ----

shot('the atomic ruler', () => {
  const start = now()
  say('ruler', 19)
  const end = tPhoton
  const coilAt = start + heard('ruler', 'coil', 5.6)
  const far = start + heard('ruler', 'kilometres', 9.2)
  const moon = start + heard('ruler', 'moon', 12.8)
  const second = start + heard('ruler', 'second', 17.6)
  // The camera leaves the Earth until a light-second fits in the frame
  at(tPull - 0.3, () => { to({ trailIntensity: 0.5 }, 0.3) })
  at(tPull, () => { to({ cameraZoom: 1, cameraX: 0, cameraY: 0, gridSheet: 0.8, ...SCALE }, 3.6) })
  at(tPull + 3.6, () => { to({ trailIntensity: 0.2 }, 0.6) })
  // "Picture a coil": the ruler, wound
  at(coilAt + 0.2, () => {
    const made = coil({ length: 0.3, radius: 0.085, lean: 0.34, turns: 9, at: (along, up) => [part(0.35 + along), part(0.33 - up)] })
    wound(made, far + 2.2 - now(), { wind: 2.2, width: 0.004 })
    cap('a coil of superconductor', far + 2.2 - now(), { at: [0.5, 0.185], size: 0.028, font: 'unbounded', color: INK, fade: 0.5 })
  })
  // and laid out: a wire from the Earth along the sheet, which runs down a little into the Earth's well
  const wire = []
  const REACH = 1 + 299792.458 / 6371
  for (let across = 1.5; across < REACH; across += 1.5) wire.push(onScale(across))
  wire.push(onScale(REACH))
  const tip = wire[wire.length - 1]
  const middle = [tip[0] * 0.5, tip[1]]
  const OUT = 2.8
  at(far - 0.3, () => {
    const life = end + 0.6 - now()
    sketch({ kind: 'line', points: wire.map(([x, y]) => ({ hole: [x, y] })), color: COLD, width: 0.0036, draw: OUT, fade: 0.5 }, life)
    cap('*{#{thousands:0} 000 km}', OUT, { at: { hole: [middle[0], middle[1] + 4.4] }, size: 0.04, font: 'unbounded', accent: COLD, fade: 0.2, values: { thousands: [0, 300] } })
    at(now() + OUT, () => {
      cap('*{299 792.458 km}', end + 0.6 - now(), { at: { hole: [middle[0], middle[1] + 4.4] }, size: 0.04, font: 'unbounded', accent: COLD, fade: 0.2 })
      sketch({ kind: 'circle', center: { hole: tip }, radius: 0.5, fill: COLD, color: COLD, fade: 0.3 }, end + 0.6 - now())
    })
  })
  // The Moon, as far and as large as it is beside this Earth
  at(moon - 0.9, () => {
    const life = end + 0.6 - now()
    const [x, y] = onScale(384400 / 6371)
    sketch({ kind: 'circle', center: { hole: [x, y] }, radius: 0.62, fill: '#8a8f9c', color: '#8a8f9c', opacity: 0.22, fade: 0.8 }, life)
    sketch({ kind: 'circle', center: { hole: [x, y] }, radius: 0.273, fill: '#cfd2da', color: '#eef0f5', width: 0.001, fade: 0.8 }, life)
    sketch({ kind: 'line', points: [{ hole: [tip[0] + 0.9, tip[1]] }, { hole: [x - 0.7, y] }], dash: true, color: SOFT, width: 0.002, opacity: 0.7, fade: 0.8, draw: 0.8 }, life)
    cap('the Moon', life, { at: { hole: [x, y - 2.3] }, size: 0.026, font: 'unbounded', color: INK, fade: 0.8 })
    cap('the Earth', life, { at: { hole: [0, -2.9] }, size: 0.026, font: 'unbounded', color: INK, fade: 0.8 })
    cap('more than three quarters of the way', life, { at: { hole: [middle[0], middle[1] - 2.3] }, size: 0.028, font: 'noto', color: SOFT, fade: 0.8 })
    cap('the Earth and the Moon, to scale', life, { at: [0.5, 0.185], size: 0.024, font: 'unbounded', color: SOFT, fade: 0.8 })
  })
  // "in one second": a photon crosses the wire in one second of the film
  at(second - 1.3, () => {
    cap('light crosses it in *{1 second}', end + 0.6 - now(), { at: [0.5, 0.835], size: 0.034, font: 'noto', accent: GOLD, plate: 0.65 })
  })
  at(second - 0.5, () => {
    const lengths = [0]
    for (let index = 1; index < wire.length; index++) lengths.push(lengths[index - 1] + Math.hypot(wire[index][0] - wire[index - 1][0], wire[index][1] - wire[index - 1][1]))
    const whole = lengths[lengths.length - 1]
    const along = share => {
      const run = whole * Math.min(Math.max(share, 0), 1)
      let index = 1
      while (index < lengths.length - 1 && lengths[index] < run) index++
      const piece = (run - lengths[index - 1]) / (lengths[index] - lengths[index - 1])
      return [part(wire[index - 1][0] + (wire[index][0] - wire[index - 1][0]) * piece), part(wire[index - 1][1] + (wire[index][1] - wire[index - 1][1]) * piece)]
    }
    // Twice: once as the word is said, and once more to be watched
    for (const from of [0, 2.2]) {
      at(now() + from, () => {
        const values = { x: s => along(s)[0], y: s => along(s)[1] }
        sketch({ kind: 'circle', center: { hole: ['x', 'y'] }, radius: 1.3, fill: GOLD, color: GOLD, width: 0.0005, opacity: 0.22, fade: 0.1, values }, 1.25)
        sketch({ kind: 'circle', center: { hole: ['x', 'y'] }, radius: 0.5, fill: '#fffbe8', color: GOLD, width: 0.002, fade: 0.1, values }, 1.25)
        cap('*{#{t:3} s}', 2, { at: { hole: [middle[0], middle[1] + 1.9] }, size: 0.034, font: 'geistMono', accent: GOLD, fade: 0.15, values: { t: [[now(), 0], [now() + 1, 1, 'linear']] } })
      })
    }
    cap('shown at its true speed', 4.2, { at: { hole: [middle[0], middle[1] - 3.9] }, size: 0.026, font: 'noto', color: SOFT, fade: 0.4 })
  })
  wait(end - now())
})

// ---- the photon, on Earth and far out ----

// The two coils of the experiment, the same coil in two places: beside the Earth, down in its well, and far
// out on the flat of the sheet, 20 radii of the Earth away on the screen. In radii of the Earth
const COIL = { length: 4.4, radius: 0.78, lean: 0.36, turns: 7 }
const HERE_FROM = 1.5
let near = 1
let wide = 90
for (let round = 0; round < 40; round++) {
  const tried = (near + wide) / 2
  if (onTwo(tried)[0] < 20) near = tried
  else wide = tried
}
const [, levelHere] = onTwo(1.02)
const [thereX, levelThere] = onTwo(near)
const here = coil({ ...COIL, at: (along, up) => [part(HERE_FROM + along), part(levelHere + 0.15 + up)] })
const there = coil({ ...COIL, at: (along, up) => [part(thereX + along), part(levelThere + 0.5 + up)] })
const holes = made => ({ ...made, arcs: made.arcs.map(arc => ({ ...arc, points: arc.points.map(([x, y]) => ({ hole: [x, y] })) })) })
// Where the camera looks to see each of them
const AT_EARTH = { cameraX: 2.7, cameraY: 0.7 }
const FAR_OUT = { cameraX: part(thereX + COIL.length / 2), cameraY: part(levelThere + 0.3) }

shot('on Earth and far out', () => {
  const start = now()
  say('photon', 9.1)
  const end = tAnswers
  const onEarth = start + heard('photon', 'earth', 1.4)
  const inSpace = start + heard('photon', 'space', 4.6)
  // Closer again, on the Earth and the coil beside it, down in the well
  at(start - 1.1, () => { to({ ...TWO, cameraZoom: 2, ...AT_EARTH }, 2.4) })
  at(start - 0.6, () => {
    // The two leave the scene when the race comes forward
    wound(holes(here), tAnswers - 0.4 - now(), { wind: 1.6 })
    wound(holes(there), tAnswers - 0.4 - now(), { wind: 1.6 })
  })
  at(onEarth - 0.2, () => {
    photon(here, upTo(RUN), RUN + 0.5, true)
    cap('on Earth, deep in the well\n*{#{t:3} s}', inSpace + 0.6 - now(), { at: { hole: [HERE_FROM + COIL.length / 2, levelHere - 2.1] }, size: 0.026, font: 'noto', accent: GOLD, plate: 0.6, values: { t: [[now(), 0], [now() + RUN, 1, 'linear']] } })
  })
  // The camera flies out along the sheet to the same coil, far from the Earth. The trails are cut short for
  // the flight, which would draw them as rain, and stay short where little moves
  at(inSpace - 1.7, () => { to({ trailIntensity: 0.5 }, 0.3) })
  at(inSpace - 1.4, () => { to(FAR_OUT, 3.4) })
  // Its stopwatch waits at nought until the photon is sent
  at(Math.min(inSpace + 2.2, farAt - 0.3), () => {
    cap('far out, where the well is almost flat\n*{#{t:3} s} ?', end - 0.4 - now(), { at: { hole: [thereX + COIL.length / 2, levelThere - 1.3] }, size: 0.026, font: 'noto', accent: GOLD, plate: 0.6, values: { t: [[farAt, 0], [farAt + RUN, 1, 'linear']] } })
  })
  at(farAt, () => { photon(there, upTo(RUN), RUN + 0.5, true) })
  wait(end - now())
})

// ---- one coil, two answers: a race ----

// The same coil twice on the frame, one above the other from one starting line: far out above, on Earth
// below, as the well has them. The lower one starts beside the Earth itself
const LANE = { from: 0.27, length: 0.44, far: 0.37, earth: 0.635 }
const lane = (y, stretch = 1, skip = 0) => coil({
  length: LANE.length * stretch, radius: 0.058, lean: 0.36, turns: Math.round(12 * stretch), at: (along, up) => [part(LANE.from + skip + along), part(y - up)]
})
const MORE = 1.16

shot('two answers', () => {
  const start = now()
  say('answers', 14.2)
  const end = tQuestion
  const hypothesis = start + heard('answers', 'hypothesis', 4.9)
  const more = start + heard('answers', 'more', 12.6)
  const board = tNotes + 0.2
  // The camera draws back and the scene dims: the two coils come forward as a diagram
  at(start - 0.7, () => { to({ cameraZoom: 1, cameraX: 0, cameraY: 0, fade: 0.62 }, 1.3) })
  const earthLane = lane(LANE.earth)
  const farLane = lane(LANE.far)
  at(start - 0.2, () => {
    wound(farLane, board - now(), { wind: 0.9 })
    wound(earthLane, board - now(), { wind: 0.9 })
    cap('far out · the well is almost flat', board - now(), { at: [LANE.from + 0.115, LANE.far - 0.105], size: 0.024, font: 'unbounded', color: SOFT, fade: 0.4 })
    cap('on Earth · deep in the well', board - now(), { at: [LANE.from + 0.1, LANE.earth + 0.105], size: 0.024, font: 'unbounded', color: SOFT, fade: 0.4 })
    // The starting line, and the depth of the well between the two
    sketch({ kind: 'line', points: [[LANE.from - 0.012, LANE.far - 0.075], [LANE.from - 0.012, LANE.earth + 0.075]], color: SOFT, width: 0.002, opacity: 0.6, fade: 0.4 }, board - now())
    sketch({ kind: 'line', points: [[LANE.from - 0.11, LANE.far], [LANE.from - 0.11, LANE.earth - 0.09]], arrow: 'end', color: W, width: 0.0042, fade: 0.4, draw: 0.8 }, board - now())
    cap('W', board - now(), { at: [LANE.from - 0.135, (LANE.far + LANE.earth) / 2 - 0.04], size: 0.036, font: 'unbounded', color: W, fade: 0.4 })
  })
  // Relativity: both photons arrive as the second ends
  const FIRST = 2.4
  at(start + heard('answers', 'relativity', 0.1) + 0.5, () => {
    const until = hypothesis - 0.3 - now()
    photon(farLane, upTo(FIRST), until, false)
    photon(earthLane, upTo(FIRST), until, false)
    for (const y of [LANE.far, LANE.earth]) {
      cap('*{#{t:3} s}', until, { at: [LANE.from + LANE.length + 0.085, y], size: 0.032, font: 'geistMono', accent: GOLD, fade: 0.3, values: { t: [[now(), 0], [now() + FIRST, 1, 'linear']] } })
    }
    cap('relativity: *{one second}, here and there', until, { at: [0.5, 0.185], size: 0.036, font: 'noto', accent: GRID, plate: 0.65 })
  })
  // The hypothesis: out of the well the coil is no longer squeezed along W, so the one far out is the longer
  at(hypothesis + 0.3, () => {
    cap('the hypothesis: in the well, matter is squeezed along *{W}', board - now(), { at: [0.5, 0.185], size: 0.036, font: 'noto', accent: W, plate: 0.65 })
  })
  const SECOND = 3
  const raced = Math.max(more - 0.4 - SECOND, hypothesis + 3.2)
  const rest = lane(LANE.far, MORE - 1, LANE.length)
  at(raced - 2.2, () => {
    wound(rest, board - now(), { wind: 1.1, color: W })
    cap('not squeezed: *{longer}', board - now(), { at: [LANE.from + LANE.length * (1 + MORE) / 2, LANE.far - 0.105], size: 0.024, font: 'unbounded', color: SOFT, accent: W, fade: 0.4 })
  })
  at(raced, () => {
    // The photon far out follows the coil as it is drawn: the coil of the Earth, then the part it has more.
    // Both at the speed of light: when the one on Earth is through, the one far out has the rest still to go
    const whole = { along: share => share * MORE <= 1 ? farLane.along(share * MORE) : rest.along((share * MORE - 1) / (MORE - 1)) }
    photon(whole, upTo(SECOND * MORE), board - now(), false)
    photon(earthLane, upTo(SECOND), board - now(), false)
    cap('*{#{t:3} s}', board - now(), { at: [LANE.from + LANE.length + 0.085, LANE.earth], size: 0.032, font: 'geistMono', accent: GOLD, fade: 0.3, values: { t: [[now(), 0], [now() + SECOND, 1, 'linear']] } })
    at(now() + SECOND, () => {
      cap('*{more than 1 s}', board - now(), { at: [LANE.from + LANE.length * (1 + MORE) / 2, LANE.far + 0.105], size: 0.028, font: 'unbounded', accent: W, fade: 0.3 })
    })
  })
  wait(end - now())
})

// ---- an open question ----

shot('an open question', () => {
  say('question', 8.6)
  // The author's own later notes on this design, as they were written
  at(tNotes, () => {
    to({ fade: 0.85 }, 1)
    const life = tOne - 0.5 - now()
    cap('from the author’s notes', life, { at: [0.5, 0.27], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.5 })
    cap('*{11.09.2023}   Baryonic matter may not shrink. That is a question.', life, { at: [0.5, 0.4], size: 0.038, font: 'noto', accent: GOLD, color: INK, reveal: 'letters', revealOver: NOTE_WRITTEN[0], fade: 0.5 })
    at(tNotes + NOTE_TWO, () => {
      cap('*{08.10.2023}   Gravitational time dilation is mistakenly linked\nto the compression of baryonic matter.', tOne - 0.5 - now(), { at: [0.5, 0.56], size: 0.038, font: 'noto', accent: GOLD, color: INK, reveal: 'letters', revealOver: NOTE_WRITTEN[1], fade: 0.5 })
    })
  })
  // "One coil. One photon. One second, or a little more": back to the experiment itself, far out
  at(tOne - 0.6, () => {
    to({ fade: 0, cameraZoom: 2, ...FAR_OUT }, 1.6)
    wound(holes(there), END - now(), { wind: 1.2 })
  })
  wait(tOne - now())
  say('one', 5.4)
  at(tOne + heard('one', 'photon', 1.7) - 0.2, () => { photon(there, upTo(3.4), END - now(), true) })
  at(tOne + heard('one', 'second', 3.1) - 0.3, () => {
    cap('*{1.000 s}, or a little more', tLast + 0.3 - now(), { at: [0.5, 0.835], size: 0.036, font: 'geistMono', accent: GOLD, color: INK, plate: 0.65 })
  })
  wait(tLast - now())
  // The author's line on time, to leave on
  cap('“Light is a time.”', 3.3, { at: [0.5, 0.185], size: 0.046, font: 'unbounded', color: GOLD })
  wait(END - now())
})
