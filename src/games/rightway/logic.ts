import type { Difficulty } from '../../types'

export type Category = 'greetings' | 'sharing' | 'queue' | 'space' | 'polite' | 'apology'

export interface Pose {
  /** actor raises one arm (waving / reaching) */
  armUp?: boolean
  /** actor leans toward the other character (grabbing / pushing) */
  lean?: number
  /** actor crowds the other character's personal space */
  close?: boolean
}

export interface Scenario {
  id: string
  /** what the narrator describes while the scene plays */
  text: string
  /** emoji shown in the action bubble above the scene */
  bubble: string
  /** true when the behaviour is already kind/correct */
  isFine: boolean
  category: Category
  /** spoken after the child answers */
  explain: string
  pose: Pose
}

export const SCENARIOS: Scenario[] = [
  { id: 'wave', text: 'Maya sees her friend and waves hello.', bubble: '👋', isFine: true, category: 'greetings', explain: 'Waving hello is a friendly greeting.', pose: { armUp: true } },
  { id: 'ignore', text: 'Ben turns away when his friend says hi.', bubble: '🙈', isFine: false, category: 'greetings', explain: 'It is kinder to say hi back.', pose: { lean: -0.3 } },
  { id: 'share', text: 'Leo shares his blocks with a friend.', bubble: '🧸', isFine: true, category: 'sharing', explain: 'Sharing helps everyone have fun.', pose: { armUp: true } },
  { id: 'grab', text: 'Ravi grabs a toy from someone’s hands.', bubble: '✋', isFine: false, category: 'sharing', explain: 'Better to ask, "Can I have a turn?"', pose: { lean: 0.4 } },
  { id: 'sorry', text: 'Ada bumps someone and says sorry.', bubble: '🙏', isFine: true, category: 'apology', explain: 'Saying sorry shows you care.', pose: { armUp: true } },
  { id: 'close', text: 'Tom stands very close to someone’s face.', bubble: '😬', isFine: false, category: 'space', explain: 'Give friends a little more space.', pose: { close: true, lean: 0.2 } },
  { id: 'please', text: 'Nina says please when she asks for help.', bubble: '🙂', isFine: true, category: 'polite', explain: 'Polite words make people feel good.', pose: {} },
  { id: 'push', text: 'Sam pushes to the front of the line.', bubble: '😠', isFine: false, category: 'queue', explain: 'Wait your turn in the line.', pose: { lean: 0.4 } },
]

const ROUNDS: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 8 }
export function rounds(difficulty: Difficulty): number {
  return ROUNDS[difficulty]
}

/** Pick the next scenario, never repeating the previous one. */
export function nextScenario(
  prevId: string | null,
  rng: () => number = Math.random,
): Scenario {
  const pool = SCENARIOS.filter((s) => s.id !== prevId)
  return pool[Math.floor(rng() * pool.length)]
}
