import { useRef, type CSSProperties } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { discoveryMeta, type DiscoveryId, type Friend, type Saliency } from './logic'

export interface DiscoverySceneProps {
  /** the current surprise (only rendered while `active`) */
  discovery: DiscoveryId
  /** true from the moment the surprise pops in until the round ends */
  active: boolean
  saliency: Saliency
  /** the child has tapped the surprise (sparkle marker, stops the pulse ring) */
  found: boolean
  friend: Friend
  /** display name in the app language (Malayalam glyphs need the DOM overlay) */
  friendLabel: string
  friendState: 'away' | 'curious' | 'celebrating'
  /** radians the friend is turned away from the park (fades with difficulty) */
  awayYaw: number
  /** which helper nudge is showing, if any */
  nudge: 'find' | 'share' | null
  onTapDiscovery: () => void
  onTapFriend: () => void
}

export function DiscoveryScene(props: DiscoverySceneProps) {
  return (
    <Canvas camera={{ position: [0, 2.7, 7.4], fov: 42 }}>
      <color attach="background" args={['#dff4ff']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />
      {/* soft fill from the front so the friend's face reads clearly */}
      <directionalLight position={[0, 3, 7]} intensity={0.35} />
      <SceneInner {...props} />
    </Canvas>
  )
}

const BASE_Y = -0.6 // grass level

/** the friend plays off to the right, busy with their own little flowerbed */
const FRIEND_POS: readonly [number, number] = [2.4, 1.1]

function SceneInner(props: DiscoverySceneProps) {
  const { discovery, active, saliency, found, nudge } = props
  const [dx, dz] = discoveryMeta(discovery).position

  return (
    <group>
      <CameraSway />

      {/* grass */}
      <mesh rotation-x={-Math.PI / 2} position={[0, BASE_Y, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#b7dfa0" />
      </mesh>
      {/* a sandy path wandering through the park */}
      <mesh rotation-x={-Math.PI / 2} position={[0.6, BASE_Y + 0.005, 0.5]}>
        <circleGeometry args={[2.6, 40]} />
        <meshStandardMaterial color="#cfe9b6" />
      </mesh>

      {/* park dressing — the surprises pop up among these */}
      <Tree x={-4.4} z={-3.0} />
      <Tree x={-1.6} z={-2.6} scale={0.85} />
      <Tree x={4.5} z={-3.4} scale={1.2} />
      <Bush x={-2.6} z={0.2} />
      <Bush x={3.6} z={-0.9} />
      <Fence />
      {/* the friend's flowerbed — what they are busy looking at */}
      <FlowerBed x={3.6} z={1.7} />

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

/** Barely-there drift so the fixed camera still feels alive. */
function CameraSway() {
  const { camera } = useThree()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    camera.position.x = Math.sin(t * 0.16) * 0.14
    camera.lookAt(0, 0.8, 0)
  })
  return null
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, BASE_Y, z]} scale={scale}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 1.1, 8]} />
        <meshStandardMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.75, 14, 14]} />
        <meshStandardMaterial color="#5da44e" />
      </mesh>
    </group>
  )
}

function Bush({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, BASE_Y + 0.22, z]}>
      <sphereGeometry args={[0.38, 12, 12]} />
      <meshStandardMaterial color="#6fb35d" />
    </mesh>
  )
}

/** low picket fence along the back — the bird's landing spot */
function Fence() {
  const posts = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]
  const z = -2.9
  return (
    <group>
      {posts.map((x) => (
        <mesh key={x} position={[x, BASE_Y + 0.32, z]}>
          <boxGeometry args={[0.09, 0.64, 0.06]} />
          <meshStandardMaterial color="#c8b08a" />
        </mesh>
      ))}
      <mesh position={[0, BASE_Y + 0.5, z]}>
        <boxGeometry args={[7.6, 0.07, 0.05]} />
        <meshStandardMaterial color="#c8b08a" />
      </mesh>
    </group>
  )
}

function FlowerBed({ x, z }: { x: number; z: number }) {
  const colors = ['#e2554c', '#f5c542', '#b07fe0']
  return (
    <group position={[x, BASE_Y, z]}>
      {colors.map((c, i) => (
        <group key={c} position={[(i - 1) * 0.3, 0, (i % 2) * 0.2]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
            <meshStandardMaterial color="#4d8a3d" />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---- the surprise ------------------------------------------------------- */

/** per-surprise base height of the model (and its tap target) */
const SURPRISE_Y: Record<DiscoveryId, number> = {
  butterfly: 0.75,
  bunny: 0.3,
  bird: 0.62, // perched on the fence rail
  flower: 0.3,
  gem: 0.28,
  rainbow: 2.6, // up in the sky
}

const SALIENCY_SCALE: Record<Saliency, number> = { big: 1.35, medium: 1, subtle: 0.72 }

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
  const grow = useRef(0) // 0 -> 1 pop-in spring
  const target = SALIENCY_SCALE[saliency]
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
  })

  const y = BASE_Y + SURPRISE_Y[id]
  return (
    <group position={[x, 0, z]}>
      {showRing && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, BASE_Y + 0.02, 0]}>
          <ringGeometry args={[0.5, 0.66, 32]} />
          <meshBasicMaterial color="#ffd95e" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={group} position={[0, y, 0]} scale={0}>
        <SurpriseModel id={id} />
        {/* transparent tap target, comfortably larger than the model */}
        <mesh
          visible={false}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            onTap()
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <boxGeometry args={[1.1, 1.1, 1.1]} />
        </mesh>
      </group>
      {/* found marker: the child's "point" planted on the discovery */}
      {found && (
        <Html position={[0, y + 0.75, 0]} center distanceFactor={8} style={LABEL_STYLE} zIndexRange={[10, 0]}>
          <div style={{ fontSize: 26 }}>✨</div>
        </Html>
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
        <group rotation={[0, 0, 0]}>
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

const LABEL_STYLE: CSSProperties = { pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none' }

/**
 * The friend (same body plan as Roll-Back Buddy's kids) idles facing away,
 * absorbed in their flowerbed. Tapped early they turn to the camera, curious;
 * once the share completes they spin toward the discovery and celebrate with
 * both hands up. A share-nudge adds a pulsing ring at their feet.
 */
function FriendKid({
  discovery,
  friend,
  friendLabel,
  friendState,
  awayYaw,
  nudge,
  onTapFriend,
}: DiscoverySceneProps) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const [x, z] = FRIEND_POS
  const look = friend.look
  const initialized = useRef(false)

  // facing: toward the flowerbed (away), toward the camera (curious), or
  // toward the discovery being shown (celebrating)
  const [dxp, dzp] = discoveryMeta(discovery).position
  const faceCenter = Math.atan2(-x, -z)
  const face =
    friendState === 'curious'
      ? Math.atan2(0 - x, 7.4 - z)
      : friendState === 'celebrating'
        ? Math.atan2(dxp - x, dzp - z)
        : faceCenter + awayYaw

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
    grp.position.y += (BASE_Y + hop - grp.position.y) * 0.12

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
      position={[x, BASE_Y, z]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onTapFriend()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* share-nudge only: pulsing ring at the friend's feet */}
      {nudge === 'share' && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.42, 0.56, 32]} />
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
      </group>
      {/* name label — DOM overlay so Malayalam script renders */}
      <Html position={[0, 1.86, 0]} center distanceFactor={8} style={LABEL_STYLE} zIndexRange={[10, 0]}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#333' }}>{friendLabel}</div>
      </Html>
      {/* celebration bubble: the shared-affect payoff */}
      {friendState === 'celebrating' && (
        <Html position={[0, 2.3, 0]} center distanceFactor={8} style={LABEL_STYLE} zIndexRange={[10, 0]}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: '#0a7d4f',
              background: '#eafbf1',
              border: '2px solid #22c55e',
              borderRadius: 12,
              padding: '4px 10px',
            }}
          >
            🤩 !
          </div>
        </Html>
      )}
    </group>
  )
}
