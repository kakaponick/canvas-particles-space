// A popular-science film carried by what is drawn over the picture: rings that mark radii inside the shadow,
// an arrow with a label that rides on the scene, a ring that follows a setting as it moves, a chart with a dot
// that walks along it with the number a caption counts, the orbit of a second black hole with a camera that
// pans to it, a picture in a frame.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/graphics/graphics.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/graphics/graphics.js films/graphics/out/graphics.mp4
// The picture is films/graphics/ring.png, read from the folder the film server runs in (the repository).
/* global film, set, to, wait, shot, caption, draw, meanwhile */
film({ seed: 12, preset: 'Schwarzschild', settings: { blackHoleX: 0.36, baseBrightness: 0.5 } })
set({ fade: 1 })

// The shadow's edge is 1 in the scene's lengths and 2.6 Schwarzschild radii, so 1 r_s is this much
const RS = 1 / 2.598
const GOLD = '#ffd27a'
const BLUE = '#8fc7ff'
const column = (y, more = {}) => ({ at: [0.74, y], width: 0.42, align: 'left', font: 'noto', size: 0.04, ...more })
const label = (x, y, more = {}) => ({ at: { hole: [x, y] }, font: 'noto', size: 0.028, ...more })

shot('anatomy', () => {
  to({ fade: 0, cameraZoom: 3 }, 2)
  caption('Что внутри *{тени}', column(0.3, { size: 0.05 }))
  // Two radii the shadow hides: the horizon and the sphere where light can circle
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: RS, color: BLUE, fill: BLUE, fillOpacity: 0.18, draw: 1.2 })
  caption('горизонт, r_{s}', label(0, 0, { color: BLUE, size: 0.024 }))
  wait(1.5)
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 1.5 * RS, color: GOLD, dash: true, draw: 1.2 })
  caption('фотонная сфера, 1,5 r_{s}', label(0, -0.73, { color: GOLD, size: 0.024 }))
  wait(1.5)
  // An arrow from outside to the shadow's edge, with its words riding at the arrow's tail
  draw({ kind: 'line', arrow: 'end', points: [{ hole: [1.5, -1.12] }, { hole: [0.78, -0.66] }], draw: 0.8 })
  caption('край тени, 2,6 r_{s}', label(2.1, -1.27))
  caption('Тень в 2,6 раза шире горизонта:\nсвет, прошедший ближе, уже не выходит', column(0.48, { reveal: 'lines', revealOver: 2 }))
  wait(3)
})

shot('einstein', () => {
  set({ gridSky: 0.35 })
  to({ cameraZoom: 1.3 }, 1.5)
  // The ring reads the setting itself, so it stays on the Einstein ring while the track moves it
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 'lensingRadius', color: GOLD, dash: [0.02, 0.012], width: 0.003 })
  caption('Кольцо Эйнштейна:\n*{#{lensingRadius:1,}} радиуса тени', column(0.36))
  caption('Чем тяжелее линза,\nтем шире кольцо', column(0.56, { size: 0.034, color: '#b8c4d6' }))
  to({ lensingRadius: 3.4 }, 3.5)
  wait(1)
})

// The fall: a dot travels in, and the same number moves the dot on the chart and the count in the words
shot('fall', () => {
  set({ gridSky: 0 })
  const distance = u => 10 - 8.9 * u
  const slowed = r => Math.sqrt(1 - 1 / r)
  const curve = []
  // More points where the curve is steep, close to the horizon
  for (let step = 0; step <= 80; step++) {
    const r = 1 + 9 * (step / 80) ** 3
    curve.push([+r.toFixed(4), +slowed(r).toFixed(4)])
  }
  draw({
    kind: 'circle', center: { hole: ['x', 'y'] }, radius: 0.07, fill: '#ffffff',
    values: { x: (s, u) => distance(u) * RS * 0.8, y: (s, u) => distance(u) * RS * 0.6 }
  })
  draw({
    kind: 'plot', box: [0.64, 0.5, 0.29, 0.3], x: [1, 10], y: [0, 1], points: curve, color: GOLD, plate: 0.55,
    xLabel: 'r / r_{s}', yLabel: 'ход часов, dτ / dt', marker: 'r', draw: 1.5,
    values: { r: (s, u) => distance(u) }
  })
  caption('До центра: *{#{r:1,} r_{s}}\nЧасы идут в *{#{slower:2,}} раза медленнее', column(0.26, {
    values: { r: (s, u) => distance(u), slower: (s, u) => 1 / slowed(distance(u)) }
  }))
  meanwhile(() => { to({ cameraZoom: 1.6 }, 8, 'in') })
  wait(8)
})

shot('pair', () => {
  set({ companionSize: 0.6, companionDistance: 6, companionSpeed: 2.5, cameraZoom: 1 })
  // Seen from the main hole the second one circles at their distance, so this ring rides with the main hole
  // and reads the distance as the track closes it
  draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 'companionDistance', dash: true, color: BLUE, width: 0.003 })
  draw({ kind: 'line', points: [{ hole: [0, 0] }, { companion: [0, 0] }], color: BLUE, width: 0.0025, opacity: 0.7 })
  caption('вторая чёрная дыра', { at: { companion: [0, 1.9] }, font: 'noto', size: 0.028 })
  caption('Расстояние: *{#{companionDistance:1,}} радиуса\nЧем ближе, тем быстрее оборот', column(0.2, { at: [0.72, 0.16] }))
  wait(2)
  // The camera leaves the centre of the pair for the second hole and rides round its orbit with it
  meanwhile(() => { to({ cameraZoom: 2.2, cameraPair: 1 }, 3) })
  to({ companionDistance: 3.2 }, 5)
})

shot('telescope', () => {
  set({ companionSize: 0, cameraZoom: 1, cameraPair: 0 })
  // A picture in a frame of its own: a plate, the picture, a thin edge
  draw({ kind: 'rect', center: [0.76, 0.42], size: [0.5, 0.5], round: 0.02, fill: '#000000', fillOpacity: 0.7, color: '#b8c4d6', width: 0.002 })
  draw({ kind: 'image', src: 'films/graphics/ring.png', center: [0.76, 0.42], width: 0.44 })
  caption('Так тень видит телескоп:\nразмытое кольцо (схема)', column(0.78, { at: [0.76, 0.8], align: 'center', size: 0.034 }))
  wait(3.5)
  to({ fade: 1 }, 1.5)
})
