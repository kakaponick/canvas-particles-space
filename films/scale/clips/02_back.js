// Sixty-one orders, the way back: from the edge of the observable universe to the Big Bang. The frame keeps
// what we see today at one size on the screen while time runs back, so its real size is what the frame's height
// reads: the observable universe is a / 1 as large as now, a = 2.725 K / T, the temperature of the plasma that
// fills it. The ruler (the lensed grid in powers of ten, as in the first clip) runs back down the orders: 10^26
// metres at the wall of the microwave background, 10^18 at the birth of helium, a metre at the end of
// inflation, smaller than a proton before it, and down to the Planck length the film began at.
//
// Looking further is looking back: past the galaxies stands the wall where the young universe's light was let
// go, and beyond it hotter plasma to the Big Bang's horizon (the Primordial Plasma layer). Going back, the
// galaxies go out, the wall closes in, and the plasma heats from an orange 3000 K through white to blue.
/* global film, drive, wait, caption, draw, meanwhile, at, mark, to */
film({
  size: '1080p', fps: 60, seed: 61, preset: 'Schwarzschild',
  settings: {
    fieldEnabled: false, blackHoleSize: 0, followFrequency: 60, cameraFloat: 0, cameraBank: 0,
    gridLatticeUnit: 0.01, gridSky: 0.2, gridCell: 40, gridSkyDecades: 1, gridSkyLine: 1.4, starsBrightness: 0, starDensity: 0.25,
    // As the first clip leaves them: the cosmic web an even glow round the wall
    cosmicWeb: 1.6, cosmicWebGalaxies: 16, cosmicWebSize: 0.14, cosmicWebCell: 0.05,
    plasma: 1, plasmaGrain: 60, plasmaMottle: 0.3, plasmaBoil: 0, plasmaColor: '#ff7a2e', plasmaHotColor: '#ffc88a'
  }
})

// --- The narration ----------------------------------------------------------------------------------------

const LINES = {
  wall: 'За галактиками — стена реликтового излучения. Дальше Вселенная была раскалённой плазмой, и её свет до нас не доходит.',
  back: 'Запустим время назад. Вселенная сжимается и нагревается, галактики гаснут.',
  plasma380: 'Триста восемьдесят тысяч лет. Вся Вселенная — светящаяся плазма в три тысячи градусов.',
  helium: 'Три минуты. Миллиард градусов: рождаются ядра гелия.',
  quarks: 'Десять микросекунд. Протонов ещё нет: кварки свободны.',
  inflation: 'Конец инфляции. Всё, что мы видим сегодня, размером примерно с метр.',
  before: 'А до инфляции — меньше протона.',
  planckEra: 'Планковская эпоха. Здесь кончается известная физика — там же, где начался наш путь.',
  orders: 'Шестьдесят один порядок туда — и обратно.'
}
const SAID = { wall: 0.5, back: 8.6, plasma380: 17.2, helium: 24, quarks: 31, inflation: 40, before: 49.2, planckEra: 55, orders: 63.4 }
for (const [name, second] of Object.entries(SAID)) at(second, () => mark('say:' + name))

// --- Time, back ---------------------------------------------------------------------------------------------

// [second, log10 of the frame's height in metres]: 27.35 is where the first clip ends; each stop below is the
// observable universe's size at that moment, log10(2.24e27 * 2.725 / T)
const KEYS = [
  [0, 27.35], [6, 27.35], // the edge of what we see, today
  [16, 24.6], [20, 24.31], // 380 000 years, 3000 K
  [23.5, 18.5], [28, 18.0], // three minutes, a billion degrees
  [30.5, 15.1], [35, 14.78], // ten microseconds, 2·10^12 K
  [39, 0.4], [46, 0.08], // the end of inflation
  [48.5, 0], [53.5, -26], // inflation, run back: 10^26 times in a blink
  [56.5, -27], [61, -34.5], [70, -34.8] // down to the Planck length
]
const END = 70

const L = (() => {
  const n = KEYS.length
  const x = KEYS.map(k => k[0])
  const y = KEYS.map(k => k[1])
  const d = []
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]))
  const m = [d[0]]
  for (let i = 1; i < n - 1; i++) {
    const h0 = x[i] - x[i - 1]
    const h1 = x[i + 1] - x[i]
    const w1 = 2 * h1 + h0
    const w2 = h1 + 2 * h0
    // Fritsch and Carlson: a stop, or a turn of the slope's sign, holds the curve flat there
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]))
  }
  m.push(d[n - 2])
  return t => {
    const at = Math.min(Math.max(t, x[0]), x[n - 1])
    let i = 0
    while (i < n - 2 && x[i + 1] < at) i++
    const h = x[i + 1] - x[i]
    const u = (at - x[i]) / h
    const u2 = u * u
    const u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1]
  }
})()
const cellPower = t => Math.floor(L(t) + Math.log10(0.4))
const W = 1080 / 1920
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const smooth = u => {
  const c = clamp(u, 0, 1)
  return c * c * (3 - 2 * c)
}
const rad = a => a * Math.PI / 180
// What we see today, on the screen: the observable universe's radius as the first clip leaves it, and the
// wall of the microwave background inside it (45.7 of its 46.5 billion light years)
const SEEN = 4.40e26 / Math.pow(10, 27.35)
const WALL = SEEN * 45.7 / 46.5

meanwhile(() => drive({
  fade: s => smooth((s - 66.5) / 2.5),
  // The ruler, as in the first clip: Grid Zoom is the frame's log, folded by the scene, here running down
  gridSkyZoom: s => L(s) + Math.log10(0.4) + 40,
  // As the first clip leaves it, then quieter over the bright plasma
  gridSky: s => 0.2 - 0.08 * smooth((s - 6) / 6),
  // The plasma's spots hold still as the first clip leaves them, then stir as the young universe heats
  plasmaBoil: s => 0.3 * smooth((s - 8) / 6),
  // The galaxies go out as time runs back past their birth
  cosmicWeb: s => 1.6 * (1 - smooth((s - 7) / 6)),
  // The wall closes in until, at 380 000 years, the whole universe is plasma; its hottest part, the Big Bang's
  // horizon, comes with it
  plasmaRadius: s => 100 * WALL * (1 - smooth((s - 8) / 10)),
  plasmaDepth: s => 100 * (SEEN - WALL) * (1 - smooth((s - 8) / 10)),
  // Brighter as it heats, and a flash at the Planck era before the dark
  plasma: s => 1 + 0.3 * smooth((s - 18) / 30) + 1.5 * smooth((s - 61) / 2.5)
}, END))
// The plasma's colour as it heats: an orange 3000 K, as the wall is seen, then a yellow-white, a white 6500 K and
// a blue-white past 20 000 K (the colours of a black body)
meanwhile(() => {
  wait(18)
  to({ plasmaColor: '#ffb46b', plasmaHotColor: '#ffb46b' }, 2)
  to({ plasmaColor: '#ffe4c4', plasmaHotColor: '#ffe4c4' }, 6)
  to({ plasmaColor: '#f6f4ff', plasmaHotColor: '#f6f4ff' }, 6)
  to({ plasmaColor: '#b9ccff', plasmaHotColor: '#b9ccff' }, 9)
})

// --- Words ------------------------------------------------------------------------------------------------

const WHITE = '#ffffff'
const SOFT = '#9fb0c8'

const name = { at: [0.955, 0.1], anchor: 'right', align: 'right', font: 'noto', size: 0.032, weight: 600, fade: 0.5, plate: 0.45 }
const note = { at: 'bottom', font: 'noto', size: 0.03, plate: 0.55, fade: 0.5 }
const named = (text, from, to) => at(from, () => caption(text, to - from, name))
const noted = (text, from, to) => at(from, () => caption(text, to - from, note))

// The counter, as in the first clip, from the second this clip starts, at full strength
{
  const steps = [0]
  for (let t = 0; t < END; t += 1 / 240) {
    if (cellPower(t) !== cellPower(steps[steps.length - 1])) steps.push(t)
  }
  steps.push(END)
  const o = (a, s) => smooth((END - 3.5 - a - s) / 1.5)
  const ruler = { kind: 'line', color: WHITE, width: 0.003, opacity: 'o' }
  for (let k = 0; k < steps.length - 1; k++) {
    const a = steps[k]
    const n = cellPower(a + 1e-6)
    const cell = s => 0.045 + Math.pow(10, n - L(a + s)) * W
    const span = steps[k + 1] - a - 1e-4
    at(a, () => {
      caption(`10^{${n}} м`, span, { at: [0.045, 0.09], anchor: 'left', align: 'left', font: 'unbounded', size: 0.055, fade: 0, opacity: 'o', plate: 0.35, values: { o: s => o(a, s) } })
      draw({ ...ruler, points: [[0.045, 0.16], ['x', 0.16]], values: { x: cell, o: s => o(a, s) } }, span)
      draw({ ...ruler, points: [['x', 0.148], ['x', 0.172]], values: { x: cell, o: s => o(a, s) } }, span)
    })
  }
  at(0, () => {
    draw({ ...ruler, points: [[0.045, 0.148], [0.045, 0.172]], values: { o: s => o(0, s) } }, END)
    caption('одна клетка сетки', END - 4, { at: [0.045, 0.2], anchor: 'left', align: 'left', font: 'noto', size: 0.022, color: SOFT, fade: 0, plate: 0.35, opacity: 'o', values: { o: s => smooth((END - 4 - s) / 0.8) } })
  })
}

// What we see today, held at one size while it shrinks in metres: a dashed edge, kept until inflation runs back
at(6, () => {
  draw({ kind: 'circle', center: [0.5, 0.5], radius: SEEN, color: WHITE, width: 0.0016, dash: [0.008, 0.008], opacity: 'o', values: { o: s => 0.8 * smooth(s / 1) * (1 - smooth((s - 42) / 1.5)) } }, 44)
  caption('всё, что мы видим сегодня', 41, {
    at: [0.5 + SEEN * Math.cos(rad(35)) * W + 0.012, 0.5 - SEEN * Math.sin(rad(35))], anchor: 'left', font: 'noto', size: 0.022, color: WHITE, fade: 0.5, plate: 0.45
  })
})

noted('Дальше — стена реликтового излучения: за ней\nВселенная ещё раскалённая плазма', 0.6, 7.6)
named('Время назад\nВселенная сжимается и нагревается', 8.4, 15.6)
named('380 000 лет · 3000 K', 16.6, 23)
noted('Вся Вселенная — светящаяся плазма.\nЕё свет мы видим как реликтовое излучение', 17.4, 23)
named('3 минуты · 10^{9} K', 23.8, 30.2)
noted('Рождаются ядра гелия', 24.6, 30.2)
named('10 микросекунд · 2·10^{12} K', 30.8, 38.8)
noted('Протонов ещё нет: кварки и глюоны свободны', 31.6, 38.8)
named('10^{-32} секунды · конец инфляции', 39.6, 47.8)
noted('Всё, что мы видим сегодня, — размером около метра', 40.4, 47.8)
noted('Инфляция назад: всё в 10^{26} раз меньше —\nнамного меньше протона', 48.6, 54.6)
named('10^{-43} секунды · планковская эпоха', 55, 62.4)
noted('Здесь кончается известная физика —\nу планковской длины, откуда начался наш путь', 55.6, 62.4)
at(63.2, () => caption('61 порядок туда — и обратно', 4.6, { at: [0.5, 0.5], font: 'unbounded', size: 0.045, fade: 0.6, plate: 0.5 }))

wait(END)
