"""The taint store: per-agent provenance state.

Taint is **monotonic** within a run (once tainted, never clean again) and is a
fact by construction (we labeled the channel), not a guess about content.
"""
from __future__ import annotations

from typing import Optional

from control_plane.models import AgentStatus, TaintStateRecord

# Statuses that the broker treats as "do not hand this agent a sensitive secret".
_TAINTED_STATES = {AgentStatus.TAINTED, AgentStatus.COMPROMISED, AgentStatus.QUARANTINED}


class TaintStore:
    def __init__(self) -> None:
        self._agents: dict[str, TaintStateRecord] = {}

    def register(
        self,
        agent_id: str,
        sandbox_id: Optional[str] = None,
        credential: Optional[str] = None,
    ) -> TaintStateRecord:
        rec = self._agents.get(agent_id)
        if rec is None:
            rec = TaintStateRecord(agent_id=agent_id, sandbox_id=sandbox_id)
            self._agents[agent_id] = rec
        if sandbox_id is not None:
            rec.sandbox_id = sandbox_id
        if credential and credential not in rec.held_credentials:
            rec.held_credentials.append(credential)
        return rec

    def mark_tainted(self, agent_id: str, source: str) -> TaintStateRecord:
        rec = self.register(agent_id)
        if rec.status == AgentStatus.HEALTHY:  # monotonic: never downgrade
            rec.status = AgentStatus.TAINTED
        if source not in rec.taint_sources:
            rec.taint_sources.append(source)
        return rec

    def mark_compromised(self, agent_id: str) -> TaintStateRecord:
        rec = self.register(agent_id)
        if rec.status != AgentStatus.QUARANTINED:
            rec.status = AgentStatus.COMPROMISED
        return rec

    def quarantine(self, agent_id: str) -> TaintStateRecord:
        rec = self.register(agent_id)
        rec.status = AgentStatus.QUARANTINED
        return rec

    # --- queries ---
    def is_tainted(self, agent_id: str) -> bool:
        rec = self._agents.get(agent_id)
        return rec is not None and rec.status in _TAINTED_STATES

    def is_quarantined(self, agent_id: str) -> bool:
        rec = self._agents.get(agent_id)
        return rec is not None and rec.status == AgentStatus.QUARANTINED

    def status(self, agent_id: str) -> Optional[AgentStatus]:
        rec = self._agents.get(agent_id)
        return rec.status if rec else None

    def sources(self, agent_id: str) -> list[str]:
        rec = self._agents.get(agent_id)
        return list(rec.taint_sources) if rec else []

    def get(self, agent_id: str) -> Optional[TaintStateRecord]:
        return self._agents.get(agent_id)

    def all(self) -> dict[str, TaintStateRecord]:
        return dict(self._agents)
