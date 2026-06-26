"""Authentication dependencies for players and admins."""
import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Admin, User
from .security import TOKEN_TYPE_ADMIN, TOKEN_TYPE_PLAYER, decode_token

bearer_scheme = HTTPBearer(auto_error=True)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _decode(credentials: HTTPAuthorizationCredentials, expected_type: str) -> str:
    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise _CREDENTIALS_EXC
    if payload.get("type") != expected_type:
        raise _CREDENTIALS_EXC
    subject = payload.get("sub")
    if not subject:
        raise _CREDENTIALS_EXC
    return subject


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    subject = _decode(credentials, TOKEN_TYPE_PLAYER)
    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        raise _CREDENTIALS_EXC
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXC
    return user


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    subject = _decode(credentials, TOKEN_TYPE_ADMIN)
    try:
        admin_id = uuid.UUID(subject)
    except ValueError:
        raise _CREDENTIALS_EXC
    admin = db.get(Admin, admin_id)
    if admin is None or not admin.is_active:
        raise _CREDENTIALS_EXC
    return admin
