// The poster of The Fourth Dimension, take 1, for the title "Where Is the 4th Dimension? A Hypothesis About
// Gravity": the well of the film's second clip seen from the side (its shot "down into what?"), matter going
// down its wall to the hole, and what the film ends on, said to the viewer. The title asks where; the picture
// shows a way down and the words say who is on it.
// The niche's posters are tesseracts, faces and shallow cyan grids: this one is a deep well in gold on blue.
// A still for YouTube (films.md, section 17), staged for 4K: what the scene counts in pixels is twice the film's.
//   node .claude/skills/space-scene/scripts/space.mjs still films/fourth_dimension/posters/poster.js films/fourth_dimension_poster.jpg 1.5
/* global film, set, caption, wait */
const GOLD = '#ffc61a'

film({
  size: '4k',
  fps: 30,
  seed: 5,
  warmup: 10,
  settings: {
    // The well on the left half, the hole a quarter of the frame's height at its foot
    blackHoleSize: 12.5,
    blackHoleX: 0.28,
    blackHoleY: 0.74,
    lensingEnabled: false,
    ringGlow: 0.8,
    gridSheet: 0.6,
    gridColor: '#7fa8ff',
    gridLine: 2.5,
    gridTilt: 66,
    gridDepth: 6,
    gridRings: 40,
    gridSpokes: 24,
    // A disc of space round the well: the half the words stand on is sky
    gridSpan: 0.3,
    gridFade: 0.45,
    gridRide: 1,
    fieldAtHole: 1,
    // The film's matter on the sheet, which drains down the wall of the well, in gold
    numParticles: 60000,
    gravityInertia: 0.75,
    orbitalStrength: 80,
    gravityStrength: 6,
    gravityReach: 16,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.06,
    trailIntensity: 0.3,
    depthFade: 0,
    minOpacity: 0.12,
    particleSize: 4,
    particleSizeMin: 4,
    baseBrightness: 0.9,
    colorPalette: [
      { r: 255, g: 176, b: 48, enabled: true, percent: 70 },
      { r: 255, g: 214, b: 120, enabled: true, percent: 18 },
      { r: 255, g: 120, b: 30, enabled: true, percent: 12 }
    ],
    // The sky reaches every edge
    nebula: 1.2,
    nebulaScale: 900,
    nebulaSparseness: 0,
    nebulaEdge: 0.6,
    nebulaContrast: 0,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    // The clouds drift until their one dark gap stands behind the well, where it sets the gold off, and the
    // haze reaches every edge
    nebulaDrift: 46,
    nebulaDriftAngle: -25,
    nebulaColor: '#2b46d6',
    nebulaColorDeep: '#0f5fa8',
    starsBrightness: 1.8,
    starDensity: 0.25
  }
})
set({ fade: 0, letterbox: 0 })
caption('YOU’RE\n*{FALLING}\nINTO IT', 2, { at: [0.715, 0.42], size: 0.132, font: 'unbounded', color: '#ffffff', accent: GOLD, fade: 0 })
wait(2)
