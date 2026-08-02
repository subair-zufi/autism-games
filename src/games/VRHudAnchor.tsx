import { useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { DEFAULT_MIN_OFFSET_Y, HUD_SETTLE_S, hudEyeOffset } from './hudAnchor'

const pos = new THREE.Vector3()

/**
 * Slides a game's in-world HUD to the wearer's actual eye height.
 *
 * Wrap the contents of each game's `VRHud` in one of these, passing that
 * scene's own `EYE_Y` — the flat camera height its panel positions were tuned
 * against. See `hudAnchor.ts` for why this is needed at all.
 *
 * The offset is sampled once, a moment after the HUD mounts, and then held.
 * Deliberately not a per-frame follow: a HUD that tracked the head would be
 * head-locked, which is both uncomfortable and, for the children this is built
 * for, a panel that will not stay still. Latching keeps it world-locked — it
 * simply hangs at a height that suits this wearer. The trade is that a child
 * who starts standing and then sits keeps the standing layout for the rest of
 * the session; leaving and re-entering VR re-samples, since `VRHud` only
 * renders while a session is presenting and so remounts each time.
 */
export function VRHudAnchor({
  designEyeY,
  minOffsetY = DEFAULT_MIN_OFFSET_Y,
  children,
}: {
  /** the scene's declared flat camera height — what the HUD was laid out for */
  designEyeY: number
  /**
   * Floor on how far the HUD may drop for a short wearer. Defaults to
   * `DEFAULT_MIN_OFFSET_Y`, which keeps every scene's `VRInputSwitch` above
   * the floor. A scene whose HUD also hangs close above something taller
   * (Emotion Room's face boards) passes a stricter (less negative) value of
   * its own so the panel stops descending before it reaches that object too.
   */
  minOffsetY?: number
  children: ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const waited = useRef(0)
  const latched = useRef(false)

  useFrame((_, dt) => {
    if (latched.current) return
    const g = ref.current
    if (!g) return
    waited.current += dt
    if (waited.current < HUD_SETTLE_S) return
    // world position, not camera.position: on a headset the camera sits under
    // the XR origin group, so its local y is not the height above the floor
    camera.getWorldPosition(pos)
    g.position.y = hudEyeOffset(pos.y, designEyeY, minOffsetY)
    latched.current = true
  })

  return <group ref={ref}>{children}</group>
}
