# Particle Universe ⭐

A stunning React SPA featuring an interactive particle animation with black hole physics and customizable visual effects.

## Features

- 🌌 Warp speed particle animation
- ⚫ Interactive black hole with gravitational effects
- 🎨 Customizable color palette with weighted distribution
- ⚙️ Real-time control panel for physics parameters
- 🚀 Smooth scroll-based speed transitions
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
- **Touch**: Drag the black hole with a finger; swipe elsewhere to scroll
- **Scroll**: Fall toward the black hole and accelerate; at the bottom you cross the event horizon
- **Intro debugger** (Shift+D, `?debug` in the address, or Settings → Intro Debugger): timeline with phase markers, playback speed from 0 (stopped) to 2×, frame step, loop, switches to turn each effect of the opening off, and every tunable number of the opening (about 60, grouped; kept across reloads in this browser, with reset and "copy changed" to share the values)
- **⚙️ Control Panel**: Adjust physics parameters and colors

### Parameters

- **Particles**: Number of particles (1000-50000; 24000 by default, 12000 on phones)
- **Frame Rate**: AUTO follows the display refresh rate; 30-144 caps it. Motion speed does not depend on the frame rate
- **Pulse Intensity**: Star twinkling effect (0-1)
- **Base Speed**: Initial particle velocity
- **Black Hole Size**: Shadow radius as a share of the screen's short side
- **Gravity Reach**: How far gravity reaches, in black hole radii
- **Gravity**: Gravitational pull strength
- **Orbital Force**: Tangential force around black hole
- **Lensing Radius**: Einstein ring radius, in black hole radii

## Project Structure

```
src/
├── components/
│   ├── particle_canvas.tsx    # Animation loop, input and resize handling
│   ├── control_panel.tsx      # Settings UI
│   ├── color_palette.tsx      # Color management
│   ├── blackhole_indicator.tsx
│   └── scroll_indicator.tsx   # Interaction hints, speed bar, horizon crossing message
├── lib/
│   ├── particle_simulation.ts # Particle state and per-frame physics
│   ├── particle_renderer.ts   # WebGL passes: trail fade, particles, title, black hole composite
│   ├── intro_timeline.ts      # Choreography of the opening seconds
│   ├── black_hole_motion.ts   # Spring follow and the scroll journey to the event horizon
│   ├── title_sprite.ts        # Intro title rasterised for the lens
│   └── webgl_shaders.ts       # GLSL sources and program helpers
├── store/
│   └── particle_store.ts      # Zustand state management
├── app.tsx                    # Main app component
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## License

MIT

