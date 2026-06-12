import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { emotionMeta, type EmotionId } from './logic'

export interface MirrorSceneProps {
  target: EmotionId
  /** increments each correct answer to trigger a happy wobble */
  celebrate: number
}

export function MirrorScene(props: MirrorSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 4.6], fov: 42 }}>
      <color attach="background" args={['#efe7fb']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[2, 3, 4]} intensity={0.9} />
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
    <group position={[0, 0, -0.4]}>
      {/* glassy backing */}
      <mesh>
        <circleGeometry args={[1.65, 48]} />
        <meshStandardMaterial color="#dfeefb" />
      </mesh>
      {/* ornate ring */}
      <mesh>
        <torusGeometry args={[1.7, 0.16, 16, 60]} />
        <meshStandardMaterial color="#c9a24b" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* little sparkle gems around the frame */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.12]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#fff4cf" emissive="#f6e08a" emissiveIntensity={0.4} />
          </mesh>
        )
      })}
    </group>
  )
}

function Face({ target, celebrate }: { target: EmotionId; celebrate: number }) {
  const group = useRef<THREE.Group>(null)
  const wobble = useRef(99)
  const blink = useRef({ next: 2, closing: -1 })

  useEffect(() => {
    if (celebrate > 0) wobble.current = 0
  }, [celebrate])

  const f = emotionMeta(target).face

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    // gentle idle bob
    g.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.04
    // happy wobble on a correct answer
    if (wobble.current < 1) {
      wobble.current += dt
      const fade = 1 - wobble.current
      g.rotation.z = Math.sin(wobble.current * 20) * 0.14 * fade
      g.scale.setScalar(1 + Math.sin(wobble.current * 10) * 0.08 * fade)
    } else {
      g.rotation.z = 0
      g.scale.setScalar(1)
    }
  })

  // simple recurring blink driven by clock
  const eyeRef = useRef<[THREE.Group | null, THREE.Group | null]>([null, null])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const b = blink.current
    if (t > b.next && b.closing < 0) b.closing = t
    let openY = 1
    if (b.closing > 0) {
      const p = (t - b.closing) / 0.16
      if (p >= 1) {
        b.closing = -1
        b.next = t + 2.4 + Math.random() * 2
      } else {
        openY = Math.abs(Math.cos(p * Math.PI)) // dip to 0 and back
      }
    }
    for (const e of eyeRef.current) if (e) e.scale.y = f.eyeWide * openY
  })

  return (
    <group ref={group}>
      {/* head */}
      <mesh>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshStandardMaterial color="#f4c79c" />
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
      {([-0.42, 0.42] as const).map((x, i) => (
        <group key={x} position={[x, 0.22, 0.95]} ref={(g) => { eyeRef.current[i] = g }}>
          <mesh scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.12]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#3a3550" />
          </mesh>
        </group>
      ))}

      {/* brows: inner ends lift for worry, drop for anger */}
      <mesh position={[-0.42, 0.55, 1.02]} rotation={[0, 0, f.browInner * 0.7]}>
        <boxGeometry args={[0.34, 0.07, 0.08]} />
        <meshStandardMaterial color="#6b4a35" />
      </mesh>
      <mesh position={[0.42, 0.55, 1.02]} rotation={[0, 0, -f.browInner * 0.7]}>
        <boxGeometry args={[0.34, 0.07, 0.08]} />
        <meshStandardMaterial color="#6b4a35" />
      </mesh>

      {/* nose */}
      <mesh position={[0, -0.05, 1.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.22, 12]} />
        <meshStandardMaterial color="#e8b184" />
      </mesh>

      <Mouth curve={f.mouthCurve} open={f.mouthOpen} />
    </group>
  )
}

function Mouth({ curve, open }: { curve: number; open: number }) {
  // curved lip line: 5 beads on a parabola (corners lift for a smile)
  const beads = Array.from({ length: 5 }, (_, i) => {
    const t = (i / 4) * 2 - 1 // -1..1
    const x = t * 0.34
    const y = -0.5 + curve * 0.16 * (t * t)
    return [x, y] as const
  })
  return (
    <group position={[0, 0, 0.98]}>
      {beads.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.06]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#8a3b3b" />
        </mesh>
      ))}
      {/* open mouth grows round when the emotion calls for it */}
      <mesh position={[0, -0.5 + curve * 0.05, 0.02]} scale={[0.26, 0.1 + open * 0.34, 0.2]}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshStandardMaterial color="#5e2330" />
      </mesh>
    </group>
  )
}
