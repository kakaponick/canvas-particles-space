// The fourth dimension as popular science, clip 2 of films/fourth_dimension_pop.json: a point dragged into a line, a square and a cube: a dimension is one more direction.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_02_ladder.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  zero: "Let's build space from nothing. Start with a point. No room to move at all. Zero dimensions.",
  one: 'Drag the point sideways. Now you have a line: one direction to move in. One dimension.',
  two: 'Drag the line in a new direction, at a right angle to the first. A square. Two.',
  three: 'And once more, at a right angle to both. A cube. Three.',
  pattern: 'See the pattern? A dimension is not a mysterious place. It is just one more direction, at a right angle to all the others.',
  fourth: 'So a fourth dimension needs a fourth direction. Where would it point?'
}

// ---- the film's kit: the same text in every clip of films/fourth_dimension_pop.json ----
const lines = input.lines ?? {}
const cues = input.cues ?? {}
// The colours: the three directions of space, the fourth (W, and every word about it), the ink, a quieter
// ink for what stands beside it, and gold for what was measured
const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b30'
const INK = '#eef2ff'
const SOFT = '#b4c2c8'
const GOLD = '#ffd27a'
// Until a voice has spoken a line it takes what its words would at 155 a minute
const long = name => lines[name] ?? +(LINES[name].split(/\s+/).length * 60 / 155).toFixed(1)
// Marks where a line starts, which is where the voice is laid, and tells its length
const say = name => { mark('say:' + name); return long(name) }
// The second of a line a word falls at: heard in the voice, or this share of the line until it is spoken
const heard = (name, word, share) => cues[name]?.[word] ?? +(long(name) * share).toFixed(2)
const until = second => wait(Math.max(0, second - now()))
// The chapter's card on black; the picture comes up under its last CARD_FADE, and the first line follows at
// CARD. The breaks between chapters ran 4.2 s of silence, 2.8 s of it the card: too long for the operator, so
// the card is held 1.1 s and the picture comes up in 0.7 s
const CARD_FADE = 0.7
const CARD = 1.1 + CARD_FADE
const chapter = (number, name) => {
  set({ fade: 1 })
  caption(`*{${number}}`, CARD, { at: [0.5, 0.43], size: 0.03, font: 'unbounded', accent: W, fade: 0.4 })
  caption(name, CARD, { at: [0.5, 0.52], size: 0.052, font: 'unbounded', color: INK, fade: 0.4 })
  wait(CARD - CARD_FADE)
  to({ fade: 0 }, CARD_FADE)
}
// What kind of claim is on the screen: measured physics, plain geometry, the hypothesis, or a question
// nobody has answered. A line that claims nothing about nature (a question, a thought experiment) has none
const STATUS = { known: ['KNOWN PHYSICS', GOLD], math: ['GEOMETRY', SOFT], idea: ['HYPOTHESIS', W], open: ['OPEN QUESTION', INK] }
const status = (kind, seconds) => caption(STATUS[kind][0], seconds, { at: [0.11, 0.94], size: 0.022, font: 'unbounded', color: STATUS[kind][1], fade: 0.4 })
// The one sentence of a shot a viewer should keep, at the foot of the frame
const keep = (text, seconds, more = {}) => caption(text, seconds, { at: [0.5, 0.86], size: 0.038, font: 'noto', accent: W, plate: 0.35, fade: 0.4, ...more })
// The clip leaves through black
const LEAVE = 0.5
const leave = () => { to({ fade: 1 }, LEAVE) }
// ---- end of the kit ----

film({
  fps: 60,
  seed: 2,
  warmup: 4,
  settings: {
    blackHoleSize: 0,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 10,
    cameraPitch: 8,
    numParticles: 12000,
    baseSpeed: 0.7,
    trailIntensity: 0.25,
    baseBrightness: 0.6,
    // Stars on black, no nebula: its violet and pink read as stock space, and its dust muddied the frame
    starsBrightness: 1.4,
    starDensity: 0.2,
    colorPalette: [
      { r: 225, g: 236, b: 255, enabled: true, percent: 70 },
      { r: 150, g: 200, b: 255, enabled: true, percent: 30 }
    ]
  }
})
chapter('02', 'WHAT IS A DIMENSION?')

const ASPECT = 9 / 16
// A point of space on the frame, as a cabinet drawing sees it: x straight to the right, y straight up, and z
// away to the upper right at 30 degrees, shortened by half, so the square of x and y keeps its right angles
const DEPTH = 0.5
const SLANT = Math.PI / 6
const flat = (centre, size) => ([x, y, z]) => {
  const across = x + DEPTH * z * Math.cos(SLANT)
  const up = y + DEPTH * z * Math.sin(SLANT)
  return [+(centre[0] + size * across * ASPECT).toFixed(5), +(centre[1] - size * up).toFixed(5)]
}
const stroke = (points, color, more = {}) => ({ kind: 'line', points, color, width: 0.0045, fade: 0.4, ...more })
const cube = flat([0.6, 0.5], 0.3)
// A corner while the figure is built: its sides pulled out this far along x, y and z
const built = ([x, y, z], [alongX, alongY, alongZ]) => cube([x * alongX - 0.5, y * alongY - 0.5, z * alongZ - 0.5])
const STAGES = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]
const COLORS = [X, Y, Z]
const corners = []
for (let index = 0; index < 8; index++) corners.push([index & 1, (index >> 1) & 1, (index >> 2) & 1])
const madeBy = corner => corner.lastIndexOf(1)

// The seconds of the whole chapter, laid out first: the figure is drawn once and grows along them
const begin = now()
const starts = {}
let second = begin
for (const name of Object.keys(LINES)) { starts[name] = second; second += long(name) + 0.6 }
const end = second
const word = (name, w, share) => starts[name] + heard(name, w, share)
const pulls = [
  { at: word('one', 'Drag', 0.05), over: 1.6 },
  { at: word('two', 'Drag', 0.05), over: 1.6 },
  { at: word('three', 'once', 0.1), over: 1.6 }
]
const square = pulls[1].at + pulls[1].over

shot('zero', () => {
  say('zero')
  status('math', end - now() - 0.4)
  // In a point nothing can move: the field goes still and dark
  meanwhile(() => { to({ baseSpeed: 0 }, 1.8) })
  // Along a line everything runs one way across the frame; with a square and a cube the camera looks into the depth
  at(pulls[0].at, () => { to({ baseSpeed: 1.8, cameraYaw: 90, cameraPitch: 0 }, 1.6) })
  at(pulls[1].at, () => { to({ cameraYaw: 62, cameraPitch: 32 }, 1.6) })
  at(pulls[2].at, () => { to({ cameraYaw: 28, cameraPitch: 14, baseSpeed: 1.2 }, 1.6) })
  const pointAt = word('zero', 'point', 0.4)
  const born = corner => madeBy(corner) < 0 ? pointAt : pulls[madeBy(corner)].at
  const path = (corner, part) => {
    const keys = madeBy(corner) < 0 ? [[born(corner), built(corner, STAGES[0])[part]]] : []
    for (let pull = Math.max(0, madeBy(corner)); pull < pulls.length; pull++) {
      keys.push([pulls[pull].at, built(corner, STAGES[pull])[part]])
      keys.push([pulls[pull].at + pulls[pull].over, built(corner, STAGES[pull + 1])[part], 'ease'])
    }
    return keys
  }
  const place = corner => ({ x: path(corner, 0), y: path(corner, 1) })
  corners.forEach(corner => {
    at(born(corner), () => {
      draw({ kind: 'circle', center: ['x', 'y'], radius: madeBy(corner) < 0 ? 0.009 : 0.0062, fill: INK, color: INK, fade: 0.3, values: place(corner) }, end - now() + 0.8)
    })
  })
  corners.forEach(from => {
    for (let way = 0; way < 3; way++) {
      if (from[way] === 1) continue
      const to = from.map((part, index) => index === way ? 1 : part)
      const a = place(from)
      const b = place(to)
      at(Math.max(born(from), born(to)), () => {
        draw(stroke([['ax', 'ay'], ['bx', 'by']], COLORS[way], { fade: 0, values: { ax: a.x, ay: a.y, bx: b.x, by: b.y } }), end - now() + 0.8)
      })
    }
  })
  // The count of dimensions beside the figure, gone before the fourth takes its place
  const counted = [[begin, 0], [pulls[0].at + 1.2, 1, 'hold'], [pulls[1].at + 1.2, 2, 'hold'], [pulls[2].at + 1.2, 3, 'hold']]
  const fourthAt = word('fourth', 'fourth', 0.3)
  at(pointAt, () => {
    caption('*{#{count:0}}D', fourthAt + 0.1 - now(), { at: [0.2, 0.44], size: 0.17, font: 'noto', accent: INK, values: { count: counted }, fade: 0.5 })
  })
  const names = [['a point', pointAt, pulls[0].at + 0.4], ['no room to move', word('zero', 'room', 0.55), pulls[0].at + 0.4],
    ['a line', pulls[0].at + 1, pulls[1].at + 0.4], ['a square', pulls[1].at + 1, pulls[2].at + 0.4], ['a cube', pulls[2].at + 1, fourthAt + 0.6]]
  names.forEach(([name, from, till], index) => {
    at(from, () => { caption(name, till - from, { at: [0.2, index === 1 ? 0.66 : 0.6], size: index === 1 ? 0.026 : 0.034, font: 'unbounded', color: SOFT, fade: 0.3 }) })
  })
  // The letter of each direction beside the first edge pulled along it
  const letters = [['X', [0.5, -0.14, 0], X, 0], ['Y', [-0.16, 0.5, 0], Y, 1], ['Z', [1.16, -0.04, 0.5], Z, 2]]
  for (const [letter, where, color, pull] of letters) {
    at(pulls[pull].at + pulls[pull].over * 0.7, () => {
      caption(letter, end - now() + 0.8, { at: cube(where.map(part => part - 0.5)), size: 0.034, font: 'unbounded', color, fade: 0.4 })
    })
  }
  until(starts.one)
})

shot('one', () => {
  say('one')
  until(starts.two)
})

shot('two', () => {
  say('two')
  // The right angle at the corner the square grew from
  at(word('two', 'right', 0.62), () => {
    const c = 0.13
    draw(stroke([cube([c - 0.5, -0.5, -0.5]), cube([c - 0.5, c - 0.5, -0.5]), cube([-0.5, c - 0.5, -0.5])], INK, { width: 0.0035, draw: 0.4 }), square + 1.2 - now() + long('three'))
  })
  until(starts.three)
})

shot('three', () => {
  say('three')
  at(word('three', 'both', 0.5), () => {
    caption('⟂ X  and  ⟂ Y', 2.2, { at: [0.6, 0.16], size: 0.04, font: 'noto', color: Z, fade: 0.3 })
  })
  until(starts.pattern)
})

shot('pattern', () => {
  say('pattern')
  at(word('pattern', 'pattern', 0.1), () => {
    caption('+1 dimension = +1 *{direction}', long('pattern') - 0.2, { at: [0.6, 0.15], size: 0.046, font: 'noto', accent: W, reveal: 'words', revealOver: 1.6, fade: 0.4 })
  })
  at(word('pattern', 'right', 0.85), () => {
    caption('⟂ to all the others', starts.fourth - now(), { at: [0.6, 0.22], size: 0.034, font: 'noto', color: SOFT, fade: 0.3 })
  })
  at(word('pattern', 'just', 0.5), () => { keep('A dimension is just *{one more direction}.', starts.fourth - now()) })
  until(starts.fourth)
})

shot('fourth', () => {
  say('fourth')
  const middle = cube([0, 0, 0])
  const from = word('fourth', 'fourth', 0.3)
  // A fourth arrow that finds nowhere to point: it swings round the cube and settles nowhere, and the field whirls
  // The camera stays inside the field as it swings, so the frame stays full of streaks
  at(from - 0.3, () => { to({ cameraYaw: 90, cameraPitch: 0, baseSpeed: 1.8 }, 2.5) })
  const swing = s => 0.7 + 2.4 * s + 0.9 * Math.sin(2.6 * s)
  at(from, () => {
    draw(stroke([middle, ['tipX', 'tipY']], W, {
      arrow: 'end',
      width: 0.007,
      dash: true,
      values: { tipX: s => middle[0] + 0.3 * Math.cos(swing(s)) * ASPECT, tipY: s => middle[1] - 0.3 * Math.sin(swing(s)) }
    }), end - now() + 0.8)
    caption('a *{W} direction?', end - now() + 0.8, { at: [0.6, 0.16], size: 0.046, font: 'unbounded', accent: W, fade: 0.4 })
  })
  // The fourth count lands once the third has gone from its place
  at(from + 0.6, () => caption('*{4D?}', end - now() + 0.8, { at: [0.2, 0.44], size: 0.17, font: 'noto', accent: W, fade: 0.5 }))
  until(end)
})

leave()
