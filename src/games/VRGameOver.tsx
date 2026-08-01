import { useEffect, useMemo, useState } from 'react'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useVrGameOver, type VrGameOverInfo } from './gameOverPanel'
import { exitVrToHome } from './exitVr'

/**
 * The end-of-round results, shown inside VR.
 *
 * The flat `GameOverDialog` cannot be seen from a headset, and the old answer —
 * end the session so the child is back on the page to read it — is exactly what
 * strands them: on this device any `XRSession.end()` costs the browser window
 * (see `gameOverPanel.ts`). So the score stays in-world, with the same three
 * choices the flat dialog offers.
 *
 * Two of the three keep the session alive: **Play again** starts another round,
 * and **Choose level** opens an in-world copy of the level picker. Only **Home**
 * leaves the headset, and it is the one deliberate exit left in the app.
 *
 * Drop one inside each game's `<XR>`, next to `<HeadSelect>`.
 */

/** Distance from the child, metres — closer than any game's activity arc. */
const PANEL_RADIUS = 2.4
const PANEL_Y = 1.45
/** Three buttons across, sized so the row stays inside the board above it. */
const BTN_W = 0.62
const BTN_H = 0.3
const BTN_X = 0.68

export function VRGameOver() {
  const session = useXR((s) => s.session)
  const info = useVrGameOver((s) => s.info)
  if (!session || info == null) return null
  return <Panel info={info} />
}

function Panel({ info }: { info: VrGameOverInfo }) {
  const session = useXR((s) => s.session)
  const hide = useVrGameOver((s) => s.hide)
  const [view, setView] = useState<'results' | 'levels'>('results')

  return (
    <group position={[0, PANEL_Y, -PANEL_RADIUS]}>
      {view === 'results' ? (
        <ResultsView
          info={info}
          onPlayAgain={() => {
            hide()
            info.onPlay()
          }}
          onChooseLevel={() => setView('levels')}
          onHome={() => {
            hide()
            // the single place the app leaves a headset session on purpose
            if (session) void exitVrToHome(session)
          }}
        />
      ) : (
        <LevelsView
          info={info}
          onPlay={() => {
            hide()
            info.onPlay()
          }}
        />
      )}
    </group>
  )
}

function ResultsView({
  info,
  onPlayAgain,
  onChooseLevel,
  onHome,
}: {
  info: VrGameOverInfo
  onPlayAgain: () => void
  onChooseLevel: () => void
  onHome: () => void
}) {
  const board = useCanvasTexture(
    () => resultsTexture(info.headline, info.scoreLine, info.bestLine, info.stars),
    [info.headline, info.scoreLine, info.bestLine, info.stars],
  )
  return (
    <>
      <Board texture={board} />
      <Button label={info.labels.playAgain} tone="primary" x={-BTN_X} y={-0.34} onPick={onPlayAgain} />
      <Button label={info.labels.chooseLevel} tone="plain" x={0} y={-0.34} onPick={onChooseLevel} />
      <Button label={info.labels.home} tone="plain" x={BTN_X} y={-0.34} onPick={onHome} />
    </>
  )
}

/**
 * The flat `StartScreen` picker, in-world. Selecting a level and starting are
 * deliberately two acts — see `onSelectLevel` in `gameOverPanel.ts`.
 */
function LevelsView({ info, onPlay }: { info: VrGameOverInfo; onPlay: () => void }) {
  const board = useCanvasTexture(
    () => titleTexture(info.labels.chooseLevelTitle),
    [info.labels.chooseLevelTitle],
  )
  return (
    <>
      <Board texture={board} />
      {info.levels.map((level, i) => (
        <Button
          key={level.id}
          label={level.label}
          tone={level.id === info.currentLevel ? 'selected' : 'plain'}
          x={(i - 1) * BTN_X}
          y={-0.22}
          onPick={() => info.onSelectLevel(level.id)}
        />
      ))}
      <Button label={info.labels.play} tone="primary" x={0} y={-0.62} width={0.9} onPick={onPlay} />
    </>
  )
}

function Board({ texture }: { texture: THREE.Texture }) {
  return (
    <mesh position={[0, 0.42, 0]}>
      <planeGeometry args={[2.0, 1.15]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

type Tone = 'primary' | 'plain' | 'selected'

function Button({
  label,
  tone,
  x,
  y,
  width = BTN_W,
  onPick,
}: {
  label: string
  tone: Tone
  x: number
  y: number
  width?: number
  onPick: () => void
}) {
  const texture = useCanvasTexture(() => buttonTexture(label, tone), [label, tone])
  return (
    <mesh
      position={[x, y, 0.01]}
      userData={{ headSelect: true }}
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <planeGeometry args={[width, BTN_H]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/** Builds a canvas texture, disposing the previous one whenever it changes. */
function useCanvasTexture(make: () => THREE.CanvasTexture, deps: unknown[]): THREE.CanvasTexture {
  const texture = useMemo(make, deps)
  useEffect(() => () => void texture.dispose(), [texture])
  return texture
}

/* ---- canvas text ----------------------------------------------------------
 * Same approach as every other in-world panel in these games: drawn to a
 * CanvasTexture, so no font assets are needed and the browser's own fonts cover
 * Malayalam script.
 */

const FONT = (px: number) => `bold ${px}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`

function panelBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  ctx.beginPath()
  ctx.roundRect(8, 8, w - 16, h - 16, 44)
  ctx.fillStyle = 'rgba(30, 41, 56, 0.92)'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#7fb2e8'
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

function resultsTexture(
  headline: string,
  scoreLine: string,
  bestLine: string,
  stars?: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 590
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex
  panelBackdrop(ctx, cv.width, cv.height)

  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(72)
  ctx.fillText(headline, cv.width / 2, 130)

  if (stars !== undefined) {
    ctx.font = FONT(84)
    ctx.fillText('⭐'.repeat(Math.max(1, Math.min(3, stars))), cv.width / 2, 250)
  }

  ctx.fillStyle = '#ffe08a'
  ctx.font = FONT(74)
  ctx.fillText(scoreLine, cv.width / 2, stars === undefined ? 290 : 385)

  ctx.fillStyle = '#b9c8dc'
  ctx.font = FONT(50)
  ctx.fillText(bestLine, cv.width / 2, stars === undefined ? 400 : 480)

  tex.needsUpdate = true
  return tex
}

function titleTexture(title: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 590
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex
  panelBackdrop(ctx, cv.width, cv.height)

  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(80)
  ctx.fillText(title, cv.width / 2, cv.height / 2 - 40)
  tex.needsUpdate = true
  return tex
}

function buttonTexture(label: string, tone: Tone): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 190
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex

  const fill =
    tone === 'primary'
      ? 'rgba(46, 160, 100, 0.96)'
      : tone === 'selected'
        ? 'rgba(37, 122, 205, 0.96)'
        : 'rgba(74, 82, 96, 0.94)'

  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.beginPath()
  ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, 52)
  ctx.fillStyle = fill
  ctx.fill()
  // the chosen level has to read at a glance on a headset display, where a
  // difference in fill alone is easy to miss
  ctx.lineWidth = tone === 'selected' ? 14 : 7
  ctx.strokeStyle = tone === 'plain' ? '#9aa3b4' : '#eafff2'
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // labels carry emoji and vary a lot in length; shrink to fit rather than clip
  let px = 62
  ctx.font = FONT(px)
  while (ctx.measureText(label).width > cv.width - 70 && px > 30) {
    px -= 4
    ctx.font = FONT(px)
  }
  ctx.fillText(label, cv.width / 2, cv.height / 2)

  tex.needsUpdate = true
  return tex
}
