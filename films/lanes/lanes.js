// Полосы: a first-person ride in the traffic of an accretion disc. The disc is three lanes of matter, each a
// flow at its own radius and in its own colour, turning at its own Kepler rate, so the inner lanes overtake
// the outer ones as fast traffic overtakes slow. The camera is a rider low over the disc's plane, a hand's
// breadth above it: it weaves inside a lane, leans into every swerve and pays each lean back with the
// opposite one, changes lanes inward (each lane faster, brighter and hotter than the one before) while the
// shadow and its lens loom larger, and, instead of falling in, is thrown out over the pole on the outflow
// and looks back down at the lanes from above. One continuous scene, no cut and no caption.
//
// The simulation carries the film as much as the camera does. The lanes themselves change under the
// rider: they migrate inward, wind faster as the hole spins up (a lane's Swirl is Kepler's rate times the
// frame dragging's share, 1 + 4.5 a / r^1.5, so the inner lane gains most), breathe in brightness, heat from
// red through gold to blue-white, grow in count, and the inner lane peels off into a fall that lights the
// photon ring. The hole's spin, the ring, the lens (taken from the camera's real place) and the bloom move
// with them; the outflow's plane turns about the pole as a searchlight does.
//
// The spin's axis stands up the screen (Spin Tilt 90, Spin Axis 0) and the flows follow it fully
// (Swirl Follows Spin 1, its curve 0, so any spin at all turns their plane to the hole's equator): the disc
// is level, the camera's Orbit Angle is its bearing round the hole and its Elevation the height over the
// plane. A bearing that circles for more than a turn is Auto Orbit (cameraSpin, a rate), never a yaw key,
// which would wrap at 180.
//
// Colour comes from the disc's temperature, hotter inward: outer lane red-orange, middle gold, inner lane
// pale yellow turning blue-white as the fall quickens; the outflow is white with a cold blue. The sky is
// hydrogen red and oxygen teal, faint.
//
// Written without a preview: nothing here was drawn, checked or rendered, at the operator's word. Check
// it before the first render. What to look at first: whether the lanes lie level (the spin axis up the screen),
// which way the lanes turn against the rider (Swirl's sign and Auto Orbit's were not matched by a picture),
// and whether the hole stays in the frame at the inner lane (Look Aside 34 degrees at 3 radii).
//
// Parameter changes (each value in a `to` or a `set` is a key, a driven value one per leg), counted by the
// script's own arithmetic with the film calls stubbed out, not by the scene: 8 235 in all.
//   camera, 12 legs a second for 62 s on 4 values (moveIn, moveRight, lookYaw, roll)       2 976
//   the lanes, 5 legs a second for 78 s on 13 values (spin, 3 swirls, 6 radii, 3 lights)   5 070
//   the outflow's turning plane (Node), 5 legs a second for 26 s                            132
//   eased moves, colours, counts, ring, lens, bloom and the setups at second 0              ~60
// So the simulation (lanes, spin, ring, outflow) is about 5 270 of them, 64 %, the camera 3 000.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/lanes/lanes.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/lanes/lanes.js films/lanes/out/lanes.mp4
/* global film, set, to, wait, shot, meanwhile, at */

const SIZE = 6
// How far the 3D camera circles from the hole, in its radii: half the frame's long side over the
// shadow's radius (knobs.md section 11)
const AWAY = 960 / (SIZE / 100 * 1080)
const DEGREE = 180 / Math.PI
const clamp = x => Math.min(Math.max(x, 0), 1)
const smooth = x => { const u = clamp(x); return u * u * (3 - 2 * u) }
// The second the outflow takes the outer lane's place, while that lane is dark
const SWAP = 49.6
// The camera's height over the disc's plane through the film is the main script's; the bearing is Auto Orbit
const FAR = 27
const ABOVE = 28

// The three lanes: radius of each (in the hole's radii) as it migrates inward
const rA = t => 9.4 - 0.6 * smooth((t - 8) / 40)
const rB = t => 6.4 - 1.0 * smooth((t - 14) / 40)
const rC = t => 3.9 - 0.9 * smooth((t - 22) / 26)
// The share of the way the rider has crossed to the middle lane and on to the inner one
const toB = t => smooth((t - 19) / 4.5)
const toC = t => smooth((t - 35) / 4.5)
const onA = t => 1 - toB(t)
const onB = t => toB(t) - toC(t)
const onC = t => toC(t)
const lane = t => onA(t) * rA(t) + onB(t) * rB(t) + onC(t) * rC(t)
// The hole's spin winds up; frame dragging adds to a lane's Kepler turn 4.5 a / r^1.5 of itself
const spin = t => 0.5 + 0.485 * smooth((t - 3) / 45)
const swirl = (r, t) => 0.9 * (1 + 4.5 * spin(t) / Math.pow(r, 1.5))

// How much of the weave there is: none on the approach and none once thrown out
const weave = t => smooth((t - 7) / 3) * (1 - smooth((t - 50) / 3))

// The rider's distance from the hole: the approach from far out, the lane it is on, a weave across the
// lane's width, then the throw out to above the disc
const radius = t => {
  const base = lane(t) + (FAR - lane(t)) * (1 - smooth(t / 8))
  const amp = 0.9 * onA(t) + 0.55 * onB(t) + 0.32 * onC(t)
  const across = weave(t) * amp * (0.7 * Math.sin(2 * Math.PI * t / 2.9) + 0.3 * Math.sin(2 * Math.PI * t / 1.7 + 1))
  const here = base + across
  const u = clamp((t - 50) / 11)
  return here + (ABOVE - here) * u * u * (3 - 2 * u)
}
// Sideways, across the heading
const sideways = t => weave(t) * (0.8 * onA(t) + 0.5 * onB(t) + 0.3 * onC(t)) * Math.sin(2 * Math.PI * t / 3.7 + 0.8)
// Where the head looks, right of the hole: the hole stands left in the frame, farther left the nearer it is
const heading = t => (10 + 22 * smooth((t - 5) / 9) + 8 * smooth((t - 35) / 6)) * (1 - smooth((t - 50) / 8))
// The lean: into each weave, each lane change and the approach's turn, every one paid back by its opposite
const lean = t => {
  let roll = -6.5 * weave(t) * Math.cos(2 * Math.PI * t / 3.7 + 0.8)
  if (t > 4 && t < 9) roll -= 8 * Math.sin(2 * Math.PI * (t - 4) / 5)
  if (t > 19 && t < 23.5) roll -= 9 * Math.sin(2 * Math.PI * (t - 19) / 4.5)
  if (t > 35 && t < 39.5) roll -= 11 * Math.sin(2 * Math.PI * (t - 35) / 4.5)
  if (t > 50 && t < 58) roll += 22 * Math.sin(2 * Math.PI * (t - 50) / 8)
  return roll
}

const camera = t => {
  const r = radius(t)
  const side = sideways(t)
  const look = heading(t) - Math.atan2(side, r) * DEGREE + 2.5 * weave(t) * Math.sin(2 * Math.PI * t / 4.3)
  return { cameraMoveIn: AWAY - r, cameraMoveRight: side, cameraLookYaw: look, cameraRoll: lean(t) }
}

// The lanes, at the second t
const pulse = (t, period, phase) => 1 + 0.17 * Math.sin(2 * Math.PI * t / period + phase)
const rise = t => 1 + 0.5 * smooth((t - 6) / 40)
const showing = t => smooth(t / 3.5)
const lanes = t => {
  const out = t >= SWAP
  const brightA = out
    ? 2.4 * smooth((t - 49.8) / 1.8) * (1 - smooth((t - 72) / 5)) * (1 + 0.14 * Math.sin(2 * Math.PI * t / 0.9))
    : 1.3 * showing(t) * (1 + 0.7 * onA(t) * smooth((t - 6) / 3)) * rise(t) * pulse(t, 2.3, 0) * (1 - smooth((t - 46) / 3.2))
  const fall = rC(t) - (rC(t) - 0.7) * smooth((t - 34) / 13)
  return {
    blackHoleSpin: spin(t),
    flowASwirl: out ? 0 : swirl(rA(t), t),
    flowBSwirl: swirl(rB(t), t),
    flowCSwirl: swirl(rC(t), t),
    flowAFrom: out ? 1.3 : rA(t),
    flowATo: out ? 24 : rA(t),
    flowBFrom: rB(t),
    flowBTo: rB(t),
    flowCFrom: rC(t),
    flowCTo: fall,
    flowA: brightA,
    flowB: 1.6 * showing(t) * (1 + 0.6 * onB(t)) * rise(t) * pulse(t, 2.0, 1.3),
    flowC: 2.0 * showing(t) * (1 + 0.5 * onC(t)) * rise(t) * pulse(t, 1.6, 2.1)
  }
}
// The outflow's plane turns once about the pole, as a searchlight does
const searchlight = t => ({ flowANode: Math.min(-180 + 14 * (t - 49.8), 180) })

// Plays `values(t)`, an object of the values at the film's second t, as straight legs of 1/rate s each, from
// the second `from` to the second `until`
const sample = (rate, from, until, values) => {
  const step = 1 / rate
  const legs = Math.round((until - from) * rate)
  for (let leg = 1; leg <= legs; leg++) to(values(from + leg * step), step, 'linear')
}

film({
  size: '1080p', fps: 60, seed: 61, warmup: 0,
  settings: {
    // 3D from the first frame; the flight is off, the lanes are all the matter there is
    threeD: true, threeDEase: 0, fieldEnabled: false, cameraYaw: -130, cameraPitch: 18, cameraSpin: 5,
    cameraFloat: 0.5, cameraBank: 0.2,
    // A hole that spins about the screen's vertical, its disc level
    blackHoleSize: SIZE, spinTilt: 90, spinAxis: 0, orbitalSpinFollow: 1, orbitalSpinFollowCurve: 0,
    ringSpinFollow: 1, ringDoppler: 0.85, frameDrag: 6,
    ringBrightness: 1.2, ringGlow: 0.8, ringColor: '#fff2dc', ringColorApproaching: '#bfe3ff',
    ringColorReceding: '#ff6a2a', ringFeed: 1.5, flowRingFeed: 1, flowRingFlicker: 0.6,
    // The sky: stars with a little blue, hydrogen red and oxygen teal behind them
    starsBrightness: 2, starDensity: 0.2, nebula: 0.5, nebulaScale: 380,
    nebulaColor: '#8a1f1c', nebulaColorDeep: '#14606e', nebulaColorCore: '#ffd9a0',
    bloom: 0.9, bloomThreshold: 0.5, bloomReach: 0.05,
    // Strokes near the camera cross the frame instead of fading out
    flowNearFade: 0.14, flowNearGone: 0.03, flowTrailFade: 1.2, flowDimmest: 0.45,
    // The outer lane, red-orange; the middle, gold; the inner, pale yellow
    flowACount: 14000, flowASpread: 2.2, flowALife: 14, flowATrail: 0.6, flowASize: 1.4, flowAThick: 0.05,
    flowAColor: '#ff4a1c',
    flowBCount: 9000, flowBSpread: 1.5, flowBLife: 12, flowBTrail: 0.6, flowBSize: 1.3, flowBThick: 0.05,
    flowBColor: '#ff9a2a',
    flowCCount: 6000, flowCSpread: 0.9, flowCLife: 7, flowCTrail: 0.5, flowCSize: 1.2, flowCThick: 0.04,
    flowCColor: '#ffe3a8'
  }
})

set({ fade: 1 })
// Where every driven value starts, so the first leg continues it
set(camera(0))
set(lanes(0))

// The camera's four driven values and the lanes' thirteen run under the whole film, on their own clocks
meanwhile(() => { sample(12, 0, 62, camera) })
meanwhile(() => { sample(5, 0, 78, lanes) })
meanwhile(() => { wait(SWAP); sample(5, SWAP, 76, searchlight) })

// The outer lane's slot becomes the outflow while the lane is dark: matter from 1.3 to 24 radii in a plane
// that stands across the equator, a short life so each ray is short, white with a cold blue
at(SWAP, () => {
  set({
    flowATilt: 90, flowASpread: 0.5, flowACount: 7000, flowALife: 2.4, flowATrail: 0.35, flowASize: 1.7,
    flowAThick: 0.18, flowAColor: '#e4f6ff'
  })
})

shot('the road', () => {
  // Out beyond the outer lane and a little above the plane: three bands of matter, red-orange, gold and
  // pale yellow, the inner ones turning visibly faster, the hole's flattened shadow and its lens on one
  // side. The camera drops toward the plane and slides in
  meanwhile(() => { to({ fade: 0 }, 2.2) })
  meanwhile(() => { to({ ringBrightness: 1.5 }, 8) })
  to({ cameraPitch: 8 }, 8)
})

shot('the outer lane', () => {
  // The rider settles in the outer lane, weaving across its width, the lane's strokes sweeping past the
  // camera in long lines, the middle and inner lanes whirling on the far side of the hole. The lane heats
  // from red to orange over the next half minute while the spin starts to wind
  meanwhile(() => { to({ flowAColor: '#ff8a3d' }, 32) })
  meanwhile(() => { to({ cameraSpin: 9 }, 4) })
  meanwhile(() => { to({ flowBCount: 14000 }, 26) })
  to({ cameraPitch: 5 }, 11)
})

shot('into the middle lane', () => {
  // A swerve inward: lean left, then right to straighten. The middle lane is faster and brighter, gold
  // turning to yellow-white, the hole larger and the lens (now taken from the camera's own place) bending
  // the far side of the lanes higher over the shadow
  meanwhile(() => { to({ flowBColor: '#ffd66b' }, 28) })
  meanwhile(() => { to({ cameraSpin: 15 }, 4) })
  meanwhile(() => { to({ lensingFromCamera: 1 }, 24) })
  meanwhile(() => { to({ flowCCount: 15000, flowCColor: '#9fd8ff' }, 20) })
  meanwhile(() => { to({ bloom: 1.4 }, 15) })
  to({ cameraPitch: 4 }, 16)
})

shot('the inner lane', () => {
  // The last lane change, the sharpest. The inner lane is blue-white and fast; frame dragging has wound it
  // well beyond its Kepler rate, and it peels off into a fall that winds into the hole: the photon ring
  // brightens as it is fed. The shadow fills the left of the frame and the camera is almost in the plane
  meanwhile(() => { to({ cameraSpin: 25 }, 4) })
  meanwhile(() => { to({ flowRingFeed: 3, ringBrightness: 2.6, ringGlow: 1.5 }, 14) })
  meanwhile(() => { to({ flowCTrail: 0.3, flowBTrail: 0.45 }, 14) })
  to({ cameraPitch: 3.5 }, 15)
})

shot('thrown out', () => {
  // The outer lane has gone dark behind and returned as an outflow over the pole. The camera is flung
  // up through the fan of rays, its strokes crossing the frame, leaning one way and then the other, the
  // elevation rising from the plane to nearly the pole while the distance grows to 28 radii
  meanwhile(() => { to({ cameraSpin: 7 }, 10) })
  meanwhile(() => { to({ flowCColor: '#7cc4ff', bloom: 0.9 }, 12) })
  to({ cameraPitch: 83 }, 12)
})

shot('from above', () => {
  // Looking down on the disc: the middle lane a ring, the inner lane a spiral falling into the shadow,
  // each turning at its own rate, the outflow's fan sweeping round the pole; the camera backs away
  // slowly, tilts down to a third of the way up the sky and circles
  meanwhile(() => { to({ cameraMoveIn: AWAY - 34, cameraSpin: 4 }, 14.5) })
  meanwhile(() => { to({ flowBThick: 0.1, lensingRadius: 2.4 }, 12) })
  to({ cameraPitch: 58 }, 14.5)
})

to({ fade: 1 }, 3.5)
