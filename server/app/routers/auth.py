"""Player authentication: sign-up (which also logs in) and explicit login."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AuthResponse, LoginRequest, SignupRequest, UserPublic
from ..security import create_player_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Fields that may be refreshed on an idempotent sign-up of an existing account.
_PROFILE_FIELDS = (
    "full_name",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
    "education_level",
    "institution",
    "field_of_study",
)


@router.post("/signup", response_model=AuthResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Sign up a new player and log them in.

    Behaviour requested by the product:
      * New email           -> create the account and return a token (signed in).
      * Existing email +
        matching password   -> treat as a login and return a token (idempotent).
      * Existing email +
        wrong password       -> 409, the email already belongs to someone else.
    """
    existing = db.scalar(select(User).where(User.email == data.email.lower()))

    if existing is not None:
        if not verify_password(data.password, existing.password_hash):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists with a different password.",
            )
        if not existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="This account is disabled."
            )
        # Same email + same password -> log them in. Refresh any newly provided profile fields.
        for field in _PROFILE_FIELDS:
            value = getattr(data, field)
            if value is not None:
                setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        token = create_player_token(str(existing.id))
        return AuthResponse(access_token=token, created=False, user=UserPublic.model_validate(existing))

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        **{field: getattr(data, field) for field in _PROFILE_FIELDS},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_player_token(str(user.id))
    return AuthResponse(access_token=token, created=True, user=UserPublic.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Explicit email + password login."""
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is disabled.")
    token = create_player_token(str(user.id))
    return AuthResponse(access_token=token, created=False, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
