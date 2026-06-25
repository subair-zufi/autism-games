# Two New Emotion Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two fixed-question-quiz emotion games — "Know the Emotion" (tap the person in a group photo showing a requested emotion) and "Identify Emotions" (pick the emotion shown in a short video clip) — to the existing Autism Games collection.

**Architecture:** Each game lives in its own folder under `src/games/` with a pure, seeded-RNG-testable `logic.ts` (+ `logic.test.ts`) and a `*Game.tsx` component. A shared `emotionVocab.ts` provides the 6-emotion vocabulary and a `shuffle` helper. Both games use a fixed-question quiz flow (progress indicator + results screen) inlined per component, reusing existing `StartScreen`, `PromptBanner`, `speak`, and the sound helpers. Media is served from `public/`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, react-router-dom, zustand (persisted settings/scores). No 3D for these games (plain DOM + `<img>`/`<video>`).

## Global Constraints

- Image src paths use the `./` prefix (e.g. `./groups/happy_sad.png`) to work under the GitHub Pages subdirectory base — matches existing `./emotions/...` usage.
- Emotion vocabulary is exactly the six emotions in the assets: `happy`, `sad`, `angry`, `surprised`, `scared` (the "Fear" assets), `disgust`. Do NOT add Excited/Calm/Confused.
- New games are fixed-question quizzes: Know the Emotion = 6 / 6 / 10 questions (easy/medium/hard); Identify Emotions = 5 / 7 / 10 videos. No lives. Score = number of questions correct on the FIRST attempt. Wrong answer = gentle feedback + stay on the question for another attempt.
- `GameId` is a closed union; `settings.ts` and `scores.ts` hold `Record<GameId, …>` defaults — whenever a `GameId` is added, its default key MUST be added to both default objects in the same change or TypeScript will not compile.
- Pure logic takes `rng: () => number = Math.random` as its last parameter for deterministic tests, following the existing `makeRound` convention.
- Run all tests with `npm test` (vitest run). Type-check/build with `npm run build`.

---

### Task 1: Copy and normalize media assets into `public/`

**Files:**
- Create: `public/groups/*.png` (14 files)
- Create: `public/videos/*.mp4` (12 files)

**Interfaces:**
- Produces: image files at `./groups/<slug>.png` and video files at `./videos/<slug>.mp4`, consumed by Tasks 3–6.

The source archives are `/Volumes/T9/Downloads/Group Images.zip` and `/Volumes/T9/Downloads/Videos.zip`. The asset slug mappings are in `docs/superpowers/specs/2026-06-25-emotion-games-design.md`.

- [ ] **Step 1: Extract archives to a temp dir**

```bash
rm -rf /tmp/otist_assets && mkdir -p /tmp/otist_assets
unzip -o -q "/Volumes/T9/Downloads/Group Images.zip" -d /tmp/otist_assets/gi
unzip -o -q "/Volumes/T9/Downloads/Videos.zip" -d /tmp/otist_assets/vid
```

- [ ] **Step 2: Copy + rename group photos into `public/groups/`**

```bash
mkdir -p public/groups
SRC="/tmp/otist_assets/gi/Group Images"
cp "$SRC/2 Emotions/Disgust_Fear.png"            public/groups/disgust_fear.png
cp "$SRC/2 Emotions/Fear_Angry.png"              public/groups/fear_angry.png
cp "$SRC/2 Emotions/Happy_Sad.png"               public/groups/happy_sad.png
cp "$SRC/2 Emotions/Happy_Surprise.png"          public/groups/happy_surprise.png
cp "$SRC/2 Emotions/Sad_Angry.png"               public/groups/sad_angry.png
cp "$SRC/2 Emotions/Surprise_Disgust.png"        public/groups/surprise_disgust.png
cp "$SRC/3 Emotions/Disgust_Surprise_Angry.png"  public/groups/disgust_surprise_angry.png
cp "$SRC/3 Emotions/Disgust-Surprise-Angry.png"  public/groups/disgust_surprise_angry_2.png
cp "$SRC/3 Emotions/Disgust_Surprise_Fear.png"   public/groups/disgust_surprise_fear.png
cp "$SRC/3 Emotions/Fear_Surprise_Happy.png"     public/groups/fear_surprise_happy.png
cp "$SRC/3 Emotions/Sad_Happy_Angry.png"         public/groups/sad_happy_angry.png
cp "$SRC/3 Emotions/Sad_Happy_Angry 2.png"       public/groups/sad_happy_angry_2.png
cp "$SRC/3 Emotions/Sad-Happy-Angry.png"         public/groups/sad_happy_angry_3.png
cp "$SRC/3 Emotions/Surprise_Disgust_Sad.png"    public/groups/surprise_disgust_sad.png
```

- [ ] **Step 3: Copy + rename videos into `public/videos/`**

```bash
mkdir -p public/videos
V="/tmp/otist_assets/vid/Videos"
cp "$V/Angry video 1.mp4"     public/videos/angry_1.mp4
cp "$V/Angry Video2.mp4"      public/videos/angry_2.mp4
cp "$V/Disgust video.mp4"     public/videos/disgust_1.mp4
cp "$V/Disgust video 1.mp4"   public/videos/disgust_2.mp4
cp "$V/Fear Video.mp4"        public/videos/fear_1.mp4
cp "$V/Fear video 1.mp4"      public/videos/fear_2.mp4
cp "$V/Happy video 1.mp4"     public/videos/happy_1.mp4
cp "$V/Happy video 2.mp4"     public/videos/happy_2.mp4
cp "$V/Sad Video 1.mp4"       public/videos/sad_1.mp4
cp "$V/Sad video 2.mp4"       public/videos/sad_2.mp4
cp "$V/Surprise.mp4"          public/videos/surprise_1.mp4
cp "$V/Surprise video 1.mp4"  public/videos/surprise_2.mp4
```

- [ ] **Step 4: Verify all 26 files exist**

Run: `ls public/groups/*.png | wc -l && ls public/videos/*.mp4 | wc -l`
Expected: `14` then `12`

- [ ] **Step 5: Commit**

```bash
git add public/groups public/videos
git commit -m "Add group-photo and video assets for new emotion games"
```

---

### Task 2: Shared emotion vocabulary module

**Files:**
- Create: `src/games/emotionVocab.ts`
- Test: `src/games/emotionVocab.test.ts`

**Interfaces:**
- Produces:
  - `type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'disgust'`
  - `interface EmotionMeta { id: EmotionId; label: string; emoji: string }`
  - `const EMOTIONS: EmotionMeta[]` (length 6)
  - `function emotionMeta(id: EmotionId): EmotionMeta`
  - `function shuffle<T>(arr: T[], rng: () => number): T[]` (returns a new array; does not mutate)

- [ ] **Step 1: Write the failing test**

Create `src/games/emotionVocab.test.ts`:

```ts
import { expect, test } from 'vitest'
import { EMOTIONS, emotionMeta, shuffle } from './emotionVocab'

test('has the six asset emotions with labels and emojis', () => {
  expect(EMOTIONS.map((e) => e.id)).toEqual([
    'happy', 'sad', 'angry', 'surprised', 'scared', 'disgust',
  ])
  for (const e of EMOTIONS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
})

test('emotionMeta returns the matching entry', () => {
  expect(emotionMeta('scared').label).toBe('Scared')
})

test('shuffle keeps the same elements and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5]
  const out = shuffle(input, () => 0)
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  expect(input).toEqual([1, 2, 3, 4, 5])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- emotionVocab`
Expected: FAIL — cannot find module `./emotionVocab`.

- [ ] **Step 3: Write the implementation**

Create `src/games/emotionVocab.ts`:

```ts
export type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'disgust'

export interface EmotionMeta {
  id: EmotionId
  label: string
  emoji: string
}

export const EMOTIONS: EmotionMeta[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'surprised', label: 'Surprised', emoji: '😮' },
  { id: 'scared', label: 'Scared', emoji: '😨' },
  { id: 'disgust', label: 'Disgust', emoji: '🤢' },
]

export function emotionMeta(id: EmotionId): EmotionMeta {
  return EMOTIONS.find((e) => e.id === id)!
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- emotionVocab`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/emotionVocab.ts src/games/emotionVocab.test.ts
git commit -m "Add shared emotion vocabulary for new emotion games"
```

---

### Task 3: Game 1 logic — `knowemotion/logic.ts`

**Files:**
- Create: `src/games/knowemotion/logic.ts`
- Test: `src/games/knowemotion/logic.test.ts`

**Interfaces:**
- Consumes: `EmotionId`, `EMOTIONS`, `shuffle` from `../emotionVocab`; `Difficulty` from `../../types`.
- Produces:
  - `interface GroupPhoto { slug: string; src: string; emotions: EmotionId[] }` (emotions ordered left→right)
  - `const GROUP_PHOTOS: GroupPhoto[]` (6 two-emotion + 8 three-emotion)
  - `interface FindQuestion { type: 'find'; photo: GroupPhoto; targetEmotion: EmotionId; answerIndex: number }`
  - `interface NameQuestion { type: 'name'; photo: GroupPhoto; position: number; choices: EmotionId[]; answer: EmotionId }`
  - `type Question = FindQuestion | NameQuestion`
  - `function buildQuiz(difficulty: Difficulty, rng?: () => number): Question[]`

- [ ] **Step 1: Write the failing test**

Create `src/games/knowemotion/logic.test.ts`:

```ts
import { expect, test } from 'vitest'
import { GROUP_PHOTOS, buildQuiz } from './logic'

test('photo emotion order matches the slug', () => {
  const happySad = GROUP_PHOTOS.find((p) => p.slug === 'happy_sad')!
  expect(happySad.emotions).toEqual(['happy', 'sad'])
  const sha = GROUP_PHOTOS.find((p) => p.slug === 'sad_happy_angry')!
  expect(sha.emotions).toEqual(['sad', 'happy', 'angry'])
})

test('question counts: easy 6, medium 6, hard 10', () => {
  expect(buildQuiz('easy').length).toBe(6)
  expect(buildQuiz('medium').length).toBe(6)
  expect(buildQuiz('hard').length).toBe(10)
})

test('easy uses only two-person photos and find questions', () => {
  for (const q of buildQuiz('easy')) {
    expect(q.photo.emotions).toHaveLength(2)
    expect(q.type).toBe('find')
  }
})

test('medium uses only three-person photos and find questions', () => {
  for (const q of buildQuiz('medium')) {
    expect(q.photo.emotions).toHaveLength(3)
    expect(q.type).toBe('find')
  }
})

test('find answerIndex points at the target emotion', () => {
  for (let i = 0; i < 50; i++) {
    for (const q of buildQuiz('hard')) {
      if (q.type === 'find') {
        expect(q.photo.emotions[q.answerIndex]).toBe(q.targetEmotion)
      } else {
        expect(q.photo.emotions[q.position]).toBe(q.answer)
        expect(q.choices).toContain(q.answer)
        expect(q.choices).toHaveLength(4)
        expect(new Set(q.choices).size).toBe(q.choices.length)
      }
    }
  }
})

test('deterministic with a seeded rng', () => {
  const seq = [0.1, 0.5, 0.9, 0.3, 0.7]
  const makeRng = () => {
    let i = 0
    return () => seq[i++ % seq.length]
  }
  const a = buildQuiz('hard', makeRng())
  const b = buildQuiz('hard', makeRng())
  expect(a.map((q) => q.photo.slug)).toEqual(b.map((q) => q.photo.slug))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- knowemotion/logic`
Expected: FAIL — cannot find module `./logic`.

- [ ] **Step 3: Write the implementation**

Create `src/games/knowemotion/logic.ts`:

```ts
import type { Difficulty } from '../../types'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'

export interface GroupPhoto {
  slug: string
  src: string
  emotions: EmotionId[] // ordered left → right
}

export const GROUP_PHOTOS: GroupPhoto[] = [
  // two-person
  { slug: 'disgust_fear', src: './groups/disgust_fear.png', emotions: ['disgust', 'scared'] },
  { slug: 'fear_angry', src: './groups/fear_angry.png', emotions: ['scared', 'angry'] },
  { slug: 'happy_sad', src: './groups/happy_sad.png', emotions: ['happy', 'sad'] },
  { slug: 'happy_surprise', src: './groups/happy_surprise.png', emotions: ['happy', 'surprised'] },
  { slug: 'sad_angry', src: './groups/sad_angry.png', emotions: ['sad', 'angry'] },
  { slug: 'surprise_disgust', src: './groups/surprise_disgust.png', emotions: ['surprised', 'disgust'] },
  // three-person
  { slug: 'disgust_surprise_angry', src: './groups/disgust_surprise_angry.png', emotions: ['disgust', 'surprised', 'angry'] },
  { slug: 'disgust_surprise_angry_2', src: './groups/disgust_surprise_angry_2.png', emotions: ['disgust', 'surprised', 'angry'] },
  { slug: 'disgust_surprise_fear', src: './groups/disgust_surprise_fear.png', emotions: ['disgust', 'surprised', 'scared'] },
  { slug: 'fear_surprise_happy', src: './groups/fear_surprise_happy.png', emotions: ['scared', 'surprised', 'happy'] },
  { slug: 'sad_happy_angry', src: './groups/sad_happy_angry.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'sad_happy_angry_2', src: './groups/sad_happy_angry_2.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'sad_happy_angry_3', src: './groups/sad_happy_angry_3.png', emotions: ['sad', 'happy', 'angry'] },
  { slug: 'surprise_disgust_sad', src: './groups/surprise_disgust_sad.png', emotions: ['surprised', 'disgust', 'sad'] },
]

export interface FindQuestion {
  type: 'find'
  photo: GroupPhoto
  targetEmotion: EmotionId
  answerIndex: number
}

export interface NameQuestion {
  type: 'name'
  photo: GroupPhoto
  position: number
  choices: EmotionId[]
  answer: EmotionId
}

export type Question = FindQuestion | NameQuestion

const QUESTION_COUNT: Record<Difficulty, number> = { easy: 6, medium: 6, hard: 10 }
const NAME_CHOICES = 4

const twoPerson = () => GROUP_PHOTOS.filter((p) => p.emotions.length === 2)
const threePerson = () => GROUP_PHOTOS.filter((p) => p.emotions.length === 3)

function makeFind(photo: GroupPhoto, rng: () => number): FindQuestion {
  const targetEmotion = photo.emotions[Math.floor(rng() * photo.emotions.length)]
  return { type: 'find', photo, targetEmotion, answerIndex: photo.emotions.indexOf(targetEmotion) }
}

function makeName(photo: GroupPhoto, rng: () => number): NameQuestion {
  const position = Math.floor(rng() * photo.emotions.length)
  const answer = photo.emotions[position]
  // Prefer the other emotions present in this same photo as distractors,
  // then pad with the rest of the vocabulary, up to NAME_CHOICES total.
  const samePhoto = photo.emotions.filter((id) => id !== answer)
  const others = shuffle(
    EMOTIONS.map((e) => e.id).filter((id) => id !== answer && !samePhoto.includes(id)),
    rng,
  )
  const distractors = [...samePhoto, ...others].slice(0, NAME_CHOICES - 1)
  const choices = shuffle([answer, ...distractors], rng)
  return { type: 'name', photo, position, choices, answer }
}

export function buildQuiz(difficulty: Difficulty, rng: () => number = Math.random): Question[] {
  const count = QUESTION_COUNT[difficulty]
  const pool =
    difficulty === 'easy' ? twoPerson()
    : difficulty === 'medium' ? threePerson()
    : [...GROUP_PHOTOS]
  const photos = shuffle(pool, rng).slice(0, count)
  return photos.map((photo) => {
    const useName = difficulty === 'hard' && rng() < 0.4
    return useName ? makeName(photo, rng) : makeFind(photo, rng)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- knowemotion/logic`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/knowemotion/logic.ts src/games/knowemotion/logic.test.ts
git commit -m "Add Know the Emotion quiz logic"
```

---

### Task 4: Shared QuizResult component + CSS scaffolding

**Files:**
- Create: `src/components/QuizResult.tsx`
- Modify: `src/styles/global.css` (append new classes)

**Interfaces:**
- Produces: `function QuizResult(props: { score: number; total: number; onRestart: () => void }): JSX.Element` — a results overlay reusing the existing `.overlay`/`.dialog` classes, showing `score / total` and Play-again + Home buttons. Consumed by Tasks 5 and 7.
- Produces CSS classes: `.quiz-progress`, `.group-photo-wrap`, `.group-photo`, `.tap-region`, `.tap-region.highlight`, `.video-stage`, `.quiz-video`, `.replay-btn`.

This task has no unit test (presentational component + CSS); it is verified visually in Tasks 6 and 8.

- [ ] **Step 1: Create the QuizResult component**

Create `src/components/QuizResult.tsx`:

```tsx
import { Link } from 'react-router-dom'

export function QuizResult(props: { score: number; total: number; onRestart: () => void }) {
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>Great playing! 🎉</h2>
        <p className="dialog-score">You got {props.score} / {props.total}</p>
        <button className="big-btn" onClick={props.onRestart}>Play again</button>
        <Link to="/" className="big-btn home-link">🏠 Home</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Append the new CSS**

Append to `src/styles/global.css`:

```css
/* ---- fixed-question quiz games (Know the Emotion / Identify Emotions) ---- */
.quiz-progress {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  border-radius: 999px;
  background: var(--card);
  color: var(--ink-soft);
  font-size: 1.05rem;
  font-weight: 700;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
  z-index: 2;
}
.group-photo-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 60vh;
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;
}
.group-photo {
  display: block;
  width: 100%;
  height: auto;
  max-height: 60vh;
  object-fit: contain;
}
.tap-region {
  position: absolute;
  top: 0;
  bottom: 0;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: box-shadow 0.15s ease, background 0.15s ease;
}
.tap-region:hover,
.tap-region:focus-visible {
  background: rgba(127, 182, 164, 0.18);
  box-shadow: inset 0 0 0 5px var(--accent);
  outline: none;
}
.tap-region:disabled { cursor: default; }
.tap-region.highlight {
  background: rgba(246, 193, 119, 0.22);
  box-shadow: inset 0 0 0 5px #f6c177;
}
.video-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.quiz-video {
  max-width: 100%;
  max-height: 56vh;
  border-radius: 18px;
  background: #000;
}
.replay-btn {
  padding: 8px 20px;
  font-size: 1.05rem;
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.1);
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/QuizResult.tsx src/styles/global.css
git commit -m "Add QuizResult component and quiz-game styles"
```

---

### Task 5: Game 1 component + wiring — Know the Emotion

**Files:**
- Create: `src/games/knowemotion/KnowEmotionGame.tsx`
- Modify: `src/types.ts` (add `'knowemotion'` to `GameId` and a `GAME_LIST` entry)
- Modify: `src/state/settings.ts:19` (add `knowemotion: 'easy'` to the `difficulty` default)
- Modify: `src/state/scores.ts:13` (add `knowemotion: 0` to the `best` default)
- Modify: `src/App.tsx` (import + register `KnowEmotionGame`)

**Interfaces:**
- Consumes: `buildQuiz`, `Question` from `./logic`; `emotionMeta`, `type EmotionId` from `../emotionVocab`; `QuizResult` from `../../components/QuizResult`; `StartScreen`, `PromptBanner`; `speak`, `playSuccess`, `playGentle`; `useSettings`, `useScores`, `reportScore`; `GAME_LIST`.
- Produces: default-exported-style `function KnowEmotionGame()` component (named export, matching `EmotionsGame`).

- [ ] **Step 1: Add the GameId, list entry, and state defaults**

In `src/types.ts`, add `'knowemotion'` to the `GameId` union (after `'slider'`):

```ts
  | 'slider'
  | 'knowemotion'
```

Add to `GAME_LIST` (append):

```ts
  { id: 'knowemotion', title: 'Know the Emotion', icon: '🧒', path: '/knowemotion', color: '#7fb6a4' },
```

In `src/state/settings.ts`, add `knowemotion: 'easy'` inside the `difficulty` default object (line 19). In `src/state/scores.ts`, add `knowemotion: 0` inside the `best` default object (line 13).

- [ ] **Step 2: Create the component**

Create `src/games/knowemotion/KnowEmotionGame.tsx`:

```tsx
import { useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { PromptBanner } from '../../components/PromptBanner'
import { QuizResult } from '../../components/QuizResult'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { buildQuiz, type Question } from './logic'

const META = GAME_LIST.find((g) => g.id === 'knowemotion')!
const POS_LABEL = ['left', 'middle', 'right']

function promptText(q: Question): string {
  if (q.type === 'find') return `Who is feeling ${emotionMeta(q.targetEmotion).label.toLowerCase()}?`
  const pos = q.photo.emotions.length === 2 ? (q.position === 0 ? 'left' : 'right') : POS_LABEL[q.position]
  return `What is the ${pos} one feeling?`
}

export function KnowEmotionGame() {
  const difficulty = useSettings((s) => s.difficulty.knowemotion)
  const best = useScores((s) => s.best.knowemotion)
  const reportScore = useScores((s) => s.reportScore)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [quiz, setQuiz] = useState<Question[]>(() => buildQuiz(difficulty))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [firstTry, setFirstTry] = useState(true)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrongFind, setWrongFind] = useState<number[]>([])
  const [wrongName, setWrongName] = useState<EmotionId[]>([])
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const q = quiz[idx]
  const imgLoaded = loadedSrc === q.photo.src
  const colWidth = 100 / q.photo.emotions.length

  function start() {
    setQuiz(buildQuiz(difficulty))
    setIdx(0)
    setScore(0)
    resetQuestion()
    setPhase('playing')
  }

  function resetQuestion() {
    setFirstTry(true)
    setLocked(false)
    setCelebrating(false)
    setWrongFind([])
    setWrongName([])
    setLoadedSrc(null)
  }

  function advance(gained: number) {
    setLocked(true)
    setCelebrating(true)
    playSuccess()
    speak('Great job!')
    const nextScore = score + gained
    setTimeout(() => {
      setScore(nextScore)
      if (idx + 1 >= quiz.length) {
        reportScore('knowemotion', nextScore)
        setPhase('over')
      } else {
        setIdx(idx + 1)
        resetQuestion()
      }
    }, 1300)
  }

  function wrong() {
    playGentle()
    speak("Let's look again.")
    setFirstTry(false)
  }

  function pickRegion(i: number) {
    if (locked || q.type !== 'find' || wrongFind.includes(i)) return
    if (i === q.answerIndex) advance(firstTry ? 1 : 0)
    else { setWrongFind((w) => [...w, i]); wrong() }
  }

  function pickEmotion(id: EmotionId) {
    if (locked || q.type !== 'name' || wrongName.includes(id)) return
    if (id === q.answer) advance(firstTry ? 1 : 0)
    else { setWrongName((w) => [...w, id]); wrong() }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <div className="game-page">
      <div className="game-canvas">
        <div className="quiz-progress">Question {idx + 1} / {quiz.length}</div>
        <div className="video-stage">
          <div className="group-photo-wrap">
            {!imgLoaded && <div className="emotion-img-loader"><div className="emotion-spinner" /></div>}
            <img
              className="group-photo"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              src={q.photo.src}
              alt="Children showing different feelings"
              onLoad={() => setLoadedSrc(q.photo.src)}
              onError={() => setLoadedSrc(q.photo.src)}
            />
            {q.photo.emotions.map((_, i) => (
              <button
                key={i}
                className={
                  'tap-region' + (q.type === 'name' && i === q.position ? ' highlight' : '')
                }
                style={{ left: `${i * colWidth}%`, width: `${colWidth}%` }}
                disabled={q.type !== 'find' || locked || wrongFind.includes(i)}
                aria-label={`${POS_LABEL[q.photo.emotions.length === 2 ? i * 2 : i]} person`}
                onClick={() => pickRegion(i)}
              />
            ))}
          </div>
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <PromptBanner text={promptText(q)} />
        {q.type === 'name' && (
          <div className="choice-row">
            {q.choices.map((id) => {
              const m = emotionMeta(id)
              return (
                <button
                  key={id}
                  className="choice-btn"
                  disabled={locked || wrongName.includes(id)}
                  onClick={() => pickEmotion(id)}
                >
                  <span className="choice-emoji">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {phase === 'over' && (
        <QuizResult score={score} total={quiz.length} onRestart={start} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Register the route**

In `src/App.tsx`, add the import after the other game imports:

```ts
import { KnowEmotionGame } from './games/knowemotion/KnowEmotionGame'
```

And add to `GAME_COMPONENTS`:

```ts
  knowemotion: KnowEmotionGame,
```

- [ ] **Step 4: Type-check / build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (existing + the new logic tests).

- [ ] **Step 6: Commit**

```bash
git add src/games/knowemotion/KnowEmotionGame.tsx src/types.ts src/state/settings.ts src/state/scores.ts src/App.tsx
git commit -m "Add Know the Emotion game and wire it into the app"
```

---

### Task 6: Manual verification of Game 1

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the game**

Use the preview tooling (preview_start), navigate to `/knowemotion`.

- [ ] **Step 2: Verify Easy**

Pick Easy → Play. Confirm: a two-person photo shows; progress reads "Question 1 / 6"; prompt asks "Who is feeling …?"; hovering a half shows a highlight ring; tapping the correct person plays the success sound + ⭐ and advances; tapping the wrong person gives gentle feedback and lets you retry. Complete all 6 → results screen shows `score / 6`.

- [ ] **Step 3: Verify Medium and Hard**

Medium → three-person photos, 6 questions. Hard → 10 questions mixing 2- and 3-person photos and including some "What is the left/middle/right one feeling?" questions with emotion-name buttons (the queried person is ring-highlighted). Confirm a screenshot of each.

- [ ] **Step 4: Report findings**

Share a screenshot of a Find question and a Name question. Fix any layout/alignment issues (region columns must line up with the photo panels) before moving on.

---

### Task 7: Game 2 logic — `identifyemotions/logic.ts`

**Files:**
- Create: `src/games/identifyemotions/logic.ts`
- Test: `src/games/identifyemotions/logic.test.ts`

**Interfaces:**
- Consumes: `EMOTIONS`, `shuffle`, `type EmotionId` from `../emotionVocab`; `Difficulty` from `../../types`.
- Produces:
  - `interface VideoClip { slug: string; src: string; emotion: EmotionId }`
  - `const VIDEO_CLIPS: VideoClip[]` (12 clips)
  - `interface VideoQuestion { clip: VideoClip; choices: EmotionId[]; answer: EmotionId }`
  - `function buildQuiz(difficulty: Difficulty, rng?: () => number): VideoQuestion[]`

- [ ] **Step 1: Write the failing test**

Create `src/games/identifyemotions/logic.test.ts`:

```ts
import { expect, test } from 'vitest'
import { VIDEO_CLIPS, buildQuiz } from './logic'

test('there are 12 clips, 2 per emotion', () => {
  expect(VIDEO_CLIPS).toHaveLength(12)
  const counts: Record<string, number> = {}
  for (const c of VIDEO_CLIPS) counts[c.emotion] = (counts[c.emotion] ?? 0) + 1
  expect(Object.values(counts)).toEqual([2, 2, 2, 2, 2, 2])
})

test('video counts: easy 5, medium 7, hard 10', () => {
  expect(buildQuiz('easy').length).toBe(5)
  expect(buildQuiz('medium').length).toBe(7)
  expect(buildQuiz('hard').length).toBe(10)
})

test('choice counts: easy 3, medium/hard 4; answer always present and unique', () => {
  const check = (d: 'easy' | 'medium' | 'hard', n: number) => {
    for (let i = 0; i < 30; i++) {
      for (const q of buildQuiz(d)) {
        expect(q.choices).toHaveLength(n)
        expect(q.choices).toContain(q.answer)
        expect(q.answer).toBe(q.clip.emotion)
        expect(new Set(q.choices).size).toBe(q.choices.length)
      }
    }
  }
  check('easy', 3)
  check('medium', 4)
  check('hard', 4)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- identifyemotions/logic`
Expected: FAIL — cannot find module `./logic`.

- [ ] **Step 3: Write the implementation**

Create `src/games/identifyemotions/logic.ts`:

```ts
import type { Difficulty } from '../../types'
import { EMOTIONS, shuffle, type EmotionId } from '../emotionVocab'

export interface VideoClip {
  slug: string
  src: string
  emotion: EmotionId
}

export const VIDEO_CLIPS: VideoClip[] = [
  { slug: 'angry_1', src: './videos/angry_1.mp4', emotion: 'angry' },
  { slug: 'angry_2', src: './videos/angry_2.mp4', emotion: 'angry' },
  { slug: 'disgust_1', src: './videos/disgust_1.mp4', emotion: 'disgust' },
  { slug: 'disgust_2', src: './videos/disgust_2.mp4', emotion: 'disgust' },
  { slug: 'fear_1', src: './videos/fear_1.mp4', emotion: 'scared' },
  { slug: 'fear_2', src: './videos/fear_2.mp4', emotion: 'scared' },
  { slug: 'happy_1', src: './videos/happy_1.mp4', emotion: 'happy' },
  { slug: 'happy_2', src: './videos/happy_2.mp4', emotion: 'happy' },
  { slug: 'sad_1', src: './videos/sad_1.mp4', emotion: 'sad' },
  { slug: 'sad_2', src: './videos/sad_2.mp4', emotion: 'sad' },
  { slug: 'surprise_1', src: './videos/surprise_1.mp4', emotion: 'surprised' },
  { slug: 'surprise_2', src: './videos/surprise_2.mp4', emotion: 'surprised' },
]

export interface VideoQuestion {
  clip: VideoClip
  choices: EmotionId[]
  answer: EmotionId
}

const VIDEO_COUNT: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }
const CHOICE_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4 }

export function buildQuiz(difficulty: Difficulty, rng: () => number = Math.random): VideoQuestion[] {
  const clips = shuffle([...VIDEO_CLIPS], rng).slice(0, VIDEO_COUNT[difficulty])
  const n = CHOICE_COUNT[difficulty]
  return clips.map((clip) => {
    const answer = clip.emotion
    const distractors = shuffle(
      EMOTIONS.map((e) => e.id).filter((id) => id !== answer),
      rng,
    ).slice(0, n - 1)
    const choices = shuffle([answer, ...distractors], rng)
    return { clip, choices, answer }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- identifyemotions/logic`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/games/identifyemotions/logic.ts src/games/identifyemotions/logic.test.ts
git commit -m "Add Identify Emotions quiz logic"
```

---

### Task 8: Game 2 component + wiring — Identify Emotions

**Files:**
- Create: `src/games/identifyemotions/IdentifyEmotionsGame.tsx`
- Modify: `src/types.ts` (add `'identifyemotions'` to `GameId` and a `GAME_LIST` entry)
- Modify: `src/state/settings.ts` (add `identifyemotions: 'easy'`)
- Modify: `src/state/scores.ts` (add `identifyemotions: 0`)
- Modify: `src/App.tsx` (import + register `IdentifyEmotionsGame`)

**Interfaces:**
- Consumes: `buildQuiz`, `type VideoQuestion` from `./logic`; `emotionMeta`, `type EmotionId` from `../emotionVocab`; `QuizResult`, `PromptBanner`, `StartScreen`; `speak`, `playSuccess`, `playGentle`; `useSettings`, `useScores`; `GAME_LIST`.
- Produces: `function IdentifyEmotionsGame()` (named export).

- [ ] **Step 1: Add the GameId, list entry, and state defaults**

In `src/types.ts`, add to `GameId`:

```ts
  | 'identifyemotions'
```

Append to `GAME_LIST`:

```ts
  { id: 'identifyemotions', title: 'Emotion Clips', icon: '🎬', path: '/identifyemotions', color: '#c9a0e0' },
```

Add `identifyemotions: 'easy'` to the `difficulty` default in `src/state/settings.ts` and `identifyemotions: 0` to the `best` default in `src/state/scores.ts`.

- [ ] **Step 2: Create the component**

Create `src/games/identifyemotions/IdentifyEmotionsGame.tsx`:

```tsx
import { useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { PromptBanner } from '../../components/PromptBanner'
import { QuizResult } from '../../components/QuizResult'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { buildQuiz, type VideoQuestion } from './logic'

const META = GAME_LIST.find((g) => g.id === 'identifyemotions')!

export function IdentifyEmotionsGame() {
  const difficulty = useSettings((s) => s.difficulty.identifyemotions)
  const reportScore = useScores((s) => s.reportScore)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [quiz, setQuiz] = useState<VideoQuestion[]>(() => buildQuiz(difficulty))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [firstTry, setFirstTry] = useState(true)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrong, setWrong] = useState<EmotionId[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)

  const q = quiz[idx]

  function start() {
    setQuiz(buildQuiz(difficulty))
    setIdx(0)
    setScore(0)
    resetQuestion()
    setPhase('playing')
  }

  function resetQuestion() {
    setFirstTry(true)
    setLocked(false)
    setCelebrating(false)
    setWrong([])
  }

  function replay() {
    const v = videoRef.current
    if (v) { v.currentTime = 0; void v.play() }
  }

  function pick(id: EmotionId) {
    if (locked || wrong.includes(id)) return
    if (id === q.answer) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      speak('Great job!')
      const nextScore = score + (firstTry ? 1 : 0)
      setTimeout(() => {
        setScore(nextScore)
        if (idx + 1 >= quiz.length) {
          reportScore('identifyemotions', nextScore)
          setPhase('over')
        } else {
          setIdx(idx + 1)
          resetQuestion()
        }
      }, 1300)
    } else {
      playGentle()
      speak("Let's look again.")
      setFirstTry(false)
      setWrong((w) => [...w, id])
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <div className="game-page">
      <div className="game-canvas">
        <div className="quiz-progress">Video {idx + 1} / {quiz.length}</div>
        <div className="video-stage">
          <video
            key={q.clip.slug}
            ref={videoRef}
            className="quiz-video"
            src={q.clip.src}
            autoPlay
            muted
            loop
            playsInline
          />
          <button className="replay-btn" onClick={replay}>↻ Watch again</button>
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <PromptBanner text="What emotion is shown in this video?" />
        <div className="choice-row">
          {q.choices.map((id) => {
            const m = emotionMeta(id)
            return (
              <button
                key={id}
                className="choice-btn"
                disabled={locked || wrong.includes(id)}
                onClick={() => pick(id)}
              >
                <span className="choice-emoji">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {phase === 'over' && (
        <QuizResult score={score} total={quiz.length} onRestart={start} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Register the route**

In `src/App.tsx`, add the import:

```ts
import { IdentifyEmotionsGame } from './games/identifyemotions/IdentifyEmotionsGame'
```

And add to `GAME_COMPONENTS`:

```ts
  identifyemotions: IdentifyEmotionsGame,
```

- [ ] **Step 4: Type-check / build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/games/identifyemotions/IdentifyEmotionsGame.tsx src/types.ts src/state/settings.ts src/state/scores.ts src/App.tsx
git commit -m "Add Identify Emotions game and wire it into the app"
```

---

### Task 9: Manual verification of Game 2 + final regression

**Files:** none (verification only).

- [ ] **Step 1: Verify the video quiz**

Open `/identifyemotions`. Easy → confirm a clip autoplays muted and loops; progress reads "Video 1 / 5"; "Watch again" restarts it; 3 emotion buttons; correct pick celebrates and advances; wrong pick gives gentle feedback + retry; finishing shows `score / 5`. Spot-check Medium (7 videos, 4 choices) and Hard (10 videos).

- [ ] **Step 2: Verify the Home screen**

Confirm both new cards appear on Home with their icons and "Best: 0", and that best score updates after finishing a quiz.

- [ ] **Step 3: Full regression**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Report findings**

Share screenshots of the video game and the updated Home screen.

---

## Self-Review Notes

- **Spec coverage:** assets/normalization (Task 1); emotion vocab (Task 2); Game 1 logic incl. find+name, level counts, randomization (Task 3); quiz scaffold/results CSS (Task 4); Game 1 component, tap-the-person, wiring (Tasks 5–6); Game 2 logic incl. counts/choices (Task 7); Game 2 component, video playback, wiring (Tasks 8–9). All spec sections map to a task.
- **Scoring rule** (first-attempt-correct, retry-on-wrong) is implemented identically in both components via the `firstTry` flag.
- **State-default constraint** is honored: each `GameId` addition includes its `settings.ts` and `scores.ts` default in the same task.
- **No shared quiz-flow abstraction** beyond the presentational `QuizResult`, per the spec's explicit decision.
