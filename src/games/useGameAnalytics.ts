import { useCallback, useRef } from 'react'
import { analytics } from '../services/analytics'
import type { GameId } from '../types'

export function useGameAnalytics(gameKey: GameId) {
  const sessionId = useRef<string | null>(null)
  const starting = useRef<Promise<string | null> | null>(null)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId.current) return sessionId.current
    if (!starting.current) starting.current = analytics.startSession(gameKey)
    const id = await starting.current
    sessionId.current = id
    return id
  }, [gameKey])

  const recordStep = useCallback(
    (eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number }) => {
      void ensureSession().then((id) =>
        analytics.recordStep(gameKey, eventType, payload, { ...opts, sessionId: id ?? undefined }),
      )
    },
    [gameKey, ensureSession],
  )

  const finishGame = useCallback(
    (finalScore: number) => {
      void ensureSession().then(async (id) => {
        await analytics.recordStep(gameKey, 'game_over', undefined, { score: finalScore, sessionId: id ?? undefined })
        if (id) await analytics.endSession(id, finalScore)
        sessionId.current = null
        starting.current = null
      })
    },
    [gameKey, ensureSession],
  )

  const resetSession = useCallback(() => {
    sessionId.current = null
    starting.current = null
  }, [])

  return { recordStep, finishGame, resetSession }
}
