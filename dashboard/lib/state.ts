// Pure reducer: (UIState, CordonEvent) => UIState. The single mapping from the
// SSE event stream to everything the dashboard renders. Mirrors EVENT_CONTRACT.md.
import type { AgentStatus, CordonEvent, Mode } from "./events";

export type LogTone = "muted" | "info" | "taint" | "danger" | "quarantine" | "ok";

export type VaultState = "none" | "issued" | "locked" | "revoked";

export interface AgentUI {
  agent_id: string;
  name: string;
  role: string;
  status: AgentStatus;
  holds_sensitive: boolean;
  credential?: string;
  vault: VaultState;
  taintSources: string[];
  quarantineOrder?: number;
}

export interface EdgeUI {
  id: string;
  from: string;
  to: string;
  carried_taint: boolean;
  reason: string;
  seq: number;
}

export interface LogEntry {
  key: number;
  ts: string;
  tone: LogTone;
  text: string;
}

export interface RecorderRow {
  seq: number;
  timestamp: string;
  event_type: string;
  actor: string;
  details: Record<string, unknown>;
  prev_hash: string;
  entry_hash: string;
  signature: string;
  pubkey_id: string;
}

export interface UIState {
  mode: Mode;
  agents: Record<string, AgentUI>;
  order: string[];
  edges: EdgeUI[];
  log: LogEntry[];
  recorder: RecorderRow[];
  counters: { exposed: number; leaked: number; breached: number };
  contained: boolean | null;
  patientZero?: string;
  quarantineOrder: string[];
  hero: { state: "guarded" | "requested" | "denied" | "released" | "leaked"; by?: string; secret_ref?: string };
  incomingEmail?: { content: string; agent: string };
  lastSeq: number;
}

export const initialState: UIState = {
  mode: "on",
  agents: {},
  order: [],
  edges: [],
  log: [],
  recorder: [],
  counters: { exposed: 0, leaked: 0, breached: 0 },
  contained: null,
  quarantineOrder: [],
  hero: { state: "guarded" },
  lastSeq: 0,
};

const LOG_CAP = 120;
const RANK: Record<AgentStatus, number> = { healthy: 0, tainted: 1, compromised: 2, quarantined: 3 };

const shortRef = (r: string) => r.replace(/^op:\/\//, "");
const maxStatus = (a: AgentStatus, b: AgentStatus) => (RANK[a] >= RANK[b] ? a : b);
const exposedCount = (agents: Record<string, AgentUI>) =>
  Object.values(agents).filter((a) => a.status !== "healthy").length;

function pushLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
  const next = [...log, entry];
  return next.length > LOG_CAP ? next.slice(next.length - LOG_CAP) : next;
}

function patchAgent(state: UIState, id: string, patch: Partial<AgentUI>): Record<string, AgentUI> {
  const cur: AgentUI =
    state.agents[id] ??
    { agent_id: id, name: id, role: "", status: "healthy", holds_sensitive: false, vault: "none", taintSources: [] };
  return { ...state.agents, [id]: { ...cur, ...patch } };
}

export function reduce(state: UIState, env: CordonEvent): UIState {
  const { ts, seq } = env;

  switch (env.event) {
    case "scenario_started": {
      const agents: Record<string, AgentUI> = {};
      const order: string[] = [];
      for (const a of env.data.agents) {
        agents[a.agent_id] = {
          agent_id: a.agent_id, name: a.name, role: a.role, status: "healthy",
          holds_sensitive: a.holds_sensitive, vault: "none", taintSources: [],
        };
        order.push(a.agent_id);
      }
      return {
        ...initialState, mode: env.data.mode, agents, order, lastSeq: seq,
        log: pushLog([], { key: seq, ts, tone: "info", text: `run started · CORDON ${env.data.mode.toUpperCase()}` }),
      };
    }

    case "agent_registered": {
      const agents = patchAgent(state, env.data.agent_id, {
        name: env.data.name, role: env.data.role,
        status: state.agents[env.data.agent_id]?.status ?? "healthy",
      });
      const order = state.order.includes(env.data.agent_id) ? state.order : [...state.order, env.data.agent_id];
      return { ...state, agents, order, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "muted", text: `agent registered · ${env.data.agent_id}` }) };
    }

    case "credential_issued": {
      const cur = state.agents[env.data.agent_id];
      const tainted = !!cur && cur.status !== "healthy";
      if (env.data.sensitive && tainted) {
        // CORDON OFF: the broker handed a sensitive secret to a tainted agent (the leak)
        return { ...state, hero: { state: "released", by: env.data.agent_id, secret_ref: env.data.secret_ref }, lastSeq: seq,
          log: pushLog(state.log, { key: seq, ts, tone: "danger", text: `cred issued · ${env.data.agent_id} · ${shortRef(env.data.secret_ref)} · LEAK` }) };
      }
      const agents = patchAgent(state, env.data.agent_id, { credential: env.data.secret_ref, vault: "issued" });
      // seed the hero card's title from the sensitive holder's credential, at registration
      const hero =
        env.data.sensitive && state.hero.state === "guarded"
          ? { ...state.hero, secret_ref: env.data.secret_ref }
          : state.hero;
      return { ...state, agents, hero, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "ok", text: `cred issued · ${env.data.agent_id} · ${shortRef(env.data.secret_ref)}` }) };
    }

    case "tool_call": {
      const incomingEmail = env.data.content
        ? { content: env.data.content, agent: env.data.agent_id }
        : state.incomingEmail;
      return { ...state, incomingEmail, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: env.data.trust === "untrusted" ? "taint" : "muted",
          text: `tool · ${env.data.agent_id} → ${env.data.tool} [${env.data.trust}]` }) };
    }

    case "tainted": {
      const cur = state.agents[env.data.agent_id];
      const status = maxStatus(cur?.status ?? "healthy", "tainted");
      const taintSources = Array.from(new Set([...(cur?.taintSources ?? []), env.data.source]));
      const agents = patchAgent(state, env.data.agent_id, { status, taintSources });
      return { ...state, agents, counters: { ...state.counters, exposed: exposedCount(agents) }, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "taint", text: `tainted · ${env.data.agent_id} ← ${env.data.source}` }) };
    }

    case "contact_edge": {
      const id = `${env.data.from_agent}->${env.data.to_agent}`;
      const edges = [...state.edges.filter((e) => e.id !== id),
        { id, from: env.data.from_agent, to: env.data.to_agent, carried_taint: env.data.carried_taint, reason: env.data.reason, seq }];
      return { ...state, edges, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: env.data.carried_taint ? "taint" : "muted",
          text: `contact · ${env.data.from_agent}→${env.data.to_agent}${env.data.carried_taint ? " (taint)" : ""}` }) };
    }

    case "credential_requested": {
      const hero = env.data.sensitive
        ? { state: "requested" as const, by: env.data.agent_id, secret_ref: env.data.secret_ref }
        : state.hero;
      return { ...state, hero, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: env.data.sensitive ? "info" : "muted",
          text: `cred requested · ${env.data.agent_id} · ${shortRef(env.data.secret_ref)}${env.data.sensitive ? " [sensitive]" : ""}` }) };
    }

    case "credential_denied":
      return { ...state, hero: { state: "denied", by: env.data.agent_id, secret_ref: env.data.secret_ref }, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "danger",
          text: `DENIED · ${env.data.agent_id} · ${shortRef(env.data.secret_ref)} · 1Password not queried` }) };

    case "credential_exfiltrated":
      return { ...state, contained: false,
        hero: { state: "leaked", by: env.data.agent_id, secret_ref: env.data.secret_ref },
        counters: { ...state.counters, leaked: state.counters.leaked + 1, breached: state.counters.breached + 1 }, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "danger", text: `EXFILTRATED · ${env.data.agent_id} → ${env.data.destination}` }) };

    case "patient_zero_confirmed":
      return { ...state, patientZero: env.data.origin, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "danger", text: `PATIENT ZERO · origin ${env.data.origin} · trifecta confirmed` }) };

    case "quarantine_started":
      return { ...state, quarantineOrder: env.data.order, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "quarantine", text: `quarantine · exposed [${env.data.exposed_set.join(", ")}]` }) };

    case "agent_quarantined": {
      const agents = patchAgent(state, env.data.agent_id, { status: "quarantined", vault: "revoked", quarantineOrder: env.data.order_index });
      return { ...state, agents, counters: { ...state.counters, exposed: exposedCount(agents) }, lastSeq: seq,
        log: pushLog(state.log, { key: seq, ts, tone: "quarantine", text: `QUARANTINED · ${env.data.agent_id} · revoked + frozen` }) };
    }

    case "recorder_entry":
      return { ...state, recorder: [...state.recorder, env.data as RecorderRow], lastSeq: seq };

    case "scenario_complete": {
      const c = env.data.counters;
      return { ...state, contained: c.contained, lastSeq: seq,
        counters: { exposed: c.exposed, leaked: c.credentials_leaked, breached: c.sandboxes_breached },
        log: pushLog(state.log, { key: seq, ts, tone: c.contained ? "ok" : "danger", text: `run complete · ${c.contained ? "CONTAINED" : "BREACH"}` }) };
    }

    default:
      return state;
  }
}
