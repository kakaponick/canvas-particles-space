// The fourth dimension as popular science, clip 11 of films/fourth_dimension_pop/fourth_dimension_pop.json: the test: a light clock, two mirrors with light between them, counted against an atomic clock deep in Earth's well and higher up.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop/clips/11_test.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  fail: 'A nice story is not science until it can fail. So how could this one fail?',
  clock: 'Gravity slows time. In twenty twenty-two, physicists measured that with atomic clocks, across a single millimetre of height.',
  ruler: 'The hypothesis adds something. If matter deep in a well is squeezed along W, our rulers are squeezed too. So we need a ruler we can trust.',
  mirrors: 'Nothing exotic. Two mirrors on a solid block, a few centimetres apart, with light bouncing between them. Labs already build these to keep the best clocks on Earth steady. It is a ruler that light can read.',
  count: 'Count the round trips in one second of an atomic clock, here, deep in the well of the Earth. Then count again on a satellite, high up, where the well is shallower.',
  verdict: 'Einstein says: the same count, up and down. The hypothesis says: up there the block is less squeezed, so a few fewer round trips. One number, and two different predictions for it.'
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

// ---- this chapter's own drawing ----

const COLD = '#aeeeff'
const GRID = '#4de3ff'
const part = value => +value.toFixed(4)
const sketch = (shape, seconds) => { if (seconds > 0.15) draw(shape, seconds) }
const cap = (text, seconds, options) => { if (seconds > 0.15) caption(text, seconds, options) }

// A light clock, the kind labs build to keep the best clocks steady: two mirrors on a solid block, a few
// centimetres apart, and light bouncing between them. It is drawn large on the frame, as an inset beside the
// place it stands for: `inset(x, y)` gives the clock's points around [x, y] in shares of the frame, in clock units
// of INSET of the frame's short side, x to the right and y up. Its light makes one crossing every 0.28 s, slowed a
// billion times so it can be seen
const MIRROR = '#e6eeff'
const BLOCK = '#141d36'
const CLOCK = { gap: 2.2, high: 0.9 }
const INSET = 0.12
const inset = (x, y) => (dx, dy) => [part(x + dx * INSET * 9 / 16), part(y - dy * INSET)]
function clockBody (at, seconds) {
  const half = CLOCK.gap / 2
  const low = -CLOCK.high - 0.18
  // The block that holds the mirrors apart: its length is matter, and it is what the hypothesis squeezes
  sketch({ kind: 'line', points: [at(-half - 0.25, low), at(half + 0.25, low), at(half + 0.25, low - 0.45), at(-half - 0.25, low - 0.45)], close: true, color: SOFT, width: 0.0018, fill: BLOCK, fillOpacity: 0.92, fade: 0.3 }, seconds)
  for (const side of [-1, 1]) {
    sketch({ kind: 'line', points: [at(side * half, low), at(side * half, CLOCK.high)], color: MIRROR, width: 0.008, fade: 0.3 }, seconds)
  }
  // The beam's path, faint, for the light to run along
  sketch({ kind: 'line', points: [at(-half, 0), at(half, 0)], color: GOLD, width: 0.0016, opacity: 0.25, fade: 0.3 }, seconds)
}
// The gap measured above the mirrors, with its length
function clockGap (at, seconds) {
  const half = CLOCK.gap / 2
  sketch({ kind: 'line', points: [at(-half, CLOCK.high + 0.3), at(half, CLOCK.high + 0.3)], arrow: 'both', color: SOFT, width: 0.0016, fade: 0.3 }, seconds)
  cap('5 cm', seconds, { at: at(0, CLOCK.high + 0.62), size: 0.026, font: 'unbounded', color: SOFT, fade: 0.3 })
}
// A dashed lead from the clock's block (at `from`, in clock units) to the place on the scene it stands at, with a
// dot of `dot` there in that place's unit
function clockLead (at, from, place, dot, seconds) {
  sketch({ kind: 'line', points: [at(...from), place], color: GOLD, width: 0.0024, dash: [0.008, 0.005], draw: 0.6, fade: 0.3 }, seconds)
  sketch({ kind: 'circle', center: place, radius: dot, fill: GOLD, color: GOLD, width: 0, fade: 0.3 }, seconds)
}
// Its light, crossing from mirror to mirror every `cross` seconds for `seconds`, with a short trail behind it
function clockLight (at, seconds, cross = 0.28) {
  const born = now()
  const half = CLOCK.gap / 2
  const keys = [[part(born), 0]]
  for (let crossing = 1; crossing * cross <= seconds; crossing++) keys.push([part(born + crossing * cross), crossing % 2, 'linear'])
  const light = { between: [at(-half + 0.08, 0), at(half - 0.08, 0)], share: 'p' }
  sketch({ kind: 'circle', center: light, radius: part(0.3 * INSET), fill: GOLD, color: GOLD, width: 0, fillOpacity: 0.3, opacity: 0.8, fade: 0.2, values: { p: keys } }, seconds)
  sketch({ kind: 'circle', center: light, radius: part(0.1 * INSET), fill: '#fffbe8', color: GOLD, width: 0.001, fade: 0.2, values: { p: keys } }, seconds)
}
// Round trips of light in one second of an atomic clock, between mirrors 5 cm apart: c / 10 cm, in billions
const ROUND_TRIPS = 299792458 / 0.1 / 1e9
// The counter under a clock, counting up to the round trips of one second over `run` seconds
const counter = (at, seconds, run, ask = false) => {
  const born = now()
  cap(`*{#{n:3}} billion${ask ? '  ?' : ''}`, seconds, { at: at(0, -CLOCK.high - 1.05), size: 0.032, font: 'geistMono', color: INK, accent: GOLD, fade: 0.3, values: { n: [[born, 0], [born + run, ROUND_TRIPS, 'out']] } })
}

// The clip's whole length, for what stays on through all of it
const SHOTS = ['fail', 'clock', 'ruler', 'mirrors', 'count', 'verdict']
// Seconds the ruler shot holds after its line, for the ruler to lie on the sheet a while, then be laid straight and read
const RULER_HOLD = 3.2
// and the count shot, for the clock higher up to finish its count before the verdict
const COUNT_HOLD = 1.8
const END = CARD + SHOTS.reduce((sum, name) => sum + long(name) + 0.6, 0) + RULER_HOLD + COUNT_HOLD + LEAVE

film({
  fps: 60,
  seed: 10,
  warmup: 10,
  settings: {
    // The Earth at the left with its well, and room on the flat of the sheet at the right
    blackHoleSize: 4,
    blackHoleX: 0.22,
    blackHoleY: 0.64,
    gridDepth: 3,
    gridSpan: 2,
    gridRings: 72,
    particleSize: 1.8,
    particleSizeMin: 1.8,
    numParticles: 10000,
    lensingEnabled: false,
    ringEnabled: false,
    // Space falling gently into the Earth's well along every spoke
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
    // Stars on black, no nebula: its violet and pink read as stock space, and its dust muddied the frame
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridColor: GRID,
    gridSheet: 0.8,
    // The sheet in the scene, seen by the 3D camera from above the well's mouth, so that it can fly down to it
    threeD: true,
    threeDEase: 0,
    cameraYaw: 0,
    cameraPitch: -62,
    // In 3D the field's gravity ends at a sphere and the warm-up drains it, so the space falling into the
    // Earth's well down every spoke is a flow laid on the sheet, in the field's colour
    flowA: 1.6,
    flowACount: 9000,
    flowAFrom: 8,
    flowATo: 1,
    flowASpread: 6,
    flowALife: 8,
    flowASwirl: 0.1,
    flowATrail: 0.6,
    flowASize: 1.2,
    flowAColor: COLD,
    gridSpokes: 24,
    gridRide: 1,
    // The whole column lies on the sheet: at the default Ride Edge the matter the well gathers from every
    // depth hung part of the way between where it flies and the surface, a cloud under the Earth
    gridRideSoft: 0.01,
    // and the slab reaches the whole column: Ride Depth is in hole radii, and this hole is half the default
    // size, so at the default slab half the column flew free round the Earth, a cloud in front of the well
    gridRideDepth: 400,
    // The Earth's well is a billionth of a black hole's: no redshift to see near it
    gravityRedshift: 0,
    // nor a glow of slowed time at its throat, nor light of its own on the sheet: the Earth shines by the Sun
    gridThroatGlow: 0,
    gridLight: 0,
    fieldAtHole: 1,
    gridFade: 0.3
  }
})
set({ letterbox: 0, filmGrain: 0 })
chapter('11', 'HOW TO PROVE IT WRONG')

// The Earth, NASA's Apollo 17 photograph, stands over the hole for the whole clip. The hole is the scene's
// way of giving the Earth a well and a pull, and is never to be seen as one: the photograph comes up with
// the picture as the chapter's card leaves, covering the shadow from the card's last second on, and is
// drawn a little wider than elsewhere, since the camera that flies down to the well sees the shadow's
// edge round the photograph's at the default width
at(CARD - CARD_FADE, () => {
  // its light keyed to the picture's own fade in and out, so the hole under it never shows through
  draw({ kind: 'image', src: 'films/fourth_dimension/earth.png', center: { hole: [0, 0] }, width: 2.9, opacity: 'lit', fade: 0, values: { lit: [[CARD - CARD_FADE, 0], [CARD, 1], [END - LEAVE, 1], [END, 0]] } }, END - now())
})

shot('fail', () => {
  const start = now()
  const spoken = say('fail')
  // The space falls into the well: what a claim says moves
  at(start + heard('fail', 'fail', 0.55) - 0.3, () => {
    caption('a claim that can *{fail}', spoken + 0.6 - (now() - start), { at: [0.6, 0.3], size: 0.05, font: 'unbounded', color: INK, accent: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('clock', () => {
  const start = now()
  const spoken = say('clock')
  const life = spoken + 0.6
  status('known', spoken)
  // The space falls faster for a moment: gravity, the thing that slows time
  at(start, () => { to({ gravityStrength: 5 }, 1.5) })
  // Two clocks, one a millimetre above the other: the upper counts a little faster
  at(start + heard('clock', 'time', 0.12), () => {
    const rest = life - (now() - start)
    const born = now()
    for (const [y, rate, name] of [[0.34, 1, 'higher'], [0.48, 0.96, 'lower']]) {
      sketch({ kind: 'circle', center: [0.62, y], radius: 0.05, color: INK, width: 0.003, fill: '#101a33', opacity: 0.9, fade: 0.3 }, rest)
      cap('#{n:0}', rest, { at: [0.62, y], size: 0.03, font: 'geistMono', color: INK, fade: 0.3, values: { n: [[born, 0], [born + rest, 1000 * rate * rest, 'linear']] } })
      cap(name, rest, { at: [0.73, y], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.3 })
    }
    sketch({ kind: 'line', points: [[0.55, 0.34], [0.55, 0.48]], arrow: 'both', color: SOFT, width: 0.002, fade: 0.3, draw: 0.5 }, rest)
    // The clocks' gap is 4 %; over a millimetre nature's is g h / c^2, about 1e-19, so the drawing owns its
    // stretch: 0.04 / 1.1e-19 is about 4e17
    cap('difference exaggerated ~10^{17}×', rest, { at: [0.62, 0.69], size: 0.022, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  at(start + heard('clock', 'millimetre', 0.85) - 0.4, () => {
    cap('*{2022 · 1 mm}', life - (now() - start), { at: [0.62, 0.62], size: 0.05, font: 'unbounded', accent: GOLD, fade: 0.3 })
  })
  wait(life)
})

// ---- the ruler, lying on the sheet ----
// The sheet's well, as SHEET_GLSL dents it: its depth this far from the middle (in the well's radii) as a
// share of the depth at the mouth (gridDepth, WELL radii)
const dent = away => {
  const x = Math.min(1 / Math.max(away, 1), 1)
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
const WELL = 3
// The length along the surface between two distances from the well's middle, down one spoke
const surface = (from, to) => {
  let length = 0
  for (let step = 0; step < 200; step++) {
    const a = from + (to - from) * step / 200
    const b = from + (to - from) * (step + 1) / 200
    length += Math.hypot(b - a, WELL * (dent(b) - dent(a)))
  }
  return length
}
// The sheet's rings are its contour lines, each the same step down the well, which is the step along W
// (gridRings, as the grid's shader lays them): ring k of RINGS, in the well's radii from its middle
const RINGS = 72
const ring = k => {
  const kept = 1 - k / (RINGS + 1) / 2.3660254
  return 0.3849002 / ((1 - kept * kept) * kept)
}
// A place on the sheet, `away` of the well's radii from its middle, `angle` degrees round from the right
// toward the far side; the spokes are every 15 degrees
const onSheet = (away, angle) => {
  const turn = angle * Math.PI / 180
  return { sheet: [part(away * Math.cos(turn)), part(away * Math.sin(turn))] }
}
// The ruler lies down the spoke at RULER.angle, and its marks are the rings it crosses, from ring `first`
// out on the flat to ring `last` just above the Earth, every `every` rings: each piece between two marks
// holds the same amount of space, the same steps along W, and the deeper it lies the shorter it is on the surface. A mark is a piece of
// its ring, `half` of the well's radii either side of the spoke
const RULER = { angle: 60, first: 5, last: 25, every: 4, half: 0.22 }
const RULER_LENGTH = surface(ring(RULER.first), ring(RULER.last))
// Lifted off the sheet the ruler lies straight across the top of the frame, its flat end at the right and
// its deep end at the left, every piece as long as it was on the surface: from 0.47 of the frame out on the
// flat to 0.047 deep in the well, room for three separate dots in the shortest
const STRAIGHT = { right: 0.93, left: 0.07, y: 0.3, tick: 0.022 }
const straightAt = away => [part(STRAIGHT.right - (STRAIGHT.right - STRAIGHT.left) * surface(ring(RULER.first), away) / RULER_LENGTH), STRAIGHT.y]
// A place of the ruler `lift` of the way from the sheet to the straight ruler (a value's name)
const lifted = (sheetPlace, framePlace, lift) => ({ between: [sheetPlace, framePlace], share: lift })
const rulerLine = lift => {
  const places = []
  for (let index = 0; index <= 40; index++) {
    const away = ring(RULER.first) + (ring(RULER.last) - ring(RULER.first)) * index / 40
    places.push(lifted(onSheet(away, RULER.angle), straightAt(away), lift))
  }
  return places
}
const rulerMark = (k, lift) => {
  const away = ring(k)
  const turn = RULER.half / away * 180 / Math.PI
  const [x, y] = straightAt(away)
  return [
    lifted(onSheet(away, RULER.angle - turn), [x, part(y - STRAIGHT.tick)], lift),
    lifted(onSheet(away, RULER.angle), [x, y], lift),
    lifted(onSheet(away, RULER.angle + turn), [x, part(y + STRAIGHT.tick)], lift)
  ]
}
// The same amount of space in every piece: DOTS dots spread evenly along each
const DOTS = 3
// W, the way down the well, is shown down the spoke at this angle: on the near wall
const W_SPOKE = -60

shot('ruler', () => {
  const start = now()
  const spoken = say('ruler')
  const life = spoken + 0.6 + RULER_HOLD
  status('idea', life - 0.2)
  // The camera flies down to the sheet beside the Earth's well, and back as the shot ends
  at(start, () => {
    to({ gravityStrength: 3 }, 1.5)
    // and the falling space dims as it goes, so the ruler and the rings it is read by stand out
    to({ cameraMoveIn: 15, cameraPitch: -42, cameraLookPitch: 8, flowA: 0.6 }, 2.4, 'ease')
  })
  at(start + life - 1.6, () => { to({ cameraMoveIn: 0, cameraPitch: -62, cameraLookPitch: 0 }, 1.6, 'ease'); to({ flowA: 1.6, gridSheet: 0.8 }, 1.6) })
  const gone = start + life - 1.4
  const rulerFrom = start + heard('ruler', 'rulers', 0.4) - 2.6
  const squeezeFrom = start + heard('ruler', 'squeezed', 0.55)
  // The ruler leaves the sheet for the frame after the squeeze is named, the flight down has ended and it has
  // lain on the sheet, read by the rings, for 2 s after its last mark (drawn over 1.6 s), and lies there straight
  const liftFrom = Math.max(squeezeFrom + 1.4, rulerFrom + 1.6 + 2.0, start + 3.95)
  const LIFT = 1.6
  const lift = [[liftFrom, 0], [liftFrom + LIFT, 1]]
  // The sheet and the falling space step back as the ruler lifts off, so the straight ruler reads on the dark
  at(liftFrom, () => { to({ gridSheet: 0.25, flowA: 0.25 }, 0.8) })
  // The ruler laid down the spoke, its marks lit ring by ring from the flat down to the Earth
  at(rulerFrom, () => {
    const rest = gone - now()
    const born = now()
    const count = (RULER.last - RULER.first) / RULER.every + 1
    sketch({ kind: 'line', points: rulerLine('lift'), smooth: true, color: GOLD, width: 0.004, fade: 0.3, draw: 1.6, values: { lift } }, rest)
    for (let k = RULER.first; k <= RULER.last; k += RULER.every) {
      const late = 1.6 * (k - RULER.first) / RULER.every / count
      at(born + late, () => {
        sketch({ kind: 'line', points: rulerMark(k, 'lift'), color: GOLD, width: 0.0034, fade: 0.15, values: { lift } }, rest - late)
      })
    }
  })
  // W is the way the well goes down: an arrow along the next spoke, down to the Earth, while the ruler lies there
  at(squeezeFrom - 0.5, () => {
    const rest = liftFrom - now()
    // down the near wall, the side facing the camera, from out on the flat to the Earth's edge
    sketch({ kind: 'line', points: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(step => onSheet(3.6 - 2.45 * step / 8, W_SPOKE)), smooth: true, arrow: 'end', color: W, width: 0.0042, fade: 0.3, draw: 0.9 }, rest)
    cap('*{W}', rest, { at: onSheet(3.3, W_SPOKE + 14), size: 0.036, font: 'unbounded', accent: W, fade: 0.3 })
    cap('squeezed along *{W}', rest, { at: [0.68, 0.12], size: 0.03, font: 'unbounded', color: SOFT, accent: W, fade: 0.3 })
  })
  // Laid straight, the pieces are not the same length, and each holds the same space: as many dots in each
  at(liftFrom + LIFT, () => {
    const rest = gone - now()
    for (let k = RULER.first; k < RULER.last; k += RULER.every) {
      const near = straightAt(ring(k))[0]
      const deep = straightAt(ring(k + RULER.every))[0]
      for (let dot = 0; dot < DOTS; dot++) {
        const late = 0.8 * (k - RULER.first) / (RULER.last - RULER.first)
        at(now() + late, () => {
          sketch({ kind: 'circle', center: [part(near + (deep - near) * (dot + 0.5) / DOTS), STRAIGHT.y - 0.04], radius: 0.004, color: INK, width: 0, fill: INK, fillOpacity: 1, fade: 0.2 }, rest - late)
        })
      }
    }
    cap('out on the flat', rest, { at: [STRAIGHT.right - 0.06, STRAIGHT.y + 0.055], size: 0.028, font: 'unbounded', color: SOFT, fade: 0.3 })
    cap('deep in the well', rest, { at: [STRAIGHT.left + 0.06, STRAIGHT.y + 0.055], size: 0.028, font: 'unbounded', color: SOFT, fade: 0.3 })
    at(now() + 0.8, () => {
      cap('the same *{space} in every step', gone - now(), { at: [0.5, STRAIGHT.y - 0.1], size: 0.034, font: 'unbounded', color: SOFT, accent: INK, fade: 0.3 })
    })
  })
  at(start + heard('ruler', 'trust', 0.92) - 0.5, () => {
    keep('a ruler we can *{trust}?', life - (now() - start))
  })
  wait(life)
})

// The experiment, at two places of the scene: one light clock on the Earth, deep in its well, and the same clock on
// a satellite, higher up, far out on the flat of the sheet where the well is shallow (its height drawn out of
// scale). The way up is drawn on the sheet itself: an arrow from the Earth up the well's wall and out along the
// spoke the ruler lay on, to the satellite. Each clock stands large on the frame, the upper one higher on it, with
// a lead to its place. Probed at the count shot's wide camera: the spoke at 60 degrees runs from the Earth's top
// (0.24, 0.56 of the frame) up and right to 0.37, 0.37 at 22 radii, clear of both insets
const HERE = inset(0.84, 0.58)
const THERE = inset(0.62, 0.25)
const onEarth = { hole: [0.95, 0.75] }
const UP = { away: 22, angle: RULER.angle }
const upAt = onSheet(UP.away, UP.angle)
// The way up the well, on the sheet: from the Earth's edge up the wall and out on the flat, stopping short of the
// satellite
const climb = () => [1.2, 1.5, 2, 2.8, 4, 6, 9, 13, 17, 19.8].map(away => onSheet(away, UP.angle))
// A satellite at its place on the sheet: a body and two solar wings across the spoke, in the sheet's radii, so it
// lies where the climb ends, and its name above it
function satellite (seconds) {
  const [x, y] = upAt.sheet
  for (const side of [-1, 1]) {
    sketch({ kind: 'line', points: [{ sheet: [part(x + side * 0.9), y] }, { sheet: [part(x + side * 2.8), y] }], color: GOLD, width: 0.006, fade: 0.3 }, seconds)
  }
  sketch({ kind: 'circle', center: upAt, radius: 0.45, fill: GOLD, color: GOLD, width: 0, fade: 0.3 }, seconds)
  cap('satellite', seconds, { at: { sheet: [x, part(y + 9)] }, size: 0.022, font: 'unbounded', color: GOLD, fade: 0.3 })
}
// The two clocks, their leads and counters stay on to the end of the verdict, whose line compares their counts
const VERDICT_END = () => long('verdict') + 0.6

shot('mirrors', () => {
  const start = now()
  const spoken = say('mirrors')
  const life = spoken + 0.6
  status('known', spoken)
  // The space eases: the clock is drawn on a quiet sheet
  at(start, () => { to({ gravityStrength: 1.5 }, 2) })
  // Two mirrors on a block, drawn large beside the Earth they stand on, and the light set bouncing between them.
  // The clock stays on through the count and the verdict
  const end = start + life + long('count') + 0.6 + COUNT_HOLD + VERDICT_END()
  at(start + heard('mirrors', 'mirrors', 0.2) - 0.4, () => {
    clockBody(HERE, end - now())
    clockLead(HERE, [-CLOCK.gap / 2 - 0.25, -CLOCK.high - 0.4], onEarth, 0.12, end - now())
    clockGap(HERE, life - (now() - start))
  })
  at(start + heard('mirrors', 'bouncing', 0.4) - 0.2, () => {
    clockLight(HERE, end - now())
    cap('light, slowed a billion times', life - (now() - start), { at: HERE(0, -CLOCK.high - 1.05), size: 0.024, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  at(start + heard('mirrors', 'ruler', 0.85) - 0.3, () => {
    keep('a ruler that *{light} can read', life - (now() - start))
  })
  wait(life)
})

shot('count', () => {
  const start = now()
  const spoken = say('count')
  const life = spoken + 0.6 + COUNT_HOLD
  const end = start + life + VERDICT_END()
  // Here, deep in the well: the clock from the shot before, its round trips counted against an atomic clock's second
  at(start + heard('count', 'atomic', 0.25) - 0.3, () => {
    counter(HERE, end - now(), 2.4)
    cap('in 1 s of an atomic clock', end - now(), { at: HERE(0, -CLOCK.high - 1.6), size: 0.022, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  // Then on a satellite: the satellite at its place far out on the flat, and the way up to it drawn along the sheet
  const climbFrom = start + heard('count', 'satellite', 0.62) - 0.6
  at(climbFrom, () => {
    satellite(end - now())
    sketch({ kind: 'line', points: climb(), smooth: true, arrow: 'end', color: GOLD, width: 0.003, dash: [0.01, 0.007], draw: 1.2, fade: 0.3 }, end - now())
  })
  // and the same clock there, once the arrow has reached it
  at(climbFrom + 1.1, () => {
    clockBody(THERE, end - now())
    clockLead(THERE, [-CLOCK.gap / 2 - 0.25, -CLOCK.high - 0.4], upAt, 0.35, end - now())
    clockLight(THERE, end - now())
    cap('higher up: a shallower well', end - now(), { at: THERE(0, CLOCK.high + 0.5), size: 0.024, font: 'unbounded', color: SOFT, fade: 0.3 })
  })
  at(Math.max(start + heard('count', 'shallower', 0.9), climbFrom + 1.4), () => {
    counter(THERE, end - now(), 2.4, true)
  })
  wait(life)
})

shot('verdict', () => {
  const start = now()
  const spoken = say('verdict')
  const life = spoken + 0.6
  status('idea', spoken)
  // The sheet steps back behind the two clocks, which stay with their counts, and the two answers stand beside the
  // upper clock's count, each with the reading it predicts
  at(start, () => { to({ fade: 0.6 }, 0.8) })
  at(start + heard('verdict', 'Einstein', 0.03), () => {
    cap('Einstein: the same count\n*{2.998 billion}', life - (now() - start), { at: [0.27, 0.13], size: 0.032, font: 'unbounded', color: SOFT, accent: GRID, plate: 0.55, fade: 0.4 })
  })
  at(start + heard('verdict', 'hypothesis', 0.3) - 0.2, () => {
    cap('the hypothesis: a few fewer\n*{2.998 billion − a few}', life - (now() - start), { at: [0.27, 0.26], size: 0.032, font: 'unbounded', color: SOFT, accent: W, plate: 0.55, fade: 0.4 })
  })
  at(start + heard('verdict', 'number', 0.7) - 0.3, () => {
    keep('one number, two *{predictions}', life - (now() - start))
  })
  wait(life)
})

leave()
