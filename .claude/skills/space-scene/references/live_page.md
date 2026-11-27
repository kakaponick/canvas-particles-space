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

## In the operator's browser

The operator sees every simulation first (CLAUDE.md, "Working here"): before an agent draws a still, a
preview, a sheet or a render of a film or of a new look, it opens it in the operator's own browser. A shell
is all it takes; no browser tool of the agent's.

1. A dev server from the agent's own worktree, on a port nobody uses:
   `node node_modules/vite/bin/vite.js --port 5181 --strictPort --host 127.0.0.1`, run in the background.
   It serves that worktree's `src/` and `films/`, so an engine change shows as it is saved.
2. A film not yet in `films/` goes there as `films/_lab_<name>.js`; `films/_lab_*` is in the repository's
   `.git/info/exclude`, so it never joins a commit.
3. Open `http://127.0.0.1:5181/?live=<film>` in the operator's default browser:
   `Start-Process 'http://127.0.0.1:5181/?live=<film>'` in PowerShell, or
   `powershell -NoProfile -Command "Start-Process 'http://127.0.0.1:5181/?live=<film>'"` from Git Bash.
   `?live=` plays that film of `films/` inside the page's own scene, looping: its tracks are written into
   the settings every frame, the operator can still turn the camera, and a reload of the page (every save
   of the code) starts it again. Only settings move: captions, graphics and cues show in the film mode,
   `/?film=<film>`. A later change to the same film needs no new tab: the page reloads itself on save.
4. Then the agent's own stills. The report names the address, and the server stays up while the
   operator may still be watching; the agent stops it when its task ends.

On the page, `window.space.film.live(film, { from?, loop?, input? })` plays a film, its script or a name in
`films/` the same way, `film.liveTime()` says where it is, and `film.liveStop()` stops it and puts back the
settings from before (`{ keep: true }` leaves the film's).
