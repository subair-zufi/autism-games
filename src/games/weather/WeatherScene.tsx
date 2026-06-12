import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ZONES, zonePosition, type WeatherId } from './logic'

const ORB_HOME = new THREE.Vector3(0, 0.6, 3.2)
const ZONE_Y = 1.7 // height the clouds float at

export interface WeatherSceneProps {
  /** zone the orb is flying to, or null when resting in front of the child */
  thrownAt: WeatherId | null
  /** increments on a correct throw so the target zone celebrates */
  celebrate: number
  locked: boolean
  onPick: (id: WeatherId) => void
}

export function WeatherScene(props: WeatherSceneProps) {
  return (
    <Canvas camera={{ position: [0, 1.9, 6.6], fov: 46 }} onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}>
      <color attach="background" args={['#dceefb']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={0.85} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ thrownAt, celebrate, locked, onPick }: WeatherSceneProps) {
  return (
    <group>
      {/* park ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#b9dba2" />
      </mesh>
      {/* path the orb sits on */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 2.6]}>
        <circleGeometry args={[1.1, 24]} />
        <meshStandardMaterial color="#e3d6b8" />
      </mesh>

      {ZONES.map((z, i) => {
        const [x, zz] = zonePosition(i)
        return (
          <WeatherZone
            key={z.id}
            id={z.id}
            position={[x, 0, zz]}
            celebrating={celebrate > 0 && thrownAt === z.id}
            disabled={locked}
            onPick={() => onPick(z.id)}
          />
        )
      })}

      <Orb thrownAt={thrownAt} />
    </group>
  )
}

function Orb({ thrownAt }: { thrownAt: WeatherId | null }) {
  const ref = useRef<THREE.Mesh>(null)
  const progress = useRef(0)
  const lastTarget = useRef<WeatherId | null>(null)

  useFrame((state, dt) => {
    const m = ref.current
    if (!m) return
    if (thrownAt !== lastTarget.current) {
      lastTarget.current = thrownAt
      progress.current = 0
    }
    if (thrownAt) {
      const i = ZONES.findIndex((z) => z.id === thrownAt)
      const [x, z] = zonePosition(i)
      progress.current = Math.min(1, progress.current + dt * 1.6)
      const t = progress.current
      // ballistic arc from home to the zone
      m.position.lerpVectors(ORB_HOME, new THREE.Vector3(x, ZONE_Y, z), t)
      m.position.y += Math.sin(t * Math.PI) * 1.4
    } else {
      progress.current = 0
      m.position.copy(ORB_HOME)
      m.position.y += Math.sin(state.clock.elapsedTime * 2.2) * 0.08
    }
  })

  return (
    <mesh ref={ref} position={ORB_HOME}>
      <sphereGeometry args={[0.26, 20, 20]} />
      <meshStandardMaterial color="#fff1b8" emissive="#f5c542" emissiveIntensity={0.8} />
    </mesh>
  )
}

function WeatherZone({
  id,
  position,
  celebrating,
  disabled,
  onPick,
}: {
  id: WeatherId
  position: [number, number, number]
  celebrating: boolean
  disabled: boolean
  onPick: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    g.position.y = ZONE_Y + Math.sin(state.clock.elapsedTime * 1.4 + position[0]) * 0.06
    const target = celebrating ? 1.3 : hover && !disabled ? 1.12 : 1
    g.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, dt * 8))
    if (celebrating) g.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.1
    else g.rotation.z = 0
  })

  return (
    <group position={position}>
      {/* landing pad so each zone reads as a place */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.85, 24]} />
        <meshStandardMaterial color={hover && !disabled ? '#f2eeda' : '#d6e6c4'} />
      </mesh>

      <group ref={group} position={[0, ZONE_Y, 0]}>
        <ZoneModel id={id} />
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
          <boxGeometry args={[1.5, 1.5, 1]} />
        </mesh>
      </group>
    </group>
  )
}

function CloudPuffs({ color }: { color: string }) {
  return (
    <group>
      {[[-0.4, 0, 0.32], [0, 0.14, 0.42], [0.42, 0, 0.34]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0]} scale={[1.3, 0.9, 1]}>
          <sphereGeometry args={[p[2], 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

function ZoneModel({ id }: { id: WeatherId }) {
  switch (id) {
    case 'sunny':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.42, 20, 20]} />
            <meshStandardMaterial color="#f5c542" emissive="#f5a623" emissiveIntensity={0.5} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.22, 0.07, 0.07]} />
                <meshStandardMaterial color="#f5c542" emissive="#f5a623" emissiveIntensity={0.4} />
              </mesh>
            )
          })}
        </group>
      )
    case 'rainy':
      return (
        <group>
          <CloudPuffs color="#cfd8e6" />
          {[[-0.3, -0.45], [0, -0.6], [0.3, -0.45]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0]}>
              <sphereGeometry args={[0.06, 10, 10]} />
              <meshStandardMaterial color="#6f9fd8" />
            </mesh>
          ))}
        </group>
      )
    case 'stormy':
      return (
        <group>
          <CloudPuffs color="#8d86a8" />
          {/* lightning bolt */}
          <mesh position={[0, -0.5, 0]} rotation={[0, 0, 0.35]}>
            <boxGeometry args={[0.1, 0.4, 0.06]} />
            <meshStandardMaterial color="#ffe66b" emissive="#f5d142" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.12, -0.78, 0]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.1, 0.36, 0.06]} />
            <meshStandardMaterial color="#ffe66b" emissive="#f5d142" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )
    case 'snowy':
      return (
        <group>
          <CloudPuffs color="#e8eef5" />
          {[[-0.32, -0.45], [0.02, -0.62], [0.32, -0.42], [-0.05, -0.4]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      )
  }
}
