// Sixty-one orders: one pull back from the Planck length to the Hubble sphere, the frame's height running from
// 10^-34 to 10^27 metres. A black hole stands at every scale it can have, each at its true size for the frame:
// a Planck-mass hole that evaporates, the Earth squeezed into one, Cygnus X-1 with Moscow inside its shadow,
// Sgr A* with the Sun a dot in its middle, M87* with the whole Solar System and Voyager 1 inside its shadow.
// Between them the proton, the atom (flow B as the electron's cloud), a virus, a cell, a man, the Earth, the
// Sun with the Moon's orbit inside it, Proxima, the Milky Way (flows B and C round its centre, the hole taken
// away so they are measured in Lattice Unit), and the observable universe with the field as receding galaxies.
//
// Everything is one number: L(t), the base-10 logarithm of the frame's height in metres, a monotone curve
// through the keys below that slows at every stop. A thing of R metres is R / 10^L of the short side; the
// hole's size, the radii of the circles, the cloud and the galaxy all read that, so they cannot drift apart.
// Bodies stand round the frame's middle, where the hole is, so every comparison is concentric. The ruler is
// the lensed grid drawn in powers of ten (Grid Decades), one cell one power of ten of metres, which the
// counter and the bar under it name; the Earth and the Sun are NASA's photographs.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/scale/scale.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/scale/scale.js films/scale/out/scale.mp4
/* global film, set, drive, wait, caption, draw, meanwhile, at */
film({
  size: '1080p', fps: 60, seed: 61, preset: 'Schwarzschild',
  settings: {
    fieldEnabled: false, blackHoleSize: 26, followFrequency: 60, cameraFloat: 0, cameraBank: 0,
    gridLatticeUnit: 0.01, gridSky: 0.3, gridCell: 40, gridSkyDecades: 1, gridSkyLine: 1.4, starsBrightness: 0, starDensity: 0.25,
    // The discs of the holes that have one: in the hole's radii, so they scale with it
    flowACount: 7000, flowAFrom: 1.9, flowATo: 1.9, flowASpread: 1, flowASwirl: 0.5, flowALife: 10,
    flowATrail: 0.6, flowASize: 1.3, flowAColor: '#ffcf9a', flowTrace: 1,
    // Flow B: the electron's cloud first, the galaxy's bulge later. Turned as a wheel (Falloff 0), so its
    // radii can follow the zoom without moving a particle round
    flowBCount: 9000, flowBFalloff: 0, flowBSwirl: 1.2, flowBLife: 0.5, flowBTrail: 0.02, flowBSize: 1.2,
    flowBColor: '#9fd0ff',
    // Flow C: the galaxy's disc, a fall wound into spiral strokes, also a wheel
    flowCCount: 26000, flowCFall: 1, flowCFalloff: 0, flowCSwirl: 0.04, flowCLife: 24, flowCTrail: 2.5,
    flowCSize: 1.1, flowCColor: '#c8d4ff', flowCArms: 2, flowCArmWidth: 0.12
  }
})

// --- The zoom ---------------------------------------------------------------------------------------------

// [second, log10 of the frame's height in metres]: travel between the stops, a slow drift at each
const KEYS = [
  [0, -33.5], [9, -33.3], // the Planck-mass hole
  [13, -19.5], [16, -18.5], // the collider's limit
  [19, -14.8], [22.5, -14.35], // the proton
  [26.5, -10.0], [31.5, -9.7], // the atom
  [39, -1.25], [45, -1.0], // the Earth as a black hole
  [49, 0.45], [51.5, 0.6], // a man
  [56, 5.65], [62, 5.85], // Cygnus X-1
  [65.5, 7.35], [68, 7.5], // the Earth
  [71, 9.25], [74, 9.4], // the Sun
  [77, 11.55], [84, 11.75], // Sgr A*
  [88, 14.0], [95, 14.2], // M87*
  [99, 17.05], [102.5, 17.3], // the Sun's neighbours
  [107, 20.95], [114, 21.15], // the Milky Way
  [119, 27.05], [134, 27.35] // the observable universe
]
const END = 134

// A monotone cubic through the keys (Fritsch and Carlson): it never overshoots, so the zoom never turns back
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
    m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]))
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

// A length of R metres as a share of the frame's short side at second t
const share = (R, t) => R / Math.pow(10, L(t))
// The power of ten of metres one cell of the grid is: the one whose cell is 4% to 40% of the short side
const cellPower = t => Math.floor(L(t) + Math.log10(0.4))
// The second at which R metres have shrunk to `s` of the short side
const when = (R, s) => {
  if (share(R, 0) <= s) return 0
  if (share(R, END) > s) return END
  let lo = 0
  let hi = END
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (share(R, mid) > s) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const W = 1080 / 1920 // a share of the short side, as a share of the frame's width
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const smooth = u => {
  const c = clamp(u, 0, 1)
  return c * c * (3 - 2 * c)
}
const rad = a => a * Math.PI / 180
// The place on the frame R metres from the middle at `a` degrees (0 right, 90 up)
const placeAt = (R, a, t) => [0.5 + share(R, t) * Math.cos(rad(a)) * W, 0.5 - share(R, t) * Math.sin(rad(a))]

// --- Lengths, in metres -----------------------------------------------------------------------------------

const AU = 1.496e11
const LY = 9.461e15
const SHADOW = 2.598 // the shadow's radius in Schwarzschild radii
const RS_SUN = 2953 // the Schwarzschild radius of one solar mass
const PLANCK_RS = 2 * 1.616e-35
const PROTON = 0.84e-15
const BOHR = 5.29e-11
const EARTH_RS = 8.87e-3
const EARTH = 6.371e6
const MOON = 3.844e8
const SUN = 6.957e8
const MKAD = 1.8e4
const GALAXY = 4.73e20 // the Milky Way's disc, 50 000 light years
const SUN_FROM_CENTRE = 2.46e20 // 26 000 light years
const HUBBLE = 1.32e26 // c / H0 at 70 km/s/Mpc
const OBSERVABLE = 4.40e26

// The holes, by their shadows: when each grows into the frame, how bright its disc, and when it evaporates
const HOLES = [
  { R: SHADOW * PLANCK_RS, grow: null, gone: 8, disc: 0 },
  { R: SHADOW * EARTH_RS, grow: 39.5, disc: 0 },
  { R: SHADOW * 21.2 * RS_SUN, grow: 56.5, disc: 0.55 },
  { R: SHADOW * 4.3e6 * RS_SUN, grow: 77.5, disc: 0 },
  { R: SHADOW * 6.5e9 * RS_SUN, grow: 88.5, disc: 0 }
]
for (const hole of HOLES) {
  // A hole leaves once its shadow is under 2% of the short side, so no dot stays in the next thing's middle
  hole.fade = hole.gone ?? when(hole.R, 0.02)
  hole.fadeFor = hole.gone ? 0.5 : 1
}
const holeAt = t => {
  for (const hole of HOLES) {
    const up = hole.grow === null ? 1 : smooth((t - hole.grow) / 1.5)
    const down = 1 - smooth((t - hole.fade) / hole.fadeFor)
    const g = (hole.grow === null || t >= hole.grow) ? up * down : 0
    if (g > 0) return { hole, g }
  }
  return null
}
const holeSize = t => {
  const on = holeAt(t)
  if (!on) return 0
  const size = Math.min(60, 100 * share(on.hole.R, t)) * on.g
  return size < 0.1 ? 0 : size
}

// The electron's cloud: in from when the atom is 60% of the short side, out once it is a speck
const ATOM_IN = when(BOHR, 0.6)
const ATOM_OUT = when(BOHR, 0.004)
// The galaxy: in once its centre is inside the frame, out once the disc is a speck
const GAL_IN = when(SUN_FROM_CENTRE, 0.889)
const GAL_OUT = when(GALAXY, 0.004)
const GAL_ANGLE = 200
const lit = (t, from, to) => smooth((t - from) / 1.5) * (1 - smooth((t - (to - 1.5)) / 1.5))
const inGalaxy = t => t >= GAL_IN && t <= GAL_OUT
const galaxyCentre = t => placeAt(SUN_FROM_CENTRE, GAL_ANGLE, t)
// Where the hole stands, which the flows turn round: the frame's middle, the galaxy's centre while it is on,
// gliding there over the second and a half before, and back after, while nothing is drawn round it
const galaxyPlace = (t, k) => {
  const there = clamp(galaxyCentre(clamp(t, GAL_IN, GAL_OUT))[k], 0, 1)
  return 0.5 + (there - 0.5) * smooth((t - (GAL_IN - 1.5)) / 1.5) * (1 - smooth((t - GAL_OUT) / 1.5))
}
// Flow radii with no hole are in Lattice Unit, 1% of the short side
const unit = (R, t) => share(R, t) / 0.01
const flowRadius = v => clamp(v, 0.2, 200)
// Flow B's radius: the atom's, then the bulge's, passing between them while the flow is dark (50 to 58 s)
const bRadius = (t, atom, bulge) => {
  const u = smooth((t - 50) / 8)
  return Math.exp(Math.log(flowRadius(unit(atom, t))) * (1 - u) + Math.log(flowRadius(unit(bulge, t))) * u)
}

meanwhile(() => drive({
  fade: s => s < 2.5 ? 1 : s < 4 ? 1 - smooth((s - 2.5) / 1.5) : smooth((s - 131) / 2.5),
  blackHoleSize: s => holeSize(s),
  blackHoleX: s => galaxyPlace(s, 0),
  blackHoleY: s => galaxyPlace(s, 1),
  flowA: s => {
    if (s > 110) return 1.3 * smooth((s - 116.5) / 2)
    const on = holeAt(s)
    return on && holeSize(s) > 0 ? on.hole.disc * on.g : 0
  },
  // The cloud, then the bulge: a ring as wide as the atom, a ring round the galaxy's middle
  flowB: s => s < 60 ? 1.1 * lit(s, ATOM_IN, ATOM_OUT) : inGalaxy(s) ? 2 * lit(s, GAL_IN, GAL_OUT) : 0,
  flowBFrom: s => bRadius(s, 0.9 * BOHR, 0.07 * GALAXY),
  flowBTo: s => bRadius(s, 0.9 * BOHR, 0.07 * GALAXY),
  flowBSpread: s => bRadius(s, 1.8 * BOHR, 0.14 * GALAXY),
  flowC: s => inGalaxy(s) ? 1.4 * lit(s, GAL_IN, GAL_OUT) : 0,
  flowCFrom: s => flowRadius(unit(0.85 * GALAXY, s)),
  flowCTo: s => flowRadius(unit(0.1 * GALAXY, s)),
  flowCSpread: s => flowRadius(unit(0.16 * GALAXY, s)),
  // The ruler of the whole film: the lensed grid in powers of ten (Grid Decades), its cell one power of ten
  // of metres. Grid Zoom is the log of the frame itself, a number that only rises, so the cell shrinks from
  // Grid Spacing's 40% to 4% and the scene folds it back seamlessly: no track ever carries the jump. It
  // stands at the frame's middle, where every body is, and each hole bends it at its own scale. Brighter in
  // the small, where there are no stars
  gridSkyZoom: s => L(s) + Math.log10(0.4) + 40,
  gridSky: s => 0.2 + 0.1 * (1 - smooth((L(s) + 0.5) / 2)),
  starsBrightness: s => 1.3 * smooth((L(s) - 0.5) / 2) * (1 - smooth((L(s) - 16.3) / 1.5))
}, END))

// Flow B becomes the bulge while it is dark between the atom and the galaxy
at(60, () => set({ flowBSwirl: 0.04, flowBLife: 14, flowBTrail: 1.2, flowBSize: 1.3, flowBColor: '#ffd9a0', flowBCount: 7000 }))
// Flow A becomes the galaxies of the last picture while it is dark: an outflow from the middle whose pace
// grows with distance (Fall Power below 1 races through the outer part), as Hubble's law has it
at(110, () => set({ flowAFrom: 2, flowATo: 170, flowASpread: 3, flowAFall: 0.4, flowASwirl: 0, flowALife: 16, flowATrail: 0.25, flowASize: 1.6, flowACount: 9000, flowAColor: '#e8ecff' }))

// --- Words ------------------------------------------------------------------------------------------------

const WHITE = '#ffffff'
const SOFT = '#9fb0c8'
const BLUE = '#8fc7ff'
const GOLD = '#ffd27a'
const name = { at: [0.955, 0.1], anchor: 'right', align: 'right', font: 'noto', size: 0.032, weight: 600, fade: 0.5 }
const note = { at: 'bottom', font: 'noto', size: 0.03, plate: 0.45, fade: 0.5 }
const named = (text, from, to) => at(from, () => caption(text, to - from, name))
const noted = (text, from, to) => at(from, () => caption(text, to - from, note))

// A label that rides what it names: held a little off the point, outward at `a` degrees, and standing by
// its near edge, so it follows a circle's edge as the zoom shrinks it
// (`reach`, a function of the second, holds the words that far off instead, past another circle, with a
// thin lead back to the point)
function tag (text, from, to, point, a, color = SOFT, reach = null) {
  const off = s => reach ? reach(from + s) : 0.018
  const x = s => point(from + s)[0] + off(s) * Math.cos(rad(a)) * W
  const y = s => point(from + s)[1] - off(s) * Math.sin(rad(a))
  at(from, () => {
    caption(text, to - from, {
      at: ['x', 'y'], anchor: Math.cos(rad(a)) >= 0 ? 'left' : 'right', font: 'noto', size: 0.022, color, fade: 0.4, plate: 0.35,
      values: { x, y }
    })
    if (reach) {
      const end = k => s => point(from + s)[k] + (off(s) - 0.006) * (k === 0 ? Math.cos(rad(a)) * W : -Math.sin(rad(a)))
      draw({
        kind: 'line', points: [['px', 'py'], ['ex', 'ey']], color, width: 0.0014, opacity: 'o',
        values: { px: s => point(from + s)[0], py: s => point(from + s)[1], ex: end(0), ey: end(1), o: s => 0.7 * smooth(s / 0.4) * smooth((to - from - s) / 0.4) }
      }, to - from)
    }
  })
}
const edge = (R, a) => t => placeAt(R, a, t)

// A circle of R metres round the frame's middle, from when it is `hi` of the short side to when it is `lo`
// (`peak` its brightest opacity, `start` the earliest second it may come in)
function body (R, { peak = 1, start = 0, stop = END, ...spec }, hi = 1.5, lo = 0.003) {
  const from = Math.max(when(R, hi), start)
  const to = Math.min(when(R, lo), stop)
  if (to - from < 0.2) return
  at(from, () => draw({
    kind: 'circle', center: [0.5, 0.5], radius: 'r', opacity: 'o', ...spec,
    values: {
      r: s => share(R, from + s),
      o: s => (from === 0 ? 1 : smooth(s / 0.6)) * smooth(Math.log(share(R, from + s) / lo) / Math.log(2.5)) * smooth((to - from - s) / 0.8) * peak
    }
  }, to - from))
}

// A photograph of a body R metres in radius at the frame's middle, its disc `disc` of the picture's half side
function picture (R, src, disc, hi, lo) {
  const from = when(R, hi)
  const to = when(R, lo)
  at(from, () => draw({
    kind: 'image', src, center: [0.5, 0.5], width: 'w', opacity: 'o',
    values: {
      w: s => 2 * share(R, from + s) / disc,
      o: s => smooth(s / 0.6) * smooth(Math.log(share(R, from + s) / lo) / Math.log(2.5))
    }
  }, to - from))
}
const credit = (text, from, to) => at(from, () => caption(text, to - from, { ...name, at: [0.955, 0.19], size: 0.02, weight: 400, color: SOFT }))

// A dot of a fixed size at R metres and `a` degrees: a probe, a star
function dot (R, a, color, size, hi, lo) {
  const from = when(R, hi)
  const to = when(R, lo)
  at(from, () => draw({
    kind: 'circle', center: ['x', 'y'], radius: size, fill: color, color, glow: 0.008, opacity: 'o',
    values: {
      x: s => placeAt(R, a, from + s)[0],
      y: s => placeAt(R, a, from + s)[1],
      o: s => smooth(s / 0.6) * smooth((to - from - s) / 0.8)
    }
  }, to - from))
}

// The opening card, on black
at(0.4, () => {
  caption('Шестьдесят один порядок', 2.8, { at: [0.5, 0.45], font: 'unbounded', size: 0.06, fade: 0.6 })
  caption('от планковской длины до края Вселенной', 2.8, { at: [0.5, 0.56], font: 'noto', size: 0.03, color: SOFT, fade: 0.6 })
})

// The counter: one cell of the grid as a power of ten of metres, with a bar as long as one cell under it.
// Each power of ten is a caption and a bar of its own, from the second the cell becomes it to the second it
// grows past it, so neither number nor bar is ever drawn between two keys across the step
{
  const START = 2.5
  const steps = [START]
  for (let t = START; t < END; t += 1 / 240) {
    if (cellPower(t) !== cellPower(steps[steps.length - 1])) steps.push(t)
  }
  steps.push(END)
  const o = (a, s) => smooth((a + s - START) / 0.8) * smooth((END - a - s) / 1.5)
  const ruler = { kind: 'line', color: WHITE, width: 0.003, opacity: 'o' }
  for (let k = 0; k < steps.length - 1; k++) {
    const a = steps[k]
    const n = cellPower(a + 1e-6)
    const cell = s => 0.045 + Math.pow(10, n - L(a + s)) * W
    at(a, () => {
      caption(`10^{${n}} м`, steps[k + 1] - a, { at: [0.045, 0.09], anchor: 'left', align: 'left', font: 'unbounded', size: 0.055, fade: 0, opacity: 'o', values: { o: s => o(a, s) } })
      draw({ ...ruler, points: [[0.045, 0.16], ['x', 0.16]], values: { x: cell, o: s => o(a, s) } }, steps[k + 1] - a)
      draw({ ...ruler, points: [['x', 0.148], ['x', 0.172]], values: { x: cell, o: s => o(a, s) } }, steps[k + 1] - a)
    })
  }
  at(START, () => {
    draw({ ...ruler, points: [[0.045, 0.148], [0.045, 0.172]], values: { o: s => o(START, s) } }, END - START)
    caption('одна клетка сетки', END - START, { at: [0.045, 0.2], anchor: 'left', align: 'left', font: 'noto', size: 0.022, color: SOFT, fade: 0.8 })
  })
}

// --- The Planck scale -------------------------------------------------------------------------------------

named('Планковская длина\n1,6·10^{-35} м', 3.5, 10.5)
noted('Чёрная дыра планковской массы, 22 микрограмма:\nменьше чёрной дыры не бывает', 3.8, 7.9)
noted('По формуле Хокинга она испаряется за 10^{-39} секунды', 8, 11)
// Its evaporation: a flash where it was
at(8, () => draw({
  kind: 'circle', center: [0.5, 0.5], radius: 'r', fill: WHITE, color: WHITE, glow: 0.05, opacity: 'o',
  values: { r: s => 0.02 + 0.5 * smooth(s / 1.2), o: s => 1 - smooth(s / 1.2) }
}, 1.3))
at(11.5, () => caption('Следующие 16 порядков не видел никто:\nБольшой адронный коллайдер различает около 10^{-19} м', 7, { ...note, at: [0.5, 0.1] }))
// The collider's limit, passing through the frame where the zoom slows for it
const LHC = 1e-19
body(LHC, { color: SOFT, dash: [0.01, 0.008], width: 0.002 }, 0.8, 0.02)
tag('предел разрешения БАК', when(LHC, 0.6), when(LHC, 0.06), edge(LHC, 35), 35)

// --- The proton and the atom ------------------------------------------------------------------------------

body(PROTON, { color: '#ffb38a', fill: '#ff7a4a', fillOpacity: 0.18, glow: 0.01, width: 0.002 }, 0.6, 0.0015)
{
  // Three quarks, turning slowly inside it
  const from = when(PROTON, 0.6)
  const to = when(PROTON, 0.004)
  ;['#ff6a6a', '#6aff8a', '#6a9aff'].forEach((color, k) => at(from, () => draw({
    kind: 'circle', center: ['x', 'y'], radius: 'r', fill: color, color, glow: 0.006, opacity: 'o',
    values: {
      x: s => 0.5 + 0.42 * share(PROTON, from + s) * Math.cos(rad(90 + 120 * k + 12 * s)) * W,
      y: s => 0.5 - 0.42 * share(PROTON, from + s) * Math.sin(rad(90 + 120 * k + 12 * s)),
      r: s => 0.16 * share(PROTON, from + s),
      o: s => smooth(s / 0.6) * smooth((to - from - s) / 0.6)
    }
  }, to - from)))
}
named('Протон\n0,84·10^{-15} м', 19.5, 25)
noted('Три кварка и поле, которое их держит', 20.5, 25)

named('Атом водорода\n0,53·10^{-10} м', 26, 33)
// Its nucleus, the proton, a point at the middle of the cloud
at(ATOM_IN, () => draw({ kind: 'circle', center: [0.5, 0.5], radius: 0.004, fill: '#ffb38a', color: '#ffb38a', glow: 0.008 }, ATOM_OUT - ATOM_IN))
noted('Облако — где может оказаться электрон.\nЯдро в 60 000 раз меньше самого атома', 26.8, 33)

// --- Life ---------------------------------------------------------------------------------------------------

const VIRUS = 5e-8
const CELL = 3.9e-6
body(VIRUS, { color: '#9be39b', fill: '#4fae4f', fillOpacity: 0.15, dash: [0.006, 0.004], width: 0.003 }, 0.8, 0.004)
tag('вирус · 100 нм', when(VIRUS, 0.45), when(VIRUS, 0.03), edge(VIRUS, 35), 35, '#9be39b')
body(CELL, { color: '#ff7a7a', fill: '#ff5a5a', fillOpacity: 0.2, width: 0.003 }, 0.8, 0.004)
tag('эритроцит · 8 мкм', when(CELL, 0.45), when(CELL, 0.03), edge(CELL, 145), 145, '#ff9a9a')

// --- The Earth as a black hole ------------------------------------------------------------------------------

body(EARTH_RS, { color: BLUE, dash: [0.008, 0.006], width: 0.0016, start: 41 }, 0.3, 0.012)
tag('горизонт событий', 41, 47, edge(EARTH_RS, 40), 40, BLUE)
named('Земля, сжатая в чёрную дыру\nгоризонт — 9 мм', 40, 47.5)
noted('Чтобы стать чёрной дырой, Земле нужно сжаться\nв шарик 18 мм. Тень в 2,6 раза шире горизонта', 41, 47.5)

// --- A man --------------------------------------------------------------------------------------------------

{
  const HALF = 0.85
  const from = when(HALF, 0.42)
  const to = when(HALF, 0.006)
  const y = (sign, s) => 0.5 - sign * share(HALF, from + s)
  const o = s => smooth(s / 0.6) * smooth((to - from - s) / 0.8)
  at(from, () => {
    draw({ kind: 'line', points: [[0.5, 'a'], [0.5, 'b']], color: WHITE, width: 0.003, opacity: 'o', values: { a: s => y(1, s), b: s => y(-1, s), o } }, to - from)
    for (const sign of [1, -1]) {
      draw({ kind: 'line', points: [[0.488, 'a'], [0.512, 'a']], color: WHITE, width: 0.003, opacity: 'o', values: { a: s => y(sign, s), o } }, to - from)
    }
  })
}
named('Человек\n1,7 м', 48.5, 52.3)

// --- Cygnus X-1 ---------------------------------------------------------------------------------------------

const CYG_RS = 21.2 * RS_SUN
body(MKAD, { color: GOLD, width: 0.002 }, 0.6, 0.004)
tag('Москва в пределах МКАД', 58, 64, edge(MKAD, 55), 55, GOLD, t => share(CYG_RS * SHADOW, t) - share(MKAD, t) + 0.03)
body(CYG_RS, { color: BLUE, dash: [0.008, 0.006], width: 0.0016, start: 58 }, 0.3, 0.012)
tag('горизонт событий', 58.5, 64, edge(CYG_RS, -35), -35, BLUE)
named('Лебедь X-1\n21 масса Солнца', 57, 64.5)
noted('Первая признанная чёрная дыра, 1972 год.\nВся Москва — маленький круг в её тени', 58, 64.5)

// --- The Earth and the Sun ----------------------------------------------------------------------------------

// The Earth is NASA's photograph from Apollo 17, its disc 0.78 of the picture's half side; the Sun is SDO's
// white-light image of the day the film was made, cut out with its disc filling the picture
picture(EARTH, 'films/fourth_dimension/earth.png', 0.78, 0.45, 0.002)
named('Земля\n12 742 км', 66, 70.5)
credit('снимок NASA, «Аполлон-17»', 66, 70.5)
// A halo under the Sun, which carries it as a point once the disc is a few pixels across
body(SUN, { color: '#ffb347', glow: 0.025, width: 0.0015 }, 0.45, 0.0005)
picture(SUN, 'films/scale/sun.png', 1, 0.45, 0.0005)
body(MOON, { color: WHITE, dash: [0.006, 0.006], width: 0.0014, peak: 0.8 }, 1.5, 0.004)
tag('орбита Луны', 72.5, 76.5, edge(MOON, 42), 42, WHITE, t => share(SUN, t) - share(MOON, t) + 0.04)
named('Солнце\n1,39 млн км', 72, 76.8)
credit('снимок NASA SDO, 28.11.2026', 72, 76.8)
noted('Орбита Луны поместилась бы внутри Солнца', 72.5, 76.8)

// --- Sgr A* and the planets ---------------------------------------------------------------------------------

const PLANETS = [0.387, 1, 5.2, 9.58, 19.2, 30.1]
PLANETS.forEach(a => body(a * AU, { color: a === 1 ? BLUE : '#a9bcd8', width: 0.0014, peak: a === 1 ? 0.9 : 0.55 }, 1.5, 0.005))
tag('Солнце', 79, 84.8, edge(SUN, -135), -135, '#ffe7a0')
tag('орбита Меркурия', 79.5, 85.3, edge(0.387 * AU, 52), 52)
tag('орбита Земли', 80, 85.5, edge(AU, 172), 172, BLUE)
named('Sgr A* · центр Млечного Пути\n4,3 млн масс Солнца', 78, 85.6)
noted('Солнце — точка в центре её тени.\nОрбита Меркурия шире тени всего в 1,75 раза', 79, 85.6)

// --- M87* ---------------------------------------------------------------------------------------------------

const VOYAGER = 173 * AU // one light day, which it reaches in November 2026
dot(VOYAGER, -25, WHITE, 0.004, 0.85, 0.004)
tag('Вояджер-1 · 1 световые сутки', 90, 96.5, t => placeAt(VOYAGER, -25, t), -25, WHITE)
tag('орбита Нептуна', 90.5, 96.5, edge(30.1 * AU, 50), 50)
named('M87*\n6,5 млрд масс Солнца', 89, 97)
noted('В её тени поместится вся Солнечная система\nвместе с «Вояджером-1», который летит уже 49 лет', 90, 97)

// --- The stars ----------------------------------------------------------------------------------------------

// The Sun's real neighbours seen from above the Galaxy's plane: distance in light years, galactic longitude
// and latitude in degrees, set at the distance they lie from the Sun along the plane. Longitude 0 points at
// the Galaxy's centre, which this film puts at GAL_ANGLE, so the stars and the Milky Way that follows them
// are one map
const NEIGHBOURS = [
  ['Проксима Центавра', 4.24, 313.9, -1.9, '#ffb08a'], ['α Центавра', 4.37, 315.7, -0.7, '#fff1d0'],
  ['звезда Барнарда', 5.96, 31.0, 14.1, '#ffb08a'], ['Вольф 359', 7.86, 244.1, 56.1, '#ff9a7a'],
  ['Лаланд 21185', 8.31, 185.1, 65.4, '#ffb08a'], ['Сириус', 8.6, 227.2, -8.9, '#dfe9ff'],
  ['ε Эридана', 10.47, 195.8, -48.1, '#ffd9a0'], ['Процион', 11.46, 213.7, 13.0, '#fff4dc'],
  ['61 Лебедя', 11.4, 82.3, -5.8, '#ffc890'], ['ε Индейца', 11.87, 336.2, -48.0, '#ffc890'],
  ['τ Кита', 11.9, 173.1, -73.4, '#fff1d0']
]
const starPlace = ([, ly, l, b]) => ({ R: ly * LY * Math.cos(rad(b)), a: GAL_ANGLE + l })
body(LY, { color: SOFT, dash: [0.008, 0.008], width: 0.0014, peak: 0.7 }, 1, 0.004)
tag('1 световой год', 98.5, 103.5, edge(LY, 290), 290)
for (const star of NEIGHBOURS) {
  const { R, a } = starPlace(star)
  dot(R, a, star[4], 0.0045, 0.85, 0.004)
}
for (const k of [0, 2]) {
  const { R, a } = starPlace(NEIGHBOURS[k])
  tag(NEIGHBOURS[k][0], 100, 104.8, t => placeAt(R, a, t), a, NEIGHBOURS[k][4])
}
named('Соседи Солнца\nдо 12 световых лет', 99.5, 105.8)
noted('Вид сверху на плоскость Галактики:\nближайшая звезда — в 4,2 светового года', 100.5, 105.8)

// --- The Milky Way ------------------------------------------------------------------------------------------

at(108, () => draw({ kind: 'circle', center: [0.5, 0.5], radius: 0.012, color: GOLD, width: 0.0016 }, 8))
tag('Солнце', 108.5, 116, () => [0.5 + 0.012 * Math.cos(rad(30)) * W, 0.5 - 0.012 * Math.sin(rad(30))], 30, GOLD)
tag('Sgr A*', 109, 116, galaxyCentre, 200, '#ffd9a0')
named('Млечный Путь\n100 000 световых лет', 108, 116.5)
noted('Солнце — в 26 000 световых лет от центра,\nгде живёт Sgr A*', 109, 116.5)
noted('Дальше галактики — как пылинки,\nи их сотни миллиардов', 116.8, 119.5)

// --- The universe -------------------------------------------------------------------------------------------

body(HUBBLE, { color: GOLD, width: 0.0018, dash: [0.01, 0.006], stop: 131.5 }, 1.2, 0.0001)
body(OBSERVABLE, { color: '#ff9a5a', width: 0.0025, glow: 0.02, stop: 131.5 }, 1.2, 0.0001)
tag('хаббловская сфера\n14 млрд св. лет', 122, 128, edge(HUBBLE, 25), 25, GOLD, t => share(OBSERVABLE, t) - share(HUBBLE, t) + 0.035)
tag('реликтовое излучение', 122.5, 131, edge(OBSERVABLE, 205), 205, '#ff9a5a')
named('Наблюдаемая Вселенная\n93 млрд световых лет', 121, 131)
noted('Масса внутри хаббловской сферы дала бы радиус\nШварцшильда, равный самой сфере. Так устроена плоская Вселенная', 123, 127.5)
noted('Это не значит, что мы внутри чёрной дыры:\nу Вселенной нет центра и нет «снаружи»', 127.6, 131)
at(131.2, () => caption('61 порядок: от 10^{-34} до 10^{27} м', 2.6, { at: [0.5, 0.5], font: 'unbounded', size: 0.045, fade: 0.6 }))

wait(END)
