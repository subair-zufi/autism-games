import { afterEach, describe, expect, it, vi } from 'vitest'
import { exitVrToHome } from './exitVr'

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
})

/** the parts of XRSession this touches */
function fakeSession(end: () => Promise<void>): XRSession {
  return { end } as unknown as XRSession
}

describe('exitVrToHome', () => {
  it('ends the session before navigating, never the other way round', async () => {
    const order: string[] = []
    const session = fakeSession(async () => {
      order.push('end')
    })

    await exitVrToHome(session)
    order.push('navigated:' + window.location.hash)

    expect(order).toEqual(['end', 'navigated:#/'])
  })

  it('still gets the child Home if ending the session rejects', async () => {
    // a double-tap on Quit, or the headset pulled off mid-press
    const session = fakeSession(() => Promise.reject(new Error('already ending')))
    await exitVrToHome(session)
    expect(window.location.hash).toBe('#/')
  })

  it('does not strand the child when frames stop coming', async () => {
    // a backgrounded tab never fires rAF; the internal timeout has to carry it
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.useFakeTimers()

    const session = fakeSession(async () => {})
    const done = exitVrToHome(session)
    await vi.advanceTimersByTimeAsync(1000)
    await done

    expect(window.location.hash).toBe('#/')
    vi.useRealTimers()
  })
})
