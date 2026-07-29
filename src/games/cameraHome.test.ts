import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { captureCameraHome, restoreCameraHome } from './cameraHome'

/** a camera set up the way every 360 scene sets up its <Canvas camera={{…}}> */
function sceneCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(60, 16 / 9, 0.1, 120)
  cam.position.set(0, 1.5, 0)
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld(true)
  return cam
}

/**
 * What three's WebXRManager.updateUserCamera leaves on the app camera while a
 * headset session is presenting: the head pose, and the two-eye union frustum
 * with an fov derived back out of it.
 */
function clobberAsXrWould(cam: PerspectiveCamera): void {
  cam.position.set(0.42, 1.13, -0.87) // wherever the child's head was
  cam.quaternion.set(0.1, 0.3, 0.05, 0.94).normalize()
  // a wide, off-axis union frustum — the [8] and [9] terms are the off-centre
  // shear a symmetric perspective matrix never has
  cam.projectionMatrix.set(
    0.6, 0, 0.13, 0,
    0, 0.55, -0.04, 0,
    0, 0, -1.0002, -0.2,
    0, 0, -1, 0,
  )
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()
  cam.fov = 104
  cam.zoom = 1
}

describe('camera restore after an immersive session', () => {
  it('puts back the scene position and fov', () => {
    const cam = sceneCamera()
    const home = captureCameraHome(cam)

    clobberAsXrWould(cam)
    restoreCameraHome(cam, home)

    expect(cam.fov).toBe(60)
    expect(cam.position.toArray()).toEqual([0, 1.5, 0])
    expect(cam.near).toBe(0.1)
    expect(cam.far).toBe(120)
  })

  it('rebuilds the projection matrix, dropping the headset union frustum', () => {
    const cam = sceneCamera()
    const home = captureCameraHome(cam)
    const expected = cam.projectionMatrix.toArray()

    clobberAsXrWould(cam)
    // guard the guard: the clobber really did change the projection
    expect(cam.projectionMatrix.toArray()).not.toEqual(expected)

    restoreCameraHome(cam, home)
    expect(cam.projectionMatrix.toArray()).toEqual(expected)
  })

  it('leaves no off-axis shear behind — the flat view is on-centre again', () => {
    const cam = sceneCamera()
    const home = captureCameraHome(cam)

    clobberAsXrWould(cam)
    restoreCameraHome(cam, home)

    // elements 8 and 9 carry the frustum's horizontal/vertical offset; a
    // symmetric on-axis perspective projection has both at exactly zero
    const m = cam.projectionMatrix.elements
    expect(m[8]).toBe(0)
    expect(m[9]).toBe(0)
  })

  it('is a no-op when the session never moved anything', () => {
    const cam = sceneCamera()
    const home = captureCameraHome(cam)
    const before = cam.projectionMatrix.toArray()

    restoreCameraHome(cam, home)

    expect(cam.projectionMatrix.toArray()).toEqual(before)
    expect(cam.position.toArray()).toEqual([0, 1.5, 0])
  })
})
