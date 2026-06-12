import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FINDS, findMeta, type FindId } from './logic'

export interface ShareSceneProps {
  shared: FindId[]
  /** the find most recently shared, which the robot looks at */
  lastShared: FindId | null
  onShare: (id: FindId) => void
}

export function ShareScene(props: ShareSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3.4, 7.8], fov: 46 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
    >
      <color attach="background" args={['#d4ecf7']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 7, 5]} intensity={0.9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ shared, lastShared, onShare }: ShareSceneProps) {
  return (
    <group>
      {/* meadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#aedb8f" />
      </mesh>

      {FINDS.map((f) => (
        <Find
          key={f.id}
          id={f.id}
          position={[f.position[0], 0, f.position[1]]}
          shared={shared.includes(f.id)}
          justShared={lastShared === f.id}
          onShare={() => onShare(f.id)}
        />
      ))}

      <RobotFace lastShared={lastShared} />
    </group>
  )
}

function RobotFace({ lastShared }: { lastShared: FindId | null }) {
  const group = useRef<THREE.Group>(null)
  const eyes = useRef<(THREE.Mesh | null)[]>([null, null])
  const excite = useRef(99)
  const prev = useRef<FindId | null>(null)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    if (lastShared !== prev.current) {
      prev.current = lastShared
      if (lastShared) excite.current = 0
    }
    g.position.y = 2.6 + Math.sin(state.clock.elapsedTime * 1.5) * 0.06
    // turn to look at the shared object (or back at the child)
    const look = lastShared
      ? new THREE.Vector3(findMeta(lastShared).position[0], 0.6, findMeta(lastShared).position[1])
      : new THREE.Vector3(0, 2.6, 10)
    const target = new THREE.Vector3().copy(look).sub(g.position)
    const yaw = Math.atan2(target.x, target.z)
    g.rotation.y += (yaw - g.rotation.y) * Math.min(1, dt * 5)
    // excited bounce + eye widen after a share
    let eyeScale = 1
    if (excite.current < 1) {
      excite.current += dt
      const fade = 1 - excite.current
      g.position.y += Math.abs(Math.sin(excite.current * 12)) * 0.18 * fade
      eyeScale = 1 + 0.5 * fade
    }
    for (const e of eyes.current) e?.scale.setScalar(eyeScale)
  })

  return (
    <group ref={group} position={[4.6, 2.6, -3]}>
      {/* face panel */}
      <mesh>
        <boxGeometry args={[1.2, 1, 0.18]} />
        <meshStandardMaterial color="#a8bad4" />
      </mesh>
      {([-0.26, 0.26] as const).map((x, i) => (
        <mesh key={x} position={[x, 0.14, 0.12]} ref={(m) => { eyes.current[i] = m }}>
          <sphereGeometry args={[0.13, 14, 14]} />
          <meshStandardMaterial color="#fff" emissive="#9fe2ff" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* smile */}
      <mesh position={[0, -0.2, 0.12]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.18, 0.04, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#3a4458" emissive="#62d2ff" emissiveIntensity={0.4} />
      </mesh>
      {/* antenna */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#6b7a94" />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#ffd24a" emissive="#f5a623" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function Find({
  id,
  position,
  shared,
  justShared,
  onShare,
}: {
  id: FindId
  position: [number, number, number]
  shared: boolean
  justShared: boolean
  onShare: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = justShared ? 1.25 : hover && !shared ? 1.12 : 1
    g.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, dt * 8))
    if (justShared) g.rotation.y += dt * 2
  })

  return (
    <group position={position}>
      <group ref={group}>
        <FindModel id={id} />
        <mesh
          visible={false}
          position={[0, 0.8, 0]}
          onClick={(e) => {
            e.stopPropagation()
            if (!shared) onShare()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            if (!shared) document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = 'auto'
          }}
        >
          <boxGeometry args={[1.3, 1.8, 1.3]} />
        </mesh>
      </group>
      {/* star marker over finds already shared */}
      {shared && (
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial color="#ffd24a" emissive="#f5c542" emissiveIntensity={1} />
        </mesh>
      )}
    </group>
  )
}

const RAINBOW_BANDS = ['#e2554c', '#f5a623', '#f5e042', '#7ac74f', '#5aa9e6', '#9d6fd6']

function FindModel({ id }: { id: FindId }) {
  switch (id) {
    case 'rainbow':
      return (
        <group position={[0, 0, 0]}>
          {RAINBOW_BANDS.map((c, i) => (
            <mesh key={c} position={[0, 0.2, 0]} rotation={[0, 0.4, 0]}>
              <torusGeometry args={[1.1 - i * 0.09, 0.045, 8, 24, Math.PI]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
        </group>
      )
    case 'balloon':
      return (
        <group>
          <mesh position={[0, 1.5, 0]} scale={[1, 1.2, 1]}>
            <sphereGeometry args={[0.32, 18, 18]} />
            <meshStandardMaterial color="#e2554c" />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.4, 6]} />
            <meshStandardMaterial color="#8a8a8a" />
          </mesh>
        </group>
      )
    case 'frog':
      return (
        <group>
          <mesh position={[0, 0.25, 0]} scale={[1.15, 0.85, 1]}>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial color="#6aa84f" />
          </mesh>
          {([-0.13, 0.13] as const).map((x) => (
            <group key={x}>
              <mesh position={[x, 0.5, 0.1]}>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshStandardMaterial color="#7cb45e" />
              </mesh>
              <mesh position={[x, 0.52, 0.17]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial color="#2c2a3a" />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'snail':
      return (
        <group>
          <mesh position={[0, 0.12, 0.15]} scale={[0.8, 0.5, 1.4]}>
            <sphereGeometry args={[0.18, 14, 14]} />
            <meshStandardMaterial color="#d8b46a" />
          </mesh>
          <mesh position={[0, 0.35, -0.05]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.16, 0.1, 10, 20]} />
            <meshStandardMaterial color="#b06d3c" />
          </mesh>
          <mesh position={[0, 0.42, 0.42]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#d8b46a" />
          </mesh>
        </group>
      )
    case 'duck':
      return (
        <group>
          <mesh position={[0, 0.28, 0]} scale={[1, 0.9, 1.25]}>
            <sphereGeometry args={[0.26, 16, 16]} />
            <meshStandardMaterial color="#f5d142" />
          </mesh>
          <mesh position={[0, 0.55, 0.18]}>
            <sphereGeometry args={[0.15, 14, 14]} />
            <meshStandardMaterial color="#f5dc6b" />
          </mesh>
          <mesh position={[0, 0.53, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.06, 0.16, 8]} />
            <meshStandardMaterial color="#f2902a" />
          </mesh>
          <mesh position={[0.07, 0.6, 0.26]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#2c2a3a" />
          </mesh>
          <mesh position={[-0.07, 0.6, 0.26]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#2c2a3a" />
          </mesh>
        </group>
      )
    case 'sunflower':
      return (
        <group>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 1.2, 8]} />
            <meshStandardMaterial color="#5d9b53" />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.26, 1.25 + Math.sin(a) * 0.26, 0]} scale={[1, 1, 0.4]}>
                <sphereGeometry args={[0.12, 10, 10]} />
                <meshStandardMaterial color="#f5c542" />
              </mesh>
            )
          })}
          <mesh position={[0, 1.25, 0.08]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.17, 12, 12]} />
            <meshStandardMaterial color="#7a4f2a" />
          </mesh>
        </group>
      )
    case 'kite':
      return (
        <group position={[0, 1.7, 0]} rotation={[0, 0.5, 0.2]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.55, 0.55]} />
            <meshStandardMaterial color="#9d6fd6" side={THREE.DoubleSide} />
          </mesh>
          {[-0.25, -0.45, -0.65].map((y, i) => (
            <mesh key={i} position={[i % 2 ? 0.08 : -0.08, y - 0.3, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={i % 2 ? '#f5c542' : '#e2554c'} />
            </mesh>
          ))}
        </group>
      )
    case 'ladybug':
      return (
        <group>
          <mesh position={[0, 0.14, 0]} scale={[1, 0.6, 1.2]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#d8352a" />
          </mesh>
          <mesh position={[0, 0.18, 0.22]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#2c2a3a" />
          </mesh>
          {[[-0.1, 0.05], [0.1, 0.02], [0, -0.12]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.26, z]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#2c2a3a" />
            </mesh>
          ))}
        </group>
      )
  }
}
