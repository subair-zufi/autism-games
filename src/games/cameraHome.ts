import type { Camera, PerspectiveCamera } from 'three'

/**
 * Capturing and restoring a scene's flat camera around an immersive session —
 * the pure part, so it can be tested against a real camera without a headset.
 * Mounted by `XRCameraHome`, which explains why this is needed at all.
 */

export interface CameraHome {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  /** null for a non-perspective camera; the games are all perspective */
  fov: number | null
  near: number
  far: number
  zoom: number
}

function asPerspective(camera: Camera): PerspectiveCamera | null {
  return (camera as PerspectiveCamera).isPerspectiveCamera ? (camera as PerspectiveCamera) : null
}

/** Snapshot the values the scene declared, before any session can touch them. */
export function captureCameraHome(camera: Camera): CameraHome {
  const p = asPerspective(camera)
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
    fov: p ? p.fov : null,
    near: p ? p.near : 0.1,
    far: p ? p.far : 2000,
    zoom: p ? p.zoom : 1,
  }
}

/**
 * Put everything back and rebuild the projection.
 *
 * The projection is the part that matters: while presenting, three copies the
 * headset's *union* frustum (two eyes, wide and off-axis) onto the app camera
 * and derives an fov from it. Restoring position alone leaves the flat view
 * rendering through that frustum, which is what puts nearly the whole scene
 * off-frame after quitting.
 */
export function restoreCameraHome(camera: Camera, home: CameraHome): void {
  camera.position.set(...home.position)
  camera.quaternion.set(...home.quaternion)

  const p = asPerspective(camera)
  if (p != null) {
    p.fov = home.fov ?? p.fov
    p.near = home.near
    p.far = home.far
    p.zoom = home.zoom
    p.updateProjectionMatrix()
  }
  camera.updateMatrixWorld(true)
}
