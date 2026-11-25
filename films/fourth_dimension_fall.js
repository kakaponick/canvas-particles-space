// The fourth dimension, clip 4 of films/fourth_dimension.json: the fall. A spinning black hole in its lattice,
// seen by a camera that circles it and then goes in until the shadow fills the frame; the reel dissolves from
// there into the fall into the Mandelbrot set.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_fall.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, mark, now, at, meanwhile, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const W = '#ff3b5c'

film({
  fps: 60,
  seed: 17,
  warmup: 8,
  settings: {
    blackHoleSize: 8,
    numParticles: 40000,
    threeD: true,
    threeDEase: 0,
    cameraYaw: -40,
    cameraPitch: 24,
    cameraSpin: 5,
    blackHoleSpin: 0.9,
    spinTilt: 70,
    spinAxis: 20,
    frameDrag: 5,
    // A disc of matter in space: it keeps its speed along all three directions and circles the hole
    gravityInertia: 0.95,
    baseSpeed: 0.4,
    gravityStrength: 6,
    gravityReach: 12,
    orbitalStrength: 80,
    baseBrightness: 2,
    speedGlow: 0.3,
    ringSpinFollow: 1,
    ringDoppler: 0.85,
    ringGlow: 0.8,
    nebula: 1,
    nebulaScale: 700,
    nebulaSparseness: 0.38,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    nebulaColorCore: '#ff7ab8',
    nebulaCore: 0.5,
    starsBrightness: 1.8,
    starDensity: 0.25,
    gridColor: '#4de3ff',
    gridLattice: 0.4,
    gridLatticeCell: 1.6,
    gridLatticeWarp: 8,
    orbitCount: 9,
    orbitSize: 4.4,
    orbitEccentricity: 0.5,
    orbitTrail: 14,
    orbitStarSize: 3
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

shot('only a hypothesis', () => {
  wait(1)
  const spoken = say('hypothesis', 8.3)
  caption('for now: a *{hypothesis}', spoken, { at: [0.5, 0.84], size: 0.045, font: 'unbounded', accent: W, plate: 0.65 })
  wait(spoken + 1)
})

shot('already falling', () => {
  const start = now()
  const spoken = say('falling', 9.7)
  const falling = start + heard('falling', 'falling', 8.3)
  // The camera leaves its circle and goes in, until the shadow is all there is
  at(start + heard('falling', 'remember', 2.5), () => {
    to({ cameraMoveIn: 8.4, cameraZoom: 2.6, gridLattice: 0.7 }, falling + 1.6 - now(), 'in')
  })
  at(start + heard('falling', 'remember', 2.5) + 1.3, () => {
    caption('a direction you cannot point to', falling - 0.6 - now(), { at: [0.5, 0.84], size: 0.04, font: 'noto', plate: 0.6 })
  })
  wait(spoken + 2)
})
