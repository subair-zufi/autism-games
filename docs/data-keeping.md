# Data-Keeping & Dashboard/Metrics Review

*Expert review of what the Autism Games platform records per participant, whether it is
research-relevant, and what is missing.*

*Version 1.0 · 2026-08-19 · reviewer role: research-methods audit of the dashboard + metrics layer*

This document is a **data dictionary + relevance assessment + gap analysis** for the
participant data the app collects and the metrics the dashboards derive from it. It pairs
with the [study blueprint](study-blueprint-buds.md), the
[pre/post battery protocol](pre-post-test-protocol.md), the
[pre-registration & SAP](preregistration-and-sap.md), and the
[analysis guide](analysis-guide.md). Where those documents state the *intended* design, this
one audits what the **code actually stores** (`server/app/models.py`, `scoring.py`, the
`admin`/`reports` routers, and the client `analytics.ts` + `useGameAnalytics.ts`).

---

## 0. Executive summary

**What is strong.** The telemetry layer is unusually well-built for a small study. Every
forced-choice trial keeps its guessing baseline (`chance` / `n_options`) so scores are
chance-recoverable; first-attempt rules are enforced per game; a single **standardised
0–100 chance-corrected skill score** makes 2-, 3-, 4-alternative and "wait your turn" tasks
directly comparable; VR-vs-flat is flagged on every step; dose (sessions, minutes, spacing)
is derivable; and the outcome battery carries `rater_id` + `is_double_coded` + parallel
`form` for inter-rater and form-equivalence checks. The exports are de-identified
(participant code + opaque id, never the child's name).

**What is missing or risky (headline).**

1. **Study-design metadata is not stored on the participant or the session** — no
   **arm** (Immediate/Waitlist), no **cluster/classroom/school**, no **study-phase/timepoint**
   tag on gameplay sessions, no **enrollment/consent** fields. The confirmatory design
   (cluster-randomized, waitlist-controlled, T0/T1/T2) cannot be reconstructed from the
   database alone.
2. **The primary outcome and the game data never meet inside the app.** Battery scores
   (`AssessmentScore`) are CSV import/export only; there is **no server `summary` endpoint**
   and **no dashboard panel** that joins pre/post battery gains to in-game scores. The
   `summary` sheet in the analysis guide exists *only in the Python dummy generator*, so the
   primary-outcome join, RCI, and the NCT specificity contrast all happen off-platform.
3. **Baseline characterization is thinner than the protocol requires** — **ISAA** severity,
   verbal/communication level, language of administration, and the IQ instrument/date are
   not stored (only a bare `iq_score` and a DSM-5 `autism_level`).
4. **PII and research data are co-mingled in one table**, and admin dashboard endpoints
   return the child's name, parent name, and parent contact. The exports are clean, but the
   operational store and the code↔identity separation required by the blueprint are not.
5. **The co-primary VR acceptability outcome (O6)** — cybersickness (FMS/SSQ), presence,
   engagement, stop-rule triggers, adverse events — has **no home in the data model** at all.
6. **`composite_delta` (first-session→last-session) is a within-app proxy, not the study's
   pre/post efficacy outcome**, and is easy to mistake for one.

Details and recommendations follow.

---

## 1. Where data lives (systems of record)

| Store | Table / file | Grain | Written by |
|---|---|---|---|
| Mentor accounts | `users` | one row per mentor/therapist | sign-up |
| **Participants** | `students` | one row per child | New Participant form |
| Play sessions | `game_sessions` | one row per game run | `startSession`/`endSession` |
| **Gameplay steps** | `game_events` (+ JSONB `payload`) | one row per step/trial | `recordStep` (only when logged in) |
| Level progression | `level_progress` | one row per (mentor, child, game, level) | `submitProgress` |
| **Outcome battery** | `assessment_scores` | one row per blinded score | CSV import (blinded tester) |
| Admins | `admins` | dashboard operators | seed/admin |
| Derived scores | *(none — computed on read)* | per trial / game / skill / participant / cohort | `scoring.py` |

Only **logged-in** play is stored; anonymous play is a deliberate no-op
(`analytics.ts`). Sessions/events attach the **active student** automatically, so
attribution is per child. Battery scores are the one stream **not** produced by the app —
they are typed by a blinded examiner and imported.

---

## 2. Per-participant data dictionary

### 2.1 Participant record — `students` (`models.py:Student`)

| Field | Type | Research role | Notes / relevance |
|---|---|---|---|
| `id` | UUID | **linkage key** | Opaque; carried into every export as `student_id`. Re-identification path back to PII (see §6). |
| `mentor_id` | UUID | ownership/scoping | Also the de-facto data-access boundary. |
| `full_name` | str | **operational only** | Direct identifier. Not a research variable — should be segregated (§6). |
| `date_of_birth` | date | **covariate** | Feeds `age_years` / `age_band` (moderation, O4). Also a quasi-identifier. |
| `gender` | str | **covariate** | Moderator (O4); free among Male/Female/Other. |
| `autism_level` | str | **covariate** | DSM-5 Level 1/2/3. *Not* ISAA (see gap G3). |
| `iq_score` | int | **covariate** | Feeds `iq_band`. No instrument/date/source recorded. |
| `participant_code` | str | **pseudonymous key** | e.g. `P-2024-001`; unique *per mentor*. The intended analysis id. Nullable — a child with no code is excluded from battery import and templates. |
| `rehabilitation_centre` | str | descriptive | Could proxy a site/cluster but is **not** used as one. |
| `parent_guardian_name` | str | operational only | Direct identifier (consent/contact). |
| `parent_contact` | str | operational only | Direct identifier. |
| `notes` | str | free text | Not analyzable; may contain incidental PII. |
| `avatar` | str | UI only | Not research data. |
| `is_active` | bool | housekeeping | Soft delete / active roster. |
| `created_at` / `updated_at` | datetime | provenance | `created_at` is used as a study-order proxy in exports (imperfect — see G1). |

**Relevance verdict:** the demographic/clinical covariates (age, gender, autism level, IQ)
are exactly the O4 moderators and are appropriate. The identifiers (name, parent name,
parent contact) are operationally necessary but are **not research variables** and are
stored in the wrong place (§6). `notes`/`avatar` are non-analytic.

### 2.2 Session — `game_sessions`

`id`, `user_id`, `student_id`, `game_key`, `final_score`, `started_at`, `ended_at`.

- **Relevance:** `started_at`/`ended_at` give play duration → the `dose` metrics
  (`total_minutes`, `span_days`, `median_gap_days`). Session id groups steps for the
  first-attempt and per-session scoring.
- **Gap:** no **study-phase / timepoint** tag (G1). There is no way, in the row, to say
  "this session is part of the 8-week intervention window" vs a stray replay. `final_score`
  is a raw per-game tally, not comparable across games (the standardised score replaces it).

### 2.3 Gameplay step — `game_events` + `payload`

Fixed columns: `id`, `user_id`, `student_id`, `session_id`, `game_key`, `event_type`,
`step_index`, `score`, `client_timestamp`, `created_at`, and a JSONB **`payload`**.

`event_type` drives scoring: `answer`, `roll_return`, `place_block`, `hand_off`,
`impatient_tap`, `share`, `no_share`, `game_over`. The **`payload`** is the substance —
every process/condition field the analysis relies on. Union of payload keys actually
recorded (from `sample-data/raw_events.csv` + `useGameAnalytics.ts` enrichment):

| Payload key(s) | Meaning | Used for |
|---|---|---|
| `correct`, `firstAttempt`, `attempt` | outcome + first-attempt flags | the scored trial; first-attempt accuracy |
| `chance`, `n_options`(battery), `visibleCount` | guessing baseline / options on screen | chance-correction (`c`); `1/visibleCount` for pointing games |
| `latencyMs` | response latency (includes spoken-prompt time) | RT — **but** contaminated by TTS |
| `latencyFromPromptEndMs` | clean RT (TTS `onend`) | the RT the SAP mandates — **only on 360 emotion games + Football 360** |
| `hinted` | a hint fired before the answer | scaffold/process |
| `level` / `difficulty` | Easy/Moderate/Hard tier | per-level chance table; learning |
| `construct` | social-norms sub-skill (greetings, sharing, …) | per-construct profile |
| `cue`, `cueKind` | joint-attention cue (verbal/gesture/orient; pulse/hover/distal) | RJA cue-fading analysis; `1/partners` chance |
| `answer`, `picked` | emotion shown vs chosen | confusion matrix |
| `spontaneous`, `nudges`, `found`, `discovery`, `saliency`, `during` | initiation-JA process | Look-What-I-Found / Park 360 |
| `headStartYawDeg`, `headEndYawDeg`, `headYawTravelDeg`, `headYawRangeDeg`, `headReversals`, `headSamples`, `headMinPitchDeg`, `headMaxPitchDeg`, `headToTargetMs`, `targetBearingDeg` | VR head-scan telemetry | objective attention markers (O5); **VR only** |
| `xrPresenting` | 1 = immersive VR, 0 = flat | VR-vs-flat condition (O5) |
| `inputMethod` | gaze vs controller/pointer | latency pooling guard (dwell ≠ tap) |
| `headYawContaminated` | JA-in-VR where head yaw is instrumental, not shared attention | exclude/adjust contaminated yaw |
| *(visibility metrics — `visibilityMetrics()`)* | time the page was hidden mid-trial | exclude trials spanning a headset break / tab switch |
| `boardCount`, `count`, `round`, `slot`, `target`, `method`, `source`, `kind`, `clip`, `freezeKind`, `errorType` | per-game bookkeeping / error typing | error analysis, replay reconstruction |

**Relevance verdict:** this is the core research asset and it is well-designed — chance is
always recoverable, first attempts are separable, condition flags (VR, input, visibility,
contaminated yaw) are present, and mechanism telemetry (head scan) is captured where it is
meaningful. Two caveats: **clean RT coverage is partial** (only some games record
`latencyFromPromptEndMs`; the SAP forbids using raw `latencyMs` for RT claims → RT analysis
is limited to that subset), and payload is schema-less JSONB, so field presence must be
validated per go-live (the M1–M5 telemetry pre-checks in the blueprint).

### 2.4 Level progression — `level_progress`

Per (mentor, child, game, level): `attempts`, `best_score`, `best_accuracy`, `unlocked`,
`passed` (≥70%), `mastered` (≥80%), timestamps.

- **Relevance:** engagement/adaptivity state and the source of the mentor-facing
  `completion_pct`. It is a **best-of** summary, not a trial log — do not use it for
  learning curves (use `trials`). `best_accuracy` is uncorrected accuracy, not the
  chance-corrected skill score.

### 2.5 Outcome battery — `assessment_scores` (the primary outcome)

Per (child, `timepoint`, `instrument`, `form`, `rater_id`): `raw_score`, `n_options`,
`max_score`, `is_double_coded`, `assessed_on`, `notes`.

- `timepoint` ∈ pre / post / followup (T0/T1/T2).
- `instrument` ∈ EIT / TOP / JAP / NCT (near-transfer battery) + VSMS / ATEC / TRENDS
  (distal). Free-text, so any instrument name imports.
- `form` A/B (parallel forms); `rater_id` + `is_double_coded` support inter-rater κ.
- Uniqueness is per (child, timepoint, instrument, form, rater) → a second blinded coder is
  a separate row (IRR), and re-import updates in place.

**Relevance verdict:** the schema is exactly right for the confirmatory endpoints and for
reliability (κ), form equivalence, and chance-correction on the battery. The problem is not
the schema but that this table is **isolated** from the rest of the platform (§5, G2).

---

## 3. Metrics the dashboards derive (`scoring.py`)

| Metric | Definition | Surfaced in |
|---|---|---|
| **Skill Score (per game)** | `100·max(0,(p−c)/(1−c))`, first-attempt, chance-corrected | Progress, admin games, exports |
| Raw accuracy | uncorrected proportion correct | secondary |
| `baseline_score` / `latest_score` / `delta` | first vs last **session of that game** | Progress ▲/▼ chips |
| **Skill Score (per skill)** | equal-weighted mean of that skill's games | Progress radar, Cohort |
| **Composite social-emotional** | equal-weighted mean of the four skill scores | Progress hero, Participants overview |
| median latency | per game / emotion / construct | Progress |
| Emotion confusion matrix | `answer × picked`, first attempts | Progress |
| Per-construct score | pooled over recent sessions (default 5) | Progress social-norms |
| Dose summary | sessions, minutes, span, median gap | `dose.csv` |
| Group stats | mean / SD / mean-delta by cohort or demographic band | Cohort |

**Dashboards:** the **mentor** app shows a per-child Progress dashboard (composite, radar,
skill breakdown, construct profile, emotion confusion, weekly activity, recent list) and a
Cohort comparison (group means ± SD by gender / autism level / age / IQ band). The **admin**
dashboard shows platform totals, a per-game breakdown with skill score, an activity
timeseries, a per-participant overview, and the CSV/battery exports.

**Critical interpretation caveat.** `delta` / `composite_delta` compares a game's **first
vs last recorded session**, irrespective of study phase. It is a within-app improvement
proxy, **not** the study's T0→T1 battery change and **not** an efficacy outcome. It is shown
as a ▲/▼ chip next to scores and is easy to over-read. The SAP's efficacy tests run on
`assessment_scores`, not on this chip. This should be labelled wherever it appears.

---

## 4. Relevance map — every research question to its data

| Question (blueprint O1–O8 / analysis guide Q1–Q8) | Data that answers it | Status |
|---|---|---|
| O1 Near-transfer efficacy | `assessment_scores` (EIT/TOP/JAP) vs NCT | **stored, but not joined in-app** (G2) |
| O2 In-game acquisition | `game_events` → `trials` (`first_attempt_correct` ~ trial index) | ✅ well covered |
| O3 Dose–response | `game_sessions` → `dose` | ✅ covered |
| O4 Moderation | `students` (age, gender, autism level, IQ) | ⚠️ covered but ISAA/verbal-level missing (G3) |
| O5 VR value-add | `payload.xrPresenting` + head-scan block | ✅ covered (flat games have no head telemetry, by design) |
| O6 VR acceptability (co-primary) | FMS/SSQ/presence/engagement/stop-rule | ❌ **no data model** (G4) |
| O7 Confusions / sub-skills | `answer×picked`, `construct`, `cue` | ✅ covered |
| O8 Reliability / psychometrics | `rater_id`, `is_double_coded`, `form` | ✅ schema present |
| H1b Between-arm contrast | **arm + cluster** assignment | ❌ **not stored** (G1) |
| H3 Reliable Change Index | battery pre/post + pilot SD | computed **off-platform** (G2) |
| Missingness (ITT vs completer) | `has_post_battery`, "never played" | derived **off-platform**, not a stored flag (G1/G2) |

---

## 5. What is missing — gap analysis

### G1 — Study-design metadata is absent from the operational store
The confirmatory design is a **cluster-randomized, waitlist-controlled** trial with T0/T1/T2
windows, yet none of the following is captured:

- **Arm** (Immediate vs Waitlist) — required for H1b. *Not stored.*
- **Cluster / classroom / school** — the randomization unit and the mixed-model random
  intercept. *Not stored* (`rehabilitation_centre` is free text and unused as a cluster).
- **Study-phase / timepoint tag on `game_sessions`** — no way to bound the "intervention
  window" or to separate baseline familiarization from dose. Only wall-clock timestamps
  exist; export order falls back to `created_at`.
- **Enrollment date, consent status, assent status, withdrawal date.** Consent is paper per
  the blueprint, but there is no per-participant flag even to gate analysis or to record
  `has_post_battery` / dropout. Attrition analysis (SAP §8) has no structured source.

*Impact:* H1b and any cluster-adjusted model cannot be run from platform data; ITT vs
completer populations are reconstructed by hand.

### G2 — The primary outcome never integrates with the game data in-app
`assessment_scores` is **import/export CSV only**. There is:

- **no server `summary` endpoint** — the per-participant `summary` sheet (with `eit_gain`,
  `top_gain`, `jap_gain`, `nct_gain`, `has_post_battery`, `composite_delta`) that the
  analysis guide centres on exists **only in `sample-data/generate_dummy_data.py`**, i.e. it
  is a documentation artifact, not a reproducible product export;
- **no dashboard panel** showing battery scores, pre/post gains, the NCT specificity
  contrast, or RCI — the admin dashboard surfaces only in-game telemetry;
- no in-app computation of the confirmatory statistics.

*Impact:* the study's headline analysis is done entirely off-platform in R/SPSS from two
disconnected exports; the app cannot show a researcher "did this child transfer?".

### G3 — Baseline characterization is thinner than the protocol
Blueprint §5 requires **ISAA** severity, **verbal/communication level**, **language of
administration (Malayalam)**, class, and the IQ **instrument/source/date**. The model stores
only a bare `iq_score` and a DSM-5 `autism_level`. ISAA (the India-standard severity
instrument the protocol names) has no field; IQ has no provenance.

*Impact:* O4 moderation is limited to age/gender/DSM-level/raw-IQ; ISAA-based severity
moderation and attrition-by-severity are not possible from stored data.

### G4 — The co-primary acceptability outcome (O6) has no data model
Cybersickness (FMS, VRSQ/SSQ), presence, engagement, sensory tolerance, **stop-rule
triggers**, and the **adverse-event log** are all paper per the VR-UX protocol. For a
*co-primary* outcome, having no structured store means O6 is entirely outside the system of
record and cannot be joined to dose or head-scan telemetry.

*Impact:* the safety/acceptability headline ("n-of-N tolerated a full session") is manual;
Smileyometer-vs-behaviour discrepancy checks have no dataset.

### G5 — Data governance: PII co-mingled with research data
`students` holds direct identifiers (`full_name`, `parent_guardian_name`, `parent_contact`,
`notes`) **in the same row** as clinical covariates, and admin endpoints
(`/students/overview`, `/students/{id}`, `/students/{id}/profile`) **return those
identifiers** to any admin. The blueprint §11 requires the `participant_code ↔ identity`
map to live in a single access-controlled file, **never in a data sheet**. The exports do
de-identify (participant code + opaque UUID, no name — good), but:

- the operational DB is not segregated, and admins see PII by default;
- the opaque `student_id` is carried into **every** export as a join key, so anyone with DB
  access can re-identify an exported row.

There is also **no retention/destruction metadata**, no access audit, and IQ + autism level
are special-category data with no field-level handling. This is a DPDP-relevant gap.

### G6 — Missingness and data-quality rules are convention, not enforced
"Never played a skill" (structural missing) vs zero, the "≥2 sessions / N trials" stability
screen, and `has_post_battery` are all **analysis-time conventions** (analysis guide §3).
Nothing in the store distinguishes a structural blank from a genuine zero, and the
instability screen is guidance, not a stored quality flag. A `*_delta` of 100 from a
26-trial dropout (the sample's P-005) is exactly the artifact this leaves in the data.

### G7 — Latency/RT coverage is partial
`latencyFromPromptEndMs` (the only RT the SAP permits) is recorded on the 360 emotion games
and Football 360; other games record `latencyMs`, which includes spoken-prompt time. RT/
automaticity claims are therefore restricted to a subset of games. This is documented but
limits O2's RT strand.

---

## 6. Recommendations (prioritised)

**P0 — enables the confirmatory design**
1. Add study-design columns: on `students` an **arm** and a **cluster/classroom** (+ school);
   on `game_sessions` a **study-phase/timepoint** tag or an enrollment→window mapping so
   intervention sessions are identifiable. (G1)
2. Add a **participant enrollment/status** record: enrollment date, consent flag, assent
   flag, withdrawal date, and a stored **`has_post_battery`** — so ITT/completer and
   attrition analyses have a source. (G1)

**P0 — closes the outcome loop**
3. Build a server **`summary` export/endpoint** that joins `assessment_scores` gains to the
   standardised in-game scores per participant (the shape the analysis guide already
   documents), so the primary-outcome table is reproducible from the product, not a script. (G2)
4. Add a dashboard **Outcomes panel**: pre/post battery per instrument, the trained-vs-NCT
   specificity view, and RCI per child. (G2)

**P1 — data quality & scope**
5. Add **ISAA** severity, verbal/communication level, language, class, and IQ
   instrument/date to the participant record. (G3)
6. Give **O6 (VR acceptability)** a data model: per-session FMS/SSQ/presence/engagement, a
   **stop-rule trigger** flag, and an **adverse-event** table. (G4)
7. Store explicit **missingness/quality flags** (structural-missing vs zero; an
   `unstable_estimate` flag from the ≥2-session/N-trial screen). (G6)
8. Extend `latencyFromPromptEndMs` coverage to the remaining games, or mark per-game RT
   validity in the export. (G7)

**P1 — governance**
9. **Segregate PII from research data**: move `full_name`/parent fields to an
   access-controlled identity table keyed by `participant_code`; drop direct identifiers
   from the default admin overview/profile responses; add **retention/destruction** metadata
   and an access audit. Re-check that `student_id` in exports cannot re-identify without that
   key. (G5)

**Docs**
10. Label `delta`/`composite_delta` everywhere it appears as a **within-app first→last
    session proxy, not the study efficacy outcome**, to prevent misreading. (§3)

---

## 7. One-line answer to the brief

The app keeps a **rich, well-instrumented per-trial telemetry stream and a clean blinded
outcome-battery table**, and its **covariates are appropriate** — but it is **missing the
study-design scaffolding** (arm, cluster, timepoint, consent/enrollment), the **in-app
integration and display of the primary outcome**, part of the **protocol-mandated baseline
battery** (ISAA, verbal level), any **structured VR-acceptability/adverse-event capture**,
and **PII segregation**. The telemetry is research-grade; the surrounding *study* data model
is not yet complete.
