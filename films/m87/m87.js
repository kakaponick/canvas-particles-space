// M87*, the first black hole ever imaged (Event Horizon Telescope, 10 April 2019): 6.5 billion solar masses,
// 55 million light years away. Seen from Earth its spin axis is 17° off the line of sight and points away
// (spinTilt 163); the jet runs to the right on the sky, so the spin's projection points left (spinAxis 108)
// and the approaching limb, the bright one in the EHT image, is at the bottom (ringSide 288°, 5.05 on its slider). The camera
// flies in from afar (the traced lens places it by lensingRadius), circles the hole in 3D with the spin
// axis standing in space, and comes back to where Earth sees it from.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/m87/m87.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/m87/m87.js films/m87/out/m87.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({
  size: '1080p', fps: 60, seed: 87, preset: 'Kerr', warmup: 4,
  settings: {
    blackHoleSize: 12, blackHoleSpin: 0.9, spinTilt: 163, spinAxis: 108, ringSide: 5.05,
    ringDoppler: 0.55, ringColor: '#ffb070', ringGlow: 0.9, ringBrightness: 1.6, lensingRadius: 5,
    orbitCount: 28, orbitSize: 2.8, orbitEccentricity: 0.2, orbitTrail: 5, orbitStarSize: 2,
    orbitSizeSpread: 0.15, orbitEccentricitySpread: 0.2,
    starDensity: 0.35, starsBrightness: 2.2, starsColorWarm: '#ffc890', baseBrightness: 0.6,
    threeDEase: 3, cameraYaw: 0, cameraPitch: 0
  }
})

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })

shot('approach', () => {
  caption('M87* · галактика M87 в созвездии Девы\n55 млн световых лет · 6,5 млрд масс Солнца', 14, fact)
  meanwhile(() => { to({ fade: 0 }, 2.5) })
  meanwhile(() => {
    wait(4)
    caption('Тень этой дыры в 11 раз шире\nорбиты Нептуна', 7, note)
  })
  to({ lensingRadius: 1.7, cameraZoom: 1.25 }, 18, 'ease')
})

shot('around', () => {
  set({ threeD: true })
  meanwhile(() => {
    to({ ringDoppler: 0.2 }, 3)
    to({ cameraPitch: 40 }, 8)
    to({ cameraPitch: -20 }, 9)
  })
  caption('Спин около 0,9. Рядом с такой дырой\nничто не может стоять на месте', 7, note)
  drive({ cameraYaw: (s, u) => 160 * (u * u * (3 - 2 * u)) }, 20)
})

shot('from Earth', () => {
  meanwhile(() => { to({ cameraYaw: 0, cameraPitch: 0 }, 6) })
  wait(6)
  set({ threeD: false })
  to({ ringDoppler: 0.55 }, 2)
  caption('10 апреля 2019 года: первое изображение\nчёрной дыры. Ярче край, где газ летит к нам', 8, note)
  wait(6)
})

shot('the bright limb', () => {
  to({ cameraZoom: 3.2, cameraY: -0.8, cameraX: 0.3 }, 6)
  to({ fade: 1 }, 2)
})
