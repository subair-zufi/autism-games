"""Analytics event recording. Every step is stored — but only for logged-in players."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import GameEvent, GameSession, User
from ..schemas import (
    EventBatchCreate,
    EventCreate,
    EventPublic,
    SessionEndRequest,
    SessionPublic,
    SessionStartRequest,
)
from .students import resolve_owned_student

router = APIRouter(prefix="/api", tags=["events"])


def _persist_event(db: Session, user: User, data: EventCreate) -> GameEvent:
    if data.session_id is not None:
        session = db.get(GameSession, data.session_id)
        if session is None or session.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
            )
    if data.student_id is not None:
        # Ensure the student belongs to this mentor (raises 404 otherwise).
        resolve_owned_student(db, user, data.student_id)
    event = GameEvent(
        user_id=user.id,
        student_id=data.student_id,
        session_id=data.session_id,
        game_key=data.game_key,
        event_type=data.event_type,
        step_index=data.step_index,
        score=data.score,
        payload=data.payload,
        client_timestamp=data.client_timestamp,
    )
    db.add(event)
    return event


@router.post("/sessions", response_model=SessionPublic, status_code=status.HTTP_201_CREATED)
def start_session(
    data: SessionStartRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionPublic:
    """Open a play session so a run of steps can be grouped together (optional)."""
    if data.student_id is not None:
        resolve_owned_student(db, user, data.student_id)
    session = GameSession(user_id=user.id, student_id=data.student_id, game_key=data.game_key)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionPublic.model_validate(session)


@router.post("/sessions/{session_id}/end", response_model=SessionPublic)
def end_session(
    session_id: str,
    data: SessionEndRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionPublic:
    session = db.get(GameSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    session.ended_at = datetime.now(timezone.utc)
    if data.final_score is not None:
        session.final_score = data.final_score
    db.commit()
    db.refresh(session)
    return SessionPublic.model_validate(session)


@router.post("/events", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
def record_event(
    data: EventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EventPublic:
    """Record a single game step. Requires a valid player token."""
    event = _persist_event(db, user, data)
    db.commit()
    db.refresh(event)
    return EventPublic.model_validate(event)


@router.post("/events/batch", status_code=status.HTTP_201_CREATED)
def record_events_batch(
    data: EventBatchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Record many steps at once (useful for buffered/offline play)."""
    for item in data.events:
        _persist_event(db, user, item)
    db.commit()
    return {"recorded": len(data.events)}
