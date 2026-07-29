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
import { analytics } from '../services/analytics'
import { useSettings } from '../state/settings'

describe('useGameAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettings.getState().setInputMethod('poke')
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
      { xrPresenting: false, inputMethod: 'poke', headYawContaminated: false },
      expect.objectContaining({ score: 7 }),
    )
    expect(analytics.endSession).toHaveBeenCalledWith('sess-1', 7)
  })

  it('tags every step with the selection method, so poke and dwell latencies are separable', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotionrecognition'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[0][2]).toMatchObject({ inputMethod: 'poke' })

    useSettings.getState().setInputMethod('dwell')
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    expect((analytics.recordStep as any).mock.calls[1][2]).toMatchObject({ inputMethod: 'dwell' })
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
})
