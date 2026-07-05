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
    _ensure_student_columns()
    _ensure_seed_admin()


def _ensure_student_columns() -> None:
    """Add the nullable ``student_id`` columns to pre-existing record tables.

    ``create_all`` creates the ``students`` table and adds the new columns on a
    fresh database, but it never ALTERs tables that already exist. This project
    has no migration tool, so we add the columns idempotently here for
    already-deployed databases. Postgres only (``IF NOT EXISTS`` + inline FK);
    a no-op on a freshly created schema.
    """
    if engine.dialect.name != "postgresql":
        return
    statements = (
        "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS student_id UUID "
        "REFERENCES students(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_game_sessions_student_id "
        "ON game_sessions (student_id)",
        "ALTER TABLE game_events ADD COLUMN IF NOT EXISTS student_id UUID "
        "REFERENCES students(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_game_events_student_id "
        "ON game_events (student_id)",
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
