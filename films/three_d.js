// The scene in three dimensions, shown by one thing: the camera leaves the line of flight. It opens straight
// on, where everything lies in one picture and the scene reads flat, and every shot after that is a place
// the flat scene could not be seen from. A disc that lies in the hole's equator and passes before the
// shadow, an equator that leans with the spin and takes the disc along, stars each on a plane of its own,
// two holes on a tilted orbit that pass one before the other, a sheet whose well runs down to the hole.
// It ends where it began, straight on, over the sheet.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/three_d.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/three_d.js films/three_d.mp4
/* global film, set, to, drive, wait, shot, caption, together */
film({
  size: '1080p', fps: 60, seed: 7, warmup: 4,
  settings: {
    blackHoleSize: 7, starsBrightness: 1.8, starDensity: 0.2, nebula: 0.45, nebulaScale: 300,
    threeDEase: 5, numParticles: 40000, baseSpeed: 3.5, baseBrightness: 1.6
  }
})

const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.55 }
const say = (text, play) => caption(text, play, note)
// From one setup of the scene to the next through black
const through = change => {
  to({ fade: 1 }, 1)
  change()
  wait(0.4)
  to({ fade: 0 }, 1.2)
}

// The disc: a ring that circles and a fall that winds into it, all the matter there is
const DISC = {
  flowA: 1.8, flowACount: 3500, flowAFrom: 3.2, flowATo: 3.2, flowASpread: 1.6, flowASwirl: 1.2, flowALife: 10,
  flowATrail: 0.9, flowASize: 1.3,
  flowB: 1.5, flowBCount: 9000, flowBFrom: 11, flowBTo: 0.6, flowBSpread: 8, flowBSwirl: 0.8, flowBLife: 6,
  flowBTrail: 0.6, flowBSize: 1.2
}

set({ fade: 1 })
shot('along the flight', () => {
  // The flight comes at the camera out of the point where the hole stands: one picture, no depth in it
  to({ fade: 0 }, 1.5)
  say('Вид вдоль полёта. Отсюда сцена плоская', () => { wait(3.5) })
})

shot('off the axis', () => {
  // The same flight is a column of matter, and the hole stands in the middle of it
  set({ cameraYaw: 82, cameraPitch: 12, threeD: true })
  say('Камера сходит с оси: полёт оказывается колонной, а дыра стоит внутри неё', () => { wait(8) })
})

through(() => {
  set({ fieldEnabled: false, threeDEase: 0, cameraYaw: 0, cameraPitch: 0, ...DISC })
})

shot('the disc', () => {
  // Matter circles the hole in its equator; the camera rises over it and goes round
  say('Диск лежит в экваторе дыры', () => {
    to({ cameraPitch: 64 }, 6)
  })
  say('Ближняя сторона проходит перед тенью, дальнюю линза поднимает над ней', () => {
    together(() => { to({ cameraYaw: 70 }, 8, 'linear') }, () => { to({ cameraPitch: 74 }, 8) })
  })
})

shot('the spin', () => {
  // The hole spins about an axis that leans: its equator leans with it, and the disc follows
  set({ spinTilt: 0, spinAxis: 0 })
  say('Дыра вращается, и её ось наклоняется. Экватор идёт за осью, диск — за экватором', () => {
    to({ blackHoleSpin: 0.97 }, 2)
    to({ spinTilt: 55 }, 7)
  })
})

through(() => {
  set({
    flowB: 0, flowA: 1.2, orbitCount: 14, orbitSize: 5.5, orbitTrail: 16, orbitInclination: 35, orbitDrag: 12,
    blackHoleSpin: 0.97, spinTilt: 0, cameraYaw: 30, cameraPitch: 70
  })
})

shot('the stars', () => {
  // Each star keeps a plane of its own, and the spinning hole turns those planes about its axis
  say('У каждой звезды своя плоскость орбиты. Вращение дыры медленно поворачивает их', () => {
    together(() => { to({ cameraYaw: 110 }, 10, 'linear') }, () => { to({ cameraPitch: 82 }, 10) })
  })
})

through(() => {
  set({
    orbitCount: 0, blackHoleSpin: 0, nebula: 0.5, starsBrightness: 2.2, gridSky: 0.22, gridCell: 3,
    companionSize: 0.7, companionDistance: 8, companionSpeed: 2.2, companionTilt: 76, companionNode: 90,
    companionWaves: 2.5, cameraYaw: 0, cameraPitch: 0, blackHoleSize: 6, ringBrightness: 2.5, ringGlow: 1.2,
    // A ring of matter round each hole, so each is a thing with a size that the other can pass before
    flowA: 1.6, flowACount: 2500, flowAFrom: 2.4, flowATo: 2.4, flowASpread: 0.9, flowASwirl: 1.4, flowALife: 8,
    flowATrail: 0.9, flowASize: 1.2, flowAPair: -1,
    flowB: 1.6, flowBCount: 2500, flowBFrom: 2.4, flowBTo: 2.4, flowBSpread: 0.9, flowBSwirl: 1.4, flowBLife: 8,
    flowBTrail: 0.9, flowBSize: 1.2, flowBPair: 1
  })
})

shot('the pair', () => {
  // Two holes on an orbit tipped almost edge-on to a camera that looks straight down the flight: each
  // passes before the other, and the nearer bends the grid and the light of the farther
  say('Орбита пары наклонена: дыры проходят одна перед другой, ближняя гнёт свет дальней', () => {
    wait(9)
  })
  say('Слияние. Волны расходятся в плоскости орбиты', () => {
    to({ companionDistance: 0 }, 7, 'in')
    to({ flowA: 0, flowB: 0 }, 1)
    wait(2.5)
  })
})

through(() => {
  set({
    companionSize: 0, nebula: 0.3, starsBrightness: 1.4, blackHoleSize: 7, lensingEnabled: false, gridSky: 0,
    flowB: 0, ringBrightness: 1, ringGlow: 0.3,
    gridSheet: 0.85, gridRings: 40, gridSpokes: 24, gridDepth: 6, gridSpan: 0.6, gridFade: 0.3, gridRide: 1,
    flowA: 1.5, flowACount: 20000, flowAFrom: 8, flowATo: 1, flowASpread: 6, flowALife: 8, flowASwirl: 0.4,
    flowATrail: 0.6, flowASize: 1.2,
    cameraYaw: 40, cameraPitch: -42
  })
})

shot('the sheet', () => {
  // The sheet is a surface of the scene: the camera flies round the well, whose bottom is the hole
  say('Лист искривлённого пространства стоит в сцене. Камера облетает воронку: её дно — сама дыра', () => {
    together(() => { to({ cameraYaw: -60 }, 11, 'linear') }, () => { to({ cameraPitch: -28 }, 11) })
  })
})

shot('back on the axis', () => {
  // And straight on again: the same well, seen down its throat
  say('И снова вдоль оси', () => {
    together(() => { to({ cameraYaw: 0 }, 5) }, () => { to({ cameraPitch: 0 }, 5) })
    wait(2.5)
  })
  to({ fade: 1 }, 1.5)
})
