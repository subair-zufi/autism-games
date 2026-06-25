"""Create database tables and seed the first admin account."""
import logging

from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Admin  # noqa: F401  (ensure models are imported for metadata)
from . import models  # noqa: F401
from .security import hash_password

logger = logging.getLogger("uvicorn.error")


def init_db() -> None:
    """Create tables if they do not yet exist and ensure a seed admin exists."""
    Base.metadata.create_all(bind=engine)
    _ensure_seed_admin()


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
