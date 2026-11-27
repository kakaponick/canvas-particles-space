// The infographic look on one frame, after the operator's reference: a glowing neutron star sitting in a
// deep, lit well of space, light from a distant source bent down into the well and under the star to an
// observatory on a rock, the path it would take without the star dashed behind it, the spin axis with its
// turn, a title, a legend and an inset on quiet plates. The scene is cold blue, the light the one warm thing
// that glows. The recipe is in .claude/skills/space-scene/references/films.md, "An infographic look".
//   node .claude/skills/space-scene/scripts/space.mjs still films/infographic_style.js out.jpg 8
/* global film, set, wait, caption, draw, to */
film({
  seed: 3,
  settings: {
    fieldEnabled: false, lensingEnabled: false, ringEnabled: false, blackHoleX: 0.5, blackHoleY: 0.47,
    // The neutron star the scene draws in the hole's stead, its surface 1.4 shadow radii out, as a typical
    // one of three Schwarzschild radii is seen; thin plasma veins that branch and turn with it, a lit limb
    // and a glow a radius wide
    blackHoleSize: 8.4, neutronStar: 1, neutronSurface: 1.4,
    neutronVeinLight: 1, neutronVeinSharp: 20, neutronWarp: 1.4, neutronLimb: 1, neutronGlow: 1, neutronGlowLight: 0.6,
    // A sheet of large square cells seen at 64 degrees by a camera 4 long sides away, which sees the lifted
    // sheet whole down to the frame's foot. The well is deep, 8 radii, so its walls open wide across the
    // frame, and lifted 55% of the way the star sits on the round bottom of a star's well (no throat: inside
    // its surface the sheet closes), the bowl's lit rim just under it. Lifted less, the bowl hangs far below
    // the star; more, the near sheet passes the camera. The lines keep off the star's face. The well is lit
    // by the slowing of time and by the star's own light, and the frame's bloom spreads it
    gridSheet: 0.4, gridColor: '#8fb0ff', gridRings: 0, gridCell: 6, gridTilt: 64, gridDistance: 4, gridNear: 0.02, gridSpan: 0.8, gridFade: 0.6,
    gridDepth: 8, gridLift: 0.55, gridClearing: 1.4, gridClearingEdge: 1.45,
    gridThroatGlow: 2.5, gridThroatCurve: 1, gridLight: 3, gridLightReach: 8, gridLightColor: '#8fc6ff',
    bloom: 2, bloomThreshold: 0.55, bloomReach: 0.05
  }
})
set({ fade: 1 })

const WARM = '#ffb35c'
const QUIET = '#9aa6b8'
const PLATE = '#070b14'
// Words in a corner or a column stand by their left edge, so a row starts where it is put
const text = (more = {}) => ({ font: 'noto', size: 0.024, anchor: 'left', ...more })
// A plate: a quiet rounded frame on a dark ground; its centre and its size in shares of the frame's short side
const plate = (center, size) => ({ kind: 'rect', center, size, round: 0.014, color: QUIET, width: 0.0014, opacity: 0.85, fill: PLATE, fillOpacity: 0.72 })

// The light: from the source high on the left it falls toward the well, runs down its near wall and under
// the star, the other image of the source that the star's pull makes, and goes on below the straight path to
// the observatory's slit. It is drawn in the frame, as the reference lays it out, and dips under the star
// along the bowl's lit rim. A path laid on the sheet would pass the near rim, which stands in front of the
// star's lower half, behind its face. The straight path it would take without the star is dashed and passes behind
// the star: it stops at the star's outline, where it goes in and where it comes out (the frame's words and
// shapes are drawn over the scene, so nothing hides it)
const source = [0.081, 0.27]
const slit = [0.914, 0.75]
const UNLENSED = { kind: 'line', color: '#ffffff', width: 0.0016, dash: [0.008, 0.007], opacity: 0.6 }
draw({ ...UNLENSED, points: [source, [0.434, 0.473]] })
draw({ ...UNLENSED, points: [[0.552, 0.542], slit] })
// The observatory on its rock in the frame's lower right corner, the rock running off the frame, its dome's
// slit (63% across the picture and 22% down) where the light ends
draw({ kind: 'image', src: 'films/infographic_observatory.png', center: [0.891, 0.84], width: 0.32 })
draw({
  kind: 'line', smooth: true, color: WARM, width: 0.0055, glow: 0.024, draw: 3,
  points: [source, [0.2, 0.375], [0.32, 0.47], [0.41, 0.555], [0.5, 0.618], [0.59, 0.6], [0.7, 0.64], [0.82, 0.702], slit]
})
draw({ kind: 'circle', center: source, radius: 0.007, fill: '#ffd9a0', color: '#ffd9a0', glow: 0.02 })

to({ fade: 0 }, 1)

// The spin axis through the star, dashed above it down to its top, and the way it turns round the axis
draw({ kind: 'line', points: [[0.5, 0.135], [0.5, 0.352]], color: '#ffffff', width: 0.0016, dash: [0.008, 0.007], opacity: 0.85 })
draw({ kind: 'circle', center: [0.5, 0.215], radius: 0.05, radiusY: 0.013, arc: [200, 520], arrow: 'end', color: '#ffffff', width: 0.0024 })
// and on below the star, from its bottom down into the bowl
draw({ kind: 'line', points: [[0.5, 0.588], [0.5, 0.64]], color: '#ffffff', width: 0.0016, dash: [0.008, 0.007], opacity: 0.6 })
caption('Ω', { at: [0.525, 0.17], font: 'noto', size: 0.04, anchor: 'left', italic: true })

// Words: the title in the top-left corner, labels beside what they name with a short leader, the legend
// and the inset in the corners
wait(0.3)
caption('Gravitational Lensing around a Rotating Neutron Star', text({ at: [0, 0.05], size: 0.036 }))
caption('(Kerr Metric)', text({ at: [0, 0.122], size: 0.028, color: QUIET, weight: 400 }))
draw({ kind: 'line', points: [[0.547, 0.387], [0.598, 0.31]], color: '#ffffff', width: 0.0012, opacity: 0.8 })
caption('Neutron Star\n(rapid rotation)', text({ at: [0.6, 0.275] }))
draw({ kind: 'line', points: [[0.08, 0.255], [0.076, 0.236]], color: '#ffffff', width: 0.0012, opacity: 0.8 })
caption('Distant\nlight source', text({ at: [0.056, 0.198] }))
draw({ kind: 'line', points: [[0.92, 0.715], [0.926, 0.675]], color: '#ffffff', width: 0.0012, opacity: 0.8 })
caption('Observer', text({ at: [0.9, 0.65] }))

// Once the path has drawn itself in: the head on its last stretch, into the slit, and the legend that names it
wait(2)
draw({ kind: 'line', arrow: 'end', points: [[0.86, 0.722], slit], color: WARM, width: 0.0055, glow: 0.024 })
draw(plate([0.152, 0.845], [0.44, 0.22]))
draw({ kind: 'line', points: [[0.05, 0.775], [0.095, 0.775]], color: WARM, width: 0.005, glow: 0.012 })
draw({ kind: 'line', points: [[0.05, 0.83], [0.095, 0.83]], color: '#ffffff', width: 0.0016, dash: [0.008, 0.007], opacity: 0.8 })
draw({ kind: 'line', points: [[0.05, 0.885], [0.095, 0.885]], color: '#8fb0ff', width: 0.0022 })
caption('Lensed light path', text({ at: [0.11, 0.775] }))
caption('Path without lensing', text({ at: [0.11, 0.83] }))
caption('Spacetime curvature\n(grid)', text({ at: [0.11, 0.9] }))

// The inset: frame dragging. Space turns with the star, fastest close to it: the Lense-Thirring rate falls as
// the cube of the distance, so a ring twice as far turns eight times slower. Each ring carries arcs with
// heads that say which way, and a dot that goes round at its ring's rate
const INSET = [0.87, 0.2]
// A frame place is a share of the width and of the height; this keeps a ring round on a 16:9 frame
const WIDE = 9 / 16
draw(plate(INSET, [0.36, 0.32]))
caption('Frame Dragging Effect', text({ at: [0.785, 0.075], size: 0.024 }))
// The star small, a ball of its plasma's blue with its veins' light at the rim
draw({ kind: 'circle', center: INSET, radius: 0.024, fill: '#0a3aa8', fillTo: '#8fdcff', fillAt: [-0.3, 0.3], color: '#8fdcff', width: 0.0012, glow: 0.016 })
const rings = [[0.06, 0.028], [0.088, 0.038], [0.116, 0.048]]
const TURNS = 0.5 // turns a second of the innermost ring
rings.forEach(([across, tall], index) => {
  // Two arcs a ring, each with its head, a third of a turn apart from the next ring's
  for (const half of [0, 180]) {
    const from = index * 50 + half + 20
    draw({ kind: 'circle', center: INSET, radius: across, radiusY: tall, arc: [from, from + 130], arrow: 'end', color: '#6fc3ff', width: 0.0016, glow: 0.008, opacity: 0.9 })
  }
  const rate = TURNS * (rings[0][0] / across) ** 3 * 2 * Math.PI
  const start = index * 2.1
  draw({
    kind: 'circle', center: ['x', 'y'], radius: 0.005, fill: '#e8f4ff', color: '#e8f4ff', glow: 0.01, width: 0,
    values: {
      x: s => INSET[0] + Math.cos(start + rate * s) * across * WIDE,
      y: s => INSET[1] - Math.sin(start + rate * s) * tall
    }
  })
})
draw({ kind: 'line', arrow: 'end', points: [[INSET[0], 0.18], [INSET[0], 0.115]], color: '#ffffff', width: 0.0016 })
caption('Ω', text({ at: [INSET[0] + 0.01, 0.125], size: 0.026, italic: true }))
caption('Rotation twists spacetime\naround the star', { at: [INSET[0], 0.31], font: 'noto', size: 0.022, italic: true, color: '#dfe6f0' })

wait(6)
