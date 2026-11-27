// OGLE-2011-BLG-0462, the first black hole found alone: 7.1 solar masses, about 5000 light years away,
// drifting through the Galaxy at about 45 km/s with no star beside it to give it away. It was found by
// the star behind it, which its lens brightened for some 270 days (Hubble and OGLE, published 2022). The
// hole crosses the crowded star field of the bulge toward Sagittarius; the zoomed camera keeps the hole and
// lets the sky slide past, so every background star swings round the Einstein ring as it goes by.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/ogle_0462/ogle_0462.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/ogle_0462/ogle_0462.js films/ogle_0462/out/ogle_0462.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({
  size: '1080p', fps: 60, seed: 462, preset: 'Schwarzschild', warmup: 3,
  settings: {
    blackHoleSize: 3, lensingRadius: 5, blackHoleX: 0.1, blackHoleY: 0.58, followFrequency: 4,
    starDensity: 0.7, starCell: 14, starsSize: 1.8, starsBrightness: 3.5, starsColorWarm: '#ffcf9a',
    nebula: 0.45, nebulaSparseness: 0.45, nebulaDrift: 0, nebulaColor: '#5a3a26', nebulaColorDeep: '#24140e',
    baseBrightness: 0.3, baseSpeed: 0.8, ringBrightness: 0.6, ringGlow: 0.2, cameraCutZoom: 0.3
  }
})

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }
const smooth = u => u * u * (3 - 2 * u)

set({ fade: 1 })
meanwhile(() => {
  drive({
    blackHoleX: (s, u) => 0.1 + 0.8 * u,
    blackHoleY: (s, u) => 0.58 - 0.16 * u + 0.05 * Math.sin(u * Math.PI)
  }, 60)
})

shot('alone', () => {
  caption('OGLE-2011-BLG-0462 · 5000 световых лет\n7,1 массы Солнца', 10, fact)
  to({ fade: 0 }, 2)
  caption('Одиночная чёрная дыра. Рядом нет звезды,\nи её не видно ни в каком свете', 7, note)
  wait(10)
})

shot('the sky slides past', () => {
  to({ cameraZoom: 4 }, 5)
  caption('Выдаёт её только линза: звёзды позади\nобтекают кольцо Эйнштейна', 7, note)
  wait(15)
})

shot('one star', () => {
  to({ cameraZoom: 7 }, 6, smooth)
  caption('Так её и нашли в 2022 году: одна звезда\nза ней ярчала около 270 дней', 8, note)
  wait(8)
})

shot('wide', () => {
  caption('Она летит сквозь Галактику со скоростью 45 км/с', 6, note)
  to({ cameraZoom: 1 }, 6)
  wait(4)
  to({ fade: 1 }, 4)
})
