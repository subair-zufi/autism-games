/**
 * Pure game logic for Right or Wrong — no React, no I/O, fully testable.
 *
 * Level design (mirrors Good Choice, so attempts are psychometrically
 * comparable):
 *  - The response set is always the same two buttons (okay / not okay), so
 *    guessing chance is 1/2 at every level. Difficulty is a property of the
 *    stimulus tier instead: Easy shows only `clear` behaviours, Hard only
 *    `subtle` ones (passive omissions and looks-odd-but-fine behaviours),
 *    Moderate mixes one clear and one subtle behaviour per construct.
 *  - Sampled composition: a level is 5 constructs × 2 = 10 trials (5 okay /
 *    5 not-okay), but each tier×valence cell of the bank holds two authored
 *    exemplars and the builder samples one per build. Sessions therefore
 *    rotate through the enlarged bank — repeated sessions accumulate
 *    per-construct evidence across different items without lengthening any
 *    single session (fatigue) — while every level keeps the same composition
 *    invariants (per-construct quota, 5/5 valence balance, tier recipe).
 *  - Stratified order: constructs are dealt in shuffled cycles — each of the
 *    5 constructs appears once in the first half and once in the second.
 *  - Chance level: constant 1/2; `CHANCE` feeds `scoreLevel` so recorded
 *    accuracy is chance-corrected and comparable with the 2-choice levels of
 *    the other games.
 */
import type { Difficulty } from '../../types'
import { shuffle } from '../emotionVocab'
import {
  behaviorsFor,
  CONSTRUCTS,
  type Behavior,
  type Construct,
  type StimulusPool,
  type Tier,
} from './content'

// Re-exported so the 3D scene and UI import everything from one module.
export type { Behavior, BiText, Construct, Pose, SceneCue, StimulusPool, Tier } from './content'
export { BEHAVIORS, CONSTRUCTS } from './content'

// Scoring is shared across level games; re-exported so imports stay uniform.
export {
  PASS_THRESHOLD,
  MASTERY_THRESHOLD,
  scoreLevel,
  type LevelSummary,
} from '../progression'

/** Trials per level: two behaviours per construct (5 constructs × 2). */
export const ACTIVITY_COUNT = 10

/** Guessing probability: always a 2-button judgment, at every level. */
export const CHANCE = 1 / 2

/** Which stimulus tiers a level draws from. */
export const LEVEL_TIERS: Record<Difficulty, Tier[]> = {
  easy: ['clear'],
  medium: ['clear', 'subtle'],
  hard: ['subtle'],
}

/**
 * The two behaviours one construct contributes to a level — always one okay
 * and one not-okay. Easy draws from the clear cells, Hard from the subtle
 * cells; Moderate takes one of each tier, coin-flipping which valence is the
 * subtle one so "subtle = not okay" never becomes a learnable rule. Each cell
 * holds two authored exemplars and the concrete item is sampled per build, so
 * repeated sessions rotate through the bank instead of replaying a fixed set.
 */
function constructPair(
  construct: Construct,
  pool: StimulusPool,
  difficulty: Difficulty,
  rng: () => number,
): Behavior[] {
  const items = behaviorsFor(construct, pool)
  const pick = (tier: Tier, isFine: boolean) => {
    const cell = items.filter((b) => b.tier === tier && b.isFine === isFine)
    return cell[Math.floor(rng() * cell.length)]
  }
  if (difficulty === 'easy') return [pick('clear', true), pick('clear', false)]
  if (difficulty === 'hard') return [pick('subtle', true), pick('subtle', false)]
  return rng() < 0.5
    ? [pick('clear', true), pick('subtle', false)]
    : [pick('subtle', true), pick('clear', false)]
}

/**
 * Build one level's trials from the given pool ('training' for practice,
 * 'probe' for Assessment mode — held-out behaviours only).
 */
export function buildLevel(
  difficulty: Difficulty,
  rng: () => number = Math.random,
  pool: StimulusPool = 'training',
): Behavior[] {
  // Two stratified cycles: every construct once per cycle, then repeat with
  // each construct's remaining behaviour.
  const remaining = new Map<Construct, Behavior[]>(
    CONSTRUCTS.map((c) => [c, shuffle(constructPair(c, pool, difficulty, rng), rng)]),
  )
  const trials: Behavior[] = []
  const cycles = Math.ceil(ACTIVITY_COUNT / CONSTRUCTS.length)
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const construct of shuffle(CONSTRUCTS, rng)) {
      const behavior = remaining.get(construct)!.pop()
      if (behavior) trials.push(behavior)
    }
  }
  return trials
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

/**
 * Correct/total split by item valence (okay vs not-okay behaviours) — the
 * response-bias readout: a child who answers "okay" to everything scores 100%
 * on `fine` and 0% on `needsFixing`.
 */
export function tallyByValence(
  answers: Array<{ isFine: boolean; correct: boolean }>,
): { fine: { correct: number; total: number }; needsFixing: { correct: number; total: number } } {
  const tally = {
    fine: { correct: 0, total: 0 },
    needsFixing: { correct: 0, total: 0 },
  }
  for (const a of answers) {
    const bucket = a.isFine ? tally.fine : tally.needsFixing
    bucket.total += 1
    if (a.correct) bucket.correct += 1
  }
  return tally
}
