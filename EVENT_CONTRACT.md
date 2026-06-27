# CORDON — Event Contract (source of truth)

This is the interface that decouples the three moving parts:

- **Control plane** (FastAPI) — *emits* events over SSE as the live swarm runs.
- **Demo replay** (`demo/replay.py`) — *re-emits* a scripted timeline over the **same** SSE channel.
- **Dashboard** (Next.js) — *consumes* events and maps them to UI state.

Because the dashboard only ever sees this event stream, it can be built and polished
entirely against `demo/scenario.json` **before the live swarm exists**. That is the
whole point of locking this first.

> **Two implementations, kept in sync:**
> - Python: [`control_plane/models.py`](control_plane/models.py) (Pydantic v2)
> - TypeScript: [`dashboard/lib/events.ts`](dashboard/lib/events.ts)
> If you change one, change the other.

---

## Envelope

Every event on the wire is:

```jsonc
{ "event": "<EventType>", "seq": 42, "ts": "2026-06-27T13:05:01.123Z", "data": { ... } }
```

- `seq` — monotonic per run, **injected by the emitter** (not stored in `scenario.json`).
- `ts` — ISO-8601, **injected by the emitter**.
- `data` — shape depends on `event` (table below).

On the SSE transport, `event` becomes the SSE `event:` field and the JSON-encoded
`{seq, ts, data}` becomes the `data:` field (sse-starlette: `yield {"event": t, "data": json}`).

---

## Agent roster (the 5-agent swarm)

| agent_id | name | role | holds sensitive cred? |
|---|---|---|---|
| `orchestrator` | Orchestrator | Delegates the human task | no |
| `inbox` | Inbox | Reads & triages email (**untrusted** source) | no |
| `research` | Research | Looks things up on the web (**untrusted**) | no |
| `coder` | Coder | Writes & edits code | no |
| `deployer` | Deployer | Ships to production | **yes** (production deploy key) |

The hero credential ref used throughout: `op://Production/Deploy Key/credential`.

---

## State → color (used consistently everywhere)

| status | color | meaning |
|---|---|---|
| `healthy` | green | clean / trusted |
| `tainted` | amber | touched untrusted data — *contained, still allowed safe work* |
| `compromised` | red | patient zero / active breach |
| `quarantined` | blue | frozen + credentials revoked |
| (locked secret) | grey | a secret that is not released |

> **Reducer rule for the OFF/ON toggle:** amber only reads as "safely contained"
> when CORDON is **ON**. In **OFF** mode there is no immune system, so the dashboard
> renders the *same* `tainted` status as **red** (active infection). Same taint, two
> meanings depending on whether CORDON is running. This needs no extra events.

---

## Event types

| event | data fields | when |
|---|---|---|
| `scenario_started` *(added)* | `mode` ("off"\|"on"), `agents[]` | resets dashboard, builds the graph nodes |
| `agent_registered` | `agent_id, name, role, status, sandbox_id?, credential_ref?` | live mode: an agent comes up |
| `tool_call` | `agent_id, tool, trust, summary?` | an agent invokes a tool through the proxy |
| `tainted` | `agent_id, source, reason` | an agent ingested untrusted data (or received it via handoff) |
| `contact_edge` | `from_agent, to_agent, carried_taint, reason` | a handoff/delegation edge is recorded |
| `credential_requested` | `agent_id, secret_ref, sensitive` | an agent asks the broker for a secret |
| `credential_issued` | `agent_id, secret_ref, sensitive, token_id?, onepassword_queried` | broker released a (short-lived) credential |
| `credential_denied` | `agent_id, secret_ref, sensitive, reason, onepassword_queried(=false)` | **the hero moment** — broker refused; 1Password never queried |
| `credential_exfiltrated` *(added)* | `agent_id, secret_ref, destination, note?` | CORDON-OFF breach path: a leaked secret leaves the swarm |
| `patient_zero_confirmed` | `confirmed_at, origin, source, trifecta{tainted,sensitive_access,outbound_attempt}` | the lethal trifecta tripped |
| `quarantine_started` | `patient_zero, exposed_set[], order[]` | cascade begins (`nx.descendants`, topological order) |
| `agent_quarantined` | `agent_id, actions[], order_index` | one agent revoked + frozen |
| `recorder_entry` | `seq, timestamp, event_type, actor, details, prev_hash, entry_hash, signature, pubkey_id` | a signed hash-chained log line was appended |
| `scenario_complete` | `mode, counters{exposed,quarantined,credentials_leaked,sandboxes_breached,contained}` | run finished |

### Two additions vs. the plan's §8 list (flagged on purpose)
- **`scenario_started`** — gives the dashboard a clean reset + node roster + the OFF/ON mode. Pulled forward because demo mode is now the spine, not the last phase.
- **`credential_exfiltrated`** — the plan's OFF path ("Deployer exfiltrates") had no event for the actual breach. This makes the "watch it burn" half of the demo expressive.

`recorder_entry.seq` is the **hash-chain index** and is independent of the envelope `seq`.

---

## Persistent per-agent state (control plane, §8 of the plan)

`TaintStateRecord`: `agent_id, status, taint_sources[], held_credentials[], sandbox_id?`
— monotonic within a run (once tainted, stays tainted).

---

## The two timelines in `demo/scenario.json`

- `cordon_off` — orchestrator→inbox→(reads poisoned email)→research→coder→**broker releases the prod key**→deployer **exfiltrates**. Ends: 0 contained, production credential leaked. *("Most Likely to Get You Fired".)*
- `cordon_on` — same attack → Inbox amber → taint rides the handoffs → Coder requests the prod key → **`credential_denied`, 1Password never queried** → patient zero confirmed → cascade quarantines inbox/research/coder in topological order → deployer stays green → signed recorder verifies. Ends: 0 leaked, contained.
