// A film as a script: each part shows what a script says in a line and JSON says in a table of keys.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/language/language.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/language/language.js films/language/out/language.mp4
/* global film, set, to, drive, wait, shot, slow, together, caption, title, fire, input */
film({ seed: 12, settings: { gridSky: 0.4, orbitCount: 10, orbitEccentricity: 0.6, orbitTrail: 8 } })
set({ fade: 1, letterbox: 0.1, filmHold: 1 })

// A part of a film is a function: a move in on the hole with a label on it
function moveIn (zoom, seconds, words) {
  caption(words, seconds, { at: 'hole', angle: 30 })
  to({ cameraZoom: zoom }, seconds, 'spring')
}

shot('arrival', () => {
  caption('Чёрная дыра и звёзды на орбитах')
  to({ fade: 0 }, 2)
  wait(3)
})

shot('circle', () => {
  caption('Дыра идёт по кругу: её путь задан функцией времени')
  // Out from the middle, round and back: the radius is a half wave over the stretch
  const radius = u => 0.2 * Math.sin(Math.PI * u)
  drive({
    blackHoleX: (s, u) => 0.5 + radius(u) * Math.cos(1.5 * s),
    blackHoleY: (s, u) => 0.5 + radius(u) * Math.sin(1.5 * s)
  }, 8)
})

shot('approach', () => {
  moveIn(3, 4, 'Тень чёрной дыры')
  slow(0.15, () => {
    caption('Время сцены замедлено в семь раз')
    wait(3)
  })
})

shot('waves', () => {
  caption('Четыре волны, каждая сильнее: цикл')
  for (let wave = 0; wave < 4; wave++) {
    fire('ringdown', 'gravityWave', { gravityWaveGain: 1 + wave })
    wait(1.5)
  }
})

shot('ending', () => {
  together(
    () => { to({ cameraZoom: 1 }, 3) },
    () => { wait(1); to({ gridSky: 0 }, 2) }
  )
  title(input.ending ?? 'КОНЕЦ', 4)
  wait(2.5)
  to({ fade: 1 }, 1.5)
})
