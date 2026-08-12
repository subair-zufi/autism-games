import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { FLAT_SCREEN_DPR } from '../xrInput'
import { HeadSelect } from '../HeadSelect'
import { XRCameraHome } from '../XRCameraHome'
import { VRGameOver } from '../VRGameOver'
import { HeadSampler } from '../HeadSampler'
import { VRQuitButton } from '../VRQuitButton'
import { VRInputSwitch } from '../VRInputSwitch'
import { VRHudAnchor } from '../VRHudAnchor'
import {
  bearingToXZ,
  discoveryPosition,
  dragDistance,
  friendPosition,
  isDragTail,
  lookDrag,
  type DiscoveryId,
  type Friend,
  type Saliency,
} from './logic'

/** the child's eye height — the camera stands here, on the lawn */
const EYE_Y = 1.5

/** the surprises sit metres away now, not in a diorama — scaled up to match */
const MODEL_SCALE = 2.0
const SALIENCY_SCALE: Record<Saliency, number> = { big: 1.35, medium: 1, subtle: 0.72 }

/** model-local top of each surprise (metres before scaling) — the found
 *  sparkle floats just above this, not at a fixed height, so it hugs small
 *  models and large ones alike */
const MODEL_TOP: Record<DiscoveryId, number> = {
  butterfly: 0.2,
  bunny: 0.65,
  bird: 0.3,
  flower: 0.4,
  gem: 0.35,
  rainbow: 1.1,
}

/** world height of each surprise model's centre (fence rail for the bird, sky for the rainbow) */
const SURPRISE_Y: Record<DiscoveryId, number> = {
  butterfly: 1.5,
  bunny: 0.6,
  bird: 1.12, // perched on the front fence rail
  flower: 0.6,
  gem: 0.55,
  rainbow: 4.6, // up in the sky
}

export interface Park360SceneProps {
  /** the current surprise (only rendered while `active`) */
  discovery: DiscoveryId
  /** true from the moment the surprise pops in until the round ends */
  active: boolean
  saliency: Saliency
  /** the child has tapped the surprise (sparkle marker, stops the pulse ring) */
  found: boolean
  friend: Friend
  /** display name in the app language (canvas texture, so it shows inside VR too) */
  friendLabel: string
  friendState: 'away' | 'curious' | 'celebrating'
  /** radians the friend is turned away from the child (fades with difficulty) */
  awayYaw: number
  /** which helper nudge is showing, if any */
  nudge: 'find' | 'share' | null
  onTapDiscovery: () => void
  onTapFriend: () => void
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function Park360Scene(props: Park360SceneProps) {
  return (
    <Canvas
      dpr={FLAT_SCREEN_DPR}
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 120 }}
      onCreated={({ camera }) => {
        // yaw-then-pitch so dragging sideways always spins the park level
        camera.rotation.order = 'YXZ'
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* open-air morning sky */}
        <color attach="background" args={['#9ed7f2']} />
        <ambientLight intensity={0.85} color="#fdfbf4" />
        {/* the sun, plus a soft fill from the opposite side so faces read */}
        <directionalLight position={[10, 20, 6]} intensity={1.0} color="#fff7e0" />
        <directionalLight position={[-8, 9, -10]} intensity={0.3} />
        <LookControls />
        <HeadSelect confirmSide="on" />
        <XRCameraHome />
        <VRGameOver />
        <HeadSampler />
        <ParkWorld />
        <SceneInner {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls ------------------------------------------
 * Same controls as Museum 360: the camera never moves — the child stands on
 * the lawn and drags (touch or mouse) or scrolls to turn their view, like a
 * panorama viewer. Pitch is clamped so the park never flips; motion is
 * damped so turning feels smooth, not jumpy (gentler for sensory comfort).
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
    const clampPitch = (p: number) => Math.max(-0.5, Math.min(0.42, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the park left, so the view turns right
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
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

/* ---- in-world HUD for VR --------------------------------------------------
 * The DOM score bar and prompt banner cannot be seen inside an immersive
 * session, so the same lines are mirrored on gentle floating panels at
 * bearing 0 — the natural "home" direction the child returns to between
 * rounds. Rendered only while a session is presenting. Kept below the
 * rainbow's sky spot so the panels never block a tap on it.
 */
function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <VRHudAnchor designEyeY={EYE_Y}>
      <TextPanel text={score} position={[0, 3.9, -7.4]} width={2.6} height={0.62} font={110} />
      <TextPanel text={prompt} position={[0, 3.15, -7.4]} width={4.6} height={0.8} font={64} />
      {/* left of the outermost discovery (flower ≈−52°) — clear of the play
          area, with a bit more margin than the flower's own edge */}
      <VRQuitButton bearingDeg={-74} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-74} />
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
    ctx.fillStyle = 'rgba(24, 34, 24, 0.82)'
    ctx.fill()
    // centred text, shrunk to fit if a line runs long
    ctx.fillStyle = '#f4fbe9'
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

/* ---- the park: a full 360° open lawn --------------------------------------
 * The environment wraps the whole way around — looking behind shows more
 * park, sky and trees, so the world feels real — but everything *playable*
 * (surprise spots, the friend, the fence they perch on) stays in the front
 * half-circle, so the game itself never asks for more than a head turn.
 */
function ParkWorld() {
  // a loose ring of trees all around the lawn (decor only, out of the play arc's radius)
  const treeRing = [15, 48, 80, 112, 145, 178, 210, 243, 275, 308, 340]
  return (
    <group>
      {/* the lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[45, 64]} />
        <meshStandardMaterial color="#8fca79" />
      </mesh>
      {/* a lighter play-lawn patch where the game happens */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -3]}>
        <circleGeometry args={[6.5, 48]} />
        <meshStandardMaterial color="#a5d88e" />
      </mesh>
      {/* a sandy patch where the child stands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[1.0, 32]} />
        <meshStandardMaterial color="#e3d3a6" />
      </mesh>

      {/* distant tree line wrapping the full 360° */}
      {treeRing.map((deg, i) => {
        const a = (deg * Math.PI) / 180
        const r = 13 + (i % 3) * 3
        const [x, z] = bearingToXZ(a, r)
        return <Tree key={deg} x={x} z={z} scale={1.6 + (i % 2) * 0.5} />
      })}
      {/* nearer trees framing the play arc from the sides (outside it) */}
      <Tree x={bearingToXZ((-72 * Math.PI) / 180, 8)[0]} z={bearingToXZ((-72 * Math.PI) / 180, 8)[1]} scale={1.3} />
      <Tree x={bearingToXZ((70 * Math.PI) / 180, 8.5)[0]} z={bearingToXZ((70 * Math.PI) / 180, 8.5)[1]} scale={1.2} />
      <Bush x={-3.4} z={-3.2} />
      <Bush x={2.6} z={-4.6} />
      <Bush x={4.4} z={1.8} />
      <Bush x={-4.2} z={2.6} />

      {/* the low picket fence arcs across the front — the bird's landing spot */}
      <FrontFence />

      {/* the friend's flowerbed — what they are busy looking at */}
      <FlowerBed bearingDeg={53} radius={4.9} />

      {/* sun + a few drifting-still clouds */}
      <mesh position={[16, 22, -26]}>
        <sphereGeometry args={[2.6, 16, 16]} />
        <meshBasicMaterial color="#fff3c2" />
      </mesh>
      <Cloud x={-14} y={14} z={-24} s={1.4} />
      <Cloud x={9} y={17} z={-30} s={1.9} />
      <Cloud x={-2} y={15} z={26} s={1.6} />
      <Cloud x={20} y={13} z={10} s={1.3} />
    </group>
  )
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 1.6, 8]} />
        <meshStandardMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[1.05, 14, 14]} />
        <meshStandardMaterial color="#5da44e" />
      </mesh>
    </group>
  )
}

function Bush({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.32, z]}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshStandardMaterial color="#6fb35d" />
    </mesh>
  )
}

/** low picket fence arcing across the front of the play area (bird perch at bearing 0) */
function FrontFence() {
  const posts: number[] = []
  for (let deg = -58; deg <= 58; deg += 7.25) posts.push(deg)
  const R = 6.2
  return (
    <group>
      {posts.map((deg) => {
        const a = (deg * Math.PI) / 180
        const [x, z] = bearingToXZ(a, R)
        return (
          <mesh key={deg} position={[x, 0.5, z]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.1, 1.0, 0.07]} />
            <meshStandardMaterial color="#c8b08a" />
          </mesh>
        )
      })}
      {/* the rail, as short straight segments between posts */}
      {posts.slice(0, -1).map((deg) => {
        const a1 = (deg * Math.PI) / 180
        const a2 = ((deg + 7.25) * Math.PI) / 180
        const [x1, z1] = bearingToXZ(a1, R)
        const [x2, z2] = bearingToXZ(a2, R)
        const mx = (x1 + x2) / 2
        const mz = (z1 + z2) / 2
        const len = Math.hypot(x2 - x1, z2 - z1)
        const yaw = Math.atan2(x2 - x1, z2 - z1)
        return (
          <mesh key={deg} position={[mx, 0.92, mz]} rotation={[0, yaw, 0]}>
            <boxGeometry args={[0.06, 0.08, len]} />
            <meshStandardMaterial color="#c8b08a" />
          </mesh>
        )
      })}
    </group>
  )
}

function FlowerBed({ bearingDeg, radius }: { bearingDeg: number; radius: number }) {
  const [x, z] = bearingToXZ((bearingDeg * Math.PI) / 180, radius)
  const colors = ['#e2554c', '#f5c542', '#b07fe0', '#f473b9', '#5aa9e6']
  return (
    <group position={[x, 0, z]}>
      {/* a soil patch under the flowers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshStandardMaterial color="#9a7a52" />
      </mesh>
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2
        return (
          <group key={c} position={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.4, 6]} />
              <meshStandardMaterial color="#4d8a3d" />
            </mesh>
            <mesh position={[0, 0.44, 0]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Cloud({ x, y, z, s }: { x: number; y: number; z: number; s: number }) {
  return (
    <group position={[x, y, z]} scale={s}>
      {[
        [0, 0, 0, 1.1],
        [1.2, 0.25, 0.2, 0.85],
        [-1.1, 0.15, -0.1, 0.8],
        [0.3, 0.55, 0, 0.7],
      ].map(([cx, cy, cz, r], i) => (
        <mesh key={i} position={[cx, cy, cz]}>
          <sphereGeometry args={[r, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

/* ---- the play layer -------------------------------------------------------- */

function SceneInner(props: Park360SceneProps) {
  const { discovery, active, saliency, found, nudge } = props
  const [dx, dz] = discoveryPosition(discovery)

  return (
    <group>
      {active && (
        <Surprise
          key={discovery}
          id={discovery}
          x={dx}
          z={dz}
          saliency={saliency}
          found={found}
          nudged={nudge === 'find'}
          onTap={props.onTapDiscovery}
        />
      )}
      <FriendKid {...props} />
    </group>
  )
}

function Surprise({
  id,
  x,
  z,
  saliency,
  found,
  nudged,
  onTap,
}: {
  id: DiscoveryId
  x: number
  z: number
  saliency: Saliency
  found: boolean
  nudged: boolean
  onTap: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const spark = useRef<THREE.Mesh>(null)
  const grow = useRef(0) // 0 -> 1 pop-in spring
  const target = SALIENCY_SCALE[saliency] * MODEL_SCALE
  // the pulse ring announces the surprise on `big` saliency or a find-nudge,
  // and disappears once found — sharing, not finding, is then the open step
  const showRing = (saliency === 'big' || nudged) && !found

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    grow.current = Math.min(1, grow.current + dt * 2.4)
    // pop with a little overshoot, then settle
    const overshoot = 1 + Math.sin(grow.current * Math.PI) * 0.25
    g.scale.setScalar(target * grow.current * overshoot)
    if (ring.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.14
      ring.current.scale.setScalar(s)
    }
    if (spark.current) {
      spark.current.rotation.y = state.clock.elapsedTime * 2.2
      const s = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.2
      spark.current.scale.setScalar(s)
    }
  })

  const y = SURPRISE_Y[id]
  return (
    <group position={[x, 0, z]}>
      {showRing && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.9, 1.15, 32]} />
          <meshBasicMaterial color="#ffd95e" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={group} position={[0, y, 0]} scale={0}>
        <SurpriseModel id={id} />
        {/* transparent tap target, comfortably larger than the model */}
        <mesh
          visible={false}
          userData={{ headSelect: true }}
          onClick={(e) => {
            e.stopPropagation()
            // a drag that ends on the surprise is looking around, not a tap.
            // XR trigger/pinch events carry no drag distance and count as
            // clean taps (dragDistance swallows their throwing delta getter).
            if (isDragTail() || dragDistance(e) > 8) return
            onTap()
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <boxGeometry args={[1.1, 1.1, 1.1]} />
        </mesh>
      </group>
      {/* found marker: the child's "point" planted on the discovery — a gold
          sparkle mesh, not a DOM overlay, so it shows inside VR too */}
      {found && (
        <mesh ref={spark} position={[0, y + MODEL_TOP[id] * target + 0.3, 0]}>
          <octahedronGeometry args={[0.16]} />
          <meshBasicMaterial color="#ffd95e" />
        </mesh>
      )}
    </group>
  )
}

function SurpriseModel({ id }: { id: DiscoveryId }) {
  switch (id) {
    case 'butterfly':
      return <Butterfly />
    case 'bunny':
      return (
        <group>
          {/* body + head */}
          <mesh position={[0, 0, 0]} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.26, 14, 14]} />
            <meshStandardMaterial color="#f5f1ea" />
          </mesh>
          <mesh position={[0, 0.28, 0.05]}>
            <sphereGeometry args={[0.17, 14, 14]} />
            <meshStandardMaterial color="#f5f1ea" />
          </mesh>
          {/* ears */}
          {[-0.07, 0.07].map((ex) => (
            <mesh key={ex} position={[ex, 0.52, 0.02]} rotation={[0, 0, ex * -1.2]}>
              <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
              <meshStandardMaterial color="#f0dede" />
            </mesh>
          ))}
          {/* eyes + nose */}
          {[-0.06, 0.06].map((ex) => (
            <mesh key={ex} position={[ex, 0.3, 0.19]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#2b2620" />
            </mesh>
          ))}
          <mesh position={[0, 0.25, 0.21]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#d98a8a" />
          </mesh>
        </group>
      )
    case 'bird':
      return (
        <group>
          <mesh scale={[1.15, 0.9, 0.9]}>
            <sphereGeometry args={[0.16, 14, 14]} />
            <meshStandardMaterial color="#5aa9e6" />
          </mesh>
          <mesh position={[0.1, 0.14, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#5aa9e6" />
          </mesh>
          <mesh position={[0.2, 0.14, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.035, 0.09, 8]} />
            <meshStandardMaterial color="#f5a623" />
          </mesh>
          <mesh position={[0.11, 0.17, 0.07]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#2b2620" />
          </mesh>
          {/* tail */}
          <mesh position={[-0.17, 0.04, 0]} rotation={[0, 0, 0.7]}>
            <boxGeometry args={[0.16, 0.05, 0.08]} />
            <meshStandardMaterial color="#3f7fb5" />
          </mesh>
        </group>
      )
    case 'flower':
      return (
        <group>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.03, 0.035, 0.5, 8]} />
            <meshStandardMaterial color="#4d8a3d" />
          </mesh>
          {/* petals around a golden centre */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12]}>
                <sphereGeometry args={[0.09, 10, 10]} />
                <meshStandardMaterial color="#f473b9" />
              </mesh>
            )
          })}
          <mesh position={[0, 0.24, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial color="#f5c542" />
          </mesh>
        </group>
      )
    case 'gem':
      return (
        <mesh>
          <octahedronGeometry args={[0.3]} />
          <meshStandardMaterial color="#3fd0e0" emissive="#1f8aa0" emissiveIntensity={0.5} metalness={0.3} roughness={0.2} />
        </mesh>
      )
    case 'rainbow':
      return (
        <group>
          {[
            { r: 1.0, c: '#e2554c' },
            { r: 0.86, c: '#f5c542' },
            { r: 0.72, c: '#6fb35d' },
          ].map(({ r, c }) => (
            <mesh key={c}>
              <torusGeometry args={[r, 0.06, 10, 40, Math.PI]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
          {/* little clouds at the feet of the arc */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s, 0, 0]}>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      )
  }
}

/** gentle wing-flap so the butterfly reads as alive even at subtle saliency */
function Butterfly() {
  const wingL = useRef<THREE.Mesh>(null)
  const wingR = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const a = Math.sin(state.clock.elapsedTime * 7) * 0.7
    if (wingL.current) wingL.current.rotation.y = a
    if (wingR.current) wingR.current.rotation.y = -a
  })
  return (
    <group>
      <mesh>
        <capsuleGeometry args={[0.035, 0.2, 4, 8]} />
        <meshStandardMaterial color="#3a3230" />
      </mesh>
      <mesh ref={wingL} position={[-0.02, 0.02, 0]}>
        <boxGeometry args={[0.34, 0.26, 0.02]} />
        <meshStandardMaterial color="#f5a623" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wingR} position={[0.02, 0.02, 0]}>
        <boxGeometry args={[0.34, 0.26, 0.02]} />
        <meshStandardMaterial color="#f47bb0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ---- the friend ---------------------------------------------------------- */

/**
 * The friend (same body plan as the flat-screen game) idles at the right edge
 * of the front arc, absorbed in their flowerbed. Tapped early they turn to
 * face the child, curious; once the share completes they spin toward the
 * discovery and celebrate with both hands up. A share-nudge adds a pulsing
 * ring at their feet. Their name and the celebration bubble are canvas-
 * texture panels (not DOM overlays) so they show inside VR too.
 */
function FriendKid({
  discovery,
  friend,
  friendLabel,
  friendState,
  awayYaw,
  nudge,
  onTapFriend,
}: Park360SceneProps) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const [x, z] = friendPosition()
  const look = friend.look
  const initialized = useRef(false)

  // facing: toward the flowerbed (away), toward the child at the origin
  // (curious), or toward the discovery being shown (celebrating)
  const [dxp, dzp] = discoveryPosition(discovery)
  const faceChild = Math.atan2(0 - x, 0 - z)
  const face =
    friendState === 'curious'
      ? faceChild
      : friendState === 'celebrating'
        ? Math.atan2(dxp - x, dzp - z)
        : faceChild + awayYaw

  const handsUp = friendState === 'celebrating'

  useFrame((state) => {
    const grp = g.current
    if (!grp) return
    if (!initialized.current && body.current) {
      // start out already turned away — no spin-around on mount
      body.current.rotation.y = face
      initialized.current = true
    }
    const t = state.clock.elapsedTime
    const hop = handsUp ? Math.abs(Math.sin(t * 5)) * 0.14 : 0
    grp.position.y += (hop - grp.position.y) * 0.12

    const b = body.current
    if (b) {
      b.rotation.y += (face + Math.sin(t * 0.9) * 0.04 - b.rotation.y) * 0.09
      // absorbed in the flowers: a gentle lean-forward while looking away
      const lean = friendState === 'away' ? -0.12 : 0
      b.rotation.x += (lean - b.rotation.x) * 0.1
    }
    const raiseL = handsUp ? -2.55 : Math.sin(t * 1.1) * 0.06
    const raiseR = handsUp ? -2.55 : Math.sin(t * 1.05) * 0.06
    if (armL.current) armL.current.rotation.x += (raiseL - armL.current.rotation.x) * 0.12
    if (armR.current) armR.current.rotation.x += (raiseR - armR.current.rotation.x) * 0.12

    if (ring.current) {
      const s = 1 + Math.sin(t * 4) * 0.12
      ring.current.scale.setScalar(s)
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 + Math.sin(t * 4) * 0.2
    }
  })

  return (
    <group
      ref={g}
      position={[x, 0, z]}
      userData={{ headSelect: true }}
      onClick={(e) => {
        e.stopPropagation()
        if (isDragTail() || dragDistance(e) > 8) return
        onTapFriend()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* share-nudge only: pulsing ring at the friend's feet */}
      {nudge === 'share' && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.6, 0.78, 32]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      )}
      <group ref={body}>
        {/* legs + shoes */}
        {[-0.09, 0.09].map((lx) => (
          <group key={lx}>
            <mesh position={[lx, 0.28, 0]}>
              <cylinderGeometry args={[0.065, 0.075, 0.56, 10]} />
              <meshStandardMaterial color={look.pants} />
            </mesh>
            <mesh position={[lx, 0.03, 0.03]}>
              <boxGeometry args={[0.14, 0.07, 0.24]} />
              <meshStandardMaterial color="#494d52" />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.175, 0.34, 6, 14]} />
          <meshStandardMaterial color={look.shirt} />
        </mesh>
        {/* arms */}
        {[
          { side: -0.25 as number, ref: armL },
          { side: 0.25 as number, ref: armR },
        ].map(({ side, ref }) => (
          <group key={side} ref={ref} position={[side, 1.03, 0]}>
            <mesh position={[0, -0.19, 0]}>
              <cylinderGeometry args={[0.05, 0.045, 0.4, 8]} />
              <meshStandardMaterial color={look.shirt} />
            </mesh>
            <mesh position={[0, -0.42, 0]}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshStandardMaterial color={look.skin} />
            </mesh>
          </group>
        ))}
        {/* head, hair, face */}
        <mesh position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.165, 18, 18]} />
          <meshStandardMaterial color={look.skin} />
        </mesh>
        <mesh position={[0, 1.45, -0.03]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.175, 18, 18]} />
          <meshStandardMaterial color={look.hair} />
        </mesh>
        {look.longHair && (
          <mesh position={[0, 1.27, -0.12]}>
            <boxGeometry args={[0.26, 0.34, 0.1]} />
            <meshStandardMaterial color={look.hair} />
          </mesh>
        )}
        {[-0.06, 0.06].map((ex) => (
          <mesh key={ex} position={[ex, 1.4, 0.145]}>
            <sphereGeometry args={[0.021, 8, 8]} />
            <meshStandardMaterial color="#2b2620" />
          </mesh>
        ))}
        <mesh position={[0, 1.315, 0.152]}>
          <boxGeometry args={[0.07, 0.016, 0.02]} />
          <meshStandardMaterial color="#9a5b4a" />
        </mesh>
        {/* invisible tap pad so the whole kid is an easy target from metres away */}
        <mesh visible={false} position={[0, 0.85, 0]}>
          <boxGeometry args={[1.0, 1.9, 0.8]} />
        </mesh>
      </group>
      {/* name tag — canvas texture, so Malayalam script shows in VR too */}
      <NameTag text={friendLabel} y={1.92} />
      {/* celebration bubble: the shared-affect payoff */}
      {friendState === 'celebrating' && <SpeechBubble text={'🤩 !'} y={2.35} accent="#22c55e" />}
      {friendState === 'curious' && <SpeechBubble text={'?'} y={2.35} accent="#f5a623" />}
    </group>
  )
}

/** small floating name plate above the friend's head (canvas texture) */
function NameTag({ text, y }: { text: string; y: number }) {
  return <BillboardPanel text={text} y={y} w={1.1} h={0.32} font={120} bg="rgba(255,255,255,0.88)" fg="#333333" />
}

function SpeechBubble({ text, y, accent }: { text: string; y: number; accent: string }) {
  return <BillboardPanel text={text} y={y} w={0.9} h={0.5} font={190} bg="rgba(255,255,255,0.95)" fg={accent} />
}

/** a text plane that always turns to face the child at the origin */
function BillboardPanel({
  text,
  y,
  w,
  h,
  font,
  bg,
  fg,
}: {
  text: string
  y: number
  w: number
  h: number
  font: number
  bg: string
  fg: string
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = Math.round((512 * h) / w)
    return new THREE.CanvasTexture(cv)
  }, [w, h])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const r = cv.height * 0.35
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = font
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 4
    } while (ctx.measureText(text).width > cv.width - 60 && size > 20)
    ctx.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [text, font, bg, fg, texture])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    // always face the child at the origin (level, no tilt)
    const p = m.getWorldPosition(vBillboard)
    m.lookAt(0, p.y, 0)
  })

  return (
    <mesh ref={mesh} position={[0, y, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

const vBillboard = new THREE.Vector3()
