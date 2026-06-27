"""In-process pub/sub event bus that feeds the SSE stream.

Anything in the control plane calls ``bus.publish(event_type, data)``; the SSE
endpoint subscribes with ``bus.subscribe()``. The bus owns the envelope: it
assigns the monotonic ``seq`` and the ``ts``, validates the payload against the
contract, and normalizes it (defaults filled, enums -> values) so the wire format
exactly matches EVENT_CONTRACT.md.

publish() is synchronous (``put_nowait``) so the broker / quarantine / recorder
can stay plain sync functions and remain trivially unit-testable.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pydantic import BaseModel

from control_plane.models import EventType, validate_event_data


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class EventBus:
    def __init__(self, validate: bool = True, history_limit: int = 2000):
        self._subs: set[asyncio.Queue] = set()
        self._seq = 0
        self._validate = validate
        self._history_limit = history_limit
        self.history: list[dict] = []

    # --- subscription (SSE side) ---
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    # --- publication (control-plane side) ---
    def publish(self, event_type, data) -> dict:
        et = event_type if isinstance(event_type, EventType) else EventType(event_type)
        payload = data.model_dump(mode="json") if isinstance(data, BaseModel) else dict(data)
        if self._validate:
            payload = validate_event_data(et, payload).model_dump(mode="json")

        self._seq += 1
        env = {"event": et.value, "seq": self._seq, "ts": now_iso(), "data": payload}

        self.history.append(env)
        if len(self.history) > self._history_limit:
            self.history = self.history[-self._history_limit:]

        for q in list(self._subs):
            try:
                q.put_nowait(env)
            except asyncio.QueueFull:  # pragma: no cover - unbounded queues by default
                pass
        return env

    @property
    def seq(self) -> int:
        return self._seq

    def clear(self) -> None:
        self._seq = 0
        self.history.clear()
