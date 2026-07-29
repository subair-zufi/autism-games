import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'

/**
 * Puts the camera back where the scene put it when an immersive session ends.
 *
 * While a session is presenting, three's WebXRManager overwrites the camera's
 * position and orientation from the headset pose on every frame. Each scene's
 * `LookControls` re-asserts *rotation* once the session ends — it writes
 * `camera.rotation` every frame — but nothing restores *position*, so the flat
 * view is left standing wherever the child's head happened to be: offset by
 * however far they leaned or stepped, and at the headset's floor-relative
 * height rather than the scene's designed eye height.
 *
 * The visible result is quitting a game and landing in what looks like an empty
 * world — the camera is below the ground plane or inside scenery, so the whole
 * frame is one flat colour. Restoring the spawn position on session end fixes
 * it, and is harmless when the child never moved.
 *
 * Renders nothing — drop one inside each game's `<XR>`, next to `<HeadSelect>`.
 */
export function XRCameraHome() {
  const camera = useThree((s) => s.camera)
  const session = useXR((s) => s.session)

  // Captured on mount, before any session can have touched it, so this is the
  // position the scene declared on its <Canvas camera={{ position }}>.
  const home = useMemo(() => camera.position.clone(), [camera])
  const wasPresenting = useRef(false)

  useEffect(() => {
    if (session != null) {
      wasPresenting.current = true
      return
    }
    if (!wasPresenting.current) return
    wasPresenting.current = false
    camera.position.copy(home)
    camera.updateMatrixWorld()
  }, [session, camera, home])

  return null
}
