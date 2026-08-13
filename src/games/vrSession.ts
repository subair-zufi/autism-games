import { useSyncExternalStore } from 'react'
import type { XRStore } from '@react-three/xr'

/**
 * Whether the given `XRStore` currently has a live (presenting) WebXR
 * session — i.e. the child is actually inside the headset, not just looking
 * at the flat pre-VR screen.
 *
 * `XRStore` is a zustand vanilla store under the hood (it exposes
 * `getState`/`subscribe`), so this is readable from anywhere, not only from
 * inside the `<Canvas>`/`<XR>` tree — which matters here because the
 * "has the game started yet" gate in each `*Game.tsx` lives above the Canvas.
 */
export function useVrSessionActive(store: XRStore): boolean {
  return useSyncExternalStore(
    (onChange) => store.subscribe(onChange),
    () => !!store.getState().session,
  )
}
