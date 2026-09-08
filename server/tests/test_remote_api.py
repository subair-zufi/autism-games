"""HTTP-level tests for the trainer remote-control relay.

The relay keeps its pairings in memory and never touches the database, so the
mentor identity is stubbed with a dependency override and these run without
Postgres — unlike test_flow.py.
"""
import os
import uuid
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("ADMIN_PASSWORD", "admin-pass-123")

from app.deps import get_current_user  # noqa: E402
from app.main import app  # noqa: E402
from app.remote_rooms import rooms  # noqa: E402


@dataclass
class FakeUser:
    id: uuid.UUID


MENTOR = FakeUser(id=uuid.uuid4())
OTHER_MENTOR = FakeUser(id=uuid.uuid4())


@pytest.fixture()
def as_mentor():
    """A client authenticated as MENTOR, with a clean room registry."""
    rooms._rooms.clear()
    current = {"user": MENTOR}
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    # No context manager: the app's lifespan creates database tables, which is
    # exactly what these tests do not need.
    client = TestClient(app)
    client.become = lambda user: current.update(user=user)  # type: ignore[attr-defined]
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        rooms._rooms.clear()


def _open(client) -> str:
    res = client.post("/api/remote/rooms")
    assert res.status_code == 201
    return res.json()["code"]


def test_pair_and_drive_a_headset(as_mentor) -> None:
    code = _open(as_mentor)

    joined = as_mentor.post(f"/api/remote/rooms/{code}/join")
    assert joined.status_code == 200
    assert joined.json()["last_seq"] == 0

    pushed = as_mentor.post(
        f"/api/remote/rooms/{code}/commands",
        json={"type": "goto", "payload": {"gameId": "park360", "level": "medium"}},
    )
    assert pushed.status_code == 201
    assert pushed.json()["seq"] == 1

    pulled = as_mentor.get(f"/api/remote/rooms/{code}/commands?after=0").json()
    assert [c["type"] for c in pulled["commands"]] == ["goto"]
    assert pulled["commands"][0]["payload"]["level"] == "medium"
    assert pulled["console_online"] is True
    # Each command says how old it is, so a headset that has been asleep can
    # decline to act on instructions from several minutes ago.
    assert pulled["commands"][0]["age_ms"] < 5000

    # Acknowledged — the headset does not run it twice.
    again = as_mentor.get(f"/api/remote/rooms/{code}/commands?after=1").json()
    assert again["commands"] == []


def test_state_and_mirror_frame_round_trip(as_mentor) -> None:
    code = _open(as_mentor)
    frame = "data:image/jpeg;base64,AAAABBBB"

    posted = as_mentor.post(
        f"/api/remote/rooms/{code}/state",
        json={"state": {"route": "/park-360", "vrActive": True}, "frame": frame},
    )
    assert posted.status_code == 200
    assert posted.json()["state_rev"] == 1
    # The headset's own response never carries the frame back to it.
    assert posted.json()["frame"] is None

    seen = as_mentor.get(f"/api/remote/rooms/{code}/state?after=0").json()
    assert seen["state"]["route"] == "/park-360"
    assert seen["frame"] == frame
    assert seen["headset_online"] is True

    # The console can ask for state without paying for the image.
    lean = as_mentor.get(f"/api/remote/rooms/{code}/state?after=0&frame=false").json()
    assert lean["frame"] is None
    assert lean["state_rev"] == 1


def test_an_unchanged_view_is_not_sent_twice(as_mentor) -> None:
    code = _open(as_mentor)
    as_mentor.post(
        f"/api/remote/rooms/{code}/state",
        json={"state": {}, "frame": "data:image/jpeg;base64,FIRST"},
    )

    first = as_mentor.get(f"/api/remote/rooms/{code}/state?after=0").json()
    assert first["frame"] == "data:image/jpeg;base64,FIRST"
    assert first["frame_rev"] == 1

    # The console says which frame it already has; the same one costs nothing.
    again = as_mentor.get(f"/api/remote/rooms/{code}/state?after=0&frame_after=1").json()
    assert again["frame"] is None
    assert again["frame_rev"] == 1

    as_mentor.post(
        f"/api/remote/rooms/{code}/state",
        json={"state": {}, "frame": "data:image/jpeg;base64,SECOND"},
    )
    fresh = as_mentor.get(f"/api/remote/rooms/{code}/state?after=0&frame_after=1").json()
    assert fresh["frame"] == "data:image/jpeg;base64,SECOND"
    assert fresh["frame_rev"] == 2


def test_oversized_frame_is_rejected(as_mentor) -> None:
    code = _open(as_mentor)
    res = as_mentor.post(
        f"/api/remote/rooms/{code}/state",
        json={"state": {}, "frame": "x" * 400_001},
    )
    assert res.status_code == 413


def test_long_poll_returns_promptly_when_nothing_happens(as_mentor) -> None:
    code = _open(as_mentor)
    res = as_mentor.get(f"/api/remote/rooms/{code}/commands?after=0&wait=0.5")
    assert res.status_code == 200
    assert res.json()["commands"] == []


def test_another_mentor_gets_a_404_not_somebody_elses_headset(as_mentor) -> None:
    code = _open(as_mentor)
    as_mentor.become(OTHER_MENTOR)

    assert as_mentor.post(f"/api/remote/rooms/{code}/join").status_code == 404
    assert (
        as_mentor.post(
            f"/api/remote/rooms/{code}/commands", json={"type": "quit", "payload": {}}
        ).status_code
        == 404
    )
    assert as_mentor.get(f"/api/remote/rooms/{code}/state").status_code == 404


def test_unknown_code_is_404(as_mentor) -> None:
    assert as_mentor.post("/api/remote/rooms/ZZZZZZ/join").status_code == 404


def test_closing_a_pairing_ends_it(as_mentor) -> None:
    code = _open(as_mentor)
    assert as_mentor.delete(f"/api/remote/rooms/{code}").status_code == 204
    assert as_mentor.post(f"/api/remote/rooms/{code}/join").status_code == 404
