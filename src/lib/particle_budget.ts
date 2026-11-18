// Adaptive particle budget: the simulation runs on the main thread every frame, so on a slow CPU or
// a fast display it can overrun the frame. The budget lowers the particle count until the simulation
// fits in a share of the frame, and raises it back once there is room again.

// Share of the frame the simulation may use; the rest is for drawing, React and the browser
const FRAME_SHARE = 0.4
// Frame interval never counts as shorter than a 240 Hz display's, so vsync-off runs stay sane
const MIN_FRAME_MS = 1000 / 240
const MIN_PARTICLES = 4000
const CHECK_INTERVAL_MS = 500
const GROW_AFTER_MS = 2000
const SMOOTHING = 0.1

export interface ParticleBudget {
  active: number
  requested: number
  simMs: number
  frameMs: number
  lastCheck: number
  calmSince: number
}

export function createParticleBudget (initial: number): ParticleBudget {
  return { active: initial, requested: initial, simMs: 0, frameMs: 1000 / 60, lastCheck: 0, calmSince: 0 }
}

// Feeds one frame's measurements and returns the particle count to simulate next
export function updateParticleBudget (
  budget: ParticleBudget,
  requested: number,
  simMs: number,
  frameMs: number,
  now: number,
  enabled: boolean
): number {
  if (!enabled) {
    budget.requested = requested
    budget.active = requested
    return requested
  }

  budget.simMs += (simMs - budget.simMs) * SMOOTHING
  budget.frameMs += (Math.max(frameMs, MIN_FRAME_MS) - budget.frameMs) * SMOOTHING
  // A new count from the slider is tried as asked; the budget trims it again only if it overruns
  if (requested !== budget.requested) {
    budget.requested = requested
    budget.active = requested
    budget.calmSince = now
  }
  if (now - budget.lastCheck < CHECK_INTERVAL_MS) return budget.active
  budget.lastCheck = now

  const allowedMs = budget.frameMs * FRAME_SHARE
  if (budget.simMs > allowedMs && budget.active > MIN_PARTICLES) {
    const factor = Math.min(Math.max(allowedMs / budget.simMs, 0.6), 0.92)
    budget.active = Math.max(MIN_PARTICLES, Math.round(budget.active * factor / 100) * 100)
    budget.calmSince = now
  } else if (budget.simMs < allowedMs * 0.6 && budget.active < requested && now - budget.calmSince > GROW_AFTER_MS) {
    budget.active = Math.min(requested, Math.round(budget.active * 1.1 / 100) * 100)
    budget.calmSince = now
  } else if (budget.simMs >= allowedMs * 0.6) {
    budget.calmSince = now
  }
  return budget.active
}
