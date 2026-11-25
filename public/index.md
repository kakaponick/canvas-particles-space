# Gravitational Lensing Particle Simulator

A WebGL2 scene that runs in the browser: particles fly through space, a black hole pulls them in and bends the light behind it (shadow, photon ring, Einstein ring), with orbiting stars, a second black hole and gravitational waves, grids that show curved space, and a camera that zooms. Everything is computed in the visitor's browser. This server only sends files, so there is no HTTP API to call.

## For AI agents

Open the page in a browser you control, with `?agent` in the address:

    https://space.xn--c6t.net/?agent

The page then has `window.space`, and everything is done by running JavaScript in it:

- `space.help()` lists every command.
- `space.describe()` and `space.intro.describe()` list every setting with its range, default and meaning.
- `space.set({ gravityStrength: 5 })`, `space.reset()` and `space.preset.apply('Schwarzschild')` change the scene.
- `space.film.guide()` is the format of a film: the scene as an mp4 with keyframes and captions. `await space.film.render(film, { download: 'film.mp4' })` renders one in the page.

With no browser of your own, write the calls for the person you work for: they open that address and paste them into the browser's console.

Calls return plain JSON, and a wrong name fails with the closest ones. No key and no sign-in. What you change stays in that browser: other visitors never see it.

The scene needs WebGL2; a film also needs WebCodecs (Chrome or Edge).

The source, a manual for agents and a local server that renders films faster: https://github.com/kakaponick/canvas-particles-space
