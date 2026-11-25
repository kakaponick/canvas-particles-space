// The Ray Traced lens up close: a dive to the shadow's edge, where light that circled the hole once and twice
// lies in rings, each e^π ≈ 23 times thinner than the one before. What lights them is the orbiting stars: their
// traces lie right round the hole, so every ring holds a copy of them, as a real hole's rings hold its disc.
// The frame is tall, so at the end the rings stand in it as bands. For a camera 21 Schwarzschild radii away the
// lens puts them at 1.0011 to 1.0273 shadow radii (once round) and 1.00005 to 1.0011 (twice), as lens_trace.ts
// finds them; the drawn photon ring is off, so that only the traced light is there.
//   node .claude/skills/space-scene/scripts/space.mjs preview films/ray_deeper.js out.jpg
//   node .claude/skills/space-scene/scripts/space.mjs render films/ray_deeper.js films/ray_deeper.mp4
/* global film, set, to, wait, shot, caption, together */
const SIZE = 18
film({
  size: 'vertical', fps: 60, seed: 5, preset: 'Schwarzschild', warmup: 8,
  settings: {
    blackHoleSize: SIZE, lensingRadius: 2.85, ringEnabled: false, baseBrightness: 0.3, starsBrightness: 1,
    orbitCount: 40, orbitSize: 2.5, orbitEccentricity: 0.4, orbitTrail: 20, orbitStarSize: 3
  }
})

// The frame's half width in shadow radii, which is how far the camera may pan at a zoom (it stops at the
// edge of the picture, which is nothing at 1)
const HALF = 540 / (SIZE / 100 * 1080)
const reach = zoom => 0.97 * HALF * (1 - 1 / zoom)
// The traces are bright right up to the frame's top, so the words stand on a plate
const note = { at: 'top', font: 'noto', size: 0.032, plate: 0.75 }
const label = { at: 'hole', font: 'noto', size: 0.026, plate: 0.75 }

set({ fade: 1 })

shot('orbits', () => {
  caption('Звёзды кружат вокруг дыры.\nКаждую видно дважды: свет второй\nобогнул дыру с другой стороны', 5, note)
  caption('кольцо Эйнштейна', 5, { ...label, at: 'einstein', angle: 62 })
  to({ fade: 0 }, 1.5)
  wait(3.5)
})

shot('closer', () => {
  caption('Внутри кольца — те же орбиты,\nвывернутые наизнанку', 6.5, note)
  to({ cameraZoom: 3, cameraX: reach(3) * 0.55 }, 5)
  to({ cameraY: 0.35 }, 3.5, 'linear')
})

shot('edge', () => {
  caption('У самого края свет\nделает вокруг дыры полный оборот', 5.5, note)
  together(() => { to({ cameraZoom: 8, cameraX: 1.06 }, 6) }, () => { to({ cameraY: 0 }, 6) })
})

shot('rings', () => {
  caption('один оборот', 6.5, { ...label, radius: 1.014, angle: 14 })
  caption('два оборота:\nв e^{π} ≈ 23 раза тоньше', 6.5, { ...label, radius: 1.0006, angle: -16 })
  wait(6.5)
})

// The camera slides up along the rings, which stand in the tall frame as bands, and the picture goes dark
shot('along', () => {
  together(() => { to({ cameraY: 0.7 }, 4, 'linear') }, () => { wait(2.5); to({ fade: 1 }, 1.5) })
})
