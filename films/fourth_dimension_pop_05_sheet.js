// The fourth dimension as popular science, clip 5 of films/fourth_dimension_pop.json: the sheet of space with a dent in it, its axes X, Y and W, and the question whether the dent is real.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_05_sheet.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  textbook: 'Now, how do you draw gravity? Every textbook does it the same way. Space is a stretched sheet, and a mass makes a dent in it.',
  roll: 'Things roll toward the dent. That is your orbit, your falling apple, your weight.',
  axes: "Look at the axes. Two of them, X and Y, are ordinary space. The third, the depth of the dent, is not. Let's call it W.",
  metaphor: 'Physicists will tell you the dent is only a picture. Space does not really sag into anything.',
  whatif: 'This hypothesis asks: what if it does? What if W is a real direction, and the dent is really there?'
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

// The sheet is seen from the side from the first frame, tipped as a textbook draws it, flat until the mass
// arrives; its matter lies on it (gridRide), and the lens is off: the textbook picture has none
const TILT = 68
const HOLE_Y = 0.68
const DEEP = 6
// What lies on the sheet is swung round as it falls: it rolls toward the dent and circles it
const WHIRL = {
  gravityInertia: 0.75, orbitalStrength: 80, gravityStrength: 4, gravityReach: 16, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.03, trailIntensity: 0.15,
  depthFade: 0, minOpacity: 0.1, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.3
}
film({
  fps: 60,
  seed: 5,
  settings: {
    blackHoleSize: 8,
    numParticles: 20000,
    lensingEnabled: false,
    lensingRadius: 0,
    nebula: 0.6,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.2,
    starDensity: 0.22,
    gridColor: '#4de3ff',
    gridSheet: 0.85,
    gridTilt: TILT,
    gridDepth: 0,
    gridRings: 40,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridRide: 1,
    // The whole column lies on the sheet: a share of the ride fading with depth left the matter the hole
    // gathers hanging between where it flies and the surface, a white ball over the shadow. Laid wholly,
    // it crowds the steep throat, so half as many particles, dimmer, let the wall show through it
    gridRideSoft: 0.01,
    fieldAtHole: 1,
    blackHoleY: HOLE_Y,
    ...WHIRL,
    // Before the mass arrives nothing pulls: the matter only drifts over the flat sheet
    gravityStrength: 0,
    orbitalStrength: 0,
    baseSpeed: 0.3
  }
})
chapter('05', 'THE TEXTBOOK PICTURE')

// ---- the sheet as the scene lays it out, so that a drawing can lie on it (as in fourth_dimension_well.js) ----
const LONG = 1920
const SHORT = 1080
const SHADOW = 0.08 * SHORT
const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
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
const part = value => +value.toFixed(4)
// The sheet once the dent has sunk: the axes are drawn on it while the camera stands still
const here = laySheet(TILT, DEEP, HOLE_Y)
const on = point => { const [x, y] = here(...point); return { hole: [part(x), part(y)] } }
const X_TIP = [3.6, 0, 0]
const Y_TIP = [-1.5, -3.6, 0]
const W_TOP = [0, 0, 0]
const W_TIP = [0, 0, 0.8]
const wSide = (() => { const [x, y] = here(0, 0, 0.45); return { hole: [part(x - 4.2), part(y)] } })()
const label = (text, seconds, place, more) => caption(text, seconds, { at: place, size: 0.03, font: 'unbounded', fade: 0.4, ...more })

shot('textbook', () => {
  const start = now()
  const spoken = say('textbook')
  status('known', spoken + 0.6)
  at(start + heard('textbook', 'sheet', 0.62), () => { label('a stretched sheet', 3, [0.5, 0.2], { color: INK }) })
  // "a mass makes a dent": the pull comes on and the dent sinks
  at(start + heard('textbook', 'mass', 0.84), () => {
    label('a mass', 3.4, { hole: [2.6, 0.3] }, { color: GOLD })
    to({ gridDepth: DEEP, gravityStrength: WHIRL.gravityStrength, orbitalStrength: WHIRL.orbitalStrength, baseSpeed: 0 }, 2.4)

  })
  wait(spoken + 0.6)
})

shot('roll', () => {
  const start = now()
  const spoken = say('roll')
  status('known', spoken + 0.6)
  // The dent's own move ends inside this line; then the pull grows and more of the sheet rolls in
  at(start + 1.6, () => { to({ gravityStrength: 5, baseBrightness: 0.5 }, spoken - 1.6) })
  const word = (name, share, text, point) => {
    at(start + heard('roll', name, share), () => { label(text, start + spoken + 0.6 - now(), on(point), { size: 0.026, color: INK }) })
  }
  word('orbit', 0.55, 'orbit', [-3.2, 1.2, 0])
  word('apple', 0.72, 'apple', [3.2, 1.6, 0])
  word('weight', 0.92, 'weight', [0, -3.6, 0])
  wait(spoken + 0.6)
})

// The W axis, solid or dashed; each drawing lasts until the next replaces it
const wAxis = (seconds, more) => {
  draw({ kind: 'line', points: [on(W_TOP), on(W_TIP)], arrow: 'end', color: W, width: 0.0065, draw: 0.8, fade: 0.4, ...more }, seconds)
}
let axesEnd = 0
shot('axes', () => {
  const start = now()
  const spoken = say('axes')
  status('known', spoken + 0.6)
  axesEnd = start + spoken + 0.6 + long('metaphor') + 0.6 + long('whatif') + 0.6
  at(start + heard('axes', 'x', 0.3), () => {
    draw({ kind: 'line', points: [on(W_TOP), on(X_TIP)], arrow: 'end', color: X, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    label('X', axesEnd - now(), on([4.1, 0, 0]), { size: 0.034, color: X })
  })
  at(start + heard('axes', 'y', 0.35), () => {
    draw({ kind: 'line', points: [on(W_TOP), on(Y_TIP)], arrow: 'end', color: Y, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    label('Y', axesEnd - now(), on([-1.8, -4.1, 0]), { size: 0.034, color: Y })
  })
  at(start + heard('axes', 'third', 0.6), () => {
    wAxis(start + spoken + 0.6 - now())
    label('*{W}: the depth of the dent', start + spoken + 0.6 - now(), wSide, { size: 0.034, accent: W })
  })
  wait(spoken + 0.6)
})

shot('metaphor', () => {
  const start = now()
  const spoken = say('metaphor')
  status('known', spoken + 0.6)
  // "only a picture": W goes dashed and pale
  wAxis(spoken + 0.6, { dash: true, opacity: 0.35, draw: 0 })
  at(start + heard('metaphor', 'picture', 0.5), () => {
    label('only a picture', start + spoken + 0.6 - now(), wSide, { size: 0.034, color: SOFT })
  })
  wait(spoken + 0.6)
})

shot('whatif', () => {
  const start = now()
  const spoken = say('whatif')
  status('idea', spoken + 0.6)
  // "what if it does?": W comes back solid, and the matter on the sheet falls down it harder
  at(start + heard('whatif', 'does', 0.3), () => {
    wAxis(start + spoken + 0.6 - now(), { draw: 0.6, width: 0.009 })
    to({ gravityStrength: 6 }, 2)
  })
  at(start + heard('whatif', 'w', 0.55), () => { keep('what if *{W} is a real direction?', start + spoken + 0.6 - now()) })
  wait(spoken + 0.6)
})

leave()
