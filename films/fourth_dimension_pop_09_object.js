// The fourth dimension as popular science, clip 9 of films/fourth_dimension_pop.json: a neutron star at the bottom of its well, the well deepening until light cannot climb out: an object, not a hole.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_09_object.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  bottom: 'So what sits at the bottom of a well? Start with something we understand. A neutron star: one and a half Suns, crushed into a ball twenty kilometres wide.',
  deeper: 'Pile on more mass, and the well gets deeper, and its walls get steeper.',
  dark: 'At some point they are so steep that even light cannot climb out. From outside, the star goes dark. That is a black hole.',
  thing: 'In this picture it is not a hole in space, and not a tear. It is an object. Very heavy, very small, sitting at the bottom of a very deep well.',
  bold: 'That would mean no singularity where physics breaks. No wormhole. No white hole. Just a heavy object at the bottom of a well. It is one way to picture it.'
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

// What falls toward the hole on the sheet, swung round as it comes: a whirl that drains down the well's wall
const WHIRL = {
  gravityInertia: 0.75, orbitalStrength: 80, gravityStrength: 4, gravityReach: 16, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.03, trailIntensity: 0.15,
  depthFade: 0, minOpacity: 0.1, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.3
}
film({
  fps: 60,
  seed: 9,
  warmup: 10,
  settings: {
    numParticles: 20000,
    lensingEnabled: false,
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
    ringGlow: 1.3,
    gridColor: '#4de3ff',
    gridSheet: 0.85,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridDepth: 2.5,
    blackHoleY: 0.62,
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
    companionSize: 0,
    companionWaves: 0,
    ...WHIRL
  }
})
set({ vignette: 0.4, filmHold: 1 })
chapter('09', 'WHAT A BLACK HOLE IS')

// The star as a drawing over the hole: a white-hot ball and its glow, dark once light cannot climb out
const HOT = '#f3f8ff'
const ball = (color, radius, glow, seconds) => draw({ kind: 'circle', center: { hole: [0, 0] }, radius, fill: color, color, width: 0.001, opacity: 'glow', fade: 1.2, values: { glow } }, seconds)
let dark = 0

shot('bottom', () => {
  const start = now()
  const spoken = say('bottom')
  const end = start + spoken + 0.6
  // The star shines until the line after next says "dark"
  dark = end + long('deeper') + 0.6 + heard('dark', 'dark', 0.7)
  // The star comes up with the picture under the chapter's card, so the hole is never seen bare before it
  const lit = start - 1.2
  at(lit, () => {
    const total = dark + 1.5 - lit
    for (let layer = 0; layer < 6; layer++) {
      const glow = +(0.1 * (1 - layer / 7)).toFixed(3)
      ball(HOT, +(1.12 + layer * 0.2).toFixed(2), [[lit, glow], [dark - 2.5, glow], [dark, 0]], total)
    }
    ball(HOT, 1.02, [[lit, 1], [dark - 2.5, 1], [dark - 1.2, 0.5], [dark, 0]], total)
  })
  // One status over the three shots of measured physics
  status('known', spoken + 0.6 + long('deeper') + 0.6 + long('dark') + 0.4)
  // The mass stays on into the next shot, where its counter climbs from it
  const counted = end + heard('deeper', 'mass', 0.2) + (long('deeper') + 0.6 - heard('deeper', 'mass', 0.2)) / 5
  at(start + heard('bottom', 'neutron', 0.47) - 0.2, () => {
    caption('neutron star', end - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: INK })
  })
  at(start + heard('bottom', 'half', 0.66), () => {
    caption('1.4 M_{☉}', counted + 0.05 - now(), { at: [0.24, 0.3], size: 0.07, font: 'unbounded', color: GOLD })
  })
  at(start + heard('bottom', 'twenty', 0.85), () => {
    caption('20 km', end - now(), { at: [0.76, 0.3], size: 0.07, font: 'unbounded', color: GOLD })
  })
  wait(spoken + 0.6)
})

shot('deeper', () => {
  const start = now()
  const spoken = say('deeper')
  // The mass counter climbs and the well deepens and steepens with it
  const masses = ['1.4', '1.8', '2.2', '2.6', '3']
  const from = start + heard('deeper', 'mass', 0.2)
  const span = spoken + 0.6 - heard('deeper', 'mass', 0.2)
  const step = span / masses.length
  // 1.4 is the last shot's caption, still on
  masses.forEach((mass, index) => {
    if (index === 0) return
    at(from + index * step, () => {
      caption(`${mass} M_{☉}`, +(step + 0.05).toFixed(2), { at: [0.24, 0.3], size: 0.07, font: 'unbounded', color: index ? INK : GOLD, fade: 0.05 })
    })
  })
  at(from - 0.2, () => { to({ gridDepth: 9, blackHoleY: 0.76 }, span) })
  at(start + heard('deeper', 'deeper', 0.55), () => {
    caption('deeper, steeper', start + spoken + 0.6 - now(), { at: [0.76, 0.3], size: 0.04, font: 'unbounded', color: INK })
  })
  wait(spoken + 0.6)
})

shot('dark', () => {
  const start = now()
  const spoken = say('dark')
  const end = start + spoken + 0.6
  caption('3 M_{☉}', end - start, { at: [0.24, 0.3], size: 0.07, font: 'unbounded', color: INK })
  // Light climbs the wall and falls back: each ray lies on the near wall of the well, leaves the star, rises
  // as far as it can and turns back down to it a little further round. A place on the sheet is the well's
  // radii from its middle, `angle` degrees round from the right toward the far side, so -90 faces the camera
  const light = start + heard('dark', 'light', 0.35)
  const RAYS = [[-120, 1.7], [-60, 2.2], [-100, 2.8], [-75, 1.5]]
  RAYS.forEach(([angle, reach], index) => {
    const points = []
    for (let step = 0; step <= 24; step++) {
      const share = step / 24
      const away = 1.04 + (reach - 1.04) * Math.sin(Math.PI * share)
      const turn = (angle + 22 * (share - 0.5)) * Math.PI / 180
      points.push({ sheet: [+(away * Math.cos(turn)).toFixed(4), +(away * Math.sin(turn)).toFixed(4)] })
    }
    at(light - 0.4 + index * 0.35, () => {
      draw({ kind: 'line', points, smooth: true, color: HOT, width: 0.0035, draw: 1.2, fade: 0.5 }, 2.6)
    })
  })
  at(light, () => {
    caption('light falls back', dark - 0.3 - now(), { at: [0.76, 0.3], size: 0.04, font: 'unbounded', color: INK })
  })
  at(dark - 0.5, () => { to({ ringGlow: 0.6 }, 2) })
  at(start + heard('dark', 'black', 0.88) - 0.2, () => {
    caption('black hole', end - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: INK })
  })
  wait(spoken + 0.6)
})

shot('thing', () => {
  const start = now()
  const spoken = say('thing')
  const end = start + spoken + 0.6
  status('idea', spoken + 0.6)
  at(start + heard('thing', 'hole', 0.22) - 0.2, () => {
    caption('a hole', end - now(), { at: [0.36, 0.2], size: 0.05, font: 'unbounded', color: SOFT })
  })
  at(start + heard('thing', 'tear', 0.32), () => {
    draw({ kind: 'line', points: [[0.3, 0.2], [0.42, 0.2]], color: W, width: 0.006, draw: 0.3, fade: 0.3 }, end - now())
  })
  at(start + heard('thing', 'object', 0.4) - 0.2, () => {
    caption('*{an object}', end - now(), { at: [0.64, 0.2], size: 0.05, font: 'unbounded', accent: W })
  })
  at(start + heard('thing', 'bottom', 0.85) - 0.3, () => {
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 1.3, color: W, width: 0.003, fade: 0.3 }, end - now())
    caption('the object', end - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: W })
  })
  keep('Not a hole in space: *{an object} at the bottom of a well.', spoken + 0.4, { at: [0.5, 0.91] })
  wait(spoken + 0.6)
})

shot('bold', () => {
  const start = now()
  const spoken = say('bold')
  // held 1.2 s past the line, so its last caption reads
  const end = start + spoken + 1.8
  status('idea', spoken + 0.6)
  // What the picture would do without, said plainly as the line names it: no verdict on anyone's idea
  const named = (word, share, text, row) => {
    at(start + heard('bold', word, share) - 0.3, () => {
      caption(text, end - now(), { at: [0.8, 0.3 + row * 0.1], size: 0.036, font: 'unbounded', color: SOFT, fade: 0.3 })
    })
  }
  named('singularity', 0.16, 'no singularity', 0)
  named('wormhole', 0.27, 'no wormhole', 1)
  named('white', 0.37, 'no white hole', 2)
  at(start + heard('bold', 'way', 0.85) - 0.3, () => {
    caption('*{one way} to picture it', end - now(), { at: [0.8, 0.62], size: 0.04, font: 'unbounded', color: INK, accent: W, fade: 0.3 })
  })
  wait(spoken + 1.8)
})

leave()
