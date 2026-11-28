// Sixty-one orders: one pull back from the Planck length to the Hubble sphere, the frame's height running from
// 10^-34 to 10^27 metres. A black hole stands at every scale it can have, each at its true size for the frame:
// a Planck-mass hole that evaporates, the Earth squeezed into one, Cygnus X-1 with Moscow inside its shadow,
// Sgr A* with the Sun a dot in its middle, M87* with the whole Solar System and Voyager 1 inside its shadow.
// Between them the proton, the atom (flow B as the electron's cloud), a virus, a cell, a man, the Earth, the
// Sun with the Moon's orbit inside it, the Sun's real neighbours, the Milky Way (the hole taken away, so its
// flows are measured in Lattice Unit): stars on circular orbits at its flat rotation curve, an old disc
// (flow A), young stars lit where they are born in two arms they then drift through (flow C), and a bulge
// turning as a wheel (flow B). Beyond it the map turns to the supergalactic
// plane, where the nearby universe lies flat, and every galaxy is a real one: a map of 47 000 from two
// catalogues (map_*.png, drawn by galaxy_map.py beside this file) in eleven levels a power of two apart, with
// NASA's GALEX photographs of Andromeda and the Triangulum over it. On it the Local Group, the Virgo Cluster
// with the infall round it (flow A), Laniakea, its motions converging on the Great Attractor (flow C), and
// past the catalogues' reach the cosmic web (a layer of the scene whose voids merge into an even glow as the
// frame grows), then the observable universe.
//
// Everything is one number: L(t), the base-10 logarithm of the frame's height in metres, a monotone curve
// through the keys below that slows at every stop. A thing of R metres is R / 10^L of the short side; the
// hole's size, the radii of the circles, the cloud and the galaxy all read that, so they cannot drift apart.
// Bodies stand round the frame's middle, where the hole is, so every comparison is concentric. Every thing
// is drawn at its own size and shrinks with the pull back; what is smaller than a point (POINT) stays one,
// and a glow is never wider than what it lies round. The ruler is
// the lensed grid drawn in powers of ten (Grid Decades), one cell one power of ten of metres, which the
// counter and the bar under it name; the Earth and the Sun are NASA's photographs.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/scale/scale.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/scale/scale.js films/scale/out/scale.mp4
// The narration is LINES below, spoken by films/scale/voice.mjs into films/scale/out/scale.wav.
/* global film, set, drive, wait, caption, draw, meanwhile, at, mark */
film({
  size: '1080p', fps: 60, seed: 61, preset: 'Schwarzschild',
  settings: {
    fieldEnabled: false, blackHoleSize: 26, followFrequency: 60, cameraFloat: 0, cameraBank: 0,
    gridLatticeUnit: 0.01, gridSky: 0.3, gridCell: 40, gridSkyDecades: 1, gridSkyLine: 1.4, starsBrightness: 0, starDensity: 0.25,
    // Flow A: Cygnus X-1's disc, in the hole's radii, the Milky Way's old disc, then the infall round the
    // Virgo Cluster
    flowACount: 7000, flowASwirl: 0.5, flowALife: 10, flowATrail: 0.6, flowASize: 1.3, flowAColor: '#ffcf9a', flowTrace: 1,
    // Flow B: the electron's cloud first, the galaxy's bulge later. Turned as a wheel (Falloff 0), so its
    // radii can follow the zoom without moving a particle round
    flowBCount: 9000, flowBFalloff: 0, flowBSwirl: 1.2, flowBLife: 0.5, flowBTrail: 0.02, flowBSize: 1.2,
    flowBColor: '#9fd0ff',
    // Flow C: the galaxy's young stars, born on two arms of the Milky Way's pitch, on circular orbits at a flat
    // rotation curve (Falloff 1), living a small share of an orbit, as its blue giants do; then Laniakea's
    // motions
    flowCCount: 12000, flowCFalloff: 1, flowCLife: 2.2, flowCTrail: 0.8, flowCSize: 1, flowCColor: '#cfe0ff',
    flowCArms: 2, flowCArmWidth: 0.1, flowCArmPitch: 13,
    // The cosmic web's galaxies and their size; its brightness and its voids are driven below
    cosmicWebGalaxies: 16, cosmicWebSize: 0.14
  }
})

// --- The narration ----------------------------------------------------------------------------------------

// What the narrator says (films/scale/voice.mjs speaks it), by name, spelled the way it is spoken, and the
// second each line starts at. The film does not wait for the voice: each line must end before the next one
// starts, which the mix checks
const LINES = {
  title: 'Шестьдесят один порядок. От планковской длины до края Вселенной.',
  planck: 'Планковская длина. Самая лёгкая чёрная дыра весит здесь двадцать два микрограмма, и по формуле Хокинга она испаряется почти мгновенно.',
  collider: 'Следующие шестнадцать порядков не видел никто. Коллайдер различает только десять в минус девятнадцатой метра.',
  proton: 'Протон. Три кварка и поле, которое их держит.',
  atom: 'Атом водорода. Облако показывает, где может быть электрон, а ядро в шестьдесят тысяч раз меньше.',
  virus: 'Вирус, сто нанометров.',
  cell: 'Эритроцит, восемь микрон.',
  earthHole: 'Чтобы стать чёрной дырой, Земле пришлось бы сжаться в шарик в восемнадцать миллиметров.',
  man: 'А это человек.',
  cygnus: 'Лебедь икс один, первая признанная чёрная дыра. Вся Москва поместилась бы в её тени.',
  earth: 'Земля, почти тринадцать тысяч километров в поперечнике.',
  sun: 'Солнце. Орбита Луны поместилась бы внутри него.',
  sgr: 'Стрелец А со звёздочкой, чёрная дыра в центре Галактики. Солнце в её тени — просто точка.',
  m87: 'Эм восемьдесят семь, шесть с половиной миллиардов Солнц. В её тени поместится вся Солнечная система вместе с «Вояджером».',
  stars: 'Соседи Солнца, вид сверху на плоскость Галактики. Ближайшая звезда — в четырёх световых годах.',
  milky: 'Млечный Путь, сто тысяч световых лет. Звёзды кружат вокруг центра, и Солнцу на один оборот нужно двести тридцать миллионов лет.',
  group: 'Местная группа, около восьмидесяти галактик. Андромеда в двух с половиной миллионах световых лет, и она сближается с нами.',
  virgo: 'Скопление Девы, больше тысячи галактик. Местная группа тоже понемногу падает к нему.',
  laniakea: 'Ланиакея: сто тысяч галактик, и все их движения сходятся к Великому аттрактору. Мы живём на её окраине.',
  web: 'Космическая паутина. Галактики лежат на нитях и стенах вокруг огромных пустот.',
  even: 'А на самых больших масштабах Вселенная везде одинакова.',
  universe: 'Наблюдаемая Вселенная. Масса внутри хаббловской сферы дала бы радиус Шварцшильда, равный самой сфере.',
  outside: 'Но мы не внутри чёрной дыры: у Вселенной нет ни центра, ни «снаружи».'
}
const SAID = {
  title: 0.4, planck: 4.7, collider: 13.6, proton: 21, atom: 26.3, virus: 33.3, cell: 37.6, earthHole: 42.2,
  man: 49, cygnus: 57.3, earth: 66.2, sun: 72.2, sgr: 78.3, m87: 89.3, stars: 99.6, milky: 108.3, group: 119.8,
  virgo: 132.3, laniakea: 143, web: 154, even: 160.8, universe: 167.3, outside: 174.5
}
for (const [name, second] of Object.entries(SAID)) at(second, () => mark('say:' + name))

// --- The zoom ---------------------------------------------------------------------------------------------

// [second, log10 of the frame's height in metres]: travel between the stops, a slow drift at each
const KEYS = [
  [0, -33.5], [9, -33.3], // the Planck-mass hole
  [13, -18.7], [16, -18.3], // the collider's limit
  [19, -14.8], [22.5, -14.35], // the proton
  [26.5, -10.0], [30.5, -9.75], // the atom
  [32.8, -6.75], [35.3, -6.55], // a virus
  [37.3, -4.85], [39.8, -4.65], // a red blood cell
  [42, -1.25], [45, -1.0], // the Earth as a black hole
  [49, 0.45], [51.5, 0.6], // a man
  [56, 5.65], [62, 5.85], // Cygnus X-1
  [65.5, 7.35], [68, 7.5], // the Earth
  [71, 9.25], [74, 9.4], // the Sun
  [77, 11.55], [84, 11.75], // Sgr A*
  [88, 14.0], [95, 14.2], // M87*
  [99, 17.05], [102.5, 17.3], // the Sun's neighbours
  [107, 20.95], [114, 21.15], // the Milky Way
  [119.5, 22.7], [126, 22.9], // the Local Group
  [131.5, 24.15], [138, 24.35], // the Virgo Cluster
  [142.5, 24.95], [149.5, 25.1], // Laniakea
  [153.5, 25.45], [160, 25.6], // the cosmic web
  [167, 27.05], [180, 27.35] // the observable universe
]
const END = 180

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
const POINT = 0.0018 // the radius of a thing smaller than a point, a share of the short side: two pixels
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
const MPC = 3.086e22
const GALAXY = 4.73e20 // the Milky Way's disc, 50 000 light years
const SUN_FROM_CENTRE = 2.46e20 // 26 000 light years
const HUBBLE = 1.32e26 // c / H0 at 70 km/s/Mpc
const OBSERVABLE = 4.40e26

// The holes, by their shadows: when each grows into the frame, how bright its disc, and when it evaporates
const HOLES = [
  { R: SHADOW * PLANCK_RS, grow: null, gone: 8, disc: 0 },
  { R: SHADOW * EARTH_RS, grow: when(SHADOW * EARTH_RS, 0.46), disc: 0 },
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
const galaxyCentre = t => placeAt(SUN_FROM_CENTRE, GAL_ANGLE, t)
// The second at which the frame's log reaches `value`
const atL = value => {
  let lo = 0
  let hi = END
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (L(mid) < value) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// Beyond the Milky Way the map is the supergalactic plane, the plane the nearby universe lies in: a place
// stands at its supergalactic longitude from SG_ANGLE, its distance projected onto the plane (the catalogue
// map is drawn the same way). The Milky Way's disc stays face on, as its own map had it
const SG_ANGLE = 47.1
const onPlane = (mpc, sgl, sgb) => ({ R: mpc * MPC * Math.cos(rad(sgb)), a: SG_ANGLE + sgl })
const VIRGO = onPlane(16.5, 102.9, -2.3) // the Virgo Cluster, 54 million light years
const ATTRACTOR = onPlane(65, 169.8, -9.2) // the Great Attractor, at Laniakea's heart
const LANIAKEA = 80 * MPC // Laniakea's radius, 260 million light years
const VOID = 50 * MPC // the gap between two voids' middles, 160 million light years
// The stretches the flows stand round each: the cluster's infall, then Laniakea's motions
const V_IN = atL(23.98)
const V_OUT = atL(24.5)
const G_IN = atL(24.75)
const G_OUT = atL(25.35)

// Where the hole stands, which the flows turn round: the frame's middle, then each place in turn while its
// flows are on, gliding from the last over the second and a half before, and back to the middle at the end;
// nothing is drawn round it while it glides
const ANCHORS = [
  { from: GAL_IN, to: GAL_OUT, at: galaxyCentre },
  { from: V_IN, to: V_OUT, at: t => placeAt(VIRGO.R, VIRGO.a, t) },
  { from: G_IN, to: G_OUT, at: t => placeAt(ATTRACTOR.R, ATTRACTOR.a, t) }
]
const holePlace = (t, k) => {
  let value = 0.5
  for (const anchor of ANCHORS) {
    const there = clamp(anchor.at(clamp(t, anchor.from, anchor.to))[k], 0, 1)
    value += (there - value) * smooth((t - (anchor.from - 1.5)) / 1.5)
  }
  return value + (0.5 - value) * smooth((t - G_OUT) / 1.5)
}
// Flow radii with no hole are in Lattice Unit, 1% of the short side
const unit = (R, t) => share(R, t) / 0.01
const flowRadius = v => clamp(v, 0.2, 200)
const units = R => t => flowRadius(unit(R, t))
const fixedAt = v => () => v
// A flow's value for each stretch it is on, passing from one to the next on a log scale while it is dark
const phased = stretches => t => {
  let i = 0
  while (i < stretches.length - 1 && t > stretches[i].to) i++
  const now = stretches[i]
  if (i === 0 || t >= now.from) return now.value(t)
  const last = stretches[i - 1]
  const u = smooth((t - last.to) / Math.max(now.from - last.to, 0.01))
  return Math.exp(Math.log(last.value(t)) * (1 - u) + Math.log(now.value(t)) * u)
}
const CYG_DISC = { from: 0, to: 70 }
// The galaxy's pace: turns a second at the Sun's orbit, the first radius of both discs. At a flat rotation
// curve (Falloff 1) Swirl is the pace at a radius of 1 Lattice Unit, so it is driven as this pace times the
// first radius, and the zoom, which shrinks the radii, leaves every star's pace alone
const GALAXY_PACE = 0.03
const SUN_ORBIT = SUN_FROM_CENTRE / GALAXY
const ATOM = { from: 0, to: ATOM_OUT }
const MILKY = { from: GAL_IN, to: GAL_OUT }
const CLUSTER = { from: V_IN, to: V_OUT }
const STREAMS = { from: G_IN, to: G_OUT }
// The second between the galaxy and Laniakea, while flow C is dark: its other settings change there
const C_TO_STREAMS = (GAL_OUT + V_IN) / 2

// The first radii the discs' pace is driven from
const aFrom = phased([{ ...CYG_DISC, value: fixedAt(1.9) }, { ...MILKY, value: units(SUN_ORBIT * GALAXY) }, { ...CLUSTER, value: units(11 * MPC) }])
const cFrom = phased([{ ...MILKY, value: units(SUN_ORBIT * GALAXY) }, { ...STREAMS, value: units(0.95 * LANIAKEA) }])

meanwhile(() => drive({
  fade: s => s < 2.5 ? 1 : s < 4 ? 1 - smooth((s - 2.5) / 1.5) : smooth((s - 177) / 2.5),
  blackHoleSize: s => holeSize(s),
  blackHoleX: s => holePlace(s, 0),
  blackHoleY: s => holePlace(s, 1),
  flowA: s => {
    if (s > 100) return s < C_TO_STREAMS ? 0.7 * lit(s, GAL_IN, GAL_OUT) : 0.3 * lit(s, V_IN, V_OUT)
    const on = holeAt(s)
    return on && holeSize(s) > 0 ? on.hole.disc * on.g : 0
  },
  // Cygnus X-1's disc; the galaxy's old disc, circular orbits round the Sun's; the infall into the cluster
  flowAFrom: aFrom,
  flowATo: phased([{ ...CYG_DISC, value: fixedAt(1.9) }, { ...MILKY, value: units(SUN_ORBIT * GALAXY) }, { ...CLUSTER, value: units(1.2 * MPC) }]),
  flowASpread: phased([{ ...CYG_DISC, value: fixedAt(1) }, { ...MILKY, value: units(0.85 * GALAXY) }, { ...CLUSTER, value: units(4 * MPC) }]),
  flowASwirl: s => s < 100
    ? 0.5 + (GALAXY_PACE * aFrom(s) - 0.5) * smooth((s - 95) / 5)
    : GALAXY_PACE * aFrom(s) * (1 - smooth((s - GAL_OUT) / (C_TO_STREAMS - GAL_OUT))),
  // The electron's cloud, then the galaxy's bulge
  flowB: s => s < 60 ? 1.1 * lit(s, ATOM_IN, ATOM_OUT) : 2 * lit(s, GAL_IN, GAL_OUT),
  flowBFrom: phased([{ ...ATOM, value: units(0.9 * BOHR) }, { ...MILKY, value: units(0.07 * GALAXY) }]),
  flowBTo: phased([{ ...ATOM, value: units(0.9 * BOHR) }, { ...MILKY, value: units(0.07 * GALAXY) }]),
  flowBSpread: phased([{ ...ATOM, value: units(1.8 * BOHR) }, { ...MILKY, value: units(0.14 * GALAXY) }]),
  // The galaxy's young stars, on the same orbits as its old disc, then Laniakea's motions
  flowC: s => s < C_TO_STREAMS ? 1.1 * lit(s, GAL_IN, GAL_OUT) : 0.45 * lit(s, G_IN, G_OUT),
  flowCFrom: cFrom,
  flowCTo: phased([{ ...MILKY, value: units(SUN_ORBIT * GALAXY) }, { ...STREAMS, value: units(0.06 * LANIAKEA) }]),
  flowCSpread: phased([{ ...MILKY, value: units(0.85 * GALAXY) }, { ...STREAMS, value: units(0.25 * LANIAKEA) }]),
  flowCSwirl: s => GALAXY_PACE * cFrom(s) * (1 - smooth((s - GAL_OUT) / (C_TO_STREAMS - GAL_OUT))),
  // The cosmic web past the catalogues' reach, cleared where the map lies: in from Laniakea, round the map;
  // when a void is a few pixels across the layer is an even glow, the universe the same everywhere on the
  // largest scales
  cosmicWeb: s => 1.6 * smooth((L(s) - 24.9) / 0.4),
  cosmicWebHole: s => Math.min(100 * share(250 * MPC, s), 400),
  cosmicWebCell: s => clamp(100 * VOID / Math.pow(10, L(s)), 0.05, 2000),
  // The ruler of the whole film: the lensed grid in powers of ten (Grid Decades), its cell one power of ten
  // of metres. Grid Zoom is the log of the frame itself, a number that only rises, so the cell shrinks from
  // Grid Spacing's 40% to 4% and the scene folds it back seamlessly: no track ever carries the jump. It
  // stands at the frame's middle, where every body is, and each hole bends it at its own scale. Brighter in
  // the small, where there are no stars
  gridSkyZoom: s => L(s) + Math.log10(0.4) + 40,
  gridSky: s => 0.2 + 0.1 * (1 - smooth((L(s) + 0.5) / 2)),
  starsBrightness: s => 1.3 * smooth((L(s) - 0.5) / 2) * (1 - smooth((L(s) - 16.3) / 1.5))
}, END))

// Flow B becomes the bulge while it is dark between the atom and the galaxy: the inner kiloparsec turns as a
// wheel, as fast as the disc where they meet
at(60, () => set({ flowBSwirl: 0.08, flowBLife: 14, flowBTrail: 1.2, flowBSize: 1.3, flowBColor: '#ffd9a0', flowBCount: 7000 }))
// Flow A becomes the galaxy's old disc while it is dark: old stars all round, on circular orbits at the flat
// rotation curve, living long
at(100, () => set({ flowTrace: 0, flowAFalloff: 1, flowALife: 40, flowATrail: 1, flowACount: 14000, flowASize: 1, flowAColor: '#ffe2bd' }))
// Between the galaxy and the cluster, while both are dark, flow A becomes the infall (a straight fall into the
// cluster from every side, the motion the galaxies round it have on top of the universe's expansion) and flow
// C Laniakea's motions (a fall from the whole basin to the Great Attractor)
at(C_TO_STREAMS, () => set({ flowALife: 20, flowATrail: 1.5, flowAFall: 1.5, flowAFalloff: 0, flowACount: 1500, flowASize: 1.3, flowAColor: '#ffd9b0',
  flowCArms: 0, flowCFalloff: 0, flowCLife: 40, flowCTrail: 3, flowCFall: 1.5, flowCCount: 12000, flowCColor: '#ffd9b0' }))

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
// (`peak` its brightest opacity, `start` the earliest second it may come in, `glow` its widest glow, which
// shrinks with it once the circle is under twice as wide)
function body (R, { peak = 1, start = 0, stop = END, glow = 0, ...spec }, hi = 1.5, lo = 0.003) {
  const from = Math.max(when(R, hi), start)
  const to = Math.min(when(R, lo), stop)
  if (to - from < 0.2) return
  at(from, () => draw({
    kind: 'circle', center: [0.5, 0.5], radius: 'r', opacity: 'o', glow: 'g', ...spec,
    values: {
      r: s => share(R, from + s),
      g: s => Math.min(glow, 0.5 * share(R, from + s)),
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

// A thing of `size` metres across at R metres and `a` degrees, a point once it is smaller than one: a probe,
// a star
function dot (R, a, color, size, hi, lo) {
  const from = when(R, hi)
  const to = when(R, lo)
  const r = s => Math.max(share(size / 2, from + s), POINT)
  at(from, () => draw({
    kind: 'circle', center: ['x', 'y'], radius: 'r', fill: color, color, glow: 'g', opacity: 'o',
    values: {
      x: s => placeAt(R, a, from + s)[0],
      y: s => placeAt(R, a, from + s)[1],
      r,
      g: s => 1.6 * r(s),
      o: s => smooth(s / 0.6) * smooth((to - from - s) / 0.8)
    }
  }, to - from))
}

// The opening card, on black
at(0.4, () => {
  caption('Шестьдесят один порядок', 3.4, { at: [0.5, 0.45], font: 'unbounded', size: 0.06, fade: 0.6 })
  caption('от планковской длины до края Вселенной', 3.4, { at: [0.5, 0.56], font: 'noto', size: 0.03, color: SOFT, fade: 0.6 })
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
    // Each ends a hair before the next begins, so no frame holds two
    const span = steps[k + 1] - a - 1e-4
    at(a, () => {
      caption(`10^{${n}} м`, span, { at: [0.045, 0.09], anchor: 'left', align: 'left', font: 'unbounded', size: 0.055, fade: 0, opacity: 'o', values: { o: s => o(a, s) } })
      draw({ ...ruler, points: [[0.045, 0.16], ['x', 0.16]], values: { x: cell, o: s => o(a, s) } }, span)
      draw({ ...ruler, points: [['x', 0.148], ['x', 0.172]], values: { x: cell, o: s => o(a, s) } }, span)
    })
  }
  at(START, () => {
    draw({ ...ruler, points: [[0.045, 0.148], [0.045, 0.172]], values: { o: s => o(START, s) } }, END - START)
    caption('одна клетка сетки', END - START, { at: [0.045, 0.2], anchor: 'left', align: 'left', font: 'noto', size: 0.022, color: SOFT, fade: 0.8 })
  })
}

// --- The Planck scale -------------------------------------------------------------------------------------

named('Планковская длина\n1,6·10^{-35} м', 3.5, 10.5)
noted('Чёрная дыра планковской массы, 22 микрограмма:\nменьше чёрной дыры не бывает', 3.3, 8.5)
noted('По формуле Хокинга она испаряется за 10^{-39} секунды', 8.6, 12.6)
// Its evaporation: a flash where it was
at(8, () => draw({
  kind: 'circle', center: [0.5, 0.5], radius: 'r', fill: WHITE, color: WHITE, glow: 0.05, opacity: 'o',
  values: { r: s => 0.02 + 0.5 * smooth(s / 1.2), o: s => 1 - smooth(s / 1.2) }
}, 1.3))
at(12.7, () => caption('Следующие 16 порядков не видел никто:\nБольшой адронный коллайдер различает около 10^{-19} м', 6.5, note))
// The collider's limit, passing through the frame where the zoom slows for it
const LHC = 1e-19
body(LHC, { color: SOFT, dash: [0.01, 0.008], width: 0.002 }, 0.35, 0.02)
tag('предел разрешения БАК', when(LHC, 0.35), when(LHC, 0.03), edge(LHC, 35), 35)

// --- The proton and the atom ------------------------------------------------------------------------------

body(PROTON, { color: '#ffb38a', fill: '#ff7a4a', fillOpacity: 0.18, glow: 0.01, width: 0.002 }, 0.6, 0.0015)
{
  // Three quarks, turning slowly inside it
  const from = when(PROTON, 0.6)
  const to = when(PROTON, 0.004)
  ;['#ff6a6a', '#6aff8a', '#6a9aff'].forEach((color, k) => at(from, () => draw({
    kind: 'circle', center: ['x', 'y'], radius: 'r', fill: color, color, glow: 'g', opacity: 'o',
    values: {
      x: s => 0.5 + 0.42 * share(PROTON, from + s) * Math.cos(rad(90 + 120 * k + 12 * s)) * W,
      y: s => 0.5 - 0.42 * share(PROTON, from + s) * Math.sin(rad(90 + 120 * k + 12 * s)),
      r: s => 0.16 * share(PROTON, from + s),
      g: s => Math.min(0.006, 0.16 * share(PROTON, from + s)),
      o: s => smooth(s / 0.6) * smooth((to - from - s) / 0.6)
    }
  }, to - from)))
}
named('Протон\n0,84·10^{-15} м', 19.5, 25)
noted('Три кварка и поле, которое их держит', 20.5, 25)

named('Атом водорода\n0,53·10^{-10} м', 26, 32.2)
// Its nucleus, the proton, a point at the middle of the cloud
at(ATOM_IN, () => draw({ kind: 'circle', center: [0.5, 0.5], radius: POINT, fill: '#ffb38a', color: '#ffb38a', glow: 1.6 * POINT }, ATOM_OUT - ATOM_IN))
noted('Облако — где может оказаться электрон.\nЯдро в 60 000 раз меньше самого атома', 26.8, 32.2)

// --- Life ---------------------------------------------------------------------------------------------------

const VIRUS = 5e-8
const CELL = 3.9e-6
body(VIRUS, { color: '#9be39b', fill: '#4fae4f', fillOpacity: 0.15, dash: [0.006, 0.004], width: 0.003 }, 0.8, 0.004)
tag('вирус · 100 нм', when(VIRUS, 0.5), when(VIRUS, 0.04), edge(VIRUS, 35), 35, '#9be39b')
body(CELL, { color: '#ff7a7a', fill: '#ff5a5a', fillOpacity: 0.2, width: 0.003 }, 0.8, 0.004)
tag('эритроцит · 8 мкм', when(CELL, 0.5), when(CELL, 0.04), edge(CELL, 145), 145, '#ff9a9a')

// --- The Earth as a black hole ------------------------------------------------------------------------------

body(EARTH_RS, { color: BLUE, dash: [0.008, 0.006], width: 0.0016, start: 42.3 }, 0.3, 0.012)
tag('горизонт событий', 42.5, 47.5, edge(EARTH_RS, 40), 40, BLUE)
named('Земля, сжатая в чёрную дыру\nгоризонт — 9 мм', 41.5, 47.8)
noted('Чтобы стать чёрной дырой, Земле нужно сжаться\nв шарик 18 мм. Тень в 2,6 раза шире горизонта', 42, 48.2)

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
named('Солнце\n1,39 млн км', 72, 76.3)
credit('снимок NASA SDO, 28.11.2026', 72, 76.3)
noted('Орбита Луны поместилась бы внутри Солнца', 72.5, 76.8)

// --- Sgr A* and the planets ---------------------------------------------------------------------------------

const PLANETS = [0.387, 1, 5.2, 9.58, 19.2, 30.1]
PLANETS.forEach(a => body(a * AU, { color: a === 1 ? BLUE : '#a9bcd8', width: 0.0014, peak: a === 1 ? 0.9 : 0.55 }, 0.85, 0.005))
tag('Солнце', 79, 84.2, edge(SUN, -135), -135, '#ffe7a0')
tag('орбита Меркурия', 79.5, 83, edge(0.387 * AU, 52), 52)
tag('орбита Земли', 80, 84.2, edge(AU, 172), 172, BLUE)
named('Sgr A* · центр Млечного Пути\n4,3 млн масс Солнца', 78, 84.3)
noted('Солнце — точка в центре её тени.\nОрбита Меркурия шире тени всего в 1,75 раза', 78.8, 84.3)

// --- M87* ---------------------------------------------------------------------------------------------------

const VOYAGER = 173 * AU // one light day, which it reaches in November 2026
dot(VOYAGER, -25, WHITE, 0, 0.85, 0.004)
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
  dot(R, a, star[4], 2 * SUN, 0.85, 0.004)
}
for (const k of [0, 2]) {
  const { R, a } = starPlace(NEIGHBOURS[k])
  tag(NEIGHBOURS[k][0], 100, 104.8, t => placeAt(R, a, t), a, NEIGHBOURS[k][4])
}
named('Соседи Солнца\nдо 12 световых лет', 99.5, 105.8)
// Gone before the first of the real stars, which close in on the middle, passes under it
noted('Ближайшая звезда — в 4,2 светового года', 99.4, 102.8)

// --- The Milky Way ------------------------------------------------------------------------------------------

at(108, () => draw({ kind: 'circle', center: [0.5, 0.5], radius: POINT, fill: GOLD, color: GOLD, glow: 1.6 * POINT }, 8))
tag('Солнце', 108.5, 116, () => [0.5, 0.5], 30, GOLD)
tag('Sgr A*', 109, 116, galaxyCentre, 200, '#ffd9a0')
named('Млечный Путь\n100 000 световых лет', 108, 116.5)
noted('Солнце — в 26 000 световых лет от центра,\nгде живёт Sgr A*', 109, 116.5)

// --- The real galaxies ---------------------------------------------------------------------------------------

// The map of the nearby universe: the Updated Nearby Galaxy Catalog (Karachentsev and others, 2013), with
// measured distances, to 9 Mpc, and the 2MASS Redshift Survey (Huchra and others, 2012) beyond, each galaxy at
// its redshift's distance, the big clusters' fingers of god pulled back into them and the strip the Milky Way
// hides filled from the strips beside it, each galaxy's light multiplied by how much the survey thins at its
// distance, faded out from 150 to 230 Mpc where the survey ends; the cosmic web goes on round it. Every galaxy
// is a disc of its own size on every level, so it shrinks with the frame until it is a point. Eleven levels,
// each 2048 pixels across and E Mpc from us to its edge, a power of two apart; each is strongest where its
// pixel is the frame's and shares the frame with the next between, as mipmaps do, so no galaxy grows when a
// level gives way
const MAPS = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
const native = E => Math.log10(2 * E * MPC / (2048 / 1080))
const OCTAVE = Math.log10(2)
MAPS.forEach((E, k) => {
  const first = k === 0
  const last = k === MAPS.length - 1
  const into = first ? 21.75 : native(MAPS[k - 1])
  const away = last ? 26.3 : native(MAPS[k + 1])
  const from = atL(into)
  const to = atL(away)
  const weight = l => {
    if (l < native(E)) return first ? smooth((l - 21.75) / 0.25) : 1 - (native(E) - l) / OCTAVE
    return last ? 1 - smooth((l - 26.0) / 0.3) : 1 - (l - native(E)) / OCTAVE
  }
  at(from, () => draw({
    kind: 'image', src: `films/scale/map_${E}.png`, center: [0.5, 0.5], width: 'w', opacity: 'o',
    values: {
      w: s => share(2 * E * MPC, from + s),
      o: s => clamp(weight(L(from + s)), 0, 1)
    }
  }, to - from))
})

// --- The Local Group ----------------------------------------------------------------------------------------

// Andromeda and the Triangulum are NASA's GALEX photographs, cut out by their own light, each disc spanning
// 0.926 of its picture's width, laid over their own discs on the map, which carries them on once they go.
// The Magellanic Clouds are the map's
const M31 = { ...onPlane(2.5e6 * LY / MPC, -23.8, 12.5), width: 1.44e21 / 0.926 }
const M33 = { ...onPlane(2.73e6 * LY / MPC, -31.5, -0.1), width: 5.77e20 / 0.926 }
const LMC = onPlane(0.05, -144.2, -34.1)
function galaxyPicture (src, g) {
  const from = when(g.R, 0.85)
  const to = when(g.width, 0.004)
  at(from, () => draw({
    kind: 'image', src, center: ['x', 'y'], width: 'w', opacity: 'o',
    values: {
      x: s => placeAt(g.R, g.a, from + s)[0],
      y: s => placeAt(g.R, g.a, from + s)[1],
      w: s => share(g.width, from + s),
      o: s => smooth(s / 0.8) * smooth((to - from - s) / 0.8)
    }
  }, to - from))
}
galaxyPicture('films/scale/m31.png', M31)
galaxyPicture('films/scale/m33.png', M33)
tag('Андромеда', 120.5, 125.8, t => placeAt(M31.R, M31.a, t), 180, '#cfe0ff')
tag('Треугольник', 121, 125.8, t => placeAt(M33.R, M33.a, t), 0, '#cfe0ff')
tag('Магеллановы Облака', 121, 125.5, t => placeAt(LMC.R, LMC.a, t), 120, '#cfe0ff')
tag('Млечный Путь', 120.5, 125.8, galaxyCentre, -60, GOLD)
named('Местная группа\nоколо 80 галактик в 10 млн световых лет', 119.5, 126.6)
credit('снимки NASA GALEX', 119.5, 126.6)
noted('Андромеда — в 2,5 млн световых лет.\nОна сближается с нами со скоростью 110 км/с', 120.3, 126.6)

// --- The Virgo Cluster --------------------------------------------------------------------------------------

// The Milky Way, at the middle of every map that follows: its own disc, shrinking into a point
at(GAL_OUT - 0.5, () => {
  const from = GAL_OUT - 0.5
  const r = s => Math.max(share(GALAXY, from + s), POINT)
  draw({ kind: 'circle', center: [0.5, 0.5], radius: 'r', fill: GOLD, color: GOLD, glow: 'g', opacity: 'o', values: { r, g: s => 1.6 * r(s), o: s => smooth(s / 0.8) * smooth((165.5 - from - s) / 0.8) } }, 166 - from)
})
tag('скопление Девы', 132.5, 138.3, t => placeAt(VIRGO.R, VIRGO.a, t), 30, '#ffe9cf')
tag('Местная группа', 133, 138.3, () => [0.5, 0.5], -30, GOLD)
named('Скопление Девы\n54 млн световых лет', 132, 138.8)
noted('Больше тысячи галактик. Галактики вокруг падают\nв него, и Местная группа тоже тянется к нему', 132.8, 138.8)
credit('карта: каталоги 2MRS и UNGC', 132, 150)

// --- Laniakea -----------------------------------------------------------------------------------------------

// Laniakea's edge round the Great Attractor, which the cosmic web then shows as one of its cells
{
  const from = G_IN + 1
  const to = 165.5
  const centre = k => s => placeAt(ATTRACTOR.R, ATTRACTOR.a, from + s)[k]
  at(from, () => draw({
    kind: 'circle', center: ['x', 'y'], radius: 'r', color: '#ffe9cf', width: 0.0016, dash: [0.01, 0.007], opacity: 'o',
    values: { x: centre(0), y: centre(1), r: s => share(LANIAKEA, from + s), o: s => 0.8 * smooth(s / 1) * smooth((to - from - s) / 0.8) }
  }, to - from))
  tag('Ланиакея', 154, 164.5, t => placeAt(ATTRACTOR.R + LANIAKEA, ATTRACTOR.a, t), ATTRACTOR.a, '#ffe9cf')
}
tag('Великий аттрактор', 143, 148, t => placeAt(ATTRACTOR.R, ATTRACTOR.a, t), -90, '#ffe9cf')
tag('Местная группа', 143.5, 149.3, () => [0.5, 0.5], 200, GOLD)
named('Ланиакея\n520 млн световых лет', 142.8, 150)
noted('Сто тысяч галактик, чьи движения сходятся\nк Великому аттрактору. Мы — на её окраине', 144.4, 150)

// --- The cosmic web -----------------------------------------------------------------------------------------

named('Космическая паутина', 153.8, 160.4)
credit('в середине — карта 2MRS, вокруг — модель паутины', 153.8, 160.4)
noted('Галактики лежат на стенах и нитях вокруг пустот\nв десятки и сотни миллионов световых лет', 154.2, 160.4)
noted('Дальше паутина сливается: на самых больших\nмасштабах Вселенная одинакова повсюду', 160.6, 166.6)

// --- The universe -------------------------------------------------------------------------------------------

body(HUBBLE, { color: GOLD, width: 0.0018, dash: [0.01, 0.006], stop: 177.6, start: 166.7 }, 0.85, 0.0001)
body(OBSERVABLE, { color: '#ff9a5a', width: 0.0025, glow: 0.02, stop: 177.6, start: 166.7 }, 0.85, 0.0001)
tag('хаббловская сфера\n14 млрд св. лет', 168, 173.5, edge(HUBBLE, 25), 25, GOLD, t => share(OBSERVABLE, t) - share(HUBBLE, t) + 0.035)
tag('реликтовое излучение', 168.5, 177, edge(OBSERVABLE, 205), 205, '#ff9a5a')
named('Наблюдаемая Вселенная\n93 млрд световых лет', 167, 177)
noted('Масса внутри хаббловской сферы дала бы\nрадиус Шварцшильда, равный самой сфере', 167.7, 173.1)
noted('Но мы не внутри чёрной дыры:\nу Вселенной нет центра и нет «снаружи»', 173.2, 177.7)
at(177.4, () => caption('61 порядок: от 10^{-34} до 10^{27} м', 2.6, { at: [0.5, 0.5], font: 'unbounded', size: 0.045, fade: 0.4 }))

wait(END)
