// The infographic look on one frame: the scene in cold blue, the one thing the film is about in a warm
// accent that glows, a dashed line for what would be without the effect, words in the corners and the
// physics in the middle, leader lines to what the words name, a legend and an inset on quiet plates.
// The recipe is in .claude/skills/space-scene/references/films.md, "An infographic look".
//   node .claude/skills/space-scene/scripts/space.mjs still films/infographic_style.js out.jpg 6
/* global film, set, wait, caption, draw, to */
film({
  seed: 3,
  settings: {
    fieldEnabled: false, lensingEnabled: false, ringEnabled: false, blackHoleX: 0.57, blackHoleY: 0.55,
    // The star is 1.15 hole radii across its radius, and a hole radius is the shadow's, 2.6 Schwarzschild
    // radii: about 3 of them, a real neutron star's size. Its well is a bowl that ends at its surface, not a
    // black hole's long throat: shallow, its rings spread toward even radii so they do not pack against the
    // star, and no glow at a throat the star covers. 42 spokes keep a spoke from lying under the spin axis (a
    // multiple of 4 would)
    gridSheet: 0.75, gridTilt: 52, gridDepth: 1.2, gridRings: 16, gridRingSpacing: 0.7, gridSpokes: 42, gridSpan: 2.6,
    gridLift: 0.6, gridThroatGlow: 0, gridLight: 1.2, gridLightReach: 3
  }
})
set({ fade: 1 })

const WARM = '#ffb35c'
const STAR = '#5aa8ff'
const QUIET = '#9aa6b8'
const PLATE = '#070b14'
// Words in a corner or a column stand by their left edge, so a row starts where it is put
const text = (more = {}) => ({ font: 'noto', size: 0.026, anchor: 'left', ...more })
// A plate: a quiet rounded frame on a dark ground; its centre and its size in shares of the frame's short side
const plate = (center, size) => ({ kind: 'rect', center, size, round: 0.012, color: QUIET, width: 0.0012, opacity: 0.8, fill: PLATE, fillOpacity: 0.72 })
// A sphere lit from the top left: its colour at the light, its own at the edge, and its glow
const sphere = (center, radius, glow) => ({ kind: 'circle', center, radius, color: STAR, width: 0.002, fill: '#bfe2ff', fillTo: '#1d4f9a', fillAt: [-0.35, 0.4], glow })

// The light, laid on the sheet so it dips with the well wherever it goes, and running from the depth toward
// the camera so its bend lies across the frame, where a tilted sheet does not squash it. Without the star it
// would run straight from the source to the observer, through the star, which blocks it: the dashed line,
// whose middle the star hides. Gravity bends the light round the star's left flank instead, 2.4 hole radii
// out: two straight legs mirrored about the point of closest approach, each turned 13 degrees toward the
// star there, 26 in all, about 1.4 times what a neutron star gives light passing there. The star is there
// from the first frame, so the black hole under it is never seen bare, and drawn over the dashed line,
// under the bent one, which passes in front of the well
const source = { sheet: [-0.9, 6.5] }
const closest = { sheet: [-2.4, 0] }
const observer = { sheet: [-1, -6] }
draw({ kind: 'line', points: [source, observer], color: '#ffffff', width: 0.002, dash: [0.012, 0.008], opacity: 0.8 })
draw(sphere({ hole: [0, 0] }, 1.15, 0.05))
// The observer: an observatory on a rock (a generated picture, cut out on a clear ground), its dome's slit
// where the light ends, the rock running off the frame's bottom. It rides the hole, which the still sheet
// keeps in one place under the observer
const OBSERVATORY = { center: { hole: [-1.44, -4.62] }, width: 4 }
draw({ kind: 'image', src: 'films/infographic_observatory.png', ...OBSERVATORY })
draw({
  kind: 'line', smooth: true, arrow: 'middle', color: WARM, width: 0.0035, glow: 0.012, draw: 3,
  points: [source, { sheet: [-1.63, 4] }, { sheet: [-2.14, 2] }, closest, { sheet: [-2.14, -2] }, { sheet: [-1.63, -4] }, observer]
})
draw({ kind: 'circle', center: source, radius: 0.08, fill: '#ffd9a0', color: '#ffd9a0', glow: 0.02 })

to({ fade: 0 }, 1)

// The axis it turns about, rising from its pole, and the way it turns
draw({ kind: 'line', arrow: 'end', points: [{ hole: [0, 1.15] }, { hole: [0, 2.8] }], color: '#ffffff', width: 0.0028 })
// Its stub under the star, faint, so the arrow reads as an axis through the star and not a line on the sheet; solid,
// since a dash means the path without lensing here
draw({ kind: 'line', points: [{ hole: [0, -1.15] }, { hole: [0, -1.9] }], color: '#ffffff', width: 0.0028, opacity: 0.45 })
draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 1.5, radiusY: 0.92, arc: [-40, 35], arrow: 'end', color: '#ffffff', width: 0.0025 })
caption('Ω', { at: { hole: [0.35, 2.9] }, font: 'noto', size: 0.04, italic: true })

// Words: the title against the top-left margin, labels beside what they name, a legend and an inset in the corners
wait(0.3)
caption('Light bent by a neutron star', text({ at: [0, 0.07], size: 0.045 }))
caption('(schematic; not to scale, bend exaggerated)', text({ at: [0, 0.135], size: 0.034, color: '#c6cfdc', weight: 400, plate: 0.5 }))
caption('Neutron star\n(rapid rotation)', { at: 'hole', angle: -60, radius: 1.2, font: 'noto', size: 0.026, plate: 0.5 })
// The two ends are named where they are, on the sheet, so their words go wherever the sheet takes them
caption('Distant light source', { at: { sheet: [-1.4, 6.5] }, font: 'noto', size: 0.026, anchor: 'right' })
caption('Observer', { at: { hole: [0.45, -3.4] }, font: 'noto', size: 0.026, anchor: 'left' })

// Once the path has drawn itself in: the legend that names it
wait(2)

// The legend: a plate whose left edge is the frame's margin, its samples and their words in two columns
draw(plate([0.18, 0.86], [0.52, 0.2]))
draw({ kind: 'line', points: [[0.05, 0.8], [0.1, 0.8]], color: WARM, width: 0.0035, glow: 0.008 })
draw({ kind: 'line', points: [[0.05, 0.86], [0.1, 0.86]], color: '#ffffff', width: 0.002, dash: [0.012, 0.008], opacity: 0.8 })
draw({ kind: 'line', points: [[0.05, 0.92], [0.1, 0.92]], color: '#8fa6c8', width: 0.0022 })
caption('Lensed light path', text({ at: [0.115, 0.8] }))
caption('Path without lensing', text({ at: [0.115, 0.86] }))
caption('Spacetime curvature (grid)', text({ at: [0.115, 0.92] }))

// The inset: frame dragging. Space turns with the star, fastest close to it: the Lense-Thirring rate falls as
// the cube of the distance, so a ring twice as far turns eight times slower. Each ring carries a dot that
// goes round at its ring's rate, and a head that says which way
const INSET = [0.83, 0.2]
// A frame place is a share of the width and of the height; this keeps a ring round on a 16:9 frame
const WIDE = 9 / 16
draw(plate(INSET, [0.48, 0.34]))
caption('Frame dragging', text({ at: [0.71, 0.075], size: 0.028 }))
// Each ring is taller than the star, so no ring or its dot crosses the star's face
draw(sphere(INSET, 0.022, 0.02))
const rings = [[0.075, 0.034], [0.11, 0.046], [0.145, 0.058]]
const TURNS = 0.5 // turns a second of the innermost ring
rings.forEach(([across, tall], index) => {
  // A whole ring's head is halfway round from where it starts: each starts a third of a turn on, so the heads
  // do not stand in a column
  const from = 240 + index * 120
  draw({ kind: 'circle', center: INSET, radius: across, radiusY: tall, arc: [from, from + 360], arrow: 'middle', color: '#7fc4ff', width: 0.0016, glow: 0.006, opacity: 0.85 })
  const rate = TURNS * (rings[0][0] / across) ** 3 * 2 * Math.PI
  const start = index * 2.1
  draw({
    kind: 'circle', center: ['x', 'y'], radius: 0.006, fill: '#e8f4ff', color: '#e8f4ff', glow: 0.012, width: 0,
    values: {
      x: s => INSET[0] + Math.cos(start + rate * s) * across * WIDE,
      y: s => INSET[1] - Math.sin(start + rate * s) * tall
    }
  })
})
draw({ kind: 'line', arrow: 'end', points: [[INSET[0], 0.178], [INSET[0], 0.112]], color: '#ffffff', width: 0.0016 })
caption('Ω', text({ at: [INSET[0] + 0.012, 0.108], size: 0.024, italic: true }))
caption('Rotation twists spacetime\naround the star · rate ∝ 1/r³', { at: [INSET[0], 0.31], font: 'noto', size: 0.026, italic: true, color: '#dfe6f0' })

wait(6)
