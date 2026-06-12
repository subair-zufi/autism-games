# Web 3D Intervention Tasks — Autism Spectrum Disorder

8 browser-based 3D tasks built with **Three.js** for children aged 7–15. Each task runs under 3 minutes with built-in performance assessment, clear navigation, and minimal avatar requirements.

| Platform | Audience | Duration | Avatars | Scoring |
|---|---|---|---|---|
| Web browser (desktop, tablet, mobile) — Three.js + WebGL | Ages 7–15 | < 3 min per task | Minimal avatars | Auto-scoring |

**Tech context:** React + TypeScript + Vite + Three.js. Input is mouse pointer / touch tap resolved through a `THREE.Raycaster`. Camera movement uses drag-to-look (OrbitControls or pointer-drag rotation). Audio narration via Web Speech API or pre-recorded clips. All feedback is visual + audio (no controller haptics; optional `navigator.vibrate()` on supported mobile devices).

---

## Skill 1 — Emotional Recognition

### Task 1: The Emotion Mirror Room

> Environment: simple indoor room · One animated face panel · Input: mouse click / touch tap

**Scene setup**
The child views a bright, calm 3D room. A large floating "magic mirror" plane displays animated 2D cartoon faces (textured plane or sprite — no full avatar). Each face shows one of 6 core emotions: happy, sad, angry, scared, surprised, disgusted.

**Navigation**
Four large labelled emotion buttons appear below the mirror as 3D button meshes (or HTML overlay buttons). The child clicks/taps a button; selection is resolved with a raycaster. A glowing arrow always indicates the active button. Audio instruction plays automatically at start.

**Task steps**
1. Audio prompt: *"Look at the face. How is this person feeling?"* Face animates for 4 seconds.
2. Four emotion choices appear as large icon + word buttons. Child selects one with a click or tap.
3. Immediate animated feedback: correct = green sparkle particles + cheer sound; incorrect = gentle blue glow + correct answer shown.
4. 8 trials per session (covering all 6 emotions, with 2 repeats of common ones). Stars earned display at end.

**Performance assessment**

| Metric | Measure |
|---|---|
| Accuracy score | Correct / 8 trials |
| Response latency | Avg. seconds to select |
| Emotion breakdown | % correct per emotion |

- 🟢 **Mastered:** ≥ 7/8
- 🟡 **Developing:** 4–6/8
- 🔴 **Retry:** ≤ 3/8

---

### Task 2: Emotion Weather Station

> Environment: outdoor park scene · Weather metaphor objects · Input: aim with pointer + click to throw

**Scene setup**
A 3D park with 4 "weather zones" (sunny, rainy, stormy, breezy). Short video clips of real-life situations play on a floating screen (video texture on a plane) — a child opening a birthday gift, a child scraping their knee, etc. The child matches the clip to the correct emotional weather zone.

**Navigation**
The child drags to rotate the camera and face each zone. A glowing orb floats at the bottom-center of the view — the child aims at a zone with the pointer and clicks to throw it (simple ballistic tween or physics impulse). Zones glow and pulse when the cursor/orb trajectory is near as a spatial cue.

**Task steps**
1. Clip plays (8–10 seconds). Audio: *"How does that make you feel? Find the right weather!"*
2. Child aims the glowing orb and clicks to throw it toward the matching emotion zone.
3. Correct zone: sky lights up with animation. Wrong zone: gentle shake + correct zone highlighted.
4. 6 situational clips per session. End-screen shows star rating and which emotions were tricky.

**Performance assessment**

| Metric | Measure |
|---|---|
| Contextual accuracy | Correct / 6 clips |
| Confusion matrix | Which emotions get mixed up |
| Motor engagement | Orb throw accuracy (distance from zone center) |

- 🟢 **Mastered:** ≥ 5/6
- 🟡 **Developing:** 3–4/6
- 🔴 **Retry:** ≤ 2/6

---

## Skill 2 — Turn Taking

### Task 3: The Talking Torch

> Environment: campfire circle · One simple robot companion · Input: press-and-hold to speak

**Scene setup**
The child sits at a virtual campfire with a single, simple robot companion (non-realistic, low-polygon, friendly). A glowing torch object floats between them. Whoever holds the torch "has the turn" — a clear, concrete rule.

**Navigation**
Press-and-hold mouse button (or touch-and-hold) = child holds the torch and it glows blue (their turn). The robot takes the torch automatically after a set time; torch glows orange. No complex menus. An animated ring around the torch shows remaining turn time.

**Task steps**
1. Robot asks a simple question (e.g., *"What's your favourite animal?"*) and passes the torch to the child.
2. Child holds the torch and responds (verbally via mic, or by clicking a button choice). Timer ring counts down (15 sec).
3. Child passes the torch back (releases the button). Robot takes a turn, responds, and asks a follow-up.
4. 6 exchanges per session. A "Waiting" indicator flashes gently if the child grabs the torch too early.

**Performance assessment**

| Metric | Measure |
|---|---|
| Interruptions | Times grabbed early |
| Wait duration | Avg. seconds waited |
| Smooth exchanges | % clean handovers |

- 🟢 **Mastered:** 0–1 interruptions
- 🟡 **Developing:** 2–3
- 🔴 **Retry:** 4+ interruptions

---

### Task 4: Colour Block Builder

> Environment: simple build table · Alternating block placement · Input: click to grab + click to place (drag and drop)

**Scene setup**
A table with colour-coded building blocks. The child and a robot arm (no full avatar needed — just an animated mechanical arm) take turns stacking blocks to build a tower. The turn alternates strictly — child goes, arm goes, child goes.

**Navigation**
Click/tap a block to pick it up (it follows the cursor on a drag plane), then click the tower slot to place it. A turn indicator (large "YOUR TURN" / "WAIT" badge as a billboard or HUD element) shows clearly on the table edge. The robot arm is visually paused during the child's turn. During the robot's turn, blocks are not clickable (raycast targets disabled).

**Task steps**
1. Audio: *"We're building together! Wait for your turn."* Turn indicator shows "ROBOT GOES FIRST."
2. Robot arm places one block. Indicator flips to "YOUR TURN" with a chime.
3. Child grabs and places their block. Indicator flips back. 10 rounds total (10 blocks each = 20-block tower).
4. If the child clicks a block during the robot's turn, blocks glow red briefly and gentle audio plays: *"Almost! Wait a moment."*

**Performance assessment**

| Metric | Measure |
|---|---|
| False grabs | Click attempts during robot turn |
| Initiation time | Delay after "YOUR TURN" cue |
| Tower completion | % blocks correctly placed |

- 🟢 **Mastered:** 0 false grabs
- 🟡 **Developing:** 1–3
- 🔴 **Retry:** 4+ false grabs

---

## Skill 3 — Joint Attention

### Task 5: The Pointing Hand Guide

> Environment: indoor museum room · Floating objects · Camera-center reticle (gaze proxy) + click to confirm

**Scene setup**
A simple 3D museum room with 6 floating exhibit objects (butterfly, rocket, fish, etc.). A disembodied glowing hand appears and points toward one object. The child must follow the point and look at the correct object. Since browsers have no eye tracking, "gaze" is approximated by a camera-center reticle: the child drags the camera until the reticle rests on the target (raycast from screen center), or hovers the cursor over the object on desktop.

**Navigation**
The child drags to rotate the camera toward the pointed object. No button pressing required for the main detection — dwelling the reticle/cursor on the object for 1 second counts as a gaze. A "Look here!" animated arrow reinforces the pointing hand. A confirm click is used only to lock in their choice after looking.

**Task steps**
1. Audio: *"The hand is pointing at something special! Look where it's pointing."* Hand appears and points.
2. Child follows the point and rests the reticle/cursor on the target object (1-second dwell confirms the gaze).
3. Object glows and plays a fun-fact sound when correctly gazed at. 8 trials per session.
4. If the child does not follow within 5 sec, an animated arrow gently sweeps toward the object.

**Performance assessment**

| Metric | Measure |
|---|---|
| Gaze-following rate | % correct reticle shifts |
| Latency to shift | Seconds after point cue |
| Prompt dependency | % trials needing the arrow |

- 🟢 **Mastered:** ≥ 7/8 unprompted
- 🟡 **Developing:** 4–6/8
- 🔴 **Retry:** ≤ 3/8

---

### Task 6: Show and Share

> Environment: outdoor garden · Interesting objects to point at · Input: click to point/share

**Scene setup**
A 3D garden with 10 interesting objects scattered around (butterfly, frog, rainbow, etc.). A simple robot face panel floats at eye level (no full avatar). The child's job is to *initiate* joint attention — find something cool and click it to share with the robot.

**Navigation**
The child drags to look around the garden, spots an object, and clicks/taps it to "share." A pointing beam (line or glow trail) extends from the bottom of the screen to the clicked object. The robot face panel turns to face the shared object and reacts (eyes widen, happy expression). Simple, intuitive pointer mechanic.

**Task steps**
1. Audio: *"Look around the garden! Find something amazing and show your friend!"*
2. Child explores by dragging the view, spots an interesting object, and clicks it.
3. Robot face reacts with excitement: *"Wow, a butterfly! I see it too!"* The object highlights and a shared-attention glow connects child's view and robot.
4. Child must find and share 5 objects in 2.5 minutes. Bonus star for sharing all 10.

**Performance assessment**

| Metric | Measure |
|---|---|
| Initiations | Total sharing clicks |
| Exploration range | % of garden viewed (camera coverage) |
| First initiation | Seconds to first share |

- 🟢 **Mastered:** ≥ 5 shares under 90 sec
- 🟡 **Developing:** 3–4 shares
- 🔴 **Retry:** ≤ 2 shares

---

## Skill 4 — Social Rules

### Task 7: The Right Way or Wrong Way?

> Environment: everyday locations (shop, classroom) · Short clips · Choice buttons

**Scene setup**
Short animated 3D clips (10 seconds each, scripted character animations in the Three.js scene) showing social scenarios in familiar settings: a child greeting someone, waiting in a queue, asking permission, using polite words. The child judges if the social behaviour shown is "right" or "needs fixing."

**Navigation**
After each clip, two large buttons appear: green checkmark ("That's fine!") and yellow wrench ("Needs fixing!"). Child selects with a click or tap. If "Needs fixing" is chosen, a follow-up shows the correct behaviour.

**Task steps**
1. Audio: *"Watch carefully! Is this the right thing to do?"* Clip plays.
2. Child selects "That's fine!" or "Needs fixing!" A friendly narrator explains why after each answer.
3. If incorrect: the clip replays with a red highlight on the problematic moment, then shows the correct version.
4. 8 clips per session covering: greetings, personal space, sharing, queue waiting, polite requests, saying sorry.

**Performance assessment**

| Metric | Measure |
|---|---|
| Rule recognition | Correct / 8 clips |
| Rule category score | % per rule type |
| Decision speed | Avg. seconds to decide |

- 🟢 **Mastered:** ≥ 7/8
- 🟡 **Developing:** 4–6/8
- 🔴 **Retry:** ≤ 3/8

---

### Task 8: Social Rule Fixer

> Environment: school / café scene · Choose the correct action · Click to select option cards

**Scene setup**
The child views a social situation in first person (camera placed inside the scene). A frozen scene shows a social moment — e.g., someone dropped their books, a peer is crying, it's time to greet a teacher. The child must choose the correct social action from 3 options shown as floating 3D cards.

**Navigation**
Three option cards float in the environment. The child clicks/taps the card they choose (cards enlarge slightly on hover as feedback; the camera smoothly tweens toward the selected card). Option cards have a short pictogram + word label. The scene then "unfreezes" and plays the consequence of their choice — good or bad outcome.

**Task steps**
1. Audio: *"Oh! Something is happening. What should you do?"* Scene freezes, 3 option cards appear.
2. Child reviews the options (e.g., "Help pick up books" / "Walk past" / "Laugh") and selects one.
3. Scene unfreezes and shows the consequence. Positive choices = warm glow + praise. Negative = neutral consequence + brief explanation of the better choice.
4. 6 scenes per session. Topics: helping others, greetings, personal space, sharing, apologies, asking for help.

**Performance assessment**

| Metric | Measure |
|---|---|
| Prosocial choices | Correct / 6 scenarios |
| Second attempts | % needing replay |
| Session trend | Score across sessions |

- 🟢 **Mastered:** ≥ 5/6 first attempt
- 🟡 **Developing:** 3–4/6
- 🔴 **Retry:** ≤ 2/6

---

## Master Performance Assessment Framework

### Domain summaries

**Emotional recognition**
- Face accuracy (T1) + context accuracy (T2)
- Confusion heat-map per emotion pair
- Latency trend across sessions
- Star rating: 1–3 stars per session

**Turn taking**
- Interruption count (T3 + T4)
- Wait duration trend
- False grab reduction over sessions
- % smooth handovers weekly

**Joint attention**
- Reticle-follow % (T5) + initiation count (T6)
- Latency to respond to pointing cue
- Prompt dependency index
- First-initiation time across sessions

**Social rules**
- Rule recognition % (T7) + prosocial choice % (T8)
- Category breakdown (greetings, sharing, etc.)
- Second-attempt rate
- Cross-session improvement slope

### Progression levels

| Level | Criteria (each task) | Action | Session reward |
|---|---|---|---|
| 🟢 Mastered | Top band score for 2 consecutive sessions | Advance to harder variant or next skill | Gold star + animated trophy |
| 🟡 Developing | Middle band score | Repeat with same difficulty | Silver star + encouragement |
| 🔴 Retry | Bottom band score | Repeat with extra visual prompts enabled | Bronze star + "Keep going!" message |

### In-task feedback modalities (all tasks)

- 🔊 Audio narration after each trial (Web Speech API or pre-recorded clips)
- ✨ Visual glow / particle feedback (Three.js particles, emissive materials, post-processing bloom)
- 📳 Optional vibration on correct answer (`navigator.vibrate()` on supported mobile devices); screen pulse/flash as the universal fallback
- ⭐ Star counter visible throughout (HUD overlay)
- 🤖 Friendly robot narrator voice

### Data export for researcher / therapist

All session data auto-saves to the browser (localStorage / IndexedDB) and can sync to a backend API when online. Export is a downloadable JSON file including: participant ID · task ID · trial-by-trial accuracy · latency per trial · prompt count · star rating · session timestamp. Visualised as weekly progress charts in a web researcher dashboard. Data compatible with SPSS / R import (JSON or CSV export) for statistical analysis.
