/**
 * A generic within-session adaptive-difficulty controller, shared by the games
 * (review R14).
 *
 * Museum 360 was the only game that adapted mid-session; this extracts that
 * step-up / step-down idea into one place so any game can keep a child near the
 * edge of their ability instead of sitting a whole session at whatever level the
 * facilitator picked.
 *
 * Rungs are integer difficulty steps, 0..rungCount-1, where a HIGHER rung is
 * harder. Each game maps a rung to its own concrete parameters (cue support,
 * distractor count, nudge delay, …). The mentor-set level is the FLOOR and the
 * starting rung, so facilitator control is preserved: the controller only ever
 * makes a session harder than that floor, never easier.
 *
 *   - `advanceStreak` consecutive first-try-correct trials → step UP one rung
 *   - `retreatErrors` erred trials within the window       → step DOWN one rung
 *
 * A clean first-try success closes the error window (errors reset); an erred
 * trial breaks the success streak. Pure and framework-free, so the maths is
 * unit-tested without a game or a WebGL context.
 */

/** consecutive first-try-correct trials to step up a rung */
export const DEFAULT_ADVANCE_STREAK = 3
/** erred trials within the window to step down a rung */
export const DEFAULT_RETREAT_ERRORS = 2

export interface MasteryConfig {
  /** number of rungs; valid rungs are 0..rungCount-1 */
  rungCount: number
  /** the mentor-set level's rung — the starting rung and the floor */
  floor: number
  /** override the step-up streak (defaults to DEFAULT_ADVANCE_STREAK) */
  advanceStreak?: number
  /** override the step-down error count (defaults to DEFAULT_RETREAT_ERRORS) */
  retreatErrors?: number
}

export interface MasteryState {
  /** the active difficulty rung */
  rung: number
  /** consecutive first-try-correct trials since the last step/err */
  streak: number
  /** erred trials in the current window */
  errors: number
}

function floorRung(cfg: MasteryConfig): number {
  return Math.max(0, Math.min(cfg.floor, cfg.rungCount - 1))
}

/** The starting state: sitting on the level's floor, no streak, no errors. */
export function initMastery(cfg: MasteryConfig): MasteryState {
  return { rung: floorRung(cfg), streak: 0, errors: 0 }
}

/**
 * Fold one trial outcome into the state and return the next state. `firstTryCorrect`
 * is true only when the child got the trial right with no wrong attempts; any
 * erred trial (even if eventually corrected) counts toward the retreat window.
 */
export function stepMastery(
  state: MasteryState,
  cfg: MasteryConfig,
  outcome: { firstTryCorrect: boolean },
): MasteryState {
  const advance = cfg.advanceStreak ?? DEFAULT_ADVANCE_STREAK
  const retreat = cfg.retreatErrors ?? DEFAULT_RETREAT_ERRORS
  const floor = floorRung(cfg)
  const top = cfg.rungCount - 1

  if (outcome.firstTryCorrect) {
    let streak = state.streak + 1
    let rung = state.rung
    if (streak >= advance) {
      rung = Math.min(rung + 1, top)
      streak = 0
    }
    // a clean success closes the error window
    return { rung, streak, errors: 0 }
  }

  let errors = state.errors + 1
  let rung = state.rung
  if (errors >= retreat) {
    rung = Math.max(rung - 1, floor)
    errors = 0
  }
  // an erred trial breaks the success streak
  return { rung, streak: 0, errors }
}
