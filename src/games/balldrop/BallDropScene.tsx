import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX_COLORS, type ColorId } from './logic'

const SPACING = 1.6
const BOX_W = 1.2
const BOX_H = 0.7
const WALL = 0.09
const BALL_R = 0.3
const BALL_START_Y = 2.4
const REST_Y = WALL + BALL_R + 0.01

export interface BallDropSceneProps {
  boxes: ColorId[]
  mode: 'tap' | 'drag'
  disabled: boolean
  resetKey: number
  confetti: { color: ColorId; trigger: number }
  onLand: (box: ColorId) => void
}

function boxX(i: number, n: number) {
  return (i - (n - 1) / 2) * SPACING
}

function hexOf(id: ColorId) {
  return BOX_COLORS.find((c) => c.id === id)!.hex
}

export function BallDropScene(props: BallDropSceneProps) {
  // pull the camera back so wider box rows (medium/hard) stay in frame
  const extra = props.boxes.length - 3
  return (
    <Canvas
      camera={{ position: [0, 3 + extra * 0.7, 7 + extra * 1.9], fov: 42 }}
      onCreated={({ camera }) => camera.lookAt(0, 1, 0)}
    >
      <color attach="background" args={['#dff0f7']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 5]} intensity={0.9} />
      <SceneInner {...props} />
    </Canvas>
  )
}

function SceneInner(props: BallDropSceneProps) {
  const ball = useRef<THREE.Mesh>(null)
  const sim = useRef({
    mode: 'idle' as 'idle' | 'drag' | 'fall' | 'settle',
    vy: 0,
    targetX: null as number | null,
    targetBox: null as ColorId | null,
  })
  const onLandRef = useRef(props.onLand)
  onLandRef.current = props.onLand
  const propsRef = useRef(props)
  propsRef.current = props

  const n = props.boxes.length
  const maxX = boxX(n - 1, n)

  useEffect(() => {
    sim.current = { mode: 'idle', vy: 0, targetX: null, targetBox: null }
    ball.current?.position.set(0, BALL_START_Y, 0)
    ball.current?.scale.setScalar(1)
  }, [props.resetKey])

  useFrame((state, dt) => {
    const b = ball.current
    if (!b) return
    const s = sim.current
    const t = state.clock.elapsedTime
    if (s.mode === 'idle') {
      b.position.y = BALL_START_Y + Math.sin(t * 2) * 0.08
      b.position.x += (0 - b.position.x) * Math.min(1, dt * 6)
    } else if (s.mode === 'fall') {
      if (s.targetX !== null) {
        b.position.x += (s.targetX - b.position.x) * Math.min(1, dt * 10)
      }
      s.vy -= 12 * dt
      b.position.y += s.vy * dt
      if (b.position.y <= REST_Y) {
        b.position.y = REST_Y
        if (Math.abs(s.vy) > 2.2) {
          s.vy = -s.vy * 0.3 // small soft bounce
        } else {
          s.mode = 'settle'
          b.scale.set(1.15, 0.85, 1.15) // squash on landing
          if (s.targetBox) onLandRef.current(s.targetBox)
        }
      }
    } else if (s.mode === 'settle') {
      b.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8))
    }
  })

  const { camera, gl } = useThree()

  // drag is tracked on the window (not via scene raycasts) so fast pointer
  // moves can't escape the ball and the drop always sees the release point
  function startDrag(e: ThreeEvent<PointerEvent>) {
    if (propsRef.current.mode !== 'drag' || propsRef.current.disabled) return
    if (sim.current.mode !== 'idle') return
    e.stopPropagation()
    sim.current.mode = 'drag'
    const raycaster = new THREE.Raycaster()
    const ballPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const hit = new THREE.Vector3()
    const onMove = (ev: PointerEvent) => {
      if (sim.current.mode !== 'drag' || !ball.current) return
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
      )
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(ballPlane, hit)) {
        ball.current.position.x = THREE.MathUtils.clamp(hit.x, -maxX - 0.4, maxX + 0.4)
        ball.current.position.y = BALL_START_Y
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function endDrag() {
    if (sim.current.mode !== 'drag' || !ball.current) return
    const x = ball.current.position.x
    const boxes = propsRef.current.boxes
    let dropped = false
    boxes.forEach((id, i) => {
      const bx = boxX(i, boxes.length)
      if (!dropped && Math.abs(x - bx) <= 0.65) {
        dropped = true
        sim.current.mode = 'fall'
        sim.current.vy = 0
        sim.current.targetX = bx
        sim.current.targetBox = id
      }
    })
    if (!dropped) sim.current.mode = 'idle' // glides back to center
  }

  function tapBox(id: ColorId, i: number) {
    if (propsRef.current.mode !== 'tap' || propsRef.current.disabled) return
    if (sim.current.mode !== 'idle') return
    sim.current.mode = 'fall'
    sim.current.vy = 0
    sim.current.targetX = boxX(i, propsRef.current.boxes.length)
    sim.current.targetBox = id
  }

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#cfe6c8" />
      </mesh>

      {props.boxes.map((id, i) => (
        <ColorBox key={id} x={boxX(i, n)} hex={hexOf(id)} onTap={() => tapBox(id, i)} />
      ))}

      <mesh ref={ball} position={[0, BALL_START_Y, 0]} onPointerDown={startDrag}>
        <sphereGeometry args={[BALL_R, 32, 32]} />
        <meshStandardMaterial color="#f08a4b" />
      </mesh>

      <Confetti
        trigger={props.confetti.trigger}
        hex={hexOf(props.confetti.color)}
        x={boxX(Math.max(props.boxes.indexOf(props.confetti.color), 0), n)}
      />
    </group>
  )
}

function ColorBox({ x, hex, onTap }: { x: number; hex: string; onTap: () => void }) {
  return (
    <group position={[x, 0, 0]} onClick={onTap}>
      <mesh position={[0, WALL / 2, 0]}>
        <boxGeometry args={[BOX_W, WALL, BOX_W]} />
        <meshStandardMaterial color={hex} />
      </mesh>
      <mesh position={[-BOX_W / 2 + WALL / 2, BOX_H / 2, 0]}>
        <boxGeometry args={[WALL, BOX_H, BOX_W]} />
        <meshStandardMaterial color={hex} />
      </mesh>
      <mesh position={[BOX_W / 2 - WALL / 2, BOX_H / 2, 0]}>
        <boxGeometry args={[WALL, BOX_H, BOX_W]} />
        <meshStandardMaterial color={hex} />
      </mesh>
      <mesh position={[0, BOX_H / 2, -BOX_W / 2 + WALL / 2]}>
        <boxGeometry args={[BOX_W, BOX_H, WALL]} />
        <meshStandardMaterial color={hex} />
      </mesh>
      <mesh position={[0, BOX_H / 2, BOX_W / 2 - WALL / 2]}>
        <boxGeometry args={[BOX_W, BOX_H, WALL]} />
        <meshStandardMaterial color={hex} />
      </mesh>
    </group>
  )
}

function Confetti({ trigger, hex, x }: { trigger: number; hex: string; x: number }) {
  const group = useRef<THREE.Group>(null)
  const vels = useRef<THREE.Vector3[]>([])
  const life = useRef(99)

  useEffect(() => {
    if (trigger === 0 || !group.current) return
    life.current = 0
    vels.current = Array.from(
      { length: 14 },
      () =>
        new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          2.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 2,
        ),
    )
    for (const m of group.current.children) {
      m.position.set(x, 0.9, 0)
      m.visible = true
    }
  }, [trigger, x])

  useFrame((_, dt) => {
    if (!group.current) return
    if (life.current > 1.3) {
      for (const m of group.current.children) m.visible = false
      return
    }
    life.current += dt
    group.current.children.forEach((m, i) => {
      const v = vels.current[i]
      if (!v) return
      v.y -= 7 * dt
      m.position.addScaledVector(v, dt)
      m.rotation.x += dt * 6
      m.rotation.z += dt * 8
    })
  })

  return (
    <group ref={group}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} visible={false}>
          <boxGeometry args={[0.13, 0.13, 0.02]} />
          <meshStandardMaterial color={hex} />
        </mesh>
      ))}
    </group>
  )
}
