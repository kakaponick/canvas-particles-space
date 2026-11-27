# Gravitational Lensing Particle Simulator

A WebGL2 particle flight through space that ends in a black hole. Particles fly past the camera, and the black
hole pulls them in and bends the light behind it: a shadow, a photon ring and an Einstein ring. Stars can circle
it on real orbits, a second black hole can circle with it and send out gravitational waves, two grids show curved
space, and the camera zooms in on the shadow or pulls back. React drives only the panels; the scene runs in one
`requestAnimationFrame` loop.

The same scene can be scripted from the browser's console or by an AI agent through `window.space`, and rendered
to an mp4 film from a JSON description or a script (see [Films](#films)).

## Tech Stack

- **React** 18 and **TypeScript** 5, built with **Vite** 5
- **Tailwind CSS** 3, Radix UI primitives through shadcn/ui (`src/components/ui/`), lucide-react icons
- **Zustand** 4 - state; the animation loop reads the stores directly, so React never renders per frame
- **WebGL2** - instanced particle strokes and one full-screen composite pass for the lens, the ring, the opening
  and the grids. There is no fallback: a browser without WebGL2 gets a message instead of the scene
- **mediabunny** - encodes films to H.264 mp4 through WebCodecs; loaded only when a film is rendered. The film server uses the graphics card's encoder through ffmpeg instead on a machine set up for it (`docs/films.md`)
- **Vercel** - hosting (`vercel.json`) and Vercel Analytics

## Getting Started

### Prerequisites

- Node.js 18+ for the page; Node.js 22+ for the film server (`mcp/space_mcp.mjs`), which also needs Chrome,
  Chromium or Edge
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type check and build for production into dist/
pnpm build

# Preview production build
pnpm preview

# Lint
pnpm lint

# Frame time against an earlier commit (see CLAUDE.md, Measuring)
node scripts/bench.mjs page --against HEAD
```

## Opening

The page opens on its own, no click needed. A star brightens and explodes: its light races outward at
the on-screen speed of light, visible only where it strikes dust, which keeps glowing for a moment
(a light echo). The ejected matter follows more slowly and becomes the particle field. The core's light
reddens away as it collapses, a black hole forms, rings down and sends out a gravitational wave that
ripples the background stars, swallows the title and then drifts to your cursor. The whole opening takes
about 6 seconds. With the system "reduce motion" setting the explosion, fronts and wobble are skipped and
the scene fades in.

## Controls

On the scene:

- **Mouse movement**: the black hole follows your cursor with inertia
- **Click**: anchor the black hole where it is, or release it to follow again. An anchored black hole can be
  dragged to a new place; a double-click puts it back in the middle
- **Scroll**: change Base Speed; down is faster, up is slower
- **Touch**: drag the black hole with a finger; swipe up or down elsewhere to change Base Speed
- **In 3D**: with 3D View on, drag the scene (or swipe it on a touch screen) to circle the camera around the
  black hole
- **Keyboard**: Tab reaches the scene first. With the focus on it the arrow keys circle the 3D camera, or pan
  a zoomed-in flat one; plus and minus zoom; Shift makes each step finer; Home resets the camera. A screen
  reader hears where the camera now stands

The toolbar at the top right holds the measured frame rate (while FPS Counter is on), the films, the Mandelbrot
zoom, the intro debugger, Settings and fullscreen. Each panel opens and closes from its button there; Escape closes the panel the focus is
in, and with the focus outside both panels, Escape opens Settings. The panels show no help text: right-click a
control (or press Shift+F10 or the Menu key on it, or long-press it on a touch screen) for its one-line hint and
a reset to its default. A double-click on a slider, or Delete while it has the focus, also resets it.

- **Settings**: every setting of the scene, in the groups below. The current settings are kept in this browser
  across reloads
- **Intro debugger** (its toolbar button, Alt+Shift+D, or `?debug` in the address): a timeline of the opening
  with a track for each of its elements and the moments on it (drag a moment, or focus it and use the arrows, to
  retime it), playback speed from 0.05× to 2×, frame step, loop, a switch to turn each element off, every
  tunable number of the opening (98, grouped by track), the title's words, face and case, and presets of the
  opening: Default and ten built-in looks, plus your own, saved with or without the scene's settings. Its values
  are kept across reloads in this browser, with reset and "copy changed" to share them as JSON. The Keys
  button in the debugger lists its keyboard shortcuts

### Settings

The Settings panel is built from `src/lib/simulation_specs.ts`, which holds every slider's range, step, unit
and meaning; `window.space.describe()` reads the same text. The groups:

- **Presets**: **Default** is tuned for the look; **Schwarzschild** is a real non-rotating black hole as far as
  the scene shows one: a ray-traced lens and capture at the edge of the shadow; **Kerr** is the same hole spinning
  at 0.99, seen side-on. Save your own setups under a name; they stay in this browser. Every length around the
  hole is in black hole radii, so Black Hole Size alone scales it
- **Playback**: Scene Motion (freeze the scene), **FPS Limit** (AUTO follows the display, or a cap of 30-240;
  motion speed does not depend on the frame rate) and FPS Counter
- **3D View**: the ON/OFF switch at the head of the section. The field becomes a column of particles flowing
  through space past the black hole, stepped with gravity along the true distance, and a camera circles the
  hole: **Orbit Angle** around it, **Elevation** above or below it, **Auto Orbit** in degrees a second. Straight
  on it looks like the flat mode, and the camera eases between the two in about a second. The shadow, ring and
  lens look the same from every side, as a non-rotating hole's do; the orbiting stars, the second black hole, the
  sky and the space sheet turn with the camera (the sheet fades out as the camera comes level with it)
- **Particles**: the field (**Count**, 500-200 000; 24 000 by default, 12 000 on screens narrower than 768 px),
  its depth and spawn disc, Base Speed and its spread, the scroll step, particle size and how fast trails fade
- **Particle Lighting**: brightness, how brightness follows speed and depth, the opacity range, the pulse
- **Colors**: the particle palette, each colour with its share of the mix, and the background colour
- **Black Hole**: **Size** (shadow radius as a share of the screen's short side), the Event Horizon where
  particles are captured, the depth it sits at, **Spin** with the tilt and direction of its axis (a spinning
  hole's shadow flattens on the side turning toward the camera and shifts the other way, the photon ring follows
  it, the orbiting stars and the particles near the hole are dragged round, the particles as hard as **Frame Drag** says, and under Ray Traced so is the light), **Gravity**, **Orbital Force**, **Inertia** (how much of the speed gravity gives the particles they keep: at 0 the classic look, near 1 they swing past the hole along bent paths), **Gravity Reach** (in black hole
  radii), Follow Cursor and how stiffly it follows, its resting position, and **Zoom**: magnifies the view around
  the black hole, which stays where it is on the screen. The scene is drawn anew at the zoom, not enlarged:
  particles, orbits, the ring and the grids stay sharp, and hairlines stay hairlines. Below 1 the camera pulls
  back, and the picture repeats, mirrored, beyond its edges. While it is zoomed in the camera can look beside
  the black hole (**Pan X**, **Pan Y**, in radii) and, in a pair, at either black hole (**Pan in Pair**); it
  moves inside the picture the scene draws and stops at its edge
- **Second Black Hole**: a companion of **Size** (in main hole radii, 0 = none) at **Distance** from the main
  one. The two circle their common centre at the rate Kepler's law gives, faster as they close in (**Orbit
  Speed** scales it, its sign is the direction), each with its own shadow, lens, ring, gravity and well in the
  sheet, and send out a spiral of gravitational **Waves**. Below a Distance of 1 + Size their shadows overlap and
  the main hole grows by the companion's mass; at 0 they are one, an oval that keeps turning as it rings down and
  sends a last wave. The waves stretch the picture across their path and weaken as 1 over the distance, as real
  ones do
- **Photon Ring**: brightness, glow, thickness, the Doppler contrast between its approaching and receding sides,
  and the light that infalling particles leave on it
- **Gravitational Lensing**: **Ray Traced**, on by default, follows every pixel's ray round the black hole, spinning (Kerr) or not, so
  the Einstein ring, the mirrored image inside it and the thin rings of light that circled the hole come from
  the physics, and **Einstein Radius** (in black hole radii, 0 = no lens) places the camera. Off, the stylized
  lens adds how far it reaches, its falloff, a twist of the sky and the limits near the hole
- **Orbiting Stars**: stars with real orbits around the black hole (**Count**, 0 = none): ellipses that precess,
  faster the closer they come, with a trace that stays lit for **Trail** seconds. The traces are lines kept
  around the black hole, so they move and grow with it. **Orbit Size**, **Eccentricity** and **Orbit Speed**
  (its sign is the direction) shape them; a star that crosses the Event Horizon lights the photon ring
- **Space Grid**: grids for explaining curved space, each off until its brightness is above 0. **Sheet** is a
  grid seen at an angle (**Sheet Tilt**) and dented where the black hole sits (**Well Depth**) by how much time
  is slowed there; gravitational waves ripple through it. **Lattice** is the same law in three dimensions:
  lines along all three axes around the black hole, drawn in towards it (**Lattice Pull**) by how much time is
  slowed at each node, with a cell of **Lattice Spacing** black hole radii; it is seen through the lens and is
  made for 3D View, where the camera circles it. **Lensed Grid** is a flat grid on the sky read through the
  lens, so it shows what the lens does
- **Background Stars**: brightness, density and spacing

## Driving the scene from the console

Open the page with `?agent` in the address (in development `window.space` is always there) and call
`space.help()` in the console: it lists every command. `space.describe()` and `space.intro.describe()` list
every setting and intro parameter with its range, default and meaning; `space.set({ gravityStrength: 5 })`,
`space.reset()` and `space.preset.apply('Schwarzschild')` change the scene, and `space.intro.*` drives the
opening's timeline. The API is a separate chunk that visitors without `?agent` never download. The
`space-scene` skill in `.claude/skills/` is the manual for agents.

## Films

The scene can be rendered to a short mp4 (1-180 s, H.264, up to 4K and 240 fps) from one JSON description: its length and
frame, a seed, starting settings, and a timeline: keyframes for any setting, layers of the scene switched on
and off, the opening as a clip, its events (the flash, the light front, the ringing, the gravitational wave)
fired again at any second, slow motion and still frames, a camera that zooms and pans, shapes drawn over
the picture (lines and arrows, circles, charts, pictures), captions and an optional audio track. The same film
is the same video on any machine.

```json
{
  "duration": 12,
  "preset": "Schwarzschild",
  "intro": false,
  "settings": { "gridSheet": 0.6, "orbitCount": 12 },
  "tracks": { "cameraZoom": [[0, 1], [12, 2.5]] },
  "captions": [{ "text": "Event horizon", "from": 2, "to": 8, "at": "hole" }]
}
```

A longer film is easier written as a script: JavaScript that plays the film forward, where no second is
written by hand, a part of a film is a function and a path is a function of time. It comes to the same JSON
(`films/language/language.js` is one):

```js
film({ preset: 'Schwarzschild', settings: { gridSheet: 0.6, orbitCount: 12 } })
set({ fade: 1 })
shot('arrival', () => {
  caption('A black hole, from a distance')
  to({ fade: 0 }, 2)
  wait(3)
})
shot('approach', () => {
  caption('Event horizon', { at: 'hole' })
  to({ cameraZoom: 2.5 }, 6, 'spring')
  slow(0.15, () => { wait(3) })
})
to({ fade: 1 }, 1.5)
```

- **For AI agents**: the `space` MCP server (`mcp/space_mcp.mjs`, listed in `.mcp.json`) has five tools:
  `space_guide` (the format, the script language and recipes), `space_describe` (what can be set), `space_check`
  (a film read back as a timeline, with every mistake and its line), `space_preview` (frames of the film
  side by side) and `space_render` (the mp4). Run `pnpm build` first; it needs Node 22+ and Chrome, Chromium or Edge.
  The `space-scene` skill in `.claude/skills/` is the manual that goes with them: every setting by the physical
  law it belongs to, how to drive the live page through `window.space`, how to make a film that reads, the same
  tools from a shell (`scripts/space.mjs`) and a check that agents reach every knob (`scripts/audit.mjs`).
- **An agent that has only the address** learns the rest from it: the page's HTML carries a short description
  of `window.space` behind `?agent` for a reader that runs no script, and the address answers with the same
  text when asked for markdown (`Accept: text/markdown`). The text is `public/index.md`.
- **By hand**: open the page with `?agent` and call `await space.film.render(film, { download: 'film.mp4' })`
  in the console; `space.film.guide()` prints the format.
- **A film that explains**: captions take the text popular science is written in. `r_{s} = 2GM / c^{2}` is drawn
  with its lowered and raised parts, `*{event horizon}` in an accent colour, `#{cameraZoom:1}` or a counter of the
  caption's own is a number read from the film as it plays; Greek, mathematics and the signs of the Sun and the
  planets are bundled (Noto Sans, Noto Sans Math, Noto Sans Symbols), so they are the same on every machine; a
  caption can arrive a letter, a word or a line at a time, stand on a plate, in a column, on black, or point at a
  distance from the hole. `films/horizon/horizon.js` is a 40 s film about the event horizon made of these.
- **Several films in one**: a JSON object with `clips` is a reel, taken by the same tools: clips of the scene and
  of the fractal one after another, each a film's JSON, a script or a path to a film that exists, cut to a
  stretch with `from` and `to`, joined by a cut, through black or by a dissolve. `films/reel/reel.json` goes from a
  stretch of `horizon.js` into the fractal and out to a stretch of `graphics.js`.
- **A film that draws**: `graphics` lays shapes over the picture: a line or an arrow, a circle or an arc, a
  rectangle, a small chart with a dot that walks along its curve, a picture. A shape can ride on the scene (its
  places in black hole radii, following the hole, the zoom and the pan) and read its numbers from the film, so a
  ring stays on the Einstein radius while a track moves it. `films/graphics/graphics.js` is a 34 s film made of these, with
  a camera that pans from the centre of a pair to its second black hole.
- **A film to start from**: `films/showreel/showreel.json` is a 50 s tour of what a film can do (the opening with its own
  title, a zoom with labels on the shadow, the lens changed by keyframes, orbiting stars, the sheet, two black
  holes merging). `node films/showreel/sound.mjs` writes its soundtrack, `films/showreel/out/showreel.wav`, to give
  `space_render` as `audio`; `node films/showreel/voice.mjs` then lays a narration over it
  (`films/showreel/out/showreel_voiced.wav`), spoken by a [VoiceStudio](https://github.com/debpalash/VoiceStudio) running on
  this machine, in a designed voice or in the voice of a recording named in `SHOWREEL_VOICE`. Rendered videos
  and sound files in `films/` stay out of git.
- **Five more films** in `films/`, each built on one thing the scene can do. `exposure.json`: trails that never
  fade and a field that only gravity moves, so the black hole draws a knot with its own pull. `rosette.json`
  (square): orbiting stars whose precession weaves a rosette, until a growing horizon takes them. `graph_paper.json`:
  the lens travelling over the lensed grid, wound up by Twist, then two lenses. `rapid.json` (60 fps): the opening
  stretched until the light takes four seconds to cross the frame. `waltz.json` (vertical, 60 fps): two black
  holes closing and parting over the sheet before they merge.
- **The zoom on its own**: `films/zoom/zoom.json` (60 fps, silent) pushes in from 1× to 8× on the photon ring, which
  stays a line of a pixel and a half, cuts between 1×, 2×, 4× and 8×, travels with the black hole over the lensed
  grid at 4× and pulls back with the trails streaking behind the camera.

### Watching films in the browser

The clapperboard button in the scene toolbar opens the film mode: a film plays live on the page, drawn as it plays
by the same players that render the mp4, so every frame on screen is the frame the video will have. When the
machine falls behind, a frame is stepped without being shown, and the film slows down rather than skip ahead. It
plays films of the scene, fractal films and reels, as JSON or as scripts. The panel opens a film from a file, or
from a file dropped anywhere on the page or text pasted onto it; it also lists the films opened before and the
films in `films/`, which are bundled with the page. A film whose shapes use a picture, or a reel that names
other files, asks for those files, and they can be opened or dropped next to the film; files in `films/` are
found by themselves. From Scene turns the scene as it is set now into a 20 s film. Under the picture there is Play
and Pause (Space or K) and the film's progress. Save MP4 renders the film on this machine at the quality chosen;
Film File and Copy hand over the film's own text. `?film=kerr_around` in the address opens a film of the library
straight away.

### Mandelbrot zoom

The film renderer has a fork that draws a zoom into the Mandelbrot set instead of the scene, as deep as asked:
×10¹⁵, where ordinary doubles give out, ×10³⁰⁰ or ×10¹⁰⁰⁰. A fractal film is one JSON object (target, depth or
pace, palette, frame); `window.space.fractal.guide()` and the `space_fractal_guide` tool give the format, and
`space_fractal_preview` and `space_fractal_render` (or `space.mjs fractal-preview` and `fractal-render`) draw it.
The camera falls into a Misiurewicz point, where the set has structure at every depth. That point is placed by
Newton's method on BigInt to as many bits as the deepest frame needs. Every pixel is drawn on the graphics card
as the offset of its orbit from that point's orbit (perturbation), with an exponent of its own so it never
underflows, and rebased so the zoom has no glitches. `"loop": true` makes a clip that falls forever when played
on repeat. A fractal film is a timeline too: the pace, the turn and the colours move along keyframes, and it takes
a fade, captions with a live ×10ⁿ, and shots. It can be written as a script in the films' own language
(`space.fractal.script`). `films/mandelbrot/mandelbrot.json` falls for 60 s to ×10⁶⁰, `films/mandelbrot_loop/mandelbrot_loop.json` is a 12 s
loop, and `films/mandelbrot_story/mandelbrot_story.js` tells a fall in words, speeding up past the depth where ordinary numbers give
out and stopping there.

On the page the ∞ button in the scene toolbar opens the same zoom live, in place of the particle scene. Its panel
picks the target, the colours and the speed, pauses (the still picture is redrawn sharp) and starts again, and
Save MP4 renders the fall from where the camera is as a 15, 30 or 60 s video on the visitor's own machine.

## Project Structure

```
src/
├── components/
│   ├── particle_canvas.tsx      # Animation loop, frame-rate cap, pointer and touch input
│   ├── control_panel.tsx        # Scene toolbar and the Settings panel
│   ├── film_mode.tsx            # The film mode: a film played live, opened and saved
│   ├── settings_body.tsx        # Every setting, built once with the page
│   ├── controls/                # Sliders, switches, presets, colours, the hint menu (hint_menu.tsx),
│   │                            # the intro debugger (intro_debugger.tsx, intro_track_list.tsx, intro_preset_bar.tsx)
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── scene.ts                 # The scene apart from the page: one frame from its inputs
│   ├── particle_simulation.ts   # The particle field as it is born, and the numbers a step is given
│   ├── field_step.ts            # The field's step, a vertex shader: flat and in 3D
│   ├── field_feedback.ts        # The field's buffers on the graphics card, the step's pass, the ring's light
│   ├── camera_pose.ts           # The 3D camera: where it stands and looks
│   ├── particle_renderer.ts     # WebGL passes: trails, particles, orbits, composite, space sheet
│   ├── webgl_shaders.ts         # GLSL sources and program helpers
│   ├── simulation_specs.ts      # Name, range, unit and meaning of every setting
│   ├── simulation_presets.ts    # Named snapshots of the settings
│   ├── intro_params.ts          # Every tunable number of the opening
│   ├── intro_timeline.ts        # Choreography of the opening
│   ├── intro_tracks.ts          # The opening as tracks and layers, for the debugger and films
│   ├── intro_presets.ts         # Built-in looks of the opening
│   ├── orbiters.ts              # Stars in real orbits around the black hole
│   ├── companion.ts             # A second black hole: the pair's orbit, merger and waves
│   ├── space_grid.ts            # The space sheet: its lines and where its well goes
│   ├── space_lattice.ts         # The space lattice: its lines in three dimensions
│   ├── ring_energy.ts           # Light that infalling matter leaves on the photon ring
│   ├── title_sprite.ts          # The opening's title rasterised for the lens
│   ├── black_hole_motion.ts     # Spring follow of the black hole
│   ├── base_speed.ts            # Base Speed range and the scroll dial
│   ├── frame_pacing.ts          # Keeps a one-off stall from making the scene jump
│   ├── random.ts                # Seeded random generator of a scene
│   ├── scene_api.ts             # window.space: the scene for agents and the console
│   ├── agent_values.ts          # How values given to the API and to films are checked
│   ├── film.ts                  # A film: its JSON format, the plan made from it, its guide
│   ├── film_script.ts           # A film written as a script, and the script's guide
│   ├── film_render.ts           # Plays a film in a scene of its own: mp4 and contact sheet
│   ├── film_live.ts             # Plays a film live on the page, paced by the clock (film_session.ts drives it)
│   ├── film_library.ts          # The films of films/, bundled for the film mode
│   ├── film_captions.ts         # Captions drawn over a film's frames
│   ├── reel.ts                  # A reel: several films in one video, its format and guide (reel_render.ts plays it)
│   ├── film_graphics.ts         # Shapes drawn over a film's frames: lines, circles, charts, pictures
│   └── caption_text.ts          # The marks a caption's text takes
├── store/
│   ├── particle_store.ts        # Simulation settings and runtime state
│   ├── settings_persistence.ts  # Keeps the current settings across reloads
│   ├── preset_store.ts          # Default, Schwarzschild and saved presets
│   ├── intro_debug_store.ts     # The intro debugger's state, the opening's numbers and title
│   ├── film_store.ts            # The film mode: the film in it, how it plays, the films opened before
│   └── intro_preset_store.ts    # Presets of the opening
├── hooks/                       # Colour palette selector, interaction hints
├── app.tsx                      # Main app component
├── main.tsx                     # Entry point; loads window.space in development or with ?agent
└── index.css                    # Global styles and the bundled fonts
mcp/space_mcp.mjs                # The space MCP server: films from a shell or an agent
films/                           # Example films (.json and .js) and the showreel's sound scripts
public/index.md                  # The page's description for agents
.claude/skills/space-scene/      # The manual for agents, with the knob map and the audit
```

## License

MIT. The fonts in `public/fonts` are under the SIL Open Font License; the Noto faces' copy of it is
`public/fonts/noto-OFL.txt`.
