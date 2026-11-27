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

// The sheet seen from straight above: its well is the rings crowding toward the centre, and what lies on it
// slides along the spokes toward the hole, with nothing to swing it round
const SLIDE = { gravityInertia: 0.3, orbitalStrength: 0, gravityStrength: 6, gravityReach: 14, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.02, trailIntensity: 0.05, depthFade: 0, minOpacity: 0.2, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.6 }
// What falls in space: straight in from every side, with a slow drift that brings new matter
const FALLING = { orbitalStrength: 0, gravityInertia: 0.5, gravityStrength: 7, gravityReach: 18, baseSpeed: 0.25, baseBrightness: 1.3, speedGlow: 0.3, trailIntensity: 0.06 }

film({
  fps: 60,
  seed: 7,
  settings: {
    blackHoleSize: 8,
    numParticles: 30000,
    fieldAtHole: 1,
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
    gridLatticeCell: 1.6,
    gridLatticeWarp: 0,
    gridLatticeLine: 2,
    threeDEase: 2.6,
    cameraYaw: 0,
    cameraPitch: 0,
    ...SLIDE,
    gravityStrength: 0.5
  }
})
chapter('07', 'THE FLAT CREATURE')

// The creature: a round body with two eyes, out on the sheet to the right of the well, in hole radii
const HOME = [5, 2]
const CREATURE = GOLD
const near = (dx, dy) => ({ hole: [HOME[0] + dx, HOME[1] + dy] })
const creature = seconds => {
  draw({ kind: 'circle', center: near(0, 0), radius: 0.55, fill: CREATURE, color: CREATURE, fade: 0.5 }, seconds)
  draw({ kind: 'circle', center: near(-0.18, 0.15), radius: 0.09, fill: '#101830', color: '#101830', fade: 0.5 }, seconds)
  draw({ kind: 'circle', center: near(0.18, 0.15), radius: 0.09, fill: '#101830', color: '#101830', fade: 0.5 }, seconds)
}
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
    caption('?', end - now() + long('word') * 0.4, { at: near(0, 1.4), size: 0.07, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // Everything it drops slides toward the same spot
  at(start + heard('blind', 'drops', 0.72), () => {
    to({ gravityStrength: 6, baseBrightness: 0.9 }, 2)
    draw({ kind: 'line', points: [near(-0.8, -0.3), { hole: [1.5, 0.6] }], arrow: 'end', color: INK, width: 0.004, dash: true, draw: 0.8, fade: 0.4 }, end - now())
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
  at(start + heard('us', 'creature', 0.42), () => {
    caption('we = the creature?', flatEnd - now(), { at: [0.5, 0.12], size: 0.034, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // The sheet goes and its matter is let off it; space gets its third dimension: a lattice, drawn inward
  at(flatEnd - 1.4, () => { to({ gridSheet: 0 }, 1.4) })
  at(flatEnd, () => { set({ gridRide: 0, numParticles: 500, baseBrightness: 0 }) })
  at(flatEnd + 0.04, () => { set({ numParticles: 30000 }) })
  at(flatEnd + 0.06, () => {
    set({ threeD: true, lensingEnabled: true, cameraCutTurn: 0, speedGlowKnee: 0.15, gravityDepth: 18, depthFade: 1, minOpacity: 0.02, particleSize: 3, particleSizeMin: 0.3 })
    caption('2D sheet  →  3D space', start + spoken + 0.6 - now() + 1.5, { at: [0.5, 0.12], size: 0.036, font: 'unbounded', color: INK, fade: 0.4 })
    to({ cameraYaw: 34, cameraPitch: 18, gridLattice: 0.6, gridLatticeWarp: 5, lensingRadius: 1.6, ...FALLING }, 2.8)
    at(now() + 0.2, () => { set({ cameraCutTurn: 0.35 }) })
  })
  wait(spoken + 0.6)
})

shot('chair', () => {
  const start = now()
  const spoken = say('chair')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.6)
  meanwhile(() => { to({ cameraYaw: 70, cameraPitch: 22 }, spoken + 0.6) })
  // The well we cannot see drops into a fourth direction: W points inward at the mass
  at(start + heard('chair', 'fourth', 0.18), () => {
    to({ gravityStrength: 10 }, 2)
    draw({ kind: 'line', points: [[0.3, 0.3], [0.44, 0.44]], arrow: 'end', color: W, width: 0.007, draw: 0.6, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: [0.27, 0.27], size: 0.05, font: 'unbounded', color: W, fade: 0.4 })
  })
  at(start + heard('chair', 'point', 0.45), () => {
    keep('You cannot point at it, but you can *{feel} it.', end - now())
  })
  // A figure on a chair, pressed down
  at(start + heard('chair', 'feel', 0.72), () => {
    const seconds = end - now()
    const look = { color: INK, width: 0.004, draw: 0.5, fade: 0.4 }
    draw({ kind: 'line', points: [[0.78, 0.62], [0.86, 0.62]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.78, 0.62], [0.78, 0.72]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.86, 0.62], [0.86, 0.72]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.86, 0.62], [0.86, 0.48]], ...look }, seconds)
    draw({ kind: 'circle', center: [0.835, 0.425], radius: 0.022, color: INK, width: 0.004, fade: 0.4 }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.46], [0.835, 0.6]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.6], [0.79, 0.6]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.79, 0.6], [0.79, 0.72]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.5], [0.8, 0.56]], ...look }, seconds)
    draw({ kind: 'line', points: [[0.835, 0.24], [0.835, 0.36]], arrow: 'end', color: W, width: 0.007, draw: 0.5, fade: 0.4 }, seconds)
    caption('weight', seconds, { at: [0.92, 0.3], size: 0.032, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

leave()
