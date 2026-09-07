"""In-memory pairing rooms for the trainer remote control.

A "room" is one headset paired with one trainer console. The headset registers
a room and shows the short code; the trainer types that code on their phone.
From then on the console pushes commands into the room and the headset pulls
them, while the headset pushes back its state (and a small mirror frame of what
the child is looking at) for the console to display.

Deliberately *not* in the database. A pairing is worth nothing once the session
is over — it is short-lived, high-churn, and read every second by both sides,
which is the opposite of what the Postgres tables here are for. The cost is
that the state lives in one process: run the API with a single worker (the
default `uvicorn app.main:app`), or two workers will hand out rooms neither can
see. Nothing else in the app depends on this, so a restart mid-session costs a
re-pair, not data.

Rooms are always scoped to the mentor account that created them — `get()`
refuses a code belonging to a different account — so knowing a code is not by
itself enough to drive somebody else's headset.
"""
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field
from typing import Any

# No 0/O/1/I/5/S: the code is read off a headset screen and typed on a phone,
# often by someone mid-session with a child waiting.
CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXYZ2346789"
CODE_LENGTH = 6

#: A room with no traffic from either side for this long is dropped.
ROOM_TTL_SECONDS = 6 * 60 * 60
#: A side that has not called in for this long counts as offline.
ONLINE_WINDOW_SECONDS = 15.0
#: Commands kept per room. The headset acknowledges by sequence number, so this
#: only has to cover a client that fell behind, not the whole session.
MAX_COMMANDS = 64
#: Rooms one mentor may hold at once — a trainer with several headsets is
#: normal, a client re-registering in a loop is not.
MAX_ROOMS_PER_OWNER = 8


class RoomNotFound(Exception):
    """No such code, or it belongs to another mentor (indistinguishable on purpose)."""


@dataclass
class Command:
    seq: int
    type: str
    payload: dict[str, Any]
    created_at: float

    def as_dict(self) -> dict[str, Any]:
        return {"seq": self.seq, "type": self.type, "payload": self.payload}


@dataclass
class Frame:
    """One mirror image of the headset view, as a data URL."""

    data: str
    rev: int
    created_at: float


@dataclass
class Room:
    code: str
    owner_id: str
    created_at: float
    commands: list[Command] = field(default_factory=list)
    next_seq: int = 1
    state: dict[str, Any] = field(default_factory=dict)
    state_rev: int = 0
    frame: Frame | None = None
    headset_seen: float = 0.0
    console_seen: float = 0.0

    @property
    def last_seq(self) -> int:
        return self.next_seq - 1

    def touched_at(self) -> float:
        return max(self.created_at, self.headset_seen, self.console_seen)

    def headset_online(self, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        return now - self.headset_seen <= ONLINE_WINDOW_SECONDS

    def console_online(self, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        return now - self.console_seen <= ONLINE_WINDOW_SECONDS


class RoomRegistry:
    """Every live pairing in this process, keyed by code."""

    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    # --- lifecycle ---------------------------------------------------------
    def create(self, owner_id: str) -> Room:
        self.purge()
        self._enforce_owner_limit(owner_id)
        code = self._fresh_code()
        room = Room(code=code, owner_id=owner_id, created_at=time.time())
        room.headset_seen = room.created_at
        self._rooms[code] = room
        return room

    def get(self, code: str, owner_id: str) -> Room:
        room = self._rooms.get(_normalise(code))
        if room is None or room.owner_id != owner_id:
            raise RoomNotFound(code)
        return room

    def close(self, code: str, owner_id: str) -> None:
        room = self.get(code, owner_id)
        self._rooms.pop(room.code, None)

    def purge(self, now: float | None = None) -> int:
        """Drop rooms nobody has touched in `ROOM_TTL_SECONDS`. Returns the count."""
        now = time.time() if now is None else now
        stale = [c for c, r in self._rooms.items() if now - r.touched_at() > ROOM_TTL_SECONDS]
        for code in stale:
            del self._rooms[code]
        return len(stale)

    # --- traffic -----------------------------------------------------------
    def push_command(self, room: Room, type_: str, payload: dict[str, Any] | None) -> Command:
        command = Command(
            seq=room.next_seq,
            type=type_,
            payload=payload or {},
            created_at=time.time(),
        )
        room.next_seq += 1
        room.commands.append(command)
        del room.commands[:-MAX_COMMANDS]
        room.console_seen = command.created_at
        return command

    def commands_after(self, room: Room, after: int) -> list[Command]:
        return [c for c in room.commands if c.seq > after]

    def set_state(
        self,
        room: Room,
        state: dict[str, Any],
        frame: str | None = None,
    ) -> Room:
        room.state = state
        room.state_rev += 1
        room.headset_seen = time.time()
        if frame is not None:
            room.frame = Frame(data=frame, rev=room.state_rev, created_at=room.headset_seen)
        return room

    def mark_console(self, room: Room) -> None:
        room.console_seen = time.time()

    def mark_headset(self, room: Room) -> None:
        room.headset_seen = time.time()

    # --- internals ---------------------------------------------------------
    def _fresh_code(self) -> str:
        for _ in range(64):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self._rooms:
                return code
        raise RuntimeError("could not allocate a free pairing code")

    def _enforce_owner_limit(self, owner_id: str) -> None:
        mine = sorted(
            (r for r in self._rooms.values() if r.owner_id == owner_id),
            key=lambda r: r.touched_at(),
        )
        for room in mine[: max(0, len(mine) - (MAX_ROOMS_PER_OWNER - 1))]:
            self._rooms.pop(room.code, None)

    def __len__(self) -> int:  # pragma: no cover - diagnostics only
        return len(self._rooms)


def _normalise(code: str) -> str:
    return (code or "").strip().upper()


#: The process-wide registry used by the router.
rooms = RoomRegistry()
