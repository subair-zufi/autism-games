"""Student management for mentors.

A mentor (the logged-in :class:`User`) adds and edits the students they play
on behalf of. All endpoints are scoped to the current mentor — a mentor can
only ever see or touch their own students.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Student, User, participant_code_seq
from ..schemas import StudentCreate, StudentPublic, StudentUpdate

router = APIRouter(prefix="/api/students", tags=["students"])


def resolve_owned_student(
    db: Session, user: User, student_id: uuid.UUID
) -> Student:
    """Return the student if it exists and belongs to ``user``, else 404.

    Shared with the events router so a mentor can only attach their own
    students to sessions/events.
    """
    student = db.get(Student, student_id)
    if student is None or student.mentor_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return student


@router.get("", response_model=list[StudentPublic])
def list_students(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    include_inactive: bool = Query(default=False),
) -> list[StudentPublic]:
    """List the current mentor's students (used by the switch-student picker)."""
    stmt = select(Student).where(Student.mentor_id == user.id)
    if not include_inactive:
        stmt = stmt.where(Student.is_active.is_(True))
    rows = db.scalars(stmt.order_by(Student.created_at.asc())).all()
    return [StudentPublic.model_validate(s) for s in rows]


#: How many times a create retries when two mentors are issued the same code at
#: the same instant. The unique index is what actually prevents the duplicate;
#: this just gives the loser a fresh number instead of an error.
_CODE_RETRIES = 5


def next_participant_code(db: Session) -> str:
    """The next free code for this year, like ``P-2024-001``.

    Numbered across the whole study rather than per mentor. Per-mentor numbering
    gave every mentor account its own ``P-<year>-001``, so as soon as two
    facilitators signed in under separate logins their first two children shared
    a code — and the code is what every export is joined on.

    The number comes from a sequence, so it is never handed out twice — not
    after a participant is removed from the console, and not across a year
    boundary. Counting existing rows would reuse a withdrawn child's code, and
    an ASSP or battery score imported under that code would then be filed
    against the wrong child.
    """
    n = db.scalar(select(participant_code_seq.next_value()))
    year = datetime.now(timezone.utc).year
    return f"P-{year}-{n:03d}"


@router.post("", response_model=StudentPublic, status_code=status.HTTP_201_CREATED)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StudentPublic:
    """Add a student under the current mentor.

    Retries on a code collision: two facilitators enrolling a child at the same
    moment both read the same highest number, and the unique index lets only one
    of them keep it. The other is issued the next code rather than shown an
    error in front of a family.
    """
    fields = data.model_dump()
    for attempt in range(_CODE_RETRIES):
        student = Student(
            mentor_id=user.id,
            participant_code=next_participant_code(db),
            **fields,
        )
        db.add(student)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if attempt == _CODE_RETRIES - 1:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not allocate a participant code. Please try again.",
                )
            continue
        db.refresh(student)
        return StudentPublic.model_validate(student)
    raise AssertionError("unreachable")  # pragma: no cover


@router.get("/{student_id}", response_model=StudentPublic)
def get_student(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StudentPublic:
    return StudentPublic.model_validate(resolve_owned_student(db, user, student_id))


@router.patch("/{student_id}", response_model=StudentPublic)
def update_student(
    student_id: uuid.UUID,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StudentPublic:
    """Edit a student (name, dob, notes, avatar, active flag)."""
    student = resolve_owned_student(db, user, student_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.commit()
    db.refresh(student)
    return StudentPublic.model_validate(student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Delete a student. Their past events/sessions are kept but detached
    (``student_id`` is set to NULL)."""
    student = resolve_owned_student(db, user, student_id)
    db.delete(student)
    db.commit()
