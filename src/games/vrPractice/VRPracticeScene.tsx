import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { WebGLGate } from '../../components/WebGLGate'
import { PromptBanner } from '../../components/PromptBanner'
import { useSettings } from '../../state/settings'
import { t } from '../../i18n/strings'
import { playSuccess, playTap } from '../../services/sounds'
import { xrStore, vrSupported } from './xrStore'
import { HeadSelect } from '../HeadSelect'
import { XRCameraHome } from '../XRCameraHome'
import { VRInputSwitch } from '../VRInputSwitch'
import {
  PRACTICE_BEARINGS_DEG,
  PRACTICE_FEEDBACK_MS,
  dragDistance,
  isDragTail,
  isPracticeComplete,
  lookDrag,
  practicePromptKey,
} from './logic'

const EYE_Y = 1.6
const STAR_Y = 1.6
const STAR_RADIUS = 4

/** How long the "you're ready!" beat shows before `onComplete` fires. */
const READY_MS = 1800

/**
 * One-time, unscored warm-up shown before a child's very first real 360-game
 * session (review U2): tap the star straight ahead, then one each side — the
 * same drag-to-look-or-real-head-turn + select model every 360 game uses. No
 * analytics are recorded; this never counts toward any score or session.
 *
 * Inside a headset it teaches the child's own selection method (Profile →
 * Selection): `HeadSelect` supplies the gaze reticle and dwell ring where that
 * is the method, and the instruction here names the act. That is the whole point
 * of the warm-up — the first time a child meets an unfamiliar way of choosing
 * should not be inside a scored trial.
 */
export function VRPracticeScene({ onComplete }: { onComplete: () => void }) {
  const lang = useSettings((s) => s.language)
  const inputMethod = useSettings((s) => s.inputMethod)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [canVR, setCanVR] = useState(false)

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(onComplete, READY_MS)
    return () => clearTimeout(timer)
  }, [ready, onComplete])

  // Short "that worked" beat between targets. A child meeting gaze dwell for
  // the first time has no idea whether their attempt registered, and the star
  // simply moving is a weak signal.
  useEffect(() => {
    if (!celebrating) return
    const timer = setTimeout(() => setCelebrating(false), PRACTICE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [celebrating])

  function tapStar() {
    if (ready) return
    playTap()
    const next = step + 1
    if (isPracticeComplete(next)) {
      playSuccess()
      setReady(true)
    } else {
      setStep(next)
      setCelebrating(true)
    }
  }

  // The DOM banner is only ever seen outside a session — WebXR immersive mode
  // hides the page — so it keeps the flat-screen wording; the in-world panel
  // below carries the method-specific instruction.
  const promptText = t(practicePromptKey({ ready, celebrating, inVR: false, inputMethod }), lang)

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
              <HeadSelect />
              <XRCameraHome />
              <Ground />
              {!ready && <Star bearingDeg={PRACTICE_BEARINGS_DEG[step]} onTap={tapStar} />}
              <VRInstruction
                text={t(practicePromptKey({ ready, celebrating, inVR: true, inputMethod }), lang)}
              />
              {/* the warm-up is exactly where a facilitator works out which
                  method a child can use, so the switch matters most here.
                  Well outside the ±30° star arc. */}
              <VRInputSwitch bearingDeg={-62} />
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

/**
 * The warm-up's instruction, inside the world.
 *
 * Every 360 game mirrors its DOM prompt onto a floating panel because an
 * immersive session hides the page entirely — and here it matters more than
 * usual, since this text is the only place the child is told *how* to choose.
 * Sits at bearing 0, above the straight-ahead star, so it is in view at the
 * first target and only a small glance away at the two side ones.
 */
function VRInstruction({ text }: { text: string }) {
  const inSession = useXR((s) => !!s.session)

  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = 256
    return new THREE.CanvasTexture(cv)
  }, [])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')
    if (ctx == null) return
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.beginPath()
    ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, 40)
    ctx.fillStyle = 'rgba(38, 54, 68, 0.86)'
    ctx.fill()
    ctx.fillStyle = '#f2f8fc'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // wrap to two lines: the per-method instructions are full sentences, and a
    // single line would shrink past readability inside the headset
    const font = 'bold 58px "Comic Sans MS", "Noto Sans Malayalam", sans-serif'
    ctx.font = font
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (ctx.measureText(next).width > cv.width - 90 && line) {
        lines.push(line)
        line = w
      } else {
        line = next
      }
    }
    if (line) lines.push(line)

    const lh = 70
    let y = cv.height / 2 - ((lines.length - 1) * lh) / 2
    for (const l of lines) {
      ctx.fillText(l, cv.width / 2, y)
      y += lh
    }
    texture.needsUpdate = true
  }, [text, texture])

  useEffect(() => () => texture.dispose(), [texture])

  if (!inSession) return null
  return (
    <mesh position={[0, 2.75, -STAR_RADIUS]}>
      <planeGeometry args={[3.2, 0.8]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
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
        userData={{ headSelect: true }}
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
