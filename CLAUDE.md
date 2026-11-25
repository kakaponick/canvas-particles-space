# canvas-particles-space

A WebGL particle flight through space, ending in a black hole. React only drives the UI. The scene itself runs in one requestAnimationFrame loop.

## Devices

Write for current browsers with WebGL2 on desktop-class hardware: one code path, defaults tuned for that hardware, and frame time judged by Measuring on the development machine. Legacy browsers and weak devices are not supported, and that is a hard rule: no fallback, polyfill, lighter mode, lowered default or feature turned off for them, and no change is held back or reshaped by what it would cost on them.

## UX

Every panel reads well at its defaults and still lets the user change layout and look. Judge every UI change by readability, compactness and clarity first.

- **Microcopy is one short line.** A control's hint fits one line of the 340px panel (at most 42 characters): what the control changes, in plain words, with the direction when it is not obvious ("Higher: shorter trails"). The full explanation goes in the spec's `description`, which the agent API reads; the context menu shows the spec's `hint`.
- **A hint lives in the control's context menu** (`hint_menu.tsx`, one menu for the page), the one place a panel shows it: a right-click, Shift+F10 or the Menu key, or a long press on touch opens it with the control's name, its hint and, where it has a default, a reset to it. A row offers its hint through `data-hint`, `data-hint-label` and `data-hint-reset`, and keeps the same text as an `sr-only` line tied to its control with `aria-describedby`, so screen readers always read it. Panels draw no hint lines, help icons or HELP toggle.
- **A panel opens and closes from one place**: its button in the scene toolbar at the top right (`control_panel.tsx`), which never moves or hides and shows the panel open with `aria-expanded` and a solid fill; panels have no close buttons of their own. Opening moves the focus into the panel; Escape closes the panel the focus is in; closing with the focus inside returns it to the panel's button.
- **A slider's label and value sit on a quiet tint** with a solid edge at the value, never on a strong fill or a blend mode. Every value carries its unit, formatted once in the spec (`format` in `simulation_specs.ts`, `unit` in `INTRO_PARAM_SPECS`) and spoken through `aria-valuetext`.
- **Scrolling never changes a value**: the wheel moves a slider only while it has the focus or with Shift or Alt, and a finger moves it only after a sideways slop or with a short tap, never one that lands while the panel scrolls.

## Render performance

The hard constraint in this project is frame time. Any change that touches the **per-frame path** has to keep it lean. The per-frame path is:
- `renderFrame` in `src/components/particle_canvas.tsx`
- `advance` in `src/lib/scene.ts`
- `stepParticles` in `src/lib/particle_simulation.ts`
- `render` in `src/lib/particle_renderer.ts`
- the composite fragment shader in `src/lib/webgl_shaders.ts`

The bottleneck is the **main thread**, not the GPU, and most of it is the `stepParticles` **hot loop**: any per-particle cost is multiplied by the particle count, 24 000 by default.

Two words used here and in `docs/`:
- **Gated**: the code runs only while its uniform or flag is non-zero and costs nothing otherwise; in a shader, `if (u_<effect> > 0.0)` with the uniform 0 while the effect is off.
- **Bit-identical**: the same bytes as the reference it is held to (a film that does not use a change, on the build before it; a film stepped by the crew, against the plain loop), checked by comparing film previews.

### Frame pipeline

1. `renderFrame` reads both stores with `getState()`, applies the frame-rate cap through the `nextFrameSlot` scheduler, derives `frameScale` from the real elapsed time and hands both stores to the scene as its `SceneInput`. `advance` assembles the frame from that input alone.
2. `stepParticles` advances a struct-of-arrays field (Float32Array per property) and writes clipped segments into one interleaved instance array: 7 floats per segment, with the colour stored as a packed Uint32.
3. `render` uploads the instances with a single `bufferSubData` (a film's crew leaves its pieces as runs, which go up one after another) and draws instanced quads into a persistent scene FBO that holds the trails. It then runs one full-screen composite pass for the lens, the intro effects and the title, and draws the space sheet over it while that is on.

### Invariants

- **The scene reads no store, no window and no clock.** `createScene` owns the field, the black hole, the intro frame and the renderer; a frame depends only on its `SceneInput` (settings, intro parameters, hidden layers, reduced motion, particle count) with `frameScale` and `dt`. The page keeps the loop, the frame-rate cap, the particle budget, input handling and every store write. Random numbers come from the scene's seeded generator (`src/lib/random.ts`), never `Math.random`, so one seed and one sequence of inputs draw the same frames, which is what lets a film render the scene in a plain loop.
- **The per-frame path allocates nothing.** `frame`, `settings`, `instances` and `composite` are created once with the scene, the page's `input` once in the effect, and all are mutated in place. New per-frame data becomes fields on these objects or preallocated typed arrays, and no closure is made per frame.
- **React never renders per frame.** The loop reads stores through `getState()`. It writes to a store only when a value changes, and only at a throttled rate:
  - `measuredFps`: every 500 ms;
  - `activeParticles`: when the budget changes it;
  - the debugger readout: every 66 ms, and only while the debugger is open.

  Every `set()` also wakes every subscriber, including `syncLoop` in the canvas.
- **Fast-changing values stay in leaf components.** A component that shows `readout`, `measuredFps` or `activeParticles` subscribes to just that value through a narrow selector (`MeasuredFps`; in the debugger `TimeReadout`, `Ruler`, `Playhead`, `TrackValue`, `SpanBar`, `MarkerButton`). Large components (`IntroDebugger`, `IntroTrackList`, `TrackRow`, `ControlPanel`) never subscribe to them.
- **The hot loop rejects cheaply before it computes.** It compares squared distances first, since the event horizon captures particles at any depth, then tests the depth band `holeDepthNear..holeDepthFar`, and only then does the gravity math. It uses polynomial falloffs instead of `Math.exp` or `Math.pow`, at most one `Math.sqrt` per particle on the gravity path (one more within reach of a second black hole), multiplications by precomputed reciprocals, and loop-invariant values hoisted above the loop. Respawning goes through `spawnParticle`, a captured particle through `respawnBeyondHorizon`. A spinning hole captures on the circle that fits its shadow's outline (`captureX`, `captureY`) and drags the particles it pulls round with the space near it (`spinRight`, `spinUp`, `spinToward`, as a share of the pull); without spin each costs one predictable branch.
- **What reaches beyond one particle goes through `StepLater`.** A film steps the field on several cores (`src/lib/particle_crew.ts`) and replays the respawns and the ring's light on the main thread in particle order (`StepLater`, `settleLater` in `particle_simulation.ts`), so a new random draw, sum or counter in the hot loop goes through `StepLater`. A new numeric step setting goes into `STEP_NUMBERS` in `particle_pieces.ts` (the build fails without it), and every new step setting gets a value in the step settings of `scripts/bench.mjs`.
- **The particle count follows the adaptive budget.** `src/lib/particle_budget.ts` trims the count when the simulation takes more than 40% of the frame and restores it once there is room again. The field count follows `particleBudget.active` everywhere, `restartIntro` included, not `numParticles`. Users can turn the budget off with the Particle Budget switch in the Playback section.
- **Motion is frame-rate independent.** Per-frame motion is scaled by `frameScale` (relative to 60 Hz, capped at 6); seconds-based motion uses `dt`; `src/lib/frame_pacing.ts` treats a one-off stall as a normal frame. Trails fade in whole 60 Hz steps through `fadeBacklog`. A particle is a disc sweeping a round-capped capsule over a frame, stamped with the brighter-of-two blend (`MAX`), never added; its brightness comes from its speed per 60 Hz frame (`u_speedGlow` bends that, `u_frameScale` keeps it the same at any refresh rate), and a particle that did not move writes no stroke. Gravity is never scaled by the flight speed, so at Base Speed 0 only the particles gravity moves stay lit.
- **The composite shader is gated effect by effect.** It runs for every device pixel on every frame, so each effect sits behind its uniform; after the intro only the lens, the shadow, the ring and the background stars do work. A new effect is gated the same way. The Ray Traced lens (`u_trace.x`) is the one that works every pixel (`traceSweep`); the main thread only places its camera (`cameraFor` in `src/lib/lens_trace.ts`, redone only when Einstein Radius changes). A spinning hole (`u_spin.x` above 0) takes the Kerr ray (`kerrRay`, or `kerrRayFrom` where the sines and cosines are at hand, in `src/lib/kerr_glsl.ts`; its reference is `src/lib/kerr_trace.ts`), and its shadow and ring follow the outline `updateShadowShape` works out when spin, tilt or the camera change; at spin 0 each of these takes the path it took before the spin existed, and the frames are bit-identical. The GPU's `asin` and `sin` lose near-equal differences, so take such a quantity (the ray's remaining fall) from an identity, never by subtracting.
- **Opening Settings builds nothing.** `SettingsBody` is built once with the page, before the first frame, in a detached element the open panel attaches; keep that work there, since a long task while the scene runs makes the next frame jump. A closed section stays mounted and hidden, every toggle is a leaf bound to its own setting, each slider subscribes to its own setting through `SettingSlider`, and `settings_persistence.ts` writes to the browser in idle time.
- **The space grid costs the main thread a few numbers per frame.** The Lensed Grid is a block of the composite shader gated by `u_skyGrid`, read at the bent ray like the stars. The Sheet (`src/lib/space_grid.ts`) is a static buffer of line pieces that the grid vertex shader places, dents (`dent`, whose physics its comment gives) and ripples, in one instanced draw over the finished frame while Sheet is above 0. `placeGrid` finds where the well goes; nothing about the sheet is computed per line in JavaScript.
- **A second black hole is gated.** `stepPair` (`src/lib/companion.ts`) is a few numbers per frame; the hot loop takes the companion's capture and pull in one block behind `hasCompanion`; its lens, shadow, ring and spiral wave sit behind `u_companion.z` and `u_pairWave.x`, and the sheet takes its second well and wave from uniforms. The merger is the pair's own motion: `stepPair` gives the merged hole's tone and the pair's last angle, and `advance` turns them into `u_holeOval` and a wave that the intro's wave block draws through `u_gravityWaveCenter`, `u_gravityWaveTurn` and `u_pairFront`; the opening's ringdown and a fired one stand still. Every gravitational wave moves the picture across its path, never along it, and weakens as 1 over the distance (`waveReach`); a new wave does both.
- **Uniforms go through the dirty-checked setters** `setUniform1f`, `setUniform2f` and `setUniform4f` in the renderer, which skip unchanged values. The texture units are fixed: the scene on 0, the title on 1, the photon ring's energy (`src/lib/ring_energy.ts`) on 2, the orbiting stars' traces on 3, a spinning hole's shadow outline (`src/lib/kerr_shadow.ts`) on 4.
- **The camera's zoom redraws, it does not magnify.** A zoom above 1 (the Zoom setting, the intro's camera) is applied to the geometry: the particle and orbit vertex shaders draw at `u_zoom`, and the composite pass reads the layers through `u_layerZoom`, the zoom they were drawn at. Every edge and hairline in that pass is measured in `px`, the scene pixels under one screen pixel, so nothing softens or thickens with the zoom; a new shape there follows the same rule. A zoom below 1 is left to the composite pass. The camera pans by moving the point its zoom leaves in place (`zoomX`, `zoomY` in `advance`), kept inside the frame, with nothing new in any shader; whatever places things on the screen (captions, the sheet, `scene.holeShiftX`) reads that point. A stroke starts where the particle stood in the last frame's picture (`u_zoomFrom`), so a moving camera streaks the trails and a camera cut (`CAMERA_CUT_ZOOM`, `CAMERA_CUT_SHIFT`) starts them afresh. The title sprite and the intro's dust still soften when magnified.
- **Orbiting stars leave lines, not a picture.** `stepOrbiters` (`src/lib/orbiters.ts`) integrates at most 64 stars and hands the renderer one row a frame (a new one every `STRETCH_SECONDS`), which goes up in one `bufferSubData` into a ring of rows on the GPU; the orbit program draws the whole layer anew each frame around the hole at the camera's zoom, and the composite pass reads it only while `u_orbits` is 1. How a trace ages (`dimmed`) is told in `orbiters.ts`.
- **GPU buffers grow and are reused.** The instance buffer grows ×1.5 through `bufferData` and is otherwise refilled with `bufferSubData`. The resolution follows `PIXEL_BUDGET` (4.5 M device pixels), with `MAX_PIXEL_RATIO` 2.
- **Resize is coalesced into one rAF.** World coordinates do not depend on the viewport, so a resize reallocates only GPU targets and keeps the particle field.
- **The loop runs only while it is visible.** `syncLoop` stops it while the scene is paused, while the tab is hidden and while the WebGL context is lost. Every GL resource is created inside `createParticleRenderer`, so `webglcontextrestored` rebuilds it all. A new texture or buffer belongs there.
- **The scene needs WebGL2.** A browser without it gets the message in `particle_canvas.tsx` instead of the scene, and the renderer calls WebGL2 directly (Devices). The scene's shaders are GLSL ES 1.00, which WebGL2 compiles as it is.

### Measuring

A change to the per-frame path is done when its before/after numbers are in hand and its main-thread time per frame is within noise of the commit before it. Runs vary by about ±10%, so take two runs of each build. If a regression is the price of a visual feature, report it in numbers.

- **Throughput**: build the commit before your change (`HEAD` while the change is uncommitted, else its parent) into another folder: `git worktree add --detach <dir> <commit>`, link `node_modules` into it (on Windows a junction, `New-Item -ItemType Junction -Path <dir>/node_modules -Target node_modules`, removed with `cmd /c rmdir` before `git worktree remove`), `pnpm build`. Then `node scripts/bench.mjs page <dir>/dist dist`; `--debug` measures with the intro debugger open. To find where the time goes, take a CDP `Profiler` capture with self time per function.
- **Simulation**: `node scripts/bench.mjs step` times `stepParticles` alone.

For orientation, at fdd46f6 on the development machine (RTX 3070):

| Scene | FPS | Main thread | Simulation |
|---|---|---|---|
| Default | 710–785 | 1.27–1.41 ms/frame | — |
| `?debug`, debugger open | 380–435 | 2.30–2.51 ms/frame | — |
| `stepParticles`, 24 000 with hole | — | — | 1.42–1.47 ms/step |

### Gotchas

- `pnpm build` is the type check. `tsc -b` writes stray `vite.config.js`, `vite.config.d.ts` and `*.tsbuildinfo` files into the repo root. Delete them if they appear.
- `pnpm lint` already fails on files outside your change: the shadcn files in `src/components/ui/` and a few files under `src/components/controls/`. Lint the files you touched and judge only those.

## Driving the scene as an agent

`window.space` (`src/lib/scene_api.ts`) reads and changes every simulation setting and intro parameter and drives the intro timeline. It loads in development, and on a deployed build only with `?agent`, as a chunk other visitors never download. To drive the page or make a film, use the `space-scene` skill.

- **Each fact has one home**: ranges and meanings in the specs (read through `describe`), the page's commands in `help()`, the film format in `FILM_GUIDE`, how to use the knobs in the skill, the rules for the code here and in `docs/`. A simulation slider is described once in `src/lib/simulation_specs.ts` (the Settings panel builds from it), an intro parameter in `INTRO_PARAM_SPECS`; a new setting goes there, and the panel, the agent API and films pick it up. A setting that is not a slider also needs a line in `parseSettings` (`src/lib/agent_values.ts`) and, to move along a film's track, one in `readTracks` (`src/lib/film.ts`).
- **Every length around the black hole is in black hole radii**, so Black Hole Size alone scales the hole; a new length setting follows the same rule.
- **A change to the knobs ends with the audit.** After a setting, an intro parameter, a layer or a preset is added, renamed or removed, `node .claude/skills/space-scene/scripts/audit.mjs` must print no problem.
- **`public/index.md` is the door for agents from outside the page.** The build puts it into the page's HTML as markup inside `#root`, never as a `<noscript>` (`describePage` in `vite.config.ts` says why), the `<meta name="description">` in `index.html` says the same in one sentence, it answers a request with `Accept: text/markdown` (a route in `vercel.json`, not a rewrite, which would give way to the `index.html` at that address), and the page's `Link` header names it as its `service-doc`. It names commands and leaves every range to `describe()`, so change it only when a command it names changes, and change the canvas's label (`SCENE_LABEL` in `particle_canvas.tsx`), which names `?agent` and `help()`, with it. Preview deployments are behind Vercel's sign-in: check a change to the routes with the project's bypass secret in an `x-vercel-protection-bypass` header.

## Films

The rules for films, scripts, reels, captions, the encoder and the `space` MCP server are in `docs/films.md`; those for the Mandelbrot zoom, its films and the page's Mandelbrot mode are in `docs/fractal_films.md`. Read the one that applies before changing film or fractal code: `src/lib/film*.ts`, `reel*.ts`, `caption_text.ts`, `particle_crew*.ts`, `particle_pieces.ts`, `intro_tracks.ts`, the scene's `fire`, `makeTitle` and `useTitle`, the fonts in `public/fonts` and `index.css`, `mcp/` or a `fractal*` file. Add a new rule for that code there.
