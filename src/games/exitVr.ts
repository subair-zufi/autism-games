/**
 * Leaving an immersive session cleanly.
 *
 * The order matters more than it looks. Ending the session and navigating in
 * the same breath tears the `<Canvas>` down — and with it the WebGL context —
 * at the exact moment the Quest browser is trying to restore its 2D view. A
 * browser that finds the immersive page gone rather than handed back defensively
 * minimises itself, dropping the child into the Quest home environment ("Loft")
 * with no window to return to.
 *
 * So: end the session, let the flat page prove it is alive again by painting a
 * couple of frames, and only then navigate. The app is never torn down — this
 * is a hash change inside a still-running SPA, not a page load.
 */

/**
 * Resolves on the next animation frame, or after `timeoutMs`, whichever comes
 * first. The timeout matters: if the browser has backgrounded the tab, rAF may
 * never fire, and the child would be stranded in the game rather than sent Home.
 */
function nextFrame(timeoutMs = 250): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    requestAnimationFrame(finish)
    setTimeout(finish, timeoutMs)
  })
}

/**
 * Ends the session and returns to the app's Home page.
 *
 * Failure to end is deliberately swallowed: the session may already be ending
 * (a double-tap on Quit, or the headset removed), and either way the goal is to
 * get the child out, not to report why.
 */
export async function exitVrToHome(session: XRSession): Promise<void> {
  try {
    await session.end()
  } catch {
    /* already ending or ended — carry on */
  }
  // two frames: the first is scheduled while the compositor is still switching
  // back, the second only runs once the flat page is genuinely rendering again
  await nextFrame()
  await nextFrame()
  window.location.hash = '#/'
}
