"""The per-session user-experience record.

The trainer's console posts one of these the moment the headset comes off. It
is the instrument behind the user-experience objective, and the reason it lives
in the app rather than in a separate form tool is the join: recorded here it
arrives already carrying ``student_id`` and the date, so it lines up with that
child's telemetry without anybody re-typing a participant code.

Writes are idempotent per (participant, date, session of that day, rater). The
console re-sends a queued record after the Wi-Fi comes back without having to
know whether the first attempt landed, and a trainer correcting an answer
re-posts the form rather than creating a second row.
"""
import uuid
from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import SessionExperience, User
from ..schemas import PLAY_AGAIN_VALUES, SessionExperienceIn, SessionExperiencePublic
from .students import resolve_owned_student

router = APIRouter(prefix="/api/session-experience", tags=["session-experience"])

#: Fields copied straight from the payload onto the row. Listed rather than
#: derived from the schema so adding a question to the form is a deliberate
#: edit here as well — the export and the codebook have to learn about it too.
_ANSWER_FIELDS = (
    "games_played",
    "minutes",
    "child_fun",
    "child_feeling",
    "child_play_again",
    "rated_engagement",
    "rated_independence",
    "rated_comfort",
    "rated_enjoyment",
    "rated_willingness",
    "went_well",
    "was_difficult",
    "different_from_last",
    "stopped_early",
    "stop_reason",
    "is_second_rating",
)


def _scope(student_id: uuid.UUID, visit_date: date_cls, ordinal: int, rater_id: str):
    """WHERE clause for the one row a given rater holds for a given visit."""
    return and_(
        SessionExperience.student_id == student_id,
        SessionExperience.visit_date == visit_date,
        SessionExperience.session_ordinal == ordinal,
        SessionExperience.rater_id == rater_id,
    )


@router.post("", response_model=SessionExperiencePublic, status_code=status.HTTP_201_CREATED)
def submit_experience(
    data: SessionExperienceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionExperiencePublic:
    """Save (or update) one session record for a child the caller owns."""
    resolve_owned_student(db, user, data.student_id)

    if data.child_play_again is not None and data.child_play_again not in PLAY_AGAIN_VALUES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"child_play_again must be one of {', '.join(PLAY_AGAIN_VALUES)}.",
        )

    row = db.scalar(
        select(SessionExperience).where(
            _scope(data.student_id, data.visit_date, data.session_ordinal, data.rater_id)
        )
    )
    if row is None:
        row = SessionExperience(
            user_id=user.id,
            student_id=data.student_id,
            visit_date=data.visit_date,
            session_ordinal=data.session_ordinal,
            rater_id=data.rater_id,
            # Set explicitly: SQLAlchemy column defaults land at flush time, so
            # the in-memory row would otherwise carry None for a NOT NULL bool.
            is_second_rating=data.is_second_rating,
            stopped_early=data.stopped_early,
        )
        db.add(row)

    for field in _ANSWER_FIELDS:
        setattr(row, field, getattr(data, field))

    db.commit()
    db.refresh(row)
    return SessionExperiencePublic.model_validate(row)


@router.get("", response_model=list[SessionExperiencePublic])
def list_experience(
    student_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SessionExperiencePublic]:
    """Every record held for one child, oldest first.

    The console reads this to show the trainer what they wrote last time, which
    is what makes the "anything different from the last session?" question
    answerable rather than a guess.
    """
    resolve_owned_student(db, user, student_id)
    rows = db.scalars(
        select(SessionExperience)
        .where(SessionExperience.student_id == student_id)
        .order_by(SessionExperience.visit_date.asc(), SessionExperience.session_ordinal.asc())
    ).all()
    return [SessionExperiencePublic.model_validate(r) for r in rows]
