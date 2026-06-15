import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EmotionId } from './logic'

export interface MirrorSceneProps {
  target: EmotionId
  /** increments each correct answer to trigger a happy wobble */
  celebrate: number
}

export function MirrorScene(props: MirrorSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 4.6], fov: 42 }}>
      <color attach="background" args={['#efe7fb']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 4]} intensity={0.95} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner({ target, celebrate }: MirrorSceneProps) {
  return (
    <group>
      <MirrorFrame />
      <Face target={target} celebrate={celebrate} />
    </group>
  )
}

function MirrorFrame() {
  return (
    <group position={[0, 0, -0.5]}>
      {/* glassy backing */}
      <mesh>
        <circleGeometry args={[1.7, 48]} />
        <meshStandardMaterial color="#dbe9fb" metalness={0.3} roughness={0.25} />
      </mesh>
      {/* ornate ring */}
      <mesh>
        <torusGeometry args={[1.74, 0.16, 16, 60]} />
        <meshStandardMaterial color="#c9a24b" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* little sparkle gems around the frame */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.74, Math.sin(a) * 1.74, 0.12]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#fff4cf" emissive="#f6e08a" emissiveIntensity={0.4} />
          </mesh>
        )
      })}
    </group>
  )
}

/** A clear, distinct target shape per emotion. Values are gently lerped toward
 * so the mirror face visibly "morphs" into each feeling. */
interface Expr {
  smile: number // + corners up (happy), - corners down (sad/angry/yucky)
  open: number // 0..1 round open mouth (surprise/scared)
  browInner: number // + inner brow raised (sad/scared), - lowered (angry/yucky)
  browHeight: number // overall brow lift
  eyeWide: number // eye height scale
  tear: number // 0/1 show a tear
  tremble: number // 0/1 scared shiver
  tongue: number // 0/1 yucky tongue
  color: string
}

const EXPR: Record<EmotionId, Expr> = {
  happy: { smile: 1, open: 0.15, browInner: 0.1, browHeight: 0.04, eyeWide: 1.0, tear: 0, tremble: 0, tongue: 0, color: '#f4c79c' },
  sad: { smile: -0.9, open: 0.05, browInner: 0.7, browHeight: 0.02, eyeWide: 0.85, tear: 1, tremble: 0, tongue: 0, color: '#e9c6a6' },
  angry: { smile: -0.7, open: 0.1, browInner: -0.8, browHeight: -0.08, eyeWide: 0.8, tear: 0, tremble: 0, tongue: 0, color: '#f0a98a' },
  scared: { smile: -0.3, open: 0.65, browInner: 0.7, browHeight: 0.1, eyeWide: 1.4, tear: 0, tremble: 1, tongue: 0, color: '#f2d3b0' },
  surprised: { smile: 0.1, open: 1, browInner: 0.4, browHeight: 0.12, eyeWide: 1.5, tear: 0, tremble: 0, tongue: 0, color: '#f4c79c' },
  disgusted: { smile: -0.8, open: 0.2, browInner: -0.5, browHeight: -0.04, eyeWide: 0.65, tear: 0, tremble: 0, tongue: 1, color: '#cfd49a' },
}

const COLORS = Object.fromEntries(
  Object.entries(EXPR).map(([id, e]) => [id, new THREE.Color(e.color)]),
) as Record<EmotionId, THREE.Color>

const MOUTH_ARC = Math.PI * 0.8

function Face({ target, celebrate }: { target: EmotionId; celebrate: number }) {
  const group = useRef<THREE.Group>(null)
  const headMat = useRef<THREE.MeshStandardMaterial>(null)
  const browL = useRef<THREE.Mesh>(null)
  const browR = useRef<THREE.Mesh>(null)
  const eyeL = useRef<THREE.Group>(null)
  const eyeR = useRef<THREE.Group>(null)
  const smile = useRef<THREE.Mesh>(null)
  const frown = useRef<THREE.Mesh>(null)
  const open = useRef<THREE.Mesh>(null)
  const tongue = useRef<THREE.Mesh>(null)
  const tear = useRef<THREE.Mesh>(null)
  const wobble = useRef(99)
  const prevCelebrate = useRef(0)

  // current (animated) expression, lerped toward the target each frame
  const cur = useRef<Expr & { colorObj: THREE.Color }>({
    ...EXPR.happy,
    colorObj: COLORS.happy.clone(),
  })

  useFrame((state, dt) => {
    // trigger a happy wobble when the celebrate counter changes
    if (celebrate !== prevCelebrate.current) {
      prevCelebrate.current = celebrate
      if (celebrate > 0) wobble.current = 0
    }

    const t0 = EXPR[target]
    const c = cur.current
    const k = 1 - Math.exp(-dt * 6)
    c.smile = THREE.MathUtils.lerp(c.smile, t0.smile, k)
    c.open = THREE.MathUtils.lerp(c.open, t0.open, k)
    c.browInner = THREE.MathUtils.lerp(c.browInner, t0.browInner, k)
    c.browHeight = THREE.MathUtils.lerp(c.browHeight, t0.browHeight, k)
    c.eyeWide = THREE.MathUtils.lerp(c.eyeWide, t0.eyeWide, k)
    c.tear = THREE.MathUtils.lerp(c.tear, t0.tear, k)
    c.tremble = THREE.MathUtils.lerp(c.tremble, t0.tremble, k)
    c.tongue = THREE.MathUtils.lerp(c.tongue, t0.tongue, k)
    c.colorObj.lerp(COLORS[target], k)

    const t = state.clock.elapsedTime
    const g = group.current
    if (g) {
      g.position.y = Math.sin(t * 1.6) * 0.04
      g.position.x = Math.sin(t * 32) * 0.02 * c.tremble
      if (wobble.current < 1) {
        wobble.current += dt
        const fade = 1 - wobble.current
        g.rotation.z = Math.sin(wobble.current * 20) * 0.14 * fade
        g.scale.setScalar(1 + Math.sin(wobble.current * 10) * 0.08 * fade)
      } else {
        g.rotation.z = 0
        g.scale.setScalar(1)
      }
    }

    if (headMat.current) headMat.current.color.copy(c.colorObj)

    // brows: inner ends lift for worry, drop for anger; whole brow shifts height
    if (browL.current) {
      browL.current.rotation.z = c.browInner * 0.7
      browL.current.position.y = 0.55 + c.browHeight
    }
    if (browR.current) {
      browR.current.rotation.z = -c.browInner * 0.7
      browR.current.position.y = 0.55 + c.browHeight
    }

    // eyes scale in height; a touch wider so wide eyes read clearly
    const ex = 1 + (c.eyeWide - 1) * 0.3
    eyeL.current?.scale.set(ex, c.eyeWide, 1)
    eyeR.current?.scale.set(ex, c.eyeWide, 1)

    // mouth: show smile arc or frown arc depending on sign; round open mouth on top
    const sUp = Math.max(c.smile, 0)
    const sDown = Math.max(-c.smile, 0)
    if (smile.current) {
      smile.current.visible = sUp > 0.05 && c.open < 0.5
      smile.current.scale.set(1, Math.max(sUp, 0.001), 1)
    }
    if (frown.current) {
      frown.current.visible = sDown > 0.05 && c.open < 0.5
      frown.current.scale.set(1, Math.max(sDown, 0.001), 1)
    }
    if (open.current) {
      open.current.visible = c.open > 0.06
      open.current.scale.set(0.8 + c.open * 0.3, Math.max(c.open, 0.001), 0.6)
    }
    if (tongue.current) {
      tongue.current.visible = c.tongue > 0.2
      tongue.current.scale.setScalar(Math.max(c.tongue, 0.001))
    }
    if (tear.current) {
      tear.current.visible = c.tear > 0.1
      const fall = (t % 1.6) / 1.6
      tear.current.position.set(-0.42, 0.05 - fall * 0.45, 1.0)
      const mat = tear.current.material as THREE.MeshStandardMaterial
      mat.opacity = c.tear * (1 - fall)
    }
  })

  return (
    <group ref={group}>
      {/* head */}
      <mesh>
        <sphereGeometry args={[1.15, 40, 40]} />
        <meshStandardMaterial ref={headMat} color="#f4c79c" />
      </mesh>
      {/* ears */}
      <mesh position={[-1.12, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#eeb98a" />
      </mesh>
      <mesh position={[1.12, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#eeb98a" />
      </mesh>

      {/* eyes */}
      <group ref={eyeL} position={[-0.42, 0.22, 0.95]}>
        <mesh scale={[1, 1, 0.5]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.13]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#3a3550" />
        </mesh>
      </group>
      <group ref={eyeR} position={[0.42, 0.22, 0.95]}>
        <mesh scale={[1, 1, 0.5]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.13]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#3a3550" />
        </mesh>
      </group>

      {/* brows */}
      <mesh ref={browL} position={[-0.42, 0.55, 1.02]}>
        <boxGeometry args={[0.36, 0.08, 0.08]} />
        <meshStandardMaterial color="#6b4a35" />
      </mesh>
      <mesh ref={browR} position={[0.42, 0.55, 1.02]}>
        <boxGeometry args={[0.36, 0.08, 0.08]} />
        <meshStandardMaterial color="#6b4a35" />
      </mesh>

      {/* nose */}
      <mesh position={[0, -0.05, 1.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.22, 12]} />
        <meshStandardMaterial color="#e8b184" />
      </mesh>

      {/* smile: torus arc, edges curve up */}
      <mesh ref={smile} position={[0, -0.42, 1.0]} rotation={[0, 0, Math.PI + (Math.PI - MOUTH_ARC) / 2]}>
        <torusGeometry args={[0.34, 0.06, 12, 32, MOUTH_ARC]} />
        <meshStandardMaterial color="#8a3b3b" />
      </mesh>
      {/* frown: torus arc, edges curve down */}
      <mesh ref={frown} position={[0, -0.62, 1.0]} rotation={[0, 0, (Math.PI - MOUTH_ARC) / 2]}>
        <torusGeometry args={[0.34, 0.06, 12, 32, MOUTH_ARC]} />
        <meshStandardMaterial color="#8a3b3b" />
      </mesh>
      {/* round open mouth */}
      <mesh ref={open} position={[0, -0.5, 0.98]}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshStandardMaterial color="#5e2330" />
      </mesh>
      {/* yucky tongue sticking out */}
      <mesh ref={tongue} position={[0, -0.66, 1.06]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#e06a82" />
      </mesh>

      {/* tear */}
      <mesh ref={tear} position={[-0.42, 0.05, 1.0]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial color="#6fb7e8" transparent />
      </mesh>
    </group>
  )
}
