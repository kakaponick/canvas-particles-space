// GW150914, the first gravitational wave ever heard: two black holes of 36 and 29 solar masses, 1.3 billion
// light years away, merged on 14 September 2015. The companion is 29/36 of the main hole, so its size is
// 0.8. The gap closes by the real inspiral law, r ∝ (t_merge − t)^¼, so the pair lingers wide and plunges
// in the last seconds. The camera rides the smaller hole, swings into 3D over the sheet, and is above it
// when the merger folds the sheet into spiral arms.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/gw150914/gw150914.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/gw150914/gw150914.js films/gw150914/out/gw150914.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile, slow */
film({
  size: '1080p', fps: 60, seed: 15, preset: 'Schwarzschild', warmup: 4,
  settings: {
    blackHoleSize: 7, companionSize: 0.8, companionDistance: 12, companionSpeed: 3, companionWaves: 3,
    gridSheet: 0.6, gridTilt: 66, gridDepth: 3, gridWaveLift: 12, baseBrightness: 1, starsBrightness: 1.6,
    threeDEase: 3, cameraYaw: 0, cameraPitch: 0
  }
})

const MERGE = 44
const inspiral = u => 1 - Math.pow(1 - u, 0.25)
const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })
meanwhile(() => { to({ companionDistance: 0 }, MERGE, inspiral) })

shot('far', () => {
  caption('GW150914 · 14.09.2015\n1,3 млрд световых лет', 9, fact)
  to({ fade: 0 }, 2)
  wait(1)
  caption('Две чёрные дыры: 36 и 29 масс Солнца', 5.5, note)
  wait(6)
})

shot('riding the smaller one', () => {
  to({ cameraZoom: 2.4 }, 3)
  caption('Каждый оборот пары даёт два гребня волны', 6, note)
  to({ cameraPair: 1 }, 2.5)
  wait(2.5)
  to({ cameraPair: 0, cameraZoom: 1 }, 2)
})

shot('into space', () => {
  set({ threeD: true })
  meanwhile(() => {
    to({ cameraPitch: 32 }, 4)
  })
  drive({ cameraYaw: (s, u) => 150 * (u * u * (3 - 2 * u)) }, 15)
})

shot('plunge', () => {
  caption('LIGO услышал последние 0,2 секунды:\n8 колебаний, от 35 до 150 Гц', 7, note)
  to({ cameraPitch: 58, cameraZoom: 1.4 }, 9)
})

shot('merger', () => {
  slow(0.2, () => { wait(4) })
})

shot('ringdown', () => {
  caption('Три массы Солнца ушли в гравитационные волны.\nОсталась одна дыра: 62 массы Солнца', 8, note)
  to({ cameraPitch: 72, cameraZoom: 1 }, 7)
  wait(3)
  to({ fade: 1 }, 3)
})
