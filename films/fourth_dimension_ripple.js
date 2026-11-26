// The fourth dimension, clip 3 of films/fourth_dimension.json: what follows if the well is real. Space is
// stretched along W, not curved: the well grows deeper and the line of W down its wall grows with it. What
// stretches can ripple: two black holes close in on each other and the sheet carries their wave away, the
// one measured in 2015. And the bottom of the well is where an object rests: a neutron star in a shallow
// well, a black hole in a deep one, the same kind of thing. No singularity, no wormhole, no white hole.
// A wave leaves only what moves: nothing here is fired at a hole at rest.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how); the sheet is drawn in
// rings with its matter lying on it, and what is drawn on it is laid there by the sheet's own sums, as in
// clip 2 (fourth_dimension_well.js).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_ripple.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, drive, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const long = (name, guess) => lines[name] ?? guess
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const W = '#ff3b5c'
const INK = '#eef2ff'
const SOFT = '#c9d4f0'
const GRID = '#4de3ff'
const GOLD = '#ffd27a'

// What falls toward the hole on the sheet: the whole field, at any depth, so that what the hole takes is made
// up again; it is swung round as it comes, a whirl that drains down the well's wall. Its trails are short: a
// camera that tilts moves every particle on the screen, and a long trail would draw that as rain. Every
// particle is drawn as wide and as bright as the next, near or far in the field, and dimly, so that the well
// fills with a veil of matter the sheet's lines show through
const WHIRL = {
  gravityInertia: 0.75, orbitalStrength: 80, gravityStrength: 4, gravityReach: 16, gravityDepth: 100, baseSpeed: 0, speedGlowKnee: 0.03, trailIntensity: 0.5,
  depthFade: 0, minOpacity: 0.1, particleSize: 2, particleSizeMin: 2, baseBrightness: 0.6
}
// The sheet as a textbook draws it, seen from the side, with that matter on it
const TEXTBOOK = { gridRings: 40, gridCell: 4, gridTilt: 66, gridRide: 1, fieldAtHole: 1, blackHoleSize: 8, companionSize: 0, companionWaves: 0, ...WHIRL }

film({
  fps: 60,
  seed: 9,
  warmup: 10,
  settings: {
    numParticles: 40000,
    lensingEnabled: false,
    nebula: 0.8,
    nebulaScale: 700,
    nebulaSparseness: 0.4,
    nebulaEdge: 0.5,
    nebulaContrast: 0.35,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    nebulaColor: '#6a2cc0',
    nebulaColorDeep: '#0f7a9a',
    nebulaColorCore: '#ff7ab8',
    nebulaCore: 0.5,
    starsBrightness: 1.6,
    starDensity: 0.22,
    ringDoppler: 0.6,
    ringGlow: 0.6,
    gridColor: GRID,
    gridSheet: 0.85,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridDepth: 3,
    blackHoleY: 0.66,
    companionSpeed: 2,
    ...TEXTBOOK
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

// A caption or a drawing whose seconds come out of the narration is left out when they leave it no time
const cap = (text, seconds, look) => { if (seconds > 0.15) caption(text, seconds, look) }
const sketch = (shape, seconds) => { if (seconds > 0.15) draw(shape, seconds) }

// ---- the sheet as the scene lays it out, so that a drawing can lie on it (fourth_dimension_well.js) ----

const LONG = 1920
const SHORT = 1080
const SHADOW = 0.08 * SHORT
const EASES = { ease: share => share * share * (3 - 2 * share), out: share => 1 - (1 - share) ** 3, in: share => share ** 3 }
const track = keys => second => {
  if (second <= keys[0][0]) return keys[0][1]
  for (let index = 1; index < keys.length; index++) {
    const [until, value, how = 'ease'] = keys[index]
    if (second > until) continue
    const [from, before] = keys[index - 1]
    return until === from ? value : before + (value - before) * EASES[how]((second - from) / (until - from))
  }
  return keys[keys.length - 1][1]
}
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

// ---- stretched, not curved ----

shot('not curved: stretched', () => {
  const start = now()
  wait(0.8)
  const said = now()
  const spoken = say('stretch', 7.7)
  const stretches = said + heard('stretch', 'stretches', 5.9)
  const end = said + spoken + 1.4
  // The well grows deeper under the word, and the camera goes down with its bottom
  const depth = track([[start, 3], [stretches - 0.2, 3], [stretches + 3.2, 9, 'out']])
  const holeY = track([[start, 0.66], [stretches - 0.2, 0.66], [stretches + 3.2, 0.78, 'out']])
  meanwhile(() => { drive({ gridDepth: s => depth(start + s), blackHoleY: s => holeY(start + s) }, end - start) })
  const sheetAt = at => laySheet(66, depth(at), holeY(at))
  // The words stand beside the well, clear of the line of W that runs down its other wall
  const SIDE = [0.77, 0.43]
  cap('Einstein: mass *{curves} space', stretches - 0.5 - said, { at: SIDE, width: 0.34, size: 0.042, font: 'noto', accent: GRID, plate: 0.55 })
  at(stretches - 0.2, () => {
    cap('this hypothesis: mass *{stretches} space, along *{W}', end - now(), { at: SIDE, width: 0.34, size: 0.042, font: 'noto', accent: W, plate: 0.55 })
    // The line of W runs down the wall of the well and grows with it
    const PIECES = 14
    const radius = index => 1 + (4 - 1) * (1 - index / PIECES) ** 2
    for (let index = 0; index < PIECES; index++) {
      const late = index * 0.05
      at(now() + late, () => {
        const born = now()
        const from = [-radius(index), 0]
        const next = [-radius(index + 1), 0]
        sketch({
          kind: 'line', points: [{ hole: ['ax', 'ay'] }, { hole: ['bx', 'by'] }], color: W, width: 0.0075, fade: 0.25,
          values: {
            ax: s => part(sheetAt(born + s)(...from)[0]),
            ay: s => part(sheetAt(born + s)(...from)[1]),
            bx: s => part(sheetAt(born + s)(...next)[0]),
            by: s => part(sheetAt(born + s)(...next)[1])
          }
        }, end - born)
      })
    }
  })
  // More of the matter round the mouth goes down the longer wall
  at(stretches, () => { to({ gravityStrength: 6, baseBrightness: 0.8 }, 3) })
  wait(end - start - 0.45)
  to({ fade: 1 }, 0.45)
})

// ---- what stretches can ripple ----

// The wave of two bodies closing in: it rises in pitch and strength up to the merger and rings away after it
const MERGER = 0.78
const chirp = []
for (let step = 0; step <= 520; step++) {
  const x = step / 520
  if (x < MERGER) {
    const left = MERGER - x + 0.004
    chirp.push([+x.toFixed(4), +(Math.min(1, 0.3 * Math.pow(left, -0.25)) * Math.cos(-46 * Math.pow(left, 0.625))).toFixed(4)])
  } else {
    chirp.push([+x.toFixed(4), +(Math.exp(-(x - MERGER) / 0.035) * Math.cos(-46 * Math.pow(0.004, 0.625) + 190 * (x - MERGER))).toFixed(4)])
  }
}

shot('two black holes', () => {
  const start = now()
  // A sheet of square cells, wide and with nothing on it: the ripple is the whole picture. The two are small in
  // the frame, far enough from the camera for the wave to be seen leaving them
  set({
    blackHoleSize: 3.5, blackHoleY: 0.5, gridRings: 0, gridCell: 3, gridTilt: 60, gridDepth: 4, gridSpan: 3, gridFade: 0.5, gridRide: 0,
    baseBrightness: 0, companionSize: 0.8, companionDistance: 6, companionWaves: 3, gridWaveLift: 30
  })
  meanwhile(() => { to({ fade: 0 }, 0.6) })
  const spoken = say('ripple', 11.4)
  const two = start + heard('ripple', 'two', 7.3) - 1.4
  const proton = start + spoken + 0.9
  const merger = proton + 0.4
  const end = proton + long('proton', 4.6) + 1.8
  // They close in slowly at first and fast at the end, and the wave grows as they do; it is drawn lower as
  // it grows, so that the sheet round the merger stays a surface
  meanwhile(() => { to({ companionDistance: 0 }, merger - start, 'in') })
  meanwhile(() => { to({ gridWaveLift: 11, companionWaves: 1.6 }, merger - start, 'in') })
  meanwhile(() => { to({ gridTilt: 56 }, end - start) })
  at(two + 0.6, () => {
    const from = now()
    sketch({ kind: 'plot', box: [0.065, 0.2, 0.3, 0.24], x: [0, 1], y: [-1.15, 1.15], points: chirp, color: GOLD, plate: 0.72, labelSize: 0.022,
      xLabel: 'time', yLabel: 'the stretch of space', upTo: 'reached', marker: 'reached', fade: 0.5,
      values: { reached: [[from, 0], [merger, MERGER, 'in'], [merger + 2.2, 1, 'linear']] } }, end - 0.6 - from)
    cap('GW150914 · 14 September 2015', end - 0.6 - from, { at: [0.215, 0.5], size: 0.024, font: 'noto', color: SOFT })
  })
  wait(proton - start)
})

shot('a thousandth of a proton', () => {
  const start = now()
  const spoken = say('proton', 4.6)
  const end = start + spoken + 1.8
  at(start + heard('proton', 'proton', 3.6) - 1.6, () => {
    cap('measured: a stretch of *{1 / 1000} of a proton', end - 0.6 - now(), { at: [0.5, 0.86], size: 0.036, font: 'unbounded', accent: GOLD, plate: 0.6 })
  })
  wait(end - start - 0.45)
  to({ fade: 1 }, 0.45)
})

// ---- the bottom of the well ----

// A star as a drawing over the hole: a white-hot ball with its glow, which cools to an ember and goes dark
const WHITE_HOT = '#f3f8ff'
const ORANGE = '#ff9a3c'
const EMBER = '#b3261e'
function ball (color, radius, glow, seconds) {
  sketch({ kind: 'circle', center: { hole: [0, 0] }, radius, fill: color, color, width: 0.001, opacity: 'glow', fade: 0, values: { glow } }, seconds)
}

// The seconds of the three lines, which the star's light and the words on the screen follow
let object = 0
let light = 0
let black = 0
let thing = 0
let nothing = 0
let well = 0

shot('a neutron star', () => {
  const start = now()
  set({ ...TEXTBOOK, gridDepth: 2.5, blackHoleY: 0.62, gridWaveLift: 4, gridSpan: 0.6, gridFade: 0.3, ringGlow: 1.3 })
  meanwhile(() => { to({ fade: 0 }, 0.7) })
  wait(0.3)
  const said = now()
  const spoken = say('star', 8.6)
  object = said + spoken + 0.8
  light = object + heard('object', 'light', 5.2)
  black = object + heard('object', 'black', 8.3)
  thing = object + heard('object', 'object', 11.6)
  nothing = object + long('object', 11.7) + 0.9
  well = nothing + heard('nothing', 'well', 12.3)
  const end = nothing + long('nothing', 16) + 1.6
  // The star shines until its light cannot climb out: white, then orange, then an ember, then nothing, and it
  // is dark by the word "black hole", however fast the line is read. As the line calls the black hole an
  // object, the ember shows again, faintly, and stays
  const cools = light - 0.3
  const span = Math.max(black - 0.2 - cools, 1.5)
  const orange = cools + span * 0.36
  const ember = cools + span * 0.66
  const dark = cools + span
  for (let layer = 0; layer < 8; layer++) {
    const glow = 0.085 * (1 - layer / 9)
    ball(WHITE_HOT, +(1.12 + layer * 0.17).toFixed(2), [[start, glow], [cools, glow], [cools + span * 0.5, 0]], end - start)
  }
  ball(EMBER, 1, [[start, 0], [orange, 0], [ember, 0.9], [dark, 0], [thing - 0.3, 0], [thing + 1.2, 0.3], [well, 0.3], [well + 1.5, 0.5]], end - start)
  ball(ORANGE, 1, [[start, 0], [cools, 0], [orange, 1], [ember, 0]], end - start)
  ball(WHITE_HOT, 1.02, [[start, 1], [cools, 1], [orange, 0]], end - start)
  at(said + heard('star', 'neutron', 3.6) - 0.2, () => {
    cap('a neutron star', black - 0.5 - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: INK })
  })
  wait(object - start)
})

shot('a black hole is an object', () => {
  // "Add more mass": the well grows deeper, and nothing else about the picture changes
  const spokenObject = say('object', 11.7)
  at(object + heard('object', 'deeper', 1.9) - 1.4, () => { to({ gridDepth: 8, blackHoleY: 0.76 }, 4.2) })
  at(light - 0.3, () => { to({ ringGlow: 0.6 }, 2.6) })
  at(black - 0.2, () => {
    cap('a black hole', nothing - 0.4 - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: INK })
  })
  // The hypothesis's own words: a black hole is as simple an object as a neutron star
  at(thing - 0.2, () => {
    cap('not a hole in space: *{an object}, as simple as a neutron star', nothing - 0.4 - now(), { at: [0.5, 0.2], size: 0.04, font: 'noto', accent: GOLD })
  })
  wait(spokenObject + 0.9)
})

shot('nothing has to break', () => {
  // The three things the equations promised and nobody has found, named one after another and then struck
  // out together under the hypothesis's own verdict: in our nature they are most likely impossible, which is
  // less than "there are none"
  const spokenNothing = say('nothing', 16)
  const verdict = nothing + heard('nothing', 'likely', 8.1)
  const named = (word, guess, text, row, width) => {
    const y = 0.3 + row * 0.1
    at(nothing + heard('nothing', word, guess) - 0.3, () => {
      cap(text, well - 0.2 - now(), { at: [0.8, y], size: 0.04, font: 'unbounded', color: INK, fade: 0.3 })
    })
    at(verdict - 0.3 + row * 0.18, () => {
      sketch({ kind: 'line', points: [[0.8 - width / 2, y], [0.8 + width / 2, y]], color: W, width: 0.006, draw: 0.3, fade: 0.3 }, well - 0.2 - now())
    })
  }
  named('singularity', 2.4, 'singularity', 0, 0.19)
  named('wormhole', 4.2, 'wormhole', 1, 0.15)
  named('white', 5.4, 'white hole', 2, 0.17)
  at(verdict + 0.4, () => {
    cap('in our nature', well - 0.2 - now(), { at: [0.8, 0.615], size: 0.03, font: 'noto', color: INK, fade: 0.3 })
    cap('*{most likely impossible}', well - 0.2 - now(), { at: [0.8, 0.675], size: 0.036, font: 'noto', accent: W, fade: 0.3 })
  })
  // "Only a well": the camera rises a little and takes the whole of it in, and what rests at its bottom is named
  at(well - 0.4, () => { to({ gridTilt: 60, blackHoleY: 0.72 }, 3.2) })
  at(nothing + heard('nothing', 'simple', 13.4) - 0.2, () => {
    cap('a simple object', nothing + spokenNothing + 1.2 - now(), { at: 'hole', angle: 25, size: 0.03, font: 'unbounded', color: INK })
  })
  wait(spokenNothing + 1.6)
})
