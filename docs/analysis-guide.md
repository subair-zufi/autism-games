# Analysis Guide — Autism Games research data

How to turn the exported data into answers. This maps each research question to
the exact **sheet + columns** to use, with the scoring maths and the data-quality
checks to run first. It pairs with the synthetic preview dataset in
[`sample-data/`](../sample-data) (open `dummy_research_data.xlsx`), which has the
identical structure to the real exports — only the values are fake.

---

## 1. The data you get

Everything is downloaded from the **Admin dashboard** (or the API directly). Five
data sheets, at three grains:

| Export (button / endpoint) | Sheet | Grain | Use for |
|---|---|---|---|
| **Raw events CSV** · `/api/admin/export/events_raw.csv` | `raw_events` | one row per recorded event | your own scoring/filtering in SPSS/R — the source of truth |
| **Sessions CSV** · `/api/admin/export/sessions.csv` | `sessions` | one row per play session | session-level timing/duration; join to `raw_events` on `session_id` |
| **Level progress CSV** · `/api/admin/export/level_progress.csv` | `level_progress` | one row per participant × game × level | progression/unlock state (attempts, best score/accuracy, pass/master) |
| **Trial-level CSV** · `/api/admin/export/trials.csv` | `trials` | one row per scored trial | learning curves, RT/process, head-scan, error analysis |
| **Dose CSV** · `/api/admin/export/dose.csv` | `dose` | one row per participant × game | dose-response, retention/spacing |
| **Session UX CSV** · `/api/admin/export/session_ux.csv` | `session_ux` | one row per participant × visit × rater | the user-experience objective: across-session trajectories and overall experience |
| **Export scores** · `/api/admin/assessments.csv` | `battery` | one row per entered score | pre/post outcomes: the near-transfer battery, the ASSP, and the control |
| **Participants CSV** · `/api/admin/export/participants.csv` | `participants` | one row per child | the de-identified demographic roster / covariates (no name/contact) |
| **Codebook CSV** · `/api/admin/export/codebook.csv` | `codebook` | one row per variable | the data dictionary — type, unit and value meanings for every raw column |
| **All raw (ZIP)** · `/api/admin/export/all.zip` | — | bundle | participants + raw_events + sessions + level_progress + codebook in one download |
| *(derived from trials + dose + battery)* | `summary` | **one row per participant** | between-subjects analysis — **start here** |

### Raw or derived — know which you are holding

| | Files | What has been done to them |
|---|---|---|
| **Raw** (as stored) | `raw_events` · `sessions` · `level_progress` · `participants` · `battery` · `session_ux` | **Nothing.** Every recorded event and every entered score, exactly as saved. No scoring, no filtering, no banding, no aggregation. |
| **Derived** (convenience) | `trials` · `dose` · `summary` | The app's scoring applied: the first-attempt rule, chance-correction, session windows, per-skill and composite averaging. |

**If you want to run your own statistics from scratch, use the raw files and ignore the
derived ones entirely.** One click gets all of them: **All raw (ZIP)** ·
`/api/admin/export/all.zip` — participants, raw events, sessions, level progress, the
outcome scores, and the codebook, with no scoring applied. The derived files are
deliberately *excluded* from that bundle so there is no ambiguity about what you have.

`raw_events` is the ground truth underneath everything: one row per recorded action, every
payload field flattened into its own column, in a pinned column order. Anything in `trials`,
`dose` or `summary` can be rebuilt from it — so if you disagree with a scoring choice (the
first-attempt rule, a chance baseline, how sessions are windowed), rebuild it your own way
rather than working around the app's version. The `codebook` sheet defines every column.

---

## 2. The one formula you need

Every forced-choice score is reported as **chance-corrected first-attempt
accuracy** on a 0–100 scale:

```
skill_score = 100 · max(0, (p − c) / (1 − c))
```

- `p` = proportion correct on the **first attempt**
- `c` = the item's guessing baseline (`chance` column; `1 / n_options`)

So **0 = chance-level performance, 100 = ceiling**, and a 2-choice task is directly
comparable to a 4-choice task or a "wait your turn" task (`c = 0`). The `summary`
and `trials`/`dose` sheets already apply this; to reproduce it from `raw_events`,
aggregate `correct` and `chance` per whatever grouping you choose.

---

## 3. Do these checks before any analysis

1. **Screen unstable estimates.** A delta from 1–2 sessions or a handful of trials
   is noise. Filter on `summary.total_scored_trials` / `dose.n_sessions` (e.g.
   require ≥ 2 sessions and ≥ N trials per game) before trusting `*_delta`.
   *(In the sample, the dropout P-005 shows `emotion_delta = 100` from 26 trials —
   exactly the artefact this screen removes.)*
2. **Filter to the intervention: VR only.** The research condition is the 360°/VR build;
   the desktop games are in the app for demonstration only
   ([blueprint §8](study-blueprint-buds.md)). **Every efficacy, dose and learning analysis
   filters `xr_presenting = 1`** (`trials`, and `raw_events.xrPresenting`). Desktop rows are
   legitimate data about demo use — just not intervention data. Blank `xr_presenting` means
   the flag was not recorded: exclude it from the intervention set rather than assuming.
3. **Understand the missingness.** Blank skill columns in `summary` mean the child
   **never played** that skill (structural missing, not zero). `has_post_battery = 0`
   flags dropouts with no post outcome. Decide intention-to-treat vs completer
   analysis explicitly.
4. **Prefer the clean RT.** `latency_ms` includes spoken-prompt time; use
   `latency_from_prompt_end_ms` where present (the 360 emotion games + Football 360).
5. **Recode for SPSS.** Booleans export as `1/0` already — in every sheet,
   `raw_events` included (`correct`, `firstAttempt`, `xrPresenting`, `hinted`,
   `unlocked`/`passed`/`mastered`, …); empty cells are system-missing.
   `xr_presenting` is `1` (VR) / `0` (flat) / blank (not recorded).
6. **`raw_events` columns are stable.** The flattened payload columns follow a
   pinned order (every known field first, always, even when empty; genuinely new
   fields only ever appended after them), so a saved import / column map keeps
   working across exports — new data never shifts the existing columns.

---

## 4. Research questions → sheets & columns

### Q1 — Did the training transfer? *(primary outcome)*
Does in-game improvement move the **blinded near-transfer battery**, while the
**non-social control (NCT) stays flat**?

- **Sheet:** `summary` (one row per child).
- **Predictors:** `composite_delta`, or a specific `{skill}_delta` (VR trials only).
- **Outcomes:** `eit_gain`, `top_gain`, `jap_gain` (trained) vs `nct_gain` /
  `soundloc_gain` (controls).
- **Analysis:** paired *t*/Wilcoxon on each instrument pre→post; correlate in-game
  delta with battery gain; the trained–vs–NCT contrast is the specificity test.
- **Expectation baked into the sample:** EIT/TOP/JAP gain, NCT ≈ 0.

### Q1b — Did it reach everyday life? *(secondary outcome)*
Same question one step further out: does the **informant-rated ASSP** move too?

- **Sheet:** `summary`.
- **Outcomes:** `assp_total_gain` (secondary endpoint) and the three subscale gains
  (`assp_sr_gain`, `assp_spa_gain`, `assp_dsb_gain`), Holm-corrected within the family.
- **Analysis:** paired *t*/Wilcoxon pre→post, plus the between-arm contrast at T1. If you
  compare the ASSP against the NCT, **standardize both change scores first** — they are
  different scales and different measurement modes (rating scale vs child task).
- **Read it against Q1, not on its own.** The four-way interpretation table is fixed in
  advance in [protocol §5.4](pre-post-test-protocol.md): battery gain + ASSP gain is the
  strongest result; battery gain + ASSP flat is the *expected* one at 8 weeks and is not a
  failure; ASSP gain without a battery gain is not headlined.
- **Caveat to carry into the write-up:** the NCT rules out practice/compliance/maturation
  for the child, not **informant expectancy** on the ASSP. Only the between-arm (waitlist)
  contrast speaks to that — see [protocol §5.3](pre-post-test-protocol.md).

### Q6 — What was the user experience? *(exploratory)*
Can these children use, tolerate and enjoy the headset — and does that change as
the sessions go on?

- **Sheet:** `session_ux` (one row per participant × visit × rater).
- **Across sessions:** plot each item against `visit_index` per child. The shape
  of the line is the finding — settling in, steady, or deteriorating.
- **The item that moves:** `play_again_num` (no=0, maybe=1, yes=2). Children
  shift on this before they shift on `child_fun`, which sits near its ceiling
  from the first session — report both and say so.
- **Safety headline:** `stopped_early` — n-of-N children who completed a full
  session, with `stop_reason` coded by type.
- **Reliability:** rows with `is_second_rating = 1` are an independent rating of
  the same visit. Agreement between them and the `rater_id = ""` row on the five
  `rated_*` items is what makes Part B more than one person's impression.
- **Open text:** `went_well`, `was_difficult`, `different_from_last` — code
  thematically. The last is written as a change question on purpose and carries
  the trajectory.
- **Join to telemetry:** on `student_id` + the date. A visit normally spans
  several games, so it matches *several* rows in `sessions` / `trials`, not one.

**Report the items separately.** There is no total score in the export and none
should be computed: summing them would assert a single-factor structure this
record has never been shown to have. Where a child's rating and their behaviour
disagree — high `child_fun`, but `stopped_early = 1` — believe the behaviour and
report the mismatch.

### Q2 — How fast do children learn? *(learning curves)*
- **Sheet:** `trials`, filtered to `xr_presenting = 1`.
- **Columns:** `first_attempt_correct` ~ `trial_in_game` (or session index), grouped
  by `participant_code` × `game_key`; `latency_from_prompt_end_ms` for automaticity;
  `hinted` for scaffold dependence; **`level` as a covariate — see the warning below**.
- **Analysis:** mixed-effects logistic growth (trials nested in sessions in children);
  slope = acquisition rate. Compare slopes across subgroups.

> **Control for difficulty, or the curve is wrong.** Children move up levels during the
> study, and the app does not hold the level fixed. `chance` corrects only for the number
> of options; it does **not** capture the subtler cues, faded hints and more confusable
> distractors a harder tier adds. A child who progressed easy → hard mid-study can show a
> *flat or falling* accuracy curve while genuinely improving. Always put `level` in the
> model (or fit within-level curves), and report how many children changed level and when.

**Three secondary process measures on the same sheet, all worth a paragraph each:**

- **Speed → automaticity.** `latency_from_prompt_end_ms` (never raw `latency_ms`) against
  trial number. Accuracy rising *and* latency falling is a stronger learning claim than
  accuracy alone. Guard: dwell-based selection makes looking instrumental, so pool
  latencies only within the same `inputMethod` (`raw_events`).
- **Hints → independence.** The proportion of trials with `hinted = 1` should fall across
  sessions. A child at ceiling *with* hints is a different result from one at ceiling
  without them.
- **Head-scan → search efficiency.** `head_yaw_travel_deg`, `head_yaw_range_deg`,
  `head_reversals`, `head_to_target_ms`. A child who finds the target with less sweeping
  and fewer reversals is searching more efficiently — an objective process signal no
  questionnaire can give you. Caveat: in the two joint-attention games, gaze can be the
  *selection* method, which makes head yaw instrumental rather than social;
  `headYawContaminated` in `raw_events` flags exactly those trials — exclude or adjust.

### Q3 — Pre vs post within child
- **Sheet:** `summary` — `{skill}_pre` / `{skill}_post` (in-game, VR trials only); or
  `battery` in long form for the battery instruments, the ASSP and the control.
- **Analysis:** paired tests / repeated-measures; effect sizes (Cohen's *d*, or
  *d_z* for paired). ASSP is analysed on **raw** scores and raw change.

### Q4 — Dose–response and retention *(the bridge from in-game data to the outcome)*
- **Sheet:** `dose` (per game) and `summary` (`total_*`, `active_days`).
- **Columns:** `n_sessions`, `n_scored_trials`, `total_minutes`, `span_days`,
  `median_gap_days` → predict gains. **Count VR sessions only** — desktop demo play is
  not dose.
- **Analysis:** regress **battery** gain on dose (ASSP gain exploratorily); test for a
  minimal effective dose / diminishing returns; `median_gap_days` speaks to
  spacing/retention. Classroom as a random intercept.
- **Why this matters more than it looks:** dose is measured objectively by the app, not
  self-reported, and it varies naturally between children. A dose–response relationship is
  therefore one of the few pieces of causal evidence available in a small trial — if more
  play predicts more gain, chance and expectancy explain the pattern less well.

### Q5 — Who benefits most? *(moderation / ATI)*
- **Sheet:** `summary`.
- **Moderators:** `iq_score`/`iq_band`, `age_years`/`age_band`, `autism_level`, `gender`.
- **Analysis:** regress gain on moderator (aptitude-by-treatment interactions);
  or compare `age_band` / `iq_band` groups. Small N ⇒ report effect sizes over *p*.

### Q6 — How does the child attend inside the headset? *(process)*
There is no VR-vs-flat contrast to run: the intervention is VR-only and desktop play is
demonstration, so the two are not two conditions of one experiment. Treat the head-scan
block as a process/attention measure within the VR trials instead.

- **Sheet:** `trials`, filtered to `xr_presenting = 1`.
- **Columns:** accuracy, `latency_from_prompt_end_ms`, and the head-scan block
  (`head_yaw_travel_deg`, `head_yaw_range_deg`, `head_reversals`, `head_to_target_ms`)
  as objective attention markers — does scanning become more direct as accuracy rises?
- **If you do look at desktop rows**, it is a descriptive comparison of a demo surface
  against the intervention, confounded by who played what and when. Label it exploratory,
  never as O5 evidence.

### Q7 — What's confused / which sub-skills lag?
- **Sheet:** `raw_events`, `event_type = answer`.
- **Emotion confusion:** cross-tabulate `answer` × `picked` (emotion games) →
  confusion matrix; does the off-diagonal shrink pre→post?
- **Joint-attention sub-skills:** group by `cue`/`cueKind`.

### Q8 — Reliability & psychometrics
- **Inter-rater (battery):** `battery` rows for the same probe with different `rater_id`
  (`is_double_coded = true`) → Cohen's **κ**, target ≥ .80 per code.
- **Inter-rater (ASSP):** the same column pair, but the second `rater_id` is an independent
  **informant**, not a video coder → **ICC(2,1)**, target ≥ .70 on the total.
- **Internal consistency (ASSP):** Cronbach's α on T0 item data, computed before unblinding.
  (Item-level ASSP responses are entered outside the app — the `battery` sheet stores the
  scored totals.)
- **In-game test–retest:** split `trials` by trial or session and correlate; item difficulty
  per emotion/cue from `raw_events`.

---

## 4b. What the in-game metrics are for (and what they are not)

The app produces far more data than the outcome measures do, and it is easy to over-claim
from it. The division of labour is fixed:

| Question | Evidence | Status |
|---|---|---|
| Did the child improve **at the game**? | `summary` `{skill}_pre/post/delta`, `trials` curves | **Process** — never the study's result |
| Did the trained **skill** improve? | EIT / TOP / JAP | **Primary outcome** |
| Did it reach **everyday life**? | ASSP | Secondary outcome |
| Did **more play** produce more gain? | `dose` × battery gain | The link between the two |
| **How** did they improve? | latency, hints, head-scan, error types | Mechanism |
| Did they **engage** at all? | sessions, minutes, level progression, on-task | Feasibility / fidelity |

**In-game improvement is confounded with game familiarity, and that is by design.** A child
gets better at Museum 360 partly because joint attention improved and partly because they
learned Museum 360. Nothing in the telemetry can separate those two — which is the entire
reason the battery exists, using different materials in a different room. So:

- **Never report an in-game gain as evidence of efficacy.** It belongs in a "did the
  intervention take?" section, not in the results for O1.
- **Do report it**, because a study where children *didn't* improve in-game and *did*
  improve on the battery would be strange, and one where neither moved tells you the dose or
  the design failed rather than the concept.
- The genuinely load-bearing use is the **correlation** between in-game gain and battery
  gain (Q1) and the **dose–response** relationship (Q4). Those connect the process to the
  outcome; the raw in-game numbers on their own do not.

### Report progression — it is the measure the score hides

If a child moved from Easy to Hard, **that is the improvement**, and the app already defines
it: **70%** accuracy passes a level, **80%** masters it, both stored per child × game × level
in `level_progress` (`passed`, `mastered`, `attempts`, `best_accuracy`).

A flat score at a rising difficulty is real progress that the score actively conceals, so
report progression as its own measure rather than trying to squeeze it into the delta:

- **Levels passed** and **levels mastered** per child (out of 3 per game).
- **Highest level reached** per game, and how quickly.
- The **distribution** across the cohort — how many children reached Hard on anything.

It needs no modelling, has no small-sample problem, and it is the app's own definition of
getting better. Together with the process measures (Q2) and dose–response (Q4) it gives a
complete account of the training without leaning on a fragile difference score.

### Three traps in `{skill}_delta`

`baseline_score` is the child's **first session** of a game and `latest_score` their
**last**; `delta` is the difference. Three things break that comparison, all avoidable:

1. **Level changes.** The two sessions may be at different difficulties (see the Q2
   warning). The app now reports this for you: every game score carries `baseline_level`,
   `latest_level` and **`delta_same_level`** — filter on the last one, and treat a delta
   across tiers as uninterpretable rather than as a decline. (The Progress dashboard does
   the same thing, showing "Easy → Hard" instead of a red ▼.)
2. **Too few sessions.** A delta from one or two sessions is noise — apply the stability
   screen in §3.1.
3. **Ceiling.** A child who scored 100 in session one cannot improve. Report the baseline
   distribution alongside any delta, and consider excluding ceiling cases from the
   dose–response model rather than letting them flatten the slope.

---

## 5. Design notes carried in the data

- **Chance is recoverable everywhere** (`chance` on trials; `n_options` on battery),
  so you can always chance-correct.
- **Two levels of transfer:** the battery (`EIT`/`TOP`/`JAP`) is the **primary**,
  near-transfer outcome; the `ASSP_*` rows are the **secondary**, far-transfer one. Do not
  pool them, and do not swap which is which after seeing results.
- **Forms:** parallel forms `A`/`B` are counterbalanced on the battery and the `NCT` (`form`)
  — post-test gains can't be item memory. The ASSP is one fixed translated form
  (`form = SINGLE`); a rating scale has no item-memory problem.
- **Discriminant control** (`NCT`) has identical response demands but no social
  content; it anchors specificity against practice and maturation.
- **Blinding & reliability** are represented by `rater_id` + `is_double_coded` — on the
  battery these identify a second **video coder** (κ), on the ASSP a second independent
  **informant** (ICC).
- **`xr_presenting` is an inclusion filter, not a contrast:** `1` = the VR intervention,
  `0` = desktop demo play, blank = not recorded.

---

## 6. Reproducing the sample dataset

The preview in `sample-data/` is generated by
[`generate_dummy_data.py`](../sample-data/generate_dummy_data.py), which runs the
real `app.scoring` pipeline over synthetic events:

```bash
server/.venv/bin/python -m pip install openpyxl
PYTHONPATH=server server/.venv/bin/python sample-data/generate_dummy_data.py
```

**All values there are fake** — it exists only to show the exact shape of the real
exports before real data collection.
