# canvas-particles-space

A WebGL particle flight through space, ending in a black hole. React drives only the UI; the scene runs in one requestAnimationFrame loop.

## Working here

- **Work in a worktree of your own**: several agents share this repository, the main checkout included. A task that changes files:
  1. `git worktree add ../canvas-particles-space-<task> -b <branch> master`, then `pnpm install --offline --frozen-lockfile` there (seconds, from pnpm's store).
  2. Build into that worktree's `dist/` and preview films with `node .claude/skills/space-scene/scripts/space.mjs` run from it (the `space` MCP server serves the `dist/` of the checkout the session started in).
  3. Once its checks pass (Checking a change): rebase on master, `git -C <main checkout> merge --ff-only <branch>`, then `pnpm build` in the main checkout, whose `dist/` the `space` server and a local preview show.
  4. Remove it from the main checkout with `node scripts/worktree.mjs drop <worktree>`: it stops the worktree's dev server, takes out `node_modules` without walking its junctions (a removal that walks one empties the folder it points at), then removes the worktree and its merged branch.
- **Friction goes in the log**: `.claude/skills/space-scene/references/friction.md`, in the shape its head gives, committed with the task, whenever the scene, a tool, the machine or the instructions cost you a detour, or the operator sends back a defect you could have caught; its head says what counts. Read it before a film or a change to the scene; a brief for another agent names it.
- **A rented machine waits for the operator's yes.** A Runpod pod (narration, any GPU work) starts only after the operator agrees to that run in the current conversation, with the lines, voices and expected cost named; the film-voice skill says how.
- **Critical and major defects are fixed without asking** (a rented machine excepted): a bug, a broken check, or a reviewer agent's blocker or major, found while a task makes or changes something, is fixed within that task and named in the report. The operator decides only what is not a defect: taste between working options, a push, the task's scope. A question, an audit or a review the operator asked for only reports.
- **The operator sees a simulation first.** Whoever makes or changes a simulation (a film, a lab film, a tracer, a new look of the engine) puts it on the operator's screen with `node scripts/screen.mjs live <film> "<what>" --by "<who>"` from its worktree, before drawing any still, preview, sheet or render; it needs only a shell. `.claude/skills/space-scene/references/live_page.md`, "On the operator's screen", says how. A brief for a subagent that will make a simulation says so.
- **A brief for another agent** points here, at `docs/`, and states only the goal and what is particular to the task; its checks are those Checking a change gives for its kind.
- **A commit message** is a subject line of what changed, then a few short paragraphs: why, and how it was checked, with the numbers that decided something.

## Checking a change

A change owes the checks of its kind, each run once on the finished change; what each prints goes into the commit message.

| The change | Owes |
|---|---|
| Any | `pnpm build` and `pnpm lint`, both clean |
| Adds, renames or removes a setting, an intro parameter, a layer or a preset | the audit, `node .claude/skills/space-scene/scripts/audit.mjs`, printing no problem |
| Touches only `films/` or docs | nothing beyond build and lint |

- **After a rebase on a master that moved**: build, lint and the audit again, then fast-forward at once.
- **Film bytes are compared only at the user's word**: `node scripts/bench.mjs films --against <commit>` tells whether the previews of `films/` moved between two builds, for a user who asks which change moved a picture.
- **Checks take turns across the machine** (`scripts/turn.mjs`): `bench.mjs` and the film server's previews and renders wait for one another, since a build measured beside another agent's Chrome measures that agent. A preview holds the turn for its drawing alone, a second or two; a bench holds it for its whole run, minutes, so start it once the task's previews are done. A wait prints `waiting for ...` and `the turn came after ...`: a slow call is a call in the queue, so read a preview's output unfiltered. A new script that drives Chrome takes the turn too.

## Devices

Current browsers with WebGL2 on desktop-class hardware: one code path, defaults tuned for that hardware. Legacy browsers and weak devices are not supported, and that is a hard rule: no fallback, polyfill, lighter mode, lowered default or feature turned off for them, and no change held back or reshaped by what it would cost on them.

## Earlier films

The scene is built for the film made next: a change takes the laws, the defaults and the look that are right today, and the films in `films/` are drawn by them from then on. The picture a film had before is not kept, and that is a hard rule: no flag, preset, mode or default holds an earlier look, and no change is held back or reshaped by the films it redraws, or counts them as its cost in a plan or a report. A hook holds it (`.claude/hooks/earlier_films.mjs`, whose header says what it reads): an answer, a file's text or a commit message that keeps or prices an earlier look is sent back.

## UX

Every panel reads well at its defaults and still lets the user change layout and look. Judge a UI change by readability, compactness and clarity first.

- **A section's rarely moved settings sit in its Fine Tuning group** (`SettingsFine` in `settings_section.tsx`), closed by default. A knob for a number that was a constant goes there, in the section of its effect; the settings that set an effect stay in the section itself. A track of the intro debugger has the same group: its `fine` list (`INTRO_TRACKS`), drawn by `TrackFine` in `intro_track_list.tsx`.
- **Microcopy is one line**: a control's hint (the spec's `hint`) fits the 340px panel (at most 42 characters) and says what it changes in plain words, with the direction when it is not obvious ("Higher: shorter trails"). The full explanation goes in the spec's `description`, which the agent API reads.
- **A hint lives only in the control's context menu** (`hint_menu.tsx`, one menu for the page): a right-click, Shift+F10, the Menu key or a long press opens it with the control's name, its hint and, where it has a default, a reset. A row offers it through `data-hint`, `data-hint-label` and `data-hint-reset`, and keeps the same text as an `sr-only` line tied to its control with `aria-describedby`. Panels draw no hint lines, help icons or HELP toggle.
- **A panel opens and closes from its button** in the scene toolbar at the top right (`control_panel.tsx`), which never moves or hides and shows the panel open with `aria-expanded` and a solid fill; panels have no close buttons. Opening moves the focus into the panel; Escape closes the panel the focus is in; closing with the focus inside returns it to the button.
- **A slider's label and value sit on a quiet tint** with a solid edge at the value, never on a strong fill or a blend mode. Every value carries its unit, formatted once in the spec (`format` in `simulation_specs.ts`, `unit` in `INTRO_PARAM_SPECS`) and spoken through `aria-valuetext`.
- **What the pointer does to the camera, the keyboard does too.** The scene is a Tab stop with a visible focus edge; while it has the focus, the arrows, plus, minus and Home move the camera through the sliders' own ranges, steps and names (`src/lib/camera_keys.ts`), the status line beside the canvas tells a screen reader where the camera is, and the hints at the bottom show the keys. A new way to move the camera with the pointer gets its key there.
- **Scrolling never changes a value**: the wheel moves a slider only while it has the focus or with Shift or Alt; a finger moves it only after a sideways slop or with a short tap, never one that lands while the panel scrolls.

## Render performance

Frame time is the hard constraint. The **per-frame path** is:
- `renderFrame` in `src/components/particle_canvas.tsx`
- `advance` in `src/lib/scene.ts`
- the field's step: the vertex shader of `src/lib/field_step.ts`, which `src/lib/field_feedback.ts` runs once a frame for every particle
- `render` in `src/lib/particle_renderer.ts`
- the composite fragment shader in `src/lib/webgl_shaders.ts`

The main thread only gathers a frame's numbers: no loop over the particles runs in JavaScript. Per particle the step's shader and its stroke cost, times the particle count (24 000 by default, 200 000 at most); per pixel the composite pass costs.

Two words used here and in `docs/`:
- **Gated**: the code runs only while its uniform or flag is non-zero and costs nothing otherwise; in a shader, `if (u_<effect> > 0.0)` with the uniform 0 while the effect is off.
- **Deterministic**: one seed and one film draw the same bytes every time on one machine. The field is stepped by the graphics card, and another card or driver may round a sine or a square root differently.

### Frame pipeline

1. `renderFrame` reads both stores with `getState()`, applies the frame-rate cap (`nextFrameSlot`), derives `frameScale` from the real elapsed time and hands both stores to the scene as its `SceneInput`; `advance` assembles the frame from that input alone.
2. `render` steps the field on the graphics card: the step's vertex shader reads each particle's record from one buffer and transform feedback writes the next into a second (`FIELD_FLOATS` floats: its state, the clipped stroke it draws this frame and its side of the holes, the light it leaves in the photon ring). The main thread hands over the step's numbers as uniforms and sends up only the newborn, when the field grows.
3. `render` draws the strokes from that buffer as instanced quads into a persistent scene FBO that holds the trails, and the orbits' traces, the lattice and the flows into a layer of lines drawn anew; in 3D, while something can stand in front of the holes, a front FBO and a front layer of lines sit beside them. One full-screen composite pass then does the lens, the intro effects and the title and lays the front layers over the holes; the space sheet is drawn over it while it is on.

### Invariants

- **The scene reads no store, no window and no clock.** `createScene` owns the field, the black hole, the intro frame and the renderer; a frame depends only on its `SceneInput` (settings, intro parameters, hidden layers, reduced motion) with `frameScale` and `dt`. The page keeps the loop, the frame-rate cap, input handling and every store write. Random numbers come from the scene's seeded generator (`src/lib/random.ts`), never `Math.random`, and the step draws its own from the particle's number, the step's number and the seed (`chance` in `field_step.ts`), so one seed and one sequence of inputs draw the same frames, which is what lets a film render the scene in a plain loop.
- **The per-frame path allocates nothing.** `frame`, `settings` and `composite` are created once with the scene, the page's `input` once in the effect, all mutated in place. New per-frame data becomes fields on these objects or preallocated typed arrays; no closure is made per frame.
- **React never renders per frame.** The loop reads stores through `getState()` and writes only when a value changes, throttled: `measuredFps` every 500 ms, the debugger readout every 66 ms and only while the debugger is open. Every `set()` wakes every subscriber, `syncLoop` in the canvas included. A component that shows `readout` or `measuredFps` is a leaf subscribed through a narrow selector (`MeasuredFps`; in the debugger `TimeReadout`, `Ruler`, `Playhead`, `TrackValue`, `SpanBar`, `MarkerButton`); large components (`IntroDebugger`, `IntroTrackList`, `TrackRow`, `ControlPanel`) never subscribe to them.
- **Opening Settings builds nothing.** `SettingsBody` is built once with the page, before the first frame, in a detached element the open panel attaches, since a long task while the scene runs makes the next frame jump. A closed section stays mounted and hidden, every toggle is a leaf bound to its own setting, each slider subscribes to its own setting through `SettingSlider`, and `settings_persistence.ts` writes in idle time.
- **The field is the graphics card's**, and nothing of it is read back. The scene makes a particle only when the field grows (`spawnParticle`, sent up once, `fieldBorn`); after that the step's shader moves it, takes it at a horizon, makes it anew and draws its random numbers (`chance`). A new per-particle value is a float of the record (`FIELD_FLOATS`, `FIELD_VARYINGS` and the offsets in `field_step.ts`, `send` in `field_feedback.ts`). A new numeric step setting is a name in `STEP_KEYS` there, read in the shader as `s_<name>`, with its resting value in `createStepSettings`. What a particle leaves for the rest of the scene goes out as the ring's light does: a value of its record that a pass adds into a texture (`lightRing`).
- **Motion is frame-rate independent.** Per-frame motion is scaled by `frameScale` (relative to 60 Hz, capped at 6), seconds-based motion by `dt`; `src/lib/frame_pacing.ts` treats a one-off stall as a normal frame; trails fade in whole 60 Hz steps (`fadeBacklog`). A particle is a disc sweeping a round-capped capsule over a frame, stamped with the brighter-of-two blend (`MAX`), never added; its brightness comes from its own speed on the screen per 60 Hz frame, worked out in the step (`s_speedGlow` bends it, `s_frameScale` keeps it the same at any refresh rate), and a particle that did not move writes no stroke. Gravity is never scaled by the flight speed, so at Base Speed 0 only the particles gravity moves stay lit.
- **The composite shader is gated effect by effect.** It runs for every device pixel every frame, so each effect sits behind its uniform; after the intro only the lens, the shadow, the ring, the background stars and, in 3D, the front layers (`u_front`) do work. A new effect is gated the same way.
- **Uniforms go through the dirty-checked setters** `setUniform1f` to `setUniform4f` in the renderer. The texture units are fixed: 0 the scene, 1 the title, 2 the photon ring's energy (`ring_energy.ts`), 3 the orbiting stars' traces, 4 a spinning hole's shadow outline (`kerr_shadow.ts`), 5 the light the field leaves in the photon ring (`field_feedback.ts`), 6 the field's trails in front of the holes, 7 the lines in front of them, 8 the traced disc's map of the equator, 9 the bloom's frame and 10 its levels, which they take in turn, 11 the sheet's light front's delay field (`light_front.ts`), 12 the table of the flash's photons (`photon_program.ts`).
- **Every GL resource is created inside `createParticleRenderer`**, so `webglcontextrestored` rebuilds it all; a new texture or buffer belongs there. The field's two buffers grow ×1.5 and carry over what they hold (`reserve` in `field_feedback.ts`); the orbits' rows are refilled with `bufferSubData`. The resolution follows `PIXEL_BUDGET` (4.5 M device pixels), with `MAX_PIXEL_RATIO` 2. A resize is coalesced into one rAF and reallocates only GPU targets, keeping the field, since world coordinates do not depend on the viewport.
- **The loop runs only while it is visible**: `syncLoop` stops it while the scene is paused, the tab is hidden or the WebGL context is lost.
- **The renderer calls WebGL2 directly**; a browser without it gets the message in `particle_canvas.tsx`. The composite pass and the sheet are GLSL ES 1.00, which WebGL2 compiles as it is; the field's step and the passes of the ring's light are GLSL ES 3.00, which transform feedback asks for, and so are the programs that fade and stamp strokes, which write two targets in one draw (their vertex shaders are written as the others are and read as 3.00 through `MODERN_VERTEX`).

### The subsystems

Before a change to one of these, read its section in `docs/scene.md`, which holds the laws its code keeps: Inertia and 3D's step (`stepSpace`, the camera's poses); 3D's places and sky; what stands in front of the holes (the front layers); the lens (Ray Traced, Kerr, Horizon Grid); the zoom and pan; the space grid (Lensed Grid, Sheet, Lattice, Light Front); particles on the sheet; the flows; the traced disc; a second black hole, its merger and waves; the orbiting stars; the bloom. A new thing drawn round the holes, on the sheet or in 3D follows the section it joins.

### Gotchas

- `tsc -b`, inside `pnpm build`, writes stray `vite.config.js`, `vite.config.d.ts` and `*.tsbuildinfo` files into the repo root. Delete them if they appear.

## Driving the scene as an agent

`window.space` (`src/lib/scene_api.ts`) reads and changes every simulation setting and intro parameter and drives the intro timeline. It loads in development, and on a deployed build only with `?agent`, as a chunk other visitors never download. To drive the page or make a film, use the `space-scene` skill.

- **Each fact has one home**: ranges and meanings in the specs (read through `describe`), the page's commands in `help()`, the film format in `FILM_GUIDE`, how to use the knobs in the skill, the rules for the code here and in `docs/`.
- **A new setting** is described once: a slider in `src/lib/simulation_specs.ts` (the Settings panel builds from it), an intro parameter in `INTRO_PARAM_SPECS`; with its default in `particle_store.ts`, its key in `SIMULATION_SETTING_KEYS` and its row in `settings_body.tsx` (a slider sets its own field and needs no setter), the panel, the agent API and films pick it up. A colour is a `'#rrggbb'` string in the store, its key in `SIMULATION_SETTING_KEYS`, its spec in `SIMULATION_COLOR_SPECS`, a `SettingColor` row in the panel, and `readSceneColor` (`src/lib/scene_color.ts`) where the scene reads it. A setting that is neither a slider nor a colour also needs a line in `parseSettings` (`src/lib/agent_values.ts`) and, to move along a film's track, one in `readTracks` (`src/lib/film.ts`).
- **A number that shapes the picture is a knob.** Agents make films from the knobs alone: what a film cannot set, it cannot show. A change that brings a strength, a falloff, a reach, a rate, a share or a colour gives each a spec whose default is the value you would have written into the code; where physics gives the value, the knob is a multiple of it and 1 is the real thing (`frameDrag`). What stays in the code is what frame time, memory or the precision of the arithmetic holds (a step count, the size of a buffer, a floor against a division by zero), with a comment that says so.
- **Every length around the black hole is in black hole radii**, so Black Hole Size alone scales the hole.
- **`public/index.md` is the door for agents from outside the page.** The build puts it into the page's HTML as markup inside `#root`, never as a `<noscript>` (`describePage` in `vite.config.ts` says why); a route in `vercel.json`, not a rewrite (which would give way to the `index.html` at that address), serves it for `Accept: text/markdown`; the page's `Link` header names it as its `service-doc`; the `<meta name="description">` in `index.html` says the same in one sentence. It names commands and leaves every range to `describe()`: change it only when a command it names changes, and the canvas's label (`SCENE_LABEL` in `particle_canvas.tsx`, which names `?agent` and `help()`) with it. Preview deployments are behind Vercel's sign-in: check a change to the routes with the project's bypass secret in an `x-vercel-protection-bypass` header.

## Films

A film is a folder of `films/`, `films/README.md` its layout: `node scripts/films.mjs new` makes one with its `meta.json`, and whoever makes or changes a film adds a line to that record of who made it, its model's id included, in the same commit (`node scripts/films.mjs made <film> --model <id> --agent "<harness>" --did "<what>"`).

Before changing film or fractal code, read its rules, and add a new rule for that code there: `docs/films.md` for films (`src/lib/film*.ts`, `reel*.ts`, `caption_text.ts`, `intro_tracks.ts`, the scene's `fire`, `makeTitle` and `useTitle`, the fonts in `public/fonts` and `index.css`, `mcp/`, `scripts/voice.mjs`), in sections an agent reads by the code it changes: the film and its plan, the film's scene, scripts, reels, over the frame (fade, shapes, captions), encoding and output, the `space` MCP server, narration; `docs/fractal_films.md` for the Mandelbrot zoom, its films and the page's Mandelbrot mode (any `fractal*` file).
