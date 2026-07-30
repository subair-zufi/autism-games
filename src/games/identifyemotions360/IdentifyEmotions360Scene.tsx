import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { HeadSelect } from '../HeadSelect'
import { XRCameraHome } from '../XRCameraHome'
import { HeadSampler } from '../HeadSampler'
import { VRQuitButton } from '../VRQuitButton'
import { VRInputSwitch } from '../VRInputSwitch'
import { VRHudAnchor } from '../VRHudAnchor'
import {
  EYE_Y,
  SCREEN_DISTANCE,
  SCREEN_H,
  SCREEN_W,
  SCREEN_Y,
  CARD_RADIUS,
  CARD_Y,
  CAUSE_RADIUS,
  CAUSE_Y,
  bearingToXZ,
  cardBearingDeg,
  causeBearingDeg,
  dragDistance,
  isDragTail,
  lookDrag,
} from './logic'
import { emotionLabel, displayLangs, type Lang, type LocalizedText } from '../../i18n/strings'
import { emotionMeta, type EmotionId } from '../emotionVocab'

export type CardState = 'idle' | 'correct' | 'wrong' | 'dim' | 'go' | 'tool'

export interface IdentifyEmotions360SceneProps {
  /** the shared <video> element the game drives; shown on the big screen */
  videoEl: HTMLVideoElement | null
  /** re-key the video texture when the clip changes */
  clipSlug: string
  /** true once the clip has frozen on its expressive frame — answering opens */
  frozen: boolean
  /** which sub-question is active */
  stage: 'emotion' | 'cause'
  /** naming stage */
  choices: EmotionId[]
  answer: EmotionId
  wrong: EmotionId[]
  locked: boolean
  onPickEmotion: (id: EmotionId) => void
  /** cause ("why?") stage */
  causeOptions: LocalizedText[] | null
  causeAnswerIndex: number
  causePicked: number | null
  onPickCause: (i: number) => void
  /** advance past the cause stage — the DOM Next button is invisible inside a
   *  headset, so this in-world card is the only way to move on there */
  onNextFromCause: () => void
  /** localized "Next ▶" / "Finish ▶" label for the in-world Next card */
  nextLabel: string
  /**
   * Re-watch the clip up to its freeze. The flat game has always had a
   * "Watch again" button; in here the DOM is invisible, so without this card
   * the only way to see the clip twice inside a headset was to answer wrongly
   * and take the automatic replay — the child had to pay an error to look
   * again at the thing they are being asked about.
   */
  onReplay: () => void
  /** localized "↻ Watch again" label for that card */
  replayLabel: string
  celebrating: boolean
  lang: Lang
  /** HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function IdentifyEmotions360Scene(props: IdentifyEmotions360SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 100 }}
      onCreated={({ camera, gl }) => {
        camera.rotation.order = 'YXZ'
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* a calm, softly-lit room — never dark (a dark room can frighten), but
            not stark either: gentle daylight, muted surfaces */}
        <color attach="background" args={['#e8ecf1']} />
        <ambientLight intensity={0.95} color="#fff8ee" />
        <directionalLight position={[3, 10, 4]} intensity={0.5} color="#fff2dc" />
        <directionalLight position={[-5, 7, -3]} intensity={0.22} color="#eaf1ff" />
        <LookControls />
        <HeadSelect />
        <XRCameraHome />
        <HeadSampler />
        <MediaRoom />
        <BigScreen videoEl={props.videoEl} clipSlug={props.clipSlug} frozen={props.frozen} />
        <AnswerLayer {...props} />
        {props.celebrating && <Celebration />}
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls (same as the other 360 games) ------------- */
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
    const clampPitch = (p: number) => Math.max(-0.4, Math.min(0.4, p))
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

/* ---- the media room ------------------------------------------------------- */
function MediaRoom() {
  const WALL_R = 7
  const WALL_H = 4.5
  return (
    <group>
      {/* floor: warm light wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[WALL_R, 48]} />
        <meshStandardMaterial color="#cdbfa8" />
      </mesh>
      {/* soft muted rug under the child's spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.4]}>
        <circleGeometry args={[2.2, 40]} />
        <meshStandardMaterial color="#b7c3cf" />
      </mesh>
      {/* wraparound wall: light, with a warm wood wainscot band low down */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <cylinderGeometry args={[WALL_R, WALL_R, WALL_H, 40, 1, true]} />
        <meshStandardMaterial color="#e3e7ed" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[WALL_R - 0.02, WALL_R - 0.02, 2.0, 40, 1, true]} />
        <meshStandardMaterial color="#c8ad8c" side={THREE.BackSide} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <circleGeometry args={[WALL_R, 40]} />
        <meshStandardMaterial color="#eef1f5" side={THREE.DoubleSide} />
      </mesh>
      {/* a soft sage accent wall directly behind the screen */}
      <mesh position={[0, SCREEN_Y, -SCREEN_DISTANCE - 0.2]}>
        <planeGeometry args={[SCREEN_W + 2.4, SCREEN_H + 2.0]} />
        <meshStandardMaterial color="#d3ddd2" />
      </mesh>
      {/* a low console beneath the screen */}
      <mesh position={[0, 0.35, -SCREEN_DISTANCE + 0.3]}>
        <boxGeometry args={[SCREEN_W + 0.6, 0.7, 0.5]} />
        <meshStandardMaterial color="#b79d86" />
      </mesh>
      {/* a couple of plants flanking the screen */}
      <Plant x={-(SCREEN_W / 2 + 1.1)} z={-SCREEN_DISTANCE + 0.4} />
      <Plant x={SCREEN_W / 2 + 1.1} z={-SCREEN_DISTANCE + 0.4} />
    </group>
  )
}

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.24, 0.2, 0.6, 12]} />
        <meshStandardMaterial color="#8a8177" />
      </mesh>
      {[
        [0, 0.85, 0, 0.5],
        [0.2, 0.72, 0.12, 0.34],
        [-0.18, 0.7, -0.1, 0.32],
      ].map(([fx, fy, fz, r], i) => (
        <mesh key={i} position={[fx, fy as number, fz]}>
          <sphereGeometry args={[r as number, 12, 12]} />
          <meshStandardMaterial color={i === 0 ? '#5f8f52' : '#6fa860'} />
        </mesh>
      ))}
    </group>
  )
}

/* ---- the big screen ------------------------------------------------------- */
function BigScreen({
  videoEl,
  clipSlug,
  frozen,
}: {
  videoEl: HTMLVideoElement | null
  clipSlug: string
  frozen: boolean
}) {
  // one VideoTexture per clip element; re-created if the element or clip changes
  const texture = useMemo(() => {
    if (!videoEl) return null
    const tex = new THREE.VideoTexture(videoEl)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    return tex
    // clipSlug re-keys so a new clip on the same element refreshes the texture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl, clipSlug])

  useFrame(() => {
    // keep the frozen last frame crisp; VideoTexture auto-updates while playing
    if (texture && videoEl && !videoEl.paused) texture.needsUpdate = true
  })

  return (
    <group position={[0, SCREEN_Y, -SCREEN_DISTANCE]}>
      {/* bezel, sat clearly behind the picture so the two never z-fight */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[SCREEN_W + 0.18, SCREEN_H + 0.18, 0.1]} />
        <meshStandardMaterial
          color="#15181d"
          emissive={frozen ? '#f4b740' : '#000000'}
          emissiveIntensity={frozen ? 0.25 : 0}
        />
      </mesh>
      {/* the picture */}
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#0d0f12" />
        )}
      </mesh>
    </group>
  )
}

/* ---- answer cards --------------------------------------------------------- */
function AnswerLayer(props: IdentifyEmotions360SceneProps) {
  const { frozen, stage, choices, answer, wrong, locked, onPickEmotion } = props
  const { causeOptions, causeAnswerIndex, causePicked, onPickCause, lang } = props
  const { onNextFromCause, nextLabel, onReplay, replayLabel } = props
  if (!frozen) return null

  if (stage === 'cause' && causeOptions) {
    const n = causeOptions.length
    return (
      <group>
        {causeOptions.map((opt, i) => {
          const state: CardState =
            causePicked === null
              ? 'idle'
              : i === causeAnswerIndex
                ? 'correct'
                : i === causePicked
                  ? 'wrong'
                  : 'dim'
          return (
            <TextCard
              key={i}
              bearingDeg={causeBearingDeg(i, n)}
              radius={CAUSE_RADIUS}
              y={CAUSE_Y}
              width={1.25}
              height={1.0}
              lines={displayLangs(lang).map((l) => opt[l])}
              state={state}
              disabled={causePicked !== null}
              onTap={() => onPickCause(i)}
            />
          )
        })}
        {/* the DOM Next button is invisible inside a headset (review V-note),
            so once the cause is answered this in-world card is the only way
            to move on in VR — sits low, straight ahead, clear of the
            sentence cards above it */}
        {causePicked !== null && (
          <TextCard
            bearingDeg={0}
            radius={CAUSE_RADIUS - 0.6}
            y={0.4}
            width={0.9}
            height={0.42}
            lines={[nextLabel]}
            state="go"
            disabled={false}
            onTap={onNextFromCause}
          />
        )}
      </group>
    )
  }

  const n = choices.length
  return (
    <group>
      {choices.map((id, i) => {
        const isWrong = wrong.includes(id)
        const state: CardState = locked && id === answer ? 'correct' : isWrong ? 'wrong' : 'idle'
        return (
          <TextCard
            key={id}
            bearingDeg={cardBearingDeg(i, n)}
            radius={CARD_RADIUS}
            y={CARD_Y}
            width={0.66}
            height={0.62}
            emoji={emotionMeta(id).emoji}
            lines={displayLangs(lang).map((l) => emotionLabel(id, l))}
            state={state}
            disabled={locked || isWrong}
            onTap={() => onPickEmotion(id)}
          />
        )
      })}
      {/* "Watch again", just outside the answer row on the right — the Quit
          button and mode switch own the left corner, so this side is clear.
          Sits at the answer cards' own height so reaching it is a turn, not a
          look down, and 4 choices only reach +31.5° so it never crowds them. */}
      <TextCard
        bearingDeg={42}
        radius={CARD_RADIUS}
        y={CARD_Y}
        width={0.72}
        height={0.34}
        lines={[replayLabel]}
        state="tool"
        disabled={locked}
        onTap={onReplay}
      />
    </group>
  )
}

const STATE_BORDER: Record<CardState, string> = {
  idle: '#c9cdd6',
  correct: '#22c55e',
  wrong: '#ef6a5e',
  dim: '#9aa0ab',
  go: '#7fb6a4', // matches the DOM Next button's --accent, for the in-world twin
  // "Watch again" is a tool, not an answer — a distinct blue so a child
  // scanning the row never reads it as one more feeling to choose from
  tool: '#5b8bc4',
}

/** Break `text` into lines that each fit `maxWidth` at the current ctx font.
 *  Words are split on whitespace — Malayalam separates words with spaces too,
 *  so a long "why?" sentence flows onto several lines instead of one squashed,
 *  unreadable line. */
function wrapToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const out: string[] = []
  let cur = words[0]
  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`
    if (ctx.measureText(next).width <= maxWidth) cur = next
    else {
      out.push(cur)
      cur = words[i]
    }
  }
  out.push(cur)
  return out
}

function TextCard({
  bearingDeg,
  radius,
  y,
  width,
  height,
  emoji,
  lines,
  state,
  disabled,
  onTap,
}: {
  /** signed bearing (deg) and distance (m) of the card, and its centre height */
  bearingDeg: number
  radius: number
  y: number
  width: number
  height: number
  emoji?: string
  lines: string[]
  state: CardState
  disabled: boolean
  onTap: () => void
}) {
  const bearingRad = (bearingDeg * Math.PI) / 180
  const [x, z] = bearingToXZ(bearingRad, radius)

  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = Math.round((512 * height) / width)
    return new THREE.CanvasTexture(cv)
  }, [width, height])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const r = cv.height * 0.16
    // card face
    ctx.beginPath()
    ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, r)
    ctx.fillStyle = state === 'dim' ? 'rgba(244,246,250,0.55)' : state === 'go' ? STATE_BORDER.go : '#f8fafc'
    ctx.fill()
    // colored border by state
    ctx.lineWidth = state === 'idle' ? 8 : 14
    ctx.strokeStyle = STATE_BORDER[state]
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = state === 'go' ? '#ffffff' : '#2a2f3a'
    const cx = cv.width / 2
    const pad = Math.round(cv.width * 0.09)
    const maxW = cv.width - pad * 2

    // emoji (emotion-naming cards) sits up top; the label area is what remains
    let regionTop = pad
    if (emoji) {
      ctx.font = `${Math.round(cv.height * 0.34)}px "Comic Sans MS", sans-serif`
      ctx.fillText(emoji, cx, cv.height * 0.32)
      regionTop = cv.height * 0.52
    }
    const regionH = cv.height - pad - regionTop

    // shrink the font until the word-wrapped block fits the card's width AND
    // height — so a one-word label stays big, a whole sentence wraps and fits
    const text = lines.join('  ').trim()
    let size = Math.round(cv.height * (emoji ? 0.18 : 0.15))
    let wrapped = [text]
    for (; size >= 13; size -= 2) {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      wrapped = wrapToWidth(ctx, text, maxW)
      const lh = size * 1.28
      const fits = wrapped.length * lh <= regionH && wrapped.every((l) => ctx.measureText(l).width <= maxW)
      if (fits) break
    }
    ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
    const lh = size * 1.28
    let ly = regionTop + (regionH - wrapped.length * lh) / 2 + lh / 2
    for (const l of wrapped) {
      ctx.fillText(l, cx, ly)
      ly += lh
    }
    texture.needsUpdate = true
  }, [texture, emoji, lines, state])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group position={[x, y, z]} rotation={[0, -bearingRad, 0]}>
      <mesh
        // a spent card must not arm the gaze reticle, or the child gets a
        // "ready" signal for a selection that does nothing
        userData={{ headSelect: !disabled }}
        onClick={(e) => {
          e.stopPropagation()
          if (disabled || isDragTail() || dragDistance(e) > 8) return
          onTap()
        }}
        onPointerOver={() => !disabled && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}

/* ---- celebration + VR HUD ------------------------------------------------- */
function Celebration() {
  const spark = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (spark.current) {
      const t = s.clock.elapsedTime
      spark.current.rotation.y = t * 2.4
      spark.current.scale.setScalar(1 + Math.sin(t * 6) * 0.25)
    }
  })
  return (
    <mesh ref={spark} position={[0, SCREEN_Y + SCREEN_H / 2 + 0.4, -SCREEN_DISTANCE]}>
      <octahedronGeometry args={[0.22]} />
      <meshBasicMaterial color="#f4b740" />
    </mesh>
  )
}

function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  // Both HUD lines sit ABOVE the screen (a marquee), right where the child is
  // already looking. The question must never go below the screen — the console
  // and the answer cards live there and would bury it (that hid the prompt in
  // VR). The prompt is the prominent line just above the picture; the score
  // rides a little higher. Quit rides higher still, for the same reason.
  const topY = SCREEN_Y + SCREEN_H / 2
  const z = -SCREEN_DISTANCE + 0.2
  return (
    <VRHudAnchor designEyeY={EYE_Y}>
      <TextPanel text={prompt} position={[0, topY + 0.45, z]} width={3.8} height={0.64} font={64} />
      <TextPanel text={score} position={[0, topY + 1.08, z]} width={1.8} height={0.44} font={88} />
      {/* just left of the outermost answer card (≈−24°) — clear of screen & cards */}
      <VRQuitButton bearingDeg={-42} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-42} />
    </VRHudAnchor>
  )
}

function TextPanel({
  text,
  position,
  width,
  height,
  font,
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  font: number
}) {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = Math.round((1024 * height) / width)
    return new THREE.CanvasTexture(cv)
  }, [width, height])
  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const r = cv.height * 0.3
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = 'rgba(20, 24, 30, 0.82)'
    ctx.fill()
    ctx.fillStyle = '#f5f7fb'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = font
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 4
    } while (ctx.measureText(text).width > cv.width - 90 && size > 24)
    ctx.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [text, font, texture])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}
