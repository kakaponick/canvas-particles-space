// The fourth dimension as popular science, clip 3 of films/fourth_dimension_pop.json: every direction is taken, and the drawing of a cube inside a cube shows the one that is left: inward.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_03_inward.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  taken: 'Try it. Up and down: taken. Left and right: taken. Forward and back: taken. In our space, there is nowhere left to point.',
  trick: 'But there is a trick. When you draw a cube on paper, you fake the third direction. The far side is simply drawn smaller.',
  copy: 'So do it again. Draw a small cube inside the big one, and join the corners. Those red lines are the fourth direction, faked the only way we can.',
  tesseract: 'This shape has a name: a tesseract. A cube, dragged through a fourth dimension.',
  inout: 'And look which way the red lines run. Inward. From where we stand, the fourth direction looks like in, and out.'
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

film({
  fps: 60,
  seed: 3,
  warmup: 4,
  settings: {
    blackHoleSize: 0,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 28,
    cameraPitch: 14,
    numParticles: 30000,
    baseSpeed: 1.2,
    trailIntensity: 0.1,
    baseBrightness: 0.8,
    nebula: 1,
    nebulaScale: 900,
    nebulaSparseness: 0.35,
    nebulaEdge: 0.5,
    nebulaContrast: 0.3,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#4a22b0',
    nebulaColorDeep: '#0f7a9a',
    nebulaColorCore: '#ff7ab8',
    nebulaCore: 0.5,
    starsBrightness: 1.4,
    starDensity: 0.2,
    colorPalette: [
      { r: 120, g: 200, b: 255, enabled: true, percent: 45 },
      { r: 190, g: 140, b: 255, enabled: true, percent: 35 },
      { r: 255, g: 210, b: 150, enabled: true, percent: 20 }
    ]
  }
})
chapter('03', 'WHERE DOES THE FOURTH POINT?')

const ASPECT = 9 / 16
const YAW = 0.52
const PITCH = 0.34
// A point of space on the frame, as an oblique drawing sees it: x to the right, y up, z away to the upper right
const flat = (centre, size) => ([x, y, z]) => {
  const across = x * Math.cos(YAW) + z * Math.sin(YAW)
  const away = z * Math.cos(YAW) - x * Math.sin(YAW)
  const up = y * Math.cos(PITCH) + away * Math.sin(PITCH)
  return [+(centre[0] + size * across * ASPECT).toFixed(5), +(centre[1] - size * up).toFixed(5)]
}
const stroke = (points, color, more = {}) => ({ kind: 'line', points, color, width: 0.0042, fade: 0.4, ...more })
const label = (text, seconds, at, color, more = {}) => caption(text, seconds, { at, size: 0.03, font: 'unbounded', color, fade: 0.4, ...more })

const cube = flat([0.58, 0.5], 0.3)
const INNER = 0.42
const DEEP = 1 / INNER - 1
const COLORS = [X, Y, Z, W]
const corners = []
for (let index = 0; index < 16; index++) corners.push([index & 1, (index >> 1) & 1, (index >> 2) & 1, (index >> 3) & 1])

// The seconds of the whole clip, laid out first: the figure is drawn once and moves along them
const REST = 0.6
const plan = {}
let second = now()
for (const name of Object.keys(LINES)) { plan[name] = second; second += long(name) + REST }
const end = second + 1.4
const smooth = share => { const k = Math.min(1, Math.max(0, share)); return k * k * (3 - 2 * k) }
// The copy shrinks out of the cube at "Draw a small cube"; the figure turns once through W after "dragged"
const shrinkAt = plan.copy + heard('copy', 'Draw', 0.14)
const joinAt = plan.copy + heard('copy', 'join', 0.46)
const turnAt = plan.tesseract + heard('tesseract', 'dragged', 0.62) - 0.3
const TURN = 4.6
const copyScale = t => 1 - (1 - INNER) * smooth((t - shrinkAt) / 1.6)
const angleAt = t => 2 * Math.PI * smooth((t - turnAt) / TURN)
const place = (corner, t) => {
  const angle = angleAt(t)
  const [x, y, z, w] = corner
  if (angle <= 0 || angle >= 2 * Math.PI) {
    const scale = w ? copyScale(t) : 1
    return cube([(x - 0.5) * scale, (y - 0.5) * scale, (z - 0.5) * scale])
  }
  const across = (x - 0.5) * Math.cos(angle) - (w - 0.5) * Math.sin(angle)
  const deep = (x - 0.5) * Math.sin(angle) + (w - 0.5) * Math.cos(angle)
  const scale = 1 / (1 + DEEP * (deep + 0.5))
  return cube([across * scale, (y - 0.5) * scale, (z - 0.5) * scale])
}
// Every edge of the figure, born when its line asks for it and drawn till the clip ends
corners.forEach(from => {
  for (let way = 0; way < 4; way++) {
    if (from[way] === 1) continue
    const to = from.map((part, index) => index === way ? 1 : part)
    const born = way === 3 ? joinAt : from[3] ? shrinkAt : plan.taken
    const values = {
      ax: s => place(from, born + s)[0], ay: s => place(from, born + s)[1],
      bx: s => place(to, born + s)[0], by: s => place(to, born + s)[1]
    }
    // The fourth direction is drawn twice: a wide soft line under the line itself
    const looks = way === 3 ? [{ width: 0.016, opacity: 0.22 }, { width: 0.0052 }] : [from[3] ? { opacity: 0.6 } : {}]
    for (const look of looks) {
      at(born, () => { draw(stroke([['ax', 'ay'], ['bx', 'by']], COLORS[way], { ...look, draw: way === 3 ? 0.8 : 0, values }), end - now()) })
    }
  }
})

shot('taken', () => {
  const start = now()
  const spoken = say('taken')
  status('math', spoken + REST)
  const middle = cube([0, 0, 0])
  // Each pair of arrows at its words, the stream of particles whipped to run that way, and its row ticked
  const pairs = [
    ['Up', 0.08, 'taken', 0.22, Y, [0, 0.85, 0], 'up / down', { cameraYaw: 0, cameraPitch: 80 }],
    ['Left', 0.27, 'taken', 0.42, X, [0.85, 0, 0], 'left / right', { cameraYaw: 90, cameraPitch: 0 }],
    ['Forward', 0.45, 'taken', 0.6, Z, [0, 0, 0.85], 'forward / back', { cameraYaw: 0, cameraPitch: 0 }]
  ]
  const gone = start + spoken + REST
  pairs.forEach(([word, share, , tickShare, color, way, name, view], row) => {
    const y = 0.3 + 0.11 * row
    at(start + heard('taken', word, share), () => {
      to(view, 0.6)
    })
    at(start + heard('taken', word, share), () => {
      for (const sign of [1, -1]) draw(stroke([middle, cube(way.map(part => part * sign))], color, { arrow: 'end', width: 0.007, draw: 0.4 }), gone - now())
      label(name, gone - now(), [0.17, y], color)
    })
    at(start + long('taken') * tickShare + 0.2, () => { label('✓ taken', gone - now(), [0.17, y + 0.045], SOFT, { size: 0.024 }) })
  })
  // The fourth arrow, finding nowhere left to point
  const from = heard('taken', 'nowhere', 0.85)
  const swing = s => 2.4 + 2.1 * s + 0.8 * Math.sin(2.6 * s)
  at(start + from - 0.6, () => {
    draw(stroke([middle, ['tipX', 'tipY']], W, {
      arrow: 'end', width: 0.006, dash: true,
      values: { tipX: s => middle[0] + 0.26 * Math.cos(swing(s)) * ASPECT, tipY: s => middle[1] - 0.26 * Math.sin(swing(s)) }
    }), gone - now())
    label('?', gone - now(), [0.17, 0.63], W, { size: 0.06 })
  })
  wait(spoken + REST)
})

shot('trick', () => {
  const start = now()
  const spoken = say('trick')
  status('math', spoken + REST)
  // The stream comes straight at the viewer: the particles fan out from the middle as the drawn depth does
  meanwhile(() => { to({ cameraYaw: 0, cameraPitch: 0, baseSpeed: 1.6 }, 1.5) })
  // A cube as it is drawn on paper, straight on: a square inside a square, the corners joined along Z
  const centre = [0.2, 0.47]
  const square = half => [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => [+(centre[0] + a * half * ASPECT).toFixed(5), +(centre[1] + b * half).toFixed(5)])
  const outer = square(0.13)
  const inner = square(0.065)
  const gone = shrinkAt + 1.2
  at(start + heard('trick', 'draw', 0.26), () => { draw(stroke(outer, INK, { draw: 0.6 }), gone - now()) })
  at(start + heard('trick', 'fake', 0.5), () => {
    for (let index = 0; index < 4; index++) draw(stroke([outer[index], inner[index]], Z, { draw: 0.5 }), gone - now())
    label('Z', gone - now(), [outer[2][0] + 0.015, outer[2][1] + 0.02], Z)
  })
  at(start + heard('trick', 'far', 0.73), () => {
    draw(stroke(inner, INK, { draw: 0.5 }), gone - now())
    label('drawn smaller', gone - now(), [centre[0], centre[1] + 0.2], SOFT, { size: 0.026 })
  })
  wait(spoken + REST)
})

shot('copy', () => {
  const start = now()
  const spoken = say('copy')
  status('math', spoken + REST)
  meanwhile(() => { to({ baseSpeed: 0.9 }, 3) })
  const till = start + spoken + REST + long('tesseract') * 0.3
  at(start + heard('copy', 'red', 0.6), () => {
    // The label points at the middle of one red edge, between a corner of the cube and the same corner of its copy
    const edge = cube([0.5, 0.5, 0.5].map(part => part * (1 + INNER) / 2))
    draw(stroke([[0.855, 0.3], [edge[0] + 0.012, edge[1] - 0.012]], W, { arrow: 'end', width: 0.004, draw: 0.4 }), till - now())
    caption('*{W}: the fourth direction', till - now(), { at: [0.87, 0.24], size: 0.028, font: 'unbounded', accent: W, width: 0.22, fade: 0.4 })
  })
  at(start + heard('copy', 'fourth', 0.75), () => { keep('red lines: the *{fourth} direction, faked', start + spoken + REST - now()) })
  wait(spoken + REST)
})

shot('tesseract', () => {
  const start = now()
  const spoken = say('tesseract')
  status('math', spoken + REST)
  meanwhile(() => { to({ cameraYaw: 30, cameraPitch: 12 }, 5) })
  at(start + heard('tesseract', 'tesseract', 0.42), () => {
    caption('tesseract', start + spoken + REST - now(), { at: [0.5, 0.13], size: 0.07, font: 'unbounded', color: W, fade: 0.5 })
  })
  wait(spoken + REST)
})

shot('inout', () => {
  const start = now()
  const spoken = say('inout')
  status('math', spoken + REST)
  meanwhile(() => { to({ cameraYaw: 0, cameraPitch: 0, baseSpeed: 1.4 }, 3) })
  const gone = end
  // Arrows along the red lines: inward from each corner to its copy, then outward past the corner
  const reds = corners.filter(corner => corner[3] === 0).map(corner => [place(corner, end), place([...corner.slice(0, 3), 1], end)])
  const along = (a, b, share) => [+(a[0] + (b[0] - a[0]) * share).toFixed(5), +(a[1] + (b[1] - a[1]) * share).toFixed(5)]
  at(start + heard('inout', 'Inward', 0.36), () => {
    for (const [outer, inner] of reds) draw(stroke([along(outer, inner, 0.15), along(outer, inner, 0.8)], W, { arrow: 'end', width: 0.006, draw: 0.6 }), gone - now())
    caption('*{inward}', gone - now(), { at: [0.5, 0.13], size: 0.06, font: 'unbounded', accent: W, fade: 0.4 })
  })
  at(start + heard('inout', 'out', 0.92), () => {
    for (const [outer, inner] of reds) draw(stroke([outer, along(outer, inner, -0.55)], W, { arrow: 'end', width: 0.006, draw: 0.5 }), gone - now())
  })
  at(start + heard('inout', 'fourth', 0.66), () => { keep('the fourth direction looks like *{in} and out', end - now()) })
  until(end)
})

leave()
