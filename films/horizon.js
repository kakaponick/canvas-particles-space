// A popular-science film carried by its text: words on black, a definition with a stressed term, a formula,
// a label on the scene, numbers that are read from the film as it plays, a list that builds.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/horizon.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/horizon.js films/horizon.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({ seed: 21, preset: 'Schwarzschild', settings: { gridSky: 0.3, blackHoleX: 0.34 } })
set({ fade: 1 })

// The column of text beside the hole: the text face, lines starting from one edge
const column = (y, more = {}) => ({ at: [0.72, y], width: 0.44, align: 'left', font: 'noto', size: 0.042, ...more })

shot('question', () => {
  caption('Что увидит тот, кто смотрит,\nкак вы падаете в чёрную дыру?', 4.5, { at: 'center', font: 'noto', size: 0.055, reveal: 'words', revealOver: 2.5 })
  wait(3.5)
  to({ fade: 0 }, 2)
})

shot('definition', () => {
  caption('*{Горизонт событий} — граница, из-за которой наружу не выходит даже свет', column(0.4, { reveal: 'words', revealOver: 3 }))
  caption('Тень: 2,6 r_{s}', { at: 'hole', angle: 150 })
  wait(6)
})

shot('formula', () => {
  caption('Радиус Шварцшильда\nr_{s} = 2GM / c^{2}', column(0.34, { size: 0.055 }))
  caption('Для Солнца r_{s} ≈ 3 км.\nДля Земли — 9 мм.', column(0.58, { reveal: 'lines', revealOver: 3 }))
  wait(6.5)
})

// The fall: the distance closes, and the scene's own time runs as slow as a far observer sees the faller's
// clock run, dτ/dt = √(1 − r_s / r)
shot('fall', () => {
  const distance = u => 10 - 8.9 * u
  const pace = u => Math.sqrt(1 - 1 / distance(u))
  caption('До центра: *{#{r:1,} r_{s}}\nЧасы падающего идут\nв *{#{slower:1,}} раза медленнее', column(0.42, {
    values: { r: (s, u) => distance(u), slower: (s, u) => 1 / pace(u) }
  }))
  caption('Δτ = Δt · √(1 − r_{s} / r)', column(0.68, { size: 0.036, color: '#b8c4d6' }))
  meanwhile(() => { to({ cameraZoom: 2.4 }, 9, 'in') })
  drive({ speed: (s, u) => pace(u) }, 9)
})

shot('observer', () => {
  set({ speed: 1 })
  caption('Издалека это выглядит так:\n1. свет краснеет\n2. время замирает\n3. образ гаснет', column(0.42, { reveal: 'lines', revealOver: 5 }))
  to({ cameraZoom: 1 }, 6)
  wait(1)
})

shot('answer', () => {
  to({ fade: 1 }, 1.5)
  caption('Горизонт — не поверхность.\nЭто *{точка невозврата}.', 4, { at: 'center', font: 'noto', size: 0.055, reveal: 'lines', revealOver: 2 })
  wait(4)
})
