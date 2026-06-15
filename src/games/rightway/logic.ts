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

/** Concrete props the 3D scene draws so the picture matches the sentence. */
export interface SceneCue {
  /** actor is turned away from the friend (ignoring) */
  turnAway?: boolean
  /** a toy/blocks held out kindly ('offer') or snatched away ('grab') */
  toy?: 'offer' | 'grab'
  /** a queue of waiting kids (the actor cuts / waits in it) */
  line?: boolean
  /** a little bump star between the two characters */
  bump?: boolean
  /** a polite "please" heart cue */
  polite?: boolean
  /** the friend is happy and waving back (kind greeting) */
  waveBack?: boolean
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
  /** extra objects the scene draws to match the sentence */
  scene: SceneCue
}

export const SCENARIOS: Scenario[] = [
  { id: 'wave', text: 'Maya sees her friend and waves hello.', bubble: '👋', isFine: true, category: 'greetings', explain: 'Waving hello is a friendly greeting.', pose: { armUp: true }, scene: { waveBack: true } },
  { id: 'ignore', text: 'Ben turns away when his friend says hi.', bubble: '🙈', isFine: false, category: 'greetings', explain: 'It is kinder to say hi back.', pose: {}, scene: { turnAway: true } },
  { id: 'share', text: 'Leo shares his blocks with a friend.', bubble: '🧸', isFine: true, category: 'sharing', explain: 'Sharing helps everyone have fun.', pose: { armUp: true }, scene: { toy: 'offer' } },
  { id: 'grab', text: 'Ravi grabs a toy from someone’s hands.', bubble: '✋', isFine: false, category: 'sharing', explain: 'Better to ask, "Can I have a turn?"', pose: { lean: 0.4 }, scene: { toy: 'grab' } },
  { id: 'sorry', text: 'Ada bumps someone and says sorry.', bubble: '🙏', isFine: true, category: 'apology', explain: 'Saying sorry shows you care.', pose: { armUp: true }, scene: { bump: true } },
  { id: 'close', text: 'Tom stands very close to someone’s face.', bubble: '😬', isFine: false, category: 'space', explain: 'Give friends a little more space.', pose: { close: true, lean: 0.2 }, scene: {} },
  { id: 'please', text: 'Nina says please when she asks for help.', bubble: '🙂', isFine: true, category: 'polite', explain: 'Polite words make people feel good.', pose: {}, scene: { polite: true } },
  { id: 'push', text: 'Sam pushes to the front of the line.', bubble: '😠', isFine: false, category: 'queue', explain: 'Wait your turn in the line.', pose: { lean: 0.4 }, scene: { line: true } },
]

const ROUNDS: Record<Difficulty, number> = { easy: 3, medium: 5, hard: 7 }
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
