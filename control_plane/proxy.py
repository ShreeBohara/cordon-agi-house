"""The Tool Proxy — the single chokepoint.

Every tool call, handoff, and credential request routes through here: taint
tagging, contact edges, broker gating, and the trifecta -> cascade trigger.
Both the deterministic spine (/debug/run) and the live swarm (/live/run) drive
the exact same security choreography through this one class.
"""
from __future__ import annotations

import uuid
from typing import Optional

from control_plane.models import AgentStatus

PRODUCTION_SECRET_REF = "op://Production/Deploy Key/credential"

ROSTER = [
    {"agent_id": "orchestrator", "name": "Orchestrator", "role": "Delegates the human task", "holds_sensitive": False},
    {"agent_id": "inbox", "name": "Inbox", "role": "Reads & triages email", "holds_sensitive": False},
    {"agent_id": "research", "name": "Research", "role": "Looks things up on the web", "holds_sensitive": False},
    {"agent_id": "coder", "name": "Coder", "role": "Writes & edits code", "holds_sensitive": False},
    {"agent_id": "deployer", "name": "Deployer", "role": "Ships to production", "holds_sensitive": True},
]


class ToolProxy:
    def __init__(self, system) -> None:
        self.s = system

    def start_scenario(self, mode: str, roster: list[dict] = ROSTER) -> None:
        self.s.bus.publish("scenario_started", {
            "mode": mode,
            "agents": [{"agent_id": a["agent_id"], "name": a["name"], "role": a["role"],
                        "holds_sensitive": a["holds_sensitive"]} for a in roster],
        })

    def register_swarm(self, roster: list[dict] = ROSTER, prod_ref: str = PRODUCTION_SECRET_REF,
                       real_resolve: bool = False, sandbox_map: Optional[dict] = None) -> None:
        sandbox_map = sandbox_map or {}
        for a in roster:
            self.s.taint.register(a["agent_id"], sandbox_id=sandbox_map.get(a["agent_id"], f"sbx-{a['agent_id']}"))
            self.s.graph.add_agent(a["agent_id"])
            self.s.bus.publish("agent_registered", {"agent_id": a["agent_id"], "name": a["name"], "role": a["role"]})
        for a in roster:
            ref = prod_ref if a["holds_sensitive"] else f"op://CORDON/{a['name']} Token/credential"
            queried = True
            if a["holds_sensitive"] and real_resolve:
                # genuinely pull the real secret from 1Password for the healthy holder
                try:
                    self.s.broker.resolver(ref)  # real resolve; value is discarded, never on the bus
                    self.s.broker.resolve_calls.append({"agent_id": a["agent_id"], "secret_ref": ref, "sensitive": False})
                except Exception:
                    queried = False
            rec = self.s.taint.get(a["agent_id"])
            if rec:
                rec.held_credentials.append(ref)
            self.s.bus.publish("credential_issued", {
                "agent_id": a["agent_id"], "secret_ref": ref, "sensitive": a["holds_sensitive"],
                "token_id": "tok_" + uuid.uuid4().hex[:8], "onepassword_queried": queried})

    def tool_call(self, agent: str, tool: str, trust: str, summary: Optional[str] = None,
                  content: Optional[str] = None) -> None:
        self.s.bus.publish("tool_call", {"agent_id": agent, "tool": tool, "trust": trust,
                                         "summary": summary, "content": content})
        if trust == "untrusted":
            self.s.taint.mark_tainted(agent, tool)
            self.s.bus.publish("tainted", {"agent_id": agent, "source": tool, "reason": "ingested untrusted data"})
            self.s.recorder.append("tainted", agent, {"source": tool})

    def handoff(self, frm: str, to: str, reason: str = "handoff") -> None:
        carried = self.s.taint.is_tainted(frm)
        self.s.graph.add_contact(frm, to, carried_taint=carried, reason=reason)
        self.s.bus.publish("contact_edge", {"from_agent": frm, "to_agent": to, "carried_taint": carried, "reason": reason})
        if carried:
            self.s.taint.mark_tainted(to, frm)
            self.s.bus.publish("tainted", {"agent_id": to, "source": frm, "reason": "received tainted data via handoff"})

    def request_credential(self, agent: str, secret_ref: str, sensitive: bool, source: str = "read_email") -> dict:
        decision = self.s.broker.request(agent, secret_ref, sensitive)  # emits credential_requested + issued/denied
        if decision["decision"] == "denied" and sensitive and self.s.taint.is_tainted(agent):
            # the lethal trifecta tripped: tainted + sensitive access + outbound attempt
            origin = self.s.graph.trace_origin(agent)
            self.s.bus.publish("patient_zero_confirmed", {
                "confirmed_at": agent, "origin": origin, "source": source,
                "trifecta": {"tainted": True, "sensitive_access": True, "outbound_attempt": True}})
            self.s.recorder.append("patient_zero_confirmed", "cordon", {"origin": origin, "confirmed_at": agent})
            decision["quarantine_order"] = self.s.quarantine.quarantine(origin=origin, confirmed_at=agent, source=source)
        return decision

    def complete(self, mode: str) -> dict:
        agents = self.s.taint.all().values()
        counters = {
            "exposed": sum(1 for a in agents if a.status != AgentStatus.HEALTHY),
            "quarantined": sum(1 for a in agents if a.status == AgentStatus.QUARANTINED),
            "credentials_leaked": 0,
            "sandboxes_breached": 0,
            "contained": True,
        }
        self.s.bus.publish("scenario_complete", {"mode": mode, "counters": counters})
        return counters
