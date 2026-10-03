# VR Games Review — October 2026

Scope: the six playable 360°/VR games — Emotion Room 360, Emotion Cinema 360, Playroom 360,
Football 360, Museum 360, Park 360. (Calm Crew, Right or Wrong, Schoolyard 360 and Good Choice
are `hidden: true` in `src/types.ts` and are out of scope.)

Lens: autism intervention design and research validity — not an engineering audit.
Date: 2026-10-03. Reviewed against the code on `main`, after the 2026-07-16/17 review
(`docs/vr-games-expert-review.md`) whose items 1, 2, 4, 5, 6, 7, 8 and half of 9 are closed.

**Items are ordered easiest → hardest.** Each has an ID, an effort estimate, the reason it
matters, the concrete change, and a done-when test. Work top-down; nothing below depends on
anything above except where stated.

Effort key: **XS** = constants / a few lines · **S** = one game's logic file · **M** = logic +
scene + telemetry in one game · **L** = shared system across all six · **XL** = new content or
a rebuilt game.

---

## R1 · Unmute the Emotion Cinema 360 clips — XS

**Why.** The clips play muted, so vocal prosody is stripped and a multimodal emotion-recognition
task is reduced to a visual one. Prosody is a major affect channel and congruent face+voice
cues are generally easier for autistic children than face alone, so muting makes the task both
harder and less ecologically valid than intended. The original reason was browser autoplay
policy, but every session already starts with a user gesture (Start / Enter VR), so audio is
permitted from that point on.

**Change.** In `src/games/identifyemotions360/` (and the flat `identifyemotions/` twin for
parity), unmute the shared `<video>` element after the session's first user gesture. Keep a
muted fallback if playback is rejected. Add the audio state to the recorded step so analysis
can tell muted trials from unmuted ones.

**Done when.** A clip plays with sound in a headset session; the `answer` step carries an
`audioOn` flag; a blocked-autoplay path still plays silently rather than failing.

---

## R2 · Vary the Park 360 friend's position — XS

**Why.** `FRIEND_BEARING_DEG = 40` is a constant, so the friend stands in the same spot every
round of every session. The turn toward the friend — half of the IJA loop — becomes a learned
motor habit rather than an orienting response, and the friend-directed head-turn cost is a
constant that cannot be separated from it in the telemetry.

**Change.** In `src/games/park360/logic.ts`, deal the friend's bearing per round from a small
set of slots (e.g. ±25°, ±40°) using the same shuffled-cycle bag technique as `buildAnswerSlots`
in `emotionrecognition360/logic.ts`, keeping the friend inside `FRONT_HALF_ARC_DEG` and well
clear of the round's surprise spot. Record `friendBearingDeg` on the share event.

**Done when.** Across one session the friend appears at more than one bearing, never within
~15° of the active surprise, and every share event carries the friend's bearing.

---

## R3 · Jitter the Playroom 360 peer wait time — XS

**Why.** `peerTurnMs` is a constant per level (1300 / 1800 / 2400 ms). Waiting for a perfectly
predictable interval is a much easier skill than waiting for an unpredictable one, and tolerance
for uncertainty is exactly the turn-taking stressor that shows up in real classrooms. Flagged in
July; still constant.

**Change.** In `src/games/playroom360/logic.ts` add a jitter band to `BlockConfig`
(easy: none, medium: ±20%, hard: ±40%) and apply it per peer turn. Log the actual wait on the
`place_block` / `impatient_tap` events so impatience can be modelled against how long the child
was actually asked to wait.

**Done when.** Hard-level peer turns vary visibly in length, and each event records
`peerWaitMs` for the turn it followed.

---

## R4 · Stop Football 360 ending a session on lives — XS

**Why.** Football 360 is the only game in the suite with a fail state: `MAX_LIVES = 3`, and
running out sets `phase = 'over'` before the goal is reached. Every other game states a no-fail
principle explicitly. The child this cuts off is the struggling one — the clinically most
interesting participant produces the fewest trials, which is backwards for both intervention and
measurement.

**Change.** In `src/games/football360/Football360Game.tsx`, remove the early termination. Keep
lives as a visible score decrement if the motivational framing is wanted, or drop the HUD heart
row entirely. Keep `starsFor(completed, livesLeft)` working, but let the session always run to
`goal`.

**Done when.** A session with four or more errors still reaches the goal and reports a full
trial set; the level row submitted to `game_progress` reflects a complete attempt.

---

## R5 · Schedule Football 360's self-initiated rallies — S

**Why.** `initiate` fires on `rng() < 0.34` on Hard only. Across 10 rallies that is typically
2–4 initiate trials, varying per child and sometimes landing on the first rally. The
initiate-vs-respond distinction is the construct this game adds over Roll-Back Buddy, and it is
currently measured with an unstable, uncounterbalanced handful of trials. Museum 360 already
solves the same problem correctly with `cueSchedule`.

**Change.** In `src/games/football360/logic.ts`, replace the random draw with a deterministic
schedule modelled on `cueSchedule`: a fixed count per level, spread evenly, never on the opening
rally. Expose the count as a config field so it can be tuned per level.

**Done when.** Every Hard session contains exactly the configured number of initiate rallies,
evenly spaced, never first — asserted in `logic.test.ts`.

---

## R6 · Add a manual replay card to Emotion Cinema 360 — S

**Why.** A clip replays only *after* a wrong answer. A child who wants a second look before
committing has no way to take one, so uncertainty is forced to express itself as an error.
Pressing a replay card is also interpretable data in its own right — a self-monitoring measure
rather than noise.

**Change.** Add a small in-world "watch again" card beside the answer cards
(`identifyemotions360` scene + logic constants for its bearing/height). Allow it before the
first answer; log a `replay_request` step with the round and the time since freeze. Leave
scoring unchanged — a replay before answering still counts as a first try.

**Done when.** The card is tappable before answering, replays the clip from the start, and emits
a logged step; first-try scoring is unaffected.

---

## R7 · Decouple Football 360's cue modality from partner count — S

**Why.** The difficulty ladder changes two things at once: the ready-cue fades
(verbal → gesture → orient) *and* the number of teammates grows (1 → 2 → 3). When a child fails
on Hard there is no way to tell whether they could not read body orientation or could not handle
a three-way choice. For a game whose output feeds a research claim about reciprocity, that is a
confound, not a difficulty curve.

**Change.** In `src/games/football360/logic.ts`, separate `cue` and `partners` into independently
settable fields, and either (a) hold partners constant within a level and fade only the cue, or
(b) expose a crossed cue × set-size selection so the two can be varied independently in the
protocol. Record both on every rally event so analysis can model them separately. Mirror the
change in `rollback/logic.ts` to keep the twins aligned.

**Done when.** Cue mode and partner count can be set independently; each rally event carries
both; the default ladder is documented in `levelNotes` in `src/types.ts`.

---

## R8 · In-VR progress dots — S/M (shared)

**Why.** The flat ScoreBar shows `3 / 8`; inside the headset only score and prompt are mirrored.
Predictability — knowing how much is left — reduces anxiety for autistic children more reliably
than almost any other interface property, and tolerance of the headset is a co-primary endpoint
(O6) in the study blueprint. Open since July (review item 10).

**Change.** Add a TEACCH-style row of progress dots to the shared VR HUD
(`src/games/VRHudAnchor.tsx` / each game's HUD block): one dot per trial, filled as trials
complete, placed with the existing score/prompt panel. All six games pass their own
`done / goal`.

**Done when.** Every 360 game shows a filled-dot row in-headset that matches the flat
ScoreBar's progress count.

---

## R9 · Fix the Playroom 360 star metric — M

**Why.** Stars are `placements / (placements + impatientTaps)`. A child who sits completely
passively — never taps out of turn, never watches anyone, simply places their block when
prompted — earns a perfect three stars. The most disengaged participant and the best turn-taker
are currently indistinguishable both to the child and in `game_progress`. The game measures
inhibition only, and scores the absence of behaviour as success.

**Change.** Make the session composite three-part: (1) in-turn placements vs out-of-turn taps
(existing), (2) attention during peer turns — head yaw within a tolerance of the active peer's
bearing for a proportion of their turn, using the existing `headTracking` accumulator, and
(3) own-turn response latency. Open a head window at the start of each peer turn, not only at
hand-off. Report the three sub-scores separately in telemetry and combine them for the child-
facing stars. Keep the no-fail rule: a low score never ends the session.

**Done when.** A simulated passive session scores materially below an engaged one; `peer_turn`
events carry a watch proportion; the stars shown and the accuracy recorded still derive from the
same numbers.

**Depends on.** Nothing, but pairs naturally with R13.

---

## R10 · Add the back-reference glance to Museum 360 — M

**Why.** The attention bid now waits for real eye contact (July item 5 — good). But the canonical
responding-to-joint-attention pattern in the developmental literature is an *alternation*:
partner looks at child → looks at target → looks back at child. The current bid goes
child → target, repeating. The back-reference is what marks the exchange as a shared one rather
than a directional pointer.

**Change.** In `src/games/museum360/Museum360Scene.tsx`, extend the gaze cue cycle with a return
glance to the child after the shift, before repeating. Keep the 6 s fallback. No logic-file
change is needed beyond a timing constant.

**Done when.** On a gaze trial the avatar visibly looks back at the child between shifts, and the
existing eye-contact gate and timeout still behave.

---

## R11 · Score "looked at the target first" in Museum 360 — M

**Why.** The dependent variable is currently the tap. Cue-following is an *orienting* response —
the child's head turning toward the cued exhibit — and the tap is only a downstream report of it.
The head data is already being sampled; it just isn't being used as the measure. The existing
adjacent-vs-far error taxonomy approximates this but cannot separate "followed the cue" from
"searched and got lucky".

**Change.** From the per-trial head window, derive and record: first-fixated exhibit sector,
time-to-first-look at the target sector, and whether the first sustained look matched the cued
target. Keep the tap as the child-facing response and the scoring basis; add these as analysis
fields on the `answer` step. Apply the same derivation to Park 360 and Football 360, where the
measure means the same thing.

**Done when.** Every Museum 360 answer step carries `firstLookSector`, `timeToTargetLookMs` and
`followedCue`, and the analysis guide documents them.

---

## R12 · Close the IJA loop in Park 360 — M

**Why.** The friend celebrates after the child's two taps regardless of anything else, so the
round completes without the child ever confirming the bid landed. Real initiating joint attention
includes checking the partner — the gaze alternation back to the object once the partner has
turned. Without it, the game trains a two-tap screen convention and the construct claim in the
validity dossier is weaker than it needs to be.

**Change.** Add a third beat: after the friend is called, the friend turns toward the surprise;
the round completes when the child looks back at the surprise (head yaw within tolerance) or taps
it again, with a short timeout fallback that completes the round anyway (no-fail). Record whether
the alternation happened and its latency. Rate the full alternation above a bare two-tap share in
the points economy, mirroring the existing spontaneous/prompted ratio.

**Done when.** A completed share logs `alternationCompleted` and its latency; a child who does
not alternate still finishes the round; the points table documents the new tier.

**Depends on.** R11's head-derivation helper.

---

## R13 · Make Playroom 360 reciprocal, not just inhibitory — M

**Why.** The peers never respond to the child. Turn-taking as implemented is a solo waiting task
performed next to some animated avatars; the social contingency — the thing that makes turn-taking
social — is absent. Impatient taps are logged and then silently discarded.

**Change.** Two additions. (1) On medium/hard, a peer occasionally stalls on their turn, and the
child must prompt them (tap the peer / their name) to resume — a bid-and-response exchange rather
than pure inhibition; log `peer_prompt` with latency. (2) Give the impatient tap a gentle
contingent response from the peer ("almost my turn!") instead of silence, so the child learns
from the exchange rather than from nothing.

**Done when.** Stalled turns occur at the configured rate, resume on a child prompt, and log the
prompt latency; an out-of-turn tap draws a visible, non-punishing peer response.

---

## R14 · A shared adaptive mastery engine across all six games — L

**Why.** Museum 360 is the only game that adapts within a session (`FADE_STREAK` ladder with
least-to-most back-off). The other five hold whatever level the facilitator picked for the entire
session. Across a 20–24 session, 8-week dose that means children sit at a level that is too easy
(no learning) or too hard (frustration, early withdrawal) for an entire sitting. This is the
single largest learning-outcome lever in the suite, and it also cleans up O3 (dose–response) by
making "dose" mean comparable difficulty-adjusted practice rather than whatever was selected
that day.

**Change.** Extract Museum's ladder into a shared module (e.g. `src/games/mastery.ts`): a generic
step-up / step-down controller — 3 consecutive first-try correct → step up one rung; 2 errors in
a window → step down one rung, never below the level's floor. Each game supplies its own rung
definition (Emotion Room: distractor tier and board count; Cinema: freeze point and choice count;
Playroom: peers and jitter; Football: cue mode; Park: saliency and nudge delay). Record the active
rung on every trial so difficulty is a covariate in analysis rather than an uncontrolled variable.
Keep the mentor-set level as the floor and starting point, so facilitator control is preserved.

**Done when.** All six games adapt within a session from a single shared controller; every trial
event carries its rung; the flat twins behave identically; `logic.test.ts` covers step-up,
step-down and floor behaviour per game.

---

## R15 · Program for generalization — L

**Why.** Each game is one scene, one peer set, one cue form, repeated 20+ times over eight weeks.
Generalization in autism intervention has to be trained explicitly — multiple exemplars, varied
settings, varied people — or children learn the specific display. Your primary endpoint is
*near transfer to a different battery*, so training a single exemplar set is the most direct
threat to H1 that remains in the design.

**Change.** Two parts. (1) **Multiple exemplar training:** two or three re-skins per environment
(playroom / pitch / gallery / park / media room — lighting, props, wall colour), a larger peer
roster with randomized appearance and names, and more than one surface form per cue. Rotate
across sessions, logging which exemplar was used. (2) **In-app generalization probes:** every
few sessions, insert a short block of unscored trials in an untrained configuration (an unseen
environment skin, an unseen peer), logged as `probe: true` and excluded from the child-facing
score and from `game_progress`. This yields a generalization measure continuously, at no extra
assessment burden.

**Done when.** Each game has ≥2 environment exemplars in rotation; `exemplarId` is on every
trial; probe blocks are scheduled, logged, and excluded from scoring and level progression.

---

## R16 · Pre-recorded prompt audio (Malayalam, then English) — XL (content)

**Why.** Still the highest-risk open item from July (V2 / item 3). Prompts are spoken by
`speechSynthesis` with `lang='ml-IN'`; Quest Browser almost certainly has no matching voice. If
that fails in the field, every game fails for the Malayalam arm — in a BUDS population that is
not a degraded experience, it is no intervention at all. Even where TTS works, voice and rate vary
by device, which is an uncontrolled variable in an eight-week trial.

**Change.** Define a stable prompt-line key scheme (the games currently speak dynamically
interpolated strings — this is the real work, not the recording). Record or synthesise a clip per
key in Malayalam and English, including the emotion words, the teammate names and the praise
lines. Front `speak`/`speakAll` with a clip layer that falls back to TTS on a missing key. Verify
the `Noto Sans Malayalam` fallback renders in the canvas HUDs on-device at the same time.

**Done when.** A full session in Malayalam on a Quest plays every prompt from clips with no TTS
fallback fired, and the HUD text renders correctly.

---

## R17 · Rebuild the Emotion Room 360 stimulus set — XL (content)

**Why.** Six basic emotions, 3–6 images each, a photo drawn at random per board. Three problems:
actor identity still partly co-varies with emotion, so a child can in principle discriminate on
face or lighting rather than expression; there are no intensity gradations, so the task is
all-or-nothing at peak expression; and there are no complex or social emotions (embarrassed,
proud, left out, confused), which is a real ceiling for the 11–15 band. Provenance and cultural
match also remain unresolved (July P1) — own-culture recognition advantage matters for a Kerala
sample and will be asked about in review.

**Change.** Source or produce a locally representative face set; where the bank allows, draw all
boards in a round from the **same actor** so expression is the only varying dimension; add at
least a mid-intensity tier per emotion; extend the vocabulary with a small set of complex
emotions behind a level gate. Document provenance in the content-validity dossier.

**Done when.** `SINGLE_IMAGES` supports same-actor rounds and an intensity dimension; a Hard
round can draw a confusable pair from one actor; provenance is written up.

**Note.** If R18 is taken, do R17 only to the extent the new game needs it.

---

## R18 · Repurpose Emotion Room 360 into an emotional-responsiveness game — XL (rebuild)

**Why.** This is the weakest of the six and the one I would change rather than polish.

- It trains labelling of static, decontextualised faces — the emotion-training paradigm with the
  poorest transfer record. Children reliably learn the stimulus set rather than the skill.
- It duplicates Emotion Cinema 360's construct with a worse stimulus class. Two of six slots go
  to recognition, and the better version is the other one.
- It does not match what you are measuring. The ISAA subscale is **emotional responsiveness** —
  responding appropriately to another person's emotion. Naming a photo is not that, and nothing
  else in the suite covers it. This is the largest construct gap in the set.

**Change.** Reuse the avatar and scene technology already built for Playroom 360 and Football 360.
A short situation plays out in front of the child — a tower is knocked over, someone is left out
of a game, someone's drawing is praised. The child (1) identifies how the person feels and
(2) chooses what to do about it, from options tiered the way the existing distractor tiers are.
Keep the head-turn scan metric by placing the actors across the front arc. This gives emotion in
context, an emotional-responsiveness measure that maps directly to the ISAA subscale, and a far
stronger near-transfer story than a second recognition quiz.

**Done when.** The game runs end-to-end with ≥12 situations, logs both the identification and the
response choice separately, and the content-validity dossier is updated to describe the new
construct.

---

## Protocol item (not a code change)

**P1 · Concentrate the dose on a core three.** The blueprint prescribes ~20–24 sessions of
15–20 min, spread across 12 playable builds (6 concepts × desktop + VR) and 3 levels. Per game,
per child, that is a handful of sessions — too thin for skill acquisition, and far too thin for
O2 (learning slopes) or O3 (dose–response), which need per-game trial counts to fit anything
stable.

Designate a **core three** per child at baseline — one game per target skill — and give them
roughly 80% of the dose. Play the second game in each skill occasionally as a generalization
probe rather than as training. This costs no development work, concentrates the training signal,
and converts the dose-dilution weakness into a measured generalization claim. It is the highest-
value change available and should be settled before go-live, since it affects §8 of the study
blueprint and the pre-registration.

---

## Suggested sequencing

- **Before the pilot:** R1–R8 (all small), plus R16 started — the Malayalam audio has the longest
  lead time of anything here and blocks fieldwork.
- **Before go-live:** R9–R13, and P1 settled in the protocol.
- **Between pilot and main study:** R14, R15.
- **Decide early, build when scoped:** R17 vs R18 — they are alternatives, and R18 supersedes
  most of R17.
