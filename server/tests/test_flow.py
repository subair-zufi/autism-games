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


def test_level_progress_unlock_flow(client):
    """Passing a level (≥70%) unlocks the next; failing (<70%) does not."""
    token = client.post(
        "/api/auth/signup", json=_signup_payload("hank@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # attach a student so progress is scoped per-student
    student = client.post(
        "/api/students", json={"full_name": "Kid"}, headers=h
    ).json()
    sid = student["id"]

    game = "emotionrecognition"

    # No progress saved yet.
    assert client.get(f"/api/progress?game_key={game}&student_id={sid}", headers=h).json() == []

    # Fail easy (6/10 = 60%) -> easy recorded, medium NOT unlocked.
    r = client.post(
        "/api/progress",
        json={"game_key": game, "level": "easy", "student_id": sid, "score": 6, "total": 10},
        headers=h,
    )
    assert r.status_code == 201, r.text
    rows = {row["level"]: row for row in r.json()}
    assert rows["easy"]["unlocked"] is True
    assert rows["easy"]["passed"] is False
    assert rows["easy"]["attempts"] == 1
    assert "medium" not in rows  # not unlocked yet

    # Pass easy (8/10 = 80%) -> mastered, medium unlocked.
    r = client.post(
        "/api/progress",
        json={"game_key": game, "level": "easy", "student_id": sid, "score": 8, "total": 10},
        headers=h,
    )
    rows = {row["level"]: row for row in r.json()}
    assert rows["easy"]["attempts"] == 2
    assert rows["easy"]["passed"] is True and rows["easy"]["mastered"] is True
    assert rows["easy"]["best_score"] == 8
    assert abs(rows["easy"]["best_accuracy"] - 0.8) < 1e-6
    assert rows["medium"]["unlocked"] is True and rows["medium"]["passed"] is False

    # Progress persists and is scoped to the student.
    saved = client.get(f"/api/progress?game_key={game}&student_id={sid}", headers=h).json()
    assert {row["level"] for row in saved} == {"easy", "medium"}

    # A different mentor cannot use this student.
    other = client.post(
        "/api/auth/signup", json=_signup_payload("iris@example.com")
    ).json()["access_token"]
    oh = {"Authorization": f"Bearer {other}"}
    assert client.get(f"/api/progress?game_key={game}&student_id={sid}", headers=oh).status_code == 404


def test_profile_update(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("prof@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    r = client.patch(
        "/api/auth/me",
        json={
            "full_name": "Dr. Sarah Mitchell",
            "designation": "Clinical Psychologist",
            "organisation": "Sunrise Therapy Center",
            "mobile_number": "+1 (555) 204-8832",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["designation"] == "Clinical Psychologist"
    assert body["organisation"] == "Sunrise Therapy Center"
    # Persisted on subsequent /me.
    assert client.get("/api/auth/me", headers=h).json()["mobile_number"] == "+1 (555) 204-8832"


def test_student_extended_fields_and_code(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("codes@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    a = client.post(
        "/api/students",
        json={
            "full_name": "Aiden Patel",
            "gender": "Male",
            "autism_level": "Level 2",
            "iq_score": 85,
            "parent_guardian_name": "Priya Patel",
            "parent_contact": "+1 (555) 000-0000",
            "rehabilitation_centre": "Sunrise",
        },
        headers=h,
    ).json()
    assert a["participant_code"] == "P-%d-001" % __import__("datetime").datetime.now().year
    assert a["autism_level"] == "Level 2" and a["iq_score"] == 85

    # Second student gets the next sequential code.
    b = client.post("/api/students", json={"full_name": "Zoe Chen"}, headers=h).json()
    assert b["participant_code"].endswith("-002")


def test_student_report_shape(client):
    token = client.post(
        "/api/auth/signup", json=_signup_payload("report@example.com")
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    sid = client.post("/api/students", json={"full_name": "Milo"}, headers=h).json()["id"]

    # a played + ended session gives the report something to summarise
    s = client.post(
        "/api/sessions", json={"game_key": "balldrop", "student_id": sid}, headers=h
    ).json()["id"]
    client.post(f"/api/sessions/{s}/end", json={"final_score": 42}, headers=h)

    r = client.get(f"/api/reports/student/{sid}", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["sessions"] == 1
    assert body["summary"]["games_done"] == 1
    assert len(body["timeseries"]) == 6  # WEEKS
    assert body["by_game"][0]["game_key"] == "balldrop"
    assert body["recent"][0]["score"] == 42

    # not your student -> 404
    other = client.post(
        "/api/auth/signup", json=_signup_payload("nosy@example.com")
    ).json()["access_token"]
    assert client.get(
        f"/api/reports/student/{sid}", headers={"Authorization": f"Bearer {other}"}
    ).status_code == 404
