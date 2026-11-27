// The fourth dimension as popular science, clip 6 of films/fourth_dimension_pop.json: seen from straight above the well is flat, and its depth is rings crowding toward the middle: inward.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_06_above.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, drive, input, hide */
const LINES = {
  flyup: "Let's test that picture. Fly up above the sheet, and look straight down.",
  flat: 'The dent disappears. From up here, the sheet looks perfectly flat.',
  rings: 'But the depth is not gone. Paint a ring at every step down the well. From above, the rings crowd together toward the middle.',
  same: 'Recognise it? A circle inside a circle, with W running between them. It is the lamp and the wall again: a direction the sheet cannot show turns into in and out.',
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

// The sheet as chapter 05 leaves it: seen from the side, the well deep under the mass, the matter on it
// whirling down. The flat mode draws the sheet; the camera is its tilt
const GRID = '#4de3ff'
// Chapter 05's mass, the textbook's ball, stands over the hole for the whole clip: the narration never says
// it became a black hole, so the hole is covered by it
const MASS = '#ffc861'
// The matter on the sheet is chapter 05's: flow A laid on the sheet, born 2 to 7 radii out round the mouth
// and winding down into the well (the field laid on the sheet draws no matter there since the engine's
// redshift and rebirth changes, films.md "On the sheet"). From the side it opens as chapter 05 swept it at
// the same framing; from above the count is this clip's own, swept in "rings" a second a step over 2000 /
// 4000 / 8000 / 16000: at 2000 the rings read through the matter to the mass, at 4000 the inner rings are
// lost under it, from 8000 it is a carpet. The count thins from one to the other while the camera rises
const MATTER = 2
const COUNT_SIDE = 5000
const COUNT = 2500
film({
  fps: 60,
  seed: 6,
  settings: {
    blackHoleSize: 8,
    fieldEnabled: false,
    flowA: MATTER,
    flowACount: COUNT_SIDE,
    flowAFrom: 4.5,
    flowAFall: 0.8,
    flowATo: 0.8,
    flowASpread: 5,
    flowASwirl: 0.7,
    flowALife: 5,
    flowATrail: 0.6,
    flowASize: 1.4,
    flowAColor: '#ffe9c8',
    // The same matter falling straight in, for the last line; dark until then
    flowB: 0,
    flowBCount: COUNT,
    flowBFrom: 4.5,
    flowBFall: 0.8,
    flowBTo: 0.8,
    flowBSpread: 5,
    flowBSwirl: 0,
    flowBLife: 5,
    flowBTrail: 0.6,
    flowBSize: 1.4,
    flowBColor: '#ffe9c8',
    lensingEnabled: false,
    lensingRadius: 0,
    orbitCount: 0,
    // Stars on black, no nebula: its violet and pink read as stock space, and its dust muddied the frame
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridColor: GRID,
    // Chapter 05's sheet: square cells, as bright, reaching the frame's edges
    gridSheet: 1,
    gridLine: 2,
    gridCell: 4,
    gridTilt: 68,
    // Chapter 05's bowl, the ball lying in it
    gridDepth: 4,
    gridRings: 0,
    gridSpokes: 24,
    gridSpan: 1.6,
    gridFade: 0.4,
    // The flow lies on the sheet
    gridRide: 1,
    blackHoleY: 0.7
  }
})
// The hole itself stays: without it the sheet has no well and no rings. The mass covers its shadow, and its
// ring, which would edge the ball, is hidden
hide('ring')
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
const DEPTH = 4
const above = laySheet(0, DEPTH, 0.5)
const part = value => +value.toFixed(4)
// A point of the sheet at a radius and an angle, on the screen
const onTop = (radius, angle) => {
  const [x, y] = above(radius * Math.cos(angle), radius * Math.sin(angle))
  return { hole: [part(x), part(y)] }
}

const ASPECT = 9 / 16

const RISE = 4
// Two steps of the well that the circles pick out, far enough apart that W between them reads as an arrow
// (3.2 and 2.4 drew it tiny, review 3:47), and the rim the arrows of the last line start from
const R_OUT = 4.6
const R_IN = 2.5
const RIM = 3.9
const FLYUP = Math.max(long('flyup') + 0.6, heard('flyup', 'up', 0.45) - 0.3 + RISE + 0.2)

// The mass over the hole: it comes up with the picture under the chapter card's last second and stays to the
// clip's end, going dark with the picture as the clip leaves (shapes lie over the fade). It is chapter 05's
// ball, wider than the throat and lying LIFT radii up in the bowl; seen from straight above it lies over the
// hole's middle, so it slides there while the camera rises
const BALL = 1.9
const LIFT = 0.8
const RISES = now() + heard('flyup', 'up', 0.45) - 0.3
{
  const card = now() - 1.2
  const clipEnd = now() + FLYUP + long('flat') + 0.6 + long('rings') + 0.6 + long('same') + 0.6 + long('points') + 0.6 + 0.8
  at(card, () => {
    draw({ kind: 'circle', center: { hole: [0, 'up'] }, radius: BALL, fill: MASS, color: '#ffe3a8', width: 0.002, glow: 0.03, fade: 0, opacity: 'lit', values: { lit: [[card, 0], [card + 1.2, 1], [clipEnd - 0.8, 1], [clipEnd, 0]], up: [[card, LIFT], [RISES, LIFT], [RISES + RISE, 0]] } }, clipEnd - card)
  })
}

shot('flyup', () => {
  const start = now()
  const spoken = say('flyup')
  status('math', spoken + 0.4)
  // "Fly up": the camera rises from the side of the sheet to straight above it
  at(RISES, () => {
    meanwhile(() => { to({ gridTilt: 0, gridDepth: DEPTH, blackHoleY: 0.5, flowACount: COUNT }, RISE) })
    caption('*{look down}', RISE, { at: [0.5, 0.12], size: 0.04, font: 'unbounded', accent: W, fade: 0.4 })
  })
  wait(FLYUP)
})

shot('flat', () => {
  const start = now()
  const spoken = say('flat')
  status('math', spoken + 0.4)
  // From above the well is gone: the same square cells, as flat as paper. They stay through the line: ruled
  // as spokes already, the sheet read as a starburst round the ball, not as flat paper (review, 3:35)
  at(start + heard('flat', 'flat', 0.85), () => {
    caption('flat?', spoken - heard('flat', 'flat', 0.85) + 0.6, { at: [0.5, 0.14], size: 0.07, font: 'unbounded', color: INK, fade: 0.3 })
  })
  wait(spoken + 0.6)
})

shot('rings', () => {
  const start = now()
  const spoken = say('rings')
  status('math', spoken + 0.4)
  // "But the depth is not gone": the sheet is ruled again for what comes. It dips out for a moment and comes
  // back as spokes round the hole, with one ring, which lies under the mass (the outermost ring stands half
  // as many radii out as there are rings), so "paint a ring" only paints rings onto it. Switched at the
  // first ring, the square grid flipped to a wheel in one frame (review, 3:41)
  at(start, () => {
    to({ gridSheet: 0 }, 0.3)
    set({ gridRings: 1 })
    to({ gridSheet: 1 }, 0.3)
  })
  // "Paint a ring": one ring for every step of the well's depth, painted in over two seconds
  at(start + heard('rings', 'ring', 0.4), () => {
    meanwhile(() => { to({ gridRings: 40 }, 2, 'linear') })
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
    draw({ kind: 'line', points: [onTop(R_OUT, Math.PI), onTop(R_IN, Math.PI)], arrow: 'end', color: W, width: 0.008, draw: 0.6, fade: 0.4 }, end - now())
    const [x] = above(-(R_OUT + R_IN) / 2, 0)
    caption('W', end - now(), { at: { hole: [part(x), 0.9] }, size: 0.05, font: 'unbounded', color: W, fade: 0.4, plate: 0.5 })
  })
  // "The lamp and the wall again": chapter 03's rhyme, drawn small beside the picture on a dark card of its
  // own, so the spokes do not run through it. Above, the lamp, the ball and the wall seen edge on, W the way
  // toward the lamp; below, the shadow as the wall shows it, small and grown, W the way between the two
  at(start + heard('same', 'lamp', 0.62), () => {
    const life = end - now()
    const x = dx => +(0.86 + dx * ASPECT).toFixed(5)
    draw({ kind: 'rect', center: [0.86, 0.5], size: [0.42, 0.68], round: 0.012, color: '#46525a', width: 0.0012, fill: '#05070a', fillOpacity: 0.82, fade: 0.4 }, life)
    // Light from a point: the shadow is the ball scaled by how much nearer the lamp the ball is
    const lampAt = -0.15
    const ballAt = -0.03
    const wallAt = 0.13
    const ball = 0.026
    const shade = ball * (wallAt - lampAt) / (ballAt - lampAt)
    for (const side of [-1, 1]) {
      draw({ kind: 'line', points: [[x(lampAt), 0.33], [x(wallAt), part(0.33 + side * shade)]], color: GOLD, width: 0.0016, draw: 0.6, fade: 0.4 }, life)
    }
    draw({ kind: 'line', points: [[x(wallAt), 0.2], [x(wallAt), 0.46]], color: SOFT, width: 0.004, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[x(wallAt), part(0.33 - shade)], [x(wallAt), part(0.33 + shade)]], color: '#05070a', width: 0.006, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [x(lampAt), 0.33], radius: 0.012, fill: GOLD, color: GOLD, width: 0, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [x(ballAt), 0.33], radius: ball, fill: INK, color: INK, width: 0, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[x(ballAt - 0.035), 0.4], [x(lampAt + 0.025), 0.4]], arrow: 'end', color: W, width: 0.0035, draw: 0.5, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [0.86, 0.6], radius: 0.06, color: INK, width: 0.003, draw: 0.6, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [0.86, 0.6], radius: 0.025, color: INK, width: 0.003, draw: 0.6, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[0.86 - 0.025 * ASPECT, 0.6], [0.86 - 0.06 * ASPECT, 0.6]], arrow: 'end', color: W, width: 0.0045, draw: 0.5, fade: 0.4 }, life)
    caption('the ball\'s shadow\non the wall, again', life, { at: [0.86, 0.75], size: 0.03, font: 'noto', color: SOFT, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('points', () => {
  const start = now()
  const spoken = say('points')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.4)
  // With nothing to swing it round, the matter goes straight in along the spokes: the depth points inward.
  // The winding flow gives way to flow B, the same matter with no swirl: B comes up before A goes, so the
  // matter does not thin out in the middle of the handover (review, 4:00)
  meanwhile(() => {
    to({ flowB: MATTER }, 1.2)
    to({ flowA: 0 }, 1.2)
  })
  at(start + heard('points', 'points', 0.6), () => {
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4
      draw({ kind: 'line', points: [onTop(RIM, angle), onTop(BALL + 0.3, angle)], arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    }
  })
  at(start + heard('points', 'inward', 0.9) - 0.4, () => {
    keep('The depth points *{inward}.', end - now())
  })
  wait(spoken + 0.6)
})

leave()
