/**
 * Leaving an immersive session cleanly.
 *
 * On a Quest, quitting used to strand the child: the session ended, the browser
 * window vanished, and they were left in the empty home environment ("Loft")
 * until someone reopened the browser by hand. The app itself was fine — when
 * the window came back it was sitting on Home exactly as intended — so nothing
 * had crashed. What went wrong was the timing.
 *
 * Ending a session and navigating in the same breath unmounts the `<Canvas>`,
 * and with it the WebGL context, while the browser is still mid-transition back
 * to its 2D window. The previous version waited two animation frames (~33ms),
 * which is nowhere near long enough — the compositor is still fading out of
 * immersive mode at that point.
 *
 * So this waits for evidence that the flat page is genuinely back — visible,
 * and painting frames — plus a settle margin, and only then navigates. Nothing
 * is ever torn down: Home is a hash change inside the running SPA, not a page
 * load.
 */

/** How long the flat page must be visible and painting before we touch it. */
const SETTLE_MS = 1200
/** Never wait longer than this for the session to report that it ended. */
const END_TIMEOUT_MS = 2000
/** Never hold the child in the game if frames stop arriving altogether. */
const HARD_CAP_MS = 4000

/**
 * Resolves once the session is done, by whichever signal arrives first: the
 * `end` event, the promise settling, or a timeout. A session that refuses to
 * end must not trap the child in the game.
 */
function endSession(session: XRSession): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    try {
      session.addEventListener('end', finish, { once: true })
    } catch {
      /* not all implementations expose the event */
    }
    session.end().then(finish, finish)
    setTimeout(finish, END_TIMEOUT_MS)
  })
}

/**
 * Resolves once the document has been visible and painting for `ms`.
 *
 * `requestAnimationFrame` is the useful signal here: it does not run while the
 * headset owns the display, so frames arriving again is the page telling us the
 * browser has handed control back. The hard cap covers the case where the
 * window is minimised and frames never resume — better to navigate into a
 * hidden page, which then shows Home whenever it is reopened, than to leave the
 * child stuck in a game they asked to leave.
 */
function pageSettled(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    let visibleSince = document.visibilityState === 'visible' ? performance.now() : null

    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const tick = () => {
      if (settled) return
      if (document.visibilityState !== 'visible') {
        visibleSince = null
      } else {
        visibleSince ??= performance.now()
        if (performance.now() - visibleSince >= ms) {
          finish()
          return
        }
      }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    setTimeout(finish, ms + HARD_CAP_MS)
  })
}

/**
 * Ends the session and returns to the app's Home page.
 *
 * Failure to end is deliberately swallowed: the session may already be ending
 * (a double-tap on Quit, or the headset taken off), and either way the goal is
 * to get the child out, not to report why.
 */
export async function exitVrToHome(session: XRSession): Promise<void> {
  await endSession(session)
  await pageSettled(SETTLE_MS)
  window.location.hash = '#/'
}
