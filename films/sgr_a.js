// Sagittarius A*, the black hole at the centre of the Milky Way: 4 million solar masses, 26 000 light years
// away. S2 goes round it every 16 years on an ellipse of eccentricity 0.88; its orbit turns a little each
// time (Schwarzschild precession, measured by GRAVITY in 2020). Here the turn is hundreds of times larger,
// which the caption says, so the rosette builds in seconds. Then the S cluster fills in, the camera swings
// over the plane of the orbits and dives at the shadow, where the traced lens copies every orbit into the
// photon rings.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/sgr_a.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/sgr_a.js films/sgr_a.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({
  size: '1080p', fps: 60, seed: 26, preset: 'Schwarzschild', warmup: 3,
  settings: {
    blackHoleSize: 2, orbitCount: 1, orbitSize: 14, orbitEccentricity: 0.88, orbitSizeSpread: 0,
    orbitEccentricitySpread: 0, orbitTrail: 60, orbitStarSize: 3, orbitSpeed: 1.4, orbitClosest: 4,
    baseBrightness: 0.5, starsBrightness: 2.2, starDensity: 0.3, nebula: 0.6,
    nebulaColor: '#4a2c1e', nebulaColorDeep: '#2a1a14',
    threeDEase: 3, cameraYaw: 0, cameraPitch: 0, cameraCutZoom: 0.3
  }
})

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })

shot('S2', () => {
  caption('Sgr A* · центр Млечного Пути\n26 000 световых лет · 4 млн масс Солнца', 12, fact)
  to({ fade: 0 }, 2)
  caption('Звезда S2 обходит дыру за 16 лет\nпо вытянутому эллипсу: e = 0,88', 7, note)
  wait(12)
})

shot('rosette', () => {
  caption('С каждым оборотом эллипс поворачивается.\nУ S2 на 12′, здесь в сотни раз сильнее', 8, note)
  to({ cameraZoom: 1.6 }, 12)
})

shot('the S cluster', () => {
  set({ orbitSize: 9, orbitSizeSpread: 1.2, orbitEccentricitySpread: 0.5, orbitTrail: 14, orbitCount: 8 })
  set({ threeD: true })
  meanwhile(() => {
    to({ cameraPitch: 55 }, 5)
    wait(2)
    to({ cameraPitch: 15 }, 5)
  })
  caption('Рядом с ней — десятки других S-звёзд', 6, note)
  drive({ cameraYaw: (s, u) => 110 * (u * u * (3 - 2 * u)) }, 12)
})

shot('dive', () => {
  set({ threeD: false, orbitTrail: 6 })
  meanwhile(() => {
    wait(1)
    set({ orbitCount: 24 })
    wait(2)
    set({ orbitCount: 40 })
  })
  wait(1.5)
  caption('12.05.2022: телескоп горизонта событий\nпоказал тень Sgr A*', 8, note)
  to({ cameraZoom: 4 }, 14, 'in')
})

shot('out', () => {
  to({ cameraZoom: 1 }, 3, 'in')
  wait(1.5)
  to({ fade: 1 }, 2)
})
