# The live page: window.space

`window.space` reads and changes every setting and intro parameter and drives the opening's timeline. It is
loaded in development and on any build opened with `?agent`; `window.space.help()` lists its commands.

1. Open the page with a browser tool. The `chrome-devtools` MCP server of this repository opens its own headless
   Chrome with its own profile: `navigate_page` to `http://localhost:5173/` (the dev server, `pnpm dev`)
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
- When the browser tool reports that its browser is already running, somebody else holds that profile:
  make a film instead, which needs no shared browser.
- The live scene has a random seed and a cursor. A picture that must come out the same twice is a film.
