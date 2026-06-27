"""
CORDON event & data contract — backend source of truth (Pydantic v2).

This module defines the shapes that flow over the SSE stream between the control
plane (emitter), the demo replay engine, and the dashboard (consumer). The
TypeScript mirror lives in ``dashboard/lib/events.ts`` and MUST be kept in sync.

Nothing here imports Daytona / 1Password / OpenAI — the contract is deliberately
account-free so both build tracks can start against it immediately.

See EVENT_CONTRACT.md for the human-readable spec.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class AgentStatus(str, Enum):
    HEALTHY = "healthy"          # green  — clean / trusted
    TAINTED = "tainted"          # amber  — touched untrusted data, still allowed safe work
    COMPROMISED = "compromised"  # red    — patient zero / active breach
    QUARANTINED = "quarantined"  # blue   — frozen + credentials revoked


class TrustLabel(str, Enum):
    TRUSTED = "trusted"
    UNTRUSTED = "untrusted"
    SENSITIVE_OUTBOUND = "sensitive_outbound"


class CredentialDecision(str, Enum):
    ISSUED = "issued"
    DENIED = "denied"


class EventType(str, Enum):
    SCENARIO_STARTED = "scenario_started"            # [added] reset + roster + mode
    AGENT_REGISTERED = "agent_registered"
    TOOL_CALL = "tool_call"
    TAINTED = "tainted"
    CONTACT_EDGE = "contact_edge"
    CREDENTIAL_REQUESTED = "credential_requested"
    CREDENTIAL_ISSUED = "credential_issued"
    CREDENTIAL_DENIED = "credential_denied"
    CREDENTIAL_EXFILTRATED = "credential_exfiltrated"  # [added] CORDON-OFF breach
    PATIENT_ZERO_CONFIRMED = "patient_zero_confirmed"
    QUARANTINE_STARTED = "quarantine_started"
    AGENT_QUARANTINED = "agent_quarantined"
    RECORDER_ENTRY = "recorder_entry"
    SCENARIO_COMPLETE = "scenario_complete"


# --------------------------------------------------------------------------- #
# Shared / domain shapes
# --------------------------------------------------------------------------- #
class AgentInfo(BaseModel):
    agent_id: str
    name: str
    role: str
    holds_sensitive: bool = False


class TaintStateRecord(BaseModel):
    """Persistent per-agent state in the control plane (monotonic within a run)."""
    agent_id: str
    status: AgentStatus = AgentStatus.HEALTHY
    taint_sources: list[str] = Field(default_factory=list)
    held_credentials: list[str] = Field(default_factory=list)
    sandbox_id: Optional[str] = None


class Trifecta(BaseModel):
    tainted: bool
    sensitive_access: bool
    outbound_attempt: bool


class Counters(BaseModel):
    exposed: int = 0
    quarantined: int = 0
    credentials_leaked: int = 0
    sandboxes_breached: int = 0
    contained: bool = True


# --------------------------------------------------------------------------- #
# Per-event data payloads
# --------------------------------------------------------------------------- #
class ScenarioStartedData(BaseModel):
    mode: str                       # "off" | "on"
    agents: list[AgentInfo]


class AgentRegisteredData(BaseModel):
    agent_id: str
    name: str
    role: str
    status: AgentStatus = AgentStatus.HEALTHY
    sandbox_id: Optional[str] = None
    credential_ref: Optional[str] = None


class ToolCallData(BaseModel):
    agent_id: str
    tool: str
    trust: TrustLabel
    summary: Optional[str] = None
    content: Optional[str] = None  # the untrusted payload (e.g. the poisoned email body)


class TaintedData(BaseModel):
    agent_id: str
    source: str                     # tool name or upstream agent id
    reason: str


class ContactEdgeData(BaseModel):
    from_agent: str
    to_agent: str
    carried_taint: bool = False
    reason: str = "handoff"


class CredentialRequestedData(BaseModel):
    agent_id: str
    secret_ref: str
    sensitive: bool


class CredentialIssuedData(BaseModel):
    agent_id: str
    secret_ref: str
    sensitive: bool
    token_id: Optional[str] = None  # short-lived handle, NEVER the secret value
    onepassword_queried: bool = True


class CredentialDeniedData(BaseModel):
    agent_id: str
    secret_ref: str
    sensitive: bool
    reason: str
    onepassword_queried: bool = False  # the whole point: we never even asked


class CredentialExfiltratedData(BaseModel):
    agent_id: str
    secret_ref: str
    destination: str
    note: Optional[str] = None


class PatientZeroConfirmedData(BaseModel):
    confirmed_at: str               # agent where the trifecta tripped
    origin: str                     # traced-back patient zero (nx.ancestors)
    source: str                     # the untrusted channel that started it
    trifecta: Trifecta


class QuarantineStartedData(BaseModel):
    patient_zero: str
    exposed_set: list[str]
    order: list[str]                # topological order of the cascade


class AgentQuarantinedData(BaseModel):
    agent_id: str
    actions: list[str]              # e.g. ["credential_revoked", "sandbox_frozen", "network_blocked"]
    order_index: int


class RecorderEntryData(BaseModel):
    seq: int                        # hash-chain index (independent of envelope seq)
    timestamp: str
    event_type: str
    actor: str
    details: dict
    prev_hash: str
    entry_hash: str
    signature: str
    pubkey_id: str


class ScenarioCompleteData(BaseModel):
    mode: str
    counters: Counters


# --------------------------------------------------------------------------- #
# Envelope
# --------------------------------------------------------------------------- #
class Event(BaseModel):
    event: EventType
    seq: int = Field(..., description="monotonic SSE sequence, injected at emit time")
    ts: str = Field(..., description="ISO-8601 emit timestamp, injected at emit time")
    data: dict


# Maps each event type to the model that validates its `data` payload.
EVENT_DATA_MODELS: dict[EventType, type[BaseModel]] = {
    EventType.SCENARIO_STARTED: ScenarioStartedData,
    EventType.AGENT_REGISTERED: AgentRegisteredData,
    EventType.TOOL_CALL: ToolCallData,
    EventType.TAINTED: TaintedData,
    EventType.CONTACT_EDGE: ContactEdgeData,
    EventType.CREDENTIAL_REQUESTED: CredentialRequestedData,
    EventType.CREDENTIAL_ISSUED: CredentialIssuedData,
    EventType.CREDENTIAL_DENIED: CredentialDeniedData,
    EventType.CREDENTIAL_EXFILTRATED: CredentialExfiltratedData,
    EventType.PATIENT_ZERO_CONFIRMED: PatientZeroConfirmedData,
    EventType.QUARANTINE_STARTED: QuarantineStartedData,
    EventType.AGENT_QUARANTINED: AgentQuarantinedData,
    EventType.RECORDER_ENTRY: RecorderEntryData,
    EventType.SCENARIO_COMPLETE: ScenarioCompleteData,
}


def validate_event_data(event_type: EventType, data: dict) -> BaseModel:
    """Validate a raw `data` dict against the model registered for its event type."""
    model = EVENT_DATA_MODELS[event_type]
    return model.model_validate(data)
