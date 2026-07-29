import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { HeadSelect } from '../HeadSelect'
import { VRInputSwitch } from '../VRInputSwitch'
import {
  CARD_Y,
  cardBearingDeg,
  cardPosition,
  dragDistance,
  isDragTail,
  lookDrag,
  STAGE_RADIUS,
  stagePosition,
  type Behavior,
  type Performance,
  type Staging,
} from './logic'
import { JUDGMENTS } from './strings'
import type { Lang } from '../../i18n/strings'

/** the child's eye height — the camera stands here, in the middle of the yard */
const EYE_Y = 1.5

export type CardState = 'idle' | 'correct' | 'wrong' | 'dim'

export interface RightWay360SceneProps {
  behavior: Behavior
  staging: Staging
  /** where (signed degrees) the scene is being acted out this trial */
  stageBearingDeg: number
  /** true while the scene is up and answerable */
  active: boolean
  /** the judgment the child tapped (saidFine), or null */
  picked: boolean | null
  /** true once an answer is locked in (drives the reveal + friend reaction) */
  answered: boolean
  onPick: (saidFine: boolean) => void
  lang: Lang
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudPrompt: string
  hudProgress: string
}

export function RightWay360Scene(props: RightWay360SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 100 }}
      onCreated={({ camera, gl }) => {
        // yaw-then-pitch so dragging sideways always spins the yard level
        camera.rotation.order = 'YXZ'
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* a bright, calm morning — soft sky, no harsh shadows */}
        <color attach="background" args={['#dceaf3']} />
        <ambientLight intensity={0.95} color="#fffaf0" />
        <directionalLight position={[4, 12, 6]} intensity={0.65} color="#fff6e0" />
        <directionalLight position={[-6, 8, -5]} intensity={0.22} color="#e8f0ff" />
        <LookControls />
        <HeadSelect />
        <SchoolYard />
        {props.active && (
          <>
            <Stage key={props.behavior.id} {...props} />
            <JudgmentCards {...props} />
          </>
        )}
        <VRHud
          prompt={props.hudPrompt}
          progress={props.hudProgress}
          stageBearingDeg={props.stageBearingDeg}
        />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls (same as the other 360 games) --------------- */
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
    const clampPitch = (p: number) => Math.max(-0.4, Math.min(0.4, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the yard left, so the view turns right
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
    // inside a VR session the headset owns the camera — a real head turn IS the
    // look-around, so the drag controls stand down entirely
    if (state.gl.xr.isPresenting) return
    const v = view.current
    const k = Math.min(1, dt * 9)
    v.yaw += (v.tYaw - v.yaw) * k
    v.pitch += (v.tPitch - v.pitch) * k
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

/* ---- the yard: a calm green schoolyard ------------------------------------
 * Grass, a low hedge ring, trees and playground props (slide, swing) around
 * the back so the full 360° reads as a real yard when the child looks around —
 * but everything playable stays in the front arc.
 */
function SchoolYard() {
  const YARD_R = 9
  return (
    <group>
      {/* grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[YARD_R, 56]} />
        <meshStandardMaterial color="#a8c98a" />
      </mesh>
      {/* a sandy play path ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.8, 3.3, 56]} />
        <meshStandardMaterial color="#d9c9a3" />
      </mesh>
      {/* the child's standing spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#c5d6ae" />
      </mesh>
      {/* low hedge ring so the yard has a soft edge (open sky above) */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[YARD_R, YARD_R, 1.1, 48, 1, true]} />
        <meshStandardMaterial color="#7fa969" side={THREE.BackSide} />
      </mesh>
      {/* far treeline band above the hedge, all the way round */}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[YARD_R + 0.4, YARD_R + 0.4, 2.4, 48, 1, true]} />
        <meshStandardMaterial color="#b9d4c0" side={THREE.BackSide} />
      </mesh>
      {/* trees + playground props behind the child (decor only) */}
      <Tree bearingDeg={120} />
      <Tree bearingDeg={-125} />
      <Tree bearingDeg={165} />
      <Slide bearingDeg={-160} />
      <Swing bearingDeg={145} />
      {/* a soft sun */}
      <mesh position={[6, 9, -10]}>
        <circleGeometry args={[1.2, 32]} />
        <meshBasicMaterial color="#ffe9a8" />
      </mesh>
    </group>
  )
}

function propSpot(bearingDeg: number, radius: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180
  return [Math.sin(rad) * radius, -Math.cos(rad) * radius]
}

function Tree({ bearingDeg }: { bearingDeg: number }) {
  const [x, z] = propSpot(bearingDeg, 7.6)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 2.2, 10]} />
        <meshStandardMaterial color="#8a6a48" />
      </mesh>
      {[
        [0, 2.6, 0, 1.05],
        [0.6, 2.2, 0.2, 0.7],
        [-0.55, 2.25, -0.15, 0.65],
      ].map(([fx, fy, fz, r], i) => (
        <mesh key={i} position={[fx, fy as number, fz]}>
          <sphereGeometry args={[r as number, 14, 14]} />
          <meshStandardMaterial color={i === 0 ? '#6fa85a' : '#7cb968'} />
        </mesh>
      ))}
    </group>
  )
}

function Slide({ bearingDeg }: { bearingDeg: number }) {
  const [x, z] = propSpot(bearingDeg, 6.8)
  const yaw = (-bearingDeg * Math.PI) / 180
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {/* ladder */}
      <mesh position={[-0.7, 0.75, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.12, 1.5, 0.5]} />
        <meshStandardMaterial color="#e0b04f" />
      </mesh>
      {/* slide chute */}
      <mesh position={[0.35, 0.75, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[1.7, 0.08, 0.55]} />
        <meshStandardMaterial color="#e2554c" />
      </mesh>
    </group>
  )
}

function Swing({ bearingDeg }: { bearingDeg: number }) {
  const [x, z] = propSpot(bearingDeg, 6.8)
  const yaw = (-bearingDeg * Math.PI) / 180
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[-0.8, 0.8].map((px) => (
        <mesh key={px} position={[px, 1.0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.0, 8]} />
          <meshStandardMaterial color="#5b6b8c" />
        </mesh>
      ))}
      <mesh position={[0, 1.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.7, 8]} />
        <meshStandardMaterial color="#5b6b8c" />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.25]} />
        <meshStandardMaterial color="#e0b04f" />
      </mesh>
    </group>
  )
}

/* ---- the acted-out scene ---------------------------------------------------
 * Two kids perform the behaviour on a soft mat at the trial's bearing. The
 * pose engine below turns each Performance into a ~4 s looping animation, so
 * the scene *shows* the sentence: the walk-past walks, the snatch lunges, the
 * queue-cut runs to the front, the polite refusal speaks with a heart.
 */

const LOOP = 4
const REST = -0.15
const WAVE = 2.2
/** facing the other kid: actor faces +x, friend faces -x (stage-local) */
const R = Math.PI / 2
const L = -Math.PI / 2

interface KidPose {
  x: number
  z: number
  yaw: number
  lean: number
  arm: number
  bob: number
}

interface StagePoses {
  a: KidPose
  f: KidPose
  /** extra queued kids (absolute stage-local coords), empty when no queue */
  q: KidPose[]
  /** toy position, or null when this beat has no toy in play */
  toy: [number, number, number] | null
  /** bump-star scale 0..1 */
  bump: number
  /** angry-burst scale 0..1 (shouting) */
  burst: number
  /** where the bump/burst sits */
  sparkAt: [number, number, number]
}

const clamp01 = (u: number) => Math.min(1, Math.max(0, u))
const smooth = (u: number) => {
  const c = clamp01(u)
  return c * c * (3 - 2 * c)
}
/** eased 0→1 progress of t across [a, b] */
const seg = (t: number, a: number, b: number) => smooth((t - a) / (b - a))
/** eased on-then-off window over [a, b] */
const win = (t: number, a: number, b: number, fade = 0.35) => seg(t, a, a + fade) - seg(t, b - fade, b)
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** three-quarter stance: facing the other kid but angled a little toward the
 *  child, so both faces stay readable (pure profile hides the eyes) */
const TILT = 0.35

function basePoses(t: number): { a: KidPose; f: KidPose } {
  return {
    a: { x: -0.8, z: 0, yaw: R - TILT, lean: 0, arm: REST, bob: Math.sin(t * 1.8) * 0.03 },
    f: { x: 0.8, z: 0, yaw: L + TILT, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 2.1) * 0.03 },
  }
}

/** walking bob (little steps) */
const steps = (t: number) => Math.abs(Math.sin(t * 6)) * 0.045

/** The pose engine: one looping performance → everything the rig needs. */
function stagePoses(kind: Performance, tRaw: number): StagePoses {
  const t = tRaw % LOOP
  const { a, f } = basePoses(t)
  const out: StagePoses = { a, f, q: [], toy: null, bump: 0, burst: 0, sparkAt: [0, 1.3, 0.4] }

  switch (kind) {
    case 'greet': {
      a.arm = lerp(REST, WAVE, win(t, 0.2, 3.4)) + Math.sin(t * 6) * 0.25 * win(t, 0.2, 3.4)
      f.arm = lerp(REST, WAVE, win(t, 0.9, 3.6)) + Math.sin(t * 6 + 1) * 0.25 * win(t, 0.9, 3.6)
      a.bob += Math.abs(Math.sin(t * 4)) * 0.03 * win(t, 0.5, 3.2)
      f.bob += Math.abs(Math.sin(t * 4 + 1)) * 0.03 * win(t, 1.2, 3.4)
      break
    }
    case 'politeTalk': {
      // kind words: gentle talking nods both ways (the heart cue floats above)
      a.lean = 0.05 + Math.sin(t * 3) * 0.04
      f.lean = 0.04 + Math.sin(t * 3 + 1.4) * 0.04
      a.arm = lerp(REST, 0.9, win(t, 0.6, 3.2))
      break
    }
    case 'shout': {
      const w = win(t, 0.5, 3)
      a.lean = 0.35 * w + Math.sin(t * 10) * 0.05 * w
      out.burst = w
      out.sparkAt = [a.x + 0.55, 1.75, 0.25]
      f.lean = -0.25 * w
      f.x += 0.15 * w
      break
    }
    case 'offer': {
      const raise = seg(t, 0.3, 0.9) * (1 - seg(t, 3.1, 3.7))
      const glide = seg(t, 1.1, 2.0)
      a.arm = lerp(REST, 1.35, raise)
      f.arm = lerp(REST, 1.35, seg(t, 1.4, 2.2) * (1 - seg(t, 3.2, 3.8)))
      out.toy = [lerp(-0.42, 0.42, glide), 1.12 + Math.sin(glide * Math.PI) * 0.18, 0.08]
      const happy = win(t, 2.3, 3.5)
      a.bob += Math.abs(Math.sin(t * 5)) * 0.05 * happy
      f.bob += Math.abs(Math.sin(t * 5 + 1)) * 0.05 * happy
      break
    }
    case 'grab': {
      const lunge = seg(t, 0.5, 1.0)
      const yank = seg(t, 1.9, 2.3)
      const retreat = seg(t, 2.4, 3.0)
      a.x = -0.8 + 0.55 * lunge - 0.45 * retreat
      a.lean = 0.35 * lunge * (1 - yank)
      a.arm = lerp(REST, 1.5, lunge * (1 - yank))
      f.arm = lerp(REST, 0.95, win(t, 0.2, 2.3))
      f.lean = -0.16 * yank
      const jitter = win(t, 1.0, 1.9) * Math.sin(t * 16) * 0.05
      out.toy = [lerp(0.45, a.x + 0.3, yank) + jitter, lerp(1.0, 1.06, yank), 0.12]
      break
    }
    case 'hold':
    case 'holdTurn': {
      // clutching the toy; the friend asks politely with a reaching hand
      if (kind === 'holdTurn') a.yaw = R + Math.PI * 0.85
      else a.yaw += Math.sin(t * 1.2) * 0.12
      out.toy = kind === 'holdTurn' ? [-1.05, 1.02, -0.02] : [-0.52, 1.02, 0.14]
      f.arm = lerp(REST, 1.3, win(t, 0.6, 3.5)) + Math.sin(t * 3) * 0.05
      f.lean = 0.08
      break
    }
    case 'turnAway': {
      f.arm = lerp(REST, WAVE, win(t, 0.3, 2.3)) + Math.sin(t * 6) * 0.25 * win(t, 0.3, 2.3)
      a.yaw += Math.PI * seg(t, 1.0, 1.8)
      f.lean = 0.12 * seg(t, 2.6, 3.2) // slump: the hello went unanswered
      break
    }
    case 'walkPast': {
      const walk = seg(t, 0, 3.2)
      a.x = lerp(-2.3, 2.3, walk)
      a.z = 0.7
      a.lean = 0.22 // eyes on shoes
      a.bob = steps(t) * (walk < 1 ? 1 : 0)
      f.arm = lerp(REST, WAVE, win(t, 0.8, 2.0)) + Math.sin(t * 6) * 0.22 * win(t, 0.8, 2.0)
      f.lean = 0.12 * seg(t, 2.3, 2.9)
      break
    }
    case 'gentleTap': {
      const approach = seg(t, 0.2, 1.0)
      a.x = lerp(-1.5, 0.12, approach)
      a.z = 0.25
      a.bob = steps(t) * (1 - approach) + Math.sin(t * 1.8) * 0.02
      a.arm = lerp(REST, 1.5, win(t, 1.1, 2.2)) + Math.sin(t * 10) * 0.14 * win(t, 1.2, 1.9)
      // the friend starts facing away, feels the tap, turns and waves
      f.yaw = R - Math.PI * seg(t, 1.9, 2.5)
      f.arm = lerp(REST, WAVE, win(t, 2.5, 3.6))
      break
    }
    case 'crowd': {
      const approach = seg(t, 0.4, 1.4)
      a.x = lerp(-0.8, 0.32, approach)
      a.lean = 0.18 * approach + Math.sin(t * 4) * 0.03 * approach
      f.lean = -0.3 * approach
      f.x += 0.18 * approach
      break
    }
    case 'leanOver': {
      // the friend is bent over their drawing; the actor looms right over it
      f.yaw = 0
      f.lean = 0.5
      const approach = seg(t, 0.3, 1.2)
      a.x = lerp(-1.4, 0.25, approach)
      a.z = 0.35
      a.yaw = 0.5
      a.bob = steps(t) * (1 - approach)
      a.lean = 0.55 * seg(t, 1.0, 1.8) + Math.sin(t * 2) * 0.02
      break
    }
    case 'queueWait': {
      // the actor waits calmly at the back of the line
      f.x = 1.0
      f.yaw = R
      out.q = [
        { x: 0.25, z: 0, yaw: R, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 0.9) * 0.03 },
        { x: -0.5, z: 0, yaw: R, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 1.7) * 0.03 },
      ]
      a.x = -1.25
      a.yaw = R
      break
    }
    case 'queueCut': {
      // the actor sprints from the side straight to the front of the line
      f.x = 1.0
      f.yaw = R
      out.q = [
        { x: 0.25, z: 0, yaw: R, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 0.9) * 0.03 },
        { x: -0.5, z: 0, yaw: R, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 1.7) * 0.03 },
      ]
      const run = seg(t, 0.5, 1.6)
      a.x = lerp(-1.7, 1.6, run)
      a.z = lerp(0.9, 0, run)
      a.lean = 0.3 * win(t, 0.5, 1.8)
      a.bob = steps(t * 1.4) * win(t, 0.4, 1.7, 0.2)
      // the queue rocks as the actor barges in front
      const rock = Math.sin(t * 9) * 0.09 * win(t, 1.5, 2.4)
      f.lean = rock
      out.q.forEach((k, i) => (k.lean = rock * (i === 0 ? 0.7 : 0.4)))
      break
    }
    case 'queueHog': {
      // the actor stays at the front, holding on, while the line waits
      a.x = 1.0
      a.yaw = R
      out.toy = [1.28, 1.02, 0.14]
      f.x = 0.2
      f.yaw = R
      f.lean = Math.sin(t * 2.6) * 0.06 // impatient shuffle
      out.q = [
        { x: -0.55, z: 0, yaw: R, lean: Math.sin(t * 2.6 + 1.2) * 0.06, arm: REST, bob: Math.sin(t * 1.8 + 0.9) * 0.03 },
        { x: -1.3, z: 0, yaw: R, lean: Math.sin(t * 2.6 + 2.2) * 0.06, arm: REST, bob: Math.sin(t * 1.8 + 1.7) * 0.03 },
      ]
      break
    }
    case 'usherFirst': {
      // "you go first" — the actor steps aside and waves the friend ahead
      a.x = 0.35
      a.z = 0.5
      a.arm = lerp(REST, 1.4, win(t, 0.4, 3.2)) + Math.sin(t * 3) * 0.15 * win(t, 0.4, 3.2)
      const go = seg(t, 1.0, 2.2)
      f.x = lerp(-0.6, 1.35, go)
      f.yaw = R
      f.bob = steps(t) * (go > 0 && go < 1 ? 1 : 0) + Math.sin(t * 1.8) * 0.02
      break
    }
    case 'pushThrough': {
      // barging between two queued kids — they part, a bump star pops
      f.x = 0.45
      f.yaw = R
      out.q = [{ x: -0.45, z: 0, yaw: R, lean: 0, arm: REST, bob: Math.sin(t * 1.8 + 0.9) * 0.03 }]
      const through = seg(t, 0.4, 2.2)
      a.x = lerp(-1.9, 1.9, through)
      a.z = 0
      a.lean = 0.25 * win(t, 0.4, 2.3)
      a.bob = steps(t * 1.2) * win(t, 0.3, 2.3, 0.2)
      const part = win(t, 1.0, 2.0)
      f.z = -0.35 * part
      out.q[0].z = 0.35 * part
      out.bump = win(t, 1.15, 1.75)
      out.sparkAt = [a.x, 1.3, 0.3]
      break
    }
    case 'apologize': {
      // bump!, then a little sorry-bow with hands together
      a.x = -0.35
      out.bump = win(t, 0.3, 0.95)
      out.sparkAt = [0.1, 1.3, 0.3]
      const bow = win(t, 1.1, 2.8)
      a.lean = 0.45 * bow
      a.arm = lerp(REST, 0.7, bow)
      f.lean = -0.12 * win(t, 0.3, 0.95) + Math.sin(t * 3) * 0.04 * win(t, 1.6, 2.8)
      break
    }
    case 'bumpWalkOff': {
      // bump!, then the actor just walks away without a word
      out.bump = win(t, 0.3, 0.95)
      out.sparkAt = [0.15, 1.3, 0.3]
      a.x = -0.3
      f.lean = -0.18 * win(t, 0.3, 0.95) + 0.15 * seg(t, 2.6, 3.4)
      const turn = seg(t, 1.0, 1.4)
      const off = seg(t, 1.2, 2.8)
      a.yaw = R - Math.PI * turn
      a.x = lerp(-0.3, -2.3, off)
      a.bob = steps(t) * (off > 0 && off < 1 ? 1 : 0)
      break
    }
  }
  return out
}

/* ---- the kid rig (same friendly blocky kids as the flat game) -------------- */

interface KidHandle {
  set(p: KidPose): void
}

const Kid = forwardRef<KidHandle, { shirt: string; small?: boolean }>(function Kid(
  { shirt, small = false },
  ref,
) {
  const root = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  useImperativeHandle(ref, () => ({
    set(p: KidPose) {
      const g = root.current
      if (!g) return
      g.position.set(p.x, p.bob, p.z)
      g.rotation.set(p.lean, p.yaw, 0)
      if (arm.current) arm.current.rotation.z = p.arm
    },
  }))
  const skin = '#f2c89b'
  const s = small ? 0.85 : 1
  return (
    <group ref={root} scale={s}>
      {/* legs */}
      <mesh position={[-0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      <mesh position={[0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      {/* torso */}
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.6, 0.8, 0.34]} /><meshStandardMaterial color={shirt} /></mesh>
      {/* left arm */}
      <mesh position={[-0.42, 1.05, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={shirt} />
      </mesh>
      {/* right arm (animated: wave / reach / point) */}
      <group ref={arm} position={[0.42, 1.35, 0]}>
        <mesh position={[0, -0.3, 0]}><boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh position={[0, -0.65, 0]}><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color={skin} /></mesh>
      </group>
      {/* head */}
      <mesh position={[0, 1.75, 0]}><sphereGeometry args={[0.34, 24, 24]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[-0.12, 1.78, 0.3]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      <mesh position={[0.12, 1.78, 0.3]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      <mesh position={[0, 1.62, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} /><meshStandardMaterial color="#c2706a" />
      </mesh>
    </group>
  )
})

/* ---- stage assembly --------------------------------------------------------- */

function Stage(props: RightWay360SceneProps) {
  const { behavior, staging, stageBearingDeg, answered, picked } = props
  const [sx, sz] = stagePosition(stageBearingDeg)
  const bearingRad = (stageBearingDeg * Math.PI) / 180

  const actor = useRef<KidHandle>(null)
  const friend = useRef<KidHandle>(null)
  const extras = [useRef<KidHandle>(null), useRef<KidHandle>(null)]
  const toy = useRef<THREE.Group>(null)
  const bump = useRef<THREE.Mesh>(null)
  const burst = useRef<THREE.Mesh>(null)
  const actorBubble = useRef<THREE.Group>(null)
  const friendBubble = useRef<THREE.Group>(null)
  const heart = useRef<THREE.Group>(null)
  const spark = useRef<THREE.Mesh>(null)
  const t0 = useRef<number | null>(null)

  const isQueue = staging.line || staging.performance === 'pushThrough'
  const correct = answered && picked === behavior.isFine

  useFrame((s) => {
    if (t0.current === null) t0.current = s.clock.elapsedTime
    const t = s.clock.elapsedTime - t0.current
    const p = stagePoses(staging.performance, t)
    actor.current?.set(p.a)
    friend.current?.set(p.f)
    extras.forEach((ref, i) => {
      const k = p.q[i]
      if (k) ref.current?.set(k)
    })
    if (toy.current) {
      toy.current.visible = !!p.toy && staging.toy
      if (p.toy) toy.current.position.set(...p.toy)
    }
    if (bump.current) {
      bump.current.position.set(...p.sparkAt)
      bump.current.scale.setScalar(Math.max(0.001, p.bump))
      bump.current.rotation.z += 0.03
    }
    if (burst.current) {
      burst.current.position.set(...p.sparkAt)
      const pulse = 1 + Math.sin(t * 9) * 0.15
      burst.current.scale.setScalar(Math.max(0.001, p.burst * pulse))
    }
    // the speech bubbles ride along with whoever they belong to
    actorBubble.current?.position.set(p.a.x, 2.5 + p.a.bob + Math.sin(t * 2) * 0.04, p.a.z + 0.1)
    friendBubble.current?.position.set(p.f.x, 2.5 + p.f.bob, p.f.z + 0.1)
    if (heart.current) {
      heart.current.position.set(p.a.x + 0.45, 2.05 + Math.sin(t * 3) * 0.07, p.a.z + 0.1)
      heart.current.rotation.z = Math.sin(t * 2) * 0.15
    }
    if (spark.current) {
      spark.current.rotation.y = t * 2.2
      spark.current.scale.setScalar(1 + Math.sin(t * 5) * 0.2)
    }
  })

  return (
    <group position={[sx, 0, sz]} rotation={[0, -bearingRad, 0]}>
      {/* the soft mat that marks where the scene is happening */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.1]}>
        <circleGeometry args={[2.3, 40]} />
        <meshStandardMaterial color="#c9dcb2" />
      </mesh>

      <Kid ref={actor} shirt="#7fb6d8" />
      <Kid ref={friend} shirt="#e3a3b5" />
      {isQueue && <Kid ref={extras[0]} shirt="#caa46f" small />}
      {staging.line && <Kid ref={extras[1]} shirt="#9bbf8f" small />}
      {/* what the queue is for: a little water-stand marker at the front */}
      {isQueue && (
        <group position={[1.9, 0, 0]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 1.1, 10]} />
            <meshStandardMaterial color="#9a9488" />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#5aa9e6" />
          </mesh>
        </group>
      )}

      {/* the toy the exchange is about */}
      <group ref={toy} visible={false}>
        {['#e2554c', '#f5c542', '#5aa9e6'].map((c, i) => (
          <mesh key={c} position={[0, i * 0.2 - 0.2, 0]}>
            <boxGeometry args={[0.24, 0.2, 0.24]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>

      {/* cartoon bump star / angry burst */}
      <mesh ref={bump} scale={0.001}>
        <octahedronGeometry args={[0.24]} />
        <meshStandardMaterial color="#ffd54a" emissive="#f5b301" emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={burst} scale={0.001}>
        <octahedronGeometry args={[0.2]} />
        <meshStandardMaterial color="#ef6a5e" emissive="#d43d2f" emissiveIntensity={0.6} />
      </mesh>

      {/* the behaviour's emoji over the actor — ties the scene to the sentence */}
      <group ref={actorBubble}>
        <EmojiBubble emoji={staging.bubble} />
      </group>

      {/* kind-words heart (the flat scene's polite cue) */}
      {staging.heart && (
        <group ref={heart}>
          <Heart />
        </group>
      )}

      {/* after answering, the friend shows how the behaviour felt — the
          consequence, never a pre-answer cue */}
      {answered && (
        <group ref={friendBubble}>
          <EmojiBubble emoji={behavior.isFine ? '😊' : '😟'} />
        </group>
      )}

      {/* gold sparkle over the scene on a correct judgment */}
      {correct && (
        <mesh ref={spark} position={[0, 3.0, 0]}>
          <octahedronGeometry args={[0.16]} />
          <meshBasicMaterial color="#f4b740" />
        </mesh>
      )}
    </group>
  )
}

/** A rounded speech bubble with one big emoji, drawn to a canvas texture. */
function EmojiBubble({ emoji }: { emoji: string }) {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 256
    const ctx = cv.getContext('2d')!
    ctx.beginPath()
    ctx.arc(128, 112, 96, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.fill()
    ctx.lineWidth = 7
    ctx.strokeStyle = '#c9cdd6'
    ctx.stroke()
    // tail
    ctx.beginPath()
    ctx.moveTo(104, 196)
    ctx.lineTo(128, 244)
    ctx.lineTo(152, 196)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.fill()
    ctx.font = '104px "Comic Sans MS", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, 128, 118)
    const tex = new THREE.CanvasTexture(cv)
    return tex
  }, [emoji])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh>
      <planeGeometry args={[0.62, 0.62]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/** A floating heart for the polite/kind-words cue (same as the flat scene). */
function Heart() {
  return (
    <group>
      <mesh position={[-0.07, 0.04, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
      <mesh position={[0.07, 0.04, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
      <mesh position={[0, -0.06, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.16, 0.16, 0.12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
    </group>
  )
}

/* ---- the two judgment cards ------------------------------------------------- */

const STATE_BORDER: Record<CardState, string> = {
  idle: '#c9cdd6',
  correct: '#22c55e',
  wrong: '#ef6a5e',
  dim: '#9aa0ab',
}

function JudgmentCards(props: RightWay360SceneProps) {
  const { behavior, stageBearingDeg, picked, answered, onPick, lang } = props
  return (
    <group>
      {JUDGMENTS.map((j, i) => {
        const state: CardState = !answered
          ? 'idle'
          : j.saidFine === behavior.isFine
            ? 'correct'
            : picked === j.saidFine
              ? 'wrong'
              : 'dim'
        return (
          <JudgmentCard
            key={String(j.saidFine)}
            i={i}
            stageDeg={stageBearingDeg}
            emoji={j.emoji}
            label={j.label[lang]}
            state={state}
            disabled={answered}
            onTap={() => onPick(j.saidFine)}
          />
        )
      })}
    </group>
  )
}

function JudgmentCard({
  i,
  stageDeg,
  emoji,
  label,
  state,
  disabled,
  onTap,
}: {
  i: number
  stageDeg: number
  emoji: string
  label: string
  state: CardState
  disabled: boolean
  onTap: () => void
}) {
  const [x, z] = cardPosition(i, stageDeg)
  const bearingRad = (cardBearingDeg(i, stageDeg) * Math.PI) / 180
  const W = 0.78
  const H = 0.62

  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = Math.round((512 * H) / W)
    return new THREE.CanvasTexture(cv)
  }, [])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const r = cv.height * 0.16
    ctx.beginPath()
    ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, r)
    ctx.fillStyle = state === 'dim' ? 'rgba(244,246,250,0.55)' : '#f8fafc'
    ctx.fill()
    ctx.lineWidth = state === 'idle' ? 8 : 14
    ctx.strokeStyle = STATE_BORDER[state]
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cx = cv.width / 2
    ctx.font = `${Math.round(cv.height * 0.36)}px "Comic Sans MS", sans-serif`
    ctx.fillText(emoji, cx, cv.height * 0.32)
    let size = Math.round(cv.height * 0.17)
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 2
    } while (ctx.measureText(label).width > cv.width - 48 && size > 12)
    ctx.fillStyle = '#2a2f3a'
    ctx.fillText(label, cx, cv.height * 0.74)
    texture.needsUpdate = true
  }, [texture, emoji, label, state])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group position={[x, CARD_Y, z]} rotation={[0, -bearingRad, 0]}>
      <mesh
        // a spent card must not arm the reticle or light the poke pad
        userData={{ headSelect: !disabled }}
        onClick={(e) => {
          e.stopPropagation()
          // a drag that ends on the card is looking around, not a tap. XR
          // trigger/pinch events carry no drag distance and count as clean taps.
          if (disabled || isDragTail() || dragDistance(e) > 8) return
          onTap()
        }}
        onPointerOver={() => !disabled && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}

/* ---- in-world HUD for VR ----------------------------------------------------
 * The DOM prompt banner cannot be seen inside an immersive session, so the
 * behaviour sentence + question is mirrored on a floating panel that hangs
 * ABOVE the acted-out scene (it follows the stage's bearing — right where the
 * child is already looking), with the trial progress riding a little higher.
 */
function VRHud({
  prompt,
  progress,
  stageBearingDeg,
}: {
  prompt: string
  progress: string
  stageBearingDeg: number
}) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  const rad = (stageBearingDeg * Math.PI) / 180
  const x = Math.sin(rad) * STAGE_RADIUS
  const z = -Math.cos(rad) * STAGE_RADIUS
  return (
    <>
      <group position={[x, 0, z]} rotation={[0, -rad, 0]}>
        <TextPanel text={prompt} position={[0, 3.15, 0]} width={4.4} height={0.72} font={64} />
        <TextPanel text={progress} position={[0, 3.8, 0]} width={1.7} height={0.46} font={88} />
      </group>
      {/* fixed bearing, not the stage's — stages roam ±50°, so the switch sits
          just outside that arc where it can never cover a scene */}
      <VRInputSwitch bearingDeg={-70} />
    </>
  )
}

/**
 * A rounded dark panel with centred text, drawn to a CanvasTexture — no font
 * assets needed, and the browser's own fonts cover Malayalam script too.
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
    const r = cv.height * 0.3
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = 'rgba(34, 44, 34, 0.82)'
    ctx.fill()
    ctx.fillStyle = '#f7f4ea'
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
