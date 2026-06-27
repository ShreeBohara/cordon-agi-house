"""The cascade quarantine engine — contact tracing in infection order.

Given a confirmed patient zero, compute the exposed set from the contact graph
and, for each agent in topological order, revoke its credential (broker-deny)
and freeze its sandbox (stubbed in Phase 1, real Daytona in Phase 2). Healthy
agents are never touched.
"""
from __future__ import annotations

from typing import Callable, Optional


def _stub_freeze(agent_id: str, sandbox_id: Optional[str]) -> None:
    """Phase-1 stand-in for Daytona ``sandbox.stop()`` + network block."""
    return None


class QuarantineEngine:
    def __init__(self, taint, graph, bus, broker, recorder=None, freezer: Callable = _stub_freeze) -> None:
        self.taint = taint
        self.graph = graph
        self.bus = bus
        self.broker = broker
        self.recorder = recorder
        self.freezer = freezer
        self.revoke_calls: list[str] = []  # spies for tests
        self.freeze_calls: list[str] = []

    def quarantine(self, origin: str, confirmed_at: Optional[str] = None, source: Optional[str] = None) -> list[str]:
        order = self.graph.quarantine_order(origin)

        self.bus.publish("quarantine_started",
                         {"patient_zero": origin, "exposed_set": order, "order": order})
        if self.recorder:
            self.recorder.append("quarantine_started", "cordon",
                                 {"patient_zero": origin, "confirmed_at": confirmed_at,
                                  "source": source, "exposed_set": order})

        for i, agent in enumerate(order):
            self.broker.revoke(agent)            # credential revoked (broker-deny)
            self.revoke_calls.append(agent)
            rec = self.taint.get(agent)
            self.freezer(agent, rec.sandbox_id if rec else None)  # sandbox frozen
            self.freeze_calls.append(agent)
            self.taint.quarantine(agent)
            self.bus.publish("agent_quarantined", {
                "agent_id": agent,
                "actions": ["credential_revoked", "sandbox_frozen", "network_blocked"],
                "order_index": i,
            })

        if self.recorder:
            self.recorder.append("quarantine_complete", "cordon", {"quarantined": order})
        return order
