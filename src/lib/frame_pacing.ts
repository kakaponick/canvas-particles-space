// Keeps a one-off long frame from moving the scene by everything it missed. A stall on the main thread
// then passes unnoticed, while a display or device that is lastingly slower keeps its true speed.

// A frame this many times longer than the recent ones counts as a stall
const STALL_FACTOR = 2.5
const SMOOTHING = 0.1

export interface FramePacer {
  typicalMs: number
}

export function createFramePacer (): FramePacer {
  return { typicalMs: 1000 / 60 }
}

// Returns the time this frame should advance the scene by
export function pacedFrameMs (pacer: FramePacer, elapsedMs: number): number {
  const stallMs = pacer.typicalMs * STALL_FACTOR
  const pacedMs = elapsedMs > stallMs ? pacer.typicalMs : elapsedMs
  // Long frames still raise the typical time, so a lasting slowdown is accepted within a few frames
  pacer.typicalMs += (Math.min(elapsedMs, stallMs) - pacer.typicalMs) * SMOOTHING
  return pacedMs
}
