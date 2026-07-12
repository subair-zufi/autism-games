"""Framework-agnostic report builders shared by the mentor (`reports.py`) and
admin (`admin.py`) routers, so both surfaces show identical scoring/analytics
from one source of truth. Every function takes a resolved ``student_id`` (or a
pre-fetched list of students for the group report) — callers own the
authorization check (mentor ownership vs. admin) before calling in.

``GameEvent.student_id`` always belongs to exactly one mentor (enforced at
write time by ``resolve_owned_student`` in events.py), so filtering purely by
``student_id`` is sufficient and correct for both a mentor's own view and an
admin's cross-mentor view.
"""
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import scoring
from .models import GameEvent, GameSession, LevelProgress, Student
from .schemas import (
    ConstructScoreOut,
    EmotionReport,
    EmotionStat,
    GameConstructReport,
    GameScoreOut,
    GroupBreakdown,
    GroupReport,
    GroupStatOut,
    ParticipantSkillReport,
    ReportGameBreakdown,
    ReportRecentActivity,
    ReportSummary,
    ReportTimeseriesPoint,
    SkillScoreOut,
    SocialNormsReport,
    StudentReport,
)

# Number of playable games in the client GAME_LIST. Kept here so the summary can
# show "N / TOTAL games done"; keep in sync with src/types.ts GAME_LIST.
TOTAL_GAMES = len(scoring.GAMES)

# The games whose "answer" events carry emotion ids, and the emotion vocabulary.
# Keep in sync with src/games/emotionVocab.ts.
EMOTION_GAMES = ("emotionrecognition", "identifyemotions")
EMOTION_IDS = ("happy", "sad", "angry", "surprised", "scared", "disgust")
# How many trailing weeks the "Progress Over Time" chart shows.
WEEKS = 6
# How many rows the "Recent Activities" list shows.
RECENT_LIMIT = 8

# Which Student attribute (or derived band) each grouping dimension reads.
GROUP_DIMS = ("overall", "gender", "autism_level", "age_band", "iq_band")


def _aware(dt: datetime) -> datetime:
    """Treat naive timestamps (sqlite) as UTC so week bucketing is stable."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2 == 1:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2)


def build_student_report(db: Session, student_id: uuid.UUID) -> StudentReport:
    sessions = list(
        db.scalars(
            select(GameSession)
            .where(GameSession.student_id == student_id)
            .order_by(GameSession.started_at.asc())
        ).all()
    )
    levels = list(
        db.scalars(select(LevelProgress).where(LevelProgress.student_id == student_id)).all()
    )

    completion_pct = (
        round(sum(l.best_accuracy for l in levels) / len(levels) * 100) if levels else 0
    )
    games_done = len({s.game_key for s in sessions})
    summary = ReportSummary(
        completion_pct=completion_pct,
        games_done=games_done,
        total_games=TOTAL_GAMES,
        sessions=len(sessions),
    )

    now = datetime.now(timezone.utc)
    sums: dict[int, list[int]] = defaultdict(list)
    for s in sessions:
        if s.final_score is None:
            continue
        age_weeks = int((now - _aware(s.started_at)).days // 7)
        idx = WEEKS - 1 - age_weeks
        if 0 <= idx < WEEKS:
            sums[idx].append(s.final_score)
    timeseries = [
        ReportTimeseriesPoint(
            label=f"W{i + 1}",
            value=round(sum(sums[i]) / len(sums[i])) if sums.get(i) else 0,
        )
        for i in range(WEEKS)
    ]

    counts = Counter(s.game_key for s in sessions)
    by_game = [ReportGameBreakdown(game_key=k, activities=v) for k, v in counts.most_common()]

    recent = [
        ReportRecentActivity(
            game_key=s.game_key,
            label=s.game_key,
            when=s.ended_at or s.started_at,
            score=s.final_score,
        )
        for s in sorted(sessions, key=lambda s: _aware(s.started_at), reverse=True)[:RECENT_LIMIT]
    ]

    return StudentReport(
        student_id=student_id, summary=summary, timeseries=timeseries, by_game=by_game, recent=recent
    )


def build_emotion_report(
    db: Session, student_id: uuid.UUID, game_key: str | None = None
) -> EmotionReport:
    """Per-emotion confusion matrix + latency for the emotion games.

    Aggregates *first-attempt* ``answer`` events (Emotion Clips lets the child
    retry until correct; retries would make accuracy meaningless, so
    ``payload.attempt`` > 1 is excluded — Emotion Recognition has one attempt
    per item and records no attempt field).
    """
    games = (game_key,) if game_key else EMOTION_GAMES
    events = db.scalars(
        select(GameEvent).where(
            GameEvent.student_id == student_id,
            GameEvent.game_key.in_(games),
            GameEvent.event_type == "answer",
        )
    ).all()

    confusion: dict[str, dict[str, int]] = {
        shown: {picked: 0 for picked in EMOTION_IDS} for shown in EMOTION_IDS
    }
    latencies: dict[str, list[int]] = defaultdict(list)
    for e in events:
        p = e.payload or {}
        shown, picked = p.get("answer"), p.get("picked")
        if shown not in EMOTION_IDS or picked not in EMOTION_IDS:
            continue
        if p.get("attempt") not in (None, 1):
            continue
        confusion[shown][picked] += 1
        latency = p.get("latencyMs")
        if isinstance(latency, (int, float)):
            latencies[shown].append(int(latency))

    stats = []
    for shown in EMOTION_IDS:
        row = confusion[shown]
        total = sum(row.values())
        correct = row[shown]
        stats.append(
            EmotionStat(
                emotion=shown,
                total=total,
                correct=correct,
                accuracy=correct / total if total else 0.0,
                median_latency_ms=_median(latencies[shown]),
            )
        )

    return EmotionReport(
        student_id=student_id, emotions=list(EMOTION_IDS), confusion=confusion, stats=stats
    )


def _game_out(g: scoring.GameScore) -> GameScoreOut:
    return GameScoreOut(**g.as_dict())


def _skill_out(s: scoring.SkillScore) -> SkillScoreOut:
    return SkillScoreOut(
        skill=s.skill, label=s.label, score=s.score, delta=s.delta, n_games=s.n_games,
        games=[_game_out(g) for g in s.games],
    )


def score_student(db: Session, student_id: uuid.UUID) -> scoring.ParticipantScores:
    """Load a student's whole event stream and reduce it to standardised scores."""
    events = db.scalars(
        select(GameEvent).where(GameEvent.student_id == student_id).order_by(GameEvent.created_at.asc())
    ).all()
    return scoring.score_participant(events)


def build_skill_report(db: Session, student_id: uuid.UUID) -> ParticipantSkillReport:
    ps = score_student(db, student_id)
    return ParticipantSkillReport(
        student_id=student_id,
        composite=ps.composite,
        composite_delta=ps.composite_delta,
        n_sessions=ps.n_sessions,
        n_trials=ps.n_trials,
        skills=[_skill_out(s) for s in ps.skills],
    )


def build_social_norms_report(
    db: Session,
    student_id: uuid.UUID,
    session_window: int = scoring.DEFAULT_CONSTRUCT_SESSION_WINDOW,
) -> SocialNormsReport:
    events = db.scalars(
        select(GameEvent)
        .where(
            GameEvent.student_id == student_id,
            GameEvent.game_key.in_(scoring.SOCIAL_NORMS_GAMES),
            GameEvent.event_type == "answer",
        )
        .order_by(GameEvent.created_at.asc())
    ).all()
    profiles = scoring.score_social_norms(events, session_window=session_window)
    return SocialNormsReport(
        student_id=student_id,
        games=[
            GameConstructReport(
                game_key=p.game_key,
                constructs=[ConstructScoreOut(**c.as_dict()) for c in p.constructs],
                n_sessions_pooled=p.n_sessions_pooled,
                session_window=p.session_window,
            )
            for p in profiles
        ],
    )


def _bucket_of(student: Student, group_by: str) -> str:
    if group_by == "gender":
        return student.gender or "unknown"
    if group_by == "autism_level":
        return student.autism_level or "unknown"
    if group_by == "age_band":
        return scoring.age_band(student.date_of_birth, date.today())
    if group_by == "iq_band":
        return scoring.iq_band(student.iq_score)
    return "all"


def build_group_report(db: Session, students: list[Student], group_by: str) -> GroupReport:
    """Cohort-level scores across ``students``, optionally split by a
    demographic dimension. Caller decides which students are in scope (one
    mentor's own, or every mentor's, for the admin cross-cohort view)."""
    if group_by not in GROUP_DIMS:
        group_by = "overall"

    scored: list[tuple[Student, scoring.ParticipantScores]] = [
        (s, score_student(db, s.id)) for s in students
    ]
    scored = [(s, ps) for (s, ps) in scored if ps.n_trials > 0]

    buckets: dict[str, list[scoring.ParticipantScores]] = defaultdict(list)
    for student, ps in scored:
        buckets[_bucket_of(student, group_by)].append(ps)

    breakdowns = [
        GroupBreakdown(
            group=name,
            n_participants=len(group),
            stats=[GroupStatOut(**gs.as_dict()) for gs in scoring.aggregate_group(group)],
        )
        for name in sorted(buckets)
        for group in [buckets[name]]
    ]

    return GroupReport(group_by=group_by, total_participants=len(scored), breakdowns=breakdowns)
