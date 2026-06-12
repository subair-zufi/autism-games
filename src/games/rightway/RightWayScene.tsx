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
  return (
    <Canvas camera={{ position: [0, 1.6, 6], fov: 45 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
      <color attach="background" args={['#eaf4ec']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={0.85} />
      <Room />
      {/* the "other" friend on the right, the actor on the left */}
      <Character
        position={[1.3, 0, 0]}
        shirt="#e3a3b5"
        yaw={-0.4}
        celebrate={celebrate}
      />
      <Character
        position={[scenario.pose.close ? 0.4 : -1.3, 0, 0.2]}
        shirt="#7fb6d8"
        yaw={0.4}
        armUp={scenario.pose.armUp}
        lean={scenario.pose.lean ?? 0}
        celebrate={celebrate}
      />
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

function Character({
  position,
  shirt,
  yaw,
  armUp = false,
  lean = 0,
  celebrate,
}: {
  position: [number, number, number]
  shirt: string
  yaw: number
  armUp?: boolean
  lean?: number
  celebrate: number
}) {
  const group = useRef<THREE.Group>(null)
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
    g.rotation.x = lean
  })

  const skin = '#f2c89b'
  return (
    <group ref={group} position={position} rotation={[lean, yaw, 0]}>
      {/* legs */}
      <mesh position={[-0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      <mesh position={[0.16, 0.35, 0]}><boxGeometry args={[0.22, 0.7, 0.24]} /><meshStandardMaterial color="#5b6b8c" /></mesh>
      {/* torso */}
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.6, 0.8, 0.34]} /><meshStandardMaterial color={shirt} /></mesh>
      {/* arms */}
      <mesh position={[-0.42, 1.05, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.16, 0.7, 0.18]} /><meshStandardMaterial color={shirt} />
      </mesh>
      <group position={[0.42, 1.35, 0]} rotation={[0, 0, armUp ? 2.2 : -0.15]}>
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
