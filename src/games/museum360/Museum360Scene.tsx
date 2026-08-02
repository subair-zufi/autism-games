import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { HeadSelect } from '../HeadSelect'
import { XRCameraHome } from '../XRCameraHome'
import { VRGameOver } from '../VRGameOver'
import { HeadSampler } from '../HeadSampler'
import { angDiffDeg, latestYawDeg } from '../headTracking'
import { VRQuitButton } from '../VRQuitButton'
import { VRInputSwitch } from '../VRInputSwitch'
import { VRHudAnchor } from '../VRHudAnchor'
import {
  AVATAR_Z,
  OBJECT_RADIUS,
  bearingToXZ,
  dragDistance,
  isDragTail,
  lookDrag,
  slotPosition,
  type CueMode,
  type ExhibitId,
  type Round,
} from './logic'

// shorter pedestals than the flat-screen Museum Look: the exhibits sit a bit
// lower so they clear the helper avatar standing behind the row (the avatar's
// face and pointing arm stay readable above the exhibits)
const PEDESTAL_H = 0.6
const EXHIBIT_Y = PEDESTAL_H + 0.5
/** the child's eye height — the camera stands here, at the centre of the rotunda */
const EYE_Y = 1.7

export interface Museum360SceneProps {
  round: Round
  locked: boolean
  disabledIds: ExhibitId[]
  celebrate: number
  /** joint-attention cue level: pulse = highlighted point, hover = plain point, distal = point from afar */
  cue: CueMode
  onPick: (id: ExhibitId) => void
  /** fired once per round, the moment the pointing cue has settled on the target */
  onCueReady: () => void
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function Museum360Scene(props: Museum360SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 60 }}
      onCreated={({ camera }) => {
        // yaw-then-pitch so dragging sideways always spins the room level
        camera.rotation.order = 'YXZ'
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        <color attach="background" args={['#2a2520']} />
        {/* soft warm ambient so nothing is pitch black */}
        <ambientLight intensity={0.55} color="#fff3e0" />
        <LookControls />
        <HeadSelect confirmSide="above" />
        <XRCameraHome />
        <VRGameOver />
        <HeadSampler />
        <RotundaRoom />
        <SceneInner {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls ------------------------------------------
 * The camera never moves — the child stands at the centre of the room and
 * drags (touch or mouse) or scrolls to turn their view, like a panorama
 * viewer. Pitch is clamped so the room never flips; motion is damped so
 * turning feels smooth, not jumpy (gentler for sensory comfort).
 */

function LookControls() {
  const { camera, gl } = useThree()
  const view = useRef({ yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 })

  useEffect(() => {
    const el = gl.domElement
    let down = false
    let lastX = 0
    let lastY = 0
    let startX = 0
    let startY = 0
    const clampPitch = (p: number) => Math.max(-0.5, Math.min(0.35, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the room left, so the view turns right
      v.tYaw -= (e.clientX - lastX) * 0.0042
      v.tPitch = clampPitch(v.tPitch + (e.clientY - lastY) * 0.0032)
      lastX = e.clientX
      lastY = e.clientY
      lookDrag.px = Math.max(lookDrag.px, Math.hypot(e.clientX - startX, e.clientY - startY))
    }
    const onUp = () => {
      if (down) lookDrag.endedAt = Date.now()
      down = false
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      view.current.tYaw += d * 0.0022
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, dt) => {
    // inside a VR session the headset owns the camera — a real head turn IS
    // the look-around, so the drag controls stand down entirely
    if (state.gl.xr.isPresenting) return
    const v = view.current
    const k = Math.min(1, dt * 9)
    v.yaw += (v.tYaw - v.yaw) * k
    v.pitch += (v.tPitch - v.pitch) * k
    // bearing θ (clockwise from forward/-z) maps to three.js rotation.y = -θ
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

/* ---- in-world HUD for VR --------------------------------------------------
 * The DOM score bar and prompt banner cannot be seen inside an immersive
 * session, so the same lines are mirrored on gentle floating panels at the
 * helper's bearing (0°) — the natural "home" direction the child returns to
 * between trials. Rendered only while a session is presenting.
 */
function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <VRHudAnchor designEyeY={EYE_Y}>
      <TextPanel text={score} position={[0, 4.35, -7.6]} width={2.6} height={0.62} font={110} />
      <TextPanel text={prompt} position={[0, 3.55, -7.6]} width={4.6} height={0.8} font={64} />
      {/* left of the outermost pedestal (≈−33°) — clear of the exhibits, with
          a bit more margin than the pedestal's own edge */}
      <VRQuitButton bearingDeg={-58} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-58} />
    </VRHudAnchor>
  )
}

/**
 * A rounded dark panel with centred text, drawn to a CanvasTexture — no font
 * assets needed, and the browser's own fonts cover Malayalam script too
 * (troika/drei Text would need a Malayalam font file).
 */
function TextPanel({
  text,
  position,
  width,
  height,
  font,
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  font: number
}) {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = Math.round((1024 * height) / width)
    return new THREE.CanvasTexture(cv)
  }, [width, height])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    // rounded backing
    const r = cv.height * 0.3
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = 'rgba(30, 24, 18, 0.82)'
    ctx.fill()
    // centred text, shrunk to fit if a line runs long
    ctx.fillStyle = '#fdf6e9'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = font
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 4
    } while (ctx.measureText(text).width > cv.width - 90 && size > 24)
    ctx.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [text, font, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/* ---- the rotunda: a circular gallery wrapped all the way around ---------- */
const ROOM_R = 9 // rotunda radius
const WALL_H = 7

function RotundaRoom() {
  const wallColor = '#ddd2c0'
  const trimColor = '#c4b79e'
  // paintings around the wall — bearing 0 is kept clear for the MUSEUM sign
  const paintingBearings = [45, 90, 135, 180, 225, 270, 315]
  const canvases = ['#7a93b5', '#b56b6b', '#7fae7a', '#c9a24a', '#9a7bb0', '#5a8fa8', '#b08a5a']
  return (
    <group>
      {/* polished marble floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[ROOM_R, 64]} />
        <meshStandardMaterial color="#cfc9c0" metalness={0.35} roughness={0.18} />
      </mesh>
      {/* a darker inlaid marble band running under the front row of exhibits */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, AVATAR_Z + OBJECT_RADIUS * 0.85]}>
        <circleGeometry args={[OBJECT_RADIUS + 1.1, 48]} />
        <meshStandardMaterial color="#bcb09a" metalness={0.3} roughness={0.25} />
      </mesh>
      {/* a small medallion where the child stands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <meshStandardMaterial color="#b3a68e" metalness={0.3} roughness={0.3} />
      </mesh>

      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <circleGeometry args={[ROOM_R, 64]} />
        <meshStandardMaterial color="#efe9dd" />
      </mesh>

      {/* the wall wraps the whole way around (inward-facing cylinder) */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <cylinderGeometry args={[ROOM_R, ROOM_R, WALL_H, 64, 1, true]} />
        <meshStandardMaterial color={wallColor} side={THREE.BackSide} />
      </mesh>
      {/* baseboard + crown trim rings */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[ROOM_R - 0.03, ROOM_R - 0.03, 0.4, 64, 1, true]} />
        <meshStandardMaterial color={trimColor} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, WALL_H - 0.25, 0]}>
        <cylinderGeometry args={[ROOM_R - 0.03, ROOM_R - 0.03, 0.5, 64, 1, true]} />
        <meshStandardMaterial color={trimColor} side={THREE.BackSide} />
      </mesh>

      {/* MUSEUM sign above the helper (bearing 0) */}
      <group position={[0, WALL_H - 1.3, -(ROOM_R - 0.15)]}>
        <MuseumSign />
      </group>

      {/* framed artwork wrapped around the wall */}
      {paintingBearings.map((deg, i) => {
        const a = (deg * Math.PI) / 180
        const [x, z] = bearingToXZ(a, ROOM_R - 0.15)
        return <Painting key={deg} position={[x, 3.6, z]} rotY={-a} canvas={canvases[i]} w={1.6} h={2} />
      })}

      {/* warm lighting: a central wash plus spots over the helper and the ring */}
      <pointLight position={[0, WALL_H - 1.2, 0]} intensity={55} distance={26} color="#fff1da" />
      <spotLight
        position={[0, WALL_H - 0.8, -1.6]}
        angle={0.7}
        penumbra={0.6}
        intensity={45}
        distance={18}
        color="#ffe6bf"
        target-position={[0, 0, -3.1]}
      />
      <spotLight
        position={[0, WALL_H - 0.6, 0]}
        angle={1.15}
        penumbra={0.7}
        intensity={65}
        distance={22}
        color="#ffe6bf"
        target-position={[0, 0, 0.01]}
      />

      {/* visitor benches tucked between pedestals, out of the click area */}
      <Bench bearingDeg={125} />
      <Bench bearingDeg={235} />
    </group>
  )
}

function MuseumSign() {
  return (
    <group>
      {/* banner backing */}
      <mesh>
        <boxGeometry args={[6.2, 1.1, 0.08]} />
        <meshStandardMaterial color="#5c2230" />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[5.9, 0.85, 0.06]} />
        <meshStandardMaterial color="#7a2d3e" />
      </mesh>
      {/* "MUSEUM" rendered as simple gold letter blocks */}
      <SignLetters />
    </group>
  )
}

/** spells MUSEUM with little extruded gold blocks (no font dependency). */
function SignLetters() {
  // 5x7 pixel patterns per letter, rows top->bottom
  const FONT: Record<string, string[]> = {
    M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  }
  const word = 'MUSEUM'
  const px = 0.07 // pixel size
  const letterW = 5 * px
  const gap = px * 1.6
  const totalW = word.length * letterW + (word.length - 1) * gap
  const blocks: { x: number; y: number }[] = []
  let cursor = -totalW / 2
  for (const ch of word) {
    const pat = FONT[ch]
    for (let r = 0; r < pat.length; r++) {
      for (let c = 0; c < 5; c++) {
        if (pat[r][c] === '1') {
          blocks.push({ x: cursor + c * px, y: (3 - r) * px })
        }
      }
    }
    cursor += letterW + gap
  }
  return (
    <group position={[0, 0, 0.09]}>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x + px / 2, b.y, 0]}>
          <boxGeometry args={[px * 0.95, px * 0.95, 0.04]} />
          <meshStandardMaterial color="#e9c66b" emissive="#9c7a1f" emissiveIntensity={0.3} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Painting({
  position,
  canvas,
  w,
  h,
  rotY = 0,
}: {
  position: [number, number, number]
  canvas: string
  w: number
  h: number
  rotY?: number
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* gilt frame */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[w + 0.22, h + 0.22, 0.08]} />
        <meshStandardMaterial color="#b08a2e" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* inner mat */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshStandardMaterial color="#f3ecdc" />
      </mesh>
      {/* the canvas */}
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={canvas} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bench({ bearingDeg }: { bearingDeg: number }) {
  const a = (bearingDeg * Math.PI) / 180
  const [x, z] = bearingToXZ(a, ROOM_R - 1.6)
  return (
    <group position={[x, 0, z]} rotation={[0, -a + Math.PI / 2, 0]}>
      {/* seat */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.18, 0.6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.7} />
      </mesh>
      {/* legs */}
      {[-0.75, 0.75].map((dx) =>
        [-0.22, 0.22].map((dz) => (
          <mesh key={`${dx}-${dz}`} position={[dx, 0.25, dz]}>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color="#4a3320" />
          </mesh>
        )),
      )}
    </group>
  )
}

function SceneInner({ round, locked, disabledIds, celebrate, cue, onPick, onCueReady }: Museum360SceneProps) {
  const n = round.visible.length
  const targetIdx = round.visible.indexOf(round.target)
  const [tx, tz] = slotPosition(targetIdx, n)
  const aimPoint = new THREE.Vector3(tx, EXHIBIT_Y, tz)

  return (
    <group>
      {cue === 'pulse' && <TargetRing x={tx} z={tz} />}

      {round.visible.map((id, i) => {
        const [x, z] = slotPosition(i, n)
        return (
          <Exhibit
            key={id}
            id={id}
            position={[x, 0, z]}
            disabled={locked || disabledIds.includes(id)}
            celebrating={celebrate > 0 && id === round.target}
            onPick={() => onPick(id)}
          />
        )
      })}

      {/* one person, one cue: the helper avatar at their "home" spot (bearing
          0) is the single source of every cue — a second floating hand would
          split the child's attention between two places */}
      <HelperFigure mode={cue} cueKey={round.target} aimPoint={aimPoint} onSettled={onCueReady} />

      {/* podium the helper stands on, behind the row, so the exhibits never
          hide its face or merge with its body (the gaze cue needs the face
          readable). Two tiers so it reads as a small stage, not a plinth. */}
      <group position={[0, 0, HELPER_Z]}>
        <mesh position={[0, HELPER_LIFT * 0.35, 0]}>
          <cylinderGeometry args={[1.15, 1.3, HELPER_LIFT * 0.7, 32]} />
          <meshStandardMaterial color="#b3a68e" metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, HELPER_LIFT * 0.85, 0]}>
          <cylinderGeometry args={[0.95, 1.1, HELPER_LIFT * 0.3, 32]} />
          <meshStandardMaterial color="#c3b79e" metalness={0.2} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

/* ---- the helper: a full standing avatar behind the front row --------------
 * The avatar is the SINGLE source of every cue (a second floating hand split
 * the child's attention between two places — Quest pilot feedback). It stands
 * behind the row of exhibits, facing the child, on a low dais so the row never
 * hides its face. On hand rungs the body turns toward the target and a
 * shoulder-anchored arm points with a repeated thrust; the fading ladder is
 * expressed through the extra support around that one gesture:
 *   pulse  — point + fingertip sparkle trail + glowing ring at the target
 *   hover  — point + fingertip sparkle trail
 *   distal — plain point
 *   gaze   — no gesture: the head holds on the child (attention bid) until
 *            real eye contact, then shifts to the target and keeps
 *            alternating back to the child and out again
 * The trail shows the *direction* for about a metre and stops far short of
 * the target, so the child still extrapolates and searches.
 */
const HELPER_Z = AVATAR_Z // the avatar stands at the arc's centre, behind the row
// podium height — on odd-count levels one exhibit sits on the avatar's forward
// axis, so the avatar stands high enough that its head, torso and pointing arm
// all clear the row and only its legs pass behind the centre exhibit
const HELPER_LIFT = 1.0
const HELPER_POS = new THREE.Vector3(0, HELPER_LIFT, HELPER_Z)
const HEAD_POS = new THREE.Vector3(0, HELPER_LIFT + 1.74, HELPER_Z) // head pivot, world space
const CHILD_EYES = new THREE.Vector3(0, 1.5, 0) // roughly the child's face
const SHOULDER_LOCAL = new THREE.Vector3(0.3, 1.4, 0) // right shoulder, body-local
const ARM_LEN = 1.05 // shoulder to fingertip along the arm's +z
const TRAIL_DOTS = 4
// gaze cue: the shift to the target only starts once the child actually
// looks back at the avatar (real eye contact), not on a blind timer —
// but a child who doesn't orient at all still gets the cue eventually
const EYE_CONTACT_TOL_DEG = 15
const EYE_CONTACT_TIMEOUT_S = 6
const UP = new THREE.Vector3(0, 1, 0)
const FWD = new THREE.Vector3(0, 0, 1)
// scratch objects reused every frame
const lookM = new THREE.Matrix4()
const qHead = new THREE.Quaternion()
const qArm = new THREE.Quaternion()
const qBodyInv = new THREE.Quaternion()
const vShoulder = new THREE.Vector3()
const vDir = new THREE.Vector3()
const vLocal = new THREE.Vector3()
const vDot = new THREE.Vector3()

function HelperFigure({
  mode,
  cueKey,
  aimPoint,
  onSettled,
}: {
  mode: CueMode
  cueKey: ExhibitId
  aimPoint: THREE.Vector3
  onSettled: () => void
}) {
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const dots = useRef<(THREE.Mesh | null)[]>([])
  const yaw = useRef(0)
  const t0 = useRef<number | null>(null)
  const roundStart = useRef<number | null>(null)
  const eyeContact = useRef(false)
  const settled = useRef(false)
  // keep the latest callback without re-subscribing the frame loop
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    settled.current = false
    eyeContact.current = false
    t0.current = null // restart the attention-bid sequence each round
    roundStart.current = null
  }, [cueKey, mode])

  const handMode = mode !== 'gaze'
  const trailOn = mode === 'pulse' || mode === 'hover'

  useFrame((state, dt) => {
    const b = body.current
    const h = head.current
    if (!b || !h) return
    if (roundStart.current === null) roundStart.current = state.clock.elapsedTime

    // hold the attention bid (looking at the child) until real eye contact —
    // the child's head within EYE_CONTACT_TOL_DEG of the avatar's bearing
    // (0°) — rather than shifting to the target on a blind timer. A child who
    // never orients still gets the cue after EYE_CONTACT_TIMEOUT_S so the
    // round can't stall indefinitely.
    if (mode === 'gaze' && !eyeContact.current) {
      const waited = state.clock.elapsedTime - roundStart.current
      const looking = Math.abs(angDiffDeg(latestYawDeg(), 0)) <= EYE_CONTACT_TOL_DEG
      if (looking || waited > EYE_CONTACT_TIMEOUT_S) {
        eyeContact.current = true
        t0.current = state.clock.elapsedTime // start the shift cycle now
      } else {
        t0.current = state.clock.elapsedTime // keep t at 0: stay in the bid
      }
    }
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - t0.current
    const k = Math.min(1, dt * 5)

    // body swings toward the target — on gaze trials only subtly, keeping
    // gaze the head-led (harder) cue
    const yawToAim = Math.atan2(aimPoint.x - HELPER_POS.x, aimPoint.z - HELPER_POS.z)
    const yawGoal = (handMode ? 1 : 0.35) * yawToAim
    yaw.current += (yawGoal - yaw.current) * k
    b.rotation.y = yaw.current

    // head: look at the child first (the attention bid), then at the target;
    // gaze trials repeat the shift every few seconds so it reads as motion
    const inBid = mode === 'gaze' ? t % 3.0 < 0.75 : t < 0.45
    lookM.lookAt(inBid ? CHILD_EYES : aimPoint, HEAD_POS, UP)
    qHead.setFromRotationMatrix(lookM)
    h.quaternion.slerp(qHead, Math.min(1, dt * 6))
    // a light bob during the bid marks the moment the gaze shift starts
    h.position.y = 1.74 + (inBid ? Math.sin(state.clock.elapsedTime * 6) * 0.02 : 0)

    if (mode === 'gaze' && !settled.current && !inBid && h.quaternion.angleTo(qHead) < 0.12) {
      settled.current = true
      onSettledRef.current()
    }

    // every hand rung: the whole arm points from the shoulder with a thrust
    const a = arm.current
    if (a && handMode) {
      vShoulder.copy(SHOULDER_LOCAL).applyAxisAngle(UP, yaw.current).add(HELPER_POS)
      vDir.copy(aimPoint).sub(vShoulder).normalize()
      qArm.setFromUnitVectors(FWD, vDir)
      qBodyInv.setFromAxisAngle(UP, yaw.current).invert()
      qArm.premultiply(qBodyInv) // world → body-local (arm is a child of the body)
      a.quaternion.slerp(qArm, Math.min(1, dt * 6))
      const thrust = inBid ? 0 : Math.max(0, Math.sin((t - 0.45) * 2.4)) * 0.12
      vLocal.copy(vDir).applyAxisAngle(UP, -yaw.current)
      a.position.copy(SHOULDER_LOCAL).addScaledVector(vLocal, thrust)

      // fingertip sparkle trail (pulse/hover support): direction only,
      // never reaches the target
      if (trailOn) {
        for (let i = 0; i < dots.current.length; i++) {
          const dot = dots.current[i]
          if (!dot) continue
          const phase = (t * 0.55 + i / TRAIL_DOTS) % 1
          vDot.copy(vShoulder).addScaledVector(vDir, ARM_LEN + thrust + 0.15 + phase * 1.1).sub(HELPER_POS)
          dot.position.copy(vDot)
          ;(dot.material as THREE.MeshBasicMaterial).opacity = inBid ? 0 : 0.85 * (1 - phase)
        }
      }

      if (!settled.current && !inBid && a.quaternion.angleTo(qArm) < 0.15 && Math.abs(yawGoal - yaw.current) < 0.12) {
        settled.current = true
        onSettledRef.current()
      }
    }
  })

  const skin = '#f2c89b'
  const shirt = '#7f8fb6'
  return (
    <group position={HELPER_POS.toArray()}>
      {/* body (yaw only): legs, torso and the pointing arm */}
      <group ref={body}>
        {/* legs + shoes */}
        {[-0.13, 0.13].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.36, 0]}>
              <cylinderGeometry args={[0.09, 0.1, 0.72, 10]} />
              <meshStandardMaterial color="#5a668c" />
            </mesh>
            <mesh position={[x, 0.045, 0.05]}>
              <boxGeometry args={[0.16, 0.09, 0.3]} />
              <meshStandardMaterial color="#3a3a44" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.75, 14]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* shoulders */}
        <mesh position={[0, 1.4, 0]} scale={[1, 0.55, 0.8]}>
          <sphereGeometry args={[0.32, 14, 14]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* neck, so the head sits on the body instead of in it */}
        <mesh position={[0, 1.52, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.18, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* shoulder joints keep both arms visually attached */}
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 1.4, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
        ))}
        {/* resting left arm: sleeve, forearm and a hand */}
        <group position={[-0.3, 1.4, 0]} rotation={[0, 0, 0.12]}>
          <mesh position={[0, -0.26, 0]}>
            <cylinderGeometry args={[0.065, 0.075, 0.5, 10]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh position={[0, -0.62, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.26, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, -0.8, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        {/* resting right arm — shown when the avatar is not pointing (gaze) */}
        <group position={[0.3, 1.4, 0]} rotation={[0, 0, -0.12]} visible={!handMode}>
          <mesh position={[0, -0.26, 0]}>
            <cylinderGeometry args={[0.065, 0.075, 0.5, 10]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh position={[0, -0.62, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.26, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, -0.8, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        {/* pointing right arm, built along +z, aimed in useFrame (hand rungs) */}
        <group ref={arm} position={SHOULDER_LOCAL.toArray()} visible={handMode}>
          <mesh position={[0, 0, 0.29]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.075, 0.58, 10]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh position={[0, 0, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.32, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          {/* a rounded hand with an extended index finger */}
          <mesh position={[0, 0, 0.9]} scale={[1, 0.9, 1.2]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
          <mesh position={[0, 0, ARM_LEN - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.022, 0.16, 8]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
      </group>

      {/* head — independent of body yaw, so gaze stays a head-led cue */}
      <group ref={head} position={[0, 1.74, 0]}>
        <mesh>
          <sphereGeometry args={[0.3, 20, 20]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.12, -0.05]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.32, 20, 20]} />
          <meshStandardMaterial color="#4a3320" />
        </mesh>
        {/* big high-contrast eyes — readable from across the room */}
        {[-0.11, 0.11].map((ex) => (
          <group key={ex} position={[ex, 0.03, 0.25]}>
            <mesh scale={[1, 1.3, 0.5]}>
              <sphereGeometry args={[0.075, 12, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0, 0.045]}>
              <sphereGeometry args={[0.04, 10, 10]} />
              <meshStandardMaterial color="#1c1712" />
            </mesh>
          </group>
        ))}
        {/* the nose makes head orientation legible even in profile */}
        <mesh position={[0, -0.03, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.045, 0.14, 10]} />
          <meshStandardMaterial color="#e8b888" />
        </mesh>
        {/* smile (arc flipped downward) */}
        <mesh position={[0, -0.13, 0.26]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.07, 0.018, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#9a5b4a" />
        </mesh>
      </group>

      {/* fingertip direction trail (pulse/hover support; positioned in useFrame) */}
      <group visible={trailOn}>
        {Array.from({ length: TRAIL_DOTS }, (_, i) => (
          <mesh key={i} ref={(m) => { dots.current[i] = m }}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#ffd95e" transparent opacity={0} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Soft pulsing ring around the target pedestal — the extra prompt used on easy. */
function TargetRing({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12
    m.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.62, 0.8, 32]} />
      <meshBasicMaterial color="#ffd95e" transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Exhibit({
  id,
  position,
  disabled,
  celebrating,
  onPick,
}: {
  id: ExhibitId
  position: [number, number, number]
  disabled: boolean
  celebrating: boolean
  onPick: () => void
}) {
  const model = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const wob = useRef(99)

  useEffect(() => {
    if (celebrating) wob.current = 0
  }, [celebrating])

  useFrame((state, dt) => {
    const g = model.current
    if (!g) return
    g.rotation.y += dt * 0.4
    let scale = hover && !disabled ? 1.12 : 1
    if (wob.current < 1) {
      wob.current += dt
      const fade = 1 - wob.current
      scale += Math.sin(wob.current * 14) * 0.18 * fade
      g.position.y = EXHIBIT_Y + Math.abs(Math.sin(wob.current * 10)) * 0.25 * fade
    } else {
      g.position.y = EXHIBIT_Y + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.04
    }
    g.scale.setScalar(scale)
  })

  return (
    <group position={position}>
      {/* slim pedestal — kept narrow so the row hides less of the avatar */}
      <mesh position={[0, PEDESTAL_H / 2, 0]}>
        <cylinderGeometry args={[0.28, 0.34, PEDESTAL_H, 20]} />
        <meshStandardMaterial color="#bcae98" />
      </mesh>
      <mesh position={[0, PEDESTAL_H + 0.03, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 20]} />
        <meshStandardMaterial color="#cdbfa6" />
      </mesh>

      {/* the exhibit model + a transparent click target around it */}
      <group ref={model} position={[0, EXHIBIT_Y, 0]}>
        <ExhibitModel id={id} />
        <mesh
          visible={false}
          // a locked exhibit must not arm the gaze reticle
          userData={{ headSelect: !disabled }}
          onClick={(e) => {
            e.stopPropagation()
            // a drag that ends on a pedestal is looking around, not a pick.
            // Checked against LookControls' own measurement (recent drag) AND
            // the event's drag distance where available — XR trigger/pinch
            // events carry neither and count as clean taps (dragDistance
            // swallows their throwing delta getter).
            if (isDragTail() || dragDistance(e) > 8) return
            if (!disabled) onPick()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            if (!disabled) document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = 'auto'
          }}
        >
          <boxGeometry args={[1, 1.2, 1]} />
        </mesh>
      </group>
    </group>
  )
}

function ExhibitModel({ id }: { id: ExhibitId }) {
  switch (id) {
    case 'gem':
      return (
        <mesh>
          <octahedronGeometry args={[0.42]} />
          <meshStandardMaterial color="#3fd0e0" emissive="#1f8aa0" emissiveIntensity={0.4} metalness={0.3} roughness={0.2} />
        </mesh>
      )
    case 'crystal':
      return (
        <mesh>
          <cylinderGeometry args={[0.18, 0.32, 0.95, 6]} />
          <meshStandardMaterial color="#b07fe0" emissive="#6f3fa0" emissiveIntensity={0.4} />
        </mesh>
      )
    case 'rocket':
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
            <meshStandardMaterial color="#f1f1f1" />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <coneGeometry args={[0.2, 0.35, 16]} />
            <meshStandardMaterial color="#e2554c" />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <coneGeometry args={[0.26, 0.2, 16]} />
            <meshStandardMaterial color="#f5a623" />
          </mesh>
        </group>
      )
    case 'vase':
      return (
        <group>
          <mesh position={[0, -0.1, 0]}>
            <sphereGeometry args={[0.33, 20, 20]} />
            <meshStandardMaterial color="#c97b4a" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.3, 16]} />
            <meshStandardMaterial color="#b86c3d" />
          </mesh>
        </group>
      )
    case 'mask':
      return (
        <group>
          <mesh scale={[1, 1.25, 0.4]}>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color="#d4af37" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[-0.12, 0.06, 0.16]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#2e2a3a" />
          </mesh>
          <mesh position={[0.12, 0.06, 0.16]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#2e2a3a" />
          </mesh>
        </group>
      )
    case 'dino':
      return (
        <group>
          <mesh position={[0, -0.1, 0]} scale={[1.2, 0.8, 0.8]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#6aa84f" />
          </mesh>
          <mesh position={[0.18, 0.22, 0.05]} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.08, 0.1, 0.5, 12]} />
            <meshStandardMaterial color="#6aa84f" />
          </mesh>
          <mesh position={[0.3, 0.42, 0.05]}>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshStandardMaterial color="#7cb45e" />
          </mesh>
          <mesh position={[-0.3, 0.0, 0.0]} rotation={[0, 0, 0.6]}>
            <coneGeometry args={[0.1, 0.4, 12]} />
            <meshStandardMaterial color="#5d9b53" />
          </mesh>
        </group>
      )
  }
}

