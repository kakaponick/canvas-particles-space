// The last parsec. Two galaxies merge, and their black holes settle into the common centre as a pair. They
// close in only by throwing out the stars that pass between them, each of which leaves faster than it came and
// takes a share of the orbit with it; once the stars that can pass are spent, the pair stalls about a parsec
// apart, where gravitational waves alone would take some 35 ages of the universe to finish it. In 2023 the
// pulsar timing arrays heard a hum that such pairs most likely make, so they do get through, and how is open.
//
// The look is a draughtsman's: the sheet as a square mesh, seen from far below, so that the two wells hang
// from it like a ceiling over the camera, in cold colours only, with the notes written by hand on the drawing
// (films/last_parsec/letters.py draws them; the scene's caption faces are all set type).
//
// The stars are the field's particles, at rest until the pair's pull moves them: with all their speed kept
// (Inertia 1) and no swirl of the scene's own, those that pass near the moving pair leave faster than they
// came, and burn brighter for it, since a particle is as bright as it is fast. What is thrown out is not made
// again near the pair, so the cloud round it empties by itself. The pair does not feel what it throws: its
// approach is keyed here, a step for each stretch of throwing, and stops when the stars do.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/last_parsec/last_parsec.js out.jpg
/* global film, set, to, wait, shot, draw, now, at, meanwhile */

// The width of each note, in shares of the frame's short side, as films/last_parsec/letters/letters.json gives it
const WIDE = {
  title: 0.6051, merged: 0.6255, heavy: 0.2227, light: 0.2426, stars: 0.4171, pass: 0.4921, takes: 0.4671, shrinks: 0.0662, empty: 0.4083,
  stall: 0.1157, period: 0.3111, waves: 0.4199, age: 0.3324, hum: 0.6898, through: 0.3986, how: 0.3144
}
const INK = '#d6e8ff'
const LEAD = '#9cc6ff'

// A note written on the drawing, for its seconds from now
function note (name, center, seconds, fade = 0.5) {
  draw({ kind: 'image', src: `films/last_parsec/letters/${name}.png`, center, width: WIDE[name], fade }, seconds)
}
// The main hole's radius on the screen, in shares of the short side, as this camera sees it (from the stills);
// a place at a hole measures in its own radii, and the second hole's are 0.7 of these
const RADIUS = { hole: 0.033, companion: 0.033 * 0.7 }
// A note that rides one of the holes, with no leader
function pinned (name, hole, away, seconds) {
  draw({ kind: 'image', src: `films/last_parsec/letters/${name}.png`, center: { [hole]: away }, width: +(WIDE[name] / RADIUS[hole]).toFixed(2), fade: 0.5 }, seconds)
}
// A note that rides one of the holes, `away` radii from its centre, with a leader line from the shadow's edge
// toward it, as a drawing's callout
function callout (name, hole, away, seconds) {
  const [x, y] = away
  const length = Math.hypot(x, y)
  const reach = length - (WIDE[name] / RADIUS[hole]) * 0.32
  draw({ kind: 'image', src: `films/last_parsec/letters/${name}.png`, center: { [hole]: away }, width: +(WIDE[name] / RADIUS[hole]).toFixed(2), fade: 0.5 }, seconds)
  draw({ kind: 'line', points: [{ [hole]: [+(x / length * 1.15).toFixed(3), +(y / length * 1.15).toFixed(3)] }, { [hole]: [+(x / length * reach).toFixed(3), +(y / length * reach).toFixed(3)] }], color: LEAD, width: 0.0012, draw: 0.6, fade: 0.5 }, seconds)
}

film({
  fps: 60,
  seed: 4,
  warmup: 0.5,
  settings: {
    // Seen from far below: the 3D camera behind the sheet's far side, turned over, so the sheet is a ceiling
    // and each well hangs from it toward the camera with its hole at the tip
    threeD: true,
    threeDEase: 0,
    cameraYaw: 180,
    cameraPitch: -65,
    cameraRoll: 180,
    // The mesh: square cells, which both wells dent alike (the rings and spokes are the main hole's alone)
    gridSheet: 0.55,
    gridRings: 0,
    gridCell: 3,
    gridDepth: 6,
    gridSpan: 2,
    gridFade: 0.4,
    gridWell2Bottom: 1,
    gridColor: '#7fb2ff',
    // The pair: the lighter one is 0.7 of the heavier (10^9 and 7·10^8 suns)
    blackHoleSize: 4,
    companionSize: 0.7,
    companionDistance: 7,
    companionSpeed: 1.2,
    companionWaves: 0,
    ringColor: '#e4f0ff',
    ringColorApproaching: '#eef7ff',
    ringColorReceding: '#3f63ff',
    // The stars of the old cores: at rest until the pair moves them, keeping all the speed it gives
    numParticles: 5000,
    baseSpeed: 0,
    gravityInertia: 1,
    orbitalStrength: 0,
    gravityReach: 30,
    gravityStrength: 1,
    speedGlow: 2,
    speedGlowKnee: 0.08,
    trailIntensity: 0.15,
    particleSize: 2.5,
    particleSizeMin: 2.5,
    colorPalette: [
      { r: 215, g: 235, b: 255, enabled: true, percent: 60 },
      { r: 130, g: 185, b: 255, enabled: true, percent: 30 },
      { r: 120, g: 255, b: 235, enabled: true, percent: 10 }
    ],
    starsColorWarm: '#cfe0ff',
    starsColorCool: '#8fb8ff'
  }
})

// The scene holds still under the title, so the cloud is whole when the picture comes up
set({ fade: 1, speed: 0 })
// The camera drifts round under the ceiling the whole time, so the mesh never stands quite still
meanwhile(() => { wait(9.6); to({ cameraYaw: 168, cameraPitch: -61 }, 70, 'linear') })

shot('title', () => {
  note('title', [0.5, 0.47], 4.6, 0.8)
  wait(5.2)
  note('merged', [0.5, 0.5], 5.6, 0.7)
  wait(4.4)
})

// Each stretch of throwing takes a step off the gap; the steps shrink as the cloud thins
const STEPS = [[6.3, 1.6], [5.8, 1.6], [5.5, 1.8], [5.35, 2]]

shot('the pair, and the stars round it', () => {
  meanwhile(() => { to({ fade: 0 }, 3) })
  meanwhile(() => { to({ speed: 0.6 }, 2.5) })
  wait(2.5)
  callout('heavy', 'hole', [5, 2.5], 7)
  callout('light', 'companion', [-7, -3.5], 7)
  wait(3.5)
  note('stars', [0.5, 0.86], 5.5)
  wait(6)
})

shot('thrown out', () => {
  const start = now()
  // The gap as a drawing's dimension, from centre to centre, and the steps it takes
  draw({ kind: 'line', points: [{ hole: [0, 0] }, { companion: [0, 0] }], arrow: 'both', color: LEAD, width: 0.0014, draw: 0.8, fade: 0.5 }, 39)
  meanwhile(() => {
    wait(2)
    for (const [gap, seconds] of STEPS) { to({ companionDistance: gap }, seconds, 'out'); wait(3.2) }
  })
  note('pass', [0.3, 0.85], 6.5)
  wait(7)
  note('takes', [0.3, 0.85], 6.5)
  pinned('shrinks', 'companion', [0, -2.6], 13)
  wait(7)
  note('empty', [0.3, 0.85], 5.5)
  wait(20 - (now() - start))
})

shot('stalled', () => {
  pinned('stall', 'companion', [0, -2.6], 19)
  note('period', [0.3, 0.85], 5.5)
  wait(6)
  note('waves', [0.3, 0.85], 6)
  wait(6.5)
  note('age', [0.3, 0.85], 5.5)
  wait(6.5)
})

shot('the hum', () => {
  // The camera goes on down and away from the pair, which is left as it is. The hum itself is not drawn: the
  // scene's waves are a merger's, a ringing hole's or this pair's own, and none of them is the hum of many
  meanwhile(() => { to({ cameraMoveIn: -14 }, 18, 'linear') })
  note('hum', [0.5, 0.85], 6.5)
  wait(7)
  note('through', [0.5, 0.85], 5)
  wait(5.5)
  note('how', [0.5, 0.85], 4.5)
  wait(5.5)
})
