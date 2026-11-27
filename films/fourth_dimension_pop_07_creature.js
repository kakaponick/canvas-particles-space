// The fourth dimension as popular science, clip 7 of films/fourth_dimension_pop.json: a flat creature in the sheet calls what it cannot see gravity, and we may be that creature.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_07_creature.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  lives: 'Imagine a creature that lives in this sheet. It is completely flat. It can move along X, and along Y, and that is all.',
  blind: 'It cannot see the well. It cannot even imagine down. It just notices something odd: everything it drops slides toward the same spot.',
  word: 'So it invents a word for that. It calls it gravity.',
  us: 'Here is the uncomfortable part. We might be that creature. Our sheet just has three dimensions instead of two.',
  chair: 'And the well we cannot see would drop into a fourth. You cannot point at it. But you can feel it, right now, pressing you into your chair.'
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

// The matter is flows, said from the first frame: the particle field laid on the sheet draws only still dots,
// and in 3D the field drains or, with a drift to refill it, streaks the whole frame one way as the camera turns.
// On the sheet seen from straight above, what lies on it slides along the spokes toward the hole, with nothing
// to swing it round: a flow laid on the sheet, sliding in from the first frame and lit brighter once the
// creature drops something.
// Its count was swept at this framing (from above, depth 6): 3000 was sparse specks, 12000 a grey veil over the
// grid, 6000 reads as matter sliding in with every ring still clear
const SLIDE = { flowACount: 6000, flowAFrom: 9, flowATo: 0.9, flowASpread: 6, flowASwirl: 0, flowALife: 7, flowATrail: 0.6, flowASize: 1.2, flowAThick: 0, flowAColor: '#cfe6ff' }
// What falls in space: straight in from every side. Three flows tipped 60 degrees from one another, each a thick
// slab of fall, fill a ball round the hole whose strokes all point at it; they are lines in the scene, so the
// camera's turn shows their depth and does not smear them into rain. The band and count were swept at this
// framing: from 10 radii wide 7 the near matter streaked the whole frame like a starburst; from 5.5 wide 3 the
// fall stays inside the lattice's ball, 2500 a flow reads as matter falling in, 5000 crowds the lattice out
const FALL = { From: 5.5, To: 0.9, Spread: 3, Swirl: 0, Life: 6, Trail: 0.4, Size: 1.2, Thick: 0.5, Bell: 1, Color: '#d8e4ff' }
const FALLING_LIGHT = 0.8
const LATTICE = 0.6
const falling = (flow, count, tilt, node) => ({
  ...Object.fromEntries(Object.entries(FALL).map(([key, value]) => ['flow' + flow + key, value])),
  ['flow' + flow + 'Count']: count,
  ['flow' + flow + 'Tilt']: tilt,
  ['flow' + flow + 'Node']: node
})
const FALLING_COUNT = 2500

film({
  fps: 60,
  seed: 7,
  settings: {
    blackHoleSize: 8,
    fieldEnabled: false,
    lensingEnabled: false,
    lensingRadius: 0,
    starsBrightness: 1.2,
    starDensity: 0.2,
    gridColor: '#4de3ff',
    gridSheet: 0.85,
    gridTilt: 0,
    gridDepth: 6,
    gridRings: 40,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridRide: 1,
    // The lattice of 3D space, once it comes: a ball of fine cells the camera sees from outside, drawn in hard
    // toward the hole. Its near half is drawn too, fading toward the camera, and its far half dims, so the
    // camera's turn shows the cells at their depths sliding past one another
    gridLatticeCell: 1,
    gridLatticeWarp: 0,
    gridLatticeLine: 2.4,
    gridLatticeNear: 0.85,
    gridLatticeNearEdge: 0.4,
    gridLatticeFar: 0.25,
    threeDFrontDepth: 2,
    threeDEase: 2.6,
    cameraYaw: 0,
    cameraPitch: 0,
    ...SLIDE,
    flowA: 0.8,
    ...falling('B', FALLING_COUNT, 60, 0),
    ...falling('C', FALLING_COUNT, 120, 0)
  }
})
chapter('07', 'THE FLAT CREATURE')

// The creature: a round body with two eyes, out on the sheet to the right of the well, in hole radii. Pale
// violet, so it is not taken for the gold mass ball of clip 5
const HOME = [5, 2]
const CREATURE = '#cdb6ff'
const near = (dx, dy) => ({ hole: [HOME[0] + dx, HOME[1] + dy] })
const creature = seconds => {
  draw({ kind: 'circle', center: near(0, 0), radius: 0.55, fill: CREATURE, color: CREATURE, fade: 0.5 }, seconds)
  draw({ kind: 'circle', center: near(-0.18, 0.15), radius: 0.09, fill: '#101830', color: '#101830', fade: 0.5 }, seconds)
  draw({ kind: 'circle', center: near(0.18, 0.15), radius: 0.09, fill: '#101830', color: '#101830', fade: 0.5 }, seconds)
}
const part = value => +value.toFixed(3)
// Where a thing let go at [x, y] ends its slide down the spoke it lies on: at the shadow's edge, toward the centre
const spoke = (x, y) => { const k = 1.2 / Math.hypot(x, y); return [part(x * k), part(y * k)] }
const SLIDE_SECONDS = 1.4
// The flat picture lasts until just before the line that leaves it says three
let flatEnd = 0

shot('lives', () => {
  const start = now()
  const spoken = say('lives')
  flatEnd = start + spoken + 0.6 + long('blind') + 0.6 + long('word') + 0.6 + heard('us', 'three', 0.8) - 1
  const axesEnd = start + spoken + 0.6 + long('blind')
  at(start + heard('lives', 'creature', 0.12), () => {
    creature(flatEnd - now())
    caption('a flat creature', heard('lives', 'X', 0.6) - heard('lives', 'creature', 0.12), { at: near(0, -1.3), size: 0.028, font: 'unbounded', color: CREATURE, fade: 0.4 })
  })
  at(start + heard('lives', 'X', 0.62), () => {
    draw({ kind: 'line', points: [near(0.8, 0), near(2.4, 0)], arrow: 'end', color: X, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    caption('X', axesEnd - now(), { at: near(2.8, 0), size: 0.034, font: 'unbounded', color: X, fade: 0.4 })
  })
  at(start + heard('lives', 'Y', 0.78), () => {
    draw({ kind: 'line', points: [near(0, 0.8), near(0, 3)], arrow: 'end', color: Y, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    caption('Y', axesEnd - now(), { at: near(0, 3.5), size: 0.034, font: 'unbounded', color: Y, fade: 0.4 })
  })
  at(start + heard('lives', 'all', 0.95), () => {
    caption('2 directions, no more', start + spoken + 0.6 - now(), { at: [0.5, 0.12], size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('blind', () => {
  const start = now()
  const spoken = say('blind')
  const end = start + spoken + 0.6
  // It cannot look down: under it the well is only the rings crowding inward
  at(start + heard('blind', 'see', 0.12), () => {
    caption('?', end - now() + long('word') * 0.4, { at: near(-1.1, 1.0), size: 0.07, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // Everything it drops slides toward the same spot: two pebbles let go beside it slide down their own spokes,
  // faster as they go, and are gone at the shadow; the matter on the sheet, faint till now, is lit sliding in
  at(start + heard('blind', 'drops', 0.72), () => {
    const dropped = now()
    const pebble = (from, into, late) => {
      const t = part(dropped + late)
      const keys = (a, b) => [[t, a], [part(t + SLIDE_SECONDS), b, 'in']]
      const seen = [[t, 0], [part(t + 0.15), 1], [part(t + SLIDE_SECONDS - 0.15), 1], [part(t + SLIDE_SECONDS), 0]]
      draw({ kind: 'circle', center: { hole: ['px', 'py'] }, radius: 0.22, fill: INK, color: INK, width: 0.002, glow: 0.008, opacity: 'seen', fade: 0, values: { px: keys(from[0], into[0]), py: keys(from[1], into[1]), seen } }, late + SLIDE_SECONDS + 0.1)
      draw({ kind: 'line', points: [{ hole: from }, { hole: into }], arrow: 'end', color: INK, width: 0.003, dash: true, opacity: 0.6, draw: SLIDE_SECONDS, fade: 0.4 }, end - now())
    }
    pebble([HOME[0] - 0.8, HOME[1]], spoke(HOME[0] - 0.8, HOME[1]), 0)
    pebble([HOME[0] + 0.4, HOME[1] - 1], spoke(HOME[0] + 0.4, HOME[1] - 1), 0.7)
    to({ flowA: 1.4 }, 1.5)
  })
  at(start + heard('blind', 'spot', 0.95), () => {
    caption('everything slides here', end - now() + 0.2, { at: { hole: [0, -2.2] }, size: 0.028, font: 'unbounded', color: INK, plate: 0.5, fade: 0.3 })
  })
  wait(spoken + 0.6)
})

shot('word', () => {
  const start = now()
  const spoken = say('word')
  at(start + heard('word', 'gravity', 0.88), () => {
    caption('"*{gravity}"', flatEnd - now(), { at: near(2.6, -1), size: 0.05, font: 'unbounded', color: INK, accent: GOLD, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('us', () => {
  const start = now()
  const spoken = say('us')
  status('idea', spoken + 0.6)
  // The question stays long enough to be read, past the turn into 3D; the new space is named after it
  const asked = start + heard('us', 'creature', 0.42) - 0.3
  const named = Math.max(asked + 2.6, flatEnd + 0.8)
  at(asked, () => {
    caption('we = the creature?', named - 0.3 - now(), { at: [0.5, 0.12], size: 0.034, font: 'unbounded', color: INK, fade: 0.4 })
  })
  at(named, () => {
    caption('2D sheet  →  3D space', start + spoken + 0.6 - now() + 1.5, { at: [0.5, 0.12], size: 0.036, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // The sheet goes and its matter with it; space gets its third dimension: a lattice, drawn inward, and matter
  // falling in from every side. The lens and the lattice's pull are whole at once, and the lattice comes up
  // only once the camera has eased into 3D: seen down the line of flight while 3D eased in, its rows piled into
  // a blurred cross through the hole
  at(flatEnd - 1.4, () => { to({ gridSheet: 0, flowA: 0 }, 1.4) })
  at(flatEnd, () => { set({ gridRide: 0, ...falling('A', FALLING_COUNT, 0, 0) }) })
  at(flatEnd + 0.06, () => {
    set({ threeD: true, lensingEnabled: true, lensingRadius: 1.6, gridLatticeWarp: 8 })
    // The matter comes up quickly, so the frame is not left empty while the camera turns
    meanwhile(() => { to({ flowA: FALLING_LIGHT, flowB: FALLING_LIGHT, flowC: FALLING_LIGHT }, 1) })
    to({ cameraYaw: 34, cameraPitch: 18 }, 2.8)
  })
  at(flatEnd + 0.06 + 1.9, () => { to({ gridLattice: LATTICE }, 1.2) })
  wait(spoken + 0.6)
})

shot('chair', () => {
  const start = now()
  const spoken = say('chair')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.6)
  // The camera rises and comes a little nearer as it turns, so the lattice's near layers slide past its far
  // ones and the space reads as deep. The yaw stays on one side of 45 degrees: across it a cube of cells is
  // its own mirror image and the turn reads as no change
  meanwhile(() => { to({ cameraYaw: 14, cameraPitch: 40, cameraMoveIn: 3 }, spoken + 0.6) })
  // The well we cannot see drops into a fourth direction: W is no one way of our space, it points inward
  // from every side at once, and the arrows ride the hole as the camera turns round it
  at(start + heard('chair', 'fourth', 0.18), () => {
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4
      const from = { hole: [+(3.3 * Math.cos(angle)).toFixed(3), +(3.3 * Math.sin(angle)).toFixed(3)] }
      const into = { hole: [+(1.7 * Math.cos(angle)).toFixed(3), +(1.7 * Math.sin(angle)).toFixed(3)] }
      draw({ kind: 'line', points: [from, into], arrow: 'end', color: W, width: 0.006, draw: 0.6, fade: 0.4 }, end - now())
    }
    caption('W', end - now(), { at: { hole: [-3.5, 3.5] }, size: 0.05, font: 'unbounded', color: W, fade: 0.4, plate: 0.5 })
  })
  at(start + heard('chair', 'point', 0.45), () => {
    keep('You cannot point at it, but you can *{feel} it.', end - now())
  })
  // A figure on a chair, pressed down
  at(start + heard('chair', 'feel', 0.72), () => {
    const seconds = end - now()
    const look = { color: INK, width: 0.004, draw: 0.5, fade: 0.4 }
    // A dark card behind it, so it reads over the lattice
    draw({ kind: 'rect', center: [0.86, 0.47], size: [0.44, 0.62], round: 0.012, color: '#5a6480', width: 0.0012, fill: '#05070f', fillOpacity: 0.72, fade: 0.4 }, seconds)
    // The chair: seat, two legs, back
    draw({ kind: 'line', points: [[0.805, 0.62], [0.875, 0.62]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.805, 0.62], [0.805, 0.72]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.875, 0.62], [0.875, 0.72]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.875, 0.62], [0.875, 0.48]], ...look }, seconds)
    // The figure sits a little above the seat and in front of the chair's back, so no line of it doubles the
    // chair's: torso, thigh past the seat's edge, shin, foot, arm
    draw({ kind: 'circle', center: [0.835, 0.425], radius: 0.022, color: INK, width: 0.004, fade: 0.4 }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.46], [0.835, 0.6]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.6], [0.765, 0.6]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.765, 0.6], [0.765, 0.715]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.765, 0.715], [0.745, 0.715]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.5], [0.8, 0.56]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.24], [0.835, 0.36]], arrow: 'end', color: W, width: 0.007, draw: 0.5, fade: 0.4 }, seconds)
    caption('weight', seconds, { at: [0.93, 0.3], size: 0.032, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

leave()
