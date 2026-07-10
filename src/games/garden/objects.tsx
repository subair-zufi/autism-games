import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ObjectId } from './logic'

/**
 * The single source of truth for every garden object's 3D model.
 * Both the garden scene AND the answer buttons render these exact
 * components, so what the child sees in the garden always matches
 * what they see on the option key.
 */
export function GardenObject({ id, animated = true }: { id: ObjectId; animated?: boolean }) {
  switch (id) {
    case 'flower-red': return <Flower color="#e2554c" />
    case 'flower-yellow': return <Flower color="#f5c542" />
    case 'flower-purple': return <Flower color="#9d6fd6" />
    case 'butterfly': return <Butterfly animated={animated} />
    case 'tree': return <Tree />
    case 'bird': return <Bird />
    case 'mushroom': return <Mushroom />
    case 'bee': return <Bee animated={animated} />
  }
}

/** All three flowers share one shape so colour is the only difference. */
function Flower({ color }: { color: string }) {
  // petal ring faces the camera so the flower reads as a flower, not a donut
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return [Math.cos(a) * 0.22, 0.88 + Math.sin(a) * 0.22, 0] as const
  })
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.8]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      {/* leaves, one each side */}
      <mesh position={[0.16, 0.38, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.35, 0.5]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      <mesh position={[-0.15, 0.26, 0]} rotation={[0, 0, 0.5]} scale={[1, 0.35, 0.5]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      {petals.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} scale={[1, 1, 0.45]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0.09]} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#f7e06b" />
      </mesh>
    </group>
  )
}

function Tree() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.16, 0.26, 1.2]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      {/* branch stub */}
      <mesh position={[0.28, 1.1, 0]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.06, 0.09, 0.5]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.78, 16, 16]} />
        <meshStandardMaterial color="#6aa84f" />
      </mesh>
      <mesh position={[0.55, 1.5, 0.15]}>
        <sphereGeometry args={[0.48, 16, 16]} />
        <meshStandardMaterial color="#7cb45e" />
      </mesh>
      <mesh position={[-0.55, 1.55, -0.1]}>
        <sphereGeometry args={[0.52, 16, 16]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      <mesh position={[0, 2.4, -0.05]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#7cb45e" />
      </mesh>
    </group>
  )
}

function Mushroom() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 0.5]} />
        <meshStandardMaterial color="#f3e7d3" />
      </mesh>
      <mesh position={[0, 0.55, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.46, 16, 16]} />
        <meshStandardMaterial color="#d8574a" />
      </mesh>
      {[[-0.2, 0.64, 0.26], [0.24, 0.66, 0.12], [0.02, 0.6, -0.32], [-0.28, 0.6, -0.1], [0.1, 0.63, 0.32]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#fdf6ec" />
        </mesh>
      ))}
    </group>
  )
}

function Bird() {
  return (
    <group>
      {/* legs */}
      <mesh position={[0.07, 0.08, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.16]} />
        <meshStandardMaterial color="#f2a14b" />
      </mesh>
      <mesh position={[-0.07, 0.08, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.16]} />
        <meshStandardMaterial color="#f2a14b" />
      </mesh>
      {/* body */}
      <mesh position={[0, 0.32, 0]} scale={[1, 0.9, 1.25]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#6fa8dc" />
      </mesh>
      {/* belly */}
      <mesh position={[0, 0.26, 0.1]} scale={[0.8, 0.7, 0.9]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#dceafb" />
      </mesh>
      {/* wings */}
      <mesh position={[0.22, 0.36, -0.02]} rotation={[0, 0, -0.35]} scale={[0.35, 0.6, 1]}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color="#5b8fc4" />
      </mesh>
      <mesh position={[-0.22, 0.36, -0.02]} rotation={[0, 0, 0.35]} scale={[0.35, 0.6, 1]}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color="#5b8fc4" />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.57, 0.16]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#7eb6e8" />
      </mesh>
      {/* beak */}
      <mesh position={[0, 0.56, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.14, 8]} />
        <meshStandardMaterial color="#f2a14b" />
      </mesh>
      {/* eyes */}
      <mesh position={[0.08, 0.62, 0.24]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2c2a3a" />
      </mesh>
      <mesh position={[-0.08, 0.62, 0.24]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2c2a3a" />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0.36, -0.32]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.24]} />
        <meshStandardMaterial color="#5b8fc4" />
      </mesh>
    </group>
  )
}

/** One butterfly wing: big upper lobe + small lower lobe + dark spot. */
function ButterflyWing({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 0.06, 0.05, 0]} rotation={[-Math.PI / 2.2, 0, 0]}>
      <mesh position={[side * 0.18, 0.06, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial color="#7ec8e3" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[side * 0.14, -0.16, 0]}>
        <circleGeometry args={[0.13, 16]} />
        <meshStandardMaterial color="#a3daf0" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[side * 0.2, 0.07, 0.004]}>
        <circleGeometry args={[0.06, 12]} />
        <meshStandardMaterial color="#3f7fa8" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Butterfly({ animated }: { animated: boolean }) {
  const wingL = useRef<THREE.Group>(null)
  const wingR = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!animated) return
    const t = state.clock.elapsedTime
    const flap = 0.55 + Math.sin(t * 7) * 0.45
    if (wingL.current) wingL.current.rotation.z = flap
    if (wingR.current) wingR.current.rotation.z = -flap
    if (body.current) {
      body.current.position.y = 1.5 + Math.sin(t * 2.1) * 0.15
      body.current.position.x = Math.sin(t * 0.9) * 0.2
    }
  })
  return (
    <group ref={body} position={[0, 1.5, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
        <meshStandardMaterial color="#4a4458" />
      </mesh>
      {/* head + antennae */}
      <mesh position={[0, 0.02, 0.2]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#4a4458" />
      </mesh>
      <mesh position={[0.05, 0.1, 0.26]} rotation={[0.5, 0, -0.4]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16]} />
        <meshStandardMaterial color="#4a4458" />
      </mesh>
      <mesh position={[-0.05, 0.1, 0.26]} rotation={[0.5, 0, 0.4]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16]} />
        <meshStandardMaterial color="#4a4458" />
      </mesh>
      {/* wings start half-raised so a still butterfly also reads clearly */}
      <group ref={wingL} rotation={[0, 0, 0.55]}>
        <ButterflyWing side={-1} />
      </group>
      <group ref={wingR} rotation={[0, 0, -0.55]}>
        <ButterflyWing side={1} />
      </group>
    </group>
  )
}

function Bee({ animated }: { animated: boolean }) {
  const body = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!animated) return
    const t = state.clock.elapsedTime
    if (body.current) {
      body.current.position.y = 1.2 + Math.sin(t * 3.3) * 0.1
      body.current.position.z = Math.sin(t * 1.3) * 0.15
    }
  })
  return (
    <group ref={body} position={[0, 1.2, 0]}>
      <mesh scale={[1.3, 1, 1]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#f5c542" />
      </mesh>
      {/* black stripes */}
      <mesh position={[0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.14, 0.038, 8, 16]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      <mesh position={[-0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={0.92}>
        <torusGeometry args={[0.14, 0.038, 8, 16]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      {/* head + eyes + antennae */}
      <mesh position={[0.24, 0.02, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      <mesh position={[0.3, 0.05, 0.05]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.3, 0.05, -0.05]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.28, 0.15, 0.03]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.007, 0.007, 0.12]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      <mesh position={[0.28, 0.15, -0.03]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.007, 0.007, 0.12]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      {/* stinger */}
      <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.1, 8]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      {/* translucent wings */}
      <mesh position={[0.02, 0.17, 0.06]} rotation={[-Math.PI / 2.5, 0.25, 0]}>
        <circleGeometry args={[0.13, 12]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.02, 0.17, -0.06]} rotation={[-Math.PI / 1.7, -0.25, 0]}>
        <circleGeometry args={[0.13, 12]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
