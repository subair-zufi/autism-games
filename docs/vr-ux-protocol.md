# VR User-Experience & Acceptability Protocol

Ages 7–15 · Malayalam administration · Meta Quest, six 360° games
(Emotion Room 360, Emotion Cinema 360, Playroom 360, Football 360, Museum 360, Park 360)

This is an **acceptability / usability measure, not an efficacy measure.** It answers
"can these children use, tolerate, and enjoy the headset and the games?" — a
precondition for the intervention, and a moderator to report alongside outcomes. Efficacy
(near transfer) is measured separately by the [pre/post battery](pre-post-test-protocol.md).
Because the sample is autistic children, this protocol leans on **objective telemetry and
structured observation** and treats child self-report as corroborating, not primary —
Likert-style self-report is unreliable in this population (literal interpretation,
alexithymia, acquiescence bias).

Design rules applied throughout:

1. **Five constructs, measured separately.** Usability, cybersickness/comfort,
   presence, engagement/enjoyment, and sensory tolerance can diverge (a game can be fun
   but nauseating, or comfortable but confusing). Never collapse them into one "UX score".
2. **Objective first, proxy second, self-report third.** Headset telemetry and
   video-coded behaviour outrank facilitator/caregiver report, which outranks the child's
   own rating. Where they disagree, trust the objective signal and say so.
3. **Cybersickness is a safety gate, not just a metric.** It is measured pre, during, and
   post every session, with a pre-defined stop rule that overrides all data collection.
4. **Report per child, not just group means.** This population is heterogeneous;
   averages hide the children who removed the headset at minute two. Every endpoint is
   reported as a distribution + an n-of-N tolerated/enjoyed count.
5. **Child-appropriate self-report only.** Pictorial scales (Smileyometer,
   faces-based sickness) with concrete, screenshot-anchored probes — never adult-worded
   questionnaires administered to the child.

---

## Constructs and instruments at a glance

| # | Construct | Primary source | Instrument / metric | When |
|---|-----------|----------------|---------------------|------|
| 1 | **Cybersickness / comfort** | Child + observer | FMS (in-session) · VRSQ or SSQ (pre/post) | Pre, during (every ~3 min), post |
| 2 | **Usability** | Telemetry + observer | Task-based behavioural metrics · facilitator SUS (proxy) | During, post |
| 3 | **Presence** | Child (simplified) | Short pictorial presence items (IPQ-derived) | Post |
| 4 | **Engagement / enjoyment** | Child + telemetry + observer | Smileyometer · Again-Again · on-task/affect codes · session telemetry | During, post |
| 5 | **Sensory tolerance** | Observer + caregiver | Don/doff & distress codes · caregiver sensory form | During, post |

Total added time ≈ 15 min of instruments around a normal game session. The FMS check-ins
happen inside the session and cost seconds each.

---

## Construct 1 — Cybersickness & comfort (the safety gate)

Seated 360° content still produces **vection** (illusory self-motion) from head-turn
scanning, so sickness is a real risk even with no locomotion. This is measured on every
session and gates everything else.

### Instruments

- **Fast Motion Sickness Scale (FMS), in-session.** A single 0–20 verbal/faces rating
  ("How is your tummy / your head? Point to the face.") sampled at baseline and every
  ~3 minutes. Cheap, repeatable, catches build-up before it becomes distress.
- **VRSQ** (Virtual Reality Sickness Questionnaire, 9 items) **or SSQ** (Simulator
  Sickness Questionnaire, 16 items) administered **pre and immediately post**. VRSQ is
  shorter and VR-specific — preferred for this age group. Use the faces/pictorial variant
  for younger or minimally-verbal children; administer as facilitator-read items.
- **Observed sickness signs** (video + live), coded continuously: pallor, sweating,
  yawning, stillness/freezing, hand to head/stomach, headset removal, verbal report.

### Stop rule (overrides data collection)

End the session immediately and remove the headset if **any** of:
FMS ≥ 6 and rising across two consecutive check-ins · any vomiting/retching or pallor+sweating ·
child requests to stop (verbal or by removing the headset) · facilitator judgement of distress.
Record time-to-stop and reason. A stopped session is **not** a missing data point — it is
the acceptability finding.

### Endpoints

Peak FMS · FMS trajectory (slope over the session) · VRSQ/SSQ change pre→post
(total + nausea / oculomotor / disorientation subscales) · % sessions hitting the stop rule ·
per-child "tolerated the full session (Y/N)".

---

## Construct 2 — Usability

Can the child physically operate the headset and drive the game? Confounds outcome data
if they can't — a low game score from a child who couldn't aim the controller is not a
skill deficit.

### Behavioural metrics (primary — from observation + telemetry)

| Metric | Definition | Source |
|--------|-----------|--------|
| DON | Headset donned & fitted within 60 s, ≤1 adult adjustment | Observed 2/1/0 |
| CALIBRATE | Completes IPD/boundary/tutorial without hand-over-hand help | Observed 1/0 |
| SELECT | Selects an intended target on first attempt (controller **or** gaze dwell) | Telemetry: mis-taps / total taps |
| RECOVER | Recovers from a wrong turn / lost HUD without adult rescue | Observed per episode |
| DOFF | Removes headset calmly on request | Observed 2/1/0 |

**Log the input modality per child** (controller vs. gaze/dwell picking) — per the VR
review this is a known open question (controller vs. gaze picking on Quest), and usability
almost certainly differs by modality. It must be on the record to interpret SELECT.

### Facilitator SUS (proxy, secondary)

The **System Usability Scale** (10 items) filled by the facilitator *about* the child's
session — not by the child. Gives a comparable 0–100 number across games and sessions.
Do **not** administer SUS to the child.

### Telemetry to capture (ties to VR review findings)

Per the [VR games expert review](docs/vr-games-expert-review.md), these are needed and not
all logged yet — flag as data-engineering prerequisites:

- **VR-vs-flat mode flag** (`xr.isPresenting`) on every step (review finding M2) — without
  it, usability data from headset and screen sessions are indistinguishable.
- **Head-yaw telemetry** sampled 5–10 Hz during the response window (review finding M1) —
  yields time-to-first-look, scan-path length, direction reversals, dwell per option. These
  double as objective engagement/attention measures (Construct 4).
- **Mis-tap / drag-tail guard events** and **hint state** on the answer record (M5).
- **Latency stamped from TTS `onend`, not utterance start** (M3), or usability latency is
  confounded with Malayalam prompt length.

### Endpoints

Per-child usability composite (DON+CALIBRATE+SELECT+RECOVER+DOFF) · mis-tap rate ·
facilitator SUS · % children reaching independent operation by session 2/3 (learnability).

---

## Construct 3 — Presence

The proposed mechanism of VR transfer — worth measuring but low-stakes; keep it short and
child-appropriate.

- **Simplified presence items** derived from the **IPQ** (igroup Presence Questionnaire),
  4–5 items reworded to concrete child language and rated on a 5-point faces scale, e.g.:
  "Did it feel like you were really *there* in the room/stadium/park?" ·
  "Did you forget about the real room around you?" ·
  "Did the things in the game feel real?"
- Administer **post-session only**, facilitator-read, screenshot-anchored.
- Optional behavioural corroborator: spontaneous in-world behaviours (ducking, reaching
  for virtual objects, addressing avatars) coded from video — a proxy that needs no
  self-report.

Endpoint: mean simplified-presence score per game (descriptive; not a primary endpoint).

---

## Construct 4 — Engagement & enjoyment

Often VR's main advantage for autistic learners, and the most defensible self-report
because it's about preference, not introspection.

### Child self-report (pictorial, validated for children)

- **Smileyometer** (Fun Toolkit; Read & MacFarlane) — 5-point faces, "How much fun was
  that game?" Administered per game, post.
- **Again-Again table** — "Would you play it again?" **Yes / Maybe / No**, one row per game.
  Captures behavioural intention with almost no verbal load; also lets children **rank**
  the six games by comparison.

### Behavioural & telemetry (objective, primary)

| Metric | Definition | Source |
|--------|-----------|--------|
| ON-TASK | Proportion of session oriented to / acting on the task | Video code, interval sampling |
| POS-AFFECT | Spontaneous positive affect (smile, laugh, "again!", bouncing) | Video code, frequency |
| VOLUNTARY-CONTINUE | Chooses to keep playing when offered a stop | Observed / telemetry |
| SESSION LENGTH & COMPLETION | Duration played, trials completed vs. offered | Telemetry |
| RE-ENGAGEMENT | Asks for the headset / a specific game in later sessions | Facilitator log |

Head-yaw telemetry (from Construct 2) also feeds here: active scanning of all options
before answering is an engagement/attention signal, not just usability.

### Endpoints

Smileyometer per game · Again-Again ranking · on-task proportion · positive-affect rate ·
voluntary-continue rate. Triangulate: a game with a high Smileyometer but low on-task time
and early removal is **not** actually engaging — report the discrepancy.

---

## Construct 5 — Sensory tolerance (autism-specific)

The most common dropout driver in this population, and specific to the headset + these
games' content.

### Observed / logged during session

- **Fit & weight distress** — headset too heavy/loose for smaller heads; adjustments
  needed; forehead/nose pressure complaints.
- **Audio tolerance** — reaction to volume, chimes, TTS voice; requests to lower/mute;
  covering ears.
- **Visual intensity** — brightness, and specifically the **close-to-face avatars/faces**
  in Emotion Room 360 and Emotion Cinema 360 (a plausible aversive stimulus for this
  cohort — flag distancing/averting/backing-away behaviour to those games specifically).
- **Transition distress** — don and doff moments coded as their own events (some children
  tolerate the game but not the putting-on/taking-off).
- **Perceived control** — did the child know they could pause/exit? Availability and use of
  a safe-exit affordance strongly predicts tolerance; log whether it was rehearsed and used.

### Caregiver sensory form (post-session)

Short caregiver-completed form (see Form C) covering comfort, any distress the caregiver
noticed, sensory issues (light/sound/weight/face-proximity), and willingness for the child
to continue. Caregivers detect subtle distress facilitators miss.

### Endpoints

Sensory-distress event count by type · per-game aversion flags (esp. face-proximity games) ·
caregiver-rated comfort · % children willing to continue to next session.

---

## Observation coding scheme (video)

One fixed-angle camera on the child (face + upper body; headset means face is partly
occluded, so weight body/hand/vocal cues). Interval sampling: **15-second intervals**,
code presence/absence per interval, plus event-count codes tallied continuously.

| Code | Type | Definition |
|------|------|-----------|
| ON-TASK | Interval | Oriented to / acting on the current game task |
| POS-AFFECT | Event | Smile, laugh, positive vocalization, "again", excited movement |
| DISTRESS | Event | Whine, protest, freeze, self-soothe, hand to head/stomach, tears |
| SICK-SIGN | Event | Pallor, sweating, yawning, stillness, hand to stomach (feeds Construct 1) |
| REMOVAL | Event | Child lifts/removes headset (record timestamp + apparent reason) |
| ADULT-HELP | Event | Any facilitator physical/verbal rescue (feeds usability) |
| IN-WORLD | Event | Ducking, reaching, addressing avatars (feeds presence) |
| SAFE-EXIT | Event | Child uses pause/exit affordance independently |

**Reliability:** a second blinded coder scores ≥ 30% of sessions; target Cohen's κ ≥ .75
per code (looser than the outcome battery's .80 because headset occlusion makes affect
coding harder — state this). Refine the manual on pilot videos until reached.

---

## Forms

Two counterbalanced game orders (to control fatigue/novelty across the six games), plus the
three respondent forms. Order counterbalancing matters because later games are rated after
more time in the headset (more fatigue, more sickness build-up).

**Game-order Form A:** Museum → Park → Playroom → Football → Emotion Room → Emotion Cinema
**Game-order Form B:** Emotion Cinema → Emotion Room → Football → Playroom → Park → Museum

(Reverse order; half the children get A, half B, stratified by age band 7–10 / 11–15.
If a session covers only a subset of games, keep the relative order and record which games
were shown.)

### Form 1 — Facilitator session record (per session)
- Child ID · date · game-order form (A/B) · games played · input modality (controller/gaze)
- Baseline FMS · FMS at each ~3-min check-in · peak FMS · stop-rule triggered? (reason, time)
- VRSQ/SSQ pre & post (attach)
- Usability: DON / CALIBRATE / SELECT (mis-taps) / RECOVER / DOFF · facilitator SUS (10 items)
- Sensory events by type · safe-exit rehearsed? used?
- Free-text: anything notable

### Form 2 — Child self-report (per game, pictorial, facilitator-read)
- **Smileyometer** (5 faces): "How much fun was ___?" — one per game played
- **Again-Again**: "Play ___ again?" Yes / Maybe / No — one per game
- **Simplified presence** (5 faces, 3–4 items): really there? / forgot the real room? / felt real?
- Optional: "Which game did you like best?" (point at screenshots — gives a ranking)

### Form 3 — Caregiver form (per session)
- Did your child seem comfortable? (faces)
- Any distress you noticed the facilitator might not have? (free text + checklist:
  light / sound / headset weight / faces-too-close / taking-it-off / other)
- Any tummy/head/dizziness afterward? (Y/N + notes; catches delayed sickness)
- Willing for your child to continue next time? Yes / Maybe / No

---

## Session flow

1. **Pre (out of headset):** baseline FMS · VRSQ/SSQ pre · rehearse safe-exit ("if you want
   to stop, do this").
2. **Don & acclimate:** fit headset, boundary/tutorial, first FMS check. Code DON/CALIBRATE.
3. **Play** in the assigned game order, FMS check every ~3 min, continuous observation coding,
   telemetry logging (mode flag + head-yaw + latency). Honour the stop rule at all times.
4. **Doff (immediately):** VRSQ/SSQ post while symptoms are fresh · code DOFF.
5. **Child self-report (Form 2)** with screenshot anchors.
6. **Facilitator (Form 1) and caregiver (Form 3)** forms.

Keep total headset time within tolerance for the youngest/most support-needing pilot child;
split across days if needed and keep the split point consistent per child.

---

## Analysis

Report **per construct, per child, and per game** — no single composite "UX score".

- **Cybersickness:** peak FMS & trajectory; VRSQ/SSQ pre→post (Wilcoxon) with subscales;
  % sessions stopped. **Safety headline: n-of-N children tolerated a full session.**
- **Usability:** usability composite distribution; mis-tap rate by input modality;
  learnability (independent operation by session 2/3).
- **Engagement:** Smileyometer & Again-Again per game; on-task proportion; positive-affect
  rate; game ranking. **Flag any Smileyometer-vs-behaviour discrepancy explicitly.**
- **Presence:** descriptive per game (+ in-world behaviour corroboration).
- **Sensory:** distress-event counts by type; per-game aversion flags (call out the
  face-proximity games specifically); caregiver comfort & willingness-to-continue.

**Moderator use:** carry per-child tolerance/enjoyment into the efficacy analysis — a child
who couldn't tolerate the headset contributes little dose, and their outcome data should be
interpreted (and reported) in that light rather than pooled blind.

---

## Piloting checklist (before the study proper)

1. **Stop-rule & sickness safety:** run 4–6 pilot children; confirm the FMS check cadence
   and stop rule catch build-up early and are feasible mid-game. Adjust cadence if 3 min is
   too sparse for the most sensitive child.
2. **Coding reliability:** two coders reach κ ≥ .75 per observation code on 5 pilot videos;
   refine the manual (headset occlusion makes affect coding the hard part).
3. **Instrument comprehension:** confirm children can use the Smileyometer, Again-Again, and
   faces-sickness scales — pilot the pictorial anchors and Malayalam wording (forward–back
   translate; the game screenshots must be recognizable out of headset).
4. **Telemetry prerequisites:** verify the VR-vs-flat flag, head-yaw sampling, TTS-`onend`
   latency, and hint/mis-tap fields are actually being logged (VR-review findings M1–M5)
   **before** relying on them as endpoints.
5. **Modality decision:** pilot controller vs. gaze/dwell picking and pick a default (or
   log it as a within-study factor) — it drives usability and must not be an uncontrolled
   confound.
