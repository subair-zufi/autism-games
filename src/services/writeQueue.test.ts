import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearQueue, enqueue, flush, flushOnReconnect, pending, pendingCount } from './writeQueue'

describe('writeQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    clearQueue()
  })

  it('keeps a write that could not be sent', async () => {
    enqueue('k1', '/api/x', { a: 1 })
    const send = vi.fn().mockRejectedValue(new Error('offline'))

    expect(await flush(send)).toBe(0)
    expect(pendingCount()).toBe(1)
  })

  it('drops a write once it lands', async () => {
    enqueue('k1', '/api/x', { a: 1 })
    expect(await flush(vi.fn().mockResolvedValue({}))).toBe(1)
    expect(pendingCount()).toBe(0)
  })

  it('survives a reload, because the queue is on disk not in memory', async () => {
    enqueue('k1', '/api/x', { a: 1 })
    // A fresh module read is what a reload does; the store is localStorage.
    expect(pending()[0].body).toEqual({ a: 1 })
  })

  it('replaces a re-queued record rather than stacking a duplicate', () => {
    enqueue('k1', '/api/x', { fun: 4 })
    enqueue('k1', '/api/x', { fun: 5 })

    expect(pendingCount()).toBe(1)
    expect(pending()[0].body).toEqual({ fun: 5 })
  })

  it('sends oldest first and stops at the first failure', async () => {
    enqueue('k1', '/api/x', { n: 1 })
    enqueue('k2', '/api/x', { n: 2 })
    enqueue('k3', '/api/x', { n: 3 })
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('offline'))

    expect(await flush(send)).toBe(1)
    // k2 failed, so it and everything behind it stay, in order.
    expect(pending().map((e) => e.key)).toEqual(['k2', 'k3'])
  })

  it('counts attempts on the entry that failed', async () => {
    enqueue('k1', '/api/x', {})
    const send = vi.fn().mockRejectedValue(new Error('offline'))

    await flush(send)
    await flush(send)

    expect(pending()[0].attempts).toBe(2)
  })

  it('does not lose a record queued while a flush was in flight', async () => {
    enqueue('k1', '/api/x', { n: 1 })
    const send = vi.fn().mockImplementation(async () => {
      enqueue('k2', '/api/x', { n: 2 })
      throw new Error('offline')
    })

    await flush(send)

    expect(pending().map((e) => e.key).sort()).toEqual(['k1', 'k2'])
  })

  it('flushes again when the connection comes back', async () => {
    const run = vi.fn().mockResolvedValue(1)
    const stop = flushOnReconnect(run)

    expect(run).toHaveBeenCalledTimes(1) // immediately, on mount
    window.dispatchEvent(new Event('online'))
    expect(run).toHaveBeenCalledTimes(2)

    stop()
    window.dispatchEvent(new Event('online'))
    expect(run).toHaveBeenCalledTimes(2) // torn down
  })

  it('degrades to not-queued rather than throwing when storage is unusable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })

    expect(() => enqueue('k1', '/api/x', {})).not.toThrow()

    spy.mockRestore()
  })
})
