// The poster of The Fourth Dimension, take 2, without words: the well of the film's second clip seen from
// straight above (its shots "its depth is not gone" and "a circle inside a circle"), where the well is gone
// and its depth is the rings crowding toward the hole, with matter closing on it from every side. The viewer
// looks down the way the title asks about.
// The niche's posters show a well from the side or a tesseract: none looks down one.
// A still for YouTube (films.md, section 17), staged for 4K: what the scene counts in pixels is twice the film's.
//   node .claude/skills/space-scene/scripts/space.mjs still films/fourth_dimension_poster2.js films/fourth_dimension_poster2.jpg 1.5
/* global film, set, wait */
film({
  size: '4k',
  fps: 30,
  seed: 5,
  warmup: 10,
  settings: {
    blackHoleSize: 17,
    blackHoleX: 0.5,
    blackHoleY: 0.5,
    lensingEnabled: false,
    ringGlow: 1,
    gridSheet: 0.9,
    gridColor: '#7fa8ff',
    gridLine: 3,
    gridTilt: 0,
    gridDepth: 6,
    gridRings: 40,
    gridSpokes: 24,
    gridSpan: 0.6,
    gridFade: 0.3,
    gridRide: 1,
    fieldAtHole: 1,
    // Matter that goes in along the spokes, swung a little so the eye is drawn round and down, in gold
    numParticles: 90000,
    gravityInertia: 0.5,
    orbitalStrength: 30,
    gravityStrength: 8,
    gravityReach: 14,
    gravityDepth: 100,
    baseSpeed: 0,
    speedGlowKnee: 0.02,
    trailIntensity: 0.05,
    depthFade: 0,
    minOpacity: 0.2,
    particleSize: 3.5,
    particleSizeMin: 3.5,
    baseBrightness: 0.7,
    colorPalette: [
      { r: 255, g: 150, b: 30, enabled: true, percent: 75 },
      { r: 255, g: 196, b: 80, enabled: true, percent: 25 }
    ],
    nebula: 1.2,
    nebulaScale: 900,
    nebulaSparseness: 0,
    nebulaEdge: 0.6,
    nebulaContrast: 0,
    nebulaGrain: 0.1,
    nebulaWarp: 1.5,
    // The clouds drift until their one dark gap stands behind the hole, and the haze reaches every edge
    nebulaDrift: 80,
    nebulaDriftAngle: 0,
    nebulaColor: '#2b46d6',
    nebulaColorDeep: '#0f5fa8',
    starsBrightness: 1.8,
    starDensity: 0.25
  }
})
set({ fade: 0, letterbox: 0 })
wait(2)
