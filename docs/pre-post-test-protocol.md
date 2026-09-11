# Pre/Post Outcome Measure — ASSP + Discriminant Control

Ages 7–15 · Malayalam administration · three trained skills (Emotional Identification,
Turn-Taking, Joint Attention) · intervention delivered in **VR only**

The **Autism Social Skills Profile (ASSP)** is the study's pre/post outcome tool. It is an
informant-rated measure of the child's everyday social functioning, completed by an adult
who knows the child well (BUDS teacher or parent/guardian), at T0, T1 and T2.

Alongside it, one short **discriminant control block** is administered directly to the
child. It is *not* an outcome — it exists only to show that any ASSP change is not
general practice, compliance or maturation.

> **Read this before locking the SAP.** Replacing a direct near-transfer battery with an
> informant rating scale changes what the study can claim. ASSP asks about *generalized,
> real-world social behaviour*, so a pre→post gain is evidence of **transfer to everyday
> functioning** — a stronger claim, but a harder one to move in 8 weeks, and one that
> carries informant-expectancy risk the old direct battery did not. §2 and §7 spell out
> how the design compensates. The study is framed as **generalization**, not near transfer,
> throughout this repo.

---

## 1. Instrument

| | |
|---|---|
| **Name** | Autism Social Skills Profile (ASSP) |
| **Source** | Bellini & Hopf (2007), *Focus on Autism and Other Developmental Disabilities*, 22(2), 80–87 |
| **Type** | Informant-rated questionnaire (parent / teacher) |
| **Items** | 49 |
| **Response scale** | 4-point frequency: Never / Sometimes / Often / Very Often |
| **Subscales** | Social Reciprocity · Social Participation–Avoidance · Detrimental Social Behaviours |
| **Administration time** | ~15–20 min per child per timepoint |
| **Respondent burden** | One form per child per timepoint (three total across T0/T1/T2) |

> **Fill from the manual before go-live.** Exact item counts per subscale, the reverse-scored
> item list, the raw-score ranges, and the published reliability/validity coefficients must be
> transcribed from the ASSP source and recorded in §10 of the
> [pre-registration](preregistration-and-sap.md). Nothing in this repo should be treated as
> the authoritative item set. Confirm permission/licensing terms for research use and for
> translation at the same time.

### Scoring

- Each item scores 1–4. **Detrimental Social Behaviours items are reverse-scored** so that a
  higher score always means better social functioning.
- Derived scores, all reported: **ASSP total** (primary), and the **three subscale raw
  totals** (secondary).
- The published standard scores are normed on a US sample. This study analyses **raw scores
  and raw change**; any standard score is reported descriptively only, with the norm mismatch
  stated.
- No chance correction applies — ASSP is a rating scale, not a forced-choice test. Chance
  correction still governs the control task (§3) and all in-app telemetry.

### Translation

The ASSP is an English instrument and BUDS informants rate in Malayalam. Before T0:

1. Forward translation by a bilingual clinician, back-translation by a second, independent
   bilingual translator, reconciliation of discrepancies item by item.
2. Cognitive pre-testing with 3–5 BUDS teachers — do they read each item the way it is meant?
3. The **same translated form** is used at T0, T1 and T2. Freeze it; a mid-study wording fix
   breaks the pre/post comparison.
4. Record the translation provenance in the pre-registration (§10) and file the final
   Malayalam form under `validation/`.

---

## 2. Design rules

1. **Same informant at every timepoint.** The teacher or parent who completes T0 completes
   T1 and T2 for that child. A changed informant is a protocol deviation and is recorded as
   one — informant change is the single largest threat to a pre/post rating-scale contrast.
2. **Informant blinding, as far as it goes.** The informant cannot be blind to the child's
   participation (they are in the school). They **are** kept blind to: arm allocation where
   the classroom design allows, their own previous ratings (T0 forms are collected and not
   returned), and the study's hypotheses. Never rate with the previous form in view.
3. **Rate on a fixed observation window.** Every rating refers to the child's behaviour over
   **the preceding 4 weeks**, stated on the form, so T0/T1/T2 cover comparable windows.
4. **Rater training.** A single short briefing covering the response anchors, the 4-week
   window, and "rate what you see, not what you hope" — delivered once, identically, to all
   informants before T0.
5. **No parallel forms.** Forms A/B were a feature of the retired direct battery (they
   controlled item memory in a child-administered test). A rating scale has no item-memory
   problem, so the `form` field is recorded as `SINGLE` for ASSP rows. The corresponding
   threat — **informant expectancy** — is handled by rules 2, 3 and §7 instead.
6. **Independent double-rating.** For ≥30% of children, a **second informant** (the other of
   teacher/parent, or a second teacher) completes the ASSP independently at the same
   timepoint. This yields inter-rater agreement (ICC) and is the rating-scale analogue of the
   old double-coded video.
7. **Discriminant control administered directly to the child** (§3), by a tester who does not
   run intervention sessions.

---

## 3. Discriminant control block (~6 min, child-administered)

Retained unchanged from the previous battery, and retained for one reason only: it should
**not** move. Two parts, administered together at T0, T1 and T2.

### 3.1 Non-Social Control Task (NCT) — 12 items

Photo cards of **objects/animals in Kerala contexts**, no social content, at two difficulty
tiers (6 typical views; 6 unusual angles / partial occlusion). "Which one is the ___?" —
3 options, forced choice. Two sets exist (previously forms A/B); alternate them across T0/T1
and return to the T0 set at T2, so the control task keeps its own memory guard.

Record per item: correct (1/0), and `n_options` so chance stays recoverable.

### 3.2 Non-social orienting control — 2 trials

While the child faces forward, a small sound (phone chime) plays from a speaker placed left,
then right, behind the midline. Code whether the child localizes it (1/0). This separates
social-cue following from general orienting.

### Pre-registered prediction

**No reliable change pre→post** on either part. If either moves, the ASSP gain is reported
with an explicit caution (see [analysis guide](analysis-guide.md) §3 and
[SAP](preregistration-and-sap.md) §6).

---

## 4. What the control does and does not control

State this plainly in the write-up; it is the main methodological cost of the change.

| Threat to a pre→post ASSP gain | Does the NCT / sound-loc control it? |
|---|---|
| General practice, test-wiseness, compliance improvement | ✅ Yes — same child, same response demands, no social content |
| Maturation over the study window | ✅ Yes |
| Regression to the mean on the child's task performance | ✅ Yes |
| **Informant expectancy** — the teacher knows the child played, expects improvement | ❌ **No.** Different measurement mode and different respondent |
| **Informant drift** — the rater's internal anchors shift between T0 and T1 | ❌ No |

The expectancy and drift threats are addressed by design instead: blinding the informant to
their own T0 ratings (§2.2), the fixed 4-week observation window (§2.3), independent
double-rating (§2.6), and — where the cluster design holds — the waitlist arm, whose
informants have the same expectancy exposure without the intervention. **The waitlist
contrast (H1b) is therefore the strongest available guard against expectancy**, and should be
described as such rather than as a mere efficacy comparison.

---

## 5. Session plan

| Timepoint | ASSP | Control block | Window |
|---|---|---|---|
| **T0** (baseline) | Informant form | Child, ~6 min | Before randomization |
| **T1** (post) | Same informant | Same child block | 3–7 days after the final intervention session |
| **T2** (follow-up) | Same informant | Same child block | 4–8 weeks after T1 |

ASSP forms are distributed and collected by the data manager, not by the intervention
facilitators. Completed forms go straight into the code-keyed store; the informant never sees
a previous timepoint's form.

The control block is administered in a quiet room, same room and same time-of-day window
(±2 h) per child across timepoints, by the blinded tester.

---

## 6. Endpoints

| # | Endpoint | Metric | Role |
|---|---|---|---|
| **P1** | **ASSP total** | raw sum, 49 items, reverse-scored where required | **Primary** |
| P2 | ASSP Social Reciprocity | subscale raw total | Secondary |
| P3 | ASSP Social Participation–Avoidance | subscale raw total | Secondary |
| P4 | ASSP Detrimental Social Behaviours | subscale raw total (reverse-scored) | Secondary |
| C1 | NCT | /12, chance-corrected | Discriminant control — expected null |
| C2 | Sound-localization | /2 | Discriminant control — expected null |

The subscales are **secondary and interpreted as a family**, not as four independent
primaries; the study is not powered to test each one. See [SAP §6–7](preregistration-and-sap.md).

---

## 7. Piloting checklist (before the study proper)

1. **Translation validation** — forward–back translation complete, reconciled, and cognitively
   pre-tested with 3–5 BUDS teachers (§1).
2. **Internal consistency in sample** — compute Cronbach's α for the total and each subscale on
   the T0 data before unblinding; report alongside the published values. A subscale that does
   not hold together in this population is reported as such, not quietly dropped.
3. **Inter-rater agreement** — ICC(2,1) on the ≥30% independently double-rated forms, target
   **ICC ≥ .70** for the total. Below that, the subscale-level claims are withdrawn and only
   the total is interpreted.
4. **Test–retest SD for the RCI** — rate 8–12 children twice, 2 weeks apart, with no
   intervention in between. This SD and reliability feed the Reliable Change Index
   ([SAP §6](preregistration-and-sap.md)); without it H3 cannot be computed.
5. **Floor/ceiling** — check the T0 total distribution. A sample bunched at the floor cannot
   show improvement; if so, say it before the study, not after.
6. **Control block timing and floor/ceiling** — NCT item p-values in the .2–.9 range; whole
   block ≤ 10 min including settling.

---

## 8. Intervention → measure mapping (validity trace)

The research condition is the **VR (360°) build only** — six games, two per trained skill.
Desktop builds exist in the app for demonstration and familiarization and are **not** part of
the intervention (see [blueprint §8](study-blueprint-buds.md)).

| Trained skill | VR games (the intervention) | ASSP domain the gain should surface in |
|---|---|---|
| Emotional identification | Emotion Room 360 · Emotion Cinema 360 | Social Reciprocity (reading and responding to others' states) |
| Turn-taking | Playroom 360 · Football 360 | Social Reciprocity · Social Participation–Avoidance (sustaining an exchange, joining in) |
| Joint attention | Museum 360 · Park 360 | Social Reciprocity (responding to bids) · Social Participation–Avoidance (initiating, sharing) |
| — (control) | none | NCT · sound-localization: expected flat |

This mapping is **directional, at domain level only**. Item-level alignment (which ASSP items
plausibly index which trained behaviour) is to be completed against the manual and recorded
before lock; it is a pre-specified interpretive aid, not an analysis — no item subsets are
scored separately.

---

## 9. What changed from version 0.1, and why

Version 0.1 of this protocol specified a bespoke near-transfer battery: EIT (emotion
identification), TOP (turn-taking observation), JAP (joint attention probe), plus VSMS and
ATEC-Malayalam as distal measures, with parallel forms A/B and video coding.

It has been replaced by the ASSP as the single pre/post tool. Consequences carried through
the rest of the repo:

- The claim moves from **near transfer** to **generalization to everyday social behaviour**.
- **Parallel forms A/B no longer apply** to the outcome (the `form` field is `SINGLE` for ASSP
  rows); the control task keeps its own two sets.
- **Video coding and coder κ no longer apply** to the outcome; the reliability target becomes
  **inter-rater ICC** on double-rated forms.
- **VSMS / ATEC / TRENDS are out** of the measurement plan entirely.
- **ISAA stays**, but only as a baseline participant characteristic alongside IQ — never as a
  pre/post outcome.
- The **NCT and sound-localization controls survive** as the discriminant control block.

Anyone reading an older draft, an older analysis script, or the dated documents under
`docs/superpowers/` should treat this document as authoritative.
