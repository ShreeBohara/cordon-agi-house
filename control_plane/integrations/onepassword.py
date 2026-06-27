"""Real 1Password integration (GA Service Account + SDK).

The 1Password SDK is async, but CORDON's broker is sync and may be called from
inside FastAPI's event loop. We bridge with a dedicated background event loop in
its own thread: the SDK client is created and used only on that loop, and the
sync side blocks on the result via ``run_coroutine_threadsafe``. This is safe
whether or not the caller already has a running loop.

``revoke()`` is a logged no-op: 1Password has no programmatic token revoke (that
is a UI action). CORDON's deterministic "revoke" is the broker refusing to
resolve for tainted/quarantined agents — see broker.py / quarantine.py.
"""
from __future__ import annotations

import asyncio
import os
import threading

from control_plane import config  # noqa: F401  (import triggers .env loading)

_INTEGRATION = "CORDON"
_VERSION = "v1.0.0"


def is_configured() -> bool:
    return bool(os.getenv("OP_SERVICE_ACCOUNT_TOKEN"))


class _Bridge:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._client = None
        self._lock = threading.Lock()

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is not None:
            return self._loop
        with self._lock:
            if self._loop is None:
                loop = asyncio.new_event_loop()
                threading.Thread(target=loop.run_forever, daemon=True, name="op-bridge").start()
                self._loop = loop
        return self._loop

    def _submit(self, coro):
        loop = self._ensure_loop()
        return asyncio.run_coroutine_threadsafe(coro, loop).result()

    async def _resolve(self, ref: str) -> str:
        if self._client is None:
            from onepassword.client import Client

            token = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
            if not token:
                raise RuntimeError("OP_SERVICE_ACCOUNT_TOKEN not set")
            self._client = await Client.authenticate(
                auth=token, integration_name=_INTEGRATION, integration_version=_VERSION
            )
        return await self._client.secrets.resolve(ref)

    def resolve(self, ref: str) -> str:
        return self._submit(self._resolve(ref))


_bridge = _Bridge()


def resolve(secret_ref: str) -> str:
    """Resolve a secret reference to its value (blocking). Injected into the broker."""
    return _bridge.resolve(secret_ref)


def revoke(agent_id: str) -> None:
    """No programmatic revoke exists in 1Password; the deterministic revoke is
    broker-deny. This is a logged no-op kept for interface symmetry."""
    return None
