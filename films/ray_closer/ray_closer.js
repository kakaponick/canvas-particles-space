// The Ray Traced lens as a dolly zoom. Under Ray Traced the Einstein Radius is the camera's distance, and the
// shadow keeps the size Black Hole Size gives it, so moving that one value flies the camera from 190 to 2
// Schwarzschild radii while the lens widens to keep the shadow where it is: the sky behind is drawn into the
// frame until its edge looks almost straight back. The numbers on screen are worked out from the same
// distance the scene is given.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/ray_closer/ray_closer.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/ray_closer/ray_closer.js films/ray_closer/out/ray_closer.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({ fps: 60, seed: 12, preset: 'Schwarzschild', settings: { gridSky: 0.3, starsBrightness: 2.5, starDensity: 0.5 } })

// The Einstein ring in shadow radii for a camera at r Schwarzschild radii, as lens_trace.ts finds it
const RING = [[2, 1.3157], [2.5, 1.3834], [3, 1.4474], [4, 1.5662], [5, 1.6752], [7, 1.8715], [10, 2.1279], [14, 2.4233],
  [20, 2.8029], [30, 3.3332], [45, 3.9898], [70, 4.8808], [100, 5.7623], [140, 6.7538], [190, 7.8118]]
const ringAt = r => {
  let k = 1
  while (k < RING.length - 1 && RING[k][0] < r) k++
  const [r0, e0] = RING[k - 1]
  const [r1, e1] = RING[k]
  const share = Math.log(r / r0) / Math.log(r1 / r0)
  return Math.exp(Math.log(e0) + share * Math.log(e1 / e0))
}
const FAR = 190
const NEAR = 2
const FLIGHT = 21
// The distance along the flight: even in its logarithm, easing out of the start and into the stop
const distance = s => {
  const u = Math.min(Math.max(s / FLIGHT, 0), 1)
  return FAR * Math.pow(NEAR / FAR, u * u * (3 - 2 * u))
}
// The shadow's angular size and the direction the frame's side edge looks in, from the hole's direction:
// the edge is 960 / 86.4 shadow radii away in the stereographic picture
const shadowHalf = r => Math.asin(Math.sqrt(27) / 2 / r * Math.sqrt(1 - 1 / r))
const degrees = a => a * 180 / Math.PI
const edge = r => degrees(2 * Math.atan(960 / 86.4 * Math.tan(shadowHalf(r) / 2)))

set({ fade: 1, lensingRadius: ringAt(FAR) })

shot('far', () => {
  to({ fade: 0 }, 1.5)
  wait(1.5)
})

shot('flight', () => {
  caption('Размер тени не меняется.\nМеняется расстояние до неё.', 6, { at: [0.06, 0.12], align: 'left', font: 'noto', size: 0.034 })
  caption('расстояние   #{r:0} r_{s}\nтень закрывает   #{shadow:0}°\nкрай кадра   #{edge:0}° от дыры', FLIGHT + 4.5, {
    at: [0.06, 0.84], align: 'left', font: 'noto', size: 0.03, color: '#c9d4e6',
    values: { r: s => distance(s), shadow: s => degrees(2 * shadowHalf(distance(s))), edge: s => edge(distance(s)) }
  })
  drive({ lensingRadius: s => ringAt(distance(s)) }, FLIGHT)
})

shot('near', () => {
  caption('Ближе — фотонная сфера, 1,5 r_{s}:\nтам свет ходит по кругу.', 5, { at: [0.94, 0.12], align: 'right', font: 'noto', size: 0.034 })
  wait(4.5)
  to({ fade: 1 }, 1.5)
})

