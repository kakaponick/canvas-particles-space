// Motion of the black hole on screen: a critically damped spring toward its target, which makes
// it feel heavy, and the scroll journey that ends in crossing the event horizon.

export interface Spring2D {
  x: number
  y: number
  vx: number
  vy: number
}

const MAX_SPRING_STEP = 1 / 120

// Critically damped: reaches the target without overshoot; `frequency` in radians per second
export function stepSpring (spring: Spring2D, targetX: number, targetY: number, dt: number, frequency: number) {
  const steps = Math.max(1, Math.ceil(dt / MAX_SPRING_STEP))
  const h = dt / steps
  const stiffness = frequency * frequency
  const damping = 2 * frequency
  for (let i = 0; i < steps; i++) {
    spring.vx += (stiffness * (targetX - spring.x) - damping * spring.vx) * h
    spring.vy += (stiffness * (targetY - spring.y) - damping * spring.vy) * h
    spring.x += spring.vx * h
    spring.y += spring.vy * h
  }
}

export interface ScrollJourney {
  armed: boolean
  crossed: boolean
  crossedAt: number
  // 0 while falling in, 1 after the crossing: the calm on the other side
  calm: number
}

export interface JourneyFrame {
  // Scroll progress after the crossing calm is applied; drives speed and approach
  progress: number
  flash: number
  // Black hole growth as the visitor falls toward it
  approach: number
}

const CROSS_AT = 0.995
const REARM_BELOW = 0.9

export function createScrollJourney (): ScrollJourney {
  return { armed: true, crossed: false, crossedAt: 0, calm: 0 }
}

export function stepScrollJourney (
  journey: ScrollJourney,
  scrollProgress: number,
  time: number,
  dt: number,
  out: JourneyFrame
) {
  if (journey.armed && scrollProgress >= CROSS_AT) {
    journey.armed = false
    journey.crossed = true
    journey.crossedAt = time
  } else if (!journey.armed && scrollProgress < REARM_BELOW) {
    journey.armed = true
    journey.crossed = false
  }

  const calmRate = journey.crossed ? 1 / 1.2 : 1 / 1.5
  const calmTarget = journey.crossed ? 1 : 0
  journey.calm += Math.sign(calmTarget - journey.calm) * Math.min(Math.abs(calmTarget - journey.calm), calmRate * dt)

  const sinceCrossing = time - journey.crossedAt
  out.flash = journey.crossed && sinceCrossing < 3
    ? Math.min(sinceCrossing / 0.15, 1) * Math.exp(-Math.max(sinceCrossing - 0.15, 0) * 2.2)
    : 0

  out.progress = scrollProgress * (1 - journey.calm)
  out.approach = 1 + 3 * out.progress * out.progress * out.progress
  return out
}
