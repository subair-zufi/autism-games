"""SQLAlchemy ORM models."""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    """A mentor / account holder. Created on sign-up (which also logs them in).

    A mentor logs in with their own details and manages one or more
    :class:`Student` records. Gameplay analytics are attributed to the mentor
    (``user_id``) and, when a student is selected, to that student too.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))

    # Address information
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    postal_code: Mapped[str | None] = mapped_column(String(40))
    country: Mapped[str | None] = mapped_column(String(120))

    # Education information
    education_level: Mapped[str | None] = mapped_column(String(120))
    institution: Mapped[str | None] = mapped_column(String(200))
    field_of_study: Mapped[str | None] = mapped_column(String(200))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    events: Mapped[list["GameEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["GameSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    students: Mapped[list["Student"]] = relationship(
        back_populates="mentor", cascade="all, delete-orphan"
    )


class Student(Base):
    """A learner managed by a mentor (:class:`User`).

    A mentor adds/edits students from the client and switches between them
    during gameplay. Sessions and events recorded while a student is selected
    carry that student's id so the admin dashboard can break analytics down per
    student.
    """

    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(1000))
    # Small UI hint for the "switch student" picker (e.g. an emoji or colour).
    avatar: Mapped[str | None] = mapped_column(String(120))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    mentor: Mapped["User"] = relationship(back_populates="students")
    events: Mapped[list["GameEvent"]] = relationship(back_populates="student")
    sessions: Mapped[list["GameSession"]] = relationship(back_populates="student")


class Admin(Base):
    """A dashboard administrator. Logs in with email + password."""

    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GameSession(Base):
    """A single play session grouping a sequence of steps/events."""

    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Optional: the student this session was played for. Nullable so legacy rows
    # and mentor-only play (no student selected) remain valid.
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), index=True
    )
    game_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    final_score: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="sessions")
    student: Mapped["Student | None"] = relationship(back_populates="sessions")
    events: Mapped[list["GameEvent"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class GameEvent(Base):
    """A single recorded step/event. One row per step, stored only for logged-in players."""

    __tablename__ = "game_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Optional: the student this event was recorded for (see GameSession above).
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("game_sessions.id", ondelete="SET NULL"), index=True
    )

    game_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    step_index: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict | None] = mapped_column(JSONB)

    # Timestamp reported by the client (optional) + authoritative server time
    client_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(back_populates="events")
    student: Mapped["Student | None"] = relationship(back_populates="events")
    session: Mapped["GameSession | None"] = relationship(back_populates="events")


Index("ix_game_events_game_type", GameEvent.game_key, GameEvent.event_type)


class LevelProgress(Base):
    """Per-student progression through a level-based game (Emotion Recognition).

    One row per (mentor, student, game, level). It records how far a learner has
    got so play resumes across sessions: which levels are unlocked, their best
    score/accuracy, how many attempts they have made, and whether they have
    passed (≥70%) or mastered (≥80%) the level.

    ``student_id`` is nullable so a mentor can also play (and keep progress)
    without a student selected, mirroring sessions/events.
    """

    __tablename__ = "level_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "student_id", "game_key", "level", name="uq_level_progress_scope"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), index=True
    )

    game_key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False)

    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mastered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
