import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type Holder = 'robot' | 'child'

export interface TorchSceneProps {
  /** who holds the torch: robot glows orange near the robot, child glows blue near the camera */
  holder: Holder
  /** true while the robot is talking so it can bob along */
  robotTalking: boolean
}

export function TorchScene(props: TorchSceneProps) {
  return (
    <Canvas camera={{ position: [0, 1.8, 5.6], fov: 46 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
      <color attach="background" args={['#2e3450']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 5]} intensity={0.35} />
      <pointLight position={[0, 1.2, 0]} intensity={6} color="#f5a04a" distance={9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ holder, robotTalking }: TorchSceneProps) {
  return (
    <group>
      {/* night-time clearing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#3c4a3e" />
      </mesh>
      <Stars />
      <Campfire />
      <Robot talking={robotTalking} />
      <Torch holder={holder} />
    </group>
  )
}

function Stars() {
  const spots: [number, number, number][] = [
    [-5, 5.2, -8], [-2.4, 6, -8], [0.8, 5.5, -8], [3.4, 6.2, -8], [5.6, 4.9, -8], [-4, 4.2, -8], [2, 4.4, -8],
  ]
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fffbe0" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  )
}

function Campfire() {
  const flame = useRef<THREE.Mesh>(null)
  const flame2 = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (flame.current) {
      flame.current.scale.set(1 + Math.sin(t * 9) * 0.12, 1 + Math.sin(t * 7) * 0.18, 1)
      flame.current.rotation.y = t * 1.2
    }
    if (flame2.current) {
      flame2.current.scale.setScalar(1 + Math.sin(t * 11 + 1) * 0.15)
      flame2.current.rotation.y = -t * 1.6
    }
  })
  return (
    <group position={[0, 0, 0]}>
      {/* log ring */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55]} rotation={[0, -a, Math.PI / 2.4]}>
            <cylinderGeometry args={[0.09, 0.09, 0.7, 10]} />
            <meshStandardMaterial color="#6b4a32" />
          </mesh>
        )
      })}
      <mesh ref={flame} position={[0, 0.55, 0]}>
        <coneGeometry args={[0.32, 0.85, 12]} />
        <meshStandardMaterial color="#f5a04a" emissive="#f57b2a" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={flame2} position={[0, 0.5, 0]}>
        <coneGeometry args={[0.18, 0.55, 10]} />
        <meshStandardMaterial color="#ffe08a" emissive="#ffd24a" emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}

function Robot({ talking }: { talking: boolean }) {
  const group = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (group.current) {
      group.current.position.y = Math.sin(t * 1.6) * 0.04 + (talking ? Math.abs(Math.sin(t * 5)) * 0.05 : 0)
    }
    if (mouth.current) {
      mouth.current.scale.y = talking ? 0.6 + Math.abs(Math.sin(t * 10)) * 0.9 : 0.5
    }
  })
  const body = '#8fa3bf'
  return (
    <group ref={group} position={[0, 0, -2.2]}>
      {/* body */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.9, 1, 0.7]} />
        <meshStandardMaterial color={body} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.7, 0.6, 0.6]} />
        <meshStandardMaterial color="#a8bad4" />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.16, 1.82, 0.31]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#fff" emissive="#9fe2ff" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.16, 1.82, 0.31]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#fff" emissive="#9fe2ff" emissiveIntensity={0.9} />
      </mesh>
      {/* mouth bar scales while talking */}
      <mesh ref={mouth} position={[0, 1.6, 0.31]}>
        <boxGeometry args={[0.26, 0.08, 0.04]} />
        <meshStandardMaterial color="#3a4458" emissive="#62d2ff" emissiveIntensity={0.5} />
      </mesh>
      {/* antenna */}
      <mesh position={[0, 2.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color="#6b7a94" />
      </mesh>
      <mesh position={[0, 2.32, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#ffd24a" emissive="#f5a623" emissiveIntensity={0.8} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.6, 0.95, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <mesh position={[0.6, 0.95, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color={body} />
      </mesh>
    </group>
  )
}

const ROBOT_SPOT = new THREE.Vector3(0.9, 1.5, -1.7)
const CHILD_SPOT = new THREE.Vector3(0, 1.1, 2.6)

function Torch({ holder }: { holder: Holder }) {
  const group = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Mesh>(null)
  const color = holder === 'child' ? '#62b8ff' : '#f5a04a'
  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const target = holder === 'child' ? CHILD_SPOT : ROBOT_SPOT
    g.position.lerp(target, Math.min(1, dt * 3.5))
    g.position.y += Math.sin(state.clock.elapsedTime * 2.4) * 0.01
    if (flame.current) {
      flame.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.15)
    }
  })
  return (
    <group ref={group} position={[0.9, 1.5, -1.7]}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.09, 0.6, 10]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      <mesh ref={flame} position={[0, 0.45, 0]}>
        <coneGeometry args={[0.16, 0.42, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} intensity={2.5} color={color} distance={4} />
    </group>
  )
}
