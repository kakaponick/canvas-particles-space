---
name: space-scene
description: The working manual for the black-hole particle scene of this repository, for agents. It maps every knob of the simulation's physics (flight, gravity, capture, the lens, the photon ring, orbiting stars, a second black hole and gravitational waves, the space grids, the camera, the opening) to the three ways an agent reaches it - window.space on the live page, films through the space MCP server, and the code. Use it whenever a task is to set up, change, screenshot or explain the scene from outside its UI, to pick values for a physical effect, to make, edit, preview or render a film or video ("ролик", "видео", "покажи", "настрой сцену"), or to add or rename a setting, an intro parameter, a layer or a preset - also when the request names none of these and only describes a picture or a motion it wants to see.
---

# The space scene, for agents

The scene is a WebGL flight of particles through space around a black hole. Everything it can do is a
number, a switch, a colour or a choice in one of two registries: simulation settings and the parameters of
the opening. An agent reaches all of them, and this skill is how.

## One home for each fact

Do not answer from memory, and do not copy ranges into notes: the scene describes itself, and what it says
is always current.

| You need | Ask |
|---|---|
| A key's range, default, unit, full meaning | `describe` with a filter word: `window.space.describe('lens')` on the page, `space_describe` for films |
| The commands of the live page | `window.space.help()` |
| The film format, the script language and ready recipes | `space_guide`, or `window.space.film.guide()` |
| Which keys belong to one physical effect, how they act on each other, the traps | [references/knobs.md](references/knobs.md) |
| How to make a film that reads well, and what went wrong before | [references/films.md](references/films.md) |
| A zoom into the Mandelbrot set: its format and targets | `space_fractal_guide`, or `window.space.fractal.guide()` |
| The rules for changing the code (frame time, invariants, measuring) | `CLAUDE.md` at the repository root |
| The rules for changing the code of films, reels, captions or the Mandelbrot zoom | `docs/films.md`, `docs/fractal_films.md` |

## From a wish to a knob

A request rarely names a key. It says "make the hole heavier", "show how light bends", "let two of them
merge". Work from the effect:

1. Find the law in [references/knobs.md](references/knobs.md): it is organised by what happens physically,
   and each section lists the keys that take part and what they do to each other.
2. Call `describe` with a word from that section to get the exact ranges and meanings.
3. Set the values, look at the result, adjust. A picture is the only proof: a value that passed the check
   can still show nothing, because another knob gates it (a lens on a black sky, a ring with nothing
   falling in, particles that do not move and so are not drawn).

Every length around the black hole is in black hole radii, so `blackHoleSize` alone scales it and nothing
has to be kept in step.

## Three ways in

Pick by what the task leaves behind.

### A look at the scene as it runs: the live page

`window.space` reads and changes every setting and intro parameter and drives the opening's timeline. It is
loaded in development and on any build opened with `?agent`.

1. Open the page with a browser tool. The `chrome-devtools` MCP server of this repository opens its own
   Chrome with its own profile: `navigate_page` to `http://localhost:5173/` (the dev server, `pnpm dev`)
   or to `https://space.xn--c6t.net/?agent`.
2. `evaluate_script` with `() => window.space.set({ blackHoleSize: 12 })`, and the same way for every
   command `help()` lists. `set` and `intro.set` check every value, move it onto its slider's step and
   report what they moved in `clamped`; an unknown key fails with the closest names.
3. `async () => window.space.frames(60)` lets the change settle; `take_screenshot` shows it.

What trips an agent here:

- `frames` needs a visible tab with the scene running; a paused scene draws nothing and the call says so.
- A paused intro timeline freezes the particle field. After `intro.seek`, play or step before a
  screenshot of the particles at that moment.
- The intro part of `readout()` is live only while the debugger is open: `debug(true)`.
- Setting `blackHoleX` or `blackHoleY` anchors the hole; `blackHoleFollowing: true` hands it back to the
  cursor.
- The page saves its settings in the browser it runs in. In the MCP server's own Chrome that touches
  nobody. To work in the user's own open Chrome instead, the server runs with `--autoConnect` (Chrome 144+,
  after the user turns on remote debugging at `chrome://inspect/#remote-debugging`); changes then land in
  their saved settings, so put back what you changed with `reset` and `intro.reset` unless the change was
  the task.
- If the browser tool reports that its browser is already running, somebody else holds that profile. Leave
  it alone and use a film instead: it needs no shared browser.
- The live scene has a random seed and a cursor. For a picture that must come out the same twice, make a
  film.

### A video, or a picture that repeats: a film

A film is one description: frame and length, a seed, starting settings, and a timeline. On the timeline
any number, switch or colour moves along keyframes, the scene's layers switch on and off, the opening is a
clip, its events (the flash, the fronts, the ringing, the gravitational wave) are fired again at any
second, the scene's own time slows or stops, and shapes (lines and arrows, circles, charts, pictures) and
captions lie over the picture. Everything the intro
debugger does with time and layers, a film does. The same film is the same video on any machine. It plays in a
scene of its own, from the page's defaults, so it never touches the page or anyone's saved settings.

Several films make one video as a reel: a JSON object with `clips`, each a film of the scene or of the fractal
(its JSON, a script, or the path of a film that exists), cut to a stretch and joined by a cut, through black
or by a dissolve. The same tools take it; `films/reel.json` is one.

A film is written one of two ways, and every tool takes either. The JSON object itself suits a film of a
few things. Anything longer is a script: JavaScript that plays the film forward (`wait`, `to`, `shot`,
`caption`, `draw`, `fire`), where no second is written by hand, a part of a film is a function, a path is a
function of time, and the film is as long as what was played. A script comes to the same JSON, so nothing
about the scene is said differently in it.

1. Read both once: `space_guide`.
2. Write the film as a `.js` script or a `.json` file. Films of this project live in `films/`; a throwaway
   goes to a temp folder. Cut a script into shots: a shot is what a viewer would call one picture.
3. `space_check` reads it back in a moment as a timeline, with every mistake at once and the line of each.
4. `space_preview` draws its frames side by side: a frame of each shot when the film has shots (its
   storyboard), or the seconds you ask for. Ask for the seconds where something changes, and look at the
   picture before rendering.
5. `space_render` writes the mp4 and reports what it adjusted. Read that line: a value moved into range is
   a value you got wrong.

If the session has no `space_*` tools, the same five are a script away, run from anywhere in the
repository:

```
node .claude/skills/space-scene/scripts/space.mjs guide
node .claude/skills/space-scene/scripts/space.mjs describe orbit
node .claude/skills/space-scene/scripts/space.mjs check films/language.js
node .claude/skills/space-scene/scripts/space.mjs preview films/language.js out/language.jpg
node .claude/skills/space-scene/scripts/space.mjs preview films/waltz.json out/waltz.jpg 4,12,29.5,31
node .claude/skills/space-scene/scripts/space.mjs render films/waltz.json films/waltz.mp4 high
```

Both the server and the script serve `dist/`, so run `pnpm build` after any change to the page; without it
they draw the old scene and reject keys the code already has.

Read [references/films.md](references/films.md) before writing a film longer than a single shot.

### A zoom into the Mandelbrot set: a fractal film

A request for a Mandelbrot (fractal) zoom, "zooming to infinity", is not the particle scene: it is a fractal
film drawn by its own renderer. Its format, targets and script language are in `space_fractal_guide` (or
`window.space.fractal.guide()`); `space_fractal_check`, `space_fractal_preview` and `space_fractal_render` work
like their film counterparts and take the film as JSON or as a script. A frame depends on its second alone,
so a preview draws only the frames asked for. Pick a named target or a Misiurewicz point (`re`, `im`,
`preperiod`, `period`): only such a point has structure at every depth, and only it can loop. A fall told in
words is a script, as a film's is (`films/mandelbrot_story.js`): `to({ rate: 2 }, 4)` speeds the fall up,
`set({ rate: 0 })` holds it, captions show the depth as `×10^{#{depth:0}}`. `"loop": true` makes a clip that,
played on repeat, falls forever. On the page the same zoom is live behind the ∞ button of the toolbar.
Without the server:

```
node .claude/skills/space-scene/scripts/space.mjs fractal-guide
node .claude/skills/space-scene/scripts/space.mjs fractal-preview films/mandelbrot.json out/mandelbrot.jpg 5,30,59
node .claude/skills/space-scene/scripts/space.mjs fractal-check films/mandelbrot_story.js
node .claude/skills/space-scene/scripts/space.mjs fractal-render films/mandelbrot.json films/mandelbrot.mp4
```

### A new ability: the code

When the effect asked for is not a combination of existing knobs, it is a code change, under the rules of
`CLAUDE.md`. Section 16 of the map lists the numbers still fixed in code and what a knob for each would
take: a film that needs one of them is asking for that knob, so make it and then write the film. A new
effect brings its numbers out the same way (`CLAUDE.md`, "A number that shapes the picture is a knob"). A
knob is described once and everything else follows from that description:

- A numeric simulation setting: a field with its default in `src/store/particle_store.ts`, its key in
  `SIMULATION_SETTING_KEYS` (`src/lib/simulation_presets.ts`), its spec in `SIMULATION_SETTING_SPECS`
  (`src/lib/simulation_specs.ts`: label, range, step, unit, a hint of at most 42 characters, the full
  description). The Settings panel, `window.space`, presets and films all pick it up from there.
- A colour setting: a `'#rrggbb'` string with its default in the store, its key in
  `SIMULATION_SETTING_KEYS`, its spec in `SIMULATION_COLOR_SPECS` (`src/lib/simulation_specs.ts`: label, a
  hint of at most 42 characters, the full description), a `SettingColor` row in
  `src/components/settings_body.tsx`, and `readSceneColor` (`src/lib/scene_color.ts`) where the scene reads
  it. `window.space`, presets, films (a colour moves channel by channel along a track) and scripts pick it
  up from the spec. A colour that replaces a constant of the code gives its spec that constant as `exact`:
  a hex can only round it, and the films made before must keep their bytes.
- A switch or anything else that is neither a slider nor a colour also needs its line in `TOGGLES` or
  `parseSettings` (`src/lib/agent_values.ts`), and in `readTracks` (`src/lib/film.ts`) if a film should
  move it.
- An intro parameter: its default in `DEFAULT_INTRO_PARAMS`, its spec in `INTRO_PARAM_SPECS`
  (`src/lib/intro_params.ts`), its place on a track in `INTRO_TRACKS` (`src/lib/intro_tracks.ts`): in the
  track's `params`, and in its `fine` list too (`FINE`, in the same file) if it is a number that shapes the
  effect and was a constant of the code, which the intro debugger keeps in the track's Fine Tuning group.
  One the title's words are drawn from also goes into `TITLE_DRAWN_KEYS` and into the two places that read
  the title's style (`docs/films.md`).
- A length around the hole is in black hole radii, like the rest.
- Add the key to [references/knobs.md](references/knobs.md), in the section of its law, with what it does
  to its neighbours.

Then prove that agents reach it:

```
node .claude/skills/space-scene/scripts/audit.mjs
```

The audit loads the registries themselves and checks that `set` takes every key, that every slider's
default sits on its range, that the scene reads no setting an agent cannot write, that a film takes every
setting, moves every number, switch and colour along a track and loads every preset, and that the map
names every key and none that is gone. A change to the knobs is done when it prints no problem; `--keys`
lists every key by kind.

## What to report

Say what was set and where the result is (the screenshot, the film's json and mp4 as paths), repeat
anything the scene adjusted, and name what was not looked at. If the picture did not show the effect and a
gating knob had to be raised, say which one: that is what the next request will need. After a code change,
name the numbers it left fixed (its new lines in section 16 of the map) and what a knob for each would take.
