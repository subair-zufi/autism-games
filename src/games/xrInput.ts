import type { XRStore } from '@react-three/xr'
import type { InputMethod } from '../types'

/**
 * Shared WebXR input wiring for the 360 games.
 *
 * Every game's `xrStore.ts` builds its own store (one store per Canvas), but
 * they all want the same input rules, and those rules depend on the child's
 * `inputMethod` — which can change in Profile between sessions, so they are
 * applied at runtime rather than baked in at store creation.
 *
 * The shape of both configurations follows from one goal: nothing the child
 * holds, and no pinch. Selection is always the head reticle in `HeadSelect`.
 * Controllers stay live in both modes purely as the facilitator's rescue hatch
 * — the child never holds one, and a controller resting on a table cannot fire
 * anything on its own because it still needs a trigger pull.
 */

/** Store options shared by every 360 game — pass to `createXRStore`. */
export const XR_STORE_OPTIONS = {
  // the child stays put in every game — no teleport/locomotion anywhere
  hand: { teleportPointer: false as const },
  controller: { teleportPointer: false as const },
  // no localhost headset emulation: its fake pose/controller interferes with
  // the on-screen (non-VR) mode during development, and real devices never use it
  emulate: false as const,
}

/**
 * Hand configuration per input method.
 *
 * `poke` keeps only the touch pointer, so the child's fingertip can press the
 * in-reach pad — and drops the ray and grab pointers, because those are the
 * pinch-at-a-distance gestures we are removing. The touch radii are opened up
 * well past the defaults: a child's poke lands approximately, not precisely.
 *
 * `dwell` turns hands off outright. A child who is not using their hands may
 * still wave them into view, and a stray pinch on a live ray would answer for
 * them.
 */
const HAND_CONFIG: Record<InputMethod, Parameters<XRStore['setHand']>[0]> = {
  poke: {
    teleportPointer: false,
    rayPointer: false,
    grabPointer: false,
    touchPointer: { hoverRadius: 0.07, downRadius: 0.025 },
  },
  dwell: false,
}

/**
 * Applies an input method to a game's store. Called by `HeadSelect`, which
 * every 360 scene already mounts, so scenes need no input wiring of their own.
 */
export function applyInputMethod(store: XRStore, method: InputMethod): void {
  store.setHand(HAND_CONFIG[method])
}
