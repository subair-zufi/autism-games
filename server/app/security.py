"""Password hashing and JWT helpers."""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from .config import settings

# Token subject "type" claim values
TOKEN_TYPE_PLAYER = "player"
TOKEN_TYPE_ADMIN = "admin"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, token_type: str, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def create_player_token(user_id: str) -> str:
    return create_access_token(user_id, TOKEN_TYPE_PLAYER, settings.access_token_expire_minutes)


def create_admin_token(admin_id: str) -> str:
    return create_access_token(admin_id, TOKEN_TYPE_ADMIN, settings.admin_token_expire_minutes)
