/**
 * Whether an immersive session is presenting right now, readable from outside
 * React.
 *
 * Nothing may tear the page down while a headset session is live. If the
 * document reloads or navigates mid-session the Quest browser sees the
 * immersive page vanish rather than hand control back, and defensively
 * minimises itself — the child is dropped into the Quest home environment
 * ("Loft") with no browser window, and someone has to reopen it from the system
 * menu. Anything that would reload the page has to wait for the session to end
 * first, which is what `whenXrIdle` is for.
 *
 * Kept as a plain module rather than store state because the code that needs it
 * (the service-worker update handler in `main.tsx`) runs outside React.
 */

let presenting = false
const waiting = new Set<() => void>()

/** Set by `XRCameraHome`, which every 360 scene mounts inside its `<XR>`. */
export function setXrPresenting(value: boolean): void {
  if (value === presenting) return
  presenting = value
  if (presenting) return
  // session just ended — release anything that was holding off
  const due = [...waiting]
  waiting.clear()
  for (const fn of due) fn()
}

export function isXrPresenting(): boolean {
  return presenting
}

/** Runs `fn` now if no session is presenting, otherwise once one ends. */
export function whenXrIdle(fn: () => void): void {
  if (!presenting) {
    fn()
    return
  }
  waiting.add(fn)
}
