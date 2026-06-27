// CORDON event & data contract — frontend source of truth.
// Mirror of control_plane/models.py. If you change one, change the other.
// See EVENT_CONTRACT.md for the human-readable spec.

export type AgentStatus = "healthy" | "tainted" | "compromised" | "quarantined";
export type TrustLabel = "trusted" | "untrusted" | "sensitive_outbound";
export type CredentialDecision = "issued" | "denied";
export type Mode = "off" | "on";

export type EventType =
  | "scenario_started"
  | "agent_registered"
  | "tool_call"
  | "tainted"
  | "contact_edge"
  | "credential_requested"
  | "credential_issued"
  | "credential_denied"
  | "credential_exfiltrated"
  | "patient_zero_confirmed"
  | "quarantine_started"
  | "agent_quarantined"
  | "recorder_entry"
  | "scenario_complete";

// --------------------------------------------------------------------------- //
// Shared shapes
// --------------------------------------------------------------------------- //
export interface AgentInfo {
  agent_id: string;
  name: string;
  role: string;
  holds_sensitive: boolean;
}

export interface Trifecta {
  tainted: boolean;
  sensitive_access: boolean;
  outbound_attempt: boolean;
}

export interface Counters {
  exposed: number;
  quarantined: number;
  credentials_leaked: number;
  sandboxes_breached: number;
  contained: boolean;
}

// --------------------------------------------------------------------------- //
// Per-event data payloads
// --------------------------------------------------------------------------- //
export interface ScenarioStartedData { mode: Mode; agents: AgentInfo[]; }

export interface AgentRegisteredData {
  agent_id: string;
  name: string;
  role: string;
  status: AgentStatus;
  sandbox_id?: string | null;
  credential_ref?: string | null;
}

export interface ToolCallData { agent_id: string; tool: string; trust: TrustLabel; summary?: string | null; content?: string | null; }

export interface TaintedData { agent_id: string; source: string; reason: string; }

export interface ContactEdgeData { from_agent: string; to_agent: string; carried_taint: boolean; reason: string; }

export interface CredentialRequestedData { agent_id: string; secret_ref: string; sensitive: boolean; }

export interface CredentialIssuedData {
  agent_id: string;
  secret_ref: string;
  sensitive: boolean;
  token_id?: string | null;        // short-lived handle, NEVER the secret value
  onepassword_queried: boolean;
}

export interface CredentialDeniedData {
  agent_id: string;
  secret_ref: string;
  sensitive: boolean;
  reason: string;
  onepassword_queried: boolean;    // the whole point: false
}

export interface CredentialExfiltratedData {
  agent_id: string;
  secret_ref: string;
  destination: string;
  note?: string | null;
}

export interface PatientZeroConfirmedData {
  confirmed_at: string;            // where the trifecta tripped
  origin: string;                  // traced-back patient zero
  source: string;                  // the untrusted channel that started it
  trifecta: Trifecta;
}

export interface QuarantineStartedData { patient_zero: string; exposed_set: string[]; order: string[]; }

export interface AgentQuarantinedData { agent_id: string; actions: string[]; order_index: number; }

export interface RecorderEntryData {
  seq: number;                     // hash-chain index (independent of envelope seq)
  timestamp: string;
  event_type: string;
  actor: string;
  details: Record<string, unknown>;
  prev_hash: string;
  entry_hash: string;
  signature: string;
  pubkey_id: string;
}

export interface ScenarioCompleteData { mode: Mode; counters: Counters; }

// --------------------------------------------------------------------------- //
// Envelope + discriminated union
// --------------------------------------------------------------------------- //
interface Envelope<T extends EventType, D> {
  event: T;
  seq: number;
  ts: string;
  data: D;
}

export type CordonEvent =
  | Envelope<"scenario_started", ScenarioStartedData>
  | Envelope<"agent_registered", AgentRegisteredData>
  | Envelope<"tool_call", ToolCallData>
  | Envelope<"tainted", TaintedData>
  | Envelope<"contact_edge", ContactEdgeData>
  | Envelope<"credential_requested", CredentialRequestedData>
  | Envelope<"credential_issued", CredentialIssuedData>
  | Envelope<"credential_denied", CredentialDeniedData>
  | Envelope<"credential_exfiltrated", CredentialExfiltratedData>
  | Envelope<"patient_zero_confirmed", PatientZeroConfirmedData>
  | Envelope<"quarantine_started", QuarantineStartedData>
  | Envelope<"agent_quarantined", AgentQuarantinedData>
  | Envelope<"recorder_entry", RecorderEntryData>
  | Envelope<"scenario_complete", ScenarioCompleteData>;

// --------------------------------------------------------------------------- //
// Color tokens (single accent per state). Tailwind-friendly hex.
// --------------------------------------------------------------------------- //
export const STATUS_COLORS: Record<AgentStatus, string> = {
  healthy: "#22c55e",      // green
  tainted: "#f59e0b",      // amber (contained when CORDON ON)
  compromised: "#ef4444",  // red
  quarantined: "#3b82f6",  // blue
};

export const LOCKED_SECRET_COLOR = "#6b7280"; // grey

/**
 * OFF/ON reducer rule: amber only means "safely contained" when CORDON is ON.
 * In OFF mode there is no immune system, so render `tainted` as compromised (red).
 */
export function displayStatus(status: AgentStatus, mode: Mode): AgentStatus {
  if (mode === "off" && status === "tainted") return "compromised";
  return status;
}
