"""Real Daytona integration — create agent sandboxes and freeze them on quarantine.

The Daytona Python SDK is synchronous, so (unlike 1Password) no async bridge is
needed. A quarantine "freeze" = block the sandbox's network, then stop it.

``freeze`` only acts on sandboxes this manager actually created (tracked in a
registry), so the demo/headless spine — whose agents have placeholder sandbox ids
— is silently skipped rather than making spurious API calls.
"""
from __future__ import annotations

import os
from typing import Optional

from control_plane import config  # noqa: F401  (import triggers .env loading)


def is_configured() -> bool:
    return bool(os.getenv("DAYTONA_API_KEY"))


class DaytonaManager:
    def __init__(self) -> None:
        self._daytona = None
        self._sandboxes: dict[str, object] = {}  # agent_id -> Sandbox

    def _client(self):
        if self._daytona is None:
            from daytona import Daytona, DaytonaConfig

            self._daytona = Daytona(DaytonaConfig(
                api_key=os.getenv("DAYTONA_API_KEY"),
                api_url=os.getenv("DAYTONA_API_URL") or None,
                target=os.getenv("DAYTONA_TARGET") or None,
            ))
        return self._daytona

    def create_for(self, agent_id: str) -> str:
        """Create a real sandbox for an agent and return its id."""
        sb = self._client().create()
        self._sandboxes[agent_id] = sb
        return sb.id

    def freeze(self, agent_id: str, sandbox_id: Optional[str] = None) -> bool:
        """Network-block + stop the agent's sandbox. Returns True if a real sandbox
        was frozen, False if skipped (no real sandbox for this agent). Never raises."""
        sb = self._sandboxes.get(agent_id)
        if sb is None:
            return False
        try:
            try:
                sb.update_network_settings(network_block_all=True)
            except Exception:
                pass  # network block is best-effort; stopping is the hard guarantee
            self._client().stop(sb)
            return True
        except Exception:
            return False

    def netblock_proof(self, url: str = "https://api.github.com") -> dict:
        """Live proof that Daytona's network block really stops exfiltration:
        create a sandbox, curl out (succeeds), block the network, curl again (fails),
        then destroy the sandbox. Returns the real before/after results + sandbox id."""
        import time

        d = self._client()
        sb = d.create()
        cmd = f"curl -s -m 6 -o /dev/null -w '%{{http_code}}' {url} || echo FAILED"
        result = {"sandbox_id": sb.id, "url": url}
        try:
            before = (getattr(sb.process.exec(cmd), "result", "") or "").strip()
            result["before"] = {"raw": before, "reachable": before[:1] in ("2", "3")}
            sb.update_network_settings(network_block_all=True)
            time.sleep(1.5)
            after = (getattr(sb.process.exec(cmd), "result", "") or "").strip()
            result["after"] = {"raw": after, "blocked": after[:1] not in ("2", "3")}
        finally:
            try:
                d.delete(sb)
            except Exception:
                pass
        return result

    def state(self, sandbox_id: str) -> str:
        try:
            return str(getattr(self._client().get(sandbox_id), "state", "unknown"))
        except Exception as e:
            return f"err:{e}"

    def cleanup(self) -> None:
        for sb in list(self._sandboxes.values()):
            try:
                self._client().delete(sb)
            except Exception:
                pass
        self._sandboxes.clear()


_manager = DaytonaManager()


def manager() -> DaytonaManager:
    return _manager


def freeze(agent_id: str, sandbox_id: Optional[str] = None) -> None:
    """Freezer injected into the QuarantineEngine."""
    _manager.freeze(agent_id, sandbox_id)
