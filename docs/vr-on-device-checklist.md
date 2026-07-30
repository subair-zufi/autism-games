# On-device verification — full app + six VR games

A complete pass on a real Quest. Covers the whole app as a facilitator and a
child would meet it, and every VR game at every level — not only what changed
recently.

- **Who:** one adult wearing the headset. No participant needed for §0–§3.
- **How long:** ~90 min for everything; ~30 min for §0–§2 alone.
- **When:** before participant data collection, not after.

Record **what you saw**, not just a tick — "readable but high" is worth more
later than a pass. File the finished sheet with the validity dossier as the
record that on-device testing happened.

**Legend:** `✓` works · `~` works with a caveat (write it) · `✗` broken ·
`n/a` not reachable. Items marked **[unmeasured]** were reasoned about in code
but never observed on hardware — they need a real verdict, not a guess.

Tester: ________________ Date: __________ Device/browser: ________________
Build stamp: ________________

---

## §0 Setup

| # | Check | Notes | |
|---|---|---|---|
| 0.1 | **Build stamp.** Profile → bottom shows `Build <stamp>`. Confirm it matches what you deployed. *Nothing below is trustworthy until this matches* — the offline cache has served stale builds before, making shipped fixes look like no-ops. | | |
| 0.2 | App loads over HTTPS (WebXR requires it). | | |
| 0.3 | Sign in works on the headset keyboard. | | |
| 0.4 | Headset fit and weight at a child's head size. | | |

---

## §1 App shell (outside VR, on the headset browser)

| # | Check | | |
|---|---|---|---|
| 1.1 | **Login** — sign in, wrong password shows an error, "Remember me" persists. | | |
| 1.2 | **Play Offline** — download completes; app then runs with no network. | | |
| 1.3 | **Home** — all four skill sections render; cards readable at headset DPI. | | |
| 1.4 | **Play-mode toggle** — 🖥️ Desktop / 🥽 VR HMD switches the list. VR shows exactly six games. *(Social Norms has no VR game — confirm that is understood, not a bug report.)* | | |
| 1.5 | **Participants** — add, edit, and select a participant. | | |
| 1.6 | **Participant guard** — with none selected, a game detail page warns the session will not be recorded, and only offers "Play without recording" after a first tap. | | |
| 1.7 | **Game detail** — objective, duration, and the difficulty panel with attempts / best %. | | |
| 1.8 | **Per-level Play** — tapping Play on the *Hard* row opens that game with Hard already selected. | | |
| 1.9 | **Progress** — skill scores and charts render for a participant with data. | | |
| 1.10 | **Cohort** — group view renders. | | |
| 1.11 | **Profile → Language** — English / മലയാളം switches game text and speech. | | |
| 1.12 | **Profile → Selection** — Gaze dwell / Controller. | | |
| 1.13 | **Profile → Voice / Sounds** — both toggles take effect in a game. | | |
| 1.14 | **Log out** returns to login and clears the session. | | |

---

## §2 VR infrastructure — shared by all six games

Do these once, in any game, then spot-check elsewhere.

| # | Check | What wrong looks like | | |
|---|---|---|---|---|
| 2.1 | **Enter VR** — the 🥽 button appears and starts an immersive session. | Button missing → WebXR unavailable (check HTTPS). | | |
| 2.2 | **Frame rate** — look around slowly ~30 s in the busiest scene (Museum 360 Hard, 5 exhibits). | Judder; world lagging behind your head. Biggest comfort risk. | | |
| 2.3 | **HUD height [unmeasured]** — prompt is a glance up, not a neck tilt. Then **crouch to child height** and re-enter VR. | The HUD should hang *lower* for a shorter wearer, holding the same angle. If it stays put and you must crane, eye-height anchoring is not working. | | |
| 2.4 | **Score panel angle** — check Emotion Room 360 and Emotion Cinema 360 specifically. | These sit highest (~25–29° up by calculation). Neck extension rather than an eye flick = too high. | | |
| 2.5 | **Prompt legibility** — in-world text readable without leaning. Repeat in Malayalam (longer script). | Clipped or shrunk-to-fit text. | | |
| 2.6 | **Gaze dwell** — two-stage: rest on a target to arm it (~0.3 s), then hold the ✓ chip beneath it (~1.6 s). | Selections firing while merely looking around; chip so low it is uncomfortable to hold. | | |
| 2.7 | **Controller** — ray selects; gaze no longer fires on its own. | | | |
| 2.8 | **In-world Quit** — bottom **left** in every game. Ends the session *and* returns to Home. | Unreachable, overlaps the game, or fires by accident. | | |
| 2.9 | **In-world selection switch** — directly under Quit; changes method mid-session. | | | |
| 2.10 | **Camera restore** — quit a game and look at the flat page. | Scene rendered through a wide off-axis frustum — most content off-screen. | | |
| 2.11 | **Warm-up (first run)** — clear site data, launch a VR game: an unscored practice scene (tap the star ahead, then one each side). | | | |
| 2.12 | **Warm-up on a shared headset** — now launch a *different* VR game. | It will **not** reappear. It is remembered per *device*, not per child, with no reset in the UI. **On a shared research headset only the first participant ever sees it.** Decide if that is acceptable before testing children. | | |
| 2.13 | **Malayalam speech** — Profile → Malayalam, start any VR game. | Silence, or an English voice reading Malayalam. Quest browser may have no Malayalam voice. | | |
| 2.14 | **Recentre** — start a session deliberately facing ~45° off. | Content sits to one side, possibly outside the front arc. **No in-app recentre** — confirm the facilitator knows the Quest system gesture. | | |
| 2.15 | **Headset removed mid-trial** — lift it off ~10 s, put it back (use Emotion Cinema mid-clip). | The clip must be **paused** where you left it, not finished. | | |
| 2.16 | **Exit routes** — in-world Quit, the flat 🏠 button, and finishing a session all leave cleanly. | | | |

---

## §3 Per game

Play **every level** — difficulty changes the mechanics, not just the count.

### 🧭 Museum 360 — joint attention (responding)

| Level | Setup | Check | |
|---|---|---|---|
| Easy | 3 exhibits, 5 finds, point + glowing target | Cue obvious; all exhibits reachable by head turn | |
| Moderate | 4 exhibits, 7 finds, point + sparkle trail | Trail readable, points the right way | |
| Hard | 5 exhibits, 10 finds, plain point fading to gaze | All 5 in the front arc, none behind you | |

- [ ] Centre exhibit does not hide the helper's **pointing arm** (legs behind it are intended).
- [ ] **[unmeasured] Gaze-only trials** (2 / 3 / 5 per session): with no pointing gesture, can you tell *which* exhibit the helper is looking at? Adjacent exhibits differ by ~20° of head yaw at ~7.5 m. **Most likely item to fail — answer honestly.**
- [ ] Wrong tap is gently corrected and the round continues (no fail state).
- [ ] Cue thins after 3 correct first-attempt finds in a row.
- [ ] Session end: stars shown, score and best correct.
- Notes: ______________________________________________

### 🌳 Park 360 — joint attention (initiating)

| Level | Setup | Check | |
|---|---|---|---|
| Easy | Big surprises, nudge after 4 s, 5 shares | Surprise obvious; nudge fires and helps | |
| Moderate | Quieter, nudge after 8 s, 6 shares | | |
| Hard | Tiny surprises, **no nudges**, 8 shares | Still findable unaided in the headset | |

- [ ] Both taps work: the surprise (the "point") and the friend (the "hey, look!").
- [ ] Tapping the friend *first* makes them turn, curious, and wait.
- [ ] Leave a Hard round un-acted for >20 s: it keeps waiting and can still be completed.
- [ ] Friend (~40° right) and surprises (out to ~55° left) are comfortable turns.
- Notes: ______________________________________________

### 🖼️ Emotion Room 360 — emotion recognition

| Level | Setup | Check | |
|---|---|---|---|
| Easy | 2 faces, easy to tell apart, hint after 5 s | Faces legible at 4.2 m | |
| Moderate | 3 faces, mixed similarity, hint after 9 s | | |
| Hard | 3 confusable faces, **no hints**, 10 rounds | Fear/surprise, anger/disgust genuinely hard but fair | |

- [ ] The spoken question matches the written one, in both languages.
- [ ] Hint (easy/medium) is noticeable but not startling.
- [ ] Correct/wrong feedback readable.
- [ ] Photos differ in style — some cut-out, some full-frame. Note whether that is distracting in the headset.
- Notes: ______________________________________________

### 🎥 Emotion Cinema 360 — emotion in motion

| Level | Setup | Check | |
|---|---|---|---|
| Easy | 6 clips, freeze on peak, 2 choices | Screen comfortable, face clear at freeze | |
| Moderate | 9 clips, freeze on peak, 3 choices | | |
| Hard | 12 clips, freeze half-formed, 4 choices + "why?" | 4 cards separated and readable | |

- [ ] Clip plays smoothly; audio audible through the headset.
- [ ] Freeze lands on the expressive frame.
- [ ] **"↻ Watch again"** card (right, ~42°) findable and works.
- [ ] Wrong answer replays the clip automatically.
- [ ] Cause stage (Hard): sentences readable; in-world **Next** card works.
- [ ] Session is not too long at 12 clips — note fatigue.
- Notes: ______________________________________________

### 🧸 Playroom 360 — turn-taking

| Level | Setup | Check | |
|---|---|---|---|
| Easy | 3 builders, fixed order, 5 rounds | Turn order anticipatable | |
| Moderate | 4 builders, fixed order, 7 rounds | **Name tags overlap?** | |
| Hard | 5 builders, order reshuffled, 10 rounds | **Name tags overlap?** Known issue on flat screen | |

- [ ] Tapping your glowing block places it; tapping out of turn is coached, not punished.
- [ ] Hand-off: tapping the next friend passes the turn reliably.
- [ ] Tower never grows tall enough to hide a friend's face (parks as a mini at 8).
- [ ] Waiting through 4 peers on Hard (~2.4 s each) is tolerable, not tedious.
- [ ] Session end shows **1–3 stars** (a clean run with no out-of-turn taps earns three).
- Notes: ______________________________________________

### 🏟️ Football 360 — turn-taking (reciprocity)

| Level | Setup | Check | |
|---|---|---|---|
| Easy | 1 teammate, spoken "pass it to me!", 5 rallies | Cue clear | |
| Moderate | 2 teammates, hands-up gesture, no words, 7 rallies | Gesture readable | |
| Hard | 3 teammates at ±50°, body/gaze only, 10 rallies | **Can you compare all three at once?** | |

- [ ] Name tags in the play language (English session → "Ammu", not Malayalam).
- [ ] "Pass it to me!" bubble in the play language.
- [ ] Ball travel readable; a wrong pass is returned and play continues.
- [ ] Hard: child-initiated rallies (no incoming pass) are understandable.
- [ ] **Lives** — tap a teammate during the incoming pass. That costs a life; three ends the session at zero. **The only VR game that can fail.** Confirm this is what a distressed child should meet.
- Notes: ______________________________________________

---

## §4 Data and recording

Do with a participant selected, then check on a laptop.

- [ ] Finish one session per game. Each game's detail page shows attempts and a best %.
- [ ] Progress page shows the session in the skill scores.
- [ ] Sessions played **in VR** are distinguishable from flat play in the exported data.
- [ ] A session interrupted by removing the headset is flagged as such.
- [ ] Offline play syncs (or is knowingly not recorded) — confirm which.
- Notes: ______________________________________________

---

## §5 Comfort and safety

Run alongside the FMS/VRSQ gate in the main UX protocol.

- [ ] After ~20 min across games: nausea, eye strain, disorientation? Rate on the usual scale.
- [ ] **Continuous motion** — Museum 360's exhibits rotate without stopping; blocks wobble; celebrations spin. There is **no reduced-motion option**. Note any discomfort; this feeds the VRSQ directly.
- [ ] Nothing visually startling: sudden brightness, fast pop-in, loud onset.
- [ ] Audio level comfortable; no sudden loud cues.
- [ ] A child can always stop: in-world Quit reachable from every game state.
- Notes: ______________________________________________

---

## §6 Summary

| Question | Answer |
|---|---|
| Safe to run with children as-is? | |
| Blocking issues | |
| Non-blocking issues | |
| Games needing another pass | |
| Items still **[unmeasured]** after this session | |

Signed: ________________  Date: __________
