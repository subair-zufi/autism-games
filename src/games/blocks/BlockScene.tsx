import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { blockY, BLOCK_H, type TurnSpec, type Player } from './logic'

export interface BlockSceneProps {
  placed: TurnSpec[]
  players: Player[]
  activeIndex: number
  reaching: boolean
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

function SceneInner({ placed, players, activeIndex, reaching }: BlockSceneProps) {
  const towerTop = blockY(placed.length - 1) + BLOCK_H / 2
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

      {/* stacked tower */}
      {placed.map((spec, i) => (
        <Block key={i} spec={spec} index={i} fresh={i === placed.length - 1} />
      ))}

      {/* player avatars spread along the front of the table */}
      {players.map((player, i) => {
        const isActive = i === activeIndex
        const isReaching = isActive && reaching
        // spread avatars symmetrically around x=0, spaced ~1.4 units apart
        const spread = (players.length - 1) * 0.7
        const x = players.length > 1 ? -spread + i * (spread * 2) / (players.length - 1) : 0
        return (
          <PlayerAvatar
            key={player.id}
            player={player}
            x={x}
            active={isActive}
            reaching={isReaching}
          />
        )
      })}
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

function Block({ spec, index, fresh }: { spec: TurnSpec; index: number; fresh: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const drop = useRef(fresh ? 1 : 0)
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

/**
 * A simple avatar: a sphere body with an emoji label above it.
 * Active player is scaled up and gets an emissive glow.
 * Reaching pose tilts the body forward slightly.
 */
function PlayerAvatar({
  player,
  x,
  active,
  reaching,
}: {
  player: Player
  x: number
  active: boolean
  reaching: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  // child sits at z=1.4 (front of table), peers are behind the tower at z=-1.4
  const z = player.kind === 'child' ? 1.4 : -1.4
  const baseY = 0.05

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const targetScale = active ? 1.25 : 1.0
    const currentScale = g.scale.x
    const newScale = currentScale + (targetScale - currentScale) * 0.1
    g.scale.setScalar(newScale)

    // gentle bob when active
    if (active) {
      g.position.y = baseY + Math.sin(state.clock.elapsedTime * 3) * 0.04
    } else {
      g.position.y += (baseY - g.position.y) * 0.1
    }

    // lean forward when reaching
    const targetRot = reaching ? -0.45 : 0
    g.rotation.x += (targetRot - g.rotation.x) * 0.1
  })

  return (
    <group ref={groupRef} position={[x, baseY, z]}>
      {/* body sphere */}
      <mesh>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial
          color={player.kind === 'child' ? '#f9a84d' : '#7ac9f1'}
          emissive={active ? (player.kind === 'child' ? '#f9a84d' : '#7ac9f1') : '#000000'}
          emissiveIntensity={active ? 0.35 : 0}
        />
      </mesh>
      {/* small head */}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          color={player.kind === 'child' ? '#fbd29a' : '#b8e4f9'}
          emissive={active ? (player.kind === 'child' ? '#fbd29a' : '#b8e4f9') : '#000000'}
          emissiveIntensity={active ? 0.25 : 0}
        />
      </mesh>
      {/* emoji + name label */}
      <Text
        position={[0, 0.72, 0]}
        fontSize={0.22}
        anchorX="center"
        anchorY="bottom"
        color="#333333"
      >
        {player.emoji} {player.name}
      </Text>
    </group>
  )
}
