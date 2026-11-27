// GRS 1915+105, a black hole of about 12 solar masses in Aquila, 28 000 light years away, spinning at
// a/M above 0.98. In its "rho" state its X-rays beat about once every 50 seconds, a light curve astronomers
// call the heartbeat (RXTE; Neilsen, Remillard and Lee 2011): the inner disk fills with light until
// radiation pressure tips it over, empties into the hole within seconds, and begins to fill again. The
// film is one such beat in real time. The ring brightens and the vortex thickens while the camera closes
// in by a few radii; at the beat the inner ring falls through the horizon, the ring flares, the flash
// runs out across the stars and throws the camera back; then the quiet, and the next rise, cut off by the
// end. The light curve in the corner is drawn in step: a schematic of the rho class, said so on screen.
// The hole: spinTilt 66 and spinAxis 151 from its jets, the ring's bright side from the spin as seen
// (ringSpinFollow), the particles' drag six times the physical share.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/grs1915/grs1915.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/grs1915/grs1915.js films/grs1915/out/grs1915.mp4
/* global film, set, to, drive, wait, shot, caption, draw, fire, meanwhile, slow, at */
film({
  size: '1080p', fps: 60, seed: 1915, preset: 'Kerr', warmup: 6,
  settings: {
    blackHoleSize: 9, blackHoleSpin: 0.98, spinTilt: 66, spinAxis: 151, ringSide: 5.8,
    ringDoppler: 0.9, ringSpinFollow: 1, ringBrightness: 0.5, ringGlow: 0.2, ringBase: 0.3,
    frameDrag: 6, gravityInertia: 0.85, gravityStrength: 2, gravityDepth: 40, starsBrightness: 1.6,
    threeD: true, threeDEase: 0
  }
})

// The beat, in film seconds: the inner disk lets go, and is empty a second and a half later
const BEAT = 45
const EMPTY = BEAT + 1.5

// The camera, one path through poses that never stops (see the Catmull-Rom below): second, then orbit
// angle, elevation, roll, look aside, look up (degrees), move right, up and in (hole radii) and zoom.
// It creeps in through the rise, is thrown back by the beat, and drifts in the quiet after
const KEYS = [
  [0, -30, 6, -3, 10, -2, 0, 0, -3, 1.15],
  [15, -12, 12, -1, 6, -1, 0.3, 0.2, -1, 1.2],
  [30, 5, 18, 1, 3, 0, 0.4, 0.3, 1.5, 1.25],
  [BEAT, 18, 22, 2, 1, 0, 0.3, 0.2, 4, 1.32],
  [BEAT + 0.6, 21, 24, 9, -2, 2, 0, 0, -1, 1.25],
  [BEAT + 2.5, 24, 20, 4, -4, 1, -0.2, 0, -3, 1.18],
  [54, 30, 14, 0, -2, 0, -0.3, 0, -2.5, 1.15],
  [60, 36, 12, -1, 2, -1, -0.2, 0.1, -1.5, 1.17]
]
const AXES = ['cameraYaw', 'cameraPitch', 'cameraRoll', 'cameraLookYaw', 'cameraLookPitch', 'cameraMoveRight', 'cameraMoveUp', 'cameraMoveIn', 'cameraZoom']
function path (axis, s) {
  const k = Math.max(0, KEYS.findIndex((key, i) => i < KEYS.length - 1 && s <= KEYS[i + 1][0]))
  const a = KEYS[k]
  const b = KEYS[k + 1] ?? a
  const before = KEYS[k - 1] ?? a
  const after = KEYS[k + 2] ?? b
  const span = Math.max(b[0] - a[0], 1e-6)
  const u = Math.min(Math.max((s - a[0]) / span, 0), 1)
  const slopeA = (b[axis] - before[axis]) / Math.max(b[0] - before[0], 1e-6) * span
  const slopeB = (after[axis] - a[axis]) / Math.max(after[0] - a[0], 1e-6) * span
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * a[axis] + (u3 - 2 * u2 + u) * slopeA + (-2 * u3 + 3 * u2) * b[axis] + (u3 - u2) * slopeB
}
const float = (s, size, rate, phase) => size * (Math.sin(rate * s + phase) + 0.5 * Math.sin(2.3 * rate * s + 2 * phase))
const camera = {}
AXES.forEach((key, i) => { camera[key] = s => path(i + 1, s) })
camera.cameraRoll = s => path(3, s) + float(s, 0.4, 0.6, 1)
camera.cameraLookYaw = s => path(4, s) + float(s, 0.3, 0.45, 2)
camera.cameraLookPitch = s => path(5, s) + float(s, 0.2, 0.7, 0.5)

// The rho light curve as a schematic, X-rays against seconds: low after a beat, a long rise that steepens,
// a small dip, the spike, the fall to nothing, and the next rise
const rise = (s, from, to) => {
  const u = Math.min(Math.max((s - from) / (to - from), 0), 1)
  return 0.12 + 0.43 * u * u
}
const curve = []
for (let s = 0; s <= 60; s += 0.25) {
  let y
  if (s < BEAT - 1.2) y = rise(s, -2, BEAT - 1.2)
  else if (s < BEAT - 0.3) y = 0.55 - 0.12 * Math.sin(Math.PI * (s - BEAT + 1.2) / 0.9)
  else if (s < BEAT + 0.4) y = 0.55 + 0.45 * Math.sin(0.5 * Math.PI * (s - BEAT + 0.3) / 0.7)
  else if (s < EMPTY) y = 1 - 0.95 * (s - BEAT - 0.4) / (EMPTY - BEAT - 0.4)
  else y = rise(s, EMPTY, EMPTY + 50)
  curve.push([s, y])
}

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: [0.05, 0.86], align: 'left', width: 0.5, font: 'noto', size: 0.03, plate: 0.5 }

meanwhile(() => { drive(camera, 60) })
// The plot of the light curve, drawn up to the film's second
draw({
  kind: 'plot', box: [0.66, 0.74, 0.3, 0.18], x: [0, 60], y: [0, 1], points: curve, plate: 0.5,
  upTo: 'seconds', marker: 'seconds', xLabel: 't, с', yLabel: 'рентген', labelSize: 0.018, color: '#9fd0ff'
}, 60)
caption('схема ρ-состояния по RXTE', 60, { at: [0.81, 0.71], font: 'noto', size: 0.018, color: '#8a96a8' })

set({ fade: 1 })

shot('the quiet after a beat', () => {
  caption('GRS 1915+105 · созвездие Орла\n28 000 световых лет · 12 масс Солнца', 14, fact)
  to({ fade: 0 }, 3, 'out')
  wait(3)
  caption('В «ρ-состоянии» её рентгеновский свет\nбьётся раз в 50 секунд. Это одна минута', 8, note)
  wait(8)
})

shot('filling', () => {
  // The inner ring fills: more of the stream is held round the hole and the ring burns brighter, slowly
  // and then faster
  to({ ringBase: 1.6, ringBrightness: 1.6, ringGlow: 0.9, gravityStrength: 4.5 }, BEAT - 14, u => u * u)
  at(24, () => caption('Внутренний диск копит свет, пока давление\nизлучения не сделает его неустойчивым', 9, note))
})

shot('the beat', () => {
  fire('light', 'echo', 'camera', {
    lightPower: 2, echoPower: 0.5, cameraKick: 0.06, starFlare: 6, starFlareDecay: 0.8, lightCrossTime: 2.5
  })
  slow(0.3, () => {
    to({ horizonScale: 2.6, ringBrightness: 4, ringGlow: 1.8 }, 0.5, 'in')
    to({ horizonScale: 1, ringBrightness: 0.6, ringGlow: 0.25, ringBase: 0.25, gravityStrength: 2 }, 1, 'out')
    wait(1)
  }, 0.4)
})

shot('empty', () => {
  caption('За секунды внутренняя часть диска уходит\nпод горизонт. И он начинает копить снова', 8, note)
  to({ ringBase: 0.5, ringBrightness: 0.75, ringGlow: 0.3, gravityStrength: 2.6 }, 60 - BEAT - 2.5, u => u * u)
})
