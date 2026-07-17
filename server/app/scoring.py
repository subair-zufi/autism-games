"""Standardised, cross-game scoring for the research battery.

The games emit very different raw numbers (chance-corrected accuracy for
the emotion/social quizzes, point tallies with lives for the joint-attention
and turn-taking scenes, latencies everywhere). To compare a child over time, to
compare the four target skills, and to compare cohorts, every game has to reduce
to *one* comparable quantity.

The common currency is a **0-100 Skill Score** defined identically for every
game as chance-corrected, first-attempt accuracy::

    score = 100 * max(0, (p - c) / (1 - c))

where ``p`` is the proportion of trials answered correctly on the first attempt
(independent responses only) and ``c`` is the game's guessing baseline. This is
the standard correction-for-guessing: 0 means chance-level performance, 100
means ceiling, and a 2-, 3- or 4-alternative task becomes directly comparable to
a "tap the pointed-at object" task.

Everything here is pure (no DB, no I/O) so it is unit-testable and is the single
source of truth for scoring. It reads the *existing* event stream, so no
gameplay change is needed and historical data still scores.

Aggregation is equal-weighted on purpose:
  * a **Skill Score** is the mean of the (<=3) game scores in that skill, so one
    game cannot dominate a skill;
  * the **Composite Social-Emotional Score** is the mean of the available skill
    scores, so each skill contributes equally regardless of how many games or
    trials it has.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Protocol

# --- Skill taxonomy (keep in sync with src/types.ts GAME_LIST `skill`) --------

SKILLS = ("emotion", "turntaking", "socialnorms", "jointattention")

SKILL_LABELS = {
    "emotion": "Emotional Identification",
    "turntaking": "Turn-Taking",
    "socialnorms": "Social Norms",
    "jointattention": "Joint Attention",
}

# The current game roster (keep in sync with src/types.ts GAME_LIST). Each VR
# copy trains the same skill as its flat original and is listed right after it.
SKILL_BY_GAME = {
    "emotionrecognition": "emotion",
    "emotionrecognition360": "emotion",
    "identifyemotions": "emotion",
    "identifyemotions360": "emotion",
    "blocks": "turntaking",
    "playroom360": "turntaking",
    "rollback": "turntaking",
    "football360": "turntaking",
    "rightway": "socialnorms",
    "rightway360": "socialnorms",
    "rulefixer": "socialnorms",
    "museum": "jointattention",
    "museum360": "jointattention",
    "discovery": "jointattention",
    "park360": "jointattention",
}

GAMES = tuple(SKILL_BY_GAME.keys())

# --- Per-game guessing baselines (chance level c) ----------------------------
# Emotion Recognition answer events do not carry a per-item chance, so it is
# derived from the level (Easy = 2 choices, Moderate/Hard = 3). Emotion Clips
# matches CHOICE_COUNT exactly. Right or Wrong / Good Choice record `chance`
# on every answer, so those are read straight from the payload.
EMOTIONREC_CHANCE = {"easy": 1 / 2, "medium": 1 / 3, "hard": 1 / 3}
CLIPS_CHANCE = {"easy": 1 / 2, "medium": 1 / 3, "hard": 1 / 4}

# Joint attention: Museum answers record ``visibleCount`` (pedestals on
# screen), so chance is read as 1/n directly. The cue map below is a legacy
# fallback for events recorded before within-session cue fading (July 2026),
# when the cue still identified the difficulty (and thus the pedestal count).
# Garden always shows all 8 objects regardless of cue.
MUSEUM_CUE_CHANCE = {"pulse": 1 / 3, "hover": 1 / 4, "distal": 1 / 6}
GARDEN_CHANCE = 1 / 8


def _museum_chance(p: dict) -> float:
    n = p.get("visibleCount")
    if isinstance(n, (int, float)) and n >= 2:
        return 1 / int(n)
    return MUSEUM_CUE_CHANCE.get(str(p.get("cue")), 1 / 3)

# Roll-Back: the cue identifies difficulty, which sets the number of partners the
# child must pick the ready one from. With a single partner the "who is ready"
# choice is trivial (chance handled as 0 — the skill there is timing, not
# selection).
ROLLBACK_CUE_PARTNERS = {"verbal": 1, "gesture": 2, "orient": 3}


class EventLike(Protocol):
    """Duck-typed subset of models.GameEvent used by the scorer."""

    event_type: str
    payload: dict | None
    session_id: object
    created_at: datetime


@dataclass
class Trial:
    """One scored opportunity, normalised across games."""

    correct: bool
    chance: float
    latency_ms: int | None
    session_id: str | None
    ts: datetime


def _p(e: EventLike) -> dict:
    return e.payload or {}


def _sid(e: EventLike) -> str | None:
    return str(e.session_id) if e.session_id is not None else None


def _is_true(v: object) -> bool:
    return v is True


def _level(p: dict) -> str:
    """Difficulty key, tolerating both ``level`` (flat games) and ``difficulty``
    (the 360 copies record the same easy/medium/hard tier under that name), so a
    VR build reads the same chance table as its flat original."""
    return str(p.get("level", p.get("difficulty", "easy")))


# --- Per-game trial extraction ------------------------------------------------
# Each returns a flat list of Trials. "First attempt only" is enforced per game
# so that retries (which some games allow as a scaffold) never inflate accuracy.


def _quiz_trials(events: Iterable[EventLike], chance_by_level: dict[str, float]) -> list[Trial]:
    """Emotion Recognition: one attempt per item, chance derived from level."""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "answer":
            continue
        p = _p(e)
        if "correct" not in p:
            continue
        level = _level(p)
        out.append(
            Trial(
                correct=_is_true(p["correct"]),
                chance=chance_by_level.get(level, 1 / 3),
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _clips_trials(events: Iterable[EventLike]) -> list[Trial]:
    """Emotion Clips: retries allowed, so keep first attempts (attempt in {None,1})."""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "answer":
            continue
        p = _p(e)
        if "correct" not in p or p.get("attempt") not in (None, 1):
            continue
        level = _level(p)
        out.append(
            Trial(
                correct=_is_true(p["correct"]),
                chance=CLIPS_CHANCE.get(level, 1 / 3),
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _payload_chance_trials(events: Iterable[EventLike]) -> list[Trial]:
    """Right or Wrong / Good Choice: `chance` is recorded on every answer."""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "answer":
            continue
        p = _p(e)
        if "correct" not in p:
            continue
        out.append(
            Trial(
                correct=_is_true(p["correct"]),
                chance=_float_or(p.get("chance"), 0.5),
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _pointing_trials(events: Iterable[EventLike], chance_of) -> list[Trial]:
    """Museum / Garden: each completed round ends on a correct tap. A round is a
    first-attempt success iff that correct tap carries ``firstAttempt``; a round
    whose correct tap does not is a first-attempt miss. (Rounds abandoned when
    lives run out are rare and simply not counted — this is first-attempt
    accuracy among completed rounds.)"""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "answer":
            continue
        p = _p(e)
        if not _is_true(p.get("correct")):
            continue  # only the round-closing correct tap defines the round
        out.append(
            Trial(
                correct=_is_true(p.get("firstAttempt")),
                chance=chance_of(p),
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _rollback_trials(events: Iterable[EventLike]) -> list[Trial]:
    """Roll-Back: each rally ends on a correct return; first-attempt success iff
    that return carries ``firstAttempt``. Chance is 1/partners (from the cue)."""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "roll_return":
            continue
        p = _p(e)
        if not _is_true(p.get("correct")):
            continue
        partners = ROLLBACK_CUE_PARTNERS.get(str(p.get("cue")), 1)
        out.append(
            Trial(
                correct=_is_true(p.get("firstAttempt")),
                chance=(1 / partners) if partners > 1 else 0.0,
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _discovery_trials(events: Iterable[EventLike]) -> list[Trial]:
    """Look What I Found (initiating JA): each round ends on a completed share
    (the child tapped both the surprise and the friend). A share is a success
    iff it was ``spontaneous`` — completed before any helper nudge fired.
    Initiation has no guessing baseline, so chance is 0 (like Blocks), and
    ``latencyMs`` is surprise-onset -> friend-tap (the initiation latency)."""
    out: list[Trial] = []
    for e in events:
        if e.event_type != "share":
            continue
        p = _p(e)
        if "correct" not in p:
            continue
        out.append(
            Trial(
                correct=_is_true(p.get("correct")),
                chance=0.0,
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
            )
        )
    return out


def _blocks_trials(events: Iterable[EventLike]) -> list[Trial]:
    """Block Buddies: waiting for one's turn has no guessing baseline. Each block
    placed is a success; each out-of-turn (impatient) tap is a failure."""
    out: list[Trial] = []
    for e in events:
        if e.event_type == "place_block":
            correct = True
        elif e.event_type == "impatient_tap":
            correct = False
        else:
            continue
        out.append(Trial(correct=correct, chance=0.0, latency_ms=None, session_id=_sid(e), ts=e.created_at))
    return out


def trials_for_game(game_key: str, events: Iterable[EventLike]) -> list[Trial]:
    """Normalise one game's events into comparable trials."""
    evs = list(events)
    if game_key == "emotionrecognition":
        return _quiz_trials(evs, EMOTIONREC_CHANCE)
    if game_key == "emotionrecognition360":
        # Emotion Room 360 is the immersive copy of Emotion Recognition. It
        # records the guessing baseline (`chance`) directly on every answer (one
        # answer per round), so it scores like the payload-chance games; the flat
        # original derives chance from the level instead.
        return _payload_chance_trials(evs)
    if game_key in ("identifyemotions", "identifyemotions360"):
        # Emotion Cinema 360 is the immersive copy of Emotion Clips — same
        # first-attempt answer payloads (chance from the level's choice count),
        # so the same clips scoring applies.
        return _clips_trials(evs)
    if game_key in ("rightway", "rightway360", "rulefixer"):
        # Schoolyard 360 is the immersive copy of Right or Wrong — same answer
        # payloads (`chance` and `construct` on every answer), so the same
        # payload-chance scoring applies.
        return _payload_chance_trials(evs)
    if game_key in ("museum", "museum360"):
        # Museum 360 is the immersive copy of Museum Look — same answer
        # payloads, so the same 1/visibleCount guessing baseline applies.
        return _pointing_trials(evs, _museum_chance)
    if game_key == "garden":
        return _pointing_trials(evs, lambda p: GARDEN_CHANCE)
    if game_key in ("rollback", "football360"):
        # Football 360 is the immersive copy of Roll-Back Buddy — same
        # roll_return payloads, so the same 1/partners guessing baseline applies.
        return _rollback_trials(evs)
    if game_key in ("blocks", "playroom360"):
        # Playroom 360 is the immersive copy of Block Buddies — same place_block /
        # impatient_tap turn events, so the same waiting score applies.
        return _blocks_trials(evs)
    if game_key in ("discovery", "park360"):
        # Park 360 is the immersive copy of Look What I Found! — same share
        # payloads, so the same spontaneous-initiation scoring applies.
        return _discovery_trials(evs)
    return []


# --- Scoring primitives -------------------------------------------------------


def corrected_score(trials: list[Trial]) -> float | None:
    """0-100 chance-corrected first-attempt accuracy over a pool of trials."""
    if not trials:
        return None
    p = sum(1 for t in trials if t.correct) / len(trials)
    c = sum(t.chance for t in trials) / len(trials)
    if c >= 1:
        return 0.0
    return round(100 * max(0.0, (p - c) / (1 - c)), 1)


def _raw_accuracy(trials: list[Trial]) -> float | None:
    if not trials:
        return None
    return round(sum(1 for t in trials if t.correct) / len(trials), 4)


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2 == 1:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2)


def _sessions_ordered(trials: list[Trial]) -> list[list[Trial]]:
    """Group trials by session, oldest session first (by earliest trial)."""
    buckets: dict[str | None, list[Trial]] = {}
    for t in trials:
        buckets.setdefault(t.session_id, []).append(t)
    return sorted(buckets.values(), key=lambda ts: min(t.ts for t in ts))


# --- Public score objects -----------------------------------------------------


@dataclass
class GameScore:
    game_key: str
    skill: str
    score: float | None  # 0-100 chance-corrected first-attempt accuracy
    raw_accuracy: float | None  # 0-1, uncorrected
    n_trials: int
    n_sessions: int
    median_latency_ms: int | None
    baseline_score: float | None  # first session's score (pre)
    latest_score: float | None  # most recent session's score (post)
    delta: float | None  # latest - baseline (improvement)

    def as_dict(self) -> dict:
        return {
            "game_key": self.game_key,
            "skill": self.skill,
            "score": self.score,
            "raw_accuracy": self.raw_accuracy,
            "n_trials": self.n_trials,
            "n_sessions": self.n_sessions,
            "median_latency_ms": self.median_latency_ms,
            "baseline_score": self.baseline_score,
            "latest_score": self.latest_score,
            "delta": self.delta,
        }


@dataclass
class SkillScore:
    skill: str
    label: str
    score: float | None
    delta: float | None
    n_games: int  # games in this skill with any data
    games: list[GameScore] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "skill": self.skill,
            "label": self.label,
            "score": self.score,
            "delta": self.delta,
            "n_games": self.n_games,
            "games": [g.as_dict() for g in self.games],
        }


@dataclass
class ParticipantScores:
    composite: float | None  # 0-100 Social-Emotional composite
    composite_delta: float | None
    skills: list[SkillScore]
    n_sessions: int
    n_trials: int

    def as_dict(self) -> dict:
        return {
            "composite": self.composite,
            "composite_delta": self.composite_delta,
            "n_sessions": self.n_sessions,
            "n_trials": self.n_trials,
            "skills": [s.as_dict() for s in self.skills],
        }


def _mean(values: list[float]) -> float | None:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def score_game(game_key: str, events: Iterable[EventLike]) -> GameScore:
    trials = trials_for_game(game_key, events)
    sessions = _sessions_ordered(trials)
    latencies = [t.latency_ms for t in trials if t.latency_ms is not None]
    baseline = corrected_score(sessions[0]) if sessions else None
    latest = corrected_score(sessions[-1]) if sessions else None
    delta = round(latest - baseline, 1) if baseline is not None and latest is not None else None
    return GameScore(
        game_key=game_key,
        skill=SKILL_BY_GAME.get(game_key, ""),
        score=corrected_score(trials),
        raw_accuracy=_raw_accuracy(trials),
        n_trials=len(trials),
        n_sessions=len(sessions),
        median_latency_ms=_median([int(x) for x in latencies]),
        baseline_score=baseline,
        latest_score=latest,
        delta=delta,
    )


def score_participant(events: Iterable[EventLike]) -> ParticipantScores:
    """Compute the full participant profile from one student's event stream.

    ``events`` may contain any/all games; each is bucketed by ``game_key``.
    """
    by_game: dict[str, list[EventLike]] = {g: [] for g in GAMES}
    session_ids: set[str] = set()
    for e in events:
        if e.game_key in by_game:  # type: ignore[attr-defined]
            by_game[e.game_key].append(e)  # type: ignore[attr-defined]
            if e.session_id is not None:
                session_ids.add(str(e.session_id))

    game_scores = {g: score_game(g, by_game[g]) for g in GAMES}

    skills: list[SkillScore] = []
    for skill in SKILLS:
        gs = [game_scores[g] for g in GAMES if SKILL_BY_GAME[g] == skill]
        scored = [g for g in gs if g.score is not None]
        skills.append(
            SkillScore(
                skill=skill,
                label=SKILL_LABELS[skill],
                score=_mean([g.score for g in scored]) if scored else None,
                delta=_mean([g.delta for g in scored if g.delta is not None]) or None,
                n_games=len(scored),
                games=gs,
            )
        )

    composite = _mean([s.score for s in skills if s.score is not None]) or None
    composite_delta = _mean([s.delta for s in skills if s.delta is not None]) or None
    n_trials = sum(g.n_trials for g in game_scores.values())
    return ParticipantScores(
        composite=composite,
        composite_delta=composite_delta,
        skills=skills,
        n_sessions=len(session_ids),
        n_trials=n_trials,
    )


# --- Cohort / demographic aggregation ----------------------------------------


def _stddev(values: list[float]) -> float | None:
    if len(values) < 2:
        return 0.0 if values else None
    m = sum(values) / len(values)
    var = sum((v - m) ** 2 for v in values) / (len(values) - 1)
    return round(var**0.5, 1)


@dataclass
class GroupStat:
    """Mean/SD/n of one metric across a cohort (a group of participants)."""

    metric: str  # "composite" or a skill id
    label: str
    mean: float | None
    sd: float | None
    mean_delta: float | None  # mean improvement across participants
    n: int  # participants contributing a score

    def as_dict(self) -> dict:
        return {
            "metric": self.metric,
            "label": self.label,
            "mean": self.mean,
            "sd": self.sd,
            "mean_delta": self.mean_delta,
            "n": self.n,
        }


def aggregate_group(participants: list[ParticipantScores]) -> list[GroupStat]:
    """Composite + per-skill mean/SD/mean-delta across a set of participants."""
    stats: list[GroupStat] = []

    comp = [p.composite for p in participants if p.composite is not None]
    comp_d = [p.composite_delta for p in participants if p.composite_delta is not None]
    stats.append(
        GroupStat(
            metric="composite",
            label="Social-Emotional Composite",
            mean=_mean(comp),
            sd=_stddev(comp),
            mean_delta=_mean(comp_d),
            n=len(comp),
        )
    )

    for skill in SKILLS:
        vals = []
        deltas = []
        for p in participants:
            s = next((s for s in p.skills if s.skill == skill), None)
            if s and s.score is not None:
                vals.append(s.score)
            if s and s.delta is not None:
                deltas.append(s.delta)
        stats.append(
            GroupStat(
                metric=skill,
                label=SKILL_LABELS[skill],
                mean=_mean(vals),
                sd=_stddev(vals),
                mean_delta=_mean(deltas),
                n=len(vals),
            )
        )
    return stats


def age_band(dob: object, today: object) -> str:
    """Coarse age bands for demographic grouping (8-15 target range)."""
    from datetime import date

    if not isinstance(dob, date) or not isinstance(today, date):
        return "unknown"
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if years < 8:
        return "under 8"
    if years <= 10:
        return "8-10"
    if years <= 12:
        return "11-12"
    if years <= 15:
        return "13-15"
    return "16+"


def iq_band(iq: object) -> str:
    """Coarse IQ bands for demographic grouping."""
    if not isinstance(iq, (int, float)):
        return "unknown"
    if iq < 70:
        return "<70"
    if iq < 85:
        return "70-84"
    if iq < 100:
        return "85-99"
    return "100+"


def _int_or_none(v: object) -> int | None:
    return int(v) if isinstance(v, (int, float)) else None


def _float_or(v: object, default: float) -> float:
    return float(v) if isinstance(v, (int, float)) else default


# --- Per-construct scores (social-norms games) --------------------------------
# Right or Wrong and Good Choice both tag every answer with a `construct` (see
# their tallyByConstruct helpers), but a single session only carries ~2 trials
# per construct — a deliberate fatigue guard (see their content.ts headers).
# That is too few to read one child's strength/weakness on one construct, so
# the dashboard pools several recent sessions instead of reading one alone.

SOCIAL_NORMS_GAMES = ("rightway", "rightway360", "rulefixer")

SOCIAL_NORMS_CONSTRUCTS: dict[str, tuple[str, ...]] = {
    "rightway": ("greetings", "sharing", "turns", "space", "politeness"),
    # Schoolyard 360 reuses the flat game's item bank, so the same constructs.
    "rightway360": ("greetings", "sharing", "turns", "space", "politeness"),
    "rulefixer": ("helping", "comforting", "inclusion", "politeness", "fairness"),
}

# How many of a student's most recent sessions of a game to pool by default.
# Each session samples ~2 of the ~4 banked items per construct, so 5 sessions
# comfortably cover the bank at least once while staying weighted toward
# current ability rather than a child's very first attempts.
DEFAULT_CONSTRUCT_SESSION_WINDOW = 5


@dataclass
class ConstructTrial:
    """One scored opportunity tagged with the construct it measures."""

    correct: bool
    chance: float
    latency_ms: int | None
    session_id: str | None
    ts: datetime
    construct: str


def _construct_trials(events: Iterable[EventLike]) -> list[ConstructTrial]:
    """Right or Wrong / Good Choice: `construct` and `chance` are recorded on
    every answer event (see tallyByConstruct in each game's logic.ts)."""
    out: list[ConstructTrial] = []
    for e in events:
        if e.event_type != "answer":
            continue
        p = _p(e)
        construct = p.get("construct")
        if "correct" not in p or not isinstance(construct, str):
            continue
        out.append(
            ConstructTrial(
                correct=_is_true(p["correct"]),
                chance=_float_or(p.get("chance"), 0.5),
                latency_ms=_int_or_none(p.get("latencyMs")),
                session_id=_sid(e),
                ts=e.created_at,
                construct=construct,
            )
        )
    return out


@dataclass
class ConstructScore:
    construct: str
    score: float | None  # 0-100 chance-corrected, pooled across recent sessions
    raw_accuracy: float | None  # 0-1, uncorrected
    n_trials: int
    median_latency_ms: int | None

    def as_dict(self) -> dict:
        return {
            "construct": self.construct,
            "score": self.score,
            "raw_accuracy": self.raw_accuracy,
            "n_trials": self.n_trials,
            "median_latency_ms": self.median_latency_ms,
        }


@dataclass
class GameConstructProfile:
    game_key: str
    constructs: list[ConstructScore]
    n_sessions_pooled: int
    session_window: int

    def as_dict(self) -> dict:
        return {
            "game_key": self.game_key,
            "constructs": [c.as_dict() for c in self.constructs],
            "n_sessions_pooled": self.n_sessions_pooled,
            "session_window": self.session_window,
        }


def score_constructs(
    game_key: str,
    events: Iterable[EventLike],
    session_window: int = DEFAULT_CONSTRUCT_SESSION_WINDOW,
) -> GameConstructProfile:
    """Per-construct accuracy for one social-norms game, pooled across the
    student's most recent ``session_window`` sessions of that game (oldest of
    the window first, so a still-shorter play history just pools everything
    it has)."""
    trials = _construct_trials(events)
    sessions = _sessions_ordered(trials)
    recent = sessions[-session_window:] if session_window > 0 else sessions
    pooled = [t for sess in recent for t in sess]

    constructs = SOCIAL_NORMS_CONSTRUCTS.get(game_key, ())
    by_construct: dict[str, list[ConstructTrial]] = {c: [] for c in constructs}
    for t in pooled:
        if t.construct in by_construct:
            by_construct[t.construct].append(t)

    scores = []
    for c in constructs:
        ts = by_construct[c]
        latencies = [t.latency_ms for t in ts if t.latency_ms is not None]
        scores.append(
            ConstructScore(
                construct=c,
                score=corrected_score(ts),
                raw_accuracy=_raw_accuracy(ts),
                n_trials=len(ts),
                median_latency_ms=_median([int(x) for x in latencies]),
            )
        )

    return GameConstructProfile(
        game_key=game_key,
        constructs=scores,
        n_sessions_pooled=len(recent),
        session_window=session_window,
    )


def score_social_norms(
    events: Iterable[EventLike],
    session_window: int = DEFAULT_CONSTRUCT_SESSION_WINDOW,
) -> list[GameConstructProfile]:
    """Per-construct profiles for both social-norms games from one student's
    event stream (mirrors :func:`score_participant`'s per-game bucketing)."""
    by_game: dict[str, list[EventLike]] = {g: [] for g in SOCIAL_NORMS_GAMES}
    for e in events:
        if e.game_key in by_game:  # type: ignore[attr-defined]
            by_game[e.game_key].append(e)  # type: ignore[attr-defined]
    return [score_constructs(g, by_game[g], session_window) for g in SOCIAL_NORMS_GAMES]
