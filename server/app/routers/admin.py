"""Admin API: authentication, user management and analytics."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import Admin, GameEvent, GameSession, Student, User
from ..scoring import VISIBLE_GAMES, corrected_score, trials_for_game
from ..schemas import (
    AdminAuthResponse,
    AdminLoginRequest,
    AnalyticsSummary,
    EventPublic,
    GameBreakdownItem,
    PaginatedEvents,
    PaginatedStudents,
    PaginatedUsers,
    StudentPublic,
    TimeseriesPoint,
    UserPublic,
    UserUpdate,
)
from ..security import create_admin_token, verify_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@router.post("/login", response_model=AdminAuthResponse)
def admin_login(data: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminAuthResponse:
    admin = db.scalar(select(Admin).where(Admin.email == data.email.lower()))
    if admin is None or not verify_password(data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This admin is disabled.")
    token = create_admin_token(str(admin.id))
    return AdminAuthResponse(access_token=token, email=admin.email)


@router.get("/me")
def admin_me(admin: Admin = Depends(get_current_admin)) -> dict[str, str]:
    return {"id": str(admin.id), "email": admin.email}


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------
@router.get("/users", response_model=PaginatedUsers)
def list_users(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    q: str | None = Query(default=None, description="Search email or name"),
    limit: int = Query(default=50, le=200, ge=1),
    offset: int = Query(default=0, ge=0),
) -> PaginatedUsers:
    stmt = select(User)
    count_stmt = select(func.count(User.id))
    if q:
        like = f"%{q.lower()}%"
        condition = func.lower(User.email).like(like) | func.lower(
            func.coalesce(User.full_name, "")
        ).like(like)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return PaginatedUsers(total=total, items=[UserPublic.model_validate(u) for u in rows])


@router.get("/users/{user_id}", response_model=UserPublic)
def get_user(
    user_id: str, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> UserPublic:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserPublic.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserPublic)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> UserPublic:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserPublic.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    db.delete(user)
    db.commit()


@router.get("/users/{user_id}/events", response_model=PaginatedEvents)
def user_events(
    user_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    limit: int = Query(default=100, le=500, ge=1),
    offset: int = Query(default=0, ge=0),
) -> PaginatedEvents:
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    total = db.scalar(
        select(func.count(GameEvent.id)).where(GameEvent.user_id == user_id)
    ) or 0
    rows = db.scalars(
        select(GameEvent)
        .where(GameEvent.user_id == user_id)
        .order_by(GameEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return PaginatedEvents(total=total, items=[EventPublic.model_validate(e) for e in rows])


# ---------------------------------------------------------------------------
# Student records
# ---------------------------------------------------------------------------
@router.get("/students", response_model=PaginatedStudents)
def list_students(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    q: str | None = Query(default=None, description="Search student name"),
    mentor_id: str | None = Query(default=None, description="Filter by owning mentor"),
    limit: int = Query(default=50, le=200, ge=1),
    offset: int = Query(default=0, ge=0),
) -> PaginatedStudents:
    stmt = select(Student)
    count_stmt = select(func.count(Student.id))
    if q:
        like = f"%{q.lower()}%"
        condition = func.lower(Student.full_name).like(like)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    if mentor_id:
        stmt = stmt.where(Student.mentor_id == mentor_id)
        count_stmt = count_stmt.where(Student.mentor_id == mentor_id)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(Student.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return PaginatedStudents(total=total, items=[StudentPublic.model_validate(s) for s in rows])


@router.get("/students/{student_id}", response_model=StudentPublic)
def get_student(
    student_id: str, db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StudentPublic:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    return StudentPublic.model_validate(student)


@router.get("/students/{student_id}/events", response_model=PaginatedEvents)
def student_events(
    student_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    limit: int = Query(default=100, le=500, ge=1),
    offset: int = Query(default=0, ge=0),
) -> PaginatedEvents:
    if db.get(Student, student_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    total = db.scalar(
        select(func.count(GameEvent.id)).where(GameEvent.student_id == student_id)
    ) or 0
    rows = db.scalars(
        select(GameEvent)
        .where(GameEvent.student_id == student_id)
        .order_by(GameEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return PaginatedEvents(total=total, items=[EventPublic.model_validate(e) for e in rows])


# ---------------------------------------------------------------------------
# Events feed
# ---------------------------------------------------------------------------
@router.get("/events", response_model=PaginatedEvents)
def list_events(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    game_key: str | None = None,
    event_type: str | None = None,
    student_id: str | None = None,
    limit: int = Query(default=100, le=500, ge=1),
    offset: int = Query(default=0, ge=0),
) -> PaginatedEvents:
    stmt = select(GameEvent)
    count_stmt = select(func.count(GameEvent.id))
    if game_key:
        stmt = stmt.where(GameEvent.game_key == game_key)
        count_stmt = count_stmt.where(GameEvent.game_key == game_key)
    if event_type:
        stmt = stmt.where(GameEvent.event_type == event_type)
        count_stmt = count_stmt.where(GameEvent.event_type == event_type)
    if student_id:
        stmt = stmt.where(GameEvent.student_id == student_id)
        count_stmt = count_stmt.where(GameEvent.student_id == student_id)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(GameEvent.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return PaginatedEvents(total=total, items=[EventPublic.model_validate(e) for e in rows])


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@router.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> AnalyticsSummary:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    return AnalyticsSummary(
        total_users=db.scalar(select(func.count(User.id))) or 0,
        active_users=db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
        total_students=db.scalar(select(func.count(Student.id))) or 0,
        total_events=db.scalar(select(func.count(GameEvent.id))) or 0,
        total_sessions=db.scalar(select(func.count(GameSession.id))) or 0,
        events_last_7_days=db.scalar(
            select(func.count(GameEvent.id)).where(GameEvent.created_at >= week_ago)
        )
        or 0,
        new_users_last_7_days=db.scalar(
            select(func.count(User.id)).where(User.created_at >= week_ago)
        )
        or 0,
    )


# Event types the standardised scorer consumes (see app/scoring.py). Pulling
# only these keeps the per-game score query light on large event tables.
SCORING_EVENT_TYPES = ("answer", "roll_return", "place_block", "impatient_tap", "share")


@router.get("/analytics/games", response_model=list[GameBreakdownItem])
def analytics_games(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> list[GameBreakdownItem]:
    # Only games still in the roster (src/types.ts GAME_LIST). Retired games
    # keep their historical events in the table, but the dashboard should show
    # the current line-up, not garden/zebra/emotions/etc.
    rows = db.execute(
        select(
            GameEvent.game_key,
            func.count(GameEvent.id),
            func.count(func.distinct(GameEvent.user_id)),
        )
        .where(GameEvent.game_key.in_(VISIBLE_GAMES))
        .group_by(GameEvent.game_key)
        .order_by(func.count(GameEvent.id).desc())
    ).all()

    # Standardised 0-100 skill score per game: chance-corrected first-attempt
    # accuracy pooled across every player's scoring events. Comparable across
    # games (unlike the raw per-game point tallies), so one column reads the same
    # for a 2-choice quiz and a "wait your turn" scene.
    scoring_events = db.scalars(
        select(GameEvent)
        .where(
            GameEvent.game_key.in_(VISIBLE_GAMES),
            GameEvent.event_type.in_(SCORING_EVENT_TYPES),
        )
        .order_by(GameEvent.created_at.asc())
    ).all()
    by_game: dict[str, list[GameEvent]] = defaultdict(list)
    for e in scoring_events:
        by_game[e.game_key].append(e)
    score_by_game = {
        gk: corrected_score(trials_for_game(gk, evs)) for gk, evs in by_game.items()
    }

    return [
        GameBreakdownItem(
            game_key=row[0],
            event_count=row[1],
            user_count=row[2],
            skill_score=score_by_game.get(row[0]),
        )
        for row in rows
    ]


@router.get("/analytics/timeseries", response_model=list[TimeseriesPoint])
def analytics_timeseries(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    days: int = Query(default=30, ge=1, le=365),
) -> list[TimeseriesPoint]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", GameEvent.created_at)
    rows = db.execute(
        select(
            day.label("day"),
            func.count(GameEvent.id),
            func.count(func.distinct(GameEvent.user_id)),
        )
        .where(GameEvent.created_at >= since)
        .group_by(day)
        .order_by(day)
    ).all()
    return [
        TimeseriesPoint(
            date=row[0].date().isoformat(),
            events=row[1],
            active_users=row[2],
        )
        for row in rows
    ]
