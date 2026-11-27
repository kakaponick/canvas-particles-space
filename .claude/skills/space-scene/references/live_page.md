# The live page: window.space

`window.space` reads and changes every setting and intro parameter and drives the opening's timeline. It is
loaded in development and on any build opened with `?agent`; `window.space.help()` lists its commands.

1. Open the page with a browser tool. The `chrome-devtools` MCP server of this repository opens its own headless
   Chrome with a fresh profile each start: `navigate_page` to `http://localhost:5173/` (the dev server, `pnpm dev`; it opens with the opening already
   over, and `?intro` in the address plays it)
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

## On the operator's screen

The operator sees every simulation first (CLAUDE.md, "Working here"): before an agent draws a still, a
preview, a sheet or a render of a film or of a new look, it puts it on the operator's screen. The screen is
one page, `http://127.0.0.1:5199/`, that the operator keeps open in T3 Code's own browser; it shows what an
agent last put on it, with a bar naming what it shows, the worktree and when, and a list to go back to the
last few. A shell is all an agent needs; no browser tool of its own.

1. A film not yet in `films/` goes there as `films/_lab_<name>.js`; `films/_lab_*` is in the repository's
   `.git/info/exclude`, so it never joins a commit.
2. From the worktree: `node scripts/screen.mjs live <film> "<what it shows>"`. It starts that worktree's
   dev server once (a port from 5200 up, detached; later calls reuse it), starts the screen if it is not
   up, and shows `?live=<film>` there. `?live=` plays that film of `films/` inside the page's own scene,
   looping: its tracks are written into the settings every frame, the operator can still turn the camera,
   and a save of the code or the film reloads the page and starts it again, so a change to the same film
   needs no second call. Only settings move: captions, graphics and cues show in the film mode; to show
   that, `node scripts/screen.mjs show http://127.0.0.1:<port>/?film=<film> "<what>"`.
3. Then the agent's own stills. The report says what it put on the screen.
4. The dev server runs until the worktree goes: `node scripts/screen.mjs stop` from the worktree before it
   is removed. `node scripts/screen.mjs status` lists what the screen shows and the servers it knows.

The page drives its film by the browser's frames, so a hidden tab holds it still; it runs on as soon as the
operator looks.

On the page, `window.space.film.live(film, { from?, loop?, input? })` plays a film, its script or a name in
`films/` the same way, `film.liveTime()` says where it is, and `film.liveStop()` stops it and puts back the
settings from before (`{ keep: true }` leaves the film's).
