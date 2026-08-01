import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isXrPresenting, setXrPresenting, whenXrIdle } from './xrPresence'

beforeEach(() => setXrPresenting(false))

describe('xrPresence', () => {
  it('runs work immediately when no session is presenting', () => {
    const fn = vi.fn()
    whenXrIdle(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('holds work back for the whole time a session is presenting', () => {
    setXrPresenting(true)
    const fn = vi.fn()
    whenXrIdle(fn)
    expect(fn).not.toHaveBeenCalled()
    expect(isXrPresenting()).toBe(true)

    setXrPresenting(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('releases everything that queued up, once each', () => {
    setXrPresenting(true)
    const a = vi.fn()
    const b = vi.fn()
    whenXrIdle(a)
    whenXrIdle(b)

    setXrPresenting(false)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    // a later session must not re-run work that already ran
    setXrPresenting(true)
    setXrPresenting(false)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('ignores repeated set calls with the same value', () => {
    setXrPresenting(true)
    const fn = vi.fn()
    whenXrIdle(fn)

    setXrPresenting(true) // a re-render reporting the same session
    expect(fn).not.toHaveBeenCalled()

    setXrPresenting(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
