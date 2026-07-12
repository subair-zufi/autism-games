/**
 * Pure game logic for Good Choice — no React, no I/O, fully testable.
 *
 * Level design (mirrors the emotion battery, so attempts are psychometrically
 * comparable):
 *  - Difficulty = discrimination required, not round count. The level decides
 *    which option roles are shown: Easy contrasts kind vs. clearly wrong,
 *    Moderate adds the plausible-passive distractor, Hard drops the obvious
 *    wrong option and forces the sensitive kind-vs-passive discrimination.
 *  - Sampled composition: a level is 5 constructs × 2 = 10 trials, sampled
 *    from a bank of 8 situations per construct. Sessions therefore rotate
 *    through the enlarged bank — repeated sessions accumulate per-construct
 *    evidence across different items without lengthening any single session
 *    (fatigue) — while the per-construct quota is fixed.
 *  - Stratified order: constructs are dealt in shuffled cycles — each of the
 *    5 constructs appears once in the first half and once in the second.
 *  - Chance level: 1/2 on Easy and Hard, 1/3 on Moderate; `levelChance` feeds
 *    `scoreLevel` so recorded accuracy is chance-corrected and comparable.
 */
import type { Difficulty } from '../../types'
import { shuffle } from '../emotionVocab'
import {
  CONSTRUCTS,
  situationsFor,
  type Construct,
  type Option,
  type Role,
  type Situation,
} from './content'

// Re-exported so the 3D scene and UI import everything from one module.
export type { Construct, Option, PeerMood, Role, Situation } from './content'
export { CONSTRUCTS, SITUATIONS } from './content'

// Scoring is shared across level games; re-exported so imports stay uniform.
export {
  PASS_THRESHOLD,
  MASTERY_THRESHOLD,
  scoreLevel,
  type LevelSummary,
} from '../progression'

/** Trials per level: two sampled situations per construct (5 constructs × 2). */
export const ACTIVITY_COUNT = 10

/** Which graded option roles a level shows (order here is pre-shuffle). */
export const OPTION_ROLES: Record<Difficulty, Role[]> = {
  easy: ['kind', 'wrong'],
  medium: ['kind', 'passive', 'wrong'],
  hard: ['kind', 'passive'],
}

export interface Trial {
  situation: Situation
  /** the level's option subset, in shuffled display order */
  choices: Option[]
}

/** Build one level's trials. */
export function buildLevel(difficulty: Difficulty, rng: () => number = Math.random): Trial[] {
  const roles = OPTION_ROLES[difficulty]
  // Two stratified cycles: every construct once per cycle. Each construct's
  // pile is shuffled first, so the two popped situations are a fresh sample
  // of its eight banked ones — sessions rotate through the bank.
  const remaining = new Map<Construct, Situation[]>(
    CONSTRUCTS.map((c) => [c, shuffle(situationsFor(c), rng)]),
  )
  const trials: Trial[] = []
  const cycles = Math.ceil(ACTIVITY_COUNT / CONSTRUCTS.length)
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const construct of shuffle(CONSTRUCTS, rng)) {
      const pile = remaining.get(construct)!
      const situation = pile.pop()
      if (!situation) continue
      trials.push({
        situation,
        choices: shuffle(
          situation.options.filter((o) => roles.includes(o.role)),
          rng,
        ),
      })
    }
  }
  return trials
}

/** Guessing probability of one trial (1/2 on Easy and Hard, 1/3 on Moderate). */
export function trialChance(t: Trial): number {
  return 1 / t.choices.length
}

/** Mean guessing probability across a level — feed into `scoreLevel` so the
 *  recorded adjusted accuracy is comparable across levels. */
export function levelChance(trials: Trial[]): number {
  if (trials.length === 0) return 0
  return trials.reduce((sum, t) => sum + trialChance(t), 0) / trials.length
}

/** Per-construct correct/total tallies for the level_result analytics payload. */
export function tallyByConstruct(
  answers: Array<{ construct: Construct; correct: boolean }>,
): Record<Construct, { correct: number; total: number }> {
  const tally = Object.fromEntries(
    CONSTRUCTS.map((c) => [c, { correct: 0, total: 0 }]),
  ) as Record<Construct, { correct: number; total: number }>
  for (const a of answers) {
    tally[a.construct].total += 1
    if (a.correct) tally[a.construct].correct += 1
  }
  return tally
}
