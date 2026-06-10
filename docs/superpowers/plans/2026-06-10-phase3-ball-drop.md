# Phase 3: Ball Drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Ball Drop" game: open boxes in distinct colors sit on the ground; the voice asks for one color; the student taps the box (Easy) or drags the ball above a box and releases it (Medium/Hard). The ball falls in with a bounce; correct drops earn a star and color-matched confetti.

**Architecture:** Same pattern as Phase 2 — pure logic module (`logic.ts`, unit-tested), one 3D scene component (`BallDropScene`), one flow component (`BallDropGame`) reusing the shared kit. Falling/dragging is hand-rolled in `useFrame` (gravity + bounce) — no physics engine dependency. Box positions stay fixed for the whole session (predictability matters for this audience); only the requested color changes.

**Spec:** `docs/superpowers/specs/2026-06-10-otist-games-design.md` §4.4

---

## File Structure

```
src/games/balldrop/logic.ts        — BOX_COLORS meta, boxesFor(difficulty), pickTarget()
src/games/balldrop/logic.test.ts
src/games/balldrop/BallDropScene.tsx — boxes, draggable ball, fall/bounce, confetti burst
src/games/balldrop/BallDropGame.tsx  — start/playing/over flow, prompt, scoring
src/App.tsx                          — route /balldrop → BallDropGame
```

### Task 1: Color/round logic (TDD)

- [ ] **Step 1:** Failing tests: `boxesFor` returns 3/4/5 unique colors for easy/medium/hard; `pickTarget` returns a color from the box list, never the previous target, deterministic with seeded rng; every color has label + hex.
- [ ] **Step 2:** Implement:

```ts
import type { Difficulty } from '../../types'

export type ColorId = 'red' | 'blue' | 'yellow' | 'green' | 'purple'
export interface ColorMeta { id: ColorId; label: string; hex: string }

export const BOX_COLORS: ColorMeta[] = [
  { id: 'red', label: 'Red', hex: '#e26d5c' },
  { id: 'blue', label: 'Blue', hex: '#5c9ead' },
  { id: 'yellow', label: 'Yellow', hex: '#f2c14e' },
  { id: 'green', label: 'Green', hex: '#84a98c' },
  { id: 'purple', label: 'Purple', hex: '#9d8cd6' },
]

const BOX_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 }

export function boxesFor(difficulty: Difficulty): ColorId[] {
  return BOX_COLORS.slice(0, BOX_COUNT[difficulty]).map((c) => c.id)
}

export function pickTarget(boxes: ColorId[], prev: ColorId | null, rng: () => number = Math.random): ColorId {
  const pool = boxes.filter((c) => c !== prev)
  return pool[Math.floor(rng() * pool.length)]
}
```

- [ ] **Step 3:** Tests pass. Commit: `feat: ball drop color logic`

### Task 2: 3D scene

**`BallDropScene` props:** `boxes: ColorId[]`, `mode: 'tap' | 'drag'`, `disabled: boolean`, `onLand(box: ColorId): void`, `resetKey: number` (re-centers the ball each round).

- [ ] **Step 1:** Scene contents:
  - Ground: large soft-green plane; light blue sky background.
  - Boxes: open crates (4 thin walls + bottom built from `boxGeometry`) spaced along x at y=0, each in its color hex; gentle hover wobble on the target is NOT shown (no hints).
  - Ball: orange sphere, idle floating at top center (y≈2.2) with a small bob.
  - Camera: `position [0, 2.8, 6.5]`, looking slightly down.
- [ ] **Step 2:** Interactions (all in refs/useFrame; React state only for results):
  - `drag` mode: pointer-down on the ball starts dragging; an invisible plane at the ball's height captures pointer-moves; ball.x follows, clamped to the box row. Pointer-up: if over a box (nearest center within half a box width) → enter `falling`; otherwise ball glides back to center.
  - `tap` mode: clicking/tapping a box moves the ball above it, then `falling`.
  - Falling: gravity in useFrame; on reaching box rim height, small bounce + squash, then `onLand(boxColor)`.
- [ ] **Step 3:** Confetti: on correct landing the parent re-renders scene with `celebrate: ColorId | null` — 14 small boxes in that color burst upward from the box with random velocities, fall with gravity, fade after ~1.2 s.
- [ ] **Step 4:** Commit: `feat: ball drop 3d scene`

### Task 3: Game flow + route

- [ ] **Step 1:** `BallDropGame` mirrors `EmotionsGame`: StartScreen → playing (ScoreBar 3 hearts, PromptBanner "Drop the ball in the RED box.", scene) → GameOverDialog.
  - Correct: `playSuccess()`, speak "Wonderful! That's the red box!", confetti, +1, next target after 1.4 s.
  - Wrong: `playGentle()`, speak "That's the blue box. Let's find the red box.", −1 heart, ball resets, same target.
  - Easy = tap mode; Medium/Hard = drag mode (4/5 boxes).
- [ ] **Step 2:** Route `/balldrop` in `App.tsx` `GAME_COMPONENTS`.
- [ ] **Step 3:** `npm test` + `npm run build` pass; play-test in preview: tap flow, drag flow, wrong-box flow, game over, best score on Home. Commit: `feat: ball drop game`

## Self-review notes

- Spec §4.4 coverage: 3–5 distinct-color boxes ✓, voice+text prompt ✓, easy tap vs medium/hard drag ✓, falling ball physics ✓, color confetti ✓.
- Names consistent with shared kit (`StartScreen`, `ScoreBar`, `PromptBanner`, `GameOverDialog`, `speak`, `playSuccess`, `playGentle`, `reportScore`).
- No physics engine added (YAGNI) — gravity is ~8 lines in useFrame.
