// The fourth dimension, clip 3 of films/fourth_dimension.json: what follows if the well is real. Space is
// stretched along W, not curved; what stretches can ripple, and two black holes merge and send the wave that
// was measured in 2015; the bottom of the well is a throat, not a singularity, and the camera falls through it
// as through a tunnel and comes out of a white hole.
// The narration sets the pace, as in clip 1 (fourth_dimension_ladder.js says how).
//   node .claude/skills/space-scene/scripts/space.mjs preview films/fourth_dimension_ripple.js out.jpg - --input films/voice/fourth_dimension_lines.json
/* global film, set, to, wait, shot, caption, draw, mark, now, at, meanwhile, fire, title, input */
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

film({
  fps: 60,
  seed: 9,
  warmup: 4,
  settings: {
    blackHoleSize: 8,
    blackHoleY: 0.72,
    numParticles: 40000,
    baseBrightness: 0.9,
    // The ring of matter round the hole at the bottom of the well, as in clip 2
    gravityInertia: 0.92,
    orbitalStrength: 90,
    gravityStrength: 5,
    gravityReach: 8,
    baseSpeed: 0.5,
    trailIntensity: 0.08,
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
    gridCell: 4,
    gridSheet: 0.9,
    gridTilt: 66,
    gridDepth: 3,
    gridWaveLift: 9,
    companionDistance: 6.5,
    companionSpeed: 2,
    companionWaves: 2.2
  }
})
set({ letterbox: 0.11, filmHold: 1, vignette: 0.4, filmGrain: 0.04 })

// ---- stretched, not curved ----

shot('not curved: stretched', () => {
  const start = now()
  wait(0.8)
  const said = now()
  const spoken = say('stretch', 7.7)
  const stretches = said + heard('stretch', 'stretches', 5.9)
  const end = said + spoken + 1.2
  caption('Einstein: mass *{curves} space', stretches - 0.4 - said - 0.6, { at: [0.5, 0.2], size: 0.042, font: 'noto', accent: GRID })
  at(stretches, () => {
    caption('this hypothesis: mass *{stretches} space, along *{W}', end - now(), { at: [0.5, 0.2], size: 0.042, font: 'noto', accent: W })
    to({ gridDepth: 9 }, 2.8, 'out')
  })
  // The arrow of W grows with the well: from the mouth of the well, which rises as it deepens, down to the hole
  at(stretches - 0.2, () => {
    const top = [[now(), 1.9], [now() + 3, 5.3, 'out']]
    for (const look of [{ width: 0.016, opacity: 0.22 }, { width: 0.0065 }]) {
      draw({ kind: 'line', points: [{ hole: [0, 'top'] }, { hole: [0, 1.25] }], arrow: 'end', color: W, fade: 0.4, values: { top }, ...look }, end - now())
    }
    caption('W', end - now(), { at: { hole: [-0.9, 3.2] }, size: 0.04, font: 'unbounded', color: W, fade: 0.4 })
  })
  wait(end - start)
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
  const spoken = say('ripple', 11.4)
  const two = start + heard('ripple', 'two', 7.3) - 1.4
  const proton = start + spoken + 0.9
  const merger = proton + 0.5
  const end = proton + long('proton', 4.6) + 1.6
  meanwhile(() => { to({ gridDepth: 4, blackHoleY: 0.5, gridTilt: 62 }, 2.4) })
  // "can also ripple": one wave crosses the sheet
  at(start + heard('ripple', 'ripple', 2.4) - 0.3, () => { fire('ringdown', 'gravityWave', { gravityWaveGain: 9, ringdownAmplitude: 0.08 }) })
  at(two, () => {
    to({ companionSize: 0.8 }, 1.2)
    to({ companionDistance: 0 }, merger - now(), 'in')
  })
  // The field keeps all the speed the two holes give it and whirls round the pair; the merger throws it outward
  at(two, () => { to({ gravityInertia: 1, baseSpeed: 1.5, gravityStrength: 4.5, gravityReach: 9 }, 2) })
  at(merger - 0.1, () => {
    to({ baseSpeed: 9 }, 0.5, 'out')
    to({ baseSpeed: 1.2 }, 2.6)
  })
  at(two + 0.6, () => {
    const from = now()
    draw({ kind: 'plot', box: [0.065, 0.2, 0.3, 0.24], x: [0, 1], y: [-1.15, 1.15], points: chirp, color: GOLD, plate: 0.72, labelSize: 0.022,
      xLabel: 'time', yLabel: 'the stretch of space', upTo: 'reached', marker: 'reached', fade: 0.5,
      values: { reached: [[from, 0], [merger, MERGER, 'in'], [merger + 2.2, 1, 'linear']] } }, end - from)
    caption('GW150914 · 14 September 2015', end - from, { at: [0.215, 0.5], size: 0.024, font: 'noto', color: SOFT })
  })
  wait(proton - start)
})

shot('a thousandth of a proton', () => {
  const start = now()
  const spoken = say('proton', 4.6)
  meanwhile(() => { to({ cameraZoom: 1.15 }, spoken + 1.4) })
  caption('LIGO: two arms of 4 km\nstretched by *{10^{−18} m}\n≈ 1 / 1000 of a proton', spoken + 1.2, {
    at: [0.79, 0.3], width: 0.34, align: 'left', size: 0.036, font: 'noto', accent: GOLD, plate: 0.6, reveal: 'lines', revealOver: heard('proton', 'proton', 3.9)
  })
  wait(spoken + 1.6)
})

// ---- the bottom of the well ----

shot('the bottom of the well', () => {
  const start = now()
  const spoken = say('throat', 15.2)
  const singularity = start + heard('throat', 'singularity', 6.3)
  const throat = start + heard('throat', 'throat', 10.3)
  const tunnel = start + heard('throat', 'tunnel', 11.5)
  const wormhole = start + heard('throat', 'wormhole', 14.4)
  meanwhile(() => { to({ blackHoleY: 0.72, gridTilt: 68, gridDepth: 6.5, cameraZoom: 1.2 }, 3.4) })
  at(singularity - 0.2, () => { caption('a singularity?', throat - 0.5 - now(), { at: 'hole', angle: 200, size: 0.03, font: 'unbounded', color: INK }) })
  // The well grows into a throat
  at(throat - 0.4, () => {
    caption('a *{throat}', tunnel - now() + 0.5, { at: 'hole', angle: 200, size: 0.03, font: 'unbounded', color: INK, accent: W })
    to({ gridDepth: 12, gridTilt: 73 }, tunnel - now() + 0.2)
  })
  // And the camera goes down it: the flight rushes, the picture folds round into a tunnel
  at(tunnel + 0.2, () => {
    to({ gridSheet: 0, blackHoleY: 0.5, cameraZoom: 0.5, baseSpeed: 70, baseBrightness: 1.2, flightTintFrom: 0, blackHoleSize: 16, trailIntensity: 0.05 }, 3.2, 'in')
  })
  at(wormhole - 0.2, () => { caption('a *{wormhole}', start + spoken + 1 - now(), { at: [0.5, 0.84], size: 0.05, font: 'unbounded', accent: W }) })
  wait(spoken + 1.2)
})

shot('a white hole', () => {
  const start = now()
  const spoken = say('white', 6.7)
  const pours = start + heard('white', 'pours', 3.7) - 0.6
  // The far end: the hole pushes instead of pulling, takes nothing in and shines
  at(pours, () => {
    fire('glare', 'light', 'burst')
    set({
      companionSize: 0, gravityStrength: -18, gravityInertia: 0, orbitalStrength: 0, horizonScale: 0, lensingEnabled: false, ringBrightness: 10, ringGlow: 3, ringBase: 3,
      ringGlowSkirt: 1, ringGlowSkirtShare: 3, ringGlowCore: 0.4, ringGlowCoreShare: 3
    })
    to({ cameraZoom: 1, baseSpeed: 3, blackHoleSize: 7, trailIntensity: 0.12 }, 2.6, 'out')
  })
  at(start + heard('white', 'white', 5.4) - 1.1, () => {
    title('A WHITE HOLE', { params: { titleEntrance: 'Comes out of the black hole', titleExit: 'Fades out', titleInAt: 0, titleInDuration: 1.6, dissolveAt: 4.2, dissolveDuration: 1, titleOffset: -0.3, titleSize: 0.46 } })
  })
  wait(spoken + 3.6)
})
