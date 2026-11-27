// Соперники: two rival black holes that borrow matter from each other, and every gain costs them. One
// continuous scene, one pair, 82 seconds, no cut: the physics is what moves.
//
// The idea. Hole A (main, a ring of fire-orange matter) and hole B (the companion, a ring of ice-blue matter)
// pass matter back and forth in twelve transfers, faster and faster. The matter in transit is a third flow,
// a small bright ring that hops along the line between the holes (flowCPair slides from the giver's hole to
// the taker's) and collapses into the taker. The taker is rewarded: its ring brightens, thickens, widens and
// turns faster, its spin goes up (accretion spins a hole up), the pair's mass shifts toward it, a bloom flash
// marks the moment. The cost is the pair's: every transfer drops companionDistance a step and the distance
// also creeps lower in between, so by Kepler's law the pair turns faster with every gift; the waves grow, the
// pull on the field strengthens, the lens widens. Colours mix as matter passes: both flows slide, a twelfth
// of the way at each transfer, from fire and ice toward the warm and cold white that light of both colours
// would add up to. After the last transfer both holes grab at once, the distance plunges to 0 over 8.5 s
// (the pair whips round, the swirl of both rings climbs with it), they merge, the merged hole rings in slow
// motion, and the one hole that is left wears both colours: two rings crossing at it in the pale fire and
// ice, its ring's approaching side ice-blue and its receding side orange (Doppler).
//
// The tether. The camera is a cable between the two holes: it hangs between them (cameraMoveIn takes it from
// the far view in to a few radii from the pair's centre), cameraPair slides the view to the hole that is
// taking, and from 34 s to 58 s cameraYaw is driven by the orbit's own phase, integrated in the script from
// the same distance and speed the film plays (the law is stepPair's: Kepler, omega = speed * 1.2 * 2.598 /
// (size / 100) * sqrt(1 / orbit^3) with orbit = distance * 2.598 in main radii), so the camera twists back
// and forth as a cable would, once for every two turns of the pair, faster as the pair closes. Pitch and
// roll lean slowly under it. The camera only serves the physics: about a fifth of the keys.
//
// Colours: fire #ff6a14 and ice #14b8ff, the colours of the two sides of a Doppler-shifted ring and of
// hydrogen red and oxygen teal in the sky behind; the nebula is red and teal over bright stars, the lensed
// grid a deep blue. No violet, lilac or pink.
//
// Key tally, counted by hand (the film was written without a preview or a check and has not been run):
//   companionDistance, one drive over 66.3 s ................. 3 978  the cost, the whole law of the film
//   flowCPair, 12 hops of 1.3 s (78 keys each) ................ 936   the matter crossing
//   swirl of both rings, one drive over 8.5 s, 2 values ....... 1 020  the plunge
//   cameraYaw, one drive over 24 s ............................ 1 440  the cable's twist
//   12 transfers, 22 values each, an anchor and a target ....... 528
//   12 transfers, the hop's brightness, fall, colour, the bloom 180
//   the camera's eased lanes (zoom, in, pitch, roll, pair) ..... 110
//   the plunge, the merger and the ending, the pair's speed .... 75
//   total about 8 270 parameter changes; about 6 200 of them are the physics (distance, hops, swirl,
//   transfers), about 1 550 the camera.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/rivals.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/rivals.js films/rivals.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile, slow, at, now */
const FIRE = '#ff6a14'
const ICE = '#14b8ff'
const FIRE_PALE = '#ffe0b0'
const ICE_PALE = '#c8f0ff'

const D0 = 13.5 // the gap at the start, in main radii
const DEND = 3.2 // the gap after the last transfer
const PLUNGE_AT = 57.5
const MERGED_AT = 66
const DRIVE_END = 66.3
const BEAT_DUR = 1.6 // a transfer's gift: the gap drops over this
const SIZE = 6.5 // blackHoleSize at the start, the pair's time scale

film({
  size: '1080p', fps: 60, seed: 77, warmup: 8,
  settings: {
    // 3D from the first frame, looking along the flight with the camera well out from the pair
    threeD: true, threeDEase: 0, cameraYaw: 0, cameraPitch: 10, cameraFloat: 0.5, cameraBank: 0.14,
    cameraZoom: 1, cameraPair: 0, cameraMoveIn: 0,
    // The pair: equal holes on a tilted orbit; the plane precesses with the spins
    blackHoleSize: SIZE, companionSize: 1, companionDistance: D0, companionSpeed: 1.2, companionTilt: 62,
    companionNode: 90, companionWaves: 1.5, companionClosest: 0.8, companionPrecession: 4,
    companionSpin: 1.5, companionOval: 8, blackHoleSpin: 0.5, companionOwnSpin: 0.5, frameDrag: 3,
    // The field falls toward both holes and is carried round them by inertia: matter that gravity lights
    numParticles: 50000, baseSpeed: 0.5, gravityStrength: 3.5, gravityReach: 16, gravityInertia: 0.88,
    orbitalStrength: 60, baseBrightness: 1.3, trailIntensity: 0.12, speedGlow: 0.4, particleSize: 2.4,
    colorPalette: [
      { r: 255, g: 130, b: 60, percent: 30 },
      { r: 90, g: 200, b: 255, percent: 30 },
      { r: 255, g: 255, b: 255, percent: 25 },
      { r: 255, g: 205, b: 120, percent: 15 }
    ],
    // The lens, the rings, the halo
    lensingRadius: 1.7, ringBrightness: 2, ringGlow: 0.8, ringDoppler: 0.2,
    bloom: 1.1, bloomThreshold: 0.5, bloomReach: 0.05,
    // The sky: hydrogen red and oxygen teal over bright stars, the lensed grid a box of blue lines
    starsBrightness: 2, nebula: 0.5, nebulaScale: 420, nebulaColor: '#a8281a', nebulaColorDeep: '#127a7a',
    nebulaColorCore: '#ffcf8a', gridSky: 0.3, gridColor: '#4a86ff',
    // A ring of matter round each hole, in its colour; the third flow is the matter in transit, dark until
    // a transfer sends it across
    flowPairPlane: 1,
    flowA: 1.4, flowACount: 3500, flowAFrom: 2.6, flowATo: 2.6, flowASpread: 0.8, flowASwirl: 1.3,
    flowALife: 7, flowATrail: 0.9, flowASize: 1.3, flowAColor: FIRE, flowAPair: -1,
    flowB: 1.4, flowBCount: 3500, flowBFrom: 2.6, flowBTo: 2.6, flowBSpread: 0.8, flowBSwirl: 1.3,
    flowBLife: 7, flowBTrail: 0.9, flowBSize: 1.3, flowBColor: ICE, flowBPair: 1,
    flowC: 0, flowCCount: 1800, flowCFrom: 1.5, flowCTo: 1.5, flowCSpread: 0.35, flowCSwirl: 2,
    flowCLife: 3, flowCTrail: 0.5, flowCSize: 1.6, flowCColor: '#ffffff', flowCPair: -1
  }
})

const smooth = u => u * u * (3 - 2 * u)
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
const mix = (a, b, k) => { const x = rgb(a); const y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * k)) }

// The twelve transfers: second, who takes, weight of the step the gap drops by
const BEATS = [
  [8, 'A', 1.5], [14, 'B', 1.4], [19.5, 'A', 1.2], [25, 'B', 1.1], [30, 'A', 1.0], [34.5, 'B', 0.9],
  [38.5, 'A', 0.8], [42, 'B', 0.7], [45, 'A', 0.6], [47.8, 'B', 0.55], [50.4, 'A', 0.5], [53, 'B', 0.45]
]

// The gap as a polyline: a creep before each transfer, a step during it; then the plunge. The same function
// drives companionDistance and the camera's phase, so they agree
const KNOTS = [[0, D0]]
{
  const total = BEATS.reduce((sum, beat) => sum + beat[2], 0)
  const scale = (D0 - DEND) / (total * 1.1)
  let level = D0
  for (const [t, , weight] of BEATS) {
    const drop = weight * scale
    level -= 0.1 * drop
    KNOTS.push([t, level])
    level -= drop
    KNOTS.push([t + BEAT_DUR, level])
  }
  KNOTS.push([PLUNGE_AT, DEND])
}
const gap = t => {
  if (t >= PLUNGE_AT) {
    const u = Math.min((t - PLUNGE_AT) / (MERGED_AT - PLUNGE_AT), 1)
    return DEND * (1 - Math.pow(u, 2.2))
  }
  for (let i = 1; i < KNOTS.length; i++) {
    if (t <= KNOTS[i][0]) {
      const a = KNOTS[i - 1]
      const b = KNOTS[i]
      return a[0] === b[0] ? b[1] : a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])
    }
  }
  return DEND
}
const pace = t => t < 50 ? 1.2 + 0.3 * t / 50 : 1.5 + 0.5 * Math.min((t - 50) / 16, 1)

// The pair's phase, integrated as stepPair does it for two equal holes at the starting size
const OMEGA_UNIT = 1.2 * 2.598 / (SIZE / 100)
const omega = t => OMEGA_UNIT * pace(t) / Math.pow(Math.max(gap(t), 1.6) * 2.598, 1.5)
const PHASE = [0]
for (let i = 0; i < 83 * 60; i++) PHASE.push(PHASE[i] + omega(i / 60) / 60)
const phase = t => PHASE[Math.min(Math.round(t * 60), PHASE.length - 1)]

const lane = (key, knots, from = 0) => at(from, () => {
  let clock = from
  for (const [t, v] of knots) { to({ [key]: v }, t - clock); clock = t }
})

// What each hole holds, and the transfers
const hole = { A: { bright: 1.4, count: 3500, ring: 2.6, swirl: 1.3 }, B: { bright: 1.4, count: 3500, ring: 2.6, swirl: 1.3 } }
const gain = f => { f.bright = Math.min(f.bright * 1.12, 3.4); f.count = Math.min(f.count * 1.12, 9000); f.ring *= 1.07; f.swirl *= 1.1 }
const cost = f => { f.bright = Math.max(f.bright * 0.93, 0.9); f.count = Math.max(f.count * 0.93, 2200); f.ring *= 0.96; f.swirl *= 0.97 }
const around = who => who === 'A' ? -1 : 1
let massA = SIZE
let massB = SIZE
let spinA = 0.5
let spinB = 0.5
let pull = 3.5
let inertia = 0.88
let ringLight = 2
let waves = 1.5
let lens = 1.7
let colourA = FIRE
let colourB = ICE
const pairLane = [[0, 0]]

BEATS.forEach(([t, takes], i) => {
  const giver = takes === 'A' ? 'B' : 'A'
  gain(hole[takes])
  cost(hole[giver])
  if (takes === 'A') { massA += 0.3; massB -= 0.2; spinA = Math.min(spinA + 0.1, 0.9); spinB = Math.max(spinB - 0.05, 0.2) } else { massB += 0.3; massA -= 0.2; spinB = Math.min(spinB + 0.1, 0.9); spinA = Math.max(spinA - 0.05, 0.2) }
  pull += 0.25
  inertia += 0.0033
  ringLight += 0.08
  waves += 0.12
  lens += 0.04
  const share = (i + 1) / BEATS.length * 0.8
  const before = { A: colourA, B: colourB }
  colourA = mix(FIRE, FIRE_PALE, share)
  colourB = mix(ICE, ICE_PALE, share)
  const takerColour = takes === 'A' ? colourA : colourB
  const giverColour = before[giver]
  const state = {
    flowA: hole.A.bright, flowB: hole.B.bright, flowACount: hole.A.count, flowBCount: hole.B.count,
    flowAFrom: hole.A.ring, flowATo: hole.A.ring, flowBFrom: hole.B.ring, flowBTo: hole.B.ring,
    flowASwirl: hole.A.swirl, flowBSwirl: hole.B.swirl, flowAColor: colourA, flowBColor: colourB,
    blackHoleSize: massA, companionSize: massB / massA, blackHoleSpin: spinA, companionOwnSpin: spinB,
    gravityStrength: pull, gravityInertia: inertia, ringBrightness: ringLight, companionWaves: waves, lensingRadius: lens
  }
  const bloomRest = 1.1 + 0.03 * i
  pairLane.push([t + 0.8, around(takes)])
  at(t, () => {
    // The gift lights the taker's ring: a flash of bloom that settles
    meanwhile(() => { to({ bloom: 2.2 }, 0.25, 'out'); to({ bloom: bloomRest }, 1.6, 'in') })
    // The matter in transit: a small ring lights at the giver, in the giver's colour, slides along the line
    // to the taker and takes its colour on the way, then falls into it and goes dark
    meanwhile(() => {
      set({ flowCPair: around(giver), flowCColor: giverColour })
      to({ flowC: 2 }, 0.3, 'out')
      meanwhile(() => { to({ flowCColor: takerColour }, 1.3) })
      to({ flowCPair: around(takes) }, 1.3, smooth)
      meanwhile(() => { to({ flowC: 0 }, 0.6, 'in') })
      to({ flowCTo: 0.5 }, 0.6, 'in')
      set({ flowCTo: 1.5 })
    })
    // The reward and the cost together
    to(state, BEAT_DUR + 0.4)
  })
})

set({ fade: 1 })

// The cost: the gap, one law for the whole film. A creep and a step for each transfer, a pause after the
// twelfth, then the plunge to nothing
meanwhile(() => { drive({ companionDistance: s => gap(s) }, DRIVE_END) })
// Kepler turns the pair faster as the gap falls; the rate of its time rises too
at(0, () => { to({ companionSpeed: 1.5 }, 50, 'linear'); to({ companionSpeed: 2 }, 16, 'linear') })

// The camera: a cable between the holes
lane('cameraZoom', [[7.5, 1], [9.5, 1.4], [56, 1.4], [59, 1], [82, 1]])
lane('cameraMoveIn', [[8, 3.5], [20, 6.5], [34, 5.2], [46, 7.8], [57, 9.5], [63, 10.3], [66, 9], [70, 6], [76, 0], [82, -3]])
lane('cameraPitch', [[0, 10], [8, 22], [20, 8], [34, 28], [46, -12], [58, 20], [66, 35], [72, 60], [82, 70]])
lane('cameraRoll', [[12, 8], [24, -10], [40, 14], [52, -16], [60, 25], [66, 0], [76, -8], [82, 0]])
lane('cameraPair', [...pairLane.slice(1), [59, 0], [82, 0]], 0)
lane('cameraYaw', [[8, 18], [20, -25], [34, 30]])
// 34 to 58 s: the cable's twist, once for every two turns of the pair, faster as the pair closes
at(34, () => {
  drive({
    cameraYaw: s => {
      const u = s / 24
      return 30 - 30 * smooth(u) + 38 * Math.pow(Math.sin(Math.PI * u), 0.7) * Math.sin(phase(34 + s) / 2)
    }
  }, 24)
})
lane('cameraYaw', [[66, 45], [76, 100], [82, 150]], 58)

// The plunge: both holes grab at once. The pull, the waves, the lens, the spins and both rings go up, the
// rings' swirl climbs with the pair's turn, and the sky's grid lights
at(PLUNGE_AT, () => {
  meanwhile(() => {
    drive({
      flowASwirl: (s, u) => hole.A.swirl + 3.5 * Math.pow(u, 2.2),
      flowBSwirl: (s, u) => hole.B.swirl + 3.5 * Math.pow(u, 2.2)
    }, MERGED_AT - PLUNGE_AT)
  })
  meanwhile(() => {
    to({
      gravityStrength: 12, gravityInertia: 0.95, companionWaves: 7, lensingRadius: 2.8, ringBrightness: 4.5,
      blackHoleSpin: 0.9, companionOwnSpin: 0.9, frameDrag: 8, flowA: 3, flowB: 3, flowACount: 9000,
      flowBCount: 9000, bloom: 2.4, gridSky: 0.6
    }, MERGED_AT - PLUNGE_AT, 'in')
  })
})
// The merged hole's ring takes both colours: ice on the side turning to us, fire on the other
at(62, () => { to({ ringDoppler: 0.85, ringColorApproaching: '#6fe0ff', ringColorReceding: '#ff6a1a' }, 6) })
// What is left: two rings crossing at the one hole, in the pale fire and ice, its spin still high
at(MERGED_AT, () => {
  meanwhile(() => { to({ flowBTilt: 70, flowASwirl: 1.8, flowBSwirl: 1.8, flowA: 2.2, flowB: 2.2 }, 4) })
  meanwhile(() => { to({ flowAFrom: 3.6, flowATo: 3.6, flowBFrom: 3, flowBTo: 3, bloom: 1.4 }, 5) })
})

shot('двое', () => {
  // Two equal holes on a tilted orbit 13 radii apart, a ring of fire round one and of ice round the other,
  // the field a dust the pair's gravity leans toward them; the camera far out, drifting in
  to({ fade: 0 }, 2.5)
  wait(8)
})

shot('долги', () => {
  // Six transfers: the giver's ring dims and narrows, a small white ring hops along the line between the
  // holes taking the taker's colour and drops into it; the taker's ring blooms, thickens and turns faster,
  // and the gap falls a step. The view slides to the taker each time and the camera swings in
  wait(26)
})

shot('ускорение', () => {
  // Six more, every three seconds and closer: the pair's turn quickens (about 5 s a turn at the end), its
  // waves stretch the grid and the nebula, the camera, now between them, twists with the orbit
  wait(23.5)
})

shot('провал', () => {
  // Both grab; the gap falls from 3.2 radii to nothing, the turn whips round, the rings spin up, the shadows
  // touch and become one oval
  wait(MERGED_AT - PLUNGE_AT)
})

shot('одна', () => {
  // The merged hole rings in slow motion, its spin drags the field, two rings cross at it in the pale fire
  // and ice, its Doppler ring ice on one side and orange on the other; the camera backs away and rises
  wait(0.4)
  slow(0.3, () => { wait(3.6) })
  wait(2)
  caption('ОДНА', 6, { at: 'center', font: 'unbounded', size: 0.07, weight: 300, color: '#eaf6ff' })
  wait(7)
  to({ fade: 1 }, 3)
})
