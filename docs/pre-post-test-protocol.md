# Pre/Post Outcome Measures — Near-Transfer Battery + ASSP

Ages 7–15 · Malayalam administration · three trained skills (Emotional Identification,
Turn-Taking, Joint Attention) · intervention delivered in **VR only**

The study measures transfer at **two distances**, and the distinction runs through every
other document:

| | Measure | Question it answers | Role |
|---|---|---|---|
| **Near** | The custom battery — **EIT · TOP · JAP** (§§1–3) | Has the trained skill itself improved, away from the game? | **Primary outcome** |
| **Far** | The **ASSP** (§5) | Has the child's everyday social behaviour changed? | Secondary outcome |
| **Neither** | **NCT** (§4) + sound-localization (§3, block 3.3) | Would anything have improved anyway? | Discriminant control |

The **battery is the primary outcome**. Each subtest mirrors the construct its games train
(same task logic) while changing every surface feature (stimuli, medium, setting,
respondent) so a pre→post gain demonstrates **near transfer**, not game familiarity.

The **ASSP sits alongside it** as the broader, real-world measure: an informant-rated
questionnaire on the child's everyday social functioning. It answers a question the battery
cannot — did anything reach the classroom and the home? — and it is deliberately *secondary*,
because an 8-week intervention is unlikely to move an informant rating far, and a null there
does not undo a battery gain. There are no other standardized outcome instruments — VSMS and
ATEC are not used. (The **TRENDS** set may still be licensed as a source of face photographs
for the EIT; that is a stimulus source, not an outcome measure.)

Design rules applied throughout:

1. **Novel stimuli, different medium.** Nothing from the games appears in the tests. No
   screens where avoidable; never the app, never the headset.
2. **Parallel forms A/B**, matched item-by-item, counterbalanced across children
   (half get A→B, half B→A) so post-test gains cannot be item memory.
3. **Blinded administration.** The tester does not run intervention sessions and does not
   know (where feasible) which arm/dose the child received. All observation subtests are
   video-recorded; a second blinded coder scores ≥30% for inter-rater reliability
   (target Cohen's κ ≥ .80 per code).
4. **Built-in discriminant control.** A non-social control task with identical response
   demands is administered pre and post; it should **not** improve. Trained-construct
   gains against a flat control task rule out practice/compliance/maturation effects.
5. **Chance-corrected scoring.** Every forced-choice item reports raw accuracy and the
   number of options, so chance level is always recoverable. (The ASSP is a rating scale and
   is exempt — see §5.)
6. **One informant, one window, for the ASSP.** The far-transfer measure has its own rules,
   because its threats are different from a child-administered test's — §5.2.

---

## Battery at a glance

| # | Subtest | Construct | Format | Trials | Time |
|---|---------|-----------|--------|--------|------|
| 1 | Emotion Identification Test (EIT) | Emotional identification | Table-top photo/video cards, forced choice | 30 | ~12 min |
| 2 | Turn-Taking Observation Probe (TOP) | Waiting, anticipating, reciprocity | Live structured play, video-coded | 21 | ~10 min |
| 3 | Joint Attention Probe (JAP) | RJA + IJA | Live structured probes, video-coded | 16 | ~10 min |
| 4 | Non-Social Control Task (NCT) | Discriminant control | Table-top cards, forced choice | 12 | ~4 min |

Total ≈ 40 min of child time including breaks. Order is fixed (1 → 2 → 3 with NCT items
interleaved after subtest 1) so that IJA probes in subtest 3 arrive when the child no longer
treats the room as a test situation — IJA must be measured un-announced.

The **ASSP (§5) adds no child time at all** — it is completed by an adult informant away from
the child, so the total burden on the child is unchanged by including it.

---

## Subtest 1 — Emotion Identification Test (EIT)

Mirrors Emotion Recognition + Emotion Clips. All six basic emotions
(happy, sad, angry, surprised, scared, disgust), Indian child/adolescent faces only.

### Stimulus sourcing

Preferred: license the **TRENDS** stimulus set (NIMHANS; Indian actors, six emotions at
high and low intensity, stills + video). Fallback: photograph/film 4 local actors
(2 male, 2 female, school-age where possible) posing each emotion at full and partial
intensity, validated by ≥10 adult raters at ≥80% agreement per item before use.
Each form (A/B) uses **different actors or different items of the same actors** —
no photo appears in both forms. Forms are matched cell-by-cell on emotion × intensity ×
actor gender.

### Structure (30 items, 4 parts)

| Part | Mirrors | Items | Task | Chance |
|------|---------|-------|------|--------|
| 1a. Label the face | Emotion Recognition `single` | 6 (one per emotion) | One photo at full intensity; "How does he/she feel?" — choose from 3 spoken+pictogram options | 33% |
| 1b. Who feels X? | Emotion Recognition `whoFeels` | 6 (one per emotion) | Group photo of 3 faces, each showing a different emotion; "Show me who feels ___" — child points | 33% |
| 1c. Low-intensity faces | Emotion Clips hard early-freeze | 12 (two per emotion) | Photo at partial (~40–50%) intensity; 3 options **always including one confusable distractor** (fear↔surprise, anger↔disgust, sad↔scared) | 33% |
| 1d. Why does she feel…? | Emotion Clips `cause` follow-up | 6 (one per emotion) | Short picture scenario (e.g. dropped ice-cream); "Why is she sad?" — 3 pictured cause options | 33% |

Age-calibration note (7–15): full-intensity items (1a/1b) will show ceiling in older
children — that is acceptable; they anchor the scale and check compliance. The
**sensitive slice is 1c**, which is why it carries double weight (12 items). Report 1c
separately in analysis; it is the pre-registered primary emotion endpoint.

### Distractor rules (copied from the games' `pickDistractors` logic)

- Parts 1a/1b/1d: `mixed` tier — distractors drawn uniformly from the other 5 emotions.
- Part 1c: `high` tier — at least one confusable distractor per item, per the
  confusability map in `src/games/emotionVocab.ts`.
- Options are presented as spoken Malayalam word + printed word + emoji pictogram
  (same tri-modal presentation as the games' answer cards).

### Administration

- Seated at a table; stimuli on A5 cards (or a plain tablet in card-viewer mode if
  printing quality is poor — same device pre and post, never the study app).
- Script (Malayalam, verify with forward–back translation):
  - 1a: "ഇവൻ/ഇവൾക്ക് എന്ത് തോന്നുന്നു?" (How does he/she feel?)
  - 1b: "___ തോന്നുന്നത് ആരാണെന്ന് കാണിക്കൂ" (Show me who feels ___)
  - 1d: "എന്തുകൊണ്ടാണ് അവൾക്ക് ___ തോന്നുന്നത്?" (Why does she feel ___?)
- No feedback on correctness; neutral praise for effort every 3–4 items
  ("നന്നായി ചെയ്യുന്നു" — you're working well).
- One repeat of the question allowed per item on request; no other prompts.

### Scoring

Per item: correct (1/0), response latency (from card presentation, stopwatch or video),
and for errors in 1c whether the chosen distractor was the confusable one.
Derived scores: total /30; part scores; per-emotion accuracy /5; confusable-error rate.

---

## Subtest 2 — Turn-Taking Observation Probe (TOP)

Mirrors Block Buddies (structured waiting/anticipation) and Roll-Back Buddy
(reciprocity, cue-reading, initiation). Live, with the examiner (E) and one trained
assistant (A) — same two roles pre and post. Video-recorded from a fixed corner angle.

### Task 2.1 — Building rotation (mirrors Block Buddies) — 8 rounds

Materials: stacking cups (Form A) / large beads on a rope (Form B) — different materials,
identical demands.

Setup: E, A, and child seated in a triangle. Instruction: "We build together. We go
around — E, then A, then you. Wait for your turn."

- Rounds 1–5: fixed rotation (E → A → child).
- Rounds 6–8: E announces "now we mix it up!" and calls turns in an unpredictable order
  (mirrors the hard-level shuffle) — the child must monitor, not count.
- E and A take deliberately slow turns (~5 s each, consistent via silent count) to
  create genuine waiting demand.

Codes per round (from video):

| Code | Definition | Score |
|------|-----------|-------|
| WAIT | Child does not touch materials during others' turns | 2 = no touch; 1 = reach/hover, self-corrects; 0 = grabs/places out of turn |
| READY | Child acts within 3 s of their turn arriving, without being re-prompted | 1/0 |

### Task 2.2 — Ball return (mirrors Roll-Back Buddy) — 11 trials

Materials: soft ball (Form A) / bean-bag slide across the table (Form B).
Setup: E and A sit apart in front of the child, ~2 m. One of them rolls the ball to the
child; the child must return it **to whichever partner shows the ready cue**. Cue levels
are staged in the game's fading order:

- Trials 1–3 — **verbal**: ready partner says "എനിക്ക് താ!" (roll it to me!) with open hands.
- Trials 4–6 — **gesture**: no words; ready partner leans in with open cupped hands;
  the other partner keeps hands in lap.
- Trials 7–9 — **orientation only**: both partners keep hands neutral; the ready partner
  turns torso + gaze to the child, the other looks away at a clipboard (mirrors the
  `orient` cue).
- Trials 10–11 — **initiation**: nobody rolls first. E places the ball in front of the
  child and both adults sit quietly; the ready partner orients toward the child. Does
  the child start the exchange within 10 s? (mirrors `selfInitiate` rallies).

Standardization: cue onset begins ~1 s after the ball settles; the "ready" partner
alternates on a fixed schedule (E, A, A, E, …) identical across forms.

Codes per trial:

| Code | Definition |
|------|-----------|
| PARTNER | Rolled to the cued partner (1/0) — the orientation-reading error of the game |
| TIMING | Waited for cue onset before releasing (1/0) — the premature-roll error |
| LATENCY | Seconds from cue onset to release (video-coded) |
| INIT (trials 10–11 only) | 2 = initiates unprompted ≤10 s; 1 = initiates after E's neutral glance; 0 = no initiation |

Primary turn-taking endpoint (pre-registered): composite of WAIT (2.1) +
PARTNER on gesture/orientation trials (2.2 trials 4–9) + INIT.
Verbal-cue trials 1–3 are warm-up/anchor items and near ceiling by design.

---

## Subtest 3 — Joint Attention Probe (JAP)

Mirrors Museum Look (RJA: fading point + gaze cues) and Look What I Found!
(IJA: spontaneous sharing). Live, video-coded. The room is pre-arranged with **6 target
pictures/objects** on walls and shelves: two in front, two ~90° left/right, two behind
the child's midline — novel targets, different set per form (A: animals; B: vehicles).

### Block 3.1 — Responding to joint attention (RJA) — 10 trials

E sits facing the child ("Let's look at the pictures in this room"). Each trial: E gets
eye contact by saying the child's name, then delivers ONE cue and holds it 3 s. No
verbal label of the target, ever.

| Trials | Cue | Mirrors |
|--------|-----|---------|
| 1–2 | Proximal point (arm extended, target ≤1 m from E) | `hover` rung |
| 3–6 | Distal point (target ≥2 m, including one behind-midline target) | `distal` rung |
| 7–10 | **Gaze only** — head + eye turn, hands in lap (incl. one behind-midline) | `gaze` trials |

The pulse/highlight rung of the game has no live equivalent and is omitted; the ladder
starts at proximal point. 40% gaze trials matches the game's `GAZE_TRIALS` share.

Codes per trial: CORRECT (child fixates the cued target — head/eye turn to the right
object — within 5 s; 1/0); for errors, whether the child looked at a *different* target
(discrimination error) or did not shift gaze at all (no-response).

### Block 3.2 — Initiating joint attention (IJA) — 4 probes

**Never announced.** Probes are embedded in "break" moments between subtests and inside
JAP while E writes on a clipboard, per this schedule: after EIT, after TOP task 2.1,
before RJA, after RJA.

Each probe: a pre-arranged surprise activates while E is visibly disengaged (turned
~45–90° away, writing — mirrors the friend's `awayYaw`). Surprises (different set per
form, ordered big → subtle to mirror the saliency fade):

- Form A: wind-up walking toy crosses the table · remote-controlled light-up star on shelf ·
  A "accidentally" knocks a cup that rolls · a picture on the wall is now upside-down (subtle)
- Form B: battery bubble machine puffs once · remote buzzer + flap opens on a box ·
  A's pen "rolls off" the table · a sticker has appeared on the child's cup (subtle)

Code per probe (hierarchical, take the highest):

| Score | Behaviour |
|-------|-----------|
| 3 | Spontaneous share ≤10 s: points/shows/vocalizes **and** alternates gaze between surprise and E |
| 2 | Spontaneous partial: points at or comments on the surprise without gaze alternation, or gaze-alternates without point/comment |
| 1 | Prompted share: shares only after E's neutral re-engagement ("ം?" + looking up) at 10 s |
| 0 | No share (looks at/handles the surprise but never recruits E, or no reaction) |

Also record LATENCY (surprise onset → first communicative act toward E) — the game's
share-latency analog.

### Block 3.3 — Non-social orienting control — 2 trials

While the child faces forward, a small sound (phone chime) plays from a speaker placed
left, then right, behind the midline. Code whether the child localizes it (1/0).
This separates *social-cue* following from general orienting: RJA can improve while
sound localization stays flat.

Primary JA endpoints (pre-registered): RJA correct on distal+gaze trials (3–10, /8) and
IJA total (/12), reported separately — the games train them as separate steps and they
may move independently.

---

## Subtest 4 — Non-Social Control Task (NCT) — 12 items

Same response format as the EIT, no social content: photo cards of **objects/animals in
Kerala contexts** at two difficulty tiers (6 typical views; 6 unusual angles/partial
occlusion — the perceptual analog of low-intensity faces). "Which one is the ___?" —
3 options. Forms A/B use different photo sets.

Pre-registered prediction: **no reliable change** pre→post. Administered in two blocks
of 6 interleaved after EIT parts 1b and 1d, so it also serves as a pacing break.

---

## Section 5 — Autism Social Skills Profile (ASSP), the far-transfer measure

The battery above asks whether the trained skill itself improved. This section asks the
different — and for a thesis, the more interesting — question: **did any of it show up in the
child's ordinary life?**

### 5.1 The instrument

| | |
|---|---|
| **Name** | Autism Social Skills Profile (ASSP) — Bellini & Hopf (2007), *Focus on Autism and Other Developmental Disabilities*, 22(2), 80–87 |
| **Type** | Informant-rated questionnaire (parent / teacher) — **no child time** |
| **Items** | 49 |
| **Response scale** | 4-point frequency: Never / Sometimes / Often / Very Often |
| **Subscales** | Social Reciprocity · Social Participation–Avoidance · Detrimental Social Behaviours |
| **Time** | ~15–20 min per child per timepoint, completed by the informant |
| **When** | T0, T1, T2 — the same schedule as the battery |

> **Fill from the manual before go-live.** Exact item counts per subscale, the reverse-scored
> item list, raw-score ranges and the published reliability/validity coefficients must be
> transcribed from the ASSP source and recorded in
> [SAP §11](preregistration-and-sap.md). Confirm permission for research use **and for
> translation** at the same time. Nothing in this repo is the authoritative item set.

**Scoring.** Each item scores 1–4; **Detrimental Social Behaviours items are reverse-scored**
so a higher score always means better social functioning. Reported: the **ASSP total** and the
**three subscale raw totals**. Analysis uses raw scores and raw change — the published standard
scores are normed on a US sample, so any standard score is descriptive only, with the mismatch
stated. Chance correction does not apply (design rule 5).

**Translation.** Forward translation by a bilingual clinician, back-translation by a second
independent translator, item-by-item reconciliation, then cognitive pre-testing with 3–5 BUDS
teachers. The **same translated form** is used at T0, T1 and T2 — freeze it; a mid-study
wording fix breaks the comparison. File the final Malayalam form under `validation/`.

### 5.2 Rules specific to an informant measure

The battery's protections (parallel forms, blinded tester, video coding) do not transfer to a
questionnaire. Its threats are different, so its rules are too:

1. **Same informant at every timepoint.** The teacher or parent who completes T0 completes T1
   and T2 for that child. A changed informant is recorded as a protocol deviation.
2. **Blind to their own previous ratings.** T0 forms are collected and never returned; the
   informant never rates with the earlier form in view. They are blind to arm where the
   cluster design allows, and to the hypotheses throughout. They cannot be blind to the
   child's participation — they work in the school.
3. **Fixed observation window.** Every rating refers to the child's behaviour over **the
   preceding 4 weeks**, printed on the form, so the three timepoints cover comparable windows.
4. **Independent double-rating.** For ≥30% of children a **second informant** (the other of
   teacher/parent, or a second teacher) completes the ASSP independently at the same
   timepoint → inter-rater **ICC(2,1)**, target ≥ .70 on the total.
5. **Rater training.** One short briefing on the anchors, the 4-week window, and "rate what
   you see, not what you hope", delivered identically to all informants before T0.
6. **Facilitators do not rate children they facilitate** where another informant is available.

### 5.3 What the ASSP adds, and what it cannot settle

| | Battery (EIT/TOP/JAP) | ASSP |
|---|---|---|
| Measures | The child, directly | An adult's impression of the child |
| Distance from training | Near — same construct, new materials | Far — everyday behaviour |
| Sensitive over 8 weeks? | Yes, by design | Likely not; a null here is expected, not a failure |
| Protected against practice/maturation by | The NCT control (§4) | The NCT control (§4) |
| Protected against **informant expectancy** by | n/a — not informant-rated | Only the waitlist arm, plus rules 5.2.2–5.2.4 |

The last row is the honest limit. The NCT rules out the *child* simply getting better at being
tested; nothing in a single-arm design rules out a *teacher* expecting improvement and rating
more warmly the second time. **The waitlist arm is the ASSP's main protection** — its
informants carry the same expectancy without the intervention — which is a further reason not
to lose the cluster design ([blueprint §3](study-blueprint-buds.md)).

### 5.4 How the two levels are read together

Pre-specify the interpretation now, so it cannot be chosen after the fact:

| Battery | ASSP | Reading |
|---|---|---|
| Gains | Gains | The strongest result: the skill improved **and** reached everyday life. |
| Gains | Flat | The expected result. Near transfer demonstrated; generalization not yet evident at 8 weeks. Report as such — it is not a failure. |
| Flat | Gains | Treat with caution: the trained skill did not move, so an informant shift most likely reflects expectancy or a general engagement effect. Do not headline it. |
| Flat | Flat | No evidence of benefit on either measure. |

---

## Counterbalancing and session plan

Parallel forms apply to the **battery only**. The ASSP is one fixed translated form at every
timepoint (`form = SINGLE`) — a rating scale has no item-memory problem to counterbalance.

| Group (random ½) | Pre-test | Post-test |
|------------------|----------|-----------|
| 1 | Form A | Form B |
| 2 | Form B | Form A |

Stratify the randomization by age band (7–10 / 11–15) so forms are balanced within band.
Same room, same time-of-day window (±2 h), same examiner pre and post per child where
possible. Post-test 3–7 days after the final intervention session. Identical battery at
follow-up (T2, 4–8 weeks) using the child's **pre-test form** (a ≥10-week gap makes item
memory negligible and keeps forms balanced).

Session order (fixed): EIT 1a–1b → NCT block 1 → [IJA probe 1] → EIT 1c–1d → NCT block 2 →
TOP 2.1 → [IJA probe 2] → TOP 2.2 → [IJA probe 3] → JAP RJA → [IJA probe 4] →
sound-control trials → finish. Breaks on request; battery may split into two sittings on
consecutive days if needed (split point: after TOP), same split at pre and post.

**ASSP logistics.** Forms are distributed and collected by the data manager, not by the
intervention facilitators, in the same window as each battery sitting. Completed forms go
straight into the code-keyed store; the informant never sees a previous timepoint's form.

---

## Piloting checklist (before the study proper)

1. **Form equivalence**: administer both forms (1 week apart, order counterbalanced) to
   8–12 typically-developing children in the age band. Form means within ~½ SD per
   subtest; fix any item with a large A/B gap.
2. **Floor/ceiling**: item p-values in .2–.9 range for the sensitive slices (EIT 1c,
   TOP gesture/orient trials, RJA distal+gaze, IJA). Full-intensity anchors may exceed .9.
3. **IRR calibration**: two coders score 5 pilot videos to κ ≥ .80 per code; refine the
   coding manual until reached.
4. **Translation**: forward–back translate all scripts (Malayalam ↔ English) with a
   bilingual clinician; the Malayalam lines above are drafts pending that verification.
5. **Timing**: confirm ≤45 min including breaks for the youngest/most support-needing pilot child.

**ASSP additions to the pilot** (§5):

6. **Translation validated**: forward–back translation reconciled and cognitively pre-tested
   with 3–5 BUDS teachers; the Malayalam form then frozen.
7. **Internal consistency**: Cronbach's α for the total and each subscale on the T0 data,
   before unblinding, reported alongside the published values. A subscale that does not hold
   together in this population is reported as such, not quietly dropped.
8. **Inter-rater agreement**: ICC(2,1) on the ≥30% independently double-rated forms, target
   ≥ .70 on the total; below that, only the total is interpreted.
9. **Test–retest SD**: rate 8–12 children twice, 2 weeks apart with no intervention between,
   to supply the RCI denominator for the ASSP as well as the battery.
10. **Floor/ceiling**: inspect the T0 total distribution — a sample bunched at the floor
    cannot show improvement, and that must be said before the study, not after.

## Analysis (pre-registered endpoints)

**Primary family — near transfer.** Per skill, ONE primary endpoint: EIT part 1c (/12) ·
TOP composite (WAIT + PARTNER gesture/orient + INIT) · JAP split RJA distal+gaze (/8) and
IJA (/12). Group level: Wilcoxon signed-rank (or paired t) with effect sizes. Child level:
Reliable Change Index per primary endpoint using pilot test–retest SD — report "n of N
children showed reliable improvement".

**Secondary — far transfer.** ASSP total (raw change), then the three subscales as a
Holm-corrected family within the secondary set. Reported with effect sizes and CIs; never
substituted for a primary endpoint, and a null here is interpreted per §5.4.

**Control.** NCT and sound-localization must show no reliable group change; if they move,
treat trained-skill gains with suspicion and say so.

Everything else is exploratory. Full endpoint table and tests:
[SAP §6](preregistration-and-sap.md).

## Game → test mapping (validity trace)

The research condition is the **VR (360°) build only** — six games, two per trained skill.
Desktop builds exist in the app for demonstration and familiarization and are not part of the
intervention ([blueprint §8](study-blueprint-buds.md)). The game elements below are shared by
both builds, so the trace holds for the VR versions the children actually play:
Emotion Room 360 · Emotion Cinema 360 (emotion) · Playroom 360 · Football 360 (turn-taking) ·
Museum 360 · Park 360 (joint attention).

| Game element | Test element |
|---|---|
| `single` items, tri-modal answer cards | EIT 1a |
| `whoFeels` group photos | EIT 1b |
| Hard early-freeze (~40–50% intensity), `high` distractor tier | EIT 1c |
| `cause` follow-up questions | EIT 1d |
| Fixed rotation → shuffled rotation; `impatient_tap` | TOP 2.1 rounds 1–5 → 6–8; WAIT code |
| Cue fade verbal → gesture → orient; wrong-partner & premature errors | TOP 2.2 trial tiers; PARTNER & TIMING codes |
| `selfInitiate` rallies | TOP 2.2 trials 10–11 (INIT) |
| Hand ladder hover → distal; gaze-only trials (~40%) | JAP 3.1 trial tiers |
| Surprise saliency fade; `awayYaw`; spontaneous vs prompted; share latency | JAP 3.2 probes, hierarchy + LATENCY |
| (no game analog — control) | NCT; sound-localization trials |

**Far transfer has no element-level trace, by design.** The ASSP is not mirrored from any game
mechanic — that is the point of it. The intended direction is domain-level only, and no ASSP
item subset is scored separately:

| Trained skill (VR games) | ASSP domain a gain should surface in |
|---|---|
| Emotional identification — Emotion Room 360 · Emotion Cinema 360 | Social Reciprocity (reading and responding to others' states) |
| Turn-taking — Playroom 360 · Football 360 | Social Reciprocity · Social Participation–Avoidance (sustaining an exchange, joining in) |
| Joint attention — Museum 360 · Park 360 | Social Reciprocity (responding to bids) · Social Participation–Avoidance (initiating, sharing) |

---

## What changed from version 0.1, and why

Version 0.1 specified this battery (EIT / TOP / JAP / NCT) as the sole outcome, with VSMS and
ATEC-Malayalam as distal secondary measures. Two changes since:

- The **ASSP was added as the far-transfer secondary measure** (§5), and **VSMS, ATEC and
  TRENDS-as-an-outcome were dropped**. The battery remains the primary outcome. TRENDS may
  still be licensed as a stimulus source for the EIT.
- The **intervention is now the VR build only**; desktop play is demonstration and is excluded
  from all efficacy and dose analyses.
- **ISAA** is recorded once at T0 as a participant characteristic alongside the IQ score —
  never a pre/post outcome.

Anyone reading an older draft, an older analysis script, or the dated documents under
`docs/superpowers/` should treat this document as authoritative.
