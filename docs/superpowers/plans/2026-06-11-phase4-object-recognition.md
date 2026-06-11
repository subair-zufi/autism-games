# Phase 4: Object Recognition (Garden Finder) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Garden Finder" game: a 3D garden holds eight procedural objects (three flowers, tree, mushroom, bird, butterfly, bee). A chunky cartoon hand floats above one object, pointing at it; the student taps the matching picture button below. Correct = the object does a happy wiggle, +1 star.

**Architecture:** Same proven pattern — pure logic module (TDD), one scene component, one flow component on the shared kit. All 3D models are built from primitives in small sub-components. The hand glides between targets each round; choice buttons are DOM (no 3D picking needed, simpler than Ball Drop).

**Spec:** `docs/superpowers/specs/2026-06-10-autism-games-design.md` §4.3

---

## File Structure

```
src/games/garden/logic.ts        — GARDEN_OBJECTS meta, makeRound(difficulty, prev, rng)
src/games/garden/logic.test.ts
src/games/garden/GardenScene.tsx — garden, 8 objects, pointing hand, wiggle celebration
src/games/garden/GardenGame.tsx  — start/playing/over flow, prompt, picture buttons
src/App.tsx                      — route /garden → GardenGame
```

### Task 1: Round logic (TDD)

Objects: `flower-red 🌹, flower-yellow 🌻, flower-purple 🪻, butterfly 🦋, tree 🌳, bird 🐦, mushroom 🍄, bee 🐝`. Each has `category` ('flower' or unique) and a fixed scene `position`.

Difficulty rules:
- **easy:** 3 choices; distractor categories all differ from the target's and each other (no confusable flowers together).
- **medium:** 4 choices, random distractors.
- **hard:** 4 choices; when the target is a flower, the other flowers are preferred as distractors (color discrimination).

- [ ] **Step 1:** Failing tests — choice counts (3/4/4), target included, choices unique, easy categories all distinct, hard flower-target includes ≥2 flowers, target never repeats previous round, all 8 objects have label/emoji/position.
- [ ] **Step 2:** Implement `makeRound(difficulty, prevTarget, rng)` mirroring the emotions/balldrop logic style.
- [ ] **Step 3:** Tests pass. Commit: `feat: garden round logic`

### Task 2: Garden scene

- [ ] **Step 1:** Procedural models as tiny components, each a `<group>` of primitives:
  - `Flower(color)`: stem cylinder, 6 petal spheres around a center sphere.
  - `Tree`: trunk cylinder + 3 leafy spheres.
  - `Mushroom`: stem + squashed-sphere cap + white dots.
  - `Bird`: body + head spheres, cone beak, tail box.
  - `Butterfly`: capsule body + two wing planes flapping in `useFrame`.
  - `Bee`: striped sphere + wings, hovering in a small circle.
- [ ] **Step 2:** `PointingHand` — chunky cartoff hand from boxes (palm, extended index finger, folded fingers, thumb), pointing downward; floats above the target's position with a gentle bob; glides (lerp) to the new target each round.
- [ ] **Step 3:** Celebration: `celebrate` trigger prop wiggles the target object (scale pulse + rotation shake ~1 s) via `useFrame`.
- [ ] **Step 4:** Ground plane, sky color, soft lights, fixed camera `[0, 3.2, 7.5]` looking at `(0, 0.8, 0)`.
- [ ] **Step 5:** Commit: `feat: 3d garden scene with pointing hand`

### Task 3: Game flow + route

- [ ] **Step 1:** `GardenGame`: StartScreen → playing (ScoreBar 3 hearts, GardenScene, PromptBanner "What is the hand pointing at?", picture buttons emoji+label from `round.choices`) → GameOverDialog. Correct: chime, praise speech, wiggle, +1, next round after 1.4 s; wrong: gentle sound, "Let's look again", grey out that button, −1 heart, same round.
- [ ] **Step 2:** Route `/garden` in `GAME_COMPONENTS`.
- [ ] **Step 3:** `npm test` + build pass; play-test: hand clearly indicates objects, correct/wrong flows, game over, best score. Commit: `feat: garden finder game`

## Self-review notes

- Spec §4.3 coverage: garden with 6–10 objects ✓ (8), hand sign marks an object ✓, pick matching from list ✓, more-similar objects on harder levels ✓ (flower colors).
- Reuses shared kit names exactly as Phases 2–3.
