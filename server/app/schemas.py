"""Pydantic request/response schemas."""
import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------------------------------------------------------------------------
# Auth (players)
# ---------------------------------------------------------------------------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)

    # Professional profile
    designation: str | None = None
    organisation: str | None = None
    mobile_number: str | None = None
    avatar: str | None = None

    # Address
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None

    # Education
    education_level: str | None = None
    institution: str | None = None
    field_of_study: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    """Mentor profile edit (Complete Your Profile / Profile screens)."""

    full_name: str | None = Field(default=None, max_length=200)
    designation: str | None = Field(default=None, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    mobile_number: str | None = Field(default=None, max_length=40)
    avatar: str | None = Field(default=None, max_length=1000)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    designation: str | None = None
    organisation: str | None = None
    mobile_number: str | None = None
    avatar: str | None = None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str | None
    education_level: str | None
    institution: str | None
    field_of_study: str | None
    is_active: bool
    created_at: datetime


class AuthResponse(BaseModel):
    """Returned by both sign-up and login (sign-up logs the user in)."""

    access_token: str
    token_type: str = "bearer"
    created: bool  # True when a brand-new account was created
    user: UserPublic


# ---------------------------------------------------------------------------
# Students (managed by a mentor)
# ---------------------------------------------------------------------------
class StudentBase(BaseModel):
    """Extended participant fields shared by create/update, matching the design's
    New Participant form."""

    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    avatar: str | None = Field(default=None, max_length=1000)
    gender: str | None = Field(default=None, max_length=40)
    parent_guardian_name: str | None = Field(default=None, max_length=200)
    parent_contact: str | None = Field(default=None, max_length=80)
    autism_level: str | None = Field(default=None, max_length=40)
    iq_score: int | None = Field(default=None, ge=0, le=300)
    rehabilitation_centre: str | None = Field(default=None, max_length=200)


class StudentCreate(StudentBase):
    full_name: str = Field(min_length=1, max_length=200)


class StudentUpdate(StudentBase):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None


class StudentPublic(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mentor_id: uuid.UUID
    full_name: str
    participant_code: str | None
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
class SessionStartRequest(BaseModel):
    game_key: str = Field(max_length=80)
    student_id: uuid.UUID | None = None


class SessionEndRequest(BaseModel):
    final_score: int | None = None


class SessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID | None
    game_key: str
    final_score: int | None
    started_at: datetime
    ended_at: datetime | None


class EventCreate(BaseModel):
    game_key: str = Field(max_length=80)
    event_type: str = Field(max_length=80)
    step_index: int | None = None
    score: int | None = None
    student_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    payload: dict[str, Any] | None = None
    client_timestamp: datetime | None = None


class EventBatchCreate(BaseModel):
    events: list[EventCreate] = Field(min_length=1, max_length=500)


class EventPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    student_id: uuid.UUID | None
    session_id: uuid.UUID | None
    game_key: str
    event_type: str
    step_index: int | None
    score: int | None
    payload: dict[str, Any] | None
    client_timestamp: datetime | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Level progress (per-student game progression)
# ---------------------------------------------------------------------------
class LevelProgressSubmit(BaseModel):
    """A completed level attempt reported by the client."""

    game_key: str = Field(max_length=80)
    level: str = Field(max_length=20)
    student_id: uuid.UUID | None = None
    score: int = Field(ge=0)
    total: int = Field(gt=0)


class LevelProgressPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID | None
    game_key: str
    level: str
    attempts: int
    best_score: int
    best_accuracy: float
    unlocked: bool
    passed: bool
    mastered: bool
    updated_at: datetime


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: EmailStr


class UserUpdate(BaseModel):
    is_active: bool | None = None
    full_name: str | None = None
    education_level: str | None = None
    city: str | None = None
    country: str | None = None


class PaginatedUsers(BaseModel):
    total: int
    items: list[UserPublic]


class PaginatedStudents(BaseModel):
    total: int
    items: list[StudentPublic]


class PaginatedEvents(BaseModel):
    total: int
    items: list[EventPublic]


class AnalyticsSummary(BaseModel):
    total_users: int
    active_users: int
    total_students: int
    total_events: int
    total_sessions: int
    events_last_7_days: int
    new_users_last_7_days: int


class GameBreakdownItem(BaseModel):
    game_key: str
    event_count: int
    user_count: int
    # Standardised 0-100 skill score: chance-corrected first-attempt accuracy
    # pooled across all players (see app/scoring.py). None for games with no
    # scorable trials yet (or retired games no longer in the roster).
    skill_score: float | None


class StudentOverviewItem(BaseModel):
    """One row per child for the dashboard's Participants table.

    The Players table lists mentor *accounts*; this is the participant-level
    companion — the unit the study actually reports on. Scores are the same
    chance-corrected 0-100 metric used everywhere else (see app/scoring.py).
    """

    student_id: uuid.UUID
    participant_code: str | None
    full_name: str
    mentor_email: str | None
    gender: str | None
    autism_level: str | None
    age_years: int | None
    n_sessions: int
    n_trials: int
    composite: float | None
    last_played: datetime | None


class TimeseriesPoint(BaseModel):
    date: str
    events: int
    active_users: int


class AssessmentImportRequest(BaseModel):
    """Raw CSV text of blinded battery scores, parsed and upserted server-side."""

    csv: str


class AssessmentImportResult(BaseModel):
    rows: int  # data rows seen (excluding header)
    created: int
    updated: int
    errors: list[str]  # human-readable "row N: reason" messages for skipped rows


# ---------------------------------------------------------------------------
# Mentor-facing progress reports (per student)
# ---------------------------------------------------------------------------
class ReportSummary(BaseModel):
    completion_pct: int
    games_done: int
    total_games: int
    sessions: int


class ReportTimeseriesPoint(BaseModel):
    label: str  # e.g. "W1"
    value: int  # average score/accuracy for that week (0-100)


class ReportGameBreakdown(BaseModel):
    game_key: str
    activities: int  # sessions/events completed for the game


class ReportRecentActivity(BaseModel):
    game_key: str
    label: str
    when: datetime
    score: int | None


class StudentReport(BaseModel):
    student_id: uuid.UUID
    summary: ReportSummary
    timeseries: list[ReportTimeseriesPoint]
    by_game: list[ReportGameBreakdown]
    recent: list[ReportRecentActivity]


class EmotionStat(BaseModel):
    """Per-emotion first-attempt performance across the emotion games."""

    emotion: str
    total: int
    correct: int
    accuracy: float  # 0..1
    median_latency_ms: int | None


class EmotionReport(BaseModel):
    """Per-student emotion identification profile.

    ``confusion[shown][picked]`` counts first-attempt answers: the diagonal is
    correct identifications, off-diagonal cells are which emotion the child
    confused the shown one with (e.g. scared → surprised).
    """

    student_id: uuid.UUID
    emotions: list[str]
    confusion: dict[str, dict[str, int]]
    stats: list[EmotionStat]


# ---------------------------------------------------------------------------
# Standardised skill scores (research analytics — see app/scoring.py)
# ---------------------------------------------------------------------------
class GameScoreOut(BaseModel):
    """Standardised 0-100 score for one game (chance-corrected first-attempt
    accuracy), plus its secondary metrics and pre/post improvement."""

    game_key: str
    skill: str
    score: float | None
    raw_accuracy: float | None
    n_trials: int
    n_sessions: int
    median_latency_ms: int | None
    baseline_score: float | None
    latest_score: float | None
    delta: float | None


class SkillScoreOut(BaseModel):
    """Mean 0-100 score across the games that train one target skill."""

    skill: str
    label: str
    score: float | None
    delta: float | None
    n_games: int
    games: list[GameScoreOut]


class ParticipantSkillReport(BaseModel):
    """Full per-participant profile: composite social-emotional score, the four
    skill scores, per-game scores, and improvement (pre/post) at every level."""

    student_id: uuid.UUID
    composite: float | None
    composite_delta: float | None
    n_sessions: int
    n_trials: int
    skills: list[SkillScoreOut]


class GroupStatOut(BaseModel):
    """Mean / SD / mean-improvement of one metric across a cohort of students."""

    metric: str  # "composite" or a skill id
    label: str
    mean: float | None
    sd: float | None
    mean_delta: float | None
    n: int


class GroupBreakdown(BaseModel):
    """One demographic bucket (e.g. gender = 'male') and its aggregate stats."""

    group: str  # the bucket value, or "all" for the ungrouped cohort
    n_participants: int
    stats: list[GroupStatOut]


class GroupReport(BaseModel):
    """Cohort-level scores, optionally split by a demographic dimension."""

    group_by: str  # overall | gender | autism_level | age_band | iq_band
    total_participants: int
    breakdowns: list[GroupBreakdown]


# ---------------------------------------------------------------------------
# Per-construct scores for the social-norms games (see app/scoring.py)
# ---------------------------------------------------------------------------
class ConstructScoreOut(BaseModel):
    """0-100 chance-corrected accuracy for one construct (e.g. "sharing"),
    pooled across the student's recent sessions of that game."""

    construct: str
    score: float | None
    raw_accuracy: float | None
    n_trials: int
    median_latency_ms: int | None


class GameConstructReport(BaseModel):
    """Per-construct profile for one social-norms game (Right or Wrong or
    Good Choice), pooled across the student's most recent sessions."""

    game_key: str
    constructs: list[ConstructScoreOut]
    n_sessions_pooled: int
    session_window: int


class SocialNormsReport(BaseModel):
    """Per-construct profiles for both social-norms games. A single session
    only carries ~2 trials per construct (a deliberate fatigue guard), so
    each game's profile pools several recent sessions instead of reading one
    session alone."""

    student_id: uuid.UUID
    games: list[GameConstructReport]
