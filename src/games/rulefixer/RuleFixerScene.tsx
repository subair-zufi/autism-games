import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PeerMood, Situation } from './logic'

export interface RuleFixerSceneProps {
  situation: Situation
  /** 'good' when the child made the kind choice, 'bad' otherwise, null while deciding */
  outcome: 'good' | 'bad' | null
}

export function RuleFixerScene({ situation, outcome }: RuleFixerSceneProps) {
  const { mood, books, tall, swing, fallen, watching } = situation.scene
  return (
    <Canvas camera={{ position: [0, 1.7, 6], fov: 45 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
      <color attach="background" args={['#eef0f7']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={0.85} />
      <Room />
      {books && <Books />}
      {swing && <Swing />}
      {watching && <Ball />}
      <Peer
        mood={mood}
        tall={tall}
        happy={outcome === 'good'}
        fallen={fallen}
        offset={watching ? -1.6 : 0}
      />
    </Canvas>
  )
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#d6d9e6" />
      </mesh>
      <mesh position={[0, 3, -4]}>
        <planeGeometry args={[24, 9]} />
        <meshStandardMaterial color="#e3e5ef" />
      </mesh>
    </group>
  )
}

function Books() {
  const colors = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f']
  const spots: [number, number, number][] = [
    [-1, 0.06, 1.4], [-0.5, 0.18, 1.1], [-1.3, 0.3, 1.2], [-0.8, 0.42, 1.5],
  ]
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, i * 0.6, (i % 2 ? 0.2 : -0.15)]}>
          <boxGeometry args={[0.5, 0.12, 0.36]} />
          <meshStandardMaterial color={colors[i % colors.length]} />
        </mesh>
      ))}
    </group>
  )
}

function Swing() {
  // A-frame swing set off to the right; peer (at x=0) stands beside it waiting.
  const seat = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = seat.current
    if (!g) return
    g.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.18
  })
  return (
    <group position={[1.7, 0, 0.2]}>
      {/* top bar */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[1.8, 0.12, 0.12]} />
        <meshStandardMaterial color="#9aa3bd" />
      </mesh>
      {/* legs (A-frame) */}
      <mesh position={[-0.8, 1.1, 0.35]} rotation={[0.35, 0, 0.18]}>
        <boxGeometry args={[0.1, 2.3, 0.1]} />
        <meshStandardMaterial color="#9aa3bd" />
      </mesh>
      <mesh position={[-0.8, 1.1, -0.35]} rotation={[-0.35, 0, 0.18]}>
        <boxGeometry args={[0.1, 2.3, 0.1]} />
        <meshStandardMaterial color="#9aa3bd" />
      </mesh>
      <mesh position={[0.8, 1.1, 0.35]} rotation={[0.35, 0, -0.18]}>
        <boxGeometry args={[0.1, 2.3, 0.1]} />
        <meshStandardMaterial color="#9aa3bd" />
      </mesh>
      <mesh position={[0.8, 1.1, -0.35]} rotation={[-0.35, 0, -0.18]}>
        <boxGeometry args={[0.1, 2.3, 0.1]} />
        <meshStandardMaterial color="#9aa3bd" />
      </mesh>
      {/* swinging seat hangs from the top bar */}
      <group ref={seat} position={[0, 2.2, 0]}>
        <mesh position={[-0.22, -0.7, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.04]} />
          <meshStandardMaterial color="#5b6b8c" />
        </mesh>
        <mesh position={[0.22, -0.7, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.04]} />
          <meshStandardMaterial color="#5b6b8c" />
        </mesh>
        <mesh position={[0, -1.42, 0]}>
          <boxGeometry args={[0.6, 0.08, 0.34]} />
          <meshStandardMaterial color="#e2554c" />
        </mesh>
      </group>
    </group>
  )
}

function Ball() {
  // a game cue on the ground that the lonely child is watching from the side
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    m.position.x = 1.4 + Math.sin(state.clock.elapsedTime * 1.4) * 0.4
    m.rotation.z = state.clock.elapsedTime * 0.8
  })
  return (
    <mesh ref={ref} position={[1.4, 0.32, 1]}>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial color="#f5c542" />
    </mesh>
  )
}

function Peer({
  mood,
  tall,
  happy,
  fallen,
  offset = 0,
}: {
  mood: PeerMood
  tall?: boolean
  happy: boolean
  fallen?: boolean
  offset?: number
}) {
  const group = useRef<THREE.Group>(null)
  const hop = useRef(99)
  // a fallen peer gets up (stands) when the kind choice is made
  const down = fallen && !happy
  useEffect(() => {
    if (happy) hop.current = 0
  }, [happy])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    if (down) {
      g.position.y = 0
      return
    }
    let y = 0
    if (hop.current < 1.2) {
      hop.current += dt * 1.6
      y = Math.abs(Math.sin(hop.current * Math.PI * 2)) * 0.22
    } else {
      y = Math.sin(state.clock.elapsedTime * 1.6) * 0.03
    }
    g.position.y = y
  })

  const skin = '#f2c89b'
  const scale = tall ? 1.25 : 1
  const curve = happy ? 0.55 : mood === 'neutral' ? 0.05 : -0.45
  const showTear = !happy && mood === 'cry'

  return (
    <group
      ref={group}
      position={[offset, down ? 0.3 : 0, down ? 1 : 0]}
      rotation={down ? [0, 0, Math.PI / 2] : [0, 0, 0]}
      scale={scale}
    >
      {/* legs */}
      <mesh position={[-0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      <mesh position={[0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      {/* torso */}
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.62, 0.8, 0.34]} /><meshStandardMaterial color={tall ? '#8a6fb0' : '#e08a6f'} /></mesh>
      {/* arms */}
      <mesh position={[-0.44, 1.05, 0]} rotation={[0, 0, happy ? 1.4 : 0.12]}><boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={tall ? '#8a6fb0' : '#e08a6f'} /></mesh>
      <mesh position={[0.44, 1.05, 0]} rotation={[0, 0, happy ? -1.4 : -0.12]}><boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={tall ? '#8a6fb0' : '#e08a6f'} /></mesh>
      {/* head */}
      <mesh position={[0, 1.78, 0]}><sphereGeometry args={[0.36, 24, 24]} /><meshStandardMaterial color={skin} /></mesh>
      {/* eyes */}
      <mesh position={[-0.13, 1.82, 0.31]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      <mesh position={[0.13, 1.82, 0.31]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      {/* mouth: beads on a parabola, corners lift when happy */}
      <Mouth curve={curve} />
      {showTear && <Tear />}
      {mood === 'hurt' && !happy && (
        <group position={[0.18, 1.95, 0.3]}>
          <mesh><boxGeometry args={[0.18, 0.05, 0.02]} /><meshStandardMaterial color="#fff" /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.18, 0.05, 0.02]} /><meshStandardMaterial color="#fff" /></mesh>
        </group>
      )}
    </group>
  )
}

function Mouth({ curve }: { curve: number }) {
  const beads = Array.from({ length: 5 }, (_, i) => {
    const t = (i / 4) * 2 - 1
    return [t * 0.18, 1.66 + curve * 0.08 * (t * t), 0.32] as const
  })
  return (
    <group>
      {beads.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#8a3b3b" />
        </mesh>
      ))}
    </group>
  )
}

function Tear() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = (state.clock.elapsedTime % 1.6) / 1.6
    m.position.y = 1.78 - t * 0.5
    const mat = m.material as THREE.MeshStandardMaterial
    mat.opacity = 1 - t
  })
  return (
    <mesh ref={ref} position={[-0.13, 1.78, 0.34]}>
      <sphereGeometry args={[0.035, 10, 10]} />
      <meshStandardMaterial color="#6fb6e8" transparent />
    </mesh>
  )
}
