"""Per-student level progression for level-based games (Emotion Recognition).

Progress is scoped to the current mentor (:class:`User`) and, optionally, the
student being played for — so a learner resumes at their highest unlocked level
across sessions and devices. The server is authoritative for unlock logic:
reaching the pass threshold on a level unlocks the next one.
"""
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import LevelProgress, User
from ..schemas import LevelProgressPublic, LevelProgressSubmit
from .students import resolve_owned_student

router = APIRouter(prefix="/api/progress", tags=["progress"])

# Ordered levels shared with the client. Passing a level unlocks the next.
LEVEL_ORDER = ["easy", "medium", "hard"]
# Kept in sync with the client thresholds in src/games/emotionrecognition/logic.ts.
PASS_THRESHOLD = 0.7
MASTERY_THRESHOLD = 0.8


def _scope(user: User, student_id: uuid.UUID | None, game_key: str):
    """WHERE clause matching a mentor+student+game scope (NULL-safe on student)."""
    return and_(
        LevelProgress.user_id == user.id,
        LevelProgress.student_id.is_(None)
        if student_id is None
        else LevelProgress.student_id == student_id,
        LevelProgress.game_key == game_key,
    )


def _rows(db: Session, user: User, student_id: uuid.UUID | None, game_key: str) -> list[LevelProgress]:
    return list(db.scalars(select(LevelProgress).where(_scope(user, student_id, game_key))).all())


def _get_or_create(
    db: Session, user: User, student_id: uuid.UUID | None, game_key: str, level: str, *, unlocked: bool
) -> LevelProgress:
    row = db.scalar(
        select(LevelProgress).where(and_(_scope(user, student_id, game_key), LevelProgress.level == level))
    )
    if row is None:
        # Easy is always unlocked; other levels start unlocked only when reached.
        # Set the numeric/bool fields explicitly: SQLAlchemy column ``default``s
        # are applied at flush time, so without these the in-memory row holds
        # ``None`` and the caller's ``row.attempts += 1`` would fail.
        row = LevelProgress(
            user_id=user.id,
            student_id=student_id,
            game_key=game_key,
            level=level,
            unlocked=unlocked or level == LEVEL_ORDER[0],
            attempts=0,
            best_score=0,
            best_accuracy=0.0,
            passed=False,
            mastered=False,
        )
        db.add(row)
    elif unlocked:
        row.unlocked = True
    return row


@router.get("", response_model=list[LevelProgressPublic])
def get_progress(
    game_key: str = Query(..., max_length=80),
    student_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LevelProgressPublic]:
    """All saved level rows for a student+game, so the client can resume/gate."""
    if student_id is not None:
        resolve_owned_student(db, user, student_id)
    return [LevelProgressPublic.model_validate(r) for r in _rows(db, user, student_id, game_key)]


@router.post("", response_model=list[LevelProgressPublic], status_code=status.HTTP_201_CREATED)
def submit_attempt(
    data: LevelProgressSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LevelProgressPublic]:
    """Record a finished level attempt and apply unlock logic authoritatively."""
    if data.student_id is not None:
        resolve_owned_student(db, user, data.student_id)

    accuracy = data.score / data.total

    row = _get_or_create(db, user, data.student_id, data.game_key, data.level, unlocked=True)
    row.attempts += 1
    row.best_score = max(row.best_score, data.score)
    row.best_accuracy = max(row.best_accuracy, accuracy)
    row.passed = row.passed or accuracy >= PASS_THRESHOLD
    row.mastered = row.mastered or accuracy >= MASTERY_THRESHOLD

    # Passing unlocks the next level in the sequence (if any).
    if accuracy >= PASS_THRESHOLD and data.level in LEVEL_ORDER:
        idx = LEVEL_ORDER.index(data.level)
        if idx + 1 < len(LEVEL_ORDER):
            _get_or_create(db, user, data.student_id, data.game_key, LEVEL_ORDER[idx + 1], unlocked=True)

    db.commit()
    return [LevelProgressPublic.model_validate(r) for r in _rows(db, user, data.student_id, data.game_key)]
