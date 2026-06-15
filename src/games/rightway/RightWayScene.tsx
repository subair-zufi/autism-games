import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Scenario } from './logic'

export interface RightWaySceneProps {
  scenario: Scenario
  /** increments on a correct answer to make the characters cheer */
  celebrate: number
}

export function RightWayScene({ scenario, celebrate }: RightWaySceneProps) {
  const { scene, pose } = scenario
  // the actor crowds in (close), or stands back at the left
  const actorX = scene.turnAway ? -1.1 : pose.close ? 0.35 : -1.3
  const actorYaw = scene.turnAway ? -2.6 : 0.4

  return (
    <Canvas camera={{ position: [0, 1.7, 6.2], fov: 45 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
      <color attach="background" args={['#eaf4ec']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={0.85} />
      <Room />

      {/* a waiting line of kids behind the friend (queue scenarios) */}
      {scene.line && <Line />}

      {/* the friend on the right */}
      <Character
        position={[1.3, 0, 0]}
        shirt="#e3a3b5"
        yaw={-0.4}
        armUp={scene.waveBack}
        celebrate={celebrate}
      />

      {/* the actor on the left (or crowding in) */}
      <Character
        position={[actorX, 0, 0.2]}
        shirt="#7fb6d8"
        yaw={actorYaw}
        armUp={pose.armUp}
        lean={pose.lean ?? 0}
        celebrate={celebrate}
      />

      {/* objects that make the picture match the sentence */}
      {scene.toy === 'offer' && <Blocks position={[0.1, 1.15, 0.5]} />}
      {scene.toy === 'grab' && <Blocks position={[0.75, 1.0, 0.4]} grabbed />}
      {scene.bump && <Bump position={[0, 1.25, 0.5]} />}
      {scene.polite && <Heart position={[-1.3, 2.35, 0.2]} />}
    </Canvas>
  )
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#cfe3cf" />
      </mesh>
      <mesh position={[0, 3, -4]}>
        <planeGeometry args={[24, 9]} />
        <meshStandardMaterial color="#dcebe0" />
      </mesh>
      {/* a couple of friendly wall shapes so it reads as a room */}
      <mesh position={[-3.2, 2.6, -3.9]}>
        <boxGeometry args={[1.6, 1.1, 0.1]} />
        <meshStandardMaterial color="#bcd6c4" />
      </mesh>
      <mesh position={[3.1, 2.7, -3.9]}>
        <circleGeometry args={[0.7, 24]} />
        <meshStandardMaterial color="#f4d58d" />
      </mesh>
    </group>
  )
}

/** Two extra kids standing in a line behind the friend (queue scenarios). */
function Line() {
  return (
    <group>
      <Character position={[2.4, 0, -0.3]} shirt="#caa46f" yaw={-0.5} small />
      <Character position={[3.4, 0, -0.6]} shirt="#9bbf8f" yaw={-0.5} small />
    </group>
  )
}

function Character({
  position,
  shirt,
  yaw,
  armUp = false,
  lean = 0,
  small = false,
  celebrate = 0,
}: {
  position: [number, number, number]
  shirt: string
  yaw: number
  armUp?: boolean
  lean?: number
  small?: boolean
  celebrate?: number
}) {
  const group = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const hop = useRef(99)
  const phase = useRef(Math.random() * 6)

  useEffect(() => {
    if (celebrate > 0) hop.current = 0
  }, [celebrate])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    let y = position[1]
    if (hop.current < 1) {
      hop.current += dt * 1.6
      y += Math.abs(Math.sin(hop.current * Math.PI * 2)) * 0.25
    } else {
      y += Math.sin(state.clock.elapsedTime * 1.8 + phase.current) * 0.03
    }
    g.position.y = y
    // a raised arm waves gently
    if (arm.current && armUp) {
      arm.current.rotation.z = 2.2 + Math.sin(state.clock.elapsedTime * 6) * 0.25
    }
  })

  const skin = '#f2c89b'
  const s = small ? 0.85 : 1
  return (
    <group ref={group} position={position} rotation={[lean, yaw, 0]} scale={s}>
      {/* legs */}
      <mesh position={[-0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      <mesh position={[0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      {/* torso */}
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.6, 0.8, 0.34]} /><meshStandardMaterial color={shirt} /></mesh>
      {/* left arm */}
      <mesh position={[-0.42, 1.05, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={shirt} />
      </mesh>
      {/* right arm (raises when armUp) */}
      <group ref={arm} position={[0.42, 1.35, 0]} rotation={[0, 0, armUp ? 2.2 : -0.15]}>
        <mesh position={[0, -0.3, 0]}><boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh position={[0, -0.65, 0]}><sphereGeometry args={[0.1, 12, 12]} /><meshStandardMaterial color={skin} /></mesh>
      </group>
      {/* head */}
      <mesh position={[0, 1.75, 0]}><sphereGeometry args={[0.34, 24, 24]} /><meshStandardMaterial color={skin} /></mesh>
      <mesh position={[-0.12, 1.78, 0.3]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      <mesh position={[0.12, 1.78, 0.3]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
      <mesh position={[0, 1.62, 0.31]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} /><meshStandardMaterial color="#c2706a" /></mesh>
    </group>
  )
}

/** A little stack of toy blocks, shared kindly or being snatched. */
function Blocks({ position, grabbed = false }: { position: [number, number, number]; grabbed?: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    if (grabbed) {
      // jitter, as if being tugged
      g.position.x = position[0] + Math.sin(state.clock.elapsedTime * 16) * 0.04
      g.rotation.z = Math.sin(state.clock.elapsedTime * 16) * 0.12
    } else {
      g.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.03
    }
  })
  const colors = ['#e2554c', '#f5c542', '#5aa9e6']
  return (
    <group ref={group} position={position}>
      {colors.map((c, i) => (
        <mesh key={i} position={[(i - 1) * 0.005, i * 0.24, 0]}>
          <boxGeometry args={[0.26, 0.22, 0.26]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

/** A cartoon "bump" star between two characters (the sorry scenario). */
function Bump({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const p = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.12
    m.scale.setScalar(p)
    m.rotation.z += 0.02
  })
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.22]} />
      <meshStandardMaterial color="#ffd54a" emissive="#f5b301" emissiveIntensity={0.5} />
    </mesh>
  )
}

/** A floating heart for the polite "please" scenario. */
function Heart({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    g.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.08
    g.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.15
  })
  return (
    <group ref={ref} position={position}>
      <mesh position={[-0.07, 0.04, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
      <mesh position={[0.07, 0.04, 0]}><sphereGeometry args={[0.09, 12, 12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
      <mesh position={[0, -0.06, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.16, 0.16, 0.12]} /><meshStandardMaterial color="#ff6b8a" /></mesh>
    </group>
  )
}
