// Motion of the black hole on screen: a critically damped spring toward its target, which makes
// it feel heavy.

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
