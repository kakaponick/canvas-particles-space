// Frame dragging in the particle field, in 15 seconds: the space near a spinning hole carries what falls
// in round with it. The hole stands still first and the particles fall straight; then it spins up with its
// axis at the camera and their trails lean into a spiral; then the axis turns away from the camera and the
// spiral is the mirrored one. The lens is off and the field does not fly, so the only motion on screen is
// what gravity and the spin do; the camera is zoomed in, since the drag shows within a few radii.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/frame_drag/frame_drag.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/frame_drag/frame_drag.js films/frame_drag/out/frame_drag.mp4
/* global film, set, to, drive, wait, shot, caption */
film({
  size: '1080p', fps: 60, seed: 5, preset: 'Kerr',
  settings: {
    blackHoleSpin: 0, spinTilt: 2, spinAxis: 0, orbitalStrength: 0, baseSpeed: 0, trailIntensity: 0.03,
    gravityReach: 8, starsBrightness: 0, lensingRadius: 0, lensingTraced: false, cameraZoom: 4,
    ringDoppler: 0
  }
})

const SPIN_AT = 3.7
const SPIN_UP = 2
const spinAt = s => {
  const u = Math.min(Math.max(s / SPIN_UP, 0), 1)
  return 0.99 * u * u * (3 - 2 * u)
}
const note = { at: 'bottom', font: 'noto', size: 0.034, plate: 0.6 }
const label = { at: [0.05, 0.07], align: 'left', font: 'noto', size: 0.028, color: '#c9d4e6' }

set({ fade: 1 })

shot('still', () => {
  caption('a/M = #{spin:2}', 15, { ...label, values: { spin: s => spinAt(s - SPIN_AT) } })
  caption('Дыра не вращается:\nчастицы падают прямо', 3.4, note)
  to({ fade: 0 }, 0.8)
  wait(2.9)
})

shot('spin', () => {
  caption('Дыра вращается:\nпространство уносит их по кругу', 5, note)
  drive({ blackHoleSpin: s => spinAt(s) }, SPIN_UP)
  wait(3.2)
})

shot('turned', () => {
  caption('Ось отвернулась от нас:\nспираль закручена в другую сторону', 5.6, note)
  to({ spinTilt: 178 }, 2.5)
  wait(2.8)
  to({ fade: 1 }, 0.8)
})
