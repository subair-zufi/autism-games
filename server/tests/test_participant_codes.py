"""Participant codes are the analysis key, so they have to be unique.

They used to be numbered per mentor, which gave every mentor account its own
P-<year>-001: two facilitators signing in under separate logins produced two
different children carrying one code, and every export is joined on it.
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin-pass-123")

from app.config import settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Student, User  # noqa: E402
from app.seed import _ensure_unique_participant_codes  # noqa: E402


def _db_reachable() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _looks_like_test_db(db_url: str) -> bool:
    try:
        return "test" in (make_url(db_url).database or "").lower()
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _db_reachable()
    or not (os.environ.get("TEST_DATABASE_URL") or _looks_like_test_db(settings.database_url)),
    reason="Needs an isolated PostgreSQL test database (TEST_DATABASE_URL).",
)


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def _mentor(client, email: str) -> dict[str, str]:
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "secret123", "full_name": "M"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _add(client, headers, name: str) -> dict:
    r = client.post("/api/students", json={"full_name": name}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_two_mentors_first_children_do_not_share_a_code(client):
    """The bug this whole change exists for."""
    a = _add(client, _mentor(client, "one@example.com"), "Asha")
    b = _add(client, _mentor(client, "two@example.com"), "Bilal")

    assert a["participant_code"] != b["participant_code"]


def test_codes_run_as_one_sequence_across_mentors(client):
    h1 = _mentor(client, "one@example.com")
    h2 = _mentor(client, "two@example.com")

    codes = [
        _add(client, h1, "A")["participant_code"],
        _add(client, h2, "B")["participant_code"],
        _add(client, h1, "C")["participant_code"],
    ]

    assert len(set(codes)) == 3
    tails = [int(c.rsplit("-", 1)[1]) for c in codes]
    assert tails == [1, 2, 3]


def test_a_deleted_child_does_not_free_their_code_for_reuse(client):
    """Removing a participant is a console action, and the battery/ASSP import
    is keyed on the code — so a reissued code would file a withdrawn child's
    score against whoever was enrolled next."""
    h = _mentor(client, "one@example.com")
    first = _add(client, h, "A")
    client.delete(f"/api/students/{first['id']}", headers=h)

    second = _add(client, h, "B")

    assert second["participant_code"] != first["participant_code"]


def test_the_database_refuses_a_duplicate_code(client):
    """Belt as well as braces: the index is what makes the guarantee, not the
    generator."""
    h = _mentor(client, "one@example.com")
    existing = _add(client, h, "A")

    with SessionLocal() as db:
        mentor = db.scalars(select_user()).first()
        db.add(
            Student(
                mentor_id=mentor.id,
                full_name="Impostor",
                participant_code=existing["participant_code"],
            )
        )
        with pytest.raises(Exception):
            db.commit()


def select_user():
    from sqlalchemy import select

    return select(User)


def test_several_children_with_no_code_are_allowed(client):
    """The column is nullable and many rows may be null — a unique index must
    not collapse them into one."""
    h = _mentor(client, "one@example.com")
    with SessionLocal() as db:
        mentor = db.scalars(select_user()).first()
        db.add_all(
            [
                Student(mentor_id=mentor.id, full_name="No code 1", participant_code=None),
                Student(mentor_id=mentor.id, full_name="No code 2", participant_code=None),
            ]
        )
        db.commit()

    assert len(client.get("/api/students", headers=h).json()) == 2


def test_migration_reissues_codes_that_were_already_duplicated(client):
    """An existing deployment carries per-mentor codes, so the index cannot be
    built until the duplicates are resolved."""
    h1 = _mentor(client, "one@example.com")
    h2 = _mentor(client, "two@example.com")
    first = _add(client, h1, "Earliest")
    second = _add(client, h2, "Later")

    # Recreate the old state: both children holding one code.
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE students DROP CONSTRAINT IF EXISTS "
                "uq_students_participant_code"
            )
        )
        conn.execute(text("DROP INDEX IF EXISTS uq_students_participant_code"))
        conn.execute(
            text("UPDATE students SET participant_code = :c WHERE id = :i"),
            {"c": first["participant_code"], "i": second["id"]},
        )

    _ensure_unique_participant_codes()

    after = {
        s["id"]: s["participant_code"]
        for s in client.get("/api/students", headers=h1).json()
        + client.get("/api/students", headers=h2).json()
    }
    # The earliest child keeps the contested code — anything already written on
    # a consent form still points at the same child.
    assert after[first["id"]] == first["participant_code"]
    assert after[second["id"]] != first["participant_code"]
    assert len(set(after.values())) == 2


def test_migration_is_a_no_op_when_codes_are_already_unique(client):
    h = _mentor(client, "one@example.com")
    before = {s["full_name"]: s["participant_code"] for s in [_add(client, h, "A"), _add(client, h, "B")]}

    _ensure_unique_participant_codes()
    _ensure_unique_participant_codes()

    after = {s["full_name"]: s["participant_code"] for s in client.get("/api/students", headers=h).json()}
    assert after == before
