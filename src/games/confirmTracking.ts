/**
 * What the gaze-dwell confirm step cost the child, per trial.
 *
 * A child who attends perfectly and a child who never found the target score
 * identically if neither answers — and after the dwell forgiveness work
 * (`headAim.ts`) we know the difference is real: some children located the
 * right exhibit and then could not hold their head still enough to confirm it.
 * That motor cost was sitting *inside* the joint-attention outcome with no way
 * to separate it, which is a validity problem, not only a UX one: the children
 * whose scores it depresses are exactly the ones whose scores get interpreted.
 *
 * So the selection loop reports what it did and this module totals it up:
 * how many times a choice was armed, how often an unsteady head broke the
 * dwell, how much dwell that cost, and how long the confirm took once the
 * child had already chosen. `dwellArmToConfirmMs` is the headline — it is the
 * confirmation cost with the finding-the-target part removed, so it can go in
 * a model as its own term instead of contaminating latency.
 *
 * `dwellConfirmBreaks` doubles as a per-child index of head stability,
 * measured during ordinary play rather than in a separate assessment.
 *
 * The window is opened by `beginHeadWindow` (games/headTracking.ts), the one
 * place that knows where a trial starts, and `useGameAnalytics` stamps the
 * totals onto every step — so no game file needs to know this exists. Written
 * only by `HeadSelect`, which does not mount outside an immersive session or
 * on the controller input method; the fields are therefore recorded only for
 * the trials they mean something for, and are absent (system-missing)
 * elsewhere rather than a misleading zero.
 *
 * A singleton, like `headTracking`'s buffer, so hot reload never duplicates it.
 */

/** how many times a candidate was armed since the window opened */
let armCount = 0
/** slips off the chip that actually cost dwell */
let breaks = 0
/** dwell lost to those slips, in ms of progress */
let drainedMs = 0
/** when the current candidate was armed, or null if none is */
let armedAt: number | null = null
let armToConfirmMs: number | null = null
let confirms = 0
let confirmedBy: 'child' | 'facilitator' | null = null

/** Open a fresh window at cue/stimulus onset. */
export function beginConfirmWindow(): void {
  armCount = 0
  breaks = 0
  drainedMs = 0
  armedAt = null
  armToConfirmMs = null
  confirms = 0
  confirmedBy = null
}

/**
 * One frame of the selection loop, as `advanceAim` reported it.
 *
 * Takes the events rather than the whole `AimResult` so the totals can be
 * driven from plain objects in a test — there is no way to run a real gaze
 * through this.
 */
export interface AimEvents {
  armedNew: boolean
  drainedMs: number
  brokeOff: boolean
  fire: boolean
  /** the trainer released this answer from their phone, rather than the child
   *  completing the dwell themselves (`remote/intents.ts`) */
  byFacilitator?: boolean
}

export function noteAim(ev: AimEvents, now: number = performance.now()): void {
  if (ev.armedNew) {
    armCount += 1
    // re-arming restarts the clock: the cost we want is confirming the choice
    // the child actually answered with, not the one they first considered
    armedAt = now
  }
  if (ev.brokeOff) breaks += 1
  if (ev.drainedMs > 0) drainedMs += ev.drainedMs
  if (ev.fire) {
    confirms += 1
    confirmedBy = ev.byFacilitator === true ? 'facilitator' : 'child'
    // Left null when the trainer released it: the interval would then be an
    // adult's reaction time, which is not what this field means and would
    // quietly contaminate the very measure it exists to isolate. The child did
    // not complete the confirmation, so their cost for this trial is unknown,
    // and `dwellConfirmedBy` says why it is missing.
    //
    // Also null when the arming happened before this trial's window opened —
    // an unmeasurable interval is better left missing than reported from the
    // window's start, which would be a made-up number.
    if (armedAt !== null && ev.byFacilitator !== true) {
      armToConfirmMs = Math.max(0, Math.round(now - armedAt))
    }
    armedAt = null
  }
}

export interface ConfirmMetrics {
  /** times a choice was armed this trial — >1 means the child changed target */
  dwellArmCount: number
  /** slips off the chip that cost dwell — an index of head steadiness */
  dwellConfirmBreaks: number
  /** dwell those slips cost, in ms of progress */
  dwellDrainedMs: number
  /** ms from arming the answered choice to the answer — the confirmation cost
   *  with target-finding removed; null if nothing was confirmed this trial, or
   *  the choice was armed before the trial window opened */
  dwellArmToConfirmMs: number | null
  /**
   * The child chose something and never managed to answer it. The trials that
   * motivated all of this: attention succeeded, the motor confirmation did
   * not. Scoring these as "did not find the target" is the confound.
   *
   * False when the trainer stepped in and released the choice — that trial did
   * produce an answer. `dwellConfirmedBy` is what marks those; the two together
   * separate "could not confirm, and no answer happened" from "could not
   * confirm, and an adult finished it".
   */
  dwellArmedNoConfirm: boolean
  /**
   * Who released the answer. `facilitator` means the child oriented to their
   * choice themselves — that half of the trial stands — but an adult pressed
   * the button, so nothing about their motor control can be read from it, and
   * `dwellArmToConfirmMs` is deliberately blank. Null when nothing was
   * confirmed this trial.
   */
  dwellConfirmedBy: 'child' | 'facilitator' | null
}

/** Summarise the confirm activity since `beginConfirmWindow`. */
export function confirmMetrics(): ConfirmMetrics {
  return {
    dwellArmCount: armCount,
    dwellConfirmBreaks: breaks,
    dwellDrainedMs: Math.round(drainedMs),
    dwellArmToConfirmMs: armToConfirmMs,
    dwellArmedNoConfirm: armCount > 0 && confirms === 0,
    dwellConfirmedBy: confirmedBy,
  }
}

/** Test seam: forget all state. */
export function resetConfirmForTest(): void {
  beginConfirmWindow()
}
