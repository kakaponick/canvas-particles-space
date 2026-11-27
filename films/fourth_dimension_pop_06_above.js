// The fourth dimension as popular science, clip 6 of films/fourth_dimension_pop.json: seen from straight above the well is flat, and its depth is rings crowding toward the middle: inward.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_06_above.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, drive, input */
const LINES = {
  flyup: "Let's test that picture. Fly up above the sheet, and look straight down.",
  flat: 'The dent disappears. From up here, the sheet looks perfectly flat.',
  rings: 'But the depth is not gone. Paint a ring at every step down the well. From above, the rings crowd together toward the middle.',
  same: 'Recognise it? A circle inside a circle, with W running between them. It is the cube inside the cube, one dimension lower.',
  points: 'So if you live in the sheet, the depth of the well does not point down. It points inward.'
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

// The sheet as chapter 05 leaves it: seen from the side, the well deep under the hole, the matter on it
// whirling down. The flat mode draws the sheet; the camera is its tilt
const GRID = '#4de3ff'
film({
  fps: 60,
  seed: 6,
  settings: {
    blackHoleSize: 8,
    numParticles: 20000,
    lensingEnabled: false,
    lensingRadius: 0,
    orbitCount: 0,
    nebula: 0.8,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    nebulaColorCore: '#ff7ab8',
    nebulaCore: 0.5,
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridColor: GRID,
    gridSheet: 0.85,
    gridCell: 4,
    gridTilt: 68,
    gridDepth: 10,
    gridRings: 0,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridRide: 1,
    // The whole column lies on the sheet: a share of the ride fading with depth left the matter the hole
    // gathers hanging between where it flies and the surface, a white ball over the shadow. Laid wholly,
    // it crowds the steep throat, so half as many particles, dimmer, let the wall show through it
    gridRideSoft: 0.01,
    blackHoleY: 0.6,
    fieldAtHole: 1,
    // What falls toward the hole on the sheet, swung round as it comes: a whirl that drains down the well
    gravityInertia: 0.75,
    orbitalStrength: 80,
    gravityStrength: 4,
    gravityReach: 16,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.03,
    trailIntensity: 0.15,
    depthFade: 0,
    minOpacity: 0.1,
    particleSize: 2,
    particleSizeMin: 2,
    baseBrightness: 0.3
  }
})
chapter('06', 'LOOK FROM ABOVE')

// Where a point of the sheet stands on the screen, from the hole in hole radii (the sums of
// films/fourth_dimension_well.js), for the sheet seen from straight above
const LONG = 1920
const SHORT = 1080
const SHADOW = 0.08 * SHORT
const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
function laySheet (tilt, radii, holeY) {
  const distance = 2.5 * LONG
  const sin = Math.sin(tilt * Math.PI / 180)
  const cos = Math.cos(tilt * Math.PI / 180)
  const down = (holeY - 0.5) * SHORT
  let throat = SHADOW
  let depth = 0
  let away = 0
  for (let round = 0; round < 3; round++) {
    depth = radii * throat
    away = (down * (distance + depth * cos) - distance * depth * sin) / Math.max(distance * cos + down * sin, distance * 0.05)
    if (round < 2) throat = SHADOW * Math.max(distance + depth * cos - away * sin, distance * 0.05) / distance
  }
  return (across, toward, level) => {
    const x = across * throat
    const y = toward * throat + away
    const deep = depth * (level ?? dent(Math.hypot(x, toward * throat), throat))
    const scale = distance / (distance + deep * cos - y * sin)
    return [x * scale / SHADOW, (down - (y * cos + deep * sin) * scale) / SHADOW]
  }
}
const DEPTH = 6
const above = laySheet(0, DEPTH, 0.5)
const part = value => +value.toFixed(4)
// A point of the sheet at a radius and an angle, on the screen
const onTop = (radius, angle) => {
  const [x, y] = above(radius * Math.cos(angle), radius * Math.sin(angle))
  return { hole: [part(x), part(y)] }
}

// The hypercube as a small drawing: a cube inside a cube, the fourth edges red
const ASPECT = 9 / 16
const drawing = (centre, size) => ([x, y, z]) => {
  const across = x * Math.cos(0.52) + z * Math.sin(0.52)
  const away = z * Math.cos(0.52) - x * Math.sin(0.52)
  const up = y * Math.cos(0.34) + away * Math.sin(0.34)
  return [+(centre[0] + size * across * ASPECT).toFixed(5), +(centre[1] - size * up).toFixed(5)]
}
function hypercube (centre, size, seconds) {
  const place = drawing(centre, size)
  const inner = 0.42
  for (let index = 0; index < 8; index++) {
    const from = [index & 1, (index >> 1) & 1, (index >> 2) & 1].map(value => value - 0.5)
    for (let way = 0; way < 3; way++) {
      if (from[way] > 0) continue
      const to = from.map((value, each) => each === way ? 0.5 : value)
      for (const scale of [1, inner]) {
        draw({ kind: 'line', points: [place(from.map(value => value * scale)), place(to.map(value => value * scale))], color: [X, Y, Z][way], width: 0.003, draw: 0.8, fade: 0.4 }, seconds)
      }
    }
    draw({ kind: 'line', points: [place(from), place(from.map(value => value * inner))], color: W, width: 0.0045, draw: 0.8, fade: 0.4 }, seconds)
  }
}

const RISE = 4
// Two neighbouring steps of the well that the circles pick out, clear of the matter round the shadow, and
// the rim the arrows of the last line start from
const R_OUT = 3.2
const R_IN = 2.4
const RIM = 4.4

shot('flyup', () => {
  const start = now()
  const spoken = say('flyup')
  status('math', spoken + 0.4)
  // "Fly up": the camera rises from the side of the sheet to straight above it
  at(start + heard('flyup', 'up', 0.45) - 0.3, () => {
    meanwhile(() => { to({ gridTilt: 0, gridDepth: DEPTH, blackHoleY: 0.5 }, RISE) })
    caption('*{look down}', RISE, { at: [0.5, 0.12], size: 0.04, font: 'unbounded', accent: W, fade: 0.4 })
  })
  wait(Math.max(spoken + 0.6, heard('flyup', 'up', 0.45) - 0.3 + RISE + 0.2))
})

shot('flat', () => {
  const start = now()
  const spoken = say('flat')
  status('math', spoken + 0.4)
  // From above the well is gone: a square grid, as flat as paper
  at(start + heard('flat', 'flat', 0.85), () => {
    caption('flat?', spoken - heard('flat', 'flat', 0.85) + 0.6, { at: [0.5, 0.14], size: 0.07, font: 'unbounded', color: INK, fade: 0.3 })
  })
  wait(spoken + 0.6)
})

shot('rings', () => {
  const start = now()
  const spoken = say('rings')
  status('math', spoken + 0.4)
  // "Paint a ring": one ring for every step of the well's depth
  at(start + heard('rings', 'ring', 0.4), () => {
    set({ gridRings: 40 })
    caption('one ring = one step down', spoken - heard('rings', 'ring', 0.4) + 0.6, { at: [0.5, 0.12], size: 0.036, font: 'unbounded', color: INK, fade: 0.4 })
  })
  at(start + heard('rings', 'crowd', 0.85), () => {
    keep('From above, the rings crowd toward the middle.', spoken - heard('rings', 'crowd', 0.85) + 0.6)
  })
  wait(spoken + 0.6)
})

shot('same', () => {
  const start = now()
  const spoken = say('same')
  const end = start + spoken + 0.6
  status('math', spoken + 0.4)
  // "A circle inside a circle": an outer and an inner ring of the well, W the way between them
  at(start + heard('same', 'circle', 0.22), () => {
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: part(above(R_OUT, 0)[0]), color: INK, width: 0.004, draw: 0.8, fade: 0.4 }, end - now())
  })
  at(start + heard('same', 'circle', 0.32), () => {
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: part(above(R_IN, 0)[0]), color: INK, width: 0.004, draw: 0.6, fade: 0.4 }, end - now())
  })
  at(start + heard('same', 'w', 0.45), () => {
    draw({ kind: 'line', points: [onTop(R_OUT, Math.PI), onTop(R_IN, Math.PI)], arrow: 'end', color: W, width: 0.0065, draw: 0.6, fade: 0.4 }, end - now())
    const [x] = above(-(R_OUT + R_IN) / 2, 0)
    caption('W', end - now(), { at: { hole: [part(x), 0.7] }, size: 0.04, font: 'unbounded', color: W, fade: 0.4 })
  })
  // "The cube inside the cube": the rhyme, drawn small beside the picture
  at(start + heard('same', 'cube', 0.75), () => {
    hypercube([0.86, 0.36], 0.16, end - now())
    draw({ kind: 'circle', center: [0.86, 0.6], radius: 0.06, color: INK, width: 0.003, draw: 0.6, fade: 0.4 }, end - now())
    draw({ kind: 'circle', center: [0.86, 0.6], radius: 0.025, color: INK, width: 0.003, draw: 0.6, fade: 0.4 }, end - now())
    draw({ kind: 'line', points: [[0.86 - 0.06 * ASPECT, 0.6], [0.86 - 0.025 * ASPECT, 0.6]], color: W, width: 0.0045, draw: 0.5, fade: 0.4 }, end - now())
    caption('the same trick,\none dimension lower', end - now(), { at: [0.86, 0.72], size: 0.022, font: 'noto', color: SOFT, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('points', () => {
  const start = now()
  const spoken = say('points')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.4)
  // With nothing to swing it round, the matter goes straight in along the spokes: the depth points inward
  meanwhile(() => { to({ gravityInertia: 0.3, orbitalStrength: 0, gravityStrength: 6, gravityReach: 14, speedGlowKnee: 0.02, trailIntensity: 0.05, minOpacity: 0.2, baseBrightness: 0.5 }, 2) })
  at(start + heard('points', 'points', 0.6), () => {
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4 + Math.PI / 8
      draw({ kind: 'line', points: [onTop(RIM, angle), onTop(1.7, angle)], arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    }
  })
  at(start + heard('points', 'inward', 0.9) - 0.4, () => {
    keep('The depth points *{inward}.', end - now())
  })
  wait(spoken + 0.6)
})

leave()
