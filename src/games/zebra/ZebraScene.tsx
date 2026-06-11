import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { carsStopped, type LevelConfig, type LightPhase } from './logic'

const GAP = 6 // spacing between cars on the conveyor
const STOP_X = -3 // car centre rests here, leaving the crossing (±1.3) clear
const CAR_COLORS = ['#e2786b', '#5c9ead', '#6fa86f', '#d9a23e', '#9d8cd6', '#e69ab8']

// where the character stands and where it ends up
const WALK_START_Z = 3.1
const WALK_END_Z = -3.1
const WALK_DURATION = 1.7 // seconds to cross

export interface ZebraSceneProps {
  phase: LightPhase
  level: LevelConfig
  /** bump to send the character across the road */
  walkTrigger: number
  /** bump to shake the character's head ("wait!") */
  shakeTrigger: number
  /** called once the character reaches the far side */
  onCrossed: () => void
}

export function ZebraScene(props: ZebraSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 4, 7.5], fov: 45 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.8, -1.5)}
    >
      <color attach="background" args={['#cfe8f5']} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[5, 8, 4]} intensity={0.9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ phase, level, walkTrigger, shakeTrigger, onCrossed }: ZebraSceneProps) {
  const carGroup = useRef<THREE.Group>(null)
  const character = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)

  // conveyor scroll position and current speed (mutable, frame-driven)
  const conveyor = useRef({ s: 0, v: 0 })
  const walk = useRef({ active: false, t: 0 })
  const shake = useRef({ t: 99 })

  const onCrossedRef = useRef(onCrossed)
  onCrossedRef.current = onCrossed
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const n = level.carCount
  const total = n * GAP
  const half = total / 2

  // start a crossing when the trigger changes
  useEffect(() => {
    if (walkTrigger > 0) walk.current = { active: true, t: 0 }
  }, [walkTrigger])

  // shake the head when the trigger changes
  useEffect(() => {
    if (shakeTrigger > 0) shake.current = { t: 0 }
  }, [shakeTrigger])

  useFrame((state, dt) => {
    const c = conveyor.current
    const stopped = carsStopped(phaseRef.current)

    // ease the conveyor speed toward go/stop, and park aligned so a car always
    // rests on the stop line (keeping the crossing itself clear)
    const targetV = stopped ? 0 : level.carSpeed
    c.v += (targetV - c.v) * Math.min(1, dt * 2.6)
    let ns = c.s + c.v * dt
    if (stopped) {
      const aligned = Math.ceil((c.s - 1e-4) / GAP) * GAP
      if (ns >= aligned || c.v < 0.35) {
        ns = aligned
        c.v = 0
      }
    }
    if (ns >= total) ns -= total
    c.s = ns

    // place each car along the looping conveyor
    if (carGroup.current) {
      carGroup.current.children.forEach((car, k) => {
        const x = mod(STOP_X + k * GAP + c.s + half, total) - half
        car.position.x = x
      })
    }

    // walk the character across
    const ch = character.current
    if (ch) {
      const w = walk.current
      if (w.active) {
        w.t += dt
        const k = Math.min(1, w.t / WALK_DURATION)
        ch.position.z = THREE.MathUtils.lerp(WALK_START_Z, WALK_END_Z, ease(k))
        ch.position.y = Math.abs(Math.sin(w.t * 9)) * 0.12 // little walking bob
        if (k >= 1) {
          w.active = false
          ch.position.set(0, 0, WALK_START_Z) // ready for the next crossing
          onCrossedRef.current()
        }
      } else {
        ch.position.y += (0 - ch.position.y) * Math.min(1, dt * 8)
      }
    }

    // head shake ("wait — the cars haven't stopped")
    const h = head.current
    if (h) {
      const sh = shake.current
      if (sh.t <= 0.7) {
        sh.t += dt
        h.rotation.y = Math.sin(sh.t * 28) * 0.4 * (1 - sh.t / 0.7)
      } else {
        h.rotation.y += (0 - h.rotation.y) * Math.min(1, dt * 10)
      }
    }

    void state
  })

  return (
    <group>
      <Ground />
      <Road />
      <Crossing />
      <TrafficLight phase={phase} />

      <group ref={carGroup}>
        {Array.from({ length: n }, (_, k) => (
          <Car key={k} color={CAR_COLORS[k % CAR_COLORS.length]} />
        ))}
      </group>

      <group ref={character} position={[0, 0, WALK_START_Z]}>
        <Character headRef={head} />
      </group>
    </group>
  )
}

function mod(a: number, m: number) {
  return ((a % m) + m) % m
}

function ease(k: number) {
  // ease-in-out so the walk starts and stops gently
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#bfe0a8" />
    </mesh>
  )
}

function Road() {
  return (
    <group>
      {/* tarmac */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[60, 5]} />
        <meshStandardMaterial color="#6b6f76" />
      </mesh>
      {/* kerbs */}
      <mesh position={[0, 0.06, 2.6]}>
        <boxGeometry args={[60, 0.12, 0.2]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
      <mesh position={[0, 0.06, -2.6]}>
        <boxGeometry args={[60, 0.12, 0.2]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
      {/* stop line, just before the crossing on the approach side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.85, 0.01, 0]}>
        <planeGeometry args={[0.22, 4.6]} />
        <meshStandardMaterial color="#f2f0e8" />
      </mesh>
    </group>
  )
}

function Crossing() {
  const stripes = [-1.6, -0.8, 0, 0.8, 1.6]
  return (
    <group>
      {stripes.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[2.2, 0.45]} />
          <meshStandardMaterial color="#f4f2ea" />
        </mesh>
      ))}
    </group>
  )
}

function TrafficLight({ phase }: { phase: LightPhase }) {
  const ped = useRef<THREE.MeshStandardMaterial>(null)
  // flash the walk light during walk-ending
  useFrame((state) => {
    if (!ped.current) return
    if (phase === 'walk-ending') {
      const on = Math.sin(state.clock.elapsedTime * 9) > 0
      ped.current.color.set(on ? '#6cd07a' : '#23381f')
      ped.current.emissive.set(on ? '#3fa14d' : '#000000')
    }
  })

  const carRed = phase === 'walk' || phase === 'walk-ending'
  const carYellow = phase === 'cars-slow'
  const carGreen = phase === 'cars-go'
  const walkGreen = phase === 'walk'

  return (
    <group position={[3.6, 0, 2.7]}>
      {/* pole */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 2.8]} />
        <meshStandardMaterial color="#454a52" />
      </mesh>
      {/* car signal housing */}
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[0.42, 1.05, 0.3]} />
        <meshStandardMaterial color="#2c2f35" />
      </mesh>
      <Lamp y={3.42} on={carRed} onColor="#ff5a4d" offColor="#3a2422" />
      <Lamp y={3.1} on={carYellow} onColor="#ffd24a" offColor="#3a3322" />
      <Lamp y={2.78} on={carGreen} onColor="#5ad06a" offColor="#22381f" />
      {/* pedestrian signal housing */}
      <mesh position={[0, 1.95, 0.18]}>
        <boxGeometry args={[0.36, 0.42, 0.18]} />
        <meshStandardMaterial color="#2c2f35" />
      </mesh>
      <mesh position={[0, 1.95, 0.3]}>
        <circleGeometry args={[0.13, 24]} />
        <meshStandardMaterial
          ref={ped}
          color={walkGreen ? '#6cd07a' : '#ff5a4d'}
          emissive={walkGreen ? '#3fa14d' : '#7a1f18'}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  )
}

function Lamp({ y, on, onColor, offColor }: { y: number; on: boolean; onColor: string; offColor: string }) {
  return (
    <mesh position={[0, y, 0.18]}>
      <circleGeometry args={[0.13, 24]} />
      <meshStandardMaterial
        color={on ? onColor : offColor}
        emissive={on ? onColor : '#000000'}
        emissiveIntensity={on ? 0.7 : 0}
      />
    </mesh>
  )
}

function Car({ color }: { color: string }) {
  return (
    <group position={[0, 0.0, 0]}>
      {/* body */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[2.1, 0.5, 1.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* cabin */}
      <mesh position={[-0.1, 0.85, 0]}>
        <boxGeometry args={[1.1, 0.42, 0.95]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* windows */}
      <mesh position={[-0.1, 0.85, 0.49]}>
        <boxGeometry args={[1.0, 0.32, 0.02]} />
        <meshStandardMaterial color="#bfe6f2" />
      </mesh>
      <mesh position={[-0.1, 0.85, -0.49]}>
        <boxGeometry args={[1.0, 0.32, 0.02]} />
        <meshStandardMaterial color="#bfe6f2" />
      </mesh>
      {/* headlight (faces +x, the direction of travel) */}
      <mesh position={[1.06, 0.45, 0.32]}>
        <boxGeometry args={[0.04, 0.16, 0.16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#fff0b0" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[1.06, 0.45, -0.32]}>
        <boxGeometry args={[0.04, 0.16, 0.16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#fff0b0" emissiveIntensity={0.5} />
      </mesh>
      <Wheel x={0.7} z={0.56} />
      <Wheel x={0.7} z={-0.56} />
      <Wheel x={-0.7} z={0.56} />
      <Wheel x={-0.7} z={-0.56} />
    </group>
  )
}

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.22, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.22, 0.22, 0.12, 16]} />
      <meshStandardMaterial color="#2a2a2e" />
    </mesh>
  )
}

function Character({ headRef }: { headRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group>
      {/* legs */}
      <mesh position={[-0.12, 0.32, 0]}>
        <boxGeometry args={[0.16, 0.64, 0.18]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>
      <mesh position={[0.12, 0.32, 0]}>
        <boxGeometry args={[0.16, 0.64, 0.18]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[0.46, 0.56, 0.26]} />
        <meshStandardMaterial color="#e6915c" />
      </mesh>
      {/* arms */}
      <mesh position={[-0.31, 0.94, 0]}>
        <boxGeometry args={[0.13, 0.5, 0.16]} />
        <meshStandardMaterial color="#e6915c" />
      </mesh>
      <mesh position={[0.31, 0.94, 0]}>
        <boxGeometry args={[0.13, 0.5, 0.16]} />
        <meshStandardMaterial color="#e6915c" />
      </mesh>
      {/* head */}
      <group ref={headRef} position={[0, 1.42, 0]}>
        <mesh>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color="#f2c89b" />
        </mesh>
        {/* cap */}
        <mesh position={[0, 0.16, 0]} scale={[1, 0.6, 1]}>
          <sphereGeometry args={[0.27, 20, 20]} />
          <meshStandardMaterial color="#d96a5a" />
        </mesh>
        {/* eyes look forward, toward the far side (-z) */}
        <mesh position={[-0.1, 0.02, -0.22]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#2c2a3a" />
        </mesh>
        <mesh position={[0.1, 0.02, -0.22]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#2c2a3a" />
        </mesh>
      </group>
    </group>
  )
}
