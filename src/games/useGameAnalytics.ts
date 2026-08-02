import { useCallback, useRef } from 'react'
import { analytics } from '../services/analytics'
import { useSettings } from '../state/settings'
import { visibilityMetrics } from '../services/visibility'
import { GAME_LIST, type GameId } from '../types'

/**
 * The two joint attention games measure the child's head yaw as the outcome —
 * where they looked, and how long it took them to get there. Both controller-free
 * input methods aim with the head, which makes looking *instrumental*: the child
 * turns toward a target in order to select it, not only to share attention. Steps
 * from these games are flagged so the analysis can exclude or adjust them rather
 * than silently pooling contaminated yaw with the rest.
 */
const HEAD_YAW_OUTCOME_GAMES = new Set<GameId>(
  GAME_LIST.filter((g) => g.skill === 'jointattention' && g.mode === 'vr').map((g) => g.id),
)

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
    // A null id (session failed to start) must not be cached as "in flight" —
    // otherwise every later step in this game silently no-ops instead of retrying.
    if (!id) starting.current = null
    return id
  }, [gameKey])

  // Whether the child is in an immersive VR session right now. The same game
  // yields data from two very different display/input conditions (headset vs
  // flat screen); without this flag they are indistinguishable in the dataset.
  const xrPresenting = useCallback(() => (xrStore ? !!xrStore.getState().session : false), [xrStore])

  // Gaze and controller produce very different response latencies — a dwell
  // answer cannot arrive faster than DWELL_MS — so they must never be pooled. Read
  // from the store rather than subscribed to: the value only matters at the
  // moment a step is written, and it does not change mid-session.
  const inputContext = useCallback(() => {
    const presenting = xrPresenting()
    const inputMethod = useSettings.getState().inputMethod
    return {
      xrPresenting: presenting,
      inputMethod,
      // only meaningful in a headset — on a flat screen the mouse selects and
      // head yaw is drag-to-look, which the child is not steering to answer
      headYawContaminated: presenting && HEAD_YAW_OUTCOME_GAMES.has(gameKey),
      // How much of this trial the child could not see. Timers and
      // performance.now() run on wall clock while the page is hidden, so a
      // trial spanning a headset break otherwise looks like a very slow
      // response. Recorded on every step so such trials can be excluded.
      ...visibilityMetrics(),
    }
  }, [xrPresenting, gameKey])

  const recordStep = useCallback(
    (eventType: string, payload?: Record<string, unknown>, opts?: { stepIndex?: number; score?: number }) => {
      const enriched = { ...(payload ?? {}), ...inputContext() }
      void ensureSession().then((id) =>
        analytics.recordStep(gameKey, eventType, enriched, { ...opts, sessionId: id ?? undefined }),
      )
    },
    [gameKey, ensureSession, inputContext],
  )

  const finishGame = useCallback(
    (finalScore: number) => {
      const enriched = inputContext()
      void ensureSession().then(async (id) => {
        await analytics.recordStep(gameKey, 'game_over', enriched, { score: finalScore, sessionId: id ?? undefined })
        if (id) await analytics.endSession(id, finalScore)
        sessionId.current = null
        starting.current = null
      })
    },
    [gameKey, ensureSession, inputContext],
  )

  const resetSession = useCallback(() => {
    sessionId.current = null
    starting.current = null
  }, [])

  return { recordStep, finishGame, resetSession }
}
