// The fourth dimension, clip 5 of films/fourth_dimension/fourth_dimension.json: the fall. A spinning black hole in its lattice,
// seen by a camera that circles it and then goes in until the shadow is all there is. The film ends in that
// dark, on its own figure: a circle inside a circle, the one direction left drawn in red, and the title.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension/clips/05_fall.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#c9d4f0'

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
  // The dark comes with the shadow: the picture is black as the camera arrives and the line ends
  wait(Math.max(spoken - 1.2, falling + 0.4 - start))
  to({ fade: 1 }, 1.4)
})

// The last card, on the black the camera fell into. The frame is 16 wide and 9 high, and a radius is a share
// of its height, so a point of a circle stands 9/16 of that far along the frame
shot('the fourth dimension', () => {
  const centre = [0.5, 0.36]
  const outer = 0.125
  const inner = 0.042
  const along = radius => 0.5 - radius * 9 / 16
  const hold = 7
  wait(0.4)
  draw({ kind: 'circle', center: centre, radius: outer, color: INK, width: 0.003, draw: 1.3, fade: 0.9 }, hold)
  wait(0.5)
  draw({ kind: 'circle', center: centre, radius: inner, color: INK, width: 0.003, draw: 1, fade: 0.9 }, hold - 0.5)
  wait(0.7)
  draw({
    kind: 'line', arrow: 'end', points: [[along(outer), centre[1]], [along(inner + 0.012), centre[1]]], color: W, width: 0.0045, draw: 1.1, fade: 0.9
  }, hold - 1.2)
  wait(0.9)
  caption('THE *{FOURTH} DIMENSION', hold - 2.1, { at: [0.5, 0.63], size: 0.062, font: 'unbounded', accent: W, fade: 0.9 })
  wait(0.8)
  caption('a hypothesis', hold - 2.9, { at: [0.5, 0.735], size: 0.034, font: 'noto', color: SOFT, fade: 0.9 })
  wait(hold - 2.9 + 0.5)
})
