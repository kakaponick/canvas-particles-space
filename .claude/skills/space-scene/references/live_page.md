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
one page, `http://127.0.0.1:5199/`, that the operator keeps open in T3 Code's own browser. It shows what an
agent last put on it under one line from the left edge, read as a sentence: what is shown, who showed it,
how long ago, and master or the branch it comes from (the film and the exact time on hover); the clock
button at the left lists what was shown before, to go back to. A show from a worktree that is gone (or
whose port now serves another worktree) plays from the main checkout's dev server if master has its film,
which the screen starts when needed, and is marked "удалено" otherwise; so a `_lab_` film can be gone back
to only while its worktree lives. Each `live` call starts the worktree's dev server afresh on its port (a few
seconds), since Vite can miss files a rebase, a checkout or a stash rewrites and serve a stale module that
leaves the page black; after such a git step, call `live` again rather than trust the page's reload. A shell is all an agent needs; no browser tool of its own.

1. A film not yet in `films/` goes there as `films/_lab_<name>.js`; `films/_lab_*` is in `.gitignore`, so it
   never joins a commit. A film of the library is named by its folder (`kerr_around`) or its path in `films/`
   (`fourth_dimension/clips/02_well.js`).
2. From the worktree, rebased on master (the operator sees the worktree's whole page, toolbar and all, and
   the script refuses a branch behind master):
   `node scripts/screen.mjs live <film> "<what>" --by "<who>"`, both in the operator's language: what as
   the clip and the change ("клип 6: лампа и стена"), who as the agent's job, not its folder ("фиксер
   клипов 5–8"). It starts
   that worktree's dev server once (a port from 5200 up, detached; later calls reuse it), starts the screen
   if it is not up, and shows `?live=<film>` there. Master moves every half hour or so: before each call,
   stash, `git rebase master`, `git stash pop`, and `pnpm build` when `src/` moved.
3. Then the agent's own stills, chained after the screen with `&&`, never `;`, so none renders while the
   screen still shows the last clip. The report says what it put on the screen.
4. The dev server runs until the worktree goes; `node scripts/worktree.mjs drop` stops it.
   `node scripts/screen.mjs status` lists what the screen shows and the servers it knows.

`?live=` plays that film of `films/` inside the page's own scene, looping: each frame its tracks move the
settings and layers, and its graphics, captions and fade are drawn over the frame, so the operator sees what
the film shows and can still turn the camera. A save of the code or the film reloads the page and starts it
again, so a change to the same film needs no second call. Not live: the film's own frame (captions stand in
shares of the page, so a page of another shape than the film's places them a little differently), its pace
and its cues; the film mode (`/?film=<film>`, through `screen.mjs show`) plays those as the render will.

The page drives its film by the browser's frames, so a hidden tab holds it still; it runs on as soon as the
operator looks.

On the page, `window.space.film.live(film, { from?, loop?, input? })` plays a film, its script or a name in
`films/` the same way, `film.liveTime()` says where it is, and `film.liveStop()` stops it and puts back the
settings from before (`{ keep: true }` leaves the film's).
