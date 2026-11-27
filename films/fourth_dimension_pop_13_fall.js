// The fourth dimension as popular science, clip 13 of films/fourth_dimension_pop.json: back to the ball: down, or a direction nobody can point to; then the credits.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_13_fall.js out.jpg -
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

// The Earth stands over the hole, as in fourth_dimension_pop_11_test.js: NASA's photograph, a little wider
// than the shadow it covers, with the lens and the ring off and space falling in on it from every side. The
// scene is in 3D from the start, so that the camera can really go down into the Earth's well: it starts
// near, face on to the Earth (the photograph as large as a hole of SEEN would be), backs off and turns down
// as the sheet comes up, and flies down the well to the Earth at its bottom. The Earth is never taken away:
// the hole under it is the scene's way of giving it a well, never to be seen as one
const SIZE = 4
const SEEN = 14
// The 3D camera circles the hole half the frame's long side over the shadow's radius away; NEAR brings it in
// until the shadow looks SEEN large
const DISTANCE = 0.5 * 1920 / (SIZE / 100 * 1080)
const NEAR = +(DISTANCE * (1 - SIZE / SEEN)).toFixed(2)
const EARTH_TOP = 0.5 - 1.31 * SEEN / 100
const COLD = '#aeeeff'
film({
  fps: 60,
  seed: 12,
  warmup: 10,
  settings: {
    blackHoleSize: SIZE,
    blackHoleX: 0.5,
    blackHoleY: 0.5,
    numParticles: 10000,
    particleSize: 1.8,
    particleSizeMin: 1.8,
    lensingEnabled: false,
    ringEnabled: false,
    colorPalette: [{ r: 120, g: 222, b: 255, enabled: true, percent: 70 }, { r: 235, g: 246, b: 255, enabled: true, percent: 30 }],
    // Space and matter falling straight in: no swirl, no flight, only the pull
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
    // dark while the camera is close to the Earth: a planet draws no infall; space lights as the well comes up
    baseBrightness: 0,
    // Stars on black, no nebula: its dust muddied the frame round the Earth, as in chapter 01
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridColor: '#4de3ff',
    // The sheet is not there until the Earth gives way to the picture of its well
    gridSheet: 0,
    gridSpokes: 24,
    gridRings: 48,
    gridDepth: 3,
    gridSpan: 2,
    gridFade: 0.3,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 0,
    cameraPitch: 0,
    cameraMoveIn: NEAR,
    // In 3D the field's gravity ends at a sphere and the warm-up drains it, so the space falling into the
    // Earth's well down every spoke is a flow laid on the sheet, in the field's colour
    flowA: 0,
    flowACount: 9000,
    flowAFrom: 8,
    flowATo: 1,
    flowASpread: 6,
    flowALife: 8,
    flowASwirl: 0.1,
    flowATrail: 0.6,
    flowASize: 1.2,
    flowAColor: COLD,
    gridRide: 1,
    gridRideSoft: 0.01,
    gridRideDepth: 400,
    // The Earth's well is a billionth of a black hole's: no redshift, no glow of slowed time, no light of its own
    gravityRedshift: 0,
    gridThroatGlow: 0,
    gridLight: 0,
    fieldAtHole: 1
  }
})
set({ letterbox: 0, filmGrain: 0 })
chapter('13', 'SO, WHICH WAY IS DOWN?')

// The clip's seconds, laid out first
const tBack = now()
const tMaybe = tBack + long('back') + 0.6
const tEdge = tMaybe + long('maybe') + 0.6
const tCredits = tEdge + long('edge') + 0.8
const CREDITS = 10
const END = tCredits + CREDITS
const tWell = tEdge + heard('edge', 'well', 0.62)
// The camera backs off and turns down from here, and the ball and its arrows leave as it starts
const tTurn = tEdge + 0.6
const TURN = 3

// The Earth, the whole clip, coming up with the picture as the chapter's card leaves (from 2 s, once the
// title over it has mostly gone, while the picture is still too dark for the hole under it to show)
at(1.6, () => {
  // its light keyed to the picture's own fade in and out, so the hole under it never shows through
  draw({ kind: 'image', src: 'films/fourth_dimension_earth.png', center: { hole: [0, 0] }, width: 2.9, opacity: 'lit', fade: 0, values: { lit: [[2, 0], [2.8, 1], [END, 1], [END + 0.8, 0]] } }, END + 0.8 - now())
})

// The ball: it drops from high over the Earth straight down the frame and slows to a hang while the arrows
// are drawn
const BALL_FROM = 0.05
const BALL_HANG = 0.12
const ballY = s => {
  const t = s / (tMaybe + 0.4 - tBack)
  return +(t < 1 ? BALL_FROM + (BALL_HANG - BALL_FROM) * t * t : BALL_HANG + 0.006 * (t - 1)).toFixed(4)
}
draw({
  kind: 'circle', center: [0.5, 'y'], radius: 0.016, fill: INK, color: '#ffffff', width: 0.002, fade: 0.5, values: { y: ballY }
}, tTurn + 0.3 - tBack)

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
  const gone = tTurn + 0.3
  status('open', tEdge - start)
  const ball = BALL_HANG + 0.02
  // A plain arrow from the ball down the frame
  at(start + heard('maybe', 'down', 0.15), () => {
    draw({ kind: 'line', points: [[0.47, ball], [0.47, EARTH_TOP - 0.02]], arrow: 'end', color: INK, width: 0.004, draw: 0.5, fade: 0.4 }, gone - now())
    caption('down', gone - now(), { at: [0.42, (ball + EARTH_TOP) / 2], size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
  })
  // And a direction no arrow in the frame can draw: rings closing on the ball, the way a thing seen going
  // away from us, into the picture, shrinks to a point; W, inward
  at(start + heard('maybe', 'direction', 0.5), () => {
    const born = now()
    const PERIOD = 1.2
    for (let index = 0; index < 3; index++) {
      const phase = s => ((s / PERIOD + index / 3) % 1)
      draw({
        kind: 'circle', center: [0.5, 'y'], radius: 'r', color: W, width: 0.0035, opacity: 'o', fade: 0.4,
        values: { y: s => ballY(s + born - tBack), r: s => +(0.016 + 0.05 * (1 - phase(s))).toFixed(4), o: s => +Math.sin(Math.PI * phase(s)).toFixed(3) }
      }, gone - now())
    }
    caption('*{W}: inward', gone - now(), { at: [0.6, ball], size: 0.03, font: 'unbounded', color: INK, accent: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('edge', () => {
  const start = now()
  const spoken = say('edge')
  status('idea', tCredits - start)
  // The Earth's well: the sheet comes up and the camera backs off and turns down to look into it, the Earth
  // at its bottom
  at(tTurn, () => {
    to({ gridSheet: 0.8, flowA: 1.6, baseBrightness: 0.5, cameraMoveIn: 0, cameraPitch: -62 }, TURN, 'ease')
  })
  // and goes down into it, while space falls in past the camera
  at(tWell - 0.4, () => {
    to({ cameraMoveIn: 15, cameraPitch: -42, cameraLookPitch: 8 }, tCredits + 1.4 - now(), 'ease')
  })
  at(tWell, () => {
    caption('a *{well}', 2.4, { at: [0.5, 0.12], size: 0.036, font: 'unbounded', color: INK, accent: W, plate: 0.35, fade: 0.4 })
  })
  at(start + heard('edge', 'falling', 0.86), () => {
    keep('You have been *{falling} your whole life.', tCredits + 0.4 - now())
  })
  until(tCredits)
})

// The credits, with no narration, on the quiet scene: the camera rises back out of the well, the words above
// and below the Earth in its middle
shot('credits', () => {
  at(now() + 1.4, () => { to({ cameraMoveIn: 4, cameraPitch: -58, cameraLookPitch: 0, gridSheet: 0.4, flowA: 0.8 }, CREDITS - 1.4, 'ease') })
  wait(0.6)
  caption('THE *{FOURTH} DIMENSION', CREDITS - 1.2, { at: [0.5, 0.15], size: 0.062, font: 'unbounded', accent: W, color: INK, plate: 0.35, fade: 0.8 })
  wait(0.5)
  caption('a hypothesis, not established physics', CREDITS - 1.7, { at: [0.5, 0.235], size: 0.032, font: 'noto', color: SOFT, plate: 0.35, fade: 0.8 })
  wait(1.6)
  caption('Every picture in this film is a real-time particle simulation, directed from code', CREDITS - 3.3, { at: [0.5, 0.875], size: 0.026, font: 'noto', color: INK, plate: 0.4, fade: 0.8 })
  wait(0.8)
  caption('Earth photograph: NASA, Apollo 17, AS17-148-22727', CREDITS - 4.1, { at: [0.5, 0.925], size: 0.024, font: 'noto', color: SOFT, plate: 0.4, fade: 0.8 })
  wait(CREDITS - 3.5)
})

leave()
