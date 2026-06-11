# Phase 2: Emotion Identification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Feelings Faces" game: a 3D low-poly character face shows an emotion; the student taps the matching word+emoji button. +1 point per correct, 3 hearts, friendly summary when hearts run out.

**Architecture:** Pure round-generation logic (`logic.ts`, unit-tested with injectable RNG) separate from presentation. The 3D face is a parametric React Three Fiber component — one set of geometry (head, eyes, brows, mouth) whose positions/rotations/scales are driven by a per-emotion parameter record, with gentle lerp animation between expressions. Game flow component wires StartScreen → play loop → GameOverDialog using the Phase 1 shared kit.

**Tech Stack:** React Three Fiber + drei (already installed), zustand stores, speech + sounds services from Phase 1.

**Spec:** `docs/superpowers/specs/2026-06-10-autism-games-design.md` §4.1

---

## File Structure

```
src/components/WebGLGate.tsx        — shared: friendly message if WebGL unavailable (spec §7)
src/games/emotions/logic.ts         — emotions list, difficulty config, makeRound()
src/games/emotions/logic.test.ts
src/games/emotions/EmotionFace.tsx  — parametric 3D face (R3F)
src/games/emotions/EmotionsGame.tsx — game flow + choice buttons
src/App.tsx                         — route /emotions → EmotionsGame
src/styles/global.css               — choice buttons, celebration, game layout classes
```

### Task 1: Round logic (TDD)

**Files:** Create `src/games/emotions/logic.ts`, `src/games/emotions/logic.test.ts`

- [ ] **Step 1:** Failing tests

```ts
import { expect, test } from 'vitest'
import { EMOTIONS, makeRound } from './logic'

const rng = (seq: number[]) => { let i = 0; return () => seq[i++ % seq.length] }

test('easy rounds have 2 choices from basic emotions', () => {
  const r = makeRound('easy', null, Math.random)
  expect(r.choices).toHaveLength(2)
  expect(r.choices).toContain(r.target)
  for (const c of r.choices) expect(['happy', 'sad', 'angry']).toContain(c)
})

test('medium has 3 choices, hard has 4', () => {
  expect(makeRound('medium', null, Math.random).choices).toHaveLength(3)
  expect(makeRound('hard', null, Math.random).choices).toHaveLength(4)
})

test('choices are unique', () => {
  for (let i = 0; i < 50; i++) {
    const r = makeRound('hard', null, Math.random)
    expect(new Set(r.choices).size).toBe(r.choices.length)
  }
})

test('target never repeats the previous round', () => {
  for (let i = 0; i < 50; i++) {
    expect(makeRound('easy', 'happy', Math.random).target).not.toBe('happy')
  }
})

test('deterministic with seeded rng', () => {
  const r = makeRound('easy', null, rng([0, 0]))
  expect(r.target).toBe(r.choices.find((c) => c === r.target))
})

test('every emotion has display metadata', () => {
  for (const e of EMOTIONS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
})
```

- [ ] **Step 2:** Run `npm test -- emotions` — expect FAIL.
- [ ] **Step 3:** Implement

```ts
import type { Difficulty } from '../../types'

export type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'calm'

export interface EmotionMeta { id: EmotionId; label: string; emoji: string }

export const EMOTIONS: EmotionMeta[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'surprised', label: 'Surprised', emoji: '😮' },
  { id: 'scared', label: 'Scared', emoji: '😨' },
  { id: 'calm', label: 'Calm', emoji: '😌' },
]

const POOLS: Record<Difficulty, EmotionId[]> = {
  easy: ['happy', 'sad', 'angry'],
  medium: ['happy', 'sad', 'angry', 'surprised', 'scared'],
  hard: ['happy', 'sad', 'angry', 'surprised', 'scared', 'calm'],
}
const CHOICE_COUNT: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 }

export interface Round { target: EmotionId; choices: EmotionId[] }

export function makeRound(
  difficulty: Difficulty,
  prevTarget: EmotionId | null,
  rng: () => number = Math.random,
): Round {
  const pool = POOLS[difficulty]
  const targets = pool.filter((e) => e !== prevTarget)
  const target = targets[Math.floor(rng() * targets.length)]
  const others = shuffle(pool.filter((e) => e !== target), rng)
  const choices = shuffle([target, ...others.slice(0, CHOICE_COUNT[difficulty] - 1)], rng)
  return { target, choices }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 4:** Run `npm test -- emotions` — expect PASS. Commit: `feat: emotion round logic`

### Task 2: WebGL gate (shared)

**Files:** Create `src/components/WebGLGate.tsx`

- [ ] **Step 1:** Implement — checks WebGL once, renders children or a friendly message:

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

let supported: boolean | null = null
function webglSupported(): boolean {
  if (supported !== null) return supported
  try {
    const canvas = document.createElement('canvas')
    supported = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    supported = false
  }
  return supported
}

export function WebGLGate({ children }: { children: ReactNode }) {
  if (webglSupported()) return <>{children}</>
  return (
    <div className="start-screen">
      <div className="start-icon">🖥️</div>
      <h1>Oh no!</h1>
      <p>This game needs 3D graphics. Please try a newer browser like Chrome or Safari.</p>
      <Link to="/" className="big-btn home-link">🏠 Home</Link>
    </div>
  )
}
```

- [ ] **Step 2:** `npm run build` passes. Commit: `feat: webgl availability gate`

### Task 3: Parametric 3D face

**Files:** Create `src/games/emotions/EmotionFace.tsx`

- [ ] **Step 1:** Build the face from primitives inside a `<group>`: head (sphere), two eyes (white sphere + black pupil, vertical `eyeScale` for wide/relaxed), two brows (thin boxes with per-emotion `rotation`/`height`), mouth (torus arc rotated for smile/frown, or sphere for the open "o" mouth when `mouthOpen`). Expression parameters per emotion:

| emotion | browAngle | browHeight | eyeScale | mouth | headColor |
|---|---|---|---|---|---|
| happy | 0.15 | 0.62 | 1.0 | smile (arc up) | #ffd97a |
| sad | -0.5 | 0.60 | 0.9 | frown (arc down) + tear | #ffd97a |
| angry | 0.6 (inward down) | 0.52 | 0.85 | frown | #f7b36d |
| surprised | 0.0 | 0.72 | 1.35 | open "o" | #ffd97a |
| scared | -0.35 | 0.70 | 1.3 | small open + tremble | #ffe9b8 |
| calm | 0.05 | 0.58 | 0.45 (lidded) | tiny smile | #ffd97a |

- [ ] **Step 2:** Animate: `useFrame` lerps current parameter values toward the target emotion's values (smooth, slow transitions — calm not jumpy) and adds a gentle idle bob (`sin(t) * 0.03`).
- [ ] **Step 3:** Verify visually in the game scene (Task 4) — each emotion clearly distinct. Commit: `feat: parametric 3d emotion face`

### Task 4: Game flow + route

**Files:** Create `src/games/emotions/EmotionsGame.tsx`; modify `src/App.tsx`; extend `src/styles/global.css`

- [ ] **Step 1:** `EmotionsGame` phases: `start` (StartScreen) → `playing` → `over` (GameOverDialog with score + best, reportScore on entry).

Playing layout: ScoreBar (score, lives 3) on top; R3F `<Canvas>` (inside WebGLGate) with soft ambient + directional light, pastel sky background, `EmotionFace emotion={round.target}`; PromptBanner "How does this face feel?"; row of choice buttons (emoji + label) from `round.choices`.

Interaction rules:
- Correct → `playSuccess()`, `speak("Great! That's <label>!")`, star celebration overlay, buttons disabled ~1.2 s, then next round (`makeRound(difficulty, prevTarget)`), score+1.
- Wrong → `playGentle()`, `speak("Let's look again.")`, that button greys out (disabled), lives−1, same round continues.
- Lives 0 → phase `over`.

```tsx
// Core state sketch (full component in source):
const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
const [round, setRound] = useState<Round | null>(null)
const [score, setScore] = useState(0)
const [lives, setLives] = useState(3)
const [locked, setLocked] = useState(false)       // during celebration
const [wrongPicks, setWrongPicks] = useState<EmotionId[]>([])
const [celebrating, setCelebrating] = useState(false)
```

- [ ] **Step 2:** Route: in `App.tsx` replace the `/emotions` ComingSoon route with `<EmotionsGame />` (keep map for remaining games).
- [ ] **Step 3:** CSS: `.game-page` (full-height column), `.game-canvas` (flex-1), `.choice-row`, `.choice-btn` (large, emoji over label, disabled style), `.celebrate` star pop animation.
- [ ] **Step 4:** `npm test` + `npm run build` pass. Play-test: start screen difficulties work; all six emotions render distinctly; correct/wrong flows behave; game over shows after 3 misses; best score updates on Home. Commit: `feat: emotion identification game`

## Self-review notes

- Spec §4.1 coverage: emotions list ✓, choices per difficulty ✓, 3 lives ✓, gentle wrong feedback ✓, random continue until lives out ✓, summary screen ✓.
- WebGL fallback (spec §7) lands here as shared `WebGLGate` for later games.
- Names consistent with Phase 1 kit: `StartScreen`, `ScoreBar`, `PromptBanner`, `GameOverDialog`, `speak`, `playSuccess`, `playGentle`, `useScores.reportScore`, `useSettings.difficulty`.
