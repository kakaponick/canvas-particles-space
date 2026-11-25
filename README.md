# Particle Universe ⭐

A stunning React SPA featuring an interactive particle animation with black hole physics and customizable visual effects.

## Features

- 🌌 Warp speed particle animation
- ⚫ Interactive black hole with gravitational effects
- 🎨 Customizable color palette with weighted distribution
- ⚙️ Real-time control panel for physics parameters
- 💫 Dynamic particle pulsing and depth effects

## Tech Stack

- **React** 18.2 - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **WebGL2** - Instanced particle rendering with a gravitational lensing pass

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Opening

The page opens on its own, no click needed. A star brightens and explodes: its light races outward at
the on-screen speed of light, visible only where it strikes dust, which keeps glowing for a moment
(a light echo). The ejected matter follows more slowly and becomes the particle field. The core's light
reddens away as it collapses, a black hole forms, rings down and sends out a gravitational wave that
ripples the background stars, swallows the title and then drifts to your cursor. With the system
"reduce motion" setting the explosion, fronts and wobble are skipped and the scene fades in.

## Controls

- **Mouse Movement**: The black hole follows your cursor with inertia
- **Click Canvas**: Anchor the black hole where it is, or release it to follow again
- **Scroll**: Change Base Speed over the scene; down is faster, up is slower
- **Touch**: Drag the black hole with a finger; swipe up or down elsewhere to change Base Speed
- **Intro debugger** (the timeline button at the top right, Alt+Shift+D, or `?debug` in the address): timeline with phase markers (drag a moment, or focus it and use the arrows, to retime it), playback speed from 0.05× to 2×, frame step, loop, switches to turn each effect of the opening off, and every tunable number of the opening (about 60, grouped; kept across reloads in this browser, with reset and "copy changed" to share the values)
- **⚙️ Control Panel**: Adjust physics parameters and colors; Esc opens and closes it, and the current settings are kept in this browser across reloads

### Parameters

- **Particle Count**: Number of particles (1000-50000; 24000 by default, 12000 on phones)
- **FPS Limit**: AUTO follows the display refresh rate; 30-144 caps it. Motion speed does not depend on the frame rate
- **FPS Counter**: Shows the measured frame rate beside the buttons at the top right; off by default, kept per device
- **Pulse Intensity**: Star twinkling effect (0-1)
- **Base Speed**: Speed of the flight through space, also set by scrolling
- **Black Hole Size**: Shadow radius as a share of the screen's short side
- **Gravity Reach**: How far gravity reaches, in black hole radii
- **Gravity**: Gravitational pull strength
- **Orbital Force**: Tangential force around black hole
- **Einstein Radius**: Einstein ring radius, in black hole radii
- **Presets**: **Default** is tuned for the look; **Schwarzschild** is a real non-rotating black hole as far as the scene shows one: a point-mass lens with one mirrored image inside the Einstein ring, no twist, and capture at the edge of the shadow. Every length around the hole is in black hole radii, so Black Hole Size alone scales it
- **Orbiting Stars**: stars with real orbits around the black hole (**Count**, 0 = none): ellipses that precess, faster the closer they come, with a trace that stays lit for **Trail** seconds. **Orbit Size**, **Eccentricity** and **Orbit Speed** (its sign is the direction) shape them; a star that crosses the Event Horizon lights the photon ring
- **Second Black Hole**: a companion of **Size** (in main hole radii, 0 = none) at **Distance** from the main one. The two circle their common centre at the rate Kepler's law gives, faster as they close in (**Orbit Speed** scales it, its sign is the direction), each with its own shadow, lens, ring, gravity and well in the sheet, and send out a spiral of gravitational **Waves**. Below a Distance of 1 + Size their shadows overlap and the main hole grows by the companion's mass; at 0 they are one, which rings and sends a last wave
- **Zoom**: magnifies the view around the black hole, which stays where it is on the screen
- **Space Grid**: two grids for explaining curved space, both off until their brightness is above 0. **Sheet** is a grid seen at an angle (**Sheet Tilt**) and dented where the black hole sits (**Well Depth**); the gravitational wave of the opening ripples through it. **Lensed Grid** is a flat grid on the sky read through the lens, so it shows what the lens does

## Films

The scene can be rendered to a short mp4 (1-180 s, H.264, up to 4K) from one JSON description: its length and
frame, a seed, starting settings, the opening as a clip, keyframes for any setting, captions and an optional
audio track. The same film is the same video on any machine.

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

- **For AI agents**: the `space` MCP server (`mcp/space_mcp.mjs`, listed in `.mcp.json`) has four tools:
  `space_guide` (the format and recipes), `space_describe` (what can be set), `space_preview` (frames of the film
  side by side) and `space_render` (the mp4). Run `pnpm build` first; it needs Node 22+ and Chrome, Chromium or Edge.
- **By hand**: open the page with `?agent` and call `await space.film.render(film, { download: 'film.mp4' })`
  in the console; `space.film.guide()` prints the format.
- **A film to start from**: `films/showreel.json` is a 50 s tour of what a film can do (the opening with its own
  title, a zoom with labels on the shadow, the lens changed by keyframes, orbiting stars, the sheet, two black
  holes merging). `node films/showreel_sound.mjs` writes its soundtrack, `films/showreel.wav`, to give
  `space_render` as `audio`; `node films/showreel_voice.mjs` then lays a narration over it
  (`films/showreel_voiced.wav`), spoken by a [VoiceStudio](https://github.com/debpalash/VoiceStudio) running on
  this machine, in a designed voice or in the voice of a recording named in `SHOWREEL_VOICE`. Rendered videos
  and sound files in `films/` stay out of git.
- **Five more films** in `films/`, each built on one thing the scene can do. `exposure.json`: trails that never
  fade and a field that only gravity moves, so the black hole draws a knot with its own pull. `rosette.json`
  (square): orbiting stars whose precession weaves a rosette, until a growing horizon takes them. `graph_paper.json`:
  the lens travelling over the lensed grid, wound up by Twist, then two lenses. `rapid.json` (60 fps): the opening
  stretched until the light takes four seconds to cross the frame. `waltz.json` (vertical, 60 fps): two black
  holes closing and parting over the sheet before they merge.

## Project Structure

```
src/
├── components/
│   ├── particle_canvas.tsx    # Animation loop, input and resize handling
│   ├── control_panel.tsx      # Settings panel shell and shortcuts
│   ├── settings_body.tsx      # Every setting, built once with the page
│   ├── color_palette.tsx      # Color management
│   ├── blackhole_indicator.tsx
│   └── interaction_hints.tsx  # Hints for the interactions not tried yet
├── lib/
│   ├── scene.ts               # The scene apart from the page: one frame from its inputs
│   ├── random.ts              # Seeded random generator of a scene
│   ├── particle_simulation.ts # Particle state and per-frame physics
│   ├── particle_renderer.ts   # WebGL passes: trail fade, particles, title, black hole composite, space sheet
│   ├── intro_timeline.ts      # Choreography of the opening seconds
│   ├── black_hole_motion.ts   # Spring follow of the black hole
│   ├── base_speed.ts          # Base Speed range and the scroll dial
│   ├── title_sprite.ts        # Intro title rasterised for the lens
│   ├── orbiters.ts            # Stars in real orbits around the black hole
│   ├── companion.ts           # A second black hole: the pair's orbit, merger and waves
│   ├── space_grid.ts          # The space sheet: its lines and where its well goes
│   ├── webgl_shaders.ts       # GLSL sources and program helpers
│   ├── scene_api.ts           # window.space: the scene for agents and the console
│   ├── agent_values.ts        # How settings and parameters given to the API are checked
│   ├── film.ts                # A film: its JSON format, the plan made from it, its guide
│   ├── film_render.ts         # Plays a film in a scene of its own: mp4 and contact sheet
│   └── film_captions.ts       # Captions drawn over a film's frames
├── store/
│   ├── particle_store.ts      # Zustand state management
│   └── settings_persistence.ts # Keeps the current settings across reloads
├── app.tsx                    # Main app component
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## License

MIT

