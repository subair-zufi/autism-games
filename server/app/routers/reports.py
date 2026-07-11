"""Mentor-facing progress reports for a single student.

Powers the client Progress dashboard. Everything is derived from the existing
analytics tables (``game_sessions``, ``game_events``, ``level_progress``) and is
scoped to the current mentor via :func:`resolve_owned_student`, so a mentor can
only ever read reports for their own students.
"""
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import scoring
from ..database import get_db
from ..deps import get_current_user
from ..models import GameEvent, GameSession, LevelProgress, Student, User
from ..schemas import (
    EmotionReport,
    EmotionStat,
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
    StudentReport,
)
from .students import resolve_owned_student

router = APIRouter(prefix="/api/reports", tags=["reports"])

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


def _aware(dt: datetime) -> datetime:
    """Treat naive timestamps (sqlite) as UTC so week bucketing is stable."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@router.get("/student/{student_id}", response_model=StudentReport)
def student_report(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StudentReport:
    resolve_owned_student(db, user, student_id)

    sessions = list(
        db.scalars(
            select(GameSession)
            .where(GameSession.user_id == user.id, GameSession.student_id == student_id)
            .order_by(GameSession.started_at.asc())
        ).all()
    )
    levels = list(
        db.scalars(
            select(LevelProgress).where(
                LevelProgress.user_id == user.id,
                LevelProgress.student_id == student_id,
            )
        ).all()
    )

    # --- summary -----------------------------------------------------------
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

    # --- timeseries: average final_score per trailing week -----------------
    now = datetime.now(timezone.utc)
    # Bucket start dates, oldest first (W1 .. W{WEEKS}).
    week_starts = [now - timedelta(weeks=WEEKS - 1 - i) for i in range(WEEKS)]
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

    # --- by_game -----------------------------------------------------------
    counts = Counter(s.game_key for s in sessions)
    by_game = [
        ReportGameBreakdown(game_key=k, activities=v) for k, v in counts.most_common()
    ]

    # --- recent ------------------------------------------------------------
    recent = [
        ReportRecentActivity(
            game_key=s.game_key,
            label=s.game_key,
            when=s.ended_at or s.started_at,
            score=s.final_score,
        )
        for s in sorted(sessions, key=lambda s: _aware(s.started_at), reverse=True)[
            :RECENT_LIMIT
        ]
    ]

    return StudentReport(
        student_id=student_id,
        summary=summary,
        timeseries=timeseries,
        by_game=by_game,
        recent=recent,
    )


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    values = sorted(values)
    mid = len(values) // 2
    if len(values) % 2 == 1:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2)


@router.get("/student/{student_id}/emotions", response_model=EmotionReport)
def emotion_report(
    student_id: uuid.UUID,
    game_key: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EmotionReport:
    """Per-emotion confusion matrix + latency for the emotion games.

    Aggregates *first-attempt* ``answer`` events (Emotion Clips lets the child
    retry until correct; retries would make accuracy meaningless, so
    ``payload.attempt`` > 1 is excluded — Emotion Recognition has one attempt
    per item and records no attempt field). ``payload.answer`` is the emotion
    shown, ``payload.picked`` the emotion chosen; the off-diagonal of the
    matrix is therefore exactly the child's confusion pattern
    (e.g. scared → surprised).
    """
    resolve_owned_student(db, user, student_id)

    games = (game_key,) if game_key else EMOTION_GAMES
    events = db.scalars(
        select(GameEvent).where(
            GameEvent.user_id == user.id,
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
            continue  # e.g. whoFeels rows from before emotion ids were recorded
        if p.get("attempt") not in (None, 1):
            continue  # first attempts only
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
        student_id=student_id,
        emotions=list(EMOTION_IDS),
        confusion=confusion,
        stats=stats,
    )


# ---------------------------------------------------------------------------
# Standardised skill scores (research analytics)
# ---------------------------------------------------------------------------
def _game_out(g: scoring.GameScore) -> GameScoreOut:
    return GameScoreOut(**g.as_dict())


def _skill_out(s: scoring.SkillScore) -> SkillScoreOut:
    return SkillScoreOut(
        skill=s.skill,
        label=s.label,
        score=s.score,
        delta=s.delta,
        n_games=s.n_games,
        games=[_game_out(g) for g in s.games],
    )


def _score_student(db: Session, user: User, student_id: uuid.UUID) -> scoring.ParticipantScores:
    """Load a student's whole event stream and reduce it to standardised scores."""
    events = db.scalars(
        select(GameEvent)
        .where(GameEvent.user_id == user.id, GameEvent.student_id == student_id)
        .order_by(GameEvent.created_at.asc())
    ).all()
    return scoring.score_participant(events)


@router.get("/student/{student_id}/skills", response_model=ParticipantSkillReport)
def student_skill_report(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ParticipantSkillReport:
    """Per-participant standardised profile: a 0-100 Social-Emotional composite,
    the four skill scores, the eight game scores, and pre/post improvement at
    every level. All scores are chance-corrected first-attempt accuracy so they
    are directly comparable across games and skills (see app/scoring.py)."""
    resolve_owned_student(db, user, student_id)
    ps = _score_student(db, user, student_id)
    return ParticipantSkillReport(
        student_id=student_id,
        composite=ps.composite,
        composite_delta=ps.composite_delta,
        n_sessions=ps.n_sessions,
        n_trials=ps.n_trials,
        skills=[_skill_out(s) for s in ps.skills],
    )


# Which Student attribute (or derived band) each grouping dimension reads.
_GROUP_DIMS = ("overall", "gender", "autism_level", "age_band", "iq_band")


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


@router.get("/groups", response_model=GroupReport)
def group_report(
    group_by: str = Query(default="overall", description="overall|gender|autism_level|age_band|iq_band"),
    gender: str | None = Query(default=None, description="Filter cohort by gender"),
    autism_level: str | None = Query(default=None, description="Filter cohort by autism level"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GroupReport:
    """Cohort-level scores across the mentor's students, optionally split by a
    demographic dimension (gender / autism level / age band / IQ band).

    Returns mean, SD and mean-improvement of the composite and each skill per
    bucket, so a researcher can compare group-wise and demographic differences.
    Only the requesting mentor's own students are ever included.
    """
    if group_by not in _GROUP_DIMS:
        group_by = "overall"

    stmt = select(Student).where(Student.mentor_id == user.id)
    if gender:
        stmt = stmt.where(Student.gender == gender)
    if autism_level:
        stmt = stmt.where(Student.autism_level == autism_level)
    students = list(db.scalars(stmt).all())

    # Score every student once, then bucket them for aggregation.
    scored: list[tuple[Student, scoring.ParticipantScores]] = [
        (s, _score_student(db, user, s.id)) for s in students
    ]
    # Only students with at least one scorable trial contribute.
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

    return GroupReport(
        group_by=group_by,
        total_participants=len(scored),
        breakdowns=breakdowns,
    )
