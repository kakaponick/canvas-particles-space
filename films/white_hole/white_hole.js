// A black hole turns into a white one. Its shadow is black with the grid of its horizon across it, then lights up as
// the surface of the horizon, the grid dark across the light; the sky behind it stays bent round it by the same lens;
// and matter leaves the surface instead of falling in. A stand-in: the light is drawn flat, the outflow is a flow.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/white_hole/white_hole.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/white_hole/white_hole.js films/white_hole/out/white_hole.mp4
/* global film, set, to, wait, shot, caption */
film({
  size: '1080p', fps: 60, seed: 3, preset: 'Schwarzschild',
  settings: {
    blackHoleSize: 8, gridSky: 0.5, gridHorizon: 0.8, gridHorizonCells: 12, gridHorizonHaze: 0, fieldEnabled: false,
    whiteHole: 0, flowC: 0, flowCCount: 1500, flowCFrom: 1.1, flowCTo: 14, flowCSpread: 0.4, flowCSwirl: 0,
    flowCLife: 3, flowCTrail: 0.3, flowCSize: 1.4
  }
})

const note = { at: 'bottom', font: 'noto', size: 0.03, plate: 0.6 }

shot('black', () => {
  caption('Чёрная дыра: на её горизонте видна сетка, тень тёмная', 4.5, note)
  wait(5)
})

shot('turn', () => {
  to({ whiteHole: 1 }, 4)
  caption('Обращаем время: тень становится светящейся поверхностью', 4, note)
  wait(4.5)
})

shot('out', () => {
  to({ flowC: 2 }, 2)
  caption('Вещество выходит с поверхности, а не падает в неё', 5, note)
  wait(6)
})

shot('hold', () => {
  caption('Линза гнёт небо вокруг неё так же, как вокруг чёрной дыры', 5, note)
  wait(6)
})
