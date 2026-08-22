import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { slotPosition, type CueMode, type ExhibitId, type Round } from './logic'

const PEDESTAL_H = 1.2
const EXHIBIT_Y = PEDESTAL_H + 0.55

export interface MuseumSceneProps {
  round: Round
  locked: boolean
  disabledIds: ExhibitId[]
  celebrate: number
  /** joint-attention cue level: pulse = highlighted point, hover = plain point, distal = point from afar */
  cue: CueMode
  onPick: (id: ExhibitId) => void
  /** fired once per round, the moment the pointing cue has settled on the target */
  onCueReady: () => void
}

export function MuseumScene(props: MuseumSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 2.4, 6.6], fov: 47 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}
    >
      <color attach="background" args={['#2a2520']} />
      {/* soft warm ambient so nothing is pitch black */}
      <ambientLight intensity={0.5} color="#fff3e0" />
      {/* gentle fill from the front-top, like skylights */}
      <directionalLight position={[2, 7, 6]} intensity={0.35} color="#fff6e8" />
      <GalleryRoom />
      <SceneInner {...props} />
    </Canvas>
  )
}

/* ---- room dimensions, shared so decor lines up with the exhibit row ---- */
const ROOM_W = 14 // total width (x: -7..7)
const ROOM_D = 13 // total depth
const WALL_H = 8
const BACK_Z = -6 // back wall well behind the exhibits (which sit at z >= -0.91)
const SIDE_X = ROOM_W / 2

function GalleryRoom() {
  const wallColor = '#ddd2c0'
  const trimColor = '#c4b79e'
  return (
    <group>
      {/* polished marble floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#cfc9c0" metalness={0.35} roughness={0.18} />
      </mesh>
      {/* a darker inlaid marble disc under the exhibit row for a "stage" feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.3]}>
        <circleGeometry args={[4.4, 48]} />
        <meshStandardMaterial color="#bcb09a" metalness={0.3} roughness={0.25} />
      </mesh>

      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, -1]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#efe9dd" />
      </mesh>

      {/* back wall */}
      <mesh position={[0, WALL_H / 2, BACK_Z]}>
        <planeGeometry args={[ROOM_W, WALL_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {/* back wall baseboard + crown trim */}
      <mesh position={[0, 0.2, BACK_Z + 0.02]}>
        <boxGeometry args={[ROOM_W, 0.4, 0.05]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, WALL_H - 0.25, BACK_Z + 0.02]}>
        <boxGeometry args={[ROOM_W, 0.5, 0.08]} />
        <meshStandardMaterial color={trimColor} />
      </mesh>

      {/* left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-SIDE_X, WALL_H / 2, -1]}>
        <planeGeometry args={[ROOM_D, WALL_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      {/* right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[SIDE_X, WALL_H / 2, -1]}>
        <planeGeometry args={[ROOM_D, WALL_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* MUSEUM sign / banner near the top of the back wall */}
      <MuseumSign />

      {/* framed artwork on the walls */}
      <Painting position={[-4.2, 4.2, BACK_Z + 0.06]} canvas="#7a93b5" w={1.7} h={2.1} />
      <Painting position={[-1.4, 4.4, BACK_Z + 0.06]} canvas="#b56b6b" w={1.4} h={1.7} />
      <Painting position={[1.4, 4.4, BACK_Z + 0.06]} canvas="#7fae7a" w={1.4} h={1.7} />
      <Painting position={[4.2, 4.2, BACK_Z + 0.06]} canvas="#c9a24a" w={1.7} h={2.1} />
      {/* side wall paintings, rotated to face inward */}
      <Painting position={[-SIDE_X + 0.06, 3.8, -2]} canvas="#9a7bb0" w={1.4} h={1.9} rotY={Math.PI / 2} />
      <Painting position={[-SIDE_X + 0.06, 3.8, 1.2]} canvas="#5a8fa8" w={1.4} h={1.9} rotY={Math.PI / 2} />
      <Painting position={[SIDE_X - 0.06, 3.8, -2]} canvas="#b08a5a" w={1.4} h={1.9} rotY={-Math.PI / 2} />
      <Painting position={[SIDE_X - 0.06, 3.8, 1.2]} canvas="#6a9a6a" w={1.4} h={1.9} rotY={-Math.PI / 2} />

      {/* warm spotlights aimed down at the row of pedestals */}
      <GallerySpots />

      {/* a visitor bench off to the side, out of the click area */}
      <Bench position={[4.6, 0, 2.2]} />

      {/* velvet rope barrier in front of the exhibits (between exhibits and camera) */}
      <VelvetRope />
    </group>
  )
}

function MuseumSign() {
  return (
    <group position={[0, WALL_H - 1.4, BACK_Z + 0.07]}>
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

function GallerySpots() {
  // one warm spotlight high above the centre and two flanking, all aimed down
  return (
    <group>
      <spotLight
        position={[0, WALL_H - 0.6, 1]}
        angle={0.9}
        penumbra={0.6}
        intensity={70}
        distance={20}
        color="#ffe6bf"
        target-position={[0, 0, -0.5]}
      />
      <spotLight
        position={[-4, WALL_H - 0.6, 1.5]}
        angle={0.7}
        penumbra={0.6}
        intensity={45}
        distance={18}
        color="#ffe6bf"
        target-position={[-3, 0, -0.5]}
      />
      <spotLight
        position={[4, WALL_H - 0.6, 1.5]}
        angle={0.7}
        penumbra={0.6}
        intensity={45}
        distance={18}
        color="#ffe6bf"
        target-position={[3, 0, -0.5]}
      />
      {/* a soft point light to wash the artwork on the back wall */}
      <pointLight position={[0, 5.5, -3]} intensity={12} distance={12} color="#fff1da" />
    </group>
  )
}

function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
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

/** posts + draped rope, placed in front of the exhibit row (toward camera). */
function VelvetRope() {
  const ROPE_Z = 2.2 // in front of exhibits (z up to ~ -0.9) but behind camera (z 6.6)
  const posts: number[] = [-3.6, -1.8, 0, 1.8, 3.6]
  const postTop = 0.95
  return (
    <group>
      {posts.map((x) => (
        <group key={x} position={[x, 0, ROPE_Z]}>
          {/* brass post */}
          <mesh position={[0, postTop / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.06, postTop, 12]} />
            <meshStandardMaterial color="#c9a23a" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* ball cap */}
          <mesh position={[0, postTop + 0.06, 0]}>
            <sphereGeometry args={[0.09, 14, 14]} />
            <meshStandardMaterial color="#e0bd55" metalness={0.7} roughness={0.25} />
          </mesh>
          {/* heavy base */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 0.1, 16]} />
            <meshStandardMaterial color="#8a7430" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* draped velvet ropes between consecutive posts */}
      {posts.slice(0, -1).map((x, i) => {
        const x2 = posts[i + 1]
        const mid = (x + x2) / 2
        const len = x2 - x
        return (
          <mesh key={i} position={[mid, postTop - 0.18, ROPE_Z]} rotation={[0, 0, 0]}>
            {/* a gently sagging rope approximated by a thin rotated box dipping in the middle */}
            <boxGeometry args={[len, 0.07, 0.07]} />
            <meshStandardMaterial color="#7a1f33" roughness={0.85} />
          </mesh>
        )
      })}
    </group>
  )
}

function SceneInner({ round, locked, disabledIds, celebrate, cue, onPick, onCueReady }: MuseumSceneProps) {
  const n = round.visible.length
  const targetIdx = round.visible.indexOf(round.target)
  const [tx, tz] = slotPosition(targetIdx, n)
  const hoverPoint = new THREE.Vector3(tx, EXHIBIT_Y + 1.15, tz)
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

/** where the gazing helper stands: behind the exhibit row, facing the child */
const GAZE_POS = new THREE.Vector3(0, 2.55, -3.4)
const GAZE_UP = new THREE.Vector3(0, 1, 0)
const gazeM = new THREE.Matrix4()
const gazeQ = new THREE.Quaternion()

/**
 * The thinnest rung of the prompt ladder: no hand, no point — just a friendly
 * face across the room turning to *look* at the target. The child must follow
 * head/gaze orientation alone, the way real-world cue fading ends at gaze.
 * Fires `onSettled` once the head's turn has landed on the target.
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
    // face model is built looking down +z (toward the camera/child), so this
    // orients the face toward whichever pedestal holds the target
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

/* ---- exhibit models: cheerful, child-friendly characters ------------------
 * Built from three.js primitives (no model files to load), each roughly ±0.5
 * around the origin so it sits inside the shared click box and spins gently.
 * Bright, high-contrast colours read well across the gallery and are inviting
 * for a young or autistic child to look at and want to find.
 */
function ExhibitModel({ id }: { id: ExhibitId }) {
  switch (id) {
    case 'butterfly':
      return (
        <group>
          {/* body */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.66, 10]} />
            <meshStandardMaterial color="#4a3b2a" />
          </mesh>
          {/* head */}
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color="#3a2e20" />
          </mesh>
          {/* antennae */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.05, 0.48, 0]} rotation={[0, 0, -s * 0.4]}>
              <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
              <meshStandardMaterial color="#3a2e20" />
            </mesh>
          ))}
          {/* wings: pink upper pair, orange lower pair, mirrored left/right */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.28, 0.12, 0]} rotation={[0, s * 0.5, 0]} scale={[1, 1.1, 0.2]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#ff5ea8" emissive="#c02f6e" emissiveIntensity={0.25} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[s * 0.24, -0.2, 0]} rotation={[0, s * 0.5, 0]} scale={[1, 0.9, 0.2]}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial color="#ffb63d" emissive="#c07e18" emissiveIntensity={0.25} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'bird':
      return (
        <group>
          {/* body */}
          <mesh position={[0, -0.05, 0]} scale={[1, 1, 1.25]}>
            <sphereGeometry args={[0.3, 18, 18]} />
            <meshStandardMaterial color="#4aa3e0" />
          </mesh>
          {/* pale belly */}
          <mesh position={[0, -0.12, 0.16]} scale={[0.7, 0.7, 0.6]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#fdf3d0" />
          </mesh>
          {/* head */}
          <mesh position={[0, 0.28, 0.12]}>
            <sphereGeometry args={[0.2, 18, 18]} />
            <meshStandardMaterial color="#4aa3e0" />
          </mesh>
          {/* beak */}
          <mesh position={[0, 0.26, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.07, 0.18, 10]} />
            <meshStandardMaterial color="#f5a623" />
          </mesh>
          {/* eyes */}
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.33, 0.27]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#1c1712" />
            </mesh>
          ))}
          {/* wings */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.28, 0, 0]} rotation={[0, 0, s * 0.4]} scale={[0.35, 1, 0.9]}>
              <sphereGeometry args={[0.22, 14, 14]} />
              <meshStandardMaterial color="#2f7fc0" />
            </mesh>
          ))}
          {/* tail */}
          <mesh position={[0, -0.02, -0.34]} rotation={[Math.PI / 2 - 0.5, 0, 0]}>
            <coneGeometry args={[0.14, 0.3, 4]} />
            <meshStandardMaterial color="#2f7fc0" />
          </mesh>
        </group>
      )
    case 'doll':
      return (
        <group>
          {/* dress */}
          <mesh position={[0, -0.18, 0]}>
            <coneGeometry args={[0.32, 0.6, 20]} />
            <meshStandardMaterial color="#ff6f91" />
          </mesh>
          {/* arms */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.26, -0.08, 0]} rotation={[0, 0, s * 0.9]}>
              <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
              <meshStandardMaterial color="#ffd9b3" />
            </mesh>
          ))}
          {/* head */}
          <mesh position={[0, 0.28, 0]}>
            <sphereGeometry args={[0.24, 20, 20]} />
            <meshStandardMaterial color="#ffd9b3" />
          </mesh>
          {/* hair cap */}
          <mesh position={[0, 0.36, -0.02]} scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.26, 20, 20]} />
            <meshStandardMaterial color="#5a3a24" />
          </mesh>
          {/* pigtails */}
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} position={[x, 0.3, 0]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color="#5a3a24" />
            </mesh>
          ))}
          {/* eyes */}
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.29, 0.21]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#2e2a3a" />
            </mesh>
          ))}
          {/* rosy cheeks */}
          {[-0.13, 0.13].map((x) => (
            <mesh key={x} position={[x, 0.21, 0.19]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial color="#ff9aa2" />
            </mesh>
          ))}
          {/* smile */}
          <mesh position={[0, 0.2, 0.2]} rotation={[0.3, 0, Math.PI]}>
            <torusGeometry args={[0.05, 0.012, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#c0506a" />
          </mesh>
        </group>
      )
    case 'balloon':
      return (
        <group>
          {/* balloon */}
          <mesh position={[0, 0.15, 0]} scale={[1, 1.2, 1]}>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color="#e2554c" emissive="#8f2b25" emissiveIntensity={0.15} roughness={0.35} />
          </mesh>
          {/* knot */}
          <mesh position={[0, -0.28, 0]}>
            <coneGeometry args={[0.06, 0.1, 8]} />
            <meshStandardMaterial color="#c0433b" />
          </mesh>
          {/* string */}
          <mesh position={[0, -0.55, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.5, 6]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        </group>
      )
    case 'flower':
      return (
        <group>
          {/* stem */}
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 0.5, 8]} />
            <meshStandardMaterial color="#4c9a4c" />
          </mesh>
          {/* leaf */}
          <mesh position={[0.12, -0.28, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.5, 0.3]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color="#5cb85c" />
          </mesh>
          {/* petals */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.22, 0.1 + Math.sin(a) * 0.22, 0]} scale={[1, 1, 0.4]}>
                <sphereGeometry args={[0.14, 12, 12]} />
                <meshStandardMaterial color="#ff8ac2" emissive="#c74e8f" emissiveIntensity={0.2} />
              </mesh>
            )
          })}
          {/* sunny centre */}
          <mesh position={[0, 0.1, 0.05]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color="#ffd54a" emissive="#c79a17" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )
    case 'fish':
      return (
        <group>
          {/* body */}
          <mesh scale={[1.3, 0.9, 0.7]}>
            <sphereGeometry args={[0.32, 20, 20]} />
            <meshStandardMaterial color="#ff922e" emissive="#b5591a" emissiveIntensity={0.2} />
          </mesh>
          {/* tail */}
          <mesh position={[-0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.2, 0.34, 4]} />
            <meshStandardMaterial color="#ff6f3d" />
          </mesh>
          {/* top fin */}
          <mesh position={[0.02, 0.3, 0]}>
            <coneGeometry args={[0.1, 0.26, 4]} />
            <meshStandardMaterial color="#ff6f3d" />
          </mesh>
          {/* side fin */}
          <mesh position={[0.16, -0.08, 0.24]} rotation={[0.6, 0, 0.3]}>
            <coneGeometry args={[0.08, 0.2, 4]} />
            <meshStandardMaterial color="#ff6f3d" />
          </mesh>
          {/* eye */}
          <mesh position={[0.3, 0.1, 0.16]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.33, 0.1, 0.19]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color="#1c1712" />
          </mesh>
        </group>
      )
  }
}

/** where the distal hand floats: in front of the velvet rope, above and clear of every exhibit */
const DISTAL_POS = new THREE.Vector3(0, 2.5, 3.4)
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
      // drift a little toward the target's side, the way a real arm shifts when pointing
      distalBase.set(aimPoint.x * 0.35, DISTAL_POS.y, DISTAL_POS.z)
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
