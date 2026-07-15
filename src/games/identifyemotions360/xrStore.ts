import { createXRStore } from '@react-three/xr'

/**
 * Shared WebXR session store for Emotion Clips 360. On a headset (e.g. Meta
 * Quest) the child enters immersive VR and the headset drives the camera — a
 * real head turn replaces the drag-to-look controls. On screens without WebXR
 * the game plays exactly as before; nothing here activates.
 *
 * Lives in its own module so the game component (Enter VR button, ending the
 * session on game over) and the scene (<XR> provider) can share one store.
 */
export const xrStore = createXRStore({
  // the child sits still facing the screen — no teleport/locomotion
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
