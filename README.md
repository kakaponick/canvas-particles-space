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
- **WebGL** - Instanced particle rendering with a gravitational lensing pass (WebGL2, or WebGL1 with `ANGLE_instanced_arrays`)

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
- **Orbiting Stars**: stars with real orbits around the black hole (**Count**, 0 = none): ellipses that precess, faster the closer they come, with a trace that stays lit for **Trail** seconds. **Orbit Size**, **Eccentricity** and **Orbit Speed** (its sign is the direction) shape them; a star that crosses the Event Horizon lights the photon ring
- **Space Grid**: two grids for explaining curved space, both off until their brightness is above 0. **Sheet** is a grid seen at an angle (**Sheet Tilt**) and dented where the black hole sits (**Well Depth**); the gravitational wave of the opening ripples through it. **Lensed Grid** is a flat grid on the sky read through the lens, so it shows what the lens does

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
│   ├── particle_simulation.ts # Particle state and per-frame physics
│   ├── particle_renderer.ts   # WebGL passes: trail fade, particles, title, black hole composite, space sheet
│   ├── intro_timeline.ts      # Choreography of the opening seconds
│   ├── black_hole_motion.ts   # Spring follow of the black hole
│   ├── base_speed.ts          # Base Speed range and the scroll dial
│   ├── title_sprite.ts        # Intro title rasterised for the lens
│   ├── orbiters.ts            # Stars in real orbits around the black hole
│   ├── space_grid.ts          # The space sheet: its lines and where its well goes
│   └── webgl_shaders.ts       # GLSL sources and program helpers
├── store/
│   ├── particle_store.ts      # Zustand state management
│   └── settings_persistence.ts # Keeps the current settings across reloads
├── app.tsx                    # Main app component
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## License

MIT

