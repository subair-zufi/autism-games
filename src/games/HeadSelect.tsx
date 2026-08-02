import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRayPointer, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import {
  advanceAim,
  clearCandidate,
  createAimState,
  findSelectTarget,
  isConfirmChip,
} from './headAim'

/**
 * Gaze selection for the 360 games — the scene half.
 *
 * Drop one inside each game's `<XR>`, next to `<HeadSampler>`. It does nothing
 * outside an immersive session (on a flat screen the mouse already works) and
 * nothing when the child is set to `controller`.
 *
 * Selection is two-stage, because in these games looking at the options *is*
 * the task — see `headAim.ts`. Resting the gaze on something marks it as the
 * candidate and floats a ✓ chip just beside it; dwelling on that chip is what
 * answers. Scanning across faces never answers.
 *
 * Targets opt in with `userData={{ headSelect: true }}`. A confirmed selection
 * is re-emitted as an ordinary click on the candidate, so every game's existing
 * `onClick` handlers work untouched.
 *
 * `confirmSide` picks which side of the candidate the chip parks on. Sustained
 * downward neck flexion under headset weight is the uncomfortable direction,
 * and in the joint-attention/turn-taking games it also means looking away from
 * the very thing the trial is about right after correctly orienting to it — so
 * those games pass `"above"` instead of the default `"below"`.
 */

/** Reticle size as a fraction of its distance — ~2.5° wide at any range. */
const RETICLE_ANGULAR = 0.045
/** Confirm chip size as a fraction of its distance — deliberately bigger. */
const CHIP_ANGULAR = 0.075
/** Theta segments in the dwell arc; also the resolution of its fill. */
const ARC_SEGMENTS = 48

const ARMED_COLOR = '#ffd95e'
const PROGRESS_COLOR = '#5ce08a'
const IDLE_COLOR = '#ffffff'

/** Default clearance (× chip scale) past the candidate's edge, per side. */
const DEFAULT_GAP_BELOW = 1.1
const DEFAULT_GAP_ABOVE = 0.6

export function HeadSelect({
  confirmSide = 'below',
  confirmGap,
}: {
  confirmSide?: 'below' | 'above'
  /** Override the clearance past the candidate's edge, in chip-scale units.
   *  Smaller sits closer to (or just touching) the candidate. */
  confirmGap?: number
}) {
  const session = useXR((s) => s.session)
  const inputMethod = useSettings((s) => s.inputMethod)
  if (!session || inputMethod !== 'dwell') return null
  const gap = confirmGap ?? (confirmSide === 'above' ? DEFAULT_GAP_ABOVE : DEFAULT_GAP_BELOW)
  return <HeadSelectActive confirmSide={confirmSide} confirmGap={gap} />
}

function HeadSelectActive({
  confirmSide,
  confirmGap,
}: {
  confirmSide: 'below' | 'above'
  confirmGap: number
}) {
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
  const chip = useRef<THREE.Group>(null)

  const camPos = useMemo(() => new THREE.Vector3(), [])
  const box = useMemo(() => new THREE.Box3(), [])
  const centre = useMemo(() => new THREE.Vector3(), [])

  /**
   * Fires the answer on the candidate, not on the chip the gaze is actually
   * resting on. The pointer builds its event from its current intersection, so
   * retargeting a copy of that intersection at the candidate makes the event
   * dispatch from there and bubble as usual — no game needs a special path.
   */
  const commit = useCallback(
    (candidate: THREE.Object3D) => {
      const current = pointer.getIntersection()
      if (current == null) return
      pointer.setIntersection({ ...current, object: candidate })
      const now = performance.now()
      pointer.down({ timeStamp: now, button: 0 })
      pointer.up({ timeStamp: now, button: 0 })
    },
    [pointer],
  )

  // Priority 0 runs after the root combined pointer's move (−50), so the
  // intersection read here is this frame's.
  useFrame((_, dt) => {
    const inter = pointer.getIntersection()
    const onConfirm = isConfirmChip(inter?.object)
    const target = onConfirm ? null : findSelectTarget(inter?.object)
    const r = advanceAim(aim, { target, onConfirm }, dt * 1000)

    camera.getWorldPosition(camPos)

    // --- reticle ---------------------------------------------------------
    if (reticle.current != null) {
      if (inter == null) {
        reticle.current.visible = false
      } else {
        reticle.current.visible = true
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
    // clipping the index range draws a partial arc without rebuilding it. Only
    // the confirm dwell fills it — arming is too brief to be worth showing.
    if (arcGeo.current != null) {
      arcGeo.current.setDrawRange(0, Math.round(r.progress * ARC_SEGMENTS) * 6)
    }

    // --- confirm chip, parked beside the candidate -------------------------
    if (chip.current != null) {
      if (r.candidate != null) {
        // the marked object is usually an oversized invisible hit volume, which
        // is exactly the extent we want the chip to clear
        box.setFromObject(r.candidate)
        box.getCenter(centre)
        const dist = Math.max(camPos.distanceTo(centre), 0.3)
        const scale = dist * CHIP_ANGULAR
        // x/z stay pinned to the candidate's own bearing — only the pitch
        // changes, so confirming never asks for a head turn, only a nod.
        const y = confirmSide === 'above' ? box.max.y + scale * confirmGap : box.min.y - scale * confirmGap
        chip.current.position.set(centre.x, y, centre.z)
        chip.current.quaternion.copy(camera.quaternion)
        chip.current.scale.setScalar(scale)
        chip.current.visible = true
      } else {
        // `visible = false` is not enough on its own: raycasting ignores it, so
        // a hidden chip left in place would still swallow the ray and stop any
        // face behind it from ever becoming a candidate. Park it out of reach.
        chip.current.visible = false
        chip.current.position.set(0, -1e4, 0)
      }
    }

    if (r.fire && r.candidate != null) {
      const candidate = r.candidate
      clearCandidate(aim)
      commit(candidate)
    }
  })

  return (
    <>
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
        {/* confirm fill — starts at 12 o'clock, sweeps clockwise */}
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

      <group ref={chip} renderOrder={998} visible={false} userData={{ headConfirm: true }}>
        <ConfirmChip />
      </group>
    </>
  )
}

/**
 * The "choose this one" chip. Drawn to a CanvasTexture like every other bit of
 * in-world text in these games, so no font assets are needed. Carries a
 * no-op click handler purely so the pointer system treats it as a target —
 * objects without listeners are not intersected.
 */
function ConfirmChip() {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 256
    const tex = new THREE.CanvasTexture(cv)
    const ctx = cv.getContext('2d')
    if (ctx == null) return tex
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.beginPath()
    ctx.arc(cv.width / 2, cv.height / 2, cv.width / 2 - 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(46, 160, 100, 0.95)'
    ctx.fill()
    ctx.lineWidth = 12
    ctx.strokeStyle = '#eafff2'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 150px "Comic Sans MS", sans-serif'
    ctx.fillText('✓', cv.width / 2, cv.height / 2 + 8)
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <mesh onClick={(e) => e.stopPropagation()}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </mesh>
  )
}
