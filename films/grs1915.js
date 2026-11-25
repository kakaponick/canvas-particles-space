// GRS 1915+105, a black hole of about 12 solar masses in Aquila, 28 000 light years away, spinning at
// a/M above 0.98, close to the limit. Its jets leave at about 66° to the line of sight, along position
// angle 151° on the sky, so spinTilt is 66 and spinAxis 151, and the approaching limb is at 180° + 151° (ringSide 5.8 on its slider).
// Space near the hole turns with it: the particles' drag is raised six times over the physical share
// (frameDrag 6) and the captions say so. The camera flies over the hole and under it in 3D, comes back to
// Earth's view and dives at the flattened limb in slow motion.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/grs1915.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/grs1915.js films/grs1915.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile, slow */
film({
  size: '1080p', fps: 60, seed: 1915, preset: 'Kerr', warmup: 5,
  settings: {
    blackHoleSize: 9, blackHoleSpin: 0.98, spinTilt: 66, spinAxis: 151, ringSide: 5.8,
    ringDoppler: 0.8, ringBrightness: 1.5, ringGlow: 0.7, frameDrag: 6, gravityInertia: 0.85,
    gravityStrength: 4, gravityDepth: 40, cameraZoom: 1.5, starsBrightness: 1.8,
    threeDEase: 3, cameraYaw: 0, cameraPitch: 0, cameraCutZoom: 0.3
  }
})

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })

shot('vortex', () => {
  caption('GRS 1915+105 · созвездие Орла\n28 000 световых лет · 12 масс Солнца', 12, fact)
  to({ fade: 0 }, 2)
  caption('Спин выше 0,98: дыра вращается почти\nна пределе, и пространство вращается с ней', 8, note)
  wait(12)
})

shot('over and under', () => {
  set({ threeD: true })
  meanwhile(() => {
    to({ ringDoppler: 0.25 }, 3)
    to({ cameraPitch: 70 }, 8)
    to({ cameraPitch: -45 }, 9)
  })
  caption('Сбоку видно: частицы уносит вокруг оси.\nЗакрутка здесь усилена в 6 раз', 7, note)
  drive({ cameraYaw: (s, u) => 150 * (u * u * (3 - 2 * u)) }, 20)
})

shot('back to Earth', () => {
  to({ cameraYaw: 0, cameraPitch: 0 }, 5)
  set({ threeD: false })
  to({ ringDoppler: 0.8 }, 2)
})

shot('the flat limb', () => {
  caption('Край, летящий к нам, сплющен и ярче:\nсвет огибает дыру вслед за её вращением', 9, note)
  to({ cameraZoom: 4.5, cameraX: 0.8, cameraY: -0.45 }, 5)
  slow(0.2, () => { wait(4) })
  wait(1)
})

shot('away', () => {
  to({ cameraZoom: 1, cameraX: 0, cameraY: 0 }, 4, 'in')
  wait(3)
  to({ fade: 1 }, 2)
})
