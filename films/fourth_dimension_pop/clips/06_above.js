// The fourth dimension as popular science, clip 6 of films/fourth_dimension_pop/fourth_dimension_pop.json: seen from straight above the well is flat, and its depth is rings crowding toward the middle: inward. Two cells that look nothing alike from above are the same length along the surface, and a black hole, round from every side, would be the well seen from above.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop/clips/06_above.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, drive, input, hide, show */
const LINES = {
  flyup: "Let's test that picture. Fly up above the sheet, and look straight down.",
  flat: 'The dent disappears. From up here, the sheet looks perfectly flat.',
  rings: 'But the depth is not gone. Paint a ring at every step down the well. From above, the rings crowd together toward the middle.',
  same: 'Recognise it? A circle inside a circle, with W running between them. It is the lamp and the wall again: a direction the sheet cannot show turns into in and out.',
  points: 'So if you live in the sheet, the depth of the well does not point down. It points inward.',
  cells: 'Paint two cells of the same well: a wide one near the rim, a thin one near the middle. From above they look nothing alike. Walk down into the well with a ruler, and they come out the same length.',
  round: 'And a black hole looks round from every side. In this picture that is no accident: from any side, we would be looking straight down the well.'
}

// ---- the film's kit: the same text in every clip of films/fourth_dimension_pop/fourth_dimension_pop.json ----
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

// The sheet as chapter 05 leaves it: seen from the side, the well deep under the mass, the matter on it
// whirling down. The flat mode draws the sheet; the camera is its tilt
const GRID = '#4de3ff'
// The matter on the sheet is chapter 05's: flow A laid on the sheet, born 2 to 7 radii out round the mouth
// and winding down into the well (the field laid on the sheet draws no matter there since the engine's
// redshift and rebirth changes, films.md "On the sheet"). From the side it opens as chapter 05 swept it at
// the same framing; from above the count is this clip's own, swept in "rings" a second a step over 2000 /
// 4000 / 8000 / 16000: at 2000 the rings read through the matter to the mass, at 4000 the inner rings are
// lost under it, from 8000 it is a carpet. The count thins from one to the other while the camera rises
const MATTER = 2
const COUNT_SIDE = 5000
const COUNT = 2500
// The matter falling straight in, for the last line, was sparse specks at 2500 (review 5, 31 to 36 s). Swept at
// the frame of "points" (35.3 s): 5000 reads as streaks along the spokes with the rings clear, 8000 grows heavy
// over the rings; a trail of 0.9 instead of 0.6 draws each stroke long enough to read as falling straight in
const FALL_COUNT = 5000
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
    flowBCount: FALL_COUNT,
    flowBTrail: 0.9,
    flowBFrom: 4.5,
    flowBFall: 0.8,
    flowBTo: 0.8,
    flowBSpread: 5,
    flowBSwirl: 0,
    flowBLife: 5,
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
    blackHoleY: 0.7,
    // "round" circles the hole in 3D: straight on, where it starts, the 3D camera sees what the flat mode does
    cameraYaw: 0,
    cameraPitch: 0,
    ringBrightness: 0,
    ringGlow: 0.6,
    ringDoppler: 0.6
  }
})
// The hole itself stays: without it the sheet has no well and no rings. The mass covers its shadow, and its
// ring, which would edge the ball, is hidden
chapter('06', 'LOOK FROM ABOVE')

// Where a point of the sheet stands on the screen, from the hole in hole radii (the sums of
// films/fourth_dimension/clips/02_well.js), for the sheet seen from straight above
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
// (3.2 and 2.4 drew it tiny, review 3:47), and the rim the arrows of the last line start from: from 3.9 the
// lowest arrow's tail nearly touched the caption at the foot of the frame (review 5, 34.5 to 36.4 s)
const R_OUT = 4.6
const R_IN = 2.5
const RIM = 3.5
const FLYUP = Math.max(long('flyup') + 0.6, heard('flyup', 'up', 0.45) - 0.3 + RISE + 0.2)

// The mass is the black hole with its ring, as in chapter 05: the textbook's flat yellow ball drawn over it
// went ("давай просто везде использовать черную дыру"). The arrows that ended at the ball's edge end EDGE
// radii out, just past the ring
const EDGE = 1.1
const RISES = now() + heard('flyup', 'up', 0.45) - 0.3
// "cells" comes when the lines before it are done: the black disc in the
// middle of the operator's slide, which the rings crowd into, and the black hole of "round"
const GONE = now() + FLYUP + long('flat') + 0.6 + long('rings') + 0.6 + long('same') + 0.6 + long('points') + 0.6
const SHRINK = 1.4

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
  // own, so the spokes do not run through it (nearly opaque: at 0.82 the sheet showed through, review 4, 4:56).
  // Above, seen edge on: the lamp, the ball where it was (faint, near the lamp) and where it went (solid,
  // nearer the wall), W the way between them, and on a whole wall each ball's shadow as a dark-grey band, the
  // big one faint. Below, the wall face on: the big shadow and the small one, W from the big to the small:
  // inward, as on the sheet. The move is the one whose shadow shrinks, so both W arrows point the sheet's way
  // (one ball with two shadows, a gap for a shadow and an arrow outward were review 4's findings)
  at(start + heard('same', 'lamp', 0.62), () => {
    const life = end - now()
    const x = dx => +(0.86 + dx * ASPECT).toFixed(5)
    draw({ kind: 'rect', center: [0.86, 0.5], size: [0.42, 0.68], round: 0.012, color: '#46525a', width: 0.0012, fill: '#05070a', fillOpacity: 0.96, fade: 0.4 }, life)
    // Light from a point: a shadow is its ball scaled by how much nearer the lamp the ball is
    const axis = 0.32
    const lampAt = -0.17
    const wasAt = -0.09
    const isAt = 0.03
    const wallAt = 0.15
    const ball = 0.022
    const shadeOf = at => part(ball * (wallAt - lampAt) / (at - lampAt))
    const big = shadeOf(wasAt)
    const small = shadeOf(isAt)
    const lightOf = (shade, more) => {
      for (const side of [-1, 1]) {
        draw({ kind: 'line', points: [[x(lampAt), axis], [x(wallAt), part(axis + side * shade)]], color: GOLD, width: 0.0016, draw: 0.6, fade: 0.4, ...more }, life)
      }
    }
    lightOf(big, { dash: true, opacity: 0.4 })
    lightOf(small)
    // The wall, whole, and the two shadows on it
    draw({ kind: 'line', points: [[x(wallAt), 0.19], [x(wallAt), 0.45]], color: '#e4eaee', width: 0.011, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[x(wallAt), part(axis - big)], [x(wallAt), part(axis + big)]], color: '#737d83', width: 0.011, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[x(wallAt), part(axis - small)], [x(wallAt), part(axis + small)]], color: '#14181b', width: 0.011, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [x(lampAt), axis], radius: 0.012, fill: GOLD, color: GOLD, width: 0, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [x(wasAt), axis], radius: ball, fill: INK, fillOpacity: 0.3, color: INK, width: 0.0024, dash: true, opacity: 0.8, fade: 0.4 }, life)
    draw({ kind: 'circle', center: [x(isAt), axis], radius: ball, fill: INK, color: INK, width: 0, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[x(wasAt), 0.4], [x(isAt), 0.4]], arrow: 'end', color: W, width: 0.0035, draw: 0.5, fade: 0.4 }, life)
    caption('W', life, { at: [x((wasAt + isAt) / 2), 0.43], size: 0.026, font: 'unbounded', color: W, fade: 0.4 })
    // The wall face on: the big shadow faint, the small one dark, W between them, inward
    const face = [0.86, 0.6]
    draw({ kind: 'rect', center: face, size: [0.2, 0.17], round: 0.006, color: '#c8d2d8', width: 0, fill: '#e4eaee', fade: 0.4 }, life)
    draw({ kind: 'circle', center: face, radius: 0.06, fill: '#737d83', color: '#737d83', width: 0, fade: 0.4 }, life)
    draw({ kind: 'circle', center: face, radius: 0.025, fill: '#14181b', color: '#14181b', width: 0, fade: 0.4 }, life)
    draw({ kind: 'line', points: [[part(0.86 - 0.058 * ASPECT), 0.6], [part(0.86 - 0.027 * ASPECT), 0.6]], arrow: 'end', color: W, width: 0.0045, draw: 0.5, fade: 0.4 }, life)
    caption('W', life, { at: [x(-0.13), 0.6], size: 0.026, font: 'unbounded', color: W, fade: 0.4 })
    caption('the ball\'s shadow\non the wall, again', life, { at: [0.86, 0.76], size: 0.03, font: 'noto', color: SOFT, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('points', () => {
  const start = now()
  const spoken = say('points')
  const end = start + spoken + 0.6
  // Where the depth points in the sheet model is the model's geometry, as the shot before
  status('math', spoken + 0.4)
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
      draw({ kind: 'line', points: [onTop(RIM, angle), onTop(EDGE + 0.3, angle)], arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    }
  })
  at(start + heard('points', 'inward', 0.9) - 0.4, () => {
    keep('The depth points *{inward}.', end - now())
  })
  wait(spoken + 0.6)
})

// ---- "cells": two cells of one well, the same length along its surface ----
// The scene's rings are the well's contour lines, one at every equal step of depth, so a cell between two of them
// is as long along the surface as that step where the wall is steep and longer wherever it is not: no wide cell
// and thin cell of them is ever the same length. This shot rules the well with rings of its own, one every STEP
// along the surface, walked out from the shadow's edge; the step puts the fourth ring on the one ring the scene
// keeps at Sheet Rings 1 (contour 1 of 1, at 1.2911 radii), which this shot leaves on under its spokes
const ENGINE_RING = 1.2911
const FAR = 12.5
// The surface's own length from one radius of the well to another, in hole radii: the dent's depth, Well Depth
// radii at the shadow's edge, against the way out
// One walk out from the shadow's edge, in steps of 0.05% of the radius, keeping the radius and the surface walked
// every 20 steps: the table both ways (a radius's surface length, a surface length's radius) is read from it.
// Integrated anew on every call it took the clip past the 5 s scripts/voice.mjs gives a clip to read its lines
const WALK = [[1, 0]]
{
  let walked = 0
  let radius = 1
  for (let index = 1; radius < FAR; index++) {
    const out = radius * 1.0005
    walked += Math.hypot(out - radius, DEPTH * (dent(out, 1) - dent(radius, 1)))
    radius = out
    if (index % 20 === 0) WALK.push([radius, walked])
  }
}
// Between two rows of the table, by the column given (0 radius, 1 surface walked), the other column
const lookUp = (value, by) => {
  let low = 0
  let high = WALK.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (WALK[middle][by] < value) low = middle
    else high = middle
  }
  const [a, b] = [WALK[low], WALK[high]]
  return a[1 - by] + (b[1 - by] - a[1 - by]) * (value - a[by]) / (b[by] - a[by])
}
const walkedTo = radius => lookUp(radius, 0)
const radiusAt = walked => lookUp(walked, 1)
const surface = (from, to) => walkedTo(to) - walkedTo(from)
const STEP = surface(1, ENGINE_RING) / 4
const RINGS = []
for (let walked = 0; radiusAt(walked) < FAR - 0.5; walked += STEP) RINGS.push(radiusAt(walked))
// The radius a share of the way along the surface from one radius to another
const alongSurface = (from, to, share) => radiusAt(walkedTo(from) + surface(from, to) * share)
// A point of the sheet at a radius and an angle in degrees, x to the right and y away from the flat camera; it
// sinks into the well as the surface does, at any tilt
const onSheet = (radius, degrees) => {
  const turn = degrees * Math.PI / 180
  return { sheet: [part(radius * Math.cos(turn)), part(radius * Math.sin(turn))] }
}
const arc = (radius, from, to, count) => Array.from({ length: count + 1 }, (_, index) => onSheet(radius, from + (to - from) * index / count))
// The two cells, as on the slide: between the spokes at 165 and 180 degrees, left of the hole; the wide one near
// the rim, the thin one near the middle (rings by their number out from the shadow's edge)
const SECTOR = [165, 180]
const RED = { inner: 11, color: '#ff4436' }
const GREEN = { inner: 3, color: '#3fd75f' }
const cellOf = ({ inner, color }) => ({
  kind: 'line',
  close: true,
  points: [...arc(RINGS[inner + 1], SECTOR[0], SECTOR[1], 6), ...arc(RINGS[inner], SECTOR[1], SECTOR[0], 6)],
  color,
  width: 0.0012,
  fill: color,
  fillOpacity: 0.85,
  fade: 0.5
})
// The ruler down each cell's middle, following the surface, with a dot at each end and one halfway along it
const rulerOf = ({ inner }) => {
  const middle = (SECTOR[0] + SECTOR[1]) / 2
  const from = RINGS[inner]
  const to = RINGS[inner + 1]
  const points = Array.from({ length: 9 }, (_, index) => onSheet(alongSurface(from, to, index / 8), middle))
  const dots = [0, 0.5, 1].map(share => onSheet(alongSurface(from, to, share), middle))
  return { points, dots }
}
// How the camera sees the cells while "Walk down into the well": the sheet tipped nearly edge on, so the wall the
// thin cell lies on stands almost upright, sin 76 = 0.97 of its length, and zoomed in about the hole, so the two
// rulers are about 80 px long instead of 45 (zoom 1, the first still) and both cells stay in the frame.
// Measured by the sheet's sums (laySheet, and the surface integrated in 20000 steps): along the surface the cells
// are 0.5080 and 0.5078 radii, 0.04% apart; seen from above the green one is 0.163 radii across against the red
// one's 0.545 (a third), tipped to 76 degrees 0.491 against 0.520 (94%: the wall's last 3% and the camera's
// perspective)
const SIDE_TILT = 76
const SIDE_Y = 0.72
const SIDE_ZOOM = 1.8
// "round" takes the sheet back to the view from above in BACK seconds, then lets it go in SHEET_OUT
const BACK = 1.8
const SHEET_OUT = 1.2

shot('cells', () => {
  const start = now()
  const spoken = say('cells')
  const end = start + spoken + 0.6
  status('math', spoken + 0.4)
  // The matter leaves the sheet, so the cells read on a clear well
  meanwhile(() => { to({ flowB: 0 }, 1.2) })
  // Re-ruled for the cells: the contour rings dip out and the sheet comes back as spokes, the ring it keeps under
  // the shrinking mass; the rings at equal steps along the surface draw in once the mass is the hole's shadow
  at(start + 0.2, () => {
    to({ gridSheet: 0 }, 0.3)
    set({ gridRings: 1 })
    to({ gridSheet: 1 }, 0.3)
  })
  const ruled = GONE + 0.2 + SHRINK
  const tilts = Math.max(start + heard('cells', 'Walk', 0.64) - 0.2, ruled + 4.5)
  // The rest go with the sheet in "round", once it is back to the view from above
  const out = end + BACK
  at(ruled, () => {
    RINGS.forEach((radius, index) => {
      // The two innermost lie on the steep bottom of the throat, behind the shadow once the sheet tips: they go
      // as it starts to
      const life = (index < 2 ? tilts + 0.4 : out + SHEET_OUT) - now()
      const lit = index < 2 ? [[now(), 0.85]] : [[now(), 0.85], [out, 0.85], [out + SHEET_OUT, 0]]
      draw({ kind: 'line', close: true, smooth: true, points: arc(radius, 0, 355, 71), color: GRID, width: 0.0016, opacity: 'lit', values: { lit }, draw: 1, fade: 0.4 }, life)
    })
    caption('a ring every equal step *{along the surface}', tilts - now(), { at: [0.5, 0.1], size: 0.032, font: 'unbounded', color: INK, accent: GRID, fade: 0.4 })
  })
  // The wide cell, then the thin one; they stay into "round" until the sheet starts back to the view from above
  const wide = Math.max(start + heard('cells', 'wide', 0.2), ruled + 1.2)
  const thin = Math.max(start + heard('cells', 'thin', 0.38), wide + 1.2)
  at(wide, () => { draw(cellOf(RED), end + 0.4 - now()) })
  at(thin, () => { draw(cellOf(GREEN), end + 0.4 - now()) })
  // "Walk down into the well": the sheet tips nearly edge on
  at(tilts, () => { meanwhile(() => { to({ gridTilt: SIDE_TILT, blackHoleY: SIDE_Y, cameraZoom: SIDE_ZOOM }, 2.6) }) })
  // "with a ruler": the same ruler on each, ends and middle dotted
  const ruler = Math.max(start + heard('cells', 'ruler', 0.8), tilts + 2.6)
  at(ruler, () => {
    for (const cell of [RED, GREEN]) {
      const { points, dots } = rulerOf(cell)
      draw({ kind: 'line', points, smooth: true, color: INK, width: 0.0032, draw: 0.5, fade: 0.4 }, end + 0.4 - now())
      for (const dot of dots) draw({ kind: 'circle', center: dot, radius: 0.06, fill: INK, color: '#000000', width: 0.0012, fade: 0.4 }, end + 0.4 - now())
    }
  })
  at(Math.max(start + heard('cells', 'same', 0.93) - 0.6, ruler + 0.6), () => {
    keep('Along the surface, the two cells are *{the same length}.', end - now(), { accent: INK })
  })
  wait(spoken + 0.6)
})

shot('round', () => {
  const start = now()
  const spoken = say('round')
  const end = start + spoken + 0.6
  // That a black hole's shadow is round from every side is measured physics; that we would be looking down the
  // well is the hypothesis's reading of it
  const reading = start + heard('round', 'accident', 0.42) - 0.3
  status('known', reading - start)
  at(reading, () => status('idea', end - now()))
  // Back to the view from above, where the well was round
  meanwhile(() => { to({ gridTilt: 0, blackHoleY: 0.5, cameraZoom: 1 }, BACK) })
  // From above the sheet gives way to the black hole itself: the lens and the photon ring come up round the
  // shadow the rings crowded into
  const lit = start + BACK
  at(lit, () => {
    to({ gridSheet: 0 }, SHEET_OUT)
  })
  at(lit, () => {
    set({ lensingEnabled: true })
    show('ring')
    to({ lensingRadius: 2.5, ringBrightness: 2 }, 1.5)
  })
  // and the camera goes round it in 3D, straight on at first, where it sees what the flat mode saw: over and
  // past the side and under, the shadow and its ring stay round
  const turns = lit + 1
  at(turns, () => {
    set({ threeDEase: 0, threeD: true })
    const seconds = end - now()
    const yaw = s => +(170 * (1 - Math.cos(Math.PI * Math.min(s / seconds, 1))) / 2).toFixed(3)
    const pitch = s => +(55 * Math.sin(2 * Math.PI * Math.min(s / seconds, 1))).toFixed(3)
    meanwhile(() => { drive({ cameraYaw: yaw, cameraPitch: pitch }, seconds) })
    // Where the camera is, small at the top right: a dot going round the hole
    const centre = [0.87, 0.2]
    const ring = 0.075
    draw({ kind: 'circle', center: centre, radius: ring, color: SOFT, width: 0.0012, dash: true, fade: 0.4 }, seconds)
    draw({ kind: 'circle', center: centre, radius: 0.014, fill: '#000000', color: GOLD, width: 0.0016, fade: 0.4 }, seconds)
    const steps = 48
    const xs = []
    const ys = []
    for (let step = 0; step <= steps; step++) {
      const s = seconds * step / steps
      const turn = yaw(s) * Math.PI / 180
      const rise = pitch(s) * Math.PI / 180
      // seen from above the orbit: the yaw goes round, the pitch draws the dot in toward the middle
      xs.push([+(now() + s).toFixed(3), +(centre[0] + ring * ASPECT * Math.sin(turn) * Math.cos(rise)).toFixed(4), 'linear'])
      ys.push([+(now() + s).toFixed(3), +(centre[1] + ring * Math.cos(turn) * Math.cos(rise)).toFixed(4), 'linear'])
    }
    draw({ kind: 'circle', center: ['cx', 'cy'], radius: 0.01, fill: GOLD, color: GOLD, width: 0, fade: 0.4, values: { cx: xs, cy: ys } }, seconds)
    caption('the camera', seconds, { at: [centre[0], centre[1] + ring + 0.04], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.4 })
  })
  // "looking straight down the well": the well's rings from above laid round the shadow, round from every side too
  const down = Math.max(start + heard('round', 'looking', 0.72) - 0.3, reading + 1)
  at(Math.max(start + heard('round', 'round', 0.2), turns + 0.6), () => {
    caption('round from every side', down - now(), { at: [0.5, 0.12], size: 0.04, font: 'unbounded', color: INK, fade: 0.4 })
  })
  at(down, () => {
    for (const radius of RINGS.slice(3, 11)) {
      draw({ kind: 'circle', center: { hole: [0, 0] }, radius: part(above(radius, 0)[0]), color: GRID, width: 0.0014, opacity: 0.55, draw: 0.8, fade: 0.4 }, end - now())
    }
    keep('From any side, we would be looking *{down the well}.', end - now())
  })
  wait(spoken + 0.6)
})

leave()
