import { useEffect, useRef, type CSSProperties } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CueMode, Player } from './logic'
import { rbLine } from './strings'

export interface RollBackSceneProps {
  players: Player[]
  cue: CueMode
  /** player index currently holding (or receiving) the ball; the ball rolls there */
  ballOwner: number
  /** partner currently showing the "roll it to me" ready cue, or null */
  readyIndex: number | null
  /** peer performing the incoming roll (lean-and-push animation), or null */
  rollerIndex: number | null
  /** partner who just got a wrong-partner roll (head-shake wobble), or null */
  rejectIndex: number | null
  /** partner celebrating a caught return, or null */
  celebrateIndex: number | null
  /** true while the child holds the ball and may act — the ball glows/bobs */
  childTurn: boolean
  /** increments on a premature roll — shakes the ball */
  shake: number
  onPickPartner: (index: number) => void
}

export function RollBackScene(props: RollBackSceneProps) {
  return (
    <Canvas camera={{ position: [0, 2.7, 7.4], fov: 42 }}>
      <color attach="background" args={['#dff4ff']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />
      {/* soft fill from the front so the kids' faces read clearly */}
      <directionalLight position={[0, 3, 7]} intensity={0.35} />
      <SceneInner {...props} />
    </Canvas>
  )
}

const BASE_Y = -0.6 // feet / grass level
const BALL_R = 0.3
const BALL_Y = BASE_Y + BALL_R

/** child stands front-left with their back to the camera — off the camera
 * axis so their body never hides the ball resting in front of them */
const CHILD_POS: readonly [number, number] = [-0.9, 2.3]

/** Partner slots by partner count — an arc across the back of the circle. */
const PARTNER_SLOTS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, -2.3]],
  2: [[-1.7, -2.1], [1.7, -2.1]],
  3: [[-2.4, -1.5], [0, -2.5], [2.4, -1.5]],
}

function playerSpot(index: number, players: Player[]): readonly [number, number] {
  if (index <= 0) return CHILD_POS
  const slots = PARTNER_SLOTS[Math.min(players.length - 1, 3)]
  return slots[index - 1] ?? slots[0]
}

/** Where the ball rests for a given holder: just in front of them, toward the middle. */
function ballSpot(index: number, players: Player[]): [number, number] {
  const [x, z] = playerSpot(index, players)
  const len = Math.hypot(x, z) || 1
  return [x - (x / len) * 0.8, z - (z / len) * 0.8]
}

function SceneInner(props: RollBackSceneProps) {
  const { players, cue, ballOwner, readyIndex, rollerIndex, rejectIndex, celebrateIndex, childTurn, shake, onPickPartner } = props
  const [childX, childZ] = CHILD_POS

  return (
    <group>
      <CameraSway />

      {/* grass */}
      <mesh rotation-x={-Math.PI / 2} position={[0, BASE_Y, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#b7dfa0" />
      </mesh>
      {/* worn play-circle where the ball rolls */}
      <mesh rotation-x={-Math.PI / 2} position={[0, BASE_Y + 0.005, 0]}>
        <circleGeometry args={[3.1, 48]} />
        <meshStandardMaterial color="#cfe9b6" />
      </mesh>

      {/* playground dressing */}
      <Tree x={-4.6} z={-3.2} />
      <Tree x={4.4} z={-3.6} scale={1.2} />
      <Bush x={3.6} z={0.6} />
      <Bush x={-3.9} z={1.1} />

      <Ball players={players} owner={ballOwner} glowing={childTurn} shake={shake} />

      {players.map((player, i) => {
        const [x, z] = playerSpot(i, players)
        const isPartner = player.kind === 'peer'
        // everyone faces the middle by default; the ready partner squares up
        // to the child, and in orient mode the others turn away — direction
        // of the body *is* the cue on hard.
        let face = Math.atan2(-x, -z)
        if (isPartner && readyIndex !== null) {
          if (i === readyIndex) face = Math.atan2(childX - x, childZ - z)
          else if (cue === 'orient') face += (i % 2 === 0 ? 1 : -1) * 0.95
        }
        return (
          <Kid
            key={player.id}
            player={player}
            x={x}
            z={z}
            face={face}
            ready={i === readyIndex}
            cue={cue}
            rolling={i === rollerIndex}
            rejecting={i === rejectIndex}
            celebrating={i === celebrateIndex}
            onPick={isPartner ? () => onPickPartner(i) : undefined}
          />
        )
      })}
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

const UP = new THREE.Vector3(0, 1, 0)

/** Shared style for the DOM name/bubble overlays: never intercept taps. */
const LABEL_STYLE: CSSProperties = { pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none' }

/**
 * The ball rolls (position lerp + true rolling rotation) toward whoever owns
 * it. It bobs and glows on the child's turn and shakes after a premature roll.
 */
function Ball({
  players,
  owner,
  glowing,
  shake,
}: {
  players: Player[]
  owner: number
  glowing: boolean
  shake: number
}) {
  const ref = useRef<THREE.Group>(null)
  const sphere = useRef<THREE.Mesh>(null)
  const pos = useRef<THREE.Vector3 | null>(null)
  const dest = useRef(new THREE.Vector3())
  const delta = useRef(new THREE.Vector3())
  const axis = useRef(new THREE.Vector3())
  const spin = useRef(new THREE.Quaternion())
  const shakeAmt = useRef(0)

  useEffect(() => {
    if (shake > 0) shakeAmt.current = 1
  }, [shake])

  const [tx, tz] = ballSpot(owner, players)
  dest.current.set(tx, BALL_Y, tz)
  if (pos.current === null) pos.current = dest.current.clone()

  useFrame((state, dt) => {
    const g = ref.current
    const m = sphere.current
    const p = pos.current
    if (!g || !m || !p) return
    delta.current.copy(p)
    p.lerp(dest.current, Math.min(1, dt * 4.2))
    delta.current.subVectors(p, delta.current)
    const dist = delta.current.length()
    if (dist > 1e-4) {
      // rolling, not sliding: rotate about up × direction by dist / radius
      axis.current.crossVectors(UP, delta.current).normalize()
      spin.current.setFromAxisAngle(axis.current, dist / BALL_R)
      m.quaternion.premultiply(spin.current)
    }
    const t = state.clock.elapsedTime
    const bob = glowing ? Math.abs(Math.sin(t * 2.5)) * 0.09 : 0
    let sx = 0
    if (shakeAmt.current > 0) {
      shakeAmt.current = Math.max(0, shakeAmt.current - dt * 2.5)
      sx = Math.sin(t * 40) * shakeAmt.current * 0.07
    }
    g.position.set(p.x + sx, p.y + bob, p.z)
    const mat = m.material as THREE.MeshStandardMaterial
    const glow = glowing ? 0.3 + Math.sin(t * 4) * 0.15 : 0
    mat.emissiveIntensity += (glow - mat.emissiveIntensity) * 0.2
  })

  return (
    <group ref={ref}>
      <mesh ref={sphere}>
        <sphereGeometry args={[BALL_R, 24, 24]} />
        <meshStandardMaterial color="#e2554c" emissive="#e2554c" emissiveIntensity={0} />
        {/* white equator band makes the rolling readable */}
        <mesh>
          <torusGeometry args={[BALL_R * 0.99, 0.045, 10, 32]} />
          <meshStandardMaterial color="#fdf6ec" />
        </mesh>
      </mesh>
    </group>
  )
}

/**
 * A stylized kid (same body plan as Block Buddies) with the ready-cue poses:
 *  - verbal : hands up + pulsing ring at the feet + a "Roll it to me!" bubble.
 *  - gesture: hands up and leaning in — no ring, no words.
 *  - orient : arms stay down; only the body turning toward the child signals
 *             readiness (the scene turns non-ready partners away).
 * Partners are tappable — tapping one rolls the ball to them.
 */
function Kid({
  player,
  x,
  z,
  face,
  ready,
  cue,
  rolling,
  rejecting,
  celebrating,
  onPick,
}: {
  player: Player
  x: number
  z: number
  face: number
  ready: boolean
  cue: CueMode
  rolling: boolean
  rejecting: boolean
  celebrating: boolean
  onPick?: () => void
}) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const shirtMat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const look = player.look
  const phase = x * 1.7
  const handsUp = (ready && cue !== 'orient') || celebrating
  const initialized = useRef(false)

  useFrame((state) => {
    const grp = g.current
    if (!grp) return
    if (!initialized.current && body.current) {
      // start out already facing the middle — no spin-around on mount
      body.current.rotation.y = face
      initialized.current = true
    }
    const t = state.clock.elapsedTime
    const targetScale = ready || celebrating ? 1.06 : 1
    grp.scale.setScalar(grp.scale.x + (targetScale - grp.scale.x) * 0.1)
    const hop = celebrating ? Math.abs(Math.sin(t * 5)) * 0.14 : ready ? Math.abs(Math.sin(t * 3)) * 0.04 : 0
    grp.position.y += (BASE_Y + hop - grp.position.y) * 0.12

    const b = body.current
    if (b) {
      // turn to the assigned facing, sway idly, lean in to roll or beckon
      const wobble = rejecting ? Math.sin(t * 9) * 0.16 : 0
      b.rotation.y += (face + Math.sin(t * 0.9 + phase) * 0.04 + wobble - b.rotation.y) * 0.09
      const lean = rolling ? -0.3 : ready && cue !== 'verbal' ? -0.14 : 0
      b.rotation.x += (lean - b.rotation.x) * 0.1
    }
    const raiseL = handsUp ? -2.55 : Math.sin(t * 1.1 + phase) * 0.06
    const raiseR = handsUp ? -2.55 : rolling ? -1.15 : Math.sin(t * 1.05 + phase) * 0.06
    if (armL.current) armL.current.rotation.x += (raiseL - armL.current.rotation.x) * 0.12
    if (armR.current) armR.current.rotation.x += (raiseR - armR.current.rotation.x) * 0.12

    if (shirtMat.current) {
      const glow = ready && cue === 'verbal' ? 0.3 : 0
      shirtMat.current.emissiveIntensity += (glow - shirtMat.current.emissiveIntensity) * 0.2
    }
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
      onPointerDown={
        onPick
          ? (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation()
              onPick()
            }
          : undefined
      }
      onPointerOver={onPick ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onPick ? () => (document.body.style.cursor = 'auto') : undefined}
    >
      {/* verbal cue only: pulsing ring at the feet */}
      {ready && cue === 'verbal' && (
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
          <meshStandardMaterial
            ref={shirtMat}
            color={look.shirt}
            emissive={look.shirt}
            emissiveIntensity={0}
          />
        </mesh>
        {/* arms (both raise for the ready gesture; right pushes the roll) */}
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
      {/* name label — a DOM overlay so Malayalam script renders (the 3D text
          font has no Malayalam glyphs); pointer-events off so taps reach the kid */}
      <Html position={[0, 1.86, 0]} center distanceFactor={8} style={LABEL_STYLE} zIndexRange={[10, 0]}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#333' }}>{player.name}</div>
      </Html>
      {/* verbal cue only: the partner literally asks for the ball */}
      {ready && cue === 'verbal' && (
        <Html position={[0, 2.3, 0]} center distanceFactor={8} style={LABEL_STYLE} zIndexRange={[10, 0]}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: '#0a7d4f',
              background: '#eafbf1',
              border: '2px solid #22c55e',
              borderRadius: 12,
              padding: '4px 10px',
            }}
          >
            {rbLine('bubbleAsk', 'ml')}
          </div>
        </Html>
      )}
    </group>
  )
}
