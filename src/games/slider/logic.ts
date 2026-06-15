import type { Difficulty } from '../../types'

/**
 * "Slide Queue" — a patience / turn-taking game. The child stands in a line at
 * a playground slide. Each kid ahead climbs up and slides down, one at a time.
 * The child has to *wait* until everyone in front has had a turn before it is
 * finally their turn to slide. Pure config + helpers so it can be unit-tested
 * without a 3D scene.
 */
export interface SliderConfig {
  /** how many kids are ahead of the child at the start of each round */
  queue: number
  /** how long each kid ahead takes on the slide, in ms — longer = more waiting */
  turnMs: number
  /** how many of the child's own turns are needed to win a session */
  goal: number
}

export const CONFIG: Record<Difficulty, SliderConfig> = {
  easy: { queue: 2, turnMs: 1800, goal: 3 },
  medium: { queue: 3, turnMs: 2200, goal: 5 },
  hard: { queue: 4, turnMs: 2600, goal: 7 },
}

/** Friendly shirt colours for the kids waiting in line. */
export const KID_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** The child's own bright shirt colour, kept distinct from the queue. */
export const YOU_COLOR = '#ff4f9a'

/** Pick a stable list of shirt colours for the kids ahead in a round. */
export function queueColors(count: number, rng: () => number = Math.random): string[] {
  return Array.from({ length: count }, () => KID_COLORS[Math.floor(rng() * KID_COLORS.length)])
}
