/**
 * What the headset tells the trainer's phone about the child's screen.
 *
 * The trainer needs more than "which route is open": whether the child is on a
 * level picker or mid-round, what they were just asked, and how they are
 * doing. That lives inside each game's state — but not in each game's *code*,
 * because the shared components every game already renders know all of it:
 * `StartScreen`/`LevelSelect` mean a picker is up, `ScoreBar` means a round is
 * running and carries the score, `PromptBanner` carries the question, the
 * game-over panels mean the round ended. So those four report, and no game had
 * to learn anything about remote control.
 *
 * Reports are kept in slots rather than one object: several components report
 * different fields at the same time, and each must be able to take its own
 * fields away when it unmounts without wiping a sibling's. Nothing subscribes
 * — the remote agent reads the merged view once per state push.
 */
import { useEffect, useRef } from 'react'
import type { RemotePhase } from './protocol'

export interface GameReport {
  phase?: RemotePhase
  score?: number | null
  progress?: string | null
  prompt?: string | null
}

const slots = new Map<number, GameReport>()
let nextSlotId = 1

/** The merged report, later slots winning — mount order, so a game-over panel
 *  rendered over a running game reports 'over'. */
export function readGameReport(): GameReport {
  const merged: GameReport = {}
  for (const slot of slots.values()) {
    for (const [key, value] of Object.entries(slot)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value
    }
  }
  return merged
}

/** Test seam — the slots outlive any one React tree. */
export function resetGameReport(): void {
  slots.clear()
  nextSlotId = 1
}

/**
 * Report part of the child's state for as long as this component is mounted.
 *
 * Deliberately effect-only: it never triggers a render, so putting one in a
 * component that runs inside a WebXR frame loop costs nothing.
 */
export function useRemoteReport(report: GameReport): void {
  const id = useRef<number>(0)
  if (id.current === 0) id.current = nextSlotId++

  // Values, not identity: callers build this object inline every render.
  const key = JSON.stringify(report)
  useEffect(() => {
    slots.set(id.current, report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const slotId = id.current
    return () => {
      slots.delete(slotId)
    }
  }, [])
}
