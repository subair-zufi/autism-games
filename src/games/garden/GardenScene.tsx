import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GARDEN_OBJECTS, type CueMode, type ObjectId } from './logic'
import { GardenObject } from './objects'

/** y the hand hovers at, per object (just above its top) */
const HOVER_Y: Record<ObjectId, number> = {
  'flower-red': 1.55,
  'flower-yellow': 1.55,
  'flower-purple': 1.55,
  butterfly: 2.35,
  tree: 2.85,
  bird: 1.25,
  mushroom: 1.4,
  bee: 2.0,
}

/** y the distal hand aims at, per object (its visual centre) */
const AIM_Y: Record<ObjectId, number> = {
  'flower-red': 0.9,
  'flower-yellow': 0.9,
  'flower-purple': 0.9,
  butterfly: 1.5,
  tree: 1.9,
  bird: 0.4,
  mushroom: 0.5,
  bee: 1.2,
}

export interface GardenSceneProps {
  target: ObjectId
  celebrate: number
  /** joint-attention cue level: pulse = highlighted point, hover = plain point, distal = point from afar */
  cue: CueMode
  onPick: (id: ObjectId) => void
  /** fired once per round, the moment the pointing cue has settled on the target */
  onCueReady: () => void
}

export function GardenScene(props: GardenSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 3.2, 7.5], fov: 42 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
    >
      <color attach="background" args={['#bde3ff']} />
      <fog attach="fog" args={['#cfeaff', 16, 38]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ target, celebrate, cue, onPick, onCueReady }: GardenSceneProps) {
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
  const hoverPoint = new THREE.Vector3(meta.position[0], HOVER_Y[target], meta.position[1])
  const aimPoint = new THREE.Vector3(meta.position[0], AIM_Y[target], meta.position[1])

  return (
    <group>
      <Environment />

      {cue === 'pulse' && <TargetRing x={meta.position[0]} z={meta.position[1]} />}

      {GARDEN_OBJECTS.map((o) => (
        <group
          key={o.id}
          position={[o.position[0], 0, o.position[1]]}
          onClick={(e) => {
            e.stopPropagation()
            onPick(o.id)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
          }}
          ref={(g) => {
            objectRefs.current[o.id] = g
            // every solid part of every object drops a real shadow on the grass
            g?.traverse((node) => {
              const mesh = node as THREE.Mesh
              if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) {
                mesh.castShadow = true
              }
            })
          }}
        >
          <GardenObject id={o.id} />
        </group>
      ))}

      {cue === 'gaze' ? (
        <GazingHead cueKey={target} aimPoint={aimPoint} onSettled={onCueReady} />
      ) : (
        <PointingHand
          mode={cue === 'distal' ? 'distal' : 'hover'}
          cueKey={target}
          hoverPoint={hoverPoint}
          aimPoint={aimPoint}
          onSettled={onCueReady}
        />
      )}
    </group>
  )
}

/** where the gazing helper floats: above the fence line, facing the child */
const GAZE_POS = new THREE.Vector3(0, 2.3, -3.2)
const GAZE_UP = new THREE.Vector3(0, 1, 0)
const gazeM = new THREE.Matrix4()
const gazeQ = new THREE.Quaternion()

/**
 * The thinnest rung of the prompt ladder: no hand, no point — just a friendly
 * face across the garden turning to *look* at the target. The child must
 * follow head/gaze orientation alone, the way real-world cue fading ends at
 * gaze. Fires `onSettled` once the head's turn has landed on the target.
 */
function GazingHead({
  cueKey,
  aimPoint,
  onSettled,
}: {
  cueKey: ObjectId
  aimPoint: THREE.Vector3
  onSettled: () => void
}) {
  const head = useRef<THREE.Group>(null)
  const settled = useRef(false)
  // keep the latest callback without re-subscribing the frame loop
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    settled.current = false
  }, [cueKey])

  useFrame((state, dt) => {
    const g = head.current
    if (!g) return
    const k = Math.min(1, dt * 3)
    // face model is built looking down +z (toward the camera/child), so this
    // orients the face toward whichever object is the target
    gazeM.lookAt(aimPoint, GAZE_POS, GAZE_UP)
    gazeQ.setFromRotationMatrix(gazeM)
    g.quaternion.slerp(gazeQ, k)
    // local bob around the parent's anchor, not an absolute height
    g.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.03
    if (!settled.current && g.quaternion.angleTo(gazeQ) < 0.1) {
      settled.current = true
      onSettledRef.current()
    }
  })

  const skin = '#f2c89b'
  return (
    <group position={GAZE_POS.toArray()}>
      <group ref={head}>
        {/* head */}
        <mesh>
          <sphereGeometry args={[0.42, 20, 20]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.16, -0.06]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.45, 20, 20]} />
          <meshStandardMaterial color="#4a3320" />
        </mesh>
        {/* eyes: whites + pupils on the +z face — they travel with the turn */}
        {[-0.15, 0.15].map((ex) => (
          <group key={ex} position={[ex, 0.04, 0.36]}>
            <mesh scale={[1, 1.25, 0.5]}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <sphereGeometry args={[0.042, 10, 10]} />
              <meshStandardMaterial color="#2b2620" />
            </mesh>
          </group>
        ))}
        {/* smile (arc flipped downward) */}
        <mesh position={[0, -0.13, 0.38]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.09, 0.022, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#9a5b4a" />
        </mesh>
      </group>
      {/* shoulders — same cuff colour as the pointing hand, so the gaze tier
          reads as the same helper with the pointing faded away */}
      <mesh position={[0, -0.55, 0]} scale={[1.5, 0.8, 0.9]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshStandardMaterial color="#7fb6a4" />
      </mesh>
    </group>
  )
}

/** Soft pulsing ring under the target — the extra prompt used on easy. */
function TargetRing({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12
    m.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.55, 0.72, 32]} />
      <meshBasicMaterial color="#ffd95e" transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** where the distal hand floats: high above the garden centre, clear of every object */
const DISTAL_POS = new THREE.Vector3(0, 3.0, 2.0)
const DOWN = new THREE.Vector3(0, -1, 0)
const distalBase = new THREE.Vector3()

function PointingHand({
  mode,
  cueKey,
  hoverPoint,
  aimPoint,
  onSettled,
}: {
  mode: 'hover' | 'distal'
  cueKey: ObjectId
  hoverPoint: THREE.Vector3
  aimPoint: THREE.Vector3
  onSettled: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const settled = useRef(false)
  // keep the latest callback without re-subscribing the frame loop
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    settled.current = false
  }, [cueKey, mode])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const k = Math.min(1, dt * 4)
    if (mode === 'hover') {
      g.position.lerp(hoverPoint, k)
      g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.012
      g.rotation.set(0, 0, Math.sin(state.clock.elapsedTime * 1.5) * 0.06)
      if (!settled.current && g.position.distanceTo(hoverPoint) < 0.25) {
        settled.current = true
        onSettledRef.current()
      }
    } else {
      // drift a little toward the target's side, the way a real arm shifts when pointing
      distalBase.set(aimPoint.x * 0.35, DISTAL_POS.y, DISTAL_POS.z)
      g.position.lerp(distalBase, k)
      g.position.y += Math.sin(state.clock.elapsedTime * 3) * 0.012
      const dir = aimPoint.clone().sub(g.position).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(DOWN, dir)
      g.quaternion.slerp(q, k)
      if (!settled.current && g.position.distanceTo(distalBase) < 0.25 && g.quaternion.angleTo(q) < 0.12) {
        settled.current = true
        onSettledRef.current()
      }
    }
  })

  const skin = '#f2c89b'
  const distal = mode === 'distal'
  return (
    <group
      ref={group}
      position={distal ? DISTAL_POS.toArray() : [0, 3, 0]}
      scale={distal ? 0.6 : 0.85}
    >
      {/* palm */}
      <mesh position={[0.05, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.55, 0.22]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* extended index finger, pointing down (rotated toward the target in distal mode) */}
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

/* ------------------------------------------------------------------ */
/* Environment: ground, path, fence, bushes, hills, sun, clouds       */
/* ------------------------------------------------------------------ */

const GRASS_TUFTS: [number, number][] = [
  [-3.4, 0.2], [-1.2, 1.6], [0.9, 1.7], [2.2, 1.4], [3.3, 0.3],
  [-2, -0.2], [2, -1.8], [-3.6, -2.4], [3.6, -2.2], [0.2, -2.1],
  [-4.5, 1.8], [4.4, 1.6], [-1.5, -2.6], [1.6, 2.6],
]

const ROCKS: [number, number, number][] = [
  [-1.3, 2.9, 0.16], [1.5, 3.1, 0.13], [-4.6, -0.6, 0.2], [4.7, -1.2, 0.17],
]

function Environment() {
  return (
    <group>
      {/* meadow ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 44]} />
        <meshStandardMaterial color="#b7d9a2" />
      </mesh>
      {/* lighter garden bed the objects stand on */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[5.2, 40]} />
        <meshStandardMaterial color="#c8e6ad" />
      </mesh>
      {/* sandy path walking into the garden */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 5]}>
        <planeGeometry args={[1.9, 5.5]} />
        <meshStandardMaterial color="#e3cda4" />
      </mesh>

      <Fence />

      {/* bushes tucked behind the fence corners */}
      <Bush x={-6.5} z={-3.2} s={1.15} />
      <Bush x={6.3} z={-3} s={1} />
      <Bush x={-4.9} z={-3.4} s={0.75} />
      <Bush x={4.7} z={-3.5} s={0.8} />

      {/* rolling hills on the horizon */}
      <mesh position={[-7, -0.4, -13]} scale={[4.5, 1.4, 1.5]}>
        <sphereGeometry args={[2, 20, 20]} />
        <meshStandardMaterial color="#9ccb82" />
      </mesh>
      <mesh position={[6, -0.4, -14]} scale={[5, 1.7, 1.5]}>
        <sphereGeometry args={[2, 20, 20]} />
        <meshStandardMaterial color="#8fc175" />
      </mesh>
      <mesh position={[0, -0.4, -16]} scale={[6, 1.2, 1.5]}>
        <sphereGeometry args={[2, 20, 20]} />
        <meshStandardMaterial color="#a5d18c" />
      </mesh>

      {/* sun, kept out of the fog so it stays bright */}
      <mesh position={[-6.5, 3.4, -14]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color="#ffd95e" fog={false} />
      </mesh>

      <Cloud x={-3.5} y={3.9} z={-8} />
      <Cloud x={4} y={4.1} z={-9} />
      <Cloud x={0.5} y={4.5} z={-11} />

      {GRASS_TUFTS.map(([x, z], i) => (
        <GrassTuft key={i} x={x} z={z} />
      ))}

      {ROCKS.map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.4, z]} scale={[1.3, 0.7, 1]} receiveShadow>
          <sphereGeometry args={[r, 12, 12]} />
          <meshStandardMaterial color="#b9b4ab" />
        </mesh>
      ))}
    </group>
  )
}

function Fence() {
  const pickets = Array.from({ length: 29 }, (_, i) => -8.4 + i * 0.6)
  return (
    <group position={[0, 0, -3.8]}>
      {pickets.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.13, 0.9, 0.06]} />
            <meshStandardMaterial color="#f7f3ea" />
          </mesh>
          {/* pointed picket top */}
          <mesh position={[0, 0.94, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.1, 0.1, 0.055]} />
            <meshStandardMaterial color="#f7f3ea" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.64, 0.02]}>
        <boxGeometry args={[17.4, 0.09, 0.05]} />
        <meshStandardMaterial color="#efe9dc" />
      </mesh>
      <mesh position={[0, 0.3, 0.02]}>
        <boxGeometry args={[17.4, 0.09, 0.05]} />
        <meshStandardMaterial color="#efe9dc" />
      </mesh>
    </group>
  )
}

function Bush({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      {[[-0.45, 0.35, 0, 0.5], [0.4, 0.4, 0.1, 0.55], [0, 0.55, -0.1, 0.6]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} castShadow>
          <sphereGeometry args={[p[3], 14, 14]} />
          <meshStandardMaterial color={i === 1 ? '#4f8747' : '#588f4c'} />
        </mesh>
      ))}
    </group>
  )
}

function GrassTuft({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[-0.05, 0.09, 0]} rotation={[0, 0, 0.15]}>
        <coneGeometry args={[0.035, 0.22, 6]} />
        <meshStandardMaterial color="#8fbf6f" />
      </mesh>
      <mesh position={[0.05, 0.11, 0.02]} rotation={[0, 0, -0.18]}>
        <coneGeometry args={[0.035, 0.26, 6]} />
        <meshStandardMaterial color="#7fb262" />
      </mesh>
      <mesh position={[0, 0.08, -0.03]} rotation={[0.12, 0, 0]}>
        <coneGeometry args={[0.03, 0.18, 6]} />
        <meshStandardMaterial color="#9bc97c" />
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
          {/* basic material: clouds stay white instead of shading grey underneath */}
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}
