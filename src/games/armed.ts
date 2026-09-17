/**
 * Whether the child currently has a choice armed, for the trainer's remote.
 *
 * `HeadSelect` writes it each frame; `buildStatus` reads it. A singleton rather
 * than store state because it changes on nearly every frame and nothing should
 * re-render for it — the console reads it once a second along with the rest of
 * the status, which is as fresh as a human pressing a button needs.
 *
 * The console uses it only to enable its Confirm control. The headset stays the
 * authority on whether a press does anything: by the time one arrives the child
 * may have looked elsewhere, and a stale `true` must not be able to answer for
 * a choice that is no longer made.
 */

let armed = false

/** Called by `HeadSelect` as the candidate appears and goes. */
export function setArmed(value: boolean): void {
  armed = value
}

/** Is a choice sitting there waiting to be confirmed right now? */
export function isArmed(): boolean {
  return armed
}
