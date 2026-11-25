# canvas-particles-space

A WebGL particle flight through space, ending in a black hole. React only drives the UI. The scene itself runs in one requestAnimationFrame loop.

## UX

The main quality of the interface is the balance between flexibility (the user can customise layout and look) and carefully chosen defaults for both, so every panel reads well before anyone touches it. Readability, compactness and clarity for the user are the main goal of UX: every UI change is judged by them first.

- Microcopy is one short line. A control's hint fits one line of the 340px panel (at most 42 characters): what the control changes, in plain words, with the direction when it is not obvious ("Higher: shorter trails"). A paragraph under a slider (several sentences, physics, edge cases, references to other settings) is an anti-pattern: it breaks compactness and nobody reads it. The full explanation stays in the spec's `description`, which the agent API reads; the context menu shows the spec's `hint`.
- The panels draw no hint lines and no help buttons. A hint lives in the control's context menu (`hint_menu.tsx`, one menu for the page): a right-click, Shift+F10 or the Menu key, or a long press on touch opens it with the control's name, its hint and, where it has a default, a reset to it. A row offers its hint through `data-hint`, `data-hint-label` and `data-hint-reset`, and keeps the same text as an `sr-only` line tied to its control with `aria-describedby`, so screen readers always read it. Do not add per-row help icons or a HELP toggle.
- A panel opens and closes from one place: its button in the scene toolbar at the top right (`control_panel.tsx`), which never moves or hides and shows the panel open with `aria-expanded` and a solid fill. Panels have no close buttons of their own. Opening moves the focus into the panel; Escape closes the panel the focus is in; closing with the focus inside returns it to the panel's button.
- A slider's label and value never sit on a strong fill or a blend mode: the fill is a quiet tint with a solid edge at the value. Every value carries its unit, formatted once in the spec (`format` in `simulation_specs.ts`, `unit` in `INTRO_PARAM_SPECS`) and spoken through `aria-valuetext`.
- Scrolling never changes a value: the wheel moves a slider only while it has the focus or with Shift or Alt, and a finger moves it only after a sideways slop or with a short tap, never one that lands while the panel scrolls.

## Render performance

The hard constraint in this project is frame time. Any change that touches the **per-frame path** has to keep it lean. The per-frame path is:
- `renderFrame` in `src/components/particle_canvas.tsx`
- `advance` in `src/lib/scene.ts`
- `stepParticles` in `src/lib/particle_simulation.ts`
- `render` in `src/lib/particle_renderer.ts`
- the composite fragment shader in `src/lib/webgl_shaders.ts`

The bottleneck is the **main thread**, not the GPU. About 88% of main-thread time is the `stepParticles` **hot loop**, at roughly 50 ns per particle. Any per-particle cost is multiplied by the particle count, 24 000 by default and 12 000 on small screens.

### Frame pipeline

1. `renderFrame` reads both stores with `getState()`. It applies the frame-rate cap through the `nextFrameSlot` scheduler, derives `frameScale` from the real elapsed time and hands both stores to the scene as its `SceneInput`. `advance` (`src/lib/scene.ts`) assembles the frame from that input alone.
2. `stepParticles` advances a struct-of-arrays field (Float32Array per property) and writes clipped segments into one interleaved instance array: 7 floats per segment, with the colour stored as a packed Uint32.
3. `render` uploads the instances with a single `bufferSubData` and draws instanced quads into a persistent scene FBO that holds the trails. It then runs one full-screen composite pass, which does the lens, the intro effects and the title, and draws the space sheet over it while that is on.

### Invariants

- **The scene reads no store, no window and no clock.** `createScene` owns the field, the black hole, the intro frame and the renderer; what a frame depends on arrives in `SceneInput` (settings, intro parameters, hidden layers, reduced motion, particle count) with `frameScale` and `dt`. The page keeps the loop, the frame-rate cap, the particle budget, input handling and every store write. Random numbers come from the scene's own seeded generator (`src/lib/random.ts`), never `Math.random`, so one seed and one sequence of inputs draw the same frames; that is what lets a film render the scene in a plain loop.
- **The per-frame path allocates nothing.** `frame`, `settings`, `instances` and `composite` are created once with the scene, the page's `input` once in the effect, and all are mutated in place. New per-frame data becomes fields on these objects or preallocated typed arrays, not fresh objects, arrays or closures.
- **React never renders per frame.** The loop reads stores through `getState()`. It writes to a store only when a value changes, and only at a throttled rate:
  - `measuredFps`: every 500 ms;
  - `activeParticles`: when the budget changes it;
  - the debugger readout: every 66 ms, and only while the debugger is open.

  Every `set()` also wakes every subscriber, including `syncLoop` in the canvas.
- **Fast-changing values stay in leaf components.** A component that shows `readout`, `measuredFps` or `activeParticles` subscribes to just that value through a narrow selector. Examples are `MeasuredFps` and, in the debugger, `TimeReadout`, `Ruler`, `Playhead`, `TrackValue`, `SpanBar` and `MarkerButton`. Large components such as `IntroDebugger`, `IntroTrackList`, `TrackRow` and `ControlPanel` never subscribe to them, so they do not re-render at loop rate.
- **The hot loop rejects cheaply before it computes.** It compares squared distances first, because the event horizon captures particles at any depth, then applies a scalar range test (the depth band `holeDepthNear..holeDepthFar`) before the gravity math. It uses polynomial falloffs instead of `Math.exp` or `Math.pow`, at most one `Math.sqrt` per particle on the gravity path, and multiplications by precomputed reciprocals. Loop-invariant values are hoisted above the loop. Respawning goes through `spawnParticle`; a captured particle goes through `respawnBeyondHorizon`, which keeps a wide horizon from swallowing the whole field.
- **The particle count follows the adaptive budget.** `src/lib/particle_budget.ts` trims the count when the simulation takes more than 40% of the frame and restores it once there is room again. The field count follows `particleBudget.active` everywhere, `restartIntro` included, not `numParticles`. Users can turn the budget off with the Particle Budget switch in the Playback section (ON/OFF).
- **Motion is frame-rate independent.** Per-frame motion is scaled by `frameScale`, which is relative to a 60 Hz reference and capped at 6. Seconds-based motion uses `dt`. `src/lib/frame_pacing.ts` treats a one-off stall as a normal frame, so a long task on the main thread does not make the particles jump. Trails fade in whole 60 Hz steps through `fadeBacklog`. That keeps trail length the same at any refresh rate and avoids the grey 8-bit haze that per-frame fading leaves on an RGBA8 target. A particle is a filled disc that sweeps a round-capped capsule over a frame. It is stamped into the scene with the brighter-of-two blend (`MAX`), not added, so overlapping stamps of a slow particle do not build up and its edge stays sharp at any size; its brightness comes straight from its speed per 60 Hz frame in the particle vertex shader, and the trail is the fade of the scene; the Speed Glow setting (`u_speedGlow`) bends that link, and `u_frameScale` keeps it the same at any refresh rate. A particle that did not move writes no stroke, so at Base Speed 0 the field goes dark except for the particles the black hole's gravity moves; gravity must not be scaled by the flight speed.
- **The composite shader gates every effect behind a uniform.** It runs for every device pixel on every frame, so each effect sits behind `if (u_effect > 0.0)` and its uniform is 0 while the effect is inactive. After the intro, only the lens, the shadow, the ring and the background stars do any work. A new effect follows the same pattern.
- **Opening Settings builds nothing.** `SettingsBody` is built once with the page, before the first frame, in a detached element that the open panel attaches. A long task while the scene runs makes the next frame jump, so do not move this work back to the moment the panel opens. A closed section stays mounted and is only hidden, so expanding one builds nothing either; every toggle is a leaf component bound to its own setting. Each slider subscribes to its own setting through `SettingSlider`, so changing a setting re-renders one slider, and `settings_persistence.ts` writes to the browser in idle time.
- **The space grid costs the main thread a few numbers per frame.** The Lensed Grid is one block of the composite shader behind `u_skyGrid`, read at the bent ray like the stars. The Sheet (`src/lib/space_grid.ts`) is a static buffer of line pieces that the grid vertex shader places, dents and ripples; one instanced draw lays it over the finished frame, and only while Sheet is above 0. `placeGrid` finds where the well goes; nothing about the sheet is computed per line in JavaScript.
- **Uniforms go through the dirty-checked setters** `setUniform1f`, `setUniform2f` and `setUniform4f` in the renderer, which skip unchanged values. The texture units are fixed: the scene on 0, the title on 1, the photon ring's energy (`src/lib/ring_energy.ts`) on 2, the orbiting stars' traces on 3.
- **Orbiting stars ride the particle upload.** `stepOrbiters` (`src/lib/orbiters.ts`) integrates at most 64 stars with real velocity and writes one segment each after the particles' in the same instance array, so they add no upload and no per-particle cost. The renderer stamps them into a layer of their own, which fades by whole levels of brightness (a subtraction, so a long trace still reaches black on an RGBA8 target) and which the composite pass reads only while `u_orbits` is 1. That layer gets its full size when the first star is drawn, not with the page.
- **GPU buffers grow and are reused.** The instance buffer grows ×1.5 through `bufferData` and is otherwise refilled with `bufferSubData`. The resolution follows `PIXEL_BUDGET` (4.5 M device pixels), with `MAX_PIXEL_RATIO` 2.
- **Resize is coalesced into one rAF.** World coordinates do not depend on the viewport, so a resize reallocates only GPU targets and keeps the particle field.
- **The loop runs only while it is visible.** `syncLoop` stops it while the scene is paused, while the tab is hidden and while the WebGL context is lost. Every GL resource is created inside `createParticleRenderer`, so `webglcontextrestored` rebuilds it all. A new texture or buffer belongs there.
- **The scene needs WebGL2 and has no fallback.** A browser without it gets the message in `particle_canvas.tsx` instead of the scene, so the renderer calls WebGL2 directly and no feature gets a second code path. The shaders are still GLSL ES 1.00, which WebGL2 compiles as it is.

### Measuring

A change to the per-frame path is done only when its before/after numbers are in hand and the main-thread time per frame does not exceed the baseline beyond noise. Runs vary by about ±10%, so take two runs of each build. If a regression is the price of a visual feature, report it in numbers rather than hiding it.

- **Throughput.** Serve two production builds (`pnpm build`, then `dist/`): the commit before your change and your change. Load each in headless Chrome with `--use-angle=d3d11 --ignore-gpu-blocklist --disable-gpu-vsync --disable-frame-rate-limit` at 1920×1080. Click CLICK TO START, wait 7 s for the intro to finish, then count rAF ticks over 4 s. Read CDP `Performance.getMetrics` before and after, and divide the `TaskDuration` delta by the frame count to get main-thread ms per frame. To find where the time goes, use a CDP `Profiler` capture with self time per function.
- **Simulation.** Bundle a microbenchmark that calls `stepParticles` directly (esbuild ships in `node_modules/.pnpm`). Run 300 warm-up steps and then 1500 timed steps at 1920×1080. Measure 24 000 particles with the hole, and 24 000 and 10 000 without it.

Baseline at e9c18fc, measured with the method above:

| Scene | FPS | Main thread | Simulation |
|---|---|---|---|
| Default | 590–650 | 1.5–1.7 ms/frame | — |
| `?debug`, debugger open | 575–585 | 1.7 ms/frame | — |
| `stepParticles`, 24 000 with hole | — | — | ~1.45 ms/step |

### Gotchas

- `pnpm build` (`tsc && vite build`) is the type check. `tsc -b` writes stray `vite.config.js`, `vite.config.d.ts` and `*.tsbuildinfo` files into the repo root. Delete them if they appear.
- `pnpm lint` already fails on files outside your change: the shadcn files in `src/components/ui/` and a few files under `src/components/controls/`. Lint the files you touched and judge only those.

## Driving the scene as an agent

`window.space` (`src/lib/scene_api.ts`) reads and changes every simulation setting and intro parameter and drives the intro timeline. It is loaded in development, and on a deployed build only with `?agent` in the address, as a separate chunk that other visitors never download.

The browser comes from the `chrome-devtools` MCP server in `.mcp.json` ([chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)). It opens its own Chrome window with a persistent profile, separate from the user's browser, so the agent's changes never touch the user's saved settings. Its flags keep the scene rendering while the window is covered or in the background.

1. `navigate_page` to https://space.xn--c6t.net/?agent, or to `http://localhost:5173/` for the dev server, or to a Vercel preview with `?agent`.
2. `evaluate_script` with `() => window.space.help()` lists every command. Call them the same way, for example:
   - `() => window.space.describe('lens')`;
   - `() => window.space.set({ blackHoleSize: 12 })`;
   - `() => window.space.intro.preset.apply('Nebula')`;
   - `async () => window.space.frames(60)` to let the change settle.
3. `take_screenshot` shows the result: the scene, and the panels when they are open. `evaluate_script` and `click` reach the UI itself.

To work in the user's own open Chrome instead, run the server with `--autoConnect` (Chrome 144+, after the user turns on remote debugging at `chrome://inspect/#remote-debugging`); changes then land in the user's own saved settings.

- A setting or parameter is described once: simulation sliders in `src/lib/simulation_specs.ts` (the Settings panel builds from it), intro parameters in `INTRO_PARAM_SPECS`. A new setting goes there, and both the panel and the agent API pick it up.
- Every length around the black hole is in black hole radii (Event Horizon, Gravity Reach, Einstein Radius, Orbit Size), so Black Hole Size alone scales the hole and nothing has to be kept in step with it. A new such setting follows the same rule. `preset.apply('Schwarzschild')` is the physically faithful setup (`SCHWARZSCHILD_PRESET` in `src/store/preset_store.ts`): a point-mass lens with its mirrored image inside the Einstein ring, no twist, capture at the shadow's edge. Default is tuned for the look instead.
- `set` and `intro.set` check every value, put it on its slider's step within range and apply the whole patch in one store update; an unknown key fails with the closest names. `reset` and `intro.reset` bring back the defaults.
- `frames` needs a visible tab with the scene running; a paused scene draws no frames and the call fails with that reason. A paused intro timeline freezes the particle field: after `intro.seek` play or step before a screenshot of the particles at the new moment.
- The intro readout in `readout()` is live only while the intro debugger is open (`debug(true)`).

## Films

A film is the scene as a 1-180 s mp4, described by one JSON object: frame and length, seed, starting settings, the intro as a clip, keyframes for any numeric setting or intro parameter, captions. The format is written once, as `FILM_GUIDE` in `src/lib/film.ts`; `window.space.film.guide()` and the `space_guide` tool both return it, so change the guide when the format changes.

- **The `space` MCP server** (`mcp/space_mcp.mjs`, in `.mcp.json`) is how an agent makes one: `space_guide`, `space_describe`, `space_preview` (a contact sheet of frames) and `space_render` (the mp4, with an optional audio file under it). It serves `dist/` from this machine and keeps one headless Chrome on it, so run `pnpm build` after changing the page. It has no dependencies: JSON-RPC lines on stdio, the browser over its DevTools socket. The page does the work through `window.space.film` (`check`, `preview`, `render`, `progress`, `cancel`), which also works from the console of any page with `?agent`.
- **A film plays in a scene of its own** (`src/lib/film_render.ts`): a second `createScene` on a canvas of the film's size, stepped by a fixed `dt` with no clock, so the page's scene and its saved settings are never touched and a slow machine draws the same frames as a fast one. It starts from the page's defaults, never from this browser's settings. Motion is stepped at about 60 Hz whatever the film's frame rate (`frame.present` is false for the steps between two frames). The same seed gives the same frames; a preview frame is the frame the render makes.
- **`planFilm` checks a film against the same registries as `window.space`** (`src/lib/agent_values.ts`): a new simulation setting or intro parameter is settable and animatable in films as soon as it is in its spec. A setting that is not a slider needs a line in `parseSettings`.
- **Captions are drawn over the finished frame** on a 2D canvas (`src/lib/film_captions.ts`), never in the scene: the page has no captions. Encoding is WebCodecs through `mediabunny`, imported only when a film is rendered, so visitors never download it.
- Verify a film change by rendering: `space_preview` twice with one seed must give the same picture, and an mp4 must play (`<video>` in Chrome, or mediabunny's `Input` in Node for its tracks).
