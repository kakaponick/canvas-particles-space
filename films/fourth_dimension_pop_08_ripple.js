// The fourth dimension as popular science, clip 8 of films/fourth_dimension_pop.json: space that stretches can ripple, and in 2015 the ripple of two merging black holes was caught.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_08_ripple.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input, hide, show */
const LINES = {
  stretch: 'If this is right, mass does not curve space, the way Einstein put it. It stretches space, along W.',
  small: 'That sounds like a small change of words. But anything that can stretch can also ripple.',
  shake: 'In twenty fifteen, two detectors in the United States felt space itself shake.',
  source: 'The source: two black holes, each about thirty times heavier than the Sun, colliding one point three billion light years away.',
  proton: 'By the time the wave reached us, it stretched a four kilometre detector by about a thousandth of the width of a proton. And we still caught it.'
}

// ---- the film's kit: the same text in every clip of films/fourth_dimension_pop.json ----
const lines = input.lines ?? {}
const cues = input.cues ?? {}
// The colours: the three directions of space, the fourth (W, and every word about it), the ink, a quieter
// ink for what stands beside it, and gold for what was measured
const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b30'
const INK = '#eef2ff'
const SOFT = '#b4c2c8'
const GOLD = '#ffd27a'
// Until a voice has spoken a line it takes what its words would at 155 a minute
const long = name => lines[name] ?? +(LINES[name].split(/\s+/).length * 60 / 155).toFixed(1)
// Marks where a line starts, which is where the voice is laid, and tells its length
const say = name => { mark('say:' + name); return long(name) }
// The second of a line a word falls at: heard in the voice, or this share of the line until it is spoken
const heard = (name, word, share) => cues[name]?.[word] ?? +(long(name) * share).toFixed(2)
const until = second => wait(Math.max(0, second - now()))
// The chapter's card on black; the picture comes up under the last of it
const chapter = (number, name) => {
  set({ fade: 1 })
  caption(`*{${number}}`, 2.4, { at: [0.5, 0.43], size: 0.03, font: 'unbounded', accent: W, fade: 0.4 })
  caption(name, 2.4, { at: [0.5, 0.52], size: 0.052, font: 'unbounded', color: INK, fade: 0.4 })
  wait(1.6)
  to({ fade: 0 }, 1.2)
}
// What kind of claim is on the screen: measured physics, plain geometry, the hypothesis, or a question
// nobody has answered. A line that claims nothing about nature (a question, a thought experiment) has none
const STATUS = { known: ['KNOWN PHYSICS', GOLD], math: ['GEOMETRY', SOFT], idea: ['HYPOTHESIS', W], open: ['OPEN QUESTION', INK] }
const status = (kind, seconds) => caption(STATUS[kind][0], seconds, { at: [0.11, 0.94], size: 0.022, font: 'unbounded', color: STATUS[kind][1], fade: 0.4 })
// The one sentence of a shot a viewer should keep, at the foot of the frame
const keep = (text, seconds, more = {}) => caption(text, seconds, { at: [0.5, 0.86], size: 0.038, font: 'noto', accent: W, plate: 0.35, fade: 0.4, ...more })
// The clip leaves through black
const leave = () => { to({ fade: 1 }, 0.8) }
// ---- end of the kit ----

// What falls toward the hole on the sheet: swung round as it comes, a whirl that drains down the well's wall.
// It is a flow laid on the sheet, said from the first frame: the particle field laid there draws only still
// dots on the flat and leaves the wall bare. Its band and count were swept at this shot's framing (tilt 66,
// depth 3 to 8): from 9 radii wide 6 it was a carpet over the whole flat at 5000 and more; from 5.5 wide 3,
// 2500 lined the wall thinly and 5000 lines it with the grid's lines still seen through
const WHIRL = {
  fieldEnabled: false, flowA: 1.3, flowACount: 5000, flowAFrom: 5.5, flowATo: 0.8, flowASpread: 3, flowASwirl: 0.7, flowALife: 8, flowATrail: 0.6, flowASize: 1.2,
  flowAColor: '#cfe6ff'
}
const GRID = '#4de3ff'

film({
  fps: 60,
  seed: 8,
  settings: {
    lensingEnabled: false,
    // Stars on black, no nebula: its violet and pink read as stock space, and its dust muddied the frame
    starsBrightness: 1.4,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: GRID,
    gridSheet: 0.85,
    gridSpokes: 24,
    // The sheet reaches past the frame's foot, so no bare sky shows under the well
    gridSpan: 1.1,
    gridFade: 0.3,
    gridDepth: 3,
    gridRings: 40,
    gridCell: 4,
    gridTilt: 66,
    gridRide: 1,
    blackHoleSize: 8,
    blackHoleY: 0.64,
    companionSize: 0,
    companionWaves: 0,
    companionSpeed: 2,
    ...WHIRL
  }
})
// The mass of "stretch" is the textbook's ball of chapters 05 to 07, never a bare black hole: wider than the
// throat, lying LIFT radii up in the well, the hole's ring (which would edge it) hidden. It stays until the cut
// to the pair, a real pair of black holes, which come with their rings
const MASS = '#ffc861'
const BALL = 1.9
const LIFT = 0.8
hide('ring')
chapter('08', 'SPACE CAN RIPPLE')
// The cut to the pair: black from this second
const CUT = now() + long('stretch') + 1.4 + heard('small', 'anything', 0.6) - 0.6 + 0.35
{
  const card = now() - 1.2
  at(card, () => {
    draw({ kind: 'circle', center: { hole: [0, LIFT] }, radius: BALL, fill: MASS, color: '#ffe3a8', width: 0.002, glow: 0.03, fade: 0, opacity: 'lit', values: { lit: [[card, 0], [card + 1.2, 1]] } }, CUT - card)
  })
}

// The sheet as the scene lays it out (the sums of fourth_dimension_well.js), to place a label beside the well
const LONG = 1920
const SHORT = 1080
const SHADOW = 0.08 * SHORT
const dent = (away, edge) => {
  const x = away > edge ? edge / away : 1
  return (1 - Math.sqrt(Math.max(1 - x / (3 * Math.cos(Math.acos(-x) / 3)), 0))) * 2.3660254
}
function laySheet (tilt, radii, holeY) {
  const distance = 2.5 * LONG
  const sin = Math.sin(tilt * Math.PI / 180)
  const cos = Math.cos(tilt * Math.PI / 180)
  const down = (holeY - 0.5) * SHORT
  let throat = SHADOW
  let depth = 0
  let away = 0
  for (let round = 0; round < 3; round++) {
    depth = radii * throat
    away = (down * (distance + depth * cos) - distance * depth * sin) / Math.max(distance * cos + down * sin, distance * 0.05)
    if (round < 2) throat = SHADOW * Math.max(distance + depth * cos - away * sin, distance * 0.05) / distance
  }
  return (across, toward, level) => {
    const x = across * throat
    const y = toward * throat + away
    const deep = depth * (level ?? dent(Math.hypot(x, toward * throat), throat))
    const scale = distance / (distance + deep * cos - y * sin)
    return [x * scale / SHADOW, (down - (y * cos + deep * sin) * scale) / SHADOW]
  }
}
const part = value => +value.toFixed(4)
// The well once it has stretched: deeper, and still a bowl the ball lies in (at depth 8 its throat stood over
// the ball like a stalk, the defect of chapter 05)
const STRETCHED = { gridDepth: 5.5, blackHoleY: 0.72 }
const stretched = laySheet(66, STRETCHED.gridDepth, STRETCHED.blackHoleY)
// W runs down the left wall of the well, along its spoke from the flat sheet to the mass's top: laid on the
// sheet, it sinks with the well as it deepens
const W_LINE = [4.6, 3.6, 2.8, 2.2, 1.8, 1.5, 1.3, 1.2].map(away => ({ sheet: [-away, 0] }))
const W_LABEL = (() => { const [x, y] = stretched(-1.9, 0); return { hole: [part(x - 1.5), part(y)] } })()

shot('stretch', () => {
  const start = now()
  const spoken = say('stretch')
  const einstein = start + heard('stretch', 'Einstein', 0.45)
  const stretches = start + heard('stretch', 'stretches', 0.72)
  // The line holds a beat after it is said, so that W down the deepened well is read
  const end = start + spoken + 1.4
  status('idea', end - start - 0.2)
  at(einstein - 0.3, () => {
    caption('Einstein: mass *{curves} space', stretches - now(), { at: [0.78, 0.3], width: 0.34, size: 0.04, font: 'noto', accent: GRID, plate: 0.5 })
  })
  at(stretches - 0.3, () => {
    caption('hypothesis: mass *{stretches} space', end - now(), { at: [0.78, 0.3], width: 0.34, size: 0.04, font: 'noto', accent: W, plate: 0.5 })
    // The well deepens along W, and W is drawn down its wall, sinking with it
    meanwhile(() => { to(STRETCHED, 3, 'out') })
    draw({ kind: 'line', points: W_LINE, smooth: true, arrow: 'end', color: W, width: 0.0065, draw: 0.8, fade: 0.4 }, end - now())
  })
  // Its name stands beside the wall once the well has nearly settled
  at(stretches + 1.2, () => { caption('W', end - now(), { at: W_LABEL, size: 0.05, font: 'unbounded', color: W, fade: 0.4 }) })
  wait(end - start)
})

// The pair on a wide sheet of fine square cells with nothing on it, seen low so the crests stand up: the
// ripple is the whole picture. The wave was not seen until the merger (review, 5:02): 6 radii apart the pair
// sends long, low crests, and on wells 3 deep any lift that raised them folded the throats. Swept a few
// seconds a step at this framing: 4 radii apart, on wells 1.5 deep, waves 10 lifted 9 or 10 run spiral crests
// across the whole sheet; lifted 13 or 14 they fold needles at the pair's middle at any clearing tried
const PAIR = {
  blackHoleSize: 3.5, blackHoleY: 0.5, gridRings: 0, gridCell: 2, gridTilt: 66, gridDepth: 1.5, gridSpan: 1.8, gridFade: 0.5, gridRide: 0, gridSheet: 1, gridLine: 1.5,
  flowA: 0, companionSize: 0.8, companionDistance: 4, companionWaves: 0, gridWaveLift: 0,
  // The wave is strongest right at the wells, where it folds the sheet into needles: its lines fade in from
  // the shadow over several radii, so the wells read as one dark pit and the crests are drawn only where the
  // sheet stays a surface. Clearing 1.3 out to 4.5 left bright spikes beside the pair (review, 5:03), 2.4 out
  // to 6.5 and 3.2 out to 7.5 a small spike under its middle; 3.6 out to 8 none over a whole orbit
  gridClearing: 3.6, gridClearingEdge: 8
}
const WAVES = { companionWaves: 10, gridWaveLift: 9 }

shot('small', () => {
  const start = now()
  const spoken = say('small')
  const ripple = start + heard('small', 'ripple', 0.85)
  status('idea', spoken + 0.4)
  // "Anything that can stretch can also ripple": a cut through black to two black holes circling on a wide
  // sheet, their waves running out over it. The ball goes with the black, the pair comes with its rings, and
  // the waves come up over a second and a half rather than at once
  at(start + heard('small', 'anything', 0.6) - 0.6, () => {
    to({ fade: 1 }, 0.35)
    set(PAIR)
    show('ring')
    meanwhile(() => { to(WAVES, 1.5) })
    to({ fade: 0 }, 0.5)
  })
  at(ripple - 0.2, () => {
    caption('a *{ripple} of space', start + spoken + 0.6 - now(), { at: [0.5, 0.16], size: 0.045, font: 'unbounded', accent: GRID, fade: 0.4, plate: 0.55 })
  })
  wait(spoken + 0.6)
})

shot('shake', () => {
  const start = now()
  const spoken = say('shake')
  status('known', spoken + 0.4)
  at(start + heard('shake', 'fifteen', 0.2), () => {
    caption('14 September 2015', start + spoken + 0.6 - now(), { at: [0.5, 0.16], size: 0.05, font: 'unbounded', color: GOLD, fade: 0.4, plate: 0.5 })
  })
  at(start + heard('shake', 'detectors', 0.4), () => {
    caption('LIGO · two detectors', start + spoken + 0.6 - now(), { at: [0.5, 0.245], size: 0.032, font: 'noto', color: INK, fade: 0.4, plate: 0.5 })
  })
  at(start + heard('shake', 'shake', 0.95) - 0.2, () => { keep('space itself *{shook}', spoken * 0.3 + 0.6) })
  wait(spoken + 0.6)
})

shot('source', () => {
  const start = now()
  const spoken = say('source')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  // The two close in slowly, then fast, and merge before the line ends; the waves run out over the sheet
  meanwhile(() => { to({ companionDistance: 0 }, spoken - 0.8, 'in') })
  // The wave grows by itself as they close; its strengths come down against it, or the merger tears the sheet
  meanwhile(() => { to({ gridWaveLift: 3, companionWaves: 3 }, spoken - 0.8, 'in') })
  // From the merger the one hole needs less clearing than the pair's middle did: it starts closing in at once,
  // so the wide dark pit is not left standing after the merger (review, 5:17)
  at(start + spoken - 0.8, () => { to({ gridClearing: 1.8, gridClearingEdge: 4.5 }, 1.2) })
  at(start + heard('source', 'thirty', 0.3), () => {
    caption('36 + 29 M_{☉}', end - now(), { at: [0.18, 0.2], size: 0.05, font: 'unbounded', color: GOLD, fade: 0.4, plate: 0.5 })
    caption('two black holes', end - now(), { at: [0.18, 0.275], size: 0.028, font: 'noto', color: INK, fade: 0.4, plate: 0.5 })
  })
  at(start + heard('source', 'billion', 0.8), () => {
    caption('1.3 billion light years', end - now(), { at: [0.8, 0.2], size: 0.04, font: 'unbounded', color: GOLD, fade: 0.4, plate: 0.5 })
  })
  wait(spoken + 0.6)
})

shot('proton', () => {
  const start = now()
  const spoken = say('proton')
  const end = start + spoken + 0.6
  status('known', spoken + 0.4)
  // The ringing has died: the wave is gone first, since on the steep throats it folds the sheet into white
  // needles, and then the sheet closes round the one hole again, its throat drawn to the shadow
  meanwhile(() => {
    to({ gridWaveLift: 0, companionWaves: 0 }, 1)
    to({ gridClearing: 1.04, gridClearingEdge: 1.2 }, 2)
  })
  // The detector, on a dark card of its own beside the merged hole: laid over the hole, a bar and its numbers
  // read as the hole stretching the bar, not as a detector 1.3 billion light years away (review, 5:23). It is
  // drawn as LIGO is, an L of two equal arms from a beam splitter, and the passing wave stretches one arm while
  // it squeezes the other, the end mirrors ticking in and out (the stretch drawn some 10^20 times larger)
  at(start + heard('proton', 'kilometre', 0.4) - 0.2, () => {
    const seconds = end - now()
    const look = { color: INK, width: 0.005, fade: 0.4 }
    draw({ kind: 'rect', center: [0.79, 0.47], size: [0.62, 0.66], round: 0.012, color: '#46525a', width: 0.0012, fill: '#05070a', fillOpacity: 0.85, fade: 0.4 }, seconds)
    caption('4 km detector arms', seconds, { at: [0.79, 0.19], size: 0.026, font: 'unbounded', color: INK, fade: 0.4 })
    // The corner, and the two arms' ends at rest: 0.17 of the width across and 0.30 of the height up are the
    // same length on a 16:9 frame
    const corner = [0.665, 0.62]
    const tick = s => Math.sin(2 * Math.PI * 1.4 * s)
    const values = { mx: s => part(0.835 + 0.008 * tick(s)), my: s => part(0.32 + 0.014 * tick(s)) }
    draw({ kind: 'line', points: [corner, ['mx', 0.62]], ...look, values }, seconds)
    draw({ kind: 'line', points: [corner, [0.665, 'my']], ...look, values }, seconds)
    draw({ kind: 'line', points: [['mx', 0.595], ['mx', 0.645]], ...look, width: 0.008, color: GOLD, values }, seconds)
    draw({ kind: 'line', points: [[0.65, 'my'], [0.68, 'my']], ...look, width: 0.008, color: GOLD, values }, seconds)
    // The beam splitter at the corner
    draw({ kind: 'line', points: [[0.655, 0.637], [0.675, 0.603]], ...look, width: 0.004, color: SOFT }, seconds)
    caption('4 km', seconds, { at: [0.75, 0.665], size: 0.024, font: 'noto', color: SOFT, fade: 0.4 })
  })
  at(start + heard('proton', 'thousandth', 0.55) - 0.2, () => {
    const seconds = end - now()
    // The stretch's bracket at the moving mirror's reach
    const bracket = { color: GOLD, width: 0.003, fade: 0.4, draw: 0.3 }
    draw({ kind: 'line', points: [[0.827, 0.7], [0.843, 0.7]], ...bracket }, seconds)
    draw({ kind: 'line', points: [[0.827, 0.688], [0.827, 0.712]], ...bracket }, seconds)
    draw({ kind: 'line', points: [[0.843, 0.688], [0.843, 0.712]], ...bracket }, seconds)
    caption('ΔL', seconds, { at: [0.87, 0.7], size: 0.024, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('ΔL ≈ 10^{-18} m', seconds, { at: [0.82, 0.4], size: 0.042, font: 'unbounded', color: GOLD, fade: 0.4 })
    caption('a thousandth of a proton', seconds, { at: [0.82, 0.46], size: 0.026, font: 'noto', color: GOLD, fade: 0.4 })
    caption('stretch drawn 10^{20}× larger', seconds, { at: [0.79, 0.765], size: 0.02, font: 'noto', color: SOFT, fade: 0.4 })
  })
  // Said from "And we still...", so that it is up long enough to be read before the clip leaves
  at(start + heard('proton', 'caught', 0.95) - 0.9, () => { keep('and we *{caught} it', end - now()) })
  wait(spoken + 0.6)
})

leave()
