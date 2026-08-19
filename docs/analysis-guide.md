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
| **Trial-level CSV** · `/api/admin/export/trials.csv` | `trials` | one row per scored trial | learning curves, RT/process, VR-vs-flat, error analysis |
| **Dose CSV** · `/api/admin/export/dose.csv` | `dose` | one row per participant × game | dose-response, retention/spacing |
| **Export scores** · `/api/admin/assessments.csv` | `battery` | one row per blinded score | pre/post outcomes (near-transfer + distal) |
| **Participants CSV** · `/api/admin/export/participants.csv` | `participants` | one row per child | the de-identified demographic roster / covariates (no name/contact) |
| **Codebook CSV** · `/api/admin/export/codebook.csv` | `codebook` | one row per variable | the data dictionary — type, unit and value meanings for every raw column |
| **All raw (ZIP)** · `/api/admin/export/all.zip` | — | bundle | participants + raw_events + sessions + level_progress + codebook in one download |
| *(derived from trials + dose + battery)* | `summary` | **one row per participant** | between-subjects analysis — **start here** |

**Raw data is the ground truth.** `trials`, `dose`, and `summary` apply the app's
standardised scoring for convenience; if you disagree with any scoring choice
(first-attempt rule, chance baseline, session windows), rebuild it yourself from
`raw_events`.

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
2. **Understand the missingness.** Blank skill columns in `summary` mean the child
   **never played** that skill (structural missing, not zero). `has_post_battery = 0`
   flags dropouts with no post outcome. Decide intention-to-treat vs completer
   analysis explicitly.
3. **Prefer the clean RT.** `latency_ms` includes spoken-prompt time; use
   `latency_from_prompt_end_ms` where present (the 360 emotion games + Football 360).
4. **Recode for SPSS.** Booleans export as `1/0` already — in every sheet,
   `raw_events` included (`correct`, `firstAttempt`, `xrPresenting`, `hinted`,
   `unlocked`/`passed`/`mastered`, …); empty cells are system-missing.
   `xr_presenting` is `1` (VR) / `0` (flat) / blank (not recorded).
5. **`raw_events` columns are stable.** The flattened payload columns follow a
   pinned order (every known field first, always, even when empty; genuinely new
   fields only ever appended after them), so a saved import / column map keeps
   working across exports — new data never shifts the existing columns.

---

## 4. Research questions → sheets & columns

### Q1 — Did the training transfer? *(primary outcome)*
Does in-game improvement move the **blinded near-transfer battery**, while the
**non-social control (NCT) stays flat**?

- **Sheet:** `summary` (one row per child).
- **Predictors:** `composite_delta`, or a specific `{skill}_delta`.
- **Outcomes:** `eit_gain`, `top_gain`, `jap_gain` (trained) vs `nct_gain` (control).
- **Analysis:** paired *t*/Wilcoxon on each instrument pre→post; correlate in-game
  delta with battery gain; the trained–vs–NCT contrast is the specificity test.
- **Expectation baked into the sample:** EIT/TOP/JAP gain, NCT ≈ 0.

### Q2 — How fast do children learn? *(learning curves)*
- **Sheet:** `trials`.
- **Columns:** `first_attempt_correct` ~ `trial_in_game` (or session index), grouped
  by `participant_code` × `game_key`; `latency_from_prompt_end_ms` for automaticity.
- **Analysis:** mixed-effects logistic growth (trials nested in sessions in children);
  slope = acquisition rate. Compare slopes across subgroups.

### Q3 — Pre vs post within child
- **Sheet:** `summary` — `{skill}_pre` / `{skill}_post`; or `battery` in long form.
- **Analysis:** paired tests / repeated-measures; effect sizes (Cohen's *d*, or
  *d_z* for paired).

### Q4 — Dose–response and retention
- **Sheet:** `dose` (per game) and `summary` (`total_*`, `active_days`).
- **Columns:** `n_sessions`, `n_scored_trials`, `total_minutes`, `span_days`,
  `median_gap_days` → predict gains.
- **Analysis:** regress gain on dose; test for a minimal effective dose /
  diminishing returns; `median_gap_days` speaks to spacing/retention.

### Q5 — Who benefits most? *(moderation / ATI)*
- **Sheet:** `summary`.
- **Moderators:** `iq_score`/`iq_band`, `age_years`/`age_band`, `autism_level`, `gender`.
- **Analysis:** regress gain on moderator (aptitude-by-treatment interactions);
  or compare `age_band` / `iq_band` groups. Small N ⇒ report effect sizes over *p*.

### Q6 — Does VR add anything?
- **Sheet:** `trials`, split by `xr_presenting` (same game, two conditions).
- **Columns:** accuracy, `latency_from_prompt_end_ms`, and the head-scan block
  (`head_yaw_travel_deg`, `head_yaw_range_deg`, `head_reversals`, `head_to_target_ms`)
  as objective attention markers.
- **Note:** Schoolyard 360 is flat-input (`xr_presenting = 0`, no head telemetry).

### Q7 — What's confused / which sub-skills lag?
- **Sheet:** `raw_events`, `event_type = answer`.
- **Emotion confusion:** cross-tabulate `answer` × `picked` (emotion games) →
  confusion matrix; does the off-diagonal shrink pre→post?
- **Social-norms sub-skills:** group by `construct`; joint-attention by `cue`/`cueKind`.

### Q8 — Reliability & psychometrics
- **Inter-rater:** `battery` rows with the same probe but different `rater_id`
  (`is_double_coded = true`) → Cohen's κ / ICC.
- **Internal consistency / test–retest:** split `trials` by trial or session and
  correlate; item difficulty per emotion/construct/cue from `raw_events`.

---

## 5. Design notes carried in the data

- **Chance is recoverable everywhere** (`chance` on trials; `n_options` on battery),
  so you can always chance-correct.
- **Parallel forms** `A`/`B` are counterbalanced on the battery (`form`) — post-test
  gains can't be item memory.
- **Discriminant control** (`NCT`) has identical response demands but no social
  content; it anchors specificity.
- **Blinding & reliability** are represented by `rater_id` + `is_double_coded`.

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
