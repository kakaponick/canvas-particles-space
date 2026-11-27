// A spinning (Kerr) black hole seen from a camera that flies over it from pole to pole. Over the pole the
// shadow is round and only the lensed sky shows the spin, wound round the hole; from the equator the side
// that rushes toward the camera is flat and the shadow is pushed the other way; over the other pole the sky
// winds the other way. The photon ring is brightest on the side coming toward us, and only as much as that
// side's motion is along the line of sight: Doppler contrast as the sine of the tilt, the bright side at
// 180° from the axis. The frame is square: the hole is an object turned on a stand.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/kerr_around/kerr_around.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/kerr_around/kerr_around.js films/kerr_around/out/kerr_around.mp4
/* global film, set, to, drive, wait, shot, caption, meanwhile */
film({
  size: 'square', fps: 60, seed: 31, preset: 'Kerr',
  settings: {
    blackHoleSize: 11, cameraZoom: 1.5, gridSky: 0.35, starsBrightness: 2, ringGlow: 0.8, ringBrightness: 1.4,
    spinTilt: 4, spinAxis: 0, ringDoppler: 0
  }
})

const FLIGHT = 24
const FROM = 4
const TO = 176
const TURN = 35
const share = s => {
  const u = Math.min(Math.max(s / FLIGHT, 0), 1)
  return u * u * (3 - 2 * u)
}
const tiltAt = s => FROM + (TO - FROM) * share(s)
const axisAt = s => TURN * share(s)
const RADIAN = Math.PI / 180
const note = { at: 'bottom', font: 'noto', size: 0.03, plate: 0.6 }

set({ fade: 1 })

shot('pole', () => {
  caption('a/M = 0,99', 28, { at: [0.06, 0.06], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6' })
  caption('широта #{lat:0}°', 28, {
    at: [0.06, 0.11], align: 'left', font: 'noto', size: 0.026, color: '#c9d4e6',
    values: { lat: s => 90 - tiltAt(s - 3) }
  })
  caption('С полюса тень круглая.\nВращение видно по закрученному небу.', 6, note)
  to({ fade: 0 }, 1.5)
  wait(1.5)
})

shot('flight', () => {
  meanwhile(() => {
    drive({
      spinTilt: s => tiltAt(s),
      spinAxis: s => axisAt(s),
      ringSide: s => Math.PI + axisAt(s) * RADIAN,
      ringDoppler: s => 0.9 * Math.sin(tiltAt(s) * RADIAN)
    }, FLIGHT)
  })
  wait(8.5)
  caption('С экватора край, летящий на нас,\nсплющен и светит ярче', 6.5, note)
  wait(9)
  caption('С другого полюса\nнебо закручено в обратную сторону', 6.5, note)
  wait(6.5)
})

shot('down', () => {
  wait(1.5)
  to({ fade: 1 }, 1.5)
})
