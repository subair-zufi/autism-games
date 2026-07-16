# Expert Review — VR (360°) Games

Scope: Emotion Room 360, Emotion Cinema 360, Playroom 360, Football 360, Museum 360, Park 360.
(Schoolyard 360 / social-norms games excluded per request.)
Lenses: UI/UX, psychometrics, psychology & autism research, VR development.
Date: 2026-07-16. Reviewed against the code on `main`.

---

## 1. What is already strong (calibration)

These are genuinely well-designed games; the review below is a gap list, not a verdict.

- **Construct fidelity per game is thought through and documented in code.** Each 360 game
  reuses the flat game's validated logic (`buildQuiz`, tiered distractors, stratified targets,
  cue-fading ladders) and adds exactly one VR-specific construct: the head-turn / attention shift.
- **Museum 360 is the best-specified game**: prompt hierarchy (pulse → hover → distal → gaze),
  within-session adaptive fading (`FADE_STREAK`), least-to-most support on error, gaze trials
  scheduled evenly and never first, attention-bid before the gaze shift, adjacent-vs-far error
  taxonomy. This matches the RJA intervention literature closely.
- **Football 360's error taxonomy** (`premature` = timing/reciprocity slip vs `wrong-partner`
  = orientation-reading slip) is a real research-grade distinction, and latency is correctly
  measured from cue onset, not ball-settle, so calm waiting is never penalised.
- **Ergonomics decisions are explicit and mostly right**: front-arc-only interactables
  (±40–65°), no locomotion/teleport (no vection sickness), damped look controls, pitch clamp,
  z-fighting fixes, drag-tail tap guard shared and unit-tested, generous padded tap targets.
- **Errorless / never-punish reward economy** (retries rewarded less, never zero; every session
  earns ≥1 star) is consistent with ABA/NDBI practice for this population.
- **Sensory design is calm**: matte surfaces, soft palettes, no flashing, gentle chimes,
  slowed TTS (rate 0.9).

---

## 2. Cross-cutting findings (all six games)

### 2.1 Measurement / psychometrics

| # | Finding | Severity |
|---|---------|----------|
| M1 | **No actual head-motion telemetry.** Every game records the *required* turn (`targetBearingDeg`) but never samples what the child actually did with their head. In VR, head pose is a first-class gaze proxy and it is currently discarded. | High |
| M2 | **No VR-vs-flat mode flag in analytics.** `recordStep` never records whether the child was in an immersive session (`xr.isPresenting`) or playing flat on a screen. The same game yields data from two very different display/input conditions, indistinguishable in the dataset. | High |
| M3 | **Response latency includes TTS duration.** `readyAt` is stamped when the boards appear and `speak()` *starts*; the child cannot answer meaningfully until the question finishes (~1–2 s, longer in Malayalam). Latency is therefore confounded with prompt language and TTS speed. Stamp from utterance `onend` (or record both). | Medium-High |
| M4 | **Answer-position randomisation is uncounterbalanced.** e.g. Emotion Room 360's correct board lands on a random bearing each round; in a 6-trial session it can land left 5/6 times. This biases the bearing metric and lets a side preference inflate/deflate accuracy. Stratify correct-answer bearings the way targets already are. | Medium |
| M5 | **Hint/prompt state is not on the answer record.** Emotion Room 360 logs a separate `hint` event but the `answer` event doesn't carry `hinted: true/false` (and a hinted correct still earns full 10 points). Park 360, by contrast, halves prompted shares. The prompting economy and its logging are inconsistent across games — align them for cross-game comparability. | Medium |
| M6 | **Trial counts (5–10) are thin for measurement claims.** Fine for training; low internal consistency as an assessment. If session-level scores feed the validity doc, plan to aggregate across sessions or lengthen assessment sessions. | Medium |
| M7 | **VR games have no server-tracked level progression** (`hasLevels: false`) while their flat twins do. Difficulty is mentor-selected, so mode and difficulty are confounded in cross-mode comparisons. Consider mirroring the pass/mastery unlock system. | Medium |
| M8 | Leftover/opaque field: Emotion Room 360's answer payload hardcodes `mode: 'practice'` — either implement a practice/test distinction or remove it before analysis. | Low |

**M1 in detail (the biggest missed opportunity):** sampling camera yaw at 5–10 Hz during the
response window gives you, per trial, essentially free: time-to-first-look at the target sector,
scan path length, number of direction reversals, dwell time on each distractor, and whether the
child inspected all options before answering. For Museum 360 it also enables the single most
valuable upgrade (see §3.5): gating the avatar's attention bid on actual eye contact.

### 2.2 VR development

| # | Finding | Severity |
|---|---------|----------|
| V1 | **World-locked HUD at bearing 0.** The in-VR prompt/score panels hang straight ahead; when the child is looking 30–50° toward a board, the prompt is out of view. Audio mitigates — unless TTS is unavailable (see V2). Consider a lazy-follow HUD (slerp toward camera yaw with a dead zone) or duplicating the prompt near the interactables. | Medium-High |
| V2 | **Malayalam TTS almost certainly missing on Quest Browser.** `speak()` falls back to `lang='ml-IN'` with no matching voice — the engine will skip or mangle it. Combined with V1, a Malayalam-language child in VR may get no usable prompt. Recommendation: pre-recorded audio clips for all prompt lines (also removes cross-device TTS variance — an uncontrolled variable in a study). Verify the canvas font fallback (`Noto Sans Malayalam`) renders on Quest. | High (for the Malayalam arm) |
| V3 | **No in-VR session controls.** No pause, no exit, no play-again inside the headset; at game over the session force-ends and the child is dumped back to the 2D browser panel — a jarring context switch. Add an in-world results board with "play again", and end the session only when leaving to Home. | Medium |
| V4 | **No spatial audio.** Football 360's easy-tier `verbal` cue ("pass it to me!") is spoken by non-spatial TTS — the child cannot use sound direction to find who's ready, which is exactly the real-world skill. A Web Audio `PannerNode` at the teammate's position would make the cue ecologically valid *and* separately measurable (found-by-sound vs found-by-sight). | Medium |
| V5 | **No haptics.** Controller vibration on correct/wrong taps is cheap and is a strong, sensory-friendly feedback channel for this population. | Low-Medium |
| V6 | **No gaze-dwell fallback input.** Ray+trigger aiming at 4–5 m targets demands fine motor control; DCD co-occurs frequently with autism. Targets are generously padded (good), but a gaze-dwell selection option would widen access. (Memory note says controller-vs-gaze picking is still awaiting the Quest hardware test.) | Medium |
| V7 | **Content is authored for a 1.5–1.7 m eye height, but in VR the real headset height applies.** A small seated child (~1.1 m eyes) looks *up* at everything (boards at 1.45 m, screen centre at 1.7 m). Add a recenter/height-offset step at session start (shift `XROrigin` so content sits relative to actual eye height). | Medium |
| V8 | Verify `speechSynthesis` keeps working *inside* an immersive session on Quest Browser (it usually does, but it's core to the design — test it). | Verify |

### 2.3 UI / UX

| # | Finding | Severity |
|---|---------|----------|
| U1 | **VR HUD doesn't show round progress.** The flat ScoreBar shows `3 / 8`; in VR only score+prompt are mirrored. Predictability ("how many more?") is disproportionately important for autistic children — add the progress count, or better, a TEACCH-style row of progress dots in-world. | Medium |
| U2 | **No practice/familiarisation phase.** First VR exposure conflates headset novelty with the skill being measured; standard practice in autism-VR research is an acclimatisation scene plus unscored practice trials. Also gives a low-stakes place to teach the tap gesture. | Medium-High |
| U3 | **No "reduce stimulation" setting.** Sparkles, pulsing rings and celebration effects are mild, but a per-child toggle (and a volume slider rather than on/off) is standard for sensory-sensitive users. | Low-Medium |
| U4 | The one-time "drag to look around" coach mark exists only in the DOM (flat mode); there is no in-VR equivalent teaching "turn your head to look". Usually self-evident, but cheap to add to a practice scene (U2). | Low |
| U5 | In-scene celebrate feedback exists (sparkle, gold frame), but the DOM `⭐ celebrate` overlay is flat-only — fine, just confirm every game has an in-world equivalent for *wrong* answers too (gentle, non-punishing). | Low |

### 2.4 Psychology / autism research & ethics

| # | Finding | Severity |
|---|---------|----------|
| P1 | **Face stimuli provenance & cultural match (Emotion Room 360 / Emotion Cinema 360).** If the photo/clip sets are Western, note the own-race/own-culture recognition advantage for Kerala participants; either use locally validated stimuli or address it in the validity doc. | High (for validity doc) |
| P2 | **Actor identity is confounded with emotion** in Emotion Room 360: each board picks a random photo per emotion, so the child could discriminate on identity/lighting artefacts rather than expression. Prefer same-actor sets across the boards of one round where the stimulus bank allows. | Medium |
| P3 | **Prompt-dependence economics differ across games** (see M5). If one aim is a cross-skill "prompt independence" profile per child, the games must price prompts identically. | Medium |
| P4 | **Session-length & age guidance is absent.** HMD makers' guidance (Quest: 10+), typical child-VR research practice (~10–15 min max blocks, breaks, adult supervision, discomfort check-ins) should be enforced or at least surfaced in the mentor UI — e.g. a session timer with a gentle break prompt. | Medium |
| P5 | **No discomfort/overwhelm exit ramp in VR** (relates to V3): a child who is distressed has no in-world "I want to stop" affordance; they must remove the headset or have the mentor intervene. An always-visible calm exit orb is common in child-VR studies. | Medium |
| P6 | Generalisation framing is honest in the code comments (e.g. Museum trains *responding* prerequisite, not full dyadic RJA) — carry that same precision into the validity doc; VR-to-real-world transfer in autism SST is still an open literature question and shouldn't be overclaimed. | Note |

---

## 3. Per-game review

### 3.1 Emotion Room 360 (`emotionrecognition360`)

**Elements present:** 2–3 real-photo face boards at ±22°/±32°; stratified target cycling (no
immediate repeats); tiered distractor confusability (low/mixed/high); timed hint (ring + chime,
5 s / 9 s / never); gold-frame + sparkle reveal; per-answer confusion-matrix logging (`picked`
vs `answer`), chance, latency, bearing; anisotropic texture filtering; texture disposal.

**Missing / improve:**
- M4 (answer bearing not counterbalanced), M5 (hint state not on the answer event; hinted
  success not priced lower), P1/P2 (stimulus set concerns).
- Wrong answers advance after reveal with no retry — measurement-friendly, but consider an
  optional "teach mode" with a corrected retry for therapy (as opposed to assessment) use.
- The hint points directly at the correct board — after it fires the trial is effectively a
  cued-following trial, not emotion recognition; worth excluding hinted trials from the
  recognition accuracy metric in analysis.

### 3.2 Emotion Cinema 360 (`identifyemotions360`)

**Elements present:** carefully derived screen ergonomics (3.2×1.8 m at 4.5 m ≈ 39°×23°,
centre +2.5° above eye line, cards projecting below the screen edge); full reuse of the flat
quiz (freeze at peak vs early-onset on Hard, tiered choices, "why?" cause follow-up); wrong
pick → automatic "let's look again" replay scaffold; first-try scoring; single reused
`<video>` element.

**Missing / improve:**
- **Muted clips** are a deliberate choice (autoplay policy) but remove vocal prosody — the
  construct becomes *visual* dynamic emotion recognition. Fine, but state it in the validity
  doc; and since a user gesture starts each session, unmuting after the first interaction is
  actually feasible if prosody is wanted later.
- No manual "watch again" affordance in-world (replay only triggers on a wrong pick). A small
  replay card would support children who need a second look *before* committing — and pressing
  it is itself interpretable data (self-monitoring).
- No head-turn metric (acknowledged in code — the screen is straight ahead). The freeze-frame
  moment could still log head pitch/yaw stability as an attention proxy (M1).
- Cause-stage answers are logged in English regardless of display language — fine, just keep
  the mapping documented.

### 3.3 Playroom 360 (`playroom360`)

**Elements present:** fixed anticipatable rotation → reshuffled order on Hard; `impatient_tap`
(tapping out of turn / during hand-off) as the core waiting measure; `hand_off` tap to pass the
turn; single-tap placement (deliberate drop of the flat game's drag — right call, it fought the
look controls); tower capped at 8 so no friend's face is ever hidden; peers clustered around
the table, all in the front arc; kid avatars with readable faces.

**Missing / improve:**
- `peerTurnMs` is constant per level — waiting for a *predictable* interval is easier than for a
  variable one; jittering peer think-time on Hard would probe tolerance for uncertainty (a real
  turn-taking stressor) with zero new UI.
- No measure of whether the child *watches* the active peer during peer turns (M1 again —
  head-yaw sampling would turn peer turns into rich attention data rather than dead time).
- Impatient taps are logged but do not shape difficulty; consider (in therapy mode) a gentle
  contingent response from the peer ("almost my turn!") — currently the tap is silently logged.

### 3.4 Football 360 (`football360`)

**Elements present:** cue-fading ladder verbal → gesture → orient; self-initiated rallies
(~1 in 3 on Hard) probing initiate-vs-respond; `premature` vs `wrong-partner` error taxonomy;
latency from cue onset; ready-target never repeats consecutively; lives + streak bonus;
Malayalam names/roster; teammates on a ±50° arc at 5.2 m.

**Missing / improve:**
- V4 (spatial audio) matters most here: the easy-tier verbal cue should *come from* the
  teammate.
- The `orient` cue's legibility (body/gaze angle on a low-poly avatar at 5.2 m) is the crux of
  the Hard tier — pilot it on-device; if it's too subtle the wrong-partner rate will be noise,
  not signal. Museum's avatar got big high-contrast eyes + nose for exactly this reason; make
  sure the teammates match that legibility.
- With head telemetry (M1) you could split `wrong-partner` into "never looked at the ready
  teammate" (attention failure) vs "looked but passed elsewhere" (reading failure) — much more
  interpretable clinically.
- Ball-return interaction is a tap on the teammate (correct for this design), but a brief
  ball-flight anticipation window could log whether the child tracks the incoming pass.

### 3.5 Museum 360 (`museum360`)

**Elements present (best-in-suite):** prompt hierarchy pulse → hover → distal with in-session
fading after 3-success streaks and least-to-most back-off on error; separately scheduled gaze
trials (evenly spread, never first, retry falls back to the hand); attention bid — the avatar
looks at the *child* first, then the target; gaze repeats every ~3 s so it reads as motion;
big high-contrast eyes and a nose for profile legibility; arc centred on the *avatar* so its
pointing angles stay distinct; adjacent-vs-far error taxonomy; cue and bearing logged per trial.

**Missing / improve:**
- **Gate the attention bid on real eye contact.** Currently the bid plays whether or not the
  child is looking at the avatar. With head yaw available, wait until the child's view is within
  ~±15° of the avatar before the gaze shift starts (with a timeout fallback). That makes the
  exchange contingent — the defining property of a joint-attention bid — and yields a new
  measure: time-to-establish-attention. This is the single highest-value change in the suite.
- Canonical RJA cueing includes *gaze alternation* (partner: child → target → child). The
  current bid goes child → target (repeating). Adding the back-reference glance would match the
  developmental literature more closely.
- Consider logging whether the child's head actually followed the pointing vector before the
  tap (M1), separating "followed the cue" from "searched and got lucky" — the adjacent/far
  taxonomy approximates this but head data would nail it.

### 3.6 Park 360 (`park360`)

**Elements present:** two-tap IJA loop (surprise then friend, either order); spontaneous vs
prompted distinction (spontaneous iff un-nudged) with differential reward; nudge fading
(4 s → 8 s → never); saliency fading (big → medium → subtle); friend progressively more turned
away (`awayYaw` 0.9 → 2.6 rad) so the "call" is increasingly effortful; share latency from
surprise onset; discoveries spread across the front arc at varying bearings; friend celebrates
after the share (marks the act as *sharing*, not requesting — important construct point, done
right).

**Missing / improve:**
- **Construct distance:** tapping the friend is a symbolic stand-in for a communicative bid.
  Real IJA is gaze alternation + point/vocalise. With head telemetry you could require (or at
  least measure) a look toward the friend around the tap — logging genuine gaze-shift IJA
  rather than a screen-taught two-tap convention. Even as an analysis-only measure it would
  substantially strengthen the validity claim.
- The friend stands at a fixed bearing (40°) every round, so the friend-directed head turn is a
  constant; varying the friend's spot (left/right across sessions) would let you separate
  "turn to friend" cost from habit.
- On Hard (no nudges ever), a child who never initiates has no path forward — the round
  presumably waits indefinitely. Confirm there's a session-level bail-out (mentor guidance,
  timeout logging as `no_share`), otherwise Hard sessions with a non-initiating child produce
  no data at all — the most clinically interesting case is currently the least measurable.

---

## 4. Prioritised recommendations

**Do first (high value / enables everything else):**
1. ✅ **Done (2026-07-16).** Sample head yaw/pitch (~10 Hz) during response windows; add
   summary stats per trial (M1). Shared `src/games/headTracking.ts` accumulator +
   `HeadSampler.tsx` in every 360 scene; each game opens a window at cue/stimulus onset and
   spreads `headMetrics()` (scan-path length, yaw range, reversals, pitch extremes,
   time-to-target) into its answer step.
2. ✅ **Done (2026-07-16).** Add `xrPresenting` to every recorded step (M2). `useGameAnalytics`
   now takes the game's `xrStore` and tags every step + `game_over` with the display mode.
4. ✅ **Done (2026-07-16).** Record a second, TTS-unconfounded `latencyFromPromptEndMs` measured
   from when the spoken prompt finishes (M3), alongside the existing `latencyMs`. Applied to the
   games whose latency zero-point coincides with a spoken line: Emotion Room 360, Emotion Cinema
   360, Football 360. (Park/Museum already measure latency from a visual onset; Playroom's DV is
   impatient taps, not latency — item 4 doesn't apply there.)
3. ⏳ **Blocked on assets.** Pre-recorded audio for all Malayalam (and ideally English) prompt
   lines (V2). This is a content task, not a pure code change: it needs recorded/synthesised
   clips and a stable prompt-line key scheme (the games currently speak dynamic interpolated
   strings). The `speak`/`speakAll` service is ready to front a clip layer with TTS fallback
   once clips + keys exist.

**Next (research quality):**
5. Gate Museum 360's attention bid on real eye contact; add gaze alternation (§3.5).
6. Counterbalance correct-answer bearings (M4); add `hinted` to answer events and align
   prompt pricing across games (M5, P3).
7. A shared VR practice/acclimatisation scene with unscored trials (U2).
8. `no_share` / timeout logging for Park 360 Hard (§3.6).

**Then (experience & safety):**
9. In-VR results board + pause/exit orb; end the XR session only on leaving to Home (V3, P5).
10. Lazy-follow HUD with progress dots (V1, U1).
11. Spatial audio for Football 360 cues (V4); controller haptics (V5).
12. Height recentering at session start (V7); session timer with break prompts (P4);
    reduce-stimulation + volume settings (U3).

**Verify on Quest hardware (already pending per project notes):**
- Controller and hand-tracking taps on every game; gaze-dwell feasibility (V6).
- `speechSynthesis` inside immersive sessions; Malayalam font rendering in canvas HUDs (V8, V2).
- `orient` cue legibility at 5.2 m (§3.4).
