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
    Sequence,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


#: Supplies the number in a participant code.
#:
#: A sequence rather than a count of existing rows, because numbers must never
#: be handed out twice. Participants can be removed from the trainer console,
#: and a count would then issue the withdrawn child's code to the next one
#: enrolled — at which point an imported battery or ASSP score filed under that
#: code, or a consent form carrying it, would attach to the wrong child. A
#: sequence only ever moves forward, including across a delete and across a
#: year boundary.
participant_code_seq = Sequence("participant_code_seq", metadata=Base.metadata)


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

    # Professional profile (surfaced in the "Complete Your Profile" / Profile screens)
    designation: Mapped[str | None] = mapped_column(String(200))
    organisation: Mapped[str | None] = mapped_column(String(200))
    mobile_number: Mapped[str | None] = mapped_column(String(40))
    avatar: Mapped[str | None] = mapped_column(String(1000))

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
    __table_args__ = (
        # Globally unique, not per mentor. The code is the analysis key: every
        # export is joined on it and the code-to-identity map is kept on it, so
        # two children sharing one would silently merge in the analysis. Codes
        # used to be numbered per mentor, which gave every mentor account their
        # own P-<year>-001.
        UniqueConstraint("participant_code", name="uq_students_participant_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(1000))
    # Small UI hint for the "switch student" picker (e.g. an emoji or colour).
    avatar: Mapped[str | None] = mapped_column(String(1000))

    # Clinical / demographic profile (from the New Participant form in the design)
    gender: Mapped[str | None] = mapped_column(String(40))
    parent_guardian_name: Mapped[str | None] = mapped_column(String(200))
    parent_contact: Mapped[str | None] = mapped_column(String(80))
    autism_level: Mapped[str | None] = mapped_column(String(40))
    iq_score: Mapped[int | None] = mapped_column(Integer)
    rehabilitation_centre: Mapped[str | None] = mapped_column(String(200))
    # Human-readable participant code (e.g. "P-2024-001"), unique across the
    # whole study. Nullable: a child added before codes existed has none.
    participant_code: Mapped[str | None] = mapped_column(String(40))

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


class AssessmentScore(Base):
    """A pre/post outcome score for a participant.

    Holds both measurement layers — the near-transfer battery (EIT/TOP/JAP,
    the primary outcome) and the informant-rated **ASSP** (total plus its three
    subscales, the secondary far-transfer measure) — plus the discriminant
    control (NCT, sound-localization), alongside the game data, so in-game gains
    can be tested against transfer. These are entered off-platform and imported
    as CSV, not produced by the app.

    Uniqueness is per (participant, timepoint, instrument, form, rater): a second
    blinded coder on the battery, or a second independent informant on the ASSP,
    is a separate row (for inter-rater agreement), and re-importing the same row
    updates it in place.
    """

    __tablename__ = "assessment_scores"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "timepoint", "instrument", "form", "rater_id",
            name="uq_assessment_scope",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )

    timepoint: Mapped[str] = mapped_column(String(20), nullable=False)  # pre | post | followup
    instrument: Mapped[str] = mapped_column(String(40), nullable=False)  # EIT | TOP | JAP | ASSP_TOTAL | ASSP_SR | ASSP_SPA | ASSP_DSB | NCT | SOUNDLOC | ...
    form: Mapped[str | None] = mapped_column(String(10))  # A | B (parallel forms) | SINGLE (ASSP), else null
    raw_score: Mapped[float] = mapped_column(Float, nullable=False)
    # For forced-choice subtests: number of options, so chance (1/n) is recoverable.
    n_options: Mapped[int | None] = mapped_column(Integer)
    max_score: Mapped[float | None] = mapped_column(Float)
    rater_id: Mapped[str | None] = mapped_column(String(80))
    is_double_coded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assessed_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(1000))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    student: Mapped["Student"] = relationship()


class SessionExperience(Base):
    """One VR session experience record — the eleven-question form the trainer
    fills in on the remote console the moment the headset comes off.

    This is the user-experience objective's instrument. Unlike
    :class:`AssessmentScore`, which is entered off-platform at three fixed
    timepoints, this is recorded *inside* the app after every session, so it
    lands already attached to the child and the day and needs no joining by
    hand against a spreadsheet of typed participant codes.

    Part A (``child_*``) is answered by the child, pictorially, with the trainer
    reading the question aloud and tapping what the child points to. Part B
    (``rated_*``) is the trainer's own behaviourally anchored ratings. Part C is
    free text. Every rating runs 1 (low) to 5 (high) — including comfort — so
    no scale is inverted relative to another and a single direction holds
    across the whole record.

    Uniqueness is per (participant, date, session of that day, rater): a second
    trainer independently rating Part B for the reliability subsample is a
    separate row, exactly as a second blinded coder is on the battery, and
    re-submitting the same scope updates it in place rather than duplicating.

    Deliberately *not* modelled: any total score. The items are reported
    separately (see docs/vr-ux-protocol.md); summing them would assert a
    single-factor structure this record has never been shown to have.
    """

    __tablename__ = "session_experience"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "visit_date", "session_ordinal", "rater_id",
            name="uq_session_experience_scope",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    #: The mentor account that recorded it (the trainer's own login).
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Never null: this is a research record about a child, so a row with no
    #: child is meaningless — unlike sessions/events, which a mentor may
    #: generate while trying a game out on their own.
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False
    )

    #: The visit, as a calendar date. Sessions are joined to telemetry by child
    #: and day, not by ``game_sessions.id`` — one visit normally covers several
    #: games and therefore several rows in ``game_sessions``.
    visit_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    #: Which session of that day, for the rare day that runs two. 1 almost always.
    session_ordinal: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    #: Who rated Part B. "" is the session's own trainer; a named id marks the
    #: independent second rating used for the inter-rater reliability subsample.
    rater_id: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    is_second_rating: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: Game keys played during the visit, as recorded by the console.
    games_played: Mapped[list | None] = mapped_column(JSONB)
    minutes: Mapped[int | None] = mapped_column(Integer)

    # --- Part A: the child (pictorial, read aloud; 1 low - 5 high) ---
    child_fun: Mapped[int | None] = mapped_column(Integer)
    child_feeling: Mapped[int | None] = mapped_column(Integer)
    #: yes | maybe | no — the clearest change signal across sessions, because
    #: the fun rating sits high from the first session and barely moves.
    child_play_again: Mapped[str | None] = mapped_column(String(10))

    # --- Part B: the trainer (behaviourally anchored; 1 low - 5 high) ---
    rated_engagement: Mapped[int | None] = mapped_column(Integer)
    rated_independence: Mapped[int | None] = mapped_column(Integer)
    rated_comfort: Mapped[int | None] = mapped_column(Integer)
    rated_enjoyment: Mapped[int | None] = mapped_column(Integer)
    rated_willingness: Mapped[int | None] = mapped_column(Integer)

    # --- Part C: in the trainer's words ---
    went_well: Mapped[str | None] = mapped_column(String(2000))
    was_difficult: Mapped[str | None] = mapped_column(String(2000))
    different_from_last: Mapped[str | None] = mapped_column(String(2000))

    #: Set when the stop rule fired. A stopped session is a finding, not a gap,
    #: so it is recorded as data rather than left as a missing row.
    stopped_early: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stop_reason: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    student: Mapped["Student"] = relationship()


Index(
    "ix_session_experience_student_date",
    SessionExperience.student_id,
    SessionExperience.visit_date,
)
