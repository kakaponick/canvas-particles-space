# canvas-particles-space

A WebGL particle flight through space, ending in a black hole. React only drives the UI. The scene itself runs in one requestAnimationFrame loop.

## Render performance

The hard constraint in this project is frame time. Any change that touches the **per-frame path** has to keep it lean. The per-frame path is:
- `renderFrame` in `src/components/particle_canvas.tsx`
- `stepParticles` in `src/lib/particle_simulation.ts`
- `render` in `src/lib/particle_renderer.ts`
- the composite fragment shader in `src/lib/webgl_shaders.ts`

The bottleneck is the **main thread**, not the GPU. About 88% of main-thread time is the `stepParticles` **hot loop**, at roughly 50 ns per particle. Any per-particle cost is multiplied by the particle count, 24 000 by default and 12 000 on small screens.

### Frame pipeline

1. `renderFrame` reads both stores with `getState()`. It applies the frame-rate cap through the `nextFrameSlot` scheduler and derives `frameScale` from the real elapsed time.
2. `stepParticles` advances a struct-of-arrays field (Float32Array per property) and writes clipped segments into one interleaved instance array: 7 floats per segment, with the colour stored as a packed Uint32.
3. `render` uploads the instances with a single `bufferSubData` and draws instanced quads into a persistent scene FBO that holds the trails. It then runs one full-screen composite pass, which does the lens, the intro effects and the title.

### Invariants

- **The per-frame path allocates nothing.** `frame`, `settings`, `instances` and `composite` are created once in the effect and mutated in place. New per-frame data becomes fields on these objects or preallocated typed arrays, not fresh objects, arrays or closures.
- **React never renders per frame.** The loop reads stores through `getState()`. It writes to a store only when a value changes, and only at a throttled rate:
  - `measuredFps`: every 500 ms;
  - `activeParticles`: when the budget changes it;
  - the debugger readout: every 66 ms, and only while the debugger is open.

  Every `set()` also wakes every subscriber, including `syncLoop` in the canvas.
- **Fast-changing values stay in leaf components.** A component that shows `readout`, `measuredFps` or `activeParticles` subscribes to just that value through a narrow selector. Examples are `FrameRateControl` and, in the debugger, `TimeReadout`, `Ruler`, `Playhead`, `TrackValue`, `SpanBar` and `MarkerButton`. Large components such as `IntroDebugger`, `IntroTrackList`, `TrackRow` and `ControlPanel` never subscribe to them, so they do not re-render at loop rate.
- **The hot loop rejects cheaply before it computes.** It compares squared distances first, because the event horizon captures particles at any depth, then applies a scalar range test (the depth band `holeDepthNear..holeDepthFar`) before the gravity math. It uses polynomial falloffs instead of `Math.exp` or `Math.pow`, at most one `Math.sqrt` per particle on the gravity path, and multiplications by precomputed reciprocals. Loop-invariant values are hoisted above the loop. Respawning goes through `spawnParticle`; a captured particle goes through `respawnBeyondHorizon`, which keeps a wide horizon from swallowing the whole field.
- **The particle count follows the adaptive budget.** `src/lib/particle_budget.ts` trims the count when the simulation takes more than 40% of the frame and restores it once there is room again. The field count follows `particleBudget.active` everywhere, `restartIntro` included, not `numParticles`. Users can turn the budget off in the Frame Rate block (AUTO/OFF).
- **Motion is frame-rate independent.** Per-frame motion is scaled by `frameScale`, which is relative to a 60 Hz reference and capped at 6. Seconds-based motion uses `dt`. `src/lib/frame_pacing.ts` treats a one-off stall as a normal frame, so a long task on the main thread does not make the particles jump. Trails fade in whole 60 Hz steps through `fadeBacklog`. That keeps trail length the same at any refresh rate and avoids the grey 8-bit haze that per-frame fading leaves on an RGBA8 target. A particle is a filled disc that sweeps a round-capped capsule over a frame. It is stamped into the scene with the brighter-of-two blend (`MAX`), not added, so overlapping stamps of a slow particle do not build up and its edge stays sharp at any size; its brightness comes straight from its speed per 60 Hz frame in the particle vertex shader, and the trail is the fade of the scene; the Speed Glow setting (`u_speedGlow`) bends that link, and `u_frameScale` keeps it the same at any refresh rate. A particle that did not move writes no stroke, so at Base Speed 0 the field goes dark except for the particles the black hole's gravity moves; gravity must not be scaled by the flight speed.
- **The composite shader gates every effect behind a uniform.** It runs for every device pixel on every frame, so each effect sits behind `if (u_effect > 0.0)` and its uniform is 0 while the effect is inactive. After the intro, only the lens, the shadow, the ring and the background stars do any work. A new effect follows the same pattern.
- **Opening Settings builds nothing.** `SettingsBody` is built once with the page, before the first frame, in a detached element that the open panel attaches. A long task while the scene runs makes the next frame jump, so do not move this work back to the moment the panel opens. Each slider subscribes to its own setting through `SettingSlider`, so changing a setting re-renders one slider, and `settings_persistence.ts` writes to the browser in idle time.
- **Uniforms go through the dirty-checked setters** `setUniform1f`, `setUniform2f` and `setUniform4f` in the renderer, which skip unchanged values. The texture units are fixed: the scene on 0, the title on 1, the photon ring's energy (`src/lib/ring_energy.ts`) on 2.
- **GPU buffers grow and are reused.** The instance buffer grows ×1.5 through `bufferData` and is otherwise refilled with `bufferSubData`. The resolution follows `PIXEL_BUDGET` (4.5 M device pixels), with `MAX_PIXEL_RATIO` 2.
- **Resize is coalesced into one rAF.** World coordinates do not depend on the viewport, so a resize reallocates only GPU targets and keeps the particle field.
- **The loop runs only while it is visible.** `syncLoop` stops it while the scene is paused, while the tab is hidden and while the WebGL context is lost. Every GL resource is created inside `createParticleRenderer`, so `webglcontextrestored` rebuilds it all. A new texture or buffer belongs there.
- **WebGL2 comes first, with a WebGL1 fallback** through `ANGLE_instanced_arrays`. Shaders compile for both.

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
