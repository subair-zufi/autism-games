"""Admin API: authentication, user management and analytics."""
import csv
import io
import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import Admin, AssessmentScore, GameEvent, GameSession, Student, User
from ..scoring import (
    SKILL_BY_GAME,
    VISIBLE_GAMES,
    age_band,
    age_years,
    corrected_score,
    dose_summary,
    iq_band,
    raw_payload_columns,
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
    """Render a payload value for a raw CSV cell: None → empty, nested → JSON,
    everything else verbatim (booleans stay True/False; nothing is recoded)."""
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


@router.get("/export/events_raw.csv")
def export_events_raw_csv(
    db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)
) -> StreamingResponse:
    """RAW event dump for external analysis — one row per recorded event, every
    payload field flattened to its own column, nothing scored, filtered, banded
    or aggregated. This is the source data for SPSS/R: define your own scoring,
    first-attempt rules and groupings from it. All event types and all games
    (including retired ones) are included; only mentor-only play with no
    participant attached is left out (it can't be attributed)."""
    students = {s.id: s for s in db.scalars(select(Student)).all()}
    events = db.scalars(
        select(GameEvent)
        .where(GameEvent.student_id.isnot(None))
        .order_by(GameEvent.created_at.asc())
    ).all()

    payload_cols = raw_payload_columns(events)
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
