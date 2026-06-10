import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EmotionId } from './logic'

interface Expression {
  browAngle: number // positive = inner ends tilt down (angry), negative = inner up (sad)
  browHeight: number
  eyeScale: number
  smile: number
  frown: number
  open: number
  tear: number
  tremble: number
  color: string
}

const EXPRESSIONS: Record<EmotionId, Expression> = {
  happy:     { browAngle: 0.10,  browHeight: 0.62, eyeScale: 1.0,  smile: 1,   frown: 0,   open: 0,    tear: 0, tremble: 0, color: '#ffd97a' },
  sad:       { browAngle: -0.45, browHeight: 0.60, eyeScale: 0.9,  smile: 0,   frown: 1,   open: 0,    tear: 1, tremble: 0, color: '#ffd97a' },
  angry:     { browAngle: 0.55,  browHeight: 0.50, eyeScale: 0.8,  smile: 0,   frown: 0.8, open: 0,    tear: 0, tremble: 0, color: '#ff9d70' },
  surprised: { browAngle: 0.0,   browHeight: 0.70, eyeScale: 1.35, smile: 0.2, frown: 0,   open: 1,    tear: 0, tremble: 0, color: '#ffd97a' },
  scared:    { browAngle: -0.30, browHeight: 0.72, eyeScale: 1.3,  smile: 0,   frown: 0.3, open: 0.55, tear: 0, tremble: 1, color: '#ffe9b8' },
  calm:      { browAngle: 0.05,  browHeight: 0.58, eyeScale: 0.45, smile: 0.5, frown: 0,   open: 0,    tear: 0, tremble: 0, color: '#ffd97a' },
}

const COLORS = Object.fromEntries(
  Object.entries(EXPRESSIONS).map(([id, e]) => [id, new THREE.Color(e.color)]),
) as Record<EmotionId, THREE.Color>

const MOUTH_ARC = Math.PI * 0.75

export function EmotionFace({ emotion }: { emotion: EmotionId }) {
  const group = useRef<THREE.Group>(null)
  const headMat = useRef<THREE.MeshStandardMaterial>(null)
  const browL = useRef<THREE.Mesh>(null)
  const browR = useRef<THREE.Mesh>(null)
  const eyeL = useRef<THREE.Group>(null)
  const eyeR = useRef<THREE.Group>(null)
  const smile = useRef<THREE.Mesh>(null)
  const frown = useRef<THREE.Mesh>(null)
  const open = useRef<THREE.Mesh>(null)
  const tear = useRef<THREE.Mesh>(null)
  const cur = useRef({ ...EXPRESSIONS.happy, colorObj: COLORS.happy.clone() })

  useFrame((state, dt) => {
    const target = EXPRESSIONS[emotion]
    const c = cur.current
    const k = 1 - Math.exp(-dt * 5) // smooth, calm transitions
    c.browAngle = THREE.MathUtils.lerp(c.browAngle, target.browAngle, k)
    c.browHeight = THREE.MathUtils.lerp(c.browHeight, target.browHeight, k)
    c.eyeScale = THREE.MathUtils.lerp(c.eyeScale, target.eyeScale, k)
    c.smile = THREE.MathUtils.lerp(c.smile, target.smile, k)
    c.frown = THREE.MathUtils.lerp(c.frown, target.frown, k)
    c.open = THREE.MathUtils.lerp(c.open, target.open, k)
    c.tear = THREE.MathUtils.lerp(c.tear, target.tear, k)
    c.tremble = THREE.MathUtils.lerp(c.tremble, target.tremble, k)
    c.colorObj.lerp(COLORS[emotion], k)

    const t = state.clock.elapsedTime
    if (group.current) {
      group.current.position.y = Math.sin(t * 1.5) * 0.04 // gentle idle bob
      group.current.position.x = Math.sin(t * 30) * 0.015 * c.tremble
      group.current.rotation.z = Math.sin(t * 0.8) * 0.02
    }
    if (headMat.current) headMat.current.color.copy(c.colorObj)
    if (browL.current) {
      browL.current.rotation.z = -c.browAngle
      browL.current.position.y = c.browHeight
    }
    if (browR.current) {
      browR.current.rotation.z = c.browAngle
      browR.current.position.y = c.browHeight
    }
    const eyeX = 1 + (c.eyeScale - 1) * 0.3
    eyeL.current?.scale.set(eyeX, c.eyeScale, 1)
    eyeR.current?.scale.set(eyeX, c.eyeScale, 1)
    // intensity flattens the arc vertically; uniform scaling would pull the
    // mouth inside the head sphere and hide it
    if (smile.current) {
      smile.current.scale.set(1, Math.max(c.smile, 0.001), 1)
      smile.current.visible = c.smile > 0.05
    }
    if (frown.current) {
      frown.current.scale.set(1, Math.max(c.frown, 0.001), 1)
      frown.current.visible = c.frown > 0.05
    }
    if (open.current) {
      open.current.scale.setScalar(Math.max(c.open, 0.001))
      open.current.visible = c.open > 0.05
    }
    if (tear.current) tear.current.visible = c.tear > 0.05
    if (tear.current) {
      tear.current.scale.setScalar(Math.max(c.tear, 0.001))
      tear.current.position.y = -0.12 - (c.tear > 0.1 ? (t % 1.6) * 0.12 : 0)
    }
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial ref={headMat} color="#ffd97a" />
      </mesh>

      <group ref={eyeL} position={[-0.35, 0.15, 0.78]}>
        <mesh>
          <sphereGeometry args={[0.17, 24, 24]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color="#3f3a55" />
        </mesh>
      </group>
      <group ref={eyeR} position={[0.35, 0.15, 0.78]}>
        <mesh>
          <sphereGeometry args={[0.17, 24, 24]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color="#3f3a55" />
        </mesh>
      </group>

      <mesh ref={browL} position={[-0.35, 0.62, 0.7]}>
        <boxGeometry args={[0.36, 0.07, 0.08]} />
        <meshStandardMaterial color="#8a5a2b" />
      </mesh>
      <mesh ref={browR} position={[0.35, 0.62, 0.7]}>
        <boxGeometry args={[0.36, 0.07, 0.08]} />
        <meshStandardMaterial color="#8a5a2b" />
      </mesh>

      {/* smile: torus arc on the lower half of its circle, so edges curve up */}
      <mesh ref={smile} position={[0, -0.12, 0.93]} rotation={[0, 0, Math.PI + (Math.PI - MOUTH_ARC) / 2]}>
        <torusGeometry args={[0.32, 0.055, 12, 32, MOUTH_ARC]} />
        <meshStandardMaterial color="#7a4a2b" />
      </mesh>
      {/* frown: arc on the upper half of a lower circle, so edges curve down */}
      <mesh ref={frown} position={[0, -0.75, 0.93]} rotation={[0, 0, (Math.PI - MOUTH_ARC) / 2]}>
        <torusGeometry args={[0.32, 0.055, 12, 32, MOUTH_ARC]} />
        <meshStandardMaterial color="#7a4a2b" />
      </mesh>
      <mesh ref={open} position={[0, -0.4, 0.85]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color="#5a3220" />
      </mesh>

      <mesh ref={tear} position={[-0.35, -0.12, 0.88]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#6fb7e8" />
      </mesh>
    </group>
  )
}
