import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exitVrToHome } from './exitVr'

/**
 * jsdom has no rAF cadence and no visibility model, so both are driven by hand:
 * `frame()` releases exactly one animation frame, and `setVisibility` fakes the
 * browser hiding the window the way a headset does.
 */
let frameCallbacks: FrameRequestCallback[] = []

function frame(): void {
  const due = frameCallbacks
  frameCallbacks = []
  for (const cb of due) cb(performance.now())
}

/** Runs frames and timers together until `p` settles or we give up. */
async function drive(p: Promise<void>): Promise<void> {
  let done = false
  void p.then(() => (done = true))
  for (let i = 0; i < 200 && !done; i++) {
    frame()
    await vi.advanceTimersByTimeAsync(100)
  }
  await p
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
}

function fakeSession(end: () => Promise<void>): XRSession {
  return { end, addEventListener: () => {} } as unknown as XRSession
}

beforeEach(() => {
  vi.useFakeTimers()
  frameCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb)
    return frameCallbacks.length
  })
  setVisibility('visible')
  window.location.hash = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setVisibility('visible')
})

describe('exitVrToHome', () => {
  it('ends the session before navigating, never the other way round', async () => {
    const order: string[] = []
    const session = fakeSession(async () => {
      order.push('end')
      expect(window.location.hash).not.toBe('#/')
    })

    await drive(exitVrToHome(session))
    order.push('navigated')

    expect(order).toEqual(['end', 'navigated'])
    expect(window.location.hash).toBe('#/')
  })

  it('does not navigate while the browser is still handing back the display', async () => {
    // no frames arrive during the transition, which is what the headset owning
    // the display looks like from the page's side
    const session = fakeSession(async () => {})
    const p = exitVrToHome(session)

    await vi.advanceTimersByTimeAsync(400)
    expect(window.location.hash).not.toBe('#/')

    await drive(p)
    expect(window.location.hash).toBe('#/')
  })

  it('waits out the settle margin once frames resume', async () => {
    const session = fakeSession(async () => {})
    const p = exitVrToHome(session)

    // frames are flowing, but not yet for long enough to trust
    for (let i = 0; i < 3; i++) {
      frame()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(window.location.hash).not.toBe('#/')

    await drive(p)
    expect(window.location.hash).toBe('#/')
  })

  it('still gets the child Home if ending the session rejects', async () => {
    const session = fakeSession(() => Promise.reject(new Error('already ending')))
    await drive(exitVrToHome(session))
    expect(window.location.hash).toBe('#/')
  })

  it('does not strand the child when the window is minimised and frames never resume', async () => {
    setVisibility('hidden')
    const session = fakeSession(async () => {})

    const p = exitVrToHome(session)
    await vi.advanceTimersByTimeAsync(10_000)
    await p

    // navigating into a hidden page is fine — it shows Home when reopened
    expect(window.location.hash).toBe('#/')
  })

  it('does not hang when the session never reports that it ended', async () => {
    const session = fakeSession(() => new Promise<void>(() => {}))
    await drive(exitVrToHome(session))
    expect(window.location.hash).toBe('#/')
  })
})
