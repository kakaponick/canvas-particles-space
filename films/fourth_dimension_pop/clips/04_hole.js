// The fourth dimension as popular science, clip 4 of films/fourth_dimension_pop/fourth_dimension_pop.json: gravity points inward, and a black hole is where it is strongest: everything falls into it from every side.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop/clips/04_hole.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, together, input */
const LINES = {
  suspect: 'So is there anything in nature that points inward like that? There is one obvious suspect. Gravity.',
  strongest: 'And if you want to understand gravity, go where it is strongest. A black hole.',
  inward: 'Near it, everything falls inward, from every side at once. Not even light finds its way back out.'
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

film({
  fps: 60,
  seed: 4,
  settings: {
    // No hole yet: a speck of one (the pull is measured in its radii), Einstein Radius 0 bends nothing, and
    // the pull gathers the field to the centre from every side; with no flight of its own only what gravity
    // moves is lit
    // In 3D from the first frame: straight on it is the flat picture, and the hole that comes is a body in
    // space. Flat, the Ray Traced lens shows the field as if it lay behind the hole, which ringed the shadow
    // with a black band and a copy of the field. The axis points at the camera (Spin Tilt 0), so the equator
    // faces the screen until the camera climbs to it
    threeD: true,
    threeDEase: 0,
    cameraYaw: 0,
    spinTilt: 0,
    blackHoleSize: 1,
    // The accretion disc the hole is shown by: flow A in the equator, falling slowly inward, traced along the
    // paths of light, so its far side rises over the shadow as an arch. Dark until the hole comes
    flowA: 0,
    flowACount: 9000,
    // The disc is born over a wide band (1.8 to 4.2 radii) and crowds as it closes in, so it is densest
    // near the hole and thins out into the dark at its outer edge
    flowAFrom: 3,
    flowATo: 1.4,
    flowASpread: 2.4,
    flowASwirl: 1.2,
    flowALife: 6,
    flowAThick: 0.03,
    flowATrail: 0.5,
    flowASize: 1.2,
    flowTrace: 1,
    lensingRadius: 0,
    ringBrightness: 0,
    // Before the hole the matter falling to the centre from every side is flow B, turned to face the camera:
    // born from 4 to 116 radii of the speck (past the frame's corners, so no edge of the band shows), falling
    // from rest straight in along its radius, each particle its own fading stroke. The field drawn alone
    // read as an even grain of dim dots with a small burst in the middle (review, 2:09–2:18). Flow B Count
    // swept at this framing over 10000 / 16000 / 24000 / 32000: 10000 is streaks running in from the edges,
    // 24000 and up a carpet
    flowB: 1.8,
    flowBCount: 10000,
    flowBFrom: 60,
    flowBTo: 0.5,
    flowBSpread: 112,
    flowBSwirl: 0,
    flowBLife: 7,
    flowBTrail: 0.6,
    flowBSize: 1.2,
    flowBFace: 1,
    flowBThick: 0,
    flowBColor: '#e8dcc0',
    // The field stays as a sparse dust under the flow, a few thousand particles, so the frame is not grain
    numParticles: 4000,
    // Before the hole the pull is strong and kept (inertia 0.9), and slow strokes are lit (Speed Glow Knee
    // 0.02), so the field is seen falling to the centre from every side while gravity is named
    baseSpeed: 0,
    gravityStrength: 30,
    gravityReach: 200,
    gravityInertia: 0.9,
    orbitalStrength: 0,
    speedGlowKnee: 0.02,
    minOpacity: 0.05,
    trailIntensity: 0.05,
    baseBrightness: 0.6,
    starsBrightness: 1.6,
    starDensity: 0.22,
    gridSky: 0,
    gridColor: '#4de3ff',
    ringDoppler: 0.6,
    ringGlow: 0.6
  }
})
chapter('04', 'GRAVITY AT FULL POWER')

const label = (text, seconds, place, color = INK) => caption(text, seconds, { size: 0.03, font: 'unbounded', color, fade: 0.4, ...place })
// Where the hole arrives, on "where it is strongest": the arrows of the infall hold until it is there
let arrives = 0

shot('suspect', () => {
  const start = now()
  const spoken = say('suspect')
  const end = start + spoken + 0.6
  arrives = end + heard('strongest', 'strongest', 0.45)
  // Gravity named as the thing that points inward like the fourth direction is the hypothesis, as in chapter 01
  status('idea', spoken + 0.6)
  // Arrows from every side to the one centre the matter falls to, on the scene round the speck of a hole
  // (30 to 12 of its radii), held over the line after until the hole arrives there
  at(start + heard('suspect', 'inward', 0.45), () => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4
      const far = { hole: [+(30 * Math.cos(a)).toFixed(3), +(30 * Math.sin(a)).toFixed(3)] }
      const near = { hole: [+(12 * Math.cos(a)).toFixed(3), +(12 * Math.sin(a)).toFixed(3)] }
      draw({ kind: 'line', points: [far, near], arrow: 'end', color: SOFT, width: 0.003, draw: 0.6, fade: 0.4 }, arrives - now())
    }
  })
  at(start + heard('suspect', 'Gravity', 0.93), () => {
    caption('*{gravity}', end - now(), { at: [0.5, 0.16], size: 0.06, font: 'unbounded', accent: GOLD, color: INK, fade: 0.3 })
  })
  until(end)
})

shot('strongest', () => {
  const start = now()
  const spoken = say('strongest')
  status('known', spoken + 0.6)
  // The infall thins over the line toward the hole's arrival, so the matter left in flight drains to the centre
  // instead of vanishing at once
  at(start, () => { to({ flowB: 0 }, Math.max(arrives - start + 1.2, 2.5)) })
  // The hole arrives where everything was falling to, on "where it is strongest", and is grown by "A black hole"
  at(arrives, () => {
    together(
      () => { to({ blackHoleSize: 8, gravityReach: 30, gravityStrength: 5, lensingRadius: 2.5, ringBrightness: 1.5, orbitalStrength: 20, gravityInertia: 0.6, starsBrightness: 2.2 }, 2.4, 'ease') },
      // The field's long trails are cut short before the camera moves, or the move smears them into rain
      () => { to({ trailIntensity: 0.6, baseBrightness: 0.4 }, 0.6); to({ baseBrightness: 0.12 }, 1.4) },
      // The disc lights as the field it grew out of dims, so the shadow reads black
      () => { to({ flowA: 0.7 }, 3) },
      // and the camera climbs to the equator as it lights: the disc turns from a ring round the shadow to the
      // edge-on disc with its arch, never held face on
      () => { wait(1.2); to({ cameraPitch: 78 }, 3, 'ease') }
    )
  })
  // Named once it is there, and held into the next line
  at(arrives + 1.6, () => {
    caption('black hole', start + spoken + 0.6 + heard('inward', 'inward', 0.2) - now(), { at: 'hole', angle: 300, radius: 2.2, size: 0.032, font: 'unbounded', color: INK, fade: 0.4 })
  })
  until(start + spoken + 0.6)
})

shot('inward', () => {
  const start = now()
  const spoken = say('inward')
  const end = start + spoken + 0.6
  status('known', spoken + 0.6)
  // The camera flies in toward the hole, about a sixth of its way (11 radii off at this size)
  meanwhile(() => { to({ cameraMoveIn: 1.8 }, end - now()) })
  // Everything falls inward, from every side: the arrows of chapter 03's last picture, now gravity's, on the
  // hole and in the quiet ink, since this part is known
  at(start + heard('inward', 'inward', 0.2) - 0.3, () => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8
      const far = { hole: [+(4.6 * Math.cos(a)).toFixed(3), +(4.6 * Math.sin(a)).toFixed(3)] }
      const near = { hole: [+(2.4 * Math.cos(a)).toFixed(3), +(2.4 * Math.sin(a)).toFixed(3)] }
      draw({ kind: 'line', points: [far, near], arrow: 'end', color: SOFT, width: 0.003, draw: 0.6, fade: 0.4 }, end - now())
    }
    keep('everything falls *{inward}, from every side', start + heard('inward', 'light', 0.7) - now())
  })
  // and light too: the ring brightens where light circles the hole before it falls in
  at(start + heard('inward', 'light', 0.7) - 0.2, () => {
    to({ ringBrightness: 4 }, 1)
    keep('not even light gets back out', end - now())
  })
  until(end)
})

leave()
