import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { HeadSelect } from '../HeadSelect'
import { HeadSampler } from '../HeadSampler'
import { VRQuitButton } from '../VRQuitButton'
import { VRInputSwitch } from '../VRInputSwitch'
import {
  boardPosition,
  dragDistance,
  isDragTail,
  lookDrag,
  type Board,
} from './logic'

/** the child's eye height — the camera stands here, in the middle of the room */
const EYE_Y = 1.5
/** centre height of every board (a touch below eye level, like a gallery hang) */
const BOARD_Y = 1.45
/** board face size (metres) — near-square so portrait face photos don't distort */
const BOARD_W = 1.5
const BOARD_H = 1.7

/** per-board display state, decided by the game and mirrored into the scene */
export type BoardState = 'idle' | 'correct' | 'wrong' | 'dim'

export interface EmotionRecognition360SceneProps {
  boards: Board[]
  /** true while the boards are up and answerable */
  active: boolean
  /** index the child tapped this round, or null */
  pickedIndex: number | null
  /** index of the correct face */
  answerIndex: number
  /** true once an answer is locked in (drives the reveal) */
  answered: boolean
  /** show the soft "look here" ring under the correct board (hint) */
  hint: boolean
  onPick: (i: number) => void
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function EmotionRecognition360Scene(props: EmotionRecognition360SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 100 }}
      onCreated={({ camera, gl }) => {
        // yaw-then-pitch so dragging sideways always spins the room level
        camera.rotation.order = 'YXZ'
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* warm skylit interior */}
        <color attach="background" args={['#eef1ec']} />
        <ambientLight intensity={0.95} color="#fffaf0" />
        {/* soft, even daylight from the skylight above — no harsh shadow edges */}
        <directionalLight position={[3, 14, 4]} intensity={0.7} color="#fff6e4" />
        <directionalLight position={[-6, 8, -6]} intensity={0.25} />
        <LookControls />
        <HeadSelect />
        <HeadSampler />
        <GalleryRoom />
        <BoardRow {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls ------------------------------------------
 * Same controls as the other 360 games: the camera never moves — the child
 * stands in the middle of the room and drags (touch or mouse) or scrolls to
 * turn their view, like a panorama viewer. Pitch is clamped so the room never
 * flips; motion is damped so turning feels smooth, not jumpy (gentler for
 * sensory comfort).
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
    const clampPitch = (p: number) => Math.max(-0.4, Math.min(0.42, p))
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

/* ---- the room: a calm round skylit gallery --------------------------------
 * A quiet wood-and-cream rotunda that wraps the full 360° so it feels real when
 * the child looks around, but with nothing busy or reflective — matte surfaces,
 * soft even light, a ring of gentle greenery. All the playable boards stay in
 * the front arc.
 */
function GalleryRoom() {
  const WALL_R = 8
  const WALL_H = 5
  // a loose ring of planters around the room (decor only, behind the boards)
  const planterBearings = [-150, -110, 110, 150, 180]
  return (
    <group>
      {/* floor: pale polished concrete with a soft inlaid ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[WALL_R, 64]} />
        <meshStandardMaterial color="#d8d5cd" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.9, 3.1, 64]} />
        <meshStandardMaterial color="#c3bfb2" />
      </mesh>
      {/* the child's standing spot in the centre */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#cdd3c6" />
      </mesh>

      {/* curved wall: warm wood below, cream above (open feel) */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <cylinderGeometry args={[WALL_R, WALL_R, WALL_H, 48, 1, true]} />
        <meshStandardMaterial color="#efe9dd" side={THREE.BackSide} />
      </mesh>
      {/* wood wainscot band around the lower wall */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[WALL_R - 0.02, WALL_R - 0.02, 2.2, 48, 1, true]} />
        <meshStandardMaterial color="#b98d5c" side={THREE.BackSide} />
      </mesh>

      {/* ceiling ring + a bright skylight disc that reads as daylight above */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <ringGeometry args={[3.4, WALL_R, 48]} />
        <meshStandardMaterial color="#e7e2d6" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H - 0.02, 0]}>
        <circleGeometry args={[3.4, 48]} />
        <meshBasicMaterial color="#f6fbff" />
      </mesh>

      {/* gentle greenery around the room */}
      {planterBearings.map((deg) => {
        const [x, z] = boardPosition(deg)
        // push planters out to the wall
        const s = (8 - 0.6) / 4.2
        return <Planter key={deg} x={x * s} z={z * s} />
      })}
    </group>
  )
}

function Planter({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* pot */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 12]} />
        <meshStandardMaterial color="#a9a297" />
      </mesh>
      {/* foliage */}
      {[
        [0, 0.7, 0, 0.42],
        [0.18, 0.62, 0.1, 0.3],
        [-0.16, 0.6, -0.08, 0.28],
      ].map(([fx, fy, fz, r], i) => (
        <mesh key={i} position={[fx, fy as number, fz]}>
          <sphereGeometry args={[r as number, 12, 12]} />
          <meshStandardMaterial color={i === 0 ? '#6fa85a' : '#7cb968'} />
        </mesh>
      ))}
    </group>
  )
}

/* ---- in-world HUD for VR --------------------------------------------------
 * The DOM score bar and prompt banner cannot be seen inside an immersive
 * session, so the same lines are mirrored on gentle floating panels at bearing
 * 0 — the natural "home" direction. Rendered only while a session is
 * presenting, and hung above the boards so they never block a tap.
 */
function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <group>
      <TextPanel text={prompt} position={[0, 2.85, -4.2]} width={4.2} height={0.72} font={70} />
      <TextPanel text={score} position={[0, 3.5, -4.2]} width={2.4} height={0.55} font={96} />
      {/* just left of the outermost board (≈−32°) — clear of the faces */}
      <VRQuitButton bearingDeg={-52} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-52} />
    </group>
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
    const r = cv.height * 0.3
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = 'rgba(38, 42, 36, 0.82)'
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

/* ---- the boards ----------------------------------------------------------- */

function BoardRow(props: EmotionRecognition360SceneProps) {
  const { boards, active, pickedIndex, answerIndex, answered, hint, onPick } = props
  if (!active) return null
  return (
    <group>
      {boards.map((b, i) => {
        const state: BoardState = !answered
          ? 'idle'
          : i === answerIndex
            ? 'correct'
            : i === pickedIndex
              ? 'wrong'
              : 'dim'
        return (
          <FaceBoard
            key={`${b.imageSrc}-${i}`}
            board={b}
            state={state}
            // the hint ring only appears under the correct face
            hint={hint && i === answerIndex}
            onTap={() => onPick(i)}
          />
        )
      })}
    </group>
  )
}

function FaceBoard({
  board,
  state,
  hint,
  onTap,
}: {
  board: Board
  state: BoardState
  hint: boolean
  onTap: () => void
}) {
  const [x, z] = boardPosition(board.bearingDeg)
  const bearingRad = (board.bearingDeg * Math.PI) / 180
  const ring = useRef<THREE.Mesh>(null)
  const spark = useRef<THREE.Mesh>(null)
  const frameMat = useRef<THREE.MeshStandardMaterial>(null)

  const { gl } = useThree()

  // load the real face photo as a texture (no Suspense needed)
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(board.imageSrc)
    tex.colorSpace = THREE.SRGBColorSpace
    // anisotropic filtering keeps the face crisp at the board's viewing angle,
    // instead of shimmering as the child turns their head
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    return tex
  }, [board.imageSrc, gl])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (ring.current) {
      const sc = 1 + Math.sin(t * 3) * 0.12
      ring.current.scale.setScalar(sc)
      const m = ring.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.4 + Math.sin(t * 3) * 0.18
    }
    if (spark.current) {
      spark.current.rotation.y = t * 2.2
      spark.current.scale.setScalar(1 + Math.sin(t * 5) * 0.2)
    }
    if (frameMat.current) {
      // correct board warms to gold; others stay wood / fade
      const target = state === 'correct' ? 0.55 : 0
      frameMat.current.emissiveIntensity += (target - frameMat.current.emissiveIntensity) * 0.15
    }
  })

  const dim = state === 'dim' || state === 'wrong'
  const faceOpacity = dim ? 0.4 : 1

  return (
    <group position={[x, 0, z]} rotation={[0, -bearingRad, 0]}>
      {/* soft "look here" ring on the floor under the correct face (hint) */}
      {hint && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial color="#f4b740" transparent opacity={0.5} />
        </mesh>
      )}

      {/* the stand: two slim legs */}
      {[-0.5, 0.5].map((lx) => (
        <mesh key={lx} position={[lx, BOARD_Y - BOARD_H / 2 - 0.3, -0.02]}>
          <cylinderGeometry args={[0.04, 0.04, (BOARD_Y - BOARD_H / 2 - 0.3) * 2 + 0.6, 8]} />
          <meshStandardMaterial color="#9a9488" />
        </mesh>
      ))}

      {/* wooden frame behind the photo (warms to gold when correct). Sits a
          clear gap behind the photo plane — coplanar surfaces z-fight and
          flicker badly in VR (stereo + head motion), so the frame front (at
          z = -0.02) and the photo (at z = 0.02) are kept 4 cm apart. */}
      <mesh position={[0, BOARD_Y, -0.06]}>
        <boxGeometry args={[BOARD_W + 0.22, BOARD_H + 0.22, 0.08]} />
        <meshStandardMaterial
          ref={frameMat}
          color={state === 'wrong' ? '#b8b2a6' : '#c69a63'}
          emissive="#f4b740"
          emissiveIntensity={0}
        />
      </mesh>

      {/* the real face photo, stood proud of the frame so it never z-fights */}
      <mesh position={[0, BOARD_Y, 0.02]}>
        <planeGeometry args={[BOARD_W, BOARD_H]} />
        <meshBasicMaterial map={texture} transparent opacity={faceOpacity} toneMapped={false} />
      </mesh>

      {/* correct-answer sparkle above the winning board */}
      {state === 'correct' && (
        <mesh ref={spark} position={[0, BOARD_Y + BOARD_H / 2 + 0.35, 0]}>
          <octahedronGeometry args={[0.16]} />
          <meshBasicMaterial color="#f4b740" />
        </mesh>
      )}

      {/* transparent tap target, comfortably larger than the photo */}
      <mesh
        position={[0, BOARD_Y, 0.05]}
        visible={false}
        userData={{ headSelect: true }}
        onClick={(e) => {
          e.stopPropagation()
          // a drag that ends on the board is looking around, not a tap. XR
          // trigger/pinch events carry no drag distance and count as clean taps
          // (dragDistance swallows their throwing delta getter).
          if (isDragTail() || dragDistance(e) > 8) return
          onTap()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <planeGeometry args={[BOARD_W + 0.4, BOARD_H + 0.4]} />
      </mesh>
    </group>
  )
}
