# The live page: window.space

`window.space` reads and changes every setting and intro parameter and drives the opening's timeline. It is
loaded in development and on any build opened with `?agent`; `window.space.help()` lists its commands.

1. Open the page with a browser tool. The `chrome-devtools` MCP server of this repository opens its own headless
   Chrome with a fresh profile each start: `navigate_page` to `http://localhost:5173/` (the dev server, `pnpm dev`)
   or to `https://space.xn--c6t.net/?agent`.
2. `evaluate_script` with `() => window.space.set({ blackHoleSize: 12 })`, and the same way for every
   command `help()` lists. `set` and `intro.set` check every value, move it onto its slider's step and
   report what they moved in `clamped`; an unknown key fails with the closest names.
3. `async () => window.space.frames(60)` lets the change settle; `take_screenshot` shows it. Done when the
   screenshot shows the change the loop predicted (SKILL.md, "The loop").

What the page needs:

- `frames` runs in a visible tab with the scene playing; a paused scene draws nothing and the call says so.
- Setting `blackHoleX` or `blackHoleY` anchors the hole; `blackHoleFollowing: true` hands it back to the
  cursor.
- The page saves its settings in the browser it runs in, which in the MCP server's own Chrome touches
  nobody. To work in the user's own open Chrome, the server runs with `--autoConnect` (Chrome 144+, after
  the user turns on remote debugging at `chrome://inspect/#remote-debugging`); changes then land in their
  saved settings, so put back what you changed with `reset` and `intro.reset` unless the change was the
  task.
- The live scene has a random seed and a cursor. A picture that must come out the same twice is a film.

## In the operator's tab

The operator sees every simulation first (CLAUDE.md, "Working here"): before an agent draws a still, a
preview, a sheet or a render of a film or of a new look, it plays it in the operator's T3 preview tab.

1. A dev server from the agent's own worktree, on a port nobody uses:
   `node node_modules/vite/bin/vite.js --port 5181 --strictPort --host 127.0.0.1`, run in the background.
   It serves that worktree's `src/` and `films/`, so an engine change shows as it is saved.
2. A film not yet in `films/` goes there as `films/_lab_<name>.js`; `films/_lab_*` is in the repository's
   `.git/info/exclude`, so it never joins a commit.
3. `preview_open` (T3) with `target: { kind: 'environment-port', port: 5181, path: '/?live=<film>' }`,
   visible. `?live=` plays that film of `films/` inside the page's own scene, looping: its tracks are
   written into the settings every frame, the operator can still turn the camera, and a reload of the page
   (every save of the code) starts it again. Only settings move: captions, graphics and cues show in the
   film mode, `/?film=<film>`.
4. Then the agent's own stills. An agent without the T3 preview tools gives its coordinator the address and
   waits until the tab shows it.

On the page, `window.space.film.live(film, { from?, loop?, input? })` plays a film, its script or a name in
`films/` the same way, `film.liveTime()` says where it is, and `film.liveStop()` stops it and puts back the
settings from before (`{ keep: true }` leaves the film's).
