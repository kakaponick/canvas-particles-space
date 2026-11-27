// Work another module does on the page's own frames: `before` runs just before the scene reads its settings
// and advances, `after` once the frame is drawn, with the scene. The page's loop (particle_canvas.tsx) calls
// them; a film played inside the scene (film_in_scene.ts) moves its settings in one and draws its graphics
// and captions over the frame in the other. Empty, they cost the loop two checks of a null
import type { Scene } from './scene'

export const sceneHooks: { before: (() => void) | null, after: ((scene: Scene) => void) | null } = { before: null, after: null }
