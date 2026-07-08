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
