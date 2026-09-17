import { useCallback, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRayPointer, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import type { DwellProfile } from '../types'
import { noteAim } from './confirmTracking'
import {
  ARM_MS,
  DWELL_PROFILES,
  advanceAim,
  angleBetweenDeg,
  clearCandidate,
  createAimState,
  findSelectTarget,
  isConfirmChip,
  withinConfirmCone,
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
 * candidate and floats a ✓ chip on it; dwelling on that chip is what answers.
 * Scanning across faces never answers.
 *
 * Targets opt in with `userData={{ headSelect: true }}`. A confirmed selection
 * is re-emitted as an ordinary click on the candidate, so every game's existing
 * `onClick` handlers work untouched.
 *
 * Neither stage asks for precision the child has not already shown. The chip
 * catches a gaze pointing anywhere within `CONFIRM_TOL_DEG` of it, not only a
 * ray that physically lands on it, and a dwell that slips off drains instead of
 * resetting — between them these are what let a child with an unsteady head
 * answer at all. See `headAim.ts`.
 *
 * `confirmSide` picks where the chip parks. `"on"` — the default, and what
 * every scene now uses — hovers it just in front of the candidate's own
 * surface, along the same ray the gaze already used to arm it, so confirming
 * needs no head movement at all, not even a nod.
 *
 * `"below"` floats it under the candidate instead, which asks for a downward
 * nod AND a sustained hold in neck flexion. That was the original default and
 * the emotion games kept it longest; participant testing retired it. It is the
 * worst case for a child with poor head control — exactly the children the
 * dwell forgiveness in `headAim.ts` exists for — and it also requires looking
 * away from the very thing the trial is about right after correctly orienting
 * to it. Kept, with its cone ceiling below, for a scene where the chip would
 * cover something the child must keep seeing; nothing uses it today.
 */

/** Reticle size as a fraction of its distance — ~2.5° wide at any range. */
const RETICLE_ANGULAR = 0.045
/** Confirm chip size as a fraction of its distance — deliberately bigger.
 *  ~6deg wide. Its *catchment* is wider still (the profile's `tolDeg`); the
 *  drawn chip stays modest so it hides as little of the exhibit as possible. */
const CHIP_ANGULAR = 0.11
/** Theta segments in the dwell arc; also the resolution of its fill. */
const ARC_SEGMENTS = 48

const ARMED_COLOR = '#ffd95e'
const PROGRESS_COLOR = '#5ce08a'
const IDLE_COLOR = '#ffffff'

/** Default clearance (× chip scale) past the candidate's edge, "below" mode. */
const DEFAULT_GAP_BELOW = 1.1
/** Default clearance (× chip scale) in front of the candidate, "on" mode. */
const DEFAULT_GAP_ON = 0.5

export function HeadSelect({
  confirmSide = 'on',
  confirmGap,
}: {
  confirmSide?: 'below' | 'on'
  /** Override the clearance past the candidate's edge (or surface, in "on"
   *  mode), in chip-scale units. Smaller sits closer to (or just touching)
   *  the candidate. */
  confirmGap?: number
}) {
  const session = useXR((s) => s.session)
  const inputMethod = useSettings((s) => s.inputMethod)
  const profile = useSettings((s) => s.dwellProfile)
  if (!session || inputMethod !== 'dwell') return null
  const gap = confirmGap ?? (confirmSide === 'on' ? DEFAULT_GAP_ON : DEFAULT_GAP_BELOW)
  return <HeadSelectActive confirmSide={confirmSide} confirmGap={gap} profile={profile} />
}

function HeadSelectActive({
  confirmSide,
  confirmGap,
  profile,
}: {
  confirmSide: 'below' | 'on'
  confirmGap: number
  profile: DwellProfile
}) {
  // How forgiving this child's dwell is (types.ts `DwellProfile`). Read as a
  // value rather than baked in, so the trainer can loosen it from the remote
  // mid-session without leaving the game.
  const tuning = DWELL_PROFILES[profile]
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
  const tick = useRef<THREE.Group>(null)
  const arcGeo = useRef<THREE.RingGeometry>(null)
  const dotMat = useRef<THREE.MeshBasicMaterial>(null)
  const chip = useRef<THREE.Group>(null)

  const camPos = useMemo(() => new THREE.Vector3(), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  /** Where the chip sat at the end of last frame, and whether it was up at all.
   *  The chip is positioned later in this same callback, so the tolerance cone
   *  is tested against the previous frame — one frame of lag no eye can see,
   *  and much simpler than splitting the frame in two. */
  const chipWorld = useMemo(() => new THREE.Vector3(), [])
  const chipLive = useRef(false)
  /** Ceiling on the tolerance cone, so it can never reach back to the candidate
   *  itself — see where it is set, in the "below" branch below. */
  const coneLimit = useRef(Infinity)
  /** The last intersection seen while a chip was up. A cone confirm can land
   *  while the ray is over scenery that carries no pointer listener and so has
   *  no intersection at all; `commit` needs *some* event to retarget, or the
   *  answer is silently dropped after the candidate has already been cleared. */
  const lastInter = useRef<NonNullable<ReturnType<typeof pointer.getIntersection>> | null>(null)
  const box = useMemo(() => new THREE.Box3(), [])
  const centre = useMemo(() => new THREE.Vector3(), [])
  const size = useMemo(() => new THREE.Vector3(), [])
  const toCam = useMemo(() => new THREE.Vector3(), [])
  // Where the gaze actually lands on the candidate's surface, kept fresh every
  // frame the ray is still on it. Hit volumes are deliberately oversized (the
  // park's "surprise" props are a 1.1m cube around a much smaller model), so
  // the box's geometric centre can sit well off whatever surface the child is
  // actually looking at — anchoring "on" mode there left the chip floating
  // somewhere the ray never re-crossed once the gaze held past arming, which
  // is why the confirm ring seemed to just never fill in for some objects.
  const armPoint = useMemo(() => new THREE.Vector3(), [])

  /**
   * Fires the answer on the candidate, not on the chip the gaze is actually
   * resting on. The pointer builds its event from its current intersection, so
   * retargeting a copy of that intersection at the candidate makes the event
   * dispatch from there and bubble as usual — no game needs a special path.
   */
  const commit = useCallback(
    (candidate: THREE.Object3D) => {
      const current = pointer.getIntersection() ?? lastInter.current
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
    if (inter != null) lastInter.current = inter
    const rawTarget = findSelectTarget(inter?.object)

    camera.getWorldPosition(camPos)
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)

    // Two ways to be "on the chip". The ray physically hitting it, as before —
    // and the gaze merely POINTING within CONFIRM_TOL_DEG of where it sits, for
    // a child whose head will not hold still long enough to keep a ray inside a
    // few degrees (see headAim.ts). The chip stays small; only what it catches
    // grows.
    //
    // The cone is withheld while the ray rests on a DIFFERENT selectable option.
    // At the ends of Museum 360's row two pedestals are only ~10deg apart, so a
    // gaze that has genuinely moved on could otherwise sit inside the old chip's
    // cone and finish a confirm for the exhibit it just left — answering for
    // something the child is demonstrably no longer looking at. Moving on must
    // mean re-arming, which is what the raw hit test still decides.
    const onChip = isConfirmChip(inter?.object)
    const nearChip =
      chipLive.current &&
      (rawTarget == null || rawTarget === aim.candidate) &&
      withinConfirmCone(
        [fwd.x, fwd.y, fwd.z],
        [chipWorld.x - camPos.x, chipWorld.y - camPos.y, chipWorld.z - camPos.z],
        Math.min(tuning.tolDeg, coneLimit.current),
      )
    const onConfirm = onChip || nearChip
    const target = onConfirm ? null : rawTarget
    const r = advanceAim(aim, { target, onConfirm }, dt * 1000, tuning.dwellMs, ARM_MS, tuning.graceMs)
    // Before the fire below, which dispatches the click synchronously and so
    // ends with the game reading these totals back out.
    noteAim(r)
    // Anchor the confirm chip's "on"-mode point to the gaze spot on the CURRENT
    // candidate only — not to any target the ray happens to graze. Updating it
    // for a not-yet-armed target teleported the chip in front of whatever the
    // child glanced at next; because the chip then sits on the gaze ray and
    // intercepts it, that new target could never accumulate the arming dwell —
    // so the candidate stayed the first thing armed and confirming fired the
    // wrong option (in Football 360: the ball went to a teammate the child
    // wasn't looking at, costing a life). Tracking only the candidate lets the
    // gaze move to a different option and re-arm it cleanly.
    if (target != null && target === r.candidate && inter != null) armPoint.copy(inter.point)

    // --- reticle ---------------------------------------------------------
    // The dot alone tracks the gaze at all times, like an ordinary pointer.
    // The ring and its dwell arc — the "tick mark" — only appear once the
    // gaze is actually armed on something selectable; showing them while the
    // child is just scanning the scene made the ring appear to skate around
    // the background on every glance, which read as distracting noise rather
    // than feedback.
    if (reticle.current != null) {
      if (inter != null) {
        reticle.current.visible = true
        // nudge toward the head so it never z-fights the surface it lands on
        reticle.current.position.copy(inter.point).lerp(camPos, 0.02)
        reticle.current.quaternion.copy(camera.quaternion)
        reticle.current.scale.setScalar(Math.max(inter.distance, 0.3) * RETICLE_ANGULAR)
      } else if (onConfirm) {
        // Confirming by cone while the ray is over scenery that carries no
        // pointer listener — common, since nothing is intersected unless it has
        // a handler. There is no surface to sit on, so ride the gaze ray at the
        // chip's own distance. Without this the ring, a child of this group,
        // would disappear exactly while it was filling.
        const d = Math.max(camPos.distanceTo(chipWorld), 0.3)
        reticle.current.visible = true
        reticle.current.position.copy(camPos).addScaledVector(fwd, d)
        reticle.current.quaternion.copy(camera.quaternion)
        reticle.current.scale.setScalar(d * RETICLE_ANGULAR)
      } else {
        reticle.current.visible = false
      }
    }
    if (tick.current != null) {
      tick.current.visible = r.armed
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

    // --- confirm chip, parked on or beside the candidate --------------------
    if (chip.current != null) {
      if (r.candidate != null) {
        // the marked object is usually an oversized invisible hit volume, which
        // is exactly the extent we want the chip to clear
        box.setFromObject(r.candidate)

        if (confirmSide === 'on') {
          // Hover the chip in front of wherever the gaze actually landed on
          // the candidate (`armPoint`), not the hit box's geometric centre —
          // hit volumes are oversized and often off-centre from the visible
          // surface (see `armPoint`'s declaration), so anchoring on the box
          // centre could park the chip somewhere the ray, still resting on
          // the real surface, would never cross again. Offsetting along the
          // same ray keeps the same apparent screen position, so confirming
          // needs no head movement at all.
          const dist = Math.max(camPos.distanceTo(armPoint), 0.3)
          box.getSize(size)
          const clearance = Math.max(size.x, size.y, size.z) * 0.5 + dist * CHIP_ANGULAR * confirmGap
          toCam.copy(camPos).sub(armPoint).normalize()
          chip.current.position.copy(armPoint).addScaledVector(toCam, clearance)
          chip.current.quaternion.copy(camera.quaternion)
        } else {
          box.getCenter(centre)
          const dist = Math.max(camPos.distanceTo(centre), 0.3)
          // x/z stay pinned to the candidate's own bearing — only the pitch
          // changes, so confirming never asks for a head turn, only a nod.
          chip.current.position.set(
            centre.x,
            box.min.y - dist * CHIP_ANGULAR * confirmGap,
            centre.z,
          )
          chip.current.quaternion.copy(camera.quaternion)
        }
        // Size the chip from where it ENDED UP, not from the candidate it was
        // measured against. The clearance above pushes it toward the head — by
        // half the hit volume in "on" mode — so scaling it at the candidate's
        // distance drew it nearer and therefore bigger than CHIP_ANGULAR says,
        // and by an amount that grew with the hit volume. On the emotion games'
        // 2.1m boards that is half again too large, covering the very face the
        // trial is about. Measuring from the chip's own distance makes
        // CHIP_ANGULAR mean what it claims: the same apparent size in every
        // game, whatever it is parked in front of.
        chip.current.scale.setScalar(Math.max(camPos.distanceTo(chip.current.position), 0.3) * CHIP_ANGULAR)
        chip.current.visible = true
        // what next frame's tolerance cone aims at
        chip.current.updateWorldMatrix(true, false)
        chip.current.getWorldPosition(chipWorld)
        chipLive.current = true

        // Ceiling on that cone, so it can never reach back to the candidate's
        // own surface. In "below" mode answering is meant to need a nod DOWN to
        // the chip; a cone wide enough to still cover the face would quietly
        // turn this back into single-stage dwell — resting on a face would
        // answer for it, the exact Midas-touch failure the two stages exist to
        // prevent (headAim.ts). Half the gap to the candidate's centre leaves
        // room to forgive a wobble while never crossing back, whatever a
        // scene's board size or viewing distance happens to be.
        // "on" mode needs no ceiling: its chip sits ON the line of sight to the
        // candidate by design, so a cone that reaches it is the whole point.
        coneLimit.current =
          confirmSide === 'on'
            ? Infinity
            : 0.5 *
              angleBetweenDeg(
                [centre.x - camPos.x, centre.y - camPos.y, centre.z - camPos.z],
                [chipWorld.x - camPos.x, chipWorld.y - camPos.y, chipWorld.z - camPos.z],
              )
      } else {
        // `visible = false` is not enough on its own: raycasting ignores it, so
        // a hidden chip left in place would still swallow the ray and stop any
        // face behind it from ever becoming a candidate. Park it out of reach.
        chip.current.visible = false
        chip.current.position.set(0, -1e4, 0)
        chipLive.current = false
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
        {/* ring + dwell arc — only shown while armed on a target or the confirm chip */}
        <group ref={tick} visible={false}>
          <mesh>
            <ringGeometry args={[0.6, 0.72, ARC_SEGMENTS]} />
            <meshBasicMaterial
              color={ARMED_COLOR}
              transparent
              opacity={0.95}
              depthTest={false}
              depthWrite={false}
              side={THREE.DoubleSide}
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
