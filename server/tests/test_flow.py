"""End-to-end flow tests for the analytics API.

Requires a reachable PostgreSQL instance via TEST_DATABASE_URL (or DATABASE_URL).
The whole module is skipped if no database is reachable so the suite stays green
in environments without Postgres.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

# Run against a dedicated test database when provided, so the dev DB is never
# dropped by the schema reset in the `client` fixture below.
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

# Use a normal registrable domain — email-validator rejects reserved TLDs
# like `.local` / `.test`, which would make the admin-login body fail validation.
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin-pass-123")

from app.config import settings  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def _db_reachable() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _db_reachable(), reason=f"No database reachable at {settings.database_url}"
)


@pytest.fixture(scope="module")
def client():
    # Fresh schema for the test run.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:  # triggers lifespan -> seeds admin
        yield c
    Base.metadata.drop_all(bind=engine)


def _signup_payload(email: str, password: str = "secret123"):
    return {
        "email": email,
        "password": password,
        "full_name": "Alex Doe",
        "address_line1": "1 Main St",
        "city": "Springfield",
        "country": "USA",
        "education_level": "High School",
        "institution": "Springfield High",
        "field_of_study": "General",
    }


def test_signup_creates_and_logs_in(client):
    r = client.post("/api/auth/signup", json=_signup_payload("alex@example.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] is True
    assert body["access_token"]
    assert body["user"]["email"] == "alex@example.com"
    assert body["user"]["city"] == "Springfield"


def test_signup_again_same_password_logs_in(client):
    client.post("/api/auth/signup", json=_signup_payload("bob@example.com"))
    r = client.post("/api/auth/signup", json=_signup_payload("bob@example.com"))
    assert r.status_code == 200, r.text
    assert r.json()["created"] is False  # idempotent login, not a new account


def test_signup_again_wrong_password_conflicts(client):
    client.post("/api/auth/signup", json=_signup_payload("carol@example.com", "rightpass"))
    r = client.post("/api/auth/signup", json=_signup_payload("carol@example.com", "wrongpass"))
    assert r.status_code == 409, r.text


def test_events_require_auth(client):
    r = client.post("/api/events", json={"game_key": "balldrop", "event_type": "step"})
    assert r.status_code in (401, 403)


def test_full_event_flow(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("dora@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # start a session
    s = client.post("/api/sessions", json={"game_key": "balldrop"}, headers=h)
    assert s.status_code == 201, s.text
    session_id = s.json()["id"]

    # record steps
    for i in range(3):
        e = client.post(
            "/api/events",
            json={
                "game_key": "balldrop",
                "event_type": "step",
                "step_index": i,
                "score": i * 10,
                "session_id": session_id,
                "payload": {"x": i},
            },
            headers=h,
        )
        assert e.status_code == 201, e.text

    # batch
    b = client.post(
        "/api/events/batch",
        json={"events": [{"game_key": "balldrop", "event_type": "tap"} for _ in range(5)]},
        headers=h,
    )
    assert b.status_code == 201 and b.json()["recorded"] == 5

    # end session
    end = client.post(
        f"/api/sessions/{session_id}/end", json={"final_score": 30}, headers=h
    )
    assert end.status_code == 200 and end.json()["final_score"] == 30

    # /me works
    assert client.get("/api/auth/me", headers=h).json()["email"] == "dora@example.com"


def test_student_crud_scoped_to_mentor(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("mentor1@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # create
    created = client.post(
        "/api/students",
        json={"full_name": "Sam", "date_of_birth": "2015-05-01", "avatar": "🦊"},
        headers=h,
    )
    assert created.status_code == 201, created.text
    student = created.json()
    assert student["full_name"] == "Sam" and student["mentor_id"]

    # list
    listed = client.get("/api/students", headers=h)
    assert listed.status_code == 200 and len(listed.json()) == 1

    # edit
    edited = client.patch(
        f"/api/students/{student['id']}", json={"full_name": "Samantha"}, headers=h
    )
    assert edited.status_code == 200 and edited.json()["full_name"] == "Samantha"

    # another mentor cannot see or touch this student
    other = client.post(
        "/api/auth/signup", json=_signup_payload("mentor2@example.com")
    ).json()["access_token"]
    oh = {"Authorization": f"Bearer {other}"}
    assert client.get("/api/students", headers=oh).json() == []
    assert client.get(f"/api/students/{student['id']}", headers=oh).status_code == 404

    # delete
    assert client.delete(f"/api/students/{student['id']}", headers=h).status_code == 204
    assert client.get("/api/students", headers=h).json() == []


def test_events_attach_to_student(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("mentor3@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    student_id = client.post(
        "/api/students", json={"full_name": "Kai"}, headers=h
    ).json()["id"]

    # session carries the student
    s = client.post(
        "/api/sessions", json={"game_key": "balldrop", "student_id": student_id}, headers=h
    )
    assert s.status_code == 201 and s.json()["student_id"] == student_id

    # event carries the student
    e = client.post(
        "/api/events",
        json={"game_key": "balldrop", "event_type": "step", "student_id": student_id},
        headers=h,
    )
    assert e.status_code == 201 and e.json()["student_id"] == student_id

    # a student that isn't yours is rejected
    bad = client.post(
        "/api/events",
        json={"game_key": "balldrop", "event_type": "step", "student_id": str(uuid.uuid4())},
        headers=h,
    )
    assert bad.status_code == 404


def test_admin_student_records(client):
    ah_token = client.post(
        "/api/admin/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    ).json()["access_token"]
    ah = {"Authorization": f"Bearer {ah_token}"}

    token = client.post(
        "/api/auth/signup", json=_signup_payload("mentor4@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    student_id = client.post(
        "/api/students", json={"full_name": "Noa"}, headers=h
    ).json()["id"]
    client.post(
        "/api/events",
        json={"game_key": "balldrop", "event_type": "step", "student_id": student_id},
        headers=h,
    )

    # admin can list students and read a student's events
    students = client.get("/api/admin/students", headers=ah)
    assert students.status_code == 200 and students.json()["total"] >= 1

    ev = client.get(f"/api/admin/students/{student_id}/events", headers=ah)
    assert ev.status_code == 200 and ev.json()["total"] >= 1

    # summary reports total_students
    summary = client.get("/api/admin/analytics/summary", headers=ah)
    assert summary.json()["total_students"] >= 1


def test_admin_login_and_analytics(client):
    # seed admin from settings
    r = client.post(
        "/api/admin/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    )
    assert r.status_code == 200, r.text
    ah = {"Authorization": f"Bearer {r.json()['access_token']}"}

    summary = client.get("/api/admin/analytics/summary", headers=ah)
    assert summary.status_code == 200
    assert summary.json()["total_users"] >= 1

    games = client.get("/api/admin/analytics/games", headers=ah)
    assert games.status_code == 200

    ts = client.get("/api/admin/analytics/timeseries?days=30", headers=ah)
    assert ts.status_code == 200

    users = client.get("/api/admin/users", headers=ah)
    assert users.status_code == 200 and users.json()["total"] >= 1


def test_admin_manage_user(client):
    ah_token = client.post(
        "/api/admin/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    ).json()["access_token"]
    ah = {"Authorization": f"Bearer {ah_token}"}

    uid = client.post(
        "/api/auth/signup", json=_signup_payload("erin@example.com")
    ).json()["user"]["id"]

    # disable
    patched = client.patch(f"/api/admin/users/{uid}", json={"is_active": False}, headers=ah)
    assert patched.status_code == 200 and patched.json()["is_active"] is False

    # disabled user cannot log in
    login = client.post(
        "/api/auth/login", json={"email": "erin@example.com", "password": "secret123"}
    )
    assert login.status_code == 403

    # delete
    deleted = client.delete(f"/api/admin/users/{uid}", headers=ah)
    assert deleted.status_code == 204
    assert client.get(f"/api/admin/users/{uid}", headers=ah).status_code == 404


def test_admin_endpoints_reject_player_token(client):
    player_token = client.post(
        "/api/auth/signup", json=_signup_payload("frank@example.com")
    ).json()["access_token"]
    r = client.get(
        "/api/admin/users", headers={"Authorization": f"Bearer {player_token}"}
    )
    assert r.status_code == 401


def test_unknown_session_rejected(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("gina@example.com")
    ).json()["access_token"]
    r = client.post(
        "/api/events",
        json={"game_key": "x", "event_type": "step", "session_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404
