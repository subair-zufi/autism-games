# Master Study Blueprint — VR Social-Skills Games at BUDS Schools

*Version 0.1 · 2026-07-27 · owner: farhanpeecee*

This is the **conduct-of-study protocol** — the single document that ties together the
pieces already written and tells you, step by step, how to actually run the study in
BUDS schools. It does not repeat the instruments; it references them:

- Efficacy outcome (ASSP) → [`pre-post-test-protocol.md`](pre-post-test-protocol.md)
- VR acceptability/usability → [`vr-ux-protocol.md`](vr-ux-protocol.md)
- Content validity of the games → `validation/content-validity-dossier.docx`
- Data → sheets/analysis → [`analysis-guide.md`](analysis-guide.md)
- Forms → `validation/` (consent, ISAA record, ASSP (translated), expert CVI, VR-UX forms)

> **BUDS context assumption (confirm before finalizing).** BUDS is treated here as the
> Kerala Kudumbashree / Local Self-Government network of special schools for children with
> intellectual and developmental disabilities (including autism). If your target is a
> specific BUDS school / district cluster, drop its name, district, class list, and
> student roster into §4 and §6 — several numbers below depend on it.

---

## 1. One-paragraph summary

We evaluate whether a suite of **360°/VR** games that train three social-communication
skills — **emotion identification, turn-taking, and joint attention** — produces measurable
gains in the everyday social behaviour of autistic children aged 7–15 attending BUDS schools,
while confirming the intervention is **acceptable and tolerable** in a headset. Design: a
**cluster-randomized, waitlist-controlled** rollout across BUDS classrooms with an
informant-rated outcome (**ASSP**), an embedded non-social discriminant control administered
directly to the child, in-app telemetry as a process measure, and a VR user-experience
protocol as a parallel acceptability study. Primary endpoint: pre→post change on the **ASSP
total**, against a flat non-social control task.

---

## 2. Objectives, questions, hypotheses

Primary and secondary questions map 1:1 to the [analysis guide](analysis-guide.md) (Q1–Q8).

| # | Objective | Question | Endpoint |
|---|-----------|----------|----------|
| **O1 (primary)** | Efficacy / generalization | Does VR game training move the ASSP while the NCT stays flat? | **ASSP total** (raw change); subscales secondary; NCT & sound-localization flat |
| O2 | Acquisition | How fast do children learn in-game? | Trial-level learning slopes (`trials` sheet) |
| O3 | Dose–response | Does more VR play → more gain? Minimal effective dose? | `dose` (VR sessions) × ASSP gain |
| O4 | Moderation | Who benefits most (IQ, age, autism level, gender)? | Aptitude-by-treatment interactions on `summary` |
| O5 | VR process / attention | What does head-scan behaviour say about how the child attends in the headset? | `trials` (VR only) + head-scan telemetry |
| **O6 (co-primary)** | Acceptability | Can these children use, tolerate, enjoy the headset? | VR-UX protocol: n-of-N tolerated a full session; cybersickness safety |

**H1 (primary):** the ASSP total improves pre→post with a moderate effect; NCT and
sound-localization show no reliable change (specificity).
**H0:** no differential change between the ASSP and the control task.

---

## 3. Design

**Recommended primary design: cluster-randomized waitlist control (stepped rollout).**

- Unit of randomization = **classroom** (or school, if only a few children per class), not
  child — avoids contamination and fits how BUDS runs sessions.
- Clusters randomized to **Immediate** arm or **Waitlist** arm.
- Immediate: baseline (T0) → 8-week intervention → post (T1) → follow-up (T2).
- Waitlist: baseline (T0) → 8 weeks *business-as-usual* → post (T1, serves as a
  no-treatment comparison over the same window) → then receives the intervention
  (ethical: everyone eventually gets it) → its own post.
- This gives a **between-arm contrast at T1** on top of the within-child pre→post and the
  built-in discriminant control — three independent defenses against maturation/practice.

**Fallback if only one school / too few clusters:** single-arm pre–post–follow-up. It is
weaker — and weaker still with an informant-rated outcome, because the waitlist arm is the
main guard against informant expectancy ([protocol §4](pre-post-test-protocol.md)). The NCT
discriminant control and telemetry dose-response remain, but a single-arm result must be
reported as provisional, with expectancy named as the leading alternative explanation.

Either way, the **VR-UX acceptability study (O6)** runs on every child who uses the
headset — it is single-arm by nature (descriptive, per-child).

---

## 4. Setting — BUDS schools

- Confirm: which school(s)/district, number of classrooms, students per class, staff
  (teachers/aides) available, room that can be darkened/quieted for the control block,
  power + Wi-Fi/offline for the app, and a safe seated space for headset use.
- Two physical spaces needed per site: (a) a quiet **assessment room** for the control block
  (table, two chairs), (b) an **intervention space** with a **Meta Quest** and a safe seated
  area. A tablet/laptop is useful for demonstrating the desktop build to staff and families,
  but it is not an intervention device.
- Log site constraints that affect dose (session length limits, transport/attendance
  patterns, term calendar/holidays) — these bound O3.

---

## 5. Participants

**Inclusion:** enrolled BUDS student; age 7–15; clinical/educational diagnosis of ASD
(or ASD + ID) on record; parent/guardian consent + child assent where possible; able to
sit for a short structured task with support.

**Exclusion:** uncorrected visual/auditory impairment that invalidates the stimuli;
active seizure disorder not medically cleared for screen/VR exposure (VR-specific — see
§13); acute behavioral crisis at the time of screening.

**Characterize every child at baseline** (covariates for O4, `participants` sheet):
- Age, gender, class.
- **ISAA** (Indian Scale for Assessment of Autism) severity — a **participant
  characteristic recorded once at T0, exactly like the IQ score**, never a pre/post outcome.
  Form in `validation/isaa-record-form.docx/pdf`.
- IQ / developmental level (existing school records, or a brief measure) → `iq_band`.
- Verbal level / communication mode; Malayalam as language of administration.

There are no distal secondary instruments: VSMS, ATEC-Malayalam and TRENDS were dropped when
the ASSP became the single pre/post tool ([protocol §9](pre-post-test-protocol.md)).

**Sample size.** Fill in once cluster counts are known. Rule-of-thumb targets:
- Efficacy (O1): power a moderate within-child effect on the ASSP total (d_z ≈ 0.5) at 80% → ~34 completers
  paired; inflate for clustering (design effect 1 + (m−1)·ICC) and ~20% attrition. Report
  as a **feasibility-bounded** target, not a hard power promise, given a heterogeneous
  small population — the pre-registered per-child **Reliable Change Index** (n-of-N
  improved) is the honest headline for small N.
- Acceptability (O6): descriptive; every headset user contributes. Aim ≥ 15–20 children
  through at least 2 headset sessions to see learnability.

---

## 6. Recruitment & consent

1. Approach BUDS management / LSGD with the **data-collection request letter**
   (`validation/data-collection-request-letter.docx`) → site permission.
2. Parent/guardian information session (Malayalam) → **parental consent form**
   (`validation/parental-consent-form.docx`). Consent covers: participation,
   **video recording** of assessment/VR sessions, in-app data logging, and data retention.
3. **Child assent** appropriate to communication level (pictorial yes/no); a child
   removing the headset or refusing a task is honored as withdrawal of assent for that
   activity (see VR stop-rule).
4. Enroll → assign a **participant code** (`participant_code`); keep the code↔identity key
   separate from all data (see §11).

---

## 7. Ethics & approvals (do before any data collection)

- [ ] **Institutional Ethics Committee** approval (a recognized IEC; if the researcher is
      university-affiliated, that IRB/IEC). Autistic minors with ID = vulnerable population,
      so expect scrutiny of assent, VR safety, and data.
- [ ] **BUDS / Kudumbashree / LSGD site permission** (letter above).
- [ ] **Consent + assent + child-video** approved as part of the ethics package.
- [ ] **Trial/study registration** where applicable (e.g. CTRI for a prospective
      interventional study in India) — register **before** enrolling the first child.
- [ ] **Data protection** plan (DPDP-aware): storage, access, retention, destruction.
- [ ] **VR safety addendum**: seizure/photosensitivity screening, hygiene between users,
      cybersickness stop-rule (from the VR-UX protocol) filed with the IEC.

---

## 8. Intervention

**Content — the intervention is the VR (360°) build only.** Six games, two per trained skill:
- Emotion: **Emotion Room 360**, **Emotion Cinema 360**.
- Turn-taking: **Playroom 360**, **Football 360**.
- Joint attention: **Museum 360**, **Park 360**.

**Desktop builds are demonstration only.** The flat versions (Emotion Recognition, Emotion
Clips, Block Buddies, Roll-Back Buddy, Museum Look, Look What I Found!) stay in the app to
show the games to staff, families, the ethics committee and the expert CVI panel without a
headset, and to let a child see what a game is before donning one. They are **not** an
intervention condition and **not** a fallback dose: desktop play contributes nothing to O1 or
O3. Use the Home **play-mode toggle** set to 🥽 VR HMD for every intervention session.

**Delivery.** Meta Quest, seated, one child at a time, facilitator present throughout. Mode is
logged on every trial (`xr_presenting`); **all efficacy and dose analyses filter to
`xr_presenting = 1`**, so any stray desktop play is excluded at analysis rather than
contaminating the dose.

**Children who cannot tolerate the headset.** VR tolerance is not an inclusion criterion —
screening for it would bias the sample toward the children most likely to benefit. A child who
cannot wear the headset stays enrolled, contributes T0/T1/T2 and acceptability data, and is
analyzed under ITT with a dose of zero; that is a finding about reach, not a dropout. Record
the reason via the VR stop-rule log.

**Dose (the intervention "prescription").** Define and hold constant:
- Target **~3 sessions/week for 8 weeks** (~20–24 sessions), ~15–20 min each, adjusted per
  child tolerance. Record actual dose — it *is* O3, not just adherence bookkeeping
  (`dose` sheet: `n_sessions`, `total_minutes`, `span_days`, `median_gap_days`).
- Difficulty is freely selectable (levels are not locked, per commit `79d142d`); the app's
  own progression drives within-game leveling. Facilitator supports but does not do
  hand-over-hand answering (log `ADULT-HELP`).

**Facilitator role.** BUDS teacher/aide + trained study facilitator run sessions; they do
**not** administer the control block and do **not** complete ASSP forms for children they
facilitate where another informant is available (blinding, §10).

---

## 9. Measures

| Layer | Instrument | Doc | Timing |
|-------|-----------|-----|--------|
| **Primary outcome** | **ASSP** (49 items, informant-rated, Malayalam translation), same informant at every timepoint | [pre-post-test-protocol.md](pre-post-test-protocol.md) | T0, T1, T2 |
| **Discriminant control** | NCT (12 forced-choice items) + sound-localization (2 trials), child-administered by the blinded tester | [pre-post-test-protocol.md](pre-post-test-protocol.md) §3 | T0, T1, T2 |
| **Baseline characterization** | ISAA severity, IQ/dev level, demographics — recorded once, as participant characteristics | `validation/isaa-record-form.*` | T0 |
| **Process / mechanism** | In-app telemetry (trials, latency, head-yaw, dose) | [analysis-guide.md](analysis-guide.md) | continuous |
| **Acceptability (co-primary O6)** | VR-UX: FMS, VRSQ/SSQ, usability, presence, engagement, sensory | [vr-ux-protocol.md](vr-ux-protocol.md) | each VR session |
| **Content validity** | Expert CVI panel on the games | `validation/content-validity-dossier.docx` + `expert-cvi-rating-form.docx` | pre-study |

The ASSP is the primary efficacy measure and the only pre/post instrument; the control block
exists solely to be flat; telemetry is the process measure that links in-game learning (O2) to
the rated outcome (O1) and dose (O3).

---

## 10. Blinding, randomization, counterbalancing

- **Control-block tester is blinded** to arm/dose; does not run intervention sessions.
- **ASSP informants** are blind to arm (where the cluster design allows), to their own
  previous ratings, and to the hypotheses; the **same informant** rates a child at every
  timepoint. A **second independent informant** rates ≥30% of children for agreement
  (ICC ≥ .70 on the total; VR-UX video codes keep κ ≥ .75).
- **No parallel forms** on the outcome — the ASSP is one fixed translated form throughout.
  The NCT alternates its two photo sets T0→T1 and returns to the T0 set at T2.
- **Cluster randomization:** classrooms to Immediate/Waitlist by a concealed sequence
  (e.g. sealed envelopes / offline RNG), stratified by school and class age profile.
- **VR game-order** counterbalanced A/B per the VR-UX protocol.

---

## 11. Data management

- **Source of truth = the app's exports** (Admin dashboard / API), five sheets at three
  grains — see [analysis-guide.md §1](analysis-guide.md). ASSP and control-block scores enter
  via the blinded-score export (`battery` sheet).
- **Telemetry prerequisites to verify BEFORE go-live** (from the VR review, M1–M5):
  `xrPresenting` flag, head-yaw sampling 5–10 Hz, TTS-`onend` latency, mis-tap/hint fields.
  Pilot must confirm these are actually logged — `xrPresenting` now gates which data count as
  intervention at all, so a logging failure costs the dose denominator, not just O5.
- **Coding key separation:** the `participant_code ↔ child identity` map lives in a single
  access-controlled file, never in any data sheet or video filename.
- **ASSP forms:** collected by the data manager, filed by `participant_code` only, never
  returned to the informant; a completed T0 form is never visible when T1 is rated.
- **Video** (VR-UX coding): stored encrypted, access limited to coders, destroyed per the
  retention plan approved by the IEC.
- **Backups:** device-local + one encrypted off-device copy; offline-capable if site Wi-Fi
  is unreliable.
- Use `sample-data/dummy_research_data.xlsx` to build and test the entire analysis pipeline
  **before** real data exists (it has the exact real-export shape, fake values).

---

## 12. Analysis plan (pre-registered)

Pre-register O1's endpoints, the NCT specificity contrast, and RCI thresholds **before**
unblinding. Then, per [analysis-guide.md §4](analysis-guide.md):

- **O1:** paired *t*/Wilcoxon on the **ASSP total** pre→post + between-arm (Immediate vs
  Waitlist) at T1; ASSP-vs-NCT standardized contrast = specificity; **RCI per child** ("n of N
  improved"). Subscales are a Holm-corrected secondary family. NCT + sound-localization must
  be flat.
- **O2:** mixed-effects logistic growth on `trials`.
- **O3:** regress gain on dose; test minimal effective dose / diminishing returns.
- **O4:** aptitude-by-treatment interactions (IQ, age, autism level, gender) — small N ⇒
  report effect sizes over *p*.
- **O5:** head-scan telemetry on VR trials as a process/attention measure (no flat
  comparison condition exists — the intervention is VR only).
- **O6:** per-construct, per-child, per-game — **no single UX score**; safety headline =
  n-of-N tolerated a full session; flag Smileyometer-vs-behaviour discrepancies.
- **Missingness:** pre-declare ITT vs completer; `has_post_battery = 0` flags dropouts.

---

## 13. Risk, safety, adverse events

- **Cybersickness** is a safety gate: FMS pre/every-3-min/post, VRSQ/SSQ pre-post, and the
  **stop rule** (VR-UX protocol §Construct 1) overrides all data collection. A stopped
  session is a *finding*, not missing data.
- **Photosensitivity/seizure:** screen out un-cleared seizure disorders; brief flashing
  check; medical clearance on file.
- **Sensory distress / face-proximity aversion** (Emotion Room/Cinema 360): coded, and
  child removal = honored withdrawal of assent.
- **Hygiene:** wipe headset/facial interface between children; disposable liners if
  available.
- **Distress escalation:** predefined calming/exit routine; BUDS staff present; safe-exit
  affordance rehearsed each session.
- **Adverse-event log** + reporting path to the IEC.

---

## 14. Phases & timeline (master Gantt)

| Phase | Weeks | Activities | Gate to next phase |
|-------|-------|-----------|--------------------|
| **0. Approvals & content validity** | 1–6 | IEC submission; BUDS/LSGD permission; trial registration; run **expert CVI panel** on the games; finalize translations (forward–back) | Ethics + site approved; CVI acceptable |
| **1. Setup & telemetry check** | 5–7 | Headsets provisioned; verify telemetry M1–M5 logging (incl. `xrPresenting`); ASSP translation + informant briefing prepared; build analysis pipeline on dummy data; train facilitators + 2 VR-UX coders | Telemetry confirmed; coders calibrated; ASSP form frozen |
| **2. Pilot** | 7–10 | ASSP translation validation + test–retest (8–12 children, 2 wks apart) for the RCI; inter-rater ICC; control-block floor/ceiling; VR stop-rule & comprehension pilot (4–6 children) | Piloting checklists (both protocols) passed |
| **3. Baseline (T0)** | 10–12 | Consent/assent; demographics + ISAA + IQ (participant characteristics); **ASSP** from the named informant; control block; randomize clusters | All enrolled children baselined |
| **4. Intervention** | 12–20 | ~8 weeks of **VR** play; continuous telemetry + VR-UX per session; adherence/dose tracking | Dose window complete |
| **5. Post (T1)** | 20–21 | **ASSP** from the same informant + control block, 3–7 days after the last session; waitlist arm posted then crossed over | Post data collected |
| **6. Follow-up (T2)** | 24–29 | **ASSP** (same informant) + control block, 4–8 weeks post; retention | — |
| **7. Analysis & write-up** | 29–36 | Unblind after lock; run pre-registered plan; report | Manuscript / thesis |

(Overlaps are intentional; Phase 0 CVI can run while approvals are pending.)

---

## 15. Team & roles

| Role | Responsibility |
|------|----------------|
| PI / researcher | Protocol, ethics, registration, analysis, reporting |
| Blinded tester(s) | Administer the control block only; no intervention contact |
| Intervention facilitator(s) + BUDS staff | Run game sessions, support without answering, VR safety |
| Second informant (≥30% of children) | Independent ASSP rating for inter-rater ICC |
| Blinded coder ×2 | Video-code VR-UX; establish IRR |
| Expert panel (pre-study) | CVI ratings on the games |
| Bilingual clinician | Forward–back translation of all scripts |
| Data manager | Exports, key separation, backups, pipeline |

---

## 16. Document / deliverable checklist

Already written (in repo):
- [x] Pre/post outcome protocol (ASSP) · VR-UX protocol · analysis guide
- [x] Content-validity dossier + expert CVI rating form
- [x] Consent, ISAA record, data-request & expert-request letters, VR-UX forms

To produce before go-live:
- [ ] IEC application package + trial registration entry
- [ ] This master blueprint finalized with BUDS specifics (§4, §5 sample size)
- [ ] Statistical Analysis Plan / **pre-registration** (lock O1 endpoints + RCI)
- [ ] Facilitator SOP + ASSP informant briefing + coder manual (VR-UX)
- [ ] Data management & retention plan (DPDP-aware)
- [ ] Adverse-event log template + VR safety/seizure screen
- [ ] Finalized Malayalam scripts (forward–back verified)

---

## 17. Open decisions to confirm

1. **Design:** cluster-randomized waitlist (recommended) vs single-arm — depends on how
   many BUDS classrooms/schools you can recruit. How many clusters are realistically available?
2. **Which BUDS site(s)/district**, and the achievable per-child dose given attendance and
   term calendar.
3. **VR reach:** the intervention is VR-only, so headset availability now bounds the whole
   study, not a sub-study. How many Quests are available at the site, and what per-child
   session throughput does that allow across the 8-week window?
4. **ASSP access:** confirm permission/licensing for research use **and for translation**,
   and secure the manual (item list, reverse-scored items, score ranges, published
   psychometrics) before lock.
5. **Registration body:** CTRI (or applicable) — confirm and register before enrollment.
