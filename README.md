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

## Controls

- **Mouse Movement**: Black hole follows your cursor (when attached)
- **Click Canvas**: Toggle black hole attachment
- **Scroll**: Increase particle speed
- **⚙️ Control Panel**: Adjust physics parameters and colors

### Parameters

- **Particles**: Number of particles (1000-20000)
- **Frame Rate**: AUTO follows the display refresh rate; 30-144 caps it. Motion speed does not depend on the frame rate
- **Pulse Intensity**: Star twinkling effect (0-1)
- **Base Speed**: Initial particle velocity
- **Mouse Radius**: Black hole influence area
- **Gravity**: Gravitational pull strength
- **Orbital Force**: Tangential force around black hole
- **Event Horizon**: Point of no return

## Project Structure

```
src/
├── components/
│   ├── particle_canvas.tsx    # Animation loop, input and resize handling
│   ├── control_panel.tsx      # Settings UI
│   ├── color_palette.tsx      # Color management
│   ├── start_overlay.tsx      # Initial screen
│   ├── blackhole_indicator.tsx
│   └── scroll_indicator.tsx
├── lib/
│   ├── particle_simulation.ts # Particle state and per-frame physics
│   ├── particle_renderer.ts   # WebGL passes: trail fade, particles, lensing composite
│   └── webgl_shaders.ts       # GLSL sources and program helpers
├── store/
│   └── particle_store.ts      # Zustand state management
├── app.tsx                    # Main app component
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## License

MIT

