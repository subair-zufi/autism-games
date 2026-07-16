import { useCallback, useRef } from 'react'
import { analytics } from '../services/analytics'
import type { GameId } from '../types'

/** Minimal shape of an `@react-three/xr` store — enough to tell whether an
 *  immersive session is currently presenting. Passed by the 360 games so every
 *  recorded step is tagged with the display mode it came from (review item M2);
 *  the flat games omit it and the flag is simply always false. */
interface XrStoreLike {
  getState: () => { session?: unknown }
}

export function useGameAnalytics(gameKey: GameId, xrStore?: XrStoreLike) {
  const sessionId = useRef<string | null>(null)
  const starting = useRef<Promise<string | null> | null>(null)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId.current) return sessionId.current
    if (!starting.current) starting.current = analytics.startSession(gameKey)
    const id = await starting.current
    sessionId.current = id
    return id
  }, [gameKey])

  // Whether the child is in an immersive VR session right now. The same game
  // yields data from two very different display/input conditions (headset vs
  // flat screen); without this flag they are indistinguishable in the dataset.
  const xrPresenting = useCallback(() => (xrStore ? !!xrStore.getState().session : false), [xrStore])

  const recordStep = useCallback(
    (eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number }) => {
      const enriched = { ...(payload ?? {}), xrPresenting: xrPresenting() }
      void ensureSession().then((id) =>
        analytics.recordStep(gameKey, eventType, enriched, { ...opts, sessionId: id ?? undefined }),
      )
    },
    [gameKey, ensureSession, xrPresenting],
  )

  const finishGame = useCallback(
    (finalScore: number) => {
      const enriched = { xrPresenting: xrPresenting() }
      void ensureSession().then(async (id) => {
        await analytics.recordStep(gameKey, 'game_over', enriched, { score: finalScore, sessionId: id ?? undefined })
        if (id) await analytics.endSession(id, finalScore)
        sessionId.current = null
        starting.current = null
      })
    },
    [gameKey, ensureSession, xrPresenting],
  )

  const resetSession = useCallback(() => {
    sessionId.current = null
    starting.current = null
  }, [])

  return { recordStep, finishGame, resetSession }
}
