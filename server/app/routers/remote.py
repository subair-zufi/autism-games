"""Relay for the trainer remote control.

The child is in the headset; the trainer holds a phone. This is the pipe
between them: the console POSTs commands, the headset GETs them, the headset
POSTs its state and a mirror frame, the console GETs those. Nothing here knows
what a command *means* — the shared protocol lives in the frontend
(`src/remote/protocol.ts`), so adding a control does not need a server deploy.

Both ends authenticate as the same mentor account (`get_current_user`), and a
room is only ever handed back to the account that created it, so a guessed code
gets a 404 rather than somebody else's headset.

Reads are long-polled: pass `wait` and the request parks until there is
something to return or the timeout expires. Plain polling with a short sleep,
not an event/condition — with two clients per room the wakeups are free, and it
cannot deadlock or drop a notification the way a shared `asyncio.Event` can.
"""
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import get_current_user
from ..models import User
from ..remote_rooms import ROOM_TTL_SECONDS, RoomNotFound, rooms
from ..schemas import (
    RemoteCommandIn,
    RemoteCommandOut,
    RemoteCommandsOut,
    RemoteRoomOut,
    RemoteStateIn,
    RemoteStateOut,
)

router = APIRouter(prefix="/api/remote", tags=["remote"])

#: Longest a long-poll may park. Comfortably under the 30-60s idle timeout of
#: the proxies this runs behind (Railway, ngrok, a phone's mobile network).
MAX_WAIT_SECONDS = 25.0
#: How often a parked request re-checks the room.
POLL_INTERVAL_SECONDS = 0.25
#: Ceiling on one mirror frame. A 512x288 JPEG at the quality the headset
#: sends lands around 20-40 KB; this leaves room for a bad frame without
#: letting a client push megabytes through the relay.
MAX_FRAME_CHARS = 400_000

_ROOM_404 = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="No live pairing with that code.",
)


def _room(code: str, user: User):
    try:
        return rooms.get(code, str(user.id))
    except RoomNotFound:
        raise _ROOM_404


@router.post("/rooms", response_model=RemoteRoomOut, status_code=status.HTTP_201_CREATED)
def open_room(user: User = Depends(get_current_user)) -> RemoteRoomOut:
    """Headset: register a pairing and get the code to show on screen."""
    room = rooms.create(str(user.id))
    return RemoteRoomOut(code=room.code, expires_in=ROOM_TTL_SECONDS)


@router.post("/rooms/{code}/join", response_model=RemoteRoomOut)
def join_room(code: str, user: User = Depends(get_current_user)) -> RemoteRoomOut:
    """Console: attach to a code the trainer typed in."""
    room = _room(code, user)
    rooms.mark_console(room)
    return RemoteRoomOut(
        code=room.code,
        expires_in=ROOM_TTL_SECONDS,
        state=room.state,
        state_rev=room.state_rev,
        last_seq=room.last_seq,
    )


@router.delete("/rooms/{code}", status_code=status.HTTP_204_NO_CONTENT)
def close_room(code: str, user: User = Depends(get_current_user)) -> None:
    """Either end: drop the pairing (the headset's "unpair", or a finished session)."""
    room = _room(code, user)
    rooms.close(room.code, str(user.id))


@router.post("/rooms/{code}/commands", response_model=RemoteCommandOut, status_code=status.HTTP_201_CREATED)
def push_command(
    code: str,
    data: RemoteCommandIn,
    user: User = Depends(get_current_user),
) -> RemoteCommandOut:
    """Console: queue one instruction for the headset."""
    room = _room(code, user)
    command = rooms.push_command(room, data.type, data.payload)
    return RemoteCommandOut(**command.as_dict())


@router.get("/rooms/{code}/commands", response_model=RemoteCommandsOut)
async def pull_commands(
    code: str,
    after: int = Query(0, ge=0),
    wait: float = Query(0.0, ge=0.0, le=MAX_WAIT_SECONDS),
    user: User = Depends(get_current_user),
) -> RemoteCommandsOut:
    """Headset: everything queued since `after`, parking up to `wait` seconds."""
    room = _room(code, user)
    rooms.mark_headset(room)
    deadline = asyncio.get_running_loop().time() + wait
    pending = rooms.commands_after(room, after)
    while not pending and asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        # Re-resolve: the room may have been closed or evicted while parked.
        room = _room(code, user)
        rooms.mark_headset(room)
        pending = rooms.commands_after(room, after)
    return RemoteCommandsOut(
        commands=[RemoteCommandOut(**c.as_dict()) for c in pending],
        last_seq=room.last_seq,
        console_online=room.console_online(),
    )


@router.post("/rooms/{code}/state", response_model=RemoteStateOut)
def push_state(
    code: str,
    data: RemoteStateIn,
    user: User = Depends(get_current_user),
) -> RemoteStateOut:
    """Headset: publish what it is showing, and optionally a mirror frame."""
    room = _room(code, user)
    if data.frame is not None and len(data.frame) > MAX_FRAME_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Mirror frame too large.",
        )
    rooms.set_state(room, data.state, data.frame)
    return _state_out(room, want_frame=False)


@router.get("/rooms/{code}/state", response_model=RemoteStateOut)
async def pull_state(
    code: str,
    after: int = Query(0, ge=0),
    wait: float = Query(0.0, ge=0.0, le=MAX_WAIT_SECONDS),
    frame: bool = Query(True),
    frame_after: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
) -> RemoteStateOut:
    """Console: the headset's current state, parking until it changes.

    `frame_after` is the revision of the mirror image the console already has:
    an unchanged view then costs nothing instead of re-sending the same JPEG
    every second, which over a phone's mobile data is the difference between a
    trickle and a stream.
    """
    room = _room(code, user)
    rooms.mark_console(room)
    deadline = asyncio.get_running_loop().time() + wait
    while room.state_rev <= after and asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        room = _room(code, user)
        rooms.mark_console(room)
    return _state_out(room, want_frame=frame, frame_after=frame_after)


def _state_out(room, want_frame: bool, frame_after: int = 0) -> RemoteStateOut:
    fresh_frame = bool(room.frame and room.frame.rev > frame_after)
    return RemoteStateOut(
        state=room.state,
        state_rev=room.state_rev,
        frame=room.frame.data if (want_frame and fresh_frame and room.frame) else None,
        frame_rev=room.frame.rev if room.frame else 0,
        headset_online=room.headset_online(),
        last_seq=room.last_seq,
    )
