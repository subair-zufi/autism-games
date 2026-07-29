import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { captureCameraHome, restoreCameraHome } from './cameraHome'

/**
 * Restores the flat camera when an immersive session ends.
 *
 * three's `WebXRManager.updateUserCamera` drives the app camera from the
 * headset every frame while presenting, and puts nothing back afterwards. It
 * leaves behind the head pose *and* — the part that actually breaks things —
 * the XR camera's projection matrix, which on a headset is the union frustum
 * of two eyes: wide, and off-axis. r3f only recomputes projection on resize,
 * so the flat canvas goes on rendering through that frustum indefinitely.
 *
 * The visible result is quitting a game into what looks like an empty world
 * with a few things still drifting about in it: the scene is running fine, it
 * is just being viewed through a frustum that puts nearly all of it off-frame.
 * Restoring position alone does not fix it — the projection has to be rebuilt.
 *
 * Renders nothing — drop one inside each game's `<XR>`, next to `<HeadSelect>`.
 */
export function XRCameraHome() {
  const camera = useThree((s) => s.camera)
  const session = useXR((s) => s.session)

  // Captured on mount, before any session can have touched it, so this is what
  // the scene declared on its <Canvas camera={{ ... }}>.
  const home = useMemo(() => captureCameraHome(camera), [camera])
  const wasPresenting = useRef(false)

  useEffect(() => {
    if (session != null) {
      wasPresenting.current = true
      return
    }
    if (!wasPresenting.current) return
    wasPresenting.current = false
    restoreCameraHome(camera, home)
  }, [session, camera, home])

  return null
}
