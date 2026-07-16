import { createXRStore } from '@react-three/xr'

/**
 * Shared WebXR session store for the practice scene. Its own instance (like
 * every other 360 game's `xrStore.ts`) since a store is tied 1:1 to a Canvas —
 * the practice scene mounts before the real game's own Canvas ever appears.
 */
export const xrStore = createXRStore({
  hand: { teleportPointer: false },
  controller: { teleportPointer: false },
  // no localhost headset emulation: its fake pose/controller interferes with
  // the on-screen (non-VR) mode during development, and real devices never use it
  emulate: false,
})

/** Whether this browser can offer immersive VR (drives the Enter VR button). */
export async function vrSupported(): Promise<boolean> {
  try {
    return !!(await navigator.xr?.isSessionSupported('immersive-vr'))
  } catch {
    return false
  }
}
