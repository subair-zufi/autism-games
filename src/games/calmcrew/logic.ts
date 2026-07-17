import type { Difficulty } from '../../types'
import { ALL_EMOTION_IDS, type EmotionId } from '../emotionVocab'

/**
 * Calm Crew — emotion *regulation* (the "control" skill), not recognition.
 *
 * Every other emotion game asks the child to read a feeling off a face or clip
 * and label it. This one starts where those stop: a situation stirs up a big
 * feeling, a Feelings Meter climbs, and the round only ends when the child
 * brings it back down by *performing* a calming strategy — paced balloon
 * breathing, counting to ten, or a guided coping action. The measured skill is
 * doing something about the feeling, so the interaction is an activity, never a
 * multiple-choice tap.
 *
 * A round has three beats:
 *  1. name it   — the child names the feeling the situation stirs up (a light
 *                 identification tie-in, and the appraisal step of regulation);
 *  2. choose it — the child picks a calming tool from the toolkit;
 *  3. do it     — the child performs the tool; each completed step of the
 *                 activity drops the meter until it reaches "calm".
 *
 * Two design commitments, both pedagogical:
 *  - *Nothing is punished.* Every strategy calms the meter and is rewarded —
 *    the game never tells a child their way of self-soothing was "wrong".
 *  - Breathing and counting are always the right answer *and* always available,
 *    so the child over-learns the two portable skills they can use anywhere;
 *    the coping actions (ask / take-a-break / squeeze) earn the extra "and it
 *    helped!" bonus only when they actually fit the situation.
 */

// ---- Strategies (the calming toolkit) --------------------------------------

export type StrategyId = 'breathe' | 'count' | 'ask' | 'walk' | 'squeeze'

/** How the strategy is performed — drives which mini-activity the game shows. */
export type StrategyKind = 'breath' | 'count' | 'quick'

export interface StrategyMeta {
  id: StrategyId
  emoji: string
  kind: StrategyKind
}

export const STRATEGIES: StrategyMeta[] = [
  { id: 'breathe', emoji: '🎈', kind: 'breath' },
  { id: 'count', emoji: '🔢', kind: 'count' },
  { id: 'ask', emoji: '🙋', kind: 'quick' },
  { id: 'walk', emoji: '🚶', kind: 'quick' },
  { id: 'squeeze', emoji: '🤲', kind: 'quick' },
]

export function strategyMeta(id: StrategyId): StrategyMeta {
  return STRATEGIES.find((s) => s.id === id)!
}

/** The two portable skills that always calm and are always offered. */
export const UNIVERSAL_STRATEGIES: StrategyId[] = ['breathe', 'count']

// ---- Triggers (the situations that stir a feeling) -------------------------

export type TriggerId =
  | 'tower'
  | 'lostGame'
  | 'loudNoise'
  | 'brokeToy'
  | 'waiting'
  | 'darkRoom'
  | 'spilled'
  | 'crowded'
  | 'cantFind'
  | 'teased'

export interface TriggerMeta {
  id: TriggerId
  /** A picture-cue for the situation (shown alongside the child's face). */
  emoji: string
  /** The feeling this situation stirs up — the correct answer in "name it". */
  feeling: EmotionId
  /** Plausible wrong feelings offered as naming distractors (in preference order). */
  distractors: EmotionId[]
  /** How high the meter starts, 0–100 — the intensity of the feeling. */
  intensity: number
  /**
   * Coping *actions* that also address this particular situation (e.g. "ask for
   * help" when a toy broke). Choosing one earns the fit bonus. Breathing and
   * counting always earn it too — they fit everything — so they are never listed.
   */
  bestFit: StrategyId[]
}

export const TRIGGERS: TriggerMeta[] = [
  { id: 'tower', emoji: '🧱', feeling: 'angry', distractors: ['sad', 'surprised'], intensity: 70, bestFit: ['walk'] },
  { id: 'lostGame', emoji: '🎲', feeling: 'sad', distractors: ['angry', 'surprised'], intensity: 55, bestFit: ['walk', 'ask'] },
  { id: 'loudNoise', emoji: '🔊', feeling: 'scared', distractors: ['surprised', 'angry'], intensity: 78, bestFit: ['squeeze'] },
  { id: 'brokeToy', emoji: '🧸', feeling: 'sad', distractors: ['angry', 'scared'], intensity: 65, bestFit: ['ask'] },
  { id: 'waiting', emoji: '⏳', feeling: 'angry', distractors: ['sad', 'disgust'], intensity: 50, bestFit: [] },
  { id: 'darkRoom', emoji: '🌑', feeling: 'scared', distractors: ['sad', 'surprised'], intensity: 70, bestFit: ['ask'] },
  { id: 'spilled', emoji: '🥤', feeling: 'sad', distractors: ['scared', 'disgust'], intensity: 45, bestFit: ['ask'] },
  { id: 'crowded', emoji: '👥', feeling: 'scared', distractors: ['angry', 'surprised'], intensity: 68, bestFit: ['walk', 'squeeze'] },
  { id: 'cantFind', emoji: '🎒', feeling: 'scared', distractors: ['sad', 'angry'], intensity: 58, bestFit: ['ask'] },
  { id: 'teased', emoji: '😣', feeling: 'angry', distractors: ['sad', 'scared'], intensity: 72, bestFit: ['walk', 'ask'] },
]

export function triggerMeta(id: TriggerId): TriggerMeta {
  return TRIGGERS.find((t) => t.id === id)!
}

// ---- Difficulty ------------------------------------------------------------

export interface CalmConfig {
  /** Highlight one suggested tool on the toolkit (fades out on medium/hard). */
  suggest: boolean
  /** How many feelings to choose between in "name it" (2 → 4, harder = more). */
  namingChoices: number
  /** Completed breath cycles needed to fully calm the balloon. */
  breathCycles: number
  /** Numbers to tap when counting (always ten — the skill *is* "count to ten"). */
  countTarget: number
  /**
   * How fast the meter creeps back up, per second, while the child pauses
   * mid-activity — 0 on easy (all the time in the world), rising on harder
   * levels so calming has to be actually carried through, not dawdled.
   */
  driftPerSec: number
  /** Meter at or below this counts as "calm" and ends the round. */
  calmThreshold: number
  /** Rounds calmed to win a session. */
  goal: number
}

export const CONFIG: Record<Difficulty, CalmConfig> = {
  easy: { suggest: true, namingChoices: 2, breathCycles: 3, countTarget: 10, driftPerSec: 0, calmThreshold: 18, goal: 4 },
  medium: { suggest: false, namingChoices: 3, breathCycles: 4, countTarget: 10, driftPerSec: 1, calmThreshold: 15, goal: 5 },
  hard: { suggest: false, namingChoices: 4, breathCycles: 5, countTarget: 10, driftPerSec: 2, calmThreshold: 12, goal: 6 },
}

// ---- Strategy ↔ situation fit ----------------------------------------------

/** 'good' = fitting (bonus); 'ok' = still calms, just not the aptest coping move. */
export type Fit = 'good' | 'ok'

/**
 * Breathing and counting always fit; a coping action fits when the situation
 * lists it. Anything else still calms ('ok') — never wrong.
 */
export function strategyFit(trigger: TriggerMeta, strategy: StrategyId): Fit {
  if (UNIVERSAL_STRATEGIES.includes(strategy)) return 'good'
  return trigger.bestFit.includes(strategy) ? 'good' : 'ok'
}

// ---- Activity pacing (how each tool lowers the meter) ----------------------

/** Discrete steps of the chosen activity needed to go from full to calm. */
export function strategySteps(kind: StrategyKind, cfg: CalmConfig): number {
  if (kind === 'breath') return cfg.breathCycles
  if (kind === 'count') return cfg.countTarget
  return 2 // a guided coping action: do it, then notice you feel better
}

/**
 * How much one completed step drops the meter. Sized so `steps` clean steps
 * take the meter from `startMeter` down to the calm line (at least 1 each, so
 * progress is always visible even for a low-intensity feeling).
 */
export function meterStep(startMeter: number, steps: number, cfg: CalmConfig): number {
  return Math.max(1, (startMeter - cfg.calmThreshold) / steps)
}

// ---- Scoring ---------------------------------------------------------------

/** Child-facing points. Everything here is a reward; nothing subtracts. */
export const POINTS = { regulate: 10, named: 3, fitBonus: 5 }

/** Points for a completed round: calming always pays; naming and fit add on. */
export function pointsFor(namedCorrect: boolean, fit: Fit): number {
  return POINTS.regulate + (namedCorrect ? POINTS.named : 0) + (fit === 'good' ? POINTS.fitBonus : 0)
}

/**
 * 1–3 stars for the session, from how many rounds were "clean" — feeling named
 * correctly *and* a fitting tool chosen. ≥⅓ clean → 1, ≥⅔ → 2, all → 3.
 */
export function starsFor(cleanRounds: number, goal: number): number {
  if (goal <= 0) return 1
  const frac = cleanRounds / goal
  if (frac >= 1) return 3
  if (frac >= 2 / 3) return 2
  return 1
}

// ---- Round building --------------------------------------------------------

export interface Round {
  trigger: TriggerMeta
  /** The feeling options for "name it", already shuffled; one is the answer. */
  feelingOptions: EmotionId[]
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Feeling options for the naming step: the true feeling + `n-1` distractors. */
export function namingOptions(trigger: TriggerMeta, cfg: CalmConfig, rng: () => number): EmotionId[] {
  const wanted = Math.max(2, Math.min(cfg.namingChoices, ALL_EMOTION_IDS.length))
  const opts: EmotionId[] = [trigger.feeling]
  // Authored distractors first (most plausible), then fill from the rest.
  const pool = [...trigger.distractors, ...ALL_EMOTION_IDS]
  for (const e of pool) {
    if (opts.length >= wanted) break
    if (!opts.includes(e)) opts.push(e)
  }
  return shuffle(opts, rng)
}

/** Pick the next situation (never the same one twice in a row) and its options. */
export function makeRound(prev: TriggerId | null, cfg: CalmConfig, rng: () => number = Math.random): Round {
  const choices = prev ? TRIGGERS.filter((t) => t.id !== prev) : TRIGGERS
  const trigger = choices[Math.floor(rng() * choices.length)]
  return { trigger, feelingOptions: namingOptions(trigger, cfg, rng) }
}
