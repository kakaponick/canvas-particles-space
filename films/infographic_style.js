// The infographic look on one frame: the scene in cold blue, the one thing the film is about in a warm
// accent that glows, a dashed line for what would be without the effect, words in the corners and the
// physics in the middle, leader lines to what the words name, a legend and an inset on quiet plates.
// The recipe is in .claude/skills/space-scene/references/films.md, "An infographic look".
//   node .claude/skills/space-scene/scripts/space.mjs still films/infographic_style.js out.jpg 6
/* global film, set, wait, caption, draw, meanwhile, to */
film({
  seed: 3,
  settings: {
    fieldEnabled: false, lensingEnabled: false, ringEnabled: false, blackHoleY: 0.5,
    gridSheet: 0.75, gridTilt: 70, gridDepth: 4, gridRings: 26, gridSpokes: 40, gridSpan: 2.6,
    gridLift: 0.7,gridThroatGlow: 2.5, gridLight: 1.4, gridLightReach: 3
  }
})
set({ fade: 1 })

const WARM = '#ffb35c'
const STAR = '#5aa8ff'
const QUIET = '#9aa6b8'
const PLATE = '#070b14'
const text = (more = {}) => ({ font: 'noto', size: 0.026, align: 'left', ...more })
// A plate: a quiet rounded frame on a dark ground, in shares of the frame and of its short side
const plate = (center, size) => ({ kind: 'rect', center, size, round: 0.012, color: QUIET, width: 0.0012, opacity: 0.8, fill: PLATE, fillOpacity: 0.72 })
// An ellipse round a point as a smooth line, so it can carry an arrow; tilt 0 is flat across the frame
const ellipse = (place, rx, ry, from, to, steps = 24) => Array.from({ length: steps + 1 }, (_, i) => {
  const angle = (from + (to - from) * i / steps) * Math.PI / 180
  return place(rx * Math.cos(angle), ry * Math.sin(angle))
})

to({ fade: 0 }, 1)

// The axis it turns about, and the way it turns
draw({ kind: 'line', points: [{ hole: [0, 1.4] }, { hole: [0, 4.2] }], color: '#ffffff', width: 0.0015, dash: [0.008, 0.006], opacity: 0.85 })
draw({ kind: 'line', smooth: true, arrow: 'end', points: ellipse((x, y) => ({ hole: [x, 3.3 + y] }), 0.75, 0.2, 200, 520), color: '#ffffff', width: 0.002 })
caption('Ω', { at: { hole: [0.75, 4] }, font: 'noto', size: 0.04, italic: true })

// The light: its bent path in the accent, glowing, and the straight one it would take without the star
wait(0.3)
const source = { sheet: [-10, 2] }
const observer = { sheet: [8, -8.5] }
draw({ kind: 'line', points: [source, observer], color: '#ffffff', width: 0.0012, dash: [0.007, 0.006], opacity: 0.55 })
// The body over the straight path and under the bent one: a glowing disc over the hole, sitting in its well,
// whose throat glows and is lit by it
draw({ kind: 'circle', center: { hole: [0, 0] }, radius: 1.25, color: STAR, fill: '#1d4f9a', glow: 0.05, width: 0.003 })
draw({ kind: 'circle', center: { hole: [-0.25, 0.25] }, radius: 0.8, color: '#9fd0ff', fill: '#3f86e0', fillOpacity: 0.55, width: 0, glow: 0.02 })
draw({
  kind: 'line', smooth: true, arrow: 'middle', color: WARM, width: 0.0035, glow: 0.012, draw: 2,
  points: [source, { sheet: [-5, -1] }, { sheet: [-2.2, -3.6] }, { sheet: [1.2, -4.6] }, { sheet: [4.5, -6] }, observer]
})
draw({ kind: 'circle', center: source, radius: 0.08, fill: '#ffd9a0', color: '#ffd9a0', glow: 0.02 })

// Words: the title in the top-left corner, labels with leader lines, a legend and an inset in the corners
caption('Gravitational lensing around a rotating star', text({ at: [0.03, 0.07], size: 0.045, color: '#ffffff' }))
caption('(Kerr metric)', text({ at: [0.03, 0.135], size: 0.034, color: QUIET, weight: 400 }))
caption('Neutron star\n(rapid rotation)', { at: 'hole', angle: 50, radius: 1.4, font: 'noto', size: 0.026 })
caption('Distant\nlight source', text({ at: [0.1, 0.36] }))
caption('Observer', text({ at: [0.91, 0.6] }))
draw({ kind: 'circle', center: observer, radius: 0.08, fill: '#ffffff', color: '#ffffff', glow: 0.012 })

draw(plate([0.165, 0.86], [0.5, 0.2]))
draw({ kind: 'line', points: [[0.04, 0.8], [0.09, 0.8]], color: WARM, width: 0.0035, glow: 0.008 })
draw({ kind: 'line', points: [[0.04, 0.86], [0.09, 0.86]], color: '#ffffff', width: 0.0012, dash: [0.007, 0.006] })
draw({ kind: 'line', points: [[0.04, 0.92], [0.09, 0.92]], color: '#80bdff', width: 0.0015 })
// A caption's [x, y] is the middle of its block, so each row is placed by its own middle
caption('Lensed light path', text({ at: [0.165, 0.8] }))
caption('Path without lensing', text({ at: [0.176, 0.86] }))
caption('Spacetime curvature (grid)', text({ at: [0.197, 0.92] }))

draw(plate([0.85, 0.2], [0.48, 0.32]))
caption('Frame dragging', text({ at: [0.73, 0.08], size: 0.028 }))
draw({ kind: 'circle', center: [0.85, 0.2], radius: 0.028, color: STAR, fill: '#2f6fc8', glow: 0.02, width: 0.002 })
for (const [rx, ry, turn] of [[0.07, 0.025, 0], [0.105, 0.04, 60], [0.14, 0.055, 120]]) {
  draw({ kind: 'line', smooth: true, arrow: 'middle', color: '#7fc4ff', width: 0.0016, glow: 0.006, opacity: 0.85,
    points: ellipse((x, y) => [0.85 + x * 0.5625, 0.2 + y], rx, ry, turn, turn + 360, 36) })
}
draw({ kind: 'line', arrow: 'end', points: [[0.85, 0.16], [0.85, 0.1]], color: '#ffffff', width: 0.0016 })
caption('Ω', { at: [0.87, 0.1], font: 'noto', size: 0.024, italic: true })
caption('Rotation twists spacetime\naround the star', { at: [0.85, 0.31], font: 'noto', size: 0.022, italic: true, color: '#c6cfdc' })

meanwhile(() => { to({ gridTilt: 72 }, 6) })
wait(6)
