// The fourth dimension, clip 1 of films/fourth_dimension.json: the ladder of dimensions. A point is pulled into
// a line, a square and a cube, each pull a new direction; the fourth pull has no direction left and goes
// inward, a cube inside a cube, and the hypercube then turns through its fourth direction.
// The narration sets the pace: input.lines holds the seconds each line is spoken for and input.cues the
// second a word falls at (films/fourth_dimension_voice.mjs writes both), and say() marks where a line starts.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_ladder.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
// Without the narration's lengths a line takes what its words would at 155 a minute
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const long = (name, guess) => lines[name] ?? guess
const heard = (name, word, guess) => cues[name]?.[word] ?? guess
const until = second => wait(Math.max(0, second - now()))

const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b5c'
const INK = '#eef2ff'

film({
  fps: 60,
  seed: 11,
  warmup: 4,
  settings: {
    blackHoleSize: 0,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 10,
    cameraPitch: 8,
    numParticles: 30000,
    baseSpeed: 0.7,
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
    gridLatticeCell: 1.5,
    colorPalette: [
      { r: 120, g: 200, b: 255, enabled: true, percent: 45 },
      { r: 190, g: 140, b: 255, enabled: true, percent: 35 },
      { r: 255, g: 210, b: 150, enabled: true, percent: 20 }
    ]
  }
})
set({ fade: 1, letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

const ASPECT = 9 / 16
const YAW = 0.52
const PITCH = 0.34
// A point of space on the frame, as an oblique drawing sees it: x to the right, y up, z away to the upper right.
// `size` is one unit of space as a share of the frame's short side
const flat = (centre, size) => ([x, y, z]) => {
  const across = x * Math.cos(YAW) + z * Math.sin(YAW)
  const away = z * Math.cos(YAW) - x * Math.sin(YAW)
  const up = y * Math.cos(PITCH) + away * Math.sin(PITCH)
  return [+(centre[0] + size * across * ASPECT).toFixed(5), +(centre[1] - size * up).toFixed(5)]
}
const stroke = (points, color, more = {}) => ({ kind: 'line', points, color, width: 0.0042, fade: 0.4, ...more })

// ---- three directions, and the question ----

const axes = flat([0.47, 0.68], 0.34)
const origin = axes([0, 0, 0])

shot('three directions', () => {
  meanwhile(() => { to({ fade: 0 }, 3) })
  // A slow drift round the stream of particles while the question is asked
  meanwhile(() => { to({ cameraYaw: 24 }, 15) })
  wait(1.2)
  const start = now()
  const spoken = say('taught', 5.2)
  const gone = start + spoken + 0.8 + long('fourth', 6.4) + 0.9
  const named = [
    ['length', [1, 0, 0], X, 'length', 2.7],
    ['width', [0, 0, 1], Z, 'width', 3.5],
    ['height', [0, 1, 0], Y, 'height', 4.3]
  ]
  for (const [word, way, color, label, guess] of named) {
    at(start + heard('taught', word, guess), () => {
      draw(stroke([origin, axes(way)], color, { arrow: 'end', width: 0.006, draw: 0.5 }), gone - now())
      caption(label, gone - now(), { at: axes(way.map(part => part * 1.22)), size: 0.03, color, font: 'unbounded', fade: 0.4 })
    })
  }
  draw({ kind: 'circle', center: origin, radius: 0.008, fill: INK, color: INK, fade: 0.4 }, gone - now())
  wait(spoken + 0.8)
})

shot('a fourth?', () => {
  const spoken = say('fourth', 6.4)
  // A fourth arrow that finds no place to point: it swings round the three and settles nowhere
  const swing = s => 0.7 + 1.7 * s + 0.9 * Math.sin(2.3 * s)
  draw(stroke([origin, ['tipX', 'tipY']], W, {
    arrow: 'end',
    width: 0.006,
    dash: true,
    values: { tipX: s => origin[0] + 0.24 * Math.cos(swing(s)) * ASPECT, tipY: s => origin[1] - 0.24 * Math.sin(swing(s)) }
  }), spoken + 0.9)
  caption('and a *{fourth}?', spoken + 0.9, { at: [0.5, 0.2], size: 0.05, font: 'unbounded', accent: W, fade: 0.5 })
  wait(spoken + 1.5)
})

// ---- the ladder ----

const cube = flat([0.58, 0.5], 0.3)
// How small the copy of the cube stands inside it, and what that makes of the fourth direction's perspective
const INNER = 0.42
const DEEP = 1 / INNER - 1
// A corner while the figure is built: its sides pulled out this far, the copy shrunk this far
const built = ([x, y, z, w], [alongX, alongY, alongZ, copy]) => {
  const scale = w ? copy : 1
  return cube([(x * alongX - 0.5) * scale, (y * alongY - 0.5) * scale, (z * alongZ - 0.5) * scale])
}
// A corner of the finished hypercube turned by an angle from x toward the fourth direction, seen in perspective
// along that direction: at 0 it is the built figure, at half a turn the inner cube is the outer one
const turned = ([x, y, z, w], angle) => {
  const across = (x - 0.5) * Math.cos(angle) - (w - 0.5) * Math.sin(angle)
  const deep = (x - 0.5) * Math.sin(angle) + (w - 0.5) * Math.cos(angle)
  const scale = 1 / (1 + DEEP * (deep + 0.5))
  return cube([across * scale, (y - 0.5) * scale, (z - 0.5) * scale])
}
const STAGES = [[0, 0, 0, 1], [1, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 1], [1, 1, 1, INNER]]
const COLORS = [X, Y, Z, W]
const corners = []
for (let index = 0; index < 16; index++) corners.push([index & 1, (index >> 1) & 1, (index >> 2) & 1, (index >> 3) & 1])
// The pull a corner is made by: the last direction it is moved along, none for the first point
const madeBy = corner => corner.lastIndexOf(1)

shot('a point', () => {
  const start = now()
  // The seconds of the whole ladder, laid out first: every edge is drawn once and moves along them
  let second = start
  const beat = (name, guess, rest) => { const from = second; second += long(name, guess) + rest; return from }
  const point = beat('point', 3.2, 0.7)
  const line = beat('line', 3.8, 0.8)
  const square = beat('square', 3.6, 0.8)
  const solid = beat('cube', 2.2, 1.2)
  const rule = beat('rule', 4.6, 0.9)
  const taken = beat('taken', 7.4, 0.5)
  const inward = beat('inward', 7.6, 0.9)
  const hyper = beat('hypercube', 4.8, 0.9)
  const ends = beat('ends', 5.2, 4.6)
  const end = second
  const pulls = [
    { at: line + 0.2, over: 1.5 },
    { at: square + 0.2, over: 1.5 },
    { at: solid + 0.15, over: 1.5 },
    { at: inward + heard('inward', 'place', 2.9), over: 2.6 }
  ]
  // The field of particles says what each step adds. In a point nothing can move, and the field goes dark;
  // along a line everything runs one way, across the frame; the cube has depth, and the camera looks into it
  at(point + 0.3, () => { to({ baseSpeed: 0 }, 1.6) })
  at(pulls[0].at, () => { to({ baseSpeed: 1.8, cameraYaw: 90, cameraPitch: 0 }, 1.6) })
  at(pulls[1].at, () => { to({ cameraYaw: 62, cameraPitch: 32 }, 1.6) })
  at(pulls[2].at, () => { to({ cameraYaw: 28, cameraPitch: 14, baseSpeed: 1.2 }, 1.6) })
  const born = corner => madeBy(corner) < 0 ? point + 0.3 : pulls[madeBy(corner)].at
  // The way of one coordinate of a corner through the pulls that come after it is made
  const path = (corner, part) => {
    const keys = madeBy(corner) < 0 ? [[born(corner), built(corner, STAGES[0])[part]]] : []
    for (let pull = Math.max(0, madeBy(corner)); pull < pulls.length; pull++) {
      keys.push([pulls[pull].at, built(corner, STAGES[pull])[part]])
      keys.push([pulls[pull].at + pulls[pull].over, built(corner, STAGES[pull + 1])[part], 'ease'])
    }
    return keys
  }
  const spin = (ends - start) + 0.2
  const length = end - start
  // The turn: once round through the fourth direction, starting and ending at rest
  const angle = s => {
    const share = Math.min(1, Math.max(0, (s - spin) / (length - spin)))
    return 2 * Math.PI * share * share * (3 - 2 * share)
  }
  // After the build a corner follows the turn, so its shapes are two: keyed while built, baked while turning
  const turnAt = start + spin
  const place = corner => ({
    building: { x: path(corner, 0), y: path(corner, 1) },
    turning: { x: s => turned(corner, angle(s + spin))[0], y: s => turned(corner, angle(s + spin))[1] }
  })

  corners.forEach(corner => {
    const { building, turning } = place(corner)
    const dot = { kind: 'circle', center: ['x', 'y'], radius: 0.0062, fill: INK, color: INK }
    at(born(corner), () => { draw({ ...dot, fade: 0.3, values: building }, turnAt - now()) })
    at(turnAt, () => { draw({ ...dot, fade: 0, values: turning }, end - now()) })
  })
  corners.forEach(from => {
    for (let way = 0; way < 4; way++) {
      if (from[way] === 1) continue
      const to = from.map((part, index) => index === way ? 1 : part)
      const a = place(from)
      const b = place(to)
      const points = [['ax', 'ay'], ['bx', 'by']]
      const building = { ax: a.building.x, ay: a.building.y, bx: b.building.x, by: b.building.y }
      const turning = { ax: a.turning.x, ay: a.turning.y, bx: b.turning.x, by: b.turning.y }
      const first = Math.max(born(from), born(to))
      // The fourth direction is drawn twice: a wide soft line under the line itself
      const looks = way === 3 ? [{ width: 0.016, opacity: 0.22 }, { width: 0.0052 }] : [{}]
      for (const look of looks) {
        at(first, () => { draw(stroke(points, COLORS[way], { ...look, fade: 0, values: building }), turnAt - now()) })
        at(turnAt, () => { draw(stroke(points, COLORS[way], { ...look, fade: 0, values: turning }), end - now()) })
      }
    }
  })

  // The count of dimensions beside the figure, and the name of what stands there
  const counted = [[point, 0], [pulls[0].at + 0.9, 1, 'hold'], [pulls[1].at + 0.9, 2, 'hold'], [pulls[2].at + 0.9, 3, 'hold'], [pulls[3].at + 1.6, 4, 'hold']]
  caption('*{#{count:0}}D', length, { at: [0.2, 0.44], size: 0.17, font: 'unbounded', accent: INK, values: { count: counted }, fade: 0.6 })
  const names = [['a point', point, pulls[0].at + 0.5], ['a line', pulls[0].at + 1, pulls[1].at + 0.5], ['a square', pulls[1].at + 1, pulls[2].at + 0.5],
    ['a cube', pulls[2].at + 1, pulls[3].at + 1.2], ['a hypercube', pulls[3].at + 1.8, end]]
  for (const [name, from, to] of names) at(from, () => { caption(name, to - from, { at: [0.2, 0.6], size: 0.034, font: 'unbounded', color: '#aab6d8', fade: 0.3 }) })
  // The letter of each direction beside the first edge pulled along it
  const letters = [['X', [0.5, -0.13, 0], X, 0], ['Y', [-0.15, 0.5, 0], Y, 1], ['Z', [1.16, -0.04, 0.5], Z, 2]]
  for (const [letter, where, color, pull] of letters) {
    at(pulls[pull].at + pulls[pull].over, () => {
      caption(letter, turnAt - now(), { at: cube(where.map(part => part - 0.5)), size: 0.03, font: 'unbounded', color, fade: 0.4 })
    })
  }

  mark('say:point')
  until(line)
})

shot('a line', () => {
  const spoken = say('line', 3.8)
  wait(spoken + 0.8)
})

shot('a square', () => {
  const spoken = say('square', 3.6)
  wait(spoken + 0.8)
})

shot('a cube', () => {
  const spoken = say('cube', 2.2)
  wait(spoken + 1.2)
})

shot('the rule', () => {
  const spoken = say('rule', 4.6)
  caption('+1 dimension = +1 *{direction}', spoken + 0.5, { at: [0.58, 0.83], size: 0.042, font: 'noto', accent: W, reveal: 'words', revealOver: 1.6 })
  wait(spoken + 0.9)
})

shot('every direction is taken', () => {
  const start = now()
  const spoken = say('taken', 7.4)
  // The cage of space behind the cube: its lines run along the three directions there are
  meanwhile(() => { to({ gridLattice: 0.32 }, 3) })
  const corner = [-0.5, -0.5, -0.5]
  const ways = [['up', [0, 1.25, 0], Y, 2.9], ['sideways', [1.25, 0, 0], X, 3.6], ['forward', [0, 0, 1.25], Z, 4.4]]
  // The camera whips so that the stream of particles runs the way each word says: up the frame, across it,
  // and straight at the viewer
  const views = { up: { cameraYaw: 0, cameraPitch: 80 }, sideways: { cameraYaw: 90, cameraPitch: 0 }, forward: { cameraYaw: 0, cameraPitch: 0 } }
  for (const [word, , , guess] of ways) at(start + heard('taken', word, guess) - 0.35, () => { to(views[word], 0.7) })
  for (const [word, way, color, guess] of ways) {
    at(start + heard('taken', word, guess), () => {
      draw(stroke([cube(corner), cube(corner.map((part, index) => part + way[index]))], color, { arrow: 'end', width: 0.009, draw: 0.35, fade: 0.35 }), 1.5)
    })
  }
  // The fourth arrow again, looking for a way out of the cube from its middle
  const middle = cube([0, 0, 0])
  const from = heard('taken', 'every', 5.2)
  const swing = s => 2.4 + 2.1 * s + 0.8 * Math.sin(2.6 * s)
  at(start + from, () => {
    draw(stroke([middle, ['tipX', 'tipY']], W, {
      arrow: 'end',
      width: 0.006,
      dash: true,
      values: { tipX: s => middle[0] + 0.3 * Math.cos(swing(s)) * ASPECT, tipY: s => middle[1] - 0.3 * Math.sin(swing(s)) }
    }), spoken + 0.5 - from + heard('inward', 'inward', 1.9))
  })
  caption('where does the *{fourth} point?', spoken + 0.3, { at: [0.58, 0.83], size: 0.042, font: 'noto', accent: W })
  wait(spoken + 0.5)
})

shot('inward', () => {
  const spoken = say('inward', 7.6)
  meanwhile(() => { to({ cameraYaw: 24, cameraPitch: 12, baseSpeed: 0.8 }, 3.2) })
  at(now() + heard('inward', 'inward', 1.9), () => {
    caption('*{inward}', spoken + 0.6 - heard('inward', 'inward', 1.9), { at: [0.58, 0.83], size: 0.05, font: 'unbounded', accent: W })
  })
  wait(spoken + 0.9)
})

shot('a hypercube', () => {
  const start = now()
  const spoken = say('hypercube', 4.8)
  at(start + heard('hypercube', 'red', 2.6), () => {
    const till = start + spoken + 0.6
    // The label points at the middle of one red edge, between a corner of the cube and the same corner of its copy
    const edge = cube([0.5, 0.5, 0.5].map(part => part * (1 + INNER) / 2))
    draw(stroke([[0.855, 0.3], [edge[0] + 0.012, edge[1] - 0.012]], W, { arrow: 'end', width: 0.004, draw: 0.4 }), till - now())
    caption('*{W}  the fourth dimension', till - now(), { at: [0.87, 0.25], size: 0.03, font: 'unbounded', accent: W, width: 0.22 })
  })
  wait(spoken + 0.9)
})

shot('inside out', () => {
  const spoken = say('ends', 5.2)
  caption('inside ⇄ outside: two ends of *{one direction}', spoken + 3.4, { at: [0.58, 0.83], size: 0.04, font: 'noto', accent: W, reveal: 'words', revealOver: 2.4 })
  meanwhile(() => { to({ gridLattice: 0.5 }, 6) })
  wait(spoken + 4.6)
})
