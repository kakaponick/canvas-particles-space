// The poster of The Fourth Dimension, take 3: the hypercube of the film's first clip (its shots "inward" and
// "a hypercube"), the sign a viewer who searches for the fourth dimension knows, with what the film says of
// it: the eight edges that join the cube to the cube inside it are arrows, and they point in.
// The niche's tesseracts are solid models and shadows: this one is a drawing whose fourth edges are a direction.
// A still for YouTube (films.md, section 17), staged for 4K: what the scene counts in pixels is twice the film's.
//   node .claude/skills/space-scene/scripts/space.mjs still films/fourth_dimension/posters/poster3.js films/fourth_dimension_poster3.jpg 1.5
/* global film, set, caption, draw, wait */
const GOLD = '#ffc61a'
const INK = '#eef2ff'

film({
  size: '4k',
  fps: 30,
  seed: 11,
  warmup: 6,
  settings: {
    // The first clip's field: no hole, a flight through space seen a little from the side
    blackHoleSize: 0,
    threeD: true,
    threeDEase: 0,
    cameraYaw: 10,
    cameraPitch: 8,
    numParticles: 30000,
    baseSpeed: 0.5,
    trailIntensity: 0.1,
    particleSize: 5,
    baseBrightness: 0.5,
    nebula: 1.2,
    nebulaScale: 900,
    nebulaSparseness: 0,
    nebulaEdge: 0.6,
    nebulaContrast: 0,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    // The clouds drift until their dark gap stands behind the cube, and the haze reaches every edge
    nebulaDrift: 60,
    nebulaDriftAngle: -35,
    nebulaColor: '#2b46d6',
    nebulaColorDeep: '#0f5fa8',
    starsBrightness: 1.8,
    starDensity: 0.25,
    colorPalette: [
      { r: 120, g: 170, b: 255, enabled: true, percent: 70 },
      { r: 200, g: 215, b: 255, enabled: true, percent: 30 }
    ]
  }
})
set({ fade: 0, letterbox: 0 })

// The first clip's oblique drawing: x to the right, y up, z away to the upper right
const ASPECT = 9 / 16
const YAW = 0.52
const PITCH = 0.34
const CENTRE = [0.3, 0.5]
const SIZE = 0.52
const place = ([x, y, z]) => {
  const across = x * Math.cos(YAW) + z * Math.sin(YAW)
  const away = z * Math.cos(YAW) - x * Math.sin(YAW)
  const up = y * Math.cos(PITCH) + away * Math.sin(PITCH)
  return [+(CENTRE[0] + SIZE * across * ASPECT).toFixed(5), +(CENTRE[1] - SIZE * up).toFixed(5)]
}
const INNER = 0.4
const corners = []
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) corners.push([x, y, z])
const joined = (a, b) => a.filter((part, index) => part !== b[index]).length === 1
const line = (from, to, look) => draw({ kind: 'line', points: [place(from), place(to)], fade: 0, ...look }, 2)
// The cube and the cube inside it
for (const [scale, width, opacity] of [[1, 0.0075, 1], [INNER, 0.005, 0.85]]) {
  corners.forEach((a, first) => corners.forEach((b, second) => {
    if (second > first && joined(a, b)) line(a.map(part => part * scale), b.map(part => part * scale), { color: INK, width, opacity })
  }))
}
// and the eight edges of the fourth direction, each an arrow from a corner of the cube toward the same corner
// of the one inside: a glow under it, then the arrow
for (const corner of corners) {
  const from = corner.map(part => part * 0.96)
  const to = corner.map(part => part * (INNER + 0.07))
  line(from, to, { color: GOLD, width: 0.024, opacity: 0.2 })
  line(from, to, { color: GOLD, width: 0.0095, arrow: 'end' })
}
caption('IT\nPOINTS\n*{INWARD}', 2, { at: [0.735, 0.44], size: 0.132, font: 'unbounded', color: '#ffffff', accent: GOLD, fade: 0 })
wait(2)
