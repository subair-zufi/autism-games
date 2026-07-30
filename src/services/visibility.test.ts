import { beforeEach, describe, expect, it } from 'vitest'
import {
  beginVisibilityWindow,
  isPageHidden,
  notePageHidden,
  notePageVisible,
  resetVisibilityForTest,
  visibilityMetrics,
} from './visibility'

beforeEach(() => {
  resetVisibilityForTest()
  beginVisibilityWindow(0)
})

describe('visibility tracking', () => {
  it('reports a clean trial as unhidden', () => {
    expect(visibilityMetrics(5000)).toEqual({
      pageHiddenMs: 0,
      pageHideCount: 0,
      pageWasHidden: false,
    })
  })

  it('banks a completed hidden spell', () => {
    notePageHidden(1000)
    notePageVisible(3500)
    const m = visibilityMetrics(4000)
    expect(m.pageHiddenMs).toBe(2500)
    expect(m.pageHideCount).toBe(1)
    expect(m.pageWasHidden).toBe(true)
  })

  it('counts a spell that is still running when the trial is scored', () => {
    // the child answers via a timer that fired while the page was hidden
    notePageHidden(1000)
    expect(visibilityMetrics(4000).pageHiddenMs).toBe(3000)
    expect(isPageHidden()).toBe(true)
  })

  it('adds up several separate spells', () => {
    notePageHidden(1000)
    notePageVisible(2000)
    notePageHidden(3000)
    notePageVisible(3500)
    const m = visibilityMetrics(5000)
    expect(m.pageHiddenMs).toBe(1500)
    expect(m.pageHideCount).toBe(2)
  })

  it('ignores a repeated hide without an intervening show', () => {
    // visibilitychange and pagehide can both fire for one real event
    notePageHidden(1000)
    notePageHidden(1200)
    notePageVisible(2000)
    const m = visibilityMetrics(2500)
    expect(m.pageHiddenMs).toBe(1000) // from the FIRST hide, not the second
    expect(m.pageHideCount).toBe(1)
  })

  it('ignores a show with no hide outstanding', () => {
    notePageVisible(1000)
    expect(visibilityMetrics(2000).pageHiddenMs).toBe(0)
  })

  it('starts a fresh count for each trial', () => {
    notePageHidden(1000)
    notePageVisible(2000)
    beginVisibilityWindow(2000)
    const m = visibilityMetrics(3000)
    expect(m.pageHiddenMs).toBe(0)
    expect(m.pageHideCount).toBe(0)
  })

  /**
   * The case that matters most: a pacing timer fires while the child has the
   * headset off, opening a trial nobody is watching. The whole window must
   * read as unseen, not as zero hidden time.
   */
  it('reports a window that opened while already hidden as fully unseen', () => {
    notePageHidden(500)
    beginVisibilityWindow(1000)
    expect(visibilityMetrics(4000).pageHiddenMs).toBe(3000)
  })
})
