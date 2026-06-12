import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { blockY, BLOCK_H, type BlockSpec, type Owner } from './logic'

export interface BlockSceneProps {
  placed: BlockSpec[]
  turn: Owner | 'done'
  /** true while the robot arm is reaching down to set its block */
  robotReaching: boolean
}

export function BlockScene(props: BlockSceneProps) {
  return (
    <Canvas camera={{ position: [0, 2.4, 8], fov: 42 }}>
      <color attach="background" args={['#fff3e2']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ placed, turn, robotReaching }: BlockSceneProps) {
  const towerTop = blockY(placed.length - 1) + BLOCK_H / 2 // y of the current top surface
  return (
    <group>
      <CameraRig towerTop={Math.max(towerTop, 0)} />
      {/* table */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[6, 0.5, 3]} />
        <meshStandardMaterial color="#c98a5b" />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[1.4, 0.06, 1.4]} />
        <meshStandardMaterial color="#e8c79c" />
      </mesh>

      {placed.map((b, i) => (
        <Block key={i} spec={b} index={i} fresh={i === placed.length - 1} />
      ))}

      <RobotArm towerTop={Math.max(towerTop, 0)} reaching={robotReaching} active={turn === 'robot'} />
    </group>
  )
}

function CameraRig({ towerTop }: { towerTop: number }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(() => {
    const focusY = Math.max(1, towerTop - 0.6)
    look.current.lerp(new THREE.Vector3(0, focusY, 0), 0.06)
    const camY = focusY + 1.6
    camera.position.y += (camY - camera.position.y) * 0.06
    camera.lookAt(look.current)
  })
  return null
}

function Block({ spec, index, fresh }: { spec: BlockSpec; index: number; fresh: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const drop = useRef(fresh ? 1 : 0) // 1 = just dropped, animates to 0
  const y = blockY(index)
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    if (drop.current > 0) {
      drop.current = Math.max(0, drop.current - dt * 3)
      m.position.y = y + drop.current * 2.2
      const s = 1 + drop.current * 0.1
      m.scale.set(s, 1, s)
    } else {
      m.position.y = y
      m.scale.set(1, 1, 1)
    }
  })
  return (
    <mesh ref={ref} position={[spec.offset, y, 0]}>
      <boxGeometry args={[1.3, BLOCK_H, 1.3]} />
      <meshStandardMaterial color={spec.color} />
    </mesh>
  )
}

function RobotArm({ towerTop, reaching, active }: { towerTop: number; reaching: boolean; active: boolean }) {
  const claw = useRef<THREE.Group>(null)
  const restY = towerTop + 2.6
  useFrame((state) => {
    const g = claw.current
    if (!g) return
    const targetY = reaching ? towerTop + 0.55 : restY
    g.position.y += (targetY - g.position.y) * 0.12
    // gentle idle sway when it is the robot's turn
    g.position.x = 2.4 + (active ? Math.sin(state.clock.elapsedTime * 4) * 0.04 : 0)
  })
  return (
    <group>
      {/* gantry post */}
      <mesh position={[3.1, towerTop + 1.8, 0]}>
        <boxGeometry args={[0.3, towerTop + 5, 0.3]} />
        <meshStandardMaterial color="#8a93a6" />
      </mesh>
      <group ref={claw} position={[2.4, restY, 0]}>
        {/* arm bar */}
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[1.4, 0.18, 0.18]} />
          <meshStandardMaterial color="#aab3c4" metalness={0.3} />
        </mesh>
        {/* claw head */}
        <mesh>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial color="#5b677d" />
        </mesh>
        <mesh position={[-0.22, -0.3, 0]} rotation={[0, 0, reaching ? 0.5 : 0.1]}>
          <boxGeometry args={[0.1, 0.36, 0.4]} />
          <meshStandardMaterial color="#3f4860" />
        </mesh>
        <mesh position={[0.22, -0.3, 0]} rotation={[0, 0, reaching ? -0.5 : -0.1]}>
          <boxGeometry args={[0.1, 0.36, 0.4]} />
          <meshStandardMaterial color="#3f4860" />
        </mesh>
        {/* friendly eye */}
        <mesh position={[0, 0.1, 0.26]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#fff" emissive="#9fe2ff" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  )
}
