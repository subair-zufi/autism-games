"""The per-session user-experience record: saving, correcting, and exporting.

Requires PostgreSQL via TEST_DATABASE_URL (see test_flow.py) — the model uses a
JSONB column, so SQLite cannot stand in.
"""
import csv
import io
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
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


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
    not _db_reachable() or not (os.environ.get("TEST_DATABASE_URL") or _looks_like_test_db(settings.database_url)),
    reason="Needs an isolated PostgreSQL test database (TEST_DATABASE_URL).",
)


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def trainer(client):
    """A signed-in mentor with one participant to record against."""
    token = client.post(
        "/api/auth/signup",
        json={"email": "trainer@example.com", "password": "secret123", "full_name": "Trainer"},
    ).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    student = client.post(
        "/api/students",
        json={"full_name": "Child One", "participant_code": "P-001"},
        headers=h,
    ).json()
    return h, student["id"]


def _form(student_id: str, **over):
    body = {
        "student_id": student_id,
        "visit_date": "2026-09-01",
        "games_played": ["museum360", "park360"],
        "minutes": 18,
        "child_fun": 5,
        "child_feeling": 4,
        "child_play_again": "yes",
        "rated_engagement": 4,
        "rated_independence": 2,
        "rated_comfort": 5,
        "rated_enjoyment": 4,
        "rated_willingness": 5,
        "went_well": "Settled quickly.",
        "was_difficult": "Needed help with the controller.",
        "different_from_last": "Put the headset on without protest this time.",
    }
    body.update(over)
    return body


def test_requires_auth(client, trainer):
    _, student_id = trainer
    r = client.post("/api/session-experience", json=_form(student_id))
    assert r.status_code in (401, 403)


def test_saves_a_record(client, trainer):
    h, student_id = trainer
    r = client.post("/api/session-experience", json=_form(student_id), headers=h)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["child_play_again"] == "yes"
    assert body["games_played"] == ["museum360", "park360"]
    assert body["rated_independence"] == 2
    assert body["stopped_early"] is False


def test_resubmitting_the_same_visit_updates_in_place(client, trainer):
    """The console re-sends a queued record after the Wi-Fi returns without
    knowing whether the first attempt landed, so a repeat must not duplicate."""
    h, student_id = trainer
    client.post("/api/session-experience", json=_form(student_id), headers=h)
    r = client.post(
        "/api/session-experience", json=_form(student_id, child_fun=3, went_well="Corrected."), headers=h
    )
    assert r.status_code == 201, r.text

    rows = client.get(f"/api/session-experience?student_id={student_id}", headers=h).json()
    same_visit = [x for x in rows if x["visit_date"] == "2026-09-01" and x["rater_id"] == ""]
    assert len(same_visit) == 1
    assert same_visit[0]["child_fun"] == 3
    assert same_visit[0]["went_well"] == "Corrected."


def test_second_rater_is_a_separate_row(client, trainer):
    """The reliability subsample needs two independent ratings of one visit."""
    h, student_id = trainer
    r = client.post(
        "/api/session-experience",
        json=_form(student_id, rater_id="coder-2", is_second_rating=True, rated_engagement=3),
        headers=h,
    )
    assert r.status_code == 201, r.text

    rows = client.get(f"/api/session-experience?student_id={student_id}", headers=h).json()
    on_that_day = [x for x in rows if x["visit_date"] == "2026-09-01"]
    assert {x["rater_id"] for x in on_that_day} == {"", "coder-2"}


def test_a_stopped_session_still_saves(client, trainer):
    """A session cut short by the stop rule has no fun rating to give. Losing
    the record over that would discard exactly the sessions the acceptability
    objective most needs."""
    h, student_id = trainer
    r = client.post(
        "/api/session-experience",
        json={
            "student_id": student_id,
            "visit_date": "2026-09-03",
            "child_feeling": 2,
            "stopped_early": True,
            "stop_reason": "Said their tummy felt bad at eight minutes.",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert r.json()["stopped_early"] is True
    assert r.json()["child_fun"] is None


def test_rejects_an_out_of_range_rating(client, trainer):
    h, student_id = trainer
    r = client.post("/api/session-experience", json=_form(student_id, child_fun=7), headers=h)
    assert r.status_code == 422


def test_rejects_an_unknown_play_again_answer(client, trainer):
    h, student_id = trainer
    r = client.post(
        "/api/session-experience", json=_form(student_id, child_play_again="probably"), headers=h
    )
    assert r.status_code == 422


def test_cannot_record_against_another_mentors_child(client, trainer):
    _, student_id = trainer
    other = client.post(
        "/api/auth/signup",
        json={"email": "other@example.com", "password": "secret123", "full_name": "Other"},
    ).json()["access_token"]
    r = client.post(
        "/api/session-experience",
        json=_form(student_id),
        headers={"Authorization": f"Bearer {other}"},
    )
    assert r.status_code == 404


def test_export_numbers_the_visits_and_codes_play_again(client, trainer):
    """visit_index is the x-axis of every across-session plot, and
    play_again_num makes the Again-Again item directly plottable."""
    h, student_id = trainer
    client.post("/api/session-experience", json=_form(student_id), headers=h)
    client.post(
        "/api/session-experience",
        json=_form(student_id, visit_date="2026-09-05", child_play_again="maybe"),
        headers=h,
    )

    admin_token = client.post(
        "/api/admin/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    ).json()["access_token"]
    csv_text = client.get(
        "/api/admin/export/session_ux.csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).text

    # Parse as CSV, not by splitting on commas: the free-text answers are
    # quoted fields that will contain commas in real use.
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    assert "visit_index" in rows[0] and "play_again_num" in rows[0]

    by_date = {r["visit_date"]: r for r in rows if r["rater_id"] == ""}
    assert by_date["2026-09-01"]["visit_index"] == "1"
    assert by_date["2026-09-03"]["visit_index"] == "2"
    assert by_date["2026-09-05"]["visit_index"] == "3"
    assert by_date["2026-09-05"]["play_again_num"] == "1"  # maybe
    # The server issues the participant code; the record carries it so the
    # export keys on the same pseudonym as every other sheet.
    assert by_date["2026-09-01"]["participant_code"].startswith("P-")


def test_export_has_no_total_score_column(client, trainer):
    """Summing the items would assert a single-factor structure this record has
    never been shown to have — the export must not invite it."""
    admin_token = client.post(
        "/api/admin/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    ).json()["access_token"]
    csv_text = client.get(
        "/api/admin/export/session_ux.csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).text
    cols = next(csv.reader(io.StringIO(csv_text)))
    # iq_score is a participant covariate, not a score derived from this record.
    derived = [c for c in cols if c != "iq_score"]
    assert not any("total" in c or "score" in c for c in derived)


# ---------------------------------------------------------------------------
# Client-minted session ids — what lets a device with no network group the
# steps it records offline (see src/services/writeQueue.ts).
# ---------------------------------------------------------------------------
def test_session_accepts_a_client_minted_id(client, trainer):
    h, student_id = trainer
    sid = "11111111-1111-4111-8111-111111111111"
    r = client.post(
        "/api/sessions", json={"id": sid, "game_key": "museum360", "student_id": student_id}, headers=h
    )
    assert r.status_code == 201, r.text
    assert r.json()["id"] == sid


def test_replaying_a_client_minted_session_is_not_an_error(client, trainer):
    """The queue re-sends without knowing whether the first attempt landed."""
    h, student_id = trainer
    sid = "22222222-2222-4222-8222-222222222222"
    body = {"id": sid, "game_key": "park360", "student_id": student_id}

    first = client.post("/api/sessions", json=body, headers=h)
    second = client.post("/api/sessions", json=body, headers=h)

    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["id"] == second.json()["id"] == sid


def test_events_recorded_offline_attach_to_the_replayed_session(client, trainer):
    h, student_id = trainer
    sid = "33333333-3333-4333-8333-333333333333"
    client.post(
        "/api/sessions", json={"id": sid, "game_key": "museum360", "student_id": student_id}, headers=h
    )
    r = client.post(
        "/api/events",
        json={
            "game_key": "museum360",
            "event_type": "answer",
            "student_id": student_id,
            "session_id": sid,
            "payload": {"correct": True},
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert r.json()["session_id"] == sid


def test_a_session_id_belonging_to_someone_else_is_not_taken_over(client, trainer):
    h, student_id = trainer
    sid = "44444444-4444-4444-8444-444444444444"
    client.post(
        "/api/sessions", json={"id": sid, "game_key": "museum360", "student_id": student_id}, headers=h
    )

    intruder = client.post(
        "/api/auth/signup",
        json={"email": "intruder@example.com", "password": "secret123", "full_name": "Nope"},
    ).json()["access_token"]
    r = client.post(
        "/api/sessions",
        json={"id": sid, "game_key": "museum360"},
        headers={"Authorization": f"Bearer {intruder}"},
    )
    # Reported as absent, not as taken: a client must not be able to probe for
    # sessions it cannot see.
    assert r.status_code == 404


def test_a_session_without_an_id_still_gets_one(client, trainer):
    """Every caller that does not mint an id keeps the old behaviour."""
    h, student_id = trainer
    r = client.post("/api/sessions", json={"game_key": "museum360", "student_id": student_id}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["id"]
