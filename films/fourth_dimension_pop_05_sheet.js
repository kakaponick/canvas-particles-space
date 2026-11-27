// The fourth dimension as popular science, clip 5 of films/fourth_dimension_pop.json: the sheet of space with a dent in it, light held back where gravity is strong, its axes X, Y and W, and the question whether the dent is real.
// The narration sets the pace: LINES is what is said, say() marks where a line starts, and until a voice has
// spoken the lines each takes what its words would (input.lines and input.cues bring a voice's own seconds).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_pop_05_sheet.js out.jpg -
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, input, hide, show */
const LINES = {
  textbook: 'Now, how do you draw gravity? Every textbook does it the same way. Space is a stretched sheet, and a mass makes a dent in it.',
  roll: 'Things roll toward the dent. That is your orbit, your falling apple, your weight.',
  light: 'Light feels the dent too. Let a flash go off near a heavy body. Outside its field the light runs on; inside it, the same light falls behind. Radar echoes sent past the Sun really do come back late, about two hundred millionths of a second, as Einstein predicted.',
  axes: "Look at the axes. Two of them, X and Y, are ordinary space. The third, the depth of the dent, is not. Let's call it W.",
  metaphor: 'Physicists will tell you the dent is only a picture. Space does not need to sag into anything.',
  whatif: 'This hypothesis asks: what if it does? What if W is a real direction, and the dent is really there?'
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

// The sheet is seen from the side from the first frame, tipped as a textbook draws it: an even ruled sheet
// with nothing on it until the mass arrives. Its matter lies on it (gridRide), and the lens is off: the
// textbook picture has none
const TILT = 68
// The textbook's dent is a bowl the mass sits in, not a black hole's throat: at depth 6 the funnel was deep
// and narrower than the ball, which hung under its tip like a ball on a stalk (review, 3:26). At depth 3 the
// flat sheet stands 2.8 radii above the hole and the ball of 1.05 radii lies inside the bowl
const HOLE_Y = 0.7
const DEEP = 4
// Before the dent the hole stands where the flat sheet will stay, the rim of the dent to come (3.735 radii
// above the hole once it has sunk, by the sheet sums of fourth_dimension_well.js), so the sheet holds still and only the mass goes down
const RIM_Y = 0.4
// What lies on the sheet rolls toward the dent, swung round as it goes: flow A laid on the sheet, born 2 to 7
// radii out round the mouth and falling down the wall into the well, winding as it goes, lingering near the
// hole (Fall Power 0.8) so the wall is lined, warm white against the cyan sheet. The particle field laid on
// the sheet draws no matter on the wall since the engine's redshift and rebirth changes (films.md, "On the
// sheet"), so the field is off and the flow is all the matter there is. It comes on with the mass, as the
// dent sinks. Born 6 to 12 radii out (films.md's row) it was a faint haze on the flat with the wall bare
const MATTER = 2.5
// Flow A Count swept at this shot's framing (the sunk dent, tilt 68), a second a step: 3000 reads as
// streaks winding down the wall with the grid through them, 6000 richer, 12000 and 24000 a white disc that
// hides the orbit drawn on the sheet. The operator found 5000 a muddy swirl over a crowded grid ("симуляция в
// этом отрезке некрасивая"): half as many, finer
const COUNT = 2500
// The mass is the scene's own black hole, its shadow and photon ring at the bottom of the dent, as everywhere
// else in the film: not a flat yellow disc drawn over the picture ("что за странное солнце"), which hung in
// front of the dent's near wall, and not the neutron star tried after it ("отмени этот стиль, давай просто
// везде использовать черную дыру"). The sheet follows films/infographic_style.js: larger cells, the throat
// lit by the slowing of time and by the matter round the hole, fading into the dark before the frame's
// edges, and the frame's bloom spreading the light
const RING = { ringBrightness: 2.2, ringGlow: 1.2 }
// How far the camera creeps in on the sunk dent before the flash; after it the sheet comes back at 1
const PUSH = 1.04
const LOOK = {
  gridCell: 6, gridSheet: 0.8, gridLine: 1.3, gridLineNear: 2.5, gridSpan: 0.9, gridFade: 0.6,
  // The well is the black hole's own. Drawn 2.5 times wider, as round the neutron star tried first, its throat
  // stood at 2.5 shadow radii: the walls ended in a hard cut under the hole and the matter circled a floor
  // there ("у тебя артефакты в симуляции")
  gridThroatGlow: 2.5,
  gridLight: 3, gridLightColor: '#ffb45c', gridLightReach: 3,
  bloom: 2, bloomThreshold: 0.55, bloomReach: 0.05
}
film({
  fps: 60,
  seed: 5,
  settings: {
    blackHoleSize: 8,
    fieldEnabled: false,
    flowA: 0,
    flowACount: COUNT,
    flowAFrom: 4.5,
    flowAFall: 0.8,
    flowATo: 0.8,
    flowASpread: 5,
    flowASwirl: 0.7,
    flowALife: 5,
    flowATrail: 0.45,
    flowASize: 1,
    flowAColor: '#ffe9c8',
    lensingEnabled: false,
    lensingRadius: 0,
    // Stars on black, no nebula: its violet and pink read as stock space, and its dust muddied the frame
    starsBrightness: 1.2,
    starDensity: 0.22,
    gridColor: '#4de3ff',
    gridTilt: TILT,
    gridDepth: 0,
    // Square cells, as the textbook rules its sheet (and as chapter 06 opens)
    gridRings: 0,
    // The flow lies on the sheet
    gridRide: 1,
    blackHoleY: RIM_Y,
    ...LOOK,
    ...RING
  }
})
// No mass yet: the hole is not there to see
hide('hole')
hide('ring')
chapter('05', 'THE TEXTBOOK PICTURE')

const part = value => +value.toFixed(4)
// The axes lie on the sheet once the dent has sunk, and W must read as down. Run from the X/Y corner down the
// dent's left wall along X's own spoke, X and W were one line with two heads and nothing pointed down (review 5,
// 21.9 to 41.35 s). Two ways were put on the screen: W standing straight down from a corner on the left flat,
// square to the sheet (laySheet's level, as chapter 06 places points), hung beside the dent under the flat
// sheet, over the near lines, an arrow in the air that did not read as the dent's depth; W down the far wall,
// which on the screen drops toward the hole, lies on the dent itself and reads as down at once. So W runs down
// the far wall's spoke from a corner on the far flat to the hole, and X and Y open from that corner
// up-left and up-right, square to each other on the sheet, so W continues neither
// How far out on the far flat the corner stands
const FAR = 6
const CORNER = [0, FAR]
const AXIS = 2.8
const X_TIP = { sheet: [-AXIS, FAR + AXIS] }
const Y_TIP = { sheet: [AXIS, FAR + AXIS] }
const X_AT = { sheet: [-AXIS - 0.8, FAR + AXIS + 0.8] }
const Y_AT = { sheet: [AXIS + 0.8, FAR + AXIS + 0.8] }
// The corner mark between X and Y, lying on the sheet
const MARK = (() => {
  const c = 0.8 / Math.SQRT2
  return [[-c, FAR + c], [0, FAR + 2 * c], [c, FAR + c]].map(s => ({ sheet: s }))
})()
const W_PATH = [FAR, 5, 4.2, 3.5, 3, 2.6, 2.3, 2.1, 1.9, 1.7, 1.55, 1.45, 1.3, 1.15].map(away => ({ sheet: [0, away] }))
const wSide = { sheet: [4.4, 3.6] }
const label = (text, seconds, place, more) => caption(text, seconds, { at: place, size: 0.03, font: 'unbounded', fade: 0.4, ...more })
// A place on the sheet, `away` of the well's radii from its middle, `angle` degrees round from the right
// toward the far side
const onSheet = (away, angle) => {
  const turn = angle * Math.PI / 180
  return { sheet: [part(away * Math.cos(turn)), part(away * Math.sin(turn))] }
}

// The black between the textbook's sheet and the flash's picture, each way
const DIP = 0.6
shot('textbook', () => {
  const start = now()
  const spoken = say('textbook')
  // The stretched sheet is how textbooks draw gravity, a picture and no claim about nature: "metaphor"
  // calls it only a picture under KNOWN PHYSICS, so here it is labelled as the geometry it is
  status('math', spoken + 0.6)
  at(start + heard('textbook', 'sheet', 0.62), () => { label('a stretched sheet', 3, [0.25, 0.12], { color: INK, plate: 0.5 }) })
  // "a mass makes a dent": the black hole comes on the flat sheet, its ring flaring and settling, then the
  // pull comes on and the dent sinks, the hole with it, while the sheet round it stays where it was. The hole
  // stays to the clip's end
  const lands = start + heard('textbook', 'mass', 0.84)
  at(lands, () => {
    show('hole')
    show('ring')
    set({ ringBrightness: 5 })
    to({ ringBrightness: RING.ringBrightness }, 1.6, 'out')
  })
  at(lands, () => {
    label('a mass', 3.4, { hole: [3.6, 1] }, { color: GOLD })
    // The dent sinks and the matter on the sheet comes up with it, already running down into it
    to({ gridDepth: DEEP, blackHoleY: HOLE_Y, flowA: MATTER * 0.6 }, 2.4)
  })
  // Once the dent has sunk the camera creeps in on it until the picture goes to black for the flash
  at(lands + 2.4, () => { to({ cameraZoom: PUSH }, start + spoken + 0.6 + long('roll') + 1.4 - now(), 'linear') })
  wait(spoken + 0.6)
})

shot('roll', () => {
  const start = now()
  const spoken = say('roll')
  // The three things named are drawn on the sheet; the line holds until the last of them has been read
  const end = start + spoken + 1.4
  // The rubber sheet is the textbook's picture, not a measurement: geometry, as the shot before
  status('math', end - start - 0.2)
  // The dent's own move ends inside this line; then the matter, brighter, rolls in
  at(start + 1.2, () => { to({ flowA: MATTER }, 1.2) })
  const look = { color: INK, width: 0.0035, fade: 0.4 }
  // "your orbit": a whole ring round the dent, lying on the sheet, its way told once. The near arc passes in
  // front of the ball's lower half, as an orbit round a mass does; its far arc alone ended in mid-air left and
  // right of the ball, a horseshoe (review 5, 13.2 to 17.5 s)
  at(start + heard('roll', 'orbit', 0.55) - 0.2, () => {
    const ring = []
    for (let step = 0; step < 36; step++) ring.push(onSheet(3.4, step * 10))
    draw({ kind: 'line', points: ring, smooth: true, close: true, arrow: 'middle', draw: 0.8, ...look }, end - now())
    label('orbit', end - now(), onSheet(5, 160), { size: 0.026, color: INK, plate: 0.4 })
  })
  // "your falling apple": a small ball runs down a spoke into the dent
  at(start + heard('roll', 'apple', 0.72) - 0.2, () => {
    // It reaches the mass's edge (1.6 radii out on this spoke) in 1.4 s and leaves just after; drawn after
    // the ball, it would roll on over its face. Its word stands where the apple starts, just outside it on its
    // spoke, and is gone by the time the apple is halfway in: riding beside it, it crossed the orbit's line
    // (review 4, 0:15), and left standing outside the orbit it was far from the apple (review 5)
    const away = s => 5.2 - 3.6 * Math.min(1, s / 1.4) ** 2
    const ax = s => part(away(s) * Math.cos(Math.PI / 6))
    const ay = s => part(away(s) * Math.sin(Math.PI / 6))
    draw({ kind: 'circle', center: { sheet: ['ax', 'ay'] }, radius: 0.28, fill: '#ff6b5c', color: '#ff6b5c', fade: 0.3, values: { ax, ay } }, 1.7)
    label('apple', 1.0, onSheet(6.4, 30), { size: 0.026, color: INK, plate: 0.4, fade: 0.25 })
  })
  // "your weight": the push down the wall of the dent
  at(start + heard('roll', 'weight', 0.92) - 0.2, () => {
    // Down the wall to the throat's mouth, 1.5 out on this spoke
    draw({ kind: 'line', points: [5.4, 4.6, 3.9, 3.3, 2.7, 2.2, 1.8, 1.5].map(away => onSheet(away, 230)), smooth: true, arrow: 'end', draw: 0.5, ...look, width: 0.0055, glow: 0.008 }, end - now())
    label('weight', end - now(), onSheet(5.6, 222), { size: 0.026, color: INK, plate: 0.4 })
  })
  wait(end - start)
})

// "Light feels the dent too": the operator's drawings of a flash past a strong field. Through black the
// picture turns to the sheet seen from straight above: a light source, a ring of light leaving it, a body with
// its field drawn as a dashed zone. The same front runs free outside the zone and lags inside it, where light
// is slower (gridFrontField, gridFrontStrength, gridFrontFieldEven: the eikonal of a field drawn far stronger
// than a real one and even across the zone, which the frame says). Its key frame, the front just inside the
// zone while it runs on outside, is held while the camera comes in and the frame explains it a line at a time;
// the white band is where the light would be with no gravity (gridFrontGhost). Then through black back to the
// textbook's sheet, as "roll" left it
const SOURCE = [-8, 0]
const ZONE = 3.5
const WARM = '#ffb070'
const COOL = '#bcd4ff'
const LIGHT = {
  threeD: true, threeDEase: 0, cameraYaw: 0, cameraPitch: 0, cameraMoveIn: -9.5, cameraFloat: 0,
  blackHoleSize: 10, blackHoleY: 0.5, lensingEnabled: true, ringBrightness: 4, ringGlow: 2, bloom: 2, bloomThreshold: 0.5,
  flowA: 0, gridRide: 0, gridDepth: 2, gridSpan: 2, gridCell: 2.5, gridSheet: 0.3, gridLine: 1.2, gridFade: 0.3, gridThroatGlow: 1, gridLight: 0,
  starsBrightness: 0, starDensity: 0, cameraZoom: 1,
  // The flash's picture is the bare hole on its own real well: the textbook's star and wide bowl go
  gridLineNear: 3, bloomReach: 0.08,
  gridFront: 4, gridFrontColor: '#ff8a1e', gridFrontX: SOURCE[0], gridFrontY: SOURCE[1], gridFrontRun: 0, gridFrontWidth: 3, gridFrontLead: 0.1,
  gridFrontGhost: 0.35, gridFrontStrength: 20, gridFrontField: ZONE, gridFrontFieldEven: 1, gridFrontFieldLine: 1.5
}
// The textbook's sheet as "roll" leaves it, set back after the flash
const SHEET = {
  threeD: false, cameraYaw: 40, cameraPitch: 20, cameraMoveIn: 0, cameraFloat: 0.3,
  blackHoleSize: 8, blackHoleY: HOLE_Y, lensingEnabled: false,
  flowA: MATTER, gridRide: 1, gridDepth: DEEP,
  starsBrightness: 1.2, starDensity: 0.22, cameraZoom: 1, ...LOOK, ...RING,
  gridFront: 0, gridFrontRun: 0, gridFrontGhost: 0, gridFrontStrength: 1, gridFrontField: 0, gridFrontFieldEven: 0, gridFrontFieldLine: 0
}
const note = (text, seconds, place, more = {}) => caption(text, seconds, { at: place, size: 0.024, font: 'noto', color: INK, plate: 0.55, fade: 0.4, ...more })
const lead = (seconds, points, more = {}) => {
  draw({ kind: 'line', points: points.map(p => ({ sheet: p })), arrow: 'end', color: INK, width: 0.0016, draw: 0.5, fade: 0.4, ...more }, seconds)
}
shot('light', () => {
  const start = now()
  const spoken = say('light')
  to({ fade: 1 }, DIP)
  set(LIGHT)
  to({ fade: 0 }, DIP)
  const open = now()
  // The key frame comes as the line reaches "Outside", and is held until "behind" has been heard and read
  const key = Math.max(open + 7, start + heard('light', 'Outside', 0.31))
  const keyEnd = Math.max(key + 6, start + heard('light', 'behind', 0.56) + 2)
  const end = Math.max(keyEnd + 7.5, start + spoken + 0.6)
  // The delay past the Sun is measured; the picture draws the field larger than life, and says so
  status('known', end - open)
  caption('the field is drawn far stronger than a real one', end - open, { at: [0.5, 0.95], size: 0.019, font: 'noto', color: SOFT, plate: 0.7, fade: 0.4 })
  // The cast, one at a time: the source, a solid disc the band passes under, with its name inside; the zone's
  // name steps aside while the key frame is explained and comes back after it
  draw({ kind: 'circle', center: { sheet: SOURCE }, radius: 1.4, color: INK, fill: '#0a0e12', fillOpacity: 1, width: 0.0016, fade: 0.5 }, end - open)
  note('Light source', end - open, { sheet: SOURCE }, { size: 0.02, plate: 0 })
  at(open + 0.8, () => {
    note('Strong gravitational field', key - 0.3 - now(), { sheet: [6.6, -5.2] })
    lead(key - 0.3 - now(), [[5.4, -4.6], [2.8, -2.4]])
  })
  at(keyEnd + 0.4, () => {
    note('Strong gravitational field', end - now(), { sheet: [6.6, -5.2] })
    lead(end - now(), [[5.4, -4.6], [2.8, -2.4]])
  })
  at(open + 1.2, () => {
    note('Light', 2.6, { sheet: [SOURCE[0], -6.2] })
    lead(2.6, [[SOURCE[0], -5.6], [SOURCE[0], -3.3]])
  })
  // The key frame, a line at a time
  at(key + 0.3, () => {
    note('Same light cone', keyEnd - now(), { sheet: [-6.2, 5.6] })
    lead(keyEnd - now(), [[-4.6, 5.6], [-1.2, 5.1]])
    lead(keyEnd - now(), [[-5.2, 4.9], [-2.4, 1.6]])
  })
  at(key + 1.5, () => {
    note('outside the field it runs on', keyEnd - now(), { sheet: [4.2, 6.2] }, { color: WARM })
    lead(keyEnd - now(), [[2.6, 5.8], [0.2, 4.6]], { color: WARM })
  })
  at(key + 2.7, () => {
    note('inside the field the same light is late', keyEnd - now(), { sheet: [-6.4, -3.6] }, { color: WARM })
    lead(keyEnd - now(), [[-5.0, -3.0], [-2.6, -1.2]], { color: WARM })
  })
  at(key + 3.9, () => {
    note('without gravity it would be here', keyEnd - now(), { sheet: [5.6, 2.6] }, { color: COOL })
    lead(keyEnd - now(), [[3.8, 2.4], [1.2, 1.4]], { color: COOL })
  })
  at(keyEnd + 0.2, () => { note('inside, the front bows back toward the source', 3, { sheet: [-5.6, -4.4] }, { color: WARM }) })
  meanwhile(() => {
    // The camera drifts in while the light sets off, comes in on the key frame, and drifts out at the end
    to({ cameraMoveIn: -8 }, key - open, 'linear')
    to({ cameraMoveIn: -4.5 }, 2.5, 'ease')
    wait(keyEnd - key - 4)
    to({ cameraMoveIn: -8.5 }, 1.5, 'ease')
    to({ cameraMoveIn: -10 }, end - keyEnd, 'linear')
  })
  // The light leaves the source as a ring, reaches the field slowing as it comes to the key frame, is held,
  // bows back inside the zone and runs on
  wait(0.2)
  to({ gridFrontRun: 3 }, 2, 'linear')
  wait(1)
  to({ gridFrontRun: 9 }, key - now(), 'out')
  wait(keyEnd - now())
  to({ gridFrontRun: 12.5 }, 1.5, 'linear')
  wait(1.5)
  to({ gridFrontRun: 20 }, 3, 'linear')
  until(end)
  // Back through black to the textbook's sheet and its star
  to({ fade: 1 }, DIP)
  set(SHEET)
  to({ fade: 0 }, DIP)
})

// The W axis, solid or dashed; each drawing lasts until the next replaces it
const wAxis = (seconds, more) => {
  draw({ kind: 'line', points: W_PATH, smooth: true, arrow: 'end', color: W, width: 0.0065, draw: 0.8, fade: 0.4, ...more }, seconds)
}
let axesEnd = 0
shot('axes', () => {
  const start = now()
  const spoken = say('axes')
  // Naming the picture's axes is geometry, not a claim about nature
  status('math', spoken + 0.6)
  axesEnd = start + spoken + 0.6 + long('metaphor') + 0.6 + long('whatif') + 0.6
  // The matter dims while the axes are read on the wall, and comes back when the dent is asked to be real. Its
  // band draws in to the mouth of the dent, so no streak runs over X and Y on the flat (it raked them in
  // "whatif", review 5)
  at(start + 0.4, () => { to({ flowA: MATTER * 0.6, flowAFrom: 3.6, flowASpread: 2.6 }, 1.2) })
  at(start + heard('axes', 'x', 0.3), () => {
    draw({ kind: 'line', points: [{ sheet: CORNER }, X_TIP], arrow: 'end', color: X, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    label('X', axesEnd - now(), X_AT, { size: 0.034, color: X })
  })
  at(start + heard('axes', 'y', 0.35), () => {
    draw({ kind: 'line', points: [{ sheet: CORNER }, Y_TIP], arrow: 'end', color: Y, width: 0.006, draw: 0.5, fade: 0.5 }, axesEnd - now())
    label('Y', axesEnd - now(), Y_AT, { size: 0.034, color: Y })
    // X and Y stand square on the sheet: a corner mark between them, lying on it
    draw({ kind: 'line', points: MARK, color: INK, width: 0.0025, opacity: 0.8, draw: 0.3, fade: 0.5 }, axesEnd - now())
  })
  at(start + heard('axes', 'third', 0.6), () => {
    wAxis(start + spoken + 0.6 - now())
    label('*{W}: the depth of the dent', start + spoken + 0.6 - now(), wSide, { size: 0.034, accent: W, plate: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('metaphor', () => {
  const start = now()
  const spoken = say('metaphor')
  status('known', spoken + 0.6)
  // "only a picture": W goes dashed and pale, and stays so until "what if it does?" draws it solid over it
  wAxis(spoken + 0.6 + heard('whatif', 'does', 0.3) + 0.6, { dash: true, opacity: 0.6, draw: 0 })
  at(start + heard('metaphor', 'picture', 0.5), () => {
    label('only a picture', start + spoken + 0.6 - now(), wSide, { size: 0.034, color: SOFT, plate: 0.4 })
  })
  wait(spoken + 0.6)
})

shot('whatif', () => {
  const start = now()
  const spoken = say('whatif')
  status('idea', spoken + 0.6)
  // "what if it does?": W comes back solid, and the matter on the sheet falls down it harder: back to the brightness of "roll" (any
  // brighter burned the throat white at full size), each particle down the wall in 3.5 s where it took 5
  at(start + heard('whatif', 'does', 0.3), () => {
    wAxis(start + spoken + 0.6 - now(), { draw: 0.6, width: 0.009 })
    to({ flowA: MATTER, flowALife: 3.5 }, 2)
  })
  at(start + heard('whatif', 'w', 0.55), () => { keep('what if *{W} is a real direction?', start + spoken + 0.6 - now()) })
  wait(spoken + 0.6)
})

leave()
