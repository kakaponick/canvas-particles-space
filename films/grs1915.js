// GRS 1915+105, a black hole of about 12 solar masses in Aquila, 28 000 light years away, spinning at
// a/M above 0.98, close to the limit. Its jets leave at about 66° to the line of sight, along position
// angle 151° on the sky, so spinTilt is 66 and spinAxis 151; the ring takes its bright side from the spin
// as the camera sees it (ringSpinFollow), Doppler Contrast 0.9 side-on. Space near the hole turns with
// it: the particles' drag is raised six times over the physical share (frameDrag 6) and a caption says so.
//
// The camera is one path through poses, never at rest: a spline through keyframes of all its axes at once
// (the circle, the head, its move and the zoom), so each move begins before the last one ends. It banks
// into its turns, winds up before the whip back to Earth's view and overshoots it a little, keeps the
// hole off the middle of the frame while it travels, and floats by a fraction of a degree as a hand-held
// camera does. The slow motion falls as it reaches the flattened limb, and the camera goes on moving
// through it.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/grs1915.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/grs1915.js films/grs1915.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile, slow */
film({
  size: '1080p', fps: 60, seed: 1915, preset: 'Kerr', warmup: 5,
  settings: {
    blackHoleSize: 9, blackHoleSpin: 0.98, spinTilt: 66, spinAxis: 151, ringSide: 5.8,
    ringDoppler: 0.9, ringSpinFollow: 1, ringBrightness: 1.5, ringGlow: 0.7, frameDrag: 6, gravityInertia: 0.85,
    gravityStrength: 4, gravityDepth: 40, starsBrightness: 1.8, threeD: true, threeDEase: 0
  }
})

// The camera's poses: second, then orbit angle, elevation, roll, look aside, look up (degrees), move right,
// up and in (hole radii) and zoom. It circles about 9.9 radii from the hole
const KEYS = [
  [0, -20, 4, -5, 22, -3, 0, 0, -4, 1.2],
  [6, -8, 9, -2, 12, -1, 0.5, 0.3, 0, 1.25],
  [12, 15, 18, 2, 4, 0, 0.6, 0.6, 2.5, 1.3],
  [19, 70, 60, 4, -14, 6, 0, 0, 2.5, 1.25],
  [26, 120, 10, -3, 12, -4, -0.8, 0, 0.5, 1.2],
  [32, 150, -40, 0, -6, 5, 0, -0.5, 2, 1.25],
  // the wind-up, the whip back to Earth's view, the overshoot and the settle
  [34, 156, -38, 2, -4, 4, 0, -0.4, 2, 1.25],
  [37, 0, 2, 0, 0, 0, 0, 0, 2, 1.2],
  [39, -5, -1, 0, 0, 0, 0, 0, 2, 1.2],
  [41, 0, 0, 0, 0, 0, 0, 0, 2, 1.2],
  // in to the flattened limb, down and to the right of the hole, and on through the slow motion
  [45, 0, 0, 3, 2, -1, 0.7, -0.35, 5.5, 1.35],
  [50, 2, 1, 4, 3, -1.5, 0.9, -0.45, 6.6, 1.45],
  [53, 4, 5, 6, 1, 0, 0.6, -0.2, 3, 1.3],
  [60, 10, 25, 14, 0, 0, 0, 0, -20, 1.1]
]
const AXES = ['cameraYaw', 'cameraPitch', 'cameraRoll', 'cameraLookYaw', 'cameraLookPitch', 'cameraMoveRight', 'cameraMoveUp', 'cameraMoveIn', 'cameraZoom']

// A cubic through the keys with the slope of its neighbours at each (Catmull-Rom on uneven seconds), so
// the camera passes every pose moving and never stops on one
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

// A hand on the camera: slow, small and never repeating within the film
const float = (s, size, rate, phase) => size * (Math.sin(rate * s + phase) + 0.5 * Math.sin(2.3 * rate * s + 2 * phase))
// Degrees of bank for each degree a second the camera swings round the hole
const BANK = 0.1

const camera = {}
AXES.forEach((key, i) => { camera[key] = s => path(i + 1, s) })
camera.cameraRoll = s => path(3, s) + BANK * (path(1, s + 0.05) - path(1, s - 0.05)) * 10 + float(s, 0.5, 0.6, 1)
camera.cameraLookYaw = s => path(4, s) + float(s, 0.35, 0.45, 2)
camera.cameraLookPitch = s => path(5, s) + float(s, 0.25, 0.7, 0.5)

const fact = { at: [0.04, 0.07], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' }
const note = { at: 'bottom', font: 'noto', size: 0.032, plate: 0.5 }

set({ fade: 1 })
meanwhile(() => { drive(camera, 60) })

shot('vortex', () => {
  caption('GRS 1915+105 · созвездие Орла\n28 000 световых лет · 12 масс Солнца', 12, fact)
  to({ fade: 0 }, 2.5, 'out')
  caption('Спин выше 0,98: дыра вращается почти\nна пределе, и пространство вращается с ней', 8, note)
  wait(9.5)
})

shot('over and under', () => {
  wait(4)
  caption('Сбоку видно: частицы уносит вокруг оси.\nЗакрутка здесь усилена в 6 раз', 7, note)
  wait(16)
})

shot('whip back', () => {
  wait(9)
})

shot('the flat limb', () => {
  caption('Край, летящий к нам, сплющен и ярче:\nсвет огибает дыру вслед за её вращением', 9, note)
  wait(4)
  slow(0.25, () => { wait(5) })
  wait(3)
})

shot('away', () => {
  wait(4)
  to({ fade: 1 }, 3, 'in')
})
