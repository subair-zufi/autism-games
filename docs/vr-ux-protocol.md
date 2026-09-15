# VR User-Experience Protocol

Ages 7–15 · Malayalam administration · Meta Quest, six 360° games
(Emotion Room 360, Emotion Cinema 360, Playroom 360, Football 360, Museum 360, Park 360)

**Objective O6 — to explore the user experience of the VR intervention.** Exploratory and
descriptive: it asks whether these children can use, tolerate and enjoy the headset, and
whether that changes as the sessions go on. It is a precondition for the intervention and a
moderator to report alongside the efficacy outcomes, which are measured separately by the
[outcome measures protocol](pre-post-test-protocol.md).

The instrument is the **per-session experience record**: eleven fixed questions, asked of
the child and the trainer after every session. It is collected in the app, on the trainer's
console, and exists on paper as a fallback.

> **This replaces the five-construct battery** that earlier versions of this document
> specified (VRSQ/SSQ pre-post, IPQ presence items, interval-sampled video coding to κ,
> caregiver sensory forms). That battery measured more and measured it better; it also
> needed ~15 minutes of instruments per session and two trained video coders, which is not
> deliverable across ~24 sessions per child at a BUDS site. What it cost us is written down
> in [What this does not measure](#what-this-does-not-measure), and that section is the
> limitations paragraph for the thesis — do not omit it.

---

## Design rules

1. **The same eleven questions every session.** Repetition is the design: it is what turns
   a pile of session notes into a per-child trajectory. Changing an item mid-study breaks
   the comparison, so the instrument is frozen once enrolment starts.
2. **One direction for every scale.** All ratings run 1 (low) to 5 (high), comfort
   included, so no scale is inverted against another and every item plots the same way up.
3. **Objective before proxy before self-report.** Telemetry and the trainer's observation
   outrank the child's own rating. Likert-style self-report is unreliable in this
   population — literal interpretation, alexithymia, acquiescence. Where sources disagree,
   trust the behaviour and say so.
4. **Report per child, per item.** No total score, ever. The items are not a scale and
   summing them would assert a single-factor structure this record has never been shown to
   have. Averages also hide the child who took the headset off at minute two.
5. **Cybersickness is a safety gate, not a metric.** It is checked in every session and
   carries a stop rule that overrides all data collection.

---

## The instrument

Eleven items, about three minutes. The blank is
`validation/vr-session-experience-record.docx` (English and Malayalam, with the rating
guide on page 2); in the app it is the **End-of-session record** on the trainer console.

### Part A — the child (3 items, pictorial, read aloud)

The trainer reads each question and turns the screen to the child, who points.

| # | Item | Scale | Source |
|---|------|-------|--------|
| 1 | How much fun was it today? | 5 faces, 1 not at all – 5 very much | Smileyometer, Fun Toolkit (Read & MacFarlane, 2006) |
| 2 | How well do you feel now? (tummy and head) | 5 faces, 1 very bad – 5 completely fine | doubles as the safety check |
| 3 | Do you want to play again next time? | No / Maybe / Yes | Again–Again table, Fun Toolkit |

**Item 3 is the primary engagement signal, not item 1.** The Smileyometer has a documented
ceiling in children: most pick the top face from the first session and it barely moves.
The Again–Again item discriminates, and shifts earlier. Report both, lead with item 3.

### Part B — the trainer (5 ratings, behaviourally anchored)

Rated 1–5 against the written anchors on page 2 of the form, which are also shown beside
each rating in the app. Anchoring is what makes two trainers agree; the format follows the
behaviourally anchored proxy rating validated for adolescents with ASD in VR by Oh and
Kwon (2026), where people who know the child rate observable behaviour rather than infer
an internal state.

| # | Item | 1 | 5 |
|---|------|---|---|
| 4 | Engagement | mostly off-task | absorbed throughout |
| 5 | Independence | constant hands-on help | no help at all |
| 6 | Comfort | clear distress | fully comfortable |
| 7 | Enjoyment | no positive response seen | frequent smiles, laughter, "again!" |
| 8 | Willingness to continue | wanted to stop | clearly wanted more |

### Part C — in the trainer's words (3 short answers)

9. What went well today?
10. What was difficult today? (including any early stop and the reason)
11. **Anything different from the last session?**

Item 11 is written as a change question deliberately: it is what turns twenty separate
records into a trajectory somebody can narrate. The app shows what was written last time,
so it is answerable rather than a guess.

---

## The stop rule (overrides everything)

**End the session at once, and take the headset off, if any of:**

- the child points to **1 or 2** on item 2 (how well do you feel now);
- the child asks to stop, verbally or by removing the headset;
- vomiting or retching, or pallor with sweating;
- the facilitator judges the child to be distressed.

Record the time and the reason in item 10 and tick *the session stopped early*. The app
raises the rule on screen the moment a child answers 1 or 2.

**A stopped session is a finding, not missing data.** It is the acceptability result. Never
re-run it to "get" a complete record.

Seated 360° content still produces vection from head-turn scanning, so sickness is a real
risk even with no locomotion. This rule, and the seizure/photosensitivity screen in
[blueprint §13](study-blueprint-buds.md), are what go to the IEC as the VR safety addendum.

---

## Administration

- **When:** immediately after the headset comes off, every session, every child.
- **Who:** the trainer who ran the session. Part A is read aloud to the child in Malayalam;
  Part B and C are the trainer's own.
- **Language:** the form is bilingual. The Malayalam needs forward–back translation by the
  bilingual clinician before the field, like every other instrument in this study.
- **Anchoring the child's answers:** show a picture of the game while asking Part A, so the
  child knows which one is meant.
- **Game order:** counterbalance the order games are played in across children and
  sessions, and record which games the visit covered (the console fills this in). Later
  games are rated after more time in the headset, so order is a confound on items 1, 2
  and 6.

### Where the data goes

The console writes one record per child per visit, keyed to the child and the date, so it
joins to that visit's telemetry with nothing typed twice. It is written to the device
before it is sent, so a site with no Wi-Fi does not cost a session that cannot be
re-created. Records come out in `/api/admin/export/session_ux.csv` and in the raw ZIP —
see [analysis-guide.md](analysis-guide.md) Q9.

**Paper fallback:** if the console is unavailable, use the printed form and enter it later
via the same console, dating it to the session it describes.

---

## Reliability

A **second trainer independently completes Part B for about one session in four**, without
seeing the first rating. Tick *independent second rating* and give a rater id; it stores
alongside the primary rather than overwriting it.

Report agreement between the two on the five `rated_*` items — a weighted κ or ICC, plus
the plain percentage of exact agreement, which is the figure a reader can interpret.

Without this, Part B is one person's impression and should be described as such. This is
the single cheapest thing that makes the instrument defensible; do not skip it.

---

## The objective layer

Recorded automatically, and outranking the ratings where they disagree:

| Metric | Source |
|--------|--------|
| Minutes in the headset, and whether the session completed | `session_ux.minutes`, `stopped_early` |
| Games covered by the visit | `session_ux.games_played` |
| Trials attempted and completed | `trials`, `raw_events` |
| Head-yaw scanning during the response window | `raw_events` (VR only) |
| VR vs flat mode | `raw_events.xrPresenting` — every intervention analysis filters to 1 |

These are also the prerequisites flagged in the
[VR games expert review](vr-games-expert-review.md): the mode flag, head-yaw sampling at
5–10 Hz, TTS-`onend` latency and the mis-tap/hint fields must be confirmed as logging
**before** go-live, not assumed.

---

## Is the software good enough? (separate question, adult raters)

The per-session record asks how a child experienced the intervention. It does not tell you
whether the VR software itself is of adequate quality for research use. That is the
**VRNQ** (Kourtesis et al., 2019) — the VR-specific user-experience instrument with the
strongest psychometric standing, and the only one here with published cut-offs.

It was validated on adults aged 28–43, so it is **not** administered to the children. The
expert panel and the trained facilitators each rate each of the six games after hands-on
use, which is both inside its validated population and inside its intended purpose: the
VRNQ rates software, not people.

Sheet: `validation/vrnq-rating-sheet.docx`. Report, per game, whether the median sub-scores
and total met the minimum cut-offs and whether they met the parsimonious ones. The item
wordings must be transcribed from the source paper before use.

---

## Analysis

Per construct, per child, per game. See [analysis-guide.md](analysis-guide.md) Q9 for the
columns.

- **Trajectory.** Plot items 1, 2 and 4–8 against `visit_index` for each child. The shape
  of the line is the finding: settling in, steady, or deteriorating.
- **The change signal.** Count `play_again_num` (no=0, maybe=1, yes=2) across sessions.
  Treat it as ordinal.
- **Safety headline.** n-of-N children who completed a full session; % of sessions hitting
  the stop rule, with reasons coded by type.
- **Learnability.** `rated_independence` across sessions — the proportion of children
  reaching 4 or 5 by session 2 or 3.
- **Open text.** Code items 9–11 thematically. Item 11 carries the trajectory.
- **Discrepancies.** Where a child rates the fun high but left early, or asked not to play
  again, **believe the behaviour and report the mismatch explicitly.**
- **Moderator use.** Carry per-child tolerance into the efficacy analysis. A child who
  could not tolerate the headset contributed little dose; their outcome data should be
  interpreted in that light rather than pooled blind.

**No composite.** There is no total column in the export, by design.

---

## What this does not measure

Name these in the limitations paragraph rather than letting a reviewer find them.

| Dropped | Consequence |
|---------|-------------|
| **VRSQ / SSQ pre-post** | No validated cybersickness score, and no comparison with published figures. Item 2 is an adapted faces rating used as a **pre-specified safety trigger**, not as a measured outcome — a trigger needs a threshold, not psychometric properties. Report sickness as "n of N sessions stopped for discomfort", not as a score. |
| **IPQ presence items** | Presence is not measured at all. The proposed mechanism of VR transfer therefore goes untested in this study. |
| **Interval-sampled video coding** | On-task proportion and positive-affect rate are now the trainer's rating, not a blind coder's count. The trainer is not blind to the intervention — state this. |
| **Caregiver sensory form** | Distress a caregiver would notice and a facilitator would miss is not captured. |
| **Psychometric status of the record as a whole** | None is claimed. Parts A and C follow the Fun Toolkit; Part B follows a validated proxy-rating *format*, not a validated instrument. Describe it as a structured session record for an exploratory objective. |

Wording that survives review:

> Feasibility, tolerability and acceptability were recorded on a structured session record
> completed immediately after each session. Enjoyment items were adapted from the Fun
> Toolkit; the comfort item was an adapted faces rating used as a pre-specified safety
> trigger rather than as an outcome measure. No psychometric properties are claimed for the
> record as a whole.

Report the study under the **CONSORT extension for pilot and feasibility trials**
(Eldridge et al., 2016), where descriptive acceptability indicators without full
psychometrics are expected rather than a weakness.

---

## Piloting checklist (before the study proper)

1. **Stop rule and comprehension** — 4–6 pilot children. Confirm they can use the faces
   and the Again–Again choice, and that the stop rule fires early enough for the most
   sensitive child.
2. **Malayalam** — forward–back translate the eleven items and the read-aloud script;
   confirm the game screenshots are recognisable out of headset.
3. **Anchors** — two trainers rate the same 5 pilot sessions independently and compare.
   Refine the anchor wording until they agree; this is the calibration that the
   reliability subsample later measures.
4. **Telemetry** — verify `xrPresenting`, head-yaw sampling, TTS-`onend` latency and the
   mis-tap/hint fields are actually being logged.
5. **The console** — run one full session end to end, including with the Wi-Fi off, and
   confirm the record syncs afterwards.
6. **Pre-register the endpoints** — % completing a full session, % stopped early by reason,
   distribution of `play_again_num` by session, `rated_independence` trajectory — before
   the first child is enrolled.

---

## References

- Read, J. C., & MacFarlane, S. (2006). Using the fun toolkit and other survey methods to
  gather opinions in child computer interaction. *IDC '06*.
- Oh, S., & Kwon, S. (2026). Flow in screen-based gamified virtual reality sports:
  development and validation of a behaviorally anchored proxy rating scale for adolescents
  with autism spectrum disorder. *Frontiers in Public Health*.
- Kourtesis, P., Collina, S., Doumas, L. A. A., & MacPherson, S. E. (2019). Validation of
  the Virtual Reality Neuroscience Questionnaire. *Frontiers in Human Neuroscience, 13*, 417.
- Eldridge, S. M., et al. (2016). CONSORT 2010 statement: extension to randomised pilot and
  feasibility trials. *BMJ, 355*, i5239.

Verify each against the primary source before citing.
