"""Create database tables and seed the first admin account."""
import logging

from sqlalchemy import select, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Admin  # noqa: F401  (ensure models are imported for metadata)
from . import models  # noqa: F401
from .security import hash_password

logger = logging.getLogger("uvicorn.error")


def init_db() -> None:
    """Create tables if they do not yet exist and ensure a seed admin exists."""
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _ensure_unique_participant_codes()
    _ensure_seed_admin()


def _ensure_columns() -> None:
    """Add newly-introduced nullable columns to pre-existing tables.

    ``create_all`` creates tables and their columns on a fresh database, but it
    never ALTERs tables that already exist. This project has no migration tool,
    so we add columns idempotently here for already-deployed databases. Postgres
    only (``ADD COLUMN IF NOT EXISTS``); a no-op on a freshly created schema.
    """
    if engine.dialect.name != "postgresql":
        return
    statements = (
        # student_id back-references on the analytics tables.
        "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS student_id UUID "
        "REFERENCES students(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_game_sessions_student_id "
        "ON game_sessions (student_id)",
        "ALTER TABLE game_events ADD COLUMN IF NOT EXISTS student_id UUID "
        "REFERENCES students(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_game_events_student_id "
        "ON game_events (student_id)",
        # Mentor professional-profile fields.
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS organisation VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(40)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(1000)",
        # Extended participant/clinical fields.
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(40)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_guardian_name VARCHAR(200)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_contact VARCHAR(80)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS autism_level VARCHAR(40)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS iq_score INTEGER",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS rehabilitation_centre VARCHAR(200)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS participant_code VARCHAR(40)",
    )
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def _ensure_unique_participant_codes() -> None:
    """Make participant codes unique across the study, on an existing database.

    Codes used to be numbered per mentor, so every mentor account had its own
    ``P-<year>-001``. The code is the analysis key — every export is joined on
    it and the code-to-identity map is kept on it — so two children sharing one
    would silently merge. New rows are prevented by a unique index; rows created
    before it existed have to be re-issued first, because the index cannot be
    built while duplicates remain.

    The earliest child keeps the contested code, so any code already written on
    a consent form or a paper record still points at the same child. Later ones
    are moved to the end of their year's sequence. Idempotent: with no
    duplicates and the index already in place, this does nothing.
    """
    if engine.dialect.name != "postgresql":
        return

    from .models import Student

    with SessionLocal() as db:
        rows = list(
            db.scalars(
                select(Student)
                .where(Student.participant_code.isnot(None))
                .order_by(Student.created_at.asc(), Student.id.asc())
            ).all()
        )
        taken = {r.participant_code for r in rows}
        seen: set[str] = set()
        reissued = 0

        for row in rows:
            code = row.participant_code
            if code not in seen:
                seen.add(code)
                continue

            prefix = code.rsplit("-", 1)[0] + "-" if "-" in code else "P-"
            highest = 0
            for other in taken:
                tail = (other or "")[len(prefix) :]
                if other and other.startswith(prefix) and tail.isdigit():
                    highest = max(highest, int(tail))
            new_code = f"{prefix}{highest + 1:03d}"

            logger.warning(
                "Participant code %s was held by more than one child; re-issuing "
                "the later one as %s (student %s).",
                code,
                new_code,
                row.id,
            )
            row.participant_code = new_code
            taken.add(new_code)
            seen.add(new_code)
            reissued += 1

        if reissued:
            db.commit()
            logger.warning(
                "Re-issued %d duplicate participant code(s). Update any paper "
                "record or code-to-identity map that used them.",
                reissued,
            )

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_students_participant_code "
                "ON students (participant_code)"
            )
        )
        # The sequence now supplies the number, so on a database whose codes
        # predate it, move it past everything already issued. Without this the
        # next enrolment would be handed a code a child is already using.
        conn.execute(text("CREATE SEQUENCE IF NOT EXISTS participant_code_seq"))
        highest = conn.execute(
            text(
                "SELECT COALESCE(MAX(NULLIF(regexp_replace("
                "participant_code, '^.*-', ''), '')::bigint), 0) FROM students "
                "WHERE participant_code ~ '-[0-9]+$'"
            )
        ).scalar_one()
        current = conn.execute(text("SELECT last_value FROM participant_code_seq")).scalar_one()
        if highest >= current:
            conn.execute(
                text("SELECT setval('participant_code_seq', :n)"), {"n": int(highest)}
            )


def _ensure_seed_admin() -> None:
    with SessionLocal() as db:
        email = settings.admin_email.lower()
        existing = db.scalar(select(Admin).where(Admin.email == email))
        if existing is not None:
            return
        admin = Admin(email=email, password_hash=hash_password(settings.admin_password))
        db.add(admin)
        db.commit()
        logger.info("Seeded initial admin account: %s", email)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    print("Database initialised and admin seeded.")
