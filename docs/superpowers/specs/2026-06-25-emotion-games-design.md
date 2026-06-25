# Two New Emotion-Identification Games — Design

Date: 2026-06-25

Add two games to the existing Autism Games collection:

1. **Know the Emotion** (`knowemotion`) — identify which person in a group photo
   shows a requested emotion, or name the emotion of a given person.
2. **Identify Emotions** (`identifyemotions`) — watch a short video clip and pick
   the emotion it shows.

Both follow a **fixed-question quiz** format (a deliberate departure from the
existing lives/endless games), per the product spec.

## Assets

Source archives: `Group Images.zip`, `Videos.zip`.

### Group photos → `public/groups/`

The source filenames already encode the **left→right emotion order**, and each
photo is a clean set of equal vertical panels (2-emotion = 2 halves, 3-emotion =
3 thirds). This was visually verified, so **no manual region-mapping is needed** —
emotion-per-position is derived directly from the slug.

Copy and normalize to lowercase, separator-safe slugs:

| Source | Slug | Layout (L→R) |
|---|---|---|
| `2 Emotions/Disgust_Fear.png` | `disgust_fear.png` | disgust, scared |
| `2 Emotions/Fear_Angry.png` | `fear_angry.png` | scared, angry |
| `2 Emotions/Happy_Sad.png` | `happy_sad.png` | happy, sad |
| `2 Emotions/Happy_Surprise.png` | `happy_surprise.png` | happy, surprised |
| `2 Emotions/Sad_Angry.png` | `sad_angry.png` | sad, angry |
| `2 Emotions/Surprise_Disgust.png` | `surprise_disgust.png` | surprised, disgust |
| `3 Emotions/Disgust-Surprise-Angry.png` | `disgust_surprise_angry_2.png` | disgust, surprised, angry |
| `3 Emotions/Disgust_Surprise_Angry.png` | `disgust_surprise_angry.png` | disgust, surprised, angry |
| `3 Emotions/Disgust_Surprise_Fear.png` | `disgust_surprise_fear.png` | disgust, surprised, scared |
| `3 Emotions/Fear_Surprise_Happy.png` | `fear_surprise_happy.png` | scared, surprised, happy |
| `3 Emotions/Sad-Happy-Angry.png` | `sad_happy_angry_3.png` | sad, happy, angry |
| `3 Emotions/Sad_Happy_Angry 2.png` | `sad_happy_angry_2.png` | sad, happy, angry |
| `3 Emotions/Sad_Happy_Angry.png` | `sad_happy_angry.png` | sad, happy, angry |
| `3 Emotions/Surprise_Disgust_Sad.png` | `surprise_disgust_sad.png` | surprised, disgust, sad |

6 two-person + 8 three-person = 14 photos. (The three `sad_happy_angry*` and two
`disgust_surprise_angry*` slugs are distinct photos of the same combo — kept for
variety.)

### Video clips → `public/videos/`

Each clip is a **single emotion**, already labeled in the filename. 6 emotions ×
2 clips = 12. Normalize:

| Source | Slug | Emotion |
|---|---|---|
| `Angry video 1.mp4` | `angry_1.mp4` | angry |
| `Angry Video2.mp4` | `angry_2.mp4` | angry |
| `Disgust video.mp4` | `disgust_1.mp4` | disgust |
| `Disgust video 1.mp4` | `disgust_2.mp4` | disgust |
| `Fear Video.mp4` | `fear_1.mp4` | scared |
| `Fear video 1.mp4` | `fear_2.mp4` | scared |
| `Happy video 1.mp4` | `happy_1.mp4` | happy |
| `Happy video 2.mp4` | `happy_2.mp4` | happy |
| `Sad Video 1.mp4` | `sad_1.mp4` | sad |
| `Sad video 2.mp4` | `sad_2.mp4` | sad |
| `Surprise.mp4` | `surprise_1.mp4` | surprised |
| `Surprise video 1.mp4` | `surprise_2.mp4` | surprised |

~70 MB of video + ~30 MB of images is committed to the repo. Within GitHub Pages
limits (100 MB/file). ffmpeg is unavailable in this environment, so clips are used
as-is without transcoding.

### Emotion vocabulary

Shared across both games — only the six emotions present in the assets:

| id | label | emoji |
|---|---|---|
| `happy` | Happy | 😊 |
| `sad` | Sad | 😢 |
| `angry` | Angry | 😠 |
| `surprised` | Surprised | 😮 |
| `scared` | Scared | 😨 |
| `disgust` | Disgust | 🤢 |

The spec's Excited / Calm / Confused are dropped (no matching assets). `scared`
maps to the "Fear" source label. This set is local to the new games and does not
change the existing `emotions` game.

## Game 1 — Know the Emotion (`knowemotion`)

### Display & interaction

- Render the full group photo. Overlay equal-width invisible tap regions
  (2 or 3 columns based on the photo's panel count). Hover/focus shows a subtle
  highlight ring on a region.
- **Find question** ("Who is feeling **happy**?"): student taps the person.
  Correct region = the column whose slug-emotion equals the target.
- **Name question** ("What is the **left one** feeling?"): a position is fixed in
  the prompt; student taps one of the emotion-name buttons. Correct = the
  slug-emotion at that position.

### Levels (fixed-question quiz)

| Level | Questions | Photo pool | Question types |
|---|---|---|---|
| Easy | 6 | two-person | Find only |
| Medium | 6 | three-person | Find only |
| Hard | 10 | mix of two- & three-person | Find + Name, mixed |

Per playthrough, randomize: question order, which photo each question uses (no
immediate repeat of the same photo), the target emotion / queried position, and —
for Name questions — the emotion-name button order. Name-question distractor
buttons are drawn from the other emotions present in that same photo, padded with
other vocabulary emotions to reach the choice count.

### logic.ts (pure, seeded-RNG testable)

```ts
interface GroupPhoto { slug: string; src: string; emotions: EmotionId[] } // L→R

// "Who is feeling <targetEmotion>?" — student taps the person.
interface FindQuestion {
  type: 'find'
  photo: GroupPhoto
  targetEmotion: EmotionId
  answerIndex: number        // panel index of the correct person
}

// "What is the <position> one feeling?" — student taps an emotion button.
interface NameQuestion {
  type: 'name'
  photo: GroupPhoto
  position: number           // queried panel index
  choices: EmotionId[]       // shuffled emotion-name buttons
  answer: EmotionId
}

type Question = FindQuestion | NameQuestion
function buildQuiz(difficulty, rng = Math.random): Question[]
```

`buildQuiz` returns the full ordered list of questions for the level (6/6/10).
The component walks the list; no mid-quiz regeneration.

## Game 2 — Identify Emotions (`identifyemotions`)

### Display & interaction

- One `<video>` per question: `autoplay muted loop playsInline`, plus a Replay
  button. (Muted autoplay is required for browser autoplay policies; clips carry
  no essential audio.)
- Prompt: "What emotion is shown in this video?" with emotion-name buttons —
  3 choices on Easy, 4 on Medium/Hard. Correct = the clip's emotion; distractors
  are other vocabulary emotions; button order shuffled.

### Levels

| Level | Videos | Choices |
|---|---|---|
| Easy | 5 | 3 |
| Medium | 7 | 4 |
| Hard | 10 | 4 |

Videos shuffled per playthrough (no immediate repeat); 12 clips cover all levels.

### logic.ts

```ts
interface VideoClip { slug: string; src: string; emotion: EmotionId }
interface VideoQuestion { clip: VideoClip; choices: EmotionId[]; answer: EmotionId }
function buildQuiz(difficulty, rng = Math.random): VideoQuestion[]
```

## Shared structure & wiring

- New folders `src/games/knowemotion/` and `src/games/identifyemotions/`, each
  with `logic.ts`, `logic.test.ts`, and `<Name>Game.tsx`, matching existing
  conventions.
- **Fixed-quiz UI scaffold** inside each game component (no premature shared
  abstraction; extract later only if a third quiz appears):
  - phases `start | playing | over`, reusing `StartScreen`.
  - progress indicator "Question N / total" (replaces the lives display; the new
    games have no lives).
  - per-question: correct → `playSuccess` + ⭐ + `speak(praise)` → advance;
    wrong → `playGentle` + `speak("Let's look again.")`, stay on the question for
    another attempt. A question scores only if the **first** attempt is correct.
  - end → results screen showing `score / total` and a Play-again button; call
    `reportScore(gameId, score)` so the Home card shows best.
- `PromptBanner` shows the question text; `speak()` reads it aloud when voice is on.
- Wiring:
  - `types.ts`: add `'knowemotion'` and `'identifyemotions'` to `GameId` and two
    `GAME_LIST` entries (titles e.g. "Know the Emotion" 🧒, "Emotion Clips" 🎬;
    paths `/knowemotion`, `/identifyemotions`; accent colors).
  - `App.tsx`: import and register both components in `GAME_COMPONENTS`.
  - `settings.ts` / `scores.ts`: add default keys for both ids. Existing
    deep-merge handles older persisted stores (defaults fill missing keys).

## Testing

- `logic.test.ts` for each game using a seeded RNG:
  - Easy/Medium/Hard produce the correct question counts (6/6/10, 5/7/10).
  - Easy uses only two-person photos; Medium only three-person; Hard mixes.
  - Each Find question's `answerIndex` points at a panel whose emotion equals the
    target; each Name question's `answer` equals the photo emotion at `position`.
  - Choice arrays always contain the answer and have the expected length; no
    duplicate emotions within a choice set.
  - Video quiz: every chosen clip's emotion is its `answer`; choice counts correct.
- Component smoke render (jsdom) optional, following existing patterns where
  present.

## Out of scope

- Transcoding/compressing media (no ffmpeg available).
- Multi-emotion-per-clip segmenting (assets are single-emotion clips).
- Changes to the existing `emotions` ("Feelings Faces") game.
