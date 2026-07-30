import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../services/analytics', () => ({
  analytics: {
    startSession: vi.fn(async () => 'sess-1'),
    endSession: vi.fn(async () => {}),
    recordStep: vi.fn(async () => {}),
  },
}))

import { useGameAnalytics } from './useGameAnalytics'
import { beginHeadWindow } from './headTracking'
import { notePageHidden, notePageVisible, resetVisibilityForTest } from '../services/visibility'
import { analytics } from '../services/analytics'
import { useSettings } from '../state/settings'

describe('useGameAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettings.getState().setInputMethod('dwell')
    resetVisibilityForTest()
  })

  it('starts a session lazily on the first recordStep, then reuses it', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotionrecognition'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    await act(async () => { result.current.recordStep('answer', { correct: false }) })
    expect(analytics.startSession).toHaveBeenCalledTimes(1)
    expect(analytics.recordStep).toHaveBeenCalledTimes(2)
    expect((analytics.recordStep as any).mock.calls[1][3]).toMatchObject({ sessionId: 'sess-1' })
  })

  it('tags every step with xrPresenting=false when no xrStore is passed (flat game)', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotionrecognition'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({ correct: true, xrPresenting: false })
  })

  it('tags steps with xrPresenting=true while an immersive session is active', async () => {
    const xrStore = { getState: () => ({ session: {} }) }
    const { result } = renderHook(() => useGameAnalytics('museum360', xrStore))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({ xrPresenting: true })
  })

  it('finishGame records game_over and ends the session', async () => {
    const { result } = renderHook(() => useGameAnalytics('blocks'))
    await act(async () => { result.current.finishGame(7) })
    expect(analytics.recordStep).toHaveBeenCalledWith(
      'blocks',
      'game_over',
      // objectContaining, not an exact match: this is the shared context every
      // step carries, and it grows (visibility metrics, and whatever comes
      // next). Pinning the whole shape here just breaks on every addition.
      expect.objectContaining({ xrPresenting: false, inputMethod: 'dwell', headYawContaminated: false }),
      expect.objectContaining({ score: 7 }),
    )
    expect(analytics.endSession).toHaveBeenCalledWith('sess-1', 7)
  })

  it('tags every step with the selection method, so gaze and controller latencies are separable', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotionrecognition'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({ inputMethod: 'dwell' })

    useSettings.getState().setInputMethod('controller')
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[1][2]).toMatchObject({ inputMethod: 'controller' })
  })

  it('flags head yaw as selection-contaminated only for the JA games in a headset', async () => {
    const inXr = { getState: () => ({ session: {} }) }
    const flat = { getState: () => ({ session: undefined }) }

    // joint attention game, in a headset: the child steers their head to answer
    const ja = renderHook(() => useGameAnalytics('museum360', inXr))
    await act(async () => { ja.result.current.recordStep('answer') })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({ headYawContaminated: true })

    // same game on a flat screen: the mouse selects, yaw is only drag-to-look
    const jaFlat = renderHook(() => useGameAnalytics('park360', flat))
    await act(async () => { jaFlat.result.current.recordStep('answer') })
    expect((analytics.recordStep as any).mock.calls[1][2]).toMatchObject({ headYawContaminated: false })

    // a headset game whose outcome is not head yaw
    const other = renderHook(() => useGameAnalytics('football360', inXr))
    await act(async () => { other.result.current.recordStep('answer') })
    expect((analytics.recordStep as any).mock.calls[2][2]).toMatchObject({ headYawContaminated: false })
  })

  it('tags every step with how much of the trial the page was hidden', async () => {
    const { result } = renderHook(() => useGameAnalytics('museum360'))

    beginHeadWindow(0) // trial opens (this also opens the visibility window)
    await act(async () => { result.current.recordStep('answer') })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({
      pageWasHidden: false,
      pageHideCount: 0,
    })

    // the child takes the headset off mid-trial and comes back
    beginHeadWindow(1000)
    notePageHidden(1500)
    notePageVisible(4000)
    await act(async () => { result.current.recordStep('answer') })
    const p = (analytics.recordStep as any).mock.calls[1][2]
    expect(p.pageWasHidden).toBe(true)
    expect(p.pageHideCount).toBe(1)
    expect(p.pageHiddenMs).toBeGreaterThanOrEqual(2500)
  })
})
