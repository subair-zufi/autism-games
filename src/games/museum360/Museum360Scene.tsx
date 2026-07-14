import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import {
  EXHIBIT_RADIUS,
  bearingToXZ,
  dragDistance,
  slotBearing,
  type CueMode,
  type ExhibitId,
  type Round,
} from './logic'

const PEDESTAL_H = 1.2
const EXHIBIT_Y = PEDESTAL_H + 0.55
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
        <RotundaRoom />
        <SceneInner {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} />
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
    const clampPitch = (p: number) => Math.max(-0.5, Math.min(0.35, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the room left, so the view turns right
      v.tYaw -= (e.clientX - lastX) * 0.0042
      v.tPitch = clampPitch(v.tPitch + (e.clientY - lastY) * 0.0032)
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = () => {
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
function VRHud({ score, prompt }: { score: string; prompt: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <group>
      <TextPanel text={score} position={[0, 4.35, -7.6]} width={2.6} height={0.62} font={110} />
      <TextPanel text={prompt} position={[0, 3.55, -7.6]} width={4.6} height={0.8} font={64} />
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
      {/* a darker inlaid marble ring under the circle of exhibits */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[EXHIBIT_RADIUS - 0.9, EXHIBIT_RADIUS + 0.9, 64]} />
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
  const targetBearing = slotBearing(targetIdx, n)
  const [tx, tz] = bearingToXZ(targetBearing, EXHIBIT_RADIUS)
  const hoverPoint = new THREE.Vector3(tx, EXHIBIT_Y + 1.15, tz)
  const aimPoint = new THREE.Vector3(tx, EXHIBIT_Y, tz)

  return (
    <group>
      {cue === 'pulse' && <TargetRing x={tx} z={tz} />}

      {round.visible.map((id, i) => {
        const bearing = slotBearing(i, n)
        const [x, z] = bearingToXZ(bearing, EXHIBIT_RADIUS)
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

      {cue === 'gaze' ? (
        <GazingHead cueKey={round.target} aimPoint={aimPoint} onSettled={onCueReady} />
      ) : (
        <PointingHand
          mode={cue === 'distal' ? 'distal' : 'hover'}
          cueKey={round.target}
          hoverPoint={hoverPoint}
          aimPoint={aimPoint}
          onSettled={onCueReady}
        />
      )}
    </group>
  )
}

/** where the gazing helper stands: at bearing 0, between the child and the wall,
 *  facing the child when the view is at its starting direction */
const GAZE_POS = new THREE.Vector3(0, 1.95, -3.1)
const GAZE_UP = new THREE.Vector3(0, 1, 0)
const gazeM = new THREE.Matrix4()
const gazeQ = new THREE.Quaternion()

/**
 * The thinnest rung of the prompt ladder: no hand, no point — just a friendly
 * face turning to *look* at the target, which may be behind the child. The
 * child must read the head's direction and turn the view the same way — the
 * full real-world gaze-following loop. Fires `onSettled` once the head's turn
 * has landed on the target.
 */
function GazingHead({
  cueKey,
  aimPoint,
  onSettled,
}: {
  cueKey: ExhibitId
  aimPoint: THREE.Vector3
  onSettled: () => void
}) {
  const head = useRef<THREE.Group>(null)
  const settled = useRef(false)
  // keep the latest callback without re-subscribing the frame loop
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    settled.current = false
  }, [cueKey])

  useFrame((state, dt) => {
    const g = head.current
    if (!g) return
    const k = Math.min(1, dt * 3)
    // face model is built looking down +z (toward the child at the centre), so
    // this orients the face toward whichever pedestal holds the target
    gazeM.lookAt(aimPoint, GAZE_POS, GAZE_UP)
    gazeQ.setFromRotationMatrix(gazeM)
    g.quaternion.slerp(gazeQ, k)
    // local bob around the parent's anchor, not an absolute height
    g.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.03
    if (!settled.current && g.quaternion.angleTo(gazeQ) < 0.1) {
      settled.current = true
      onSettledRef.current()
    }
  })

  const skin = '#f2c89b'
  return (
    <group position={GAZE_POS.toArray()}>
      <group ref={head}>
        {/* head */}
        <mesh>
          <sphereGeometry args={[0.42, 20, 20]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.16, -0.06]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.45, 20, 20]} />
          <meshStandardMaterial color="#4a3320" />
        </mesh>
        {/* eyes: whites + pupils on the +z face — they travel with the turn */}
        {[-0.15, 0.15].map((ex) => (
          <group key={ex} position={[ex, 0.04, 0.36]}>
            <mesh scale={[1, 1.25, 0.5]}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <sphereGeometry args={[0.042, 10, 10]} />
              <meshStandardMaterial color="#2b2620" />
            </mesh>
          </group>
        ))}
        {/* smile (arc flipped downward) */}
        <mesh position={[0, -0.13, 0.38]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.09, 0.022, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#9a5b4a" />
        </mesh>
      </group>
      {/* shoulders — same cuff colour as the pointing hand, so the gaze tier
          reads as the same helper with the pointing faded away */}
      <mesh position={[0, -0.55, 0]} scale={[1.5, 0.8, 0.9]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial color="#7f8fb6" />
      </mesh>
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
      {/* pedestal */}
      <mesh position={[0, PEDESTAL_H / 2, 0]}>
        <cylinderGeometry args={[0.42, 0.5, PEDESTAL_H, 20]} />
        <meshStandardMaterial color="#bcae98" />
      </mesh>
      <mesh position={[0, PEDESTAL_H + 0.04, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 20]} />
        <meshStandardMaterial color="#cdbfa6" />
      </mesh>

      {/* the exhibit model + a transparent click target around it */}
      <group ref={model} position={[0, EXHIBIT_Y, 0]}>
        <ExhibitModel id={id} />
        <mesh
          visible={false}
          onClick={(e) => {
            e.stopPropagation()
            // a drag that ends on a pedestal is looking around, not a pick
            // (XR trigger/pinch events carry no drag — dragDistance handles both)
            if (dragDistance(e) > 8) return
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

/** where the distal hand floats: beside the helper at bearing 0, raised so the
 *  point across (or behind) the room reads clearly */
const DISTAL_POS = new THREE.Vector3(0, 2.35, -2.9)
const DOWN = new THREE.Vector3(0, -1, 0)
const distalBase = new THREE.Vector3()

function PointingHand({
  mode,
  cueKey,
  hoverPoint,
  aimPoint,
  onSettled,
}: {
  mode: 'hover' | 'distal'
  cueKey: ExhibitId
  hoverPoint: THREE.Vector3
  aimPoint: THREE.Vector3
  onSettled: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const settled = useRef(false)
  // keep the latest callback without re-subscribing the frame loop
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    settled.current = false
  }, [cueKey, mode])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const k = Math.min(1, dt * 4)
    if (mode === 'hover') {
      g.position.lerp(hoverPoint, k)
      g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.02
      g.rotation.set(0, 0, Math.sin(state.clock.elapsedTime * 1.5) * 0.06)
      if (!settled.current && g.position.distanceTo(hoverPoint) < 0.25) {
        settled.current = true
        onSettledRef.current()
      }
    } else {
      // drift a little toward the target's side of the room, the way a real
      // arm shifts across the body when pointing
      distalBase.set(
        DISTAL_POS.x + (aimPoint.x / EXHIBIT_RADIUS) * 0.5,
        DISTAL_POS.y,
        DISTAL_POS.z + ((aimPoint.z - DISTAL_POS.z) / EXHIBIT_RADIUS) * 0.4,
      )
      g.position.lerp(distalBase, k)
      g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.012
      const dir = aimPoint.clone().sub(g.position).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(DOWN, dir)
      g.quaternion.slerp(q, k)
      if (!settled.current && g.position.distanceTo(distalBase) < 0.25 && g.quaternion.angleTo(q) < 0.12) {
        settled.current = true
        onSettledRef.current()
      }
    }
  })

  const skin = '#f2c89b'
  const distal = mode === 'distal'
  return (
    <group
      ref={group}
      position={distal ? DISTAL_POS.toArray() : [0, 4, 0]}
      scale={distal ? 0.6 : 0.8}
    >
      {/* palm */}
      <mesh position={[0.05, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.22]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* extended index finger, pointing down (rotated toward the target in distal mode) */}
      <mesh position={[-0.14, 0.12, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* folded fingers */}
      <mesh position={[0.13, 0.26, 0]}>
        <boxGeometry args={[0.32, 0.24, 0.23]} />
        <meshStandardMaterial color="#e8b888" />
      </mesh>
      {/* thumb */}
      <mesh position={[0.34, 0.62, 0]} rotation={[0, 0, 0.55]}>
        <boxGeometry args={[0.14, 0.32, 0.16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* cuff */}
      <mesh position={[0.05, 0.92, 0]}>
        <boxGeometry args={[0.56, 0.2, 0.28]} />
        <meshStandardMaterial color="#7f8fb6" />
      </mesh>
    </group>
  )
}
