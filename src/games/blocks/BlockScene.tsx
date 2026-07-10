import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { blockY, BLOCK_H, TOWER_MAX, type TurnSpec, type Player } from './logic'

/** Hard mode: the child places blocks by physically grabbing them. */
export interface GrabControls {
  /** the child's upcoming block (color/offset); null once the game is over */
  spec: TurnSpec | null
  /** true only on the child's own turn (not while waiting or handing off) */
  canGrab: boolean
  onPlace: () => void
  onIllegal: () => void
}

export interface BlockSceneProps {
  placed: TurnSpec[]
  players: Player[]
  activeIndex: number
  reaching: boolean
  /** true while a peer builds and the child is up next — pulse the child avatar */
  childNext?: boolean
  /** present on hard difficulty: place by grab-and-drop instead of a button */
  grab?: GrabControls | null
}

export function BlockScene(props: BlockSceneProps) {
  return (
    <Canvas camera={{ position: [0, 2.4, 8], fov: 42 }}>
      <color attach="background" args={['#fff3e2']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 4]} intensity={0.9} />
      {/* soft fill from the front so the kids' faces read clearly */}
      <directionalLight position={[0, 3, 7]} intensity={0.35} />
      <SceneInner {...props} />
    </Canvas>
  )
}

/**
 * Where the peers stand, by peer count. Slots keep everyone clear of the
 * occlusion shadow directly behind the tower (|x| < ~1) so no kid ever
 * disappears behind the stack: back row first, then the table corners.
 */
const PEER_SLOTS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[1.5, -2.0]],
  2: [[-1.5, -2.0], [1.5, -2.0]],
  3: [[-1.5, -2.0], [1.5, -2.0], [2.6, -1.2]],
  4: [[-1.4, -2.0], [1.4, -2.0], [-2.6, -1.2], [2.6, -1.2]],
}

function SceneInner({ placed, players, activeIndex, reaching, childNext, grab }: BlockSceneProps) {
  // Completed towers are set aside as minis so the active stack stays short
  // and the camera never has to leave the other children out of frame.
  const doneCount = Math.floor(placed.length / TOWER_MAX)
  const current = placed.slice(doneCount * TOWER_MAX)
  const finished: TurnSpec[][] = []
  for (let k = 0; k < doneCount; k++) finished.push(placed.slice(k * TOWER_MAX, (k + 1) * TOWER_MAX))

  const towerTop = current.length ? blockY(current.length - 1) + BLOCK_H / 2 : 0
  // child stands front-left of the tower (never occluding it, always in frame)
  const childX = -1.5

  return (
    <group>
      <CameraRig towerTop={towerTop} />

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#f6e6cd" />
      </mesh>

      {/* table */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[6, 0.5, 3]} />
        <meshStandardMaterial color="#c98a5b" />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[1.4, 0.06, 1.4]} />
        <meshStandardMaterial color="#e8c79c" />
      </mesh>

      {/* active tower */}
      {current.map((spec, i) => (
        <Block key={i} spec={spec} index={i} fresh={i === current.length - 1} />
      ))}

      {/* completed towers, shrunk and lined up along the right edge */}
      {finished.map((specs, k) => (
        <MiniTower key={k} specs={specs} slot={k} />
      ))}

      {/* hard mode: the grabbable block resting beside the child */}
      {grab?.spec && (
        <GrabBlock
          spec={grab.spec}
          canGrab={grab.canGrab}
          targetY={blockY(current.length)}
          homeX={childX + 1.0}
          onPlace={grab.onPlace}
          onIllegal={grab.onIllegal}
        />
      )}

      {/* kid players standing around the table */}
      {players.map((player, i) => {
        const isActive = i === activeIndex
        const [x, z] =
          player.kind === 'child'
            ? [childX, 2.0]
            : PEER_SLOTS[Math.min(players.length - 1, 4)][i - 1]
        return (
          <HumanKid
            key={player.id}
            player={player}
            x={x}
            z={z}
            active={isActive}
            reaching={isActive && reaching}
            anticipating={player.kind === 'child' && !!childNext}
          />
        )
      })}
    </group>
  )
}

/**
 * Frames the active stack while keeping the kids in view: rises with the
 * tower but also pulls back, instead of climbing away from the table.
 */
function CameraRig({ towerTop }: { towerTop: number }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 1, 0))
  useFrame(() => {
    const focusY = Math.max(0.9, towerTop * 0.5)
    look.current.lerp(new THREE.Vector3(0, focusY, 0), 0.06)
    const camY = Math.max(2.4, towerTop * 0.6 + 1.6)
    const camZ = 8 + Math.max(0, towerTop - 1.2) * 0.5
    camera.position.y += (camY - camera.position.y) * 0.06
    camera.position.z += (camZ - camera.position.z) * 0.06
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

/** A finished tower parked along the right edge of the table. */
function MiniTower({ specs, slot }: { specs: TurnSpec[]; slot: number }) {
  return (
    <group position={[2.35, -0.1, 1.1 - slot * 0.4]} scale={0.16}>
      {specs.map((s, i) => (
        <mesh key={i} position={[s.offset, blockY(i), 0]}>
          <boxGeometry args={[1.3, BLOCK_H, 1.3]} />
          <meshStandardMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  )
}

const REST_Y = -0.1 + BLOCK_H / 2 // sitting on the table top

/**
 * Hard mode's block: rests on the table beside the child, bounces gently on
 * their turn, and is dragged onto the ghost slot at the top of the tower.
 * Grabbing it out of turn shakes it and reports an impatient grab.
 */
function GrabBlock({
  spec,
  canGrab,
  targetY,
  homeX,
  onPlace,
  onIllegal,
}: {
  spec: TurnSpec
  canGrab: boolean
  targetY: number
  homeX: number
  onPlace: () => void
  onIllegal: () => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const [dragging, setDragging] = useState(false)
  const pos = useRef(new THREE.Vector3(homeX, REST_Y, 1.05))
  const shake = useRef(0)
  const target = useRef(new THREE.Vector3())
  target.current.set(spec.offset, targetY, 0)
  const home = useRef(new THREE.Vector3())
  home.current.set(homeX, REST_Y, 1.05)

  // Resolve the drop wherever the pointer is released.
  useEffect(() => {
    if (!dragging) return
    const up = () => {
      setDragging(false)
      if (pos.current.distanceTo(target.current) < 0.85) onPlace()
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [dragging]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    const m = ref.current
    if (!m) return
    if (dragging) {
      m.position.copy(pos.current)
    } else {
      pos.current.lerp(home.current, 0.12)
      const bounce = canGrab ? Math.abs(Math.sin(state.clock.elapsedTime * 2.5)) * 0.12 : 0
      m.position.set(pos.current.x, pos.current.y + bounce, pos.current.z)
    }
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt * 3)
      m.position.x += Math.sin(state.clock.elapsedTime * 40) * shake.current * 0.08
    }
    const mat = m.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = canGrab ? 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.15 : 0
  })

  return (
    <>
      <mesh
        ref={ref}
        position={[homeX, REST_Y, 1.05]}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          if (!canGrab) {
            shake.current = 1
            onIllegal()
            return
          }
          pos.current.set(e.point.x, Math.max(REST_Y, e.point.y), 0)
          setDragging(true)
        }}
      >
        <boxGeometry args={[1.3, BLOCK_H, 1.3]} />
        <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={0} />
      </mesh>

      {/* ghost slot showing where the block belongs */}
      {canGrab && (
        <mesh position={[spec.offset, targetY, 0]}>
          <boxGeometry args={[1.32, BLOCK_H, 1.32]} />
          <meshBasicMaterial color={spec.color} transparent opacity={0.22} />
        </mesh>
      )}

      {/* invisible drag plane through the tower (z=0) */}
      {dragging && (
        <mesh
          position={[0, 2, 0]}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            pos.current.set(e.point.x, Math.max(0.15, e.point.y), 0)
          }}
        >
          <planeGeometry args={[40, 40]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}

/**
 * A stylized child (~10–15 y/o): legs, shirt, arms, head with hair and a
 * face. Peers stand behind the table facing the child; the child stands in
 * front with their back to the camera. The active kid bobs, glows, and
 * reaches an arm out over the tower to set their block.
 */
function HumanKid({
  player,
  x,
  z,
  active,
  reaching,
  anticipating,
}: {
  player: Player
  x: number
  z: number
  active: boolean
  reaching: boolean
  anticipating: boolean
}) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const shirtMat = useRef<THREE.MeshStandardMaterial>(null)
  const look = player.look
  // everyone turns toward the tower at the center of the table
  const facing = Math.atan2(-x, -z)
  const baseY = -0.6 // feet on the floor
  const phase = x * 1.7

  useFrame((state) => {
    const grp = g.current
    if (!grp) return
    const t = state.clock.elapsedTime
    const targetScale = active ? 1.08 : anticipating ? 1.05 : 1
    grp.scale.setScalar(grp.scale.x + (targetScale - grp.scale.x) * 0.1)
    // gentle bob when it's this kid's turn
    const bob = active ? Math.abs(Math.sin(t * 3)) * 0.05 : 0
    grp.position.y += (baseY + bob - grp.position.y) * 0.1

    const b = body.current
    if (b) {
      // idle sway + lean in over the table while placing
      b.rotation.y = facing + Math.sin(t * 0.9 + phase) * 0.04
      const lean = reaching ? -0.28 : 0
      b.rotation.x += (lean - b.rotation.x) * 0.1
    }
    if (arm.current) {
      const raise = reaching ? -1.45 : Math.sin(t * 1.1 + phase) * 0.06
      arm.current.rotation.x += (raise - arm.current.rotation.x) * 0.12
    }
    if (shirtMat.current) {
      const glow = active ? 0.35 : anticipating ? 0.25 + Math.abs(Math.sin(t * 4)) * 0.3 : 0
      shirtMat.current.emissiveIntensity += (glow - shirtMat.current.emissiveIntensity) * 0.2
    }
  })

  return (
    <group ref={g} position={[x, baseY, z]}>
      <group ref={body}>
        {/* legs + shoes */}
        {[-0.09, 0.09].map((lx) => (
          <group key={lx}>
            <mesh position={[lx, 0.28, 0]}>
              <cylinderGeometry args={[0.065, 0.075, 0.56, 10]} />
              <meshStandardMaterial color={look.pants} />
            </mesh>
            <mesh position={[lx, 0.03, 0.03]}>
              <boxGeometry args={[0.14, 0.07, 0.24]} />
              <meshStandardMaterial color="#494d52" />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.175, 0.34, 6, 14]} />
          <meshStandardMaterial
            ref={shirtMat}
            color={look.shirt}
            emissive={look.shirt}
            emissiveIntensity={0}
          />
        </mesh>
        {/* left arm (resting) */}
        <group position={[-0.25, 1.03, 0]}>
          <mesh position={[0, -0.19, 0]}>
            <cylinderGeometry args={[0.05, 0.045, 0.4, 8]} />
            <meshStandardMaterial color={look.shirt} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
        </group>
        {/* right arm (reaches toward the tower on their turn) */}
        <group ref={arm} position={[0.25, 1.03, 0]}>
          <mesh position={[0, -0.19, 0]}>
            <cylinderGeometry args={[0.05, 0.045, 0.4, 8]} />
            <meshStandardMaterial color={look.shirt} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
        </group>
        {/* head, hair, face */}
        <mesh position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.165, 18, 18]} />
          <meshStandardMaterial color={look.skin} />
        </mesh>
        <mesh position={[0, 1.45, -0.03]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.175, 18, 18]} />
          <meshStandardMaterial color={look.hair} />
        </mesh>
        {look.longHair && (
          <mesh position={[0, 1.27, -0.12]}>
            <boxGeometry args={[0.26, 0.34, 0.1]} />
            <meshStandardMaterial color={look.hair} />
          </mesh>
        )}
        {[-0.06, 0.06].map((ex) => (
          <mesh key={ex} position={[ex, 1.4, 0.145]}>
            <sphereGeometry args={[0.021, 8, 8]} />
            <meshStandardMaterial color="#2b2620" />
          </mesh>
        ))}
        <mesh position={[0, 1.315, 0.152]}>
          <boxGeometry args={[0.07, 0.016, 0.02]} />
          <meshStandardMaterial color="#9a5b4a" />
        </mesh>
      </group>
      {/* name label (kept outside the rotated body so it never mirrors) */}
      <Text position={[0, 1.72, 0]} fontSize={0.19} anchorX="center" anchorY="bottom" color="#333333">
        {player.name}
      </Text>
    </group>
  )
}
