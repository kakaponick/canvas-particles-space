// The fourth dimension as popular science, clip 4 of films/fourth_dimension_pop.json: gravity points inward, and a black hole is where it is strongest: its shadow, its ring and its bent sky.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_04_hole.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input */
const LINES = {
  suspect: 'So is there anything in nature that points inward like that? There is one obvious suspect. Gravity.',
  strongest: 'And if you want to understand gravity, go where it is strongest. A black hole.',
  anatomy: 'Here is the anatomy. The dark disc is the shadow: light that goes in never comes back. Around it, a thin ring, where light circles the hole. And beyond that, the whole sky, bent out of shape.',
  sixty: 'This one weighs as much as ten Suns. And its horizon is only sixty kilometres across.',
  photographed: 'None of this is speculation. We have photographed two of them.'
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
    flowAFrom: 2.6,
    flowATo: 1.4,
    flowASpread: 1.6,
    flowASwirl: 1.2,
    flowALife: 6,
    flowAThick: 0.03,
    flowATrail: 0.5,
    flowASize: 1.2,
    flowTrace: 1,
    lensingRadius: 0,
    ringBrightness: 0,
    numParticles: 40000,
    baseSpeed: 0,
    gravityStrength: 12,
    gravityReach: 200,
    gravityInertia: 0.5,
    orbitalStrength: 0,
    trailIntensity: 0.08,
    baseBrightness: 2,
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

shot('suspect', () => {
  const start = now()
  const spoken = say('suspect')
  const end = start + spoken + 0.6
  status('known', spoken + 0.6)
  // Arrows from every side to the one centre the field falls to
  at(start + heard('suspect', 'inward', 0.45), () => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4
      const far = [0.5 + 0.3 * Math.cos(a) * 0.5625, 0.5 + 0.3 * Math.sin(a)]
      const near = [0.5 + 0.12 * Math.cos(a) * 0.5625, 0.5 + 0.12 * Math.sin(a)]
      draw({ kind: 'line', points: [far, near], arrow: 'end', color: SOFT, width: 0.003, draw: 0.6, fade: 0.4 }, end - now())
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
  // The hole arrives where everything was falling to
  at(start + heard('strongest', 'hole', 0.85), () => {
    caption('black hole', spoken + 0.6 - heard('strongest', 'hole', 0.85), { at: 'hole', angle: 300, radius: 2.2, size: 0.032, font: 'unbounded', color: INK, fade: 0.4 })
    to({ blackHoleSize: 8, gravityReach: 30, gravityStrength: 5, lensingRadius: 2.5, ringBrightness: 1.5, orbitalStrength: 20, gravityInertia: 0.6, starsBrightness: 2.2 }, 2.4, 'ease')
    // The disc lights as the field it grew out of dims, so the shadow reads black, and the camera climbs to
    // the equator: the disc turns from a ring round the shadow to the edge-on disc with its arch
    to({ flowA: 0.7, baseBrightness: 0.12 }, 3)
    to({ cameraPitch: 78 }, 5, 'ease')
  })
  until(start + spoken + 0.6)
})

shot('anatomy', () => {
  const start = now()
  const spoken = say('anatomy')
  const end = start + spoken + 0.6
  status('known', spoken + 0.6)
  meanwhile(() => { to({ cameraZoom: 1.3 }, end - now()) })
  const tShadow = start + heard('anatomy', 'shadow', 0.22)
  const tRing = start + heard('anatomy', 'ring', 0.55)
  const tSky = start + heard('anatomy', 'sky', 0.88)
  at(tShadow, () => { label('shadow', end - now(), { at: 'hole', angle: 205, radius: 0.5 }) })
  at(tShadow + 1.2, () => { keep('Light that goes in never comes back.', tRing - now()) })
  at(tRing, () => {
    to({ ringBrightness: 4 }, 1)
    // Below the arch, where the ring shows clear of the disc
    label('photon ring', end - now(), { at: 'hole', angle: 320, radius: 1.02 })
  })
  // The sky behind: a lensed grid, so the bending shows
  at(tSky - 0.8, () => { to({ gridSky: 0.6 }, 1.2) })
  at(tSky, () => { label('bent sky', end - now(), { at: 'einstein', angle: 140, radius: 1.8 }) })
  until(end)
})

shot('sixty', () => {
  const start = now()
  const spoken = say('sixty')
  const end = start + spoken + 0.6
  status('known', spoken + 0.6)
  at(start + heard('sixty', 'Suns', 0.5), () => {
    caption('10 M_{☉}', end - now(), { at: [0.2, 0.3], size: 0.07, font: 'unbounded', color: GOLD, fade: 0.4 })
  })
  at(start + heard('sixty', 'sixty', 0.8), () => {
    caption('horizon: 60 km across', end - now(), { at: [0.8, 0.3], size: 0.04, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('r_{s} = 2GM / c^{2} ≈ 30 km', end - now(), { at: [0.8, 0.7], size: 0.036, font: 'noto', color: INK, fade: 0.4 })
  })
  until(end)
})

shot('photographed', () => {
  const start = now()
  const spoken = say('photographed')
  const end = start + spoken + 0.6
  status('known', spoken + 0.6)
  at(start + heard('photographed', 'photographed', 0.7), () => {
    caption('M87* · 2019', end - now(), { at: [0.2, 0.3], size: 0.04, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('Sagittarius A* · 2022', end - now(), { at: [0.8, 0.3], size: 0.04, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('Event Horizon Telescope', end - now(), { at: [0.5, 0.16], size: 0.03, font: 'unbounded', color: SOFT, fade: 0.4 })
  })
  until(end)
})

leave()
