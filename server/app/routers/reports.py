"""Mentor-facing progress reports for a single student.

Powers the client Progress dashboard. Everything is derived from the existing
analytics tables (``game_sessions``, ``game_events``, ``level_progress``) and is
scoped to the current mentor via :func:`resolve_owned_student`, so a mentor can
only ever read reports for their own students.
"""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import GameSession, LevelProgress, User
from ..schemas import (
    ReportGameBreakdown,
    ReportRecentActivity,
    ReportSummary,
    ReportTimeseriesPoint,
    StudentReport,
)
from .students import resolve_owned_student

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Number of playable games in the client GAME_LIST. Kept here so the summary can
# show "N / TOTAL games done"; keep in sync with src/types.ts GAME_LIST.
TOTAL_GAMES = 11
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
