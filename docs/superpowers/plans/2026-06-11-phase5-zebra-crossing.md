# Phase 5: Zebra Crossing (Cross the Road) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Cross the Road" game: a 3D street with a single lane of cars and a
traffic light that cycles forever. When the walk signal turns green the cars are
stopped at the line and a big **WALK** button lights up; tapping it walks the
character safely across for +1 star. Tapping WALK while cars are moving is never
a failure — the character shakes its head and a calm voice says
"Wait — the cars haven't stopped." A session ends after a goal number of safe
crossings with the friendly summary dialog.

**Architecture:** Same proven pattern — a pure logic module (TDD) for the
traffic-light state machine, one scene component, one flow component on the
shared kit. The light clock runs in the flow component via `requestAnimationFrame`
and only re-renders React on a phase change (keeping the WALK button in sync
without a render per frame); the scene animates cars and the character from the
phase prop in its own `useFrame`.

**Spec:** `docs/superpowers/specs/2026-06-10-autism-games-design.md` §4.2

---

## File Structure

```
src/games/zebra/logic.ts        — LightPhase, LEVELS, advanceTraffic(), canWalk()
src/games/zebra/logic.test.ts
src/games/zebra/ZebraScene.tsx  — road, crossing, conveyor cars, traffic light, character
src/games/zebra/ZebraGame.tsx   — light clock, WALK button, start/playing/over flow
src/App.tsx                     — route /zebra → ZebraGame
src/styles/global.css           — .walk-btn (ready/wait states)
```

### Task 1: Traffic-light state machine (TDD)

Four phases cycle forever: `cars-go → cars-slow → walk → walk-ending → …`. Cars
move only during `cars-go`; it is safe to walk only during `walk`/`walk-ending`.

- [x] **Step 1:** Failing tests — initial phase, cyclic `nextPhase`, `canWalk`
  true only on walk phases, `carsStopped === canWalk`, `advanceTraffic` moves the
  clock / rolls into the next phase, huge `dt` is bounded, stepping by small `dt`
  lands every phase in order, level configs sane (walk window ≥ 3s).
- [x] **Step 2:** Implement `advanceTraffic(state, dt, durations)` as a pure
  reducer with per-difficulty `LEVELS` (durations, carCount, carSpeed, goal).
- [x] **Step 3:** Tests pass.

### Task 2: Zebra scene

- [x] **Step 1:** Procedural models from primitives — `Car` (body, cabin,
  windows, headlights, 4 wheels), `Character` (legs, torso, arms, head + cap +
  eyes), `TrafficLight` (pole, 3-lamp car signal, pedestrian lamp).
- [x] **Step 2:** Road, kerbs, stop line, white zebra stripes.
- [x] **Step 3:** Cars as a looping "conveyor" — a single scroll value advances
  in `cars-go` and eases to an aligned stop otherwise, so a car always rests on
  the stop line and the crossing band stays clear when stopped.
- [x] **Step 4:** Character crossing animation (ease-in-out z travel + walk bob)
  triggered by `walkTrigger`; head-shake triggered by `shakeTrigger`; pedestrian
  lamp flashes during `walk-ending`.

### Task 3: Game flow

- [x] **Step 1:** Run the light clock in a `requestAnimationFrame` loop; re-render
  only on phase change. WALK button reflects `canWalk`.
- [x] **Step 2:** Tap WALK when safe → cross (+1, success chime, voice); when
  unsafe → shake + gentle prompt, no penalty.
- [x] **Step 3:** Reaching the difficulty goal → `GameOverDialog`; best score
  persisted via `reportScore('zebra', …)`.
- [x] **Step 4:** Wire `/zebra` route, `.walk-btn` styles. Type-check, tests,
  build all green.
