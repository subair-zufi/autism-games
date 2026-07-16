import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HEAD_SAMPLE_HZ, sampleHeadPose } from './headTracking'

const RAD2DEG = 180 / Math.PI
const dir = new THREE.Vector3()

/**
 * Samples the camera's world facing into the headTracking singleton at
 * ~HEAD_SAMPLE_HZ, in and out of VR: on a headset the session drives the camera
 * so this captures the real head turn; on screen it captures the drag-to-look
 * yaw. Renders nothing — drop one inside each game's <XR>, next to
 * <LookControls>, and read the per-trial summary with `headMetrics`.
 */
export function HeadSampler() {
  const camera = useThree((s) => s.camera)
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 1 / HEAD_SAMPLE_HZ) return
    acc.current = 0
    camera.getWorldDirection(dir)
    // yaw: 0 = straight ahead (−z), left(−)/right(+) — matches targetBearingDeg
    const yaw = Math.atan2(dir.x, -dir.z) * RAD2DEG
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * RAD2DEG
    sampleHeadPose(yaw, pitch)
  })
  return null
}
