"""Mentor-facing progress reports for a single student.

Powers the client Progress dashboard. Report *computation* lives in
``app/reporting.py`` (shared with the admin dashboard); this router only
resolves ownership (a mentor may only read reports for their own students)
and adapts query params.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import reporting, scoring
from ..database import get_db
from ..deps import get_current_user
from ..models import Student, User
from ..schemas import EmotionReport, GroupReport, ParticipantSkillReport, SocialNormsReport, StudentReport
from .students import resolve_owned_student

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/student/{student_id}", response_model=StudentReport)
def student_report(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StudentReport:
    resolve_owned_student(db, user, student_id)
    return reporting.build_student_report(db, student_id)


@router.get("/student/{student_id}/emotions", response_model=EmotionReport)
def emotion_report(
    student_id: uuid.UUID,
    game_key: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EmotionReport:
    """Per-emotion confusion matrix + latency for the emotion games."""
    resolve_owned_student(db, user, student_id)
    return reporting.build_emotion_report(db, student_id, game_key)


# ---------------------------------------------------------------------------
# Standardised skill scores (research analytics)
# ---------------------------------------------------------------------------
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
    return reporting.build_skill_report(db, student_id)


@router.get("/student/{student_id}/social-norms", response_model=SocialNormsReport)
def social_norms_report(
    student_id: uuid.UUID,
    sessions: int = Query(
        default=scoring.DEFAULT_CONSTRUCT_SESSION_WINDOW,
        ge=1,
        le=20,
        description="How many of the student's most recent sessions per game to pool",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SocialNormsReport:
    """Per-construct accuracy for the social-norms games (Right or Wrong, Good
    Choice), pooled across the student's most recent sessions of each game.

    A single session only carries ~2 trials per construct — a deliberate
    fatigue guard, not a data gap — so reading one session's per-construct
    tally alone is too noisy to judge a child's strength on e.g. "sharing"
    vs "personal space". Pooling the last few sessions accumulates enough
    trials per construct while staying weighted toward current ability.
    """
    resolve_owned_student(db, user, student_id)
    return reporting.build_social_norms_report(db, student_id, session_window=sessions)


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
    stmt = select(Student).where(Student.mentor_id == user.id)
    if gender:
        stmt = stmt.where(Student.gender == gender)
    if autism_level:
        stmt = stmt.where(Student.autism_level == autism_level)
    students = list(db.scalars(stmt).all())
    return reporting.build_group_report(db, students, group_by)
