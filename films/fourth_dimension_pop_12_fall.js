// The fourth dimension as popular science, clip 12 of films/fourth_dimension_pop.json: back to the ball: down, or a direction nobody can point to; then the credits.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_12_fall.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  back: 'So, back to the ball. Which way does it fall?',
  maybe: 'Maybe just down. Or maybe along a direction you have never seen, and cannot point to.',
  edge: 'Either way, the next time you feel your own weight, remember this. You are standing inside a well. And you have been falling into it your whole life.'
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

// The Earth stands over the hole, as in fourth_dimension_experiment.js: NASA's photograph, a little wider than
// the shadow it covers, with the lens and the ring off and space falling in on it from every side
const SIZE = 14
const EARTH_TOP = 0.5 - 1.31 * SIZE / 100
film({
  fps: 60,
  seed: 12,
  warmup: 8,
  settings: {
    blackHoleSize: SIZE,
    blackHoleX: 0.5,
    blackHoleY: 0.5,
    numParticles: 24000,
    lensingEnabled: false,
    ringEnabled: false,
    colorPalette: [{ r: 120, g: 222, b: 255, enabled: true, percent: 70 }, { r: 235, g: 246, b: 255, enabled: true, percent: 30 }],
    // Space and matter falling straight in: no swirl, no flight, only the pull
    orbitalStrength: 0,
    gravityInertia: 0.3,
    gravityStrength: 4,
    gravityReach: 14,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.02,
    trailIntensity: 0.2,
    minOpacity: 0.2,
    baseBrightness: 1,
    nebula: 0.8,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridColor: '#4de3ff',
    gridSheet: 0,
    gridTilt: 62,
    gridSpokes: 24,
    gridRings: 40,
    gridDepth: 2,
    gridSpan: 0.8,
    fieldAtHole: 1
  }
})
chapter('12', 'SO, WHICH WAY IS DOWN?')

// The clip's seconds, laid out first
const tBack = now()
const tMaybe = tBack + long('back') + 0.6
const tEdge = tMaybe + long('maybe') + 0.6
const tCredits = tEdge + long('edge') + 0.8
const CREDITS = 10
const END = tCredits + CREDITS
const tWell = tEdge + heard('edge', 'well', 0.62)

// The Earth, until it gives way to its well
draw({
  kind: 'image', src: 'films/fourth_dimension_earth.png', center: { hole: [0, 0] }, width: 2.62, opacity: 'lit',
  values: { lit: [[0, 1], [tWell - 0.5 - tBack, 1], [tWell + 1 - tBack, 0]] }
}, END - tBack)

// The ball: it drops from high over the Earth straight down the frame, slows to a hang while the arrows are
// drawn, and is gone with the Earth
const BALL_FROM = 0.03
const BALL_HANG = 0.12
const ballY = s => {
  const t = s / (tMaybe + 0.4 - tBack)
  return +(t < 1 ? BALL_FROM + (BALL_HANG - BALL_FROM) * t * t : BALL_HANG + 0.006 * (t - 1)).toFixed(4)
}
draw({
  kind: 'circle', center: [0.5, 'y'], radius: 0.016, fill: INK, color: '#ffffff', width: 0.002, fade: 0.5, values: { y: ballY }
}, tWell - tBack)

shot('back', () => {
  const start = now()
  const spoken = say('back')
  at(start + heard('back', 'which', 0.55), () => {
    caption('which way?', tMaybe - now(), { at: [0.64, 0.1], size: 0.04, font: 'unbounded', color: INK, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('maybe', () => {
  const start = now()
  const spoken = say('maybe')
  const life = tEdge + 1 - start
  status('open', life)
  const ball = BALL_HANG + 0.02
  // A plain arrow from the ball down the frame
  at(start + heard('maybe', 'down', 0.15), () => {
    draw({ kind: 'line', points: [[0.47, ball], [0.47, EARTH_TOP - 0.02]], arrow: 'end', color: INK, width: 0.004, draw: 0.5, fade: 0.4 }, start + life - now())
    caption('down', start + life - now(), { at: [0.42, (ball + EARTH_TOP) / 2], size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // A red one off at a slant, toward a direction the frame has no room for
  at(start + heard('maybe', 'direction', 0.5), () => {
    draw({ kind: 'line', points: [[0.53, ball], [0.6, EARTH_TOP - 0.03]], arrow: 'end', color: W, width: 0.0045, draw: 0.7, fade: 0.4 }, start + life - now())
    caption('*{W}: inward', start + life - now(), { at: [0.68, EARTH_TOP - 0.05], size: 0.03, font: 'unbounded', color: INK, accent: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('edge', () => {
  const start = now()
  const spoken = say('edge')
  status('idea', tCredits - start)
  // The Earth gives way to its well: the sheet comes up, dents, and the camera goes down into it, while
  // space and matter fall in past the viewer
  at(tWell - 1.5, () => {
    to({ gridSheet: 0.8, gridDepth: 4 }, 2)
  })
  at(tWell - 1.5, () => {
    to({ cameraZoom: 3.2, gravityStrength: 8, baseBrightness: 1.6 }, tCredits - now(), 'in')
  })
  at(tWell, () => {
    caption('a *{well}', 2.4, { at: [0.5, 0.14], size: 0.036, font: 'unbounded', color: INK, accent: W, fade: 0.4 })
  })
  at(start + heard('edge', 'falling', 0.86), () => {
    keep('You have been *{falling} your whole life.', tCredits + 0.4 - now())
  })
  until(tCredits)
})

// The credits, with no narration, on the quiet scene: the camera eases back and the fall slows
shot('credits', () => {
  at(now(), () => { to({ cameraZoom: 1.6, gravityStrength: 4, baseBrightness: 0.8, gridSheet: 0.35 }, CREDITS, 'out') })
  wait(0.6)
  caption('THE *{FOURTH} DIMENSION', CREDITS - 1.2, { at: [0.5, 0.36], size: 0.062, font: 'unbounded', accent: W, color: INK, fade: 0.8 })
  wait(0.5)
  caption('a hypothesis, not established physics', CREDITS - 1.7, { at: [0.5, 0.45], size: 0.032, font: 'noto', color: SOFT, fade: 0.8 })
  wait(1.6)
  caption('Every picture in this film is a real-time particle simulation, directed from code', CREDITS - 3.3, { at: [0.5, 0.66], size: 0.026, font: 'noto', color: INK, plate: 0.4, fade: 0.8 })
  wait(0.8)
  caption('Earth photograph: NASA, Apollo 17, AS17-148-22727', CREDITS - 4.1, { at: [0.5, 0.72], size: 0.024, font: 'noto', color: SOFT, plate: 0.4, fade: 0.8 })
  wait(CREDITS - 3.5)
})

leave()
