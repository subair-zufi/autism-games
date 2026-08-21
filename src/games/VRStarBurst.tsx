import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A gold ⭐ that pops in the 3D world after a correct answer — the headset
 * counterpart of the flat games' DOM star. Inside an immersive WebXR session
 * only the 3D scene is drawn (the DOM overlay is invisible), so the win star
 * has to be a real object in the scene; this is that object.
 *
 * Two design points that matter for the 360 games:
 *  - it appears **in front of wherever the child is currently looking** (sampled
 *    from the camera the moment it fires), so a child who has turned to a target
 *    off to the side still sees it — not stuck at the home bearing;
 *  - it **latches** for the full pop regardless of how briefly the trigger held
 *    (e.g. Football's ~0.5s ball-travel window), and the whole thing is driven
 *    by `useFrame`, so nothing about the games' per-frame re-renders disturbs it.
 *
 * Fires on the rising edge of `show`, or whenever the numeric `trigger` changes
 * (use whichever the calling scene already has). It renders in the flat view
 * too, which is deliberate: one mechanism covers both, and it's verifiable
 * outside a headset.
 */

const SHOW_MS = 1300

// A five-pointed star in the XY plane, built once and shared.
function starGeometry(outer: number, inner: number, points = 5): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return new THREE.ShapeGeometry(shape)
}
const STAR_GEO = starGeometry(0.5, 0.21)

const FWD = new THREE.Vector3()
const WORLD = new THREE.Vector3()
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const WOBBLE_Q = new THREE.Quaternion()

export function VRStarBurst({
  show,
  trigger,
  distance = 2.6,
}: {
  /** Rising edge (false→true) fires the star. Use for a per-answer pulse. */
  show?: boolean
  /** Any change to this number fires the star. Use for a per-answer counter. */
  trigger?: number
  /** Metres in front of the wearer to place the star. */
  distance?: number
}) {
  const camera = useThree((s) => s.camera)
  const [visible, setVisible] = useState(false)
  const group = useRef<THREE.Group>(null)
  const anchorPos = useRef(new THREE.Vector3())
  const anchorQuat = useRef(new THREE.Quaternion())
  const startedAt = useRef(0)
  const prevShow = useRef(false)
  const prevTrigger = useRef<number | undefined>(trigger)

  function fire() {
    camera.getWorldPosition(WORLD)
    FWD.set(0, 0, -1).applyQuaternion(camera.quaternion)
    anchorPos.current.copy(WORLD).addScaledVector(FWD, distance)
    anchorQuat.current.copy(camera.quaternion)
    startedAt.current = performance.now()
    setVisible(true)
  }

  useEffect(() => {
    if (show && !prevShow.current) fire()
    prevShow.current = !!show
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  useEffect(() => {
    if (trigger !== undefined && trigger !== prevTrigger.current) {
      prevTrigger.current = trigger
      if (trigger > 0) fire()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  useEffect(() => {
    if (!visible) return
    const id = setTimeout(() => setVisible(false), SHOW_MS)
    return () => clearTimeout(id)
  }, [visible])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const dt = (performance.now() - startedAt.current) / 1000
    const pop = 1 - Math.pow(1 - Math.min(1, dt / 0.25), 3) // ease-out to full size
    const wobble = 1 + Math.sin(dt * 11) * 0.06
    // Face the wearer (anchorQuat), with a gentle Z wobble folded in so it does
    // not clobber that orientation.
    WOBBLE_Q.setFromAxisAngle(Z_AXIS, Math.sin(dt * 3) * 0.3)
    g.quaternion.copy(anchorQuat.current).multiply(WOBBLE_Q)
    g.position.copy(anchorPos.current)
    g.scale.setScalar((0.2 + pop * 0.9) * wobble)
    g.translateY(pop * 0.25) // gentle rise as it pops (local Y follows the facing)
  })

  if (!visible) return null
  return (
    <group ref={group}>
      {/* darker back plate for contrast against bright skies/walls */}
      <mesh geometry={STAR_GEO} position={[0, 0, -0.01]} scale={1.16}>
        <meshBasicMaterial color="#a86611" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={STAR_GEO}>
        <meshBasicMaterial color="#ffd21e" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
