import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  MIRROR_HEIGHT,
  MIRROR_QUALITY,
  MIRROR_WIDTH,
  isMirrorWanted,
  mirrorIntervalMs,
  flipRowsInPlace,
  publishMirrorFrame,
  reportMirrorFailure,
  shouldCapture,
} from './mirror'

/**
 * Renders the child's view a second time, small, so the trainer's phone can
 * show it. Drop one inside each 360 scene's `<XR>`, next to `<XRCameraHome>`.
 *
 * It has to be a second render pass. While a headset session is presenting,
 * three draws into the compositor's framebuffer and the page's own canvas is
 * left untouched — there is nothing on it to screenshot, which is why "just
 * copy the canvas" does not work in VR. So this points a plain camera at the
 * headset's pose, draws the same scene into a small offscreen target, reads it
 * back and encodes a JPEG.
 *
 * That is not free, so it is gated three ways: nothing happens unless a console
 * is actually watching (`isMirrorWanted`), captures are spaced out (~700ms),
 * and a capture still in flight never starts another. The readback is async
 * where the browser supports it, so the GPU is not stalled mid-frame.
 *
 * The renderer's state is put back exactly as it was found — render target,
 * viewport, scissor and `xr.enabled` — because this runs *inside* the headset's
 * own frame. Getting that wrong shows up as a flicker in one eye, on the device
 * that is hardest to debug on.
 */
export function RemoteMirror() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const kit = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(MIRROR_WIDTH, MIRROR_HEIGHT)
    const mirrorCam = new THREE.PerspectiveCamera(75, MIRROR_WIDTH / MIRROR_HEIGHT, 0.1, 400)
    const pixels = new Uint8Array(MIRROR_WIDTH * MIRROR_HEIGHT * 4)
    const canvas =
      typeof document === 'undefined' ? null : document.createElement('canvas')
    if (canvas) {
      canvas.width = MIRROR_WIDTH
      canvas.height = MIRROR_HEIGHT
    }
    return { target, mirrorCam, pixels, canvas, ctx: canvas?.getContext('2d') ?? null }
  }, [])

  useEffect(() => () => kit.target.dispose(), [kit])

  const busy = useRef(false)
  const lastAt = useRef(0)
  /** After a failure, stop trying for a while instead of burning frames on it. */
  const retryAt = useRef(0)

  useFrame(() => {
    if (!isMirrorWanted() || busy.current || !kit.ctx) return
    const now = performance.now()
    if (now < retryAt.current) return
    if (!shouldCapture(now, lastAt.current, mirrorIntervalMs())) return
    lastAt.current = now
    busy.current = true

    void capture()
      .catch((err) => {
        reportMirrorFailure(String(err))
        retryAt.current = performance.now() + 5000
      })
      .finally(() => {
        busy.current = false
      })
  })

  async function capture(): Promise<void> {
    const { target, mirrorCam, pixels, canvas, ctx } = kit
    if (!canvas || !ctx) return

    // Aim at wherever the headset (or, on a flat screen, the app camera) is
    // looking. The XR camera is an ArrayCamera spanning both eyes; its world
    // matrix is the point between them, which is what a spectator wants.
    const source = gl.xr.isPresenting ? gl.xr.getCamera() : camera
    mirrorCam.position.setFromMatrixPosition(source.matrixWorld)
    mirrorCam.quaternion.setFromRotationMatrix(source.matrixWorld)
    mirrorCam.updateMatrixWorld()

    const prevXrEnabled = gl.xr.enabled
    const prevTarget = gl.getRenderTarget()
    const prevViewport = new THREE.Vector4()
    const prevScissor = new THREE.Vector4()
    gl.getViewport(prevViewport)
    gl.getScissor(prevScissor)
    const prevScissorTest = gl.getScissorTest()

    try {
      gl.xr.enabled = false
      gl.setRenderTarget(target)
      gl.render(scene, mirrorCam)
    } finally {
      gl.setRenderTarget(prevTarget)
      gl.xr.enabled = prevXrEnabled
      gl.setViewport(prevViewport)
      gl.setScissor(prevScissor)
      gl.setScissorTest(prevScissorTest)
    }

    const readAsync = (
      gl as unknown as {
        readRenderTargetPixelsAsync?: (
          t: THREE.WebGLRenderTarget,
          x: number,
          y: number,
          w: number,
          h: number,
          buffer: Uint8Array,
        ) => Promise<void>
      }
    ).readRenderTargetPixelsAsync

    if (readAsync) {
      await readAsync.call(gl, target, 0, 0, MIRROR_WIDTH, MIRROR_HEIGHT, pixels)
    } else {
      gl.readRenderTargetPixels(target, 0, 0, MIRROR_WIDTH, MIRROR_HEIGHT, pixels)
    }

    flipRowsInPlace(pixels, MIRROR_WIDTH, MIRROR_HEIGHT)
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(pixels), MIRROR_WIDTH, MIRROR_HEIGHT),
      0,
      0,
    )
    publishMirrorFrame(canvas.toDataURL('image/jpeg', MIRROR_QUALITY))
  }

  return null
}
