"""Unit tests for the in-memory remote-control pairing registry.

Pure logic — no database, so these run everywhere (unlike test_flow.py).
"""
import time

import pytest

from app.remote_rooms import (
    CODE_ALPHABET,
    CODE_LENGTH,
    MAX_COMMANDS,
    MAX_ROOMS_PER_OWNER,
    ROOM_TTL_SECONDS,
    RoomNotFound,
    RoomRegistry,
)

MENTOR = "mentor-1"
OTHER = "mentor-2"


@pytest.fixture()
def registry() -> RoomRegistry:
    return RoomRegistry()


def test_code_is_readable_and_unique(registry: RoomRegistry) -> None:
    codes = {registry.create(MENTOR).code for _ in range(5)}
    assert len(codes) == 5
    for code in codes:
        assert len(code) == CODE_LENGTH
        assert set(code) <= set(CODE_ALPHABET)
        # No characters that get misread off a headset screen.
        assert not set(code) & set("O0I1S5")


def test_code_lookup_is_case_and_space_insensitive(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    assert registry.get(f"  {room.code.lower()} ", MENTOR) is room


def test_another_mentor_cannot_open_a_room_they_know_the_code_of(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    with pytest.raises(RoomNotFound):
        registry.get(room.code, OTHER)


def test_unknown_code_raises(registry: RoomRegistry) -> None:
    with pytest.raises(RoomNotFound):
        registry.get("ZZZZZZ", MENTOR)


def test_commands_are_delivered_once_in_order(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    registry.push_command(room, "goto", {"gameId": "park360"})
    registry.push_command(room, "setLevel", {"level": "hard"})

    first = registry.commands_after(room, 0)
    assert [c.type for c in first] == ["goto", "setLevel"]
    assert [c.seq for c in first] == [1, 2]
    # Acknowledged up to the last seq: nothing repeats.
    assert registry.commands_after(room, first[-1].seq) == []

    registry.push_command(room, "quit", {})
    assert [c.type for c in registry.commands_after(room, 2)] == ["quit"]


def test_command_history_is_capped_but_sequence_keeps_climbing(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    for i in range(MAX_COMMANDS + 10):
        registry.push_command(room, "ping", {"i": i})
    assert len(room.commands) == MAX_COMMANDS
    assert room.last_seq == MAX_COMMANDS + 10
    # A console that never fell behind still sees only what is new.
    assert registry.commands_after(room, room.last_seq) == []


def test_state_revision_advances_and_frame_is_kept(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    registry.set_state(room, {"route": "/"}, frame=None)
    assert room.state_rev == 1
    assert room.frame is None

    registry.set_state(room, {"route": "/park-360"}, frame="data:image/jpeg;base64,AAAA")
    assert room.state_rev == 2
    assert room.frame is not None and room.frame.rev == 2

    # A state push without a frame leaves the last frame in place, so the
    # console keeps showing the view instead of blanking between frames.
    registry.set_state(room, {"route": "/park-360", "score": 3}, frame=None)
    assert room.state_rev == 3
    assert room.frame is not None and room.frame.rev == 2


def test_presence_windows(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    assert room.headset_online() is True
    assert room.console_online() is False

    registry.mark_console(room)
    assert room.console_online() is True

    room.headset_seen = time.time() - 3600
    assert room.headset_online() is False


def test_idle_rooms_are_purged(registry: RoomRegistry) -> None:
    fresh = registry.create(MENTOR)
    stale = registry.create(MENTOR)
    stale.created_at = stale.headset_seen = time.time() - ROOM_TTL_SECONDS - 1

    assert registry.purge() == 1
    assert registry.get(fresh.code, MENTOR) is fresh
    with pytest.raises(RoomNotFound):
        registry.get(stale.code, MENTOR)


def test_one_mentor_cannot_hoard_rooms(registry: RoomRegistry) -> None:
    made = [registry.create(MENTOR) for _ in range(MAX_ROOMS_PER_OWNER + 3)]
    assert len(registry) == MAX_ROOMS_PER_OWNER
    # The most recent pairings survive; the oldest are dropped.
    for room in made[-MAX_ROOMS_PER_OWNER:]:
        assert registry.get(room.code, MENTOR) is room
    with pytest.raises(RoomNotFound):
        registry.get(made[0].code, MENTOR)


def test_close_removes_the_room(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    registry.close(room.code, MENTOR)
    with pytest.raises(RoomNotFound):
        registry.get(room.code, MENTOR)


def test_commands_carry_their_age_so_a_stale_one_can_be_ignored(registry: RoomRegistry) -> None:
    room = registry.create(MENTOR)
    command = registry.push_command(room, "quit", {})

    assert command.as_dict()["age_ms"] < 1000

    # A headset that was asleep for two minutes must be able to tell that this
    # instruction is no longer worth carrying out.
    command.created_at = time.time() - 120
    assert command.as_dict()["age_ms"] >= 120_000
