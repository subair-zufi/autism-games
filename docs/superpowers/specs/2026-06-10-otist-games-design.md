# Otist Games — Design Spec

**Date:** 2026-06-10
**Status:** Approved by user

Web-based games suite for students with autism, ages 7–15, played primarily on
touch tablets, run locally (no backend, no logins).

## 1. Technology

- **Vite + React + TypeScript** — run locally with `npm run dev`, or `npm run build`
  to static files served by any static server.
- **Three.js via React Three Fiber** (`@react-three/fiber`, `@react-three/drei`) —
  real 3D scenes in a friendly low-poly, toy-like art style built entirely from
  simple geometric shapes. No downloaded 3D models (fully offline, no licensing).
- **Web Speech API** for English voice prompts (browser built-in, no audio files).
  If speech synthesis is unavailable, fall back to text-only prompts.
- **zustand** for game/settings state.
- **localStorage** for settings and best scores.
- **Vitest** for unit tests of game logic.

## 2. Autism-friendly design rules (every game)

- Calm, predictable interfaces: soft colors, no flashing, no sudden loud sounds,
  identical layout patterns across games.
- Gentle failure feedback — never a harsh buzzer. Wrong answer = neutral
  "Let's try again" voice + visual hint. Success = pleasant chime + star animation.
- No time pressure by default; difficulty raises pace gradually.
- Large touch targets (touch-first, mouse-compatible).
- Home button always visible. "Repeat instruction" speaker button on every prompt.
- Every game has **Easy / Medium / Hard**, selectable on its start screen
  (for teachers, given the 7–15 age span).

## 3. Home page

Four large 3D-styled cards (one per game): icon, name, student's best score.
Small settings panel: voice on/off, sound effects on/off.

## 4. Games

### 4.1 Emotion Identification

- A friendly low-poly 3D character face displays an emotion: happy, sad, angry,
  surprised, scared, calm.
- Student taps the matching word+icon button below the scene.
- Correct: +1 point, star celebration, voice affirmation ("Great! That's happy!").
- Wrong: gentle prompt ("Let's look again"), costs one of **3 lives** per round.
- Rounds continue with random emotions until lives run out → friendly summary screen.
- Difficulty: Easy = 2 choices, basic emotions (happy/sad/angry);
  Medium = 3 choices; Hard = 4 choices including subtler emotions.

### 4.2 Zebra Crossing

- 3D street scene, camera behind the student's character on the sidewalk.
- Cars drive continuously along the road; a traffic light cycles
  (cars green → yellow → red / walk signal green).
- When the walk signal is green, cars stop before the zebra line and a big
  **WALK** button lights up; tapping it walks the character across = +1 point.
- Tapping WALK at the wrong time is safe: character shakes head, voice says
  "Wait — the cars haven't stopped." (Teaching moment, never danger.)
- Difficulty: light-cycle speed, number of cars, walk-window length.
- Traffic light logic implemented as a pure state machine (unit-tested).

### 4.3 Object Recognition

- 3D garden scene with ~6–10 objects: flowers (multiple colors), butterfly,
  tree, bird, mushroom, pond, bench, etc.
- An animated pointing hand indicates one object at random.
- Student taps the matching picture from a row of 3–4 choice buttons.
- Correct: the object does a happy wiggle animation, +1 point.
- Difficulty: more choices, more similar-looking objects (e.g., flowers that
  differ only in color).

### 4.4 Ball Drop

- 3–5 boxes in clearly distinct colors (red, blue, yellow, green, purple) in 3D.
- Voice + text prompt: "Drop the ball in the RED box."
- Easy: student taps the target box and the ball drops in.
- Medium/Hard: student drags the ball above a box and releases; ball falls with
  simple physics into the box.
- Correct: confetti in that box's color, +1 point.
- Difficulty: number of boxes, drag vs tap.

## 5. Shared kit

Used by all games; each game is an isolated module (own folder, own scene):

- `ScoreBar`, `LivesIndicator`, `PromptBanner` (text + speak-again button),
  `GameOverDialog` (friendly summary), `HomeButton`.
- Speech service (Web Speech API wrapper with availability fallback).
- Sound effects service (small, soft, synthesized via WebAudio).
- Settings store (voice, sound, per-game difficulty) persisted to localStorage.
- Best-score persistence per game.

## 6. Build order (one phase at a time)

1. Scaffold + home page + shared kit (settings, speech, scoring, navigation)
2. Emotion Identification (establishes the game pattern)
3. Ball Drop (introduces drag + physics, still simple)
4. Object Recognition (bigger 3D scene)
5. Zebra Crossing (most complex — moving traffic + state machine — last)

## 7. Error handling

- Speech synthesis unavailable → text-only prompts (speak button hidden).
- WebGL unavailable → friendly full-screen message suggesting another browser.
- All random round generation guarded so the correct answer is always present
  among the choices.

## 8. Testing

- Game logic as pure functions (round generation, scoring, lives, traffic-light
  state machine, drop-target hit detection) unit-tested with Vitest.
- 3D scenes and interactions verified by play-testing in the browser per phase.
