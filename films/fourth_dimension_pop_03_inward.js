// The fourth dimension as popular science, clip 3 of films/fourth_dimension_pop.json: a lamp, a ball and a wall. The shadow on the wall cannot move toward the lamp, so that direction shows on the wall as growing and shrinking: in and out. One step up, a fourth direction would look like inward.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_03_inward.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  wall: 'Hold a ball between a lamp and a wall. On the wall, its shadow can slide up and down, left and right. Two directions, like a sheet.',
  toward: 'Now move the ball toward the lamp. That direction does not exist on the wall. So the shadow does the only thing it can. It grows.',
  away: 'Move it back toward the wall, and the shadow shrinks toward its middle.',
  inout: 'So a direction the wall cannot point to still shows up on it. From inside, it looks like in, and out.',
  stepup: 'One step up, the same would hold for us. A fourth direction would not look like a new way to point. It would look like inward.'
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

film({
  fps: 60,
  seed: 3,
  warmup: 4,
  settings: {
    blackHoleSize: 0,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 0,
    cameraPitch: 0,
    // A quiet field of starlight behind the drawing: few, short, dim strokes, so the lamp, the ball and the
    // shadow carry the picture
    numParticles: 8000,
    baseSpeed: 0.6,
    trailIntensity: 0.3,
    baseBrightness: 0.35,
    starsBrightness: 1.2,
    starDensity: 0.18,
    colorPalette: [
      { r: 225, g: 236, b: 255, enabled: true, percent: 70 },
      { r: 150, g: 200, b: 255, enabled: true, percent: 30 }
    ]
  }
})
chapter('03', 'SEEN FROM INSIDE')

const ASPECT = 9 / 16
const part = value => +value.toFixed(5)
const smooth = share => { const k = Math.min(1, Math.max(0, share)); return k * k * (3 - 2 * k) }

// The seconds of the whole clip, laid out first: the ball moves along them and every drawing reads it
const REST = 0.6
const plan = {}
let second = now()
for (const name of Object.keys(LINES)) { plan[name] = second; second += long(name) + REST }
const end = second + 1.2
const cue = (name, word, share) => plan[name] + heard(name, word, share)

// The side view, on the left: the lamp, the ball between, the wall seen edge on. x runs from the lamp to the
// wall in shares of the frame's width, y is the frame's own; the ball's sideways place (z) does not show here
const LAMP = [0.1, 0.44]
const WALL_X = 0.42
const WALL = [0.2, 0.68]
const BALL_R = 0.026
// The wall face on, on the right, as the shadow lives on it: its middle, its half size (shares of the frame's
// short side) and how much larger than in the side view it is drawn
const FACE = [0.73, 0.44]
const FACE_HALF = [0.3, 0.24]
const FACE_ZOOM = 1.15

// The ball's place along the clip, eased between the moves its lines ask for. Each move is
// [start, seconds, { x, y, z }]: x along the lamp's axis (frame width), y and z its offsets across it (short side)
const HOME = { x: 0.27, y: 0, z: 0 }
const moves = [
  [cue('wall', 'up', 0.5) - 0.2, 0.9, { y: -0.07 }],
  [cue('wall', 'up', 0.5) + 0.8, 1.0, { y: 0.05 }],
  [cue('wall', 'left', 0.66) - 0.1, 0.8, { y: 0, z: -0.08 }],
  [cue('wall', 'left', 0.66) + 0.8, 1.0, { z: 0.07 }],
  [cue('wall', 'Two', 0.85), 0.8, { z: 0 }],
  [cue('toward', 'toward', 0.22) - 0.2, 2.4, { x: 0.17 }],
  [cue('away', 'back', 0.25) - 0.2, 2.4, { x: 0.36 }],
  [cue('inout', 'shows', 0.45), 3.2, { x: 0.22 }],
  [cue('inout', 'out', 0.92) - 0.4, 2.2, { x: 0.34 }]
]
const ball = t => {
  const at = { ...HOME }
  for (const [from, seconds, target] of moves) {
    const k = smooth((t - from) / seconds)
    if (k <= 0) continue
    for (const key of Object.keys(target)) at[key] = at[key] + (target[key] - at[key]) * k
  }
  return at
}
// Light from a point: the shadow on the wall is the ball scaled by how much nearer the lamp the ball is
const scale = t => (WALL_X - LAMP[0]) / (ball(t).x - LAMP[0])
const sideBall = t => [part(ball(t).x), part(LAMP[1] + ball(t).y)]
const shadowHalf = t => BALL_R * scale(t)
const shadowMiddle = t => LAMP[1] + ball(t).y * scale(t)
const faceMiddle = t => [part(FACE[0] + ball(t).z * scale(t) * FACE_ZOOM * ASPECT), part(FACE[1] + ball(t).y * scale(t) * FACE_ZOOM)]
const faceRadius = t => part(BALL_R * scale(t) * FACE_ZOOM)

const stroke = (points, color, more = {}) => ({ kind: 'line', points, color, width: 0.0035, fade: 0.4, ...more })
const label = (text, seconds, at, color, more = {}) => caption(text, seconds, { at, size: 0.026, font: 'unbounded', color, plate: 0.35, fade: 0.4, ...more })
// A drawing that reads the clip's own second at each frame: `values` turned from the shape's age to clip time
const live = (born, fns) => Object.fromEntries(Object.entries(fns).map(([key, fn]) => [key, s => fn(born + s)]))

// The scene steps back for the last line, where only the inward arrows stay
const panelsGone = cue('stepup', 'step', 0.12) + 0.6

shot('wall', () => {
  const start = now()
  const spoken = say('wall')
  status('math', spoken + REST)
  const left = panelsGone - now()
  // The lamp: a warm point with a soft glow
  at(cue('wall', 'lamp', 0.33) - 0.3, () => {
    draw({ kind: 'circle', center: LAMP, radius: 0.05, fill: GOLD, color: GOLD, width: 0, fillOpacity: 0.18, fade: 0.4 }, panelsGone - now())
    draw({ kind: 'circle', center: LAMP, radius: 0.013, fill: '#fff6dd', color: GOLD, width: 0.002, fade: 0.4 }, panelsGone - now())
    label('lamp', panelsGone - now(), [LAMP[0], LAMP[1] + 0.09], GOLD)
  })
  // The ball, and the two rays that graze it on their way to the wall
  at(cue('wall', 'ball', 0.12) - 0.2, () => {
    const born = now()
    draw({ kind: 'circle', center: ['bx', 'by'], radius: BALL_R, fill: INK, color: INK, width: 0, fade: 0.4, values: live(born, { bx: t => sideBall(t)[0], by: t => sideBall(t)[1] }) }, panelsGone - now())
  })
  at(cue('wall', 'wall', 0.4) - 0.2, () => {
    const born = now()
    draw(stroke([[WALL_X, WALL[0]], [WALL_X, WALL[1]]], SOFT, { width: 0.012, opacity: 0.8, draw: 0.5 }), panelsGone - now())
    label('wall', panelsGone - now(), [WALL_X, WALL[1] + 0.05], SOFT)
    for (const side of [-1, 1]) {
      draw(stroke([LAMP, ['wx', 'wy']], GOLD, { width: 0.0015, opacity: 0.5, values: live(born, { wx: () => WALL_X, wy: t => part(shadowMiddle(t) + side * shadowHalf(t)) }) }), panelsGone - now())
    }
    // The shadow on the wall, edge on: a dark band across the wall's line
    draw(stroke([[WALL_X, 'sa'], [WALL_X, 'sb']], '#000000', { width: 0.016, values: live(born, { sa: t => part(shadowMiddle(t) - shadowHalf(t)), sb: t => part(shadowMiddle(t) + shadowHalf(t)) }) }), panelsGone - now())
    // The wall face on: what lives on it sees only this
    draw({ kind: 'rect', center: FACE, size: [FACE_HALF[0] * 2, FACE_HALF[1] * 2], color: SOFT, width: 0.002, fill: '#0b1018', fillOpacity: 0.85, round: 0.012, fade: 0.4 }, panelsGone - now())
    label('the wall, face on', panelsGone - now(), [FACE[0], FACE[1] - FACE_HALF[1] - 0.04], SOFT, { size: 0.022 })
    draw({ kind: 'circle', center: ['fx', 'fy'], radius: 'fr', fill: '#000000', color: SOFT, width: 0.0015, fade: 0.4, values: live(born, { fx: t => faceMiddle(t)[0], fy: t => faceMiddle(t)[1], fr: t => faceRadius(t) }) }, panelsGone - now())
  })
  // Its two directions, drawn on the wall as the shadow takes them
  const arrows = (color, a, b, name, at) => {
    draw(stroke([a, b], color, { arrow: 'both', width: 0.004, draw: 0.4 }), left - (now() - start))
    label(name, left - (now() - start), at, color, { size: 0.022 })
  }
  const dx = FACE_HALF[0] * 0.8 * ASPECT
  const dy = FACE_HALF[1] * 0.8
  at(cue('wall', 'up', 0.5), () => arrows(Y, [FACE[0] - dx - 0.015, FACE[1] - dy], [FACE[0] - dx - 0.015, FACE[1] + dy], 'up / down', [FACE[0] - dx - 0.015, FACE[1] - dy - 0.03]))
  at(cue('wall', 'left', 0.66), () => arrows(X, [FACE[0] - dx, FACE[1] + dy + 0.025], [FACE[0] + dx, FACE[1] + dy + 0.025], 'left / right', [FACE[0] + dx - 0.04, FACE[1] + dy + 0.055]))
  at(cue('wall', 'Two', 0.85), () => { keep('on the wall: *{two} directions', start + spoken + REST - now()) })
  wait(spoken + REST)
})

shot('toward', () => {
  const start = now()
  const spoken = say('toward')
  status('math', spoken + REST)
  // The way the wall does not have: along the light, toward the lamp
  at(cue('toward', 'toward', 0.22) - 0.3, () => {
    draw(stroke([[0.36, 0.73], [0.16, 0.73]], W, { arrow: 'end', width: 0.005, draw: 0.6 }), panelsGone - now())
    label('*{toward the lamp}', panelsGone - now(), [0.26, 0.78], INK, { accent: W, size: 0.022 })
  })
  at(cue('toward', 'exist', 0.45), () => {
    label('no such direction on the wall', start + spoken + REST - now(), [FACE[0], FACE[1] + FACE_HALF[1] + 0.09], SOFT, { size: 0.022 })
  })
  at(cue('toward', 'grows', 0.95) - 0.4, () => { keep('the shadow can only *{grow}', start + spoken + REST - now()) })
  wait(spoken + REST)
})

shot('away', () => {
  const start = now()
  const spoken = say('away')
  status('math', spoken + REST)
  at(cue('away', 'shrinks', 0.62) - 0.3, () => { keep('or *{shrink} toward its middle', start + spoken + REST - now()) })
  wait(spoken + REST)
})

shot('inout', () => {
  const start = now()
  const spoken = say('inout')
  status('math', spoken + REST)
  // On the wall face on: the direction it cannot point to, as it shows there
  const ring = (inward, born) => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4
      const far = 0.2
      const near = 0.1
      const [from, to] = inward ? [far, near] : [near, far]
      const at = r => [part(FACE[0] + r * Math.cos(a) * ASPECT), part(FACE[1] - r * Math.sin(a))]
      draw(stroke([at(from), at(to)], W, { arrow: 'end', width: 0.004, draw: 0.5 }), panelsGone - born)
    }
  }
  at(cue('inout', 'inside', 0.62), () => { ring(true, now()) })
  at(cue('inout', 'out', 0.92) - 0.2, () => { ring(false, now()) })
  at(cue('inout', 'inside', 0.62), () => {
    caption('*{in} · *{out}', panelsGone - now(), { at: [0.5, 0.12], size: 0.06, font: 'unbounded', accent: W, fade: 0.4 })
  })
  at(cue('inout', 'shows', 0.45), () => { keep('a direction the wall cannot point to looks like *{in} and *{out}', start + spoken + REST - now()) })
  wait(spoken + REST)
})

shot('stepup', () => {
  const start = now()
  const spoken = say('stepup')
  status('math', spoken + REST)
  // Our space, one step up: the arrows of a fourth direction, closing in on a middle from every side
  at(cue('stepup', 'inward', 0.93) - 1.2, () => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8
      const at = r => [part(0.5 + r * Math.cos(a) * ASPECT), part(0.47 - r * Math.sin(a))]
      draw(stroke([at(0.34), at(0.12)], W, { arrow: 'end', width: 0.005, draw: 0.8 }), end - now())
    }
    draw({ kind: 'circle', center: [0.5, 0.47], radius: 0.012, fill: INK, color: INK, width: 0, fade: 0.4 }, end - now())
  })
  at(cue('stepup', 'inward', 0.93) - 0.3, () => {
    caption('a fourth direction: *{inward}', end - now(), { at: [0.5, 0.12], size: 0.05, font: 'unbounded', accent: W, fade: 0.4 })
  })
  until(end)
})

leave()
