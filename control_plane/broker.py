"""The credential broker — the deterministic gate.

If the requesting agent is tainted and the secret is sensitive, the broker
**denies and never calls the resolver**, so the secret never enters the model's
context. The resolver is stubbed in Phase 1 and swapped for the real 1Password
SDK call in Phase 2 (dependency-injected so the gate logic never changes).
"""
from __future__ import annotations

import uuid
from typing import Callable, Optional


def _stub_resolver(secret_ref: str) -> str:
    """Phase-1 stand-in for 1Password ``client.secrets.resolve(secret_ref)``."""
    return f"STUB_SECRET::{secret_ref}"


class Broker:
    def __init__(self, taint, bus, recorder=None, resolver: Callable[[str], str] = _stub_resolver) -> None:
        self.taint = taint
        self.bus = bus
        self.recorder = recorder
        self.resolver = resolver
        # spy for tests: every resolve, with agent context, so we can assert the
        # core guarantee — no sensitive secret is ever resolved for a tainted agent.
        self.resolve_calls: list[dict] = []

    def request(self, agent_id: str, secret_ref: str, sensitive: bool) -> dict:
        self.bus.publish("credential_requested",
                         {"agent_id": agent_id, "secret_ref": secret_ref, "sensitive": sensitive})

        if self.taint.is_quarantined(agent_id):
            return self._deny(agent_id, secret_ref, sensitive, "agent is quarantined")
        if sensitive and self.taint.is_tainted(agent_id):
            srcs = ", ".join(self.taint.sources(agent_id)) or "untrusted source"
            return self._deny(agent_id, secret_ref, sensitive, f"requesting agent is tainted (provenance: {srcs})")

        # allow path — resolve happens here and ONLY here
        self.resolve_calls.append({"agent_id": agent_id, "secret_ref": secret_ref, "sensitive": sensitive})
        value = self.resolver(secret_ref)
        token_id = "tok_" + uuid.uuid4().hex[:8]
        self.bus.publish("credential_issued", {
            "agent_id": agent_id, "secret_ref": secret_ref, "sensitive": sensitive,
            "token_id": token_id, "onepassword_queried": True,
        })
        rec = self.taint.get(agent_id)
        if rec and secret_ref not in rec.held_credentials:
            rec.held_credentials.append(secret_ref)
        # value is returned to the caller but NEVER published on the bus
        return {"decision": "issued", "token_id": token_id, "value": value}

    @property
    def resolved_refs(self) -> list[str]:
        return [c["secret_ref"] for c in self.resolve_calls]

    def revoke(self, agent_id: str) -> None:
        """The deterministic 'revoke': quarantine the agent so future requests are denied.
        (Real 1Password token revoke is a UI action; this is the broker-deny model.)"""
        self.taint.quarantine(agent_id)

    def _deny(self, agent_id: str, secret_ref: str, sensitive: bool, reason: str) -> dict:
        data = {"agent_id": agent_id, "secret_ref": secret_ref, "sensitive": sensitive,
                "reason": reason, "onepassword_queried": False}
        self.bus.publish("credential_denied", data)
        if self.recorder:
            self.recorder.append("credential_denied", "broker",
                                 {"agent_id": agent_id, "secret_ref": secret_ref, "onepassword_queried": False})
        return {"decision": "denied", **data}
