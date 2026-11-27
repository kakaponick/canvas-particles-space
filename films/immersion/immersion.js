// Погружение: a showcase of the 3D scene, one unbroken descent from hyperspace into the shadow. The camera
// never stands still: it comes out of a jump along the flight, steps off the axis to see the flight as a
// column round the hole, rises over the disc that column winds into, flies past the spinning hole through
// the plane of its disc, circles a cloud of stars on tilted orbits, watches two holes merge, and dives into
// an accretion disc seen as light sees it until the shadow takes the frame.
//
// Colour comes from the physics: the flight's Doppler blue ahead and red at the edges, hydrogen red and
// oxygen teal in the nebula, a gold disc with a cyan fall, the traced disc's approaching side blue-white and
// its receding side red. A slow throb of bloom runs under the whole film.
//
// The paths no ease draws are functions (drive, 60 keys a second): the roll of the jump (841 keys), the
// fly-by (4 values, 3 364) and the dive (4 values, 3 364); with about 130 eased moves and setups between
// shots and the bloom's 72 beats (144 keys) the film is about 7 800 parameter changes over 145 seconds.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/immersion/immersion.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/immersion/immersion.js films/immersion/out/immersion.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile, fire, slow, at, now */
film({
  size: '1080p', fps: 60, seed: 2026, warmup: 3,
  settings: {
    // 3D from the first frame, looking straight along the flight
    threeD: true, threeDEase: 0, cameraYaw: 0, cameraPitch: 0, cameraFloat: 0.4, cameraBank: 0.18,
    // The jump: a dense, fast flight tinted by its Doppler shift
    numParticles: 60000, baseSpeed: 60, trailIntensity: 0.1, baseBrightness: 1.6,
    flightTintFrom: 4, flightTintFull: 50, flightTintLimit: 0.85, flightTintGradient: 1.6,
    flightTintAhead: '#47d4ff', flightTintEdge: '#ff7a1f', flightTintBehind: '#ff2d55',
    colorPalette: [
      { r: 140, g: 205, b: 255, percent: 25 },
      { r: 255, g: 255, b: 255, percent: 35 },
      { r: 255, g: 196, b: 120, percent: 25 },
      { r: 255, g: 130, b: 80, percent: 15 }
    ],
    // The sky: hydrogen red and oxygen teal over bright stars
    starsBrightness: 2, nebula: 0.6, nebulaScale: 420,
    nebulaColor: '#b3202a', nebulaColorDeep: '#127a7a', nebulaColorCore: '#ffcf8a',
    blackHoleSize: 7, ringBrightness: 2, ringGlow: 1,
    bloom: 0.9, bloomThreshold: 0.6, bloomReach: 0.05,
    // The disc's three flows, dark until the disc shot: a gold ring, a cyan fall winding in, a white fan of
    // outflow over the poles
    flowA: 0, flowACount: 4000, flowAFrom: 3.2, flowATo: 3.2, flowASpread: 1.6, flowASwirl: 1.2,
    flowALife: 10, flowATrail: 0.9, flowASize: 1.3, flowAColor: '#ffb347',
    flowB: 0, flowBCount: 9000, flowBFrom: 11, flowBTo: 0.6, flowBSpread: 8, flowBSwirl: 0.8,
    flowBLife: 6, flowBTrail: 0.6, flowBSize: 1.2, flowBColor: '#5fd4ff',
    flowC: 0, flowCCount: 1500, flowCFrom: 1.2, flowCTo: 16, flowCSpread: 0.6, flowCSwirl: 0,
    flowCLife: 2.5, flowCTrail: 0.25, flowCSize: 1.6, flowCTilt: 90, flowCThick: 0.05, flowCColor: '#eaf6ff'
  }
})

const smooth = u => u * u * (3 - 2 * u)
const DEGREE = 180 / Math.PI
// How far the 3D camera circles from the hole, in its radii: half the frame's long side over the shadow's
// radius (knobs.md section 11)
const away = size => 960 / (size / 100 * 1080)

// The field as a disc in 3D (films.md, section 16, "circle in a disc"): inertia keeps the orbits, the swirl
// lays them in the plane across the flight
const DISC_LOOK = {
  gravityInertia: 0.95, baseSpeed: 0.6, gravityStrength: 6, gravityReach: 12, orbitalStrength: 80,
  speedGlow: 0.3, trailIntensity: 0.08
}

// From one setup of the scene to the next through black
const through = change => {
  to({ fade: 1 }, 1)
  change()
  wait(0.3)
  to({ fade: 0 }, 1.2)
}

set({ fade: 1 })

shot('прыжок', () => {
  // The flight at 60 rushes out of the hole's place, blue ahead and red at the edges, and slows out of
  // the jump while the camera sways through two barrel rolls
  meanwhile(() => { to({ fade: 0 }, 2) })
  meanwhile(() => { wait(7); to({ baseSpeed: 5 }, 7, 'out') })
  drive({ cameraRoll: s => 45 * Math.sin(2 * Math.PI * s / 7) }, 14)
})

shot('колонна', () => {
  // Off the axis the flight is a column streaming past the hole; gravity takes it and starts to wind it
  // into a disc, and the gold ring lights round the shadow
  meanwhile(() => { wait(6); to(DISC_LOOK, 4) })
  meanwhile(() => { wait(8); to({ flowA: 1.6 }, 4) })
  to({ cameraYaw: 75, cameraPitch: 12 }, 7)
  to({ cameraYaw: 130, cameraPitch: 26, cameraMoveIn: 3 }, 9)
})

shot('диск', () => {
  // A flash at the hole, and the fall and the outflow join the ring. The camera climbs over the disc,
  // then drops almost into its plane, where the near side crosses the shadow and the lens lifts the far
  // side over it
  fire('glare', 'shockwave', 'burst')
  meanwhile(() => { to({ flowB: 1.4, flowC: 1.8 }, 3) })
  to({ cameraYaw: 165, cameraPitch: 75, cameraMoveIn: 5 }, 9)
  to({ cameraYaw: 95, cameraPitch: 10 }, 11)
  to({ cameraYaw: 20, cameraPitch: 5, cameraMoveIn: 4 }, 4)
})

shot('пролёт', () => {
  // The hole spins up and drags its disc round; the camera lines up on the axis and flies past the
  // shadow 3.2 radii to its side, its head turned to hold the hole and banking into the turn, until it
  // hangs just before the disc's plane, the ring of matter edge on beside it
  meanwhile(() => { to({ blackHoleSpin: 0.95, spinTilt: 25, frameDrag: 5, ringDoppler: 0.85 }, 4) })
  to({ cameraYaw: 0, cameraPitch: 0 }, 4)
  const AWAY = away(7)
  const right = s => 3.2 * smooth(Math.min(s / 4, 1))
  const ahead = (s, u) => 4 + (AWAY - 0.3 - 4) * smooth(u)
  const look = (s, u) => -Math.atan2(right(s), AWAY - ahead(s, u)) * DEGREE
  drive({
    cameraMoveRight: right,
    cameraMoveIn: ahead,
    cameraLookYaw: look,
    cameraRoll: (s, u) => 0.22 * look(s, u)
  }, 14)
})

through(() => {
  set({
    cameraYaw: -120, cameraPitch: 40, cameraMoveIn: 0, cameraMoveRight: 0, cameraLookYaw: 0, cameraRoll: 0,
    flowA: 0.9, flowB: 0, flowC: 0, baseBrightness: 1.1, blackHoleSpin: 0.97, spinTilt: 30,
    orbitCount: 24, orbitSize: 5.5, orbitEccentricity: 0.55, orbitEccentricitySpread: 0.5, orbitTrail: 14,
    orbitInclination: 60, orbitDrag: 8, orbitStarSize: 3
  })
})

shot('орбиты', () => {
  // Stars swing past the hole on tilted ellipses, each in a plane of its own, and the spin turns those
  // planes; the camera circles the cloud in one long move
  to({ cameraYaw: -40, cameraPitch: 25 }, 7)
  to({ cameraYaw: 40, cameraPitch: 45, cameraMoveIn: 3 }, 7)
  to({ cameraYaw: 110, cameraPitch: 20, cameraMoveIn: 1 }, 6)
})

through(() => {
  set({
    fieldEnabled: false, orbitCount: 0, blackHoleSpin: 0, spinTilt: 0, frameDrag: 1, blackHoleSize: 6,
    companionSize: 0.8, companionDistance: 9, companionSpeed: 2.2, companionTilt: 65, companionNode: 90,
    companionWaves: 2.5, gridSky: 0.3, gridColor: '#3d7bff', nebula: 0.9, starsBrightness: 2.4,
    ringBrightness: 2.5, ringGlow: 1.2,
    cameraYaw: 25, cameraPitch: 15, cameraMoveIn: 0,
    // A ring of matter round each hole: gold round the main one, cyan round the second
    flowA: 1.6, flowACount: 2500, flowAFrom: 2.4, flowATo: 2.4, flowASpread: 0.9, flowASwirl: 1.4,
    flowALife: 8, flowAPair: -1,
    flowB: 1.6, flowBCount: 2500, flowBFrom: 2.4, flowBTo: 2.4, flowBSpread: 0.9, flowBSwirl: 1.4,
    flowBLife: 8, flowBTrail: 0.9, flowBSize: 1.2, flowBPair: 1
  })
})

shot('слияние', () => {
  // Two holes on a tilted orbit close in, faster with every turn, passing one before the other; their
  // rings go out as they touch, the merged hole rings in slow motion and the camera pulls back from the
  // wave crossing the lensed grid
  meanwhile(() => { to({ cameraYaw: -30, cameraPitch: 5 }, 16) })
  meanwhile(() => { wait(13.5); to({ flowA: 0, flowB: 0 }, 2) })
  to({ companionDistance: 0 }, 16, 'in')
  meanwhile(() => { to({ cameraMoveIn: -6, cameraPitch: 18 }, 7) })
  slow(0.3, () => { wait(3) })
  wait(4)
})

through(() => {
  // An accretion disc as light sees it (the guide's recipe "A disc as light sees it"), 10 degrees above
  // its plane, its Doppler sides blue-white and red
  set({
    companionSize: 0, gridSky: 0, nebula: 0.35, starsBrightness: 1.6, blackHoleSize: 10, ringBrightness: 1.5,
    lensingTraced: true, lensingFromCamera: 0, lensingRadius: 6,
    flowTrace: 1, flowTraceTint: 1, ringColorApproaching: '#bfe6ff', ringColorReceding: '#ff5a1f',
    flowA: 1, flowACount: 30000, flowAFrom: 4.5, flowATo: 1.2, flowASpread: 2, flowASwirl: 0.6, flowALife: 40,
    flowATrail: 3, flowASize: 1, flowAThick: 0, flowAPair: -1, flowB: 0,
    cameraYaw: 0, cameraPitch: -80, cameraMoveIn: -4, cameraRoll: 0
  })
})

shot('погружение', () => {
  // The camera comes up to the disc, then falls: faster and faster, rolling, the lens taken from where
  // the camera really is, until the shadow fills the frame
  to({ cameraMoveIn: 0 }, 4)
  const NEAR = away(10) - 0.7
  meanwhile(() => { wait(12); to({ fade: 1 }, 2) })
  drive({
    cameraMoveIn: (s, u) => NEAR * u * u,
    lensingFromCamera: (s, u) => smooth(u),
    cameraRoll: (s, u) => 170 * u * u * u,
    cameraPitch: (s, u) => -80 + 12 * smooth(u)
  }, 14)
})

shot('титр', () => {
  caption('ПОГРУЖЕНИЕ', 4, { at: 'center', font: 'unbounded', size: 0.07, weight: 300, color: '#eaf6ff' })
  wait(4.5)
})

// A slow throb of bloom under the whole film, one beat every two seconds
const END = now()
at(0, () => {
  while (now() + 2 <= END) {
    to({ bloom: 1.9 }, 0.3, 'out')
    to({ bloom: 0.9 }, 1.7, 'in')
  }
})
