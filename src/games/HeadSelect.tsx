import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRayPointer, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import { DWELL_MS, advanceAim, createAimState, findSelectTarget } from './headAim'

/**
 * Gaze selection for the 360 games — the scene half.
 *
 * Drop one inside each game's `<XR>`, next to `<HeadSampler>`. It does nothing
 * outside an immersive session (on a flat screen the mouse already works and a
 * head reticle would only get in the way) and nothing when the child is set to
 * `controller`, so the controller ray is then the only thing that can select.
 *
 * A ray goes straight out of the head with a reticle where it lands; resting it
 * on a target for `DWELL_MS` fills a ring and selects. Targets opt in with
 * `userData={{ headSelect: true }}`, and a selection re-emits as a normal click
 * on whatever the ray hit, so every game's existing `onClick` handlers work
 * untouched.
 */

/** Reticle size as a fraction of its distance — keeps it ~2.5° wide at any range. */
const RETICLE_ANGULAR = 0.045
/** Theta segments in the dwell arc; also the resolution of its fill. */
const ARC_SEGMENTS = 48

const ARMED_COLOR = '#ffd95e'
const PROGRESS_COLOR = '#5ce08a'
const IDLE_COLOR = '#ffffff'

export function HeadSelect() {
  const session = useXR((s) => s.session)
  const inputMethod = useSettings((s) => s.inputMethod)
  if (!session || inputMethod !== 'dwell') return null
  return <HeadSelectActive />
}

function HeadSelectActive() {
  const camera = useThree((s) => s.camera)

  // The ray pointer's "space" is the head itself: its world matrix is the head
  // pose inside a session, and −z (the pointer's default direction) is exactly
  // where the child is looking. Same camera `HeadSampler` reads its yaw from.
  const spaceRef = useRef<THREE.Object3D | null>(null)
  spaceRef.current = camera

  const pointerState = useMemo(() => ({ headSelect: true }), [])
  const pointer = useRayPointer(spaceRef, pointerState, undefined, 'gaze')

  const aim = useMemo(createAimState, [])

  const reticle = useRef<THREE.Group>(null)
  const arcGeo = useRef<THREE.RingGeometry>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const dotMat = useRef<THREE.MeshBasicMaterial>(null)

  const camPos = useMemo(() => new THREE.Vector3(), [])

  // Fires the selection as a real click on whatever the ray is resting on, so
  // the games need no selection-specific code path — down then up inside the
  // pointer's click threshold is exactly what a trigger produces.
  const commit = useCallback(() => {
    const now = performance.now()
    pointer.down({ timeStamp: now, button: 0 })
    pointer.up({ timeStamp: now, button: 0 })
  }, [pointer])

  // Priority 0 runs after the root combined pointer's move (−50), so the
  // intersection read here is this frame's.
  useFrame((_, dt) => {
    const inter = pointer.getIntersection()
    const target = findSelectTarget(inter?.object)
    const r = advanceAim(aim, target, dt * 1000, DWELL_MS)

    if (reticle.current != null) {
      if (inter == null) {
        reticle.current.visible = false
      } else {
        reticle.current.visible = true
        camera.getWorldPosition(camPos)
        // nudge toward the head so it never z-fights the surface it lands on
        reticle.current.position.copy(inter.point).lerp(camPos, 0.02)
        reticle.current.quaternion.copy(camera.quaternion)
        reticle.current.scale.setScalar(Math.max(inter.distance, 0.3) * RETICLE_ANGULAR)
      }
    }
    if (ringMat.current != null) {
      ringMat.current.opacity = r.armed ? 0.95 : 0.35
      ringMat.current.color.set(r.armed ? ARMED_COLOR : IDLE_COLOR)
    }
    if (dotMat.current != null) {
      dotMat.current.color.set(r.armed ? ARMED_COLOR : IDLE_COLOR)
    }
    // RingGeometry emits its theta segments in order, 2 triangles each, so
    // clipping the index range draws a partial arc without rebuilding it.
    if (arcGeo.current != null) {
      arcGeo.current.setDrawRange(0, Math.round(r.progress * ARC_SEGMENTS) * 6)
    }

    if (r.fire) commit()
  })

  return (
    <group ref={reticle} renderOrder={999} visible={false}>
      <mesh>
        <ringGeometry args={[0.6, 0.72, ARC_SEGMENTS]} />
        <meshBasicMaterial
          ref={ringMat}
          color={IDLE_COLOR}
          transparent
          opacity={0.35}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <circleGeometry args={[0.13, 20]} />
        <meshBasicMaterial
          ref={dotMat}
          color={IDLE_COLOR}
          transparent
          opacity={0.9}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* dwell fill — starts at 12 o'clock, sweeps clockwise */}
      <mesh>
        <ringGeometry ref={arcGeo} args={[0.55, 0.86, ARC_SEGMENTS, 1, Math.PI / 2, -Math.PI * 2]} />
        <meshBasicMaterial
          color={PROGRESS_COLOR}
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
