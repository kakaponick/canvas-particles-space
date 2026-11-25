// The fourth dimension, clip 2 of films/fourth_dimension.json: the well. A star collapses into a black hole
// under the title; the textbook sheet with its well is shown from the side, with its axes X, Y and W; the
// camera rises above the sheet, the well is gone and the grid is drawn toward the centre instead: the depth
// points inward. A flat creature of the sheet knows only that pull; then the sheet gets its third dimension
// back, a lattice of space, and the lattice is drawn inward too, into a fourth.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_well.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, opening, fire, slow, input */
const lines = input.lines ?? {}
const cues = input.cues ?? {}
const say = (name, guess) => { mark('say:' + name); return lines[name] ?? guess }
const heard = (name, word, guess) => cues[name]?.[word] ?? guess

const X = '#ffb347'
const Y = '#5dff9b'
const Z = '#4da3ff'
const W = '#ff3b5c'
const INK = '#eef2ff'
const GRID = '#4de3ff'

film({
  fps: 60,
  seed: 5,
  settings: {
    blackHoleSize: 8,
    numParticles: 40000,
    // What falls toward the hole keeps most of the speed gravity gives it and is swung round: a bright ring
    // of matter gathers round the shadow, as round a real black hole
    gravityInertia: 0.92,
    orbitalStrength: 90,
    gravityStrength: 5,
    gravityReach: 8,
    baseSpeed: 1,
    trailIntensity: 0.08,
    baseBrightness: 1.1,
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
    orbitSize: 4.2,
    orbitEccentricity: 0.55,
    orbitTrail: 5,
    orbitStarSize: 3,
    gridColor: GRID,
    gridCell: 4,
    gridTilt: 66,
    gridDepth: 0,
    gridLatticeCell: 1.6,
    gridLatticeWarp: 0,
    gridLatticeLine: 2,
    threeDEase: 2.6,
    cameraYaw: 0,
    cameraPitch: 0
  }
})
set({ fade: 0 })

// ---- a star, and what is left of it ----

// The star brightens for this long under the first line and goes off as the line ends; every later moment of
// the opening is moved out by as much as the explosion is
const COLLAPSE = 3.6
const LATER = COLLAPSE - 0.6
let holeSaid = 0
let holeSpoken = 0
shot('a star', () => {
  wait(0.6)
  const spoken = say('limit', 6.6)
  wait(Math.max(0, spoken + 0.25 - COLLAPSE))
})

shot('the fourth dimension', () => {
  const start = now()
  // The next line begins while the hole is taking the title
  holeSaid = start + COLLAPSE + 3.5
  at(holeSaid, () => { holeSpoken = say('hole', 8.8) })
  opening({
    preset: 'Anamorphic',
    title: 'THE FOURTH\nDIMENSION',
    params: {
      collapseAt: COLLAPSE,
      starChargeStart: 0.2,
      remnantAt: 1 + LATER,
      horizonAt: 1.3 + LATER,
      dissolveAt: 2.9 + LATER,
      releaseAt: 5.4 + LATER,
      introEnd: 5.8 + LATER,
      titleExit: 'Falls into the black hole',
      letterbox: 0.11,
      vignette: 0.4,
      filmGrain: 0.04,
      filmHold: 1
    }
  })
  // The fringe of the anamorphic glass leaves with the opening: held, it would colour the lattice to come
  meanwhile(() => { to({ lensFringe: 0 }, 1.5) })
})

shot('a black hole', () => {
  // The stars come once the fringe is gone: it colours their traces
  at(now() + 1.5, () => { set({ orbitCount: 7 }) })
  const end = holeSaid + (lines.hole ?? 8.8) + 0.8
  meanwhile(() => { to({ cameraZoom: 1.7 }, end - now()) })
  const label = (word, guess, text, place) => {
    const from = Math.max(now(), holeSaid + heard('hole', word, guess))
    at(from, () => { caption(text, end - from, { size: 0.03, font: 'unbounded', color: INK, ...place }) })
  }
  label('shadow', 4.3, 'a shadow', { at: 'hole', angle: 205 })
  label('ring', 5.6, 'a ring of light', { at: 'hole', angle: 25 })
  label('sky', 7.4, 'a sky bent around it', { at: 'einstein', angle: 140 })
  wait(end - now())
})

// ---- the textbook picture ----

shot('the textbook well', () => {
  const start = now()
  const spoken = say('textbook', 7.7)
  set({ orbitCount: 0 })
  meanwhile(() => { to({ cameraZoom: 1, blackHoleY: 0.74, baseBrightness: 0.9, baseSpeed: 0.5 }, 3) })
  at(start + heard('textbook', 'sheet', 4.7) - 0.5, () => { to({ gridSheet: 0.9 }, 1.6) })
  at(start + heard('textbook', 'well', 6.8) - 0.6, () => { to({ gridDepth: 5.5 }, 2.4, 'out') })
  wait(spoken + 1.4)
})

shot('X, Y and W', () => {
  const start = now()
  const spoken = say('axes', 8.8)
  const end = start + spoken + 0.9 + (lines.literally ?? 5.1) + 0.8 + (lines.down ?? 4.8) * 0.2
  // The axes stand on the sheet beside the well: two along it, the third down into it
  const corner = { hole: [6.4, 3.6] }
  const axis = (word, guess, tip, color, letter, where) => {
    at(start + heard('axes', word, guess), () => {
      draw({ kind: 'line', points: [corner, { hole: tip }], arrow: 'end', color, width: 0.006, draw: 0.5, fade: 0.4 }, end - now())
      caption(letter, end - now(), { at: { hole: where }, size: 0.034, font: 'unbounded', color, fade: 0.4 })
    })
  }
  axis('x', 1.4, [9.4, 3.6], X, 'X', [10.3, 3.6])
  axis('y', 2.6, [5.3, 5.5], Y, 'Y', [5.1, 5.9])
  at(start + heard('axes', 'y', 2.6) + 1.1, () => { caption('space', 2.6, { at: { hole: [8.6, 5] }, size: 0.03, font: 'noto', color: '#c9d4f0' }) })
  at(start + heard('axes', 'w', 6.6), () => {
    draw({ kind: 'line', points: [corner, { hole: [6.4, 1.2] }], arrow: 'end', color: W, width: 0.006, draw: 0.5, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: { hole: [6.4, 0.75] }, size: 0.034, font: 'unbounded', color: W, fade: 0.4 })
    // And the same direction where it matters: down the middle of the well
    draw({ kind: 'line', points: [{ hole: [0, 4.4] }, { hole: [0, 1.25] }], arrow: 'end', color: W, width: 0.016, opacity: 0.22, draw: 0.9, fade: 0.4 }, end - now())
    draw({ kind: 'line', points: [{ hole: [0, 4.4] }, { hole: [0, 1.25] }], arrow: 'end', color: W, width: 0.0065, draw: 0.9, fade: 0.4 }, end - now())
    caption('*{W}  gravity', end - now(), { at: { hole: [-2.3, 3.1] }, size: 0.034, font: 'unbounded', accent: W, fade: 0.4 })
  })
  wait(spoken + 0.9)
})

shot('taken literally', () => {
  const spoken = say('literally', 5.1)
  meanwhile(() => { to({ gridDepth: 7, gridSheet: 1 }, spoken + 0.6) })
  caption('“only a picture”  or  *{a real direction}?', spoken + 0.4, { at: [0.5, 0.2], size: 0.04, font: 'noto', accent: W, reveal: 'words', revealOver: 2.4 })
  wait(spoken + 0.8)
})

shot('down into what?', () => {
  const start = now()
  const spoken = say('down', 4.8)
  meanwhile(() => { to({ blackHoleY: 0.55, cameraZoom: 1.2 }, 2) })
  at(start + heard('down', 'down', 1.9), () => {
    const rest = start + spoken + 0.9 - now()
    draw({ kind: 'line', points: [{ hole: [0, -1.25] }, { hole: [0, -2.9] }], arrow: 'end', color: W, width: 0.0065, dash: true, draw: 0.8, fade: 0.4 }, rest)
    caption('?', rest, { at: { hole: [0.8, -2.4] }, size: 0.07, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(spoken + 0.9)
})

// ---- the switch: from above ----

shot('rise above the sheet', () => {
  const start = now()
  const spoken = say('rise', 5.1)
  const rise = start + heard('rise', 'rise', 2.1) - 0.3
  // The camera of the sheet goes up over the well, and the hole comes to the middle of the frame under it
  at(rise, () => { to({ gridTilt: 0, blackHoleY: 0.5, cameraZoom: 1, gridDepth: 5.5 }, 5.2) })
  // From above the dent cannot be seen, so the sheet gives way to the flat grid of the sky
  at(rise + 3.6, () => { to({ gridSheet: 0, gridSky: 0.75 }, 1.6) })
  at(rise + 3.2, () => { set({ lensingEnabled: false }) })
  // Seen from above with the well gone, the particles too fly past the hole as if nothing were there
  at(rise + 2.4, () => { to({ gravityStrength: 0.3, orbitalStrength: 0, gravityInertia: 1, baseSpeed: 1.4, baseBrightness: 1.2 }, 2.6) })
  wait(Math.max(spoken + 0.6, rise + 5.4 - start))
})

shot('W has not vanished', () => {
  const start = now()
  const spoken = say('vanished', 7.4)
  caption('the same sheet, seen from above', 3.2, { at: [0.5, 0.2], size: 0.036, font: 'noto', color: '#c9d4f0' })
  // "But W has not": the grid is drawn in toward the hole
  // and the particles with it: their paths bend in toward the hole and wind round it
  at(start + 1.9, () => { to({ gridSkyPull: 9, gravityStrength: 7, gravityReach: 10, baseSpeed: 2.2 }, 4.6) })
  wait(spoken + 0.8)
})

// The hypercube of clip 1 as a small drawing, for the rhyme: a cube inside a cube, the fourth edges red
const ASPECT = 9 / 16
const drawing = (centre, size) => ([x, y, z]) => {
  const across = x * Math.cos(0.52) + z * Math.sin(0.52)
  const away = z * Math.cos(0.52) - x * Math.sin(0.52)
  const up = y * Math.cos(0.34) + away * Math.sin(0.34)
  return [+(centre[0] + size * across * ASPECT).toFixed(5), +(centre[1] - size * up).toFixed(5)]
}
function hypercube (centre, size, seconds) {
  const place = drawing(centre, size)
  const inner = 0.42
  for (let index = 0; index < 8; index++) {
    const from = [index & 1, (index >> 1) & 1, (index >> 2) & 1].map(part => part - 0.5)
    for (let way = 0; way < 3; way++) {
      if (from[way] > 0) continue
      const to = from.map((part, each) => each === way ? 0.5 : part)
      for (const scale of [1, inner]) {
        draw({ kind: 'line', points: [place(from.map(part => part * scale)), place(to.map(part => part * scale))], color: [X, Y, Z][way], width: 0.003, draw: 0.8, fade: 0.4 }, seconds)
      }
    }
    draw({ kind: 'line', points: [place(from), place(from.map(part => part * inner))], color: W, width: 0.0045, draw: 0.8, fade: 0.4 }, seconds)
  }
}

shot('a circle inside a circle', () => {
  const start = now()
  const spoken = say('circle', 12.3)
  const end = start + spoken + 0.7
  const OUTER = 4.5
  const INNER = 1.6
  at(start + heard('circle', 'inward', 3.5), () => {
    for (let index = 0; index < 12; index++) {
      // The two beside the red line of W are left out: the line says it there
      if (index === 5 || index === 6) continue
      const angle = (index + 0.5) * Math.PI / 6
      const point = radius => ({ hole: [+(radius * Math.cos(angle)).toFixed(3), +(radius * Math.sin(angle)).toFixed(3)] })
      draw({ kind: 'line', points: [point(4.1), point(2.3)], arrow: 'end', color: W, width: 0.0045, draw: 0.6, fade: 0.4 }, end - now())
    }
  })
  at(start + heard('circle', 'circle', 5.1), () => {
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: OUTER, color: INK, width: 0.004, draw: 0.9, fade: 0.4 }, end - now())
  })
  at(start + heard('circle', 'circle', 5.1) + 0.8, () => {
    draw({ kind: 'circle', center: { hole: [0, 0] }, radius: INNER, color: INK, width: 0.004, draw: 0.7, fade: 0.4 }, end - now())
  })
  at(start + heard('circle', 'w', 7.2), () => {
    draw({ kind: 'line', points: [{ hole: [-OUTER, 0] }, { hole: [-INNER, 0] }], color: W, width: 0.018, opacity: 0.25, draw: 0.6, fade: 0.4 }, end - now())
    draw({ kind: 'line', points: [{ hole: [-OUTER, 0] }, { hole: [-INNER, 0] }], color: W, width: 0.007, draw: 0.6, fade: 0.4 }, end - now())
    caption('W', end - now(), { at: { hole: [-3.05, 0.7] }, size: 0.04, font: 'unbounded', color: W, fade: 0.4 })
  })
  at(start + heard('circle', 'cube', 10.6) - 0.8, () => {
    hypercube([0.87, 0.5], 0.19, end - now())
  })
  wait(spoken + 0.7)
})

// ---- the flat creature ----

shot('a flat creature', () => {
  const start = now()
  const spoken = say('creature', 14.6)
  const end = start + spoken + 0.8
  const slides = start + heard('creature', 'slides', 12.7) - 0.6
  // Where it lives, as an angle round the hole, and how far out; it slides in when the line says so
  const way = -0.5
  const far = 5.2
  const near = 1.35
  const out = [[start, far], [slides, far], [slides + 2.6, near, 'in']]
  const creature = '#ffd27a'
  at(start + 1.2, () => {
    draw({ kind: 'circle', center: { hole: ['x', 'y'] }, radius: 0.2, fill: creature, color: creature, fade: 0.5,
      values: { x: out.map(([second, radius, ease]) => [second, +(radius * Math.cos(way)).toFixed(3), ...(ease ? [ease] : [])]), y: out.map(([second, radius, ease]) => [second, +(radius * Math.sin(way)).toFixed(3), ...(ease ? [ease] : [])]) }
    }, end - now())
    caption('a flat creature', slides - now(), { at: { hole: [far * Math.cos(way) + 1.9, far * Math.sin(way) - 0.75] }, size: 0.028, font: 'unbounded', color: creature })
  })
  // The well it cannot see, drawn from the side: its own place on it slides down as it slides in
  at(start + heard('creature', 'flat', 5) + 0.8, () => {
    const profile = []
    for (let radius = 1; radius <= 8.001; radius += 0.25) profile.push([+radius.toFixed(2), +(-Math.pow(radius, -0.8)).toFixed(4)])
    draw({ kind: 'plot', box: [0.67, 0.25, 0.26, 0.3], x: [0, 8], y: [-1, 0], points: profile, color: GRID, plate: 0.72, labelSize: 0.022,
      xLabel: 'distance from the centre', yLabel: 'depth along *{W}', marker: 'r', values: { r: out }, fade: 0.5 }, end - now())
    caption('what it cannot see: the well, from the side', end - now(), { at: [0.8, 0.2], size: 0.026, font: 'noto', color: '#c9d4f0' })
  })
  // Everything else on the sheet slides the same way, the particles hardest of all
  at(slides, () => { to({ gravityStrength: 13 }, 2.6) })
  at(slides, () => {
    for (let index = 0; index < 7; index++) {
      const angle = 0.6 + index * 0.83
      const from = 3.5 + (index % 3) * 0.4
      const late = (index % 4) * 0.22
      draw({ kind: 'circle', center: { hole: ['x', 'y'] }, radius: 0.1, fill: INK, color: INK, opacity: 0.85, fade: 0.3,
        values: { x: [[now() + late, +(from * Math.cos(angle)).toFixed(3)], [now() + late + 2.4, +(near * Math.cos(angle)).toFixed(3), 'in']], y: [[now() + late, +(from * Math.sin(angle)).toFixed(3)], [now() + late + 2.4, +(near * Math.sin(angle)).toFixed(3), 'in']] }
      }, 2.4 + late)
    }
  })
  wait(spoken + 0.8)
})

// ---- the switch: one dimension up ----

shot('we are that creature', () => {
  const start = now()
  const spoken = say('we', 4.4)
  // The sheet gets its third dimension back: the camera swings off the line of flight and the grid is a lattice
  at(start + heard('we', 'three', 3) - 1.3, () => {
    set({ threeD: true })
    // In space the falling matter keeps its speed along all three directions and settles into a disc round the hole
    to({
      cameraYaw: 30, cameraPitch: 16, gridSky: 0, gridLattice: 1, gridSkyPull: 0,
      gravityInertia: 0.95, baseSpeed: 0.4, gravityStrength: 6, gravityReach: 12, orbitalStrength: 80, baseBrightness: 2, speedGlow: 0.3
    }, 2.8)
  })
  wait(spoken + 0.9)
})

shot('falls into a fourth', () => {
  const start = now()
  const spoken = say('falls', 4.2)
  at(start + heard('falls', 'falls', 1.6) - 0.2, () => { to({ gridLatticeWarp: 10 }, 3.4) })
  meanwhile(() => { to({ cameraYaw: 52 }, spoken + 1.4) })
  at(start + heard('falls', 'falls', 1.6) + 0.9, () => {
    caption('*{W}  the fourth dimension', spoken + 1.2 - heard('falls', 'falls', 1.6) - 0.9, { at: [0.5, 0.84], size: 0.04, font: 'unbounded', accent: W })
  })
  wait(spoken + 1.4)
})

shot('inward, everywhere', () => {
  const start = now()
  const spoken = say('everywhere', 10.5)
  set({ lensingEnabled: true })
  meanwhile(() => { to({ cameraYaw: 128, cameraPitch: 26, baseBrightness: 1.6, cameraMoveIn: 3.5 }, spoken + 1) })
  at(start + heard('everywhere', 'inward', 4.4), () => {
    caption('it points *{inward}', 2.2, { at: [0.5, 0.84], size: 0.05, font: 'unbounded', accent: W })
  })
  at(start + heard('everywhere', 'star', 6.2), () => {
    caption('toward every star\ntoward every planet\ntoward the ground beneath your feet', start + spoken + 0.8 - now(), {
      at: [0.5, 0.8], size: 0.034, font: 'noto', color: INK, plate: 0.7, reveal: 'lines', revealOver: heard('everywhere', 'ground', 8.9) - heard('everywhere', 'star', 6.2) + 0.3
    })
  })
  wait(spoken + 1)
})

shot('weight', () => {
  const start = now()
  const spoken = say('weight', 4.6)
  meanwhile(() => { to({ cameraZoom: 1.5, cameraYaw: 150 }, spoken + 2.4) })
  at(start + heard('weight', 'weight', 3.9) - 0.2, () => {
    fire('ringdown', 'gravityWave', { gravityWaveGain: 9 })
    caption('you call it *{weight}', spoken + 2.2 - heard('weight', 'weight', 3.9), { at: [0.5, 0.84], size: 0.055, font: 'unbounded', accent: W })
  })
  wait(spoken + 2.4)
})
