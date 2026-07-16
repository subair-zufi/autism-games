import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import * as THREE from 'three'
import { WebGLGate } from '../../components/WebGLGate'
import { PromptBanner } from '../../components/PromptBanner'
import { useSettings } from '../../state/settings'
import { t } from '../../i18n/strings'
import { playSuccess, playTap } from '../../services/sounds'
import { xrStore, vrSupported } from './xrStore'
import { PRACTICE_BEARINGS_DEG, dragDistance, isDragTail, isPracticeComplete, lookDrag } from './logic'

const EYE_Y = 1.6
const STAR_Y = 1.6
const STAR_RADIUS = 4

/** How long the "you're ready!" beat shows before `onComplete` fires. */
const READY_MS = 1800

/**
 * One-time, unscored warm-up shown before a child's very first real 360-game
 * session (review U2): tap the star straight ahead, then one each side — the
 * same drag-to-look-or-real-head-turn + tap model every 360 game uses. No
 * analytics are recorded; this never counts toward any score or session.
 */
export function VRPracticeScene({ onComplete }: { onComplete: () => void }) {
  const lang = useSettings((s) => s.language)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [canVR, setCanVR] = useState(false)

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(onComplete, READY_MS)
    return () => clearTimeout(timer)
  }, [ready, onComplete])

  function tapStar() {
    if (ready) return
    playTap()
    const next = step + 1
    if (isPracticeComplete(next)) {
      playSuccess()
      setReady(true)
    } else {
      setStep(next)
    }
  }

  const promptText = ready ? t('practiceReady', lang) : t('practiceIntro', lang)

  return (
    <WebGLGate>
      <div className="game-page">
        <div className="game-canvas">
          <Canvas
            camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 60 }}
            onCreated={({ camera }) => {
              camera.rotation.order = 'YXZ'
            }}
          >
            <XR store={xrStore}>
              <color attach="background" args={['#eaf2f7']} />
              <ambientLight intensity={0.9} color="#ffffff" />
              <directionalLight position={[2, 6, 3]} intensity={0.5} />
              <LookControls />
              <Ground />
              {!ready && <Star bearingDeg={PRACTICE_BEARINGS_DEG[step]} onTap={tapStar} />}
            </XR>
          </Canvas>
          {canVR && (
            <button
              onClick={() => xrStore.enterVR()}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: '10px 16px',
                borderRadius: 22,
                border: 'none',
                background: 'rgba(59, 130, 246, 0.92)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              🥽 {lang === 'ml' ? 'VR-ൽ കളിക്കൂ' : 'Enter VR'}
            </button>
          )}
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} lang={lang} />
        </div>
      </div>
    </WebGLGate>
  )
}

/* ---- 360° look-around controls — same pattern as every other 360 scene --- */
function LookControls() {
  const { camera, gl } = useThree()
  const view = useRef({ yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 })

  useEffect(() => {
    const el = gl.domElement
    let down = false
    let lastX = 0
    let lastY = 0
    let startX = 0
    let startY = 0
    const clampPitch = (p: number) => Math.max(-0.4, Math.min(0.42, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      v.tYaw -= (e.clientX - lastX) * 0.0042
      v.tPitch = clampPitch(v.tPitch + (e.clientY - lastY) * 0.0032)
      lastX = e.clientX
      lastY = e.clientY
      lookDrag.px = Math.max(lookDrag.px, Math.hypot(e.clientX - startX, e.clientY - startY))
    }
    const onUp = () => {
      if (down) lookDrag.endedAt = Date.now()
      down = false
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      view.current.tYaw += d * 0.0022
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, dt) => {
    if (state.gl.xr.isPresenting) return
    const v = view.current
    const k = Math.min(1, dt * 9)
    v.yaw += (v.tYaw - v.yaw) * k
    v.pitch += (v.tPitch - v.pitch) * k
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[12, 48]} />
      <meshStandardMaterial color="#cfe0e8" />
    </mesh>
  )
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

function Star({ bearingDeg, onTap }: { bearingDeg: number; onTap: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  const [x, z] = bearingToXZ((bearingDeg * Math.PI) / 180, STAR_RADIUS)

  useFrame((state) => {
    const m = ref.current
    if (!m) return
    m.rotation.y = state.clock.elapsedTime * 0.8
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12
    m.scale.setScalar(s)
  })

  return (
    <group position={[x, STAR_Y, z]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.4]} />
        <meshStandardMaterial color="#ffd95e" emissive="#f4b740" emissiveIntensity={0.6} />
      </mesh>
      {/* transparent tap target, comfortably larger than the star */}
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation()
          if (isDragTail() || dragDistance(e) > 8) return
          onTap()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <sphereGeometry args={[0.7, 12, 12]} />
      </mesh>
    </group>
  )
}
