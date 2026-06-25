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

os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
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
