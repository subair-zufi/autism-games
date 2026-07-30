import { useEffect, useMemo, useRef, useState } from 'react'
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
  BLOCK_H,
  BLOCK_W,
  PARK_BEARING,
  PARK_RADIUS,
  TABLE_H,
  TABLE_R,
  TABLE_RADIUS,
  TOWER_BEARING,
  TOWER_MAX,
  TOWER_RADIUS,
  TRAY_BEARING,
  TRAY_RADIUS,
  bearingToXZ,
  blockY,
  dragDistance,
  isDragTail,
  landmarkXZ,
  lookDrag,
  peerPosition,
  type Player,
  type TurnSpec,
} from './logic'

/** the child's eye height — seated at the play table, at the room's centre */
const EYE_Y = 1.6

export interface Playroom360SceneProps {
  players: Player[]
  /** blocks already on the tower (all turns completed so far) */
  placed: TurnSpec[]
  activeIndex: number
  reaching: boolean
  /** a friend is building and the child is up next — pulse the child's block */
  childNext: boolean
  /** the child may act now (their turn, no hand-off pending) */
  childTurn: boolean
  /** the child's upcoming block (colour/offset); null once the game is over */
  nextChildSpec: TurnSpec | null
  /** friend the child must tap to pass the turn, or null */
  handoffIndex: number | null
  onPlace: () => void
  onIllegal: () => void
  onHandoff: () => void
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** "Tap me!" bubble line over the hand-off friend (already in the chosen language) */
  bubbleTap: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function Playroom360Scene(props: Playroom360SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 60 }}
      onCreated={({ camera }) => {
        // yaw-then-pitch so dragging sideways always spins the room level
        camera.rotation.order = 'YXZ'
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* warm indoor light so the playroom feels cosy, never gloomy */}
        <color attach="background" args={['#f7e7cf']} />
        <ambientLight intensity={0.75} color="#fff4e2" />
        <directionalLight position={[3, 5, 2]} intensity={0.8} color="#fff2d8" />
        <directionalLight position={[-4, 4, -3]} intensity={0.3} />
        {/* the pendant lamp over the play table */}
        <pointLight position={[0, 2.7, -TABLE_RADIUS]} intensity={22} color="#ffe9c4" distance={9} />
        <LookControls />
        <HeadSelect />
        <XRCameraHome />
        <HeadSampler />
        <PlayroomRoom />
        <SceneInner {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls ------------------------------------------
 * Same controls as Museum 360 / Football 360: the camera never moves — the
 * child sits at the play table and drags (touch or mouse) or scrolls to turn
 * their view, like a panorama viewer. Pitch is clamped so the room never
 * flips; motion is damped so turning feels smooth, not jumpy (gentler for
 * sensory comfort).
 */
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
    const clampPitch = (p: number) => Math.max(-0.55, Math.min(0.35, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the room left, so the view turns right
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
    // inside a VR session the headset owns the camera — a real head turn IS
    // the look-around, so the drag controls stand down entirely
    if (state.gl.xr.isPresenting) return
    const v = view.current
    const k = Math.min(1, dt * 9)
    v.yaw += (v.tYaw - v.yaw) * k
    v.pitch += (v.tPitch - v.pitch) * k
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

/* ---- in-world HUD for VR --------------------------------------------------
 * The DOM score bar and prompt banner cannot be seen inside an immersive
 * session, so the same lines are mirrored on floating panels at bearing 0 —
 * above the friends, the natural "home" direction of the play table.
 */
function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <VRHudAnchor designEyeY={EYE_Y}>
      <TextPanel text={score} position={[0, 3.02, -6.4]} width={2.2} height={0.5} font={110} />
      <TextPanel text={prompt} position={[0, 2.45, -6.4]} width={4.4} height={0.72} font={64} />
      {/* just left of the outermost seated peer (≈−31°) — clear of the table */}
      <VRQuitButton bearingDeg={-48} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-48} />
    </VRHudAnchor>
  )
}

/**
 * A rounded panel with centred text, drawn to a CanvasTexture — no font assets
 * needed, and the browser's own fonts cover Malayalam script too. Doubles as
 * the in-world name tags and the "Tap me!" bubble (drei Html overlays are
 * invisible inside a VR session, so everything textual lives in the 3D world).
 */
function TextPanel({
  text,
  position,
  width,
  height,
  font,
  bg = 'rgba(58, 44, 30, 0.82)',
  fg = '#fdf6ec',
  rotY = 0,
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  font: number
  bg?: string
  fg?: string
  rotY?: number
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
    ctx.fillStyle = bg
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = font
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 4
    } while (ctx.measureText(text).width > cv.width - 90 && size > 24)
    ctx.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [text, font, bg, fg, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} rotation={[0, rotY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/* ---- the playroom: floor, walls, windows, shelves, toys --------------------
 * Everything playable stays in the front half-circle; the back half is cosy
 * decor (door, posters, a teddy) so looking around is rewarding but never
 * required for play.
 */
const ROOM_R = 7.5
const WALL_H = 3.4

/** a small helper: put a decor group on the wall at a bearing, facing the child */
function wallSpot(bearingDeg: number, radius = ROOM_R - 0.06): { pos: [number, number]; rotY: number } {
  const a = (bearingDeg * Math.PI) / 180
  const [x, z] = bearingToXZ(a, radius)
  return { pos: [x, z], rotY: Math.atan2(-x, -z) }
}

function Window({ bearingDeg }: { bearingDeg: number }) {
  const { pos, rotY } = wallSpot(bearingDeg)
  return (
    <group position={[pos[0], 1.9, pos[1]]} rotation={[0, rotY, 0]}>
      {/* sunny sky behind the glass */}
      <mesh>
        <planeGeometry args={[1.7, 1.25]} />
        <meshBasicMaterial color="#aee3f7" />
      </mesh>
      {/* a soft cloud */}
      <mesh position={[0.3, 0.18, 0.005]} scale={[0.34, 0.14, 1]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* frame + cross bars + sill */}
      {[
        [0, 0.655, 1.86, 0.09],
        [0, -0.655, 1.86, 0.09],
        [-0.885, 0, 0.09, 1.4],
        [0.885, 0, 0.09, 1.4],
        [0, 0, 1.86, 0.06],
        [0, 0, 0.06, 1.4],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]}>
          <boxGeometry args={[w, h, 0.05]} />
          <meshStandardMaterial color="#fbf6ec" />
        </mesh>
      ))}
      <mesh position={[0, -0.75, 0.09]}>
        <boxGeometry args={[2.0, 0.08, 0.22]} />
        <meshStandardMaterial color="#e6d3b3" />
      </mesh>
    </group>
  )
}

function ToyShelf({ bearingDeg }: { bearingDeg: number }) {
  const { pos, rotY } = wallSpot(bearingDeg, ROOM_R - 0.55)
  const toyColors = ['#e2554c', '#5aa9e6', '#f5c542', '#7ac74f', '#b06fd6', '#f08a3c']
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, rotY, 0]}>
      {/* frame */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[2.0, 1.8, 0.36]} />
        <meshStandardMaterial color="#c98a5b" />
      </mesh>
      {/* two shelf openings with toys */}
      {[0.52, 1.28].map((y, row) => (
        <group key={row}>
          <mesh position={[0, y, 0.06]}>
            <boxGeometry args={[1.8, 0.62, 0.3]} />
            <meshStandardMaterial color="#f3e0c2" />
          </mesh>
          {[-0.6, 0, 0.6].map((x, col) => {
            const c = toyColors[(row * 3 + col + 3) % toyColors.length]
            return col % 2 === row % 2 ? (
              <mesh key={col} position={[x, y - 0.1, 0.16]}>
                <boxGeometry args={[0.24, 0.24, 0.24]} />
                <meshStandardMaterial color={c} />
              </mesh>
            ) : (
              <mesh key={col} position={[x, y - 0.08, 0.16]}>
                <sphereGeometry args={[0.14, 14, 14]} />
                <meshStandardMaterial color={c} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

/** the classic sitting teddy in the back corner — pure decor */
function Teddy({ bearingDeg, radius }: { bearingDeg: number; radius: number }) {
  const { pos, rotY } = wallSpot(bearingDeg, radius)
  const fur = '#a9744f'
  const muzzle = '#d9b08c'
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.34, 0]} scale={[1, 1.15, 0.85]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.16, 0.16]} rotation={[0.5, 0, x > 0 ? -0.5 : 0.5]} scale={[1, 1, 2]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0.02]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 1.03, 0]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      ))}
      <mesh position={[0, 0.8, 0.18]} scale={[1, 0.8, 0.7]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={muzzle} />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.9, 0.2]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#2b2620" />
        </mesh>
      ))}
      <mesh position={[0, 0.83, 0.27]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#3a2c20" />
      </mesh>
    </group>
  )
}

/** a bright rubber ball left on the floor — decor only */
function FloorBall({ bearingDeg, radius }: { bearingDeg: number; radius: number }) {
  const [x, z] = bearingToXZ((bearingDeg * Math.PI) / 180, radius)
  return (
    <mesh position={[x, 0.24, z]}>
      <sphereGeometry args={[0.24, 18, 18]} />
      <meshStandardMaterial color="#e2554c" />
    </mesh>
  )
}

function PlayroomRoom() {
  const door = wallSpot(180)
  const posterA = wallSpot(126)
  const posterB = wallSpot(-126)
  return (
    <group>
      {/* wooden floor with soft plank stripes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[ROOM_R + 0.5, 56]} />
        <meshStandardMaterial color="#d9b98a" roughness={0.9} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -ROOM_R + 1 + i * 1.9]}>
          <planeGeometry args={[ROOM_R * 2, 0.95]} />
          <meshStandardMaterial color={i % 2 ? '#d3b184' : '#e0c093'} roughness={0.9} />
        </mesh>
      ))}

      {/* round play rug under the table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -TABLE_RADIUS]}>
        <circleGeometry args={[2.4, 40]} />
        <meshStandardMaterial color="#7fb8a4" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, -TABLE_RADIUS]}>
        <ringGeometry args={[1.85, 2.15, 40]} />
        <meshStandardMaterial color="#f4d06f" roughness={0.95} />
      </mesh>

      {/* walls: pastel top, warmer wainscot band, skirting */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <cylinderGeometry args={[ROOM_R, ROOM_R, WALL_H, 56, 1, true]} />
        <meshStandardMaterial color="#fdeacc" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[ROOM_R - 0.015, ROOM_R - 0.015, 0.9, 56, 1, true]} />
        <meshStandardMaterial color="#ecc99b" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[ROOM_R - 0.03, ROOM_R - 0.03, 0.12, 56, 1, true]} />
        <meshStandardMaterial color="#c9a06e" side={THREE.BackSide} />
      </mesh>

      {/* ceiling + pendant lamp over the table */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <circleGeometry args={[ROOM_R + 0.5, 56]} />
        <meshStandardMaterial color="#fff6e6" />
      </mesh>
      <group position={[0, 0, -TABLE_RADIUS]}>
        <mesh position={[0, WALL_H - 0.14, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.28, 6]} />
          <meshStandardMaterial color="#5c4a38" />
        </mesh>
        <mesh position={[0, WALL_H - 0.32, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.2, 0.18, 20, 1, true]} />
          <meshStandardMaterial color="#f6c65e" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, WALL_H - 0.38, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color="#fff3c4" emissive="#ffe9a8" emissiveIntensity={1.6} />
        </mesh>
      </group>

      {/* party bunting swooping across the front wall, over the friends */}
      {Array.from({ length: 13 }, (_, i) => {
        const b = -54 + i * 9
        const a = (b * Math.PI) / 180
        const [x, z] = bearingToXZ(a, ROOM_R - 0.12)
        const droop = Math.abs(Math.sin((i / 12) * Math.PI * 2)) * 0.16
        return (
          <mesh key={i} position={[x, 2.55 - droop, z]} rotation={[Math.PI, Math.atan2(-x, -z), 0]}>
            <coneGeometry args={[0.11, 0.26, 3]} />
            <meshStandardMaterial
              color={['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6'][i % 5]}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}

      {/* sunny windows on both sides */}
      <Window bearingDeg={-95} />
      <Window bearingDeg={95} />

      {/* toy shelves flanking the back half */}
      <ToyShelf bearingDeg={-142} />
      <ToyShelf bearingDeg={142} />

      {/* the playroom door, behind the child */}
      <group position={[door.pos[0], 0, door.pos[1]]} rotation={[0, door.rotY, 0]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[1.1, 2.2, 0.08]} />
          <meshStandardMaterial color="#b07a4e" />
        </mesh>
        <mesh position={[0, 1.1, 0.045]}>
          <planeGeometry args={[0.86, 1.96]} />
          <meshStandardMaterial color="#c08a5c" />
        </mesh>
        <mesh position={[0.4, 1.05, 0.07]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#e8c15c" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* cheerful posters on the back walls */}
      <TextPanel
        text="A B C"
        position={[posterA.pos[0], 2.1, posterA.pos[1]]}
        rotY={posterA.rotY}
        width={1.2}
        height={0.9}
        font={200}
        bg="rgba(255, 251, 240, 0.96)"
        fg="#e2554c"
      />
      <TextPanel
        text="★ ● ▲"
        position={[posterB.pos[0], 2.1, posterB.pos[1]]}
        rotY={posterB.rotY}
        width={1.2}
        height={0.9}
        font={170}
        bg="rgba(255, 251, 240, 0.96)"
        fg="#5aa9e6"
      />

      {/* toys resting around the back half — decor only */}
      <Teddy bearingDeg={-165} radius={6.1} />
      <FloorBall bearingDeg={162} radius={5.9} />
      {[0, 1, 2].map((i) => {
        const [x, z] = bearingToXZ(((150 - i * 4) * Math.PI) / 180, 6.2)
        return (
          <mesh key={i} position={[x + i * 0.1, 0.09 + (i === 2 ? 0.18 : 0), z]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color={['#5aa9e6', '#f5c542', '#7ac74f'][i]} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ---- the play: table, tower, the child's block, the friends ----------------- */

function SceneInner(props: Playroom360SceneProps) {
  const { players, placed, activeIndex, reaching, childNext, childTurn, nextChildSpec, handoffIndex, onPlace, onIllegal, onHandoff, bubbleTap } = props

  // Completed towers are set aside as minis so the active stack stays short
  // and no friend's face ever hides behind it.
  const doneCount = Math.floor(placed.length / TOWER_MAX)
  const current = placed.slice(doneCount * TOWER_MAX)
  const finished: TurnSpec[][] = []
  for (let k = 0; k < doneCount; k++) finished.push(placed.slice(k * TOWER_MAX, (k + 1) * TOWER_MAX))

  const [towerX, towerZ] = landmarkXZ(TOWER_BEARING, TOWER_RADIUS)
  const [tableX, tableZ] = landmarkXZ(0, TABLE_RADIUS)

  return (
    <group>
      <PlayTable x={tableX} z={tableZ} />

      {/* active tower */}
      {current.map((spec, i) => (
        <Block key={doneCount * TOWER_MAX + i} spec={spec} index={i} x={towerX} z={towerZ} fresh={i === current.length - 1} />
      ))}

      {/* completed towers, shrunk and parked along the right table edge */}
      {finished.map((specs, k) => (
        <MiniTower key={k} specs={specs} slot={k} />
      ))}

      {/* the child's own block, waiting on the near table edge */}
      {nextChildSpec && (
        <ChildBlock
          spec={nextChildSpec}
          canAct={childTurn}
          anticipating={childNext}
          onPlace={onPlace}
          onIllegal={onIllegal}
        />
      )}

      {/* the friends, gathered around the play table */}
      {players.map((player, i) => {
        if (player.kind === 'child') return null // first person: the camera IS the child
        const [x, z] = peerPosition(i, players.length)
        return (
          <Kid360
            key={player.id}
            player={player}
            x={x}
            z={z}
            active={i === activeIndex}
            reaching={i === activeIndex && reaching}
            handoffTarget={i === handoffIndex}
            bubbleTap={bubbleTap}
            onTap={() => onHandoff()}
          />
        )
      })}
    </group>
  )
}

/** the round play table the tower is built on */
function PlayTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, TABLE_H - 0.03, 0]}>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.06, 40]} />
        <meshStandardMaterial color="#e0b57f" roughness={0.7} />
      </mesh>
      <mesh position={[0, TABLE_H - 0.075, 0]}>
        <cylinderGeometry args={[TABLE_R - 0.02, TABLE_R - 0.02, 0.035, 40]} />
        <meshStandardMaterial color="#c98a5b" roughness={0.8} />
      </mesh>
      {[45, 135, 225, 315].map((b) => {
        const a = (b * Math.PI) / 180
        return (
          <mesh key={b} position={[Math.sin(a) * (TABLE_R - 0.22), (TABLE_H - 0.09) / 2, Math.cos(a) * (TABLE_R - 0.22)]}>
            <cylinderGeometry args={[0.05, 0.06, TABLE_H - 0.09, 10]} />
            <meshStandardMaterial color="#a9764c" />
          </mesh>
        )
      })}
    </group>
  )
}

function Block({ spec, index, x, z, fresh }: { spec: TurnSpec; index: number; x: number; z: number; fresh: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const drop = useRef(fresh ? 1 : 0)
  const y = blockY(index)
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    if (drop.current > 0) {
      drop.current = Math.max(0, drop.current - dt * 3)
      m.position.y = y + drop.current * 0.7
      const s = 1 + drop.current * 0.1
      m.scale.set(s, 1, s)
    } else {
      m.position.y = y
      m.scale.set(1, 1, 1)
    }
  })
  return (
    <mesh ref={ref} position={[x + spec.offset, y, z]}>
      <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_W]} />
      <meshStandardMaterial color={spec.color} roughness={0.6} />
    </mesh>
  )
}

/** A finished tower parked small along the right edge of the table. */
function MiniTower({ specs, slot }: { specs: TurnSpec[]; slot: number }) {
  const [px, pz] = landmarkXZ(PARK_BEARING + slot * 9, PARK_RADIUS)
  return (
    <group position={[px, TABLE_H, pz]} scale={0.3}>
      {specs.map((s, i) => (
        <mesh key={i} position={[s.offset, BLOCK_H / 2 + i * BLOCK_H, 0]}>
          <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_W]} />
          <meshStandardMaterial color={s.color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The child's own block, resting on the near table edge. It glows and bounces
 * on the child's turn; a tap places it on the tower (the same single-tap on
 * every level — and the same tap works as a controller-ray click in VR).
 * Tapping it out of turn shakes it and reports an impatient tap — no-fail,
 * only redirected.
 */
function ChildBlock({
  spec,
  canAct,
  anticipating,
  onPlace,
  onIllegal,
}: {
  spec: TurnSpec
  canAct: boolean
  anticipating: boolean
  onPlace: () => void
  onIllegal: () => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const [homeX, homeZ] = useMemo(() => landmarkXZ(TRAY_BEARING, TRAY_RADIUS), [])
  const restY = TABLE_H + BLOCK_H / 2
  const shake = useRef(0)

  useFrame((state, dt) => {
    const m = ref.current
    if (!m) return
    const bounce = canAct ? Math.abs(Math.sin(state.clock.elapsedTime * 2.5)) * 0.05 : 0
    m.position.set(homeX, restY + bounce, homeZ)
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt * 3)
      m.position.x += Math.sin(state.clock.elapsedTime * 40) * shake.current * 0.04
    }
    const mat = m.material as THREE.MeshStandardMaterial
    const glow = canAct
      ? 0.35 + Math.sin(state.clock.elapsedTime * 4) * 0.15
      : anticipating
        ? 0.15 + Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.15
        : 0
    mat.emissiveIntensity += (glow - mat.emissiveIntensity) * 0.2
  })

  return (
    <mesh
      ref={ref}
      position={[homeX, restY, homeZ]}
      // stays selectable even when it is not this child's turn: tapping out of
      // turn is a real answer here, scored as an illegal move
      userData={{ headSelect: true }}
      onClick={(e) => {
        e.stopPropagation()
        if (isDragTail() || dragDistance(e) > 8) return
        if (!canAct) {
          shake.current = 1
          onIllegal()
          return
        }
        onPlace()
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_W]} />
      <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={0} roughness={0.6} />
    </mesh>
  )
}

/**
 * A friend at the play table — the same body plan as the other 360 games but
 * dressed for a genuine kid look: neck, ears, brows, a smile, sleeves with
 * skin forearms, shorts over bare shins, and shoes. The active friend glows,
 * bobs and reaches over the table to set their block; the hand-off friend
 * raises both hands with a pulsing ring ("tap me to pass the turn").
 */
function Kid360({
  player,
  x,
  z,
  active,
  reaching,
  handoffTarget,
  bubbleTap,
  onTap,
}: {
  player: Player
  x: number
  z: number
  active: boolean
  reaching: boolean
  handoffTarget: boolean
  bubbleTap: string
  onTap: () => void
}) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const shirtMat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const look = player.look
  const phase = x * 1.7
  // friends face the child at the table (panels always do, whatever the body sways)
  const faceChild = Math.atan2(-x, -z)
  const initialized = useRef(false)

  useFrame((state) => {
    const grp = g.current
    if (!grp) return
    if (!initialized.current && body.current) {
      body.current.rotation.y = faceChild
      initialized.current = true
    }
    const t = state.clock.elapsedTime
    const targetScale = (active || handoffTarget ? 1.06 : 1) * (hover && handoffTarget ? 1.05 : 1)
    grp.scale.setScalar(grp.scale.x + (targetScale - grp.scale.x) * 0.1)
    const hop = handoffTarget ? Math.abs(Math.sin(t * 4)) * 0.06 : active ? Math.abs(Math.sin(t * 3)) * 0.04 : 0
    grp.position.y += (hop - grp.position.y) * 0.12

    const b = body.current
    if (b) {
      b.rotation.y = faceChild + Math.sin(t * 0.9 + phase) * 0.04
      const lean = reaching ? -0.3 : 0
      b.rotation.x += (lean - b.rotation.x) * 0.1
    }
    const raiseL = handoffTarget ? -2.5 : Math.sin(t * 1.1 + phase) * 0.06
    const raiseR = handoffTarget ? -2.5 : reaching ? -1.5 : Math.sin(t * 1.05 + phase) * 0.06
    if (armL.current) armL.current.rotation.x += (raiseL - armL.current.rotation.x) * 0.12
    if (armR.current) armR.current.rotation.x += (raiseR - armR.current.rotation.x) * 0.12

    if (shirtMat.current) {
      const glow = active ? 0.35 : handoffTarget ? 0.25 + Math.abs(Math.sin(t * 4)) * 0.2 : 0
      shirtMat.current.emissiveIntensity += (glow - shirtMat.current.emissiveIntensity) * 0.2
    }
    if (ring.current) {
      const s = 1 + Math.sin(t * 4) * 0.12
      ring.current.scale.setScalar(s)
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 + Math.sin(t * 4) * 0.2
    }
  })

  return (
    <group position={[x, 0, z]}>
      <group ref={g}>
        {/* hand-off cue: pulsing ring at the friend's feet */}
        {handoffTarget && (
          <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.4, 0.54, 32]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} />
          </mesh>
        )}
        <group ref={body}>
          {/* shoes, bare shins, shorts */}
          {[-0.08, 0.08].map((lx) => (
            <group key={lx}>
              <mesh position={[lx, 0.035, 0.03]}>
                <boxGeometry args={[0.12, 0.07, 0.2]} />
                <meshStandardMaterial color="#494d52" />
              </mesh>
              <mesh position={[lx, 0.22, 0]}>
                <cylinderGeometry args={[0.04, 0.045, 0.3, 10]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
              <mesh position={[lx, 0.45, 0]}>
                <cylinderGeometry args={[0.058, 0.062, 0.22, 10]} />
                <meshStandardMaterial color={look.pants} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.22, 0.14, 0.15]} />
            <meshStandardMaterial color={look.pants} />
          </mesh>
          {/* torso (t-shirt) */}
          <mesh position={[0, 0.82, 0]}>
            <capsuleGeometry args={[0.13, 0.3, 6, 14]} />
            <meshStandardMaterial ref={shirtMat} color={look.shirt} emissive={look.shirt} emissiveIntensity={0} />
          </mesh>
          {/* arms: short sleeve flowing into a bare forearm and hand */}
          {[
            { side: -0.17 as number, ref: armL },
            { side: 0.17 as number, ref: armR },
          ].map(({ side, ref }) => (
            <group key={side} ref={ref} position={[side, 0.99, 0]}>
              <mesh position={[0, -0.08, 0]} rotation={[0, 0, side > 0 ? -0.12 : 0.12]}>
                <cylinderGeometry args={[0.048, 0.042, 0.18, 10]} />
                <meshStandardMaterial color={look.shirt} />
              </mesh>
              <mesh position={[side > 0 ? 0.02 : -0.02, -0.26, 0]} rotation={[0, 0, side > 0 ? -0.12 : 0.12]}>
                <cylinderGeometry args={[0.034, 0.03, 0.2, 10]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
              <mesh position={[side > 0 ? 0.033 : -0.033, -0.38, 0]}>
                <sphereGeometry args={[0.042, 10, 10]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
            </group>
          ))}
          {/* neck + head */}
          <mesh position={[0, 1.08, 0]}>
            <cylinderGeometry args={[0.05, 0.055, 0.09, 10]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          <mesh position={[0, 1.27, 0]}>
            <sphereGeometry args={[0.15, 20, 20]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          {[-0.145, 0.145].map((ex) => (
            <mesh key={ex} position={[ex, 1.27, 0]}>
              <sphereGeometry args={[0.032, 10, 10]} />
              <meshStandardMaterial color={look.skin} />
            </mesh>
          ))}
          {/* hair: cap + fringe (+ long hair at the back) */}
          <mesh position={[0, 1.335, -0.02]} scale={[1, 0.75, 1]}>
            <sphereGeometry args={[0.16, 18, 18]} />
            <meshStandardMaterial color={look.hair} />
          </mesh>
          <mesh position={[0, 1.375, 0.115]}>
            <boxGeometry args={[0.2, 0.055, 0.05]} />
            <meshStandardMaterial color={look.hair} />
          </mesh>
          {look.longHair && (
            <mesh position={[0, 1.13, -0.11]}>
              <boxGeometry args={[0.24, 0.32, 0.09]} />
              <meshStandardMaterial color={look.hair} />
            </mesh>
          )}
          {/* face: brows, eyes, nose, smile */}
          {[-0.055, 0.055].map((ex) => (
            <group key={ex}>
              <mesh position={[ex, 1.335, 0.128]}>
                <boxGeometry args={[0.05, 0.012, 0.015]} />
                <meshStandardMaterial color={look.hair} />
              </mesh>
              <mesh position={[ex, 1.295, 0.132]}>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial color="#2b2620" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.255, 0.146]}>
            <sphereGeometry args={[0.017, 8, 8]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          <mesh position={[0, 1.215, 0.132]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.042, 0.009, 8, 12, Math.PI]} />
            <meshStandardMaterial color="#9a5b4a" />
          </mesh>
        </group>

        {/* name tag — a canvas panel (visible in VR too), turned to the child */}
        <TextPanel
          text={player.name}
          position={[0, 1.72, 0]}
          width={0.8}
          height={0.26}
          font={120}
          bg="rgba(255, 255, 255, 0.88)"
          fg="#4a3b2c"
          rotY={faceChild}
        />
        {/* hand-off cue: the friend literally asks for the turn */}
        {handoffTarget && (
          <TextPanel
            text={bubbleTap}
            position={[0, 2.02, 0]}
            width={1.3}
            height={0.36}
            font={110}
            bg="rgba(255, 246, 226, 0.95)"
            fg="#b45309"
            rotY={faceChild}
          />
        )}

        {/* transparent tap target around the whole friend — only bites during a
            hand-off; taps are filtered against look-around drags */}
        {handoffTarget && (
          <mesh
            visible={false}
            position={[0, 0.85, 0]}
            userData={{ headSelect: true }}
            onClick={(e) => {
              e.stopPropagation()
              if (isDragTail() || dragDistance(e) > 8) return
              onTap()
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(true)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHover(false)
              document.body.style.cursor = 'auto'
            }}
          >
            <boxGeometry args={[1.0, 1.9, 0.8]} />
          </mesh>
        )}
      </group>
    </group>
  )
}
