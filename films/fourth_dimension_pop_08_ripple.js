// The fourth dimension as popular science, clip 8 of films/fourth_dimension_pop.json: space that stretches can ripple, and in 2015 the ripple of two merging black holes was caught.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_08_ripple.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  stretch: 'If this is right, mass does not curve space, the way Einstein put it. It stretches space, along W.',
  small: 'That sounds like a small change of words. But anything that can stretch can also ripple.',
  shake: 'In twenty fifteen, two detectors in the United States felt space itself shake.',
  source: 'The source: two black holes, each about thirty times heavier than the Sun, colliding one point three billion light years away.',
  proton: 'By the time the wave reached us, it stretched a four kilometre detector by about a thousandth of the width of a proton. And we still caught it.'
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

// What falls toward the hole on the sheet: swung round as it comes, a whirl that drains down the well's wall
const WHIRL = {
  gravityInertia: 0.75, orbitalStrength: 80, gravityStrength: 4, gravityReach: 16, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.03, trailIntensity: 0.15,
  depthFade: 0, minOpacity: 0.1, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.3
}
const GRID = '#4de3ff'

film({
  fps: 60,
  seed: 8,
  warmup: 10,
  settings: {
    numParticles: 20000,
    lensingEnabled: false,
    nebula: 0.6,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.4,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: GRID,
    gridSheet: 0.85,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridDepth: 3,
    gridRings: 40,
    gridCell: 4,
    gridTilt: 66,
    gridRide: 1,
    // The whole column lies on the sheet: a share of the ride fading with depth left the matter the hole
    // gathers hanging between where it flies and the surface, a white ball over the shadow. Laid wholly,
    // it crowds the steep throat, so half as many particles, dimmer, let the wall show through it
    gridRideSoft: 0.01,
    fieldAtHole: 1,
    blackHoleSize: 8,
    blackHoleY: 0.62,
    companionSize: 0,
    companionWaves: 0,
    companionSpeed: 2,
    ...WHIRL
  }
})
chapter('08', 'SPACE CAN RIPPLE')

shot('stretch', () => {
  const start = now()
  const spoken = say('stretch')
  const einstein = start + heard('stretch', 'Einstein', 0.45)
  const stretches = start + heard('stretch', 'stretches', 0.72)
  status('idea', spoken + 0.4)
  at(einstein - 0.3, () => {
    caption('Einstein: mass *{curves} space', stretches - now(), { at: [0.78, 0.3], width: 0.34, size: 0.04, font: 'noto', accent: GRID, plate: 0.5 })
  })
  at(stretches - 0.3, () => {
    caption('hypothesis: mass *{stretches} space', start + spoken + 0.6 - now(), { at: [0.78, 0.3], width: 0.34, size: 0.04, font: 'noto', accent: W, plate: 0.5 })
    // The well deepens along W, and a red arrow points the way it goes
    meanwhile(() => { to({ gridDepth: 8, blackHoleY: 0.72, gravityStrength: 6 }, 3, 'out') })
    draw({ kind: 'line', points: [[0.3, 0.42], [0.3, 0.74]], arrow: 'end', color: W, width: 0.006, draw: 0.8, fade: 0.4 }, start + spoken + 0.6 - now())
    caption('W', start + spoken + 0.6 - now(), { at: [0.26, 0.58], size: 0.05, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('small', () => {
  const start = now()
  const spoken = say('small')
  const ripple = start + heard('small', 'ripple', 0.85)
  // Anything that stretches can ripple: a second, small body sets the sheet waving
  at(start + heard('small', 'anything', 0.6) - 0.2, () => {
    set({ companionSize: 0.6, companionDistance: 5, gridWaveLift: 20 })
    meanwhile(() => { to({ companionWaves: 2.5 }, 1.5) })
  })
  at(ripple - 0.2, () => {
    caption('a *{ripple} of space', start + spoken + 0.6 - now(), { at: [0.5, 0.2], size: 0.045, font: 'unbounded', accent: GRID, fade: 0.4 })
  })
  status('idea', spoken + 0.4)
  wait(spoken + 0.6)
})

shot('shake', () => {
  const start = now()
  const spoken = say('shake')
  status('known', spoken + 0.4)
  // The sheet is seen from higher and wider, ready for the pair
  meanwhile(() => { to({ gridDepth: 4, blackHoleSize: 3.5, blackHoleY: 0.5, gridRings: 0, gridCell: 3, gridTilt: 60, gridSpan: 3, gridFade: 0.5, companionSize: 0.8, companionDistance: 6, companionWaves: 3, gridWaveLift: 30, baseBrightness: 0.3 }, 2.5) })
  at(start + heard('shake', 'fifteen', 0.2), () => {
    caption('14 September 2015', start + spoken + 0.6 - now(), { at: [0.5, 0.16], size: 0.05, font: 'unbounded', color: GOLD, fade: 0.4 })
  })
  at(start + heard('shake', 'detectors', 0.4), () => {
    caption('LIGO · two detectors', start + spoken + 0.6 - now(), { at: [0.5, 0.24], size: 0.032, font: 'noto', color: INK, fade: 0.4 })
  })
  at(start + heard('shake', 'shake', 0.95) - 0.2, () => { keep('space itself *{shook}', spoken * 0.3 + 0.6) })
  wait(spoken + 0.6)
})

shot('source', () => {
  const start = now()
  const spoken = say('source')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  // The two close in slowly, then fast, and merge before the line ends; the waves run out over the sheet
  meanwhile(() => { to({ companionDistance: 0 }, spoken - 0.8, 'in') })
  meanwhile(() => { to({ gridWaveLift: 11, companionWaves: 1.6 }, spoken - 0.8, 'in') })
  at(start + heard('source', 'thirty', 0.3), () => {
    caption('36 + 29 M_{☉}', end - now(), { at: [0.18, 0.2], size: 0.05, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('two black holes', end - now(), { at: [0.18, 0.27], size: 0.026, font: 'noto', color: SOFT, fade: 0.4 })
  })
  at(start + heard('source', 'billion', 0.8), () => {
    caption('1.3 billion light years', end - now(), { at: [0.8, 0.2], size: 0.04, font: 'unbounded', color: GOLD, fade: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('proton', () => {
  const start = now()
  const spoken = say('proton')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  meanwhile(() => { to({ baseBrightness: 0.15 }, 2) })
  // The detector's arm: a bar, and its stretch
  at(start + heard('proton', 'kilometre', 0.4) - 0.2, () => {
    draw({ kind: 'line', points: [[0.2, 0.3], [0.8, 0.3]], color: INK, width: 0.008, draw: 0.8, fade: 0.4 }, end - now())
    caption('4 km detector arm', end - now(), { at: [0.5, 0.25], size: 0.03, font: 'unbounded', color: INK, fade: 0.4 })
  })
  at(start + heard('proton', 'thousandth', 0.55) - 0.2, () => {
    caption('ΔL ≈ 10^{-18} m', end - now(), { at: [0.5, 0.42], size: 0.07, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('a thousandth of a proton', end - now(), { at: [0.5, 0.52], size: 0.034, font: 'noto', color: GOLD, fade: 0.4 })
  })
  at(start + heard('proton', 'caught', 0.95) - 0.3, () => { keep('and we *{caught} it', end - now()) })
  wait(spoken + 0.6)
})

leave()
