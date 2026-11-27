// The fourth dimension as popular science, clip 10 of films/fourth_dimension_pop.json: what else W would explain, each said as a reading beside the known physics it reads: a body stretched thin falling into a hole, space growing between galaxies, galaxies spinning too fast for what we see.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_10_more.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input, hide */
const LINES = {
  others: 'If W is real, a few other puzzles would read differently.',
  noodle: 'Fall into a black hole feet first, and your feet are pulled harder than your head. You are stretched thin. Physicists call it spaghettification.',
  noodlew: 'Here that stretch would be the well itself, pulling you along W.',
  grows: 'The space between galaxies is growing. Cosmology needs nothing for it to grow into.',
  growsw: 'This picture would give it somewhere: the sheet stretching along W.',
  missing: 'Galaxies spin as if they held about five times more matter than we can see.',
  missingw: 'Perhaps some of that missing mass sits along W, where we cannot look.',
  reading: 'Each of these is a reading, not a result. None of them has been tested.'
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

// Three puzzles, each in two lines: the known physics under KNOWN PHYSICS in gold, then the hypothesis's reading
// of it under HYPOTHESIS, W in red; the reading never offered as support for what general relativity or
// cosmology already explain. Each has a picture of its own, and the clip goes through black between them

// ---- the first picture: the well, and a body falling into it feet first ----
// Chapter 09's sheet seen from the side, the hole at the bottom of its well, matter winding in on it: flow A
// laid on the sheet, dimmer than chapter 09's so the falling body reads over it
const GRID = '#4de3ff'
const TILT = 66
const DEPTH = 5
const HOLE_Y = 0.68
const WHIRL = 0.7
film({
  fps: 60,
  seed: 10,
  warmup: 0,
  settings: {
    fieldEnabled: false,
    lensingEnabled: false,
    // Stars on black, no nebula: its violet and pink read as stock space
    starsBrightness: 1.6,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: GRID,
    gridSheet: 0.85,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridDepth: DEPTH,
    gridRings: 40,
    gridCell: 4,
    gridTilt: TILT,
    gridRide: 1,
    blackHoleSize: 8,
    blackHoleY: HOLE_Y,
    // Chapter 09's whirl at the same framing (its count swept there: 5000 read as matter winding in with the
    // grid through it), dimmed to WHIRL
    flowA: WHIRL,
    flowACount: 5000,
    flowAFrom: 7,
    flowATo: 0.8,
    flowASpread: 4,
    flowASwirl: 0.7,
    flowALife: 8,
    flowATrail: 0.6,
    flowASize: 1.2,
    flowAColor: '#aeeeff'
  }
})
chapter('10', 'WHAT ELSE WOULD IT EXPLAIN?')

// Where a point of the sheet stands on the screen, from the hole in hole radii (the sums of
// films/fourth_dimension_well.js). `level` takes the point off the surface to a share of the well's depth:
// 0 the flat sheet, 1 the bottom, past 1 below it
const LONG = 1920
const SHORT = 1080
const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
function laySheet (tilt, radii, holeY, size = 8) {
  const SHADOW = size / 100 * SHORT
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
const part = value => +value.toFixed(4)
const onScreen = ([x, y]) => ({ hole: [part(x), part(y)] })
const onSheet = (radius, degrees) => {
  const turn = degrees * Math.PI / 180
  return { sheet: [part(radius * Math.cos(turn)), part(radius * Math.sin(turn))] }
}
const side = laySheet(TILT, DEPTH, HOLE_Y)
// Goes through black to the next picture: the shapes of the last one end before it
const dip = change => {
  to({ fade: 1 }, 0.5)
  change()
  wait(0.3)
  to({ fade: 0 }, 0.7)
}
// The three puzzles, named as the chapter opens and again at its end
const PUZZLES = ['a body stretched thin', 'space growing', 'mass we cannot see']
const listAt = row => [0.07, part(0.3 + row * 0.08)]

shot('others', () => {
  const start = now()
  const spoken = say('others')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.4)
  // W, the well's depth, down its middle
  at(start + 0.2, () => {
    draw({ kind: 'line', points: [onScreen(side(0, 0, 0.05)), onScreen(side(0, 0, 0.85))], arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: onScreen(side(0.6, 0, 0.45)), size: 0.05, font: 'unbounded', color: W, fade: 0.4 })
  })
  // "a few other puzzles": named down the left, one after another
  PUZZLES.forEach((text, row) => {
    at(start + heard('others', 'puzzles', 0.6) + row * 0.35, () => {
      caption(text, end - now(), { at: listAt(row), anchor: 'left', size: 0.032, font: 'unbounded', color: SOFT, fade: 0.4 })
    })
  })
  wait(spoken + 0.6)
})

// The body falls in from rest along the left wall, feet first, every point of it on its own radial free fall
// (Newton's: r = r0 cos^2 e, t = k r0^1.5 (e + sin e cos e)), so the feet, nearer the hole, pull ahead of the
// head and the body stretches, more and more as it nears the hole: the tide. Its feet start 5 radii out and its
// head 5.6; laid on the sheet it slides down the wall, where the same stretch along the radius is a longer
// stretch along the surface. FALL physical seconds bring the feet to the shadow's edge; from SLOW on the film
// runs the fall at a third of its pace (marked on the frame), so the stretched body is seen through the next
// line. It thins as it lengthens
const FEET = 5
const HEAD = 5.6
const BODY = 7
const FALL = 6
const SLOW = 4.4
const SLOWED = 0.3
const PATH = 172
const timeTo = (from, radius, k) => {
  const e = Math.acos(Math.sqrt(Math.min(radius / from, 1)))
  return k * from ** 1.5 * (e + Math.sin(e) * Math.cos(e))
}
const K = FALL / timeTo(FEET, 1, 1)
const radiusAt = (from, t) => {
  const goal = t / (K * from ** 1.5)
  if (goal >= Math.PI / 2) return 0
  let low = 0
  let high = Math.PI / 2
  for (let round = 0; round < 40; round++) {
    const middle = (low + high) / 2
    if (middle + Math.sin(middle) * Math.cos(middle) < goal) low = middle
    else high = middle
  }
  return from * Math.cos((low + high) / 2) ** 2
}
// The fall's own seconds at a second of the film after it began
const fallTime = s => s < SLOW ? s : SLOW + (s - SLOW) * SLOWED
// Length along the surface from one radius of the well to another, in hole radii
const surface = (from, to) => {
  let length = 0
  const steps = 200
  for (let index = 0; index < steps; index++) {
    const a = from + (to - from) * index / steps
    const b = from + (to - from) * (index + 1) / steps
    length += Math.hypot(b - a, DEPTH * (dent(b, 1) - dent(a, 1)))
  }
  return length
}
let released = 0
let falls = 0

shot('noodle', () => {
  const start = now()
  const spoken = say('noodle')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  released = start + heard('noodle', 'Fall', 0.03) + 0.3
  // The body lives through this line and the next, and ends in the hole
  falls = end + long('noodlew') + 0.6 - released
  const rate = 30
  const steps = Math.ceil(falls * rate)
  const values = {}
  const keyed = name => { values[name] = values[name] ?? []; return values[name] }
  const firstLength = surface(FEET, HEAD)
  for (let step = 0; step <= steps; step++) {
    const s = falls * step / steps
    const second = +(released + s).toFixed(3)
    const radii = []
    for (let index = 0; index < BODY; index++) {
      const from = FEET + (HEAD - FEET) * index / (BODY - 1)
      radii.push(Math.max(radiusAt(from, fallTime(s)), 1))
    }
    radii.forEach((radius, index) => {
      const turn = PATH * Math.PI / 180
      keyed('x' + index).push([second, part(radius * Math.cos(turn)), 'linear'])
      keyed('y' + index).push([second, part(radius * Math.sin(turn)), 'linear'])
    })
    const stretch = surface(radii[0], radii[BODY - 1]) / firstLength
    // A width cannot follow a value: the body is a thick stroke over a thin one, the thick one fading as the
    // stretch grows, so it is a blob at first and a thread by the end
    keyed('thick').push([second, part(1 / Math.max(stretch, 1) ** 2), 'linear'])
    // The pull on the feet and on the head, beside the body: as long as the pull, 1 / r^2
    const pull = radius => 18 / (radius * radius)
    for (const [name, radius] of [['f', radii[0]], ['h', radii[BODY - 1]]]) {
      const turn = (PATH + 7) * Math.PI / 180
      const tip = Math.max(radius - pull(radius), 1)
      keyed(name + 'x').push([second, part(radius * Math.cos(turn)), 'linear'])
      keyed(name + 'y').push([second, part(radius * Math.sin(turn)), 'linear'])
      keyed(name + 'tx').push([second, part(tip * Math.cos(turn)), 'linear'])
      keyed(name + 'ty').push([second, part(tip * Math.sin(turn)), 'linear'])
    }
  }
  const points = Array.from({ length: BODY }, (_, index) => ({ sheet: ['x' + index, 'y' + index] }))
  at(released, () => {
    draw({ kind: 'line', points, smooth: true, color: '#fff1d6', width: 0.005, glow: 0.01, fade: 0.4, values }, falls)
    draw({ kind: 'line', points, smooth: true, color: '#fff1d6', width: 0.018, opacity: 'thick', fade: 0.4, values }, falls)
  })
  // "your feet are pulled harder than your head": the two pulls in gold, the feet's the longer
  const pulled = start + heard('noodle', 'feet', 0.27)
  const stretched = start + heard('noodle', 'stretched', 0.62)
  at(pulled, () => {
    for (const name of ['f', 'h']) {
      draw({ kind: 'line', points: [{ sheet: [name + 'x', name + 'y'] }, { sheet: [name + 'tx', name + 'ty'] }], arrow: 'end', color: GOLD, width: 0.004, draw: 0.4, fade: 0.4, values }, stretched + 1.2 - now())
    }
    caption('feet pulled harder than the head', stretched - now(), { at: [0.5, 0.1], size: 0.034, font: 'unbounded', color: GOLD, fade: 0.4 })
  })
  at(released + SLOW, () => {
    caption('slowed to a third', released + falls - now(), { at: [0.93, 0.94], anchor: 'right', size: 0.022, font: 'unbounded', color: SOFT, fade: 0.4 })
  })
  at(stretched, () => {
    keep('Stretched thin: *{spaghettification}.', end - now(), { accent: GOLD })
  })
  wait(spoken + 0.6)
})

shot('noodlew', () => {
  const start = now()
  const spoken = say('noodlew')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.4)
  // "the well itself, pulling you along W": W down the wall beside the stretched body, into the throat
  at(start + heard('noodlew', 'well', 0.4) - 0.3, () => {
    const down = []
    for (let step = 0; step <= 10; step++) down.push(onSheet(4.2 - 3.05 * step / 10, PATH - 9))
    draw({ kind: 'line', points: down, smooth: true, arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: onScreen(side(-2.6, 0.9)), size: 0.05, font: 'unbounded', color: W, fade: 0.4, plate: 0.4 })
  })
  at(start + heard('noodlew', 'well', 0.4), () => {
    keep('The stretch would be the well, pulling along *{W}.', end - now())
  })
  wait(spoken + 0.6)
})

// ---- the second picture: space growing between galaxies ----
// The sheet flat, square cells and no well, seen from the side, nothing on it but galaxies. The hole stays
// (hidden, it would take every place laid at it or on the sheet to its middle) but shrinks to a speck under the
// middle galaxy, and its well is flattened; the places below are given in radii of the hole as it was (size 8)
// and scaled by SCALE to the speck's. Space grows: the cells widen (Grid Spacing GROW times over the two lines) and
// the galaxies on the sheet move apart with them, each keeping its own size, as bound galaxies do. A galaxy is a
// small lit oval lying on the sheet, pale blue-white or warm, no violet
const FLAT_TILT = 62
const CELL = 3
const GROW = 1.7
// Places on the sheet, in hole radii from the middle, before the growth
const GALAXIES = [[0, 0], [-4.6, 2.2], [-2.1, -1.4], [-0.6, 3.6], [1.4, 0.8], [3.3, -1.8], [4.9, 2.9], [-3.9, -3.4], [2.6, 4.6], [0.3, -3.6], [-5.4, 0.2], [5.6, -0.5]]
const PAIR = [2, 4]
const SPECK = 1
const SCALE = 8 / SPECK

const grow = []
dip(() => {
  set({ flowA: 0, gridRings: 0, gridDepth: 0, gridTilt: FLAT_TILT, blackHoleY: 0.5, blackHoleSize: SPECK, gridCell: CELL, gridSheet: 0.6, gridSpan: 1.6, gridFade: 0.4 })
  hide('ring')
})

shot('grows', () => {
  const start = now()
  const spoken = say('grows')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  const over = end + long('growsw') + 0.6 - start
  // How many times wider space is, the same share for the cells and the galaxies' places
  grow.push([start, 1], [start + over, GROW, 'linear'])
  meanwhile(() => { to({ gridCell: CELL * GROW }, over, 'linear') })
  // A place of the sheet carried out by the growth
  const grown = (x, y) => ({
    gx: grow.map(([second, share, ease]) => ease ? [second, part(x * SCALE * share), ease] : [second, part(x * SCALE * share)]),
    gy: grow.map(([second, share, ease]) => ease ? [second, part(y * SCALE * share), ease] : [second, part(y * SCALE * share)])
  })
  const shrink = Math.cos(FLAT_TILT * Math.PI / 180)
  GALAXIES.forEach(([x, y], index) => {
    const warm = index % 3 === 1
    const placed = { sheet: ['gx', 'gy'] }
    const values = grown(x, y)
    draw({ kind: 'circle', center: placed, radius: part(0.42 * SCALE), radiusY: part(0.42 * SCALE * shrink), turn: (index * 37) % 50 - 25, fill: warm ? '#ffe3b8' : '#dce8ff', fillTo: '#0b1020', fillAt: [0, 0], color: warm ? '#ffe3b8' : '#dce8ff', width: 0, glow: 0.012, fade: 0.5, values }, over)
  })
  // Two of them with the way between them, its length as space grows; gone before the next line's drawing
  at(start + heard('grows', 'between', 0.25), () => {
    const [ax, ay] = GALAXIES[PAIR[0]]
    const [bx, by] = GALAXIES[PAIR[1]]
    const from = grown(ax, ay)
    const to = grown(bx, by)
    draw({ kind: 'line', points: [{ sheet: ['ax', 'ay'] }, { sheet: ['bx', 'by'] }], color: GOLD, width: 0.0025, dash: true, draw: 0.5, fade: 0.4, values: { ax: from.gx, ay: from.gy, bx: to.gx, by: to.gy } }, end - now())
    const middle = grown((ax + bx) / 2, (ay + by) / 2 + 0.9)
    caption('×#{a:2}', end - now(), { at: { sheet: ['gx', 'gy'] }, size: 0.03, font: 'unbounded', color: GOLD, fade: 0.4, values: { a: grow, ...middle } })
  })
  at(start + heard('grows', 'nothing', 0.68) - 0.3, () => {
    keep('Space grows, with *{nothing} to grow into.', end - now(), { accent: GOLD })
  })
  wait(spoken + 0.6)
})

// The flat sheet as one slice of something that grows along W: the same patch of it drawn where it would be
// later, further along W and wider, the corners joined, W down the middle. The sums of the sheet laid flat
// (no well): a point of the plane lifted `level` hole radii down along W
const flat = laySheet(FLAT_TILT, 0, 0.5, SPECK)
const flatAt = (x, y, down) => {
  const [sx, sy] = flat(x * SCALE, y * SCALE, 0)
  // Down along W: the flat camera sees it as the depth of a well, sin of the tilt of it straight down the frame
  return [sx, sy - down * SCALE * Math.sin(FLAT_TILT * Math.PI / 180)]
}

shot('growsw', () => {
  const start = now()
  const spoken = say('growsw')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.4)
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const PATCH = 1.8
  const slices = [[0, 1], [1.1, 1.22], [2.2, 1.44]]
  at(start + heard('growsw', 'somewhere', 0.3) - 0.3, () => {
    slices.forEach(([down, wide], index) => {
      at(now() + index * 0.5, () => {
        const points = corners.map(([x, y]) => onScreen(flatAt(x * PATCH * wide, y * PATCH * wide, down)))
        draw({ kind: 'line', points, close: true, color: index ? W : INK, width: index ? 0.0025 : 0.003, ...(index ? { dash: true } : {}), draw: 0.5, fade: 0.4 }, end - now())
      })
    })
    for (const [x, y] of corners) {
      const [last, wide] = slices[slices.length - 1].slice(0, 2)
      draw({ kind: 'line', points: [onScreen(flatAt(x * PATCH, y * PATCH, 0)), onScreen(flatAt(x * PATCH * wide, y * PATCH * wide, last))], color: W, width: 0.0016, opacity: 0.6, draw: 1, fade: 0.4 }, end - now())
    }
  })
  at(start + heard('growsw', 'stretching', 0.62) - 0.2, () => {
    draw({ kind: 'line', points: [onScreen(flatAt(0, 0, 0.2)), onScreen(flatAt(0, 0, 2.4))], arrow: 'end', color: W, width: 0.006, draw: 0.5, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: onScreen(flatAt(0.8, 0, 1.6)), size: 0.05, font: 'unbounded', color: W, fade: 0.4, plate: 0.4 })
    keep('The sheet would grow *{along W}.', end - now())
  })
  wait(spoken + 0.6)
})

// ---- the third picture: a galaxy spinning too fast for what we see ----
// A galaxy's disc lying on a sheet dented by it, seen from the side: flow A laid on the sheet, a wide band on
// circles (From = To) turning at one speed at every radius (Turn Falloff 1, a flat rotation curve), as galaxies
// are measured to turn; Kepler's 1.5 would have its outer part crawl. The hole stays hidden under a lit core.
// Flow A Count swept at this framing a second a step, 2500 / 4000 / 6000 / 9000: 2500 reads as streaks turning
// round the well with the sheet between them, from 4000 the disc is a solid carpet like a record
// Seen nearly from the side, so a mass under the sheet hangs clear below the disc: at 64 degrees it projected
// onto the disc's near edge and read as lying on it
const DISC_TILT = 76
const DISC_Y = 0.5
// The hole a speck at the galaxy's middle (at size 8 its shadow peeked out above the core), its well widened
// as many times as it shrank (Well Width), so the dish is as wide as the size-8 well; the lengths below are in
// radii of size 8, times GROWN for the speck's
const DISC_SIZE = 3
const GROWN = 8 / DISC_SIZE
// A galaxy dents the sheet into a shallow dish, not a black hole's throat: at depth 3 (size-8 radii) the throat
// hung under the disc and its core sat at the bottom like a ball below the galaxy (the operator's note)
const DISC_DEPTH = 1.2
const disc = laySheet(DISC_TILT, DISC_DEPTH * GROWN, DISC_Y, DISC_SIZE)
dip(() => {
  set({
    blackHoleSize: DISC_SIZE,
    gridWellWidth: GROWN,
    gridCell: 4,
    gridRings: 40,
    gridDepth: +(DISC_DEPTH * GROWN).toFixed(3),
    gridTilt: DISC_TILT,
    blackHoleY: DISC_Y,
    gridSheet: 0.55,
    gridSpan: 0.8,
    gridFade: 0.35,
    flowA: 1.6,
    flowACount: 2500,
    flowAFrom: +(4.3 * GROWN).toFixed(3),
    flowATo: +(4.3 * GROWN).toFixed(3),
    flowASpread: +(5.4 * GROWN).toFixed(3),
    // turns a second at one radius: the same speed on the frame as 0.9 at size 8 (the rate falls as 1 / r)
    flowASwirl: +(0.9 * GROWN).toFixed(3),
    flowAFalloff: 1,
    flowALife: 20,
    flowATrail: 0.5,
    flowASize: 1.2,
    flowAColor: '#d6e4ff'
  })
})

shot('missing', () => {
  const start = now()
  const spoken = say('missing')
  const end = start + spoken + 0.6
  const lasts = end + long('missingw') + 0.6 + long('reading') + 0.6 - start
  status('known', spoken + 0.4)
  // The galaxy's core: a soft glow flattened into the disc's plane, wider than the hole's shadow it covers, with
  // no hard edge, so it reads as light and not as a ball
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: part(1.6 * GROWN), radiusY: part(0.5 * GROWN), fill: '#fff3dc', fillTo: '#1a1408', fillAt: [0, 0], color: '#fff3dc', width: 0, glow: 0.06, fade: 0.6 }, lasts)
  // The speed of the disc at each distance: what the matter we see would give (it falls off past the bright
  // middle, as round a mass that is all inside) against what is measured (flat)
  at(start + heard('missing', 'spin', 0.15), () => {
    // The matter we see as a core of radius CORE: its speed sqrt(M(r) / r), M(r) ~ r^2 / (r^2 + CORE^2) (at its
    // fullest at the core's edge, then falling as 1 / sqrt(r)); the measured speed rises with it and stays there
    const CORE = 1.8
    const speedSeen = r => 1.1 * Math.sqrt(2 * CORE * r / (r * r + CORE * CORE))
    const seen = []
    const measured = []
    for (let step = 0; step <= 40; step++) {
      const r = 0.25 + step * 0.25
      seen.push([part(r), part(speedSeen(r))])
      measured.push([part(r), part(r < CORE ? speedSeen(r) : speedSeen(CORE))])
    }
    draw({ kind: 'plot', box: [0.64, 0.08, 0.3, 0.26], x: [0, 10], y: [0, 1.3], series: [{ points: seen, color: SOFT }, { points: measured, color: GOLD }], xLabel: 'distance from the centre', yLabel: 'speed', labelSize: 0.022, plate: 0.6, fade: 0.4 }, lasts - (now() - start))
    caption('measured', lasts - (now() - start), { at: [0.86, 0.1], size: 0.022, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('from what we see', lasts - (now() - start), { at: [0.85, 0.245], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.4 })
  })
  at(start + heard('missing', 'five', 0.62) - 0.2, () => {
    keep('As if they held *{about five times} the matter we see.', end - now(), { accent: GOLD })
  })
  wait(spoken + 0.6)
})

shot('missingw', () => {
  const start = now()
  const spoken = say('missingw')
  const end = start + spoken + 0.6
  const lasts = end + long('reading') + 0.6 - start
  status('idea', spoken + 0.4)
  // A faint mass under the well, off the sheet, along W: dashed, since nobody has seen it
  // under the hole on the frame, clear of the disc's near edge, whatever the dish's depth
  const below = [disc(0, 0, 1)[0], disc(0, 0, 1)[1] - 2.8 * GROWN]
  const MASS = 0.8 * GROWN
  at(start + heard('missingw', 'mass', 0.4) - 0.2, () => {
    draw({ kind: 'circle', center: onScreen(below), radius: MASS, fill: W, fillOpacity: 0.14, color: W, width: 0.0022, dash: true, glow: 0.02, draw: 0.8, fade: 0.6 }, lasts - (now() - start))
    draw({ kind: 'line', points: [onScreen([below[0], below[1] + 2.4 * GROWN]), onScreen([below[0], below[1] + MASS + 0.08 * GROWN])], arrow: 'end', color: W, width: 0.005, draw: 0.5, fade: 0.4 }, lasts - (now() - start))
    caption('W', lasts - (now() - start), { at: onScreen([below[0] + 1.6 * GROWN, below[1] + 1.4 * GROWN]), size: 0.05, font: 'unbounded', color: W, fade: 0.4 })
  })
  at(start + heard('missingw', 'look', 0.85) - 0.6, () => {
    keep('Some of the missing mass along *{W}, out of sight?', end - now())
  })
  wait(spoken + 0.6)
})

shot('reading', () => {
  const start = now()
  const spoken = say('reading')
  const end = start + spoken + 1.2
  status('open', spoken + 0.4)
  // The three again, each a reading, none tested
  PUZZLES.forEach((text, row) => {
    at(start + heard('reading', 'reading', 0.3) + row * 0.3, () => {
      caption(`${text}: *{a reading}`, end - now(), { at: listAt(row), anchor: 'left', size: 0.03, font: 'unbounded', color: SOFT, accent: W, plate: 0.5, fade: 0.4 })
    })
  })
  at(start + heard('reading', 'tested', 0.85) - 0.6, () => {
    keep('Readings, not results. None of them tested.', end - now(), { accent: INK })
  })
  wait(spoken + 1.2)
})

leave()
