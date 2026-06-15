import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KID_COLORS, YOU_COLOR } from './logic'

export interface SliderSceneProps {
  /** kids still waiting ahead of the child */
  ahead: number
  /** shirt colours for the kids in the queue */
  queueColors: string[]
  /** show the child standing in line (hidden only while they are sliding) */
  showYou: boolean
  /** bump to send a character down the slide */
  slideTrigger: number
  /** whether the current slider is the child (bright pink) or a queue kid */
  sliderIsYou: boolean
}

// slide ramp endpoints (top of the slide -> bottom)
const TOP = new THREE.Vector3(-1.1, 2.5, 0)
const BOT = new THREE.Vector3(2.4, 0.6, 0)
const RAMP_ANGLE = Math.atan2(BOT.y - TOP.y, BOT.x - TOP.x)

export function SliderScene(props: SliderSceneProps) {
  return (
    <Canvas
      camera={{ position: [0.4, 3.2, 8], fov: 45 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}
    >
      <color attach="background" args={['#bfe6f5']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 8, 5]} intensity={0.95} />
      <SceneInner {...props} />
    </Canvas>
  )
}

export function SceneInner({ ahead, queueColors, showYou, slideTrigger, sliderIsYou }: SliderSceneProps) {
  return (
    <group>
      <Ground />
      <Slide />
      <Queue ahead={ahead} colors={queueColors} showYou={showYou} />
      <ActiveSlider trigger={slideTrigger} you={sliderIsYou} />
    </group>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#a7d98a" />
    </mesh>
  )
}

function Slide() {
  const length = TOP.distanceTo(BOT)
  const mid = TOP.clone().add(BOT).multiplyScalar(0.5)
  return (
    <group>
      {/* ramp */}
      <mesh position={[mid.x, mid.y, 0]} rotation={[0, 0, RAMP_ANGLE]}>
        <boxGeometry args={[length, 0.16, 1.2]} />
        <meshStandardMaterial color="#f2a93b" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* ramp side rails */}
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[mid.x, mid.y + 0.18, z]} rotation={[0, 0, RAMP_ANGLE]}>
          <boxGeometry args={[length, 0.16, 0.08]} />
          <meshStandardMaterial color="#e2884c" />
        </mesh>
      ))}
      {/* top platform */}
      <mesh position={[TOP.x - 0.4, TOP.y - 0.18, 0]}>
        <boxGeometry args={[1.1, 0.16, 1.3]} />
        <meshStandardMaterial color="#f2c14e" />
      </mesh>
      {/* platform support legs */}
      {[[-0.8, -0.5], [-0.8, 0.5], [0.0, -0.5], [0.0, 0.5]].map(([dx, dz], i) => (
        <mesh key={i} position={[TOP.x - 0.4 + dx, (TOP.y - 0.26) / 2, dz]}>
          <cylinderGeometry args={[0.07, 0.07, TOP.y - 0.26, 10]} />
          <meshStandardMaterial color="#9a9aa2" />
        </mesh>
      ))}
      {/* ladder */}
      <Ladder x={TOP.x - 1.2} top={TOP.y - 0.1} />
    </group>
  )
}

function Ladder({ x, top }: { x: number; top: number }) {
  const steps = Math.max(2, Math.round(top / 0.45))
  return (
    <group position={[x, 0, 0]}>
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[0, top / 2, z]}>
          <cylinderGeometry args={[0.06, 0.06, top, 10]} />
          <meshStandardMaterial color="#c0c0c8" />
        </mesh>
      ))}
      {Array.from({ length: steps }, (_, i) => {
        const y = ((i + 0.5) / steps) * top
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.8, 10]} />
            <meshStandardMaterial color="#d8d8de" />
          </mesh>
        )
      })}
    </group>
  )
}

/** queue base spot (front of the line, next to the ladder) and spacing back */
const QUEUE_FRONT = new THREE.Vector3(-3.0, 0, 0.6)
const QUEUE_STEP = 0.95

function queueSpot(index: number): [number, number, number] {
  return [QUEUE_FRONT.x - index * QUEUE_STEP, 0, QUEUE_FRONT.z + index * 0.18]
}

function Queue({ ahead, colors, showYou }: { ahead: number; colors: string[]; showYou: boolean }) {
  // kids ahead fill the front spots (nearest the ladder); as each one slides the
  // rest shift forward. YOU wait directly behind them and move up too — reaching
  // the front (queueSpot(0)) when it is finally your turn.
  const waiting = colors.slice(colors.length - ahead)
  return (
    <group>
      {waiting.map((c, i) => (
        <Character key={`${c}-${i}`} position={queueSpot(i)} shirt={c} bobPhase={i * 1.3} />
      ))}
      {showYou && <Character position={queueSpot(ahead)} shirt={YOU_COLOR} bobPhase={0.5} isYou />}
    </group>
  )
}

function ActiveSlider({ trigger, you }: { trigger: number; you: boolean }) {
  const group = useRef<THREE.Group>(null)
  const anim = useRef({ t: 99 })
  const colorIdx = useRef(0)

  useEffect(() => {
    if (trigger > 0) {
      anim.current = { t: 0 }
      colorIdx.current = (colorIdx.current + 1) % KID_COLORS.length
    }
  }, [trigger])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const a = anim.current
    if (a.t > 1.05) {
      g.visible = false
      return
    }
    g.visible = true
    a.t += dt * 0.85
    const k = Math.min(1, a.t)
    // sit at the top briefly, then slide down the ramp
    const slide = Math.max(0, (k - 0.18) / 0.82)
    const pos = TOP.clone().lerp(BOT, ease(slide))
    g.position.set(pos.x, pos.y + 0.5, pos.z)
    g.rotation.z = RAMP_ANGLE * 0.6
  })

  const shirt = you ? YOU_COLOR : KID_COLORS[colorIdx.current]
  return (
    <group ref={group} visible={false}>
      <Character position={[0, 0, 0]} shirt={shirt} sitting isYou={you} />
    </group>
  )
}

function ease(k: number) {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
}

function Character({
  position,
  shirt,
  bobPhase = 0,
  sitting = false,
  isYou = false,
}: {
  position: [number, number, number]
  shirt: string
  bobPhase?: number
  sitting?: boolean
  isYou?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g || sitting) return
    // gentle waiting bob
    g.position.y = position[1] + Math.abs(Math.sin(state.clock.elapsedTime * 2.2 + bobPhase)) * 0.05
  })
  const skin = '#f2c89b'
  return (
    <group ref={group} position={position}>
      <group position={[0, sitting ? -0.15 : 0, 0]}>
        {/* legs */}
        <mesh position={[-0.12, sitting ? 0.28 : 0.3, sitting ? 0.22 : 0]} rotation={[sitting ? -1.2 : 0, 0, 0]}>
          <boxGeometry args={[0.15, 0.55, 0.16]} />
          <meshStandardMaterial color="#5b6b8c" />
        </mesh>
        <mesh position={[0.12, sitting ? 0.28 : 0.3, sitting ? 0.22 : 0]} rotation={[sitting ? -1.2 : 0, 0, 0]}>
          <boxGeometry args={[0.15, 0.55, 0.16]} />
          <meshStandardMaterial color="#5b6b8c" />
        </mesh>
        {/* torso */}
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[0.42, 0.56, 0.26]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* arms */}
        <mesh position={[-0.29, 0.8, 0]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.12, 0.5, 0.14]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0.29, 0.8, 0]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.12, 0.5, 0.14]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.28, 0]}>
          <sphereGeometry args={[0.25, 20, 20]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.09, 1.3, 0.22]}><sphereGeometry args={[0.035, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
        <mesh position={[0.09, 1.3, 0.22]}><sphereGeometry args={[0.035, 10, 10]} /><meshStandardMaterial color="#2e2a3a" /></mesh>
        {/* "YOU" marker: a bright floating star */}
        {isYou && <YouStar />}
      </group>
    </group>
  )
}

function YouStar() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    m.rotation.y += 0.04
    m.position.y = 1.85 + Math.sin(state.clock.elapsedTime * 3) * 0.06
  })
  return (
    <mesh ref={ref} position={[0, 1.85, 0]}>
      <octahedronGeometry args={[0.16]} />
      <meshStandardMaterial color="#ffd54a" emissive="#f5b301" emissiveIntensity={0.6} />
    </mesh>
  )
}
