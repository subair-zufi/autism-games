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


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
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
class StudentCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    avatar: str | None = Field(default=None, max_length=120)


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=1000)
    avatar: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class StudentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mentor_id: uuid.UUID
    full_name: str
    date_of_birth: date | None
    notes: str | None
    avatar: str | None
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
    avg_score: float | None


class TimeseriesPoint(BaseModel):
    date: str
    events: int
    active_users: int
