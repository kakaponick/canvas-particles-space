# Gravitational Lensing Particle Simulator

A WebGL2 scene that runs in the browser: particles fly through space, a black hole pulls them in and bends the light behind it (shadow, photon ring, Einstein ring), with orbiting stars, a second black hole and gravitational waves, grids that show curved space, and a camera that zooms. Everything is computed in the visitor's browser. This server only sends files, so there is no HTTP API to call.

## For AI agents

Open the page in a browser you control, with `?agent` in the address:

    https://space.xn--c6t.net/?agent

The page then has `window.space`, and everything is done by running JavaScript in it:

- `space.help()` lists every command.
- `space.describe()` and `space.intro.describe()` list every setting with its range, default and meaning.
- `space.set({ gravityStrength: 5 })`, `space.reset()` and `space.preset.apply('Schwarzschild')` change the scene.
- `space.film.guide()` is the format of a film: the scene as an mp4 on a timeline. Every setting moves along keyframes, layers switch on and off, the opening's events (the flash, the light front, the ringing, the gravitational wave) are fired again at any second, time slows or stops, and captions lie over the picture. `space.film.check(film)` answers with the timeline it understood. A film is one JSON object, or a script: JavaScript text that plays the film forward (`wait`, `to`, `shot`, `caption`), given as a string wherever a film is taken; `space.film.script(text)` returns the JSON it writes.

With no browser of your own, write the calls for the person you work for: they open that address and paste them into the browser's console.

Calls return plain JSON, and a wrong name fails with the closest ones. No key and no sign-in. What you change stays in that browser: other visitors never see it.

The scene needs WebGL2; a film also needs WebCodecs (Chrome or Edge).

## Render a film

In the page it is one call, and everything but `duration` is optional:

    await space.film.render({ duration: 10 }, { download: 'film.mp4' })

The film is put together in the page's memory and saved through the browser's download, so this suits a short film, and an automated browser has to allow downloads.

With a terminal, render on your own machine: it is faster and the file is written straight to the disk. It needs Node 22+, pnpm and Chrome, Chromium or Edge:

    git clone https://github.com/kakaponick/canvas-particles-space.git
    cd canvas-particles-space && pnpm install && pnpm build
    node .claude/skills/space-scene/scripts/space.mjs render film.json out.mp4

`film.json` holds the same object as the call above, and a script in a `.js` file is taken in its place; `space.mjs guide` prints the format and the language.

The repository also has a manual for agents and the same tools as an MCP server: https://github.com/kakaponick/canvas-particles-space
