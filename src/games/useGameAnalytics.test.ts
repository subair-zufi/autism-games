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

describe('useGameAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts a session lazily on the first recordStep, then reuses it', async () => {
    const { result } = renderHook(() => useGameAnalytics('emotionrecognition'))
    await act(async () => { result.current.recordStep('answer', { correct: true }) })
    await act(async () => { result.current.recordStep('answer', { correct: false }) })
    expect(analytics.startSession).toHaveBeenCalledTimes(1)
    expect(analytics.recordStep).toHaveBeenCalledTimes(2)
    expect((analytics.recordStep as any).mock.calls[1][3]).toMatchObject({ sessionId: 'sess-1' })
  })

  it('finishGame records game_over and ends the session', async () => {
    const { result } = renderHook(() => useGameAnalytics('blocks'))
    await act(async () => { result.current.finishGame(7) })
    expect(analytics.recordStep).toHaveBeenCalledWith('blocks', 'game_over', undefined, expect.objectContaining({ score: 7 }))
    expect(analytics.endSession).toHaveBeenCalledWith('sess-1', 7)
  })
})
