/**
 * Page-visibility tracking, so a trial the child was not present for can be
 * told apart from a slow one.
 *
 * Every game paces itself with `setTimeout` and measures response latency with
 * `performance.now()`, both of which keep running on wall-clock time while the
 * page is hidden — but the render loop (`requestAnimationFrame`) stops, and on
 * a headset "hidden" is the ordinary event of a child taking it off, a system
 * dialog opening, or the browser panel losing focus.
 *
 * Nothing recorded that. A trial spanning a two-minute break was indistinguish-
 * able from a two-minute deliberation, on a measure — response latency — that
 * is a primary outcome. This does not try to repair such a trial; it records
 * that the gap happened so the analysis can exclude or adjust it.
 *
 * The window is opened by `beginHeadWindow` (games/headTracking.ts), which
 * every game already calls at cue/stimulus onset, so the interval measured here
 * is exactly the trial. `useGameAnalytics` then stamps the metrics onto every
 * recorded step, so no game needs to know this module exists.
 *
 * The hide/show bookkeeping is exported separately from the DOM listener so the
 * arithmetic is unit-testable without driving real visibility changes. A
 * singleton, like `headTracking`'s buffer, so hot reload never duplicates it.
 */

/** when the page went hidden, or null while it is visible */
let hiddenAt: number | null = null
/** hidden time already banked in the current window (completed hidden spells) */
let hiddenMsBanked = 0
/** how many times the page went hidden during the current window */
let hideCount = 0
let listening = false

/** Open a fresh window at cue/stimulus onset. */
export function beginVisibilityWindow(now: number = performance.now()): void {
  hiddenMsBanked = 0
  hideCount = 0
  // A window can open while the page is already hidden — a pacing timer that
  // fired in the background. Start counting from now, so the whole window is
  // correctly reported as unseen rather than as zero hidden time.
  if (hiddenAt !== null) hiddenAt = now
}

/** The page became hidden. Exported for tests; normally driven by the listener. */
export function notePageHidden(now: number = performance.now()): void {
  if (hiddenAt !== null) return // already hidden; don't restart the clock
  hiddenAt = now
  hideCount += 1
}

/** The page became visible again. Exported for tests. */
export function notePageVisible(now: number = performance.now()): void {
  if (hiddenAt === null) return
  hiddenMsBanked += now - hiddenAt
  hiddenAt = null
}

export interface VisibilityMetrics {
  /** ms of this trial the page spent hidden */
  pageHiddenMs: number
  /** how many separate times it went hidden */
  pageHideCount: number
  /**
   * Whether any of this trial happened out of sight. True for ANY non-zero
   * gap: browsers can fire a brief hide for reasons that do not mean the child
   * left, so the raw millisecond count is reported alongside and the analysis
   * decides what length actually disqualifies a trial.
   */
  pageWasHidden: boolean
}

/** Summarise the visibility of the window opened by `beginVisibilityWindow`. */
export function visibilityMetrics(now: number = performance.now()): VisibilityMetrics {
  const live = hiddenAt !== null ? now - hiddenAt : 0
  const total = Math.round(hiddenMsBanked + live)
  return {
    pageHiddenMs: total,
    pageHideCount: hideCount,
    pageWasHidden: total > 0,
  }
}

/** Whether the page is hidden right now (drives the video pause). */
export function isPageHidden(): boolean {
  return hiddenAt !== null
}

/**
 * Start listening for real visibility changes. Idempotent, and safe where
 * there is no document. Called once from the app root.
 */
export function installVisibilityTracking(): void {
  if (listening || typeof document === 'undefined') return
  listening = true
  const onChange = () => {
    if (document.visibilityState === 'hidden') notePageHidden()
    else notePageVisible()
  }
  document.addEventListener('visibilitychange', onChange)
  // `pagehide` also covers the headset's own sleep/removal path, which does not
  // always surface as a visibilitychange on every browser.
  window.addEventListener('pagehide', () => notePageHidden())
  window.addEventListener('pageshow', () => notePageVisible())
  if (document.visibilityState === 'hidden') notePageHidden()
}

/** Test seam: forget all state, including any installed listeners' effects. */
export function resetVisibilityForTest(): void {
  hiddenAt = null
  hiddenMsBanked = 0
  hideCount = 0
}
