import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GARDEN_OBJECTS, type ObjectId } from './logic'

/** y the hand hovers at, per object (just above its top) */
const HOVER_Y: Record<ObjectId, number> = {
  'flower-red': 1.55,
  'flower-yellow': 1.55,
  'flower-purple': 1.55,
  butterfly: 2.35,
  tree: 3.05,
  bird: 1.25,
  mushroom: 1.4,
  bee: 2.0,
}

export interface GardenSceneProps {
  target: ObjectId
  celebrate: number
}

export function GardenScene(props: GardenSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 7.5], fov: 42 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
    >
      <color attach="background" args={['#d9efff']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 7, 5]} intensity={0.9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ target, celebrate }: GardenSceneProps) {
  const objectRefs = useRef<Partial<Record<ObjectId, THREE.Group | null>>>({})
  const wiggle = useRef({ t: 99, id: null as ObjectId | null })

  useEffect(() => {
    if (celebrate > 0) wiggle.current = { t: 0, id: target }
    // target intentionally not a dep: celebrate fires for the round that was just won
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate])

  useFrame((_, dt) => {
    const w = wiggle.current
    if (!w.id) return
    const g = objectRefs.current[w.id]
    if (!g) return
    if (w.t > 1) {
      g.rotation.z = 0
      g.scale.setScalar(1)
      w.id = null
      return
    }
    w.t += dt
    const fade = 1 - w.t
    g.rotation.z = Math.sin(w.t * 18) * 0.18 * fade
    g.scale.setScalar(1 + Math.sin(w.t * 9) * 0.12 * fade)
  })

  const meta = GARDEN_OBJECTS.find((o) => o.id === target)!
  const handTarget = new THREE.Vector3(meta.position[0], HOVER_Y[target], meta.position[1])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#bfdcab" />
      </mesh>

      <Cloud x={-4} y={4.4} z={-6} />
      <Cloud x={3.5} y={5} z={-7} />

      {GARDEN_OBJECTS.map((o) => (
        <group
          key={o.id}
          position={[o.position[0], 0, o.position[1]]}
          ref={(g) => { objectRefs.current[o.id] = g }}
        >
          <GardenObject id={o.id} />
        </group>
      ))}

      <PointingHand target={handTarget} />
    </group>
  )
}

function PointingHand({ target }: { target: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const k = Math.min(1, dt * 4)
    g.position.lerp(target, k)
    g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.012
    g.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.06
  })
  const skin = '#f2c89b'
  return (
    <group ref={group} position={[0, 3, 0]} scale={0.85}>
      {/* palm */}
      <mesh position={[0.05, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.22]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* extended index finger, pointing down */}
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
        <meshStandardMaterial color="#7fb6a4" />
      </mesh>
    </group>
  )
}

function GardenObject({ id }: { id: ObjectId }) {
  switch (id) {
    case 'flower-red': return <Flower color="#e2554c" />
    case 'flower-yellow': return <Flower color="#f5c542" />
    case 'flower-purple': return <Flower color="#9d6fd6" />
    case 'butterfly': return <Butterfly />
    case 'tree': return <Tree />
    case 'bird': return <Bird />
    case 'mushroom': return <Mushroom />
    case 'bee': return <Bee />
  }
}

function Flower({ color }: { color: string }) {
  // petal ring faces the camera so the flower reads as a flower, not a donut
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2
    return [Math.cos(a) * 0.2, 0.85 + Math.sin(a) * 0.2, 0] as const
  })
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.8]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      <mesh position={[0.12, 0.35, 0]} scale={[1, 0.4, 0.5]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
      {petals.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} scale={[1, 1, 0.55]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0.1]} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f7e06b" />
      </mesh>
    </group>
  )
}

function Tree() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 1.2]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.75, 16, 16]} />
        <meshStandardMaterial color="#6aa84f" />
      </mesh>
      <mesh position={[0.5, 1.45, 0.15]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#7cb45e" />
      </mesh>
      <mesh position={[-0.5, 1.5, -0.1]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#5d9b53" />
      </mesh>
    </group>
  )
}

function Mushroom() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 0.5]} />
        <meshStandardMaterial color="#f3e7d3" />
      </mesh>
      <mesh position={[0, 0.55, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#d8574a" />
      </mesh>
      {[[-0.2, 0.62, 0.25], [0.22, 0.66, 0.1], [0, 0.6, -0.3]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#fdf6ec" />
        </mesh>
      ))}
    </group>
  )
}

function Bird() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} scale={[1, 0.9, 1.25]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#6fa8dc" />
      </mesh>
      <mesh position={[0, 0.55, 0.16]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#7eb6e8" />
      </mesh>
      <mesh position={[0, 0.54, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.14, 8]} />
        <meshStandardMaterial color="#f2a14b" />
      </mesh>
      <mesh position={[0.08, 0.6, 0.24]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2c2a3a" />
      </mesh>
      <mesh position={[-0.08, 0.6, 0.24]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2c2a3a" />
      </mesh>
      <mesh position={[0, 0.34, -0.3]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.1, 0.04, 0.22]} />
        <meshStandardMaterial color="#5b8fc4" />
      </mesh>
    </group>
  )
}

function Butterfly() {
  const wingL = useRef<THREE.Group>(null)
  const wingR = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame((state) => {
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
      <group ref={wingL}>
        <mesh position={[-0.2, 0.05, 0]} rotation={[-Math.PI / 2.2, 0, 0]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color="#7ec8e3" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={wingR}>
        <mesh position={[0.2, 0.05, 0]} rotation={[-Math.PI / 2.2, 0, 0]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color="#7ec8e3" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function Bee() {
  const body = useRef<THREE.Group>(null)
  useFrame((state) => {
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
      <mesh position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.135, 0.035, 8, 16]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={0.9}>
        <torusGeometry args={[0.135, 0.035, 8, 16]} />
        <meshStandardMaterial color="#3a3548" />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2.5, 0, 0]}>
        <circleGeometry args={[0.12, 12]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Cloud({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      {[[-0.6, 0, 0.5], [0, 0.18, 0.7], [0.65, 0, 0.55]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0]} scale={[1.4, 0.8, 1]}>
          <sphereGeometry args={[p[2], 14, 14]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}
