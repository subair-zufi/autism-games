import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { slotPosition, type ExhibitId, type Round } from './logic'

const PEDESTAL_H = 1.2
const EXHIBIT_Y = PEDESTAL_H + 0.55

export interface MuseumSceneProps {
  round: Round
  locked: boolean
  disabledIds: ExhibitId[]
  celebrate: number
  onPick: (id: ExhibitId) => void
}

export function MuseumScene(props: MuseumSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 2.2, 6.4], fov: 45 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}
    >
      <color attach="background" args={['#efe9df']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 5]} intensity={0.85} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ round, locked, disabledIds, celebrate, onPick }: MuseumSceneProps) {
  const n = round.visible.length
  const targetIdx = round.visible.indexOf(round.target)
  const [tx, tz] = slotPosition(targetIdx, n)

  return (
    <group>
      {/* floor + back wall for a gallery feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#d8cfc0" />
      </mesh>
      <mesh position={[0, 4, -5]}>
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#e7e0d4" />
      </mesh>

      {round.visible.map((id, i) => {
        const [x, z] = slotPosition(i, n)
        return (
          <Exhibit
            key={id}
            id={id}
            position={[x, 0, z]}
            disabled={locked || disabledIds.includes(id)}
            celebrating={celebrate > 0 && id === round.target}
            onPick={() => onPick(id)}
          />
        )
      })}

      <PointingHand target={new THREE.Vector3(tx, EXHIBIT_Y + 1.15, tz)} />
    </group>
  )
}

function Exhibit({
  id,
  position,
  disabled,
  celebrating,
  onPick,
}: {
  id: ExhibitId
  position: [number, number, number]
  disabled: boolean
  celebrating: boolean
  onPick: () => void
}) {
  const model = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const wob = useRef(99)

  useEffect(() => {
    if (celebrating) wob.current = 0
  }, [celebrating])

  useFrame((state, dt) => {
    const g = model.current
    if (!g) return
    g.rotation.y += dt * 0.4
    let scale = hover && !disabled ? 1.12 : 1
    if (wob.current < 1) {
      wob.current += dt
      const fade = 1 - wob.current
      scale += Math.sin(wob.current * 14) * 0.18 * fade
      g.position.y = EXHIBIT_Y + Math.abs(Math.sin(wob.current * 10)) * 0.25 * fade
    } else {
      g.position.y = EXHIBIT_Y + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.04
    }
    g.scale.setScalar(scale)
  })

  return (
    <group position={position}>
      {/* pedestal */}
      <mesh position={[0, PEDESTAL_H / 2, 0]}>
        <cylinderGeometry args={[0.42, 0.5, PEDESTAL_H, 20]} />
        <meshStandardMaterial color="#bcae98" />
      </mesh>
      <mesh position={[0, PEDESTAL_H + 0.04, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 20]} />
        <meshStandardMaterial color="#cdbfa6" />
      </mesh>

      {/* the exhibit model + a transparent click target around it */}
      <group ref={model} position={[0, EXHIBIT_Y, 0]}>
        <ExhibitModel id={id} />
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
          <boxGeometry args={[1, 1.2, 1]} />
        </mesh>
      </group>
    </group>
  )
}

function ExhibitModel({ id }: { id: ExhibitId }) {
  switch (id) {
    case 'gem':
      return (
        <mesh>
          <octahedronGeometry args={[0.42]} />
          <meshStandardMaterial color="#3fd0e0" emissive="#1f8aa0" emissiveIntensity={0.4} metalness={0.3} roughness={0.2} />
        </mesh>
      )
    case 'crystal':
      return (
        <mesh>
          <cylinderGeometry args={[0.18, 0.32, 0.95, 6]} />
          <meshStandardMaterial color="#b07fe0" emissive="#6f3fa0" emissiveIntensity={0.4} />
        </mesh>
      )
    case 'rocket':
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
            <meshStandardMaterial color="#f1f1f1" />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <coneGeometry args={[0.2, 0.35, 16]} />
            <meshStandardMaterial color="#e2554c" />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <coneGeometry args={[0.26, 0.2, 16]} />
            <meshStandardMaterial color="#f5a623" />
          </mesh>
        </group>
      )
    case 'vase':
      return (
        <group>
          <mesh position={[0, -0.1, 0]}>
            <sphereGeometry args={[0.33, 20, 20]} />
            <meshStandardMaterial color="#c97b4a" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.3, 16]} />
            <meshStandardMaterial color="#b86c3d" />
          </mesh>
        </group>
      )
    case 'mask':
      return (
        <group>
          <mesh scale={[1, 1.25, 0.4]}>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color="#d4af37" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[-0.12, 0.06, 0.16]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#2e2a3a" />
          </mesh>
          <mesh position={[0.12, 0.06, 0.16]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#2e2a3a" />
          </mesh>
        </group>
      )
    case 'dino':
      return (
        <group>
          <mesh position={[0, -0.1, 0]} scale={[1.2, 0.8, 0.8]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#6aa84f" />
          </mesh>
          <mesh position={[0.18, 0.22, 0.05]} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.08, 0.1, 0.5, 12]} />
            <meshStandardMaterial color="#6aa84f" />
          </mesh>
          <mesh position={[0.3, 0.42, 0.05]}>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshStandardMaterial color="#7cb45e" />
          </mesh>
          <mesh position={[-0.3, 0.0, 0.0]} rotation={[0, 0, 0.6]}>
            <coneGeometry args={[0.1, 0.4, 12]} />
            <meshStandardMaterial color="#5d9b53" />
          </mesh>
        </group>
      )
  }
}

function PointingHand({ target }: { target: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    g.position.lerp(target, Math.min(1, dt * 4))
    g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.02
    g.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.06
  })
  const skin = '#f2c89b'
  return (
    <group ref={group} position={[0, 4, 0]} scale={0.8}>
      <mesh position={[0.05, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.22]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[-0.14, 0.12, 0]}>
        <boxGeometry args={[0.16, 0.5, 0.18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0.13, 0.26, 0]}>
        <boxGeometry args={[0.32, 0.24, 0.23]} />
        <meshStandardMaterial color="#e8b888" />
      </mesh>
      <mesh position={[0.34, 0.62, 0]} rotation={[0, 0, 0.55]}>
        <boxGeometry args={[0.14, 0.32, 0.16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0.05, 0.92, 0]}>
        <boxGeometry args={[0.56, 0.2, 0.28]} />
        <meshStandardMaterial color="#7f8fb6" />
      </mesh>
    </group>
  )
}
