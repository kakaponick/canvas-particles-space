// The fourth dimension, clip 6 of films/fourth_dimension.json: the credits of a studio that never was. The roll
// does not go up the screen: it goes the way the film says everything goes, inward. Each department stands
// over the black hole for a moment, bent by its lens, and falls in as dust; the hole grows by what it
// swallowed and a counter keeps the tally. The last card says the truth: nobody above exists, the counter
// runs back to nought and the hole gives the mass back.
// The 320 names are every eighth pairing of two lists of forty, dealt so that no card repeats a name.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_credits.js out.jpg
/* global film, set, to, wait, shot, caption, title, now, at */
const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#c9d4f0'
const GOLD = '#ffd27a'

// What each department did is taken from the film's own shots
const DEPARTMENTS = [
  ['DIRECTION ALONG W', 'pointing at a direction nobody can point to'],
  ['DEPARTMENT OF INWARD', 'the only way that was left'],
  ['DIMENSION LADDER CREW', 'one point, pulled three times'],
  ['HYPERCUBE RIGGING', '16 corners, 32 edges, one copy inside the cube'],
  ['RED EDGE PAINTERS', 'eight edges, one colour'],
  ['STAR DEMOLITION', 'one star, used once'],
  ['PARTICLE WRANGLERS', '40 000 particles, each laid on the sheet by hand'],
  ['WELL SURVEY', '40 rings, each one step down W'],
  ['AXIS GRIPS', 'X and Y held level, W held down'],
  ['STRAIGHT DOWN UNIT', 'the camera that rose above the sheet'],
  ['FLAT CREATURE UNIT', 'handlers, stand-ins and one consultant on flatness'],
  ['LATTICE BENDERS', 'a cage of space, drawn in by 10'],
  ['RIPPLE & CHIRP', 'GW150914, re-enacted at a thousandth of a proton'],
  ['NEUTRON STAR HANDLING', 'one heavy object, lowered to the bottom of the well'],
  ['WORMHOLE & WHITE HOLE CASTING', 'two parts, struck out before the shoot'],
  ['VOICE & THE WORD “CENTRE”', 'one voice, 38 lines, two spellings']
]
const ROWS = 5
const COLUMNS = 4
const PER_CARD = ROWS * COLUMNS

const FIRST = ['Amara', 'Tomas', 'Ingrid', 'Kenji', 'Laleh', 'Mateo', 'Sanna', 'Obinna', 'Yuki', 'Rafael', 'Zofia', 'Emeka', 'Hana', 'Luca',
  'Noor', 'Diego', 'Mirela', 'Tariq', 'Linh', 'Oskar', 'Chiara', 'Bashir', 'Ayla', 'Marek', 'Sofia', 'Kwame', 'Elif', 'Joon', 'Vera', 'Nikos',
  'Anouk', 'Samir', 'Maren', 'Thabo', 'Irina', 'Pablo', 'Meiko', 'Idris', 'Greta', 'Ravi']
const LAST = ['Okonkwo', 'Villar', 'Solheim', 'Tanaka', 'Rahimi', 'Costa', 'Lindqvist', 'Adeyemi', 'Sato', 'Moreno', 'Nowak', 'Eze', 'Novak',
  'Bianchi', 'Haddad', 'Ruiz', 'Popescu', 'Aziz', 'Tran', 'Berg', 'Ricci', 'Karimi', 'Demir', 'Kowal', 'Herrera', 'Mensah', 'Yilmaz', 'Park',
  'Sokolova', 'Pappas', 'de Vries', 'Nasser', 'Holm', 'Dlamini', 'Petrova', 'Ortega', 'Mori', 'Bello', 'Weiss', 'Menon']

film({
  fps: 60,
  seed: 31,
  warmup: 8,
  settings: {
    blackHoleSize: 5,
    blackHoleY: 0.7,
    numParticles: 40000,
    // The ring of falling matter of the film, so what the hole swallows has something to join
    gravityInertia: 0.92,
    orbitalStrength: 90,
    gravityStrength: 5,
    gravityReach: 8,
    baseSpeed: 0.7,
    trailIntensity: 0.08,
    baseBrightness: 0.9,
    nebula: 0.7,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    starsBrightness: 1.4,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: '#4de3ff',
    gridCell: 4,
    gridSky: 0.22
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

// The crew: both lists are walked in steps that visit every name before any comes again, and each pass
// through them starts somewhere else, so a card repeats no name and no pairing comes twice
const crew = []
for (let index = 0; index < DEPARTMENTS.length * PER_CARD; index++) {
  crew.push(`${FIRST[(index * 11 + Math.floor(index / FIRST.length) * 17) % FIRST.length]} ${LAST[(index * 7 + Math.floor(index / LAST.length) * 3) % LAST.length]}`)
}
const widest = Math.max(...FIRST.map(name => name.length)) + 1 + Math.max(...LAST.map(name => name.length))
// A card of names in columns: the title's face is the monospaced one, so padding lines the columns up
const card = index => {
  const names = crew.slice(index * PER_CARD, (index + 1) * PER_CARD)
  const rows = []
  for (let row = 0; row < ROWS; row++) rows.push(names.slice(row * COLUMNS, (row + 1) * COLUMNS).map(name => name.padEnd(widest)).join('   ').trimEnd())
  return rows.join('\n')
}

// A card stands, is read and falls: its seconds
const STANDS = 2
const FALLS = 1.3
const CARD = STANDS + FALLS + 0.1
const fallen = [[0, 0]]
const total = DEPARTMENTS.length * PER_CARD
// The clip's length: a breath, the cards, the truth and what is real
const LENGTH = 1.2 + DEPARTMENTS.length * CARD + 7.4 + 8.6
// The tally, for the whole clip: its keys are written as the cards fall
caption('crew inside the hole: *{#{inside:0}}', LENGTH - 1.8, { at: [0.5, 0.86], size: 0.026, font: 'geistMono', color: SOFT, accent: GOLD, values: { inside: fallen } })

shot('the crew', () => {
  wait(1.2)
  DEPARTMENTS.forEach(([name, did], index) => {
    const from = now()
    caption(name, STANDS + 0.2, { at: [0.5, 0.14], size: 0.03, font: 'unbounded', color: GOLD, fade: 0.25 })
    caption(did, STANDS + 0.2, { at: [0.5, 0.185], size: 0.023, font: 'noto', color: SOFT, fade: 0.25 })
    title(card(index), {
      font: 'geistMono',
      params: {
        titleEntrance: 'Fades in', titleInAt: 0, titleInDuration: 0.3, titleExit: 'Falls into the black hole', dissolveAt: STANDS, dissolveDuration: FALLS,
        titleOffset: -0.1, titleSize: 0.72, titleMaxWidth: 1760, titleLineHeight: 1.5, titleTracking: 0, titleWeight: 500,
        titleDust: 0.12, titleHalo: 0.25, titleFringe: 0, titlePush: 0, titleDrift: 430, titleHeat: 2.2, colorTitle: INK
      }
    })
    // The hole takes the department, and is that much heavier: it swells with a gulp
    fallen.push([from + STANDS + FALLS * 0.85, (index + 1) * PER_CARD, 'hold'])
    at(from + STANDS + FALLS * 0.7, () => { to({ blackHoleSize: 5 + (index + 1) * 0.4 }, 0.55, 'spring') })
    wait(CARD)
  })
})

shot('nobody above exists', () => {
  const from = now()
  // The tally runs back and the hole gives the mass back: there was no crew
  const back = from + 4.2
  fallen.push([back, total], [back + 3, 0, 'out'])
  at(back, () => { to({ blackHoleSize: 5 }, 3, 'out') })
  caption('Nobody above exists.\nThe whole crew is *{a hypothesis}.', 6.8, { at: [0.5, 0.26], size: 0.05, font: 'unbounded', color: INK, accent: W, reveal: 'lines', revealOver: 2.4 })
  wait(7.4)
  caption('the hypothesis  ·  its author\nthe picture  ·  canvas-particles-space\nthe voice  ·  Theo, a cloned voice, VoiceStudio\neverything else  ·  one AI', 7.2, {
    at: [0.5, 0.3], size: 0.036, font: 'noto', color: INK, reveal: 'lines', revealOver: 3.2
  })
  wait(7)
  to({ fade: 1 }, 1.6)
})
