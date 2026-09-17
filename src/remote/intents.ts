/**
 * Presses the trainer makes on their phone that only the screen the child is
 * looking at can carry out.
 *
 * "Play" means whatever Play means on the picker that happens to be showing;
 * "restart" means the result screen's Play again. The remote agent has no way
 * to know which of those is mounted, so it emits an intent and whichever
 * shared screen is up handles it — the same handler the child's own press runs.
 *
 * A plain module-level emitter rather than store state: an intent is an event,
 * and re-rendering the tree to deliver one would be the wrong shape.
 */
import { useEffect, useRef } from 'react'

/**
 * `confirm` is the odd one out: it is handled inside a game's Canvas by
 * `HeadSelect` rather than by a screen, and it answers with the choice the
 * CHILD has already made by looking. The trainer cannot pick an option from
 * their phone — only release one the child arrived at themselves — so a child
 * who can orient to the target but cannot hold still long enough to confirm it
 * still produces a trial that measures their attention. Steps record who
 * released the answer (`dwellConfirmedBy`), because the motor half of the trial
 * did not happen when it was the adult.
 */
export type RemoteIntent = 'play' | 'restart' | 'confirm'

type Handler = () => void

const handlers = new Map<RemoteIntent, Set<Handler>>()

/** Run every handler registered for `intent`. Returns how many ran, so the
 *  agent can tell the console when a press had nowhere to land. */
export function emitRemoteIntent(intent: RemoteIntent): number {
  const set = handlers.get(intent)
  if (!set?.size) return 0
  for (const fn of [...set]) {
    try {
      fn()
    } catch (err) {
      console.warn(`[remote] ${intent} handler failed:`, err)
    }
  }
  return set.size
}

/**
 * Handle a remote press for as long as this component is mounted.
 *
 * The handler is read through a ref, so callers can pass an inline closure
 * (they all do — it is the same one the on-screen button uses) without
 * re-subscribing on every render.
 */
export function useRemoteIntent(intent: RemoteIntent, handler: Handler): void {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    const run = () => latest.current()
    let set = handlers.get(intent)
    if (!set) handlers.set(intent, (set = new Set()))
    set.add(run)
    return () => {
      set!.delete(run)
    }
  }, [intent])
}
