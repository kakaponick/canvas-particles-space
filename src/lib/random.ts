// A seeded random generator (mulberry32). Each scene owns one, so the same seed gives the same field,
// frame for frame; the page seeds it differently on every load, a film with the seed it names.
export interface Random {
  state: number
}

export function createRandom (seed: number): Random {
  return { state: seed | 0 }
}

export function seedRandom (random: Random, seed: number) {
  random.state = seed | 0
}

// A seed for a scene that does not have to repeat
export function randomSeed () {
  return Math.floor(Math.random() * 0x100000000)
}

// The next number in [0, 1)
export function nextRandom (random: Random): number {
  let t = random.state = (random.state + 0x6D2B79F5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
