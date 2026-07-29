import { createXRStore } from '@react-three/xr'
import { XR_STORE_OPTIONS } from '../xrInput'

/**
 * Shared WebXR session store for the practice scene. Its own instance (like
 * every other 360 game's `xrStore.ts`) since a store is tied 1:1 to a Canvas —
 * the practice scene mounts before the real game's own Canvas ever appears.
 */
export const xrStore = createXRStore(XR_STORE_OPTIONS)

/** Whether this browser can offer immersive VR (drives the Enter VR button). */
export async function vrSupported(): Promise<boolean> {
  try {
    return !!(await navigator.xr?.isSessionSupported('immersive-vr'))
  } catch {
    return false
  }
}
