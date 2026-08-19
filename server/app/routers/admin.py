"""Admin API: authentication, user management and analytics."""
import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    Admin,
    AssessmentScore,
    GameEvent,
    GameSession,
    LevelProgress,
    Student,
    User,
)
from ..scoring import (
    SKILL_BY_GAME,
    VISIBLE_GAMES,
    ParticipantScores,
    age_band,
    age_years,
    corrected_score,
    dose_summary,
    iq_band,
    ordered_payload_columns,
    raw_payload_columns,
    score_participant,
    student_trial_records,
    trials_for_game,
)
from ..schemas import (
    AdminAuthResponse,
    AdminLoginRequest,
    AnalyticsSummary,
    AssessmentImportRequest,
    AssessmentImportResult,
    EventPublic,
    GameBreakdownItem,
    PaginatedEvents,
    PaginatedStudents,
    PaginatedUsers,
    SkillScoreOut,
    StudentOverviewItem,
    StudentProfileOut,
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


def _overview_row(
    s: Student,
    mentor_email: str | None,
    events: list[GameEvent],
    today: date,
    scores: ParticipantScores | None = None,
) -> StudentOverviewItem:
    """One participant row: the full record plus their headline scores.

    ``scores`` lets a caller that has already run the scorer pass it in rather
    than paying for a second pass.
    """
    ps = scores if scores is not None else score_participant(events)
    return StudentOverviewItem(
        student_id=s.id,
        participant_code=s.participant_code,
        full_name=s.full_name,
        mentor_email=mentor_email,
        gender=s.gender,
        date_of_birth=s.date_of_birth,
        age_years=age_years(s.date_of_birth, today),
        autism_level=s.autism_level,
        iq_score=s.iq_score,
        rehabilitation_centre=s.rehabilitation_centre,
        parent_guardian_name=s.parent_guardian_name,
        parent_contact=s.parent_contact,
        notes=s.notes,
        is_active=s.is_active,
        created_at=s.created_at,
        n_sessions=ps.n_sessions,
        n_trials=ps.n_trials,
        composite=ps.composite,
        composite_delta=ps.composite_delta,
        last_played=max((e.created_at for e in events), default=None),
    )


# NOTE: must stay above /students/{student_id} — FastAPI matches in definition
# order, and that route takes a plain `str`, so it would otherwise swallow
# "overview" as a student id and 404.
@router.get("/students/overview", response_model=list[StudentOverviewItem])
def students_overview(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
    limit: int = Query(default=200, le=500, ge=1),
) -> list[StudentOverviewItem]:
    """Per-participant scores — the child-level view the dashboard was missing.

    Every other dashboard panel aggregates by mentor account or by game, so a
    participant who has played is invisible there. This reduces each child's own
    event stream with the same scorer the mentor-facing reports use, so the
    dashboard and the app agree.
    """
    students = db.scalars(
        select(Student).order_by(Student.created_at.asc()).limit(limit)
    ).all()
    if not students:
        return []

    mentor_emails = {
        u.id: u.email
        for u in db.scalars(
            select(User).where(User.id.in_({s.mentor_id for s in students}))
        ).all()
    }

    # One pass over the events for these children, bucketed in Python — cheaper
    # than a per-student query and keeps the scorer's "whole stream" contract.
    events = db.scalars(
        select(GameEvent)
        .where(GameEvent.student_id.in_([s.id for s in students]))
        .order_by(GameEvent.created_at.asc())
    ).all()
    by_student: dict[object, list[GameEvent]] = defaultdict(list)
    for e in events:
        by_student[e.student_id].append(e)

    today = date.today()
    return [
        _overview_row(
            s,
            mentor_emails.get(s.mentor_id),
            by_student.get(s.id, []),
            today,
        )
        for s in students
    ]


@router.get("/students/{student_id}/profile", response_model=StudentProfileOut)
def student_profile(
    student_id: str,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> StudentProfileOut:
    """Everything held on one child, for the expanded dashboard row.

    Kept separate from the overview so listing a large cohort stays cheap: the
    per-game breakdown is only assembled for the participant actually opened.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    events = db.scalars(
        select(GameEvent)
        .where(GameEvent.student_id == student.id)
        .order_by(GameEvent.created_at.asc())
    ).all()
    mentor = db.get(User, student.mentor_id)
    ps = score_participant(events)
    return StudentProfileOut(
        student=_overview_row(
            student, mentor.email if mentor else None, events, date.today(), scores=ps
        ),
        # SkillScore.as_dict() already matches SkillScoreOut field-for-field.
        skills=[SkillScoreOut.model_validate(s.as_dict()) for s in ps.skills],
    )


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


# ---------------------------------------------------------------------------
# Research data export
# ---------------------------------------------------------------------------
# De-identified participant columns prefixed on every export: participant_code +
# opaque student_id, never the child's name.
DEMO_COLUMNS = (
    "participant_code",
    "student_id",
    "gender",
    "age_years",
    "age_band",
    "autism_level",
    "iq_score",
    "iq_band",
)


def _c(v: object) -> object:
    """Render None as an empty CSV cell; pass everything else through."""
    return "" if v is None else v


def _demo_row(s: Student, today: date) -> list[object]:
    yrs = age_years(s.date_of_birth, today)
    return [
        s.participant_code or "",
        str(s.id),
        s.gender or "",
        _c(yrs),
        age_band(s.date_of_birth, today),
        s.autism_level or "",
        _c(s.iq_score),
        iq_band(s.iq_score),
    ]


def _csv_response(columns, rows, filename: str) -> StreamingResponse:
    """Stream a header + pre-materialised rows as an attachment. Rows are built
    while the DB session is open, so the generator never touches a closed one."""

    def stream():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for row in rows:
            writer.writerow(row)
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        stream(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _csv_bytes(columns, rows) -> bytes:
    """Materialise a header + rows as UTF-8 CSV bytes (for bundling into a ZIP)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


# Fixed (non-payload) columns for the raw event dump. Everything after these is
# a flattened payload key. Raw participant attributes are joined on for merging;
# no derived/banded fields (compute age/bands/scores yourself in SPSS/R).
RAW_FIXED_COLUMNS = (
    "event_id",
    "participant_code",
    "student_id",
    "user_id",
    "session_id",
    "game_key",
    "event_type",
    "step_index",
    "event_score",  # the GameEvent.score column (game_over final tally); payload `score` is separate
    "client_timestamp",
    "created_at",
    "gender",
    "date_of_birth",
    "autism_level",
    "iq_score",
)


def _raw_cell(v: object) -> object:
    """Render a payload value for a raw CSV cell: None → empty, booleans → 1/0,
    nested → JSON, everything else verbatim.

    Booleans are coerced to 1/0 so the export imports as numeric in SPSS/R (a
    bare ``True``/``False`` reads as a string and would force a categorical
    recode on every boolean field). This matches the trial-level export
    (``_bool_int``) and the synthetic preview dataset, so a pipeline built on
    the sample keeps working on the live export. ``bool`` is checked before the
    numeric passthrough because ``bool`` is a subclass of ``int``."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def _events_raw_table(db: Session) -> tuple[list[str], list[list[object]]]:
    """(columns, rows) for the raw event dump — one row per recorded event, every
    payload field flattened to its own column, nothing scored, filtered, banded
    or aggregated. All event types and all games (including retired ones) are
    included; only mentor-only play with no participant attached is left out."""
    students = {s.id: s for s in db.scalars(select(Student)).all()}
    events = db.scalars(
        select(GameEvent)
        .where(GameEvent.student_id.isnot(None))
        .order_by(GameEvent.created_at.asc())
    ).all()

    payload_cols = ordered_payload_columns(events)
    columns = list(RAW_FIXED_COLUMNS) + payload_cols

    rows: list[list[object]] = []
    for e in events:
        s = students.get(e.student_id)
        p = e.payload if isinstance(e.payload, dict) else {}
        rows.append(
            [
                str(e.id),
                (s.participant_code if s else "") or "",
                str(e.student_id) if e.student_id else "",
                str(e.user_id) if e.user_id else "",
                str(e.session_id) if e.session_id else "",
                e.game_key,
                e.event_type,
                _c(e.step_index),
                _c(e.score),
                e.client_timestamp.isoformat() if e.client_timestamp else "",
                e.created_at.isoformat() if e.created_at else "",
                (s.gender if s else "") or "",
                s.date_of_birth.isoformat() if s and s.date_of_birth else "",
                (s.autism_level if s else "") or "",
                _c(s.iq_score if s else None),
            ]
            + [_raw_cell(p.get(k)) for k in payload_cols]
        )
    return columns, rows


@router.get("/export/events_raw.csv")
def export_events_raw_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """RAW event dump for external analysis — one row per recorded event, every
    payload field flattened to its own column, nothing scored, filtered, banded
    or aggregated. This is the source data for SPSS/R: define your own scoring,
    first-attempt rules and groupings from it."""
    columns, rows = _events_raw_table(db)
    return _csv_response(columns, rows, f"events_raw_{date.today().isoformat()}.csv")


TRIAL_CSV_COLUMNS = DEMO_COLUMNS + (
    "skill",
    "game_key",
    "xr_presenting",  # 1 = immersive VR, 0 = flat screen (same game, two conditions)
    "session_id",
    "trial_in_game",
    "trial_in_session",
    "first_attempt_correct",
    "chance",
    "latency_ms",
    "latency_from_prompt_end_ms",  # cleaner RT (excludes spoken-prompt time)
    "hinted",
    "construct",  # social-norms sub-skill
    "cue",  # joint-attention cue type
    "visible_count",  # options on screen (pointing games)
    "head_yaw_travel_deg",  # VR scan-path length
    "head_yaw_range_deg",  # VR widest span visited
    "head_reversals",  # VR back-and-forth (hesitation)
    "head_to_target_ms",  # VR time until head first on target
    "timestamp",
)


@router.get("/export/trials.csv")
def export_trials_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Trial-level CSV across every participant, for external analysis (R/SPSS).

    One row per scored trial — the same unit the standardised skill score is
    built from — tagged with demographics, the target skill/game, the VR-vs-flat
    condition, and the process fields (latency, prompt-end latency, hint use,
    construct/cue, head-scan telemetry) needed for mechanism analyses. Retired
    games and mentor-only play (no participant attached) are excluded.
    """
    today = date.today()
    students = db.scalars(select(Student).order_by(Student.created_at.asc())).all()

    rows: list[list[object]] = []
    for s in students:
        events = db.scalars(
            select(GameEvent)
            .where(GameEvent.student_id == s.id)
            .order_by(GameEvent.created_at.asc())
        ).all()
        records = student_trial_records(events)
        if not records:
            continue
        demo = _demo_row(s, today)
        for r in records:
            rows.append(
                demo
                + [
                    r.skill,
                    r.game_key,
                    _c(r.xr_presenting),
                    r.session_id or "",
                    r.trial_in_game,
                    r.trial_in_session,
                    r.first_attempt_correct,
                    r.chance,
                    _c(r.latency_ms),
                    _c(r.latency_from_prompt_end_ms),
                    _c(r.hinted),
                    r.construct,
                    r.cue,
                    _c(r.visible_count),
                    _c(r.head_yaw_travel_deg),
                    _c(r.head_yaw_range_deg),
                    _c(r.head_reversals),
                    _c(r.head_to_target_ms),
                    r.ts.isoformat(),
                ]
            )

    return _csv_response(TRIAL_CSV_COLUMNS, rows, f"trials_{today.isoformat()}.csv")


DOSE_CSV_COLUMNS = DEMO_COLUMNS + (
    "skill",
    "game_key",
    "n_sessions",
    "n_scored_trials",
    "total_minutes",
    "first_session",
    "last_session",
    "span_days",
    "median_gap_days",
)


@router.get("/export/dose.csv")
def export_dose_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Exposure/dose CSV: one row per participant × game, with session count,
    scored-trial count, total play minutes, first/last play dates, calendar span
    and typical spacing — the predictors for dose-response and retention
    analyses. Retired games are excluded."""
    today = date.today()
    students = db.scalars(select(Student).order_by(Student.created_at.asc())).all()

    rows: list[list[object]] = []
    for s in students:
        sessions = db.scalars(
            select(GameSession).where(GameSession.student_id == s.id)
        ).all()
        events = db.scalars(
            select(GameEvent)
            .where(GameEvent.student_id == s.id)
            .order_by(GameEvent.created_at.asc())
        ).all()
        trials_by_game: dict[str, int] = defaultdict(int)
        for r in student_trial_records(events):
            trials_by_game[r.game_key] += 1
        spans_by_game: dict[str, list] = defaultdict(list)
        for sess in sessions:
            if sess.game_key in SKILL_BY_GAME:  # roster games only
                spans_by_game[sess.game_key].append((sess.started_at, sess.ended_at))

        game_keys = sorted(set(trials_by_game) | set(spans_by_game))
        if not game_keys:
            continue
        demo = _demo_row(s, today)
        for game in game_keys:
            d = dose_summary(spans_by_game.get(game, []))
            rows.append(
                demo
                + [
                    SKILL_BY_GAME.get(game, ""),
                    game,
                    d.n_sessions,
                    trials_by_game.get(game, 0),
                    _c(d.total_minutes),
                    d.first_session.date().isoformat() if d.first_session else "",
                    d.last_session.date().isoformat() if d.last_session else "",
                    _c(d.span_days),
                    _c(d.median_gap_days),
                ]
            )

    return _csv_response(DOSE_CSV_COLUMNS, rows, f"dose_{today.isoformat()}.csv")


# ---------------------------------------------------------------------------
# Raw session dump — one row per play session
# ---------------------------------------------------------------------------
# Raw, un-banded participant attributes are joined on for merging (compute
# age/bands yourself), mirroring the raw event dump rather than the derived
# exports. Session timing is otherwise only available aggregated in dose.csv.
SESSIONS_CSV_COLUMNS = (
    "session_id",
    "participant_code",
    "student_id",
    "user_id",
    "game_key",
    "started_at",
    "ended_at",
    "duration_s",  # ended_at - started_at in seconds; blank if the session never closed
    "final_score",  # GameSession.final_score (raw per-game tally, not the standardised score)
    "n_events",  # recorded events attached to this session
    "gender",
    "date_of_birth",
    "autism_level",
    "iq_score",
)


def _sessions_table(db: Session) -> tuple[list[str], list[list[object]]]:
    """(columns, rows) for the raw session dump — one row per play session,
    nothing scored or aggregated. Complements the raw event dump (which carries
    ``session_id`` but not the session's own clock). All games (including retired
    ones) are included; only mentor-only play with no participant is left out."""
    students = {s.id: s for s in db.scalars(select(Student)).all()}
    sessions = db.scalars(
        select(GameSession)
        .where(GameSession.student_id.isnot(None))
        .order_by(GameSession.started_at.asc())
    ).all()

    # One grouped pass for the per-session event counts rather than a query each.
    counts = dict(
        db.execute(
            select(GameEvent.session_id, func.count(GameEvent.id))
            .where(GameEvent.session_id.isnot(None))
            .group_by(GameEvent.session_id)
        ).all()
    )

    rows: list[list[object]] = []
    for sess in sessions:
        s = students.get(sess.student_id)
        duration = (
            round((sess.ended_at - sess.started_at).total_seconds())
            if sess.ended_at is not None and sess.started_at is not None
            else None
        )
        rows.append(
            [
                str(sess.id),
                (s.participant_code if s else "") or "",
                str(sess.student_id) if sess.student_id else "",
                str(sess.user_id) if sess.user_id else "",
                sess.game_key,
                sess.started_at.isoformat() if sess.started_at else "",
                sess.ended_at.isoformat() if sess.ended_at else "",
                _c(duration),
                _c(sess.final_score),
                counts.get(sess.id, 0),
                (s.gender if s else "") or "",
                s.date_of_birth.isoformat() if s and s.date_of_birth else "",
                (s.autism_level if s else "") or "",
                _c(s.iq_score if s else None),
            ]
        )
    return list(SESSIONS_CSV_COLUMNS), rows


@router.get("/export/sessions.csv")
def export_sessions_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """RAW session dump — one row per play session, nothing scored or aggregated.
    Join to the raw event dump on ``session_id`` to place each event in its
    session, or use alone for session-level timing/duration."""
    columns, rows = _sessions_table(db)
    return _csv_response(columns, rows, f"sessions_{date.today().isoformat()}.csv")


# ---------------------------------------------------------------------------
# Raw level-progression dump — one row per (participant × game × level)
# ---------------------------------------------------------------------------
LEVEL_PROGRESS_CSV_COLUMNS = (
    "participant_code",
    "student_id",
    "user_id",
    "game_key",
    "level",
    "attempts",
    "best_score",
    "best_accuracy",  # 0-1, uncorrected
    "unlocked",  # 1/0
    "passed",  # 1/0 (best_accuracy >= 70%)
    "mastered",  # 1/0 (best_accuracy >= 80%)
    "created_at",
    "updated_at",
    "gender",
    "date_of_birth",
    "autism_level",
    "iq_score",
)


def _level_progress_table(db: Session) -> tuple[list[str], list[list[object]]]:
    """(columns, rows) for the raw level-progression dump — one row per
    (participant × game × level): attempts, best score/accuracy, unlock/pass/
    master flags (1/0), verbatim from ``level_progress``. Only progress attached
    to a participant is included (mentor-only play is left out)."""
    students = {s.id: s for s in db.scalars(select(Student)).all()}
    rows_q = db.scalars(
        select(LevelProgress)
        .where(LevelProgress.student_id.isnot(None))
        .order_by(LevelProgress.created_at.asc())
    ).all()

    rows: list[list[object]] = []
    for lp in rows_q:
        s = students.get(lp.student_id)
        rows.append(
            [
                (s.participant_code if s else "") or "",
                str(lp.student_id) if lp.student_id else "",
                str(lp.user_id) if lp.user_id else "",
                lp.game_key,
                lp.level,
                lp.attempts,
                lp.best_score,
                lp.best_accuracy,
                int(lp.unlocked),
                int(lp.passed),
                int(lp.mastered),
                lp.created_at.isoformat() if lp.created_at else "",
                lp.updated_at.isoformat() if lp.updated_at else "",
                (s.gender if s else "") or "",
                s.date_of_birth.isoformat() if s and s.date_of_birth else "",
                (s.autism_level if s else "") or "",
                _c(s.iq_score if s else None),
            ]
        )
    return list(LEVEL_PROGRESS_CSV_COLUMNS), rows


@router.get("/export/level_progress.csv")
def export_level_progress_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """RAW level-progression dump — one row per (participant × game × level).

    The saved progression state (attempts, best score/accuracy, unlock/pass/
    master flags) for the level-based games, verbatim from ``level_progress``.
    Booleans export as 1/0. Only progress attached to a participant is included
    (mentor-only play is left out)."""
    columns, rows = _level_progress_table(db)
    return _csv_response(
        columns, rows, f"level_progress_{date.today().isoformat()}.csv"
    )


# ---------------------------------------------------------------------------
# Participant roster + codebook + bundled "all raw" download
# ---------------------------------------------------------------------------
PARTICIPANTS_CSV_COLUMNS = (
    "participant_code",
    "student_id",
    "gender",
    "age_years",
    "age_band",
    "date_of_birth",
    "autism_level",
    "iq_score",
    "iq_band",
    "rehabilitation_centre",
    "is_active",  # 1/0
    "created_at",
)


def _participants_table(db: Session) -> tuple[list[str], list[list[object]]]:
    """(columns, rows) for the de-identified participant roster — one row per
    child with demographics/covariates (no name or contact). The merge key for
    every other export is ``participant_code`` / ``student_id``."""
    today = date.today()
    students = db.scalars(select(Student).order_by(Student.created_at.asc())).all()
    rows = [
        [
            s.participant_code or "",
            str(s.id),
            s.gender or "",
            _c(age_years(s.date_of_birth, today)),
            age_band(s.date_of_birth, today),
            s.date_of_birth.isoformat() if s.date_of_birth else "",
            s.autism_level or "",
            _c(s.iq_score),
            iq_band(s.iq_score),
            s.rehabilitation_centre or "",
            int(s.is_active),
            s.created_at.isoformat() if s.created_at else "",
        ]
        for s in students
    ]
    return list(PARTICIPANTS_CSV_COLUMNS), rows


@router.get("/export/participants.csv")
def export_participants_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """De-identified participant roster (demographics/covariates only — no name
    or contact). Join every other export to it on ``participant_code``."""
    columns, rows = _participants_table(db)
    return _csv_response(columns, rows, f"participants_{date.today().isoformat()}.csv")


# A curated data dictionary for the raw exports. Each entry documents one column
# (fixed columns and the payload/process fields that flatten into raw_events).
# `appears_in` names the export(s) the variable shows up in; `type` uses SPSS-
# friendly shorthands (id/string/int/float/bool01/datetime/date). Any payload
# key seen in the live data but missing here is appended at export time so the
# codebook never silently omits a recorded field.
CODEBOOK_CSV_COLUMNS = ("variable", "appears_in", "type", "unit", "values", "description")

_CODEBOOK: tuple[tuple[str, str, str, str, str, str], ...] = (
    # --- identifiers & keys ---
    ("event_id", "raw_events", "id", "", "UUID", "Unique id of the recorded event row."),
    ("session_id", "raw_events,sessions", "id", "", "", "Play-session id; join raw_events to sessions on this."),
    ("participant_code", "all", "id", "", "e.g. P-2024-001", "Pseudonymous participant code; the primary analysis key."),
    ("student_id", "all", "id", "", "UUID", "Opaque participant id; stable join key across exports."),
    ("user_id", "raw_events,sessions,level_progress", "id", "", "UUID", "Owning mentor/account id."),
    # --- demographics / covariates ---
    ("gender", "all", "string", "", "M | F | Other (as entered)", "Participant gender as entered on the form."),
    ("date_of_birth", "all", "date", "", "YYYY-MM-DD", "Participant date of birth."),
    ("age_years", "participants,trials,dose", "int", "years", "", "Whole years at export date (derived)."),
    ("age_band", "participants,trials,dose", "string", "", "under 8 | 8-10 | 11-12 | 13-15 | 16+", "Coarse age band (derived)."),
    ("autism_level", "all", "string", "", "Level 1 | Level 2 | Level 3", "DSM-5 autism support level as entered."),
    ("iq_score", "all", "int", "", "", "IQ score as entered (no instrument/date recorded)."),
    ("iq_band", "participants,trials,dose", "string", "", "<70 | 70-84 | 85-99 | 100+", "Coarse IQ band (derived)."),
    ("rehabilitation_centre", "participants", "string", "", "", "Centre name as entered."),
    ("is_active", "participants", "bool01", "", "1 | 0", "Whether the participant record is active."),
    ("created_at", "participants,level_progress", "datetime", "", "ISO 8601", "Row creation time (server, UTC)."),
    # --- event fixed columns ---
    ("game_key", "raw_events,sessions,level_progress,trials,dose", "string", "", "", "Game identifier (e.g. emotionrecognition, museum360)."),
    ("event_type", "raw_events", "string", "", "answer | roll_return | place_block | hand_off | impatient_tap | share | no_share | game_over | …", "The kind of step recorded."),
    ("step_index", "raw_events", "int", "count", "", "0-based order of the step within its session."),
    ("event_score", "raw_events", "int", "points", "", "GameEvent.score — running/final game tally on the event (distinct from payload 'score')."),
    ("client_timestamp", "raw_events", "datetime", "", "ISO 8601", "Client-reported event time (optional)."),
    ("created_at (event)", "raw_events", "datetime", "", "ISO 8601", "Authoritative server time the event was stored."),
    # --- session columns ---
    ("started_at", "sessions", "datetime", "", "ISO 8601", "Session start time."),
    ("ended_at", "sessions", "datetime", "", "ISO 8601", "Session end time (blank if never closed)."),
    ("duration_s", "sessions", "int", "seconds", "", "ended_at − started_at (blank if the session never closed)."),
    ("final_score", "sessions", "int", "points", "", "Session final tally (raw per-game, not the standardised score)."),
    ("n_events", "sessions", "int", "count", "", "Number of recorded events attached to the session."),
    # --- level_progress columns ---
    ("level", "level_progress,raw_events(payload)", "string", "", "easy | medium | hard", "Difficulty tier."),
    ("attempts", "level_progress", "int", "count", "", "Times this level was attempted."),
    ("best_score", "level_progress", "int", "points", "", "Best raw score achieved on the level."),
    ("best_accuracy", "level_progress", "float", "0-1", "", "Best uncorrected accuracy on the level."),
    ("unlocked", "level_progress", "bool01", "", "1 | 0", "Whether the level is unlocked."),
    ("passed", "level_progress", "bool01", "", "1 | 0", "best_accuracy ≥ 70%."),
    ("mastered", "level_progress", "bool01", "", "1 | 0", "best_accuracy ≥ 80%."),
    ("updated_at", "level_progress", "datetime", "", "ISO 8601", "Last time the progress row changed."),
    # --- payload: outcome / accuracy ---
    ("correct", "raw_events", "bool01", "", "1 | 0", "Whether the response was correct."),
    ("firstAttempt", "raw_events", "bool01", "", "1 | 0", "First-attempt success (pointing/roll games close a round on a correct tap)."),
    ("attempt", "raw_events", "int", "count", "", "Attempt number (retry-allowed games; 1 = first attempt)."),
    ("chance", "raw_events", "float", "0-1", "", "Guessing baseline c for the trial (1/n options)."),
    ("visibleCount", "raw_events", "int", "count", "", "Options on screen (pointing games) → chance = 1/visibleCount."),
    ("boardCount", "raw_events", "int", "count", "", "Answer options presented (quiz games)."),
    # --- payload: latency / process ---
    ("latencyMs", "raw_events", "int", "ms", "", "Response latency; INCLUDES spoken-prompt time — avoid for RT claims."),
    ("latencyFromPromptEndMs", "raw_events", "int", "ms", "", "Clean RT from TTS onend (subset of games only)."),
    ("hinted", "raw_events", "bool01", "", "1 | 0", "A hint had fired before the answer."),
    # --- payload: condition / construct ---
    ("difficulty", "raw_events", "string", "", "easy | medium | hard", "Difficulty tier (VR copies record the level under this name)."),
    ("construct", "raw_events", "string", "", "greetings | sharing | turns | space | politeness | helping | comforting | inclusion | fairness", "Social-norms sub-skill the item measures."),
    ("cue", "raw_events", "string", "", "verbal | gesture | orient | pulse | hover | distal", "Joint-attention / roll cue level."),
    ("cueKind", "raw_events", "string", "", "gesture | gaze", "Cue modality (museum/JA)."),
    ("answer", "raw_events", "string", "", "happy | sad | angry | surprised | scared | disgust", "Emotion shown (emotion games)."),
    ("picked", "raw_events", "string", "", "", "Option/emotion the child chose."),
    ("spontaneous", "raw_events", "bool01", "", "1 | 0", "Share completed before any helper nudge (initiating JA)."),
    ("nudges", "raw_events", "int", "count", "", "Helper nudges fired before a share."),
    ("saliency", "raw_events", "string", "", "big | subtle", "Surprise salience (initiating-JA games)."),
    ("discovery", "raw_events", "string", "", "", "Surprise/target id (discovery/park)."),
    ("found", "raw_events", "int", "count", "", "Round index within a museum session."),
    # --- payload: display / input condition ---
    ("xrPresenting", "raw_events", "bool01", "", "1 = VR | 0 = flat", "Immersive VR vs flat screen (same game, two conditions)."),
    ("inputMethod", "raw_events", "string", "", "dwell | controller", "Selection method — dwell (gaze) answers cannot arrive faster than the dwell time; never pool with controller."),
    ("headYawContaminated", "raw_events", "bool01", "", "1 | 0", "JA-in-VR trial where head yaw is instrumental (aiming), not shared attention — exclude/adjust."),
    ("pageHiddenMs", "raw_events", "int", "ms", "", "Time in this trial the page was hidden (tab switch / headset off) — exclude long ones."),
    ("pageHideCount", "raw_events", "int", "count", "", "Separate times the page went hidden during the trial."),
    ("pageWasHidden", "raw_events", "bool01", "", "1 | 0", "Any non-zero hidden time in the trial."),
    # --- payload: VR head-scan telemetry (VR games only) ---
    ("targetBearingDeg", "raw_events", "float", "deg", "", "Angle of the target from screen centre."),
    ("headStartYawDeg", "raw_events", "float", "deg", "", "Head yaw at trial onset."),
    ("headEndYawDeg", "raw_events", "float", "deg", "", "Head yaw when the answer was given."),
    ("headYawTravelDeg", "raw_events", "float", "deg", "", "Total head-scan path length (VR)."),
    ("headYawRangeDeg", "raw_events", "float", "deg", "", "Widest yaw span visited (VR)."),
    ("headReversals", "raw_events", "int", "count", "", "Back-and-forth head reversals — hesitation (VR)."),
    ("headSamples", "raw_events", "int", "count", "", "Head-pose samples logged for the trial (VR)."),
    ("headMinPitchDeg", "raw_events", "float", "deg", "", "Lowest head pitch visited (VR)."),
    ("headMaxPitchDeg", "raw_events", "float", "deg", "", "Highest head pitch visited (VR)."),
    ("headToTargetMs", "raw_events", "int", "ms", "", "Time until the head first pointed at the target (VR)."),
    # --- payload: bookkeeping ---
    ("round", "raw_events", "int", "count", "", "Round index within a game session."),
    ("slot", "raw_events", "int", "count", "", "Turn slot (turn-taking games)."),
    ("count", "raw_events", "int", "count", "", "Generic count field (nudges/taps)."),
    ("target", "raw_events", "string", "", "", "Target object/partner id."),
    ("method", "raw_events", "string", "", "tap | button", "How the action was made."),
    ("source", "raw_events", "string", "", "", "Origin of a tap/action."),
    ("kind", "raw_events", "string", "", "", "Event sub-kind (e.g. whoFeels, share)."),
    ("clip", "raw_events", "string", "", "", "Emotion-clip id (Emotion Clips)."),
    ("freezeKind", "raw_events", "string", "", "peak | …", "Freeze-frame kind (Emotion Clips)."),
    ("errorType", "raw_events", "string", "", "adjacent | …", "Mis-tap error classification (pointing games)."),
    ("during", "raw_events", "string", "", "peer-turn | …", "Phase an impatient tap occurred in."),
)


def _codebook_table(db: Session) -> tuple[list[str], list[list[object]]]:
    """(columns, rows) for the data dictionary. Starts from the curated set and
    appends any live payload key not documented there, so the codebook always
    covers what the raw export actually contains."""
    rows: list[list[object]] = [list(r) for r in _CODEBOOK]
    documented = {
        r[0].split(" ")[0] for r in _CODEBOOK  # strip disambiguating suffixes like "(payload)"
    }
    events = db.scalars(select(GameEvent).where(GameEvent.student_id.isnot(None))).all()
    for key in raw_payload_columns(events):
        if key not in documented:
            rows.append(
                [key, "raw_events", "", "", "", "Undocumented payload field — recorded verbatim; see the game's logic.ts."]
            )
    return list(CODEBOOK_CSV_COLUMNS), rows


@router.get("/export/codebook.csv")
def export_codebook_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Data dictionary for the raw exports — one row per variable (fixed columns
    and flattened payload/process fields) with type, unit and value meanings, so
    an SPSS/R import is self-documenting."""
    columns, rows = _codebook_table(db)
    return _csv_response(columns, rows, "codebook.csv")


@router.get("/export/all.zip")
def export_all_zip(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Every raw game-metrics export plus the roster and codebook, bundled as one
    ZIP: participants, raw events, sessions, level progress and the data
    dictionary — all keyed by participant_code / student_id."""
    today = date.today().isoformat()
    datasets = [
        (f"participants_{today}.csv", _participants_table(db)),
        (f"events_raw_{today}.csv", _events_raw_table(db)),
        (f"sessions_{today}.csv", _sessions_table(db)),
        (f"level_progress_{today}.csv", _level_progress_table(db)),
        ("codebook.csv", _codebook_table(db)),
    ]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, (columns, rows) in datasets:
            zf.writestr(filename, _csv_bytes(columns, rows))
    payload = buf.getvalue()
    return StreamingResponse(
        iter([payload]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="autism_games_raw_{today}.zip"'},
    )


# ---------------------------------------------------------------------------
# Outcome battery (blinded pre/post scores) — CSV round-trip
# ---------------------------------------------------------------------------
ASSESSMENT_CSV_COLUMNS = (
    "participant_code",
    "timepoint",  # pre | post | followup
    "instrument",  # EIT | TOP | JAP | NCT | VSMS | ATEC | ...
    "form",  # A | B (parallel forms), else blank
    "raw_score",
    "n_options",  # forced-choice options → chance = 1/n_options
    "max_score",
    "rater_id",
    "is_double_coded",
    "assessed_on",  # YYYY-MM-DD
    "notes",
)

# The near-transfer battery + distal measures a blank template pre-lists per
# participant (edit/extend freely — import accepts any instrument name).
TEMPLATE_INSTRUMENTS = ("EIT", "TOP", "JAP", "NCT", "VSMS", "ATEC")
TEMPLATE_TIMEPOINTS = ("pre", "post")
_VALID_TIMEPOINTS = ("pre", "post", "followup")


@router.get("/assessments/template.csv")
def assessments_template_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Blank entry template: the battery grid (timepoint × instrument) pre-filled
    for every participant with a code, ready for a blinded tester to type scores
    into and re-import."""
    students = db.scalars(select(Student).order_by(Student.created_at.asc())).all()
    rows: list[list[object]] = []
    for s in students:
        if not s.participant_code:
            continue
        for tp in TEMPLATE_TIMEPOINTS:
            for inst in TEMPLATE_INSTRUMENTS:
                rows.append([s.participant_code, tp, inst, "", "", "", "", "", "false", "", ""])
    return _csv_response(ASSESSMENT_CSV_COLUMNS, rows, "assessment_template.csv")


@router.get("/assessments.csv")
def export_assessments_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """Export all stored battery scores (round-trips the import format)."""
    rows_q = db.execute(
        select(AssessmentScore, Student.participant_code)
        .join(Student, AssessmentScore.student_id == Student.id)
        .order_by(Student.participant_code, AssessmentScore.timepoint, AssessmentScore.instrument)
    ).all()
    rows = [
        [
            code or "",
            a.timepoint,
            a.instrument,
            a.form or "",
            a.raw_score,
            _c(a.n_options),
            _c(a.max_score),
            a.rater_id or "",
            "true" if a.is_double_coded else "false",
            a.assessed_on.isoformat() if a.assessed_on else "",
            a.notes or "",
        ]
        for a, code in rows_q
    ]
    return _csv_response(ASSESSMENT_CSV_COLUMNS, rows, "assessments.csv")


def _pf(v: str | None) -> float | None:
    v = (v or "").strip()
    return float(v) if v else None


def _pi(v: str | None) -> int | None:
    v = (v or "").strip()
    return int(float(v)) if v else None


def _pbool(v: str | None) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "y", "t")


def _pstr(v: str | None) -> str | None:
    v = (v or "").strip()
    return v or None


@router.post("/assessments/import", response_model=AssessmentImportResult)
def import_assessments(
    req: AssessmentImportRequest,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
) -> AssessmentImportResult:
    """Upsert blinded battery scores from CSV text (see ASSESSMENT_CSV_COLUMNS).

    Rows are matched to participants by ``participant_code``. A row updates any
    existing score with the same (participant, timepoint, instrument, form,
    rater), else inserts. Blank ``raw_score`` rows are skipped (unfilled template
    cells). Unknown/ambiguous codes and bad values are reported, not fatal.
    """
    # Resolve participant codes once. Codes are unique per mentor, so a code
    # shared across mentors is flagged ambiguous rather than guessed.
    by_code: dict[str, list[Student]] = defaultdict(list)
    for s in db.scalars(select(Student)).all():
        if s.participant_code:
            by_code[s.participant_code.strip()].append(s)

    created = updated = rows = 0
    errors: list[str] = []
    reader = csv.DictReader(io.StringIO(req.csv))
    for i, raw in enumerate(reader, start=2):  # row 1 is the header
        rows += 1
        code = (raw.get("participant_code") or "").strip()
        if (raw.get("raw_score") or "").strip() == "":
            continue  # unfilled template cell
        matches = by_code.get(code, [])
        if not code:
            errors.append(f"row {i}: missing participant_code")
            continue
        if len(matches) != 1:
            reason = "unknown" if not matches else "ambiguous"
            errors.append(f"row {i}: participant_code '{code}' is {reason}")
            continue
        timepoint = (raw.get("timepoint") or "").strip().lower()
        instrument = (raw.get("instrument") or "").strip()
        if timepoint not in _VALID_TIMEPOINTS:
            errors.append(f"row {i}: timepoint must be pre/post/followup, got '{timepoint}'")
            continue
        if not instrument:
            errors.append(f"row {i}: missing instrument")
            continue
        try:
            raw_score = _pf(raw.get("raw_score"))
            n_options = _pi(raw.get("n_options"))
            max_score = _pf(raw.get("max_score"))
            assessed_on = None
            if (raw.get("assessed_on") or "").strip():
                assessed_on = date.fromisoformat(raw["assessed_on"].strip())
        except ValueError as exc:
            errors.append(f"row {i}: {exc}")
            continue
        form = _pstr(raw.get("form"))
        rater_id = _pstr(raw.get("rater_id"))
        student = matches[0]

        conds = [
            AssessmentScore.student_id == student.id,
            AssessmentScore.timepoint == timepoint,
            AssessmentScore.instrument == instrument,
            AssessmentScore.form.is_(None) if form is None else AssessmentScore.form == form,
            AssessmentScore.rater_id.is_(None)
            if rater_id is None
            else AssessmentScore.rater_id == rater_id,
        ]
        existing = db.scalar(select(AssessmentScore).where(*conds))
        if existing is None:
            db.add(
                AssessmentScore(
                    student_id=student.id,
                    timepoint=timepoint,
                    instrument=instrument,
                    form=form,
                    raw_score=raw_score,
                    n_options=n_options,
                    max_score=max_score,
                    rater_id=rater_id,
                    is_double_coded=_pbool(raw.get("is_double_coded")),
                    assessed_on=assessed_on,
                    notes=_pstr(raw.get("notes")),
                )
            )
            created += 1
        else:
            existing.raw_score = raw_score
            existing.n_options = n_options
            existing.max_score = max_score
            existing.is_double_coded = _pbool(raw.get("is_double_coded"))
            existing.assessed_on = assessed_on
            existing.notes = _pstr(raw.get("notes"))
            updated += 1

    db.commit()
    return AssessmentImportResult(rows=rows, created=created, updated=updated, errors=errors)
