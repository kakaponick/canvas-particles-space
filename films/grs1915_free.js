// GRS 1915+105 again (films/grs1915.js), shot with a camera that leaves its circle round the hole: it
// opens looking away into the stream and swings its head onto the hole, pushes in with a slow roll, flies
// past the shadow 3.2 radii to its side with its head turned to keep the hole in frame, drops under it,
// comes back to Earth's view close to the flattened limb in slow motion, and pulls away. The hole is the
// same: 12 solar masses, spin 0.98, seen at 66° with the jets along position angle 151°.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/grs1915_free.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/grs1915_free.js films/grs1915_free.mp4
/* global film, set, to, drive, wait, shot, caption, slow, meanwhile */
film({
  size: '1080p', fps: 60, seed: 1915, preset: 'Kerr', warmup: 5,
  settings: {
    blackHoleSize: 9, blackHoleSpin: 0.98, spinTilt: 66, spinAxis: 151, ringSide: 5.8,
    ringDoppler: 0.6, ringBrightness: 1.5, ringGlow: 0.7, frameDrag: 6, gravityInertia: 0.85,
    gravityStrength: 4, gravityDepth: 40, cameraZoom: 1.2, starsBrightness: 1.8,
    threeD: true, threeDEase: 0, cameraYaw: 0, cameraPitch: 8,
    cameraLookYaw: 60, cameraLookPitch: -8, cameraRoll: -12, cameraMoveIn: -6
  }
})

// How far the camera circles from the hole, in its radii: half the frame's long side over the shadow's
// radius, 960 / (9% of 1080)
const AWAY = 960 / (0.09 * 1080)
const DEGREE = 180 / Math.PI
const smooth = u => u * u * (3 - 2 * u)
const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })

shot('out of the dark', () => {
  caption('GRS 1915+105 · созвездие Орла\n28 000 световых лет · 12 масс Солнца', 9, fact)
  meanwhile(() => { to({ fade: 0 }, 2.5) })
  meanwhile(() => { to({ cameraMoveIn: 0 }, 9, 'out') })
  wait(1.5)
  to({ cameraLookYaw: 0, cameraLookPitch: 0, cameraRoll: 0 }, 6, 'spring')
  wait(1.5)
})

shot('the vortex', () => {
  caption('Спин выше 0,98: дыра вращается почти\nна пределе, и пространство вращается с ней', 7, note)
  to({ cameraMoveIn: 4, cameraPitch: 22, cameraRoll: 7 }, 10)
})

shot('fly-by', () => {
  // Beside the hole and level with it, then on past it, the head turned to hold the hole in the middle
  // and the camera banking into the turn
  const right = s => 3.2 * smooth(Math.min(s / 4, 1))
  const ahead = (s, u) => 4 + (AWAY - 0.3 - 4) * smooth(u)
  const look = (s, u) => -Math.atan2(right(s), AWAY - ahead(s, u)) * DEGREE
  meanwhile(() => { to({ cameraPitch: 0 }, 5) })
  caption('Пролёт в трёх радиусах от тени', 5, { ...note, from: 6 })
  drive({
    cameraMoveRight: right,
    cameraMoveIn: ahead,
    cameraLookYaw: look,
    cameraRoll: (s, u) => 7 * (1 - smooth(Math.min(s / 3, 1))) + 0.22 * look(s, u)
  }, 14)
})

shot('under', () => {
  caption('Закрутка частиц усилена в 6 раз', 5, note)
  to({
    cameraMoveIn: 3, cameraMoveRight: 0, cameraLookYaw: 0, cameraRoll: 0, cameraPitch: -35, cameraYaw: 70, ringDoppler: 0.25
  }, 10)
  wait(2)
})

shot('the limb', () => {
  caption('Край, летящий к нам, сплющен и ярче:\nсвет огибает дыру вслед за её вращением', 9, note)
  to({ cameraYaw: 0, cameraPitch: 0, cameraMoveIn: 6, cameraMoveRight: 0.9, cameraMoveUp: -0.45, ringDoppler: 0.8 }, 5)
  slow(0.25, () => { wait(4) })
})

shot('away', () => {
  to({ cameraMoveIn: -25, cameraMoveRight: 0, cameraMoveUp: 0, cameraRoll: 20 }, 4, 'in')
  to({ fade: 1 }, 2)
})
