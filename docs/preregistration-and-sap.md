# Pre-Registration & Statistical Analysis Plan (SAP)

*Version 0.1 · 2026-07-27 · owner: farhanpeecee · status: DRAFT — lock before enrolling the first child*

This document freezes the confirmatory decisions **before** any outcome data are seen. It
pairs with the [study blueprint](study-blueprint-buds.md), the
[outcome measure protocol](pre-post-test-protocol.md), the [VR-UX protocol](vr-ux-protocol.md),
and the [analysis guide](analysis-guide.md). Anything not named "confirmatory" here is
**exploratory** and will be labeled as such in the report.

> **Lock procedure.** Once §§1–9 are agreed, register the timestamped version (OSF / AsPredicted
> for the analysis plan; **CTRI** for the interventional trial itself) and record the registration
> ID and date in §11. After lock, changes are only via a dated, justified amendment in §12.

---

## 1. Study identification

- **Title:** VR social-skills games for autistic children — a cluster-randomized,
  waitlist-controlled generalization trial in BUDS schools.
- **Design:** cluster-randomized (classroom-level) waitlist-controlled trial with an
  informant-rated outcome (**ASSP**) and an embedded non-social discriminant control
  administered directly to the child; plus an embedded VR acceptability study.
- **Intervention condition:** the **VR (360°) build only** — six games, two per trained
  skill. The desktop builds in the app are for demonstration and familiarization and are
  **not** an intervention condition; desktop play is excluded from all efficacy and dose
  analyses (`xr_presenting = 1` filter).
- **Population:** autistic children (± ID) aged 7–15 enrolled in BUDS schools.
- **Registrations:** CTRI (trial) + OSF (this SAP) — IDs in §11.
- **Fallback design:** if too few clusters are available, single-arm pre–post–follow-up;
  the between-arm contrast (H1b) is dropped and only within-child + discriminant-control
  confirmatory tests stand. **This choice is made before randomization and recorded in §11.**

---

## 2. Hypotheses (confirmatory)

Stated directionally; each maps to a test in §6.

- **H1a (within-child efficacy, primary):** In the Immediate arm, the **ASSP total** improves
  from T0→T1.
- **H1b (between-arm efficacy, primary — full design only):** At T1, the Immediate arm shows
  greater ASSP-total gain than the Waitlist arm over the same calendar window. Because the
  outcome is informant-rated, this contrast is also the study's **main guard against
  informant expectancy** (both arms' informants know the study is running;
  [protocol §4](pre-post-test-protocol.md)) — not only an efficacy test.
- **H2 (specificity, primary):** The **NCT** and the **sound-localization** control show **no
  reliable change** T0→T1, and their change is smaller than the ASSP change
  (domain × time interaction). The control is child-administered and the outcome is
  informant-rated, so H2 rules out practice, compliance and maturation — **not** informant
  expectancy, which H1b and the design rules cover instead.
- **H3 (individual-level, primary):** A meaningful proportion of children show **reliable
  improvement** (RCI) on the ASSP total.
- **H4 (dose–response, secondary):** Greater VR dose (sessions/minutes) predicts larger ASSP
  gain.
- **H5 (retention, secondary):** T1 gains are maintained at T2 (no reliable T1→T2 decline).
- **H6 (acceptability, co-primary, descriptive):** A majority of headset users tolerate a
  full VR session (no stop-rule trigger) — reported as n-of-N, not tested.

**Null for the primary family:** no differential change between the ASSP and the control task
(H2 interaction = 0) and no within-arm ASSP gain (H1a = 0).

---

## 3. Design, arms, blinding

- **Randomization unit:** classroom (cluster). Sequence concealed (offline RNG / sealed
  envelopes), **stratified by school and class age profile (7–10 / 11–15)**. Allocation by a
  person not involved in assessment.
- **Arms:** Immediate (T0 → 8-wk intervention → T1 → T2) vs Waitlist (T0 → 8 wk
  business-as-usual → T1 → crossover intervention). Waitlist crossover data are analyzed
  **descriptively only** (within-arm pre–post replication), never pooled into H1b.
- **Blinding:** the control-block tester is blinded to arm and dose and never runs
  intervention sessions. The ASSP informant cannot be blind to the child's participation, but
  **is** blind to arm allocation where the cluster design allows, to their own previous
  ratings (T0 forms are collected and never returned), and to the hypotheses. Blinding
  integrity is queried at T1 (tester guesses arm; report agreement vs chance).
- **Forms:** the ASSP is a single fixed (translated) form at every timepoint — no parallel
  forms, no counterbalancing; `form = SINGLE` on ASSP rows. The NCT keeps its two photo sets,
  alternated T0→T1 with a return to the T0 set at T2.
- **Informant continuity:** the same informant rates a given child at T0, T1 and T2. A change
  of informant is recorded as a protocol deviation and that child is flagged for the
  sensitivity analysis in §8.

---

## 4. Participants & analysis populations

- **Inclusion/exclusion:** per [blueprint §5](study-blueprint-buds.md).
- **Intention-to-treat (ITT), primary population:** every randomized child with a T0 and at
  least one post observation on the endpoint, analyzed by assigned arm regardless of dose.
- **Completer population (sensitivity):** children with `has_post_battery = 1` and dose ≥ the
  pre-set minimum (§5). H1/H2 re-run here; agreement with ITT is reported.
- **Per-child dose** is a covariate/moderator (H4), **not** an inclusion gate for ITT.
- **VR-exposure population (acceptability, H6):** every child who dons the headset for ≥1
  session. Since the intervention *is* the VR build, this is the intervention population;
  a child who never tolerates the headset contributes T0 data and acceptability data but no
  dose, and is analyzed under ITT by assigned arm.

---

## 5. Sampling plan & stopping rules

- **Target N:** set once cluster count is known (blueprint §5). Planning target: detect a
  moderate within-child effect (d_z ≈ 0.5) at 80% power, two-sided α = .05 → ~34 paired
  completers; **inflated** by the cluster design effect `1 + (m − 1)·ICC` (assume ICC ≈ .05,
  m = mean cluster size) and ~20% attrition. **This is a feasibility-bounded target**, not a
  guarantee; H3 (RCI, n-of-N) is the honest small-N headline and does not depend on power.
- **Enrollment stop:** when the target is reached **or** the term calendar closes the window
  (whichever first). No interim efficacy analysis → no alpha spend for stopping.
- **Minimum dose for the completer set:** ≥ **2 sessions and ≥ N scored trials per trained
  VR game** (mirrors the analysis-guide stability screen), counting **VR sessions only**
  (`xr_presenting = 1`). Fixed here, before data: **≥ 6 total VR intervention sessions** =
  "adequate dose". Record the exact N-trials threshold used.
- **Safety stop (VR):** the VR-UX stop rule governs individual sessions; no study-level
  safety stop unless an unexpected serious adverse event pattern emerges (→ IEC).

---

## 6. Confirmatory endpoints & tests

The ASSP is a rating scale and is analysed on **raw scores and raw change** (the published
standard scores are normed on a US sample — reported descriptively only, with the mismatch
stated). Chance correction
`skill_score = 100·max(0,(p−c)/(1−c))` still governs the forced-choice control task and all
in-app telemetry. Endpoints are frozen as:

| # | Endpoint | Metric | Role | Test |
|---|----------|--------|------|------|
| **P1** | **ASSP total** | raw sum (49 items, reverse-scored where required) | **Primary** | H1a: Wilcoxon signed-rank T0→T1 (paired *t* if approx. normal) |
| P2 | ASSP Social Reciprocity | subscale raw total | Secondary | signed-rank, Holm-corrected within the subscale family |
| P3 | ASSP Social Participation–Avoidance | subscale raw total | Secondary | as P2 |
| P4 | ASSP Detrimental Social Behaviours | subscale raw total (reverse-scored) | Secondary | as P2 |
| C1 | **NCT** | /12 chance-corrected | Control | H2: signed-rank T0→T1 expected null |
| C2 | **Sound-localization** | /2 | Control | H2: expected null |

**H1a (within-child, primary):** a single Wilcoxon signed-rank on **P1, the ASSP total**
(Immediate arm), effect size = matched-pairs rank-biserial *r* (and d_z where parametric).
P2–P4 are a secondary family, reported with CIs and Holm correction **within** that family;
they never substitute for P1 and a subscale result is not reported as the study's finding.

**H1b (between-arm, primary — full design):** cluster-adjusted comparison of T0→T1 change
between arms. Primary model: **linear mixed model** on the change (or T1 with T0 as covariate,
ANCOVA-style), fixed effect = arm, **random intercept = classroom**, stratification factors as
fixed covariates. Report arm effect + 95% CI. If the mixed model won't converge (few clusters),
fall back to a cluster-summary approach: one mean change per cluster → Mann–Whitney between arms.

**H2 (specificity, primary):** domain (rated social vs non-social control) × time interaction.
Primary: compare the **standardized** T0→T1 change of the ASSP total vs the control
(NCT + sound-loc) within child (Wilcoxon on the difference-of-differences) — standardization is
required here, not optional, because the two are on different scales and different measurement
modes. C1/C2 must **not** reach a reliable change; if either moves, the ASSP gain is reported
with an explicit caution (analysis-guide rule).

**H3 (individual-level, primary):** **Reliable Change Index** on the ASSP total,
`RCI = (post − pre) / SE_diff`, with `SE_diff = √2 · SD_pilot · √(1 − r_tt)` from the ASSP
test–retest pilot ([protocol §7.4](pre-post-test-protocol.md)). RCI > 1.96 = reliable
improvement. Headline = "**n of N** children improved reliably on the ASSP total." Without the
test–retest pilot this cannot be computed — it is a go-live prerequisite, not an analysis-time
decision.

**H4 (dose–response, secondary):** regress ASSP gain on VR dose (`n_sessions`,
`total_minutes`, `median_gap_days`, counting `xr_presenting = 1` sessions only) with classroom
random intercept; report slope + CI, and test
for a minimal effective dose / diminishing returns (add a quadratic / spline as exploratory).

**H5 (retention, secondary):** Wilcoxon T1→T2 on the ASSP total; "maintained" = no reliable
decline (CI on change includes 0 / RCI not < −1.96).

**H6 (acceptability, co-primary, descriptive):** per [VR-UX §Analysis](vr-ux-protocol.md) —
per construct, per child, per game; **no composite UX score**. Safety headline = n-of-N tolerated
a full session; flag any Smileyometer-vs-behaviour discrepancy.

---

## 7. Multiplicity, inference criteria, effect sizes

- **Primary family = {P1 within-child (H1a), H1b, H2, H3}.** Each is a single pre-designated
  primary test of a different question, so no correction is applied across them; the family is
  small by construction because the outcome is now one instrument, not four endpoints.
  α = .05 two-sided throughout.
- **Subscale family (P2–P4):** **Holm–Bonferroni** within the three subscales, reported as
  secondary. A subscale result never stands in for P1.
- **Secondary (H4, H5) and all VR-UX (H6):** reported with CIs and effect sizes; **no
  confirmatory p-value claims** beyond nominal α, explicitly labeled secondary/descriptive.
- **Estimation over dichotomies:** every test reports an effect size with 95% CI (rank-biserial
  *r*, d_z, or the mixed-model estimate). Given small heterogeneous N, **effect sizes and CIs are
  the primary evidence; p-values are secondary** (analysis-guide O4 rule generalized).

---

## 8. Missing data, outliers, transformations

- **Missingness classification (analysis-guide §3):** blank skill columns = child **never played**
  that skill in VR (structural, not zero) — excluded from that skill's analysis, not imputed
  as 0. `has_post_battery = 0` = dropout with no post ASSP.
- **Item-level missingness on the ASSP:** with ≤10% of items missing on a form, prorate the
  subscale (mean of completed items × item count) and record that it was prorated; above 10%,
  the form is missing. Fixed here, before data.
- **Informant change:** children whose informant changed between timepoints are retained in
  the primary analysis and re-run as a sensitivity analysis with them excluded; report both.
- **Primary handling:** ITT with observed data; **no imputation** for the primary within-child
  tests (paired tests use complete pairs). Sensitivity: (a) completer analysis, (b) for H1b, a
  mixed model under MAR (uses all available T0/T1). Report how many pairs each test used.
- **Attrition analysis:** compare baseline participant characteristics (age, ISAA severity,
  IQ, gender, arm) of completers vs dropouts; report differential attrition by arm.
- **Outliers:** no removal of participant data on outcome grounds. **Unstable estimates**
  (delta from <2 sessions / few trials) are screened out of dose/learning analyses per
  analysis-guide §3 — this is a data-quality filter, defined before data, not outlier hunting.
- **Latency:** use `latency_from_prompt_end_ms` where present (TTS-`onend`), never raw
  `latency_ms`, for any RT/process claim.
- **Transformations:** primary tests are rank-based (distribution-free) → no transformation.
  For mixed models, inspect residuals; log-transform latency if skewed (pre-declared).

---

## 9. Reliability & data-integrity checks (before unblinding)

- **Inter-rater agreement (ASSP):** a second independent informant rates ≥30% of children at
  the same timepoint; target **ICC(2,1) ≥ .70** on the total. Below target, subscale-level
  claims are withdrawn and only the total is interpreted. VR-UX codes keep their video target
  of **κ ≥ .75** (headset occlusion).
- **Internal consistency (ASSP):** Cronbach's α for the total and each subscale computed on T0
  data **before unblinding**, reported alongside the published values. A subscale that does not
  hold together in this population is reported as such, not dropped.
- **Translation integrity:** the forward–back translation is reconciled, cognitively
  pre-tested, and **frozen** before T0; the same Malayalam form is used at every timepoint.
- **Telemetry prerequisites (M1–M5):** head-yaw 5–10 Hz, TTS-`onend` latency, mis-tap/hint
  fields, and the `xrPresenting` flag verified as logged **before** go-live. `xrPresenting` is
  now an **inclusion filter** (research data = VR only), not a contrast variable, so a failure
  to log it invalidates the dose denominator rather than costing one analysis.
- **Chance recoverability:** verified on every forced-choice endpoint (`chance` / `n_options`).

---

## 10. Software & reproducibility

- Analysis in **R** (or SPSS as declared): mixed models `lme4`/`glmmTMB`, rank tests `stats`,
  effect sizes `effectsize`/`rcompanion`, RCI computed from pilot SD/reliability.
- Pipeline built and validated on `sample-data/dummy_research_data.xlsx` (real export shape,
  fake values) **before** real data. Analysis scripts version-controlled; a locked script
  tagged at pre-registration produces every confirmatory number.
- Reporting follows **CONSORT** (extension for cluster + pilot/feasibility as applicable);
  a participant flow diagram (enrolled → randomized → analyzed) is produced.

---

## 11. Registration record (fill at lock)

- Design chosen at lock (full cluster-RCT / single-arm fallback): ______
- Final target N and cluster count: ______
- ASSP: item counts per subscale, reverse-scored item list, score ranges, published
  reliability/validity — transcribed from the manual: ______
- ASSP translation provenance (translators, reconciliation date, cognitive pre-test): ______
- ASSP permission / licensing for research use and translation: ______
- Pilot test–retest SD & reliability on the ASSP total (feeds RCI): ______
- CTRI registration ID / date: ______
- OSF (SAP) registration ID / date: ______
- Locked-script git tag: ______

---

## 12. Amendment log

| Date | Section | Change | Justification | Made before/after unblinding |
|------|---------|--------|---------------|------------------------------|
| — | — | — | — | — |
