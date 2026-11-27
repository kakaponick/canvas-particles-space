// The fourth dimension, clip 2 of films/fourth_dimension/fourth_dimension.json: the well. A star collapses into a black hole
// under the title, and the picture we have of one, seen straight on, tips over into the picture every
// textbook draws: a sheet of rings and spokes with a well in it, its axes X, Y and W, its matter lying on
// it and going down it. The camera goes down the well, then rises over it: the well is gone, and its depth
// is the rings crowding toward the centre, W the line between an outer circle and an inner one. A flat
// creature of the sheet knows only that it slides inward; then the sheet gets its third dimension back, a
// lattice of space, and the lattice is drawn inward too, into a fourth.
// It is one move of one camera from the hole to the lattice: gridTilt is that camera, the sheet is drawn in
// rings (gridRings), the particles lie on it (gridRide), and what is drawn over it is laid on it by the
// sheet's own sums (laySheet).
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension/clips/02_well.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, opening, drive, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b5c'
const INK = '#eef2ff'
const GRID = '#4de3ff'

film({
  fps: 60,
  seed: 5,
  settings: {
    blackHoleSize: 8,
    numParticles: 40000,
    // What falls toward the hole keeps most of the speed gravity gives it and is swung round: a bright ring
    // of matter gathers round the shadow, as round a real black hole
    gravityInertia: 0.92,
    orbitalStrength: 90,
    gravityStrength: 5,
    gravityReach: 8,
    baseSpeed: 1,
    trailIntensity: 0.08,
    baseBrightness: 1.1,
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
    ringDoppler: 0.6,
    ringGlow: 0.6,
    orbitSize: 4.2,
    orbitEccentricity: 0.55,
    orbitTrail: 5,
    orbitStarSize: 3,
    gridColor: GRID,
    gridCell: 4,
    gridTilt: 0,
    gridDepth: 0,
    gridRings: 40,
    // The field is born round the hole, which stands low in the frame over a tilted sheet: fed from the
    // frame's centre, the well would fill on one side only
    fieldAtHole: 1,
    gridSpokes: 24,
    // The sheet is a disc of space round the well, as a textbook draws it, so nothing of it lies under the hole
    gridSpan: 0.6,
    gridFade: 0.3,
    gridLatticeCell: 1.6,
    gridLatticeWarp: 0,
    gridLatticeLine: 2,
    threeDEase: 2.6,
    cameraYaw: 0,
    cameraPitch: 0
  }
})
set({ fade: 0 })

// ---- a star, and what is left of it ----

// The star brightens for this long under the first line and goes off as the line ends; every later moment of
// the opening is moved out by as much as the explosion is
const COLLAPSE = 3.6
const LATER = COLLAPSE - 0.6
let holeSaid = 0
let holeSpoken = 0
shot('a star', () => {
  wait(0.6)
  const spoken = say('limit', 6.6)
  wait(Math.max(0, spoken + 0.25 - COLLAPSE))
})

shot('the fourth dimension', () => {
  const start = now()
  // The next line begins while the hole is taking the title
  holeSaid = start + COLLAPSE + 3.5
  at(holeSaid, () => { holeSpoken = say('hole', 8.8) })
  opening({
    preset: 'Anamorphic',
    title: 'THE FOURTH\nDIMENSION',
    params: {
      collapseAt: COLLAPSE,
      starChargeStart: 0.2,
      remnantAt: 1 + LATER,
      horizonAt: 1.3 + LATER,
      dissolveAt: 2.9 + LATER,
      releaseAt: 5.4 + LATER,
      introEnd: 5.8 + LATER,
      titleExit: 'Falls into the black hole',
      letterbox: 0.11,
      vignette: 0.4,
      filmGrain: 0.04,
      filmHold: 1
    }
  })
  // The fringe of the anamorphic glass leaves with the opening: the grid and the lattice to come are
  // drawings, and their lines stay single to the frame's corners
  meanwhile(() => { to({ lensFringe: 0 }, 1.5) })
})

shot('a black hole', () => {
  // The stars come once the fringe is gone, so their traces are single lines from the first
  at(now() + 1.5, () => { set({ orbitCount: 7 }) })
  const end = holeSaid + (lines.hole ?? 8.8) + 0.8
  meanwhile(() => { to({ cameraZoom: 1.7 }, end - now()) })
  const label = (word, guess, text, place) => {
    const from = Math.max(now(), holeSaid + heard('hole', word, guess))
    at(from, () => { caption(text, end - from, { size: 0.03, font: 'unbounded', color: INK, ...place }) })
  }
  label('shadow', 4.3, 'a shadow', { at: 'hole', angle: 205 })
  label('ring', 5.6, 'a ring of light', { at: 'hole', angle: 25 })
  label('sky', 7.4, 'a sky bent around it', { at: 'einstein', angle: 140 })
  wait(end - now())
})

// A caption or a drawing whose seconds come out of the narration is left out when they leave it no time
const cap = (text, seconds, look) => { if (seconds > 0.15) caption(text, seconds, look) }
const sketch = (shape, seconds) => { if (seconds > 0.15) draw(shape, seconds) }

// ---- the sheet as the scene lays it out, so that a drawing can lie on it ----

// The flat mode draws the sheet with a camera of its own (layFlatSheet in src/lib/space_grid.ts, sheetSeen
// and sheetScreen in the grid vertex shader). The same sums here say where a point of the sheet stands on the screen, so that an axis, a line
// down the wall of the well or a creature can be drawn on the surface while the camera moves over it.
const LONG = 1920
const SHORT = 1080
const SHADOW = 0.08 * SHORT
const EASES = { ease: share => share * share * (3 - 2 * share), out: share => 1 - (1 - share) ** 3, in: share => share ** 3 }
// A number that moves along the clip: [[second, value, how it arrives], ...], held before and after
const track = keys => second => {
  if (second <= keys[0][0]) return keys[0][1]
  for (let index = 1; index < keys.length; index++) {
    const [until, value, how = 'ease'] = keys[index]
    if (second > until) continue
    const [from, before] = keys[index - 1]
    return until === from ? value : before + (value - before) * EASES[how]((second - from) / (until - from))
  }
  return keys[keys.length - 1][1]
}
// How deep the sheet lies at a distance from the hole, as a share of its depth at the shadow's edge
const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
// The sheet at one tilt, depth and place of the hole: a function from a point of it (across and toward the
// camera, from the hole, in the well's radii) to its place on the screen, from the hole, in hole radii, x to
// the right and y up. `level` takes the point off the surface, to a share of the well's depth: 0 is the
// height of the flat sheet, 1 the bottom of the well
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

// ---- the textbook picture, and the camera that goes over it ----

// One camera move from here to the lattice: the picture of the hole we have tips over into the textbook
// well, the camera goes down the well, rises over it, nods to it, comes down beside a creature of the
// sheet. So the seconds of every line are worked out first, and the tilt, the well's depth and the hole's
// place follow them
const long = (name, guess) => lines[name] ?? guess
const SHEET = now()
let second = SHEET
const beat = (name, guess, rest) => { const from = second; second += long(name, guess) + rest; return from }
const tTextbook = beat('textbook', 7.7, 1.3)
const tAxes = beat('axes', 8.8, 0.9)
const tLiterally = beat('literally', 5.1, 0.8)
const tDown = beat('down', 4.8, 1)
const tRise = second
const RISE = 5.4
const riseAt = tRise + heard('rise', 'rise', 2.1) - 0.3
second = Math.max(tRise + long('rise', 5.1) + 0.5, riseAt + RISE + 0.3)
const tVanished = beat('vanished', 10.5, 0.9)
const tCircle = beat('circle', 12.3, 0.8)
const tCreature = beat('creature', 14.6, 0.9)
const tWe = second

const TIP = 4.8
const tipAt = tTextbook + heard('textbook', 'sheet', 4.7) - 1.6
const wellAt = tTextbook + heard('textbook', 'well', 6.8) - 0.7
const nodAt = tVanished + heard('vanished', 'ring', 4.6) - 0.5
const nodBack = tVanished + heard('vanished', 'above', 7.6) - 0.4
const lookAt = tCreature + heard('creature', 'look', 6.4) - 0.6
const slideAt = tCreature + heard('creature', 'slides', 12.7) - 0.5
const FLAT = 1.4

const tilt = track([
  [SHEET, 0], [tipAt, 0], [tipAt + TIP, 68], [riseAt, 68], [riseAt + RISE, 0],
  [nodAt, 0], [nodAt + 1.8, 44], [nodBack, 44], [nodBack + 2.2, 0],
  [lookAt, 0], [lookAt + 3, 64], [slideAt, 64], [slideAt + 3.2, 54], [tWe, 54], [tWe + FLAT, 0]
])
const depth = track([
  [SHEET, 0], [wellAt, 0], [wellAt + 2.8, 6, 'out'], [tDown, 6], [tDown + 3.4, 10],
  [riseAt, 10], [riseAt + RISE, 6], [tWe, 6], [tWe + FLAT, 0]
])
const holeY = track([
  [SHEET, 0.5], [tipAt, 0.5], [tipAt + TIP, 0.7], [tDown, 0.7], [tDown + 3.4, 0.6], [riseAt, 0.6], [riseAt + RISE, 0.5],
  [nodAt, 0.5], [nodAt + 1.8, 0.6], [nodBack, 0.6], [nodBack + 2.2, 0.5],
  [lookAt, 0.5], [lookAt + 3, 0.68], [tWe, 0.68], [tWe + FLAT, 0.5]
])
meanwhile(() => {
  drive({ gridTilt: s => tilt(SHEET + s), gridDepth: s => depth(SHEET + s), blackHoleY: s => holeY(SHEET + s) }, tWe + FLAT - SHEET)
})

// Where a point of the sheet stands at a second of the clip
const sheets = new Map()
const sheetAt = at => {
  const key = Math.round(at * 240)
  if (!sheets.has(key)) sheets.set(key, laySheet(tilt(at), depth(at), holeY(at)))
  return sheets.get(key)
}
const part = value => +value.toFixed(4)
// A line between two points of the sheet ([across, toward, level]) that stays on it as the camera moves
function onSheet (from, to, look, seconds) {
  const born = now()
  sketch({
    kind: 'line',
    points: [{ hole: ['ax', 'ay'] }, { hole: ['bx', 'by'] }],
    ...look,
    values: {
      ax: s => part(sheetAt(born + s)(...from)[0]),
      ay: s => part(sheetAt(born + s)(...from)[1]),
      bx: s => part(sheetAt(born + s)(...to)[0]),
      by: s => part(sheetAt(born + s)(...to)[1])
    }
  }, seconds)
}

// What falls toward the hole on the sheet: the whole field, at any depth, so that what the hole takes is made
// up again; it is swung round as it comes, a whirl that drains down the well's wall. Its trails are short: a
// camera that tilts moves every particle on the screen, and a long trail would draw that as rain. Every
// particle is drawn as wide and as bright as the next, near or far in the field, and dimly, so that the well
// fills with a veil of matter the sheet's lines show through
const WHIRL = {
  gravityInertia: 0.75, orbitalStrength: 80, gravityStrength: 4, gravityReach: 16, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.03, trailIntensity: 0.5,
  depthFade: 0, minOpacity: 0.1, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.6
}
// and matter with nothing to swing it round, which goes straight in along the spokes
const INFALL = { gravityInertia: 0.3, orbitalStrength: 0, gravityStrength: 6, gravityReach: 14, speedGlowKnee: 0.02, trailIntensity: 0.05, minOpacity: 0.2, baseBrightness: 0.5 }

shot('the textbook well', () => {
  const spoken = say('textbook', 7.7)
  // The lens belongs to the picture we have; the textbook's has none, and its matter lies on the sheet
  set({ orbitCount: 0, gridRide: 1 })
  meanwhile(() => { to({ lensingRadius: 0, cameraZoom: 1, ...WHIRL }, 1.5) })
  at(SHEET + 1.5, () => { set({ lensingEnabled: false }) })
  at(tipAt + 0.3, () => { to({ gridSheet: 0.85 }, 1.8) })
  wait(spoken + 1.3)
})

// The far end of the two axes that lie in the sheet, and the two ends of the third, down the middle of the well
const X_TIP = [3.6, 0, 0]
const Y_TIP = [-1.5, -3.6, 0]
const W_TOP = [0, 0, 0]
const W_TIP = [0, 0, 0.8]

shot('X, Y and W', () => {
  const spoken = say('axes', 8.8)
  const lettersEnd = tDown - 0.3
  const axesEnd = riseAt + RISE + 0.6
  const here = sheetAt(tAxes)
  const letter = (text, color, tip, shift) => {
    const [x, y] = here(...tip)
    cap(text, lettersEnd - now(), { at: { hole: [part(x + shift[0]), part(y + shift[1])] }, size: 0.034, font: 'unbounded', color, fade: 0.4 })
  }
  at(tAxes + heard('axes', 'x', 1.4), () => {
    onSheet(W_TOP, X_TIP, { arrow: 'end', color: X, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    letter('X', X, X_TIP, [0.6, 0])
  })
  at(tAxes + heard('axes', 'y', 2.6), () => {
    onSheet(W_TOP, Y_TIP, { arrow: 'end', color: Y, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    letter('Y', Y, Y_TIP, [-0.6, 0.25])
  })
  at(tAxes + heard('axes', 'y', 2.6) + 1.1, () => {
    const [x, y] = here(1.6, -2.4, 0)
    cap('space', 2.6, { at: { hole: [part(x), part(y + 0.5)] }, size: 0.03, font: 'noto', color: '#c9d4f0' })
  })
  at(tAxes + heard('axes', 'w', 6.6), () => {
    onSheet(W_TOP, W_TIP, { arrow: 'end', color: W, width: 0.016, opacity: 0.22, draw: 0.9, fade: 0.5 }, axesEnd - now())
    onSheet(W_TOP, W_TIP, { arrow: 'end', color: W, width: 0.0065, draw: 0.9, fade: 0.5 }, axesEnd - now())
    const [x, y] = here(0, 0, 0.45)
    cap('*{W}  gravity', lettersEnd - now(), { at: { hole: [part(x - 2.5), part(y)] }, size: 0.034, font: 'unbounded', accent: W, fade: 0.4 })
  })
  wait(spoken + 0.9)
})

shot('taken literally', () => {
  const spoken = say('literally', 5.1)
  // Taken literally, the well is where things go: more of the matter round its mouth goes down it
  meanwhile(() => { to({ gravityStrength: 6, baseBrightness: 0.8 }, spoken) })
  cap('*{W}: not a picture, a direction', spoken + 0.3, { at: [0.5, 0.86], size: 0.036, font: 'unbounded', accent: W, plate: 0.6 })
  wait(spoken + 0.8)
})

shot('down into what?', () => {
  const spoken = say('down', 4.8)
  // The camera goes down the well: the sheet leaves by the top of the frame, and under the hole there is nothing
  at(tDown + heard('down', 'down', 1.9) + 1.2, () => {
    const rest = riseAt - now()
    sketch({ kind: 'line', points: [{ hole: [0, -1.25] }, { hole: [0, -2.9] }], arrow: 'end', color: W, width: 0.0065, dash: true, draw: 0.8, fade: 0.4 }, rest)
    cap('?', rest, { at: { hole: [0.8, -2.4] }, size: 0.07, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(spoken + 1)
})

// ---- the switch: from above ----

shot('rise above the sheet', () => {
  say('rise', 5.1)
  meanwhile(() => { to({ gravityStrength: WHIRL.gravityStrength, baseBrightness: WHIRL.baseBrightness }, 3) })
  wait(tVanished - now())
})

// The line of W the camera finds again: it runs down the wall of the well, and from above it is the line
// between the outer circle and the inner one
const R_OUT = 4
const R_IN = 1.08
const WALL_PIECES = 14
function wall (seconds) {
  // Short pieces near the well, where the sheet turns down
  const radius = index => R_IN + (R_OUT - R_IN) * (1 - index / WALL_PIECES) ** 2
  for (let index = 0; index < WALL_PIECES; index++) {
    const late = index * 0.07
    at(now() + late, () => {
      onSheet([-radius(index), 0], [-radius(index + 1), 0], { color: W, width: 0.0075, fade: 0.25 }, seconds - late)
    })
  }
}

shot('its depth is not gone', () => {
  const spoken = say('vanished', 10.5)
  // "Each ring is one step down": the camera nods to the well and comes back
  at(nodAt + 0.2, () => {
    wall(tCreature - 0.4 - now())
    cap('one ring: one step down *{W}', nodBack - now(), { at: [0.5, 0.86], size: 0.036, font: 'unbounded', accent: W, plate: 0.6 })
  })
  at(nodBack + 1.6, () => {
    cap('from above, the steps crowd *{inward}', tCircle - 0.3 - now(), { at: [0.5, 0.86], size: 0.036, font: 'unbounded', accent: W, plate: 0.6 })
  })
  wait(spoken + 0.9)
})

// The hypercube of clip 1 as a small drawing, for the rhyme: a cube inside a cube, the fourth edges red
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
        sketch({ kind: 'line', points: [place(from.map(value => value * scale)), place(to.map(value => value * scale))], color: [X, Y, Z][way], width: 0.003, draw: 0.8, fade: 0.4 }, seconds)
      }
    }
    sketch({ kind: 'line', points: [place(from), place(from.map(value => value * inner))], color: W, width: 0.0045, draw: 0.8, fade: 0.4 }, seconds)
  }
}

shot('a circle inside a circle', () => {
  const spoken = say('circle', 12.3)
  const end = tCreature - 0.4
  const flat = sheetAt(tCircle)
  // "It simply points inward": with nothing to swing it round, the matter goes straight in along the spokes
  at(tCircle + heard('circle', 'inward', 3.5) - 0.4, () => { to(INFALL, 2) })
  at(tCircle + heard('circle', 'circle', 5.1), () => {
    sketch({ kind: 'circle', center: { hole: [0, 0] }, radius: part(flat(R_OUT, 0)[0]), color: INK, width: 0.004, draw: 0.9, fade: 0.4 }, end - now())
  })
  at(tCircle + heard('circle', 'circle', 5.1) + 0.8, () => {
    sketch({ kind: 'circle', center: { hole: [0, 0] }, radius: part(flat(R_IN, 0)[0]), color: INK, width: 0.004, draw: 0.7, fade: 0.4 }, end - now())
  })
  at(tCircle + heard('circle', 'w', 7.2), () => {
    cap('W', end - now(), { at: { hole: [part(-(flat(R_OUT, 0)[0] + flat(R_IN, 0)[0]) / 2), 0.75] }, size: 0.04, font: 'unbounded', color: W, fade: 0.4 })
  })
  at(tCircle + heard('circle', 'cube', 10.6) - 0.8, () => { hypercube([0.87, 0.5], 0.19, end - now()) })
  wait(spoken + 0.8)
})

// ---- the flat creature ----

shot('a flat creature', () => {
  const spoken = say('creature', 14.6)
  const end = tWe + 0.4
  const creature = '#ffd27a'
  // Where it lives on the sheet, in front of the well and to the right, and how far out; it slides in, and
  // down, when the line says so
  const way = 0.5
  const out = track([[tCreature, 5], [slideAt, 5], [slideAt + 3, 1.02, 'in']])
  const place = at => sheetAt(at)(out(at) * Math.cos(way), out(at) * Math.sin(way))
  meanwhile(() => { to({ ...WHIRL, baseBrightness: 0.5 }, 2) })
  at(tCreature + 1.2, () => {
    const born = now()
    sketch({
      kind: 'circle', center: { hole: ['x', 'y'] }, radius: 0.2, fill: creature, color: creature, fade: 0.5,
      values: { x: s => part(place(born + s)[0]), y: s => part(place(born + s)[1]) }
    }, end - born)
    const [x, y] = place(born)
    cap('a flat creature', lookAt - 0.2 - born, { at: { hole: [part(x + 2), part(y - 0.7)] }, size: 0.028, font: 'unbounded', color: creature })
  })
  // "It cannot look down into the well": we can, so the camera comes down beside it
  at(lookAt + 3.2, () => {
    // A voice that goes on to the next sentence at once leaves this caption no time to be read: it is left out
    if (slideAt - 0.2 - now() > 1.2) cap('what it cannot see', slideAt - 0.2 - now(), { at: [0.5, 0.86], size: 0.034, font: 'unbounded', color: INK, plate: 0.6 })
  })
  // Everything slides the same way, and the matter of the sheet hardest of all
  at(slideAt, () => { to({ gravityStrength: 7, baseBrightness: 0.8 }, 2.6) })
  wait(spoken + 0.9)
})

// ---- the switch: one dimension up ----

// What falls in space: straight in from every side, with a slow drift of the field that brings new matter
const FALLING = { orbitalStrength: 0, gravityInertia: 0.5, gravityStrength: 7, gravityReach: 18, baseSpeed: 0.25, baseBrightness: 1.3, speedGlow: 0.3, trailIntensity: 0.06 }

shot('we are that creature', () => {
  const spoken = say('we', 4.4)
  // The sheet lies flat again and goes, and its matter is let off it
  meanwhile(() => { to({ gridSheet: 0, gravityStrength: 6 }, FLAT) })
  // By now the hole has taken every particle at least once, and each came back at the far end of the field:
  // seen from the side they would be one cloud there. Nearly all of them are let go and made anew, at every
  // depth, while the picture is all but empty
  at(tWe + FLAT, () => { set({ gridRide: 0, numParticles: 500, baseBrightness: 0 }) })
  at(tWe + FLAT + 0.04, () => { set({ numParticles: 30000 }) })
  // It gets its third dimension back: the camera swings off the line of flight and the grid is a lattice
  at(Math.max(tWe + heard('we', 'three', 3) - 1.3, tWe + FLAT + 0.05), () => {
    // The swing of the camera is a cut for the trails: streaked, every particle near the hole would cross the frame
    set({ threeD: true, cameraCutTurn: 0, speedGlowKnee: 0.15, gravityDepth: 18, depthFade: 1, minOpacity: 0.02, particleSize: 3, particleSizeMin: 0.3 })
    // In space nothing swings the matter round: it falls toward the hole from every side, along the lines
    // the lattice is about to be drawn in by
    to({ cameraYaw: 30, cameraPitch: 16, gridLattice: 1, ...FALLING }, 2.8)
    at(now() + 0.2, () => { set({ cameraCutTurn: 0.35 }) })
  })
  wait(Math.max(spoken + 0.9, FLAT + 3))
})

shot('falls into a fourth', () => {
  const start = now()
  const spoken = say('falls', 4.2)
  at(start + heard('falls', 'falls', 1.6) - 0.2, () => { to({ gridLatticeWarp: 10 }, 3.4) })
  meanwhile(() => { to({ cameraYaw: 52 }, spoken + 1.4) })
  at(start + heard('falls', 'falls', 1.6) + 0.9, () => {
    cap('*{W}  the fourth dimension', spoken + 1.2 - heard('falls', 'falls', 1.6) - 0.9, { at: [0.5, 0.84], size: 0.04, font: 'unbounded', accent: W })
  })
  wait(spoken + 1.4)
})

shot('inward, everywhere', () => {
  const start = now()
  const spoken = say('everywhere', 10.5)
  set({ lensingEnabled: true })
  meanwhile(() => { to({ lensingRadius: 1.7 }, 2) })
  meanwhile(() => { to({ cameraYaw: 128, cameraPitch: 26, cameraMoveIn: 3.5 }, spoken + 1) })
  at(start + heard('everywhere', 'inward', 4.4), () => {
    cap('it points *{inward}', 2.2, { at: [0.5, 0.84], size: 0.05, font: 'unbounded', accent: W })
  })
  at(start + heard('everywhere', 'star', 6.2), () => {
    cap('toward every star\ntoward every planet\ntoward the ground beneath your feet', start + spoken + 0.8 - now(), {
      at: [0.5, 0.8], size: 0.034, font: 'noto', color: INK, plate: 0.7, reveal: 'lines', revealOver: heard('everywhere', 'ground', 8.9) - heard('everywhere', 'star', 6.2) + 0.3
    })
  })
  wait(spoken + 1)
})

shot('weight', () => {
  const start = now()
  const spoken = say('weight', 4.6)
  // Nothing is fired here: a hole at rest sends out no wave. The matter falls harder, and the camera falls
  // with it
  meanwhile(() => { to({ gravityStrength: 11, baseBrightness: 1.8 }, 2.2) })
  meanwhile(() => { to({ cameraMoveIn: 6.5, cameraYaw: 150 }, spoken + 2.4, 'in') })
  at(start + heard('weight', 'weight', 3.9) - 0.2, () => {
    cap('you call it *{weight}', spoken + 2.2 - heard('weight', 'weight', 3.9), { at: [0.5, 0.84], size: 0.055, font: 'unbounded', accent: W })
  })
  wait(spoken + 2.4)
})
